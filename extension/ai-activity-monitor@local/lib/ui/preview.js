// Activity preview card: opens beside the clicked tile without a modal grab or key focus.
// Built once and updated in place, because rebuilding between press and release swallows clicks.
// A click catcher under the card closes it: on Wayland, presses on app windows never reach the stage.

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {State, STATE_LABEL, formatAgo, formatDuration} from '../core/model.js';
import {providerInfo} from '../providers.js';

const WIDTH = 380;
const GAP = 8;
const LOG_LINES = 5;

function label(text, style, {wrap = false} = {}) {
    const l = new St.Label({text: text ?? '', style_class: style});
    l.clutter_text.ellipsize = wrap ? Pango.EllipsizeMode.NONE : Pango.EllipsizeMode.END;
    if (wrap) {
        l.clutter_text.line_wrap = true;
        l.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
    }
    return l;
}

function setStateClass(actor, prefix, state) {
    for (const s of Object.values(State))
        actor.remove_style_class_name(`${prefix}${s}`);
    actor.add_style_class_name(`${prefix}${state}`);
}

export class PreviewCard {
    // actions: {focus(key), open(key), dismiss()}; getBelow(): lowest tile actor.
    constructor(extensionDir, actions, getBelow) {
        this._dir = extensionDir;
        this._actions = actions;
        this._getBelow = getBelow;
        this.provider = null;
        this.selectedKey = null;
        this._open = false;
        this._anchor = null;
        this._agg = null;
        this._opts = {showPrompt: true};
        this._pillKeys = '';
        this.pills = [];
        this.actionButtons = new Map();

        this._catcher = new St.Widget({reactive: true, visible: false, name: 'aimon-click-catcher'});
        this._catcher.connect('button-press-event', () => this._closeFromOutside());
        this._catcher.connect('touch-event', (_a, e) => {
            if (e.type() === Clutter.EventType.TOUCH_BEGIN)
                return this._closeFromOutside();
            return Clutter.EVENT_PROPAGATE;
        });
        Main.layoutManager.addChrome(this._catcher);

        this.actor = new St.BoxLayout({style_class: 'aimon-preview', vertical: true, reactive: true, visible: false, width: WIDTH});
        Main.layoutManager.addChrome(this.actor);
        this._build();

        // Close (never acknowledge) when a window goes fullscreen.
        this._fullscreenId = global.display.connect('in-fullscreen-changed', () => {
            if (this._open && global.display.get_monitor_in_fullscreen(global.display.get_primary_monitor()))
                this.close();
        });
    }

    get isOpen() {
        return this._open;
    }

    // The actor the card is attached to (a desktop tile or a top bar icon).
    get anchor() {
        return this._anchor;
    }

    _build() {
        const header = new St.BoxLayout({style_class: 'aimon-header'});
        this._icon = new St.Icon({style_class: 'aimon-header-icon', icon_size: 28, y_align: Clutter.ActorAlign.CENTER});
        header.add_child(this._icon);
        const titles = new St.BoxLayout({vertical: true, x_expand: true, y_align: Clutter.ActorAlign.CENTER});
        this._title = label('', 'aimon-title');
        titles.add_child(this._title);
        const status = new St.BoxLayout({style_class: 'aimon-status'});
        this._statusDot = new St.Widget({style_class: 'aimon-dot aimon-dot-small', y_align: Clutter.ActorAlign.CENTER});
        this._subtitle = label('', 'aimon-subtle');
        status.add_child(this._statusDot);
        status.add_child(this._subtitle);
        titles.add_child(status);
        header.add_child(titles);
        this._chip = label('', 'aimon-chip');
        this._chip.y_align = Clutter.ActorAlign.START;
        header.add_child(this._chip);
        this.actor.add_child(header);

        this._switcher = new St.BoxLayout({style_class: 'aimon-switcher', visible: false});
        this.actor.add_child(this._switcher);

        const body = new St.BoxLayout({vertical: true, style_class: 'aimon-body'});
        this._current = label('', 'aimon-current', {wrap: true});
        body.add_child(this._current);
        this._log = new St.BoxLayout({vertical: true, style_class: 'aimon-log', visible: false});
        this._logLines = [];
        for (let i = 0; i < LOG_LINES; i++) {
            const l = label('', 'aimon-log-line');
            this._logLines.push(l);
            this._log.add_child(l);
        }
        body.add_child(this._log);
        this.actor.add_child(body);

        // Buttons are created once; they act on whichever session is selected
        // at the moment of the click.
        const actions = new St.BoxLayout({style_class: 'aimon-actions'});
        for (const [text, style, cb] of [
            // Goes to the session's own terminal tab (opens a new terminal in
            // the project only when the session's terminal cannot be found).
            ['Open in Terminal', 'aimon-btn-primary', () => this._selected() && this._actions.focus(this.selectedKey)],
            ['Dismiss', '', () => this._actions.dismiss()],
        ]) {
            const b = new St.Button({label: text, style_class: `aimon-btn ${style}`, can_focus: false, reactive: true, track_hover: true, x_expand: true});
            b.connect('clicked', cb);
            this.actionButtons.set(text, b);
            actions.add_child(b);
        }
        this.actor.add_child(actions);
    }

