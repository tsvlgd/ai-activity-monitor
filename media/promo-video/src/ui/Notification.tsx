import React from 'react';
import {CHARCOAL, FONT_UI, Provider} from '../theme';
import {Logo} from './Logo';

// GNOME style notification banner (light shell theme).
export const Notification: React.FC<{
	x: number; // centre x
	y: number;
	provider: Provider;
	title: string;
	body: string;
	opacity?: number;
	dy?: number;
}> = ({x, y, provider, title, body, opacity = 1, dy = 0}) => (
	<div
		style={{
			position: 'absolute',
			left: x,
			top: y,
			width: 420,
			transform: `translate(-50%, ${dy}px)`,
			opacity,
			background: 'rgba(250, 251, 253, 0.97)',
			borderRadius: 18,
			boxShadow: '0 10px 30px rgba(20, 26, 38, 0.22), 0 0 0 1px rgba(20, 26, 38, 0.06)',
			padding: '14px 16px',
			display: 'flex',
			gap: 13,
			alignItems: 'center',
			fontFamily: FONT_UI,
			color: CHARCOAL,
			zIndex: 60,
		}}
	>
		<div
			style={{
				width: 40,
				height: 40,
				borderRadius: 11,
				background: '#eef0f4',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				flexShrink: 0,
			}}
		>
			<Logo provider={provider} size={24} />
		</div>
		<div style={{flex: 1, minWidth: 0}}>
			<div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
				<div style={{fontWeight: 700, fontSize: 15}}>{title}</div>
				<div style={{fontSize: 12, color: '#7a818d'}}>now</div>
			</div>
			<div style={{fontSize: 13.5, color: '#5f6672', marginTop: 2, whiteSpace: 'nowrap'}}>{body}</div>
		</div>
	</div>
);
