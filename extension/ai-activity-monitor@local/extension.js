// AI Activity Monitor: GNOME Shell 46 extension entry point. Wires the spool watcher,
// session store, liveness sweep, indicators, preview card and notifier.

import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {SessionStore} from './lib/core/store.js';
import {State} from './lib/core/model.js';
import {NotifyKind} from './lib/core/policy.js';
import {SpoolWatcher, defaultSpoolDir} from './lib/spool.js';
import {processIdentity, listProcesses} from './lib/procs.js';
import {providerInfo} from './lib/providers.js';
import {Notifier} from './lib/notifier.js';
import {EdgeIndicators} from './lib/ui/indicators.js';
import {PreviewCard} from './lib/ui/preview.js';
import {focusTerminal, openTerminal} from './lib/windows.js';
import {DevControl} from './lib/devcontrol.js';
import {DesktopState} from './lib/desktopstate.js';
import {release} from './lib/core/roaming.js';
import {PanelIndicators} from './lib/ui/panel.js';

const LIVENESS_SECONDS = 4;
const DECAY_SECONDS = 15;
const ENDED_LINGER_MS = 2500;
const NO_PID_STALE_SECONDS = 12 * 3600;
const DETACH_GRACE_SECONDS = 20;

export default class AiActivityMonitorExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._store = new SessionStore({policy: this._policy(), holdSeconds: this._settings.get_int('completed-hold-seconds')});
        this._files = new Map(); // session key -> spool path
        this._lastTs = new Map(); // spool path -> newest event timestamp seen
        this._identities = new Map(); // session key -> process identity
        this._pruneTimers = new Map();
        this._clientPids = new Map(); // session key -> attached client pid
        this._detachedSince = new Map();
        this._renderId = 0;

        this._notifier = new Notifier(this.dir, {onFocus: key => this._focus(key)});
        this._indicators = new EdgeIndicators(this.dir, {
            onTileClicked: (p, tile) => this._togglePreview(p, tile.wrapper),
            onDragStart: () => this._preview?.close(),
            onMoved: (provider, x, y) => {
                // Each tile remembers its own dragged position.
                const positions = this._positions();
                positions[provider] = {x, y};
                this._settings.set_string('tile-positions', JSON.stringify(positions));
            },
            onReleased: provider => {
                // Double click on a parked tile: forget its position, it roams again.
                this._settings.set_string('tile-positions', JSON.stringify(release(this._positions(), provider)));
            },
            onLayoutChanged: () => this._applyCover(),
        });
        this._preview = new PreviewCard(this.dir, {
            focus: key => this._focus(key),
            open: key => this._open(key),
            dismiss: () => this._dismiss(),
            changed: () => this._applyCover(),
        }, () => this._indicators.lowestActor);
        this._desktop = new DesktopState(() => this._applyCover());
        this._panel = new PanelIndicators(this.dir, {
            onClicked: (p, anchor) => this._togglePreview(p, anchor),
            onDragStart: () => this._preview?.close(),
            onPlaced: placement => this._settings.set_string('panel-placement', JSON.stringify(placement)),
        });
        this._applyLayout();
        this._settingsId = this._settings.connect('changed', () => {
            this._store.policy = {...this._store.policy, ...this._policy()};
            this._store.holdSeconds = this._settings.get_int('completed-hold-seconds');
            this._applyLayout();
            this._scheduleRender();
        });

        // Reduced motion and software rendering toggle this at runtime.
        this._animId = St.Settings.get().connect('notify::enable-animations', () => this._scheduleRender());

        this._spool = new SpoolWatcher(defaultSpoolDir(), (path, lines, opts) => this._onLines(path, lines, opts));
        this._spool.start();
        this._checkLiveness(true);
        this._repostPending();
        this._scheduleRender();

        this._livenessId = GLib.timeout_add_seconds(GLib.PRIORITY_LOW, LIVENESS_SECONDS, () => {
            this._checkLiveness(false);
            return GLib.SOURCE_CONTINUE;
        });
        // Test harness only: honoured solely for a path inside the harness's own
        // runtime folder, so a stray variable cannot enable it elsewhere.
        const devPath = GLib.getenv('AIMON_DEV_CONTROL');
        const devRoot = `${GLib.get_user_runtime_dir()}/aimon-dev/`;
        this._dev = devPath && devPath.startsWith(devRoot) && !devPath.includes('..')
            ? new DevControl(devPath, this._devApi()) : null;

        this._decayId = GLib.timeout_add_seconds(GLib.PRIORITY_LOW, DECAY_SECONDS, () => {
            if (this._store.decayAll().length || this._preview.isOpen)
                this._scheduleRender();
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        for (const id of [this._livenessId, this._decayId, this._renderId, ...this._pruneTimers.values()]) {
            if (id)
                GLib.source_remove(id);
        }
        this._pruneTimers.clear();
        this._livenessId = this._decayId = this._renderId = 0;
        this._settings.disconnect(this._settingsId);
        St.Settings.get().disconnect(this._animId);
        this._dev?.destroy();
        this._dev = null;
        this._desktop.destroy();
        this._desktop = null;
        this._panel.destroy();
        this._panel = null;
        this._spool.stop();
        this._preview.destroy();
        this._indicators.destroy();
        this._notifier.destroy();
        this._spool = this._preview = this._indicators = this._notifier = null;
        this._store = this._settings = null;
        this._files.clear();
        this._lastTs.clear();
        this._identities.clear();
        this._clientPids.clear();
        this._detachedSince.clear();
    }

    // Test harness API (only used when AIMON_DEV_CONTROL is set).
    _devApi() {
        const rect = a => {
            const [x, y] = a.get_transformed_position();
            const [w, h] = a.get_transformed_size();
            return {x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), visible: a.visible};
        };
        const previewState = () => ({open: this._preview.isOpen, provider: this._preview.provider,
            selected: this._preview.selectedKey, rect: rect(this._preview.actor)});
        return {
            clickTile: provider => {
                const tile = this._indicators.tileFor(provider);
                if (!tile)
                    return {error: `no tile for ${provider}`};
                this._togglePreview(provider, tile.wrapper);
                return previewState();
            },
            clickPill: i => {
                this._preview.pills[i]?.emit('clicked', 1);
                return previewState();
            },
            clickAction: label => {
                const b = this._preview.actionButtons.get(label);
                if (!b)
                    return {error: `no action ${label}`};
                b.emit('clicked', 1);
                return previewState();
            },
            setSetting: (key, text) => {
                this._settings.set_value(key, GLib.Variant.parse(null, text, null, null));
                return {[key]: this._settings.get_value(key).print(true)};
            },
            dump: () => ({
                panelBoxes: Object.fromEntries(['_leftBox', '_centerBox', '_rightBox'].map(b => [b, rect(Main.panel[b])])),
                previewRect: rect(this._preview.actor),
                input: {modalCount: Main.modalCount, grabActor: String(global.stage.get_grab_actor?.() ?? null),
                    dateMenuOpen: Main.panel.statusArea.dateMenu?.menu?.isOpen ?? null},
                panel: this._panel.icons.map(i => ({provider: i.provider, motion: i.motion, rect: rect(i.button),
                    tooltip: i.tooltip.visible})),
                tiles: this._indicators.tiles.map(t => ({provider: t.provider, shown: t.shown, bouncing: t.bouncing, motion: t.motion,
                    covered: this._desktop.isCovered(t.rect), rect: rect(t.wrapper), tooltip: t.tooltip.visible,
                    bubble: t.bubble.visible ? t.bubble.text : null})),
                buttons: Object.fromEntries([...this._preview.actionButtons].map(([k, b]) => [k, rect(b)])),
                groups: [...this._store.byProvider({hideIdle: this._settings.get_boolean('hide-idle')}).values()]
                    .filter(g => this._indicators.tileFor(g.provider)).map(g => ({
                    provider: g.provider, state: g.state, count: g.count,
                    detail: g.primary.detail,
                    tile: rect(this._indicators.tileFor(g.provider).button),
                })),
                preview: previewState(),
                animationsEnabled: St.Settings.get().enable_animations,
                notifications: Main.messageTray.getSources().map(src => ({title: src.title, count: src.notifications.length,
                    items: src.notifications.map(n => n.title)})),
            }),
        };
    }

    _policy() {
        const s = this._settings;
        return {
            notifyCompleted: s.get_boolean('notify-completed'),
            notifyApproval: s.get_boolean('notify-approval'),
            notifyError: s.get_boolean('notify-error'),
            notifyTerminated: s.get_boolean('notify-terminated'),
            minTurnSeconds: s.get_int('min-turn-seconds'),
        };
    }

    _applyLayout() {
        const s = this._settings;
        this._indicators.configure({
            edge: s.get_string('edge'),
            offsetX: s.get_int('offset-x'),
            offsetY: s.get_int('offset-y'),
            size: s.get_int('icon-size'),
            spacing: s.get_int('spacing'),
            animate: s.get_boolean('animate-working'),
            positions: this._positions(),
        });
        let placement = {};
        try {
            placement = JSON.parse(s.get_string('panel-placement'));
        } catch {}
        this._panel.setPlacement(placement);
    }

    _onLines(path, lines, {replaying, reset}) {
        const now = Date.now() / 1000;
        // After a compaction the whole file is replayed silently, except lines
        // newer than anything seen before, which still notify.
        const seenUpTo = this._lastTs.get(path) ?? 0;
        let orphan = false;
        for (const line of lines) {
            let ts = 0;
            try {
                ts = Number(JSON.parse(line).ts) || 0;
            } catch {}
            const silent = replaying && !(reset && ts > seenUpTo);
            if (ts > (this._lastTs.get(path) ?? 0))
                this._lastTs.set(path, ts);
            if (reset) {
                // Compacted file: rebuild this session from its retained lines.
                try {
                    const first = JSON.parse(line);
                    const key = `${first.provider}:${first.session}`;
                    if (this._files.get(key) === path)
                        this._store.remove(key);
                } catch {}
                reset = false;
            }
            const result = this._store.ingestLine(line, {replaying: silent, now});
            if (!result) {
                // An end event for a session never seen (left over from an
                // earlier run): nothing to show, so remove the file.
                if (/"kind":"session_end"/.test(line) && ![...this._files.values()].includes(path))
                    orphan = true;
                continue;
            }
            orphan = false;
            const {session, prev, notify} = result;
            this._files.set(session.key, path);
            if (prev?.state === State.WAITING && session.state !== State.WAITING)
                this._notifier.withdraw(session.key, [NotifyKind.APPROVAL, NotifyKind.INPUT]);
            if (notify)
                this._notifier.notify(session, notify);
            if (session.state === State.ENDED)
                this._schedulePrune(session.key, silent ? 0 : ENDED_LINGER_MS);
        }
        if (orphan) {
            this._lastTs.delete(path);
            this._spool.deleteFile(path);
        }
        this._scheduleRender();
    }

    // Replay is silent, but an approval that is still pending is actionable:
    // after an unlock or a shell restart, post it again.
    _repostPending() {
        for (const s of this._store.liveSessions()) {
            if (s.state === State.WAITING) {
                this._notifier.notify(s, {kind: s.waitingKind === 'input' ? NotifyKind.INPUT : NotifyKind.APPROVAL, urgent: false});
                this._store.lastNotified.set(s.key, {kind: s.waitingKind === 'input' ? NotifyKind.INPUT : NotifyKind.APPROVAL, at: Date.now() / 1000});
            }
        }
    }

    _checkLiveness(replaying) {
        const now = Date.now() / 1000;
        let changed = false;
        const clientsByPattern = new Map();
        for (const s of this._store.liveSessions()) {
            const {clientComm} = providerInfo(s.provider);
            if (clientComm && this._checkAttached(s, clientComm, clientsByPattern, now))
                changed = true;
            if (!s.pid) {
                if (now - s.updatedAt > NO_PID_STALE_SECONDS) {
                    this._schedulePrune(s.key, 0);
                    changed = true;
                }
                continue;
            }
            const id = processIdentity(s.pid);
            // Identity is remembered per PID: a resumed session or a restarted
            // server legitimately brings a new PID.
            const known = this._identities.get(s.key);
            if (id && (!known || known.pid !== s.pid))
                this._identities.set(s.key, {pid: s.pid, id});
            if (!id || (known && known.pid === s.pid && id !== known.id)) {
                const r = this._store.markProcessGone(s.key, {now, replaying});
                if (r?.notify)
                    this._notifier.notify(r.session, r.notify);
                this._notifier.withdraw(s.key, [NotifyKind.APPROVAL, NotifyKind.INPUT]);
                this._schedulePrune(s.key, replaying ? 0 : ENDED_LINGER_MS);
                changed = true;
            }
        }
        if (changed)
            this._scheduleRender();
    }

    // Shared server providers: is a client process still in the session dir?
    // Returns true when the session was ended as detached.
    _checkAttached(s, pattern, cache, now) {
        if (!cache.has(pattern))
            cache.set(pattern, listProcesses(pattern));
        const dir = s.projectDir || s.cwd;
        const client = dir && cache.get(pattern).find(c => c.cwd === dir || c.cwd.startsWith(`${dir}/`));
        if (client) {
            this._clientPids.set(s.key, client.pid);
            this._detachedSince.delete(s.key);
            return false;
        }
        this._clientPids.delete(s.key);
        if (s.state === State.WORKING || s.state === State.WAITING)
            return false; // the server keeps working without a client
        const since = this._detachedSince.get(s.key) ?? now;
        this._detachedSince.set(s.key, since);
        if (now - since < DETACH_GRACE_SECONDS)
            return false;
        this._detachedSince.delete(s.key);
        this._store.end(s.key, 'detached', {now});
        this._schedulePrune(s.key, 0);
        return true;
    }

    _schedulePrune(key, delayMs) {
        if (this._pruneTimers.has(key))
            return;
        this._pruneTimers.set(key, GLib.timeout_add(GLib.PRIORITY_DEFAULT, Math.max(1, delayMs), () => {
            this._pruneTimers.delete(key);
            const s = this._store?.get(key);
            // A session that restarted in the meantime is kept.
            if (s && s.state !== State.ENDED && s.pid)
                return GLib.SOURCE_REMOVE;
            this._store?.remove(key);
            this._identities.delete(key);
            this._clientPids.delete(key);
            this._detachedSince.delete(key);
            const path = this._files.get(key);
            this._files.delete(key);
            if (path) {
                this._lastTs.delete(path);
                this._spool?.deleteFile(path);
            }
            this._scheduleRender();
            return GLib.SOURCE_REMOVE;
        }));
    }

    _scheduleRender() {
        if (this._renderId)
            return;
        this._renderId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._renderId = 0;
            this._render();
            return GLib.SOURCE_REMOVE;
        });
    }

    _render() {
        if (!this._store)
            return;
        const groups = this._store.byProvider({hideIdle: this._settings.get_boolean('hide-idle')});
        // Two independent surfaces showing the same sessions.
        this._indicators.render(this._settings.get_boolean('desktop-tiles') ? groups : new Map());
        this._applyCover();
        const animate = this._settings.get_boolean('animate-working') && St.Settings.get().enable_animations;
        this._panel.render(this._settings.get_boolean('panel-indicators') ? groups : new Map(), {animate});
        if (this._preview.isOpen) {
            const agg = groups.get(this._preview.provider);
            if (agg)
                this._preview.render(agg, {showPrompt: this._settings.get_boolean('show-prompt-text')});
            else
                this._preview.close();
        }
    }

    _positions() {
        try {
            const v = JSON.parse(this._settings.get_string('tile-positions'));
            return v && typeof v === 'object' ? v : {};
        } catch {
            return {};
        }
    }

    // Desktop layer: a tile shows where the wallpaper is visible and hides
    // where an application window covers it ('always' shows it on top).
    _applyCover() {
        if (!this._indicators || !this._preview)
            return;
        // Play mode: the desktop is empty, nothing is open, motion is allowed.
        const play = this._settings.get_boolean('desktop-play') && this._settings.get_boolean('desktop-tiles') &&
            St.Settings.get().enable_animations && !this._preview.isOpen && this._desktop.isEmpty();
        this._indicators.setPlay(play);
        const onDesktop = this._settings.get_string('show-on') !== 'always';
        for (const tile of this._indicators.tiles) {
            const shown = !onDesktop || !this._desktop.isCovered(tile.rect);
            tile.setShown(shown);
            // Close only a card that belongs to this covered desktop tile. A
            // card opened from the top bar must survive the same agent's tile
            // being hidden under an app window.
            if (!shown && this._preview.isOpen && this._preview.anchor === tile.wrapper)
                this._preview.close();
        }
    }

    _togglePreview(provider, anchor) {
        if (this._preview.isOpen && this._preview.provider === provider) {
            this._preview.close();
            return;
        }
        const agg = this._store.byProvider({hideIdle: this._settings.get_boolean('hide-idle')}).get(provider);
        if (!agg)
            return;
        this._preview.open(provider, anchor, agg, {showPrompt: this._settings.get_boolean('show-prompt-text')});
    }

    _dismiss() {
        // Dismiss marks the result as seen: the icon stays, the bounce stops.
        const key = this._preview.selectedKey;
        if (key && this._store.acknowledge(key))
            this._notifier.withdraw(key, [NotifyKind.COMPLETED, NotifyKind.ERROR]);
        this._preview.close();
        this._scheduleRender();
    }

    _focus(key) {
        const s = this._store?.get(key);
        if (!s)
            return;
        this._preview.close();
        const pid = this._clientPids.get(key) ?? s.pid;
        // No terminal for this session any more: open one in its project.
        if (!focusTerminal({...s, pid}))
            openTerminal(s, this._settings.get_string('terminal-command'));
    }

    _open(key) {
        const s = this._store?.get(key);
        if (!s)
            return;
        this._preview.close();
        openTerminal(s, this._settings.get_string('terminal-command'));
    }
}
