// Top bar indicators: one icon per provider, by default right after the workspace indicator.
// Same hover label, click preview and motion as the desktop tiles; each icon drags on its own
// along the bar and its slot is saved.

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import {providerInfo} from '../providers.js';
import {hoverPhrase} from './indicators.js';
import {Motion, motionFor, SAYINGS, popIn, popOut} from './motion.js';

const DRAG_THRESHOLD = 6;
const ROLE_PREFIX = 'ai-activity-monitor-';

class PanelIcon {
    constructor(provider, extensionDir, handlers) {
        this.provider = provider;
        const info = providerInfo(provider);
        this.button = new PanelMenu.Button(0.5, `AI Activity ${info.name}`, true);
        // dontCreateMenu still leaves a hidden dummy menu registered with the panel's menu
        // manager; sliding over the clock then switches to the clock's menu and its modal
        // grab swallows the drop. Remove the menu entirely.
        this.button.menu?.destroy?.();
        this.button.menu = null;
        this.button.add_style_class_name('aimon-panel-button');
        this.button.can_focus = false;
        const box = new St.BoxLayout({vertical: true, y_align: Clutter.ActorAlign.CENTER, style_class: 'aimon-panel-box'});
        const gicon = info.icon
            ? Gio.FileIcon.new(extensionDir.get_child('icons').get_child(info.icon))
            : new Gio.ThemedIcon({name: 'utilities-terminal-symbolic'});
        this.icon = new St.Icon({gicon, style_class: 'aimon-panel-icon', icon_size: 22, x_align: Clutter.ActorAlign.CENTER});
        this.dot = new St.Widget({style_class: 'aimon-dot aimon-panel-dot', x_align: Clutter.ActorAlign.CENTER});
        box.add_child(this.icon);
        box.add_child(this.dot);
        this.button.add_child(box);

        this.tooltip = new St.BoxLayout({style_class: 'aimon-tooltip', visible: false, reactive: false});
        this._tipDot = new St.Widget({style_class: 'aimon-dot aimon-dot-small', y_align: Clutter.ActorAlign.CENTER});
        this._tipLabel = new St.Label({text: '', y_align: Clutter.ActorAlign.CENTER});
        this.tooltip.add_child(this._tipDot);
        this.tooltip.add_child(this._tipLabel);
        Main.layoutManager.addTopChrome(this.tooltip);

        this.button.connect('button-press-event', (_a, e) => handlers.press(this, e));
        this.button.connect('notify::hover', () => this._syncTooltip());

        // Announce bubble under the icon ("done!", "need you!").
        this.bubble = new St.Label({style_class: 'aimon-bubble', visible: false, reactive: false});
        Main.layoutManager.addTopChrome(this.bubble);
        this._bubbleTimer = 0;
        this._tipShown = false;

        this._motion = new Motion(this.icon, 3);
        this._state = null;
        this._suppressTip = false;
    }

    get role() {
        return `${ROLE_PREFIX}${this.provider}`;
    }

    // The actor that sits in the panel box (PanelMenu.Button wraps itself).
    get container() {
        return this.button.container;
    }

    get anchor() {
        return this.button;
    }

    get motion() {
        return this._motion.mode;
    }

    update(agg, {animate}) {
        if (this._state !== agg.state && this._state !== null && SAYINGS[agg.state])
            this.say(SAYINGS[agg.state]);
        if (this._state !== agg.state) {
            for (const a of [this.dot, this._tipDot]) {
                if (this._state)
                    a.remove_style_class_name(`aimon-${this._state}`);
                a.add_style_class_name(`aimon-${agg.state}`);
            }
            this._state = agg.state;
        }
        this._tipLabel.text = hoverPhrase(agg);
        this.button.accessible_name = this._tipLabel.text;
        this._syncTooltip();
        this._motion.set(animate ? motionFor(agg.state, agg.acknowledged) : 'none');
    }

    suppressTooltip(on) {
        this._suppressTip = on;
        this._syncTooltip();
    }

