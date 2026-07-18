// Abandoned furnishings: banquet tables and chairs, the Concert Hall stage,
// kitchen counters, stacked chairs, fallen ceiling tiles.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// deterministic rng so the wreckage is stable between sessions
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const aabb = (x0, x1, y0, y1, z0, z1) => ({ x0, x1, y0, y1, z0, z1 });

function chairGeometry() {
  const parts = [];
  const box = (w, h, d, x, y, z) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    parts.push(g);
  };
  box(1.5, 0.15, 1.5, 0, 1.45, 0); // seat
  box(1.5, 1.9, 0.14, 0, 2.4, -0.68); // back
  for (const sx of [-0.62, 0.62]) for (const sz of [-0.62, 0.62]) box(0.1, 1.4, 0.1, sx, 0.7, sz);
  return mergeGeometries(parts, false);
}

function tableGeometry() {
  const top = new THREE.CylinderGeometry(3, 3, 0.15, 18);
  top.translate(0, 2.45, 0);
  const stem = new THREE.CylinderGeometry(0.18, 0.18, 2.4, 8);
  stem.translate(0, 1.2, 0);
  const foot = new THREE.CylinderGeometry(1.2, 1.3, 0.12, 12);
  foot.translate(0, 0.06, 0);
  return mergeGeometries([top, stem, foot], false);
}

function placeAll(baseGeo, transforms) {
  const m = new THREE.Matrix4();
  const geos = transforms.map(({ x, y, z, ry = 0, rx = 0, rz = 0 }) => {
    const g = baseGeo.clone();
    m.makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
    m.setPosition(x, y, z);
    g.applyMatrix4(m);
    return g;
  });
  return mergeGeometries(geos, false);
}

