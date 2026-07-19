// The Concierge — the entity. A gaunt, too-tall figure in a decayed uniform,
// hands pressed over his eyes, wandering the mezzanine corridors hunting for
// sound. Two modes: blind (default — he cannot see, only hear and remember
// roughly where a sound came from) and eyes-open (hunts — hands drop away
// from his face, a faint red glow shows behind them, he moves faster and
// can actually see the player unless they're concealed). He animates in
// stop-motion (pose quantized to ~8fps while position glides) with stiff
// legs, a wrong forward lean, and long freezes mid-step in every mode.
//
// --- Manual test API (open the game, then in the devtools console) --------
//   window.__concierge.ghost.state        // 'patrol'|'suspicious'|'pursuit'|
//                                          // 'hunt'|'cooldown'|'finalHunt'|'exorcised'
//   window.__concierge.ghost.alertness    // 0..1
//   window.__concierge.ghost.eyesOpen     // bool
//   window.__concierge.ghost.triggerNewArrival()   // 15s eyes-open hunt -> cooldown
//   window.__concierge.ghost.triggerShortHunt()    // 8s eyes-open hunt -> cooldown
//   window.__concierge.ghost.startFinalHunt()      // eyes-open forever, until exorcise()
//   window.__concierge.ghost.exorcise()            // freezes the entity for good
//   window.__concierge.noiseBus.emit(x, z, 1.2, 'generator') // make noise anywhere
//
// --- Testing note -----------------------------------------------------------
// The pure logic (line-of-sight vs collider AABBs, the alertness curve, the
// state-machine transitions, and the axis-slide collision helper) is
// exported as plain functions below so it can be unit-tested from Node
// without a DOM or a THREE.WebGLRenderer — see scripts/smoke-entity.mjs.
// Nothing at module import time touches window/document; buildFigure() only
// touches document.createElement (for canvas textures) when actually called
// by createGhost(), so `import('./ghost.js')` alone is safe under plain Node.
import * as THREE from 'three';
import { ghostStep, ghostBreath } from './audio.js';
import { noiseBus, hearingFalloff } from './noise.js';

// patrol graph: mezzanine corridor A (z=33), corridor B north lane (z=114.5),
// and the open connectors between the central columns.
const NODES = [
  [20, 33], [100, 33], [161, 33], [226.5, 33], [303, 33], [355, 33],
  [20, 114.5], [100, 114.5], [161, 114.5], [226.5, 114.5], [303, 114.5], [355, 114.5],
];
const ADJ = [
  [1], [0, 2, 7], [1, 3, 8], [2, 4, 9], [3, 5, 10], [4, 11],
  [7], [6, 8, 1], [7, 9, 2], [8, 10, 3], [9, 11, 4], [10, 5],
];

const quant = (t, fps = 8) => Math.floor(t * fps) / fps;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// --- tunables (documented assumptions where the brief left room; exported
// so the smoke test can assert against the real thresholds, not copies) ----
const BASE_SPEED = 3.4;              // blind patrol/investigate walk speed, ft/s
const PURSUIT_MULT = 1.5;            // blind but urgent — assumption, brief only pins hunt speed
const HUNT_MULT = 1.7;               // eyes-open speed, exact per brief
export const ENTITY_RADIUS = 1.0;    // exact per brief ("radius 1.0")
const ENTITY_HEIGHT = 6.4;           // approx figure height, for axis-slide collision only
export const SIGHT_RANGE = 90;       // ft, exact per brief
export const CATCH_DIST = 3.0;       // exact per brief
export const PURSUIT_LOUDNESS = 0.6; // exact per brief ("loud noise (>0.6)")
export const SUSPICIOUS_ALERT = 0.3; // assumption: alertness threshold to start investigating
const LOS_GRACE = 2.0;               // seconds a just-lost sightline still counts for the catch rule

// --- grimy canvas textures for the uniform and skin ------------------------

function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function smudge(ctx, s, n, color, aMax) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * s, y = Math.random() * s, r = 6 + Math.random() * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${color},${Math.random() * aMax})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function coatTexture() {
  return canvasTex(256, (ctx, s) => {
    ctx.fillStyle = '#221317';
    ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 3) { // wool weave
      ctx.fillStyle = `rgba(255,240,230,${0.008 + Math.random() * 0.014})`;
      ctx.fillRect(x, 0, 1, s);
    }
    smudge(ctx, s, 34, '4,3,3', 0.6); // filth
    smudge(ctx, s, 8, '60,52,34', 0.1); // dried salt/dust
  });
}

