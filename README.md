# The Concierge

**The Concierge is a first-person horror game where players enter corrupted versions of real hotels, use live Stay22 booking data to restore each hotel's identity, and survive an entity that can hear their talking and breathing through camera-based biometrics—while attributed Stay22 bookings cause the entity to uncover its eyes and hunt.**

Most hotel products show the same listing cards in the same way. This project turns live accommodation data into a playable experience: a carefully corrupted 3D recreation of a real property, mysterious clues derived from current booking rates and supplier records, and a blind entity that listens to your voice and breathing patterns. Survive, restore the hotel's real identity at the front desk, and escape during a final hunt—then optionally book the actual property through a disclosed affiliate link.

**30-second pitch:** Everyone can build a hotel search. We built a hotel you can enter. Stay22's inventory becomes the mystery; its booking links monetize the experience; its transaction ledger changes the monster live. Presage makes the player's own physiology part of the stealth system.

## Quick Start

### Zero-config demo
```bash
npm install
npm run dev:all
```

Open http://localhost:5173 in your browser. The game runs entirely in **fallback/simulated mode**:
- Stay22 property data comes from a bundled snapshot (honest label: `live: false`).
- Presage biometrics use only your camera and microphone with local heuristics—nothing is recorded or uploaded.
- Booking events are labeled `SIMULATED` when you trigger them.

**Everything works without any API keys.**

### Live mode (Stay22 + Presage)

Drop keys into `.env`:
```
STAY22_API_KEY=your_key_here
STAY22_CAMPAIGN_ID=your_campaign_id
PRESAGE_API_KEY=your_presage_key
```

Then `npm run dev:all`. The game will:
- Fetch live Fairmont Royal York property data (name, rating, suppliers, prices, policies) from Stay22.
- Use SmartSpectra for real physiological detection if the Presage key is valid; otherwise fall back to local heuristics.
- Detect real attributed bookings and trigger live monster hunts.

**Why keys never reach the browser:** The Stay22 API server runs on Node (`npm run server` or `npm run dev:all`), handles all Stay22 requests, and only sends sanitized session data and transaction IDs to the client. The Presage key is used server-side only to provision the session; the browser uses only local capture processing or the official SmartSpectra SDK if available.

**Optional single script:**
```bash
npm run dev       # Vite dev server only (no server); falls back for Stay22/Presage
npm run server    # Stay22 API server only (listens on :8787, default)
npm run dev:all   # Both in parallel (Vite + server)
```

## Controls

