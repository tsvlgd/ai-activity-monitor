// Contract test: real adapter output must be accepted by the extension store
// and drive the expected states. Runs the Claude hook as a subprocess and the
// OpenCode writer in process, both into a temporary spool directory.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {SessionStore} from '../../extension/glanceagent@mehfooj.dev/lib/core/store.js';
import {mapEvent, createTracker, createWriter} from '../../adapters/opencode/ai-activity-monitor.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const HOOK = path.join(ROOT, 'adapters/claude-code/aimon_hook.py');

function replay(dir) {
    const store = new SessionStore();
    for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.jsonl')))
        for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean))
            assert.ok(store.ingestLine(line), `rejected line from ${f}: ${line}`);
    return store;
}

test('claude hook output drives the store through a full turn with approval', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aimon-'));
    const send = (name, extra = {}) => execFileSync('python3', [HOOK], {
        input: JSON.stringify({session_id: 'cc-1', cwd: '/w/demo', hook_event_name: name, ...extra}),
        env: {...process.env, AIMON_SPOOL_DIR: dir},
    });
    send('SessionStart', {source: 'startup'});
    send('UserPromptSubmit', {prompt: 'refactor'});
    send('PreToolUse', {tool_name: 'Bash', tool_input: {command: 'npm test'}});
    let s = replay(dir).get('claude-code:cc-1');
    assert.equal(s.state, 'working');
    assert.equal(s.detail, 'Running npm test');
    assert.ok(s.pid > 1, 'agent pid recorded');
    send('PermissionRequest', {tool_name: 'Bash', tool_input: {command: 'git push'}});
    assert.equal(replay(dir).get('claude-code:cc-1').state, 'waiting');
    send('PostToolUse', {tool_name: 'Bash'});
    send('Stop');
    s = replay(dir).get('claude-code:cc-1');
    assert.equal(s.state, 'completed');
    send('SessionEnd', {reason: 'prompt_input_exit'});
    assert.equal(replay(dir).byProvider().size, 0);
    fs.rmSync(dir, {recursive: true});
});

test('opencode writer output is accepted by the store', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aimon-'));
    const tr = createTracker();
    let t = 1000;
    const write = createWriter({dir, pid: 4321, term: {screen: '/org/gnome/Terminal/screen/x'}, now: () => (t += 1)});
    const feed = e => mapEvent(e, tr).forEach(p => write(p));
    feed({type: 'session.created', data: {sessionID: 'ses_9', location: {directory: '/w/oc'}}});
    feed({type: 'session.execution.started', data: {sessionID: 'ses_9'}});
    feed({type: 'session.tool.called', data: {sessionID: 'ses_9', id: 'c', input: {}}});
    const s = replay(dir).get('opencode:ses_9');
    assert.equal(s.state, 'working');
    assert.equal(s.pid, 4321);
    assert.equal(s.cwd, '/w/oc');
    feed({type: 'permission.asked', data: {sessionID: 'ses_9', permission: 'edit'}});
    assert.equal(replay(dir).get('opencode:ses_9').state, 'waiting');
    feed({type: 'permission.replied', data: {sessionID: 'ses_9'}});
    feed({type: 'session.execution.succeeded', data: {sessionID: 'ses_9'}});
    assert.equal(replay(dir).get('opencode:ses_9').state, 'completed');
    const mode = fs.statSync(path.join(dir, fs.readdirSync(dir)[0])).mode & 0o777;
    assert.equal(mode, 0o600);
    fs.rmSync(dir, {recursive: true});
});
