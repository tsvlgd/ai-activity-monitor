// Session store: owns all session records and turns raw spool lines into
// state transitions. Pure (no GObject), so Node tests can drive it.

import {parseEvent, reduceSession, decaySession, aggregateProvider, sessionKey, Kind, State} from './model.js';
import {decideNotification, DEFAULT_POLICY} from './policy.js';

export class SessionStore {
    constructor({policy = DEFAULT_POLICY, holdSeconds = 600} = {}) {
        this.sessions = new Map();
        this.policy = {...DEFAULT_POLICY, ...policy};
        this.holdSeconds = holdSeconds;
        this.lastNotified = new Map();
        this.rejected = 0;
    }

    // Apply one raw line (string). Returns {session, prev, notify} or null.
    ingestLine(line, {replaying = false, now = Date.now() / 1000} = {}) {
        let obj;
        try {
            obj = JSON.parse(line);
        } catch {
            this.rejected++;
            return null;
        }
        const event = parseEvent(obj);
        if (!event) {
            this.rejected++;
            return null;
        }
        return this.apply(event, {replaying, now});
    }

    apply(event, {replaying = false, now = Date.now() / 1000} = {}) {
        const key = sessionKey(event.provider, event.session);
        const prev = this.sessions.get(key) ?? null;
        // A session that ended and was pruned only comes back on a real start.
        if (!prev && event.kind === Kind.SESSION_END)
            return null;
        const next = reduceSession(prev, event);
        this.sessions.set(key, next);
        const notify = decideNotification(prev, next, {replaying, now, lastNotified: this.lastNotified}, this.policy);
        if (notify)
            this.lastNotified.set(key, {kind: notify.kind, at: now});
        return {session: next, prev, notify};
    }

    // Synthesized by the liveness checker when the agent PID disappeared
    // without a session_end event (terminal closed, crash, kill).
    markProcessGone(key, {now = Date.now() / 1000, replaying = false} = {}) {
        const prev = this.sessions.get(key);
        if (!prev || prev.state === State.ENDED)
            return null;
        return this.apply({
            v: 1, ts: now, provider: prev.provider, session: prev.id, kind: Kind.PROCESS_GONE,
            detail: '', tool: '', cwd: '', title: '', pid: null, reason: 'terminated', term: null,
        }, {now, replaying});
    }

    decayAll(now = Date.now() / 1000) {
        const changed = [];
        for (const [key, s] of this.sessions) {
            const next = decaySession(s, now, this.holdSeconds);
            if (next !== s) {
                this.sessions.set(key, next);
                changed.push(next);
            }
        }
        return changed;
    }

    // Normal end detected by the monitor (for example a detached session).
    end(key, reason, {now = Date.now() / 1000} = {}) {
        const prev = this.sessions.get(key);
        if (!prev || prev.state === State.ENDED)
            return null;
        return this.apply({
            v: 1, ts: now, provider: prev.provider, session: prev.id, kind: Kind.SESSION_END,
            detail: '', tool: '', cwd: '', title: '', pid: null, reason, term: null,
        }, {now, replaying: true});
    }

    // User dismissed the preview: the result was seen. The session keeps its
    // state (so its icon stays visible) but stops bouncing for attention.
    acknowledge(key) {
        const s = this.sessions.get(key);
        if (!s || s.acknowledged)
            return false;
        this.sessions.set(key, {...s, acknowledged: true});
        return true;
    }

    remove(key) {
        this.sessions.delete(key);
        this.lastNotified.delete(key);
    }

    get(key) {
        return this.sessions.get(key) ?? null;
    }

    liveSessions() {
        return [...this.sessions.values()].filter(s => s.state !== State.ENDED);
    }

    // hideIdle: only sessions that are busy, waiting or just finished count,
    // so an open but unused agent shows no tile.
    byProvider({hideIdle = false} = {}) {
        const groups = new Map();
        for (const s of this.sessions.values()) {
            if (hideIdle && s.state === State.IDLE)
                continue;
            if (!groups.has(s.provider))
                groups.set(s.provider, []);
            groups.get(s.provider).push(s);
        }
        const out = new Map();
        for (const [provider, list] of groups) {
            const agg = aggregateProvider(list);
            if (agg)
                out.set(provider, agg);
        }
        return out;
    }
}
