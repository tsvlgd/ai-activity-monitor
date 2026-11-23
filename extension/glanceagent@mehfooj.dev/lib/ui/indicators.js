// Desktop tiles: one per provider with a state dot, session count, hover label and motion.
// Each tile has its own position; a drag parks it (saved per provider), a click toggles the preview.
// Tiles never take key focus.

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {State, STATE_LABEL} from '../core/model.js';
import {isParked} from '../core/roaming.js';
import {providerInfo} from '../providers.js';
import {Motion, motionFor, SAYINGS, popIn, popOut} from './motion.js';

const DRAG_THRESHOLD = 6;
const DOUBLE_CLICK_MS = 400;
// Play mode (empty desktop): gentle drifting, bounces and greetings.
const PLAY_TICK_MS = 33;
const PLAY_MIN_SPEED = 35;
const PLAY_MAX_SPEED = 75;
const GREET_COOLDOWN_S = 5;
// Now and then one tile wanders towards another, so chance meetings (and
// their greetings) happen naturally instead of almost never.
const SEEK_EVERY_S = [9, 18];
const SEEK_FOR_S = 6;


// Short hover phrase for a provider aggregate.
export function hoverPhrase(agg) {
    const s = agg.primary;
    let phrase;
    switch (agg.state) {
    case State.WORKING:
        phrase = s.activeTools > 0 ? 'Running tools' : 'Streaming…';
        break;
    case State.WAITING:
        phrase = s.waitingKind === 'input' ? 'Waiting for your input' : 'Needs your approval';
        break;
    case State.COMPLETED:
        phrase = 'Completed';
        break;
    case State.ERROR:
        phrase = 'Stopped with an error';
        break;
    default:
        phrase = STATE_LABEL[agg.state] ?? '';
    }
    const name = providerInfo(agg.provider).name;
    return agg.count > 1 ? `${name} · ${phrase} · ${agg.count} sessions` : `${name} · ${phrase}`;
}

class ProviderTile {
    constructor(provider, extensionDir, handlers) {
        this.provider = provider;
        this._handlers = handlers;
        const info = providerInfo(provider);
        this.row = new St.BoxLayout({style_class: 'aimon-row', vertical: false, reactive: false});
        this.button = new St.Widget({
            style_class: `aimon-tile ${info.tileClass ?? ''}`.trim(),
            reactive: true,
            track_hover: true,
            can_focus: false,
            layout_manager: new Clutter.BinLayout(),
            accessible_name: info.name,
        });
        const gicon = info.icon
            ? Gio.FileIcon.new(extensionDir.get_child('icons').get_child(info.icon))
            : new Gio.ThemedIcon({name: 'utilities-terminal-symbolic'});
        this.icon = new St.Icon({
            gicon, style_class: 'aimon-tile-icon',
            x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER,
            x_expand: true, y_expand: true,
        });
        this.button.add_child(this.icon);

        this.side = new St.BoxLayout({vertical: true, y_align: Clutter.ActorAlign.CENTER, style_class: 'aimon-side'});
        this.dot = new St.Widget({style_class: 'aimon-dot', y_align: Clutter.ActorAlign.CENTER});
        this.count = new St.Label({style_class: 'aimon-count', text: '', visible: false});
        this.side.add_child(this.dot);
        this.side.add_child(this.count);
        this.row.add_child(this.button);
        this.row.add_child(this.side);

        // The layout manager owns the wrapper's visibility (fullscreen);
        // the extension owns the row's visibility (state, desktop cover).
        this.wrapper = new St.Bin({child: this.row, reactive: true, name: `aimon-tile-${provider}`});
        Main.layoutManager.addChrome(this.wrapper, {trackFullscreen: true, affectsStruts: false});

        this.tooltip = new St.BoxLayout({style_class: 'aimon-tooltip', visible: false, reactive: false});
        this._tipDot = new St.Widget({style_class: 'aimon-dot aimon-dot-small', y_align: Clutter.ActorAlign.CENTER});
        this._tipLabel = new St.Label({text: '', y_align: Clutter.ActorAlign.CENTER});
        this.tooltip.add_child(this._tipDot);
        this.tooltip.add_child(this._tipLabel);
        Main.layoutManager.addTopChrome(this.tooltip);

        // Speech bubble for play mode ("hi!", "done!").
        this.bubble = new St.Label({style_class: 'aimon-bubble', visible: false, reactive: false});
        Main.layoutManager.addTopChrome(this.bubble);
        this._bubbleTimer = 0;
        this.vel = {x: 0, y: 0};

        this.button.connect('button-press-event', (_a, e) => handlers.press(this, e));
        this.button.connect('notify::hover', () => this._syncTooltip());
        this.wrapper.connect('motion-event', (_a, e) => handlers.motion(this, e));
        this.wrapper.connect('button-release-event', (_a, e) => handlers.release(this, e));

        this._state = null;
        this._motion = new Motion(this.button, 4);
        this._shown = true;
        this._suppressTip = false;
    }

