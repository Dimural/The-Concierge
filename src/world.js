// Builds renderable geometry + collision AABBs from the layout.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WALL_T, ESCALATOR, OVAL, MEZZ_Y, CONV_Y } from './layout.js';
import { plaqueTexture } from './textures.js';

const T = WALL_T;

// collect BoxGeometry per material key, merge once at the end
function makeCollector() {
  return { geos: new Map() };
}
function addBox(col, mat, x0, x1, y0, y1, z0, z1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  if (!col.geos.has(mat)) col.geos.set(mat, []);
  col.geos.get(mat).push(g);
}
function flush(col, mats, group, { shadows = true } = {}) {
  for (const [key, list] of col.geos) {
    const merged = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, mats[key]);
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
}

const aabb = (x0, x1, y0, y1, z0, z1) => ({ x0, x1, y0, y1, z0, z1 });

const FLOOR_STYLE = {
  hall: 'wood', ballroom: 'wood', salon: 'wood', bar: 'wood',
  kitchen: 'tile', washroom: 'tile',
  office: 'corridorFloor', library: 'roomCarpet', boardroom: 'roomCarpet', meeting: 'roomCarpet',
};

// ---------------------------------------------------------------------------

export function buildFloor(floor, mats) {
  const group = new THREE.Group();
  const colliders = [];
  const col = makeCollector();
  const y = floor.y;
  const { shell } = floor;

  for (const r of floor.rooms) {
    const H = Math.max(r.h + 1, floor.circH);
    for (const side of ['N', 'S', 'E', 'W']) {
      buildWall(r, side, y, H, col, colliders);
    }
    // room ceiling slab
    addBox(col, r.style === 'hall' || r.style === 'ballroom' ? 'plasterCeiling' : 'ceiling',
      r.x - T, r.x + r.w + T, y + r.h, y + r.h + 0.5, r.z - T, r.z + r.d + T);
    if (r.h < 9.2) colliders.push(aabb(r.x, r.x + r.w, y + r.h, y + r.h + 0.5, r.z, r.z + r.d));
    // room floor overlay (slightly above the slab to avoid z-fighting)
    const fs = FLOOR_STYLE[r.style] ?? 'roomCarpet';
    addBox(col, fs, r.x, r.x + r.w, y + 0.02, y + 0.07, r.z, r.z + r.d);
    // door frames + name plaque
    addDoorTrim(r, y, col);
    addPlaque(r, y, group);
  }

  // exterior shell walls
  const s = shell;
  addBox(col, 'shellWall', s.x0 - 1, s.x1 + 1, y, y + s.h, s.z0 - 1, s.z0);
  addBox(col, 'shellWall', s.x0 - 1, s.x1 + 1, y, y + s.h, s.z1, s.z1 + 1);
  addBox(col, 'shellWall', s.x0 - 1, s.x0, y, y + s.h, s.z0, s.z1);
  addBox(col, 'shellWall', s.x1, s.x1 + 1, y, y + s.h, s.z0, s.z1);
  colliders.push(
    aabb(s.x0 - 1, s.x1 + 1, y, y + s.h, s.z0 - 1, s.z0),
    aabb(s.x0 - 1, s.x1 + 1, y, y + s.h, s.z1, s.z1 + 1),
    aabb(s.x0 - 1, s.x0, y, y + s.h, s.z0, s.z1),
    aabb(s.x1, s.x1 + 1, y, y + s.h, s.z0, s.z1),
  );

  // floor slab (mezzanine gets the escalator hole)
  const holes = floor.name === 'mezzanine' ? [ESCALATOR.hole] : [];
  group.add(slabMesh(s, holes, y, mats[floor.name === 'mezzanine' ? 'corridorFloor' : 'marble'], false));
  for (const rect of subtractRects({ x0: s.x0, x1: s.x1, z0: s.z0, z1: s.z1 }, holes)) {
    colliders.push(aabb(rect.x0, rect.x1, y - 1, y, rect.z0, rect.z1));
  }

  // circulation ceiling over everything that is not a room (or the well)
  const circHoles = floor.rooms.map((r) => ({ x0: r.x, x1: r.x + r.w, z0: r.z, z1: r.z + r.d }));
  if (floor.name === 'convention') circHoles.push(ESCALATOR.hole);
  group.add(slabMesh(s, circHoles, y + floor.circH, mats.ceiling, true));

  flush(col, mats, group);
  return { group, colliders };
}

