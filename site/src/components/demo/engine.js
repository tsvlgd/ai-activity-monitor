// Demo engine: drives the extension's real session store with synthetic
// spool lines shaped like docs/EVENTS.md. Everything about state comes from
// lib/core (reducer, aggregation, notification policy, roaming), so the demo
// cannot drift from the product. Only the GNOME bound parts are mirrored here:
// motion timings (lib/ui/motion.js) and notification titles (lib/notifier.js).

import {SessionStore} from '@glance-core/store.js';
import {State, STATE_LABEL, formatAgo, formatDuration} from '@glance-core/model.js';
import {isParked, release} from '@glance-core/roaming.js';

export {State, STATE_LABEL, formatAgo, formatDuration, isParked, release};

// Fixed demo epoch: the server and the browser replay the same first frame.
export const T0 = 1764000000;

// Mirrored from lib/ui/motion.js (it imports gi://Clutter, so it cannot run here).
export const SAYINGS = {waiting: 'need you!', completed: 'done!', error: 'oops, an error'};
export const LOG_LINES = 4;

export const AGENTS = [
  {
    provider: 'claude-code', name: 'Claude Code', logo: 'logos/claude-code.svg',
    session: 'demo-claude', cwd: '/home/you/code/auth-service', project: 'auth-service',
    task: 'Refactor the auth module and run the tests',
    suggestions: ['Refactor the auth module and run the tests', 'Fix the flaky login test', 'Add rate limiting to the API'],
    steps: [['tool_start', 'Read src/auth/session.ts', 'Read', 700], ['tool_end', '', 'Read', 900]],
    ask: {kind: 'permission', detail: 'Allow edit to src/auth/session.ts?', tool: 'Edit', button: 'Approve'},
    rest: [['tool_start', 'Update src/auth/session.ts', 'Edit', 250], ['tool_end', '', 'Edit', 900],
      ['tool_start', 'Run npm test', 'Bash', 300], ['tool_end', '', 'Bash', 1600]],
    error: 'Request failed: model_not_found',
  },
  {
    provider: 'opencode', name: 'OpenCode', logo: 'logos/opencode.svg',
    session: 'demo-opencode', cwd: '/home/you/code/api-docs', project: 'api-docs',
    task: 'Draft the API docs for /sessions',
    suggestions: ['Draft the API docs for /sessions', 'Rename the user model', 'Write a migration for orders'],
    steps: [['tool_start', 'Read routes/sessions.ts', 'read', 700], ['tool_end', '', 'read', 1200],
      ['activity', 'Writing docs/sessions.md', '', 400]],
    ask: {kind: 'input_needed', detail: 'Which format should the docs use?', tool: 'question', button: 'Answer'},
    rest: [['tool_start', 'Write docs/sessions.md', 'write', 250], ['tool_end', '', 'write', 1500]],
    error: 'Provider error: rate limit reached',
  },
];
export const agentOf = (provider) => AGENTS.find((a) => a.provider === provider);

// Notification titles, mirrored from lib/notifier.js.
export function notificationText(kind, s) {
  const name = agentOf(s.provider)?.name ?? s.provider;
  switch (kind) {
  case 'approval': return {title: `${name} needs your approval`, body: s.detail};
  case 'input': return {title: `${name} is waiting for input`, body: s.detail};
  case 'completed': return {title: `${name} finished`, body: s.lastTurnSeconds ? `Task completed in ${formatDuration(s.lastTurnSeconds)}` : 'Task completed'};
  case 'error': return {title: `${name} stopped with an error`, body: s.lastError || 'Agent error'};
  default: return {title: `${name} session ended unexpectedly`, body: ''};
  }
}

export function motionFor(agg) {
  if (!agg) return 'none';
  if (agg.state === State.WORKING) return 'work';
  if (!agg.acknowledged && (agg.state === State.WAITING || agg.state === State.COMPLETED || agg.state === State.ERROR)) return 'attention';
  return 'none';
}

export class DemoEngine {
  constructor({onChange = () => {}, onNotify = () => {}} = {}) {
    // Same hold as the extension's completed-hold-seconds default.
    this.store = new SessionStore({holdSeconds: 180});
    this.onChange = onChange;
    this.onNotify = onNotify;
    this.timers = new Map(AGENTS.map((a) => [a.provider, []]));
    this.transcript = new Map(AGENTS.map((a) => [a.provider, []]));
    this.clockOffset = 0; // seconds between the demo epoch and now, set on mount
    this.version = 0;
    this.seed();
  }

  now() {
    return this.clockOffset ? Date.now() / 1000 - this.clockOffset : T0;
  }

