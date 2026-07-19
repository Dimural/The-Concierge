// Real SmartSpectra (Presage Technologies) integration point.
//
// This file is the ONE place a production SmartSpectra hookup would live.
// Everything else in src/presage/ talks to the local fallback engine
// (dsp.js + engine.js); this module is only ever consulted first, and only
// ever "activates" when the integrator has actually provisioned a key.
//
// ---- What SmartSpectra actually is (per https://smartspectra.presagetech.com/
// and https://smartspectra.presagetech.com/docs/data-types/, fetched while
// building this module) ------------------------------------------------
//
// SmartSpectra is Presage Technologies' camera-based vital-signs SDK: it
// turns an ordinary webcam/phone camera into a contactless sensor for:
//   - pulse_rate (repeated MeasurementWithConfidence, ~40-110 BPM, each
//     with a confidence percentage 0-100%)
//   - hrv { rmssd, mean_nn, sdnn, baevsky } heart-rate-variability metrics
//   - arterial_pressure_trace (uncalibrated, unitless waveform shape)
//   - breathing.rate (~5-40 breaths/min), breathing.upper_trace /
//     lower_trace, amplitude, apnea, inhale_exhale_ratio
//   - face metrics: talking / blinking (DetectionStatus booleans with
//     timestamps), 478-point facial landmarks, 8-way expression scores
//   - electrodermal activity trace (needs 35s+ of processing to start)
// Every measurement carries `stable` (bool) and `confidence` (0-100%).
// It explicitly ships as first-party SDKs for Android (Kotlin), Swift
// (iOS 17+), C++17, and Node.js (18+) / Electron (28+) — there is no
// first-party in-browser JavaScript SDK at time of writing. It is
// explicitly NOT FDA-cleared and is documented as for general wellness /
// informational purposes only, never diagnosis or treatment — which lines
// up with this game's own "not a medical product" requirement.
//
// ---- Why this function still returns null in this build ---------------
//
// Task 3 is a browser-only module and (per the shared project contract)
// must not depend on a server of its own. A real production integration
// for this Vite/three.js game would run the official Node.js SmartSpectra
// SDK behind a small relay (the same pattern as server/index.mjs for
// Stay22) and stream `pulse_rate`/`breathing`/`talking` down to the
// browser over WebSocket or a polled REST endpoint, authenticated with
// PRESAGE_API_KEY kept server-side (never shipped to the client — same
// rule as the Stay22 keys). Until that relay exists, this function has
// nothing real to call, so it always fails closed to the local fallback
// engine — which is the correct, honest behavior, not a placeholder bug.
//
// ---- How to wire in a real key ----------------------------------------
//
// 1. Set `window.__PRESAGE_KEY_PRESENT = true` from the integrator once a
//    server-side relay exists (or set `VITE_PRESAGE_ENABLED=true` and
//    `VITE_PRESAGE_REST_ENDPOINT=<relay URL>` in `.env` and read them via
//    `import.meta.env` — both are already checked by `isPresageKeyPresent`
//    / `connectSmartSpectra` below).
// 2. Replace the `fetch(...)` stub in `connectSmartSpectra` with a real
//    call into your relay (or a WebSocket handshake), mapping the
//    `pulse_rate` / `breathing.rate` / `talking` fields documented above
//    onto this module's `{ talking, talkingConfidence, breathingIntensity,
//    breathingConfidence, pulseBpm, faceVisible }` shape.
// 3. `createPresage()` in index.js will automatically prefer this session
//    over the local fallback engine whenever `connectSmartSpectra` resolves
//    to a non-null session, and mode becomes 'presage'.

/**
 * True when an integrator has indicated a real SmartSpectra key/relay is
 * available. Checked lazily (never at import time) so this module stays
 * node-importable with no `window`/`import.meta.env` access at load time.
 */
export function isPresageKeyPresent() {
  try {
    if (typeof window !== 'undefined' && window.__PRESAGE_KEY_PRESENT === true) {
      return true;
    }
  } catch {
    /* ignore */
  }
  try {
    // Vite replaces import.meta.env.* at build time; guarded for Node.
    if (typeof import.meta !== 'undefined' && import.meta && import.meta.env) {
      return import.meta.env.VITE_PRESAGE_ENABLED === 'true' || import.meta.env.VITE_PRESAGE_ENABLED === true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Attempt to connect to a real SmartSpectra-backed data source.
 *
 * Resolves to `null` whenever no key/relay is configured, or on any
 * connection failure — callers must treat `null` as "use the local
 * fallback engine instead" and never throw for a missing key.
 *
 * On success would resolve to a session object:
 *   { close(), onSample(fn) } // fn receives the mapped signal shape
 * (left unimplemented pending a real relay — see module comment above).
 */
export async function connectSmartSpectra() {
  if (!isPresageKeyPresent()) return null;

  let endpoint = null;
  try {
    endpoint =
      (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PRESAGE_REST_ENDPOINT) || null;
  } catch {
    endpoint = null;
  }

  if (!endpoint) {
    console.warn(
      '[presage] __PRESAGE_KEY_PRESENT/VITE_PRESAGE_ENABLED is set but no VITE_PRESAGE_REST_ENDPOINT relay ' +
        'is configured — falling back to the local heuristic engine. See src/presage/smartspectra.js.'
    );
    return null;
  }

  // ==========================================================================
  // REAL INTEGRATION POINT — replace this stub with a real relay call.
  // ==========================================================================
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insightType: 'combined' }),
    });
    if (!res || !res.ok) return null;
    // A real relay would return something mappable to our signal shape, and
    // this module would open a stream/poll loop and return a session with
    // onSample()/close(). No relay exists in this build, so — even on a
    // structurally "successful" response — we deliberately fall back here
    // rather than guess a payload shape that doesn't exist yet.
    return null;
  } catch (err) {
    console.warn('[presage] SmartSpectra relay unreachable, using local fallback engine.', err);
    return null;
  }
}