export function buildProps(floors, mats) {
  const group = new THREE.Group();
  const colliders = [];
  const rand = mulberry32(1887); // the year construction of the Queen's Hotel predecessor era began — any fixed seed
  const chairGeo = chairGeometry();
  const tableGeo = tableGeometry();

  const roomByName = new Map();
  for (const f of floors) for (const r of f.rooms) roomByName.set(`${f.name}:${r.name}`, { ...r, y: f.y });

  const chairT = [];
  const tableT = [];
  const clothT = []; // toppled tables keep same geometry, different tilt

  function banquetSetup(key, nTables, topple = 0.2) {
    const r = roomByName.get(key);
    if (!r) return;
    const cols = Math.ceil(Math.sqrt(nTables * (r.w / r.d)));
    const rows = Math.ceil(nTables / cols);
    let placed = 0;
    for (let i = 0; i < cols && placed < nTables; i++) {
      for (let j = 0; j < rows && placed < nTables; j++) {
        if (rand() < 0.18) continue; // gaps where tables were removed
        const x = r.x + ((i + 0.5) / cols) * r.w + (rand() - 0.5) * 3;
        const z = r.z + ((j + 0.5) / rows) * r.d + (rand() - 0.5) * 3;
        placed++;
        if (rand() < topple) {
          clothT.push({ x, y: r.y + 1.3, z, rz: Math.PI / 2, ry: rand() * Math.PI });
        } else {
          tableT.push({ x, y: r.y, z });
          colliders.push(aabb(x - 2.7, x + 2.7, r.y, r.y + 2.5, z - 2.7, z + 2.7));
          const n = 2 + Math.floor(rand() * 4);
          for (let k = 0; k < n; k++) {
            const a = rand() * Math.PI * 2;
            const cx = x + Math.cos(a) * 4.3, cz = z + Math.sin(a) * 4.3;
            if (cx < r.x + 1 || cx > r.x + r.w - 1 || cz < r.z + 1 || cz > r.z + r.d - 1) continue;
            if (rand() < 0.25) chairT.push({ x: cx, y: r.y + 0.8, z: cz, rx: Math.PI / 2, ry: rand() * Math.PI * 2 });
            else chairT.push({ x: cx, y: r.y, z: cz, ry: -a + Math.PI / 2 + (rand() - 0.5) });
          }
        }
      }
    }
    // stacked chairs along the west wall
    for (let s = 0; s < 3; s++) {
      const sx = r.x + 2.2, sz = r.z + 6 + s * 5;
      if (sz > r.z + r.d - 3) break;
      for (let h = 0; h < 5; h++) chairT.push({ x: sx, y: r.y + h * 0.62, z: sz, ry: 0.12 * h });
      colliders.push(aabb(sx - 1, sx + 1, r.y, r.y + 4.5, sz - 1, sz + 1));
    }
  }

  banquetSetup('convention:Ballroom', 12, 0.25);
  banquetSetup('convention:Canadian', 16, 0.15);
  banquetSetup('convention:Salon A', 4);
  banquetSetup('mezzanine:Confederation 5', 4);
  banquetSetup('mezzanine:Tudor 8', 4);

  // Concert Hall: rows of chairs facing the stage at the north end, many knocked over
  {
    const r = roomByName.get('convention:Concert Hall');
    for (let row = 0; row < 7; row++) {
      for (let i = 0; i < 9; i++) {
        const x = r.x + 8 + i * 5.6 + (rand() - 0.5) * 1.4;
        const z = r.z + 46 + row * 7 + (rand() - 0.5) * 1.6;
        if (rand() < 0.2) chairT.push({ x, y: r.y + 0.8, z, rx: Math.PI / 2, ry: rand() * Math.PI * 2 });
        else chairT.push({ x, y: r.y, z, ry: Math.PI + (rand() - 0.5) * 0.4 });
      }
    }
    // stage platform at the north end with front steps
    const sx0 = r.x + 6, sx1 = r.x + r.w - 6, sz0 = r.z + 3, sz1 = r.z + 23;
    const stage = new THREE.Mesh(new THREE.BoxGeometry(sx1 - sx0, 3.5, sz1 - sz0), mats.wood);
    stage.position.set((sx0 + sx1) / 2, r.y + 1.75, (sz0 + sz1) / 2);
    stage.castShadow = stage.receiveShadow = true;
    group.add(stage);
    colliders.push(aabb(sx0, sx1, r.y, r.y + 3.5, sz0, sz1));
    const mid = (sx0 + sx1) / 2;
    for (let st = 0; st < 3; st++) {
      const top = r.y + 1.167 * (st + 1);
      const z0 = sz1 + (2 - st) * 1.5, z1 = z0 + 1.5;
      const step = new THREE.Mesh(new THREE.BoxGeometry(8, top - r.y, z1 - z0), mats.wood);
      step.position.set(mid, (r.y + top) / 2, (z0 + z1) / 2);
      step.castShadow = step.receiveShadow = true;
      group.add(step);
      colliders.push(aabb(mid - 4, mid + 4, r.y, top, z0, z1));
    }
    // tattered curtain legs at the stage sides
    for (const cx of [sx0 + 2, sx1 - 2]) {
      const cur = new THREE.Mesh(new THREE.BoxGeometry(2.4, r.h - 4, 0.4), new THREE.MeshStandardMaterial({ color: 0x2c0e12, roughness: 1 }));
      cur.position.set(cx, r.y + (r.h - 4) / 2 + 3.5, sz1 - 0.5);
      group.add(cur);
    }
  }

  // boardroom-style long tables
  for (const key of ['mezzanine:Boardroom', 'mezzanine:Territories', 'convention:Ontario']) {
    const r = roomByName.get(key);
    const lw = Math.min(r.w * 0.5, 22), ld = Math.min(r.d * 0.35, 7);
    const cx = r.x + r.w / 2, cz = r.z + r.d / 2;
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
    for (let i = 0; i < 8; i++) {
      const side = i % 2 ? 1 : -1;
      const x = cx - lw / 2 + 2.5 + Math.floor(i / 2) * (lw / 4);
      chairT.push({ x, y: r.y, z: cz + side * (ld / 2 + 1.2), ry: side > 0 ? Math.PI : 0 });
    }
  }

  // kitchen counters
  for (const key of ['mezzanine:Kitchen (mezzanine)', 'convention:Kitchen']) {
    const r = roomByName.get(key);
    for (const frac of [0.3, 0.65]) {
      const z = r.z + r.d * frac;
      const counter = new THREE.Mesh(new THREE.BoxGeometry(r.w - 10, 3, 3.2), mats.metal);
      counter.position.set(r.x + r.w / 2, r.y + 1.5, z);
      counter.castShadow = counter.receiveShadow = true;
      group.add(counter);
      colliders.push(aabb(r.x + 5, r.x + r.w - 5, r.y, r.y + 3, z - 1.6, z + 1.6));
    }
  }

  // fallen ceiling tiles scattered in the mezzanine corridors
  const tileMat = new THREE.MeshStandardMaterial({ color: 0x6b665c, roughness: 1 });
  for (let i = 0; i < 14; i++) {
    const inCorrA = i % 2 === 0;
    const x = 15 + rand() * 340;
    const z = inCorrA ? 29.5 + rand() * 7 : 113.5 + rand() * 15;
    const tile = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 2), tileMat);
    tile.position.set(x, 0.08, z);
    tile.rotation.set((rand() - 0.5) * 0.3, rand() * Math.PI, (rand() - 0.5) * 0.3);
    tile.receiveShadow = true;
    group.add(tile);
  }

  // merge the furniture batches
  if (chairT.length) {
    const mesh = new THREE.Mesh(placeAll(chairGeo, chairT), mats.chair);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  if (tableT.length || clothT.length) {
    const mesh = new THREE.Mesh(placeAll(tableGeo, [...tableT, ...clothT]), mats.cloth);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }

  return { group, colliders };
}
