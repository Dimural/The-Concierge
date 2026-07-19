// Smoke test for the Stay22 layer: spins up server/index.mjs with no API key
// on a scratch port, hits the real HTTP endpoints, then unit-tests the
// client-side clue/question generator directly against (a) a full snapshot
// and (b) a snapshot with nulled policy/market/property fields. Plain node
// asserts; exits nonzero on failure.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let failures = 0;
function check(ok, msg) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) failures++;
}

const PORT = 8791;
const BASE = `http://localhost:${PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/session`);
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await sleep(100);
  }
  return false;
}

async function runServerChecks() {
  // Explicitly scrub any inherited key so this test always exercises the
  // no-key fallback path, per the "works perfectly with no key" requirement.
  // Set to '' rather than delete: the server's loadEnv() only skips vars
  // already present in the environment, so a deleted var would be refilled
  // from the developer's real .env and flip the server into live mode.
  const env = { ...process.env };
  env.STAY22_API_KEY = '';
  env.STAY22_SERVER_PORT = String(PORT);
  env.STAY22_CAMPAIGN_ID = ''; // exercise the default campaign id too

  const child = spawn(process.execPath, [path.join(root, 'server', 'index.mjs')], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let serverOutput = '';
  child.stdout.on('data', (d) => (serverOutput += d.toString()));
  child.stderr.on('data', (d) => (serverOutput += d.toString()));

  try {
    const up = await waitForServer();
    check(up, 'server starts and /api/session responds');
    if (!up) {
      console.log('--- server output ---');
      console.log(serverOutput);
      return;
    }

    // --- GET /api/session ---
    const sessionRes = await fetch(`${BASE}/api/session`);
    const session = await sessionRes.json();

    check(sessionRes.status === 200, 'GET /api/session returns 200');
    check(session.live === false, 'session.live === false with no API key');
    check(typeof session.fetchedAt === 'number', 'session.fetchedAt is a number');
    check(session.campaign === 'concierge-royal-york', 'session.campaign defaults to concierge-royal-york');
    check(typeof session.bookingLink === 'string' && session.bookingLink.includes('aid='), 'session.bookingLink carries aid tracking param');

    const property = session.property ?? {};
    check(
      typeof property.name === 'string' &&
        typeof property.type === 'string' &&
        typeof property.address === 'string' &&
        typeof property.rating === 'number' &&
        typeof property.reviewCount === 'number' &&
        typeof property.lat === 'number' &&
        typeof property.lng === 'number',
      'session.property has full core shape (name/type/address/rating/reviewCount/lat/lng)',
    );

    const market = session.market ?? {};
    check(
      typeof market.price === 'number' &&
        typeof market.currency === 'string' &&
        typeof market.nights === 'number' &&
        typeof market.checkin === 'string' &&
        typeof market.checkout === 'string' &&
        typeof market.supplierCount === 'number' &&
        Array.isArray(market.suppliers),
      'session.market has full core shape (price/currency/nights/checkin/checkout/supplierCount/suppliers)',
    );

    const policy = session.policy ?? {};
    check(
      typeof policy.freeCancellation === 'boolean' &&
        typeof policy.instantBooking === 'boolean' &&
        typeof policy.maxGuests === 'number',
      'session.policy has full core shape (freeCancellation/instantBooking/maxGuests)',
    );

    // --- POST /api/simulate-booking ---
    const simRes = await fetch(`${BASE}/api/simulate-booking`, { method: 'POST' });
    const simTxn = await simRes.json();
    check(simRes.status === 201, 'POST /api/simulate-booking returns 201');
    check(
      typeof simTxn.id === 'string' && simTxn.id.startsWith('sim-') && simTxn.simulated === true,
      'simulate-booking response is a sanitized simulated txn',
    );

    // --- GET /api/transactions ---
    const txRes = await fetch(`${BASE}/api/transactions`);
    const txns = await txRes.json();
    check(Array.isArray(txns), 'GET /api/transactions returns an array');
    const found = txns.find((t) => t.id === simTxn.id);
    check(!!found, '/api/transactions includes the simulated booking');
    if (found) {
      const keys = Object.keys(found).sort();
      check(
        keys.join(',') === 'at,campaign,id,simulated',
        `transaction is sanitized to exactly {id,campaign,at,simulated} (got: ${keys.join(',')})`,
      );
      check(found.simulated === true, 'sanitized transaction keeps simulated:true');
      check(found.campaign === 'concierge-royal-york', 'sanitized transaction carries the campaign id');
    }

    // A second simulate-booking should produce a distinct id (dedupe-by-id
    // relies on ids being unique).
    const simRes2 = await fetch(`${BASE}/api/simulate-booking`, { method: 'POST' });
    const simTxn2 = await simRes2.json();
    check(simTxn2.id !== simTxn.id, 'successive simulated bookings get distinct ids');
  } finally {
    child.kill('SIGTERM');
    await sleep(150);
  }
}

async function runClueUnitTests() {
  const { generateClues, generateFrontDesk } = await import('../src/stay22.js');
  const { getFallbackSession } = await import('../src/data/royal-york-fallback.js');

  function assertCluesShape(session, label) {
    const clues = generateClues(session);
    for (const key of ['A', 'B', 'C', 'D']) {
      const lines = clues[key];
      check(Array.isArray(lines) && lines.length > 0, `${label}: clues.${key} is a non-empty array`);
      for (const line of lines) {
        check(typeof line === 'string' && line.length > 0, `${label}: clues.${key} line is a non-empty string`);
        check(
          !/\bnull\b|\bundefined\b|\bNaN\b/i.test(line),
          `${label}: clues.${key} line has no null/undefined/NaN leakage ("${line}")`,
        );
      }
    }
    return clues;
  }

  function assertFrontDeskShape(session, label) {
    const questions = generateFrontDesk(session);
    check(Array.isArray(questions) && questions.length === 4, `${label}: frontDesk has exactly 4 questions`);
    const seenIds = new Set();
    for (const q of questions) {
      check(typeof q.id === 'string' && q.id.length > 0, `${label}: question has an id`);
      seenIds.add(q.id);
      check(typeof q.label === 'string' && q.label.length > 0, `${label}: question "${q.id}" has a label`);
      check(Array.isArray(q.options) && q.options.length === 4, `${label}: question "${q.id}" has exactly 4 options`);
      check(
        Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex < 4,
        `${label}: question "${q.id}" answerIndex is a valid 0..3 index`,
      );
      check(
        q.options[q.answerIndex] !== undefined && q.options[q.answerIndex] !== null,
        `${label}: question "${q.id}" answerIndex points at a real option`,
      );
      for (const opt of q.options) {
        check(
          typeof opt === 'string' && opt.length > 0 && !/\bnull\b|\bundefined\b|\bNaN\b/i.test(opt),
          `${label}: question "${q.id}" option is a clean non-empty string ("${opt}")`,
        );
      }
      // Options must be distinct or the puzzle would be unsolvable/ambiguous.
      check(new Set(q.options).size === q.options.length, `${label}: question "${q.id}" options are all distinct`);
    }
    check(seenIds.size === 4, `${label}: all 4 question ids are unique`);
    return questions;
  }

  // (a) full snapshot
  const fullSession = getFallbackSession();
  assertCluesShape(fullSession, 'full snapshot');
  assertFrontDeskShape(fullSession, 'full snapshot');

  // (b) snapshot with nulled policy/market/property fields
  const nulledSession = {
    ...fullSession,
    property: {
      ...fullSession.property,
      rating: null,
      reviewCount: null,
      stars: null,
    },
    market: {
      ...fullSession.market,
      price: null,
      currency: null,
      nights: null,
      supplierCount: null,
      suppliers: null,
    },
    policy: {
      ...fullSession.policy,
      freeCancellation: null,
      instantBooking: null,
      maxGuests: null,
    },
  };
  assertCluesShape(nulledSession, 'nulled snapshot');
  assertFrontDeskShape(nulledSession, 'nulled snapshot');

  // Fully empty session object — no puzzle may crash even with nothing at all.
  let threw = false;
  try {
    assertCluesShape({}, 'empty session');
    assertFrontDeskShape({}, 'empty session');
  } catch (err) {
    threw = true;
    console.log('FAIL empty session threw:', err);
  }
  check(!threw, 'empty session ({}) does not throw for clues/frontDesk generation');

  // Regression: edge cases where decoys could collide with correct answer.
  // Rating = 10: decoyMid would clamp to 10 (collision). Rating = 0: decoyLow
  // and decoyHigh both clamp to 0 (collision). finishQuestion must handle this.
  const edgeSession10 = {
    ...fullSession,
    property: { ...fullSession.property, rating: 10 },
  };
  assertFrontDeskShape(edgeSession10, 'rating=10 edge case');

  const edgeSession0 = {
    ...fullSession,
    property: { ...fullSession.property, rating: 0 },
  };
  assertFrontDeskShape(edgeSession0, 'rating=0 edge case');

  // Also test with max stars if applicable.
  const edgeSessionMaxStars = {
    ...fullSession,
    property: {
      ...fullSession.property,
      rating: 10,
      stars: 5,
    },
  };
  assertFrontDeskShape(edgeSessionMaxStars, 'rating=10, stars=5 edge case');
}

await runServerChecks();
await runClueUnitTests();

console.log(`\n${failures === 0 ? 'ALL OK' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
