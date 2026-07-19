// Headless entity smoke test — no DOM, no THREE.WebGLRenderer needed.
// createGhost() itself needs a scene + document (canvas textures), so we
// don't call it here; instead we exercise the pure logic ghost.js and
// noise.js export: segment-vs-AABB line of sight, the axis-slide collision
// helper, the alertness curve, and the blind-state transition table.
import { noiseBus, hearingFalloff, hearingRadius } from '../src/noise.js';
import {
  createGhost,
  segmentIntersectsAABB,
  hasLineOfSight,
  blockedAt,
  axisSlide,
  updateAlertness,
  nextBehaviorState,
  ENTITY_RADIUS,
  SIGHT_RANGE,
  CATCH_DIST,
  PURSUIT_LOUDNESS,
  SUSPICIOUS_ALERT,
  ALERTNESS_DECAY_PER_SEC,
} from '../src/ghost.js';

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) failures++;
};

// --- module import sanity (the hard rule: no top-level DOM access) --------
check(typeof createGhost === 'function', 'createGhost is exported and importable without a DOM');
check(typeof noiseBus.emit === 'function' && typeof noiseBus.subscribe === 'function', 'noiseBus has emit/subscribe');
check(ENTITY_RADIUS === 1.0, 'entity collision radius is exactly 1.0 per the brief');
check(SIGHT_RANGE === 90, 'sight range is exactly 90ft per the brief');
check(CATCH_DIST === 3.0, 'catch distance is exactly 3.0ft per the brief');
check(PURSUIT_LOUDNESS === 0.35, 'pursuit loudness threshold was lowered to 0.35 (hostility pass) so quieter/closer sounds provoke pursuit sooner');
check(ALERTNESS_DECAY_PER_SEC === 0.02, 'alertness decay was slowed to 0.02/s (hostility pass) so repeated small noises stack up instead of resetting');
check(ALERTNESS_DECAY_PER_SEC < 0.05, 'alertness now decays slower than the old 0.05/s baseline');

// --- noise bus --------------------------------------------------------------
{
  const seen = [];
  const unsub = noiseBus.subscribe((ev) => seen.push(ev));
  noiseBus.emit(10, 20, 0.5, 'footstep');
  check(seen.length === 1, 'subscriber receives an emitted event');
  check(seen[0].x === 10 && seen[0].z === 20 && seen[0].loudness === 0.5 && seen[0].kind === 'footstep', 'event fields round-trip');
  unsub();
  noiseBus.emit(1, 1, 1, 'misc');
  check(seen.length === 1, 'unsubscribe stops further delivery');
}
{
  check(hearingFalloff(0, 1) === 1, 'falloff is 1 at the source');
  check(hearingFalloff(1000, 1) === 0, 'falloff is 0 far beyond hearing range');
  const r = hearingRadius(1.2);
  check(hearingFalloff(r - 1, 1.2) > 0 && hearingFalloff(r + 1, 1.2) === 0, 'falloff crosses zero at hearingRadius(loudness)');
  check(hearingRadius(1.2) > hearingRadius(0.1), 'louder sounds are heard further away');

  // hostility pass: a running footstep (raw loudness 0.55, per src/main.js's
  // player.onFootstep wiring) should cross the pursuit threshold from a
  // meaningful distance, not just point-blank — while a single walking
  // footstep (0.16) should never spike straight to pursuit on its own, even
  // heard from right next to the entity (it should build alertness instead).
  const runningEffAt30ft = 0.55 * hearingFalloff(30, 0.55);
  check(runningEffAt30ft > PURSUIT_LOUDNESS, `running footsteps heard from 30ft (eff=${runningEffAt30ft.toFixed(3)}) cross the pursuit threshold`);
  const walkingEffAt0ft = 0.16 * hearingFalloff(0, 0.16);
  check(walkingEffAt0ft < PURSUIT_LOUDNESS, `a single walking footstep, even at 0ft (eff=${walkingEffAt0ft.toFixed(3)}), never alone triggers pursuit`);
}

// --- segment vs AABB / line of sight ----------------------------------------
{
  const wall = { x0: 5, y0: 0, z0: -5, x1: 6, y1: 10, z1: 5 };
  check(segmentIntersectsAABB(0, 2, 0, 10, 2, 0, wall), 'a wall directly between two points blocks the segment');
  check(!segmentIntersectsAABB(0, 2, 0, 10, 2, 20, wall), 'a wall well off to the side does not block the segment');
  check(!segmentIntersectsAABB(0, 20, 0, 10, 20, 0, wall), 'a wall does not block a segment that passes well above it');

  const colliders = [wall];
  check(!hasLineOfSight(0, 2, 0, 10, 2, 0, colliders), 'hasLineOfSight: blocked when a collider sits on the line');
  check(hasLineOfSight(0, 2, 20, 10, 2, 20, colliders), 'hasLineOfSight: clear when nothing is in the way');
  check(hasLineOfSight(0, 2, 0, 10, 2, 0, []), 'hasLineOfSight: clear with no colliders at all');
}

