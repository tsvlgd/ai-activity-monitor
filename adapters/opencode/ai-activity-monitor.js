// OpenCode (v2 plugin API) adapter: maps the few events that change session state to the
// normalized schema (docs/EVENTS.md) and appends one JSON line per change to a per session
// spool file. Streaming deltas are ignored. All errors are swallowed: it must never break OpenCode.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PROVIDER = 'opencode';
const MAX_SPOOL_BYTES = 256 * 1024;
const KEEP_LINES = 200;

// Keep in sync with SECRET_PATTERNS in adapters/claude-code/aimon_hook.py.
const SECRET = [
    // Bearer first, so "Authorization: Bearer <tok>" cannot leave <tok> behind.
    [/\bbearer\s+\S+/gi, '[redacted]'],
    [/\b\w*(api_?key|token|secret|passw(or)?d|passwd|credential)\w*\s*[:=]\s*\S+/gi, '[redacted]'],
    [/\b(authorization)\s*[:=]\s*\S+/gi, '[redacted]'],
    [/\b(sk|ghp|gho|ghs|github_pat|xox[bap]|glpat|AKIA)[-_]?[A-Za-z0-9_-]{8,}/g, '[redacted]'],
    [/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/:@]+:[^\s/@]+@/gi, '$1[redacted]@'],
    [/\b(mysql|mariadb|mysqldump|mysqladmin)\b(.*?)\s-p(?!\s)\S+/gi, '$1$2 -p[redacted]'],
];

const HOME = os.homedir();

export function oneLine(value, limit = 120) {
    if (typeof value !== 'string')
        return '';
    let s = value.trim().split('\n')[0] ?? '';
    for (const [re, sub] of SECRET)
        s = s.replace(re, sub);
    if (HOME && HOME !== '/')
        s = s.replaceAll(HOME, '~');
    return s.length > limit ? `${s.slice(0, limit - 1)}…` : s;
}

export function spoolDir(env = process.env) {
    if (env.AIMON_SPOOL_DIR)
        return env.AIMON_SPOOL_DIR;
    const runtime = env.XDG_RUNTIME_DIR || `/run/user/${os.userInfo().uid}`;
    return path.join(runtime, 'ai-activity-monitor', 'spool');
}

function terminalInfo(env = process.env) {
    const t = {};
    if (env.GNOME_TERMINAL_SCREEN)
        t.screen = env.GNOME_TERMINAL_SCREEN;
    if (env.GNOME_TERMINAL_SERVICE)
        t.service = env.GNOME_TERMINAL_SERVICE;
    const program = env.TERM_PROGRAM || (env.KITTY_WINDOW_ID ? 'kitty' : '');
    if (program)
        t.program = program;
    return Object.keys(t).length ? t : undefined;
}

function describeTool(name, input) {
    const i = input && typeof input === 'object' ? input : {};
    const base = p => (typeof p === 'string' && p ? path.basename(p) : '');
    switch (name) {
    case 'bash':
    case 'shell':
        return i.command ? `Running ${oneLine(i.command, 90)}` : 'Running command';
    case 'edit':
    case 'write':
    case 'patch':
        return base(i.path || i.filePath) ? `Editing ${base(i.path || i.filePath)}` : 'Editing file';
    case 'read':
        return base(i.path || i.filePath) ? `Reading ${base(i.path || i.filePath)}` : 'Reading file';
    case 'grep':
    case 'glob':
        return `Searching ${oneLine(i.pattern || '', 60)}`.trim();
    case 'task':
        return `Subagent: ${oneLine(i.description || '', 70)}`;
    default:
        return name ? `Running ${name}` : 'Running tool';
    }
}

// Pure mapper: (event, tracker) -> list of normalized partial events.
// The tracker holds per process memory: subagent parents, pending prompts,
// tool names by call id, and which sessions were announced.
export function createTracker() {
    return {
        parentOf: new Map(),
        toolNames: new Map(),
        pendingPrompt: new Map(),
        announced: new Set(),
        lastActivity: new Map(),
        dirOf: new Map(),
    };
}

