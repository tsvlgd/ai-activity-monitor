import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame} from 'remotion';
import {ease, pop} from '../lib/motion';
import {wf} from '../lib/timeline';
import {AgentState, FONT_MONO, FONT_UI, FPS, H, Provider, STATE, TERM, TOPBAR_H, W} from '../theme';
import {ChromeWindow} from '../ui/ChromeWindow';
import {Wallpaper} from '../ui/Desktop';
import {Logo} from '../ui/Logo';
import {Notification} from '../ui/Notification';
import {Sfx} from '../ui/Sfx';
import {Seg} from '../ui/Terminal';
import {PanelIconSpec, TopBar} from '../ui/TopBar';

const ZOOM = 2.4;
const FOCUS_X = 900; // native x that ends up at the screen centre

// Small terminal snippet that explains each state change.
const Inset: React.FC<{provider: Provider; state: AgentState; x: number; at: number; frame: number; lines: Seg[][]}> = ({
	provider,
	state,
	x,
	at,
	frame,
	lines,
}) => {
	if (frame < at) return null;
	const s = spring({frame: frame - at, fps: FPS, config: {damping: 16, stiffness: 160}});
	return (
		<div
			style={{
				position: 'absolute',
				left: x,
				top: 640,
				width: 540,
				transform: `translateY(${(1 - s) * 30}px)`,
				opacity: s,
				background: TERM.bg,
				borderRadius: 16,
				boxShadow: '0 18px 44px rgba(10, 12, 18, 0.35)',
				overflow: 'hidden',
				zIndex: 70,
			}}
		>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 10,
					padding: '10px 16px',
					background: '#2a2d33',
					fontFamily: FONT_UI,
					fontSize: 16,
					fontWeight: 600,
					color: '#d7dbe2',
				}}
			>
				<div style={{background: '#f4f5f8', borderRadius: 6, padding: 3, display: 'flex'}}>
					<Logo provider={provider} size={18} />
				</div>
				<span style={{flex: 1}}>{provider === 'claude' ? 'claude' : provider} · ~/auth-service</span>
				<div style={{width: 10, height: 10, borderRadius: 5, background: STATE[state]}} />
			</div>
			<div style={{padding: '14px 18px', fontFamily: FONT_MONO, fontSize: 19, lineHeight: 1.55, color: TERM.fg, whiteSpace: 'pre'}}>
				{lines.map((l, i) => (
					<div key={i}>
						{l.map((sg, j) => (
							<span key={j} style={{color: sg.c ?? TERM.fg, fontWeight: sg.b ? 700 : 400, background: sg.bg}}>
								{sg.t}
							</span>
						))}
					</div>
				))}
			</div>
		</div>
	);
};

