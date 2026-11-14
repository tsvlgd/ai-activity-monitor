import React from 'react';
import {CHARCOAL, FONT_UI} from '../theme';

// .aimon-bubble: white pill with charcoal bold text. Anchored by its top centre
// (below an icon) or bottom centre (above a tile).
export const Bubble: React.FC<{
	text: string;
	x: number;
	y: number;
	anchor?: 'top' | 'bottom';
	opacity?: number;
	dy?: number;
	scale?: number;
}> = ({text, x, y, anchor = 'top', opacity = 1, dy = 0, scale = 1}) => (
	<div
		style={{
			position: 'absolute',
			left: x,
			top: y,
			transform: `translate(-50%, ${anchor === 'top' ? '0' : '-100%'}) translateY(${dy}px) scale(${scale})`,
			transformOrigin: anchor === 'top' ? '50% 0%' : '50% 100%',
			opacity,
			background: 'rgba(255, 255, 255, 0.97)',
			color: CHARCOAL,
			borderRadius: 12,
			padding: '7px 13px',
			fontFamily: FONT_UI,
			fontSize: 14,
			fontWeight: 700,
			whiteSpace: 'nowrap',
			boxShadow: '0 3px 10px rgba(20, 24, 32, 0.18)',
			pointerEvents: 'none',
		}}
	>
		{text}
	</div>
);
