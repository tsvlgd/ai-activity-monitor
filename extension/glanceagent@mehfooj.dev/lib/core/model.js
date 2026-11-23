// Provider independent session model.
//
// Pure ES module: no GObject imports, so it runs under GJS (inside GNOME
// Shell) and under Node (unit tests) unchanged.
//
// Data flow: adapter -> normalized event (spool line) -> reduceSession()
// -> session record -> aggregateProvider() -> presentation layer.

export const SCHEMA_VERSION = 1;

export const State = Object.freeze({
    IDLE: 'idle',
    WORKING: 'working',
    WAITING: 'waiting',
    COMPLETED: 'completed',
    ERROR: 'error',
    ENDED: 'ended',
});

// Normalized event kinds. Adapters must only emit these.
export const Kind = Object.freeze({
    SESSION_START: 'session_start',
    PROMPT: 'prompt',
    ACTIVITY: 'activity',
    TOOL_START: 'tool_start',
    TOOL_END: 'tool_end',
    TOOL_ERROR: 'tool_error',
    PERMISSION: 'permission',
    PERMISSION_RESOLVED: 'permission_resolved',
    INPUT_NEEDED: 'input_needed',
    TURN_COMPLETE: 'turn_complete',
    TURN_ERROR: 'turn_error',
    TURN_INTERRUPTED: 'turn_interrupted',
    // Agent reports it is idle at the prompt (Claude idle_prompt). Only
    // corrects a stale working/waiting state, never overrides completed.
    IDLE_HINT: 'idle_hint',
    SESSION_END: 'session_end',
    // Synthesized by the monitor itself, never by adapters.
    PROCESS_GONE: 'process_gone',
});

const KNOWN_KINDS = new Set(Object.values(Kind));
const MAX_RECENT = 8;
const MAX_TEXT = 160;

// Higher wins when several sessions of one provider are shown by one icon.
const PRIORITY = {
    [State.WAITING]: 50,
    [State.ERROR]: 40,
    [State.WORKING]: 30,
    [State.COMPLETED]: 20,
    [State.IDLE]: 10,
    [State.ENDED]: 0,
};

export function clampText(value, max = MAX_TEXT) {
    if (value === undefined || value === null)
        return '';
    // Control, zero width and bidi override characters could hide or reorder text.
    const s = String(value)
        .replace(/[\u0000-\u001f\u007f]+/g, ' ')
        .replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '')
        .replace(/\s+/g, ' ').trim();
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// Validate and normalize one raw spool line object. Returns null if unusable.
export function parseEvent(obj) {
    if (!obj || typeof obj !== 'object')
        return null;
    if (obj.v !== SCHEMA_VERSION)
        return null;
    if (typeof obj.provider !== 'string' || !/^[a-z0-9-]{1,32}$/.test(obj.provider))
        return null;
    if (typeof obj.session !== 'string' || obj.session.length === 0 || obj.session.length > 128)
        return null;
    if (!KNOWN_KINDS.has(obj.kind) || obj.kind === Kind.PROCESS_GONE)
        return null;
    const ts = Number(obj.ts);
    if (!Number.isFinite(ts) || ts <= 0)
        return null;
    const pid = Number.isInteger(obj.pid) && obj.pid > 1 ? obj.pid : null;
    return {
        v: SCHEMA_VERSION,
        ts,
        provider: obj.provider,
        session: obj.session,
        kind: obj.kind,
        detail: clampText(obj.detail),
        tool: clampText(obj.tool, 48),
        cwd: typeof obj.cwd === 'string' ? obj.cwd.slice(0, 1024) : '',
        title: clampText(obj.title, 96),
        pid,
        reason: clampText(obj.reason, 48),
        // Which agent inside the session (main thread, subagent id, child session).
        agent: typeof obj.agent === 'string' ? obj.agent.slice(0, 64) : '',
        term: sanitizeTerm(obj.term),
    };
}

function sanitizeTerm(term) {
    if (!term || typeof term !== 'object')
        return null;
    const out = {};
    for (const key of ['screen', 'service', 'program', 'window'])
        if (typeof term[key] === 'string' && term[key].length < 256)
            out[key] = term[key];
    return Object.keys(out).length ? out : null;
}

export function sessionKey(provider, session) {
    return `${provider}:${session}`;
}

export function newSession(event) {
    return {
        key: sessionKey(event.provider, event.session),
        provider: event.provider,
        id: event.session,
        state: State.IDLE,
        since: event.ts,
        startedAt: event.ts,
        updatedAt: event.ts,
        turnStartedAt: null,
        turnBoundaryTs: 0,
        cwd: '',
        // First directory seen: a stable project label even if the agent cd's.
        projectDir: '',
        title: '',
        pid: null,
        term: null,
        detail: '',
        waitingKind: null,
        // Pending approvals or questions, keyed by agent, so a parallel
        // subagent's tool events cannot clear another agent's prompt.
        pending: {},
        activeTools: 0,
        lastError: '',
        endReason: '',
        unexpectedEnd: false,
        recent: [],
    };
}

