import * as THREE from 'three';
import spec from '../royal_york_meeting_floors_spec.json';
import { buildFloors, SPAWN } from './layout.js';
import { makeMaterials } from './textures.js';
import { buildFloor, buildEscalator, buildOval } from './world.js';
import { buildProps } from './props.js';
import { makeLighting } from './lights.js';
import { Player } from './player.js';
import { initAudio, footstep, landThump } from './audio.js';
import { initUI } from './ui.js';
import { createGhost } from './ghost.js';

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
const ghost = createGhost(scene);
const player = new Player(camera, colliders, SPAWN, hideVolumes);
player.onFootstep = footstep;
player.onLand = landThump;
camera.position.set(SPAWN.x, SPAWN.y + 5.4, SPAWN.z);
camera.rotation.order = 'YXZ';
camera.rotation.y = SPAWN.yaw;
window.__concierge = { player, camera, scene, ghost };

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
});
document.addEventListener('keyup', (e) => input.keys.delete(e.code));

let started = false;
function enterGame() {
  started = true;
  initAudio();
  renderer.domElement.requestPointerLock();
}
initUI({ onEnter: enterGame });
overlay.addEventListener('click', enterGame);
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === renderer.domElement;
  overlay.classList.toggle('shown', started && !locked);
  if (!locked) input.keys.clear();
});
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === renderer.domElement) {
    player.onMouseMove(e.movementX, e.movementY);
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- loop
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (document.pointerLockElement === renderer.domElement) {
    player.update(dt, input);
    ghost.update(dt, player.pos);
    vignetteEl.classList.toggle('concealed', player.concealed);
  }
  lighting.update(dt, camera);
  renderer.render(scene, camera);
});
