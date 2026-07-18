// Layout builder: turns royal_york_meeting_floors_spec.json into positioned
// room rectangles for the Main Mezzanine (y=0) and Convention Floor (y=-26).
//
// Units: feet. +x = east, +z = south, +y = up.
// Room rects are INTERIOR space; walls are built 0.5ft thick outward from the
// rect edge, so adjacent rooms are placed with a 1ft gap between interiors.

export const WALL_T = 0.5; // wall thickness (each room owns 0.5ft outward)
export const GAP = 1.0; // interior-to-interior gap between adjacent rooms

export const MEZZ_Y = 0;
export const CONV_Y = -26; // spec says 18ft placeholder; 26ft clears the 24'5" Ballroom ceiling
export const MEZZ_CIRC_H = 10; // circulation-space ceiling height, mezzanine
export const CONV_CIRC_H = 14; // circulation-space ceiling height, convention floor

// ---------------------------------------------------------------------------
// spec lookup helpers
// ---------------------------------------------------------------------------

function indexFloor(floorSpec) {
  const byName = new Map();
  for (const band of floorSpec.bands) {
    for (const room of band.rooms) byName.set(room.name, room);
  }
  return byName;
}

function dims(byName, name) {
  const r = byName.get(name);
  if (!r) throw new Error(`room not in spec: ${name}`);
  return { run: r.run_ft, depth: r.depth_ft, h: r.ceiling_height_ft };
}

// ---------------------------------------------------------------------------
// room record factory
// ---------------------------------------------------------------------------
// door: { side: 'N'|'S'|'E'|'W', at?: number (ft from wall min-corner; centered
//         if omitted), w: opening width, ht: opening height }

let roomId = 0;
function room(name, x, z, w, d, h, doors, opts = {}) {
  return { id: roomId++, name, x, z, w, d, h, doors, ...opts };
}

// ---------------------------------------------------------------------------
// Main Mezzanine
// ---------------------------------------------------------------------------

