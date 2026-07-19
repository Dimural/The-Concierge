# The Concierge
## Hackathon Product and Development Plan

**Core technologies:** Stay22 Direct Travel API and Reporting API, Presage SmartSpectra SDK

**Document purpose:** This plan is intended for an AI development agent. It defines the product, player experience, gameplay rules, API responsibilities, scope, constraints, testing goals, and hackathon presentation. It intentionally contains no code and does not prescribe a detailed software architecture.

---

## 1. One-Sentence Concept

**The Concierge is a first-person horror game in which players enter corrupted versions of real hotels, use live Stay22 records to restore each hotel’s identity, and survive an entity that can hear their talking and breathing through Presage—while real attributed hotel bookings temporarily give the entity sight.**

---

## 2. The Big Idea

Most hotel products display the same information in the same way: a list of cards containing a photo, name, rating, and price. The Concierge turns that information into a place the user can physically enter and survive.

The project should feel like the hotel’s online listing has become a living supernatural system. Stay22 is not a menu added beside the game. Its information determines the mystery, supplies the facts needed to win, produces tracked booking opportunities, and can cause live danger inside the hotel.

Presage makes the player part of the horror system. The game is not only listening for controller or keyboard input. It can react to whether the player is talking, how their breathing changes, and potentially other supported physiological or facial signals when confidence is sufficient.

The result is a new form of **playable hotel discovery** and **commerce-triggered entertainment**.

---

## 3. The Purpose of the Project

### The problem

Hotel discovery is functional but rarely memorable. Users browse many nearly identical listings, while creators and affiliates usually send people to hotel pages through passive links that interrupt the content experience.

### The opportunity

Turn live accommodation data into entertainment rather than presenting it as another search interface.

### What the project demonstrates

- A real hotel listing can become a procedural game world.
- Live accommodation data can generate objectives and puzzles.
- Affiliate booking activity can become a live gameplay event.
- Physiological signals can create a more personal form of stealth horror.
- Monetization can become part of the entertainment instead of appearing as a separate advertisement.

### Who it is for

The immediate hackathon experience is for horror players and judges. The larger product direction is for:

- Horror streamers and gaming creators
- Travel creators who want a memorable way to feature hotels
- Stay22 affiliates looking for a format beyond links, maps, or listing cards
- Tourism campaigns and destination marketers
- Hotels that want an optional fictional promotional experience
- Event organizers whose audiences need nearby accommodations

### Long-term product statement

**Instead of reading a hotel recommendation, enter it. Instead of clicking an affiliate link, survive the listing first.**

---

## 4. Important Reality Checks

These constraints must be reflected honestly in the product and demo.

### Stay22 does not detect every booking made at a hotel

The game can only identify bookings attributed through the project’s Stay22 links or campaigns. It cannot detect a random person independently booking the selected hotel elsewhere on the internet.

The correct player-facing language is:

> A new reservation has appeared in the hotel ledger.

Avoid claiming:

> Someone just booked this hotel somewhere on the internet.

### Booking detection may not be instantaneous

The current public Stay22 documentation exposes a transaction retrieval endpoint. It does not document a guaranteed instant webhook. The product should therefore treat a booking event as occurring when the transaction appears in Stay22 reporting.

For the hackathon demo, provide a clearly labelled simulated booking control that activates the exact same gameplay event as a verified Stay22 transaction.

### Stay22 provides live identity, availability, pricing, and supplier records—not hotel history

The narrative should not claim that Stay22 reveals the literal historical version of a property. The player is restoring the hotel’s **real-world digital identity** after the entity corrupts it inside the nightmare.

Use language such as:

> This place has forgotten what it is. Restore the hotel recorded in the living world.

Do not use language implying that Stay22 is an archive of the hotel’s past.

### Presage is camera-based

SmartSpectra turns a camera into a physiological sensor. It provides video-derived signals such as talking detection, breathing measurements, facial analysis, pulse rate, and related confidence or stability information. It is not simply an audio voice-recognition system.

The game may use a microphone as an additional source of loudness if desired, but the Presage integration itself should be presented as camera-based talking and physiological detection.

### Presage measurements require suitable capture conditions