function skinTexture() {
  return canvasTex(256, (ctx, s) => {
    ctx.fillStyle = '#c8bba4';
    ctx.fillRect(0, 0, s, s);
    smudge(ctx, s, 22, '110,104,92', 0.4); // mottling
    smudge(ctx, s, 12, '60,52,44', 0.22); // bruised patches
    smudge(ctx, s, 30, '35,30,26', 0.12); // grime
    ctx.strokeStyle = 'rgba(96,88,110,0.16)'; // faint veins
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      let x = Math.random() * s, y = Math.random() * s;
      ctx.moveTo(x, y);
      for (let j = 0; j < 4; j++) { x += (Math.random() - 0.5) * 40; y += Math.random() * 26; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  });
}

function trouserTexture() {
  return canvasTex(128, (ctx, s) => {
    ctx.fillStyle = '#15151b';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = 'rgba(140,120,80,0.25)'; // side braid stripe
    ctx.fillRect(s * 0.46, 0, 5, s);
    smudge(ctx, s, 16, '5,5,6', 0.5);
  });
}

// --- the figure ------------------------------------------------------------

function buildFigure() {
  // cloth colors are multiplied well below white so the flashlight never
  // lifts the uniform past a rotted charcoal-oxblood
  const coat = new THREE.MeshStandardMaterial({ map: coatTexture(), color: 0x4a4245, roughness: 0.96 });
  const trouser = new THREE.MeshStandardMaterial({ map: trouserTexture(), color: 0x555560, roughness: 0.97 });
  const skin = new THREE.MeshStandardMaterial({
    map: skinTexture(), roughness: 0.55,
    emissive: 0x2e2a24, emissiveIntensity: 0.33, // faintly visible even in the dark
  });
  const brass = new THREE.MeshStandardMaterial({ color: 0x6e5a2a, metalness: 0.85, roughness: 0.45 });
  const capMat = new THREE.MeshStandardMaterial({ map: coatTexture(), color: 0x64262a, roughness: 0.92 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0a0808, roughness: 0.7 });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x1a0402, emissive: 0xff3a18, emissiveIntensity: 2.6, roughness: 0.4,
  });

  const root = new THREE.Group();
  const HIP = 4.1;

  // legs: too-thin trousers ending in long pointed shoes
  const makeLeg = (side) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.34, HIP, 0);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, HIP, 7), trouser);
    shin.position.y = -HIP / 2;
    leg.add(shin);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 1.15), dark);
    shoe.position.set(0, -HIP + 0.08, 0.38); // far too long in the toe
    shoe.scale.z = 1;
    leg.add(shoe);
    return leg;
  };
  const legL = makeLeg(-1);
  const legR = makeLeg(1);
  root.add(legL, legR);

  const torso = new THREE.Group();
  torso.position.y = HIP;
  root.add(torso);

  // double-breasted coat: gaunt tapered chest, one shoulder hitched higher
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.5, 2.9, 10), coat);
  chest.position.y = 1.45;
  chest.scale.set(1, 1, 0.62);
  chest.rotation.y = Math.PI / 10;
  torso.add(chest);

  // ragged coat skirt: displaced bottom ring reads as a torn hem
  const skirtGeo = new THREE.CylinderGeometry(0.52, 0.72, 1.5, 12, 2, true);
  {
    const pos = skirtGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) < -0.4) {
        pos.setY(i, pos.getY(i) + (Math.random() - 0.2) * 0.55);
        pos.setX(i, pos.getX(i) * (0.9 + Math.random() * 0.25));
        pos.setZ(i, pos.getZ(i) * (0.9 + Math.random() * 0.25));
      }
    }
    skirtGeo.computeVertexNormals();
  }
  const skirt = new THREE.Mesh(skirtGeo, new THREE.MeshStandardMaterial({ map: coatTexture(), color: 0x4a4245, roughness: 0.96, side: THREE.DoubleSide }));
  skirt.position.y = -0.5;
  skirt.scale.set(1, 1, 0.7);
  torso.add(skirt);

  // high collar
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.5, 8), coat);
  collar.position.y = 3.0;
  torso.add(collar);

  // two columns of tarnished brass buttons
  for (const col of [-1, 1]) {
    for (let b = 0; b < 4; b++) {
      const btn = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), brass);
      btn.position.set(col * 0.22, 0.7 + b * 0.6, 0.47 - b * 0.045);
      torso.add(btn);
    }
  }
  // scratched brass name plate, unreadable
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.02), brass);
  plate.position.set(-0.42, 2.35, 0.42);
  plate.rotation.z = 0.06;
  torso.add(plate);

  // epaulettes with hanging braid cords, left shoulder hitched higher
  for (const side of [-1, 1]) {
    const lift = side < 0 ? 0.16 : 0; // asymmetry
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.4), capMat);
    pad.position.set(side * 0.72, 2.88 + lift, 0.05);
    pad.rotation.z = side * -0.22;
    torso.add(pad);
    for (let c = 0; c < 3; c++) {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 5), brass);
      cord.position.set(side * (0.82 + c * 0.05), 2.62 + lift, 0.12 - c * 0.08);
      cord.rotation.z = side * -0.3;
      torso.add(cord);
    }
  }

  // a front-desk key on a chain at his hip — it swings as he walks
  const key = new THREE.Group();
  key.position.set(0.55, 0.35, 0.3);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 5), brass);
  chain.position.y = -0.27;
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.03, 6, 10), brass);
  bow.position.y = -0.6;
  const bit = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.08), brass);
  bit.position.y = -0.78;
  key.add(chain, bow, bit);
  torso.add(key);

  // arms: two rigid segments from shoulder to a flared elbow to the eyes.
  // Each arm lives in its own group pivoted at the shoulder so the whole
  // limb can swing down and back, in one piece, when the eyes open.
  const segment = (from, to, thick, mat) => {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    const g = new THREE.CylinderGeometry(thick, thick * 0.82, len, 7);
    g.translate(0, -len / 2, 0);
    const m = new THREE.Mesh(g, mat);
    m.position.copy(from);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
    return m;
  };
  const arms = {};
  for (const side of [-1, 1]) {
    const lift = side < 0 ? 0.16 : 0;
    const shoulder = new THREE.Vector3(side * 0.72, 2.72 + lift, 0.1);
    const elbow = new THREE.Vector3(side * 1.34, 3.1, 0.55).sub(shoulder); // elbow, shoulder-relative
    const wrist = new THREE.Vector3(side * 0.26, 3.72, 0.5).sub(shoulder); // wrist, shoulder-relative
    const armGroup = new THREE.Group();
    armGroup.position.copy(shoulder);
    armGroup.add(segment(new THREE.Vector3(0, 0, 0), elbow, 0.15, coat));
    armGroup.add(segment(elbow, wrist, 0.12, coat));
    torso.add(armGroup);
    arms[side < 0 ? 'L' : 'R'] = armGroup;
  }

  // gaunt lathe-turned skull: hollow cheeks, sharp chin, long neck
  const headG = new THREE.Group();
  headG.position.set(0, 3.2, 0.12);
  torso.add(headG);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.55, 7), skin);
  neck.position.y = 0.14;
  headG.add(neck);
  const profile = [];
  const R = [0.001, 0.16, 0.24, 0.27, 0.24, 0.3, 0.36, 0.37, 0.33, 0.2, 0.001];
  for (let i = 0; i < R.length; i++) profile.push(new THREE.Vector2(R[i], (i / (R.length - 1)) * 1.05));
  const skull = new THREE.Mesh(new THREE.LatheGeometry(profile, 12), skin);
  skull.position.y = 0.3;
  skull.scale.set(0.95, 1, 0.82);
  headG.add(skull);
  // slack open mouth — a dark recess below where the hands sit
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.06), dark);
  mouth.position.set(0, 0.52, 0.27);
  headG.add(mouth);

  // crooked bellhop pillbox cap with a tarnished band
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.28, 10), capMat);
  cap.position.set(0.03, 1.38, -0.02);
  cap.rotation.z = -0.18;
  cap.rotation.x = 0.1;
  headG.add(cap);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.02, 5, 12), brass);
  band.position.copy(cap.position).add(new THREE.Vector3(0, -0.1, 0));
  band.rotation.x = Math.PI / 2 + 0.1;
  band.rotation.y = -0.18;
  headG.add(band);

  // two faint embers behind where the hands sit — invisible until eyesOpen
  // reveals them, so the mode change reads instantly even at a distance
  const eyes = {};
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeMat);
    eye.position.set(side * 0.15, 0.66, 0.26);
    eye.visible = false;
    headG.add(eye);
    eyes[side < 0 ? 'L' : 'R'] = eye;
  }

  // bony hands over the eyes, grouped per side so they can be animated away
  // from the face as one piece without ever detaching from the head
  const hands = {};
  for (const side of [-1, 1]) {
    const handGroup = new THREE.Group();
    headG.add(handGroup);
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.1), skin);
    palm.position.set(side * 0.16, 0.62, 0.31);
    palm.rotation.y = side * -0.3;
    handGroup.add(palm);
    const lens = [0.62, 0.72, 0.66, 0.5]; // uneven finger lengths
    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.02, lens[f], 5), skin);
      finger.position.set(side * (0.04 + f * 0.08), 0.78 + lens[f] / 2 - 0.28, 0.3);
      finger.rotation.x = -0.2;
      finger.rotation.z = side * (f * 0.05 - 0.04);
      handGroup.add(finger);
      const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 5), skin);
      knuckle.position.set(side * (0.04 + f * 0.08), 0.82, 0.32);
      handGroup.add(knuckle);
    }
    // thumb hooking around the temple
    const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.02, 0.34, 5), skin);
    thumb.position.set(side * 0.34, 0.6, 0.22);
    thumb.rotation.z = side * 0.9;
    handGroup.add(thumb);
    hands[side < 0 ? 'L' : 'R'] = handGroup;
  }

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { root, legL, legR, torso, headG, key, arms, hands, eyes };
}

