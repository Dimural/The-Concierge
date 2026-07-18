// Visual verification: loads the dev server, hides the overlay, teleports the
// camera to key locations, saves screenshots.
import puppeteer from 'puppeteer';
import { mkdirSync } from 'node:fs';

const OUT = process.env.SHOT_DIR ?? 'shots';
mkdirSync(OUT, { recursive: true });

const SPOTS = [
  { name: 'spawn-corridor', pos: [183, 5.4, 137], yaw: Math.PI / 2, pitch: 0 },
  { name: 'escalator-top', pos: [182, 5.4, 137], yaw: -Math.PI / 2, pitch: -0.25 },
  { name: 'escalator-bottom', pos: [231, -20.6, 137], yaw: Math.PI / 2, pitch: 0.15 },
  { name: 'corridor-b-planter', pos: [190, 5.4, 121.4], yaw: Math.PI / 2, pitch: 0 },
  { name: 'corridor-a', pos: [340, 5.4, 33], yaw: Math.PI / 2, pitch: 0 },
  { name: 'ballroom', pos: [117, -20.6, 235], yaw: 0, pitch: 0.05 },
  { name: 'concert-hall', pos: [47, -20.6, 150], yaw: 0, pitch: 0.05 },
  { name: 'canadian', pos: [264, -20.6, 180], yaw: 0, pitch: 0.05 },
  { name: 'conv-foyer', pos: [100, -20.6, 100], yaw: Math.PI, pitch: 0 },
  { name: 'territories', pos: [130, 5.4, 92], yaw: 0.3, pitch: 0 },
];

const browser = await puppeteer.launch({ args: ['--use-gl=angle', '--enable-webgl'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE:', m.text()); });

await page.goto('http://localhost:5199/', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__concierge !== undefined, { timeout: 15000 });
await page.evaluate(() => { document.getElementById('overlay').style.display = 'none'; });

for (const s of SPOTS) {
  await page.evaluate((spot) => {
    const { camera } = window.__concierge;
    camera.position.set(...spot.pos);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = spot.yaw;
    camera.rotation.x = spot.pitch;
    camera.rotation.z = 0;
  }, s);
  await new Promise((r) => setTimeout(r, 450)); // let flicker/flashlight settle
  await page.screenshot({ path: `${OUT}/${s.name}.png` });
  console.log('shot:', s.name);
}

await browser.close();