export function buildMezzanine(spec) {
  const byName = indexFloor(spec.main_mezzanine_floor);
  const rooms = [];
  const B1S = 27.58; // band-1 south interior edge (deepest room depth)

  // --- band 1: north perimeter row, west to east, south edges aligned so
  // every door opens onto corridor A. Shallower rooms leave sealed voids
  // against the north exterior wall (invisible; matches jogging exterior).
  const band1Names = [
    'Confederation 3', 'Confederation 5', 'Confederation 6',
    'Tudor 7', 'Tudor 8', 'To Garage (passage)', 'Mens (west)',
    'Saskatchewan', 'Ladies (west)', 'Nova Scotia', 'New Brunswick',
    'Prince Edward Island', 'Newfoundland',
  ];
  let cx = 1;
  for (const name of band1Names) {
    const { run, depth, h } = dims(byName, name);
    const doors = [{ side: 'S', w: 5, ht: 8 }];
    if (name === 'Confederation 5') doors.push({ side: 'E', w: 8, ht: 8 }); // airwall to Conf 6
    if (name === 'Confederation 6') doors.push({ side: 'W', w: 8, ht: 8 });
    if (name === 'Tudor 7') doors.push({ side: 'E', w: 8, ht: 8 }); // airwall to Tudor 8
    if (name === 'Tudor 8') doors.push({ side: 'W', w: 8, ht: 8 });
    rooms.push(room(name, cx, B1S - depth, run, depth, h, doors, { style: styleFor(name) }));
    cx += run + GAP;
  }
  const mezzEast = cx; // ~377.7

  // corridor A: open strip z 28.08 .. 38.08 (between band-1 and band-2/3 walls)
  const bandCZ = B1S + 10 + GAP; // 38.58: interior north edge of bands 2/3

  // --- band 2: west back-of-house strip
  {
    let x = 1;
    for (const name of ['Medical Centre', 'Check Room (north)', 'Audio Visual Room', 'Kitchen (mezzanine)']) {
      const { run, depth, h } = dims(byName, name);
      rooms.push(room(name, x, bandCZ, run, depth, h, [{ side: 'N', w: 5, ht: 8 }], { style: styleFor(name) }));
      x += run + GAP;
    }
  }

  // --- band 3: central meeting rooms in three north-south columns with
  // walkable connector corridors between the columns.
  // column A (x 105..156.5): Boardroom over Territories
  {
    const bd = dims(byName, 'Boardroom');
    const te = dims(byName, 'Territories');
    rooms.push(room('Boardroom', 105, bandCZ, bd.run, bd.depth, bd.h,
      [{ side: 'N', w: 5, ht: 8 }], { style: 'boardroom' }));
    const teZ = bandCZ + bd.depth + GAP;
    rooms.push(room('Territories', 105, teZ, te.run, te.depth, te.h,
      [{ side: 'W', w: 6, ht: 8 }, { side: 'E', w: 6, ht: 8 }], { style: 'meeting' }));
  }
  // column B (x 165.5..222.1): Alberta / Quebec / British Columbia stacked N-S
  {
    const al = dims(byName, 'Alberta');
    const qc = dims(byName, 'Quebec');
    const bc = dims(byName, 'British Columbia');
    const zAl = bandCZ;
    const zQc = zAl + al.depth + GAP;
    const zBc = zQc + qc.depth + GAP;
    rooms.push(room('Alberta', 165.5, zAl, al.run, al.depth, al.h,
      [{ side: 'N', w: 5, ht: 8 }, { side: 'S', w: 8, ht: 8 }], { style: 'meeting' }));
    rooms.push(room('Quebec', 165.5, zQc, qc.run, qc.depth, qc.h,
      [{ side: 'N', w: 8, ht: 8 }, { side: 'S', w: 8, ht: 8 }, { side: 'W', w: 5, ht: 8 }], { style: 'meeting' }));
    rooms.push(room('British Columbia', 165.5, zBc, bc.run, bc.depth, bc.h,
      [{ side: 'N', w: 8, ht: 8 }, { side: 'S', w: 5, ht: 8 }], { style: 'meeting' }));
  }
  // column C (x 231..): Manitoba north, Algonquin south, washrooms east of them
  {
    const mb = dims(byName, 'Manitoba');
    const alg = dims(byName, 'Algonquin');
    rooms.push(room('Manitoba', 231, bandCZ, mb.run, mb.depth, mb.h,
      [{ side: 'N', w: 5, ht: 8 }], { style: 'meeting' }));
    const zAlg = bandCZ + mb.depth + GAP;
    rooms.push(room('Algonquin', 231, zAlg, alg.run, alg.depth, alg.h,
      [{ side: 'S', w: 5, ht: 8 }], { style: 'meeting' }));
    const me = dims(byName, 'Mens (east)');
    rooms.push(room('Mens (east)', 287.25, bandCZ, me.run, me.depth, me.h,
      [{ side: 'S', w: 3.5, ht: 7.5 }], { style: 'washroom' }));
    const le = dims(byName, 'Ladies (east)');
    rooms.push(room('Ladies (east)', 269.92, zAlg, le.run, le.depth, le.h,
      [{ side: 'E', w: 3.5, ht: 7.5 }], { style: 'washroom' }));
  }

  // corridor B: open strip z ~112.3 .. 130.5, full width
  const band4Z = 131; // interior north edge of band 4

  // --- band 4: south row, doors opening north onto corridor B
  {
    const order = [
      ['Library', 20], ['York', null], ['Executive Office', null],
      ['Reservation Office', null], ['York Station Bar', null], ['Sales/Catering Office', null],
    ];
    let x = 20;
    for (const [name] of order) {
      const { run, depth, h } = dims(byName, name);
      // Sales office shortened so the escalator well (x 180..234) stays clear.
      const w = name === 'Sales/Catering Office' ? 20 : run;
      rooms.push(room(name, x, band4Z, w, depth, h, [{ side: 'N', w: 5, ht: 8 }], { style: styleFor(name) }));
      x += w + GAP;
    }
  }

  const shell = { x0: 0, z0: -1, x1: mezzEast + 1, z1: 164, h: 13 };
  return { name: 'mezzanine', y: MEZZ_Y, circH: MEZZ_CIRC_H, rooms, shell };
}

// ---------------------------------------------------------------------------
// Convention Floor (local coords; offset applied so the escalator lines up)
// ---------------------------------------------------------------------------

export const CONV_OFFSET = { x: 14, z: 6 };

