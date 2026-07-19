import * as THREE from 'three';
import spec from '../royal_york_meeting_floors_spec.json';
import { buildFloors, SPAWN } from './layout.js';
import { makeMaterials } from './textures.js';
import { buildFloor, buildEscalator, buildOval } from './world.js';
import { buildProps } from './props.js';
import { makeLighting } from './lights.js';
import { Player } from './player.js';
import { initAudio, footstep, landThump, bell, printer } from './audio.js';
import { initUI } from './ui.js';
import { createGhost } from './ghost.js';
import { noiseBus } from './noise.js';
import { createPresage } from './presage/index.js';
import { createSession, startTransactionWatcher, simulateBooking } from './stay22.js';
import { createGame } from './game/index.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030507);
scene.fog = new THREE.FogExp2(0x030507, 0.016);

const camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.1, 500);

// --- build the hotel
const mats = makeMaterials();
const floors = buildFloors(spec);
const colliders = [];
for (const floor of floors) {
  const { group, colliders: c } = buildFloor(floor, mats);
  scene.add(group);
  colliders.push(...c);
}
for (const build of [buildEscalator, buildOval]) {
  const { group, colliders: c } = build(mats);
  scene.add(group);
  colliders.push(...c);
}
let hideVolumes = [];
{
  const { group, colliders: c, hideVolumes: hv } = buildProps(floors, mats);
  scene.add(group);
  colliders.push(...c);
  hideVolumes = hv;
}

const lighting = makeLighting(scene);
const ghost = createGhost(scene, colliders);
const player = new Player(camera, colliders, SPAWN, hideVolumes);
// wrap the existing sound hooks so the entity's noise bus hears the player too
player.onFootstep = (running) => {
  footstep(running);
  noiseBus.emit(player.pos.x, player.pos.z, running ? 0.55 : 0.16, running ? 'run' : 'footstep');
};
player.onLand = (fallSpeed) => {
  landThump(fallSpeed);
  noiseBus.emit(player.pos.x, player.pos.z, Math.min(1.5, 0.5 + fallSpeed * 0.03), 'land');
};
camera.position.set(SPAWN.x, SPAWN.y + 5.4, SPAWN.z);
camera.rotation.order = 'YXZ';
camera.rotation.y = SPAWN.yaw;

// --- Presage (biometric adapter) + game loop, wired together -------------
const presage = createPresage();
const game = createGame({ scene, floors, colliders, player, camera });
game.attachGhost(ghost);
game.attachPresage(presage);

// the entity catching the player ends the run; the game module owns the
// lose screen + retry flow
ghost.onCatch = () => game.handleCatch();

// world sounds the game loop produces (generators, etc.) join the same
// noise bus the entity listens on
game.onSound = ({ x, z, loudness, kind }) => noiseBus.emit(x, z, loudness, kind);
game.onBell = () => bell();
game.onGeneratorSound = () => printer();
game.onLightsFlicker = () => lighting.flicker(2.2);
game.onSimulateBooking = () => { simulateBooking().catch(() => {}); };
game.onRetry = () => requestLock();

window.__concierge = { player, camera, scene, ghost, noiseBus, presage, game };

// --- input
const input = { keys: new Set(), jumpQueued: false };
const overlay = document.getElementById('overlay');
const vignetteEl = document.getElementById('vignette');

document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  input.keys.add(e.code);
  if (e.code === 'Space') { input.jumpQueued = true; e.preventDefault(); }
  if (e.code === 'KeyC' || e.code === 'ControlLeft') player.toggleProne();
  if (e.code === 'KeyF') lighting.toggleFlashlight();
  // Tab (journal) and Backquote (judge panel) are already bound inside
  // src/game/index.js — only E (interact) is main.js's to wire.
  if (e.code === 'KeyE' && started) game.interact();
});
document.addEventListener('keyup', (e) => input.keys.delete(e.code));

// a full-screen game DOM surface is open (arrival/win/lose/desk from
// src/game/*, or the consent/calibration screens from src/presage/*) — the
// pointer-lock pause overlay must never fight these for the player's clicks.
function isGameScreenOpen() {
  return game.state === 'desk'
    || !!document.querySelector('.cg-screen')
    || !!document.querySelector('.presage-root');
}

function updateOverlay() {
  const locked = document.pointerLockElement === renderer.domElement;
  overlay.classList.toggle('shown', started && !locked && !isGameScreenOpen());
}

function requestLock() {
  renderer.domElement.requestPointerLock();
}

let started = false;
// One-time entry: consent/calibration have already resolved by the time this
// runs. Starts audio, biometric capture, and the arrival sequence, then
// engages pointer lock. Do not call this again for a plain pause/resume —
// use requestLock() for that (see overlay click handler / game.onRetry).
function enterGame() {
  started = true;
  initAudio();
  presage.start();
  game.start();
  requestLock();
}

// Case board click -> consent -> calibration (skipped in reduced mode) ->
// enter game. Stay22's session fetch runs in parallel with that flow so it's
// usually ready by the time the player reaches the front desk.
async function onCaseSelected() {
  createSession()
    .then((session) => {
      game.attachSession(session);
      startTransactionWatcher({ onNewArrival: (txn) => game.onNewArrival(txn) });
    })
    .catch(() => {});

  const container = document.getElementById('entry-flow');
  const consent = await presage.requestConsent(container);
  if (consent !== 'reduced') {
    await presage.calibrate(container);
  }
  enterGame();
}

initUI({ onEnter: onCaseSelected });
overlay.addEventListener('click', () => { if (started) requestLock(); });
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== renderer.domElement) input.keys.clear();
  updateOverlay();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === renderer.domElement) {
    player.onMouseMove(e.movementX, e.movementY);
  }
});

// --- loop
const clock = new THREE.Clock();
let lastGameState = null;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const locked = document.pointerLockElement === renderer.domElement;

  if (started) {
    if (locked) {
      player.update(dt, input);
      vignetteEl.classList.toggle('concealed', player.concealed);
    }

    // Presage signals -> entity senses, every frame. Confident talking is
    // also a sound the noise bus (and anything else listening on it) hears
    // at the player's actual position.
    const s = presage.signals;
    ghost.applySignals(s);
    if (s.talking && s.talkingConfidence >= 0.5) {
      noiseBus.emit(player.pos.x, player.pos.z, 0.7, 'talk');
    }

    game.update(dt);
    ghost.update(dt, { pos: player.pos, concealed: player.concealed });

    // won/lost screens need a normal visible cursor to click RETRY / the
    // booking link — release pointer lock the moment either is reached.
    // ('desk' releases it itself, from src/game/deskForm.js.)
    if (game.state !== lastGameState) {
      if ((game.state === 'lost' || game.state === 'won') && locked) {
        document.exitPointerLock();
      }
      lastGameState = game.state;
    }
  }

  lighting.update(dt, camera);
  renderer.render(scene, camera);
  updateOverlay();
});
