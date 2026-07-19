// Stay22 client. No top-level window/document access — imports cleanly in
// node (see scripts/smoke-stay22.mjs, which imports generateClues /
// generateFrontDesk directly). Fetches session core from the local server
// (/api/session, proxied to server/index.mjs); on any network failure falls
// back to the bundled snapshot so `npm run dev` alone always works.
import { getFallbackSession, DEFAULT_CAMPAIGN, DEFAULTS } from './data/royal-york-fallback.js';

function numOr(v, fb) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fb;
}
function strOr(v, fb) {
  return typeof v === 'string' && v.length ? v : fb;
}
function boolOr(v, fb) {
  return typeof v === 'boolean' ? v : fb;
}
function arrOr(v, fb) {
  return Array.isArray(v) && v.length ? v : fb;
}

async function fetchSessionCore() {
  try {
    const res = await fetch('/api/session', { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`session http ${res.status}`);
    const data = await res.json();
    if (!data || typeof data !== 'object' || !data.property || !data.market || !data.policy) {
      throw new Error('malformed session payload');
    }
    return data;
  } catch {
    // Server unreachable (or npm run dev without dev:all) — bundled snapshot,
    // clearly marked live:false.
    return getFallbackSession(DEFAULT_CAMPAIGN);
  }
}

// ---------------------------------------------------------------------------
// Clues — corrupted-hotel-ledger voice. Every field is coalesced against the
// fallback defaults so a null field never breaks a clue line.
// ---------------------------------------------------------------------------
export function generateClues(session) {
  const property = session?.property ?? {};
  const market = session?.market ?? {};
  const policy = session?.policy ?? {};

  const name = strOr(property.name, DEFAULTS.property.name).toUpperCase();
  const type = strOr(property.type, DEFAULTS.property.type).toUpperCase();
  const address = strOr(property.address, DEFAULTS.property.address).toUpperCase();
  const stars = numOr(property.stars, DEFAULTS.property.stars);
  const rating = numOr(property.rating, DEFAULTS.property.rating);
  const reviewCount = Math.round(numOr(property.reviewCount, DEFAULTS.property.reviewCount));
  const price = numOr(market.price, DEFAULTS.market.price);
  const currency = strOr(market.currency, DEFAULTS.market.currency).toUpperCase();
  const nights = numOr(market.nights, DEFAULTS.market.nights);
  const supplierCount = numOr(market.supplierCount, DEFAULTS.market.supplierCount);
  const suppliers = arrOr(market.suppliers, DEFAULTS.market.suppliers);
  const freeCancellation = boolOr(policy.freeCancellation, DEFAULTS.policy.freeCancellation);
  const instantBooking = boolOr(policy.instantBooking, DEFAULTS.policy.instantBooking);
  const maxGuests = numOr(policy.maxGuests, DEFAULTS.policy.maxGuests);

  return {
    // A — Property Registry
    A: [
      `THE LEDGER REMEMBERS A NAME: ${name}.`,
      `CLASSIFICATION ON FILE: ${type}, ${stars}-STAR STANDING.`,
      `LAST KNOWN ADDRESS BEFORE THE RECORDS BURNED: ${address}.`,
    ],
    // B — Guest Ledger
    B: [
      `THE LEDGER REMEMBERS: GUESTS RATED THIS PLACE ${rating.toFixed(1)} OUT OF 10 BEFORE THE RECORDS BURNED.`,
      `${reviewCount.toLocaleString('en-US')} VOICES LEFT THEIR MARK ON THIS ROOM. NONE OF THEM WARNED THE NEXT GUEST.`,
    ],
    // C — Rate Engine
    C: [
      `THE RATE ENGINE STILL TURNS: ${nights} NIGHT${nights === 1 ? '' : 'S'} BILLED AT ${price.toFixed(0)} ${currency}.`,
      `SOMEONE ALWAYS PAYS. THE LEDGER DOES NOT SAY FOR WHAT.`,
    ],
    // D — Reservation Rules
    D: [
      `${supplierCount} CHANNEL${supplierCount === 1 ? '' : 'S'} FED THIS ROOM TO THE WORLD: ${suppliers.join(', ').toUpperCase()}.`,
      `CANCELLATION: ${freeCancellation ? 'FORGIVEN, ONCE' : 'FINAL, ALWAYS'}. BOOKING: ${instantBooking ? 'INSTANT' : 'HELD FOR REVIEW'}. OCCUPANCY CEILING: ${maxGuests}.`,
    ],
  };
}

// ---------------------------------------------------------------------------
// Front-desk questions. 4 questions: identity, guest rating, supplier count,
// one rate-or-policy fact. Options/answerIndex are always derived from
// coalesced (never-null) values, so a null session field degrades to the
// fallback fact rather than a broken question.
// ---------------------------------------------------------------------------
function round1(n) {
  return Math.round(n * 10) / 10;
}
function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

// finishQuestion: shared helper that ensures exactly 4 distinct options with
// the correct answer at a deterministically shuffled position. If fewer than 3
// distinct decoys remain after formatting/deduping, generates replacements by
// stepping further from the correct value (for numeric) or from a spare-decoy
// list (for non-numeric).
// - id: question id
// - label: question label
// - correctOption: the correct value (numeric or string, before formatting)
// - decoyCandidates: array of candidate decoy values
// - spareDecoys: fallback decoy list for non-numeric questions
// - formatter: function(value) => string; if omitted, uses String()
// - isNumeric: if true, generates numeric replacements; if false, uses spareDecoys
// - numericRange: [min,max] keeping numeric replacements plausible (e.g. a
//   rating decoy must stay on the 0..10 scale); only exceeded as a last resort
function finishQuestion(
  id,
  label,
  correctOption,
  decoyCandidates,
  spareDecoys = [],
  formatter = String,
  isNumeric = false,
  numericRange = null,
) {
  const correctStr = formatter(correctOption);
  const seen = new Set([correctStr]);
  const rawDecoys = []; // raw (unformatted) decoys
  const formattedDecoys = []; // formatted decoys

  // First pass: format and dedupe decoy candidates.
  for (const decoy of decoyCandidates) {
    const decoyStr = formatter(decoy);
    if (!seen.has(decoyStr)) {
      seen.add(decoyStr);
      rawDecoys.push(decoy);
      formattedDecoys.push(decoyStr);
    }
  }

  // If fewer than 3 distinct decoys, generate replacements.
  if (formattedDecoys.length < 3) {
    // For numeric questions, step away from the correct value in both
    // directions, staying inside numericRange so decoys remain plausible.
    if (isNumeric) {
      const inRange = (v) =>
        !numericRange || (v >= numericRange[0] && v <= numericRange[1]);
      for (const respectRange of [true, false]) {
        for (let step = 1; formattedDecoys.length < 3 && step <= 100; step++) {
          for (const dir of [-1, 1]) {
            if (formattedDecoys.length >= 3) break;
            const candidate = Number(correctOption) + dir * step;
            if (respectRange && !inRange(candidate)) continue;
            const candidateStr = formatter(candidate);
            if (!seen.has(candidateStr)) {
              seen.add(candidateStr);
              rawDecoys.push(candidate);
              formattedDecoys.push(candidateStr);
            }
          }
        }
        if (formattedDecoys.length >= 3) break;
      }
    } else {
      // For non-numeric, use spare-decoy list.
      for (const spare of spareDecoys) {
        if (formattedDecoys.length >= 3) break;
        const spareStr = formatter(spare);
        if (!seen.has(spareStr)) {
          seen.add(spareStr);
          formattedDecoys.push(spareStr);
        }
      }
    }
  }

  // Ensure exactly 3 decoys for a 4-option question.
  const finalDecoys = formattedDecoys.slice(0, 3);

  // Shuffle the 4 options (correct + 3 decoys) deterministically using a
  // stable sort keyed by (id, option string) so the same question always
  // shuffles the same way, but the user doesn't know the pattern.
  const allOptions = [correctStr, ...finalDecoys];
  const withIndices = allOptions.map((opt, idx) => ({
    opt,
    origIdx: idx,
    sortKey: `${id}/${opt}`,
  }));
  withIndices.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const shuffled = withIndices.map((item) => item.opt);
  const answerIndex = withIndices.findIndex((item) => item.origIdx === 0);

  return {
    id,
    label,
    options: shuffled,
    answerIndex,
  };
}

function identityQuestion(name) {
  const spareDecoys = ['The Royal Windsor', 'Hotel Meridian', 'The Kensington Arms'];
  return finishQuestion(
    'identity',
    'THE LEDGER DEMANDS A NAME. WHICH PROPERTY DOES IT KEEP?',
    name,
    spareDecoys,
    spareDecoys,
    String,
    false, // isNumeric
  );
}

function ratingQuestion(rating) {
  const base = round1(rating);
  const decoyLow = clamp(round1(base - 1.3), 0, 10);
  const decoyMid = clamp(round1(base + 0.7), 0, 10);
  const decoyHigh = clamp(round1(base - 2.1), 0, 10);
  const candidates = [decoyLow, decoyMid, decoyHigh];
  return finishQuestion(
    'rating',
    'THE LEDGER REMEMBERS A SCORE. WHAT DID THE GUESTS SAY BEFORE THEY STOPPED SAYING ANYTHING?',
    base,
    candidates,
    [],
    (v) => `${v.toFixed(1)} / 10`,
    true, // isNumeric
    [0, 10], // decoys must stay on the rating scale
  );
}

function supplierCountQuestion(count) {
  const c = Math.max(1, Math.round(count));
  const candidates = [c - 2, c - 1, c + 1, c + 2, c + 3].filter((v) => v > 0 && v !== c);
  return finishQuestion(
    'suppliers',
    'HOW MANY CHANNELS FED THIS ROOM TO THE WORLD?',
    c,
    candidates,
    [],
    String,
    true, // isNumeric
    [1, 99], // supplier counts stay positive
  );
}

function policyQuestion(freeCancellation, instantBooking) {
  const combos = [
    { free: true, instant: true, text: 'FREE CANCELLATION. INSTANT BOOKING.' },
    { free: false, instant: true, text: 'NO CANCELLATION. INSTANT BOOKING.' },
    { free: true, instant: false, text: 'FREE CANCELLATION. HELD FOR MANUAL REVIEW.' },
    { free: false, instant: false, text: 'NO CANCELLATION. HELD FOR MANUAL REVIEW.' },
  ];
  const correctText = combos.find((c) => c.free === freeCancellation && c.instant === instantBooking).text;
  const decoyTexts = combos.filter((c) => c.text !== correctText).map((c) => c.text);
  return finishQuestion(
    'policy',
    'WHAT DOES THE RESERVATION RULES ENGINE DEMAND OF THIS ROOM?',
    correctText,
    decoyTexts,
    decoyTexts,
    String,
    false, // isNumeric
  );
}

export function generateFrontDesk(session) {
  const property = session?.property ?? {};
  const market = session?.market ?? {};
  const policy = session?.policy ?? {};

  const name = strOr(property.name, DEFAULTS.property.name);
  const rating = numOr(property.rating, DEFAULTS.property.rating);
  const supplierCount = numOr(market.supplierCount, DEFAULTS.market.supplierCount);
  const freeCancellation = boolOr(policy.freeCancellation, DEFAULTS.policy.freeCancellation);
  const instantBooking = boolOr(policy.instantBooking, DEFAULTS.policy.instantBooking);

  return [
    identityQuestion(name),
    ratingQuestion(rating),
    supplierCountQuestion(supplierCount),
    policyQuestion(freeCancellation, instantBooking),
  ];
}

export async function createSession() {
  const core = await fetchSessionCore();
  return {
    ...core,
    clues: generateClues(core),
    frontDesk: generateFrontDesk(core),
  };
}

// ---------------------------------------------------------------------------
// Transaction watcher — polls /api/transactions, dedupes by id, fires
// onNewArrival for anything not seen on a prior successful poll. The first
// successful poll establishes the baseline (pre-existing txns don't fire).
// ---------------------------------------------------------------------------
let watcherPoke = null;

export function startTransactionWatcher({ onNewArrival, intervalMs = 15000 } = {}) {
  const seen = new Set();
  let stopped = false;
  let primed = false;
  let timer = null;

  async function poll() {
    if (stopped) return;
    try {
      const res = await fetch('/api/transactions', { headers: { accept: 'application/json' } });
      if (!res.ok) return;
      const txns = await res.json();
      if (!Array.isArray(txns)) return;
      for (const txn of txns) {
        if (!txn || typeof txn.id !== 'string' || seen.has(txn.id)) continue;
        seen.add(txn.id);
        if (primed && typeof onNewArrival === 'function') onNewArrival(txn);
      }
      primed = true;
    } catch {
      // network hiccup — retry on the next tick, don't mark primed so we
      // don't replay the whole backlog as "new" once connectivity returns.
    }
  }

  poll();
  timer = setInterval(poll, intervalMs);
  watcherPoke = poll;

  return function stop() {
    stopped = true;
    if (timer) clearInterval(timer);
    if (watcherPoke === poll) watcherPoke = null;
  };
}

export async function simulateBooking() {
  const res = await fetch('/api/simulate-booking', { method: 'POST' });
  if (!res.ok) throw new Error(`simulate-booking http ${res.status}`);
  const txn = await res.json();
  if (watcherPoke) {
    // Poll fast right after simulating so the active watcher picks it up
    // well before the next scheduled interval tick.
    const fastPoll = watcherPoke;
    setTimeout(() => fastPoll(), 250);
  }
  return txn;
}