// --- pure logic (exported for scripts/smoke-entity.mjs) --------------------

// Kay–Kajiya slab test: does the segment a->b intersect the AABB `box`
// ({x0,y0,z0,x1,y1,z1})? Used both for the entity's line-of-sight check and
// tested standalone in the smoke test.
export function segmentIntersectsAABB(ax, ay, az, bx, by, bz, box) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  let tmin = 0, tmax = 1;
  const axes = [
    [ax, dx, box.x0, box.x1],
    [ay, dy, box.y0, box.y1],
    [az, dz, box.z0, box.z1],
  ];
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return false; // parallel to this slab and outside it
      continue;
    }
    let t0 = (lo - o) / d, t1 = (hi - o) / d;
    if (t0 > t1) { const tmp = t0; t0 = t1; t1 = tmp; }
    tmin = Math.max(tmin, t0);
    tmax = Math.min(tmax, t1);
    if (tmin > tmax) return false;
  }
  return true;
}

// True if nothing in `colliders` blocks the straight line from a to b.
export function hasLineOfSight(ax, ay, az, bx, by, bz, colliders) {
  for (const c of colliders) {
    if (segmentIntersectsAABB(ax, ay, az, bx, by, bz, c)) return false;
  }
  return true;
}

// Same footprint-vs-AABB overlap test Player.collides uses, for the entity's
// own axis-slide movement while off the patrol graph.
export function blockedAt(x, y, z, colliders, radius, height) {
  const x0 = x - radius, x1 = x + radius;
  const y0 = y + 0.05, y1 = y + height;
  const z0 = z - radius, z1 = z + radius;
  for (const c of colliders) {
    if (x0 < c.x1 && x1 > c.x0 && y0 < c.y1 && y1 > c.y0 && z0 < c.z1 && z1 > c.z0) return true;
  }
  return false;
}

