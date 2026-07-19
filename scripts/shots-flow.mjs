// Visual verification of the FULL judge-facing flow, headless, zero API
// keys: landing -> case board -> consent (reduced/no-camera path, since
// headless Chrome has no real camera/mic) -> in-game HUD -> judge panel ->
// New Arrival (entity blind->sighted) -> Complete Generators + Skip To Desk
// (front-desk form) -> Win screen. Screenshots land in shots/flow/.
//
// Mirrors scripts/screenshot.mjs's launch pattern but drives the whole game
// loop instead of just teleporting the camera. Starts its own vite dev
// server + the Stay22 API server (server/index.mjs, no deps, no key needed
// -> fallback/simulated mode) so `node scripts/shots-flow.mjs` works stand-
// alone with nothing else running.
//
// Resilience: every step is wrapped so one failure (missing selector, timed
// out wait, thrown page error) doesn't abort the run — it logs the error,
// saves a best-effort "<name>-ERROR.png" of whatever is on screen, and the
// script moves on to the next step. Exit code is 0 only if every step
// succeeded; non-zero (with a summary) otherwise.
import puppeteer from 'puppeteer';
import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const OUT = process.env.SHOT_DIR ?? path.join(root, 'shots', 'flow');
mkdirSync(OUT, { recursive: true });

const consoleErrors = [];
const pageErrors = [];
let failures = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------- servers

