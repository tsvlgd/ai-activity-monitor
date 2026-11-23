import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {pop, popSpring, workY} from '../lib/motion';
import {getSim, SAY, TILE} from '../lib/roam';
import {posAt, SimTileId} from '../lib/sim';
import {INTERLUDE_FRAMES, XFADE} from '../lib/timeline';
import {AgentState} from '../theme';
import {Bubble} from '../ui/Bubble';
import {Wallpaper} from '../ui/Desktop';
import {Sfx} from '../ui/Sfx';
import {Tile} from '../ui/Tile';
import {PanelIconSpec, TopBar} from '../ui/TopBar';

const IDS: SimTileId[] = ['claude', 'opencode', 'codex'];
const STATE: Record<SimTileId, AgentState> = {claude: 'working', opencode: 'working', codex: 'working'};
const BUBBLE_FRAMES = 51; // 1700 ms, as in the extension
const BUBBLE_SCALE = 2.1;

// One bubble per tile at a time: a new greeting replaces the old one, as say() does.
const bubbles = (bumps: {frame: number; a: SimTileId; b: SimTileId}[]) => {
	const list = bumps.flatMap((b) => {
		const [ta, tb] = SAY[`${b.a}-${b.b}`];
		return [
			{id: b.a, text: ta, at: b.frame},
			{id: b.b, text: tb, at: b.frame + 4},
		];
	});
	return list.map((b) => {
		const next = list.filter((o) => o.id === b.id && o.at > b.at).map((o) => o.at);
		return {...b, outAt: Math.min(b.at + BUBBLE_FRAMES, ...next.map((n) => n - 3))};
	});
};

// Silent cut: the empty desktop with the three tiles roaming and greeting.
// Its Sequence starts XFADE frames early and ends XFADE frames late; the
// opacity ramps make real crossfades with the scenes around it.
export const Interlude: React.FC = () => {
	const frame = useCurrentFrame(); // equals the sim frame
	const sim = getSim();
	const opacity = interpolate(frame, [0, XFADE], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const icons: PanelIconSpec[] = IDS.map((p) => ({provider: p, state: 'working', motion: 'work', stateAt: 0}));

	return (
		<AbsoluteFill style={{opacity}}>
			<AbsoluteFill>
				<Wallpaper />
				{IDS.map((id, i) => {
					const p = posAt(sim, id, frame);
					return (
						<Tile
							key={id}
							provider={id}
							size={TILE}
							x={p.x}
							y={p.y}
							state={STATE[id]}
							bob={workY(frame, i * 5, 6)}
							scale={1}
							dotSize={15}
							countSize={19}
						/>
					);
				})}
				{bubbles(sim.bumps).map((b) => {
					const pp = pop(frame, b.at, b.outAt, 6);
					if (!pp.visible) return null;
					const p = posAt(sim, b.id, frame);
					const s = popSpring(frame, b.at, 12);
					return (
						<Bubble
							key={`${b.id}${b.at}`}
							text={b.text}
							x={p.x + TILE / 2}
							y={p.y - 12}
							anchor="bottom"
							dy={pp.y}
							opacity={pp.opacity}
							scale={BUBBLE_SCALE * (0.85 + 0.15 * s)}
						/>
					);
				})}
				<TopBar icons={icons} />
			</AbsoluteFill>
			<Sfx name="whoosh" at={0} volume={0.3} />
			{sim.bumps.map((b) => (
				<Sfx key={`${b.frame}${b.a}`} name="bump" at={b.frame} volume={0.4} />
			))}
			<Sfx name="whoosh" at={INTERLUDE_FRAMES + XFADE - 4} volume={0.25} />
		</AbsoluteFill>
	);
};
