import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SessionStore} from '../../extension/ai-activity-monitor@local/lib/core/store.js';
import {State, parseEvent, clampText} from '../../extension/ai-activity-monitor@local/lib/core/model.js';

let T = 1000;
const ev = (kind, extra = {}) => JSON.stringify({v: 1, ts: extra.ts ?? (T += 1), provider: 'claude-code', session: 's1', kind, ...extra});

function run(store, lines, opts = {}) {
    return lines.map(l => store.ingestLine(l, {now: T, ...opts}));
}

test('session start yields idle and is visible', () => {
    const st = new SessionStore();
    run(st, [ev('session_start', {cwd: '/w/proj', pid: 4242})]);
    const s = st.get('claude-code:s1');
    assert.equal(s.state, State.IDLE);
    assert.equal(s.pid, 4242);
    assert.equal(st.byProvider().get('claude-code').count, 1);
});

test('prompt then tool start/end keeps working, stop completes', () => {
    const st = new SessionStore();
    run(st, [ev('session_start'), ev('prompt', {detail: 'fix the tests'}), ev('tool_start', {tool: 'Bash', detail: 'Bash: npm test'})]);
    let s = st.get('claude-code:s1');
    assert.equal(s.state, State.WORKING);
    assert.equal(s.activeTools, 1);
    assert.equal(s.detail, 'Bash: npm test');
    run(st, [ev('tool_end', {tool: 'Bash'})]);
    s = st.get('claude-code:s1');
    assert.equal(s.state, State.WORKING);
    assert.equal(s.detail, 'Generating response');
    run(st, [ev('turn_complete')]);
    assert.equal(st.get('claude-code:s1').state, State.COMPLETED);
});

test('permission request waits, then resumes on tool end', () => {
    const st = new SessionStore();
    run(st, [ev('session_start'), ev('prompt'), ev('tool_start', {tool: 'Bash'}), ev('permission', {detail: 'Bash: rm -rf build'})]);
    let s = st.get('claude-code:s1');
    assert.equal(s.state, State.WAITING);
    assert.equal(s.waitingKind, 'approval');
    run(st, [ev('tool_end', {tool: 'Bash'})]);
    s = st.get('claude-code:s1');
    assert.equal(s.state, State.WORKING);
});

test('late tool_end after turn_complete does not revert to working', () => {
    const st = new SessionStore();
    run(st, [ev('session_start'), ev('prompt'), ev('tool_start')]);
    const lateTs = T + 1;
    T += 5;
    run(st, [ev('turn_complete')]);
    run(st, [ev('tool_end', {ts: lateTs})]);
    assert.equal(st.get('claude-code:s1').state, State.COMPLETED);
});

test('tool_end alone does not turn an idle session into working', () => {
    const st = new SessionStore();
    run(st, [ev('session_start'), ev('tool_end')]);
    assert.equal(st.get('claude-code:s1').state, State.IDLE);
});

test('turn error then new prompt recovers', () => {
    const st = new SessionStore();
    run(st, [ev('session_start'), ev('prompt'), ev('turn_error', {detail: 'rate_limit'})]);
    assert.equal(st.get('claude-code:s1').state, State.ERROR);
    assert.equal(st.get('claude-code:s1').lastError, 'rate_limit');
    run(st, [ev('prompt')]);
    assert.equal(st.get('claude-code:s1').state, State.WORKING);
});

test('session_end hides the provider; ended session ignores later activity', () => {
    const st = new SessionStore();
    run(st, [ev('session_start'), ev('session_end', {reason: 'prompt_input_exit'})]);
    assert.equal(st.byProvider().size, 0);
    run(st, [ev('tool_start')]);
    assert.equal(st.get('claude-code:s1').state, State.ENDED);
});

test('process gone marks unexpected end and notifies once', () => {
    const st = new SessionStore();
    run(st, [ev('session_start'), ev('prompt')]);
    const r = st.markProcessGone('claude-code:s1', {now: T + 1});
    assert.equal(r.session.state, State.ENDED);
    assert.equal(r.session.unexpectedEnd, true);
    assert.equal(r.notify.kind, 'terminated');
    assert.equal(st.markProcessGone('claude-code:s1', {now: T + 2}), null);
});

