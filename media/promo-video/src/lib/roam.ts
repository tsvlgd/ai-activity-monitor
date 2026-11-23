import {SimParams, simulateMemo} from './sim';
import {INTERLUDE_FRAMES, XFADE} from './timeline';
import {FPS, W} from '../theme';

// Desktop tiles in the interlude: 1.5x the size used before, so they read at 1080p.
export const TILE = 126;

// The sim frame is the interlude Sequence frame, which starts XFADE frames
// before the cut (crossfade in) and ends XFADE frames after it.
export const simParams = (): SimParams => ({
	size: TILE,
	bounds: {x0: 40, y0: 64, x1: W - TILE - 40 - 30, y1: 904},
	start: {claude: {x: 600, y: 650}, opencode: {x: 1000, y: 400}, codex: {x: 1450, y: 300}},
	// Tuned with a seeded search: bumps land at sim frames 23 and 60, and the
	// third tile stays clear of each pair while their bubbles show.
	velocity: {claude: {x: 364, y: 66}, opencode: {x: 10, y: 336}, codex: {x: 176, y: 295}},
	roamFrom: -12, // already roaming at full speed when the cut opens
	frames: INTERLUDE_FRAMES + 2 * XFADE + 4,
	fps: FPS,
});

export const getSim = () => simulateMemo(simParams());

export const SAY: Record<string, [string, string]> = {
	'claude-opencode': ['hi OpenCode!', 'hey Claude!'],
	'opencode-codex': ['yo Codex!', 'hey OpenCode!'],
	'claude-codex': ['hi Codex!', 'hey Claude!'],
};
