// Abandoned-hotel lighting: a handful of live fixtures (steady, flickering,
// dying) among many dead ones, plus the player's flashlight.
import * as THREE from 'three';

const WARM = 0xffc684;
const COLD = 0xcfe4ff;

// deterministic value noise for flicker patterns
function hash(i) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x) {
  const i = Math.floor(x);
  const f = x - i;
  return hash(i) * (1 - f) + hash(i + 1) * f;
}

function pattern(state, t, seed) {
  switch (state) {
    case 'steady':
      return 0.8 + 0.08 * Math.sin(t * 7 + seed) + 0.06 * vnoise(t * 3 + seed);
    case 'flicker': {
      const v = vnoise(t * 9 + seed * 13.7);
      const on = v > 0.3 ? 1 : v < 0.12 ? 0 : v * 2.2;
      return on * (0.75 + 0.25 * vnoise(t * 47 + seed));
    }
    case 'dying': {
      const gate = vnoise(t * 0.6 + seed * 7.3);
      if (gate < 0.72) return 0;
      return (0.35 + 0.65 * vnoise(t * 60 + seed)) * ((gate - 0.72) / 0.28);
    }
    default:
      return 0;
  }
}

// fixture definitions: [type, x, y, z, state, cold?]
// y is the fixture's own elevation in world feet.
const FIXTURES = [
  // --- mezzanine, corridor A sconces (band-1 south wall face, z=28.35)
  ...[12, 36, 60, 84, 108, 132, 156, 180, 204, 228, 252, 276, 300, 324, 348, 370].map((x) => {
    const state = { 60: 'flicker', 156: 'dying', 252: 'steady', 348: 'flicker' }[x] ?? 'dead';
    return ['sconce', x, 6.5, 28.45, state];
  }),
  // corridor B pendants
  ['pendant', 40, 9.3, 121.4, 'dying'],
  ['pendant', 105, 9.3, 121.4, 'dead'],
  ['pendant', 160, 9.3, 121.4, 'flicker'], // over the dead planter
  ['pendant', 220, 9.3, 121.4, 'dead'],
  ['pendant', 280, 9.3, 121.4, 'steady'],
  ['pendant', 340, 9.3, 121.4, 'dead'],
  // connector corridors between the central columns
  ['pendant', 100, 9.3, 75, 'flicker'],
  ['pendant', 161, 9.3, 75, 'dead'],
  ['pendant', 226.5, 9.3, 75, 'dying'],
  // east foyer
  ['pendant', 320, 9.3, 75, 'flicker'],
  // rooms
  ['chandelier', 130.75, 8.6, 81.6, 'flicker'], // Territories
  ['pendant', 37.7, 9.6, 146.7, 'steady'], // Library, warm reading light
  ['fluoro', 72.5, 9.7, 56, 'dying', true], // mezzanine kitchen
  // --- convention floor (world coords; floor at y=-26)
  ['pendant', 100, -13, 60, 'flicker'],
  ['pendant', 100, -13, 120, 'dead'],
  ['pendant', 100, -13, 170, 'dying'],
  ['pendant', 150, -13, 90, 'steady'],
  ['chandelier', 47.8, -5.5, 89, 'flicker'], // Concert Hall
  ['chandelier', 47.8, -5.5, 140, 'dead'],
  ['chandelier', 117, -4.5, 222.7, 'flicker'], // Ballroom center
  ['chandelier', 80, -4.5, 222.7, 'dead'],
  ['chandelier', 154, -4.5, 222.7, 'dead'],
  ['chandelier', 264, -7.5, 70, 'dying'], // Canadian
  ['chandelier', 264, -7.5, 140, 'dead'],
  ['fluoro', 100, -13.2, 18, 'dying', true], // convention kitchen
  ['fluoro', 140, -13.2, 18, 'dead', true],
  ['pendant', 100, -13.5, 187, 'flicker'], // south pre-function strip
  ['pendant', 160, -13.5, 187, 'steady'],
  ['pendant', 230, -13.5, 187, 'dead'],
  ['fluoro', 206.5, -8, 137, 'dying', true], // escalator shaft
  ['chandelier', 208, -11.5, 37, 'dead'], // Ontario
];