    setEdge(edge) {
        // The dot sits on the inner side of the tile.
        this.row.remove_child(this.side);
        if (edge === 'right')
            this.row.insert_child_at_index(this.side, 0);
        else
            this.row.add_child(this.side);
    }

    setSize(px) {
        this.button.set_size(px, px);
        this.icon.icon_size = Math.round(px * 0.6);
    }

    setPosition(x, y) {
        this.wrapper.set_position(Math.round(x), Math.round(y));
        this._placeTooltip();
        this._placeBubble();
    }

    say(text, ms = 1700) {
        if (!this._shown)
            return;
        this.bubble.text = text;
        popIn(this.bubble, 6);
        this._placeBubble();
        if (this._bubbleTimer)
            GLib.source_remove(this._bubbleTimer);
        this._bubbleTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
            this._bubbleTimer = 0;
            popOut(this.bubble);
            return GLib.SOURCE_REMOVE;
        });
    }

    _placeBubble() {
        if (!this.bubble.visible)
            return;
        const [x, y] = this.wrapper.get_position();
        const [w] = this.button.get_size();
        const [, bw] = this.bubble.get_preferred_width(-1);
        const [, bh] = this.bubble.get_preferred_height(-1);
        const bx = Math.max(4, Math.min(x + w / 2 - bw / 2, global.stage.width - bw - 4));
        const by = Math.max(Main.panel.height + 2, y - bh - 6);
        this.bubble.set_position(Math.round(bx), Math.round(by));
    }

    get position() {
        return this.wrapper.get_position();
    }

    // Screen rectangle of the tile, for desktop cover checks.
    get rect() {
        const [x, y] = this.wrapper.get_position();
        const [w, h] = this.wrapper.get_size();
        return {x, y, width: Math.max(w, 1), height: Math.max(h, 1)};
    }

    setShown(on) {
        this._shown = on;
        this.row.visible = on;
        if (!on) {
            this._tipShown = false;
            this.tooltip.visible = false;
            this.bubble.visible = false;
        }
    }

    get shown() {
        return this._shown && this.wrapper.visible;
    }

    update(agg, {animate}) {
        const state = agg.state;
        if (this._state !== state && this._state !== null && SAYINGS[state] && !agg.acknowledged)
            this.say(SAYINGS[state]);
        if (this._state !== state) {
            for (const cls of [this.dot, this._tipDot]) {
                if (this._state)
                    cls.remove_style_class_name(`aimon-${this._state}`);
                cls.add_style_class_name(`aimon-${state}`);
            }
            this._state = state;
        }
        this.count.text = agg.count > 1 ? String(agg.count) : '';
        this.count.visible = agg.count > 1;
        this._tipLabel.text = hoverPhrase(agg);
        this.button.accessible_name = `${this._tipLabel.text}. ${agg.primary.detail || ''}`.trim();
        this._syncTooltip();
        this._motion.set(animate ? motionFor(state, agg.acknowledged) : 'none', agg.attentionSince);
    }

    suppressTooltip(on) {
        this._suppressTip = on;
        this._syncTooltip();
    }

    _syncTooltip() {
        const show = this.button.hover && this._shown && !this._suppressTip && Boolean(this._tipLabel.text);
        if (show && !this._tipShown) {
            this._tipShown = true;
            popIn(this.tooltip);
            this._placeTooltip();
        } else if (!show && this._tipShown) {
            this._tipShown = false;
            popOut(this.tooltip);
        } else if (show) {
            this._placeTooltip();
        }
    }

    _placeTooltip() {
        if (!this.tooltip.visible)
            return;
        const [x, y] = this.wrapper.get_transformed_position();
        const [w, h] = this.button.get_transformed_size();
        const [, tw] = this.tooltip.get_preferred_width(-1);
        const [, th] = this.tooltip.get_preferred_height(-1);
        let tx = x + w / 2 - tw / 2;
        let ty = y + h + 8;
        if (ty + th > global.stage.height - 4)
            ty = y - th - 8;
        tx = Math.max(4, Math.min(tx, global.stage.width - tw - 4));
        this.tooltip.set_position(Math.round(tx), Math.round(ty));
    }

    get bouncing() {
        return this._motion.mode !== 'none';
    }

    get motion() {
        return this._motion.mode;
    }

    get hops() {
        return this._motion.hops;
    }

    destroy() {
        this._motion.destroy();
        if (this._bubbleTimer)
            GLib.source_remove(this._bubbleTimer);
        this._bubbleTimer = 0;
        Main.layoutManager.removeChrome(this.bubble);
        this.bubble.destroy();
        this.wrapper.remove_all_transitions();
        Main.layoutManager.removeChrome(this.tooltip);
        this.tooltip.destroy();
        Main.layoutManager.removeChrome(this.wrapper);
        this.wrapper.destroy();
    }
}

