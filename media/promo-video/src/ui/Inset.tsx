import React from 'react';
import {spring} from 'remotion';
import {AgentState, FONT_MONO, FONT_UI, FPS, Provider, STATE, TERM} from '../theme';
import {Logo} from './Logo';
import {Seg} from './Terminal';

// Small terminal snippet that shows what caused a state change.
export const Inset: React.FC<{
	provider: Provider;
	state: AgentState;
	x: number;
	y?: number;
	width?: number;
	at: number;
	frame: number;
	lines: Seg[][];
}> = ({provider, state, x, y = 640, width = 540, at, frame, lines}) => {
	if (frame < at) return null;
	const s = spring({frame: frame - at, fps: FPS, config: {damping: 16, stiffness: 160}});
	return (
		<div
			style={{
				position: 'absolute',
				left: x,
				top: y,
				width,
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
				<span style={{flex: 1}}>{provider} · ~/auth-service</span>
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
