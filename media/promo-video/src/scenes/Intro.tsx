import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {attentionY, ease, popSpring, workY} from '../lib/motion';
import {wf} from '../lib/timeline';
import {AgentState, FONT_UI, Provider, W} from '../theme';
import {Wallpaper} from '../ui/Desktop';
import {Sfx} from '../ui/Sfx';
import {Tile} from '../ui/Tile';

const SIZE = 120;

export const Intro: React.FC = () => {
	const frame = useCurrentFrame();
	const tiles: {p: Provider; state: AgentState; at: number}[] = [
		{p: 'claude', state: 'working', at: 3},
		{p: 'opencode', state: 'waiting', at: 8},
		{p: 'codex', state: 'completed', at: 13},
	];
	const gap = 70;
	const rowW = tiles.length * (SIZE + 18) + (tiles.length - 1) * gap;
	const x0 = (W - rowW) / 2;
	const words = [
		{w: 'AI', at: wf('intro', 'AI')},
		{w: 'Activity', at: wf('intro', 'Activity')},
		{w: 'Monitor', at: wf('intro', 'Monitor')},
	];
	const tagAt = wf('intro', 'A');
	const linuxAt = wf('intro', 'Linux');
	const tag = ease(frame, tagAt, tagAt + 10);
	const underline = ease(frame, linuxAt, linuxAt + 12);
	const wash = interpolate(frame, [0, 10], [0.2, 0.74], {extrapolateRight: 'clamp'});
	const blur = interpolate(frame, [0, 10], [4, 16], {extrapolateRight: 'clamp'});

	return (
		<AbsoluteFill>
			<Wallpaper blur={blur} wash={wash} />
			{tiles.map((t, i) => {
				const s = popSpring(frame, t.at, 11);
				const bob =
					t.state === 'working' ? workY(frame, t.at + 12, 6) : attentionY(frame, t.at + 14 + i * 6, 6);
				return (
					<Tile
						key={t.p}
						provider={t.p}
						size={SIZE}
						x={x0 + i * (SIZE + 18 + gap)}
						y={250}
						state={t.state}
						bob={bob}
						scale={s}
						opacity={Math.min(1, s * 2)}
					/>
				);
			})}
			<div
				style={{
					position: 'absolute',
					left: 0,
					right: 0,
					top: 470,
					display: 'flex',
					justifyContent: 'center',
					gap: 30,
					fontFamily: FONT_UI,
					fontWeight: 700,
					fontSize: 112,
					letterSpacing: -2.5,
					color: '#1f232b',
				}}
			>
				{words.map(({w, at}) => {
					const p = ease(frame, at, at + 9);
					return (
						<span key={w} style={{opacity: p, transform: `translateY(${(1 - p) * 30}px)`, display: 'inline-block'}}>
							{w}
						</span>
					);
				})}
			</div>
			<div
				style={{
					position: 'absolute',
					left: 0,
					right: 0,
					top: 640,
					textAlign: 'center',
					fontFamily: FONT_UI,
					fontWeight: 500,
					fontSize: 46,
					color: '#4d5462',
					opacity: tag,
					transform: `translateY(${(1 - tag) * 16}px)`,
				}}
			>
				A tiny layer on your{' '}
				<span style={{position: 'relative', color: '#1f232b', fontWeight: 600}}>
					Linux desktop
					<span
						style={{
							position: 'absolute',
							left: 0,
							bottom: -6,
							height: 6,
							borderRadius: 3,
							width: `${underline * 100}%`,
							background: '#3fa877',
						}}
					/>
				</span>
			</div>
			{tiles.map((t) => (
				<Sfx key={t.p} name="pop" at={t.at} volume={0.28} />
			))}
		</AbsoluteFill>
	);
};