  startClock() {
    this.clockOffset = Date.now() / 1000 - T0;
  }

  // One normalized event, written and read back as a spool line.
  emit(provider, kind, {detail = '', tool = '', ts = this.now(), replaying = false, reason = ''} = {}) {
    const a = agentOf(provider);
    const line = JSON.stringify({v: 1, ts, provider, session: a.session, kind, detail, tool, cwd: a.cwd, title: a.project, reason});
    const res = this.store.ingestLine(line, {now: ts, replaying});
    this.note(provider, kind, detail);
    if (res?.notify) this.onNotify({...res.notify, ...notificationText(res.notify.kind, res.session), provider});
    this.version++;
    this.onChange();
    return res;
  }

  note(provider, kind, detail) {
    const t = this.transcript.get(provider);
    const push = (type, text) => {
      t.push({type, text, id: `${this.version}-${t.length}`});
      if (t.length > 9) t.splice(0, t.length - 9);
    };
    if (kind === 'prompt') push('prompt', detail);
    else if (kind === 'tool_start' || kind === 'activity') push('tool', detail);
    else if (kind === 'permission' || kind === 'input_needed') push('ask', detail);
    else if (kind === 'permission_resolved') push('info', 'Answered. Continuing.');
    else if (kind === 'turn_complete') push('done', 'Done.');
    else if (kind === 'turn_error') push('error', detail);
    else if (kind === 'session_start' && detail === 'clear') t.length = 0;
  }

  // The first frame, identical on the server and in the browser.
  seed() {
    const r = {replaying: true};
    this.emit('claude-code', 'session_start', {ts: T0 - 300, reason: 'startup', ...r});
    this.emit('claude-code', 'prompt', {ts: T0 - 40, detail: AGENTS[0].task, ...r});
    this.emit('claude-code', 'tool_start', {ts: T0 - 36, detail: 'Read src/auth/session.ts', tool: 'Read', ...r});
    this.emit('claude-code', 'tool_end', {ts: T0 - 34, tool: 'Read', ...r});
    this.emit('claude-code', 'permission', {ts: T0 - 30, detail: AGENTS[0].ask.detail, tool: 'Edit', ...r});
    this.emit('opencode', 'session_start', {ts: T0 - 200, reason: 'startup', ...r});
    this.emit('opencode', 'prompt', {ts: T0 - 20, detail: AGENTS[1].task, ...r});
    this.emit('opencode', 'tool_start', {ts: T0 - 5, detail: 'Read routes/sessions.ts', tool: 'read', ...r});
  }

  session(provider) {
    return this.store.get(`${provider}:${agentOf(provider).session}`);
  }

  aggregates() {
    // The demo shows idle sessions too, as with the hide-idle setting off.
    return this.store.byProvider({hideIdle: false});
  }

  clear(provider) {
    for (const id of this.timers.get(provider)) clearTimeout(id);
    this.timers.set(provider, []);
  }

  // Run [kind, detail, tool, delayMs] steps one after another.
  run(provider, steps, then) {
    let wait = 0;
    for (const [kind, detail, tool, delay] of steps) {
      wait += delay;
      this.timers.get(provider).push(setTimeout(() => this.emit(provider, kind, {detail, tool}), wait));
    }
    if (then) this.timers.get(provider).push(setTimeout(then, wait + 300));
  }

  start(provider, text) {
    const a = agentOf(provider);
    this.clear(provider);
    this.emit(provider, 'prompt', {detail: text || a.task});
    this.run(provider, a.steps, provider === 'claude-code' ? () => this.ask(provider) : null);
  }

  ask(provider) {
    const a = agentOf(provider);
    this.clear(provider);
    this.emit(provider, a.ask.kind, {detail: a.ask.detail, tool: a.ask.tool});
  }

  approve(provider) {
    const a = agentOf(provider);
    this.clear(provider);
    this.emit(provider, 'permission_resolved');
    this.run(provider, a.rest, () => this.finish(provider));
  }

  finish(provider) {
    this.clear(provider);
    this.emit(provider, 'turn_complete');
  }

  fail(provider) {
    this.clear(provider);
    this.emit(provider, 'turn_error', {detail: agentOf(provider).error});
  }

  acknowledge(provider) {
    const s = this.session(provider);
    if (s && this.store.acknowledge(s.key)) {
      this.version++;
      this.onChange();
    }
  }

  reset() {
    for (const a of AGENTS) {
      this.clear(a.provider);
      this.emit(a.provider, 'session_start', {reason: 'clear', detail: 'clear', replaying: true});
    }
  }

  dispose() {
    for (const a of AGENTS) this.clear(a.provider);
  }
}
