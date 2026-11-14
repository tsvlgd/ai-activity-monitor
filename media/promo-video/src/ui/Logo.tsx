import React from 'react';
import {getStaticFiles, Img, staticFile} from 'remotion';
import {Provider} from '../theme';

// Preferred file names per provider, first match in public/logos wins.
const CANDIDATES: Record<Provider, string[]> = {
	claude: ['logos/claude-official.svg', 'logos/claude.svg', 'logos/claude.png'],
	opencode: ['logos/opencode.svg', 'logos/opencode.png'],
	codex: ['logos/codex.svg', 'logos/codex.png'],
};

const available = (): Set<string> => {
	try {
		return new Set(getStaticFiles().map((f) => f.name));
	} catch {
		return new Set();
	}
};

export const logoFile = (p: Provider): string | null => {
	const files = available();
	return CANDIDATES[p].find((c) => files.has(c)) ?? null;
};

// Neutral placeholder used only while no Codex logo exists.
const Placeholder: React.FC<{size: number}> = ({size}) => (
	<svg width={size} height={size} viewBox="0 0 24 24">
		<circle cx="12" cy="12" r="9.5" fill="none" stroke="#2b303b" strokeWidth="2.2" />
		<path d="M8.5 9.5l3 2.5-3 2.5M13 15h3" stroke="#2b303b" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

export const Logo: React.FC<{provider: Provider; size: number; style?: React.CSSProperties}> = ({provider, size, style}) => {
	const file = logoFile(provider);
	if (!file) {
		return (
			<div style={{width: size, height: size, display: 'flex', ...style}}>
				<Placeholder size={size} />
			</div>
		);
	}
	return <Img src={staticFile(file)} style={{width: size, height: size, objectFit: 'contain', display: 'block', ...style}} />;
};