export class EdgeIndicators {
    // onTileClicked(provider, tile); onMoved(provider, x, y); onDragStart();
    // onReleased(provider) when a double click frees a parked tile;
    // onLayoutChanged() after any tile moves (desktop cover must be rechecked).
    constructor(extensionDir, {onTileClicked, onMoved, onDragStart, onReleased, onLayoutChanged}) {
        this._dir = extensionDir;
        this._cb = {onTileClicked, onMoved, onDragStart, onReleased, onLayoutChanged};
        this._tiles = new Map();
        this._press = null;
        this._lastPress = null;
        this._playing = false;
        this._playTimer = 0;
        this._greeted = new Map();
        this._config = {edge: 'left', offsetX: 12, offsetY: 140, size: 34, spacing: 10, animate: true, positions: {}};
        this._handlers = {
            press: (t, e) => this._onPress(t, e),
            motion: (t, e) => this._onMotion(t, e),
            release: (t, e) => this._onRelease(t, e),
        };
        this._monitorsId = Main.layoutManager.connect('monitors-changed', () => this.relayout());
        this._workareasId = global.display.connect('workareas-changed', () => this.relayout());
    }

    configure(cfg) {
        this._config = {...this._config, ...cfg};
        for (const t of this._tiles.values()) {
            t.setSize(this._config.size);
            t.setEdge(this._config.edge);
        }
        this.relayout();
    }

    tileFor(provider) {
        return this._tiles.get(provider) ?? null;
    }

    get tiles() {
        return [...this._tiles.values()];
    }

    // Lowest tile actor in the stacking order, for the preview click catcher.
    get lowestActor() {
        const parent = this.tiles[0]?.wrapper.get_parent();
        if (!parent)
            return null;
        return parent.get_children().find(c => this.tiles.some(t => t.wrapper === c)) ?? null;
    }

    // groups: Map provider -> aggregate (from SessionStore.byProvider()).
    render(groups) {
        let changed = false;
        for (const [provider, tile] of this._tiles) {
            if (!groups.has(provider)) {
                // The session can end while its tile is held: release the stage grab.
                if (this._press?.tile === tile) {
                    this._press.grab?.dismiss();
                    this._press = null;
                }
                tile.destroy();
                this._tiles.delete(provider);
                changed = true;
            }
        }
        for (const [provider, agg] of groups) {
            let tile = this._tiles.get(provider);
            if (!tile) {
                tile = new ProviderTile(provider, this._dir, this._handlers);
                tile.setSize(this._config.size);
                tile.setEdge(this._config.edge);
                this._tiles.set(provider, tile);
                changed = true;
            }
            tile.update(agg, {animate: this._config.animate && St.Settings.get().enable_animations});
        }
        if (changed)
            this.relayout(); // while playing this only places parked tiles
        if (changed && this._playing)
            for (const t of this._tiles.values())
                if (!t.vel.x && !t.vel.y)
                    this._kick(t);
    }

