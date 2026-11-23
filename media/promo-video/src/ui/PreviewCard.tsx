import React from 'react';
import {AgentState, CHIP, FONT_MONO, FONT_UI, Provider, STATE, STATE_LABEL} from '../theme';
import {Logo} from './Logo';

export type LogLine = {text: string; kind?: 'success' | 'warn' | 'attention' | 'error'};
const LOG_COLOR = {success: '#a9c7f0', warn: '#e8c38d', attention: '#f0c27a', error: '#ef9a94'};

export const CARD_W = 380;

// .aimon-preview and children, from stylesheet.css and lib/ui/preview.js.
export const PreviewCard: React.FC<{
	x: number;
	y: number;
	provider: Provider;
	title: string;
	subtitle: string;
	state: AgentState;
	current: string;
	log: LogLine[];
	primaryState?: 'normal' | 'hover' | 'active';
	dismissState?: 'normal' | 'hover' | 'active';
	opacity?: number;
	scale?: number;
	dy?: number;
}> = ({x, y, provider, title, subtitle, state, current, log, primaryState = 'normal', dismissState = 'normal', opacity = 1, scale = 1, dy = 0}) => {
	const chip = CHIP[state];
	const primaryBg = primaryState === 'hover' ? '#3a404d' : primaryState === 'active' ? '#1f232b' : '#2b303b';
	return (
		<div
			style={{
				position: 'absolute',
				left: x,
				top: y,
				width: CARD_W,
				boxSizing: 'border-box',
				opacity,
				transform: `translateY(${dy}px) scale(${scale})`,
				transformOrigin: '0% 0%',
				background: 'rgba(246, 247, 250, 0.97)',
				borderRadius: 20,
				border: '1px solid rgba(24, 30, 42, 0.07)',
				boxShadow: '0 8px 28px rgba(24, 30, 42, 0.22)',
				padding: '18px 18px 16px 18px',
				display: 'flex',
				flexDirection: 'column',
				gap: 14,
				color: '#262a33',
				fontFamily: FONT_UI,
				zIndex: 80,
			}}
		>
			<div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
				<Logo provider={provider} size={28} />
				<div style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
					<div style={{fontSize: 17, fontWeight: 700, color: '#20242c'}}>{title}</div>
					<div style={{display: 'flex', alignItems: 'center'}}>
						<div style={{width: 8, height: 8, borderRadius: 4, marginRight: 8, background: STATE[state]}} />
						<div style={{fontSize: 13, color: '#5f6672'}}>{subtitle}</div>
					</div>
				</div>
				<div
					style={{
						alignSelf: 'flex-start',
						fontSize: 12.5,
						fontWeight: 700,
						borderRadius: 11,
						padding: '4px 11px',
						color: chip.fg,
						background: chip.bg,
					}}
				>
					{STATE_LABEL[state]}
				</div>
			</div>
			<div style={{display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 12, borderTop: '1px solid rgba(43, 48, 59, 0.08)'}}>
				<div style={{fontSize: 15, fontWeight: 600, color: '#262a33'}}>{current}</div>
				<div style={{background: '#23272f', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4}}>
					{log.map((l, i) => (
						<div
							key={i}
							style={{
								fontFamily: FONT_MONO,
								fontSize: 12.5,
								color: l.kind ? LOG_COLOR[l.kind] : '#d5dae3',
								whiteSpace: 'nowrap',
								overflow: 'hidden',
								textOverflow: 'ellipsis',
							}}
						>
							{l.text}
						</div>
					))}
				</div>
			</div>
			<div style={{display: 'flex', gap: 10, paddingTop: 4}}>
				<div
					style={{
						flex: 1,
						textAlign: 'center',
						borderRadius: 12,
						padding: '11px 12px',
						fontSize: 14.5,
						fontWeight: 700,
						color: '#ffffff',
						background: primaryBg,
					}}
				>
					Open in Terminal
				</div>
				<div
					style={{
						flex: 1,
						textAlign: 'center',
						borderRadius: 12,
						padding: '11px 12px',
						fontSize: 14.5,
						fontWeight: 600,
						color: '#262a33',
						background: `rgba(120, 130, 145, ${dismissState === 'active' ? 0.28 : dismissState === 'hover' ? 0.2 : 0.12})`,
					}}
				>
					Dismiss
				</div>
			</div>
		</div>
	);
};
