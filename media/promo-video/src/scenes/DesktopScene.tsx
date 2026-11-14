import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {ease, pop, popSpring, workY} from '../lib/motion';
import {getSim, PARK, ROAM, SAY, TILE} from '../lib/roam';
import {posAt, SimResult, SimTileId} from '../lib/sim';
import {AgentState, FONT_UI, Provider} from '../theme';
import {Bubble} from '../ui/Bubble';
import {Cursor, cursorAt} from '../ui/Cursor';
import {Wallpaper} from '../ui/Desktop';
import {Sfx} from '../ui/Sfx';
import {Tile} from '../ui/Tile';
import {PanelIconSpec, TopBar} from '../ui/TopBar';

export const TILE_STATE: Record<Provider, AgentState> = {claude: 'working', opencode: 'working', codex: 'completed'};
const IDS: SimTileId[] = ['claude', 'opencode', 'codex'];
export const BUBBLE_SCALE = 1.6;
const BUBBLE_FRAMES = 51; // 1700 ms, as in the extension

export const desktopIcons = (): PanelIconSpec[] =>
	IDS.map((p) => ({provider: p, state: TILE_STATE[p], motion: TILE_STATE[p] === 'working' ? 'work' : 'none', stateAt: 0}));

// Bubble texts per tile at a sim frame, from the precomputed bump events.
const bubblesAt = (sim: SimResult, simFrame: number) => {
	const out: {id: SimTileId; text: string; at: number}[] = [];
	for (const b of sim.bumps) {
		if (simFrame < b.frame || simFrame > b.frame + BUBBLE_FRAMES + 4) continue;
		if (b.frame >= ROAM.grab) continue; // the held tile does not chat
		const [ta, tb] = SAY[`${b.a}-${b.b}`];
		out.push({id: b.a, text: ta, at: b.frame});
		out.push({id: b.b, text: tb, at: b.frame + 4});
	}
	return out;
};

export const RoamingTiles: React.FC<{simFrame: number; frame: number; appear?: boolean; pressedId?: SimTileId | null}> = ({
	simFrame,
	frame,
	appear = true,
	pressedId,
}) => {
	const sim = getSim();
	const lift = ease(simFrame, ROAM.grab, ROAM.grab + 5) * (1 - ease(simFrame, ROAM.release - 3, ROAM.release + 3));
	return (
		<>
			{IDS.map((id) => {
				const p = posAt(sim, id, simFrame);
				const s = appear ? popSpring(simFrame, ROAM.appear[id], 11) : 1;
				if (s <= 0.001) return null;
				return (
					<Tile
						key={id}
						provider={id}
						size={TILE}
						x={p.x}
						y={p.y}
						state={TILE_STATE[id]}
						bob={TILE_STATE[id] === 'working' ? workY(frame, 0, 4) : 0}
						scale={s}
						opacity={Math.min(1, s * 2)}
						lift={id === 'claude' ? lift : 0}
						pressed={pressedId === id}
					/>
				);
			})}
			{bubblesAt(sim, simFrame).map((b) => {
				const pp = pop(simFrame, b.at, b.at + BUBBLE_FRAMES, 6);
				if (!pp.visible) return null;
				const p = posAt(sim, b.id, simFrame);
				return (
					<Bubble
						key={`${b.id}${b.at}`}
						text={b.text}
						x={p.x + TILE / 2}
						y={p.y - 10}
						anchor="bottom"
						dy={pp.y}
						opacity={pp.opacity}
						scale={BUBBLE_SCALE}
					/>
				);
			})}
		</>
	);
};

export const ParkedHint: React.FC<{frame: number; at: number}> = ({frame, at}) => {
	if (frame < at) return null;
	const s = popSpring(frame, at, 12);
	return (
		<div
			style={{
				position: 'absolute',
				left: PARK.x + TILE / 2,
				top: PARK.y + TILE + 14,
				transform: `translateX(-50%) scale(${s})`,
				transformOrigin: '50% 0%',
				display: 'flex',
				alignItems: 'center',
				gap: 8,
				background: 'rgba(34, 38, 46, 0.92)',
				color: '#f2f4f8',
				borderRadius: 14,
				padding: '8px 14px',
				fontFamily: FONT_UI,
				fontWeight: 600,
				fontSize: 20,
				boxShadow: '0 3px 10px rgba(20, 24, 32, 0.25)',
				whiteSpace: 'nowrap',
			}}
		>
			<svg width="18" height="18" viewBox="0 0 24 24" fill="#f2f4f8">
				<path d="M15 3l6 6-2.5 1-3.5 3.5.5 4.5-1.5 1.5-4-4L5 20.5 3.5 19l4.5-5-4-4L5.5 8.5l4.5.5L13.5 5.5z" />
			</svg>
			parked
		</div>
	);
};

export const DesktopScene: React.FC = () => {
	const frame = useCurrentFrame();
	const sim = getSim();
	const grab = ROAM.grab;
	const release = ROAM.release;
	const c0 = posAt(sim, 'claude', grab);
	const held = (f: number) => {
		const p = posAt(sim, 'claude', f);
		return {x: p.x + TILE * 0.55, y: p.y + TILE * 0.5};
	};
	const keys = [
		{f: grab - 22, x: 1500, y: 1000},
		{f: grab - 1, x: c0.x + TILE * 0.55, y: c0.y + TILE * 0.5},
	];
	let cur = cursorAt(keys, frame);
	if (frame >= grab && frame <= release) cur = held(frame);
	if (frame > release) {
		const r = held(release);
		cur = cursorAt([{f: release, x: r.x, y: r.y}, {f: release + 18, x: r.x - 70, y: r.y + 110}], frame);
	}
	const cursorOpacity = interpolate(frame, [grab - 22, grab - 16, release + 30, release + 40], [0, 1, 1, 0], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});
	const pressed = frame >= grab && frame <= release;
	const empty = ease(frame, 0, 12);

	return (
		<AbsoluteFill>
			<Wallpaper />
			<div style={{position: 'absolute', inset: 0, opacity: 1 - empty, background: 'rgba(233,236,242,0.5)'}} />
			<RoamingTiles simFrame={frame} frame={frame} />
			<ParkedHint frame={frame} at={ROAM.stays} />
			{cursorOpacity > 0 ? <Cursor x={cur.x} y={cur.y} frame={frame} pressed={pressed} opacity={cursorOpacity} size={34} /> : null}
			<TopBar icons={desktopIcons()} />
			{IDS.map((id) => (
				<Sfx key={id} name="pop" at={ROAM.appear[id]} volume={0.28} />
			))}
			{sim.bumps
				.filter((b) => b.frame < sim.params.frames - 40)
				.map((b) => (
					<Sfx key={`${b.frame}${b.a}${b.b}`} name="bump" at={b.frame} volume={0.3} />
				))}
			<Sfx name="click" at={grab} volume={0.3} />
			<Sfx name="click" at={release} volume={0.25} />
			<Sfx name="pop" at={ROAM.stays} volume={0.2} />
		</AbsoluteFill>
	);
};
