// Which desktop tiles are parked and which are free to roam. Pure: no gi://
// imports, so Node tests can use it. A tile is parked only when the user
// dragged it (a saved position exists for that provider alone).

export function isParked(positions, provider) {
    const p = positions?.[provider];
    return Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.y >= 0;
}

// Providers (or tile objects with .provider) that may roam.
export function roamers(items, positions) {
    return items.filter(i => !isParked(positions, i.provider ?? i));
}

// Positions without one provider: releases that tile back to roaming.
export function release(positions, provider) {
    const next = {...positions};
    delete next[provider];
    return next;
}