export function mapEvent(e, tr) {
    if (!e || typeof e.type !== 'string')
        return [];
    const d = e.data ?? e.properties ?? {};
    const sid0 = d.sessionID ?? d.session?.id ?? d.info?.id;
    if (!sid0 && e.type !== 'location.shutdown' && e.type !== 'server.instance.disposed')
        return [];
    // Subagent (child) sessions are reported on their root session.
    let sid = sid0;
    const isChild = sid0 && tr.parentOf.has(sid0);
    while (sid && tr.parentOf.has(sid))
        sid = tr.parentOf.get(sid);
    // One plugin instance sees every session on the shared server bus, so the
    // directory must come from the session's own events, never the plugin's.
    const seenDir = d.location?.directory || e.location?.directory || '';
    if (sid && seenDir)
        tr.dirOf.set(sid, seenDir);
    const cwd = (sid && tr.dirOf.get(sid)) || '';
    const out = [];
    // Child (subagent) sessions report on the root; their own id keeps their
    // pending approvals apart from the root agent's.
    const agent = isChild ? sid0 : '';
    const emit = (kind, extra = {}) => out.push({session: sid, kind, cwd, ...(agent ? {agent} : {}), ...extra});
    const announce = () => {
        if (sid && !tr.announced.has(sid)) {
            tr.announced.add(sid);
            emit('session_start', {title: oneLine(d.title || '', 90)});
        }
    };
    const activity = detail => {
        if (tr.lastActivity.get(sid) === detail)
            return;
        tr.lastActivity.set(sid, detail);
        emit('activity', {detail});
    };

    switch (e.type) {
    case 'session.created':
        if (d.parentID) {
            tr.parentOf.set(sid0, d.parentID);
            return [];
        }
        announce();
        return out;
    case 'session.viewed':
        announce();
        return out;
    case 'session.inbox.enqueued':
        if (!isChild)
            tr.pendingPrompt.set(sid, oneLine(d.item?.payload?.text ?? '', 140));
        return [];
    case 'session.execution.started':
        if (isChild)
            return [];
        announce();
        tr.lastActivity.delete(sid);
        emit('prompt', {detail: tr.pendingPrompt.get(sid) ?? ''});
        tr.pendingPrompt.delete(sid);
        return out;
    case 'session.reasoning.started':
        announce();
        activity('Thinking');
        return out;
    case 'session.step.started':
    case 'session.text.started':
        announce();
        activity('Generating response');
        return out;
    case 'session.compaction.started':
        activity('Compacting context');
        return out;
    case 'session.retry.scheduled':
        activity(`Retrying: ${oneLine(d.error?.message ?? '', 60)}`);
        return out;
    case 'session.tool.input.started':
        if (d.id && d.name)
            tr.toolNames.set(d.id, d.name);
        return [];
    case 'session.tool.called': {
        announce();
        const name = tr.toolNames.get(d.id) ?? d.name ?? d.tool ?? '';
        tr.lastActivity.delete(sid);
        if (name === 'question') {
            // The question tool blocks on the user: that is waiting, not work.
            const q = d.input?.questions?.[0]?.question ?? d.input?.question ?? '';
            emit('input_needed', {tool: name, detail: oneLine(q, 100) || 'Question for you'});
            return out;
        }
        emit('tool_start', {tool: name, detail: describeTool(name, d.input)});
        return out;
    }
    case 'session.tool.success':
        tr.toolNames.delete(d.id);
        emit('tool_end', {});
        return out;
    case 'session.tool.failed':
        tr.toolNames.delete(d.id);
        emit('tool_error', {detail: oneLine(d.error?.message ?? 'Tool failed', 100)});
        return out;
    case 'permission.asked': {
        announce();
        const what = [d.permission, Array.isArray(d.patterns) ? d.patterns[0] : ''].filter(Boolean).join(' ');
        emit('permission', {detail: `Approve: ${oneLine(what || 'tool use', 100)}`});
        return out;
    }
    case 'question.asked':
        announce();
        emit('input_needed', {detail: oneLine(d.questions?.[0]?.question ?? 'Question for you', 100)});
        return out;
    case 'permission.replied':
    case 'permission.rejected':
    case 'question.replied':
    case 'question.rejected':
        emit('permission_resolved', {});
        return out;
    case 'session.execution.succeeded':
        if (isChild)
            return [];
        tr.lastActivity.delete(sid);
        emit('turn_complete', {});
        return out;
    case 'session.execution.interrupted':
        if (isChild)
            return [];
        tr.lastActivity.delete(sid);
        emit('turn_interrupted', {});
        return out;
    case 'session.execution.failed':
    case 'session.error':
        if (isChild)
            return [];
        tr.lastActivity.delete(sid);
        emit('turn_error', {detail: oneLine(d.error?.message ?? d.error?.data?.message ?? d.error?.type ?? 'Agent error', 100)});
        return out;
    case 'session.renamed':
        if (d.title && !isChild)
            emit('activity_meta', {title: oneLine(d.title, 90)});
        return out;
    case 'session.deleted':
        if (isChild)
            return [];
        tr.announced.delete(sid);
        emit('session_end', {reason: 'deleted'});
        return out;
    case 'location.shutdown': {
        // One project location shut down: end only the sessions in it.
        // Without a location (or for a whole server dispose) end them all.
        const dir = e.location?.directory || d.location?.directory || d.directory || '';
        const ended = [...tr.announced].filter(s => !dir || tr.dirOf.get(s) === dir);
        for (const s of ended)
            tr.announced.delete(s);
        return ended.map(s => ({session: s, kind: 'session_end', reason: 'exit', cwd: tr.dirOf.get(s) || ''}));
    }
    case 'server.instance.disposed': {
        const all = [...tr.announced];
        tr.announced.clear();
        return all.map(s => ({session: s, kind: 'session_end', reason: 'exit', cwd: tr.dirOf.get(s) || ''}));
    }
    default:
        return [];
    }
}

