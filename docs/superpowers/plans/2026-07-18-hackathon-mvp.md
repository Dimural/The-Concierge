# The Concierge — Hackathon MVP Implementation Plan

Source spec: `the-concierge-hackathon-development-plan(1).md` (product plan). This file turns it
into 6 engineering tasks. Tasks 1–4 are parallel-safe: each owns a disjoint set of files.
Task 5 integrates. Task 6 verifies/polishes.

## Global Constraints

- Only hotel: **Fairmont Royal York, Toronto** (100 Front St W, Toronto, ON M5J 1E3; lat 43.6455, lng -79.3806).
- Preserve the existing map, movement, hiding (prone under hide volumes → `player.concealed`), and entity visuals (stop-motion decayed concierge, hands over eyes).
- Vanilla JS + three.js + Vite. **No new npm runtime dependencies.** Node built-ins only for the server.
- Units are feet. Mezzanine y=0, Convention floor y=-26. Player eye height 5.4.
- All Stay22/Presage code must work with NO api key (labelled fallback/simulated mode) and be ready for a key drop-in via `.env` (`STAY22_API_KEY`, `STAY22_CAMPAIGN_ID`, `PRESAGE_API_KEY`). Keys never reach the browser; never expose raw transaction fields to the client (only `{id, campaign, at}` sanitized).
- Player-facing booking language: "A new reservation has appeared in the hotel ledger" — never "someone booked this hotel somewhere on the internet."
- Never instruct the player to hold their breath. Not a medical product; no health claims.
- Consent required before any camera/mic capture; reduced-input mode must keep the game fully playable.
- Horror layer labelled fictional; affiliate link disclosed as affiliate.
- Commit style: small frequent commits on `main` (user-authorized), imperative subject lines.

## File ownership (parallel safety — HARD RULE)

| Task | Owns (create/edit) | Must NOT touch |
|---|---|---|
| 1 Entity | `src/ghost.js`, `src/noise.js` (new), `src/main.js` (minimal wiring only), `scripts/smoke-entity.mjs` (new) | `src/game/*`, `src/presage/*`, `src/stay22*`, `server/*`, `index.html`, `src/ui.js` |
| 2 Stay22 | `server/*` (new), `src/stay22.js` (new), `src/data/royal-york-fallback.js` (new), `vite.config.js` (new), `.env.example` (new), `package.json` scripts only, `scripts/smoke-stay22.mjs` (new) | everything else |
| 3 Presage | `src/presage/*` (new dir, incl. its own injected CSS) | everything else |
| 4 Game loop | `src/game/*` (new dir, incl. its own injected CSS + sfx module) | everything else |
| 5 Integration | `src/main.js`, `index.html`, `src/ui.js`, `src/audio.js`, `src/lights.js`, small fixes anywhere | — |
| 6 Verify/polish | `README-4.md`→`README.md`, `docs/demo-script.md`, `scripts/*`, small fixes anywhere | — |

## Shared contracts (all tasks code against these exactly)

### Noise bus — `src/noise.js` (Task 1 creates)

```js
export const noiseBus = {
  emit(x, z, loudness, kind) {},   // loudness 0..1.5; kind: 'footstep'|'run'|'land'|'talk'|'generator'|'door'|'misc'
  subscribe(fn) { /* fn({x, z, loudness, kind}) */ return unsubscribe; },
};
```

### Entity API — `src/ghost.js` (Task 1 rewrites behaviour, keeps visuals)

```js
createGhost(scene, colliders) => {
  object,                       // THREE.Group
  state,                        // getter: 'patrol'|'suspicious'|'pursuit'|'hunt'|'cooldown'|'finalHunt'|'exorcised'
  alertness,                    // getter 0..1
  eyesOpen,                     // getter bool
  update(dt, player),           // player: { pos: Vector3 (feet), concealed: bool }
  applySignals({talking, talkingConfidence, breathingIntensity, breathingConfidence}), // each frame; low confidence → reduced/no influence
  triggerNewArrival(durationSec = 15),  // eyes-open hunt then cooldown
  triggerShortHunt(durationSec = 8),    // wrong front-desk submission
  startFinalHunt(),             // sight+sound until exorcise() — no cooldown
  exorcise(),                   // freeze/remove entity
  onCatch: null,                // set by integrator; called once when entity catches player
}
```