    _below(actor) {
        const [x, y] = this.button.get_transformed_position();
        const [w, h] = this.button.get_transformed_size();
        const [, tw] = actor.get_preferred_width(-1);
        const tx = Math.max(4, Math.min(x + w / 2 - tw / 2, global.stage.width - tw - 4));
        actor.set_position(Math.round(tx), Math.round(y + h + 6));
    }

    _syncTooltip() {
        const show = this.button.hover && !this._suppressTip && !this.bubble.visible && Boolean(this._tipLabel.text);
        if (show && !this._tipShown) {
            this._tipShown = true;
            popIn(this.tooltip);
            this._below(this.tooltip);
        } else if (!show && this._tipShown) {
            this._tipShown = false;
            popOut(this.tooltip);
        }
    }

    // Short speech bubble under the icon when a result or question arrives.
    say(text, ms = 3500) {
        if (this._tipShown) {
            this._tipShown = false;
            this.tooltip.visible = false;
        }
        this.bubble.text = text;
        popIn(this.bubble, 6);
        this._below(this.bubble);
        if (this._bubbleTimer)
            GLib.source_remove(this._bubbleTimer);
        this._bubbleTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
            this._bubbleTimer = 0;
            popOut(this.bubble);
            return GLib.SOURCE_REMOVE;
        });
    }

    destroy() {
        this._motion.destroy();
        if (this._bubbleTimer)
            GLib.source_remove(this._bubbleTimer);
        this._bubbleTimer = 0;
        Main.layoutManager.removeChrome(this.bubble);
        this.bubble.destroy();
        Main.layoutManager.removeChrome(this.tooltip);
        this.tooltip.destroy();
        this.button.destroy(); // also removes it from Main.panel.statusArea
    }
}

function panelBoxes() {
    return {left: Main.panel._leftBox, center: Main.panel._centerBox, right: Main.panel._rightBox};
}

export class PanelIndicators {
    // onClicked(provider, anchorActor); onPlaced(placements); onDragStart().
    constructor(extensionDir, {onClicked, onPlaced, onDragStart}) {
        this._dir = extensionDir;
        this._cb = {onClicked, onPlaced, onDragStart};
        this._icons = new Map();
        this._placement = {};
        this._press = null;
        this._handlers = {
            press: (i, e) => this._onPress(i, e),
            motion: (i, e) => this._onMotion(i, e),
            release: (i, e) => this._onRelease(i, e),
        };
    }

    // placement: {provider: {box: 'left'|'center'|'right', index}}
    setPlacement(placement) {
        this._placement = placement && typeof placement === 'object' ? placement : {};
        for (const icon of this._icons.values())
            this._place(icon);
    }

    iconFor(provider) {
        return this._icons.get(provider) ?? null;
    }

    get icons() {
        return [...this._icons.values()];
    }

    // Default slot: right after the workspace indicator, in provider order.
    _defaultIndex(provider) {
        const left = panelBoxes().left;
        const activities = Main.panel.statusArea.activities?.container;
        const base = activities?.get_parent() === left ? left.get_children().indexOf(activities) + 1 : 0;
        return base + providerInfo(provider).order;
    }

    _place(icon) {
        const saved = this._placement[icon.provider];
        const boxes = panelBoxes();
        const box = boxes[saved?.box] ?? boxes.left;
        const c = icon.container;
        if (!box)
            return;
        if (c.get_parent() !== box) {
            c.get_parent()?.remove_child(c);
            box.add_child(c);
        }
        const n = box.get_n_children();
        const index = saved ? saved.index : this._defaultIndex(icon.provider);
        box.set_child_at_index(c, Math.max(0, Math.min(index, n - 1)));
    }

    render(groups, {animate}) {
        for (const [provider, icon] of this._icons) {
            if (!groups.has(provider)) {
                icon.destroy();
                this._icons.delete(provider);
            }
        }
        for (const [provider, agg] of groups) {
            let icon = this._icons.get(provider);
            if (!icon) {
                icon = new PanelIcon(provider, this._dir, this._handlers);
                Main.panel.addToStatusArea(icon.role, icon.button, 1, 'left');
                this._icons.set(provider, icon);
                this._place(icon);
            }
            icon.update(agg, {animate});
        }
    }

