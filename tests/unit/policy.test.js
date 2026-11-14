import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SessionStore} from '../../extension/ai-activity-monitor@local/lib/core/store.js';

let T = 5000;
const line = (kind, extra = {}) => JSON.stringify({v: 1, ts: (T += extra.dt ?? 1), provider: 'claude-code', session: 's', kind, ...extra});
const feed = (st, kind, extra = {}, opts = {}) => st.ingestLine(line(kind, extra), {now: T, ...opts});

test('approval request notifies urgently', () => {
    const st = new SessionStore();
    feed(st, 'session_start');
    feed(st, 'prompt');
    const r = feed(st, 'permission', {detail: 'Bash: git push'});
    assert.equal(r.notify.kind, 'approval');
    assert.equal(r.notify.urgent, true);
});

test('quick turns do not notify on completion, long turns do', () => {
    const st = new SessionStore();
    feed(st, 'session_start');
    feed(st, 'prompt');
    assert.equal(feed(st, 'turn_complete', {dt: 3}).notify, null);
    feed(st, 'prompt');
    const r = feed(st, 'turn_complete', {dt: 40});
    assert.equal(r.notify.kind, 'completed');
});

test('replay after shell restart never notifies', () => {
    const st = new SessionStore();
    feed(st, 'session_start', {}, {replaying: true});
    feed(st, 'prompt', {}, {replaying: true});
    assert.equal(feed(st, 'permission', {}, {replaying: true}).notify, null);
    assert.equal(feed(st, 'turn_error', {}, {replaying: true}).notify, null);
});

test('same kind for the same session is deduplicated within the window', () => {
    const st = new SessionStore();
    feed(st, 'session_start');
    feed(st, 'prompt');
    assert.equal(feed(st, 'permission').notify.kind, 'approval');
    feed(st, 'tool_end');
    assert.equal(feed(st, 'permission').notify, null);
    feed(st, 'tool_end');
    assert.equal(feed(st, 'permission', {dt: 60}).notify.kind, 'approval');
});

test('repeated waiting events do not renotify', () => {
    const st = new SessionStore();
    feed(st, 'session_start');
    feed(st, 'prompt');
    feed(st, 'permission');
    assert.equal(feed(st, 'permission', {dt: 100}).notify, null);
});

test('errors notify, normal session end does not', () => {
    const st = new SessionStore();
    feed(st, 'session_start');
    feed(st, 'prompt');
    assert.equal(feed(st, 'turn_error', {detail: 'overloaded'}).notify.kind, 'error');
    assert.equal(feed(st, 'session_end', {reason: 'logout'}).notify, null);
});

test('policy toggles disable categories', () => {
    const st = new SessionStore({policy: {notifyApproval: false, notifyCompleted: false}});
    feed(st, 'session_start');
    feed(st, 'prompt');
    assert.equal(feed(st, 'permission').notify, null);
    feed(st, 'tool_end');
    assert.equal(feed(st, 'turn_complete', {dt: 100}).notify, null);
});
