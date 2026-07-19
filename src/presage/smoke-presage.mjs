// Smoke test for the Presage adapter's pure logic (dsp.js) plus a
// node-importability check for index.js. Pure node:assert, no browser, no
// test runner dependency. Exits non-zero on any failure.
//
// Run with: node src/presage/smoke-presage.mjs

import assert from 'node:assert/strict';
import {
  clamp01,
  createTalkingState,
  stepTalkingDetector,
  TALKING_DEFAULTS,
  createBreathingState,
  stepBreathingSmoother,
  BREATHING_DEFAULTS,
  computeFaceVisible,
  FACE_VARIANCE_THRESHOLD,
  createFaceLockState,
  stepFaceLock,
} from './dsp.js';

let failures = 0;
let count = 0;
const pending = [];

// Supports both sync and async check functions; failures (thrown or
// rejected) are caught and reported without aborting the remaining checks.
function check(name, fn) {
  count++;
  pending.push(
    Promise.resolve()
      .then(fn)
      .then(() => {
        console.log(`ok - ${name}`);
      })
      .catch((err) => {
        failures++;
        console.error(`FAIL - ${name}`);
        console.error(err && err.message ? err.message : err);
      })
  );
}

// ----------------------------- clamp01 --------------------------------

check('clamp01 clamps below 0, above 1, and NaN', () => {
  assert.equal(clamp01(-5), 0);
  assert.equal(clamp01(5), 1);
  assert.equal(clamp01(0.42), 0.42);
  assert.equal(clamp01(NaN), 0);
});

// -------------------------- talking detector ---------------------------

function feedTalking(state, samples) {
  let s = state;
  let last = null;
  for (const sample of samples) {
    last = stepTalkingDetector(s, sample);
    s = last.state;
  }
  return { state: s, ...last };
}

check('talking detector stays off during silence', () => {
  let state = createTalkingState();
  const silence = Array.from({ length: 60 }, () => ({ rms: 0.01, speechBandRatio: 0.1 }));
  const result = feedTalking(state, silence);
  assert.equal(result.talking, false);
});

check('talking detector requires sustained frames, ignores a single transient', () => {
  let state = createTalkingState();
  // One single loud frame surrounded by silence should NOT flip talking on
  // (onFrames defaults to 3 consecutive frames above threshold).
  const samples = [
    { rms: 0.01, speechBandRatio: 0.1 },
    { rms: 0.4, speechBandRatio: 0.9 },
    { rms: 0.01, speechBandRatio: 0.1 },
    { rms: 0.01, speechBandRatio: 0.1 },
  ];
  const result = feedTalking(state, samples);
  assert.equal(result.talking, false, 'a single transient frame must not trigger talking');
});

check('talking detector turns on after sustained speech-like energy, with rising confidence', () => {
  let state = createTalkingState();
  const speech = Array.from({ length: 40 }, () => ({ rms: 0.35, speechBandRatio: 0.85 }));
  const result = feedTalking(state, speech);
  assert.equal(result.talking, true, 'sustained loud speech-band energy should trigger talking');
  assert.ok(result.confidence >= 0.5, `expected confidence >= 0.5 once clearly talking, got ${result.confidence}`);
});

check('talking detector turns back off after sustained silence following speech', () => {
  let state = createTalkingState();
  const speech = Array.from({ length: 40 }, () => ({ rms: 0.35, speechBandRatio: 0.85 }));
  let result = feedTalking(state, speech);
  assert.equal(result.talking, true);
  const silence = Array.from({ length: 40 }, () => ({ rms: 0.01, speechBandRatio: 0.1 }));
  result = feedTalking(result.state, silence);
  assert.equal(result.talking, false, 'sustained silence after speech should turn talking back off');
});

check('talking detector does not react to loud non-speech-band noise as strongly as speech', () => {
  // Same loudness (rms), but low speech-band ratio (e.g. a generator hum) —
  // should be much less likely to trigger sustained "talking" than actual
  // speech-band-heavy energy at the same loudness.
  let state = createTalkingState();
  const noise = Array.from({ length: 60 }, () => ({ rms: 0.3, speechBandRatio: 0.05 }));
  const result = feedTalking(state, noise);
  let speechState = createTalkingState();
  const speech = Array.from({ length: 60 }, () => ({ rms: 0.3, speechBandRatio: 0.9 }));
  const speechResult = feedTalking(speechState, speech);
  assert.ok(
    speechResult.state.envelope > result.state.envelope,
    'speech-band-heavy energy should produce a higher envelope than flat noise at equal rms'
  );
});

