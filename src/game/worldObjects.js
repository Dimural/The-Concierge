// Builds the three physical world objects Task 4 owns: the four Archive
// Generators, the front-desk reception counter, and the exit-door glow
// marker. Colliders are plain {x0,y0,z0,x1,y1,z1} boxes, same shape as
// world.js/props.js, pushed into the shared colliders array passed in.
import * as THREE from 'three';

const BRASS = new THREE.MeshStandardMaterial({ color: 0x8a6a2a, metalness: 0.65, roughness: 0.32 });
const IRON = new THREE.MeshStandardMaterial({ color: 0x1e1b17, metalness: 0.35, roughness: 0.65 });
const CABLE = new THREE.MeshStandardMaterial({ color: 0x0c0b09, roughness: 0.95 });
const WOOD = new THREE.MeshStandardMaterial({ color: 0x3b2213, roughness: 0.75 });
const LEDGER = new THREE.MeshStandardMaterial({ color: 0xcbb98a, roughness: 0.9 });
const BELL = new THREE.MeshStandardMaterial({ color: 0xb08d3a, metalness: 0.85, roughness: 0.25 });

const aabb = (x0, x1, y0, y1, z0, z1) => ({ x0, x1, y0, y1, z0, z1 });

// --------------------------------------------------------------------------
// Room lookup helpers (rooms are {x,z,w,d,h} interior rects, corner-anchored,
// same convention as layout.js/props.js).
// --------------------------------------------------------------------------

export function findRoom(floors, floorIndex, name) {
  const floor = floors[floorIndex];
  if (!floor) return null;
  const room = floor.rooms.find((r) => r.name === name);
  if (!room) return null;
  return { room, floor };
}

export function roomCenter(room, floor) {
  return { x: room.x + room.w / 2, y: floor.y, z: room.z + room.d / 2 };
}

// world position of a room's door opening (defaults to its first door)
export function doorWorldPos(room, floor, side) {
  const d = (side && room.doors.find((dd) => dd.side === side)) || room.doors[0];
  if (!d) return roomCenter(room, floor);
  const horizontal = d.side === 'N' || d.side === 'S';
  const roomLen = horizontal ? room.w : room.d;
  const at = d.at ?? (roomLen - d.w) / 2;
  const center = at + d.w / 2;
  if (d.side === 'N') return { x: room.x + center, y: floor.y, z: room.z };
  if (d.side === 'S') return { x: room.x + center, y: floor.y, z: room.z + room.d };
  if (d.side === 'W') return { x: room.x, y: floor.y, z: room.z + center };
  return { x: room.x + room.w, y: floor.y, z: room.z + center };
}

// nudge a placement off the exact room center (so the player can walk around
// the machine) while staying at least ~4.5ft from any wall
function placeInRoom(room, floor, offsetX = 4, offsetZ = 2) {
  const c = roomCenter(room, floor);
  const maxOX = Math.max(0, room.w / 2 - 4.5);
  const maxOZ = Math.max(0, room.d / 2 - 4.5);
  const ox = Math.sign(offsetX) * Math.min(Math.abs(offsetX), maxOX);
  const oz = Math.sign(offsetZ) * Math.min(Math.abs(offsetZ), maxOZ);
  return { x: c.x + ox, y: floor.y, z: c.z + oz };
}

// --------------------------------------------------------------------------
// Archive Generator: boxy brass-and-ink archive engine, glowing screen,
// lever, cable run.
// --------------------------------------------------------------------------

export function buildGenerator(pos) {
  const group = new THREE.Group();
  group.position.set(pos.x, pos.y, pos.z);

  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(3.2, 5.2, 2.2), IRON);
  cabinet.position.y = 2.6;
  cabinet.castShadow = cabinet.receiveShadow = true;
  group.add(cabinet);

  const trimTop = new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.25, 2.45), BRASS);
  trimTop.position.y = 5.15;
  group.add(trimTop);
  const trimBase = trimTop.clone();
  trimBase.position.y = 0.15;
  group.add(trimBase);

  // screen — starts dim/corrupted, lights up brightly on completion
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x140d08, emissive: 0x210d06, emissiveIntensity: 0.25, roughness: 0.45,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.15), screenMat);
  screen.position.set(0, 3.4, 1.11);
  group.add(screen);

  // lever
  const leverBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.5, 8), BRASS);
  leverBase.position.set(1.35, 1.6, 1.15);
  leverBase.rotation.x = Math.PI / 2;
  group.add(leverBase);
  const leverArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6), BRASS);
  leverArm.position.set(1.35, 2.2, 1.15);
  leverArm.rotation.z = -0.5;
  group.add(leverArm);

  // cable run snaking to the floor
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.2, 6), CABLE);
  cable.position.set(-1.35, 2, -1.25);
  cable.rotation.x = 0.4;
  group.add(cable);
  const cableFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), CABLE);
  cableFoot.position.set(-1.55, 0.3, -1.6);
  cableFoot.rotation.z = 1.4;
  group.add(cableFoot);

  // restoration glow light — off until the generator completes
  const glow = new THREE.PointLight(0xffd9a0, 0, 12, 2);
  glow.position.set(0, 3.4, 1.4);
  group.add(glow);

  const colliders = [
    aabb(pos.x - 1.75, pos.x + 1.75, pos.y, pos.y + 5.3, pos.z - 1.35, pos.z + 1.35),
  ];

  return { group, screenMat, glow, colliders };
}

