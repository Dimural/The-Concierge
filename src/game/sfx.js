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

// The catch jumpscare's audio sting: a dissonant, detuned cluster (close,
// ugly intervals — no clean fifths/octaves) stacked with a sharp broadband
// noise burst, meant to read as one violent jolt rather than a musical hit.
export function catchSting() {
  const c = ensureCtx();
  if (!c || c.state !== 'running') return;
  const t = c.currentTime;
  const freqs = [55, 58, 87, 92, 138, 233]; // clashing, semitone-ish clusters
  freqs.forEach((f, i) => {
    const o = c.createOscillator();
    o.type = i % 2 === 0 ? 'sawtooth' : 'square';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f * 0.6), t + 1.05);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.24 / (i + 1), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95 - i * 0.05);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 1.05);
  });
  // sharp noise burst on top -- the actual "jolt"
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * 0.4)), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1800;
  f.Q.value = 0.55;
  const g2 = c.createGain();
  g2.gain.setValueAtTime(0.5, t);
  g2.gain.exponentialRampToValueAtTime(0.0005, t + 0.35);
  src.connect(f).connect(g2).connect(c.destination);
  src.start(t);
}

// A short, sharp near-miss stinger — much smaller than the catch sting —
// for when a hunt/pursuit kicks off close to the player.
export function nearMissSting() {
  tone(660, 0.12, 0.15, 'sawtooth');
  tone(233, 0.18, 0.09, 'square', 0.015);
}

// A low heartbeat-style double-thump used for the finalHunt dread escalation;
// interval and strength are driven by the caller (faster/louder as the
// entity closes the distance).
export function heartbeatPulse(strength = 1) {
  tone(58, 0.14, 0.15 * strength, 'sine');
  tone(46, 0.22, 0.11 * strength, 'sine', 0.11);
}
