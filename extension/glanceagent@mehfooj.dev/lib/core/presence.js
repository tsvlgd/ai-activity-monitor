// Presence: is the user already looking at this session? Then a bounce or a
// notification only repeats what is on screen. Pure, so Node tests cover it.
//
// The shell side (lib/windows.js) describes the focused window as:
//   title     the window title; for a terminal, the active tab's title
//   owns      the window's process is an ancestor of the session's process
//   detached  the session's process has no window process above it at all
//             (Claude Code can start its terminal client from a helper that
//             systemd adopted), so ownership cannot be proven either way
//   terminal  the window is a terminal, so its title names the active tab
//   siblings  live sessions of the same agent owned by that window's process
//
// Every unsure case answers false: notifying once too often is better than
// hiding a question the user never saw.

// Claude Code titles its tab with a status glyph (a spinner while busy, a
// star when idle), then the session title.
export const CLAUDE_GLYPH = /^[✳✶✻✽✢·*◐-◓⠀-⣿]/;

// The session part of a tab title, or null when the tab is not this agent's.
export function tabText(provider, title) {
    const t = (title ?? '').trim();
    if (provider === 'claude-code')
        return CLAUDE_GLYPH.test(t) ? t.replace(/^\S+\s*/, '') : null;
    if (provider === 'opencode') {
        const m = /^OC\b\s*\|?\s*(.*)$/.exec(t);
        return m ? m[1] : null;
    }
    return null;
}

const norm = s => s.replace(/\s+/g, ' ').trim().toLowerCase();

// Exact match, except a title the adapter clamped with an ellipsis matches
// by its prefix.
export function sameTitle(tab, title) {
    const a = norm(tab), b = norm(title);
    if (!a || !b)
        return false;
    if (b.endsWith('…'))
        return a.startsWith(b.slice(0, -1).trimEnd());
    return a === b;
}

function basename(path) {
    return (path ?? '').replace(/\/+$/, '').split('/').pop() ?? '';
}

export function isWatching(session, focus) {
    if (!session || !focus)
        return false;
    if (focus.detached && !focus.owns) {
        // Only an exact tab title proves the user is on this session.
        if (!focus.terminal || !session.title)
            return false;
        const t = tabText(session.provider, focus.title);
        return t !== null && sameTitle(t, session.title);
    }
    if (!focus.owns)
        return false;
    if (!focus.terminal) {
        // An editor such as VS Code: one window per project, and the window
        // title names the project folder.
        const project = basename(session.projectDir || session.cwd);
        return project.length > 0 && norm(focus.title ?? '').includes(project.toLowerCase());
    }
    const tab = tabText(session.provider, focus.title);
    if (tab === null)
        return false; // the active tab runs something else
    if (session.title)
        return sameTitle(tab, session.title);
    // No title to tell tabs apart: sure only when this agent runs in one tab.
    return (focus.siblings ?? 0) <= 1;
}
