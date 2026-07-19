// Fallback capture engine: real getUserMedia audio+video, run entirely
// locally, feeding the pure reducers in dsp.js. Nothing is recorded,
// stored, or transmitted — samples are computed and discarded every frame.
//
// No `window`/`navigator`/`document` access happens at module load time —
// only inside the functions below, invoked when `start()` is actually
// called by the browser runtime. That keeps this file node-importable.

import {
  createTalkingState,
  stepTalkingDetector,
  createBreathingState,
  stepBreathingSmoother,
  createFaceLockState,
  stepFaceLock,
  clamp01,
} from './dsp.js';

const VIDEO_W = 32;
const VIDEO_H = 24;
const SAMPLE_INTERVAL_MS = 66; // ~15Hz, plenty for these low-frequency signals

/**
 * Create a fallback engine instance. Returned object manages its own
 * MediaStream lifecycle; nothing happens until `start()` is called.
 */
export function createFallbackEngine() {
  let audioCtx = null;
  let analyser = null;
  let timeData = null;
  let freqData = null;
  let mediaStream = null;
  let videoEl = null;
  let canvas = null;
  let ctx2d = null;
  let intervalId = null;
  let running = false;
  let onSampleCb = null;

  let talkingState = createTalkingState();
  let breathingState = createBreathingState();
  let faceLockState = createFaceLockState();
  let prevLowerAvg = null;

  let lastSample = {
    talking: false,
    talkingConfidence: 0,
    breathingIntensity: 0,
    breathingConfidence: 0,
    faceVisible: false,
    lighting: 0,
    pulseBpm: null,
  };

  function sampleAudio() {
    if (!analyser) return { rms: 0, speechBandRatio: 0 };
    analyser.getByteTimeDomainData(timeData);
    let sumSquares = 0;
    for (let i = 0; i < timeData.length; i++) {
      const v = (timeData[i] - 128) / 128;
      sumSquares += v * v;
    }
    const rms = Math.sqrt(sumSquares / timeData.length);

    analyser.getByteFrequencyData(freqData);
    const nyquist = audioCtx.sampleRate / 2;
    const binHz = nyquist / freqData.length;
    let total = 0;
    let band = 0;
    for (let i = 0; i < freqData.length; i++) {
      const hz = i * binHz;
      const energy = freqData[i] / 255;
      total += energy;
      if (hz >= 300 && hz <= 3400) band += energy;
    }
    const speechBandRatio = total > 0 ? clamp01(band / total) : 0;
    return { rms: clamp01(rms * 2.2), speechBandRatio };
  }

  function sampleVideo() {
    if (!ctx2d || !videoEl || videoEl.readyState < 2) {
      return { diff: 0, centerVariance: 0, lighting: 0 };
    }
    ctx2d.drawImage(videoEl, 0, 0, VIDEO_W, VIDEO_H);
    const frame = ctx2d.getImageData(0, 0, VIDEO_W, VIDEO_H).data;

    let lowerSum = 0;
    let lowerCount = 0;
    const centerValues = [];
    for (let y = 0; y < VIDEO_H; y++) {
      for (let x = 0; x < VIDEO_W; x++) {
        const idx = (y * VIDEO_W + x) * 4;
        const lum = (frame[idx] * 0.299 + frame[idx + 1] * 0.587 + frame[idx + 2] * 0.114) / 255;
        if (y >= VIDEO_H * 0.5) {
          lowerSum += lum;
          lowerCount++;
        }
        if (x >= VIDEO_W * 0.3 && x < VIDEO_W * 0.7 && y >= VIDEO_H * 0.15 && y < VIDEO_H * 0.75) {
          centerValues.push(lum);
        }
      }
    }
    const lowerAvg = lowerCount > 0 ? lowerSum / lowerCount : 0;
    const diff = prevLowerAvg == null ? 0 : Math.abs(lowerAvg - prevLowerAvg);
    prevLowerAvg = lowerAvg;

    const mean = centerValues.length ? centerValues.reduce((a, b) => a + b, 0) / centerValues.length : 0;
    const variance = centerValues.length
      ? centerValues.reduce((a, b) => a + (b - mean) ** 2, 0) / centerValues.length
      : 0;

    return { diff, centerVariance: variance, lighting: mean };
  }

  function tick() {
    // Chrome may leave an AudioContext created outside a live user gesture
    // in 'suspended' state, which reads as flat silence; keep nudging it.
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    const audio = sampleAudio();
    const video = sampleVideo();

    const talkStep = stepTalkingDetector(talkingState, audio);
    talkingState = talkStep.state;

    const faceStep = stepFaceLock(faceLockState, video.centerVariance);
    faceLockState = faceStep.state;

    const breathStep = stepBreathingSmoother(breathingState, {
      diff: video.diff,
      faceVisible: faceStep.faceVisible,
    });
    breathingState = breathStep.state;

    lastSample = {
      talking: talkStep.talking,
      talkingConfidence: talkStep.confidence,
      breathingIntensity: breathStep.breathingIntensity,
      breathingConfidence: breathStep.confidence,
      faceVisible: faceStep.faceVisible,
      faceLocked: faceStep.locked,
      lighting: video.lighting,
      centerVariance: video.centerVariance,
      pulseBpm: null, // the local heuristic engine does not estimate pulse
    };

    if (onSampleCb) onSampleCb(lastSample);
  }

  /**
   * Request camera+mic access and begin the local sampling loop.
   * `onSample(sample)` is called at ~15Hz with the latest readings.
   * Resolves once the stream is attached (not once signals are "locked" —
   * that's the calibration screen's job).
   */
  async function start(onSample) {
    // Always adopt the newest consumer, even if capture is already live —
    // calibration starts the engine first, then the game takes over the
    // sample stream via its own start() call.
    if (onSample) onSampleCb = onSample;
    if (running) return { ok: true, videoEl };
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: { width: { ideal: 320 }, height: { ideal: 240 } },
      });
    } catch (err) {
      return { ok: false, error: err };
    }

    videoEl = document.createElement('video');
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.srcObject = mediaStream;
    try {
      await videoEl.play();
    } catch {
      /* autoplay may reject before user gesture settles; sampling just reads zeros until it starts */
    }

    canvas = document.createElement('canvas');
    canvas.width = VIDEO_W;
    canvas.height = VIDEO_H;
    ctx2d = canvas.getContext('2d', { willReadFrequently: true });

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioCtx();
    const source = audioCtx.createMediaStreamSource(mediaStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);
    timeData = new Uint8Array(analyser.fftSize);
    freqData = new Uint8Array(analyser.frequencyBinCount);

    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});

    running = true;
    intervalId = setInterval(tick, SAMPLE_INTERVAL_MS);

    return { ok: true, videoEl };
  }

  function stop() {
    running = false;
    onSampleCb = null;
    if (intervalId != null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (mediaStream) {
      for (const track of mediaStream.getTracks()) track.stop();
      mediaStream = null;
    }
    if (audioCtx) {
      try {
        audioCtx.close();
      } catch {
        /* already closed */
      }
      audioCtx = null;
    }
    analyser = null;
    videoEl = null;
    canvas = null;
    ctx2d = null;
  }

  function getBaseline() {
    return {
      noiseFloor: talkingState.noiseFloor,
      breathingSlowEnv: breathingState.slowEnv,
      sampleCount: breathingState.sampleCount,
    };
  }

  return {
    start,
    stop,
    getBaseline,
    get running() {
      return running;
    },
    get lastSample() {
      return lastSample;
    },
    get videoEl() {
      return videoEl;
    },
  };
}