    get playing() {
        return this._playing;
    }

    // Play mode: tiles roam the empty desktop. Turning it off glides each
    // tile back to its home spot (saved or edge slot).
    setPlay(on) {
        if (on === this._playing)
            return;
        this._playing = on;
        if (on) {
            for (const t of this._tiles.values()) {
                t.wrapper.remove_all_transitions();
                this._kick(t);
            }
            this._lastTick = GLib.get_monotonic_time();
            this._playTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, PLAY_TICK_MS, () => {
                this._tick();
                return GLib.SOURCE_CONTINUE;
            });
        } else {
            if (this._playTimer)
                GLib.source_remove(this._playTimer);
            this._playTimer = 0;
            this._seek = null;
            this._nextSeek = null;
            this.relayout(true);
        }
    }

    _endSeek(nowS) {
        this._seek = null;
        this._nextSeek = nowS + SEEK_EVERY_S[0] + Math.random() * (SEEK_EVERY_S[1] - SEEK_EVERY_S[0]);
    }

    _kick(tile) {
        const a = Math.random() * Math.PI * 2;
        const v = PLAY_MIN_SPEED + Math.random() * (PLAY_MAX_SPEED - PLAY_MIN_SPEED);
        tile.vel = {x: Math.cos(a) * v, y: Math.sin(a) * v};
    }

    _tick() {
        const now = GLib.get_monotonic_time();
        const dt = Math.min(0.1, (now - this._lastTick) / 1e6);
        this._lastTick = now;
        // A tile you dragged and dropped is parked: it keeps its state motion
        // but no longer roams. Roaming tiles still bump into parked ones.
        const parked = t => isParked(this._config.positions, t.provider);
        const visible = [...this._tiles.values()].filter(t => t.shown && !(this._press?.dragging && this._press.tile === t));
        const tiles = visible.filter(t => !parked(t));
        const size = this._config.size;
        const nowS = now / 1e6;
        if (tiles.length >= 1 && visible.length >= 2) {
            this._nextSeek ??= nowS + SEEK_EVERY_S[0];
            if (!this._seek && nowS >= this._nextSeek) {
                const from = tiles[Math.floor(Math.random() * tiles.length)];
                const others = visible.filter(t => t !== from);
                this._seek = {from, to: others[Math.floor(Math.random() * others.length)], until: nowS + SEEK_FOR_S};
            }
            if (this._seek && (nowS > this._seek.until || !tiles.includes(this._seek.from) || !visible.includes(this._seek.to)))
                this._endSeek(nowS);
            if (this._seek) {
                // Steer gently towards the other tile.
                const [fx, fy] = this._seek.from.position, [tx, ty] = this._seek.to.position;
                const d = Math.hypot(tx - fx, ty - fy) || 1;
                const v = this._seek.from.vel;
                v.x += ((tx - fx) / d) * 120 * dt;
                v.y += ((ty - fy) / d) * 120 * dt;
            }
        }
        const minX = 8, minY = Main.panel.height + 10;
        const maxX = global.stage.width - size - 24, maxY = global.stage.height - size - 12;
        for (const t of tiles) {
            // Wander: a small random turn now and then.
            if (Math.random() < dt * 0.4) {
                const turn = (Math.random() - 0.5) * 1.2;
                const c = Math.cos(turn), sn = Math.sin(turn);
                t.vel = {x: t.vel.x * c - t.vel.y * sn, y: t.vel.x * sn + t.vel.y * c};
            }
            const speed = Math.hypot(t.vel.x, t.vel.y) || 1;
            const target = Math.min(PLAY_MAX_SPEED, Math.max(PLAY_MIN_SPEED, speed));
            t.vel.x *= target / speed;
            t.vel.y *= target / speed;
            let [x, y] = t.position;
            x += t.vel.x * dt;
            y += t.vel.y * dt;
            if (x < minX || x > maxX) {
                t.vel.x = -t.vel.x;
                x = Math.max(minX, Math.min(x, maxX));
            }
            if (y < minY || y > maxY) {
                t.vel.y = -t.vel.y;
                y = Math.max(minY, Math.min(y, maxY));
            }
            t.setPosition(x, y);
        }
        // Collisions: equal mass elastic bounce between roaming tiles; a
        // roaming tile reflects off a parked one. Then they say hi.
        for (let i = 0; i < visible.length; i++) {
            for (let j = i + 1; j < visible.length; j++) {
                const a = visible[i], b = visible[j];
                const aFixed = parked(a), bFixed = parked(b);
                if (aFixed && bFixed)
                    continue;
                const [ax, ay] = a.position, [bx, by] = b.position;
                const dx = bx - ax, dy = by - ay;
                const d = Math.hypot(dx, dy) || 0.01;
                if (d >= size * 1.05)
                    continue;
                const nx = dx / d, ny = dy / d;
                const overlap = size * 1.05 - d;
                if (aFixed || bFixed) {
                    const mover = aFixed ? b : a;
                    const sx = aFixed ? nx : -nx, sy = aFixed ? ny : -ny; // away from the parked tile
                    const vn = mover.vel.x * sx + mover.vel.y * sy;
                    if (vn < 0) {
                        mover.vel.x -= 2 * vn * sx;
                        mover.vel.y -= 2 * vn * sy;
                    }
                    const [mx, my] = mover.position;
                    mover.setPosition(mx + sx * overlap, my + sy * overlap);
                } else {
                    const rel = (a.vel.x - b.vel.x) * nx + (a.vel.y - b.vel.y) * ny;
                    if (rel > 0) {
                        a.vel.x -= rel * nx;
                        a.vel.y -= rel * ny;
                        b.vel.x += rel * nx;
                        b.vel.y += rel * ny;
                    }
                    a.setPosition(ax - nx * overlap / 2, ay - ny * overlap / 2);
                    b.setPosition(bx + nx * overlap / 2, by + ny * overlap / 2);
                }
                if (this._seek && [a, b].includes(this._seek.from) && [a, b].includes(this._seek.to))
                    this._endSeek(now / 1e6);
                const pair = `${a.provider}|${b.provider}`;
                const t = now / 1e6;
                if (t - (this._greeted.get(pair) ?? 0) > GREET_COOLDOWN_S) {
                    this._greeted.set(pair, t);
                    a.say(`hi ${providerInfo(b.provider).name}!`);
                    b.say(`hey ${providerInfo(a.provider).name}!`);
                }
            }
        }
        this._cb.onLayoutChanged?.();
    }

    _onPress(tile, event) {
        if (event.get_button() !== Clutter.BUTTON_PRIMARY)
            return Clutter.EVENT_PROPAGATE;
        const [x, y] = event.get_coords();
        const [wx, wy] = tile.position;
        // A grab routes motion and release to this tile even off its bounds.
        this._press = {tile, x, y, wx, wy, dragging: false, consumed: false, grab: global.stage.grab(tile.wrapper)};
        // Double click on a parked tile frees it to roam again.
        const nowMs = GLib.get_monotonic_time() / 1000;
        const last = this._lastPress;
        const isDouble = Boolean(last) && last.tile === tile && nowMs - last.ms < DOUBLE_CLICK_MS &&
            Math.hypot(x - last.x, y - last.y) < DRAG_THRESHOLD * 2;
        this._lastPress = isDouble ? null : {tile, ms: nowMs, x, y};
        if (isDouble && isParked(this._config.positions, tile.provider)) {
            this._press.consumed = true;
            const {[tile.provider]: _gone, ...rest} = this._config.positions;
            this._config.positions = rest;
            this._cb.onDragStart?.();
            this._cb.onReleased?.(tile.provider);
            if (this._playing && !tile.vel.x && !tile.vel.y)
                this._kick(tile);
        }
        return Clutter.EVENT_STOP;
    }

    _onMotion(tile, event) {
        const p = this._press;
        if (!p || p.tile !== tile)
            return Clutter.EVENT_PROPAGATE;
        if (p.consumed)
            return Clutter.EVENT_STOP;
        const [x, y] = event.get_coords();
        const dx = x - p.x, dy = y - p.y;
        if (!p.dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD)
            return Clutter.EVENT_STOP;
        if (!p.dragging) {
            p.dragging = true;
            this._lastPress = null;
            tile.suppressTooltip(true);
            this._cb.onDragStart?.();
        }
        const [cx, cy] = this._clamp(tile, p.wx + dx, p.wy + dy);
        tile.setPosition(cx, cy);
        return Clutter.EVENT_STOP;
    }

    _onRelease(tile, _event) {
        const p = this._press;
        if (!p || p.tile !== tile)
            return Clutter.EVENT_PROPAGATE;
        this._press = null;
        p.grab?.dismiss();
        tile.suppressTooltip(false);
        if (p.consumed) {
            this._cb.onLayoutChanged?.();
        } else if (p.dragging) {
            const [x, y] = tile.position;
            this._config.positions = {...this._config.positions, [tile.provider]: {x: Math.round(x), y: Math.round(y)}};
            this._cb.onMoved?.(tile.provider, Math.round(x), Math.round(y));
            this._cb.onLayoutChanged?.();
        } else {
            this._cb.onTileClicked(tile.provider, tile);
        }
        return Clutter.EVENT_STOP;
    }

    // Anywhere on screen, but always fully visible.
    _clamp(tile, x, y) {
        const [w, h] = tile.wrapper.get_size();
        const maxX = global.stage.width - Math.max(w, this._config.size);
        const maxY = global.stage.height - Math.max(h, this._config.size);
        return [Math.round(Math.max(0, Math.min(x, maxX))), Math.round(Math.max(0, Math.min(y, maxY)))];
    }

    // Saved tiles go to their saved spot; the others stack at the edge.
    // glide: animate there (leaving play mode) instead of jumping.
    relayout(glide = false) {
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor)
            return;
        const wa = Main.layoutManager.getWorkAreaForMonitor(monitor.index);
        const order = [...this._tiles.keys()].sort((a, b) => providerInfo(a).order - providerInfo(b).order || a.localeCompare(b));
        let slot = 0;
        for (const provider of order) {
            const tile = this._tiles.get(provider);
            if (this._press?.dragging && this._press.tile === tile)
                continue;
            const saved = this._config.positions?.[provider];
            // Roaming tiles are moved by the play tick, not by the layout.
            if (this._playing && !isParked(this._config.positions, provider))
                continue;
            const place = (x, y) => {
                if (!glide) {
                    tile.setPosition(x, y);
                    return;
                }
                tile.wrapper.ease({x: Math.round(x), y: Math.round(y), duration: 650, mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
            };
            if (isParked(this._config.positions, provider)) {
                place(...this._clamp(tile, saved.x, saved.y));
                continue;
            }
            const [, natWidth] = tile.row.get_preferred_width(-1);
            const x = this._config.edge === 'right'
                ? wa.x + wa.width - this._config.offsetX - natWidth
                : wa.x + this._config.offsetX;
            const y = wa.y + this._config.offsetY + slot * (this._config.size + this._config.spacing);
            place(x, Math.min(y, wa.y + wa.height - this._config.size));
            slot++;
        }
        this._cb.onLayoutChanged?.();
    }

    get edge() {
        return this._config.edge;
    }

    destroy() {
        if (this._playTimer)
            GLib.source_remove(this._playTimer);
        this._playTimer = 0;
        this._press?.grab?.dismiss();
        this._press = null;
        this._lastPress = null;
        Main.layoutManager.disconnect(this._monitorsId);
        global.display.disconnect(this._workareasId);
        for (const t of this._tiles.values())
            t.destroy();
        this._tiles.clear();
    }
}