test('multiple sessions of one provider aggregate by priority with count', () => {
    const st = new SessionStore();
    const a = (kind, x = {}) => JSON.stringify({v: 1, ts: (T += 1), provider: 'opencode', session: 'A', kind, ...x});
    const b = (kind, x = {}) => JSON.stringify({v: 1, ts: (T += 1), provider: 'opencode', session: 'B', kind, ...x});
    run(st, [a('session_start'), b('session_start'), a('prompt')]);
    let agg = st.byProvider().get('opencode');
    assert.equal(agg.count, 2);
    assert.equal(agg.state, State.WORKING);
    run(st, [b('permission')]);
    agg = st.byProvider().get('opencode');
    assert.equal(agg.state, State.WAITING);
    assert.equal(agg.primary.id, 'B');
    assert.equal(agg.working, 1);
});

test('both providers tracked independently', () => {
    const st = new SessionStore();
    run(st, [ev('session_start'), ev('prompt')]);
    st.ingestLine(JSON.stringify({v: 1, ts: (T += 1), provider: 'opencode', session: 'x', kind: 'permission'}), {now: T});
    const groups = st.byProvider();
    assert.equal(groups.get('claude-code').state, State.WORKING);
    assert.equal(groups.get('opencode').state, State.WAITING);
});

test('completed decays to idle after hold time', () => {
    const st = new SessionStore({holdSeconds: 60});
    run(st, [ev('session_start'), ev('prompt'), ev('turn_complete')]);
    assert.equal(st.decayAll(T + 10).length, 0);
    assert.equal(st.decayAll(T + 61).length, 1);
    assert.equal(st.get('claude-code:s1').state, State.IDLE);
});

test('interrupt returns to idle', () => {
    const st = new SessionStore();
    run(st, [ev('session_start'), ev('prompt'), ev('turn_interrupted')]);
    assert.equal(st.get('claude-code:s1').state, State.IDLE);
});

test('malformed and foreign lines are rejected, not thrown', () => {
    const st = new SessionStore();
    assert.equal(st.ingestLine('not json'), null);
    assert.equal(st.ingestLine(JSON.stringify({v: 2, ts: 1, provider: 'x', session: 's', kind: 'prompt'})), null);
    assert.equal(st.ingestLine(JSON.stringify({v: 1, ts: 1, provider: 'BAD PROVIDER', session: 's', kind: 'prompt'})), null);
    assert.equal(st.ingestLine(JSON.stringify({v: 1, ts: 1, provider: 'x', session: 's', kind: 'process_gone'})), null);
    assert.equal(st.rejected, 4);
});

test('text is clamped and control characters stripped', () => {
    const e = parseEvent({v: 1, ts: 1, provider: 'x', session: 's', kind: 'prompt', detail: `a\nb\u0007${'z'.repeat(500)}`});
    assert.ok(e.detail.length <= 160);
    assert.ok(!/[\n\u0007]/.test(e.detail));
    assert.equal(clampText(null), '');
});

test('recent activity is bounded', () => {
    const st = new SessionStore();
    run(st, [ev('session_start'), ev('prompt')]);
    for (let i = 0; i < 30; i++)
        run(st, [ev('tool_start', {detail: `step ${i}`})]);
    assert.ok(st.get('claude-code:s1').recent.length <= 8);
});

test('project label stays on the first directory when the agent changes directory', () => {
    const st = new SessionStore();
    run(st, [ev('session_start', {cwd: '/w/app'}), ev('tool_start', {cwd: '/w/app/sub'})]);
    const s = st.get('claude-code:s1');
    assert.equal(s.projectDir, '/w/app');
    assert.equal(s.cwd, '/w/app/sub');
});

test('a parallel subagent tool event does not clear another agent approval', () => {
    const st = new SessionStore();
    run(st, [ev('session_start'), ev('prompt'), ev('permission', {agent: 'sub-a', detail: 'Approve: rm build'})]);
    run(st, [ev('tool_start', {agent: 'sub-b'}), ev('tool_end', {agent: 'sub-b'})]);
    let s = st.get('claude-code:s1');
    assert.equal(s.state, State.WAITING);
    assert.equal(s.detail, 'Approve: rm build');
    run(st, [ev('tool_end', {agent: 'sub-a'})]);
    s = st.get('claude-code:s1');
    assert.equal(s.state, State.WORKING);
});

