import React from 'react';
import {AgentState, FONT_UI, Provider, STATE} from '../theme';
import {Logo} from './Logo';

// Provider tile looks from stylesheet.css (.aimon-tile, .aimon-tile-claude, .aimon-tile-opencode).
const TILE_STYLE: Record<Provider, React.CSSProperties> = {
	claude: {
		background: 'linear-gradient(180deg, rgba(255, 244, 239, 0.98) 0%, rgba(255, 223, 208, 0.98) 100%)',
		boxShadow: '0 5px 22px rgba(217, 119, 87, 0.38)',
	},
	opencode: {
		background: 'rgba(246, 247, 250, 0.97)',
		boxShadow: '0 5px 22px rgba(76, 110, 220, 0.22)',
	},
	codex: {
		background: 'rgba(247, 248, 251, 0.95)',
		boxShadow: '0 4px 14px rgba(30, 36, 48, 0.16)',
	},
};

export const SIDE_W = 18;

export const Tile: React.FC<{
	provider: Provider;
	size: number;
	x: number;
	y: number;
	state: AgentState;
	bob?: number; // translateY of the button from the motion
	count?: number;
	scale?: number;
	opacity?: number;
	pressed?: boolean;
	lift?: number; // extra shadow while dragged
	showSide?: boolean;
	dotSize?: number;
	countSize?: number;
}> = ({provider, size, x, y, state, bob = 0, count = 1, scale = 1, opacity = 1, pressed = false, lift = 0, showSide = true, dotSize = 11, countSize = 15}) => {
	const st = TILE_STYLE[provider];
	return (
		<div
			style={{
				position: 'absolute',
				left: x,
				top: y,
				display: 'flex',
				alignItems: 'center',
				gap: 7,
				opacity,
				transform: `scale(${scale})`,
				transformOrigin: `${size / 2}px ${size / 2}px`,
			}}
		>
			<div
				style={{
					width: size,
					height: size,
					borderRadius: size * 0.3,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					transform: `translateY(${bob - lift * 4}px) scale(${pressed ? 0.94 : 1 + lift * 0.05})`,
					...st,
					boxShadow: lift > 0 ? `${st.boxShadow}, 0 ${14 * lift}px ${30 * lift}px rgba(20,26,38,${0.22 * lift})` : st.boxShadow,
				}}
			>
				<Logo provider={provider} size={Math.round(size * 0.6)} />
			</div>
			{showSide ? (
				<div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: SIDE_W - 7}}>
					<div style={{width: dotSize, height: dotSize, borderRadius: dotSize / 2, background: STATE[state]}} />
					<div style={{fontFamily: FONT_UI, fontSize: countSize, fontWeight: 700, color: '#4f5664'}}>{count}</div>
				</div>
			) : null}
		</div>
	);
};