check('talking detector honors custom threshold options', () => {
  let state = createTalkingState();
  const opts = { ...TALKING_DEFAULTS, onThreshold: 0.5, offThreshold: 0.4 };
  const loudButBelowCustomThreshold = Array.from({ length: 40 }, () => ({ rms: 0.35, speechBandRatio: 0.85 }));
  const result = feedTalking(state, loudButBelowCustomThreshold.map((s) => ({ ...s })));
  // With defaults this would be "talking", but stepTalkingDetector is called
  // per-sample with opts, so re-run explicitly with the raised threshold.
  let s2 = createTalkingState();
  let last;
  for (const sample of loudButBelowCustomThreshold) {
    last = stepTalkingDetector(s2, sample, opts);
    s2 = last.state;
  }
  assert.equal(last.talking, false, 'raising onThreshold above the envelope should keep talking false');
  void result;
});

// -------------------------- breathing smoother --------------------------

function feedBreathing(state, samples) {
  let s = state;
  let last = null;
  for (const sample of samples) {
    last = stepBreathingSmoother(s, sample);
    s = last.state;
  }
  return { state: s, ...last };
}

check('breathing smoother stays near zero for a perfectly flat signal', () => {
  let state = createBreathingState();
  const flat = Array.from({ length: 120 }, () => ({ diff: 0, faceVisible: true }));
  const result = feedBreathing(state, flat);
  assert.ok(result.breathingIntensity < 0.05, `expected near-zero intensity for flat input, got ${result.breathingIntensity}`);
});

check('breathing smoother rises for an oscillating (breathing-like) signal vs. staying flat for none', () => {
  const oscillating = Array.from({ length: 150 }, (_, i) => ({
    diff: 0.02 + 0.02 * Math.abs(Math.sin(i / 6)),
    faceVisible: true,
  }));
  const flat = Array.from({ length: 150 }, () => ({ diff: 0, faceVisible: true }));
  const oscResult = feedBreathing(createBreathingState(), oscillating);
  const flatResult = feedBreathing(createBreathingState(), flat);
  assert.ok(oscResult.breathingIntensity > 0.1, `expected raised intensity for oscillating input, got ${oscResult.breathingIntensity}`);
  assert.ok(
    flatResult.breathingIntensity < 0.01,
    `expected near-zero intensity for perfectly flat input, got ${flatResult.breathingIntensity}`
  );
  assert.ok(oscResult.breathingIntensity > flatResult.breathingIntensity * 10, 'oscillating signal must clearly dominate flat');
});

check('breathing confidence ramps up over time but never exceeds the honest max', () => {
  let state = createBreathingState();
  const oscillating = Array.from({ length: 30 }, (_, i) => ({
    diff: 0.02 + 0.02 * Math.abs(Math.sin(i / 6)),
    faceVisible: true,
  }));
  const early = feedBreathing(state, oscillating);
  const late = feedBreathing(
    early.state,
    Array.from({ length: 200 }, (_, i) => ({ diff: 0.02 + 0.02 * Math.abs(Math.sin((i + 30) / 6)), faceVisible: true }))
  );
  assert.ok(late.confidence > early.confidence, 'confidence should ramp up with more samples');
  assert.ok(
    late.confidence <= BREATHING_DEFAULTS.maxConfidence + 1e-9,
    `fallback breathing confidence must stay low/honest, got ${late.confidence}`
  );
});

check('breathing confidence is penalized when no face is visible', () => {
  const oscillating = (faceVisible) =>
    Array.from({ length: 150 }, (_, i) => ({ diff: 0.02 + 0.02 * Math.abs(Math.sin(i / 6)), faceVisible }));
  const withFace = feedBreathing(createBreathingState(), oscillating(true));
  const withoutFace = feedBreathing(createBreathingState(), oscillating(false));
  assert.ok(
    withoutFace.confidence < withFace.confidence,
    'missing face should reduce confidence relative to the same signal with a face visible'
  );
});

// ------------------------------ face visible ----------------------------

check('computeFaceVisible: low variance -> not visible, high variance -> visible', () => {
  assert.equal(computeFaceVisible(0.0001), false);
  assert.equal(computeFaceVisible(FACE_VARIANCE_THRESHOLD + 0.01), true);
});

