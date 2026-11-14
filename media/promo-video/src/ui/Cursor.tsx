import React from 'react';
import {interpolate} from 'remotion';

// macOS style arrow. (x, y) is the hotspot. `clickAt` frames draw a soft ripple.
export const Cursor: React.FC<{x: number; y: number; frame: number; pressed?: boolean; clicks?: number[]; opacity?: number; size?: number}> = ({
	x,
	y,
	frame,
	pressed = false,
	clicks = [],
	opacity = 1,
	size = 30,
}) => (
	<>
		{clicks.map((c) => {
			const t = frame - c;
			if (t < 0 || t > 14) return null;
			const r = interpolate(t, [0, 14], [8, 34]);
			const o = interpolate(t, [0, 14], [0.45, 0]);
			return (
				<div
					key={c}
					style={{
						position: 'absolute',
						left: x - r,
						top: y - r,
						width: r * 2,
						height: r * 2,
						borderRadius: r,
						border: '3px solid rgba(43,48,59,0.9)',
						opacity: o * opacity,
						zIndex: 199,
					}}
				/>
			);
		})}
		<svg
			width={size}
			height={size * 1.4}
			viewBox="0 0 20 28"
			style={{
				position: 'absolute',
				left: x - size * 0.12,
				top: y - size * 0.06,
				opacity,
				transform: `scale(${pressed ? 0.88 : 1})`,
				transformOrigin: '10% 5%',
				filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))',
				zIndex: 200,
			}}
		>
			<path d="M2 1.5 L2 22.5 L7.2 17.6 L10.6 25.6 L14.2 24.1 L10.9 16.3 L17.8 16.3 Z" fill="#111" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
		</svg>
	</>
);

// Piecewise linear+eased cursor path through keyframes [{f, x, y}].
export type CursorKey = {f: number; x: number; y: number};
export const cursorAt = (keys: CursorKey[], frame: number) => {
	if (frame <= keys[0].f) return {x: keys[0].x, y: keys[0].y};
	for (let i = 0; i < keys.length - 1; i++) {
		const a = keys[i];
		const b = keys[i + 1];
		if (frame <= b.f) {
			const t = (frame - a.f) / Math.max(1, b.f - a.f);
			const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
			return {x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e};
		}
	}
	const l = keys[keys.length - 1];
	return {x: l.x, y: l.y};
};
