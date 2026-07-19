# Interactive Furniture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make furniture (tables, chairs, counters) real physical objects — you can crawl under tables and boardroom desks, and climb on top of chairs, tables, and counters — instead of today's solid full-height blob colliders (tables/counters) or zero collision at all (chairs).

**Architecture:** Replace single-blob AABB colliders in `props.js` with small sets of boxes that mirror the actual visual geometry (a thin post/legs + a thin tabletop slab for tables; one solid seat-height block for chairs). This alone fixes both crawl-under and climb-on-top, because the current blob box blocks horizontal approach at every height — a thin slab only blocks the height range it actually occupies. Pair it with a slightly stronger jump (`JUMP_V`) so the vertical reach clears table/counter height, and a `concealed` boolean on `Player` computed from a new `hideVolumes` list (the tabletop slabs only), so a future detection system has something to key off.

**Tech Stack:** Vanilla JS + Three.js (`three` ^0.166.0), Vite. No test framework — this repo uses headless Node smoke scripts (`scripts/smoke-physics.mjs`, `scripts/check-layout.mjs`) run via `npm run check:physics` / `npm run check:layout`. No new dependencies needed.

## Global Constraints

- Units are feet; 1 unit = 1 ft (per project convention).
- Match existing code style: 2-space indent, semicolons, `const`/arrow functions, no added dependencies.
- Run `npm run check:physics` after every change to `props.js` or `player.js`; run `npm run check:layout` once at the end as a sanity check that nothing in `layout.js` was touched.
- Commit after every task (explicitly requested) — small, working commits, not one giant diff at the end.
- Out of scope (do not touch): toppled/knocked-over tables (`clothT`), stacked chairs' existing blob collider, kitchen counters, any AI/detection logic consuming `concealed`.

---

### Task 1: Round table colliders + `hideVolumes` scaffold

**Files:**
- Modify: `src/props.js`
- Modify: `scripts/smoke-physics.mjs`

**Interfaces:**
- Produces: `buildProps(floors, mats)` now returns `{ group, colliders, hideVolumes }` (was `{ group, colliders }`). `hideVolumes` is an array of AABB objects (`{x0,x1,y0,y1,z0,z1}`), populated so far with round-table tabletop slabs only.

- [ ] **Step 1: Add the `hideVolumes` array**

In `src/props.js`, find:
```js
  const chairT = [];
  const tableT = [];
  const clothT = []; // toppled tables keep same geometry, different tilt
```
Replace with:
```js
  const chairT = [];
  const tableT = [];
  const clothT = []; // toppled tables keep same geometry, different tilt
  const hideVolumes = []; // thin tabletop slabs the player can crouch under
```

- [ ] **Step 2: Replace the round-table blob collider with a pedestal + slab**

In `src/props.js`, inside `banquetSetup`, find:
```js
        } else {
          tableT.push({ x, y: r.y, z });
          colliders.push(aabb(x - 2.7, x + 2.7, r.y, r.y + 2.5, z - 2.7, z + 2.7));
          const n = 2 + Math.floor(rand() * 4);
```
Replace with:
```js
        } else {
          tableT.push({ x, y: r.y, z });
          // pedestal: thin center post, leaves the footprint open for crawling under
          colliders.push(aabb(x - 0.6, x + 0.6, r.y, r.y + 2.2, z - 0.6, z + 0.6));
          // tabletop: thin slab above prone height (2.0ft), a real ceiling to crouch under
          const slab = aabb(x - 2.9, x + 2.9, r.y + 2.2, r.y + 2.55, z - 2.9, z + 2.9);
          colliders.push(slab);
          hideVolumes.push(slab);
          const n = 2 + Math.floor(rand() * 4);
```

- [ ] **Step 3: Return `hideVolumes` from `buildProps`**

Find:
```js
  return { group, colliders };
}
```
Replace with:
```js
  return { group, colliders, hideVolumes };
}
```

- [ ] **Step 4: Update the smoke script to consume the new return shape, and add the failing test**

In `scripts/smoke-physics.mjs`, find:
```js
colliders.push(...buildProps(floors, mats).colliders);
console.log(`colliders: ${colliders.length}`);
```
Replace with:
```js
const props = buildProps(floors, mats);
colliders.push(...props.colliders);
console.log(`colliders: ${colliders.length}, props colliders: ${props.colliders.length}, hideVolumes: ${props.hideVolumes.length}`);
```

