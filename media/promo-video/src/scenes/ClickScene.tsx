import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame} from 'remotion';
import {pop} from '../lib/motion';
import {scene, wf} from '../lib/timeline';
import {VIDEO_SCROLL_ZOOMED, videoT} from '../lib/videoClock';
import {BLOG_TAB, VideoPage, VIDEO_TAB, VIDEO_URL} from '../ui/Pages';
import {AgentState, FONT_MONO, FPS, Provider, TERM, TOPBAR_H} from '../theme';
import {Cursor, cursorAt} from '../ui/Cursor';
import {CARD_W, LogLine, PreviewCard} from '../ui/PreviewCard';
import {Sfx} from '../ui/Sfx';
import {TopBarStage} from '../ui/Stage';
import {Terminal, TermLine} from '../ui/Terminal';
import {iconCenterX, PanelIconSpec} from '../ui/TopBar';
import {shellPrompt} from './Hook';

export const CARD_H = 264; // measured from a still
const CARD_Y = TOPBAR_H + 8;
const cardX = (i: number) => iconCenterX(i) - CARD_W / 2;
// Button centres inside the card (two equal buttons, 10 px gap, 18 px padding).
const btnW = (CARD_W - 36 - 10) / 2;
const primaryBtn = (i: number) => ({x: cardX(i) + 18 + btnW / 2, y: CARD_Y + CARD_H - 16 - 21});
const dismissBtn = (i: number) => ({x: cardX(i) + 18 + btnW + 10 + btnW / 2, y: CARD_Y + CARD_H - 16 - 21});
const iconPt = (i: number) => ({x: iconCenterX(i) + 3, y: 19});

export const clickCues = () => {
	const claudeClick = wf('click', 'icon');
	const openClick = wf('click', 'Open');
	const promptAt = wf('click', 'prompt');
	const termOut = wf('click', 'Dismiss') - 12;
	const codexClick = termOut + 15;
	const dismissClick = wf('click', 'stops') - 5;
	return {claudeClick, openClick, promptAt, termOut, codexClick, dismissClick};
};

const permissionLines: TermLine[] = [
	shellPrompt('claude'),
	[],
	[{t: '> ', c: TERM.dim, b: true}, {t: 'refactor the auth module and run the tests'}],
	[],
	[{t: '● ', c: TERM.green}, {t: 'Update', b: true}, {t: '(src/auth/session.ts)', c: TERM.dim}],
];

const DiffRow: React.FC<{n: string; sign: ' ' | '-' | '+'; text: string}> = ({n, sign, text}) => {
	const bg = sign === '-' ? 'rgba(255, 69, 58, 0.20)' : sign === '+' ? 'rgba(52, 199, 89, 0.20)' : 'transparent';
	const fg = sign === '-' ? '#ff9b93' : sign === '+' ? '#86e3a5' : '#d5dae3';
	return (
		<div style={{background: bg, color: fg, padding: '0 10px'}}>
			<span style={{color: '#7c8594'}}>{n}</span> {sign} {text}
		</div>
	);
};

// Claude Code style permission prompt for the pending edit.
const PermissionBox: React.FC<{highlight: number}> = ({highlight}) => (
	<div
		style={{
			marginTop: 6,
			width: 1000,
			border: `2px solid ${TERM.orange}`,
			borderRadius: 12,
			padding: '14px 18px',
			fontFamily: FONT_MONO,
			fontSize: 19,
			lineHeight: 1.6,
			whiteSpace: 'pre',
		}}
	>
		<div style={{fontWeight: 700}}>
			Edit file <span style={{fontWeight: 400, color: TERM.cyan}}>src/auth/session.ts</span>
		</div>
		<div style={{border: '1px solid #3a3f47', borderRadius: 8, margin: '10px 0 12px', padding: '6px 0'}}>
			<DiffRow n="41" sign=" " text="export function refresh(token: Token) {" />
			<DiffRow n="42" sign="-" text="  const ttl = 3600;" />
			<DiffRow n="42" sign="+" text="  const ttl = config.refreshTtl;" />
			<DiffRow n="43" sign=" " text="  return sign(token, { ttl });" />
		</div>
		<div style={{fontWeight: 700}}>Do you want to make this edit to session.ts?</div>
		<div
			style={{
				color: TERM.cyan,
				background: `rgba(100, 210, 255, ${0.06 + 0.14 * highlight})`,
				borderRadius: 6,
				margin: '2px -8px',
				padding: '0 8px',
			}}
		>
			❯ 1. Yes
		</div>
		<div style={{color: '#c7ccd4'}}>{"  2. Yes, and don't ask again this session"}</div>
		<div style={{color: '#c7ccd4'}}>
			{'  3. No, and tell Claude what to do differently '}
			<span style={{color: TERM.dim}}>(esc)</span>
		</div>
	</div>
);

