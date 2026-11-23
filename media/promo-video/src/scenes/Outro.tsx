import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {ease, popSpring, workY, attentionY} from '../lib/motion';
import {wf} from '../lib/timeline';
import {AgentState, CHARCOAL, FONT_UI, Provider, W} from '../theme';
import {Wallpaper} from '../ui/Desktop';
import {Sfx} from '../ui/Sfx';
import {Tile} from '../ui/Tile';

const Glyph: React.FC<{kind: 'hook' | 'memory' | 'gnome'}> = ({kind}) => {
	const common = {width: 44, height: 44, viewBox: '0 0 24 24', fill: 'none', stroke: CHARCOAL, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const};
	if (kind === 'hook')
		return (
			<svg {...common}>
				<path d="M7 3v8a5 5 0 0 0 10 0V8" />
				<path d="M14.5 10.5L17 8l2.5 2.5" />
				<circle cx="7" cy="3" r="1.2" fill={CHARCOAL} />
			</svg>
		);
	if (kind === 'memory')
		return (
			<svg {...common}>
				<rect x="4" y="4" width="16" height="5" rx="1.5" />
				<rect x="4" y="10" width="16" height="5" rx="1.5" />
				<rect x="4" y="16" width="16" height="5" rx="1.5" />
				<circle cx="7.5" cy="6.5" r="0.8" fill={CHARCOAL} />
				<circle cx="7.5" cy="12.5" r="0.8" fill={CHARCOAL} />
				<circle cx="7.5" cy="18.5" r="0.8" fill={CHARCOAL} />
			</svg>
		);
	return (
		<svg {...common}>
			<path d="M4 9h3.5a2 2 0 1 1 4 0H15v3.5a2 2 0 1 1 0 4V20H4V16.5a2 2 0 1 0 0-4z" />
		</svg>
	);
};

const Node: React.FC<{x: number; label: string; sub: string; kind: 'hook' | 'memory' | 'gnome'; at: number; frame: number}> = ({x, label, sub, kind, at, frame}) => {
	const s = popSpring(frame, at, 13);
	return (
		<div
			style={{
				position: 'absolute',
				left: x - 160,
				top: 330,
				width: 320,
				height: 190,
				transform: `scale(${s})`,
				opacity: Math.min(1, s * 2),
				background: 'rgba(250, 251, 253, 0.96)',
				borderRadius: 24,
				boxShadow: '0 14px 40px rgba(20, 26, 38, 0.16), 0 0 0 1px rgba(20,26,38,0.05)',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				gap: 10,
				fontFamily: FONT_UI,
			}}
		>
			<Glyph kind={kind} />
			<div style={{fontSize: 32, fontWeight: 700, color: '#1f232b'}}>{label}</div>
			<div style={{fontSize: 20, fontWeight: 500, color: '#6a7180'}}>{sub}</div>
		</div>
	);
};

const Arrow: React.FC<{x0: number; x1: number; at: number; frame: number}> = ({x0, x1, at, frame}) => {
	const p = ease(frame, at, at + 10);
	const len = (x1 - x0) * p;
	const dots = [0, 1, 2].map((i) => ((frame - at) / 22 + i / 3) % 1);
	return (
		<div style={{position: 'absolute', left: x0, top: 423, width: x1 - x0, height: 4}}>
			<div style={{position: 'absolute', left: 0, top: 0, width: len, height: 4, borderRadius: 2, background: 'rgba(43,48,59,0.25)'}} />
			{p >= 1
				? dots.map((d, i) => (
						<div key={i} style={{position: 'absolute', left: d * (x1 - x0) - 6, top: -4, width: 12, height: 12, borderRadius: 6, background: '#3fa877', opacity: Math.sin(d * Math.PI)}} />
					))
				: null}
		</div>
	);
};

const TRIO: {p: Provider; state: AgentState}[] = [
	{p: 'claude', state: 'working'},
	{p: 'opencode', state: 'waiting'},
	{p: 'codex', state: 'completed'},
];

