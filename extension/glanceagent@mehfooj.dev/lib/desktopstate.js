// Desktop layer emulation: reports which screen areas application windows cover, so tiles show
// only where the wallpaper is visible. Event driven; bursts are coalesced into one update per idle.

import Meta from 'gi://Meta';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Desktop icon helpers are full screen client windows; they are the desktop.
function isDesktopLayer(w) {
    const title = w.get_title() ?? '';
    return w.get_window_type() === Meta.WindowType.DESKTOP || title.startsWith('Desktop Icons') || Boolean(w.customJS_ding);
}

export function isAppWindow(w) {
    return w.get_window_type() === Meta.WindowType.NORMAL && !w.is_skip_taskbar() && !isDesktopLayer(w);
}

function intersects(a, b) {
    return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export class DesktopState {
    constructor(onChange) {
        this._onChange = onChange;
        this._windowSignals = new Map();
        this._idleId = 0;
        this._ids = [
            [global.display, global.display.connect('window-created', (_d, w) => {
                this._track(w);
                this._queue();
            })],
            [global.display, global.display.connect('restacked', () => this._queue())],
            [global.workspace_manager, global.workspace_manager.connect('active-workspace-changed', () => this._queue())],
            [Main.overview, Main.overview.connect('showing', () => this._queue())],
            [Main.overview, Main.overview.connect('hidden', () => this._queue())],
        ];
        for (const a of global.get_window_actors())
            this._track(a.meta_window);
    }

    _track(w) {
        if (!w || this._windowSignals.has(w))
            return;
        const ids = [
            w.connect('position-changed', () => this._queue()),
            w.connect('size-changed', () => this._queue()),
            w.connect('notify::minimized', () => this._queue()),
            w.connect('workspace-changed', () => this._queue()),
            w.connect('unmanaged', () => {
                this._untrack(w);
                this._queue();
            }),
        ];
        this._windowSignals.set(w, ids);
    }

    _untrack(w) {
        for (const id of this._windowSignals.get(w) ?? [])
            w.disconnect(id);
        this._windowSignals.delete(w);
    }

    _queue() {
        if (this._idleId)
            return;
        this._idleId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._idleId = 0;
            this._onChange();
            return GLib.SOURCE_REMOVE;
        });
    }

    // Frame rectangles of application windows visible on the active workspace.
    _coveringRects() {
        if (Main.overview.visible)
            return null; // overview hides the desktop entirely
        const ws = global.workspace_manager.get_active_workspace();
        return global.get_window_actors()
            .map(a => a.meta_window)
            .filter(w => w && isAppWindow(w) && !w.minimized && w.located_on_workspace(ws) && w.showing_on_its_workspace())
            .map(w => w.get_frame_rect());
    }

    // No application window visible on the active workspace (and no overview).
    isEmpty() {
        const rects = this._coveringRects();
        return rects !== null && rects.length === 0;
    }

    // True when the rectangle {x, y, width, height} is under an app window.
    isCovered(rect) {
        const rects = this._coveringRects();
        if (rects === null)
            return true;
        return rects.some(r => intersects(r, rect));
    }

    destroy() {
        if (this._idleId)
            GLib.source_remove(this._idleId);
        this._idleId = 0;
        for (const [obj, id] of this._ids)
            obj.disconnect(id);
        this._ids = [];
        for (const w of [...this._windowSignals.keys()])
            this._untrack(w);
    }
}