// --- axis-slide collision (Player.moveAxis-style) ---------------------------
{
  // a wall running along x=10..20, spanning all of z — blocks eastward
  // movement but a step north (along z) beside it should still succeed
  const wall = { x0: 10, y0: 0, z0: -100, x1: 20, y1: 10, z1: 100 };
  check(blockedAt(10.5, 0, 0, [wall], ENTITY_RADIUS, 6), 'blockedAt: inside the wall footprint is blocked');
  check(!blockedAt(5, 0, 0, [wall], ENTITY_RADIUS, 6), 'blockedAt: clear well away from the wall');

  const r1 = axisSlide(9, 0, 0, 3, 0, [wall], ENTITY_RADIUS, 6); // trying to walk straight into the wall
  check(r1.x < 9 + 3, 'axisSlide: x movement is stopped by the wall ahead');
  const r2 = axisSlide(9, 0, 0, 0, 3, [wall], ENTITY_RADIUS, 6); // sliding along it instead
  check(Math.abs(r2.z - 3) < 1e-9, 'axisSlide: z movement (sliding along the wall) is unaffected');
}

// --- alertness curve ---------------------------------------------------------
{
  const decayed = updateAlertness(0.5, 1, {});
  check(decayed < 0.5, 'alertness decays over time with no input');

  const risen = updateAlertness(0, 1, { noiseContribution: 0.4 });
  check(Math.abs(risen - 0.4) < 0.06, 'a noise contribution raises alertness by roughly that amount');

  const lowConfBreath = updateAlertness(0.2, 1, { breathingIntensity: 1, breathingConfidence: 0.2 });
  check(Math.abs(lowConfBreath - updateAlertness(0.2, 1, {})) < 1e-9, 'breathing below the 0.5 confidence gate has zero influence');

  const highConfBreath = updateAlertness(0.2, 1, { breathingIntensity: 1, breathingConfidence: 1 });
  const baseline = 0.2 - ALERTNESS_DECAY_PER_SEC * 1;
  check(highConfBreath > baseline, 'high-confidence breathing nudges alertness up, not just decays it');
  check(highConfBreath - baseline < 0.06, 'breathing alone raises alertness slowly, never an instant spike');

  check(updateAlertness(1, 1, { noiseContribution: 5 }) <= 1, 'alertness never exceeds 1');
  check(updateAlertness(0, 1, {}) >= 0, 'alertness never drops below 0');
}

// --- blind-state transition table -------------------------------------------
{
  check(nextBehaviorState('patrol', { alertness: 0 }) === 'patrol', 'patrol stays patrol with nothing going on');
  check(nextBehaviorState('patrol', { alertness: SUSPICIOUS_ALERT }) === 'suspicious', 'patrol -> suspicious once alertness crosses the threshold');
  check(nextBehaviorState('patrol', { alertness: 0, effectiveLoudness: PURSUIT_LOUDNESS + 0.01 }) === 'pursuit', 'patrol -> pursuit on a loud noise, even at low alertness');
  check(nextBehaviorState('patrol', { alertness: 0, sustainedTalk: true }) === 'pursuit', 'patrol -> pursuit on sustained talking');

  check(nextBehaviorState('suspicious', { alertness: 0 }) === 'patrol', 'suspicious -> patrol once alertness has fully cooled off');
  check(nextBehaviorState('suspicious', { alertness: SUSPICIOUS_ALERT }) === 'suspicious', 'suspicious holds while still moderately alert');
  check(nextBehaviorState('suspicious', { alertness: SUSPICIOUS_ALERT, effectiveLoudness: 0.9 }) === 'pursuit', 'suspicious -> pursuit on a loud noise');

  check(nextBehaviorState('pursuit', { alertness: 0 }) === 'patrol', 'pursuit -> patrol once alertness has fully cooled off');
  check(nextBehaviorState('pursuit', { alertness: 1 }) === 'pursuit', 'pursuit holds while alertness stays high');

  check(nextBehaviorState('hunt', { timerDone: false }) === 'hunt', 'hunt holds until its timer elapses');
  check(nextBehaviorState('hunt', { timerDone: true }) === 'cooldown', 'hunt -> cooldown when its timer elapses');
  check(nextBehaviorState('cooldown', { timerDone: false }) === 'cooldown', 'cooldown holds until its timer elapses');
  check(nextBehaviorState('cooldown', { timerDone: true }) === 'patrol', 'cooldown -> patrol when its timer elapses');

  check(nextBehaviorState('finalHunt', { alertness: 0, timerDone: true }) === 'finalHunt', 'finalHunt never auto-transitions (only exorcise() ends it)');
  check(nextBehaviorState('exorcised', { alertness: 1, effectiveLoudness: 2 }) === 'exorcised', 'exorcised is a dead end');
}

// --- catch rule (assembled from the primitives above, as ghost.js does) -----
{
  // While blind (eyesOpen=false), a concealed player must never be caught,
  // no matter how close: !concealed is false and eyesOpen-and-had-LOS is
  // false, so the whole condition is false regardless of distance.
  const canCatch = (dist, concealed, eyesOpenAndHadLOS) => dist < CATCH_DIST && (!concealed || eyesOpenAndHadLOS);
  check(!canCatch(0.1, true, false), 'blind + concealed + touching distance: still never caught');
  check(canCatch(0.1, false, false), 'blind + not concealed + touching distance: caught (bumped into in the dark)');
  check(canCatch(0.1, true, true), 'eyesOpen + had LOS + concealed + touching distance: caught');
  check(!canCatch(5, true, true), 'out of catch range: never caught regardless of mode');
}

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log('entity smoke test OK');