function fixtureMesh(type, cold) {
  const g = new THREE.Group();
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x3a3a34,
    emissive: cold ? COLD : WARM,
    emissiveIntensity: 0,
    roughness: 0.4,
  });
  if (type === 'sconce') {
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.6, 0.2), new THREE.MeshStandardMaterial({ color: 0x241c12, roughness: 0.7 }));
    g.add(back);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.24, 0.9, 8, 1, true), glassMat);
    shade.position.set(0, 0.1, 0.32);
    g.add(shade);
  } else if (type === 'pendant') {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0x1c1a16 }));
    rod.position.y = 0.9;
    g.add(rod);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 1.05, 0.8, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0x2c261c, roughness: 0.6, side: THREE.DoubleSide }));
    g.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), glassMat);
    bulb.position.y = -0.28;
    g.add(bulb);
  } else if (type === 'chandelier') {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6), new THREE.MeshStandardMaterial({ color: 0x2a241a, metalness: 0.5, roughness: 0.5 }));
    stem.position.y = 1.6;
    g.add(stem);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.09, 6, 20), new THREE.MeshStandardMaterial({ color: 0x4a3c22, metalness: 0.7, roughness: 0.4 }));
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), glassMat);
      bulb.position.set(Math.cos(a) * 1.7, 0.28, Math.sin(a) * 1.7);
      g.add(bulb);
    }
  } else { // fluoro
    const frame = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.22, 1.4), new THREE.MeshStandardMaterial({ color: 0x3c3e40, roughness: 0.6 }));
    g.add(frame);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.1, 1.15), glassMat);
    panel.position.y = -0.1;
    g.add(panel);
  }
  return { group: g, glassMat };
}

export function makeLighting(scene) {
  scene.add(new THREE.HemisphereLight(0x2a3444, 0x0b0908, 0.12));

  const live = [];
  let seed = 1;
  for (const [type, x, y, z, state, cold] of FIXTURES) {
    const { group, glassMat } = fixtureMesh(type, cold);
    group.position.set(x, y, z);
    scene.add(group);
    if (state === 'dead') continue;
    const color = cold ? COLD : WARM;
    const intensity = type === 'chandelier' ? 260 : type === 'sconce' ? 90 : 150;
    const light = new THREE.PointLight(color, 0, type === 'chandelier' ? 80 : 55, 2);
    light.position.set(x, y - (type === 'sconce' ? -0.4 : 0.6), z);
    scene.add(light);
    live.push({ light, glassMat, state, base: intensity, seed: seed++ * 3.7 });
  }

  // flashlight: spot with a lagging target for weighty handheld feel
  const flashlight = new THREE.SpotLight(0xfff1d6, 0, 130, 0.46, 0.55, 1.8);
  flashlight.castShadow = true;
  flashlight.shadow.mapSize.set(1024, 1024);
  flashlight.shadow.camera.near = 0.5;
  flashlight.shadow.camera.far = 130;
  flashlight.shadow.bias = -0.002;
  const flashTarget = new THREE.Object3D();
  scene.add(flashlight, flashTarget);
  flashlight.target = flashTarget;
  let flashOn = true;
  const aimDir = new THREE.Vector3(0, 0, -1);
  const wantDir = new THREE.Vector3();

  return {
    toggleFlashlight() { flashOn = !flashOn; },
    update(dt, camera) {
      const t = performance.now() / 1000;
      for (const f of live) {
        const v = pattern(f.state, t, f.seed);
        f.light.intensity = f.base * v;
        f.glassMat.emissiveIntensity = v * 1.6;
      }
      // flashlight follows the camera with lag + tiny unreliable dips
      camera.getWorldDirection(wantDir);
      aimDir.lerp(wantDir, Math.min(1, dt * 9)).normalize();
      const right = new THREE.Vector3().crossVectors(wantDir, camera.up).normalize();
      flashlight.position.copy(camera.position).addScaledVector(right, 0.55).add(new THREE.Vector3(0, -0.65, 0));
      flashTarget.position.copy(flashlight.position).addScaledVector(aimDir, 40);
      const dip = vnoise(t * 2.3) > 0.94 ? 0.35 + 0.4 * vnoise(t * 55) : 1;
      flashlight.intensity = flashOn ? 950 * dip : 0;
    },
  };
}
