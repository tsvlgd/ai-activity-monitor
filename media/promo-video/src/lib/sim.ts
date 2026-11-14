// Deterministic roaming physics for the desktop tiles.
// Positions are a pure function of the frame number: the whole trajectory is
// integrated once with a fixed step and memoised, so any frame can be rendered
// in any order (parallel rendering stays consistent).
// Self contained on purpose (no imports) so it can be run with plain Node for tuning.

export type Vec = {x: number; y: number};
export type SimTileId = 'claude' | 'opencode' | 'codex';
export type Bump = {frame: number; a: SimTileId; b: SimTileId};

export type SimParams = {
	size: number; // tile button size in px
	bounds: {x0: number; y0: number; x1: number; y1: number}; // allowed top left range
	start: Record<SimTileId, Vec>;
	velocity: Record<SimTileId, Vec>; // px per second once roaming
	roamFrom: number; // frame at which the tiles start to move
	grabFrame: number; // frame at which the cursor grabs claude
	releaseFrame: number; // frame at which claude is dropped
	parkAt: Vec; // drop position (top left)
	frames: number; // how many frames to precompute
	fps: number;
};

export type SimResult = {
	pos: Record<SimTileId, Vec[]>; // top left per frame
	bumps: Bump[];
	params: SimParams;
};

const IDS: SimTileId[] = ['claude', 'opencode', 'codex'];
const SUBSTEPS = 6;
const BUMP_COOLDOWN = 36; // frames before the same pair can greet again

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const dragPosition = (p: SimParams, grabPos: Vec, frame: number): Vec => {
	const t = Math.min(1, Math.max(0, (frame - p.grabFrame) / (p.releaseFrame - p.grabFrame)));
	const e = easeInOut(t);
	// A slight arc so the drag feels hand made.
	const lift = Math.sin(Math.PI * t) * -40;
	return {x: grabPos.x + (p.parkAt.x - grabPos.x) * e, y: grabPos.y + (p.parkAt.y - grabPos.y) * e + lift};
};

export const simulate = (p: SimParams): SimResult => {
	const dt = 1 / p.fps / SUBSTEPS;
	const pos: Record<SimTileId, Vec> = {
		claude: {...p.start.claude},
		opencode: {...p.start.opencode},
		codex: {...p.start.codex},
	};
	const vel: Record<SimTileId, Vec> = {
		claude: {x: 0, y: 0},
		opencode: {x: 0, y: 0},
		codex: {x: 0, y: 0},
	};
	const out: Record<SimTileId, Vec[]> = {claude: [], opencode: [], codex: []};
	const bumps: Bump[] = [];
	const lastBump = new Map<string, number>();
	let grabPos: Vec | null = null;
	const r = p.size / 2;
	const minD = p.size * 1.05;

	for (let f = 0; f < p.frames; f++) {
		out.claude.push({...pos.claude});
		out.opencode.push({...pos.opencode});
		out.codex.push({...pos.codex});

		// Ease velocity in over the first 12 frames of roaming.
		if (f >= p.roamFrom) {
			const k = Math.min(1, (f - p.roamFrom + 1) / 12);
			if (f - p.roamFrom < 12) {
				for (const id of IDS) {
					vel[id] = {x: p.velocity[id].x * k, y: p.velocity[id].y * k};
				}
			}
		}

		const claudeKinematic = f >= p.grabFrame; // held by the cursor, then parked
		if (f === p.grabFrame) grabPos = {...pos.claude};

		for (let s = 0; s < SUBSTEPS; s++) {
			const sub = f + (s + 1) / SUBSTEPS;
			for (const id of IDS) {
				if (id === 'claude' && claudeKinematic && grabPos) {
					pos.claude = dragPosition(p, grabPos, sub);
					vel.claude = {x: 0, y: 0};
					continue;
				}
				pos[id].x += vel[id].x * dt;
				pos[id].y += vel[id].y * dt;
				const b = p.bounds;
				if (pos[id].x < b.x0) {
					pos[id].x = b.x0;
					vel[id].x = Math.abs(vel[id].x);
				} else if (pos[id].x > b.x1) {
					pos[id].x = b.x1;
					vel[id].x = -Math.abs(vel[id].x);
				}
				if (pos[id].y < b.y0) {
					pos[id].y = b.y0;
					vel[id].y = Math.abs(vel[id].y);
				} else if (pos[id].y > b.y1) {
					pos[id].y = b.y1;
					vel[id].y = -Math.abs(vel[id].y);
				}
			}

			// Pairwise circle collisions. Equal masses swap the normal velocity
			// component (elastic); a held or parked tile acts as a fixed wall.
			for (let i = 0; i < IDS.length; i++) {
				for (let j = i + 1; j < IDS.length; j++) {
					const a = IDS[i];
					const c = IDS[j];
					const ax = pos[a].x + r;
					const ay = pos[a].y + r;
					const cx = pos[c].x + r;
					const cy = pos[c].y + r;
					const dx = cx - ax;
					const dy = cy - ay;
					const d = Math.hypot(dx, dy) || 0.0001;
					if (d >= minD) continue;
					const nx = dx / d;
					const ny = dy / d;
					const aFixed = a === 'claude' && claudeKinematic;
					const overlap = minD - d;
					const rel = (vel[c].x - vel[a].x) * nx + (vel[c].y - vel[a].y) * ny;
					if (aFixed) {
						pos[c].x += nx * overlap;
						pos[c].y += ny * overlap;
						if (rel < 0) {
							const vn = vel[c].x * nx + vel[c].y * ny;
							vel[c].x -= 2 * vn * nx;
							vel[c].y -= 2 * vn * ny;
						}
					} else {
						pos[a].x -= (nx * overlap) / 2;
						pos[a].y -= (ny * overlap) / 2;
						pos[c].x += (nx * overlap) / 2;
						pos[c].y += (ny * overlap) / 2;
						if (rel < 0) {
							vel[a].x += rel * nx;
							vel[a].y += rel * ny;
							vel[c].x -= rel * nx;
							vel[c].y -= rel * ny;
						}
					}
					const key = `${a}-${c}`;
					const last = lastBump.get(key) ?? -1e9;
					if (rel < 0 && f - last > BUMP_COOLDOWN && f >= p.roamFrom) {
						bumps.push({frame: f, a, b: c});
						lastBump.set(key, f);
					}
				}
			}
		}
	}
	return {pos: out, bumps, params: p};
};

const cache = new Map<string, SimResult>();
export const simulateMemo = (p: SimParams): SimResult => {
	const key = JSON.stringify(p);
	let r = cache.get(key);
	if (!r) {
		r = simulate(p);
		cache.set(key, r);
	}
	return r;
};

// Position at a possibly fractional frame (linear between precomputed frames).
export const posAt = (res: SimResult, id: SimTileId, frame: number): Vec => {
	const arr = res.pos[id];
	const f = Math.max(0, Math.min(arr.length - 1, frame));
	const i = Math.floor(f);
	const j = Math.min(arr.length - 1, i + 1);
	const t = f - i;
	return {x: arr[i].x + (arr[j].x - arr[i].x) * t, y: arr[i].y + (arr[j].y - arr[i].y) * t};
};
