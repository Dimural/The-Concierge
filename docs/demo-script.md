# The Concierge — Hackathon Judge Demo (3–4 min)

## Opening Pitch (15 sec)
> Everyone can build a hotel search. We built a hotel you can enter.

This is The Concierge: a first-person horror game where real hotel data from Stay22 becomes a mystery you must solve to escape. The blind entity hunts by listening to your voice and breathing through your camera—while real bookings cause it to see.

---

## Step 1: Case Board → Property Selection (30 sec)

**What you'll see:**
- Landing page with case-board or property-ledger aesthetic.
- Single supported property: Fairmont Royal York (real 4-star hotel in Toronto).

**What to say:**
> The Concierge operates on one property at a time—this is the Fairmont Royal York. Stay22 gives us its real listing data: 4-star hotel, guest rating of 8.8, available through Booking.com, Expedia, Hotels.com, and Vrbo. Click to begin.

**Click:** Enter game button / property card.

---

## Step 2: Consent & Reduced-Input Option (45 sec)

**What you'll see:**
- Modal consent screen explaining camera/mic use.
- Clear disclosures: not medical, local processing, recorded nothing, reduced-input option.

**What to say:**
> Before we enter, the game asks for camera and microphone consent. It explains:
> - We detect talking and breathing via camera and mic using local heuristics—no recording, nothing uploaded.
> - This is not a medical diagnosis product; it's purely for gameplay atmosphere.
> - If you don't want to use the camera, you can click "PROCEED UNREGISTERED" and play without any biometric capture. The game is fully playable either way.

**Your action:** Select "Grant Consent" (or "PROCEED UNREGISTERED" to demo without capture). The demo works great either way.

---

## Step 3: Calibration (30 sec)

**What you'll see:**
- Dark security-camera aesthetic screen with live video preview.
- Status lines: "FACE SIGNAL," "RESPIRATION FIELD," "ILLUMINATION."
- Flavour text: "GUEST BIOMETRIC REGISTRATION — Please remain visible while the hotel learns how to find you."

**What to say:**
> The calibration screen mimics a hotel security checkpoint. It checks:
> - Whether your face is visible in the camera.
> - Whether we can detect breathing motion (camera looks at your chest).
> - Whether lighting is adequate.
>
> You're never asked to hold your breath or do anything unusual—just stay in frame and let the sensor baseline itself.

**Your action:** Hold still for 2–3 seconds, let the calibration finish, click "CONTINUE" (or "PROCEED UNREGISTERED" again if you chose reduced mode).

---

## Step 4: Arrival Text & Enter the Hotel (30 sec)

**What you'll see:**
- Darkened hotel corridor. Ambient light, some dead lights, heavy fog.
- Text overlay:
  > "This hotel still exists in the living world, but this version has forgotten its name.
  > The Concierge erased its records and claimed every room as his own.
  > Restore the property recorded outside these walls.
  > Do not let him hear you."
- At a distance: A gaunt, too-tall figure in a decayed uniform, hands pressed over both eyes, wandering the corridor.

**What to say:**
> You're inside the corrupted Fairmont Royal York. Real hotel data has been erased. The Concierge—the entity you see in the distance—cannot see. His hands cover his eyes. He hunts only by listening to you talk, your breathing, and noise in the environment.

**Controls reminder:**
> WASD to move, Shift to run, C to crouch/hide, E to interact, Tab for your journal, mouse to look.

---

## Step 5: Demonstrate Physiology Reaction (45 sec)

**What you'll see:**
- HUD at top-left showing: entity state, alertness bar, talking/breathing meters, capture indicator.
- Entity wandering in corridor, not aware of player yet.

**What to say:**
> The HUD shows me three things: the entity's current state, its alertness level (0 to 1), and live signal meters showing my talking and breathing intensity.

**Your action 1:** Walk a few steps normally. Say the following sentence **clearly and loudly:**
> "The monster senses my voice!"