export function buildGenerators(floors, meta) {
  const built = {};
  const group = new THREE.Group();
  const colliders = [];
  for (const id of Object.keys(meta)) {
    const m = meta[id];
    const found = findRoom(floors, m.floor, m.room);
    if (!found) continue; // room missing from spec — skip gracefully
    const pos = placeInRoom(found.room, found.floor);
    const gen = buildGenerator(pos);
    gen.group.name = `generator-${id}`;
    group.add(gen.group);
    colliders.push(...gen.colliders);
    built[id] = { id, label: m.label, room: m.room, x: pos.x, y: pos.y, z: pos.z, ...gen, done: false };
  }
  return { group, colliders, generators: built };
}

// --------------------------------------------------------------------------
// Front desk: curved reception counter, corrupted ledger, desk bell.
// --------------------------------------------------------------------------

export function buildFrontDesk(pos) {
  const group = new THREE.Group();
  group.position.set(pos.x, pos.y, pos.z);

  const segments = 7;
  const radius = 6;
  const arc = Math.PI * 0.62;
  for (let i = 0; i < segments; i++) {
    const a = -arc / 2 + (i / (segments - 1)) * arc;
    const px = Math.sin(a) * radius;
    const pz = radius - Math.cos(a) * radius;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(1.95, 3.6, 1.3), WOOD);
    seg.position.set(px, 1.8, pz);
    seg.rotation.y = -a;
    seg.castShadow = seg.receiveShadow = true;
    group.add(seg);
    // desktop cap: an overhanging brass slab per segment, following the same
    // curve — avoids a single cylinder wedge (which would render as a solid
    // pie-slice rather than a thin curved counter edge)
    const cap = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.22, 1.7), BRASS);
    cap.position.set(px, 3.68, pz);
    cap.rotation.y = -a;
    cap.castShadow = cap.receiveShadow = true;
    group.add(cap);
  }

  // corrupted ledger (open book)
  const ledgerBase = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 1.15), LEDGER);
  ledgerBase.position.set(-0.4, 3.85, radius - 1.6);
  group.add(ledgerBase);
  const ledgerPageL = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.03, 1.0), new THREE.MeshStandardMaterial({ color: 0xe6dcc0, roughness: 1 }));
  ledgerPageL.position.set(-0.75, 3.95, radius - 1.6);
  ledgerPageL.rotation.z = 0.06;
  group.add(ledgerPageL);
  const ledgerPageR = ledgerPageL.clone();
  ledgerPageR.position.x = -0.05;
  ledgerPageR.rotation.z = -0.06;
  group.add(ledgerPageR);

  // desk bell
  const bell = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.8),
    BELL,
  );
  bell.position.set(1.1, 3.95, radius - 1.6);
  group.add(bell);
  const bellButton = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 8), BELL);
  bellButton.position.set(1.1, 4.1, radius - 1.6);
  group.add(bellButton);

  const colliders = [
    aabb(pos.x - radius - 1, pos.x + radius + 1, pos.y, pos.y + 3.9, pos.z - 0.6, pos.z + radius + 1.2),
  ];

  return { group, colliders };
}

// --------------------------------------------------------------------------
// Exit marker: glow overlay on the 'To Garage (passage)' door, dark until
// the property identity is restored.
// --------------------------------------------------------------------------

export function buildExitGlow(doorPos) {
  const group = new THREE.Group();
  const light = new THREE.PointLight(0xffcf7a, 0, 16, 2);
  light.position.set(doorPos.x, doorPos.y + 6, doorPos.z);
  group.add(light);

  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 7.2),
    new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x000000, emissiveIntensity: 0, transparent: true, opacity: 0 }),
  );
  panel.position.set(doorPos.x, doorPos.y + 4, doorPos.z + 0.08);
  group.add(panel);

  function setUnlocked(unlocked) {
    light.intensity = unlocked ? 2.4 : 0;
    panel.material.emissive.setHex(0xffcf7a);
    panel.material.emissiveIntensity = unlocked ? 0.5 : 0;
    panel.material.opacity = unlocked ? 0.18 : 0;
  }

  return { group, setUnlocked };
}
