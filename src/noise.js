// The Concierge — noise bus. A tiny synchronous pub/sub that decouples sound
// producers (player footsteps, generators, doors, future systems) from
// listeners (the entity in src/ghost.js). Producers call emit(); the entity
// subscribes directly to this module rather than being handed the bus, since
// createGhost(scene, colliders) has no room in its signature for it.
//
// No DOM/window access here at all, at import time or otherwise — safe to
// import under plain Node (see scripts/smoke-entity.mjs).

const listeners = new Set();

export const noiseBus = {
  // loudness 0..1.5; kind: 'footstep'|'run'|'land'|'talk'|'generator'|'door'|'misc'
  emit(x, z, loudness, kind = 'misc') {
    const event = { x, z, loudness, kind };
    for (const fn of listeners) fn(event);
  },
  // fn({x, z, loudness, kind}) -> returns an unsubscribe function
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

// How far (in feet) a noise of a given loudness can be heard at all. Louder
// sounds carry further; a whisper-quiet footstep (loudness ~0.16) is heard
// only nearby, a generator slam (1.2) carries across a couple of rooms.
export function hearingRadius(loudness) {
  return 60 + Math.max(0, loudness) * 70;
}

// Linear distance falloff: 1 at the source, 0 at/beyond hearingRadius(loudness).
// Callers multiply loudness * hearingFalloff(dist, loudness) to get the
// effective, distance-attenuated loudness a listener actually perceives.
export function hearingFalloff(dist, loudness) {
  const r = hearingRadius(loudness);
  if (r <= 0) return 0;
  return Math.max(0, 1 - dist / r);
}
