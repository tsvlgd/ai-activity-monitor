// Presence decides whether a bounce or notification is redundant because the
// user is already looking at the session. Every unsure case must say false.
import {test} from 'node:test';
import assert from 'node:assert/strict';

import {isWatching, tabText, sameTitle} from '../../extension/ai-activity-monitor@local/lib/core/presence.js';

const claude = (extra = {}) => ({provider: 'claude-code', cwd: '/home/u/Dev/ai-activity-monitor',
    projectDir: '/home/u/Dev/ai-activity-monitor', title: 'AI activity monitor results', ...extra});
const term = (title, extra = {}) => ({title, owns: true, terminal: true, siblings: 2, ...extra});

test('tab text strips the agent prefix and rejects other programs', () => {
    assert.equal(tabText('claude-code', '✳ Linux AI activity monitor'), 'Linux AI activity monitor');
    assert.equal(tabText('claude-code', '◐ AI activity monitor results'), 'AI activity monitor results');
    assert.equal(tabText('claude-code', '⠋ Working on it'), 'Working on it');
    assert.equal(tabText('claude-code', 'Terminal'), null);
    assert.equal(tabText('claude-code', 'mehfooj@host: ~/Dev'), null);
    assert.equal(tabText('opencode', 'OC | Fix the parser'), 'Fix the parser');
    assert.equal(tabText('opencode', 'OCaml toplevel'), null);
    assert.equal(tabText('unknown-agent', 'anything'), null);
});

test('watching the session tab, idle or busy glyph', () => {
    assert.equal(isWatching(claude(), term('✳ AI activity monitor results')), true);
    assert.equal(isWatching(claude(), term('◐ AI activity monitor results')), true);
});

test('another Claude tab in the same terminal window is not watching', () => {
    // The screenshot case: two Claude tabs, same gnome-terminal process.
    assert.equal(isWatching(claude(), term('✳ Linux AI activity monitor')), false);
});

test('a shell tab or another app is not watching', () => {
    assert.equal(isWatching(claude(), term('Terminal')), false);
    assert.equal(isWatching(claude(), term('✳ AI activity monitor results', {owns: false})), false);
    assert.equal(isWatching(claude(), null), false);
});

test('without a title, sure only when the agent runs in one tab', () => {
    const s = claude({title: ''});
    assert.equal(isWatching(s, term('✳ Whatever', {siblings: 1})), true);
    assert.equal(isWatching(s, term('✳ Whatever', {siblings: 2})), false);
});

test('an editor window counts when its title names the project', () => {
    const code = t => ({title: t, owns: true, terminal: false, siblings: 3});
    assert.equal(isWatching(claude(), code('model.js - ai-activity-monitor - Visual Studio Code')), true);
    assert.equal(isWatching(claude(), code('index.ts - other-project - Visual Studio Code')), false);
    assert.equal(isWatching(claude({cwd: '', projectDir: ''}), code('x - Visual Studio Code')), false);
});

test('clamped titles match by prefix, otherwise exact', () => {
    assert.equal(sameTitle('A very long session title that goes on', 'A very long session…'), true);
    assert.equal(sameTitle('AI activity monitor results', 'AI activity monitor'), false);
    assert.equal(sameTitle('  ai  Activity monitor ', 'AI activity monitor'), true);
    assert.equal(sameTitle('', 'x'), false);
});

test('opencode tab matches by its session title', () => {
    const s = {provider: 'opencode', cwd: '/p', title: 'Fix the parser'};
    assert.equal(isWatching(s, term('OC | Fix the parser')), true);
    assert.equal(isWatching(s, term('OC | Something else')), false);
});
