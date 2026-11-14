import React from 'react';

export const TrafficLights: React.FC<{size?: number}> = ({size = 13}) => (
	<div style={{display: 'flex', gap: size * 0.62}}>
		{['#ff5f57', '#febc2e', '#28c840'].map((c) => (
			<div
				key={c}
				style={{width: size, height: size, borderRadius: size / 2, background: c, boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.18)'}}
			/>
		))}
	</div>
);

export type Frame = {x: number; y: number; w: number; h: number};

// Shared window shell: rounded corners, soft shadow, transform hooks.
export const WindowShell: React.FC<{
	frame: Frame;
	children: React.ReactNode;
	dark?: boolean;
	style?: React.CSSProperties;
}> = ({frame, children, dark, style}) => (
	<div
		style={{
			position: 'absolute',
			left: frame.x,
			top: frame.y,
			width: frame.w,
			height: frame.h,
			borderRadius: 12,
			overflow: 'hidden',
			boxShadow: dark
				? '0 26px 70px rgba(10, 12, 18, 0.42), 0 0 0 1px rgba(255,255,255,0.06)'
				: '0 26px 70px rgba(20, 26, 38, 0.28), 0 0 0 1px rgba(20,26,38,0.08)',
			...style,
		}}
	>
		{children}
	</div>
);