function safeName(s) {
    return String(s).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 96);
}

export function createWriter({dir = spoolDir(), pid = process.pid, term = terminalInfo(), now = () => Date.now() / 1000} = {}) {
    let ready = false;
    return function write(partial) {
        try {
            if (!ready) {
                fs.mkdirSync(dir, {recursive: true, mode: 0o700});
                ready = true;
            }
            const kind = partial.kind;
            if (!kind || kind === 'activity_meta' || !partial.session)
                return;
            const ev = {v: 1, ts: Math.round(now() * 1000) / 1000, provider: PROVIDER, session: partial.session, kind};
            if (partial.detail)
                ev.detail = partial.detail;
            if (partial.tool)
                ev.tool = partial.tool;
            if (partial.reason)
                ev.reason = partial.reason;
            if (partial.agent)
                ev.agent = partial.agent;
            if (partial.title)
                ev.title = partial.title;
            ev.cwd = partial.cwd || '';
            if (kind === 'session_start' || kind === 'prompt') {
                ev.pid = pid;
                if (term)
                    ev.term = term;
            }
            const file = path.join(dir, `${PROVIDER}--${safeName(partial.session)}.jsonl`);
            fs.appendFileSync(file, `${JSON.stringify(ev)}\n`, {mode: 0o600});
            const size = fs.statSync(file).size;
            if (size > MAX_SPOOL_BYTES) {
                const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
                const tmp = `${file}.tmp${process.pid}`;
                fs.writeFileSync(tmp, `${[lines[0], ...lines.slice(-KEEP_LINES)].join('\n')}\n`, {mode: 0o600});
                fs.renameSync(tmp, file);
            }
        } catch {
            // Never surface errors into OpenCode.
        }
    };
}

// OpenCode 2.x runs one shared server that loads this plugin once per
// project location, and every instance sees the whole event bus. A per
// process registry keeps exactly one active subscription (so events are
// written once) and hands it to a surviving instance when the active one is
// disposed (so monitoring never goes silent while the server lives). The
// tracker is shared, so session memory survives the handover.
const REGISTRY = Symbol.for('ai-activity-monitor.registry');

export function createRegistry({writer = createWriter()} = {}) {
    const reg = {instances: [], active: null, tracker: createTracker(), titles: new Map(), write: writer};

    const handle = e => {
        for (const p of mapEvent(e, reg.tracker)) {
            if (p.kind === 'activity_meta') {
                reg.titles.set(p.session, p.title);
                continue;
            }
            if (!p.title && reg.titles.has(p.session))
                p.title = reg.titles.get(p.session);
            reg.write(p);
        }
    };

    const start = inst => {
        reg.active = inst;
        inst.controller = new AbortController();
        if (!inst.ctx.event?.subscribe)
            return;
        (async () => {
            try {
                for await (const e of inst.ctx.event.subscribe({signal: inst.controller.signal}))
                    handle(e);
            } catch {
                // Stream closed (abort on dispose) or bus error.
            }
        })();
    };

    reg.add = ctx => {
        const inst = {ctx, controller: null};
        reg.instances.push(inst);
        if (!reg.active)
            start(inst);
        return () => reg.remove(inst);
    };

    reg.remove = inst => {
        reg.instances = reg.instances.filter(i => i !== inst);
        if (reg.active !== inst)
            return;
        inst.controller?.abort();
        reg.active = null;
        if (reg.instances.length > 0) {
            start(reg.instances[0]);
        } else {
            // Last instance gone: the server is shutting down.
            handle({type: 'server.instance.disposed', data: {}});
        }
    };

    reg.handle = handle;
    return reg;
}

export default {
    id: 'ai-activity-monitor',
    async setup(ctx = {}) {
        globalThis[REGISTRY] ??= createRegistry();
        return globalThis[REGISTRY].add(ctx);
    },
};
