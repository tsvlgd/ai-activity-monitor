// Notification policy. Pure: decides whether a state transition deserves a
// desktop notification. Spam control lives here so it is unit testable.

import {State} from './model.js';

export const NotifyKind = Object.freeze({
    APPROVAL: 'approval',
    INPUT: 'input',
    COMPLETED: 'completed',
    ERROR: 'error',
    TERMINATED: 'terminated',
});

export const DEFAULT_POLICY = Object.freeze({
    notifyCompleted: true,
    notifyApproval: true,
    notifyError: true,
    notifyTerminated: true,
    // Quick turns are usually watched live; do not notify for them.
    minTurnSeconds: 15,
    // Same session and same kind within this window is suppressed.
    dedupeSeconds: 30,
});

// prev may be null (new session). `ctx.replaying` is true while the monitor
// rebuilds state from spool files after a shell restart: never notify then.
export function decideNotification(prev, next, ctx, policy = DEFAULT_POLICY) {
    if (ctx.replaying || !next)
        return null;
    const prevState = prev ? prev.state : null;
    if (prevState === next.state && !(next.state === State.WAITING && prev.waitingKind !== next.waitingKind))
        return null;

    let kind = null;
    if (next.state === State.WAITING)
        kind = next.waitingKind === 'input' ? NotifyKind.INPUT : NotifyKind.APPROVAL;
    else if (next.state === State.ERROR)
        kind = NotifyKind.ERROR;
    else if (next.state === State.COMPLETED && (prevState === State.WORKING || prevState === State.WAITING))
        kind = NotifyKind.COMPLETED;
    else if (next.state === State.ENDED && next.unexpectedEnd)
        kind = NotifyKind.TERMINATED;
    if (!kind)
        return null;

    if ((kind === NotifyKind.APPROVAL || kind === NotifyKind.INPUT) && !policy.notifyApproval)
        return null;
    if (kind === NotifyKind.ERROR && !policy.notifyError)
        return null;
    if (kind === NotifyKind.TERMINATED && !policy.notifyTerminated)
        return null;
    if (kind === NotifyKind.COMPLETED) {
        if (!policy.notifyCompleted)
            return null;
        if ((next.lastTurnSeconds ?? 0) < policy.minTurnSeconds)
            return null;
    }

    const memo = ctx.lastNotified?.get(next.key);
    if (memo && memo.kind === kind && ctx.now - memo.at < policy.dedupeSeconds)
        return null;

    return {kind, urgent: kind === NotifyKind.APPROVAL || kind === NotifyKind.INPUT || kind === NotifyKind.ERROR};
}