function pushRecent(s, ts, text, level = 'info') {
    if (!text)
        return;
    const last = s.recent[s.recent.length - 1];
    if (last && last.text === text && last.level === level)
        return;
    s.recent.push({ts, text, level});
    if (s.recent.length > MAX_RECENT)
        s.recent.splice(0, s.recent.length - MAX_RECENT);
}

function setState(s, state, ts) {
    if (s.state !== state) {
        s.state = state;
        s.since = ts;
        // A new state is news again: it may bounce until seen.
        s.acknowledged = false;
    }
}

// An agent produced any later event: its own pending prompt was answered.
// The session leaves WAITING only when no agent is still blocked.
function resolvePending(s, agent, ts) {
    delete s.pending[agent];
    const left = Object.values(s.pending);
    if (s.state !== State.WAITING)
        return;
    if (left.length === 0) {
        setState(s, State.WORKING, ts);
        s.waitingKind = null;
        s.detail = s.activeTools > 0 ? s.detail : 'Generating response';
    } else {
        s.waitingKind = left[0].kind;
        s.detail = left[0].detail;
    }
}

function clearTurn(s) {
    s.pending = {};
    s.waitingKind = null;
    s.activeTools = 0;
}

// Pure reducer: returns a new session object, never mutates `prev`.
export function reduceSession(prev, event) {
    const s = prev
        ? {...prev, recent: prev.recent.slice(), pending: {...prev.pending}}
        : newSession(event);
    const agent = event.agent || 'main';

    // An ended session only comes back if the agent explicitly restarts it.
    if (s.state === State.ENDED && event.kind !== Kind.SESSION_START)
        return s;

    // Events older than the last turn boundary are late stragglers from a
    // turn that already finished (parallel hook processes can reorder).
    const isTurnStart = event.kind === Kind.PROMPT || event.kind === Kind.SESSION_START;
    if (!isTurnStart && event.ts < s.turnBoundaryTs)
        return s;

    s.updatedAt = Math.max(s.updatedAt, event.ts);
    if (event.cwd) {
        s.cwd = event.cwd;
        if (!s.projectDir)
            s.projectDir = event.cwd;
    }
    if (event.title)
        s.title = event.title;
    if (event.pid)
        s.pid = event.pid;
    if (event.term)
        s.term = event.term;

    switch (event.kind) {
    case Kind.SESSION_START:
        if (s.state === State.ENDED || !prev) {
            setState(s, State.IDLE, event.ts);
            s.unexpectedEnd = false;
            s.endReason = '';
        }
        if (event.reason === 'clear') {
            setState(s, State.IDLE, event.ts);
            s.recent = [];
        }
        s.activeTools = 0;
        s.detail = s.state === State.IDLE ? 'Ready' : s.detail;
        break;

    case Kind.PROMPT:
        setState(s, State.WORKING, event.ts);
        s.turnStartedAt = event.ts;
        clearTurn(s);
        s.lastError = '';
        s.detail = 'Generating response';
        pushRecent(s, event.ts, event.detail ? `› ${event.detail}` : '› New prompt');
        break;

    case Kind.ACTIVITY:
        if (s.pending[agent])
            resolvePending(s, agent, event.ts);
        if (s.state !== State.WAITING) {
            if (s.state !== State.WORKING)
                s.turnStartedAt = event.ts;
            setState(s, State.WORKING, event.ts);
            s.detail = event.detail || 'Working';
        }
        break;

    case Kind.TOOL_START: {
        if (s.state !== State.WORKING && s.state !== State.WAITING)
            s.turnStartedAt = event.ts;
        s.activeTools += 1;
        const text = event.detail || (event.tool ? `Running ${event.tool}` : 'Running tool');
        pushRecent(s, event.ts, text);
        if (s.state === State.WAITING) {
            resolvePending(s, agent, event.ts);
            if (s.state === State.WORKING)
                s.detail = text;
        } else {
            setState(s, State.WORKING, event.ts);
            s.detail = text;
        }
        break;
    }

    case Kind.TOOL_END:
    case Kind.TOOL_ERROR:
        s.activeTools = Math.max(0, s.activeTools - 1);
        if (event.kind === Kind.TOOL_ERROR)
            pushRecent(s, event.ts, event.detail || `${event.tool || 'Tool'} failed`, 'warn');
        if (s.state === State.WAITING)
            resolvePending(s, agent, event.ts);
        else if (s.state === State.WORKING)
            s.detail = s.activeTools > 0 ? s.detail : 'Generating response';
        break;

    case Kind.PERMISSION:
    case Kind.INPUT_NEEDED:
        setState(s, State.WAITING, event.ts);
        s.waitingKind = event.kind === Kind.PERMISSION ? 'approval' : 'input';
        s.detail = event.detail || (s.waitingKind === 'approval' ? 'Approval required' : 'Waiting for input');
        s.pending[agent] = {kind: s.waitingKind, detail: s.detail};
        pushRecent(s, event.ts, s.detail, 'attention');
        break;

    case Kind.PERMISSION_RESOLVED:
        resolvePending(s, agent, event.ts);
        break;

    case Kind.TURN_COMPLETE: {
        const dur = s.turnStartedAt ? event.ts - s.turnStartedAt : 0;
        setState(s, State.COMPLETED, event.ts);
        s.turnBoundaryTs = event.ts;
        clearTurn(s);
        s.detail = event.detail || 'Task completed';
        s.lastTurnSeconds = dur;
        pushRecent(s, event.ts, `Completed${dur >= 1 ? ` in ${formatDuration(dur)}` : ''}`, 'success');
        s.turnStartedAt = null;
        break;
    }

    case Kind.TURN_INTERRUPTED:
        setState(s, State.IDLE, event.ts);
        s.turnBoundaryTs = event.ts;
        clearTurn(s);
        s.turnStartedAt = null;
        s.detail = 'Interrupted';
        pushRecent(s, event.ts, 'Interrupted', 'warn');
        break;

    case Kind.IDLE_HINT:
        // Idle at the prompt: corrects a stale working state. An open
        // approval dialog is never overridden by an idle hint.
        if (s.state === State.WORKING) {
            setState(s, State.IDLE, event.ts);
            s.turnBoundaryTs = event.ts;
            clearTurn(s);
            s.turnStartedAt = null;
            s.detail = 'Waiting for your next prompt';
        }
        break;

    case Kind.TURN_ERROR:
        setState(s, State.ERROR, event.ts);
        s.turnBoundaryTs = event.ts;
        clearTurn(s);
        s.turnStartedAt = null;
        s.lastError = event.detail || 'Agent error';
        s.detail = s.lastError;
        pushRecent(s, event.ts, s.lastError, 'error');
        break;

    case Kind.SESSION_END:
        setState(s, State.ENDED, event.ts);
        s.endReason = event.reason || 'exit';
        s.unexpectedEnd = false;
        s.activeTools = 0;
        break;

    case Kind.PROCESS_GONE:
        setState(s, State.ENDED, event.ts);
        s.endReason = 'terminated';
        s.unexpectedEnd = true;
        s.activeTools = 0;
        pushRecent(s, event.ts, 'Session ended unexpectedly', 'error');
        break;
    }
    return s;
}

