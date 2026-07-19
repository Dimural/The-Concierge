// Procedural footsteps and landing thuds via WebAudio — no asset files.
let ctx = null;
let noiseBuf = null;

export function initAudio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function thud(time, freq, vol, dur) {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(freq, time);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * 0.5), time + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  o.connect(g).connect(ctx.destination);
  o.start(time);
  o.stop(time + dur + 0.02);
}

export function footstep(running) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  // sprinting is LOUD — it will matter once the entity can hear
  const vol = (running ? 0.34 : 0.1) * (0.8 + Math.random() * 0.4);
  // carpet scuff: short filtered noise burst
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = running ? 640 : 330;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + (running ? 0.12 : 0.09));
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t, Math.random() * 0.5, 0.14);
  // heel weight, heavier at a run
  thud(t, running ? 80 + Math.random() * 25 : 65 + Math.random() * 25, vol * (running ? 1.1 : 0.9), running ? 0.09 : 0.07);
}

// the entity's knocking footfall — hollow, lower than the player's own steps
export function ghostStep(gain) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const vol = 0.32 * gain;
  thud(t, 38 + Math.random() * 8, vol, 0.15);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 190;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol * 0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t, Math.random() * 0.5, 0.14);
}

// a long dry exhale when he lingers nearby
export function ghostBreath(gain) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(210, t);
  f.frequency.linearRampToValueAtTime(130, t + 1.6);
  f.Q.value = 1.4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.13 * gain, t + 0.5);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.7);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t, Math.random() * 0.4, 1.8);
}

// the front-desk/arrival bell — a bright, metallic strike with tuned
// overtones, used by the game loop's onBell hook (wrong ledger submission,
// new-arrival chain). Distinct from src/game/sfx.js's own deskBell() so the
// two can layer without fighting over one AudioContext.
export function bell() {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const overtones = [988, 1480, 1975]; // bright metallic strike, roughly a fifth+octave stack
  overtones.forEach((freq, i) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22 / (i + 1), t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4 - i * 0.15);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 1.5);
  });
}

// dot-matrix printer chatter — a low motor whine plus a rapid burst of
// filtered noise "clacks", for the archive generators printing a restored
// record (wired to the game loop's onGeneratorSound hook).
export function printer() {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const motor = ctx.createOscillator();
  motor.type = 'square';
  motor.frequency.setValueAtTime(180, t);
  motor.frequency.linearRampToValueAtTime(140, t + 0.6);
  const motorGain = ctx.createGain();
  motorGain.gain.setValueAtTime(0.0001, t);
  motorGain.gain.exponentialRampToValueAtTime(0.05, t + 0.05);
  motorGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  motor.connect(motorGain).connect(ctx.destination);
  motor.start(t);
  motor.stop(t + 0.65);

  const clacks = 10;
  for (let i = 0; i < clacks; i++) {
    const ct = t + i * 0.05 + Math.random() * 0.01;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2200 + Math.random() * 800;
    f.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.09, ct);
    g.gain.exponentialRampToValueAtTime(0.001, ct + 0.03);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(ct, Math.random() * 0.4, 0.04);
  }
}

export function landThump(strength) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const vol = Math.min(0.5, 0.12 + strength * 0.02);
  thud(t, 55, vol, 0.16);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 420;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol * 0.8, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t, Math.random() * 0.5, 0.16);
}