function waitForLine(child, regex, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${regex}`)), timeoutMs);
    function onData(chunk) {
      buf += chunk.toString();
      const m = buf.match(regex);
      if (m) {
        clearTimeout(timer);
        child.stdout.off('data', onData);
        resolve(m);
      }
    }
    child.stdout.on('data', onData);
  });
}

async function startApiServer() {
  const child = spawn(process.execPath, [path.join(root, 'server', 'index.mjs')], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));
  try {
    await waitForLine(child, /listening on (http:\/\/\S+)/, 8000);
    console.log('[shots-flow] api server up');
  } catch (e) {
    console.warn('[shots-flow] api server did not confirm startup in time (continuing; client falls back locally):', e.message);
  }
  return child;
}

async function startVite() {
  const child = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', '5190'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (d) => process.stderr.write(`[vite] ${d}`));
  let url = 'http://localhost:5190/';
  try {
    const m = await waitForLine(child, /Local:\s+(http:\/\/localhost:\d+\/)/, 15000);
    url = m[1];
  } catch (e) {
    console.warn('[shots-flow] could not confirm vite URL from output, defaulting to', url, e.message);
  }
  console.log('[shots-flow] vite up at', url);
  return { child, url };
}

// ------------------------------------------------------------------ steps

async function step(name, fn, page) {
  try {
    await fn();
    console.log('ok  ', name);
    return true;
  } catch (e) {
    failures++;
    console.error('FAIL', name, '-', e.message);
    try {
      await page.screenshot({ path: path.join(OUT, `${name}-ERROR.png`) });
    } catch (shotErr) {
      console.error('     (also failed to capture error screenshot:', shotErr.message, ')');
    }
    return false;
  }
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('shot:', name);
}

async function hideOverlay(page) {
  await page.evaluate(() => {
    const el = document.getElementById('overlay');
    if (el) el.style.display = 'none';
  }).catch(() => {});
}

// --------------------------------------------------------------------- main

async function main() {
  const apiServer = await startApiServer();
  const { child: vite, url } = await startVite();

  const browser = await puppeteer.launch({ args: ['--use-gl=angle', '--enable-webgl'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.on('pageerror', (e) => { pageErrors.push(e.message); console.error('PAGE ERROR:', e.message); });
  page.on('console', (m) => { if (m.type() === 'error') { consoleErrors.push(m.text()); console.error('CONSOLE:', m.text()); } });

  await step('00-goto', async () => {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('#landing', { timeout: 10000 });
  }, page);

  // a) landing / case board -------------------------------------------------
  await step('01-landing', async () => {
    await sleep(600); // let the settle-in animation finish
    await shot(page, '01-landing');
  }, page);

  await step('02-case-board', async () => {
    await page.click('#begin');
    await page.waitForSelector('.polaroid.active-case', { timeout: 10000 });
    await sleep(2200); // polaroid drop-in + thread animations
    await shot(page, '02-case-board');
  }, page);

  // b) consent -> PROCEED UNREGISTERED (reduced input; no real camera/mic
  //    available in headless Chrome, and reduced mode must stay fully
  //    playable per the product plan) ---------------------------------------
  await step('03-consent-screen', async () => {
    await page.click('.polaroid.active-case');
    await page.waitForSelector('[data-action="reduced"]', { timeout: 10000 });
    await sleep(300);
    await shot(page, '03-consent-screen');
  }, page);

  await step('04-consent-reduced-chosen', async () => {
    await page.click('[data-action="reduced"]');
    // calibration is skipped entirely for 'reduced' -> straight to the
    // arrival intro screen inside the game.
    await page.waitForFunction(() => window.__concierge !== undefined, { timeout: 10000 });
    await page.waitForSelector('#cg-arrival', { timeout: 10000 });
    await hideOverlay(page);
    await sleep(500);
    await shot(page, '04a-arrival-intro');
    // arrival auto-dismisses into 'explore' after ~6.2s text hold + 0.9s fade
    await page.waitForFunction(() => !document.getElementById('cg-arrival'), { timeout: 12000 });
  }, page);

  // c) in-game HUD after game start -----------------------------------------
  await step('05-hud-explore', async () => {
    await hideOverlay(page);
    await sleep(500);
    await page.waitForFunction(() => window.__concierge?.game?.state === 'explore', { timeout: 8000 }).catch(() => {});
    await shot(page, '05-hud-explore');
  }, page);

  // d) judge panel -----------------------------------------------------------
  await step('06-judge-panel-open', async () => {
    await page.keyboard.press('Backquote');
    await page.waitForFunction(() => window.__judge !== undefined, { timeout: 8000 });
    await page.waitForSelector('#cg-judge', { timeout: 8000 });
    await sleep(400); // let the panel's rAF tick populate live values
    await shot(page, '06-judge-panel-open');
  }, page);

  await step('07-new-arrival-banner', async () => {
    // close the panel so the banner/HUD are unobstructed, then trigger via
    // the judge hook (more reliable than clicking a possibly-hidden button)
    await page.keyboard.press('Backquote');
    await hideOverlay(page);
    await page.evaluate(() => window.__judge.forceNewArrival());
    // onNewArrival: 800ms freeze beat, then bell + banner (~3.4s) + eyes-open hunt
    await sleep(1700);
    await shot(page, '07-new-arrival-banner');
  }, page);

  await step('08-entity-eyes-open-hunt', async () => {
    await sleep(2500);
    const eyesOpen = await page.evaluate(() => !!window.__concierge?.ghost?.eyesOpen);
    if (!eyesOpen) console.warn('     (note: ghost.eyesOpen was false at capture time, hunt may have already ended)');
    await shot(page, '08-entity-eyes-open-hunt');
  }, page);

  // The player never moves in this script, and the eyes-open New Arrival
  // hunt actively chases with LOS — a stationary player standing right next
  // to where the entity spawned is very likely to get caught (repeatedly,
  // since RETRY respawns at SPAWN, right back in the hunting entity's
  // path) before the remaining steps can run. That's the game working
  // correctly, not a bug, but the rest of this flow doesn't need the
  // hunt to keep threatening the player, so teleport well out of catch/
  // sight range once the hunt shot is captured, then recover from a lose
  // screen (possibly more than once) if one snuck in before the teleport.
  await step('08b-clear-of-danger', async () => {
    await page.evaluate(() => {
      const { player } = window.__concierge;
      player.pos.set(340, 0, 33); // corridor A — far mezzanine hallway, well >90ft from spawn/front desk
      player.vel.set(0, 0, 0);
    });
    for (let i = 0; i < 3; i++) {
      const lost = await page.evaluate(() => window.__concierge?.game?.state === 'lost');
      if (!lost) break;
      console.warn(`     (player was caught during the New Arrival hunt; clicking RETRY [attempt ${i + 1}])`);
      await page.click('#cg-retry').catch(() => {});
      await page.waitForFunction(() => window.__concierge?.game?.state !== 'lost', { timeout: 8000 }).catch(() => {});
      await page.evaluate(() => {
        const { player } = window.__concierge;
        player.pos.set(340, 0, 33);
        player.vel.set(0, 0, 0);
      });
      await sleep(200);
    }
  }, page);

  // e) Complete All Generators + Skip To Desk -> front-desk form ------------
  await step('09-front-desk-form', async () => {
    await page.evaluate(() => window.__judge.completeAllGenerators());
    await sleep(200);
    await page.evaluate(() => window.__judge.skipToDesk());
    await page.waitForSelector('#cg-desk', { timeout: 8000 });
    await sleep(500);
    // the ledger modal is a tall overflow-y:auto box; scroll it (and the
    // page) back to the top so the "PROPERTY RECORD" header is in frame
    await page.evaluate(() => {
      document.getElementById('cg-desk')?.scrollTo(0, 0);
      window.scrollTo(0, 0);
    });
    await shot(page, '09-front-desk-form');
  }, page);

  // f) Win via judge panel ----------------------------------------------------
  await step('10-win-screen', async () => {
    await page.evaluate(() => window.__judge.win());
    await page.waitForSelector('#cg-win', { timeout: 8000 });
    await sleep(500);
    await shot(page, '10-win-screen');
  }, page);

  await browser.close();
  vite.kill('SIGTERM');
  apiServer.kill('SIGTERM');

  console.log('\n--- summary ---');
  console.log('failures:', failures);
  console.log('page errors:', pageErrors.length);
  console.log('console errors:', consoleErrors.length);
  if (pageErrors.length) console.log(pageErrors.map((e) => `  pageerror: ${e}`).join('\n'));
  if (consoleErrors.length) console.log(consoleErrors.map((e) => `  console:   ${e}`).join('\n'));

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('shots-flow.mjs crashed:', e);
  process.exit(1);
});