    _onPress(icon, event) {
        if (event.get_button() !== Clutter.BUTTON_PRIMARY)
            return Clutter.EVENT_PROPAGATE;
        const [x] = event.get_coords();
        // Track the drag at the stage: the clock button takes over a plain
        // grab when the pointer crosses it, so motion and release would stop.
        const capture = global.stage.connect('captured-event', (_s, ev) => {
            const t = ev.type();
            if (t === Clutter.EventType.MOTION)
                return this._onMotion(icon, ev);
            if (t === Clutter.EventType.BUTTON_RELEASE)
                return this._onRelease(icon, ev);
            // Keep the other top bar buttons from reacting to the icon
            // sliding over them while it is dragged.
            if (t === Clutter.EventType.ENTER || t === Clutter.EventType.LEAVE)
                return this._press?.dragging ? Clutter.EVENT_STOP : Clutter.EVENT_PROPAGATE;
            return Clutter.EVENT_PROPAGATE;
        });
        this._press = {icon, x, dragging: false, capture};
        return Clutter.EVENT_STOP;
    }

    _endPress(p) {
        if (p?.capture) {
            global.stage.disconnect(p.capture);
            p.capture = 0;
        }
    }

    _onMotion(icon, event) {
        const p = this._press;
        if (!p || p.icon !== icon)
            return Clutter.EVENT_PROPAGATE;
        const [x] = event.get_coords();
        const dx = x - p.x;
        if (!p.dragging && Math.abs(dx) < DRAG_THRESHOLD)
            return Clutter.EVENT_STOP;
        if (!p.dragging) {
            p.dragging = true;
            icon.suppressTooltip(true);
            this._cb.onDragStart?.();
        }
        icon.container.translation_x = dx;
        return Clutter.EVENT_STOP;
    }

    // Which section and position a drop at stage x lands in.
    _dropTarget(x, dragged) {
        const boxes = panelBoxes();
        const extent = b => {
            const [bx] = b.get_transformed_position();
            const [bw] = b.get_transformed_size();
            return [bx, bx + bw];
        };
        const [cl, cr] = extent(boxes.center);
        // The centre section holds the clock: drops near it join it, drops
        // further out join the left or right section.
        // Drops within NEAR_CLOCK px of the clock sit right beside it.
        const NEAR_CLOCK = 160;
        const name = x < cl - NEAR_CLOCK ? 'left' : x > cr + NEAR_CLOCK ? 'right' : 'center';
        const box = boxes[name];
        let index = 0;
        for (const child of box.get_children()) {
            if (child === dragged || !child.visible)
                continue;
            const [chx] = child.get_transformed_position();
            const [chw] = child.get_transformed_size();
            if (x > chx + chw / 2)
                index = box.get_children().indexOf(child) + 1;
        }
        // Never before the workspace indicator.
        if (name === 'left') {
            const activities = Main.panel.statusArea.activities?.container;
            if (activities?.get_parent() === box)
                index = Math.max(index, box.get_children().indexOf(activities) + 1);
        }
        return {box, name, index};
    }

    _onRelease(icon, event) {
        const p = this._press;
        if (!p || p.icon !== icon)
            return Clutter.EVENT_PROPAGATE;
        this._press = null;
        this._endPress(p);
        icon.suppressTooltip(false);
        if (!p.dragging) {
            this._cb.onClicked(icon.provider, icon.anchor);
            return Clutter.EVENT_STOP;
        }
        const [x] = event.get_coords();
        const c = icon.container;
        const target = this._dropTarget(x, c);
        c.translation_x = 0;
        const from = c.get_parent();
        let index = target.index;
        if (from === target.box && from.get_children().indexOf(c) < index)
            index -= 1; // removing it first shifts later children left
        from?.remove_child(c);
        target.box.insert_child_at_index(c, Math.min(index, target.box.get_n_children()));
        this._placement = {...this._placement, [icon.provider]: {box: target.name, index: target.box.get_children().indexOf(c)}};
        this._cb.onPlaced?.(this._placement);
        return Clutter.EVENT_STOP;
    }

    destroy() {
        this._endPress(this._press);
        this._press = null;
        for (const icon of this._icons.values())
            icon.destroy();
        this._icons.clear();
    }
}