**What you'll see:**
- Alertness spike immediately.
- Entity stops, tilts its head, starts moving toward your position (even though it can't see you).
- HUD talking meter shows 1.0 confidence.

**What to say:**
> Talking creates an immediate awareness spike. The entity doesn't know my exact location, but it knows sound came from this region. Watch what happens if I stay silent and reposition.

**Your action 2:** Go silent and crouch (C key). Move quietly to the side, away from where you were standing. The entity should drift toward your old position, lose interest, and return to wandering.

---

## Step 6: Activate Archive Generator A (1 min)

**What you'll see:**
- Navigate to one of the four machines scattered around the hotel. (Generator A is in the Reservation Office, Mezzanine level.)
- Machine has a glowing lever and a screen.

**What to say:**
> There are four Archive Generators hidden around the hotel. Each one restores a category of real Stay22 data and makes noise that attracts the entity. Let me activate one.

**Your action:** Approach the generator, hold E for ~2.5 seconds. You'll see:
- Screen flickers and glows.
- Machine makes a loud mechanical sound (entity investigates immediately).
- Environment changes (a sign restores, lights flicker, room markers appear).
- Journal updates with a clue.

**What you'll see in the journal (Tab key):**
One of the property clues like:
- "THE LEDGER REMEMBERS A NAME: THE FAIRMONT ROYAL YORK."
- "CLASSIFICATION ON FILE: HOTEL, 4-STAR STANDING."
- etc.

**What to say:**
> Generator A restored property identity. Stay22 tells us the real name, type, and location. The entity heard that noise and is moving to investigate. You can hide in nearby cover (prone under overhanging objects), but the key to staying safe during normal exploration is silence and stillness.

---

## Step 7: New Arrival Event / Booking Trigger (1 min)

**What to say:**
> Now let me show you the signature moment: a real attributed booking triggering a live hunt. Since we don't have a real booking happening right now, I'll simulate one using the judge panel—but it fires the exact same gameplay event. This is labelled clearly as simulated.

**Your action:** Press Backquote (`` ` ``) to open the judge panel (out-of-fiction, floating window).

**What you'll see:**
- Judge panel with:
  - Session info: "LIVE: false" badge (fallback data) + property name.
  - Presage info: current mode, signal meters.
  - Entity info: current state ("patrol"), alertness, eyes open/closed.
  - Buttons: "Simulate Booking (LABELLED SIMULATED)," "Force New Arrival," etc.

**Click:** "Simulate Booking (LABELLED SIMULATED)"

**What you'll see immediately:**
1. Reception bell rings (audio).
2. Large banner appears on screen:
   > "A NEW RESERVATION HAS ENTERED THE LEDGER
   > THE CONCIERGE CAN SEE"
3. Lights flicker dramatically.
4. Entity stops, slowly lowers its hands from its eyes.
5. A faint red glow shows behind its hands.
6. Entity's movement becomes jerky and fast (stop-motion accelerates).
7. HUD shows entity state: "hunt", eyes open: YES, alertness ramping.

**What to say:**
> A booking just appeared in the stay22 transaction ledger (or was simulated). The entity's behaviour flips. It uncovers its eyes and gains visual line-of-sight detection for about 15 seconds. It moves faster. Now you must hide or run. Real attributed bookings through Stay22 would trigger this same chain.

**Your action (during the hunt):** Hide under a nearby overhang or behind cover. Close doors if possible. The entity's line-of-sight sweeps the area but should lose you if you crouch and stay still.

**Wait 15 sec:** After ~15 seconds, the entity covers its eyes again, enters a brief cooldown, and returns to blind patrol.

---

## Step 8: Complete Generators & Desk Sequence (1 min)

**What to say:**
> In a full playthrough, you'd activate all four generators to gather all the clues needed at the front desk. Let me skip to that moment.

**Your action:** Open the judge panel again (Backquote) and click "Skip To Desk".

**What you'll see:**
- Teleported to the front desk (curved reception counter, Mezzanine).
- A corrupted property record on the ledger.
- A form appears with 4 multiple-choice questions.

**What to say:**
> The front desk now shows the corrupted hotel record. I need to submit four answers derived from Stay22 data I gathered:
> 1. Hotel identity (the name).
> 2. Guest rating (8.8 out of 10).
> 3. Number of suppliers (4 channels).
> 4. Reservation rules (free cancellation + instant booking).

**Your action:** Fill in the answers (select the correct options for each question). The answers are based on real Stay22 fields locked into the session at the start of play.

**Submit the correct answers:**

**What you'll see:**
- All four questions answered correctly.
- Click "SUBMIT."
- Large message appears:
  > "PROPERTY IDENTITY RESTORED
  > UNREGISTERED OCCUPANT DETECTED
  > FINAL CHECKOUT AUTHORIZED"
- A previously locked door glows brightly (the exit unlocks).
- Entity begins its final hunt (sight + sound, no cooldown).

**What to say:**
> I've restored the hotel's real identity. The system has rejected the entity as an unauthorized occupant. Now the final hunt begins. I must reach the exit while it hunts with both eyes open and ears sharp.

---

## Step 9: Escape & Victory Screen (30 sec)

**Your action:** Run toward the glowing exit. Avoid the entity (it hunts normally—hide if necessary, or just run for the door).

**Reach the exit and leave the hotel.**

**What you'll see:**
- Corrupted hotel fades away.
- Clean, real-property card appears:
  > **THE FAIRMONT ROYAL YORK**
  > **4-Star Hotel**
  > **100 Front St W, Toronto, ON M5J 1E3**
  > **Guest Rating: 8.8 / 10**
- Final text:
  > "THE NIGHTMARE WAS FICTIONAL.
  > THE HOTEL IS REAL.
  > YOU RESTORED ITS NAME."
- An optional **"BOOK NOW"** button with a clear affiliate disclaimer:
  > "This link is a Stay22 affiliate link and may generate commission for this experience."

**What to say:**
> You won. The horror was fiction. The hotel and its real booking data are presented honestly and neutrally. You can optionally book the actual property through this affiliate link, or just leave. The game never required a booking to win.

---

## Closing Line (15 sec)

> **Stay22's inventory creates the mystery. Its booking links monetize the experience. Its transaction ledger changes the monster live. Presage makes the player's own body part of the stealth system.**
>
> Everything you just saw works out of the box with zero API keys. Drop in a Stay22 key and Presage key, and the simulated elements become live: real property data, real booking detection, and real biometric signals.

---

## Demo Notes for Judges

- **Total time:** 3–4 min if you move briskly through consent, calibration, and the generator demo.
- **No keys required:** Everything above works without `STAY22_API_KEY` or `PRESAGE_API_KEY` in `.env`. The fallback snapshot and simulated booking provide a complete, honest experience.
- **Honest language:**
  - Simulated bookings are labelled "LABELLED SIMULATED" in the judge panel.
  - Fallback Stay22 data is marked `live: false` in the judge panel.
  - Presage signals work in fallback mode (local heuristics, no upload).
  - Reduced-input mode is always available and keeps the game fully playable.
- **What's real without keys:**
  - The 3D hotel environment (walkable Fairmont Royal York recreation).
  - Player movement, hiding, and entity behavior (AI, pathfinding, state machine).
  - The four generators, front-desk puzzle, final hunt, and end sequence.
  - Presage consent, calibration, and signal processing (local, fallback-safe).
  - Stay22 clue generation and front-desk question generation (from bundled snapshot).
- **What becomes live with keys:**
  - Stay22 property data (real-time API calls).
  - Real attributed booking detection (Stay22 transaction polling).
  - Optional: SmartSpectra physiological signals (if Presage key is valid).
- **HUD reference:**
  - Top-left: entity state, alertness, signal meters, capture indicator.
  - Backquote opens judge panel (out-of-fiction diagnostics + test buttons).
  - Tab opens journal (clues collected so far).
  - E to interact, C to hide, WASD to move.
