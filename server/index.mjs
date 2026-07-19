// Plain node http server for the Stay22 layer. No npm dependencies — node
// built-ins only. Serves /api/session, /api/transactions and
// /api/simulate-booking; vite.config.js proxies /api to this server in dev.
import { createServer } from 'node:http';
import { loadEnv } from './env.mjs';
import { getFallbackSession, DEFAULT_CAMPAIGN } from '../src/data/royal-york-fallback.js';
import { fetchLiveSession, fetchLiveTransactions } from './stay22-api.mjs';

loadEnv();

const PORT = Number(process.env.STAY22_SERVER_PORT || process.env.PORT || 8787);
const CAMPAIGN = process.env.STAY22_CAMPAIGN_ID || DEFAULT_CAMPAIGN;
const API_KEY = process.env.STAY22_API_KEY || '';
const CACHE_TTL_MS = 5 * 60 * 1000; // Stay22 short-lived caching rule.

let sessionCache = { data: null, expiresAt: 0 };
const simulatedTransactions = [];
let simCounter = 0;

async function resolveSession() {
  const now = Date.now();
  if (sessionCache.data && sessionCache.expiresAt > now) return sessionCache.data;

  let session = null;
  if (API_KEY) {
    try {
      session = await fetchLiveSession({ apiKey: API_KEY, campaign: CAMPAIGN });
    } catch {
      session = null;
    }
  }
  if (!session) session = getFallbackSession(CAMPAIGN);

  sessionCache = { data: session, expiresAt: now + CACHE_TTL_MS };
  return session;
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'access-control-allow-origin': '*',
  });
  res.end(payload);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'access-control-allow-headers': 'content-type',
      });
      res.end();
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/session') {
      const session = await resolveSession();
      sendJson(res, 200, session);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/transactions') {
      // Never forward commission/dates/destination/device/booking ids beyond
      // an opaque id — fetchLiveTransactions already returns the sanitized
      // {id, campaign, at, simulated:false} shape.
      let real = [];
      if (API_KEY) {
        try {
          real = await fetchLiveTransactions({ apiKey: API_KEY, campaign: CAMPAIGN });
        } catch {
          real = [];
        }
      }
      sendJson(res, 200, [...real, ...simulatedTransactions]);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/simulate-booking') {
      simCounter += 1;
      const txn = {
        id: `sim-${simCounter}`,
        campaign: CAMPAIGN,
        at: new Date().toISOString(),
        simulated: true,
      };
      simulatedTransactions.push(txn);
      sendJson(res, 201, txn);
      return;
    }

    sendJson(res, 404, { error: 'not found' });
  } catch (err) {
    sendJson(res, 500, { error: 'internal error', message: String(err?.message ?? err) });
  }
});

server.listen(PORT, () => {
  console.log(
    `[stay22] server listening on http://localhost:${PORT} (${API_KEY ? 'live key present' : 'fallback-only, no key'})`,
  );
});

export { server };
