import React from 'react';
import {AbsoluteFill, Html5Audio, interpolate, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {SCENES, SceneId, TOTAL_FRAMES, XFADE} from './lib/timeline';
import {ClickScene} from './scenes/ClickScene';
import {Hook} from './scenes/Hook';
import {Interlude} from './scenes/Interlude';
import {Intro} from './scenes/Intro';
import {Matters} from './scenes/Matters';
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
	interlude: Interlude,
	matters: Matters,
	click: ClickScene,
	outro: Outro,
};

// Fades a scene in over its first frames (it sits above the interlude tail).
const FadeIn: React.FC<{frames: number; children: React.ReactNode}> = ({frames, children}) => {
	const f = useCurrentFrame();
	const o = interpolate(f, [0, frames], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return <AbsoluteFill style={{opacity: o}}>{children}</AbsoluteFill>;
};

export const Promo: React.FC<PromoProps> = ({wallpaper, captions, bedVolume}) => (
	<WallpaperContext.Provider value={wallpaper}>
		<AbsoluteFill style={{background: '#e9ecf2'}}>
			{SCENES.map((s) => {
				const C = COMPONENTS[s.id];
				if (s.id === 'interlude') {
					// Starts XFADE early (fading in over the topbar tail) and ends XFADE late
					// (under the matters fade in). No voice, no captions.
					return (
						<Sequence key={s.id} from={s.from - XFADE} durationInFrames={s.frames + 2 * XFADE} name={s.id}>
							<C />
						</Sequence>
					);
				}
				return (
					<Sequence key={s.id} from={s.from} durationInFrames={s.frames} name={s.id}>
						{s.id === 'matters' ? (
							<FadeIn frames={XFADE}>
								<C />
							</FadeIn>
						) : (
							<C />
						)}
						{s.file ? <Html5Audio src={staticFile(`vo/${s.file}`)} /> : null}
						{captions && s.words.length ? <Captions text={s.text} words={s.words} /> : null}
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
