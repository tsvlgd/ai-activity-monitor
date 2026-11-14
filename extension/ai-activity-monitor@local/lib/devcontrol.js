// Development only control channel for the headless test shell (see scripts/devctl.sh).
// Enabled only when AIMON_DEV_CONTROL names a file; each result is logged as JSON to <file>.log.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const decoder = new TextDecoder();

export class DevControl {
    constructor(path, api) {
        this._path = path;
        this._api = api;
        this._offset = 0;
        GLib.file_set_contents(path, '');
        GLib.file_set_contents(`${path}.log`, '');
        this._monitor = Gio.File.new_for_path(path).monitor_file(Gio.FileMonitorFlags.NONE, null);
        this._monitor.connect('changed', (_m, _f, _o, type) => {
            if (type === Gio.FileMonitorEvent.CHANGES_DONE_HINT || type === Gio.FileMonitorEvent.CHANGED)
                this._drain();
        });
    }

    _focusTitle() {
        const w = global.display.focus_window;
        return w ? `${w.get_wm_class() ?? ''}|${w.get_title() ?? ''}` : null;
    }

    _log(entry) {
        const f = Gio.File.new_for_path(`${this._path}.log`);
        const out = f.append_to(Gio.FileCreateFlags.NONE, null);
        out.write_all(new TextEncoder().encode(`${JSON.stringify(entry)}\n`), null);
        out.close(null);
    }

    _drain() {
        let bytes;
        try {
            [, bytes] = GLib.file_get_contents(this._path);
        } catch {
            return;
        }
        const text = decoder.decode(bytes.subarray(this._offset));
        const end = text.lastIndexOf('\n');
        if (end < 0)
            return;
        this._offset += new TextEncoder().encode(text.slice(0, end + 1)).length;
        for (const line of text.slice(0, end).split('\n').filter(Boolean))
            this._run(line.trim());
    }

    _run(line) {
        const [cmd, ...args] = line.split(' ');
        const before = this._focusTitle();
        let result = null;
        try {
            switch (cmd) {
            case 'click':
                result = this._api.clickTile(args[0]);
                break;
            case 'pill':
                result = this._api.clickPill(Number(args[0]));
                break;
            case 'action':
                result = this._api.clickAction(args.join(' '));
                break;
            case 'tray':
                Main.panel.statusArea.dateMenu.menu.toggle();
                result = {trayOpen: Main.panel.statusArea.dateMenu.menu.isOpen};
                break;
            case 'spawn':
                Gio.Subprocess.new(args, Gio.SubprocessFlags.NONE);
                result = {spawned: args};
                break;
            case 'shot': {
                // Captures the nested stage only (never the host screen).
                const [path, x, y, w, h] = args;
                const stream = Gio.File.new_for_path(path).replace(null, false, Gio.FileCreateFlags.NONE, null);
                const shooter = new Shell.Screenshot();
                const done = (o, res) => {
                    try {
                        if (x === undefined)
                            o.screenshot_finish(res);
                        else
                            o.screenshot_area_finish(res);
                        this._log({cmd: `shot-done ${path}`, result: {ok: true}});
                    } catch (e) {
                        this._log({cmd: `shot-done ${path}`, result: {error: e.message}});
                    }
                    stream.close(null);
                };
                if (x === undefined)
                    shooter.screenshot(false, stream, done);
                else
                    shooter.screenshot_area(Number(x), Number(y), Number(w), Number(h), stream, done);
                result = {shot: path};
                break;
            }
            case 'fullscreen': {
                // Toggle fullscreen on the focused window (simulates a video player).
                const w = global.display.focus_window;
                if (!w) {
                    result = {error: 'no focused window'};
                    break;
                }
                if (w.is_fullscreen())
                    w.unmake_fullscreen();
                else
                    w.make_fullscreen();
                result = {fullscreen: 'toggled'};
                break;
            }
            case 'pointer': {
                // Real pointer input through a virtual device, the same path as a
                // mouse: pointer move x y | pointer down | pointer up | pointer click x y
                this._ptr ??= Clutter.get_default_backend().get_default_seat()
                    .create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
                const t = () => GLib.get_monotonic_time();
                const [action, x, y] = args;
                if (x !== undefined)
                    this._ptr.notify_absolute_motion(t(), Number(x), Number(y));
                if (action === 'down' || action === 'click')
                    this._ptr.notify_button(t(), Clutter.BUTTON_PRIMARY, Clutter.ButtonState.PRESSED);
                if (action === 'up' || action === 'click')
                    this._ptr.notify_button(t(), Clutter.BUTTON_PRIMARY, Clutter.ButtonState.RELEASED);
                result = {pointer: action, x, y};
                break;
            }
            case 'set':
                // set <key> <gvariant text>, for example: set show-on 'always'
                result = this._api.setSetting(args[0], args.slice(1).join(' '));
                break;
            case 'animations-on':
                // Nested shells on software rendering inhibit animations.
                St.Settings.get().uninhibit_animations();
                result = {enabled: St.Settings.get().enable_animations};
                break;
            case 'state':
                result = this._api.dump();
                break;
            default:
                result = {error: `unknown command ${cmd}`};
            }
        } catch (e) {
            result = {error: e.message};
        }
        this._log({cmd: line, focusBefore: before, focusAfter: this._focusTitle(), result});
    }

    destroy() {
        this._monitor?.cancel();
        this._monitor = null;
    }
}
