import React, {createContext, useContext} from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {H, W} from '../theme';

export type WallpaperKind = 'user' | 'neutral';
export const WallpaperContext = createContext<WallpaperKind>('user');

// Original look alike of the user's wallpaper: cool light gradient with a faint
// charcoal wireframe box in perspective.
const NeutralWallpaper: React.FC = () => {
	const cx = W / 2;
	const cy = 495;
	const outer = {x0: 622, y0: 156, x1: 1296, y1: 830};
	const inner = {x0: cx - 120, y0: cy - 130, x1: cx + 120, y1: cy + 130};
	const lines: React.ReactNode[] = [];
	const N = 9;
	for (let i = 0; i <= N; i++) {
		const t = i / N;
		const ox = outer.x0 + (outer.x1 - outer.x0) * t;
		const ix = inner.x0 + (inner.x1 - inner.x0) * t;
		const oy = outer.y0 + (outer.y1 - outer.y0) * t;
		const iy = inner.y0 + (inner.y1 - inner.y0) * t;
		lines.push(<line key={`t${i}`} x1={ox} y1={outer.y0} x2={ix} y2={inner.y0} />);
		lines.push(<line key={`b${i}`} x1={ox} y1={outer.y1} x2={ix} y2={inner.y1} />);
		lines.push(<line key={`l${i}`} x1={outer.x0} y1={oy} x2={inner.x0} y2={iy} />);
		lines.push(<line key={`r${i}`} x1={outer.x1} y1={oy} x2={inner.x1} y2={iy} />);
	}
	for (let k = 0; k <= 5; k++) {
		const t = k / 5;
		const s = (1 - t) ** 1.6;
		const x0 = inner.x0 + (outer.x0 - inner.x0) * s;
		const x1 = inner.x1 + (outer.x1 - inner.x1) * s;
		const y0 = inner.y0 + (outer.y0 - inner.y0) * s;
		const y1 = inner.y1 + (outer.y1 - inner.y1) * s;
		lines.push(<rect key={`ring${k}`} x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="none" />);
	}
	return (
		<AbsoluteFill style={{background: 'linear-gradient(160deg, #f4f6f9 0%, #e9ecf2 100%)'}}>
			<AbsoluteFill
				style={{background: 'radial-gradient(ellipse at 50% 46%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 55%)'}}
			/>
			<svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
				<g stroke="#2b303b" strokeOpacity={0.16} strokeWidth={1.4}>
					{lines}
				</g>
				<rect x={outer.x0} y={outer.y0} width={outer.x1 - outer.x0} height={outer.y1 - outer.y0} fill="none" stroke="#2b303b" strokeOpacity={0.28} strokeWidth={2.4} />
			</svg>
		</AbsoluteFill>
	);
};

export const Wallpaper: React.FC<{blur?: number; wash?: number}> = ({blur = 0, wash = 0}) => {
	const kind = useContext(WallpaperContext);
	return (
		<AbsoluteFill style={{overflow: 'hidden', background: '#e9ecf2'}}>
			<AbsoluteFill style={{filter: blur ? `blur(${blur}px)` : undefined, transform: blur ? 'scale(1.04)' : undefined}}>
				{kind === 'user' ? <Img src={staticFile('wallpaper.png')} style={{width: W, height: H}} /> : <NeutralWallpaper />}
			</AbsoluteFill>
			{wash > 0 ? <AbsoluteFill style={{background: `rgba(240, 242, 246, ${wash})`}} /> : null}
		</AbsoluteFill>
	);
};
