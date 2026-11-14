// Spool watcher: replays every per session JSONL file silently at startup, then follows appends
// through a Gio.FileMonitor. Files are small, so re reading and slicing from the offset is enough.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const DEBOUNCE_MS = 40;
const decoder = new TextDecoder();

export function defaultSpoolDir() {
    const override = GLib.getenv('AIMON_SPOOL_DIR');
    if (override)
        return override;
    return GLib.build_filenamev([GLib.get_user_runtime_dir(), 'ai-activity-monitor', 'spool']);
}

export class SpoolWatcher {
    // onLines(path, lines, {replaying, reset}) is called with complete lines.
    constructor(dir, onLines) {
        this._dir = dir;
        this._onLines = onLines;
        this._offsets = new Map();
        this._pending = new Map();
        this._monitor = null;
    }

    start() {
        GLib.mkdir_with_parents(this._dir, 0o700);
        const dirFile = Gio.File.new_for_path(this._dir);
        this._monitor = dirFile.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
        this._monitor.connect('changed', (_m, file, other, type) => this._onChanged(file, other, type));
        for (const path of this._listFiles())
            this._read(path, true);
    }

    stop() {
        this._monitor?.cancel();
        this._monitor = null;
        for (const id of this._pending.values())
            GLib.source_remove(id);
        this._pending.clear();
        this._offsets.clear();
    }

    deleteFile(path) {
        if (!path.startsWith(`${this._dir}/`))
            return;
        this._offsets.delete(path);
        for (const p of [path, `${path}.lock`]) {
            try {
                Gio.File.new_for_path(p).delete(null);
            } catch {
                // Already gone.
            }
        }
    }

    _listFiles() {
        const out = [];
        let en;
        try {
            en = Gio.File.new_for_path(this._dir).enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
        } catch {
            return out;
        }
        let info;
        while ((info = en.next_file(null)) !== null) {
            const name = info.get_name();
            if (name.endsWith('.jsonl'))
                out.push(GLib.build_filenamev([this._dir, name]));
        }
        en.close(null);
        return out;
    }

    _onChanged(file, other, type) {
        const T = Gio.FileMonitorEvent;
        let target = file;
        if (type === T.RENAMED || type === T.MOVED_IN)
            target = other ?? file;
        if (type === T.DELETED || type === T.MOVED_OUT) {
            this._offsets.delete(file.get_path());
            return;
        }
        if (![T.CHANGED, T.CREATED, T.CHANGES_DONE_HINT, T.RENAMED, T.MOVED_IN].includes(type))
            return;
        const path = target?.get_path();
        if (!path || !path.endsWith('.jsonl'))
            return;
        if (this._pending.has(path))
            return;
        this._pending.set(path, GLib.timeout_add(GLib.PRIORITY_DEFAULT, DEBOUNCE_MS, () => {
            this._pending.delete(path);
            this._read(path, false);
            return GLib.SOURCE_REMOVE;
        }));
    }

    _read(path, replaying) {
        let bytes;
        try {
            [, bytes] = Gio.File.new_for_path(path).load_contents(null);
        } catch {
            return;
        }
        let offset = this._offsets.get(path) ?? 0;
        let reset = false;
        // File shrank: an adapter compacted it. Rebuild that session from scratch.
        if (bytes.length < offset) {
            offset = 0;
            reset = true;
        }
        const end = bytes.lastIndexOf(10); // last newline
        if (end < offset) {
            return;
        }
        const chunk = decoder.decode(bytes.subarray(offset, end + 1));
        this._offsets.set(path, end + 1);
        const lines = chunk.split('\n').filter(l => l.length > 0);
        if (lines.length)
            this._onLines(path, lines, {replaying: replaying || reset, reset});
    }
}
