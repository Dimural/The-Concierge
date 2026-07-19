// Pure signal-processing helpers for the Presage fallback engine.
//
// Everything in this file is a plain function operating on plain data — no
// DOM, no `window`/`navigator`, no browser APIs, no hidden mutable module
// state. That makes it safe to import under plain Node (see
// `smoke-presage.mjs`) and easy to unit test with synthetic sample
// sequences, independent of getUserMedia/AudioContext availability.

export function clamp01(v) {
  if (Number.isNaN(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// ---------------------------------------------------------------------
// Talking detector: hysteresis gate over a loudness+"speechiness" score.
//
// Feed it one sample per audio analysis frame:
//   { rms: 0..1, speechBandRatio: 0..1 }
// `rms` is overall loudness (root-mean-square of the time-domain signal).
// `speechBandRatio` is the fraction of frequency-bin energy that falls in
// the human speech band (~300Hz-3400Hz) — voice-like sound scores higher
// than a generic thump or hum at the same loudness.
//
// The detector tracks a smoothed envelope of that combined score against
// two thresholds (onThreshold > offThreshold) and requires the envelope to
// stay above/below its threshold for several consecutive frames before
// flipping `talking`, so a single loud transient (a door slam, a cough)
// can't flip it on, and it doesn't chatter on and off right at the edge.
// ---------------------------------------------------------------------

export const TALKING_DEFAULTS = Object.freeze({
  onThreshold: 0.16,
  offThreshold: 0.09,
  onFrames: 3,
  offFrames: 6,
  attack: 0.6, // envelope smoothing when the score is rising
  release: 0.35, // envelope smoothing when the score is falling — fast enough that
  // a single loud transient decays back below onThreshold in ~1 frame instead of
  // lingering long enough to look like `onFrames` consecutive sustained frames.
  noiseFloorRelease: 0.01, // how quickly the adaptive noise floor drifts up
});

export function createTalkingState() {
  return {
    envelope: 0,
    noiseFloor: 0.02,
    talking: false,
    aboveCount: 0,
    belowCount: 0,
  };
}

/**
 * Advance the talking detector by one sample. Pure: returns a new state
 * plus the derived `talking`/`confidence` readout; never mutates `state`.
 */
export function stepTalkingDetector(state, sample, opts) {
  const o = { ...TALKING_DEFAULTS, ...opts };
  const rms = clamp01(sample?.rms ?? 0);
  const speechBandRatio = clamp01(sample?.speechBandRatio ?? 0);

  // Loud but spectrally flat sound (footsteps, HVAC hum) scores lower than
  // equally loud speech-band energy.
  const score = rms * (0.35 + 0.65 * speechBandRatio);

  const coeff = score > state.envelope ? o.attack : o.release;
  const envelope = state.envelope + (score - state.envelope) * coeff;

  // Adaptive noise floor: tracks the envelope downward quickly (learns
  // quiet rooms fast) but only drifts upward slowly (doesn't get fooled by
  // one sustained loud passage into thinking that's "quiet").
  const noiseFloor =
    envelope < state.noiseFloor
      ? envelope
      : state.noiseFloor + (envelope - state.noiseFloor) * o.noiseFloorRelease;

  const aboveCount = envelope > o.onThreshold ? state.aboveCount + 1 : 0;
  const belowCount = envelope < o.offThreshold ? state.belowCount + 1 : 0;

  let talking = state.talking;
  if (!talking && aboveCount >= o.onFrames) talking = true;
  else if (talking && belowCount >= o.offFrames) talking = false;

  // Confidence: how far the envelope sits from the ambiguous midpoint
  // between the two thresholds, blended with signal-to-noise-floor ratio.
  const snr = envelope / Math.max(noiseFloor, 0.005);
  const mid = (o.onThreshold + o.offThreshold) / 2;
  const halfSpan = Math.max((o.onThreshold - o.offThreshold) / 2, 1e-4);
  const distance = clamp01(Math.abs(envelope - mid) / halfSpan);
  const confidence = clamp01(distance * 0.55 + clamp01(snr / 4) * 0.45);

  return {
    state: { envelope, noiseFloor, talking, aboveCount, belowCount },
    talking,
    confidence,
  };
}

// ---------------------------------------------------------------------
// Breathing smoother: turns a stream of "lower-half-of-frame luminance
// diff" samples into a smoothed 0..1 breathingIntensity proxy with an
// honestly LOW confidence that ramps up over time (this is a camera-based
// heuristic, not a real respiration sensor) and is further penalized when
// no face is visible in frame.
// ---------------------------------------------------------------------

export const BREATHING_DEFAULTS = Object.freeze({
  slowRate: 0.02, // baseline luminance tracking speed
  devRate: 0.15, // deviation-from-baseline tracking speed
  smoothRate: 0.12, // final output smoothing speed
  gain: 20, // deviation -> intensity scale
  confidenceRampSamples: 90, // ~3s at 30fps before confidence maxes out
  maxConfidence: 0.55, // fallback engine never claims to be highly confident
  faceMissingPenalty: 0.3, // multiplier applied to confidence with no face
});

export function createBreathingState() {
  return {
    slowEnv: 0,
    devEnv: 0,
    smoothedIntensity: 0,
    sampleCount: 0,
  };
}

/**
 * Advance the breathing smoother by one sample. Pure.
 * `sample = { diff: number >= 0, faceVisible?: bool }`
 */
export function stepBreathingSmoother(state, sample, opts) {
  const o = { ...BREATHING_DEFAULTS, ...opts };
  const diff = Math.max(0, sample?.diff ?? 0);
  const faceVisible = sample?.faceVisible !== false;

  const slowEnv = state.slowEnv + (diff - state.slowEnv) * o.slowRate;
  const deviation = Math.abs(diff - slowEnv);
  const devEnv = state.devEnv + (deviation - state.devEnv) * o.devRate;

  const raw = clamp01(devEnv * o.gain);
  const smoothedIntensity = state.smoothedIntensity + (raw - state.smoothedIntensity) * o.smoothRate;
  const sampleCount = state.sampleCount + 1;

  const ramp = clamp01(sampleCount / o.confidenceRampSamples);
  const confidence = clamp01(ramp * o.maxConfidence * (faceVisible ? 1 : o.faceMissingPenalty));

  return {
    state: { slowEnv, devEnv, smoothedIntensity, sampleCount },
    breathingIntensity: smoothedIntensity,
    confidence,
  };
}

// ---------------------------------------------------------------------
// Face-presence heuristic: center-region luminance variance. A face (with
// eyes, nose shadow, mouth) produces meaningfully more local contrast than
// a blank wall or a dark, empty frame.
// ---------------------------------------------------------------------

export const FACE_VARIANCE_THRESHOLD = 0.004;

export function computeFaceVisible(centerVariance, threshold = FACE_VARIANCE_THRESHOLD) {
  return centerVariance >= threshold;
}

// Simple hysteresis wrapper so the calibration UI's FACE SIGNAL readout
// doesn't flicker between SEARCHING/LOCKED on borderline frames.
export function createFaceLockState() {
  return { locked: false, aboveCount: 0, belowCount: 0 };
}

export function stepFaceLock(state, centerVariance, opts = {}) {
  const onFrames = opts.onFrames ?? 5;
  const offFrames = opts.offFrames ?? 8;
  const threshold = opts.threshold ?? FACE_VARIANCE_THRESHOLD;
  const visible = computeFaceVisible(centerVariance, threshold);

  const aboveCount = visible ? state.aboveCount + 1 : 0;
  const belowCount = !visible ? state.belowCount + 1 : 0;

  let locked = state.locked;
  if (!locked && aboveCount >= onFrames) locked = true;
  else if (locked && belowCount >= offFrames) locked = false;

  return { state: { locked, aboveCount, belowCount }, locked, faceVisible: visible };
}
