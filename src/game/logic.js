// Pure, DOM/THREE-free state helpers for the game loop. Kept separate from
// index.js so the progression rules (generator hold timing, objective copy,
// front-desk answer checking, new-arrival dedupe) are unit-testable with
// plain node asserts — see smoke-game.mjs.

export const GENERATOR_IDS = ['A', 'B', 'C', 'D'];

// Room/floor placement per the Task 4 brief. floor index matches the array
// returned by layout.js's buildFloors(): 0 = mezzanine (y=0), 1 = convention (y=-26).
export const GENERATOR_META = {
  A: { label: 'Property Registry', room: 'Reservation Office', floor: 0 },
  B: { label: 'Guest Ledger', room: 'Library', floor: 0 },
  C: { label: 'Rate Engine', room: 'Concert Hall', floor: 1 },
  D: { label: 'Reservation Rules', room: 'Ballroom', floor: 1 },
};

export const FRONT_DESK_POS = { x: 140, y: 0, z: 118 };
export const EXIT_ROOM = { name: 'To Garage (passage)', floor: 0 };

export const GEN_RADIUS = 6; // ft, proximity to interact with a generator
export const DESK_RADIUS = 9; // ft, proximity to interact with the front desk
export const EXIT_RADIUS = 5; // ft, proximity to trigger the win screen
export const HOLD_SECONDS = 2.5; // hold-E duration to complete a generator

export function createGeneratorState() {
  const s = {};
  for (const id of GENERATOR_IDS) s[id] = false;
  return s;
}

export function countDone(state) {
  return GENERATOR_IDS.reduce((n, id) => n + (state[id] ? 1 : 0), 0);
}

export function allGeneratorsDone(state) {
  return countDone(state) === GENERATOR_IDS.length;
}

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function stepHold(progress, dt, holdSeconds = HOLD_SECONDS) {
  return clamp(progress + dt / holdSeconds, 0, 1);
}

export function dist2D(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

// Objective copy shown in the HUD as the loop advances — a pure function of
// state so its transitions can be snapshot-tested without touching the DOM.
export function objectiveText(genState, deskDone) {
  if (deskDone) return 'FIND THE WAY OUT. THE EXIT IS UNLOCKED.';
  const remaining = GENERATOR_IDS.filter((id) => !genState[id]);
  if (remaining.length === 0) return 'RETURN TO THE FRONT DESK AND SUBMIT THE RECORD.';
  const names = remaining.map((id) => GENERATOR_META[id].label).join(', ');
  return `RESTORE THE ARCHIVE: ${names}`;
}

// Front-desk submission checking.
// questions: [{ id, label, options: [string,string,string,string], answerIndex }]
// selections: { [id]: selectedIndex }
export function checkDeskSubmission(questions, selections) {
  const wrongIds = [];
  for (const q of questions) {
    if (selections[q.id] !== q.answerIndex) wrongIds.push(q.id);
  }
  return { correct: wrongIds.length === 0, wrongIds };
}

// New-Arrival transaction dedupe — a thin Set wrapper so it is testable
// without any DOM/game-state coupling.
export function createDedupe() {
  const seen = new Set();
  return {
    tryAdd(id) {
      if (id == null || seen.has(id)) return false;
      seen.add(id);
      return true;
    },
    has(id) { return seen.has(id); },
    size() { return seen.size; },
  };
}
