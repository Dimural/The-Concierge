// Node smoke test for the pure, DOM-free parts of src/game: generator
// progression, objective copy, front-desk answer checking, and New Arrival
// dedupe. Run with `node src/game/smoke-game.mjs`; exits nonzero on failure.
import assert from 'node:assert/strict';
import {
  GENERATOR_IDS, createGeneratorState, countDone, allGeneratorsDone,
  objectiveText, stepHold, clamp, dist2D, checkDeskSubmission, createDedupe,
  HOLD_SECONDS,
} from './logic.js';

let n = 0;
function test(name, fn) {
  fn();
  n++;
  console.log(`ok - ${name}`);
}

test('createGeneratorState starts all-false', () => {
  const s = createGeneratorState();
  assert.deepEqual(Object.keys(s).sort(), [...GENERATOR_IDS].sort());
  for (const id of GENERATOR_IDS) assert.equal(s[id], false);
  assert.equal(countDone(s), 0);
  assert.equal(allGeneratorsDone(s), false);
});

test('allGeneratorsDone flips only when every generator is done', () => {
  const s = createGeneratorState();
  s.A = true; s.B = true; s.C = true;
  assert.equal(allGeneratorsDone(s), false);
  s.D = true;
  assert.equal(allGeneratorsDone(s), true);
  assert.equal(countDone(s), 4);
});

test('clamp bounds correctly', () => {
  assert.equal(clamp(-1, 0, 1), 0);
  assert.equal(clamp(2, 0, 1), 1);
  assert.equal(clamp(0.5, 0, 1), 0.5);
});

test('stepHold reaches 1.0 in exactly HOLD_SECONDS of accumulated dt', () => {
  let p = 0;
  const dt = 1 / 60;
  const frames = Math.round(HOLD_SECONDS / dt);
  for (let i = 0; i < frames; i++) p = stepHold(p, dt);
  assert.ok(Math.abs(p - 1) < 1e-6, `expected ~1, got ${p}`);
  // never overshoots
  assert.equal(stepHold(0.999, 10), 1);
});

test('objectiveText walks explore -> desk -> exit progression', () => {
  const s = createGeneratorState();
  const t0 = objectiveText(s, false);
  assert.match(t0, /RESTORE THE ARCHIVE/);
  assert.match(t0, /Property Registry/);
  s.A = true; s.B = true; s.C = true; s.D = true;
  const t1 = objectiveText(s, false);
  assert.match(t1, /FRONT DESK/);
  const t2 = objectiveText(s, true);
  assert.match(t2, /EXIT IS UNLOCKED/);
});

test('objectiveText lists only the remaining generators', () => {
  const s = createGeneratorState();
  s.A = true;
  const t = objectiveText(s, false);
  assert.ok(!t.includes('Property Registry'));
  assert.ok(t.includes('Guest Ledger'));
  assert.ok(t.includes('Rate Engine'));
  assert.ok(t.includes('Reservation Rules'));
});

test('dist2D ignores y (feet-plane distance only)', () => {
  const a = { x: 0, y: 100, z: 0 };
  const b = { x: 3, y: -50, z: 4 };
  assert.equal(dist2D(a, b), 5);
});

test('checkDeskSubmission: all-correct passes, any-wrong fails with wrongIds', () => {
  const questions = [
    { id: 'name', answerIndex: 0 },
    { id: 'rating', answerIndex: 2 },
    { id: 'suppliers', answerIndex: 1 },
    { id: 'policy', answerIndex: 3 },
  ];
  const good = { name: 0, rating: 2, suppliers: 1, policy: 3 };
  assert.deepEqual(checkDeskSubmission(questions, good), { correct: true, wrongIds: [] });

  const bad = { name: 0, rating: 1, suppliers: 1, policy: 0 };
  const result = checkDeskSubmission(questions, bad);
  assert.equal(result.correct, false);
  assert.deepEqual(result.wrongIds.sort(), ['policy', 'rating']);
});

test('checkDeskSubmission treats a missing selection as wrong, not a crash', () => {
  const questions = [{ id: 'a', answerIndex: 0 }];
  const result = checkDeskSubmission(questions, {});
  assert.equal(result.correct, false);
  assert.deepEqual(result.wrongIds, ['a']);
});

test('New Arrival dedupe: first id accepted, repeat rejected, distinct id accepted', () => {
  const dedupe = createDedupe();
  assert.equal(dedupe.tryAdd('txn-1'), true);
  assert.equal(dedupe.tryAdd('txn-1'), false, 'duplicate id must be rejected');
  assert.equal(dedupe.tryAdd('txn-2'), true);
  assert.equal(dedupe.size(), 2);
  assert.equal(dedupe.has('txn-1'), true);
  assert.equal(dedupe.has('txn-99'), false);
});

test('New Arrival dedupe rejects null/undefined ids without throwing', () => {
  const dedupe = createDedupe();
  assert.equal(dedupe.tryAdd(null), false);
  assert.equal(dedupe.tryAdd(undefined), false);
  assert.equal(dedupe.size(), 0);
});

test('forced arrival ids (judge panel "Force New Arrival") are unique per call, so never deduped away', () => {
  const dedupe = createDedupe();
  const idA = `forced-${Date.now()}`;
  const idB = `forced-${Date.now() + 1}`;
  assert.equal(dedupe.tryAdd(idA), true);
  assert.equal(dedupe.tryAdd(idB), true);
});

console.log(`\n${n} passed`);
