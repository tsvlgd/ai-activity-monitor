import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isParked, roamers, release} from '../../extension/glanceagent@mehfooj.dev/lib/core/roaming.js';

const tiles = [{provider: 'claude-code'}, {provider: 'opencode'}];

test('no saved positions: every tile roams', () => {
    assert.equal(roamers(tiles, {}).length, 2);
    assert.equal(roamers(tiles, undefined).length, 2);
});

test('parking is per tile: one parked tile does not stop the other', () => {
    const pos = {opencode: {x: 1700, y: 20}};
    assert.equal(isParked(pos, 'opencode'), true);
    assert.deepEqual(roamers(tiles, pos).map(t => t.provider), ['claude-code']);
});

test('both parked: nothing roams', () => {
    const pos = {'claude-code': {x: 0, y: 0}, opencode: {x: 5, y: 9}};
    assert.equal(roamers(tiles, pos).length, 0);
});

test('malformed saved entries do not park a tile', () => {
    for (const bad of [null, {}, {x: 'a', y: 1}, {x: -1, y: 4}, {x: NaN, y: 1}, 7])
        assert.equal(isParked({opencode: bad}, 'opencode'), false);
});

test('release removes only the named tile and does not mutate', () => {
    const pos = {'claude-code': {x: 1, y: 2}, opencode: {x: 3, y: 4}};
    const next = release(pos, 'opencode');
    assert.deepEqual(next, {'claude-code': {x: 1, y: 2}});
    assert.ok(pos.opencode);
    assert.deepEqual(roamers(tiles, next).map(t => t.provider), ['opencode']);
});