function buildWall(r, side, y, H, col, colliders) {
  const horizontal = side === 'N' || side === 'S';
  const len0 = horizontal ? r.x - T : r.z - T;
  const len1 = horizontal ? r.x + r.w + T : r.z + r.d + T;
  const roomLen = horizontal ? r.w : r.d;
  // fixed (thickness) axis range
  let t0, t1;
  if (side === 'N') { t0 = r.z - T; t1 = r.z; }
  else if (side === 'S') { t0 = r.z + r.d; t1 = r.z + r.d + T; }
  else if (side === 'W') { t0 = r.x - T; t1 = r.x; }
  else { t0 = r.x + r.w; t1 = r.x + r.w + T; }

  const doors = r.doors
    .filter((d) => d.side === side)
    .map((d) => {
      const at = d.at ?? (roomLen - d.w) / 2;
      const base = horizontal ? r.x : r.z;
      return { a: base + at, b: base + at + d.w, ht: d.ht };
    })
    .sort((p, q) => p.a - q.a);

  const put = (a, b, y0, y1) => {
    if (b - a < 0.01 || y1 - y0 < 0.01) return;
    if (horizontal) { addBox(col, 'wall', a, b, y0, y1, t0, t1); colliders.push(aabb(a, b, y0, y1, t0, t1)); }
    else { addBox(col, 'wall', t0, t1, y0, y1, a, b); colliders.push(aabb(t0, t1, y0, y1, a, b)); }
  };

  let cursor = len0;
  for (const d of doors) {
    put(cursor, d.a, y, y + H);
    put(d.a, d.b, y + d.ht, y + H); // header above the opening
    cursor = d.b;
  }
  put(cursor, len1, y, y + H);
}

function addDoorTrim(r, y, col) {
  for (const d of r.doors) {
    const horizontal = d.side === 'N' || d.side === 'S';
    const roomLen = horizontal ? r.w : r.d;
    const at = d.at ?? (roomLen - d.w) / 2;
    const a = (horizontal ? r.x : r.z) + at;
    const b = a + d.w;
    let t0, t1;
    if (d.side === 'N') { t0 = r.z - T - 0.1; t1 = r.z + 0.1; }
    else if (d.side === 'S') { t0 = r.z + r.d - 0.1; t1 = r.z + r.d + T + 0.1; }
    else if (d.side === 'W') { t0 = r.x - T - 0.1; t1 = r.x + 0.1; }
    else { t0 = r.x + r.w - 0.1; t1 = r.x + r.w + T + 0.1; }
    if (horizontal) {
      addBox(col, 'trim', a - 0.35, a, y, y + d.ht + 0.35, t0, t1);
      addBox(col, 'trim', b, b + 0.35, y, y + d.ht + 0.35, t0, t1);
      addBox(col, 'trim', a, b, y + d.ht, y + d.ht + 0.35, t0, t1);
    } else {
      addBox(col, 'trim', t0, t1, y, y + d.ht + 0.35, a - 0.35, a);
      addBox(col, 'trim', t0, t1, y, y + d.ht + 0.35, b, b + 0.35);
      addBox(col, 'trim', t0, t1, y + d.ht, y + d.ht + 0.35, a, b);
    }
  }
}

function addPlaque(r, y, group) {
  const d = r.doors[0];
  if (!d) return;
  const horizontal = d.side === 'N' || d.side === 'S';
  const roomLen = horizontal ? r.w : r.d;
  const at = d.at ?? (roomLen - d.w) / 2;
  const center = Math.min(at + d.w + 2.6, roomLen - 2);
  const tex = plaqueTexture(r.name);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.2),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }),
  );
  const e = 0.06;
  if (d.side === 'N') { mesh.position.set(r.x + center, y + 5.3, r.z - T - e); mesh.rotation.y = Math.PI; }
  else if (d.side === 'S') { mesh.position.set(r.x + center, y + 5.3, r.z + r.d + T + e); }
  else if (d.side === 'W') { mesh.position.set(r.x - T - e, y + 5.3, r.z + center); mesh.rotation.y = -Math.PI / 2; }
  else { mesh.position.set(r.x + r.w + T + e, y + 5.3, r.z + center); mesh.rotation.y = Math.PI / 2; }
  group.add(mesh);
}