    _selected() {
        return this._agg?.sessions.find(s => s.key === this.selectedKey) ?? this._agg?.primary ?? null;
    }

    open(provider, anchorActor, agg, opts) {
        this.provider = provider;
        this._anchor = anchorActor;
        if (!this.selectedKey || !agg.sessions.some(s => s.key === this.selectedKey))
            this.selectedKey = agg.primary.key;
        this._open = true;
        this.render(agg, opts);
        this.actor.visible = true;
        // Catcher covers the whole stage, just below the tiles and the card.
        this._catcher.set_position(0, 0);
        this._catcher.set_size(global.stage.width, global.stage.height);
        // Stacking: catcher under every tile, card above every tile.
        const parent = this._catcher.get_parent();
        const below = this._getBelow?.();
        if (parent && below?.get_parent() === parent)
            parent.set_child_below_sibling(this._catcher, below);
        if (parent && this.actor.get_parent() === parent) {
            if (global.top_window_group.get_parent() === parent)
                parent.set_child_below_sibling(this.actor, global.top_window_group);
            else
                parent.set_child_above_sibling(this.actor, null);
        }
        this._catcher.visible = true;
        this._position();
        // Open animation: fade in, grow slightly, settle from just above.
        this.actor.remove_all_transitions();
        this.actor.set_pivot_point(0.5, 0);
        this.actor.opacity = 0;
        this.actor.scale_x = this.actor.scale_y = 0.95;
        this.actor.translation_y = -8;
        this.actor.ease({opacity: 255, scale_x: 1, scale_y: 1, translation_y: 0, duration: 190,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD});
        this._actions.changed?.();
    }