Breathing and some cardiovascular measurements work best when the player is relatively stationary, the camera is stable, and the face and upper body are visible and adequately illuminated. The game must account for low-confidence or unavailable readings without unfairly punishing the player.

### This is not a medical product

Presage metrics are for general wellness and informational purposes. The game must never diagnose the player, label them medically, or make health claims.

---

## 5. Current Starting Point

### Product vision versus hackathon scope

The long-term product concept is designed to support many hotels, provided that each hotel has a prepared playable environment and is matched to the correct Stay22 property record. However, the hackathon MVP must support **only one hotel: Fairmont Royal York in Toronto**.

The Fairmont Royal York 3D environment already exists in the codebase. The AI development agent must use that existing environment and must not attempt to generate maps, import layouts, or make the gameplay systems universally compatible with arbitrary hotels during the hackathon.

For the MVP:

- The game may open directly into the Fairmont Royal York experience or show a selection screen containing only that hotel.
- Stay22 only needs to resolve and use the correct Fairmont Royal York property record.
- Archive Generator clues may be designed around fields that are reliably available for this specific property.
- The New Arrival campaign and transaction trigger only need to target the Fairmont Royal York experience.
- Puzzle placement, visual changes, hiding locations, and entity behaviour may be handcrafted for the existing Fairmont map.
- No functionality needs to work for every hotel in Stay22 inventory.
- Multi-hotel support is a future extension, not an MVP requirement.

The project already has:

- A playable hotel environment
- A player who can walk, run, and hide
- An entity present in the hotel
- A core entity concept in which it covers its eyes

The project should build around those existing assets rather than replacing them.

The next implementation goal is to turn the existing environment into one complete beginning-to-end game session.

---

## 6. Core Gameplay Pillars

### 6.1 Explore a corrupted real hotel

In the long-term concept, the player can select from real hotels for which fictionalized playable maps have been prepared. In the hackathon MVP, the only supported property is **Fairmont Royal York in Toronto**, using the 3D environment already present in the codebase. Stay22 identifies that exact property and retrieves its current digital record.

### 6.2 Restore the hotel’s identity

The entity has corrupted the hotel’s name, reputation, market record, and booking rules. The player activates scattered Archive Generators to recover parts of the hotel’s live Stay22 identity.

### 6.3 Stay physically quiet

During normal play, the entity cannot see because it covers its eyes. It uses the player’s talking, breathing, and other noise-related signals to become suspicious and search nearby areas.

### 6.4 Survive booking-triggered sight

When a new attributed Stay22 booking associated with the selected hotel appears in the transaction ledger, the entity uncovers its eyes and gains visual detection for a short, intense hunt.

### 6.5 Reconstruct the listing and force checkout

After recovering enough verified information, the player returns to the front desk, restores the hotel’s real identity, rejects the entity as an unregistered occupant, and escapes during a final hunt.

---

## 7. Full Player Experience

## 7.1 Launch and consent

Before gameplay begins, explain that the experience can use the player’s camera to detect talking, breathing, facial signals, and related physiological measurements.

The player must actively consent before camera processing begins.

The screen should clearly communicate:

- What signals are used
- That the experience is not medical
- Whether raw camera footage is stored
- That the player can continue with a reduced-input accessibility mode if capture is unavailable

The ideal privacy position is to avoid retaining raw video, raw audio, or unnecessary physiological history.

## 7.2 Calibration

The player completes a short atmospheric calibration in a darkened security-camera interface.

The game checks:

- Whether a face is visible
- Whether the upper chest is visible enough for breathing signals
- Whether lighting and camera stability are adequate
- The player’s baseline breathing and talking state
- Whether confidence is high enough to use each signal

The calibration should feel like part of the fiction:

> GUEST BIOMETRIC REGISTRATION
>
> Please remain visible while the hotel learns how to find you.

Do not tell the player to hold their breath or suppress normal breathing. The mechanic should reward calmness and silence, not unsafe breath restriction.

## 7.3 Hotel selection

The long-term product should show only hotels for which a playable map exists. Stay22 may contain a huge inventory, but the game cannot generate a full 3D hotel map from the API.

For the hackathon MVP, there is no need to build a real multi-hotel browser. The experience may open directly into Fairmont Royal York or present a single Fairmont Royal York property card before starting.

