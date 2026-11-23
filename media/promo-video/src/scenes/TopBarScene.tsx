import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {ease, pop} from '../lib/motion';
import {wf} from '../lib/timeline';
import {Provider} from '../theme';
import {Sfx} from '../ui/Sfx';
import {TopBarStage} from '../ui/Stage';
import {PanelIconSpec} from '../ui/TopBar';

const IDS: Provider[] = ['claude', 'opencode', 'codex'];

// Every icon working: green dot and the continuous work motion.
export const workingIcons = (appearAt?: number): PanelIconSpec[] =>
	IDS.map((p, i) => ({
		provider: p,
		state: 'working',
		motion: 'work',
		stateAt: (appearAt ?? 0) + i * 5,
		appearAt: appearAt === undefined ? undefined : appearAt + i * 4,
	}));

export const TopBarScene: React.FC = () => {
	const frame = useCurrentFrame();
	const iconAt = wf('topbar', 'icon');
	const topAt = wf('topbar', 'top');
	const z = ease(frame, topAt - 2, topAt + 24, 0, 1, Easing.inOut(Easing.cubic));
	const scroll = interpolate(frame, [80, 130], [0, 60], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)});
	const ring = pop(frame, iconAt + 10, topAt + 30);

	return (
		<AbsoluteFill>
			<TopBarStage z={z} icons={workingIcons(iconAt)} scroll={scroll}>
				{ring.visible ? (
					<div
						style={{
							position: 'absolute',
							left: 785,
							top: 1,
							width: 106,
							height: 32,
							borderRadius: 10,
							border: '2px solid rgba(63,168,119,0.9)',
							opacity: ring.opacity,
							zIndex: 55,
						}}
					/>
				) : null}
			</TopBarStage>
			{[0, 4, 8].map((d) => (
				<Sfx key={d} name="pop" at={iconAt + d} volume={0.22} />
			))}
			<Sfx name="whoosh" at={topAt - 2} volume={0.22} />
		</AbsoluteFill>
	);
};