Then, near the end of the file, find:
```js
if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log('physics smoke test OK');
```
Replace with:
```js
// 8. table/boardroom-table hideVolumes are thin slabs, not floor-to-top blobs
{
  check(props.hideVolumes.length > 0, `hideVolumes populated (${props.hideVolumes.length})`);
  const thin = props.hideVolumes.every((v) => (v.y1 - v.y0) < 1);
  check(thin, 'every hideVolume is a thin slab (<1ft tall)');
}

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log('physics smoke test OK');
```

- [ ] **Step 5: Run it and confirm it now passes**

Run: `npm run check:physics`
Expected: all checks print `ok`, including `hideVolumes populated (...)` and `every hideVolume is a thin slab`, ending in `physics smoke test OK`.

(If you run this before Steps 1-3, it fails with a `TypeError` on `props.hideVolumes.length` — that's the expected red state.)

- [ ] **Step 6: Commit**

```bash
git add src/props.js scripts/smoke-physics.mjs
git commit -m "$(cat <<'EOF'
Give round tables real collision: open underneath, thin top

Replaces the floor-to-top blob collider with a thin center post and
a thin tabletop slab, so the space underneath is crawlable and the
top is a real, separately-tracked hide volume.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Boardroom/long table colliders

**Files:**
- Modify: `src/props.js`

**Interfaces:**
- Produces: `hideVolumes` now also includes the three boardroom-style tabletop slabs (`mezzanine:Boardroom`, `mezzanine:Territories`, `convention:Ontario`).

- [ ] **Step 1: Replace the long-table blob collider with per-leg colliders + a slab**

In `src/props.js`, find:
```js
    const t = new THREE.Mesh(new THREE.BoxGeometry(lw, 0.3, ld), mats.wood);
    t.position.set(cx, r.y + 2.4, cz);
    t.castShadow = t.receiveShadow = true;
    group.add(t);
    for (const [ox, oz] of [[-lw / 2 + 1, -ld / 2 + 1], [lw / 2 - 1, -ld / 2 + 1], [-lw / 2 + 1, ld / 2 - 1], [lw / 2 - 1, ld / 2 - 1]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.3, 0.4), mats.trim);
      leg.position.set(cx + ox, r.y + 1.15, cz + oz);
      group.add(leg);
    }
    colliders.push(aabb(cx - lw / 2, cx + lw / 2, r.y, r.y + 2.55, cz - ld / 2, cz + ld / 2));
```
Replace with:
```js
    const t = new THREE.Mesh(new THREE.BoxGeometry(lw, 0.3, ld), mats.wood);
    t.position.set(cx, r.y + 2.4, cz);
    t.castShadow = t.receiveShadow = true;
    group.add(t);
    const legOffsets = [[-lw / 2 + 1, -ld / 2 + 1], [lw / 2 - 1, -ld / 2 + 1], [-lw / 2 + 1, ld / 2 - 1], [lw / 2 - 1, ld / 2 - 1]];
    for (const [ox, oz] of legOffsets) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.3, 0.4), mats.trim);
      leg.position.set(cx + ox, r.y + 1.15, cz + oz);
      group.add(leg);
      // leg collider matches the visual post, leaving the rest of the underside open
      colliders.push(aabb(cx + ox - 0.2, cx + ox + 0.2, r.y, r.y + 2.3, cz + oz - 0.2, cz + oz + 0.2));
    }
    const slab = aabb(cx - lw / 2, cx + lw / 2, r.y + 2.25, r.y + 2.55, cz - ld / 2, cz + ld / 2);
    colliders.push(slab);
    hideVolumes.push(slab);
```

- [ ] **Step 2: Run the existing test and confirm the hideVolumes count grew**

Run: `npm run check:physics`
Expected: PASS, and the printed `hideVolumes: N` count in the `props colliders:` log line is 3 higher than it was after Task 1 (one more per boardroom-style room: Boardroom, Territories, Ontario). The Task 1 test (`hideVolumes populated`, `every hideVolume is a thin slab`) still passes because it's generic over the whole array — it now also covers these new slabs.

- [ ] **Step 3: Commit**

```bash
git add src/props.js
git commit -m "$(cat <<'EOF'
Give boardroom-style long tables real collision, same as round tables

Four leg posts instead of a floor-to-top blob, plus a thin tabletop
slab added to hideVolumes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Chair colliders

**Files:**
- Modify: `src/props.js`
- Modify: `scripts/smoke-physics.mjs`