export const Outro: React.FC = () => {
	const frame = useCurrentFrame();
	const hooksAt = wf('outro', 'hooks');
	const eventsAt = wf('outro', 'events');
	const gnomeAt = wf('outro', 'GNOME');
	const drawsAt = wf('outro', 'draws');
	const cloudAt = wf('outro', 'No');
	const endAt = wf('outro', 'GlanceAgent') - 4;

	const flowOut = ease(frame, endAt - 6, endAt + 4);
	const end = ease(frame, endAt, endAt + 14);
	const xs = [330, 790, 1250];
	const iconsX = 1640;

	return (
		<AbsoluteFill>
			<Wallpaper blur={16} wash={0.74} />
			<div style={{position: 'absolute', inset: 0, opacity: 1 - flowOut, transform: `translateY(${-30 * flowOut}px)`}}>
				<Node x={xs[0]} label="agent hooks" sub="Claude Code, OpenCode, Codex" kind="hook" at={hooksAt} frame={frame} />
				<Arrow x0={xs[0] + 170} x1={xs[1] - 170} at={eventsAt - 4} frame={frame} />
				<Node x={xs[1]} label="events" sub="in memory" kind="memory" at={eventsAt} frame={frame} />
				<Arrow x0={xs[1] + 170} x1={xs[2] - 170} at={gnomeAt - 4} frame={frame} />
				<Node x={xs[2]} label="GNOME extension" sub="Shell 46" kind="gnome" at={gnomeAt} frame={frame} />
				<Arrow x0={xs[2] + 170} x1={iconsX - 130} at={drawsAt - 4} frame={frame} />
				{TRIO.map((t, i) => {
					const s = popSpring(frame, drawsAt + i * 3, 11);
					const bob = t.state === 'working' ? workY(frame, drawsAt, 4) : attentionY(frame, drawsAt + 6 + i * 4, 4);
					return <Tile key={t.p} provider={t.p} size={64} x={iconsX - 40} y={282 + i * 84} state={t.state} bob={bob} scale={s} opacity={Math.min(1, s * 2)} />;
				})}
				{frame >= cloudAt ? (
					<div
						style={{
							position: 'absolute',
							left: W / 2,
							top: 610,
							transform: `translateX(-50%) scale(${popSpring(frame, cloudAt, 10)})`,
							display: 'flex',
							alignItems: 'center',
							gap: 14,
							background: '#2b303b',
							color: '#ffffff',
							borderRadius: 40,
							padding: '16px 30px 16px 24px',
							fontFamily: FONT_UI,
							fontWeight: 700,
							fontSize: 36,
							boxShadow: '0 14px 36px rgba(20,26,38,0.3)',
						}}
					>
						<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
							<path d="M7 18h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 9.1 4.5 4.5 0 0 0 7 18z" />
							<path d="M3.5 3.5l17 17" stroke="#cf5f58" strokeWidth="2.4" />
						</svg>
						No cloud. Everything stays local.
					</div>
				) : null}
			</div>
			{frame >= endAt ? (
				<div style={{position: 'absolute', inset: 0, opacity: end}}>
					<div style={{position: 'absolute', left: 0, right: 0, top: 250, display: 'flex', justifyContent: 'center', gap: 56}}>
						{TRIO.map((t, i) => {
							const s = popSpring(frame, endAt + 2 + i * 4, 11);
							const bob = t.state === 'working' ? workY(frame, endAt, 5) : attentionY(frame, endAt + 10 + i * 5, 5);
							return (
								<div key={t.p} style={{position: 'relative', width: 118, height: 100}}>
									<Tile provider={t.p} size={100} x={0} y={0} state={t.state} bob={bob} scale={s} opacity={Math.min(1, s * 2)} />
								</div>
							);
						})}
					</div>
					<div
						style={{
							position: 'absolute',
							left: 0,
							right: 0,
							top: 420,
							textAlign: 'center',
							fontFamily: FONT_UI,
							fontWeight: 700,
							fontSize: 136,
							letterSpacing: -2.5,
							color: '#1f232b',
							transform: `translateY(${(1 - end) * 24}px)`,
						}}
					>
						GlanceAgent
					</div>
					<div
						style={{
							position: 'absolute',
							left: 0,
							right: 0,
							top: 590,
							textAlign: 'center',
							fontFamily: FONT_UI,
							fontWeight: 500,
							fontSize: 42,
							color: '#4d5462',
							opacity: interpolate(frame, [endAt + 12, endAt + 24], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
						}}
					>
						Linux · GNOME Shell
					</div>
				</div>
			) : null}
			<Sfx name="pop" at={hooksAt} volume={0.25} />
			<Sfx name="pop" at={eventsAt} volume={0.25} />
			<Sfx name="pop" at={gnomeAt} volume={0.25} />
			<Sfx name="pop" at={drawsAt} volume={0.25} />
			<Sfx name="pop" at={cloudAt} volume={0.25} />
			<Sfx name="ding" at={endAt + 2} volume={0.28} />
		</AbsoluteFill>
	);
};