// horizontal slab (floor or ceiling) as a shape with rectangular holes
function slabMesh(s, holes, yAt, material, isCeiling) {
  const shape = new THREE.Shape();
  shape.moveTo(s.x0 - 1, s.z0 - 1);
  shape.lineTo(s.x1 + 1, s.z0 - 1);
  shape.lineTo(s.x1 + 1, s.z1 + 1);
  shape.lineTo(s.x0 - 1, s.z1 + 1);
  shape.closePath();
  for (const h of holes) {
    const p = new THREE.Path();
    p.moveTo(h.x0, h.z0);
    p.lineTo(h.x1, h.z0);
    p.lineTo(h.x1, h.z1);
    p.lineTo(h.x0, h.z1);
    p.closePath();
    shape.holes.push(p);
  }
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(Math.PI / 2); // shape XY -> world XZ
  // fix UVs so textures tile in world feet
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = yAt;
  mesh.receiveShadow = true;
  if (isCeiling) mesh.castShadow = false;
  return mesh;
}

// subtract hole rects from a rect -> list of solid rects (for floor colliders)
function subtractRects(rect, holes) {
  let solids = [rect];
  for (const h of holes) {
    const next = [];
    for (const r of solids) {
      if (h.x1 <= r.x0 || h.x0 >= r.x1 || h.z1 <= r.z0 || h.z0 >= r.z1) { next.push(r); continue; }
      if (r.z0 < h.z0) next.push({ x0: r.x0, x1: r.x1, z0: r.z0, z1: h.z0 });
      if (h.z1 < r.z1) next.push({ x0: r.x0, x1: r.x1, z0: h.z1, z1: r.z1 });
      const zi0 = Math.max(r.z0, h.z0), zi1 = Math.min(r.z1, h.z1);
      if (r.x0 < h.x0) next.push({ x0: r.x0, x1: h.x0, z0: zi0, z1: zi1 });
      if (h.x1 < r.x1) next.push({ x0: h.x1, x1: r.x1, z0: zi0, z1: zi1 });
    }
    solids = next;
  }
  return solids;
}

// ---------------------------------------------------------------------------
// Escalator well between the floors
// ---------------------------------------------------------------------------

