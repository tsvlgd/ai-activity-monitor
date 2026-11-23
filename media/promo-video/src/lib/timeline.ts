import timeline from '../timeline.json';
import {FPS} from '../theme';

export type Word = {t: number; d: number; w: string};
export type SceneId = 'hook' | 'problem' | 'intro' | 'topbar' | 'interlude' | 'matters' | 'click' | 'outro';

type RawScene = {id: string; text: string; file: string; duration: number; words: Word[]};

const PAD = 0.35;
const OUTRO_TAIL = 1.8;
export const INTERLUDE_FRAMES = 90; // silent 3 s cut, no voice and no captions
export const XFADE = 8; // crossfade frames into and out of the interlude

export type SceneInfo = {id: SceneId; text: string; file: string | null; words: Word[]; frames: number; from: number};

const ORDER: SceneId[] = ['hook', 'problem', 'intro', 'topbar', 'interlude', 'matters', 'click', 'outro'];
const RAW = timeline.scenes as RawScene[];

let from = 0;
export const SCENES: SceneInfo[] = ORDER.map((id) => {
	let info: SceneInfo;
	if (id === 'interlude') {
		info = {id, text: '', file: null, words: [], frames: INTERLUDE_FRAMES, from};
	} else {
		const s = RAW.find((r) => r.id === id);
		if (!s) throw new Error(`scene ${id} missing from timeline.json`);
		const seconds = s.duration + PAD + (id === 'outro' ? OUTRO_TAIL : 0);
		info = {id, text: s.text, file: s.file, words: s.words, frames: Math.round(seconds * FPS), from};
	}
	from += info.frames;
	return info;
});

export const TOTAL_FRAMES = from;

export const scene = (id: SceneId): SceneInfo => {
	const s = SCENES.find((x) => x.id === id);
	if (!s) throw new Error(`unknown scene ${id}`);
	return s;
};

const norm = (w: string) => w.toLowerCase().replace(/[^a-z]/g, '');

const find = (id: SceneId, word: string, nth: number) => {
	const matches = scene(id).words.filter((w) => norm(w.w) === norm(word));
	const m = matches[nth];
	if (!m) throw new Error(`word ${word} not in ${id}`);
	return m;
};

// Local frame (within the scene) at which a word starts. `nth` picks a repeat.
export const wf = (id: SceneId, word: string, nth = 0): number => Math.round(find(id, word, nth).t * FPS);

// Local frame at which a word ends.
export const wfEnd = (id: SceneId, word: string, nth = 0): number => {
	const m = find(id, word, nth);
	return Math.round((m.t + m.d) * FPS);
};
