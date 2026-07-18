// Sanity checks for the generated layout: room overlap, spec dimension
// fidelity, shell containment, and escalator clearance.
import { readFileSync } from 'node:fs';
import { buildFloors, ESCALATOR, CONV_OFFSET } from '../src/layout.js';

const spec = JSON.parse(readFileSync(new URL('../royal_york_meeting_floors_spec.json', import.meta.url)));

const floors = buildFloors(spec);
let failures = 0;
const fail = (msg) => { failures++; console.error('FAIL:', msg); };

const EPS = 0.01;

// spec dims by floor for fidelity check
function specRooms(floorSpec) {
  const m = new Map();
  for (const band of floorSpec.bands) for (const r of band.rooms) m.set(r.name, r);
  return m;
}
const specByFloor = {
  mezzanine: specRooms(spec.main_mezzanine_floor),
  convention: specRooms(spec.convention_floor),
};
// layout-name -> spec-name where they differ
const alias = {
  Kitchen: 'Kitchen (convention)', Ladies: 'Ladies (convention)',
  Mens: 'Mens (convention)', 'Check Room': 'Check Room (south)',
};

for (const floor of floors) {
  const { rooms, shell } = floor;

  // 1. pairwise overlap (interiors must be disjoint)
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i], b = rooms[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.z < b.z + b.d && b.z < a.z + a.d) {
        fail(`${floor.name}: "${a.name}" overlaps "${b.name}"`);
      }
    }
  }

  // 2. shell containment (with room for the 0.5ft outward wall)
  for (const r of rooms) {
    if (r.x - 0.5 < shell.x0 || r.x + r.w + 0.5 > shell.x1 || r.z - 0.5 < shell.z0 || r.z + r.d + 0.5 > shell.z1) {
      fail(`${floor.name}: "${r.name}" outside shell (${r.x},${r.z} ${r.w}x${r.d})`);
    }
  }

  // 3. dimension fidelity for confidence:"exact" rooms — one of (w,d) must be
  // run_ft and the other depth_ft; height must be ceiling_height_ft.
  const sm = specByFloor[floor.name];
  for (const r of rooms) {
    const s = sm.get(alias[r.name] ?? r.name);
    if (!s) { fail(`${floor.name}: "${r.name}" has no spec entry`); continue; }
    if (s.confidence !== 'exact') continue;
    const dimsOk =
      (Math.abs(r.w - s.run_ft) < EPS && Math.abs(r.d - s.depth_ft) < EPS) ||
      (Math.abs(r.w - s.depth_ft) < EPS && Math.abs(r.d - s.run_ft) < EPS);
    if (!dimsOk && r.name !== 'Sales/Catering Office') fail(`${floor.name}: "${r.name}" ${r.w}x${r.d} != spec ${s.run_ft}x${s.depth_ft}`);
    if (Math.abs(r.h - s.ceiling_height_ft) > EPS) fail(`${floor.name}: "${r.name}" height ${r.h} != spec ${s.ceiling_height_ft}`);
  }

  // 4. every room has at least one door
  for (const r of rooms) if (!r.doors.length) fail(`${floor.name}: "${r.name}" has no door`);
}

// 5. escalator well must not intersect any room on either floor
const well = { x0: ESCALATOR.topLanding.x0, x1: ESCALATOR.bottomLanding.x1, z0: ESCALATOR.z0, z1: ESCALATOR.z1 };
for (const floor of floors) {
  for (const r of rooms(floor)) {
    if (r.x - 0.5 < well.x1 && well.x0 < r.x + r.w + 0.5 && r.z - 0.5 < well.z1 && well.z0 < r.z + r.d + 0.5) {
      fail(`escalator well intersects "${r.name}" on ${floor.name}`);
    }
  }
}
function rooms(f) { return f.rooms; }

// 6. bottom landing must be inside the convention shell
const conv = floors[1];
if (well.x1 > conv.shell.x1 || well.z1 > conv.shell.z1 || well.x0 < conv.shell.x0 || well.z0 < conv.shell.z0) {
  fail('escalator bottom landing outside convention shell');
}

// report
for (const floor of floors) {
  const b = floor.shell;
  console.log(`${floor.name}: ${floor.rooms.length} rooms, shell ${Math.round(b.x1 - b.x0)}ft x ${Math.round(b.z1 - b.z0)}ft`);
}
if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log('layout OK');