// Move by (dx,dz), one axis at a time, dropping whichever axis would walk
// into a collider — mirrors Player.moveAxis's slide-along-the-wall feel
// without needing the entity to know which face it clipped.
export function axisSlide(x, y, z, dx, dz, colliders, radius, height) {
  let nx = x, nz = z;
  if (dx !== 0) {
    const tryX = x + dx;
    if (!blockedAt(tryX, y, nz, colliders, radius, height)) nx = tryX;
  }
  if (dz !== 0) {
    const tryZ = z + dz;
    if (!blockedAt(nx, y, tryZ, colliders, radius, height)) nz = tryZ;
  }
  return { x: nx, z: nz };
}

// Alertness curve: decays gently every frame, rises from heard noise
// (already distance-attenuated by the caller) and, only above the 0.5
// confidence gate, from breathing — scaled by confidence so a shaky reading
// nudges alertness less than a confident one. This is the only path
// breathing has into the entity's behaviour, and it is intentionally slow:
// breathing alone can never spike alertness, only creep it up over seconds.
export function updateAlertness(alertness, dt, input = {}) {
  const {
    noiseContribution = 0,
    breathingIntensity = 0,
    breathingConfidence = 0,
    decayPerSec = 0.05,
  } = input;
  let a = alertness - decayPerSec * dt + noiseContribution;
  if (breathingConfidence >= 0.5) {
    a += breathingIntensity * breathingConfidence * 0.05 * dt;
  }
  return clamp01(a);
}

// The blind-state transition table. `hunt`/`finalHunt` are only entered
// imperatively (triggerNewArrival/triggerShortHunt/startFinalHunt) — this
// reducer only decides patrol<->suspicious<->pursuit, and the two timed
// exits: hunt->cooldown and cooldown->patrol. finalHunt/exorcised only ever
// leave via exorcise(), also imperative, so they're fixed points here.
export function nextBehaviorState(current, ctx = {}) {
  const {
    alertness = 0,
    effectiveLoudness = 0,
    sustainedTalk = false,
    timerDone = false,
  } = ctx;
  const heardSomethingLoud = effectiveLoudness > PURSUIT_LOUDNESS || sustainedTalk;

  switch (current) {
    case 'patrol':
      if (heardSomethingLoud) return 'pursuit';
      if (alertness >= SUSPICIOUS_ALERT) return 'suspicious';
      return 'patrol';
    case 'suspicious':
      if (heardSomethingLoud) return 'pursuit';
      if (alertness < SUSPICIOUS_ALERT * 0.5) return 'patrol';
      return 'suspicious';
    case 'pursuit':
      if (heardSomethingLoud) return 'pursuit';
      if (alertness < SUSPICIOUS_ALERT * 0.5) return 'patrol';
      return 'pursuit';
    case 'hunt':
      return timerDone ? 'cooldown' : 'hunt';
    case 'cooldown':
      return timerDone ? 'patrol' : 'cooldown';
    case 'finalHunt':
      return 'finalHunt';
    case 'exorcised':
      return 'exorcised';
    default:
      return current;
  }
}

