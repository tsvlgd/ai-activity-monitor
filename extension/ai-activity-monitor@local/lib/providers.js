// Provider registry: one entry per agent. A new agent needs an adapter plus an entry here.

// Claude Code titles its tab with a status glyph: a spinner while working,
// a star when idle.
const CLAUDE_GLYPH = /^[\u2733\u2736\u273b\u273d\u2722\u00b7*\u25d0-\u25d3\u2800-\u28ff]/;

function claudeTabScore(session, title) {
    if (!CLAUDE_GLYPH.test(title))
        return 0;
    if (session.title && title.toLowerCase().includes(session.title.toLowerCase()))
        return 3;
    // A spinner means busy, the star means idle: prefer the tab whose glyph
    // agrees with the session state.
    const busy = !/^\u2733/.test(title);
    const sessionBusy = session.state === 'working' || session.state === 'waiting';
    return busy === sessionBusy ? 2 : 1;
}

// OpenCode titles its tab "OC | <session title>".
function opencodeTabScore(session, title) {
    if (!/^OC\b/.test(title))
        return 0;
    if (session.title && title.toLowerCase().includes(session.title.toLowerCase()))
        return 3;
    return 1;
}

// clientComm: set for agents whose sessions live in a shared background server (OpenCode 2.x).
// The adapter PID is then the server, so a session counts as attached only while a client
// process with that comm runs in its directory.
// tabTitleScore(session, title): how well a terminal tab title matches the session
// (0 none, 1 right agent, 2 or more this session), used to switch to the session's tab.
export const PROVIDERS = {
    'claude-code': {name: 'Claude Code', icon: 'claude-code.svg', tileClass: 'aimon-tile-claude', order: 0, clientComm: null, tabTitleScore: claudeTabScore},
    'opencode': {name: 'OpenCode', icon: 'opencode.svg', tileClass: 'aimon-tile-opencode', order: 1, clientComm: /^opencode$/, tabTitleScore: opencodeTabScore},
};

export function providerInfo(id) {
    return PROVIDERS[id] ?? {name: id, icon: null, tileClass: '', order: 99, clientComm: null, tabTitleScore: null};
}