test('two agents waiting: resolving one keeps waiting on the other', () => {
    const st = new SessionStore();
    run(st, [ev('session_start'), ev('prompt'), ev('permission', {detail: 'A'}), ev('input_needed', {agent: 'x', detail: 'B?'})]);
    run(st, [ev('permission_resolved')]);
    const s = st.get('claude-code:s1');
    assert.equal(s.state, State.WAITING);
    assert.equal(s.waitingKind, 'input');
    assert.equal(s.detail, 'B?');
});

test('idle hint never overrides an open approval', () => {
    const st = new SessionStore();
    run(st, [ev('session_start'), ev('prompt'), ev('permission'), ev('idle_hint')]);
    assert.equal(st.get('claude-code:s1').state, State.WAITING);
});

test('stale working decays to idle; running tools get a longer allowance', async () => {
    const {STALE_WORKING_SECONDS, STALE_TOOL_SECONDS} = await import('../../extension/ai-activity-monitor@local/lib/core/model.js');
    const st = new SessionStore();
    run(st, [ev('session_start'), ev('prompt')]);
    const t0 = st.get('claude-code:s1').updatedAt;
    assert.equal(st.decayAll(t0 + STALE_WORKING_SECONDS - 1).length, 0);
    assert.equal(st.decayAll(t0 + STALE_WORKING_SECONDS + 1).length, 1);
    assert.equal(st.get('claude-code:s1').state, State.IDLE);
    run(st, [ev('prompt'), ev('tool_start')]);
    const t1 = st.get('claude-code:s1').updatedAt;
    assert.equal(st.decayAll(t1 + STALE_WORKING_SECONDS + 1).length, 0);
    assert.equal(st.decayAll(t1 + STALE_TOOL_SECONDS + 1).length, 1);
});

test('zero width and bidi override characters are stripped', () => {
    assert.equal(clampText('ab​c‮def'), 'abcdef');
});

test('hideIdle drops idle sessions so an unused agent shows no tile', () => {
    const st = new SessionStore();
    run(st, [ev('session_start')]);
    assert.equal(st.byProvider().size, 1);
    assert.equal(st.byProvider({hideIdle: true}).size, 0);
    run(st, [ev('prompt')]);
    assert.equal(st.byProvider({hideIdle: true}).get('claude-code').state, State.WORKING);
});

test('dismiss acknowledges without hiding: state kept, attention stops, new state resets it', () => {
    const st = new SessionStore();
    run(st, [ev('session_start'), ev('prompt'), ev('turn_complete')]);
    assert.equal(st.acknowledge('claude-code:s1'), true);
    const s = st.get('claude-code:s1');
    assert.equal(s.state, State.COMPLETED);
    assert.equal(st.byProvider({hideIdle: true}).get('claude-code').acknowledged, true);
    run(st, [ev('prompt'), ev('turn_complete')]);
    assert.equal(st.get('claude-code:s1').acknowledged, false);
});

test('attentionSince moves when a second session needs the user, so the icon hops again', () => {
    const st = new SessionStore();
    const at = (session, kind, ts) => st.ingestLine(JSON.stringify({v: 1, ts, provider: 'claude-code', session, kind}), {now: ts});
    at('a', 'session_start', 10);
    at('b', 'session_start', 10);
    at('a', 'prompt', 11);
    at('b', 'prompt', 11);
    at('a', 'turn_complete', 40);
    const first = st.byProvider().get('claude-code').attentionSince;
    assert.equal(first, 40);
    at('b', 'permission', 50);
    assert.equal(st.byProvider().get('claude-code').attentionSince, 50);
    // Seen sessions no longer ask: acknowledging both clears the episode.
    st.acknowledge('claude-code:a');
    st.acknowledge('claude-code:b');
    const agg = st.byProvider().get('claude-code');
    assert.equal(agg.acknowledged, true);
    assert.equal(agg.attentionSince, 0);
});

test('a new attention state is news again after the previous one was seen', () => {
    const st = new SessionStore();
    const at = (kind, ts) => st.ingestLine(JSON.stringify({v: 1, ts, provider: 'claude-code', session: 's', kind}), {now: ts});
    at('session_start', 1);
    at('prompt', 2);
    at('permission', 3);
    st.acknowledge('claude-code:s');
    assert.equal(st.get('claude-code:s').acknowledged, true);
    at('tool_end', 4);
    at('turn_complete', 30);
    assert.equal(st.get('claude-code:s').acknowledged, false);
});