export const TopBarScene: React.FC = () => {
	const frame = useCurrentFrame();
	const iconAt = wf('topbar', 'icon');
	const topAt = wf('topbar', 'top');
	const workAt = wf('topbar', 'Working');
	const amberAt = wf('topbar', 'amber');
	const bounceAt = wf('topbar', 'bounces');

	const icons: PanelIconSpec[] = [
		{
			provider: 'claude',
			state: frame >= workAt ? 'working' : 'idle',
			stateAt: frame >= workAt ? workAt : undefined,
			motion: frame >= workAt ? 'work' : 'none',
			appearAt: iconAt,
		},
		{
			provider: 'opencode',
			state: frame >= amberAt ? 'waiting' : 'idle',
			stateAt: frame >= amberAt ? amberAt : undefined,
			motion: frame >= amberAt ? 'attention' : 'none',
			appearAt: iconAt + 4,
			bubble: {text: 'need you!', inAt: amberAt, outAt: bounceAt - 3},
		},
		{
			provider: 'codex',
			state: frame >= bounceAt ? 'completed' : 'idle',
			stateAt: frame >= bounceAt ? bounceAt : undefined,
			motion: frame >= bounceAt ? 'attention' : 'none',
			appearAt: iconAt + 8,
			bubble: {text: 'done!', inAt: bounceAt},
		},
	];

	// Camera: zoom into the top bar around the icons and clock.
	const z = ease(frame, topAt - 4, topAt + 24, 0, 1, Easing.inOut(Easing.cubic));
	const s = 1 + (ZOOM - 1) * z;
	const fx = W / 2 + (FOCUS_X - W / 2) * z;
	const tx = W / 2 - fx * s;

	const notif = spring({frame: frame - amberAt, fps: FPS, config: {damping: 15, stiffness: 150}});
	const scroll = interpolate(frame, [70, 120], [0, 60], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)});
	const highlight = pop(frame, iconAt + 10, topAt + 6);

	return (
		<AbsoluteFill style={{background: '#e9ecf2'}}>
			<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', transform: `translate(${tx}px, 0px) scale(${s})`}}>
				<Wallpaper />
				<ChromeWindow
					frame={{x: 0, y: TOPBAR_H, w: W, h: H - TOPBAR_H}}
					radius={0}
					scroll={scroll}
					style={{boxShadow: 'none', filter: z > 0.01 ? `blur(${z * 1.2}px)` : undefined}}
				/>
				<div style={{position: 'absolute', left: 0, top: TOPBAR_H, width: W, height: H - TOPBAR_H, background: `rgba(236, 239, 244, ${0.55 * z})`}} />
				<TopBar icons={icons} />
				{highlight.visible ? (
					<div
						style={{
							position: 'absolute',
							left: 785,
							top: 1,
							width: 106,
							height: 32,
							borderRadius: 10,
							border: '2px solid rgba(63,168,119,0.9)',
							opacity: highlight.opacity,
							zIndex: 55,
						}}
					/>
				) : null}
				{frame >= amberAt ? (
					<Notification
						x={W / 2 + 30}
						y={86}
						provider="opencode"
						title="OpenCode needs your approval"
						body="Allow edit to src/auth/session.ts?"
						opacity={Math.min(1, notif * 1.5)}
						dy={(1 - notif) * -40}
					/>
				) : null}
			</div>
			<Inset
				provider="claude"
				state="working"
				x={W / 2 - 860}
				at={workAt + 2}
				frame={frame}
				lines={[
					[{t: '● ', c: TERM.green}, {t: 'Bash', b: true}, {t: '(npm test)', c: TERM.dim}],
					[{t: '✻ ', c: TERM.orange}, {t: 'Running tests…', c: TERM.orange}],
				]}
			/>
			<Inset
				provider="opencode"
				state="waiting"
				x={W / 2 - 270}
				at={amberAt + 2}
				frame={frame}
				lines={[
					[{t: '△ ', c: TERM.yellow}, {t: 'Permission required', c: TERM.yellow, b: true}],
					[{t: '  edit src/auth/session.ts ', c: TERM.fg}, {t: ' Allow ', c: '#1C1F24', bg: TERM.yellow, b: true}],
				]}
			/>
			<Inset
				provider="codex"
				state="completed"
				x={W / 2 + 320}
				at={bounceAt + 2}
				frame={frame}
				lines={[
					[{t: '✓ ', c: TERM.green, b: true}, {t: 'All tests passed', c: TERM.green, b: true}],
					[{t: '  42 passed', c: TERM.fg}, {t: ' · 3.1s', c: TERM.dim}],
				]}
			/>
			{[0, 4, 8].map((d) => (
				<Sfx key={d} name="pop" at={iconAt + d} volume={0.22} />
			))}
			<Sfx name="whoosh" at={topAt - 4} volume={0.22} />
			<Sfx name="ding" at={amberAt} volume={0.3} />
			<Sfx name="bump" at={bounceAt} volume={0.3} />
			<Sfx name="ding" at={bounceAt + 2} volume={0.22} />
		</AbsoluteFill>
	);
};
