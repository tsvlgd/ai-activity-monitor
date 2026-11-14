import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {ease, popSpring} from '../lib/motion';
import {wf} from '../lib/timeline';
import {AgentState, CHIP, FONT_UI, STATE} from '../theme';
import {ChromeWindow} from '../ui/ChromeWindow';
import {Wallpaper} from '../ui/Desktop';
import {Sfx} from '../ui/Sfx';
import {Terminal} from '../ui/Terminal';
import {TopBar} from '../ui/TopBar';
import {CHROME_FRAME, claudeSession, TERM_FRAME} from './Hook';

const BigChip: React.FC<{text: string; state: AgentState; x: number; y: number; at: number; rot: number; frame: number; out: number}> = ({
	text,
	state,
	x,
	y,
	at,
	rot,
	frame,
	out,
}) => {
	if (frame < at) return null;
	const s = popSpring(frame, at, 10);
	const c = CHIP[state];
	return (
		<div
			style={{
				position: 'absolute',
				left: x,
				top: y,
				transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${s * (1 - out * 0.15)})`,
				opacity: Math.min(1, s * 2) * (1 - out),
				background: '#ffffff',
				borderRadius: 40,
				boxShadow: '0 14px 40px rgba(20, 26, 38, 0.18)',
			}}
		>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 18,
					padding: '20px 36px 20px 30px',
					borderRadius: 40,
					background: c.bg,
					color: c.fg,
					fontFamily: FONT_UI,
					fontWeight: 700,
					fontSize: 54,
					whiteSpace: 'nowrap',
				}}
			>
				<div style={{width: 20, height: 20, borderRadius: 10, background: STATE[state]}} />
				{text}
			</div>
		</div>
	);
};

const TerminalGlyph = () => (
	<svg width="64" height="64" viewBox="0 0 64 64">
		<rect x="4" y="8" width="56" height="48" rx="10" fill="#1C1F24" stroke="#5a606c" strokeWidth="2" />
		<path d="M16 26l8 6-8 6M30 40h14" stroke="#34C759" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

const BrowserGlyph = () => (
	<svg width="64" height="64" viewBox="0 0 64 64">
		<rect x="4" y="8" width="56" height="48" rx="10" fill="#ffffff" />
		<rect x="4" y="8" width="56" height="13" rx="6" fill="#dfe3ea" />
		<rect x="12" y="29" width="30" height="4" rx="2" fill="#9aa3b2" />
		<rect x="12" y="37" width="40" height="4" rx="2" fill="#c3c9d4" />
		<rect x="12" y="45" width="24" height="4" rx="2" fill="#c3c9d4" />
	</svg>
);

const Keycap: React.FC<{k: string}> = ({k}) => (
	<div
		style={{
			fontFamily: FONT_UI,
			fontWeight: 700,
			fontSize: 20,
			color: '#2b303b',
			background: '#ffffff',
			borderRadius: 8,
			padding: '5px 12px',
			boxShadow: '0 3px 0 #c9ced8, 0 6px 16px rgba(20,26,38,0.18)',
		}}
	>
		{k}
	</div>
);

export const Problem: React.FC = () => {
	const frame = useCurrentFrame();
	const keepAt = wf('problem', 'keep');
	const chips = [
		{text: 'Still working?', state: 'working' as const, x: 640, y: 340, at: wf('problem', 'working'), rot: -2},
		{text: 'Needs approval?', state: 'waiting' as const, x: 1290, y: 420, at: wf('problem', 'approval'), rot: 2},
		{text: 'Finished?', state: 'completed' as const, x: 600, y: 600, at: wf('problem', 'finish'), rot: 1.5},
		{text: 'Failed?', state: 'error' as const, x: 1240, y: 680, at: wf('problem', 'fail'), rot: -2.5},
	];
	const out = ease(frame, keepAt - 4, keepAt + 4);
	const blur = interpolate(frame, [0, 10, keepAt - 4, keepAt + 2], [0, 6, 6, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

	// Window switching flicker: Chrome, terminal, Chrome, ...
	const step = 5;
	const k = frame >= keepAt ? Math.floor((frame - keepAt) / step) : -1;
	const termFront = k >= 0 && k % 2 === 0;
	const switches = Array.from({length: 7}, (_, i) => keepAt + i * step);
	const sess = claudeSession(200);
	const hint = ease(frame, keepAt, keepAt + 5);

	return (
		<AbsoluteFill>
			<Wallpaper />
			<div style={{position: 'absolute', inset: 0, filter: blur > 0.05 ? `blur(${blur}px)` : undefined}}>
				{termFront ? (
					<Terminal frame={TERM_FRAME} title="claude · ~/auth-service" lines={sess.lines} cursor={false} />
				) : (
					<ChromeWindow frame={CHROME_FRAME} />
				)}
			</div>
			<AbsoluteFill style={{background: `rgba(240,242,246,${(blur / 6) * 0.35})`}} />
			{chips.map((c) => (
				<BigChip key={c.text} {...c} frame={frame} out={out} />
			))}
			{frame >= keepAt ? (
				<div
					style={{
						position: 'absolute',
						left: '50%',
						top: 380,
						transform: `translateX(-50%) scale(${0.94 + 0.06 * hint})`,
						opacity: hint,
						background: 'rgba(34, 38, 46, 0.9)',
						borderRadius: 28,
						padding: 22,
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						gap: 16,
						boxShadow: '0 20px 50px rgba(10,12,18,0.35)',
					}}
				>
					<div style={{display: 'flex', gap: 14}}>
						{[
							{label: 'Terminal', on: termFront, icon: <TerminalGlyph />},
							{label: 'Browser', on: !termFront, icon: <BrowserGlyph />},
						].map((it) => (
							<div
								key={it.label}
								style={{
									width: 150,
									height: 140,
									borderRadius: 18,
									background: it.on ? 'rgba(255,255,255,0.16)' : 'transparent',
									display: 'flex',
									flexDirection: 'column',
									alignItems: 'center',
									justifyContent: 'center',
									gap: 12,
									fontFamily: FONT_UI,
									fontWeight: 600,
									fontSize: 19,
									color: '#f2f4f8',
								}}
							>
								{it.icon}
								{it.label}
							</div>
						))}
					</div>
					<div style={{display: 'flex', alignItems: 'center', gap: 10}}>
						<Keycap k="Alt" />
						<div style={{fontFamily: FONT_UI, fontSize: 22, fontWeight: 700, color: '#f2f4f8'}}>+</div>
						<Keycap k="Tab" />
					</div>
				</div>
			) : null}
			<TopBar />
			{chips.map((c) => (
				<Sfx key={c.text} name="pop" at={c.at} volume={0.3} />
			))}
			{switches.map((s) => (
				<Sfx key={s} name="click" at={s} volume={0.25} />
			))}
		</AbsoluteFill>
	);
};
