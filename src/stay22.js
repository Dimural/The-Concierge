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

function identityQuestion(name) {
  const decoys = ['The Royal Windsor', 'Hotel Meridian', 'The Kensington Arms'];
  const options = [decoys[0], decoys[1], name, decoys[2]];
  return {
    id: 'identity',
    label: 'THE LEDGER DEMANDS A NAME. WHICH PROPERTY DOES IT KEEP?',
    options,
    answerIndex: 2,
  };
}

function ratingQuestion(rating) {
  const base = round1(rating);
  const decoyLow = clamp(round1(base - 1.3), 0, 10);
  const decoyMid = clamp(round1(base + 0.7), 0, 10);
  const decoyHigh = clamp(round1(base - 2.1), 0, 10);
  const options = [decoyLow, base, decoyMid, decoyHigh].map((v) => `${v.toFixed(1)} / 10`);
  return {
    id: 'rating',
    label: 'THE LEDGER REMEMBERS A SCORE. WHAT DID THE GUESTS SAY BEFORE THEY STOPPED SAYING ANYTHING?',
    options,
    answerIndex: 1,
  };
}

function supplierCountQuestion(count) {
  const c = Math.max(1, Math.round(count));
  const candidates = [c - 2, c - 1, c + 1, c + 2, c + 3].filter((v) => v > 0 && v !== c);
  const unique = [...new Set(candidates)].slice(0, 3);
  while (unique.length < 3) unique.push(c + unique.length + 4);
  const options = [String(unique[0]), String(unique[1]), String(c), String(unique[2])];
  return {
    id: 'suppliers',
    label: 'HOW MANY CHANNELS FED THIS ROOM TO THE WORLD?',
    options,
    answerIndex: 2,
  };
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
  const options = [decoyTexts[0], correctText, decoyTexts[1], decoyTexts[2]];
  return {
    id: 'policy',
    label: 'WHAT DOES THE RESERVATION RULES ENGINE DEMAND OF THIS ROOM?',
    options,
    answerIndex: 1,
  };
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
