# Interactive furniture: real objects, crawl-under, climb-on-top

## Problem

Furniture in `props.js` is decorative in the wrong way:

- Round tables, boardroom tables, and kitchen counters are each a single solid
  AABB collider running from the floor to the object's top — functionally a
  short wall. It blocks the player at every height, so you can neither walk
  underneath nor jump on top (jumping onto it would require crossing into its
  footprint at a height above its top, which is impossible while the box is
  solid all the way down).
- Chairs (`chairT`) have **no collider at all** — the player already walks
  straight through them today.

The player controller (`player.js`) already supports the primitives this
needs: a prone/crouch state (`toggleProne`, `PRONE_H = 2.0`), a working
grounded jump, and auto step-up for low ledges (`STEP_UP = 1.25`). No new
movement mode is needed — only better collision geometry and a slightly
stronger jump.

## Scope

In scope: round banquet tables, boardroom/long tables, chairs (freestanding
only, not stacked), kitchen counters, jump height tuning, a `concealed` flag
on the player.

Out of scope: toppled/knocked-over tables (`clothT`) and stacked chairs keep
their current simplified colliders — they're wreckage/storage, not furniture
meant to be crawled into or mantled onto. No new input/interact key. No AI
consumption of the concealment flag (the entity has no senses yet in this
phase).

## Design

### 1. Collider shape rework (`props.js`)

Replace single-blob AABBs with a small set of boxes that mirror the visual
geometry, following the existing multi-box pattern already used for walls:

- **Round tables:** a thin center post/foot collider from the floor to
  ~2.2ft, plus a thin tabletop slab from ~2.2ft to ~2.55ft spanning the
  table's footprint. The gap between floor and slab is open — crawlable.
  2.2ft of clearance comfortably fits the player's prone height (2.0ft).
- **Boardroom/long tables:** four leg-post colliders near the visual leg
  positions, plus a thin tabletop slab at the top. Same open-underneath
  principle.
- **Chairs:** one solid block from the floor to seat height (~1.4ft),
  replacing the current zero collision. Small footprint, no crawl space
  (matches reality — you don't hide under a dining chair), but low enough to
  vault onto with the retuned jump.
- **Kitchen counters:** stay a single solid blob, full height. Real counters
  are closed underneath; nothing to crawl into. Still climbable on top once
  jump height is retuned.
- **Stacked chairs & toppled tables:** unchanged (out of scope, see above).

### 2. Jump tuning (`player.js`)

Raise `JUMP_V` (and/or adjust gravity on ascent) so the jump arc, combined
with forward drift during the jump (already how the physics works — no new
mantle/climb code), reliably clears:

- chair seats (~1.4ft) — already cleared today, kept working
- tabletops (~2.55ft)
- counters (~3ft)

### 3. Concealment flag

- `buildProps` returns a third field, `hideVolumes`: a small list of the
  tabletop-slab colliders from round and boardroom tables only (not chairs,
  not counters), tagged as hideable. This list is separate from the main
  `colliders` array used by the per-frame movement collision loop, so the
  hot path is unaffected.
- `Player` receives `hideVolumes` and exposes `player.concealed: boolean`,
  computed once per frame: true when the player is prone AND their
  horizontal position falls inside a hide volume's footprint AND their body
  is below the slab's bottom face.
- Nothing consumes `concealed` for gameplay yet (no detection AI exists in
  this phase). A minimal player-facing cue — a subtle vignette darkening on
  the overlay — reflects the flag so it's visibly confirmable now, ready for
  a future detection system to key off of.

## Files touched

- `src/props.js` — collider generation for tables/boardroom tables/chairs;
  return `hideVolumes` alongside `group`/`colliders`.
- `src/player.js` — `JUMP_V`/gravity tuning; `concealed` field + per-frame
  check against `hideVolumes`.
- `src/main.js` — thread `hideVolumes` from `buildProps` into `new Player(...)`.
- `src/ui.js` / overlay CSS — vignette cue driven by `player.concealed`.

## Non-goals / risks considered

- **Performance:** collider count roughly triples (chairs going from 0 to 1
  box each, tables going from 1 box to 2-5). The collision loop is a plain
  linear scan with no spatial partitioning; at this scale (low thousands of
  boxes) that remains trivially cheap per frame — not worth adding spatial
  partitioning for.
- **No new mantle/climb mechanic** — climbing is achieved entirely through
  jump-height tuning plus existing horizontal drift during a jump, per the
  approved design direction.