const Card: React.FC<{
	frame: number;
	openAt: number;
	closeAt: number;
	i: number;
	provider: Provider;
	title: string;
	subtitle: string;
	state: AgentState;
	current: string;
	log: LogLine[];
	primaryState: 'normal' | 'hover' | 'active';
	dismissState?: 'normal' | 'hover' | 'active';
}> = ({frame, openAt, closeAt, i, ...rest}) => {
	if (frame < openAt) return null;
	const open = spring({frame: frame - openAt, fps: FPS, config: {damping: 18, stiffness: 220}});
	const close = pop(frame, -100, closeAt);
	const opacity = Math.min(1, open * 1.4) * close.opacity;
	if (opacity < 0.001) return null;
	return <PreviewCard x={cardX(i)} y={CARD_Y} {...rest} opacity={opacity} scale={0.96 + 0.04 * open} dy={(1 - open) * -8} />;
};

export const ClickScene: React.FC = () => {
	const frame = useCurrentFrame();
	const c = clickCues();
	const claudeOpen = c.claudeClick + 2;
	const codexOpen = c.codexClick + 2;

	const keys = [
		{f: 0, x: 1010, y: 330},
		{f: c.claudeClick - 1, ...iconPt(0)},
		{f: c.openClick - 22, ...iconPt(0)},
		{f: c.openClick - 2, ...primaryBtn(0)},
		{f: c.termOut + 2, x: 1000, y: 320},
		{f: c.codexClick - 1, ...iconPt(2)},
		{f: c.codexClick + 6, ...iconPt(2)},
		{f: c.dismissClick - 2, ...dismissBtn(2)},
	];
	const cur = cursorAt(keys, frame);
	const isPress = (at: number) => frame >= at && frame < at + 3;
	const pressed = isPress(c.claudeClick) || isPress(c.openClick) || isPress(c.codexClick) || isPress(c.dismissClick);
	const cursorHidden = frame > c.openClick + 4 && frame < c.termOut + 2;
	const cursorOpacity = cursorHidden
		? 0
		: interpolate(frame, [c.dismissClick + 12, c.dismissClick + 22], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const settled = pop(frame, c.dismissClick + 4, c.dismissClick + 30);

	const icons: PanelIconSpec[] = [
		{provider: 'claude', state: 'waiting', motion: 'attention', stateAt: 0, pressed: isPress(c.claudeClick), hover: frame >= c.claudeClick - 4 && frame < c.openClick - 18},
		{provider: 'opencode', state: 'waiting', motion: 'attention', stateAt: 6},
		{
			provider: 'codex',
			state: 'completed',
			motion: 'attention',
			stateAt: 12,
			stopAt: c.dismissClick + 1,
			pressed: isPress(c.codexClick),
			hover: frame >= c.codexClick - 4 && frame < c.codexClick + 8,
		},
	];

	const termIn = spring({frame: frame - (c.openClick + 3), fps: FPS, config: {damping: 18, stiffness: 130}});
	const termOut = spring({frame: frame - c.termOut, fps: FPS, config: {damping: 20, stiffness: 160}});
	const termVis = frame >= c.openClick + 3 ? termIn * (1 - termOut) : 0;
	const highlight = interpolate(frame, [c.promptAt, c.promptAt + 6, c.promptAt + 18], [0, 1, 0.4], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

	return (
		<AbsoluteFill>
			<TopBarStage
				z={1}
				soften={0.15}
				icons={icons}
				tabs={[VIDEO_TAB, BLOG_TAB]}
				active={0}
				url={VIDEO_URL}
				page={<VideoPage t={videoT(scene('click').from + Math.min(frame, c.claudeClick))} playing={frame < c.claudeClick} scroll={VIDEO_SCROLL_ZOOMED} />}
			>
				<Card
					frame={frame}
					openAt={claudeOpen}
					closeAt={c.openClick + 2}
					i={0}
					provider="claude"
					title="Claude Code"
					subtitle="auth-service · 1m"
					state="waiting"
					current="Approve: Edit session.ts"
					log={[
						{text: 'Read src/auth/session.ts'},
						{text: 'Update src/auth/session.ts'},
						{text: 'Waiting for your approval', kind: 'attention'},
					]}
					primaryState={isPress(c.openClick) ? 'active' : frame >= c.openClick - 6 ? 'hover' : 'normal'}
				/>
				<Card
					frame={frame}
					openAt={codexOpen}
					closeAt={c.dismissClick + 2}
					i={2}
					provider="codex"
					title="Codex"
					subtitle="auth-service · now"
					state="completed"
					current="All tests passed"
					log={[
						{text: '$ npm test'},
						{text: 'Tests: 42 passed, 42 total', kind: 'success'},
						{text: 'Task complete', kind: 'success'},
					]}
					primaryState="normal"
					dismissState={isPress(c.dismissClick) ? 'active' : frame >= c.dismissClick - 6 ? 'hover' : 'normal'}
				/>
				{settled.visible ? (
					<div
						style={{
							position: 'absolute',
							left: iconCenterX(2) - 17,
							top: 1,
							width: 34,
							height: 32,
							borderRadius: 10,
							border: '2px solid rgba(102, 136, 204, 0.9)',
							opacity: settled.opacity,
							zIndex: 55,
						}}
					/>
				) : null}
				{cursorOpacity > 0 ? <Cursor x={cur.x} y={cur.y} frame={frame} pressed={pressed} opacity={cursorOpacity} size={16} /> : null}
			</TopBarStage>
			{termVis > 0.001 ? (
				<>
					<AbsoluteFill style={{background: `rgba(20, 24, 32, ${0.28 * termVis})`}} />
					<div
						style={{
							position: 'absolute',
							inset: 0,
							opacity: Math.min(1, termVis * 1.3),
							transform: `translateY(${(1 - termIn) * 70 + termOut * 90}px) scale(${0.95 + 0.05 * termIn})`,
							transformOrigin: '50% 60%',
						}}
					>
						<Terminal
							frame={{x: 300, y: 110, w: 1320, h: 660}}
							title="claude · ~/auth-service"
							lines={permissionLines}
							cursor={false}
							style={{boxShadow: '0 30px 80px rgba(10,12,18,0.45), 0 0 0 2px rgba(217,119,87,0.6)'}}
						>
							<PermissionBox highlight={highlight} />
						</Terminal>
					</div>
				</>
			) : null}
			<Sfx name="click" at={c.claudeClick} volume={0.35} />
			<Sfx name="pop" at={claudeOpen} volume={0.22} />
			<Sfx name="click" at={c.openClick} volume={0.35} />
			<Sfx name="whoosh" at={c.openClick + 3} volume={0.3} />
			<Sfx name="whoosh" at={c.termOut} volume={0.22} />
			<Sfx name="click" at={c.codexClick} volume={0.35} />
			<Sfx name="pop" at={codexOpen} volume={0.22} />
			<Sfx name="click" at={c.dismissClick} volume={0.35} />
		</AbsoluteFill>
	);
};
