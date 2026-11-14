import React from 'react';
import {Composition} from 'remotion';
import {TOTAL_FRAMES} from './lib/timeline';
import {Promo, PromoProps} from './Promo';
import {FPS, H, W} from './theme';

const defaults: PromoProps = {wallpaper: 'user', captions: true, bedVolume: 0.25};

export const RemotionRoot: React.FC = () => (
	<>
		<Composition id="Promo" component={Promo} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} defaultProps={defaults} />
		<Composition
			id="PromoNeutral"
			component={Promo}
			durationInFrames={TOTAL_FRAMES}
			fps={FPS}
			width={W}
			height={H}
			defaultProps={{...defaults, wallpaper: 'neutral' as const}}
		/>
	</>
);
