// Terminal window lookup and actions. Runs inside the compositor, so it can activate windows on
// Wayland. Matches windows by agent ancestor process first, then by title and recency.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {ancestors} from './procs.js';
import {providerInfo} from './providers.js';

const TERMINAL_CLASS = /terminal|kitty|alacritty|wezterm|foot|tilix|konsole|xterm|ghostty|ptyxis|kgx|console/i;

function normalWindows() {
    return global.get_window_actors()
        .map(a => a.meta_window)
        .filter(w => w && w.get_window_type() === Meta.WindowType.NORMAL && !w.is_skip_taskbar());
}

export function terminalCandidates(session) {
    const wins = normalWindows();
    let candidates = [];
    if (session.pid) {
        const chain = new Set(ancestors(session.pid));
        candidates = wins.filter(w => chain.has(w.get_pid()));
    }
    if (candidates.length === 0)
        candidates = wins.filter(isTerminal);
    const project = session.cwd ? GLib.path_get_basename(session.cwd) : '';
    const score = w => {
        const title = w.get_title() ?? '';
        let s = titleScore(session, title) * 10;
        if (project && title.toLowerCase().includes(project.toLowerCase()))
            s += 2;
        return s;
    };
    return candidates.sort((a, b) => score(b) - score(a) || b.get_user_time() - a.get_user_time());
}

function isTerminal(w) {
    return TERMINAL_CLASS.test(`${w.get_wm_class() ?? ''} ${w.get_gtk_application_id() ?? ''}`);
}

// Describe the focused window for lib/core/presence.js. pid is the process
// that runs in the session's tab (the agent, or the attached client for
// shared server agents); peerPids are the same for every live session of the
// agent, the session's own included, to count how many share the window.
export function focusInfo(pid, peerPids = []) {
    const w = global.display.focus_window;
    const wpid = w?.get_pid() ?? 0;
    if (!w || !pid || wpid <= 0)
        return null;
    const owned = p => p > 0 && ancestors(p).includes(wpid);
    if (!owned(pid))
        return {title: w.get_title() ?? '', owns: false, terminal: false, siblings: 0};
    return {
        title: w.get_title() ?? '',
        owns: true,
        terminal: isTerminal(w),
        siblings: peerPids.filter(owned).length,
    };
}

export function findTerminalWindow(session) {
    return terminalCandidates(session)[0] ?? null;
}

const DEBUG = Boolean(GLib.getenv('AIMON_DEBUG'));
function debug(msg) {
    if (DEBUG)
        console.log(`[ai-activity-monitor] ${msg}`);
}

// Score how well the window title (the active tab's title) matches the
// session. Provider rules live in providers.js; 0 means "not this session".
function titleScore(session, title) {
    return providerInfo(session.provider).tabTitleScore?.(session, title ?? '') ?? 0;
}

function waitForTitleChange(win, timeoutMs) {
    return new Promise(resolve => {
        let done = false;
        const finish = changed => {
            if (done)
                return;
            done = true;
            win.disconnect(id);
            GLib.source_remove(timer);
            resolve(changed);
        };
        const id = win.connect('notify::title', () => finish(true));
        const timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, timeoutMs, () => {
            finish(false);
            return GLib.SOURCE_REMOVE;
        });
    });
}

function actionsCall(bus, path, method, params) {
    return new Promise(resolve => {
        Gio.DBus.session.call(bus, path, 'org.gtk.Actions', method, params,
            null, Gio.DBusCallFlags.NONE, 1000, null, (conn, res) => {
                try {
                    resolve(conn.call_finish(res));
                } catch (e) {
                    debug(`${method} failed: ${e.message}`);
                    resolve(null);
                }
            });
    });
}

// gnome-terminal exposes its tab switcher as the GTK action 'active-tab' on
// each window's D-Bus object. It cannot tell which tab runs which process,
// but the window title always shows the active tab's title, so walk the
// tabs once. Returns true when the session's tab was found (and left
// active); otherwise the window's original tab is restored.
async function selectTerminalTab(win, session) {
    const bus = win.get_gtk_unique_bus_name?.();
    const path = win.get_gtk_window_object_path?.();
    debug(`tab select: bus=${bus} path=${path} title=${win.get_title()} score=${titleScore(session, win.get_title())}`);
    if (titleScore(session, win.get_title()) >= 2)
        return true;
    if (!bus || !path)
        return false;
    const described = await actionsCall(bus, path, 'Describe', new GLib.Variant('(s)', ['active-tab']));
    const startIndex = described?.deepUnpack()[0]?.[2]?.[0]?.deepUnpack?.() ?? 0;
    const setTab = i => actionsCall(bus, path, 'SetState',
        new GLib.Variant('(sva{sv})', ['active-tab', new GLib.Variant('i', i), {}]));
    let unchanged = 0;
    for (let i = 0; i < 16; i++) {
        if (i === startIndex)
            continue; // already checked: it is the current title
        const before = win.get_title();
        if (!await setTab(i))
            break;
        const changed = await waitForTitleChange(win, 350);
        const title = win.get_title();
        debug(`tab ${i}: changed=${changed} title=${title} score=${titleScore(session, title)}`);
        if (!changed && title === before) {
            if (++unchanged >= 2)
                break; // past the last tab
            continue;
        }
        unchanged = 0;
        if (titleScore(session, title) >= 2)
            return true;
    }
    await setTab(startIndex);
    return false;
}

// Raise the session's terminal and switch to its tab when it can be found.
// Windows whose current title already looks like the session come first.
export function focusTerminal(session) {
    const wins = terminalCandidates(session);
    if (wins.length === 0)
        return false;
    Main.activateWindow(wins[0]);
    (async () => {
        for (const w of wins.slice(0, 6)) {
            if (await selectTerminalTab(w, session)) {
                if (global.display.focus_window !== w)
                    Main.activateWindow(w);
                return;
            }
        }
    })().catch(e => console.warn(`[ai-activity-monitor] tab select failed: ${e.message}`));
    return true;
}

// Explicit user action: open a new terminal in the session directory.
export function openTerminal(session, commandTemplate) {
    const dir = session.cwd && GLib.file_test(session.cwd, GLib.FileTest.IS_DIR) ? session.cwd : GLib.get_home_dir();
    const cmdline = (commandTemplate || 'gnome-terminal --working-directory=%d').replaceAll('%d', GLib.shell_quote(dir));
    try {
        const [, argv] = GLib.shell_parse_argv(cmdline);
        // Launch exactly like GNOME Shell launches apps (misc/util.js
        // trySpawn): the app launch context carries the display variables.
        const env = global.create_app_launch_context(0, -1).get_environment();
        Shell.util_spawn_async(dir, argv, env, GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD);
        return true;
    } catch (e) {
        console.warn(`[ai-activity-monitor] open terminal failed: ${e.message}`);
        return false;
    }
}
