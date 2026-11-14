import React, {useMemo} from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {Word} from '../lib/timeline';
import {FONT_UI, FPS} from '../theme';

type CapWord = Word & {display: string};
type Page = {words: CapWord[]; start: number; end: number};

// Attach punctuation from the scene text to the timed words.
const withPunctuation = (text: string, words: Word[]): CapWord[] => {
	const tokens = text.split(/\s+/).filter(Boolean);
	return words.map((w, i) => ({...w, display: tokens[i] && tokens[i].replace(/[^\w]/g, '').toLowerCase() === w.w.replace(/[^\w]/g, '').toLowerCase() ? tokens[i] : w.w}));
};

// Pages break at sentence ends, or at a comma once a page is long enough.
const paginate = (words: CapWord[]): Page[] => {
	const pages: Page[] = [];
	let cur: CapWord[] = [];
	let chars = 0;
	const flush = () => {
		if (!cur.length) return;
		const last = cur[cur.length - 1];
		pages.push({words: cur, start: cur[0].t, end: last.t + last.d});
		cur = [];
		chars = 0;
	};
	for (const w of words) {
		cur.push(w);
		chars += w.display.length + 1;
		if (/[.?!]$/.test(w.display) || (/,$/.test(w.display) && chars > 34) || chars > 64) flush();
	}
	flush();
	return pages;
};

export const Captions: React.FC<{text: string; words: Word[]}> = ({text, words}) => {
	const frame = useCurrentFrame();
	const t = frame / FPS;
	const pages = useMemo(() => paginate(withPunctuation(text, words)), [text, words]);
	const idx = pages.findIndex((p, i) => t >= p.start - 0.05 && t < (pages[i + 1]?.start ?? p.end + 0.7) - 0.05);
	if (idx < 0) return null;
	const page = pages[idx];
	const fadeIn = idx === 0 ? interpolate(t, [page.start - 0.05, page.start + 0.12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1;
	const isLast = idx === pages.length - 1;
	const fadeOut = isLast ? interpolate(t, [page.end + 0.45, page.end + 0.65], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1;
	return (
		<div
			style={{
				position: 'absolute',
				left: 0,
				right: 0,
				bottom: 54,
				display: 'flex',
				justifyContent: 'center',
				zIndex: 500,
				opacity: fadeIn * fadeOut,
				pointerEvents: 'none',
			}}
		>
			<div
				style={{
					maxWidth: 1180,
					background: 'rgba(24, 27, 33, 0.82)',
					backdropFilter: 'blur(14px)',
					borderRadius: 26,
					padding: '14px 30px 16px',
					fontFamily: FONT_UI,
					fontSize: 40,
					fontWeight: 600,
					lineHeight: 1.3,
					wordSpacing: '0.14em',
					textAlign: 'center',
					color: '#ffffff',
					boxShadow: '0 10px 30px rgba(10, 12, 18, 0.25)',
				}}
			>
				{page.words.map((w, i) => {
					const active = t >= w.t && t < (page.words[i + 1]?.t ?? w.t + w.d + 0.25);
					const spoken = t >= w.t;
					return (
						<React.Fragment key={i}>
							<span
								style={{
									color: active ? '#ffffff' : spoken ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.45)',
									background: active ? 'rgba(63, 168, 119, 0.85)' : 'transparent',
									borderRadius: 10,
									padding: '0 6px',
									margin: '0 -6px',
								}}
							>
								{w.display}
							</span>
							{i < page.words.length - 1 ? ' ' : ''}
						</React.Fragment>
					);
				})}
			</div>
		</div>
	);
};