Behaviour: patrol = existing wander on node graph. Noise events raise alertness & set an
investigate target (approach general area, not exact point). Sustained talking or loud noise
(>0.6) → pursuit (fast move to last-heard region, still blind). Eyes-open modes: hands move off
eyes (animate arms/hands away; keep the stop-motion aesthetic), speed ×1.7, line-of-sight check
(segment vs collider AABBs) sees player within 90ft unless `player.concealed`; on sight, chase
directly (axis-slide collision like Player.moveAxis, radius 1.0). Catch: dist < 3.0 && (!player.concealed || eyesOpen-and-had-LOS). While blind, a concealed player is never caught.
Cooldown ≈ 10s predictable walk back toward nearest node. During hunts the entity may leave the
node graph; after, snap-path to nearest node. Breathing: `breathingIntensity` (0..1) with
confidence ≥ 0.5 gradually raises alertness (never instant kill). Talking with confidence ≥ 0.5
= strong awareness event at player position.

### Stay22 client — `src/stay22.js` (Task 2 creates)

```js
export async function createSession() => Session
// Session = {
//   live: bool, fetchedAt,
//   property: { name, type, address, city, rating, reviewCount, stars, lat, lng },
//   market: { price, currency, nights, checkin, checkout, supplierCount, suppliers: [string] },
//   policy: { freeCancellation: bool|null, instantBooking: bool|null, maxGuests: number|null },
//   campaign,                    // e.g. 'concierge-royal-york'
//   bookingLink,                 // tracked Stay22 deeplink w/ campaign
//   clues: { A: [..], B: [..], C: [..], D: [..] },   // display strings per generator
//   frontDesk: [ { id, label, options: [4 strings], answerIndex } ],  // 4 questions
// }
export function startTransactionWatcher({ onNewArrival, intervalMs = 15000 }) => stop()
export async function simulateBooking() // POST /api/simulate-booking; watcher will pick it up on next poll (poll fast after simulate)
```

Client hits `/api/session`; on network failure falls back to bundled
`src/data/royal-york-fallback.js` snapshot (marks `live:false`) so `npm run dev` alone works.
Clue/question generation runs client-side from the session fields with fallback templates when a
field is null (no puzzle may depend on a missing value). frontDesk questions cover: hotel
identity, guest rating, supplier count, one rate-or-policy fact.

Server `server/index.mjs` (plain node http, port 8787, tiny `.env` parser, no deps):
- `GET /api/session` → with `STAY22_API_KEY`: call Stay22 Direct Travel API accommodations
  search (lat/lng 43.6455,-79.3806, radius small, match "Royal York"), 2-night stay ~30 days out,
  map to Session core fields, `live:true`. Without key or on error: fallback snapshot JSON,
  `live:false`. Cache in memory 5 min (Stay22 short-lived caching rule).
- `GET /api/transactions` → with key: Stay22 reporting transactions endpoint filtered to
  campaign; sanitize to `[{id, campaign, at, simulated:false}]`. Always append in-memory
  simulated ones. Never forward commission/dates/device/etc.
- `POST /api/simulate-booking` → push `{id:'sim-'+n, campaign, at, simulated:true}`.
- `vite.config.js`: proxy `/api` → `http://localhost:8787`.
- package.json scripts: `"server": "node server/index.mjs"`, `"dev:all": "node scripts/dev-all.mjs"` (spawns vite + server).

### Presage adapter — `src/presage/index.js` (Task 3 creates)

```js
export function createPresage() => {
  requestConsent(container) => Promise<'granted'|'reduced'>, // in-fiction consent modal, full disclosures, reduced-input choice
  calibrate(container) => Promise<{ok, faceVisible, lighting, baseline}>, // "GUEST BIOMETRIC REGISTRATION" security-cam styled screen w/ live camera preview
  start(), stop(),
  mode,      // 'presage' | 'fallback' | 'reduced'
  signals,   // live getters: { talking, talkingConfidence, breathingIntensity, breathingConfidence, pulseBpm, faceVisible }
  setSimulated({talking?, breathingIntensity?}) // judge-panel override hooks
}
```

