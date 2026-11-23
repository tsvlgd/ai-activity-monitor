import {scene, wf} from './timeline';
import {FPS} from '../theme';

// Seconds the video has been playing. It starts on "Watch" in the topbar scene
// and keeps playing through the interlude and the matters scene.
export const videoStart = () => scene('topbar').from + wf('topbar', 'Watch');
export const videoT = (globalFrame: number) => Math.max(0, (globalFrame - videoStart()) / FPS);

// Scroll that brings the player's lower half, controls and progress bar under
// the zoomed top bar.
export const VIDEO_SCROLL_ZOOMED = 400;
