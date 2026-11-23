// Small /proc helpers used for liveness checks and terminal lookup.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const decoder = new TextDecoder();

export function readStat(pid) {
    try {
        const [ok, bytes] = GLib.file_get_contents(`/proc/${pid}/stat`);
        if (!ok)
            return null;
        const s = decoder.decode(bytes);
        const open = s.indexOf('('), close = s.lastIndexOf(')');
        const rest = s.slice(close + 2).split(' ');
        return {comm: s.slice(open + 1, close), state: rest[0], ppid: Number(rest[1]), startTime: rest[19]};
    } catch {
        return null;
    }
}

// Identity = comm + start time, so a recycled PID is not mistaken for the agent.
export function processIdentity(pid) {
    const st = readStat(pid);
    return st ? `${st.comm}:${st.startTime}` : null;
}

export function ancestors(pid, max = 12) {
    const out = [];
    let cur = pid;
    for (let i = 0; i < max && cur > 1; i++) {
        const st = readStat(cur);
        if (!st)
            break;
        out.push(cur);
        cur = st.ppid;
    }
    return out;
}

// Processes whose comm matches `pattern`, with their working directory.
// Used for providers whose sessions live in a shared server (OpenCode 2.x):
// a session counts as attached while a client process sits in its directory.
export function listProcesses(pattern) {
    const out = [];
    let dir;
    try {
        dir = Gio.File.new_for_path('/proc').enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
    } catch {
        return out;
    }
    let info;
    while ((info = dir.next_file(null)) !== null) {
        const name = info.get_name();
        if (!/^[0-9]+$/.test(name))
            continue;
        try {
            const [ok, bytes] = GLib.file_get_contents(`/proc/${name}/comm`);
            if (!ok || !pattern.test(decoder.decode(bytes).trim()))
                continue;
            // A suspended (Ctrl+Z) or zombie client is not using the session.
            const st = readStat(name);
            if (!st || 'TtZX'.includes(st.state))
                continue;
            const cwd = GLib.file_read_link(`/proc/${name}/cwd`);
            out.push({pid: Number(name), cwd});
        } catch {
            // Process exited or is not ours.
        }
    }
    dir.close(null);
    return out;
}