- Fallback engine (always works, no key): getUserMedia audio → RMS+speech-band energy with
  hysteresis → talking (confidence from SNR). Video → 32×24 downscale luminance temporal-diff in
  lower half → breathingIntensity proxy, low confidence, smoothed; face-presence heuristic
  (center-region variance). All processing local; nothing recorded or uploaded; camera-active
  indicator dot whenever capture runs.
- Presage engine: if `PRESAGE_API_KEY` present (served to client as boolean flag via
  `/api/config`... Task 3 must NOT depend on server: read `import.meta.env.VITE_PRESAGE_ENABLED`
  or probe a `window.__PRESAGE_KEY_PRESENT` flag set by integration; structure
  `src/presage/smartspectra.js` so the SmartSpectra Web/REST hookup is one clearly marked
  function with the official endpoints, and gracefully falls back when unavailable.
- Reduced mode: no capture at all; signals all zero/confidence 0; game stays playable.
- Never tell the player to hold breath. Copy: reward stillness/quiet.

### Game module — `src/game/index.js` (Task 4 creates)

```js
export function createGame({ scene, floors, colliders, player, camera }) => {
  attachSession(session),            // called by integrator when Stay22 session ready
  attachPresage(presage),            // for HUD capture indicator + judge panel display
  attachGhost(ghost),                // game reads ghost.state/eyesOpen for HUD; calls trigger APIs
  start(),                           // begins arrival sequence (intro text overlay)
  update(dt),                        // per-frame: interactions, objectives, HUD
  onNewArrival(txn),                 // full event chain: banner+bell hooks+ghost.triggerNewArrival(15)
  interact(),                        // E pressed
  state,                             // 'arrival'|'explore'|'desk'|'finalHunt'|'won'|'lost'
  onSound: null,                     // ({x,z,loudness,kind}) set by integrator → noiseBus.emit
  onBell: null, onGeneratorSound: null, // audio hooks wired in Task 5 (game/sfx.js provides interim WebAudio)
  handleCatch(),                     // lose screen + retry (respawn, progress kept)
}
```

World objects (own dir `src/game/`): 4 Archive Generators (distinct machine meshes, screen
glow, lever): A "Property Registry" → Reservation Office (mezz), B "Guest Ledger" → Library
(mezz), C "Rate Engine" → Concert Hall (conv), D "Reservation Rules" → Ballroom (conv). Place at
room centers via `floors[].rooms` lookup by name (room = {name,x,z,w,d,h}, floor.y). Front desk:
corridor B mezzanine at (140, 0, 118), a curved reception desk w/ corrupted ledger. Exit: 'To
Garage (passage)' room door glows after identity restored.

Loop: arrival text → explore (HUD objective + journal `Tab`, generators: hold E 2.5s, big noise
`onSound(...,1.2,'generator')`, environment flicker, clue added w/ typewriter reveal) → all 4 →
desk prompt → desk DOM form (4 questions from session.frontDesk, select answers, in-fiction
ledger styling) → correct: "PROPERTY IDENTITY RESTORED / UNREGISTERED OCCUPANT DETECTED / FINAL
CHECKOUT AUTHORIZED" → ghost.startFinalHunt(), exit unlocked → reach exit → win screen (real
property card, tracked booking link labelled affiliate, "THE NIGHTMARE WAS FICTIONAL. THE HOTEL
IS REAL." + fictional disclaimer). Wrong: bell + ghost.triggerShortHunt(8); if
`policy.freeCancellation` one free retry (say so in copy). Lose (caught): "CHECKED IN
PERMANENTLY?" screen, RETRY respawns at SPAWN keeping generator progress.

Judge panel (backquote key, clearly out-of-fiction): session live/fallback badge, presage mode +
live signal meters, entity state, buttons: Simulate Booking (labelled SIMULATED), Force New
Arrival, Complete All Generators, Skip To Desk, Win. Exposes `window.__judge`.

New Arrival chain inside game: freeze beat → bell (hook) → banner "A NEW RESERVATION HAS ENTERED
THE LEDGER / THE CONCIERGE CAN SEE" → lights-flicker hook `onLightsFlicker` → ghost.triggerNewArrival(15) → cooldown message. Dedupe by txn id (game keeps Set).

## Tasks

### Task 1 — Entity senses & two-mode behaviour
Rewrite `src/ghost.js` behaviour per Entity API contract (keep ALL current visual construction
and stop-motion animation code). Create `src/noise.js`. Minimal `src/main.js` edits: pass
colliders to createGhost, pass `{pos, concealed}` player view to update, emit noise from
player footsteps/landing (wrap existing onFootstep/onLand), `window.__concierge.noiseBus`.
Node smoke test `scripts/smoke-entity.mjs` (import ghost module? it needs DOM/three — instead
test pure helpers: extract LOS segment-AABB + alertness state machine into exported pure
functions and test those). Manual test API documented in file header.

### Task 2 — Stay22 layer (server + client + fallback + clues)
Per Stay22 contract above. Fallback snapshot uses realistic Fairmont Royal York values (name,
4-star-equivalent luxury, rating ≈ 8.8/10, reviewCount ≈ 9400, 4 suppliers
[Booking.com, Expedia, Hotels.com, Vrbo], price CAD ~1050 total 2 nights, freeCancellation
true, instantBooking true, maxGuests 4) clearly marked `live:false`. Clue text written in the
game's corrupted-ledger voice. `scripts/smoke-stay22.mjs`: starts server w/o key, asserts
/api/session shape, simulate-booking → transactions contains it, session field→clue generation
handles nulls (import clue fn directly).

### Task 3 — Presage adapter (consent, calibration, signals)
Per Presage contract above. Self-contained DOM (injects own styles). Consent copy: what signals,
not medical, nothing stored/uploaded in fallback mode, reduced-input option button. Calibration:
security-camera framed video preview, grain overlay, status lines (FACE SIGNAL / RESPIRATION
FIELD / ILLUMINATION), fiction copy "Please remain visible while the hotel learns how to find
you.", continue when ok or "PROCEED UNREGISTERED" (reduced). Camera-active indicator element
exported for HUD reuse.

### Task 4 — Game loop, world objects, HUD & screens
Per Game contract above. Own sfx via `src/game/sfx.js` (lazy AudioContext): generator hum/clunk,
desk bell, ui ticks — integrator may later swap. All DOM injected from JS w/ own CSS
(Special Elite / palette vars consistent with index.html).

### Task 5 — Integration
Wire everything in `src/main.js` + `index.html` + `src/ui.js`:
case board click → presage.requestConsent → calibrate → enterGame → game.start().
Frame loop: presage → ghost.applySignals; talking also noiseBus.emit at player pos; game.update;
ghost.update; catch → game.handleCatch. createSession() at case-select time (parallel with
consent); game.attachSession. startTransactionWatcher → game.onNewArrival. Judge panel buttons →
stay22.simulateBooking / direct triggers. game.onSound → noiseBus. Bell/flicker hooks →
`src/audio.js` new `bell()`, `printer()`; `src/lights.js` add `flicker(sec)`. Pause overlay keys
line updated (E interact, Tab journal, ` judge). Overlay must not fight game DOM screens
(pointer-unlock during desk form = intentional: suspend overlay while game.state==='desk' or a
DOM screen is open). Kill dead code. `npm run build` must pass.

### Task 6 — Verify & polish
`npm run build`, `npm run check:physics`, `npm run check:layout`, smoke scripts; puppeteer
screenshot run of full flow (landing → consent(reduced) → gameplay HUD → judge panel New
Arrival) added as `scripts/shots-flow.mjs`; write `docs/demo-script.md` (3–4 min judge flow per
plan §13, honest live-vs-simulated language); rewrite `README-4.md` → `README.md` (setup, .env
key drop-in, scripts, architecture map, disclosures). Fix anything found.

## Success criteria (from product plan §15)
Judge-visible: concept in 30s; ≥2 Stay22 fields visibly affect gameplay; Stay22 info required to
win; New Arrival flips entity blind→sighted; talking visibly affects entity; one fair
breathing effect; playable at low confidence; complete beginning→objective→climax→ending;
booking path clear, optional; team can say what's live vs simulated.
