import React from 'react';
import {AbsoluteFill} from 'remotion';
import {H, TOPBAR_H, W} from '../theme';
import {ChromeWindow} from './ChromeWindow';
import {Wallpaper} from './Desktop';
import {PanelIconSpec, TopBar} from './TopBar';

export const TOPBAR_ZOOM = 2.4;
export const TOPBAR_FOCUS_X = 900; // native x that ends up at the screen centre when zoomed
const TOP_GAP = 24; // screen px above the zoomed top bar

// A maximised browser under the light top bar, seen through a camera that zooms
// toward the aimon icons. `z` goes 0 (full view) to 1 (zoomed). Children are
// drawn in native desktop coordinates, so they move with the camera.
export const TopBarStage: React.FC<{z: number; icons: PanelIconSpec[]; scroll?: number; children?: React.ReactNode}> = ({
	z,
	icons,
	scroll = 0,
	children,
}) => {
	const s = 1 + (TOPBAR_ZOOM - 1) * z;
	const fx = W / 2 + (TOPBAR_FOCUS_X - W / 2) * z;
	const tx = Math.min(0, Math.max(W - W * s, W / 2 - fx * s));
	// When zoomed, drop the scene a little so hopping icons never touch the frame
	// edge; the band above is filled with the panel colour.
	const ty = TOP_GAP * z;
	return (
		<AbsoluteFill style={{background: '#e9ecf2', overflow: 'hidden'}}>
			<div style={{position: 'absolute', left: 0, top: 0, width: W, height: ty + 2, background: '#f6f7f9'}} />
			<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${s})`}}>
				<Wallpaper />
				<ChromeWindow
					frame={{x: 0, y: TOPBAR_H, w: W, h: H - TOPBAR_H}}
					radius={0}
					scroll={scroll}
					style={{boxShadow: 'none', filter: z > 0.01 ? `blur(${z * 1.2}px)` : undefined}}
				/>
				<div style={{position: 'absolute', left: 0, top: TOPBAR_H, width: W, height: H - TOPBAR_H, background: `rgba(236, 239, 244, ${0.55 * z})`}} />
				<TopBar icons={icons} />
				{children}
			</div>
		</AbsoluteFill>
	);
};