**Interfaces:**
- Produces: every freestanding chair (not part of a stacked-chairs pile) now has a solid collider in `props.colliders`: an upright chair is a box with `x1-x0 === 1.6` and `y1-y0 === 1.5`; a knocked-over chair (`rx === Math.PI/2` in its placement) is `y1-y0 === 0.9`. Stacked-chair piles are untouched (they keep their single existing blob collider per stack).

- [ ] **Step 1: Tag stacked-chair entries so the new per-chair loop skips them**

In `src/props.js`, find:
```js
    // stacked chairs along the west wall
    for (let s = 0; s < 3; s++) {
      const sx = r.x + 2.2, sz = r.z + 6 + s * 5;
      if (sz > r.z + r.d - 3) break;
      for (let h = 0; h < 5; h++) chairT.push({ x: sx, y: r.y + h * 0.62, z: sz, ry: 0.12 * h });
      colliders.push(aabb(sx - 1, sx + 1, r.y, r.y + 4.5, sz - 1, sz + 1));
    }
```
Replace with:
```js
    // stacked chairs along the west wall (collision stays one blob per stack —
    // it's storage, not furniture meant to be crawled into or mantled onto)
    for (let s = 0; s < 3; s++) {
      const sx = r.x + 2.2, sz = r.z + 6 + s * 5;
      if (sz > r.z + r.d - 3) break;
      for (let h = 0; h < 5; h++) chairT.push({ x: sx, y: r.y + h * 0.62, z: sz, ry: 0.12 * h, stacked: true });
      colliders.push(aabb(sx - 1, sx + 1, r.y, r.y + 4.5, sz - 1, sz + 1));
    }
```

- [ ] **Step 2: Add a collider for every freestanding chair**

In `src/props.js`, find:
```js
  // merge the furniture batches
  if (chairT.length) {
    const mesh = new THREE.Mesh(placeAll(chairGeo, chairT), mats.chair);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
```
Replace with:
```js
  // freestanding chairs are now solid: a block up to seat height for upright
  // ones, lower for knocked-over ones (rx === PI/2), skipping storage stacks
  for (const t of chairT) {
    if (t.stacked) continue;
    const toppled = t.rx === Math.PI / 2;
    const h = toppled ? 0.9 : 1.5;
    colliders.push(aabb(t.x - 0.8, t.x + 0.8, t.y, t.y + h, t.z - 0.8, t.z + 0.8));
  }

  // merge the furniture batches
  if (chairT.length) {
    const mesh = new THREE.Mesh(placeAll(chairGeo, chairT), mats.chair);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
```

- [ ] **Step 3: Add the failing test**

In `scripts/smoke-physics.mjs`, find the test 8 block added in Task 1:
```js
// 8. table/boardroom-table hideVolumes are thin slabs, not floor-to-top blobs
{
  check(props.hideVolumes.length > 0, `hideVolumes populated (${props.hideVolumes.length})`);
  const thin = props.hideVolumes.every((v) => (v.y1 - v.y0) < 1);
  check(thin, 'every hideVolume is a thin slab (<1ft tall)');
}
```
Immediately after it, add:
```js

// 9. freestanding chairs are now solid (previously zero collision) — find one
// by its known footprint/height signature and confirm it registers a hit
{
  const chair = props.colliders.find((c) => Math.abs((c.x1 - c.x0) - 1.6) < 0.01 && Math.abs((c.y1 - c.y0) - 1.5) < 0.01);
  check(!!chair, 'an upright chair collider exists');
  if (chair) {
    const cx = (chair.x0 + chair.x1) / 2, cz = (chair.z0 + chair.z1) / 2;
    const p = fresh(cx, chair.y0, cz, 0);
    check(!!p.collides(p.pos.x, p.pos.y, p.pos.z), 'a chair position collides with its seat/leg block');
  }
}
```

- [ ] **Step 4: Run it and confirm it fails, then implement, then confirm it passes**

Run: `npm run check:physics`
Expected before Steps 1-2 are applied: `FAIL an upright chair collider exists` (no collider yet matches the 1.6/1.5 signature).
After Steps 1-2: `ok  an upright chair collider exists` and `ok  a chair position collides with its seat/leg block`, script ends `physics smoke test OK`.

(Apply Steps 1-2 first if you're reading this linearly — the point is: run once to see the chair checks fail, confirming they'd have caught the "chairs still walk-through" bug, then run again after the fix to see them pass.)

