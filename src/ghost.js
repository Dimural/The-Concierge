// The Concierge — the entity. A gaunt, too-tall figure in a decayed uniform,
// hands pressed over his eyes, wandering the mezzanine corridors hunting for
// sound. This phase: he cannot hear, see, or harm the player. He animates in
// stop-motion (pose quantized to ~8fps while position glides) with stiff legs,
// a wrong forward lean, and long freezes mid-step.
import * as THREE from 'three';
import { ghostStep, ghostBreath } from './audio.js';

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

  // arms: two rigid segments from shoulder to a flared elbow to the eyes
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
  for (const side of [-1, 1]) {
    const lift = side < 0 ? 0.16 : 0;
    const shoulder = new THREE.Vector3(side * 0.72, 2.72 + lift, 0.1);
    const elbow = new THREE.Vector3(side * 1.34, 3.1, 0.55); // elbows winged out too high
    const wrist = new THREE.Vector3(side * 0.26, 3.72, 0.5);
    torso.add(segment(shoulder, elbow, 0.15, coat));
    torso.add(segment(elbow, wrist, 0.12, coat));
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

  // bony hands over the eyes, parented to the head so they never come off
  for (const side of [-1, 1]) {
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.1), skin);
    palm.position.set(side * 0.16, 0.62, 0.31);
    palm.rotation.y = side * -0.3;
    headG.add(palm);
    const lens = [0.62, 0.72, 0.66, 0.5]; // uneven finger lengths
    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.02, lens[f], 5), skin);
      finger.position.set(side * (0.04 + f * 0.08), 0.78 + lens[f] / 2 - 0.28, 0.3);
      finger.rotation.x = -0.2;
      finger.rotation.z = side * (f * 0.05 - 0.04);
      headG.add(finger);
      const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 5), skin);
      knuckle.position.set(side * (0.04 + f * 0.08), 0.82, 0.32);
      headG.add(knuckle);
    }
    // thumb hooking around the temple
    const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.02, 0.34, 5), skin);
    thumb.position.set(side * 0.34, 0.6, 0.22);
    thumb.rotation.z = side * 0.9;
    headG.add(thumb);
  }

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { root, legL, legR, torso, headG, key };
}

export function createGhost(scene) {
  const { root, legL, legR, torso, headG, key } = buildFigure();
  scene.add(root);

  // spawns in corridor B beside the player's spawn point, already mid-shamble
  let node = 7;
  let prevNode = 6;
  root.position.set(132, 0, 115);

  let state = 'walk';
  let stateT = 0;
  let stateDur = 2;
  let target = null;
  let yaw = Math.PI / 2;
  let animT = 0;
  let lastStepPhase = 0;
  let frozenPose = null;
  let breathTimer = 4;

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

  function chooseState() {
    const r = Math.random();
    if (r < 0.5) { state = 'walk'; stateDur = Infinity; if (!target) pickNext(); }
    else if (r < 0.72) { state = 'freeze'; stateDur = 2.5 + Math.random() * 5; frozenPose = null; }
    else if (r < 0.9) { state = 'listen'; stateDur = 3 + Math.random() * 3; }
    else { state = 'skitter'; stateDur = 1 + Math.random() * 1.4; }
  }
  startWalkTo(8); // first target: east along corridor B, past the planter

  return {
    object: root,
    update(dt, playerPos) {
      stateT += dt;
      animT += dt;
      const dist = Math.hypot(root.position.x - playerPos.x, root.position.z - playerPos.z);
      const audible = Math.max(0, 1 - dist / 75);

      if (stateT > stateDur) { stateT = 0; chooseState(); }

      const tq = quant(animT); // stop-motion clock for everything but gliding

      if (state === 'walk' || state === 'skitter') {
        const skitter = state === 'skitter';
        if (!skitter && target) {
          const dx = target.x - root.position.x;
          const dz = target.y - root.position.z;
          const d = Math.hypot(dx, dz);
          if (d < 1.2) {
            target = null;
            stateT = 0;
            chooseState();
          } else {
            // speed comes in irregular pushes, never a steady stride
            const push = 0.35 + 0.65 * Math.abs(Math.sin(animT * 0.9) * Math.sin(animT * 0.37 + 2));
            const speed = 3.4 * push;
            root.position.x += (dx / d) * speed * dt;
            root.position.z += (dz / d) * speed * dt;
            // the body turns late — he sets off before he faces where he goes
            const want = Math.atan2(dx, dz);
            let dy = want - yaw;
            while (dy > Math.PI) dy -= Math.PI * 2;
            while (dy < -Math.PI) dy += Math.PI * 2;
            yaw += dy * Math.min(1, dt * 1.1);
          }
        }
        const freq = skitter ? 26 : 7;
        const phase = quant(animT, skitter ? 24 : 8) * freq;
        legL.rotation.x = Math.sin(phase) * (skitter ? 0.22 : 0.55);
        legR.rotation.x = -legL.rotation.x;
        root.position.y = Math.abs(Math.sin(quant(animT) * freq)) * 0.1;
        torso.rotation.x = 0.3 + Math.sin(quant(animT) * 0.9) * 0.05; // leaning too far
        torso.rotation.z = Math.sin(phase * 0.5) * 0.08;
        key.rotation.z = Math.sin(phase * 0.5 + 1.2) * 0.35; // the desk key swings on its chain
        key.rotation.x = Math.sin(phase * 0.35) * 0.2;
        headG.rotation.z = 0.3 * (Math.sin(quant(animT) * 0.23) > 0 ? 1 : -1); // cocked, snapping sides
        headG.rotation.x = -0.12;
        // knocking footfalls
        if (Math.floor(phase / Math.PI) !== Math.floor(lastStepPhase / Math.PI) && audible > 0.02) {
          ghostStep(audible * (skitter ? 0.5 : 1));
        }
        lastStepPhase = phase;
      } else if (state === 'freeze') {
        // dead still — sometimes caught mid-step; only the head creeps, far too slowly
        if (!frozenPose) frozenPose = { head: headG.rotation.z };
        headG.rotation.z = frozenPose.head + stateT * 0.05;
      } else if (state === 'listen') {
        // head all the way back, sweeping the ceiling; hands never leave the eyes
        torso.rotation.x = Math.max(-0.15, 0.3 - stateT * 0.4);
        headG.rotation.x = Math.min(1.15, stateT * 0.9) * -1;
        headG.rotation.z = Math.sin(quant(animT, 4) * 0.7) * 0.5;
        legL.rotation.x = 0;
        legR.rotation.x = 0;
      }

      root.rotation.y = Math.round(yaw / 0.12) * 0.12; // turning happens in visible steps

      // a long dry exhale when he lingers near
      breathTimer -= dt;
      if (breathTimer <= 0) {
        breathTimer = 6 + Math.random() * 9;
        if ((state === 'freeze' || state === 'listen') && audible > 0.05) ghostBreath(audible);
      }
    },
  };
}
