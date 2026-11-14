import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mapEvent, createTracker, oneLine} from '../../adapters/opencode/ai-activity-monitor.js';

const kinds = (events, tr = createTracker()) => events.flatMap(e => mapEvent(e, tr)).map(p => `${p.session}:${p.kind}`);

test('observed v2 turn sequence maps to prompt, activity, tool, complete', () => {
    const sid = 'ses_1';
    const seq = [
        {type: 'session.inbox.enqueued', data: {sessionID: sid, item: {payload: {text: 'say hello'}}}},
        {type: 'session.execution.started', data: {sessionID: sid}},
        {type: 'session.step.started', data: {sessionID: sid}},
        {type: 'session.text.started', data: {sessionID: sid}},
        {type: 'session.text.delta', data: {sessionID: sid, delta: 'h'}},
        {type: 'session.tool.input.started', data: {sessionID: sid, id: 'c1', name: 'bash'}},
        {type: 'session.tool.called', data: {sessionID: sid, id: 'c1', input: {command: 'npm test'}}},
        {type: 'session.tool.success', data: {sessionID: sid, id: 'c1'}},
        {type: 'session.execution.succeeded', data: {sessionID: sid}},
    ];
    assert.deepEqual(kinds(seq), [
        'ses_1:session_start', 'ses_1:prompt', 'ses_1:activity', 'ses_1:tool_start', 'ses_1:tool_end', 'ses_1:turn_complete',
    ]);
});

test('tool name comes from input.started and detail is descriptive', () => {
    const tr = createTracker();
    mapEvent({type: 'session.tool.input.started', data: {sessionID: 's', id: 'c', name: 'bash'}}, tr);
    const [, p] = mapEvent({type: 'session.tool.called', data: {sessionID: 's', id: 'c', input: {command: 'npm run build'}}}, tr);
    assert.equal(p.tool, 'bash');
    assert.equal(p.detail, 'Running npm run build');
});

test('deltas are ignored and repeated activity is not re-emitted', () => {
    const tr = createTracker();
    const out = kinds([
        {type: 'session.step.started', data: {sessionID: 's'}},
        {type: 'session.reasoning.delta', data: {sessionID: 's'}},
        {type: 'session.step.started', data: {sessionID: 's'}},
        {type: 'session.text.started', data: {sessionID: 's'}},
    ], tr);
    assert.deepEqual(out, ['s:session_start', 's:activity']);
});

test('subagent child sessions report on the root and never complete it', () => {
    const tr = createTracker();
    const out = kinds([
        {type: 'session.created', data: {sessionID: 'root'}},
        {type: 'session.created', data: {sessionID: 'child', parentID: 'root'}},
        {type: 'session.tool.called', data: {sessionID: 'child', id: 'x', input: {}}},
        {type: 'session.execution.succeeded', data: {sessionID: 'child'}},
    ], tr);
    assert.deepEqual(out, ['root:session_start', 'root:tool_start']);
});

test('permission asked and replied, interrupt, failure', () => {
    assert.deepEqual(kinds([
        {type: 'permission.asked', data: {sessionID: 's', permission: 'bash', patterns: ['rm -rf build']}},
        {type: 'permission.replied', data: {sessionID: 's', reply: 'once'}},
        {type: 'session.execution.interrupted', data: {sessionID: 's', reason: 'user'}},
        {type: 'session.execution.failed', data: {sessionID: 's', error: {message: 'overloaded'}}},
    ]), ['s:session_start', 's:permission', 's:permission_resolved', 's:turn_interrupted', 's:turn_error']);
});

test('shutdown ends every announced session', () => {
    const tr = createTracker();
    kinds([{type: 'session.viewed', data: {sessionID: 'a'}}, {type: 'session.created', data: {sessionID: 'b'}}], tr);
    const out = mapEvent({type: 'location.shutdown', data: {}}, tr).map(p => `${p.session}:${p.kind}`);
    assert.deepEqual(out.sort(), ['a:session_end', 'b:session_end']);
});

test('legacy properties envelope and junk are tolerated', () => {
    assert.deepEqual(kinds([{type: 'session.idle', properties: {}}, null, {}, {type: 1}]), []);
    assert.equal(oneLine('Authorization: Bearer abc123'), '[redacted]');
});