The selection screen can resemble an old newspaper, reservation ledger, or wall of property files.

Each supported hotel may show neutral, verified Stay22 information such as:

- Hotel name
- General location
- Hotel classification
- Guest rating
- A live tracked booking option

The visual horror treatment must be clearly presented as fictional.

## 7.4 Session creation

After the player chooses a hotel, the game retrieves the hotel through Stay22 and creates a temporary session record.

This session record provides the authoritative answers for that playthrough. It prevents a live price or supplier response from changing midway through the puzzle and making the game unfair.

The session should use several available Stay22 fields, but only fields that are present and stable enough for the selected hotel.

Possible fields include:

- Property name and type
- Address or coordinates
- Guest rating
- Hotel star classification
- Review count
- Supplier availability across Booking.com, Expedia, Hotels.com, and Vrbo
- Current full-stay prices when dates are supplied
- Guest, bedroom, bed, or bathroom capacity where available
- Free-cancellation and instant-booking indicators where available
- Tracked Stay22 and supplier links

The session data is temporary. Stay22 permits short-lived use and caching but prohibits building a permanent local copy of its inventory.

## 7.5 Arrival sequence

The player enters the corrupted version of the selected hotel.

Suggested introductory message:

> This hotel still exists in the living world, but this version has forgotten its name.
>
> The Concierge erased its records and claimed every room as his own.
>
> Restore the property recorded outside these walls.
>
> Do not let him hear you.

The entity is introduced at a distance, standing unnaturally with both hands covering its eyes.

## 7.6 Normal entity behaviour

During the standard exploration state:

- The entity cannot visually detect the player.
- It patrols or wanders through the hotel.
- Talking detection produces a strong awareness event.
- Audible player noise, if a microphone layer is used, produces an awareness event.
- Elevated or unstable breathing can gradually increase its suspicion when Presage confidence is sufficient.
- Footsteps, running, doors, generators, dropped objects, and environmental actions produce in-world sound.
- The entity investigates sound rather than instantly knowing the player’s exact position.

The player should understand that silence helps, but normal breathing is allowed. The game should create tension without encouraging harmful breath-holding.

## 7.7 Archive Generators

Four Archive Generators are distributed around the map. They are physical machines that reconnect the nightmare hotel to its real Stay22 record.

Each generator should have three effects:

1. It retrieves or revalidates a category of real hotel information.
2. It reveals a fragmented clue required at the front desk.
3. It makes a loud in-world sound that attracts the entity.

The generators should not feel like ordinary trivia terminals. Activating one should alter the environment, restore a piece of signage, change room numbers, or repair part of the hotel’s visual identity.

### Generator A: Property Registry

Restores identity information such as:

- Hotel name
- Property type
- General address or location

Possible environmental result:

- The hotel’s real name partially returns to the lobby sign.
- Previously blank room plaques become readable.

### Generator B: Guest Ledger

Restores reputation information such as:

- Guest rating
- Review count
- Hotel star classification

Possible environmental result:

- Corrupted portraits become review tally marks.
- The correct star symbols appear over selected doors.

### Generator C: Rate Engine

Restores market information for the chosen dates, such as:

- A selected live total price
- Number of suppliers currently returning a quotation
- Which supplier records are reachable

Possible environmental result:

- A receipt printer produces a torn rate record.
- Elevator indicators corresponding to supplier records become active.

### Generator D: Reservation Rules

Restores available policy or capacity information such as:

- Free-cancellation status
- Instant-booking status
- Supported guest or room capacity

Possible environmental result:

- A locked safe opens.
- A cancellation stamp or occupancy seal appears.

### Data fallback rule

Not every Stay22 property will return every optional field. The game must prepare several valid clue templates and select only those supported by the current response.

No puzzle should depend on a missing value.

## 7.8 Using Stay22 data as gameplay rather than trivia

The recovered facts should also affect the level, not only become answers.

Examples:

