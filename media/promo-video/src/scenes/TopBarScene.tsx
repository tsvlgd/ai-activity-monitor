import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {ease, pop} from '../lib/motion';
import {scene, wf} from '../lib/timeline';
import {videoT} from '../lib/videoClock';
import {Provider} from '../theme';
import {DocsPage, DOCS_TAB, DOCS_URL} from '../ui/ChromeWindow';
import {BlogPage, BLOG_TAB, BLOG_URL, VideoPage, VIDEO_TAB, VIDEO_URL} from '../ui/Pages';
import {Sfx} from '../ui/Sfx';
import {TopBarStage} from '../ui/Stage';
import {PanelIconSpec} from '../ui/TopBar';

const IDS: Provider[] = ['claude', 'opencode', 'codex'];
const END_ZOOM = 2.0; // leaves a wide strip of the page visible under the icons

// Every icon working: green dot and the continuous work motion.
export const workingIcons = (appearAt?: number): PanelIconSpec[] =>
	IDS.map((p, i) => ({
		provider: p,
		state: 'working',
		motion: 'work',
		stateAt: (appearAt ?? 0) + i * 5,
		appearAt: appearAt === undefined ? undefined : appearAt + i * 4,
	}));

const Layer: React.FC<{opacity: number; children: React.ReactNode}> = ({opacity, children}) =>
	opacity > 0.001 ? <div style={{position: 'absolute', inset: 0, opacity}}>{children}</div> : null;

export const TopBarScene: React.FC = () => {
	const frame = useCurrentFrame();
	const iconAt = wf('topbar', 'icon');
	const watchAt = wf('topbar', 'Watch');
	const blogAt = wf('topbar', 'blog');
	const stillAt = wf('topbar', 'still');

	const toVideo = ease(frame, watchAt, watchAt + 8);
	const toBlog = ease(frame, blogAt, blogAt + 8);
	const active = frame >= blogAt ? 2 : frame >= watchAt ? 1 : 0;
	const url = frame >= blogAt ? BLOG_URL : frame >= watchAt ? VIDEO_URL : DOCS_URL;
	const blogScroll = interpolate(frame, [blogAt + 6, scene('topbar').frames], [0, 300], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.inOut(Easing.sin),
	});
	const z = ease(frame, stillAt - 2, stillAt + 26, 0, 1, Easing.inOut(Easing.cubic));
	const ring = pop(frame, iconAt + 10, watchAt - 4);
	const t = videoT(scene('topbar').from + frame);

	return (
		<AbsoluteFill>
			<TopBarStage
				z={z}
				zoom={END_ZOOM}
				soften={0.25}
				icons={workingIcons(iconAt)}
				tabs={[DOCS_TAB, VIDEO_TAB, BLOG_TAB]}
				active={active}
				url={url}
				page={
					<>
						<Layer opacity={1 - toVideo}>
							<DocsPage />
						</Layer>
						<Layer opacity={toVideo * (1 - toBlog)}>
							<VideoPage t={t} />
						</Layer>
						<Layer opacity={toBlog}>
							<BlogPage scroll={blogScroll} />
						</Layer>
					</>
				}
			>
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
			<Sfx name="click" at={watchAt} volume={0.25} />
			<Sfx name="click" at={blogAt} volume={0.25} />
			<Sfx name="whoosh" at={stillAt - 2} volume={0.22} />
		</AbsoluteFill>
	);
};