export function buildEscalator(mats) {
  const group = new THREE.Group();
  const colliders = [];
  const col = makeCollector();
  const E = ESCALATOR;
  const run = E.stepsX1 - E.stepsX0;
  const tread = run / E.nSteps;
  const rise = E.drop / E.nSteps;

  for (const ch of E.channels) {
    for (let i = 0; i < E.nSteps; i++) {
      const x0 = E.stepsX0 + i * tread;
      const x1 = x0 + tread;
      const top = MEZZ_Y - rise * (i + 1);
      // solid to below the convention floor so the underside reads as mass
      addBox(col, 'metal', x0, x1, CONV_Y - 0.5, top, ch.z0, ch.z1);
      colliders.push(aabb(x0, x1, CONV_Y - 0.5, top, ch.z0, ch.z1));
      // riser lip
      addBox(col, 'darkMetal', x0, x0 + 0.12, top, top + 0.06, ch.z0, ch.z1);
    }
  }
  // per-step side balustrades + center divider (collision keeps player in channel)
  for (let i = 0; i < E.nSteps; i++) {
    const x0 = E.stepsX0 + i * tread;
    const x1 = x0 + tread;
    const top = MEZZ_Y - rise * (i + 1);
    for (const [z0, z1] of [[E.z0 + 0.45, E.channels[0].z0], [E.channels[0].z1, E.channels[1].z0], [E.channels[1].z1, E.z1 - 0.45]]) {
      addBox(col, 'darkMetal', x0, x1, top, top + 3.1, z0, z1);
      colliders.push(aabb(x0, x1, top, top + 3.1, z0, z1));
    }
  }
  // guard rails around the well opening at mezzanine level
  const gx1 = E.hole.x1 + 0.4;
  addBox(col, 'darkMetal', E.stepsX0, gx1, MEZZ_Y, MEZZ_Y + 3.5, E.z0 - 0.4, E.z0);
  addBox(col, 'darkMetal', E.stepsX0, gx1, MEZZ_Y, MEZZ_Y + 3.5, E.z1, E.z1 + 0.4);
  addBox(col, 'darkMetal', E.hole.x1, gx1, MEZZ_Y, MEZZ_Y + 3.5, E.z0 - 0.4, E.z1 + 0.4);
  colliders.push(
    aabb(E.stepsX0, gx1, MEZZ_Y, MEZZ_Y + 3.5, E.z0 - 0.4, E.z0),
    aabb(E.stepsX0, gx1, MEZZ_Y, MEZZ_Y + 3.5, E.z1, E.z1 + 0.4),
    aabb(E.hole.x1, gx1, MEZZ_Y, MEZZ_Y + 3.5, E.z0 - 0.4, E.z1 + 0.4),
  );
  // shaft enclosure between convention ceiling and mezzanine floor
  const convCeil = CONV_Y + 14;
  addBox(col, 'shellWall', E.hole.x0, E.hole.x1, convCeil, MEZZ_Y, E.z0 - 0.5, E.z0);
  addBox(col, 'shellWall', E.hole.x0, E.hole.x1, convCeil, MEZZ_Y, E.z1, E.z1 + 0.5);
  addBox(col, 'shellWall', E.hole.x1, E.hole.x1 + 0.5, convCeil, MEZZ_Y, E.z0 - 0.5, E.z1 + 0.5);

  flush(col, mats, group);
  return { group, colliders };
}

// ---------------------------------------------------------------------------
// Oval planter landmark, mezzanine corridor B
// ---------------------------------------------------------------------------

export function buildOval(mats) {
  const group = new THREE.Group();
  const colliders = [];
  const O = OVAL;

  const outer = new THREE.Shape();
  outer.absellipse(0, 0, O.rx, O.rz, 0, Math.PI * 2);
  const inner = new THREE.Path();
  inner.absellipse(0, 0, O.rx - 1.2, O.rz - 1.2, 0, Math.PI * 2);
  outer.holes.push(inner);
  const ring = new THREE.Mesh(
    new THREE.ExtrudeGeometry(outer, { depth: O.h, bevelEnabled: false }),
    mats.marble,
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(O.cx, MEZZ_Y, O.cz);
  ring.castShadow = ring.receiveShadow = true;
  group.add(ring);

  // dry soil bed
  const soil = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 0.3, 24),
    new THREE.MeshStandardMaterial({ color: 0x181310, roughness: 1 }),
  );
  soil.scale.set(O.rx - 1.2, 1, O.rz - 1.2);
  soil.position.set(O.cx, MEZZ_Y + O.h - 0.4, O.cz);
  group.add(soil);

  // dead palm remains
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.22, 5 + (i % 3), 6),
      new THREE.MeshStandardMaterial({ color: 0x2c2216, roughness: 1 }),
    );
    trunk.position.set(O.cx + Math.cos(a) * (O.rx * 0.45), MEZZ_Y + O.h + 2, O.cz + Math.sin(a) * (O.rz * 0.45));
    trunk.rotation.z = Math.sin(a * 3) * 0.35;
    trunk.castShadow = true;
    group.add(trunk);
  }

  colliders.push(
    aabb(O.cx - O.rx * 0.55, O.cx + O.rx * 0.55, MEZZ_Y, MEZZ_Y + O.h, O.cz - O.rz, O.cz + O.rz),
    aabb(O.cx - O.rx, O.cx + O.rx, MEZZ_Y, MEZZ_Y + O.h, O.cz - O.rz * 0.6, O.cz + O.rz * 0.6),
  );
  return { group, colliders };
}
