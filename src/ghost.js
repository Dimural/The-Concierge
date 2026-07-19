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

function buildFigure() {
  const suit = new THREE.MeshStandardMaterial({ color: 0x0d0d12, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({
    color: 0xcfc3ae, roughness: 0.6,
    emissive: 0x35302a, emissiveIntensity: 0.28, // faintly visible even in the dark
  });

  const root = new THREE.Group();
  const HIP = 3.9;

  const legGeo = new THREE.BoxGeometry(0.34, HIP, 0.34);
  legGeo.translate(0, -HIP / 2, 0); // pivot at the hip
  const legL = new THREE.Mesh(legGeo, suit);
  const legR = new THREE.Mesh(legGeo.clone(), suit);
  legL.position.set(-0.33, HIP, 0);
  legR.position.set(0.33, HIP, 0);
  root.add(legL, legR);

  const torso = new THREE.Group();
  torso.position.y = HIP;
  root.add(torso);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.7, 0.8), suit);
  chest.scale.set(1, 1, 0.85);
  chest.position.y = 1.35;
  torso.add(chest);

  // arms: two rigid segments from shoulder to a flared elbow to the eyes
  const segment = (from, to, thick) => {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    const g = new THREE.BoxGeometry(thick, len, thick);
    g.translate(0, -len / 2, 0);
    const m = new THREE.Mesh(g, suit);
    m.position.copy(from);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
    return m;
  };
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Vector3(side * 0.8, 2.5, 0.12);
    const elbow = new THREE.Vector3(side * 1.3, 3.05, 0.5); // elbows winged out too high
    const hand = new THREE.Vector3(side * 0.24, 3.62, 0.52);
    torso.add(segment(shoulder, elbow, 0.26));
    torso.add(segment(elbow, hand, 0.22));
  }

  const headG = new THREE.Group();
  headG.position.y = 3.05;
  torso.add(headG);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), skin);
  skull.scale.set(0.85, 1.4, 0.95);
  skull.position.y = 0.42;
  headG.add(skull);

  // palms pressed over the eyes, parented to the head so they never come off
  for (const side of [-1, 1]) {
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.12), skin);
    palm.position.set(side * 0.17, 0.5, 0.4);
    palm.rotation.y = side * -0.25;
    headG.add(palm);
    for (let f = 0; f < 3; f++) {
      const finger = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.55, 0.075), skin);
      finger.position.set(side * (0.06 + f * 0.11), 0.86, 0.38);
      finger.rotation.x = -0.18;
      finger.rotation.z = side * f * 0.06;
      headG.add(finger);
    }
  }

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { root, legL, legR, torso, headG };
}

export function createGhost(scene) {
  const { root, legL, legR, torso, headG } = buildFigure();
  scene.add(root);

  let node = 4; // spawns far east on corridor A
  let prevNode = 3;
  root.position.set(NODES[node][0], 0, NODES[node][1]);

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

  function chooseState() {
    const r = Math.random();
    if (r < 0.5) { state = 'walk'; stateDur = Infinity; if (!target) pickNext(); }
    else if (r < 0.72) { state = 'freeze'; stateDur = 2.5 + Math.random() * 5; frozenPose = null; }
    else if (r < 0.9) { state = 'listen'; stateDur = 3 + Math.random() * 3; }
    else { state = 'skitter'; stateDur = 1 + Math.random() * 1.4; }
  }
  pickNext();

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
