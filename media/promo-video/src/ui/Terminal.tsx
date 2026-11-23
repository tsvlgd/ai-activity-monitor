import React from 'react';
import {FONT_MONO, FONT_UI, TERM} from '../theme';
import {Frame, TrafficLights, WindowShell} from './Window';

export type Seg = {t: string; c?: string; b?: boolean; bg?: string};
export type TermLine = Seg[];

// Reveal the first `chars` characters of a line (typing effect).
export const typed = (line: TermLine, chars: number): TermLine => {
	const out: TermLine = [];
	let left = Math.max(0, Math.floor(chars));
	for (const s of line) {
		if (left <= 0) break;
		out.push({...s, t: s.t.slice(0, left)});
		left -= s.t.length;
	}
	return out;
};

export const lineLength = (line: TermLine) => line.reduce((n, s) => n + s.t.length, 0);

// gnome-terminal in the user's profile, under a MacTahoe dark header bar.
export const Terminal: React.FC<{
	frame: Frame;
	title: string;
	lines: TermLine[];
	cursor?: boolean; // show a block cursor after the last line
	cursorOn?: boolean;
	fontSize?: number;
	style?: React.CSSProperties;
	children?: React.ReactNode; // extra content after the lines (rich blocks)
}> = ({frame, title, lines, cursor = true, cursorOn = true, fontSize = 19, style, children}) => (
	<WindowShell frame={frame} dark style={style}>
		<div style={{position: 'absolute', inset: 0, background: TERM.bg}} />
		<div
			style={{
				position: 'absolute',
				left: 0,
				right: 0,
				top: 0,
				height: 44,
				background: '#2a2d33',
				borderBottom: '1px solid rgba(0,0,0,0.35)',
				display: 'flex',
				alignItems: 'center',
				padding: '0 16px',
			}}
		>
			<TrafficLights />
			<div
				style={{
					position: 'absolute',
					left: 0,
					right: 0,
					textAlign: 'center',
					fontFamily: FONT_UI,
					fontWeight: 600,
					fontSize: 15,
					color: '#d7dbe2',
				}}
			>
				{title}
			</div>
		</div>
		<div
			style={{
				position: 'absolute',
				left: 0,
				right: 0,
				top: 44,
				bottom: 0,
				padding: '18px 24px',
				fontFamily: FONT_MONO,
				fontSize,
				lineHeight: 1.6,
				color: TERM.fg,
				whiteSpace: 'pre',
				overflow: 'hidden',
			}}
		>
			{lines.map((line, i) => (
				<div key={i} style={{minHeight: fontSize * 1.6}}>
					{line.map((s, j) => (
						<span key={j} style={{color: s.c ?? TERM.fg, fontWeight: s.b ? 700 : 400, background: s.bg}}>
							{s.t}
						</span>
					))}
					{cursor && i === lines.length - 1 ? (
						<span
							style={{
								display: 'inline-block',
								width: fontSize * 0.6,
								height: fontSize * 1.15,
								verticalAlign: 'text-bottom',
								background: cursorOn ? '#e6e9ef' : 'transparent',
							}}
						/>
					) : null}
				</div>
			))}
			{children}
		</div>
	</WindowShell>
);
