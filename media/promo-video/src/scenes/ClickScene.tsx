import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame} from 'remotion';
import {ease, pop} from '../lib/motion';
import {clickSimFrame, getSim, TILE} from '../lib/roam';
import {posAt} from '../lib/sim';
import {scene, wf} from '../lib/timeline';
import {FPS, H, TERM, W} from '../theme';
import {Cursor, cursorAt} from '../ui/Cursor';
import {Wallpaper} from '../ui/Desktop';
import {CARD_W, PreviewCard} from '../ui/PreviewCard';
import {Sfx} from '../ui/Sfx';
import {SIDE_W} from '../ui/Tile';
import {Terminal, TermLine} from '../ui/Terminal';
import {TopBar} from '../ui/TopBar';
import {desktopIcons, ParkedHint, RoamingTiles} from './DesktopScene';
import {shellPrompt} from './Hook';

export const CARD_H = 264; // measured from a still
const ZOOM = 1.35;

const opencodeSession: TermLine[] = [
	shellPrompt('opencode'),
	[],
	[{t: '┃ ', c: TERM.blue}, {t: 'run the test suite and fix any failures', b: true}],
	[],
	[{t: '  $ ', c: TERM.dim}, {t: 'npm test'}],
	[{t: '  '}, {t: ' PASS ', c: '#1C1F24', bg: TERM.green, b: true}, {t: ' src/auth/session.test.ts', c: TERM.fg}],
	[{t: '  '}, {t: ' PASS ', c: '#1C1F24', bg: TERM.green, b: true}, {t: ' src/auth/token.test.ts', c: TERM.fg}],
	[{t: '  '}, {t: ' RUNS ', c: '#1C1F24', bg: TERM.yellow, b: true}, {t: ' src/auth/refresh.test.ts', c: TERM.fg}],
	[],
	[{t: '  Tests: ', b: true}, {t: '41 passed', c: TERM.green}, {t: ', 42 total', c: TERM.dim}],
	[],
	[{t: '▣ ', c: TERM.magenta}, {t: 'Build', c: TERM.magenta, b: true}, {t: '  working… ', c: TERM.dim}, {t: 'esc', b: true}, {t: ' interrupt', c: TERM.dim}],
];

export const ClickScene: React.FC = () => {
	const frame = useCurrentFrame();
	const sim = getSim();
	const simFrame = clickSimFrame(frame);
	const oc = posAt(sim, 'opencode', clickSimFrame(40));

	const clickAt = 8;
	const openAt = clickAt + 3;
	const jumpAt = wf('click', 'jump');
	const closeAt = jumpAt + 4;

	// Card beside the tile (right side), clamped above the captions.
	const cardX = Math.min(oc.x + TILE + SIDE_W + 16, W - CARD_W - 40);
	const cardY = Math.max(50, Math.min(oc.y - 20, H - 200 - CARD_H));
	const tileC = {x: oc.x + TILE / 2, y: oc.y + TILE / 2};
	const btn = {x: cardX + 18 + 83, y: cardY + CARD_H - 16 - 21};

	const keys = [
		{f: 0, x: tileC.x + 200, y: tileC.y + 170},
		{f: clickAt - 1, x: tileC.x + 6, y: tileC.y + 4},
		{f: jumpAt - 14, x: tileC.x + 6, y: tileC.y + 4},
		{f: jumpAt - 1, x: btn.x, y: btn.y},
	];
	const cur = cursorAt(keys, frame);
	const pressed = (frame >= clickAt && frame < clickAt + 3) || (frame >= jumpAt && frame < jumpAt + 3);
	const cursorOpacity = interpolate(frame, [jumpAt + 8, jumpAt + 14], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

	// Preview card: fade in, grow slightly, settle from just above (preview.js).
	const open = spring({frame: frame - openAt, fps: FPS, config: {damping: 18, stiffness: 220}});
	const close = pop(frame, -100, closeAt);
	const cardOpacity = frame < openAt ? 0 : Math.min(1, open * 1.4) * close.opacity;
	const hover = frame >= jumpAt - 4;

	// Camera: zoom toward the tile and card, back out for the terminal.
	const zin = ease(frame, openAt, openAt + 16);
	const zout = ease(frame, closeAt, closeAt + 18);
	const z = zin * (1 - zout);
	const s = 1 + (ZOOM - 1) * z;
	const focus = {x: (oc.x + cardX + CARD_W) / 2, y: cardY + CARD_H / 2};
	const fx = W / 2 + (focus.x - W / 2) * z;
	const fy = H / 2 + (focus.y - H / 2) * z;
	// Keep the zoomed desktop covering the whole frame.
	const tx = Math.min(0, Math.max(W - W * s, W / 2 - fx * s));
	const ty = Math.min(0, Math.max(H - H * s, H / 2 - 40 * z - fy * s));

	const termIn = spring({frame: frame - (closeAt + 2), fps: FPS, config: {damping: 18, stiffness: 130}});
	const termFrame = {x: 360, y: 120, w: 1200, h: 600};

	return (
		<AbsoluteFill style={{background: '#e9ecf2'}}>
			<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${s})`}}>
				<Wallpaper />
				<RoamingTiles simFrame={simFrame} frame={frame + scene('desktop').frames} appear={false} pressedId={frame >= clickAt && frame < clickAt + 3 ? 'opencode' : null} />
				<ParkedHint frame={100} at={0} />
				{cardOpacity > 0.001 ? (
					<PreviewCard
						x={cardX}
						y={cardY}
						provider="opencode"
						title="OpenCode"
						subtitle="auth-service · 2m"
						state="working"
						current="Running npm test"
						log={[
							{text: '$ npm test'},
							{text: 'PASS src/auth/session.test.ts', kind: 'success'},
							{text: 'RUNS src/auth/refresh.test.ts', kind: 'warn'},
						]}
						primaryState={frame >= jumpAt && frame < jumpAt + 4 ? 'active' : hover ? 'hover' : 'normal'}
						opacity={cardOpacity}
						scale={0.96 + 0.04 * open}
						dy={(1 - open) * -8}
					/>
				) : null}
				{frame < jumpAt + 14 ? (
					<Cursor x={cur.x} y={cur.y} frame={frame} pressed={pressed} clicks={[clickAt, jumpAt]} opacity={cursorOpacity} size={30} />
				) : null}
				<TopBar icons={desktopIcons()} />
			</div>
			{frame >= closeAt + 2 ? (
				<div
					style={{
						position: 'absolute',
						inset: 0,
						opacity: termIn,
						transform: `translateY(${(1 - termIn) * 60}px) scale(${0.95 + 0.05 * termIn})`,
						transformOrigin: '50% 60%',
					}}
				>
					<Terminal
						frame={termFrame}
						title="opencode · ~/auth-service"
						lines={opencodeSession}
						cursor={false}
						fontSize={19}
						style={{boxShadow: '0 30px 80px rgba(10,12,18,0.45), 0 0 0 2px rgba(10,132,255,0.55)'}}
					/>
				</div>
			) : null}
			<Sfx name="click" at={clickAt} volume={0.35} />
			<Sfx name="pop" at={openAt} volume={0.25} />
			<Sfx name="click" at={jumpAt} volume={0.35} />
			<Sfx name="whoosh" at={closeAt + 1} volume={0.3} />
		</AbsoluteFill>
	);
};
