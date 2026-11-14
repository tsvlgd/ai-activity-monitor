import timeline from '../timeline.json';
import {FPS} from '../theme';

export type Word = {t: number; d: number; w: string};
export type SceneId = 'hook' | 'problem' | 'intro' | 'topbar' | 'desktop' | 'click' | 'outro';

type RawScene = {id: string; text: string; file: string; duration: number; words: Word[]};

const PAD = 0.35;
const OUTRO_TAIL = 1.8;

export type SceneInfo = RawScene & {id: SceneId; frames: number; from: number};

let from = 0;
export const SCENES: SceneInfo[] = (timeline.scenes as RawScene[]).map((s) => {
	const seconds = s.duration + PAD + (s.id === 'outro' ? OUTRO_TAIL : 0);
	const frames = Math.round(seconds * FPS);
	const info = {...s, id: s.id as SceneId, frames, from};
	from += frames;
	return info;
});

export const TOTAL_FRAMES = from;

export const scene = (id: SceneId): SceneInfo => {
	const s = SCENES.find((x) => x.id === id);
	if (!s) throw new Error(`unknown scene ${id}`);
	return s;
};

const norm = (w: string) => w.toLowerCase().replace(/[^a-z]/g, '');

// Local frame (within the scene) at which a word starts. `nth` picks a repeat.
export const wf = (id: SceneId, word: string, nth = 0): number => {
	const matches = scene(id).words.filter((w) => norm(w.w) === norm(word));
	const m = matches[nth];
	if (!m) throw new Error(`word ${word} not in ${id}`);
	return Math.round(m.t * FPS);
};

// Local frame at which a word ends.
export const wfEnd = (id: SceneId, word: string, nth = 0): number => {
	const matches = scene(id).words.filter((w) => norm(w.w) === norm(word));
	const m = matches[nth];
	if (!m) throw new Error(`word ${word} not in ${id}`);
	return Math.round((m.t + m.d) * FPS);
};