- [ ] **Step 5: Commit**

```bash
git add src/props.js scripts/smoke-physics.mjs
git commit -m "$(cat <<'EOF'
Give freestanding chairs real collision (previously walk-through)

Chairs had zero collider at all. Now every freestanding chair (not
part of a stacked pile) is a solid block up to seat height, low
enough to vault onto with a normal jump.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `Player` concealment flag

**Files:**
- Modify: `src/player.js`
- Modify: `scripts/smoke-physics.mjs`

**Interfaces:**
- Consumes: `hideVolumes` array shape from Task 1/2 (`{x0,x1,y0,y1,z0,z1}` objects).
- Produces: `new Player(camera, colliders, spawn, hideVolumes = [])` (4th constructor param, optional). `player.concealed: boolean`, updated every `update(dt, input)` call. `player.hiddenUnder(x, y, z): boolean` method.

- [ ] **Step 1: Accept `hideVolumes` in the constructor**

In `src/player.js`, find:
```js
  constructor(camera, colliders, spawn) {
    this.camera = camera;
    this.colliders = colliders;
    this.pos = new THREE.Vector3(spawn.x, spawn.y, spawn.z); // feet position
    this.vel = new THREE.Vector3();
    this.yaw = spawn.yaw ?? 0;
    this.pitch = 0;
    this.prone = false;
    this.height = STAND_H;
    this.eye = STAND_EYE;
    this.grounded = false;
    this.bobPhase = 0;
    this.stepAccum = 0;
    this.landDip = 0;
    this.noise = 0; // 0..1 how much sound the player is making (the entity's future hearing)
    this.onFootstep = null; // (running: bool) => void
    this.onLand = null; // (fallSpeed: number) => void
    this.keys = new Set();
  }
```
Replace with:
```js
  constructor(camera, colliders, spawn, hideVolumes = []) {
    this.camera = camera;
    this.colliders = colliders;
    this.hideVolumes = hideVolumes; // thin tabletop slabs the player can crouch under
    this.pos = new THREE.Vector3(spawn.x, spawn.y, spawn.z); // feet position
    this.vel = new THREE.Vector3();
    this.yaw = spawn.yaw ?? 0;
    this.pitch = 0;
    this.prone = false;
    this.height = STAND_H;
    this.eye = STAND_EYE;
    this.grounded = false;
    this.bobPhase = 0;
    this.stepAccum = 0;
    this.landDip = 0;
    this.noise = 0; // 0..1 how much sound the player is making (the entity's future hearing)
    this.concealed = false; // prone and tucked under a hide volume
    this.onFootstep = null; // (running: bool) => void
    this.onLand = null; // (fallSpeed: number) => void
    this.keys = new Set();
  }
```

- [ ] **Step 2: Add the `hiddenUnder` check**

In `src/player.js`, find:
```js
  // highest collider top within [y-probe, y] under the feet footprint
  groundAt(x, y, z) {
    const x0 = x - RADIUS, x1 = x + RADIUS;
    const z0 = z - RADIUS, z1 = z + RADIUS;
    let best = -Infinity;
    for (const c of this.colliders) {
      if (x0 < c.x1 && x1 > c.x0 && z0 < c.z1 && z1 > c.z0) {
        if (c.y1 <= y + 0.05 && c.y1 > best) best = c.y1;
      }
    }
    return best;
  }
```
Replace with:
```js
  // highest collider top within [y-probe, y] under the feet footprint
  groundAt(x, y, z) {
    const x0 = x - RADIUS, x1 = x + RADIUS;
    const z0 = z - RADIUS, z1 = z + RADIUS;
    let best = -Infinity;
    for (const c of this.colliders) {
      if (x0 < c.x1 && x1 > c.x0 && z0 < c.z1 && z1 > c.z0) {
        if (c.y1 <= y + 0.05 && c.y1 > best) best = c.y1;
      }
    }
    return best;
  }

  // true if the footprint at (x,z) sits under a hide volume's slab at height y
  hiddenUnder(x, y, z) {
    const x0 = x - RADIUS, x1 = x + RADIUS;
    const z0 = z - RADIUS, z1 = z + RADIUS;
    const top = y + this.height;
    for (const v of this.hideVolumes) {
      if (x0 < v.x1 && x1 > v.x0 && z0 < v.z1 && z1 > v.z0 && top <= v.y0 + 0.05) return true;
    }
    return false;
  }
