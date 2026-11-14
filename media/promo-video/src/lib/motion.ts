// Frame based ports of lib/ui/motion.js from the extension.
import {Easing, interpolate, spring} from 'remotion';
import {FPS} from '../theme';

const ms = (m: number) => (m / 1000) * FPS;

const WORK = ms(380);
const HOP_UP = ms(170);
const HOP_DOWN = ms(460);
const REST = ms(120);

const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
export const easeOutBounce = (x: number) => {
	const n1 = 7.5625;
	const d1 = 2.75;
	if (x < 1 / d1) return n1 * x * x;
	if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
	if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
	return n1 * (x -= 2.625 / d1) * x + 0.984375;
};

// 'work': continuous ease up and down, 380 ms each way.
export const workY = (frame: number, start: number, amp: number) => {
	if (frame < start) return 0;
	const t = (frame - start) % (2 * WORK);
	const p = t < WORK ? t / WORK : 1 - (t - WORK) / WORK;
	return -amp * easeInOutQuad(p);
};

// 'attention': hop up 170 ms, bounce down 460 ms, rest 120 ms, repeat.
export const attentionY = (frame: number, start: number, amp: number) => {
	if (frame < start) return 0;
	const h = amp + 2;
	const t = (frame - start) % (HOP_UP + HOP_DOWN + REST);
	if (t < HOP_UP) return -h * easeOutQuad(t / HOP_UP);
	if (t < HOP_UP + HOP_DOWN) return -h * (1 - easeOutBounce((t - HOP_UP) / HOP_DOWN));
	return 0;
};

export type MotionKind = 'none' | 'work' | 'attention';
export const motionY = (kind: MotionKind, frame: number, start: number, amp: number) =>
	kind === 'work' ? workY(frame, start, amp) : kind === 'attention' ? attentionY(frame, start, amp) : 0;

// popIn / popOut of the extension: 160 ms fade and slide in, 110 ms fade out.
export const pop = (frame: number, inAt: number, outAt = Infinity, dy = -4) => {
	const i = interpolate(frame, [inAt, inAt + ms(160)], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.out(Easing.quad),
	});
	const o = Number.isFinite(outAt)
		? interpolate(frame, [outAt, outAt + ms(110)], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
		: 1;
	return {opacity: i * o, y: dy * (1 - i), visible: i * o > 0.001};
};

// A bouncy scale for things that pop into view.
export const popSpring = (frame: number, at: number, damping = 12) =>
	spring({frame: frame - at, fps: FPS, config: {damping, stiffness: 180, mass: 0.7}});

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export const ease = (frame: number, from: number, to: number, a = 0, b = 1, easing = Easing.inOut(Easing.cubic)) =>
	interpolate(frame, [from, to], [a, b], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing});