| Key | Action |
|---|---|
| **WASD** | Move forward/back/strafe |
| **Shift** | Run |
| **Space** | Jump |
| **C** or **Ctrl** | Crouch / go prone (hide) |
| **E** | Interact (activate generators, submit front-desk answers) |
| **Tab** | Open journal (view clues) |
| **`` ` `` (Backquote)** | Judge panel (out-of-fiction diagnostics) |
| **Mouse** | Look around (pointer lock while in-game) |

## Architecture Map

| Module | Purpose |
|---|---|
| `server/index.mjs` | Stay22 API proxy + transaction polling. Runs on :8787; handles all credential/key access. Vite proxies `/api` to this. |
| `src/stay22.js` | Client-side session creation, clue/question generation, and transaction watcher. Fetches from `/api/session`, falls back to bundled snapshot on any network error. |
| `src/data/royal-york-fallback.js` | Bundled Fairmont Royal York snapshot (rating ~8.8, 4 suppliers, ~$1050 CAD/2 nights). Used when no key or server unavailable. Clearly marked `live: false`. |
| `src/presage/` | Consent, calibration, and live physiological signal processing. Three modes: real SmartSpectra (`presage`), local getUserMedia heuristics (`fallback`), or zero-capture (`reduced`). Always processes locally; nothing recorded or uploaded in fallback mode. |
| `src/game/` | Game loop, world objects (4 Archive Generators), front-desk puzzle, HUD, screens, and judge panel. Reads ghost state + presage signals; drives entity and game progression. |
| `src/ghost.js` | The entity: start-motion animated Concierge with two sight modes (blind/hunt). Reacts to talking, breathing, and noise via the noiseBus. Controlled by in-world events (generators, bookings, final checkout). |
| `src/noise.js` | Event emitter for in-world sound: footsteps, running, landing, talking, generators, doors. Entity subscribes to this to determine alertness and investigation targets. |
| `src/main.js` | Scene setup, three.js renderer, player controller, integration hub. Wires Presage → ghost signals, game state, Stay22 session, transaction watcher. |
| `.env.example` | Template for API keys and server port. Copy to `.env` and fill in keys. Defaults ensure fallback mode works with no `.env` at all. |
| `vite.config.js` | Proxy `/api` requests to the Stay22 server; dev server on :5173. |
| `package.json` | Build scripts, dev dependencies (Vite, Puppeteer). No runtime npm dependencies except three.js. |

## Gameplay: How Stay22 Data and Presage Biometrics Affect Play

### Stay22 Session Creation
When you enter the game, it fetches a real Fairmont Royal York property snapshot from the Stay22 Direct Travel API (or falls back to the bundled snapshot). This session is **locked for the duration of your playthrough** so that live price changes do not invalidate your puzzle answers. The session contains:
- **Property:** Name, type, address, rating, review count, star classification
- **Market:** Current 2-night total price, number of active suppliers, supplier names
- **Policy:** Free-cancellation status, instant-booking status, guest capacity

### Archive Generators
Four machines scattered around the hotel. Activate each one (hold E for ~2.5 seconds) to restore a category of real Stay22 data. Each generator:
1. **Makes noise** that attracts the entity (if it can't see).
2. **Reveals a clue** derived from the locked session data (corrupted-ledger voice).
3. **Alters the environment** visually (signs restore, room markers appear, etc.).

The four generators:
- **A — Property Registry (Mezzanine):** Hotel name, type, location. Clues: "THE LEDGER REMEMBERS A NAME: THE FAIRMONT ROYAL YORK."
- **B — Guest Ledger (Mezzanine):** Guest rating and review count. Clues: "GUESTS RATED THIS PLACE 8.8 OUT OF 10."
- **C — Rate Engine (Convention Floor):** 2-night price and supplier count. Clues: "2 NIGHTS BILLED AT $1050 CAD."
- **D — Reservation Rules (Convention Floor):** Cancellation policy, booking method, occupancy limit. Clues: "FREE CANCELLATION. INSTANT BOOKING. OCCUPANCY CEILING: 4."

### Entity Behaviour and Presage Integration
The Concierge starts with **both hands covering its eyes** — it cannot see. It hunts purely by sound:
- **Talking** (detected via Presage or fallback audio heuristics): Strong awareness spike. The entity moves toward your position.
- **Breathing intensity** (detected via Presage or fallback video temporal-diff): Gradual alertness increase when elevated or unstable. Rewards calmness, does not punish normal breathing.
- **Footsteps and running:** In-world noise events that raise suspicion.
- **Generator activation:** Loud noise that brings the entity investigating.

**Presage modes:**
- `presage` — Real SmartSpectra SDK (if `PRESAGE_API_KEY` provided and available). Camera-based talking, breathing, facial, and pulse detection with confidence metrics.
- `fallback` — Local getUserMedia processing (always available, no key). Microphone RMS + speech-band energy → talking detection. Video temporal-diff in lower half + center-region face heuristic → breathing proxy. Low confidence, smoothed, safe. **Nothing recorded or uploaded.**
- `reduced` — Player chooses "PROCEED UNREGISTERED" at consent. Zero capture; signals all zero with confidence 0. Game remains fully playable.

### New Arrival: Live Booking Event
When a real attributed bookings appears in the Stay22 transaction ledger (or you simulate one), the entity's behaviour flips:
1. A reception bell rings.
2. A banner appears: "A NEW RESERVATION HAS ENTERED THE LEDGER / THE CONCIERGE CAN SEE"
3. Lights flicker.
4. **The entity uncovers its eyes** and gains **visual line-of-sight detection** for ~15 seconds.
5. It moves faster (1.7× speed) and hunts directly.
6. You must hide, close doors, break line of sight, or run to the exit.
7. After ~15 seconds, the entity covers its eyes again and enters a brief cooldown.

**Simulated bookings** (for judging and demo purposes) trigger the exact same gameplay event but are clearly labelled `SIMULATED` in the judge panel. Real attributed bookings follow the same chain.

### Front-Desk Reconstruction
After activating all 4 generators, return to the front desk (a curved reception counter on the Mezzanine). A corrupted property record awaits. You must submit **4 answers** derived from the clues you've gathered:
1. **Hotel identity** — Select the correct hotel name.
2. **Guest rating** — Choose the correct rating (e.g., "8.8 / 10").
3. **Supplier count** — Enter how many booking channels feed this room (e.g., "4").
4. **Policy** — Identify the cancellation + booking method rule.

**Correct submission:**
- "PROPERTY IDENTITY RESTORED / UNREGISTERED OCCUPANT DETECTED / FINAL CHECKOUT AUTHORIZED"
- The exit glows and unlocks.
- You must now reach the exit while the entity hunts with both sight and sound for the final time.

**Incorrect submission:**
- The desk bell rings.
- The entity gains sight for a short (~8 second) hunt.
- If the session's policy includes free cancellation, you get **one free retry** (on correct submission, the same message confirms this).
- Otherwise, an incorrect answer puts you in immediate danger.

### Escape and Victory
Reach the unlocked exit while the entity hunts. Once you leave:
- The corrupted hotel fades away.
- You see a clean real-property card with the Fairmont Royal York's name, address, and rating.
- An optional **Stay22 tracked booking link** is displayed with a clear affiliate disclosure.
- Final message: "THE NIGHTMARE WAS FICTIONAL. THE HOTEL IS REAL. YOU RESTORED ITS NAME."

## Consent, Privacy & Disclosures

### Before Gameplay: Consent
You must actively consent to camera and microphone use before the game begins. The consent screen clearly explains:
- **What signals** the game detects: talking (via microphone/camera), breathing (via camera), facial expressions (via camera), and optional pulse (via camera).
- **This is not a medical product.** Measurements are for gameplay and entertainment only. No health diagnoses or claims.
- **Reduced-input mode:** If you don't want to use camera/mic, select "PROCEED UNREGISTERED" to play without any biometric capture. The game remains fully playable.
- **Camera recording policy:** In fallback mode, no raw video or audio is recorded or uploaded. In Presage mode, processing happens according to the official SmartSpectra terms.

### Calibration
A darkened "GUEST BIOMETRIC REGISTRATION" screen confirms camera lighting, face visibility, and breathing signal quality before gameplay. Status indicators show:
- **FACE SIGNAL:** Whether a face is visible in the frame.
- **RESPIRATION FIELD:** Camera-detected breathing motion intensity.
- **ILLUMINATION:** Ambient lighting adequacy.

You are never asked to hold your breath or restrict normal breathing. The game rewards calmness and quiet, not unsafe physiology.

### Stay22 Booking Transparency
- **Booking links are affiliate links.** They carry a campaign ID so Stay22 can attribute the booking back to this experience. You'll earn a commission on eligible bookings.
- **Booking is optional and does not affect gameplay.** You can win the game without ever clicking a booking link.
- **No private transaction data is exposed to you or the game client.** The server only sends sanitized event notifications ("new arrival") with a transaction ID and campaign, not dates, pricing, or customer details.
- **Real bookings vs. simulated bookings:** During judging or testing, you can trigger a labelled `SIMULATED` booking event via the judge panel to test the entity's hunt behavior without waiting for a real Stay22 transaction. The game clearly distinguishes between the two.

### Horror Disclaimer
**The entity, the corrupted hotel, and all supernatural events are fictional.** The Fairmont Royal York is a real, safe, well-reviewed hotel. The game is a creative entertainment layer on top of real Stay22 property data. No implication of actual hauntings, danger, or problems with the property.

### Camera and Biometric Data
- **Local processing in fallback mode:** Your camera and microphone feeds are processed only on your device in real-time. No recording. No upload. No persistent storage.
- **Presage/SmartSpectra mode:** If you provide a Presage API key and the SmartSpectra SDK is available, camera processing follows the official SDK's privacy and data-handling terms.
- **Active indicator:** A small dot in the corner of the HUD shows when the camera is actively capturing, so you always know.

## What's Live vs. Simulated Without Keys

### With zero `.env` (or blank keys)
| Feature | Status | Details |
|---|---|---|
| **Stay22 property data** | Simulated | Uses bundled fallback snapshot (real Fairmont Royal York values, clearly labelled `live:false`). |
| **Price/rating/suppliers** | Simulated | Hardcoded fallback values: 4.0-star, ~8.8 rating, $1050 CAD/2 nights, 4 suppliers. |
| **Presage signals** | Fallback | Local audio + video heuristics; no SmartSpectra SDK. Camera feed processed locally only. |
| **Booking detection** | Simulated | Use judge panel "Simulate Booking" button. Game responds exactly as if a real Stay22 transaction arrived. |
| **Everything else** | Live | Game loop, entity behavior, generator interactions, front-desk puzzle, escape, HUD, all real. |

### With `STAY22_API_KEY` and `STAY22_CAMPAIGN_ID`
| Feature | Status | Details |
|---|---|---|
| **Stay22 property data** | Live | Real-time fetch from Stay22 Direct Travel API; labelled `live:true`. |
| **Price/rating/suppliers** | Live | Current Fairmont Royal York booking records. |
| **Presage signals** | Fallback or Presage | Presage if `PRESAGE_API_KEY` available; otherwise fallback. |
| **Booking detection** | Live | Server polls Stay22 reporting endpoint; real attributed bookings trigger New Arrival events. Simulated bookings still available in judge panel for testing. |

## Development

### Build and test
```bash
npm run build          # Production bundle
npm run check:physics  # Collision detection verification
npm run check:layout   # Room layout sanity check
npm run check:stay22   # Start server; verify /api/session shape
```

### Judge Panel (in-game, press Backquote)
Out-of-fiction diagnostics:
- **Session info:** Live/fallback badge, property name.
- **Presage info:** Current mode, live signal meters (talking, breathing intensity, confidence).
- **Entity info:** Current state (patrol, suspicious, pursuit, hunt, cooldown, finalHunt, exorcised), alertness level, eyes open/closed.
- **Buttons:**
  - **Simulate Booking (LABELLED SIMULATED):** Triggers a New Arrival event immediately.
  - **Force New Arrival:** Same as simulate but overrides campaign/transaction validation.
  - **Complete All Generators:** Marks all 4 generators as activated.
  - **Skip To Desk:** Jump directly to front-desk phase.
  - **Win:** Immediately trigger the victory sequence.

## Deployment & Monetization

The game is designed to work in three contexts:

1. **Local development** (no keys): Bundled fallback, perfect for testing and judging.
2. **Private streams/events** (with campaign ID): Creators get a unique `STAY22_CAMPAIGN_ID`; attributed bookings tied to their stream trigger live events on air.
3. **Website embed** (affiliate mode): A creator hosts the game and shares a campaign-specific Stay22 booking link. Viewers can play for free; bookings earn the creator commission.

In all cases:
- The horror experience is fictional.
- The booking link is disclosed as an affiliate link.
- The player's decision to book is optional and does not affect winning.
- The experience ends with a neutral, real-property card and an optional booking path.

## Contact & Attribution

**The Concierge** is a hackathon project integrating:
- **Stay22 Direct Travel API** (dev.stay22.com) for live property data and affiliate attribution.
- **Presage SmartSpectra** (smartspectra.presagetech.com) for camera-based physiological sensing.
- **Three.js** for 3D rendering.
- **Vite** for bundling and dev server.
- **Node.js** for the backend proxy.

Authored by Dimural Murat. Built with Claude Code.
