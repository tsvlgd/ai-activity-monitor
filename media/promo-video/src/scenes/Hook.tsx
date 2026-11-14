import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame} from 'remotion';
import {ease} from '../lib/motion';
import {wf} from '../lib/timeline';
import {CHARCOAL, FONT_UI, FPS, TERM, W} from '../theme';
import {ChromeWindow} from '../ui/ChromeWindow';
import {Wallpaper} from '../ui/Desktop';
import {Sfx} from '../ui/Sfx';
import {lineLength, Terminal, TermLine, typed} from '../ui/Terminal';
import {TopBar} from '../ui/TopBar';

export const TERM_FRAME = {x: 300, y: 130, w: 1320, h: 720};
export const CHROME_FRAME = {x: 250, y: 96, w: 1420, h: 780};

const PROMPT = 'refactor the auth module and run the tests';

export const shellPrompt = (cmd: string): TermLine => [
	{t: '~/auth-service', c: TERM.cyan, b: true},
	{t: ' ❯ ', c: TERM.green, b: true},
	{t: cmd},
];

// Claude Code session lines in the user's terminal palette, revealed over time.
export const claudeSession = (frame: number): {lines: TermLine[]; cursor: boolean} => {
	const lines: TermLine[] = [];
	const cmdChars = interpolate(frame, [5, 13], [0, 6], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	lines.push(typed(shellPrompt('claude'), 17 + cmdChars));
	if (frame < 16) return {lines, cursor: true};
	const o = TERM.orange;
	const BOX = 46;
	const boxLine = (segs: TermLine): TermLine => [
		{t: '│', c: o},
		...segs,
		{t: ' '.repeat(Math.max(0, BOX - lineLength(segs))) + '│', c: o},
	];
	lines.push([{t: '╭' + '─'.repeat(BOX) + '╮', c: o}]);
	lines.push(boxLine([{t: ' *', c: o}, {t: ' Welcome to '}, {t: 'Claude Code', b: true}, {t: '!'}]));
	lines.push(boxLine([{t: '   cwd: ~/auth-service', c: TERM.dim}]));
	lines.push([{t: '╰' + '─'.repeat(BOX) + '╯', c: o}]);
	lines.push([]);
	const promptLine: TermLine = [{t: '> ', c: TERM.dim, b: true}, {t: PROMPT}];
	const chars = interpolate(frame, [22, 22 + PROMPT.length / 1.5], [0, lineLength(promptLine)], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});
	lines.push(typed(promptLine, 2 + chars));
	const stream: [number, TermLine][] = [
		[58, []],
		[60, [{t: '● ', c: TERM.fg}, {t: "I'll refactor the auth module, then run the tests."}]],
		[66, [{t: '● ', c: TERM.green}, {t: 'Read', b: true}, {t: '(src/auth/session.ts)', c: TERM.dim}]],
		[70, [{t: '  ⎿  ', c: TERM.dim}, {t: 'Read 214 lines', c: TERM.dim}]],
		[75, [{t: '● ', c: TERM.green}, {t: 'Update', b: true}, {t: '(src/auth/token.ts)', c: TERM.dim}]],
		[79, [{t: '  ⎿  ', c: TERM.dim}, {t: 'Updated with ', c: TERM.dim}, {t: '18 additions', c: TERM.green}, {t: ' and ', c: TERM.dim}, {t: '9 removals', c: TERM.red}]],
		[86, [{t: '● ', c: TERM.green}, {t: 'Bash', b: true}, {t: '(npm test)', c: TERM.dim}]],
		[92, [{t: '✻ ', c: o}, {t: 'Running tests… ', c: o}, {t: '(esc to interrupt)', c: TERM.dim}]],
	];
	for (const [at, l] of stream) if (frame >= at) lines.push(l);
	return {lines, cursor: frame < 58};
};

export const Hook: React.FC = () => {
	const frame = useCurrentFrame();
	const switchAt = wf('hook', 'switch');
	const loseAt = wf('hook', 'lose');

	const enter = spring({frame, fps: FPS, config: {damping: 18, stiffness: 140}});
	const sess = claudeSession(frame);

	const slide = spring({frame: frame - switchAt, fps: FPS, config: {damping: 17, stiffness: 120}});
	const chromeX = interpolate(slide, [0, 1], [W + 40, CHROME_FRAME.x]);
	const termDim = interpolate(slide, [0, 1], [0, 1]);

	const lost = ease(frame, loseAt, loseAt + 12, 0, 1, Easing.out(Easing.cubic));
	const q = spring({frame: frame - loseAt, fps: FPS, config: {damping: 10, stiffness: 120}});

	return (
		<AbsoluteFill>
			<Wallpaper />
			<div style={{position: 'absolute', inset: 0, opacity: enter, transform: `scale(${0.96 + 0.04 * enter})`}}>
				<Terminal
					frame={TERM_FRAME}
					title="claude · ~/auth-service"
					lines={sess.lines}
					cursor={sess.cursor}
					cursorOn={Math.floor(frame / 8) % 2 === 0 || frame < 58}
					style={{filter: `brightness(${1 - termDim * 0.25})`}}
				/>
			</div>
			{frame >= switchAt ? (
				<ChromeWindow
					frame={{...CHROME_FRAME, x: chromeX}}
					style={{filter: lost > 0 ? `blur(${lost * 3}px)` : undefined}}
				/>
			) : null}
			{frame >= loseAt ? (
				<div
					style={{
						position: 'absolute',
						left: TERM_FRAME.x,
						top: TERM_FRAME.y,
						width: TERM_FRAME.w,
						height: TERM_FRAME.h,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						opacity: lost,
					}}
				>
					<div
						style={{
							fontFamily: FONT_UI,
							fontWeight: 800,
							fontSize: 300,
							color: CHARCOAL,
							opacity: 0.22,
							transform: `scale(${0.7 + 0.3 * q})`,
						}}
					>
						?
					</div>
				</div>
			) : null}
			<TopBar />
			<Sfx name="whoosh" at={switchAt - 2} volume={0.35} />
		</AbsoluteFill>
	);
};