```

- [ ] **Step 3: Compute `concealed` every frame**

In `src/player.js`, find:
```js
    // horizontal, one axis at a time, with step-up
    this.moveAxis('x', this.vel.x * dt);
    this.moveAxis('z', this.vel.z * dt);
```
Replace with:
```js
    // horizontal, one axis at a time, with step-up
    this.moveAxis('x', this.vel.x * dt);
    this.moveAxis('z', this.vel.z * dt);

    // concealment: prone and tucked beneath a hideable surface
    this.concealed = this.prone && this.hiddenUnder(this.pos.x, this.pos.y, this.pos.z);
```

- [ ] **Step 4: Thread `hideVolumes` through the smoke script's `fresh()` helper**

In `scripts/smoke-physics.mjs`, find:
```js
function fresh(x, y, z, yaw) {
  return new Player(camera, colliders, { x, y, z, yaw });
}
```
Replace with:
```js
function fresh(x, y, z, yaw, hideVolumes = []) {
  return new Player(camera, colliders, { x, y, z, yaw }, hideVolumes);
}
```

- [ ] **Step 5: Add the failing tests**

In `scripts/smoke-physics.mjs`, after test 9 (added in Task 3), add:
```js

// 10. crouching under a table slab is open and reads as concealed; you can't
// stand up there
{
  const v = props.hideVolumes[0];
  const cx = (v.x0 + v.x1) / 2 + 1.5, cz = (v.z0 + v.z1) / 2, floorY = v.y0 - 2.2;
  const p = fresh(cx, floorY, cz, 0, props.hideVolumes);
  simulate(p, idle(), 1);
  p.toggleProne();
  simulate(p, idle(), 0.5);
  check(!p.collides(p.pos.x, p.pos.y, p.pos.z), 'prone player fits under the table slab');
  check(p.concealed, 'prone player under a table reads as concealed');
  check(!p.headroom(5.9), 'cannot stand up under the tabletop slab (blocked)');
}

// 11. concealment is false out in the open
{
  const p = fresh(SPAWN.x, SPAWN.y, SPAWN.z, 0, props.hideVolumes);
  simulate(p, idle(), 1);
  p.toggleProne();
  simulate(p, idle(), 1);
  check(!p.concealed, 'prone in the open corridor is not concealed');
}
```

- [ ] **Step 6: Run it and confirm it fails, then implement, then confirm it passes**

Run: `npm run check:physics`
Expected before Steps 1-3: `FAIL prone player under a table reads as concealed` (and `p.concealed` is `undefined`, so `!p.concealed` in test 11 spuriously passes — the meaningful red signal is test 10).
After Steps 1-3: all of tests 10 and 11 print `ok`, script ends `physics smoke test OK`.

- [ ] **Step 7: Commit**

```bash
git add src/player.js scripts/smoke-physics.mjs
git commit -m "$(cat <<'EOF'
Add player.concealed: true when prone under a table's hide volume

No detection AI consumes this yet (the entity has no senses in this
phase) — this just makes the flag correct and testable so a future
stealth system has something real to key off.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Jump tuning

**Files:**
- Modify: `src/player.js`
- Modify: `scripts/smoke-physics.mjs`

**Interfaces:**
- Modifies the `JUMP_V` constant only; no signature changes.

- [ ] **Step 1: Tighten the jump-height assertion first (expect it to fail)**

In `scripts/smoke-physics.mjs`, find:
```js
  check(peak > MEZZ_Y + 1.5, `jump peak ${peak.toFixed(2)}ft above floor`);
```
Replace with:
```js
  check(peak > MEZZ_Y + 3.0, `jump peak ${peak.toFixed(2)}ft above floor (clears table/counter height)`);
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm run check:physics`
Expected: `FAIL jump peak 2.06ft above floor (clears table/counter height)` — current `JUMP_V = 12.5` only reaches `12.5^2 / (2*38) ≈ 2.06ft`, short of the 3.0ft counter-clearing bar.

- [ ] **Step 3: Raise `JUMP_V`**

In `src/player.js`, find:
```js
const JUMP_V = 12.5;
```
Replace with:
```js
const JUMP_V = 16;
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `npm run check:physics`
Expected: `ok  jump peak 3.37ft above floor (clears table/counter height)`, script ends `physics smoke test OK`.

- [ ] **Step 5: Commit**

```bash
git add src/player.js scripts/smoke-physics.mjs
git commit -m "$(cat <<'EOF'
Raise jump height to clear tabletop/counter height

