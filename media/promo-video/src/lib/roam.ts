import {SimParams, simulateMemo, SimTileId} from './sim';
import {scene, wf} from './timeline';
import {FPS, W} from '../theme';

export const TILE = 84;

// Desktop scene local frames drive the simulation; the click scene continues it.
export const ROAM = {
	appear: {claude: wf('desktop', 'Claude'), opencode: wf('desktop', 'OpenCode'), codex: wf('desktop', 'Codex')} as Record<SimTileId, number>,
	roamFrom: wf('desktop', 'roam'),
	grab: wf('desktop', 'Drag'),
	release: wf('desktop', 'corner') + 8,
	stays: wf('desktop', 'stays'),
};

export const PARK = {x: W - TILE - 30 - 40, y: 64};

export const simParams = (): SimParams => ({
	size: TILE,
	bounds: {x0: 40, y0: 64, x1: W - TILE - 30 - 40, y1: 786},
	start: {claude: {x: 560, y: 360}, opencode: {x: 918, y: 500}, codex: {x: 1276, y: 360}},
	// Tuned with a seeded search so the bumps land on "bump" and "say hi".
	velocity: {claude: {x: 190, y: 242}, opencode: {x: -237, y: 114}, codex: {x: -158, y: -242}},
	roamFrom: ROAM.roamFrom,
	grabFrame: ROAM.grab,
	releaseFrame: ROAM.release,
	parkAt: PARK,
	frames: scene('desktop').frames + 40,
	fps: FPS,
});

export const getSim = () => simulateMemo(simParams());

// Click scene: tiles glide to a stop over the first 12 frames (continuous velocity).
export const clickSimFrame = (f: number) => {
	const base = scene('desktop').frames;
	return f <= 12 ? base + f - (f * f) / 24 : base + 6;
};

export const SAY: Record<string, [string, string]> = {
	'claude-opencode': ['hi OpenCode!', 'hey Claude!'],
	'opencode-codex': ['yo Codex!', 'hey OpenCode!'],
	'claude-codex': ['hi Codex!', 'hey Claude!'],
};