check('face lock gate requires sustained frames before LOCKED, and drops after sustained loss', () => {
  let state = createFaceLockState();
  const present = Array.from({ length: 20 }, () => FACE_VARIANCE_THRESHOLD + 0.02);
  let last;
  for (const v of present) {
    last = stepFaceLock(state, v);
    state = last.state;
  }
  assert.equal(last.locked, true, 'sustained high variance should lock face presence');

  const absent = Array.from({ length: 20 }, () => 0.0001);
  for (const v of absent) {
    last = stepFaceLock(state, v);
    state = last.state;
  }
  assert.equal(last.locked, false, 'sustained low variance should drop the face lock');
});

// -------------------------- index.js node-importability ------------------

check('index.js imports cleanly under plain Node (no top-level window/document access)', async () => {
  const mod = await import('./index.js');
  assert.equal(typeof mod.createPresage, 'function');
  assert.equal(typeof mod.createCaptureIndicator, 'function');
});

check('createPresage() can be constructed and read in Node without touching the DOM', async () => {
  const { createPresage } = await import('./index.js');
  const presage = createPresage();
  assert.equal(presage.mode, 'reduced');
  assert.equal(presage.signals.talking, false);
  assert.equal(presage.signals.talkingConfidence, 0);
  assert.equal(presage.signals.breathingIntensity, 0);
  assert.equal(presage.signals.breathingConfidence, 0);
  assert.equal(presage.signals.pulseBpm, null);
  assert.equal(presage.signals.faceVisible, false);
});

check('setSimulated overrides report confidence 1 and are mode-agnostic', async () => {
  const { createPresage } = await import('./index.js');
  const presage = createPresage();
  presage.setSimulated({ talking: true, breathingIntensity: 0.8 });
  assert.equal(presage.signals.talking, true);
  assert.equal(presage.signals.talkingConfidence, 1);
  assert.equal(presage.signals.breathingIntensity, 0.8);
  assert.equal(presage.signals.breathingConfidence, 1);
  // still reduced mode (never started/calibrated) — simulated values apply regardless
  assert.equal(presage.mode, 'reduced');
  presage.setSimulated({ talking: undefined, breathingIntensity: undefined });
  assert.equal(presage.signals.talking, false);
  assert.equal(presage.signals.breathingConfidence, 0);
});

check('engine start() while running hands the sample stream to the new callback', async () => {
  // Regression: calibration starts the engine with its own callback; the
  // game's later start() call must take over the stream, not be ignored.
  const fakeStream = { getTracks: () => [] };
  globalThis.navigator = {
    mediaDevices: { getUserMedia: async () => fakeStream },
  };
  globalThis.document = {
    createElement: (tag) =>
      tag === 'video'
        ? { muted: false, playsInline: false, srcObject: null, readyState: 0, play: async () => {} }
        : { width: 0, height: 0, getContext: () => null },
  };
  globalThis.window = {
    AudioContext: class {
      constructor() {
        this.sampleRate = 48000;
        this.state = 'running';
      }
      createMediaStreamSource() {
        return { connect() {} };
      }
      createAnalyser() {
        return {
          fftSize: 1024,
          smoothingTimeConstant: 0,
          frequencyBinCount: 512,
          getByteTimeDomainData(a) { a.fill(128); },
          getByteFrequencyData(a) { a.fill(0); },
        };
      }
      async resume() {}
      async close() {}
    },
  };
  try {
    const { createFallbackEngine } = await import('./engine.js');
    const eng = createFallbackEngine();
    let calibrationSamples = 0;
    let gameSamples = 0;
    const r1 = await eng.start(() => calibrationSamples++);
    assert.equal(r1.ok, true);
    await new Promise((r) => setTimeout(r, 200));
    assert.ok(calibrationSamples > 0, 'calibration callback should receive samples');
    const r2 = await eng.start(() => gameSamples++); // engine already running
    assert.equal(r2.ok, true);
    const before = calibrationSamples;
    await new Promise((r) => setTimeout(r, 200));
    assert.ok(gameSamples > 0, 'second start() callback must take over the stream');
    assert.equal(calibrationSamples, before, 'old callback must stop receiving samples');
    eng.stop();
  } finally {
    delete globalThis.navigator;
    delete globalThis.document;
    delete globalThis.window;
  }
});

await Promise.all(pending);

console.log(`\n${count - failures}/${count} checks passed`);
if (failures > 0) {
  console.error(`${failures} FAILURE(S)`);
  process.exit(1);
}
