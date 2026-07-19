// Lazy WebAudio sfx for the game loop: generator hum/clunk, desk bell, UI
// ticks. Self-contained (no dependency on src/audio.js) so Task 5 can swap
// these for real samples later without touching this file's callers.
let ctx = null;

function ensureCtx() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, gainPeak, type = 'sine', delay = 0) {
  const c = ensureCtx();
  if (!c || c.state !== 'running') return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, gainPeak), t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.03);
}

// low sawtooth drone while a generator is being restored
export function generatorHum() {
  tone(72, 0.5, 0.05, 'sawtooth');
  tone(144, 0.5, 0.02, 'sawtooth', 0.02);
}

// the lever-clunk + relay chatter when a generator finishes
export function generatorClunk() {
  tone(90, 0.18, 0.22, 'square');
  tone(45, 0.3, 0.18, 'triangle', 0.03);
  tone(220, 0.12, 0.08, 'square', 0.08);
}

// the front-desk bell (used both for a wrong submission and new-arrival)
export function deskBell() {
  tone(1046.5, 0.9, 0.16, 'sine');
  tone(1568, 0.7, 0.08, 'sine', 0.02);
}

export function uiTick() {
  tone(720, 0.05, 0.06, 'square');
}

export function wrongBuzz() {
  tone(140, 0.35, 0.16, 'sawtooth');
}
