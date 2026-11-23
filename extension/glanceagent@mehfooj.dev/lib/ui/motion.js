// Shared tile motion, used by the desktop tiles and the top bar icons.
//
//   work       continuous up and down while the agent is working
//   attention  ATTENTION_HOPS hops with a bounce, then still, when a result
//              or a question waits for the user (completed, waiting, error).
//              The bubble keeps saying it; the motion only draws the eye.
//              A newer attention (a new token) hops again.
//   none       still (idle, or reduced motion)

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';

import {State} from '../core/model.js';

const WORK_MS = 380;
const HOP_UP_MS = 170;
const HOP_DOWN_MS = 460;
// Done, waiting or failed: bounce again almost at once, so it reads as urgent,
// but stop after a few hops: endless motion stops being a signal and becomes noise.
const ATTENTION_REST_MS = 120;
export const ATTENTION_HOPS = 4;

// Speech bubble text when a state needs the user (tiles and top bar).
export const SAYINGS = {waiting: 'need you!', completed: 'done!', error: 'oops, an error'};

// Fade and slide a small overlay in or out (hover labels, bubbles).
export function popIn(actor, dy = -4) {
    actor.remove_all_transitions();
    actor.opacity = 0;
    actor.translation_y = dy;
    actor.visible = true;
    actor.ease({opacity: 255, translation_y: 0, duration: 160, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
}

export function popOut(actor) {
    actor.remove_all_transitions();
    actor.ease({
        opacity: 0, duration: 110, mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        onComplete: () => {
            actor.visible = false;
        },
    });
}

export function motionFor(state, acknowledged = false) {
    if (state === State.WORKING)
        return 'work';
    if (!acknowledged && (state === State.WAITING || state === State.COMPLETED || state === State.ERROR))
        return 'attention';
    return 'none';
}

export class Motion {
    // amplitude: pixels for the work motion; the attention hop is a bit higher.
    constructor(actor, amplitude) {
        this._actor = actor;
        this._amp = amplitude;
        this._mode = 'none';
        this._timer = 0;
        this._token = null;
        this._hopsLeft = 0;
        this._hopsDone = 0;
    }

    get mode() {
        return this._mode;
    }

    // Hops finished since the last attention started (test harness only).
    get hops() {
        return this._hopsDone;
    }

    // token: identifies one attention episode; a new token hops again even
    // when the mode is already 'attention'.
    set(mode, token = null) {
        if (mode === this._mode && (mode !== 'attention' || token === this._token))
            return;
        this._mode = mode;
        this._token = token;
        this._clear();
        if (mode === 'work') {
            this._actor.ease({
                translation_y: -this._amp,
                duration: WORK_MS,
                mode: Clutter.AnimationMode.EASE_IN_OUT_QUAD,
                repeatCount: -1,
                autoReverse: true,
            });
        } else if (mode === 'attention') {
            this._hopsLeft = ATTENTION_HOPS;
            this._hopsDone = 0;
            this._hop();
        } else {
            this._actor.ease({translation_y: 0, duration: 150, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
        }
    }

    _hop() {
        if (this._mode !== 'attention' || this._hopsLeft <= 0)
            return;
        this._hopsLeft--;
        this._actor.ease({
            translation_y: -(this._amp + 2),
            duration: HOP_UP_MS,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                if (this._mode !== 'attention')
                    return;
                this._actor.ease({
                    translation_y: 0,
                    duration: HOP_DOWN_MS,
                    mode: Clutter.AnimationMode.EASE_OUT_BOUNCE,
                    onComplete: () => {
                        if (this._mode !== 'attention')
                            return;
                        this._hopsDone++;
                        if (this._hopsLeft <= 0)
                            return; // rests at translation 0 until the next episode
                        this._timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ATTENTION_REST_MS, () => {
                            this._timer = 0;
                            this._hop();
                            return GLib.SOURCE_REMOVE;
                        });
                    },
                });
            },
        });
    }

    _clear() {
        if (this._timer) {
            GLib.source_remove(this._timer);
            this._timer = 0;
        }
        this._actor.remove_all_transitions();
    }

    destroy() {
        this._mode = 'none';
        this._clear();
        this._actor.translation_y = 0;
    }
}