    close() {
        const wasOpen = this._open;
        this._open = false;
        this._catcher.visible = false;
        if (wasOpen) {
            this.actor.remove_all_transitions();
            this.actor.ease({opacity: 0, scale_x: 0.97, scale_y: 0.97, duration: 120,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    if (!this._open)
                        this.actor.visible = false;
                }});
        } else {
            this.actor.visible = false;
        }
        this.provider = null;
        this._anchor = null;
        if (wasOpen)
            this._actions.changed?.();
    }

    _closeFromOutside() {
        this.close();
        return Clutter.EVENT_STOP;
    }

    _position() {
        if (!this._anchor)
            return;
        const [ax, ay] = this._anchor.get_transformed_position();
        const [aw] = this._anchor.get_transformed_size();
        // Measure the content fresh on every render. A height pinned by an
        // earlier render made later, longer content (more log lines) spill
        // out: the buttons ended up outside the card.
        this.actor.height = -1;
        const [, natH] = this.actor.get_preferred_height(WIDTH);
        this.actor.height = natH;
        const sw = global.stage.width, sh = global.stage.height;
        const [, ah] = this._anchor.get_transformed_size();
        let x, y;
        if (ay < Main.panel.height + 4) {
            // Top bar icon: drop down below it.
            x = ax + aw / 2 - WIDTH / 2;
            y = ay + ah + GAP;
        } else {
            // Desktop tile: open towards the side with more room.
            x = ax + aw / 2 > sw / 2 ? ax - WIDTH - GAP : ax + aw + GAP;
            y = ay - 4;
        }
        x = Math.max(4, Math.min(x, sw - WIDTH - 4));
        y = Math.max(4, Math.min(y, sh - natH - 4));
        this.actor.set_position(Math.round(x), Math.round(y));
    }

    render(agg, opts = this._opts) {
        this._opts = opts;
        this._agg = agg;
        if (!agg || !this._open)
            return;
        const now = opts.now ?? Date.now() / 1000;
        const session = this._selected();
        const info = providerInfo(agg.provider);

        this._icon.gicon = info.icon
            ? Gio.FileIcon.new(this._dir.get_child('icons').get_child(info.icon))
            : new Gio.ThemedIcon({name: 'utilities-terminal-symbolic'});
        this._title.text = info.name;
        const dir = session.projectDir || session.cwd;
        const project = dir ? GLib.path_get_basename(dir) : (session.title || session.id.slice(0, 8));
        this._subtitle.text = `${project} · ${formatAgo(now - session.since)}`;
        setStateClass(this._statusDot, 'aimon-', session.state);
        this._chip.text = STATE_LABEL[session.state];
        setStateClass(this._chip, 'aimon-chip-', session.state);

        // Pills are rebuilt only when the set of sessions changes.
        const pillKeys = agg.sessions.length > 1 ? agg.sessions.slice(0, 4).map(s => s.key).join('|') : '';
        if (pillKeys !== this._pillKeys) {
            this._pillKeys = pillKeys;
            this._switcher.destroy_all_children();
            this.pills = [];
            for (const s of pillKeys ? agg.sessions.slice(0, 4) : []) {
                const d = s.projectDir || s.cwd;
                const pill = new St.Button({style_class: 'aimon-pill', can_focus: false, reactive: true, track_hover: true});
                const content = new St.BoxLayout();
                pill._dot = new St.Widget({style_class: 'aimon-dot aimon-dot-small', y_align: Clutter.ActorAlign.CENTER});
                content.add_child(pill._dot);
                content.add_child(label(d ? GLib.path_get_basename(d) : s.id.slice(0, 8), 'aimon-pill-label'));
                pill.set_child(content);
                pill._key = s.key;
                pill.connect('clicked', () => {
                    this.selectedKey = pill._key;
                    this.render(this._agg, this._opts);
                });
                this._switcher.add_child(pill);
                this.pills.push(pill);
            }
        }
        this._switcher.visible = this.pills.length > 0;
        for (const pill of this.pills) {
            const s = agg.sessions.find(x => x.key === pill._key);
            if (s)
                setStateClass(pill._dot, 'aimon-', s.state);
            if (pill._key === session.key)
                pill.add_style_class_name('aimon-pill-active');
            else
                pill.remove_style_class_name('aimon-pill-active');
        }

        this._current.text = session.state === State.WORKING && session.turnStartedAt
            ? `${session.detail} · ${formatDuration(now - session.turnStartedAt)}`
            : session.detail || 'Ready';

        const recent = session.recent
            .filter(r => opts.showPrompt || !r.text.startsWith('›'))
            .slice(-LOG_LINES);
        this._log.visible = recent.length > 0;
        this._logLines.forEach((l, i) => {
            const r = recent[i];
            l.visible = Boolean(r);
            if (!r)
                return;
            // Prompts already carry a chevron; other lines get the log marker.
            l.text = r.text.startsWith('›') ? r.text : `> ${r.text}`;
            for (const lvl of ['info', 'warn', 'error', 'attention', 'success'])
                l.remove_style_class_name(`aimon-log-${lvl}`);
            l.add_style_class_name(`aimon-log-${r.level}`);
        });
        this._position();
    }

    destroy() {
        this.close();
        global.display.disconnect(this._fullscreenId);
        Main.layoutManager.removeChrome(this.actor);
        Main.layoutManager.removeChrome(this._catcher);
        this.actor.destroy();
        this._catcher.destroy();
    }
}
