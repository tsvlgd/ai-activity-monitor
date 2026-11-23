import React from 'react';
import {useCurrentFrame} from 'remotion';
import {motionY, MotionKind, pop, popSpring} from '../lib/motion';
import {AgentState, CHARCOAL, FONT_UI, Provider, STATE, TOPBAR_H, W} from '../theme';
import {Bubble} from './Bubble';
import {Logo} from './Logo';

export const PANEL_BTN = 34;
// The aimon icons sit in the centre box, just left of the clock.
export const ICONS_RIGHT = W / 2 - 74;
export const iconCenterX = (i: number, n = 3) => ICONS_RIGHT - (n - i) * PANEL_BTN + PANEL_BTN / 2;

export type PanelIconSpec = {
	provider: Provider;
	state: AgentState;
	stateAt?: number; // frame of the last state change (motion phase origin)
	motion: MotionKind;
	appearAt?: number;
	bubble?: {text: string; inAt: number; outAt?: number};
	stopAt?: number; // acknowledged: the motion settles to still over 150 ms
	pressed?: boolean;
	hover?: boolean;
};

const Wifi = () => (
	<svg width="17" height="17" viewBox="0 0 16 16" fill={CHARCOAL}>
		<path d="M8 13.6l2.1-2.6a3.3 3.3 0 0 0-4.2 0zM3.4 7.9l1.3 1.6a5.2 5.2 0 0 1 6.6 0l1.3-1.6a7.3 7.3 0 0 0-9.2 0zM1 5l1.3 1.6a8.9 8.9 0 0 1 11.4 0L15 5A11 11 0 0 0 1 5z" />
	</svg>
);
const Volume = () => (
	<svg width="17" height="17" viewBox="0 0 16 16" fill={CHARCOAL}>
		<path d="M2 6h2.5L8 3v10L4.5 10H2z" />
		<path d="M10.2 5.2a4 4 0 0 1 0 5.6M12 3.6a6.3 6.3 0 0 1 0 8.8" stroke={CHARCOAL} strokeWidth="1.4" fill="none" strokeLinecap="round" />
	</svg>
);
const Battery = () => (
	<svg width="26" height="17" viewBox="0 0 26 16">
		<rect x="1" y="3" width="21" height="10" rx="3" fill="none" stroke={CHARCOAL} strokeWidth="1.4" />
		<rect x="3" y="5" width="14" height="6" rx="1.5" fill={CHARCOAL} />
		<rect x="23" y="6" width="2" height="4" rx="1" fill={CHARCOAL} />
	</svg>
);

const PanelIcon: React.FC<{spec: PanelIconSpec; x: number; frame: number}> = ({spec, x, frame}) => {
	const s = spec.appearAt === undefined ? 1 : popSpring(frame, spec.appearAt, 11);
	let y = motionY(spec.motion, frame, spec.stateAt ?? 0, 3);
	if (spec.stopAt !== undefined && frame >= spec.stopAt) {
		const y0 = motionY(spec.motion, spec.stopAt, spec.stateAt ?? 0, 3);
		y = y0 * (1 - Math.min(1, (frame - spec.stopAt) / 4.5));
	}
	const dotPop = spec.stateAt !== undefined ? popSpring(frame, spec.stateAt, 8) : 1;
	return (
		<div
			style={{
				position: 'absolute',
				left: x - PANEL_BTN / 2,
				top: 0,
				width: PANEL_BTN,
				height: TOPBAR_H,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				gap: 2,
				paddingTop: 2,
				transform: `scale(${s * (spec.pressed ? 0.92 : 1)})`,
				opacity: Math.min(1, s * 1.5),
				borderRadius: 9,
				background: spec.pressed ? 'rgba(43, 48, 59, 0.16)' : spec.hover ? 'rgba(43, 48, 59, 0.09)' : 'transparent',
			}}
		>
			<div style={{transform: `translateY(${y}px)`}}>
				<Logo provider={spec.provider} size={22} />
			</div>
			<div
				style={{
					width: 4,
					height: 4,
					borderRadius: 2,
					background: STATE[spec.state],
					transform: `scale(${0.6 + 0.4 * dotPop})`,
				}}
			/>
		</div>
	);
};

export const TopBar: React.FC<{icons?: PanelIconSpec[]; clock?: string}> = ({icons = [], clock = 'Fri 14 Nov  20:45'}) => {
	const frame = useCurrentFrame();
	return (
		<div style={{position: 'absolute', left: 0, top: 0, width: W, height: TOPBAR_H, zIndex: 50}}>
			<div
				style={{
					position: 'absolute',
					inset: 0,
					background: 'rgba(250, 251, 253, 0.84)',
					backdropFilter: 'blur(24px) saturate(1.4)',
					boxShadow: '0 1px 0 rgba(30, 36, 48, 0.06), 0 2px 10px rgba(30, 36, 48, 0.06)',
				}}
			/>
			{/* Left: workspace indicator pill (GNOME 46 Activities). */}
			<div style={{position: 'absolute', left: 14, top: 0, height: TOPBAR_H, display: 'flex', alignItems: 'center'}}>
				<div style={{display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 14}}>
					<div style={{width: 30, height: 8, borderRadius: 4, background: CHARCOAL}} />
					<div style={{width: 7, height: 7, borderRadius: 4, background: 'rgba(43,48,59,0.45)'}} />
					<div style={{width: 7, height: 7, borderRadius: 4, background: 'rgba(43,48,59,0.45)'}} />
				</div>
			</div>
			{/* Centre: clock. */}
			<div
				style={{
					position: 'absolute',
					left: 0,
					width: W,
					top: 0,
					height: TOPBAR_H,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					fontFamily: FONT_UI,
					fontWeight: 700,
					fontSize: 14.5,
					color: CHARCOAL,
					whiteSpace: 'pre',
				}}
			>
				{clock}
			</div>
			{/* Right: system status. */}
			<div
				style={{
					position: 'absolute',
					right: 14,
					top: 0,
					height: TOPBAR_H,
					display: 'flex',
					alignItems: 'center',
					gap: 12,
					padding: '0 10px',
				}}
			>
				<Wifi />
				<Volume />
				<Battery />
			</div>
			{icons.map((spec, i) => (
				<PanelIcon key={spec.provider} spec={spec} x={iconCenterX(i, icons.length)} frame={frame} />
			))}
			{icons.map((spec, i) => {
				if (!spec.bubble) return null;
				const p = pop(frame, spec.bubble.inAt, spec.bubble.outAt, 6);
				if (!p.visible) return null;
				return <Bubble key={`b${spec.provider}`} text={spec.bubble.text} x={iconCenterX(i, icons.length)} y={TOPBAR_H + 6} dy={p.y} opacity={p.opacity} />;
			})}
		</div>
	);
};
