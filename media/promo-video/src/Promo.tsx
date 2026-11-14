import React from 'react';
import {AbsoluteFill, Html5Audio, interpolate, Sequence, staticFile} from 'remotion';
import {SCENES, SceneId, TOTAL_FRAMES} from './lib/timeline';
import {ClickScene} from './scenes/ClickScene';
import {DesktopScene} from './scenes/DesktopScene';
import {Hook} from './scenes/Hook';
import {Intro} from './scenes/Intro';
import {Outro} from './scenes/Outro';
import {Problem} from './scenes/Problem';
import {TopBarScene} from './scenes/TopBarScene';
import {Captions} from './ui/Captions';
import {WallpaperContext, WallpaperKind} from './ui/Desktop';
import {hasSfx} from './ui/Sfx';

export type PromoProps = {wallpaper: WallpaperKind; captions: boolean; bedVolume: number};

const COMPONENTS: Record<SceneId, React.FC> = {
	hook: Hook,
	problem: Problem,
	intro: Intro,
	topbar: TopBarScene,
	desktop: DesktopScene,
	click: ClickScene,
	outro: Outro,
};

export const Promo: React.FC<PromoProps> = ({wallpaper, captions, bedVolume}) => (
	<WallpaperContext.Provider value={wallpaper}>
		<AbsoluteFill style={{background: '#e9ecf2'}}>
			{SCENES.map((s) => {
				const C = COMPONENTS[s.id];
				return (
					<Sequence key={s.id} from={s.from} durationInFrames={s.frames} name={s.id}>
						<C />
						<Html5Audio src={staticFile(`vo/${s.file}`)} />
						{captions ? <Captions text={s.text} words={s.words} /> : null}
					</Sequence>
				);
			})}
			{hasSfx('bed') ? (
				<Html5Audio
					src={staticFile('sfx/bed.wav')}
					volume={(f) =>
						bedVolume *
						interpolate(f, [0, 30, TOTAL_FRAMES - 45, TOTAL_FRAMES - 1], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
					}
				/>
			) : null}
		</AbsoluteFill>
	</WallpaperContext.Provider>
);