export function buildConvention(spec) {
  const byName = indexFloor(spec.convention_floor);
  const rooms = [];
  const o = CONV_OFFSET;

  // west hall: Concert Hall spans the north-south depth of the west side
  const ch = dims(byName, 'Concert Hall');
  rooms.push(room('Concert Hall', 0, 0, ch.depth, ch.run, ch.h, [
    { side: 'E', at: 58, w: 8, ht: 9 },
    { side: 'E', at: 118, w: 8, ht: 9 },
    { side: 'S', at: 16, w: 8, ht: 9 },
    { side: 'S', at: 44, w: 8, ht: 9 },
  ], { style: 'hall' }));

  // central band: kitchen along the north edge, washrooms just south of it,
  // check room near the escalators; everything else is open pre-function foyer.
  const kc = dims(byName, 'Kitchen (convention)');
  rooms.push(room('Kitchen', ch.depth + GAP, 0, kc.run, kc.depth, kc.h, [
    { side: 'S', at: 20, w: 5, ht: 8 },
    { side: 'S', at: 70, w: 5, ht: 8 },
  ], { style: 'kitchen' }));
  const lc = dims(byName, 'Ladies (convention)');
  rooms.push(room('Ladies', ch.depth + GAP, kc.depth + GAP, lc.run, lc.depth, lc.h,
    [{ side: 'S', w: 3.5, ht: 7.5 }], { style: 'washroom' }));
  const mc = dims(byName, 'Mens (convention)');
  rooms.push(room('Mens', ch.depth + GAP + lc.run + GAP, kc.depth + GAP, mc.run, mc.depth, mc.h,
    [{ side: 'S', w: 3.5, ht: 7.5 }], { style: 'washroom' }));
  const ck = dims(byName, 'Check Room (south)');
  rooms.push(room('Check Room', ch.depth + GAP, 150, ck.run, ck.depth, ck.h,
    [{ side: 'N', w: 4, ht: 7.5 }], { style: 'office' }));

  // east hall: Ontario north, Canadian running the full east edge
  const on = dims(byName, 'Ontario');
  const onX = 168.67;
  rooms.push(room('Ontario', onX, 0, on.depth, on.run, on.h, [
    { side: 'W', at: 20, w: 8, ht: 9 },
    { side: 'S', w: 8, ht: 9 },
  ], { style: 'hall' }));
  const ca = dims(byName, 'Canadian');
  const caX = 221.09;
  rooms.push(room('Canadian', caX, 0, ca.depth, ca.run, ca.h, [
    { side: 'W', at: 78, w: 8, ht: 9 },
    { side: 'W', at: 116, w: 8, ht: 9 },
    { side: 'W', at: 154, w: 8, ht: 9 },
    { side: 'S', at: 30, w: 8, ht: 9 },
  ], { style: 'hall' }));

  // south row: Salon B | Ballroom | Salon A | Toronto, south of a full-width
  // pre-function strip (the "Foyer (south, near Ballroom)").
  const rowZ = 196;
  const sb = dims(byName, 'Salon B');
  rooms.push(room('Salon B', 1, rowZ + 1, sb.run, sb.depth, sb.h,
    [{ side: 'N', w: 5, ht: 8 }, { side: 'E', w: 10, ht: 9 }], { style: 'salon' }));
  const br = dims(byName, 'Ballroom');
  const brX = 1 + sb.run + GAP;
  rooms.push(room('Ballroom', brX, rowZ, br.run, br.depth, br.h, [
    { side: 'N', at: 24, w: 9, ht: 9 },
    { side: 'N', at: 88, w: 9, ht: 9 },
    { side: 'W', w: 10, ht: 9 }, // airwall to Salon B
    { side: 'E', w: 10, ht: 9 }, // airwall to Salon A
  ], { style: 'ballroom' }));
  const sa = dims(byName, 'Salon A');
  const saX = brX + br.run + GAP;
  rooms.push(room('Salon A', saX, rowZ + 1, sa.run, sa.depth, sa.h,
    [{ side: 'N', w: 5, ht: 8 }, { side: 'W', w: 10, ht: 9 }], { style: 'salon' }));
  const to = dims(byName, 'Toronto');
  rooms.push(room('Toronto', saX + sa.run + GAP, rowZ + 1, to.run, to.depth, to.h,
    [{ side: 'N', w: 5, ht: 8 }], { style: 'meeting' }));

  // apply world offset
  for (const r of rooms) { r.x += o.x; r.z += o.z; }

  const shell = {
    x0: o.x - 1, z0: o.z - 1,
    x1: o.x + caX + ca.depth + 1, z1: o.z + rowZ + br.depth + 1.5,
    h: 26,
  };
  return { name: 'convention', y: CONV_Y, circH: CONV_CIRC_H, rooms, shell };
}

// ---------------------------------------------------------------------------
// Escalator well connecting the floors (world coords)
// ---------------------------------------------------------------------------
// Top landing on the mezzanine at x 180..186; steps descend eastward
// x 186..227.3 dropping 26ft; bottom landing x 227.3..233.3 flush with the
// convention floor, emerging into the pre-function foyer near Toronto.

export const ESCALATOR = {
  z0: 131.5, z1: 142.5,
  topLanding: { x0: 180, x1: 186 },
  stepsX0: 186, stepsX1: 227.3,
  bottomLanding: { x0: 227.3, x1: 233.3 },
  nSteps: 34,
  drop: MEZZ_Y - CONV_Y,
  // channels: two escalators separated by a center balustrade
  channels: [ { z0: 132.3, z1: 136.3 }, { z0: 137.7, z1: 141.7 } ],
  // hole cut in the mezzanine floor slab (and convention circulation ceiling)
  hole: { x0: 186, x1: 234, z0: 131.5, z1: 142.5 },
};

// oval planter landmark in the mezzanine's corridor B ("central feature")
export const OVAL = { cx: 160, cz: 121.4, rx: 15, rz: 5, h: 2.2 };

export const SPAWN = { x: 183, y: MEZZ_Y, z: 137, yaw: Math.PI / 2 }; // top landing, facing west

// ---------------------------------------------------------------------------

function styleFor(name) {
  if (/Mens|Ladies/.test(name)) return 'washroom';
  if (/Kitchen/.test(name)) return 'kitchen';
  if (/Office|Check Room|Medical|Audio|Garage|Reservation/.test(name)) return 'office';
  if (/Library/.test(name)) return 'library';
  if (/Bar/.test(name)) return 'bar';
  return 'meeting';
}

export function buildFloors(spec) {
  roomId = 0;
  return [buildMezzanine(spec), buildConvention(spec)];
}