// Time based decay, applied by the monitor on a slow timer.
// Completed and error states fall back to idle after `holdSeconds` so a
// stale check mark does not stay forever.
// A working session with no event for this long is treated as idle: the
// end of its turn was missed (interrupt, crash of a hook). Long running
// tools get a longer allowance, since tools emit nothing while they run.
export const STALE_WORKING_SECONDS = 20 * 60;
export const STALE_TOOL_SECONDS = 2 * 3600;

export function decaySession(s, now, holdSeconds) {
    if ((s.state === State.COMPLETED || s.state === State.ERROR) && now - s.since >= holdSeconds) {
        const next = {...s};
        setState(next, State.IDLE, now);
        next.detail = 'Ready';
        return next;
    }
    const staleAfter = s.activeTools > 0 ? STALE_TOOL_SECONDS : STALE_WORKING_SECONDS;
    if (s.state === State.WORKING && now - s.updatedAt >= staleAfter) {
        const next = {...s, pending: {}, activeTools: 0, waitingKind: null, turnStartedAt: null};
        setState(next, State.IDLE, now);
        next.detail = 'No activity reported';
        return next;
    }
    return s;
}

export function aggregateProvider(sessions) {
    const live = sessions.filter(s => s.state !== State.ENDED);
    if (live.length === 0)
        return null;
    let top = live[0];
    for (const s of live) {
        const a = PRIORITY[s.state], b = PRIORITY[top.state];
        if (a > b || (a === b && s.updatedAt > top.updatedAt))
            top = s;
    }
    return {
        provider: top.provider,
        state: top.state,
        // Seen by the user (Dismiss): keep showing, stop asking for attention.
        acknowledged: live.every(s => s.acknowledged || s.state === State.WORKING || s.state === State.IDLE),
        // When the newest unseen attention began: a later one hops again.
        attentionSince: Math.max(0, ...live.filter(s => !s.acknowledged &&
            (s.state === State.WAITING || s.state === State.COMPLETED || s.state === State.ERROR)).map(s => s.since ?? 0)),
        primary: top,
        count: live.length,
        working: live.filter(s => s.state === State.WORKING).length,
        sessions: live.slice().sort((x, y) => PRIORITY[y.state] - PRIORITY[x.state] || y.updatedAt - x.updatedAt),
    };
}

export function formatDuration(seconds) {
    const sec = Math.max(0, Math.round(seconds));
    if (sec < 60)
        return `${sec}s`;
    const m = Math.floor(sec / 60);
    if (m < 60)
        return `${m}m`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
}

export function formatAgo(seconds) {
    if (seconds < 10)
        return 'just now';
    return `${formatDuration(seconds)} ago`;
}

export const STATE_LABEL = {
    [State.IDLE]: 'Idle',
    [State.WORKING]: 'Working',
    [State.WAITING]: 'Waiting',
    [State.COMPLETED]: 'Completed',
    [State.ERROR]: 'Error',
    [State.ENDED]: 'Ended',
};