function nearestNodeIndex(x, z) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < NODES.length; i++) {
    const d = Math.hypot(NODES[i][0] - x, NODES[i][1] - z);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// shared stop-motion gait pose — legs, lean, key swing, cocked head — used
// by every walking behaviour (patrol/suspicious/pursuit/hunt/finalHunt/
// cooldown), just at different speeds/frequencies.
function applyGaitPose({ legL, legR, torso, headG, key }, animT, freq, legSwing, lean) {
  const phase = quant(animT, 8) * freq;
  legL.rotation.x = Math.sin(phase) * legSwing;
  legR.rotation.x = -legL.rotation.x;
  torso.rotation.x = lean + Math.sin(quant(animT) * 0.9) * 0.05;
  torso.rotation.z = Math.sin(phase * 0.5) * 0.08;
  key.rotation.z = Math.sin(phase * 0.5 + 1.2) * 0.35; // the desk key swings on its chain
  key.rotation.x = Math.sin(phase * 0.35) * 0.2;
  headG.rotation.z = 0.3 * (Math.sin(quant(animT) * 0.23) > 0 ? 1 : -1); // cocked, snapping sides
  headG.rotation.x = -0.12;
  return phase;
}

export function createGhost(scene, colliders = []) {
  const { root, legL, legR, torso, headG, key, arms, hands, eyes } = buildFigure();
  scene.add(root);

  // spawns in corridor B beside the player's spawn point, already mid-shamble
  let node = 7;
  let prevNode = 6;
  root.position.set(132, 0, 115);

  // --- stop-motion pose sub-state (patrol/cooldown only): walk/freeze/listen/skitter
  let pose = 'walk';
  let poseT = 0;
  let poseDur = 2;
  let target = null; // Vector2, patrol/cooldown waypoint
  let yaw = Math.PI / 2;
  let animT = 0;
  let lastStepPhase = 0;
  let frozenPose = null;
  let breathTimer = 4;

  // --- behaviour state (the Entity API contract)
  let behavior = 'patrol';
  let alertness = 0;
  let huntTimer = 0;
  let cooldownTimer = 0;
  let investigateTarget = null; // {x,z} — a heard/seen area, not an exact point
  let seesPlayer = false;
  let lastSeenAt = -Infinity;
  let clockT = 0; // free-running seconds, for LOS_GRACE bookkeeping
  let handOpenT = 0; // 0 = hands over eyes, 1 = hands fully away
  let caught = false;
  let talkTimer = 0; // seconds of continuous confident talking, for "sustained" talk

  const signals = { talking: false, talkingConfidence: 0, breathingIntensity: 0, breathingConfidence: 0 };
  const pendingNoise = [];
  const unsubscribeNoise = noiseBus.subscribe((ev) => pendingNoise.push(ev));

  function pickNext() {
    const options = ADJ[node].filter((n) => n !== prevNode);
    const pool = options.length ? options : ADJ[node];
    const next = pool[Math.floor(Math.random() * pool.length)];
    prevNode = node;
    node = next;
    target = new THREE.Vector2(NODES[next][0], NODES[next][1]);
  }

  function startWalkTo(n) {
    prevNode = node;
    node = n;
    target = new THREE.Vector2(NODES[n][0], NODES[n][1]);
  }

  function choosePose() {
    const r = Math.random();
    if (r < 0.5) { pose = 'walk'; poseDur = Infinity; if (!target) pickNext(); }
    else if (r < 0.72) { pose = 'freeze'; poseDur = 2.5 + Math.random() * 5; frozenPose = null; }
    else if (r < 0.9) { pose = 'listen'; poseDur = 3 + Math.random() * 3; }
    else { pose = 'skitter'; poseDur = 1 + Math.random() * 1.4; }
  }
  startWalkTo(8); // first target: east along corridor B, past the planter

  // approach the general area a sound came from, not the exact point
  function setInvestigateTarget(ev) {
    if (!ev) return;
    if (ev.exact) { investigateTarget = { x: ev.x, z: ev.z }; return; }
    const fuzz = 12;
    investigateTarget = {
      x: ev.x + (Math.random() * 2 - 1) * fuzz,
      z: ev.z + (Math.random() * 2 - 1) * fuzz,
    };
  }

  function enterBehavior(next) {
    if (next === 'cooldown') {
      huntTimer = 0;
      cooldownTimer = 10;
      const n = nearestNodeIndex(root.position.x, root.position.z);
      node = n;
      prevNode = n;
      investigateTarget = { x: NODES[n][0], z: NODES[n][1] };
    } else if (next === 'patrol') {
      investigateTarget = null;
      seesPlayer = false;
      pose = 'walk';
      poseDur = Infinity;
      if (!target) pickNext();
    }
  }

  function beginHunt(durationSec) {
    behavior = 'hunt';
    huntTimer = durationSec;
    alertness = 1;
    seesPlayer = false;
    if (!investigateTarget) investigateTarget = { x: root.position.x, z: root.position.z };
  }

  const api = {
    object: root,
    get state() { return behavior; },
    get alertness() { return alertness; },
    get eyesOpen() { return behavior === 'hunt' || behavior === 'finalHunt'; },
    onCatch: null,

    applySignals(sig = {}) {
      signals.talking = !!sig.talking;
      signals.talkingConfidence = clamp01(sig.talkingConfidence ?? 0);
      signals.breathingIntensity = clamp01(sig.breathingIntensity ?? 0);
      signals.breathingConfidence = clamp01(sig.breathingConfidence ?? 0);
    },

    triggerNewArrival(durationSec = 15) { beginHunt(durationSec); },
    triggerShortHunt(durationSec = 8) { beginHunt(durationSec); },
    startFinalHunt() {
      behavior = 'finalHunt';
      alertness = 1;
      seesPlayer = false;
    },
    exorcise() {
      behavior = 'exorcised';
      unsubscribeNoise();
    },

    update(dt, player) {
      if (behavior === 'exorcised') return; // frozen for good

      clockT += dt;
      animT += dt;
      const distToPlayer = Math.hypot(root.position.x - player.pos.x, root.position.z - player.pos.z);
      const audible = Math.max(0, 1 - distToPlayer / 75);

      // 1. drain this frame's noise events into an effective (distance
      // attenuated) loudness + the loudest source's location
      let effectiveLoudness = 0;
      let alertBump = 0;
      let heardTarget = null;
      for (const ev of pendingNoise) {
        const dist = Math.hypot(ev.x - root.position.x, ev.z - root.position.z);
        const eff = ev.loudness * hearingFalloff(dist, ev.loudness);
        if (eff <= 0) continue;
        alertBump += eff * 0.6;
        if (eff > effectiveLoudness) { effectiveLoudness = eff; heardTarget = ev; }
      }
      pendingNoise.length = 0;

      // talking, above the confidence gate, is a strong awareness event at
      // the player's actual position (not fuzzed — he knows exactly where
      // a voice is coming from), scaled by how confident the read is. A
      // single confident frame already nudges alertness and gives him a
      // location to investigate (-> suspicious), but the dedicated
      // "sustained talking" pursuit trigger needs the brief's word taken
      // literally: ~1s of continuous confident talking, not a one-frame blip.
      const talkingConfident = signals.talking && signals.talkingConfidence >= 0.5;
      talkTimer = talkingConfident ? Math.min(3, talkTimer + dt) : Math.max(0, talkTimer - dt * 2);
      const sustainedTalk = talkTimer >= 1.0;
      if (talkingConfident) {
        heardTarget = heardTarget || { x: player.pos.x, z: player.pos.z, loudness: 1, kind: 'talk', exact: true };
        alertBump += 0.4 * signals.talkingConfidence * dt;
      }

      alertness = updateAlertness(alertness, dt, {
        noiseContribution: alertBump,
        breathingIntensity: signals.breathingIntensity,
        breathingConfidence: signals.breathingConfidence,
      });

      // 2. behaviour transitions — hunt/cooldown exits are timed, everything
      // else follows the pure reducer above; finalHunt/exorcised only leave
      // imperatively (startFinalHunt/exorcise), so they're skipped here
      if (behavior === 'hunt') huntTimer -= dt;
      if (behavior === 'cooldown') cooldownTimer -= dt;
      const timerDone = (behavior === 'hunt' && huntTimer <= 0) || (behavior === 'cooldown' && cooldownTimer <= 0);

      if (behavior !== 'finalHunt' && behavior !== 'exorcised') {
        const prev = behavior;
        behavior = nextBehaviorState(behavior, { alertness, effectiveLoudness, sustainedTalk, timerDone });
        if (behavior !== prev) enterBehavior(behavior);
      }

      // keep chasing the freshest lead while actively investigating/hunting blind
      if ((behavior === 'suspicious' || behavior === 'pursuit') && heardTarget) setInvestigateTarget(heardTarget);
      if ((behavior === 'hunt' || behavior === 'finalHunt') && heardTarget && !seesPlayer) setInvestigateTarget(heardTarget);

      // 3. eyes-open sight check — sees the player within SIGHT_RANGE unless
      // concealed, regardless of how loud/quiet they've been
      const eyesOpenNow = behavior === 'hunt' || behavior === 'finalHunt';
      if (eyesOpenNow) {
        const eyeY = root.position.y + 5.6;
        const playerEyeY = player.pos.y + (player.concealed ? 1.6 : 5.4);
        seesPlayer = !player.concealed
          && distToPlayer <= SIGHT_RANGE
          && hasLineOfSight(root.position.x, eyeY, root.position.z, player.pos.x, playerEyeY, player.pos.z, colliders);
        if (seesPlayer) lastSeenAt = clockT;
      } else {
        seesPlayer = false;
      }

      // 4. movement + pose
      if (behavior === 'patrol') {
        runPatrol(dt);
      } else {
        runReactive(dt, player, eyesOpenNow);
      }

      root.rotation.y = Math.round(yaw / 0.12) * 0.12; // turning happens in visible steps

      // 5. hands-off-the-eyes transition, quantized for the stop-motion feel
      const targetOpen = eyesOpenNow ? 1 : 0;
      handOpenT += (targetOpen - handOpenT) * Math.min(1, dt * 4);
      const q = quant(handOpenT, 6);
      arms.L.rotation.x = -q * 1.9;
      arms.R.rotation.x = -q * 1.9;
      arms.L.rotation.z = q * 0.5;
      arms.R.rotation.z = -q * 0.5;
      hands.L.position.set(-q * 0.5, -q * 0.9, -q * 0.3);
      hands.R.position.set(q * 0.5, -q * 0.9, -q * 0.3);
      hands.L.rotation.x = q * 0.8;
      hands.R.rotation.x = q * 0.8;
      eyes.L.visible = eyesOpenNow;
      eyes.R.visible = eyesOpenNow;

      // 6. catch rule: dist<3.0 && (!concealed || eyesOpen-and-had-LOS).
      // While blind, a concealed player can never be caught — hadLOS is
      // false whenever eyesOpenNow is false, so the `||` term always fails.
      // Recomputed post-movement so the check uses where he actually ended
      // up this frame, not where he started.
      const distAfterMove = Math.hypot(root.position.x - player.pos.x, root.position.z - player.pos.z);
      const hadLOS = eyesOpenNow && (seesPlayer || (clockT - lastSeenAt) < LOS_GRACE);
      const canCatch = distAfterMove < CATCH_DIST && (!player.concealed || hadLOS);
      if (canCatch && !caught) { caught = true; api.onCatch?.(); }
      if (distAfterMove > CATCH_DIST * 2) caught = false; // re-arm once they've gotten clear

      // a long dry exhale when he lingers near
      breathTimer -= dt;
      if (breathTimer <= 0) {
        breathTimer = 6 + Math.random() * 9;
        if ((pose === 'freeze' || pose === 'listen') && audible > 0.05) ghostBreath(audible);
      }

      function runPatrol(dt) {
        poseT += dt;
        if (poseT > poseDur) { poseT = 0; choosePose(); }

        if (pose === 'walk' || pose === 'skitter') {
          const skitter = pose === 'skitter';
          if (!skitter && target) {
            const dx = target.x - root.position.x;
            const dz = target.y - root.position.z;
            const d = Math.hypot(dx, dz);
            if (d < 1.2) {
              target = null;
              poseT = 0;
              choosePose();
            } else {
              // speed comes in irregular pushes, never a steady stride
              const push = 0.35 + 0.65 * Math.abs(Math.sin(animT * 0.9) * Math.sin(animT * 0.37 + 2));
              const speed = BASE_SPEED * push;
              root.position.x += (dx / d) * speed * dt;
              root.position.z += (dz / d) * speed * dt;
              turnToward(dx, dz, 1.1, dt);
            }
          }
          const freq = skitter ? 26 : 7;
          const phase = quant(animT, skitter ? 24 : 8) * freq;
          legL.rotation.x = Math.sin(phase) * (skitter ? 0.22 : 0.55);
          legR.rotation.x = -legL.rotation.x;
          root.position.y = Math.abs(Math.sin(quant(animT) * freq)) * 0.1;
          torso.rotation.x = 0.3 + Math.sin(quant(animT) * 0.9) * 0.05; // leaning too far
          torso.rotation.z = Math.sin(phase * 0.5) * 0.08;
          key.rotation.z = Math.sin(phase * 0.5 + 1.2) * 0.35;
          key.rotation.x = Math.sin(phase * 0.35) * 0.2;
          headG.rotation.z = 0.3 * (Math.sin(quant(animT) * 0.23) > 0 ? 1 : -1);
          headG.rotation.x = -0.12;
          if (Math.floor(phase / Math.PI) !== Math.floor(lastStepPhase / Math.PI) && audible > 0.02) {
            ghostStep(audible * (skitter ? 0.5 : 1));
          }
          lastStepPhase = phase;
        } else if (pose === 'freeze') {
          if (!frozenPose) frozenPose = { head: headG.rotation.z };
          headG.rotation.z = frozenPose.head + poseT * 0.05;
        } else if (pose === 'listen') {
          torso.rotation.x = Math.max(-0.15, 0.3 - poseT * 0.4);
          headG.rotation.x = Math.min(1.15, poseT * 0.9) * -1;
          headG.rotation.z = Math.sin(quant(animT, 4) * 0.7) * 0.5;
          legL.rotation.x = 0;
          legR.rotation.x = 0;
        }
      }

      function runReactive(dt, player, eyesOpenNow) {
        let moveTarget = null;
        let speed = BASE_SPEED;
        let listening = false;

        if (behavior === 'suspicious') {
          moveTarget = investigateTarget;
          speed = BASE_SPEED;
          listening = !moveTarget;
        } else if (behavior === 'pursuit') {
          moveTarget = investigateTarget;
          speed = BASE_SPEED * PURSUIT_MULT;
        } else if (behavior === 'cooldown') {
          moveTarget = investigateTarget; // nearest node, set on entry
          speed = BASE_SPEED;
        } else if (behavior === 'hunt' || behavior === 'finalHunt') {
          speed = BASE_SPEED * HUNT_MULT;
          if (eyesOpenNow && seesPlayer) {
            moveTarget = { x: player.pos.x, z: player.pos.z };
          } else if (investigateTarget) {
            moveTarget = investigateTarget;
          } else {
            if (!target) pickNext();
            moveTarget = target ? { x: target.x, z: target.y } : null;
          }
        }

        let phase = lastStepPhase;
        if (listening) {
          torso.rotation.x = Math.max(-0.15, 0.3 - poseT * 0.4);
          headG.rotation.x = Math.min(1.15, poseT * 0.9) * -1;
          headG.rotation.z = Math.sin(quant(animT, 4) * 0.7) * 0.5;
          legL.rotation.x = 0;
          legR.rotation.x = 0;
          poseT += dt;
        } else if (moveTarget) {
          const dx = moveTarget.x - root.position.x;
          const dz = moveTarget.z - root.position.z;
          const d = Math.hypot(dx, dz);
          if (d > 0.8) {
            const stepX = (dx / d) * speed * dt;
            const stepZ = (dz / d) * speed * dt;
            const r = axisSlide(root.position.x, root.position.y, root.position.z, stepX, stepZ, colliders, ENTITY_RADIUS, ENTITY_HEIGHT);
            root.position.x = r.x;
            root.position.z = r.z;
            turnToward(dx, dz, eyesOpenNow ? 2.2 : 1.3, dt);
          } else if (behavior === 'cooldown') {
            root.position.x = moveTarget.x; // snap-path exactly onto the node
            root.position.z = moveTarget.z;
          } else if (behavior === 'suspicious') {
            investigateTarget = null; // arrived, nothing there — go back to listening
          } else if (behavior === 'hunt' || behavior === 'finalHunt') {
            // reached the heard/searched area with nothing found — clear
            // whichever lead got us here so next frame picks a fresh one
            investigateTarget = null;
            target = null;
          }
          const freq = (behavior === 'hunt' || behavior === 'finalHunt' || behavior === 'pursuit') ? 10 : 7;
          phase = applyGaitPose({ legL, legR, torso, headG, key }, animT, freq, 0.55, 0.32);
          root.position.y = Math.abs(Math.sin(quant(animT) * freq)) * 0.1;
          poseT = 0;
        }

        if (Math.floor(phase / Math.PI) !== Math.floor(lastStepPhase / Math.PI) && audible > 0.02) {
          ghostStep(audible * (eyesOpenNow ? 1.2 : 1));
        }
        lastStepPhase = phase;
      }

      function turnToward(dx, dz, rate, dt) {
        const want = Math.atan2(dx, dz);
        let dy = want - yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        yaw += dy * Math.min(1, dt * rate);
      }
    },
  };

  return api;
}
