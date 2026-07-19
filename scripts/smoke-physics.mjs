// Headless physics playtest: builds the real colliders and walks the player
// through the hotel — corridor B, down the escalator, into the Ballroom.
// Stubs just enough DOM for the texture/canvas code to load under Node.
import { readFileSync } from 'node:fs';

const noopCtx = new Proxy({}, {
  get: (t, p) => {
    if (p === 'measureText') return () => ({ width: 10 });
    if (p === 'createRadialGradient' || p === 'createLinearGradient') return () => ({ addColorStop() {} });
    return () => {};
  },
  set: () => true,
});
globalThis.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => noopCtx, style: {} }),
  createElementNS: () => ({ style: {} }),
};
globalThis.window = globalThis;
globalThis.performance ??= { now: () => Date.now() };

const spec = JSON.parse(readFileSync(new URL('../royal_york_meeting_floors_spec.json', import.meta.url)));
const { buildFloors, SPAWN, MEZZ_Y, CONV_Y } = await import('../src/layout.js');
const { makeMaterials } = await import('../src/textures.js');
const { buildFloor, buildEscalator, buildOval } = await import('../src/world.js');
const { buildProps } = await import('../src/props.js');
const { Player } = await import('../src/player.js');
const THREE = await import('three');

const mats = makeMaterials();
const floors = buildFloors(spec);
const colliders = [];
for (const f of floors) colliders.push(...buildFloor(f, mats).colliders);
colliders.push(...buildEscalator(mats).colliders);
colliders.push(...buildOval(mats).colliders);
const props = buildProps(floors, mats);
colliders.push(...props.colliders);
console.log(`colliders: ${colliders.length}, props colliders: ${props.colliders.length}, hideVolumes: ${props.hideVolumes.length}`);

const camera = new THREE.PerspectiveCamera();
let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) failures++;
};

function simulate(player, input, seconds) {
  const dt = 1 / 60;
  for (let i = 0; i < seconds * 60; i++) player.update(dt, input);
}
function fresh(x, y, z, yaw, hideVolumes = []) {
  return new Player(camera, colliders, { x, y, z, yaw }, hideVolumes);
}
const idle = () => ({ keys: new Set(), jumpQueued: false });
const forward = () => ({ keys: new Set(['KeyW']), jumpQueued: false });

// 1. spawn settles on the mezzanine floor and isn't inside any wall
{
  const p = fresh(SPAWN.x, SPAWN.y + 2, SPAWN.z, SPAWN.yaw);
  simulate(p, idle(), 2);
  check(Math.abs(p.pos.y - MEZZ_Y) < 0.01, `spawn settles at mezzanine floor (y=${p.pos.y.toFixed(2)})`);
  check(!p.collides(p.pos.x, p.pos.y, p.pos.z), 'spawn position is not inside a collider');
}

// 2. corridor B is walkable west for 80+ ft (route passes south of the planter)
{
  const p = fresh(177, MEZZ_Y, 128, Math.PI / 2); // facing -x
  simulate(p, forward(), 15);
  check(p.pos.x < 100, `walked west along corridor B (x=${p.pos.x.toFixed(1)})`);
  check(Math.abs(p.pos.y - MEZZ_Y) < 0.01, `stayed on the mezzanine floor (y=${p.pos.y.toFixed(2)})`);
}

// 3. walking east from the top landing descends the escalator to the convention floor
{
  const p = fresh(183, MEZZ_Y, 134.3, -Math.PI / 2); // facing +x, in channel A
  simulate(p, forward(), 20);
  check(Math.abs(p.pos.y - CONV_Y) < 0.01, `descended escalator to convention floor (y=${p.pos.y.toFixed(2)})`);
  check(p.pos.x > 227, `reached the bottom landing (x=${p.pos.x.toFixed(1)})`);
}

// 4. and back up again (step-up logic climbs the 0.76ft risers)
{
  const p = fresh(231, CONV_Y, 134.3, Math.PI / 2); // facing -x
  simulate(p, forward(), 25);
  check(Math.abs(p.pos.y - MEZZ_Y) < 0.01, `climbed escalator back to mezzanine (y=${p.pos.y.toFixed(2)})`);
}

// 5. south from the bottom landing into the pre-function strip, then the Ballroom door
{
  const p = fresh(230, CONV_Y, 140, Math.PI); // facing +z (south)
  simulate(p, forward(), 10);
  check(p.pos.z > 180, `walked south into the pre-function foyer (z=${p.pos.z.toFixed(1)})`);
  check(Math.abs(p.pos.y - CONV_Y) < 0.01, 'stayed on the convention floor');
}

// 6. walls actually block: walking north in the east foyer into Algonquin's wall
{
  const p = fresh(240, MEZZ_Y, 121, 0); // facing -z (north)
  simulate(p, forward(), 6);
  check(p.pos.z > 84 && p.pos.z < 95, `Algonquin south wall stopped the player (z=${p.pos.z.toFixed(1)})`);
}

// 7. prone lowers the eye, jump leaves the ground
{
  const p = fresh(SPAWN.x, SPAWN.y, SPAWN.z, 0);
  simulate(p, idle(), 1);
  p.toggleProne();
  simulate(p, idle(), 1);
  check(p.eye < 2, `prone eye height (${p.eye.toFixed(2)})`);
  p.toggleProne();
  simulate(p, idle(), 1);
  const input = idle();
  input.jumpQueued = true;
  let peak = 0;
  const dt = 1 / 60;
  for (let i = 0; i < 90; i++) { p.update(dt, input); peak = Math.max(peak, p.pos.y); }
  check(peak > MEZZ_Y + 3.0, `jump peak ${peak.toFixed(2)}ft above floor (clears table/counter height)`);
  check(Math.abs(p.pos.y - MEZZ_Y) < 0.01, 'landed after jump');
}

// 8. table/boardroom-table hideVolumes are thin slabs, not floor-to-top blobs
{
  check(props.hideVolumes.length > 0, `hideVolumes populated (${props.hideVolumes.length})`);
  const thin = props.hideVolumes.every((v) => (v.y1 - v.y0) < 1);
  check(thin, 'every hideVolume is a thin slab (<1ft tall)');
}

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

// 10. crouching under a table slab is open and reads as concealed; you can't
// stand up there
{
  const v = props.hideVolumes[0];
  const cx = (v.x0 + v.x1) / 2 + 2.0, cz = (v.z0 + v.z1) / 2, floorY = v.y0 - 2.2;
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

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log('physics smoke test OK');