| Stay22 signal | Possible game effect |
|---|---|
| Hotel star classification | Number of identity seals required |
| Guest-rating decimal | Safe, room, or elevator clue |
| Review-count digits | Order of symbols or room sequence |
| Number of quoted suppliers | Number of powered escape routes |
| Selected full-stay price | Receipt code or front-desk verification number |
| Free cancellation | One opportunity to undo an incorrect submission |
| No free cancellation | Incorrect submission triggers immediate danger |
| Instant booking | Reduced warning before a special event |
| Capacity | Number of physical objects needed for a ritual |
| Distance or location | Map-room coordinate or directional clue |

The exact mapping should be chosen for clarity and reliability. Do not overload the player with every available field.

## 7.9 Real booking event: The New Arrival

Each supported hotel receives a unique Stay22 campaign identity. The tracked booking link shown by the project must carry the correct affiliate attribution and campaign.

When a previously unseen attributed transaction appears with the campaign associated with the hotel, the game creates a New Arrival event.

The event sequence:

1. The reception bell rings throughout the hotel.
2. A printer or reservation board announces a new arrival.
3. Lights briefly fail or flicker.
4. The entity stops moving.
5. It slowly removes its hands from its eyes.
6. It gains visual detection and increased speed for approximately fifteen seconds.
7. The player must hide, close doors, break line of sight, or use the environment.
8. The entity eventually covers its eyes again and enters a short cooldown.

During this event, silence alone is not enough. The mechanic changes from sound stealth to visual survival.

Suggested message:

> A NEW RESERVATION HAS ENTERED THE LEDGER
>
> THE CONCIERGE CAN SEE

### Transaction rules

- Trigger only once for each unique booking record.
- Use the campaign identity to associate the transaction with the correct hotel or event.
- Do not display private transaction information to players.
- Do not expose destination, travel dates, country, device, commission, or booking identifiers.
- Treat the event as occurring when Stay22 reports it, not necessarily at the exact moment the reservation was made.
- Retain a simulated New Arrival control for the hackathon demonstration.

## 7.10 Front-desk reconstruction

After activating the required generators, the player returns to the front desk.

The desk presents a corrupted property record with several missing fields. The player restores it using the information recovered around the hotel.

The final interaction should require understanding, not blind guessing. The player may select or enter a small number of important facts, such as:

- Correct hotel identity
- Guest rating or classification
- Number of active supplier records
- A rate or policy clue

The game compares the submission against the temporary session record created at entry.

### Correct reconstruction

The hotel begins restoring itself:

- Real property signage returns.
- Room numbers stabilize.
- Corrupted walls and objects fade.
- A final notice identifies the entity as an occupant not found in any valid reservation.

Suggested message:

> PROPERTY IDENTITY RESTORED
>
> UNREGISTERED OCCUPANT DETECTED
>
> FINAL CHECKOUT AUTHORIZED

### Incorrect reconstruction

An incorrect submission should create danger but not permanently end the session immediately.

Possible result:

- The desk bell rings.
- The entity gains sight for a shorter hunt.
- One clue remains available for review.
- A free-cancellation property may permit one consequence-free correction.

## 7.11 Final checkout and escape

After the player restores the hotel’s identity, the entity begins its final visual hunt.

The player must reach an exit, elevator, or restored front door while the entity can see and hear.

On escape:

- The entity is forcibly checked out.
- The corrupted hotel fades.
- The player returns to a neutral real-world property page.

Suggested ending:

> THE NIGHTMARE WAS FICTIONAL.
>
> THE HOTEL IS REAL.
>
> YOU RESTORED ITS NAME.

The real hotel can then be shown respectfully with an optional Stay22 tracked link.

---

## 8. Stay22’s Responsibilities in the Experience

Stay22 should have several meaningful roles. The goal is not to make unnecessary requests merely to increase the API count.

### Role 1: Identify the selected real hotel

The long-term project uses Stay22 to match each supported game map to its live property record. For the hackathon MVP, this matching only needs to work for Fairmont Royal York. A direct property or supplier identifier should be used when possible so the game does not accidentally resolve a different hotel.

### Role 2: Create the session’s hotel identity

The accommodation response provides the facts from which the Archive Generator clues and front-desk answers are chosen.

### Role 3: Control procedural details

Selected live fields influence codes, room clues, powered exits, penalties, or other level rules.

### Role 4: Provide tracked booking paths