JUMP_V 12.5 -> 16 (apex ~2.06ft -> ~3.37ft). No new mantle mechanic —
climbing onto furniture now works through the existing jump-arc +
forward-drift physics, now that furniture colliders (Tasks 1-3) don't
block horizontal approach at every height.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Wire it into the live game + concealment vignette

**Files:**
- Modify: `src/main.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: `buildProps(...).hideVolumes` (Task 1/2), `new Player(camera, colliders, spawn, hideVolumes)` and `player.concealed` (Task 4).

- [ ] **Step 1: Capture and thread `hideVolumes` in `main.js`**

In `src/main.js`, find:
```js
{
  const { group, colliders: c } = buildProps(floors, mats);
  scene.add(group);
  colliders.push(...c);
}
```
Replace with:
```js
let hideVolumes = [];
{
  const { group, colliders: c, hideVolumes: hv } = buildProps(floors, mats);
  scene.add(group);
  colliders.push(...c);
  hideVolumes = hv;
}
```

Then find:
```js
const player = new Player(camera, colliders, SPAWN);
```
Replace with:
```js
const player = new Player(camera, colliders, SPAWN, hideVolumes);
```

- [ ] **Step 2: Grab the vignette element**

In `src/main.js`, find:
```js
// --- input
const input = { keys: new Set(), jumpQueued: false };
const overlay = document.getElementById('overlay');
```
Replace with:
```js
// --- input
const input = { keys: new Set(), jumpQueued: false };
const overlay = document.getElementById('overlay');
const vignetteEl = document.getElementById('vignette');
```

- [ ] **Step 3: Toggle the concealment cue in the render loop**

In `src/main.js`, find:
```js
// --- loop
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (document.pointerLockElement === renderer.domElement) {
    player.update(dt, input);
    ghost.update(dt, player.pos);
  }
  lighting.update(dt, camera);
  renderer.render(scene, camera);
});
```
Replace with:
```js
// --- loop
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (document.pointerLockElement === renderer.domElement) {
    player.update(dt, input);
    ghost.update(dt, player.pos);
    vignetteEl.classList.toggle('concealed', player.concealed);
  }
  lighting.update(dt, camera);
  renderer.render(scene, camera);
});
```

- [ ] **Step 4: Add the darkened-vignette CSS variant**

In `index.html`, find:
```css
    #vignette {
      position: fixed; inset: 0; pointer-events: none; z-index: 3;
      background: radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%);
    }
```
Replace with:
```css
    #vignette {
      position: fixed; inset: 0; pointer-events: none; z-index: 3;
      background: radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%);
      transition: background 0.4s ease;
    }
    #vignette.concealed {
      background: radial-gradient(ellipse at center, transparent 28%, rgba(0,0,0,0.86) 100%);
    }
```

- [ ] **Step 5: Regression-check the headless scripts still pass**

Run: `npm run check:physics && npm run check:layout`
Expected: both end with their `OK` message (`physics smoke test OK`, `layout OK`). Neither script imports `main.js` or `index.html`, so this just confirms Tasks 1-5 are still intact.

- [ ] **Step 6: Manual browser verification (required — this task has no headless coverage)**

Run: `npm run dev`, open the printed local URL.

1. Click through the landing page and the Royal York case file to enter the game.
2. Walk to a room with round banquet tables — e.g. from spawn (corridor B) into the Ballroom, Canadian, or Salon A on the convention floor, or Confederation 5 / Tudor 8 on the mezzanine.
3. Press **C** to go prone and crawl underneath a table.
4. Confirm the screen vignette visibly darkens.
5. Open the browser devtools console and evaluate `window.__concierge.player.concealed` — confirm `true` while tucked under the table, `false` after standing back up (press C again) or walking away.
6. Approach a chair or a tabletop edge, press **Space**, and confirm the player lands on top of it rather than bouncing off the side.
7. Report back what you saw (vignette behavior, console value, whether the climb worked) before calling this task done.

- [ ] **Step 7: Commit**

```bash
git add src/main.js index.html
git commit -m "$(cat <<'EOF'
Wire hideVolumes into the live game and add a concealment vignette

Player now receives hideVolumes from buildProps; the screen vignette
darkens while player.concealed is true, so the (currently senseless)
concealment flag is visibly confirmable in-game.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
