import React from 'react';
import {getStaticFiles, Html5Audio, Sequence, staticFile} from 'remotion';

export type SfxName = 'pop' | 'click' | 'whoosh' | 'bump' | 'ding' | 'bed';

const has = (path: string) => {
	try {
		return getStaticFiles().some((f) => f.name === path);
	} catch {
		return false;
	}
};

// Plays public/sfx/<name>.wav at a frame, only when the file exists. Kept quiet
// so the voice always dominates.
export const Sfx: React.FC<{name: SfxName; at: number; volume?: number}> = ({name, at, volume = 0.3}) => {
	const path = `sfx/${name}.wav`;
	if (!has(path)) return null;
	return (
		<Sequence from={Math.max(0, Math.round(at))} durationInFrames={60} layout="none">
			<Html5Audio src={staticFile(path)} volume={volume} />
		</Sequence>
	);
};

export const hasSfx = (name: SfxName) => has(`sfx/${name}.wav`);