The property and supplier records provide Stay22 deeplinks carrying affiliate attribution. These links allow the project to earn commission on eligible attributed bookings.

### Role 5: Route bookings to the correct game event

Campaign identifiers distinguish hotels, creators, livestreams, or demo sessions. Reporting data allows the project to detect a new attributed transaction and trigger the entity’s sight mode.

### Role 6: Verify the hotel at the ending

The game may perform a final live revalidation for presentation purposes. The actual puzzle answer should remain based on the locked session record so that mid-game price changes do not invalidate the player’s work.

### Role 7: Support a commercial epilogue

After the fictional experience, the player may view or book the neutral real property through Stay22. The booking option must remain optional and clearly disclosed as an affiliate link.

---

## 9. Presage’s Responsibilities in the Experience

Presage should be central to the monster, not merely displayed in a debug panel.

### Primary signals for the MVP

#### Talking detection

Talking should create a clear and immediate awareness spike for the entity during blind mode.

#### Breathing signal

Breathing should influence tension more gradually. The entity can become more alert when breathing intensity or instability rises and the measurement is stable enough to trust.

Do not require the player to stop breathing. The intended fantasy is “the monster senses panic,” not “hold your breath to survive.”

### Strong optional signals

#### Pulse rate

When valid and sufficiently confident, pulse can influence subtle atmosphere such as heartbeat audio, visual distortion, or the entity’s curiosity. It should not become a precise win-or-lose condition because it requires a measurement window and suitable capture conditions.

#### Facial expression

A high-confidence fear or surprise signal can produce cosmetic or atmospheric reactions, such as a mirror changing, lights flickering, or the hotel “noticing” the player. Avoid claiming the SDK can know the player’s true emotion with certainty.

#### Blinking

Blinking may be used for a short scripted apparition or camera effect, but it should not be required for the MVP.

### Confidence and stability rules

- Use a signal only when its confidence or stability is sufficient.
- Smooth sudden changes so one poor frame does not cause an unfair attack.
- If a signal becomes unreliable, reduce its gameplay influence rather than treating it as danger.
- Provide a visible but atmospheric capture-quality indicator during calibration.
- Maintain a fallback mode so the game remains playable without valid physiology.

### Platform consideration

SmartSpectra currently documents support for Android, Swift, C++, and Node.js/Electron, with platform-specific requirements. The AI agent must choose the integration compatible with the project’s existing runtime. If the current game is browser-only, a compatible supported wrapper or desktop presentation may be the most practical hackathon route.

---

## 10. Entity Behaviour Plan

The entity should have a small number of readable states.

### Covered-Eyes Patrol

- Default state
- No visual detection
- Wanders through the map
- Responds to in-world sound, talking, and trusted breathing signals

### Suspicious

- Triggered by a weak or distant signal
- Stops, listens, tilts its body, or turns awkwardly
- Moves toward the general source rather than knowing the exact location

### Sound Pursuit

- Triggered by sustained talking, loud player action, or a noisy generator
- Moves quickly toward the last detected region
- Still cannot see the player
- Can be escaped through silence and repositioning

### Eyes-Open Hunt

- Triggered by a Stay22 New Arrival, selected story moments, or serious puzzle mistakes
- Visual detection is enabled
- Speed increases
- The player must hide or break line of sight
- Primary booking-triggered duration is approximately fifteen seconds

### Cooldown

- Follows an eyes-open hunt
- Entity covers its eyes again
- Briefly returns to a predictable route
- Gives the player a short recovery opportunity

### Final Checkout Hunt

- Begins after the identity reconstruction succeeds
- Combines visual and sound detection
- Ends only when the player reaches the restored exit

### Exorcised

- Entity is removed, frozen, sealed, or forced into the guest ledger
- Player receives the ending and real-hotel epilogue

---

## 11. Recommended MVP Scope

The hackathon MVP should contain one polished complete experience.

### Required MVP features