test('question tool means waiting for input; home is shortened', async () => {
    const os = await import('node:os');
    const tr = createTracker();
    mapEvent({type: 'session.tool.input.started', data: {sessionID: 's', id: 'q', name: 'question'}}, tr);
    const out = mapEvent({type: 'session.tool.called', data: {sessionID: 's', id: 'q', input: {questions: [{question: 'Proceed?'}]}}}, tr);
    assert.equal(out.at(-1).kind, 'input_needed');
    assert.equal(out.at(-1).detail, 'Proceed?');
    assert.equal(oneLine(`cd ${os.homedir()}/Dev`), 'cd ~/Dev');
});

test('each session keeps its own directory; events without location never borrow another', () => {
    const tr = createTracker();
    mapEvent({type: 'session.created', data: {sessionID: 'a', location: {directory: '/w/a'}}}, tr);
    mapEvent({type: 'session.created', data: {sessionID: 'b', location: {directory: '/w/b'}}}, tr);
    const [pa] = mapEvent({type: 'session.execution.started', data: {sessionID: 'a'}}, tr);
    const [pb] = mapEvent({type: 'session.execution.started', data: {sessionID: 'b'}}, tr);
    assert.equal(pa.cwd, '/w/a');
    assert.equal(pb.cwd, '/w/b');
    const [unknown] = mapEvent({type: 'session.viewed', data: {sessionID: 'c'}}, tr);
    assert.equal(unknown.cwd, '');
});

test('location shutdown ends only the sessions in that location', () => {
    const tr = createTracker();
    mapEvent({type: 'session.created', data: {sessionID: 'a', location: {directory: '/p/a'}}}, tr);
    mapEvent({type: 'session.created', data: {sessionID: 'b', location: {directory: '/p/b'}}}, tr);
    const out = mapEvent({type: 'location.shutdown', data: {}, location: {directory: '/p/a'}}, tr);
    assert.deepEqual(out.map(p => `${p.session}:${p.kind}`), ['a:session_end']);
    assert.ok(tr.announced.has('b'));
});

test('registry: one writer, handover on dispose, final dispose ends sessions', async () => {
    const {createRegistry} = await import('../../adapters/opencode/ai-activity-monitor.js');
    const written = [];
    const queues = [];
    // Fake ctx whose event bus yields events pushed into its queue until aborted.
    const fakeCtx = () => {
        const q = {items: [], wake: null};
        queues.push(q);
        return {event: {subscribe: ({signal}) => ({
            async *[Symbol.asyncIterator]() {
                while (!signal.aborted) {
                    if (q.items.length)
                        yield q.items.shift();
                    else
                        await new Promise(r => { q.wake = r; signal.addEventListener('abort', r, {once: true}); });
                }
            },
        })}};
    };
    const push = (i, e) => { queues[i].items.push(e); queues[i].wake?.(); };
    const tick = () => new Promise(r => setTimeout(r, 5));
    const reg = createRegistry({writer: p => written.push(`${p.session}:${p.kind}`)});
    const disposeA = reg.add(fakeCtx());
    reg.add(fakeCtx());
    push(0, {type: 'session.created', data: {sessionID: 's', location: {directory: '/p'}}});
    push(1, {type: 'session.created', data: {sessionID: 's', location: {directory: '/p'}}});
    await tick();
    assert.deepEqual(written, ['s:session_start'], 'only the active instance writes');
    disposeA();
    push(1, {type: 'session.execution.started', data: {sessionID: 's'}});
    await tick();
    assert.deepEqual(written, ['s:session_start', 's:prompt'], 'the survivor took over');
    reg.remove(reg.instances[0]);
    assert.deepEqual(written.at(-1), 's:session_end');
});

test('redaction shares vectors with the Claude adapter', async () => {
    const fs = await import('node:fs');
    const v = JSON.parse(fs.readFileSync(new URL('../redaction_vectors.json', import.meta.url)));
    for (const [text, secret] of v.leaks)
        assert.ok(!oneLine(text).includes(secret), `${text} -> ${oneLine(text)}`);
    assert.equal(oneLine('mkdir -p build/out'), 'mkdir -p build/out');
});
