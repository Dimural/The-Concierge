// Presage adapter — consent, calibration, and live physiological signals
// for the blind entity to sense (talking + breathing) via camera/mic.
//
// Self-contained: this module injects its own <style> tag (styles.js) and
// never touches window/document at import time — only inside the
// functions below, once the integrator actually calls them. Verified with
// `node -e "await import('./src/presage/index.js')"` (see smoke-presage.mjs).
//
// Three modes:
//   'presage'  — a real SmartSpectra-backed session connected (smartspectra.js)
//   'fallback' — local getUserMedia heuristics (engine.js/dsp.js), no key needed
//   'reduced'  — player chose "PROCEED UNREGISTERED"; zero capture, signals
//                zeroed with confidence 0, game stays fully playable
//
// setSimulated({talking, breathingIntensity}) lets the judge panel force
// specific signal values for a demo; overridden fields report confidence 1
// regardless of mode.

import { showConsent } from './consent.js';
import { showCalibration } from './calibration.js';
import { createCaptureIndicator } from './indicator.js';
import { createFallbackEngine } from './engine.js';
import { connectSmartSpectra } from './smartspectra.js';
import { clamp01 } from './dsp.js';

export function createPresage() {
  let mode = 'reduced';
  let consentStatus = null; // 'granted' | 'reduced' | null (not yet asked)
  let engine = null; // fallback engine instance, created lazily
  let presageSession = null; // real SmartSpectra session, if connected

  const indicator = createCaptureIndicator();

  const raw = {
    talking: false,
    talkingConfidence: 0,
    breathingIntensity: 0,
    breathingConfidence: 0,
    pulseBpm: null,
    faceVisible: false,
  };

  const simulated = {
    talking: null, // null = not overridden
    breathingIntensity: null,
  };

  function onEngineSample(sample) {
    raw.talking = sample.talking;
    raw.talkingConfidence = sample.talkingConfidence;
    raw.breathingIntensity = sample.breathingIntensity;
    raw.breathingConfidence = sample.breathingConfidence;
    raw.faceVisible = sample.faceVisible;
    raw.pulseBpm = sample.pulseBpm ?? null;
  }

  function ensureEngine() {
    if (!engine) engine = createFallbackEngine();
    return engine;
  }

  async function requestConsent(container) {
    const choice = await showConsent(container);
    consentStatus = choice;
    if (choice === 'reduced') {
      mode = 'reduced';
    }
    return choice;
  }

  async function calibrate(container) {
    if (consentStatus === 'reduced') {
      // Player already opted out during consent — never touch the camera/mic.
      return { ok: false, faceVisible: false, lighting: 0, baseline: null, reduced: true };
    }

    // Real-SDK integration point: only ever consulted first, and only
    // "wins" if it actually produces a session. See smartspectra.js for
    // why this currently always falls back honestly with no relay wired up.
    presageSession = await connectSmartSpectra().catch(() => null);

    if (presageSession) {
      mode = 'presage';
      return { ok: true, faceVisible: true, lighting: 1, baseline: null };
    }

    const eng = ensureEngine();
    const result = await showCalibration(container, { engine: eng });

    if (result.reduced) {
      consentStatus = 'reduced';
      mode = 'reduced';
      eng.stop();
    } else {
      mode = 'fallback';
    }

    return {
      ok: result.ok,
      faceVisible: result.faceVisible,
      lighting: result.lighting,
      baseline: result.baseline,
    };
  }

  function start() {
    if (mode === 'reduced') {
      indicator.setActive(false);
      return;
    }
    if (mode === 'fallback') {
      const eng = ensureEngine();
      if (!eng.running) {
        eng.start(onEngineSample);
      }
      indicator.setActive(true);
    } else if (mode === 'presage') {
      // Real session sample wiring would attach here:
      //   presageSession.onSample(onEngineSample)
      indicator.setActive(true);
    }
  }

  function stop() {
    indicator.setActive(false);
    if (engine) engine.stop();
    if (presageSession && typeof presageSession.close === 'function') {
      presageSession.close();
    }
  }

  const signals = {
    get talking() {
      return simulated.talking !== null ? !!simulated.talking : raw.talking;
    },
    get talkingConfidence() {
      return simulated.talking !== null ? 1 : raw.talkingConfidence;
    },
    get breathingIntensity() {
      return simulated.breathingIntensity !== null ? clamp01(simulated.breathingIntensity) : raw.breathingIntensity;
    },
    get breathingConfidence() {
      return simulated.breathingIntensity !== null ? 1 : raw.breathingConfidence;
    },
    get pulseBpm() {
      return raw.pulseBpm;
    },
    get faceVisible() {
      return raw.faceVisible;
    },
  };

  function setSimulated(overrides = {}) {
    if (Object.prototype.hasOwnProperty.call(overrides, 'talking')) {
      simulated.talking = overrides.talking === undefined ? null : !!overrides.talking;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, 'breathingIntensity')) {
      simulated.breathingIntensity =
        overrides.breathingIntensity === undefined ? null : clamp01(overrides.breathingIntensity);
    }
  }

  return {
    requestConsent,
    calibrate,
    start,
    stop,
    get mode() {
      return mode;
    },
    signals,
    setSimulated,
  };
}

// Re-exported so the integrator's HUD can adopt the same capture-active
// indicator element without reimplementing it.
export { createCaptureIndicator } from './indicator.js';