- Fairmont Royal York as the only supported real hotel
- The existing Fairmont Royal York 3D environment as the only playable hotel map
- Existing player movement, running, hiding, and entity
- Covered-eyes blind entity behaviour
- Presage calibration
- Presage talking detection affecting the entity
- One breathing-related gameplay or atmosphere effect
- One Stay22 property lookup
- Temporary session snapshot
- Three or four Archive Generators
- Clues generated from available Stay22 fields
- Front-desk reconstruction interaction
- One tracked Stay22 hotel link with a campaign identity
- Stay22 transaction retrieval or a working transaction-listener demonstration
- New Arrival event that gives the entity sight for fifteen seconds
- A clearly labelled simulated booking trigger for judging
- Final checkout hunt
- Win screen with an optional tracked real-hotel link
- Consent, privacy, affiliate, and fictionalization disclosures

### What should not block the MVP

- Multiple hotels
- Procedural 3D map generation
- Multiplayer
- A large persistent global hotel
- Several different entities
- Complex historical research
- Perfect transaction immediacy
- Advanced medical-style biometrics
- Detailed supplier-specific alternate realities

---

## 12. Build Order for the AI Development Agent

The agent should preserve the current map and entity and develop in this order.

### Phase 1: Complete the basic game loop

- Establish a clear objective and ending.
- Place the front desk and Archive Generators.
- Ensure the player can activate generators, collect information, submit an answer, and escape.
- Use placeholder hotel values at first.

### Phase 2: Complete the entity’s two-mode behaviour

- Covered-eyes sound pursuit
- Eyes-open visual hunt
- Fifteen-second transition and cooldown
- A temporary manual trigger for testing

### Phase 3: Integrate Presage

- Add camera consent and calibration.
- Use talking detection as the most immediate physiological trigger.
- Add one breathing-based effect with confidence handling.
- Add fallback behaviour when readings are unavailable.

### Phase 4: Integrate Stay22 accommodation data

- Match the existing Fairmont Royal York map to the correct Stay22 property.
- Create the temporary session snapshot.
- Replace placeholder clues with real values.
- Ensure missing fields trigger alternate clue templates.
- Add the tracked hotel link.

### Phase 5: Integrate Stay22 transaction events

- Assign a clear campaign identity to the selected hotel.
- Retrieve recent transaction records.
- Recognize previously unseen attributed transactions.
- Map a valid event to the eyes-open hunt.
- Preserve the simulation control for the demo.

### Phase 6: Polish and present

- Improve the arrival sequence, generator feedback, booking event, and final checkout.
- Add a small judge-facing status panel outside normal gameplay.
- Verify privacy and affiliate disclosures.
- Rehearse the short demo path.

---

## 13. Hackathon Demonstration Flow

The ideal live demonstration should take approximately three to four minutes.

### Opening pitch

> Everyone can build a hotel search. We built a hotel you can enter.

### Step 1: Enter Fairmont Royal York

Show the single supported Fairmont Royal York experience and demonstrate that its real property record is being resolved through Stay22 with current listing data. A multi-hotel selection interface is not required for the MVP.

### Step 2: Enter the nightmare

Show the entity covering its eyes. Explain that it cannot see but Presage allows it to detect the player talking and respond to breathing-related signals.

### Step 3: Demonstrate physiology

Speak briefly and show the entity becoming suspicious or moving toward the player.

Then remain quiet and reposition.

### Step 4: Activate an Archive Generator

Show the generator restoring a real Stay22 fact and creating noise that attracts the entity.

### Step 5: Demonstrate the New Arrival

Use the labelled booking simulator or a prepared real transaction record.

Show:

- Reception bell
- Arrival message
- Entity uncovering its eyes
- Fast visual hunt
- Player hiding until the fifteen seconds end

Explain that a real attributed Stay22 transaction follows the same event path.

### Step 6: Restore the hotel

Enter the recovered Stay22 facts at the front desk.

### Step 7: Escape and close the loop

Survive the final hunt, show the restored real property, and display the optional tracked booking link.

### Closing line

> Stay22’s inventory creates the mystery, its booking links monetize the experience, and its transaction ledger changes the monster live. Presage makes the player’s own body part of the stealth system.

---

## 14. Hackathon Track Positioning

### Why this is not another hotel search

The player does not primarily browse results. They physically enter a playable interpretation of a property and reconstruct its live listing from inside the game.

### Why Stay22 is essential

Without Stay22:

- There is no verified real property identity.
- Archive Generator clues are no longer live.
- Supplier and price information cannot affect the level.
- Tracked booking links and commission disappear.
- Real attributed bookings cannot trigger the monster.
- The ending cannot return the player to a bookable real property.

### Why it can make money after the hackathon

Each supported hotel experience ends with an optional tracked booking path. Creators can host or stream a hotel map and share a campaign-specific Stay22 link. Eligible bookings can earn affiliate commission while also producing an entertainment event.

### Strong product category

**Playable affiliate commerce** or **interactive travel discovery**.

---

## 15. Success Criteria

The MVP is successful when all of the following are true:

- A judge understands the concept within thirty seconds.
- The hotel being explored is clearly tied to a real Stay22 property.
- At least two different Stay22 fields visibly affect gameplay.
- The player must use Stay22-derived information to win.
- A New Arrival event clearly changes the entity from blind to sighted.
- Presage talking detection visibly affects the entity.
- At least one breathing-derived effect is visible and fair.
- The game remains playable when a biometric signal has low confidence.
- The experience has a beginning, objective, climax, and ending.
- The optional booking path is clear but not disruptive.
- The team can truthfully explain which event is live and which is simulated.

---

## 16. Risks and Mitigations

### Risk: No real booking occurs during judging

**Mitigation:** Include a clearly labelled simulation using the same internal New Arrival event as a verified transaction. Show the live reporting connection separately.

### Risk: Stay22 transaction reporting is delayed

**Mitigation:** Describe the event as a reservation appearing in the ledger. Do not promise second-by-second booking detection.

### Risk: Fairmont Royal York returns missing or inconsistent fields

**Mitigation:** Test the exact Fairmont Royal York response in advance, choose a small set of reliable fields, and retain one or two handcrafted fallback clue templates for the demo. Universal hotel compatibility is not required.

### Risk: Live prices change during the game

**Mitigation:** Lock the puzzle to the session snapshot. Use a final refresh only as atmosphere or a non-blocking “record drift” detail.

### Risk: Presage confidence drops during movement or poor lighting

**Mitigation:** Calibrate first, use confidence thresholds, reduce influence when unreliable, and preserve conventional in-game sound cues as fallback.

### Risk: Breathing mechanics encourage unsafe behaviour

**Mitigation:** Never ask the player to hold their breath. Use calmness, change, or intensity as gradual tension signals rather than a binary survival requirement.

### Risk: Exact real hotel floor plans create security, intellectual-property, or brand concerns

**Mitigation:** Use altered, condensed, or fictionalized layouts rather than operationally exact reproductions. Avoid staff-only, security, emergency, or restricted-area accuracy. Seek permission for commercial use of names, logos, photography, and detailed layouts.

### Risk: A real hotel appears to be accused of being haunted or unsafe

**Mitigation:** State clearly that the horror environment and entity are fictional. Present the real hotel neutrally at selection and after the ending.

### Risk: Privacy concerns around camera and transaction data

**Mitigation:** Use explicit camera consent, minimize data collection, avoid retaining raw footage, never expose transaction details, and process only what is needed for gameplay.

### Risk: Too much scope

**Mitigation:** Finish one hotel and one complete loop before adding another property, entity, or mode.

---

## 17. Accessibility and Player Comfort

- Offer adjustable camera and breathing sensitivity.
- Offer an alternative mode when a player cannot or does not want to use camera-based signals.
- Do not require whispering, breath-holding, or unusual physical behaviour.
- Avoid punishing involuntary sounds excessively.
- Allow subtitles for all story and event audio.
- Provide controls for flashes, camera effects, motion blur, and intense audio.
- Clearly indicate when the camera is active.
- Allow the player to pause or end capture outside active gameplay.

---

## 18. Privacy, Legal, and Brand Requirements

### Camera and physiology

- Obtain informed consent.
- Explain the purpose in plain language.
- Do not diagnose or make health interpretations.
- Avoid storing raw camera footage unless absolutely necessary and explicitly disclosed.
- Avoid saving long-term physiological profiles.

### Stay22 transaction data

- Keep API credentials private.
- Do not place private transaction data in the game client or public interface.
- Deduplicate transaction events privately.
- Use only sanitized game events such as “new arrival.”

### Affiliate disclosure

- Clearly state that booking links are affiliate links and may generate commission.
- Never require a purchase to beat the game.
- Never create false urgency or suggest that booking affects the safety of the player.

### Hotel representation

- Clearly label the horror experience as fictional.
- Avoid claims that the real property is haunted, dangerous, fraudulent, or associated with crimes.
- Use neutral real-property information from Stay22.
- Alter or simplify maps to avoid presenting exact operational layouts.

---

## 19. Optional Stretch Features

These should be attempted only after the MVP is complete.

### Multiple supported hotels

Each hotel has a prepared map and its own campaign identity, puzzle templates, and visual style.

### Streamer mode

A creator receives a campaign-specific booking link. An attributed booking associated with that creator’s session triggers the live New Arrival event on stream.

### Community occupancy

Attributed bookings fill a shared fictional guest ledger and unlock cosmetic rooms, lore, or global difficulty milestones without exposing customer details.

### Supplier fragments

Different Archive Generators can represent Booking.com, Expedia, Hotels.com, and Vrbo records. The number of reachable supplier records influences the number of restored routes or clues.

### Physiological hauntings

High-confidence pulse, expression, or blinking signals can influence cosmetic effects, apparition timing, or music without becoming medically framed or unfair survival requirements.

### Daily hotel seed

The same hotel produces a daily variation based on a temporary Stay22 snapshot, giving creators a reason to revisit and replay.

---

## 20. Final Product Pitch

### Short pitch

**The Concierge turns live hotel data into a first-person horror game. Players enter corrupted versions of real properties and use Stay22 records to restore the hotel’s identity. Presage lets the blind entity detect their talking and breathing, while real attributed bookings cause it to uncover its eyes and hunt.**

### Track-specific pitch

**Anyone can build a hotel search. We made hotel inventory into a monster. Stay22’s real property data generates the mystery, supplier and rate records shape the level, affiliate links create revenue, and reported bookings trigger live attacks. The player can only escape by reconstructing the real hotel from inside its corrupted digital twin.**

### Purpose statement

**The project replaces passive hotel browsing with playable discovery and turns affiliate commerce into a live entertainment mechanic.**

---

## 21. Final Direction to the AI Development Agent

- Preserve the existing hotel map, movement, hiding, and entity work.
- Build one complete Fairmont Royal York game before considering any other hotel.
- Keep Stay22 essential to selection, clues, the win condition, tracked links, and the New Arrival event.
- Keep Presage essential to the entity’s listening behaviour.
- Prioritize a polished beginning, one frightening booking event, a clear reconstruction puzzle, and a complete ending.
- Avoid unnecessary API calls or features that do not improve the player experience.
- Treat live data as temporary and handle missing fields gracefully.
- Never require a genuine purchase for gameplay progression.
- Never require unsafe breath control.
- Maintain honest demo language around simulated bookings and reporting delay.
- Keep the real property neutral and the horror layer clearly fictional.

---

## 22. Verified Reference Notes

The following official documentation informed this plan:

- Stay22 Direct Travel API overview: live accommodation inventory, prices, availability, and tracked deeplinks across Booking.com, Expedia, Hotels.com, and Vrbo.
  - https://dev.stay22.com/docs/api
- Stay22 accommodation search parameters and response fields.
  - https://dev.stay22.com/docs/api/accommodations/search
- Stay22 supplier response model and tracked links.
  - https://dev.stay22.com/docs/api/concepts/response-model
- Stay22 partner transaction reporting, including booking IDs, statuses, campaigns, providers, and update dates.
  - https://dev.stay22.com/docs/api/reporting/transactions
- Stay22 short-lived caching and prohibition on hard-storing inventory.
  - https://dev.stay22.com/docs/api/concepts/caching
- Presage SmartSpectra capabilities, supported platforms, conditions, and limitations.
  - https://smartspectra.presagetech.com/
- Presage metric types, including talking, breathing, facial, pulse, and stability/confidence data.
  - https://smartspectra.presagetech.com/docs/data-types/
- Presage Node.js and Electron SDK information.
  - https://smartspectra.presagetech.com/docs/nodejs/

