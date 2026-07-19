// "GUEST BIOMETRIC REGISTRATION" calibration screen: security-camera
// framed live preview (scanlines + grain), status readouts that progress
// SEARCHING -> LOCKED as the real fallback-engine heuristics settle, and
// a Continue button that only enables once calibration is actually ok.
// "PROCEED UNREGISTERED" is always available as an escape hatch.

import { injectPresageStyles } from './styles.js';

const LIGHTING_MIN = 0.06;
const LIGHTING_MAX = 0.97;
const LOCK_FRAMES = 10; // consecutive good samples (~0.7s at 15Hz) before a row reads LOCKED
const BREATH_WARMUP_FRAMES = 45; // ~3s at 15Hz to gather a respiration baseline

/**
 * @param {HTMLElement} container
 * @param {{ engine: ReturnType<import('./engine.js').createFallbackEngine> }} deps
 * @returns {Promise<{ok:boolean, faceVisible:boolean, lighting:number, baseline:object|null, reduced:boolean}>}
 */
export function showCalibration(container, { engine }) {
  injectPresageStyles();

  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.className = 'presage-root';
    root.innerHTML = `
      <div class="presage-overlay presage-calibration presage-grain">
        <div class="presage-camframe">
          <div class="presage-video-slot"></div>
          <div class="presage-scanlines" aria-hidden="true"></div>
          <div class="presage-crosshair" aria-hidden="true"></div>
          <div class="presage-recdot"><span></span>REC</div>
        </div>
        <div class="presage-panel presage-calib-panel">
          <div class="presage-tape">GUEST BIOMETRIC REGISTRATION</div>
          <p class="presage-fiction">Please remain visible while the hotel learns how to find you.</p>
          <dl class="presage-status">
            <div class="presage-status-row" data-row="face" data-state="searching"><dt>FACE SIGNAL</dt><dd>SEARCHING</dd></div>
            <div class="presage-status-row" data-row="breath" data-state="searching"><dt>RESPIRATION FIELD</dt><dd>SEARCHING</dd></div>
            <div class="presage-status-row" data-row="light" data-state="searching"><dt>ILLUMINATION</dt><dd>SEARCHING</dd></div>
          </dl>
          <p class="presage-error" hidden></p>
          <div class="presage-actions">
            <button type="button" class="presage-btn presage-btn-primary" data-action="continue" disabled>CONTINUE</button>
            <button type="button" class="presage-btn presage-btn-ghost" data-action="reduced">PROCEED UNREGISTERED</button>
          </div>
        </div>
      </div>
    `;
    container.appendChild(root);

    const videoSlot = root.querySelector('.presage-video-slot');
    const errorEl = root.querySelector('.presage-error');
    const continueBtn = root.querySelector('[data-action="continue"]');
    const reducedBtn = root.querySelector('[data-action="reduced"]');
    const rows = {
      face: root.querySelector('[data-row="face"]'),
      breath: root.querySelector('[data-row="breath"]'),
      light: root.querySelector('[data-row="light"]'),
    };

    let settled = false;
    let faceCount = 0;
    let breathCount = 0;
    let lightCount = 0;
    let latest = { faceVisible: false, lighting: 0 };
    let ok = false;

    function setRow(row, locked, label) {
      rows[row].dataset.state = locked ? 'locked' : 'searching';
      rows[row].querySelector('dd').textContent = label || (locked ? 'LOCKED' : 'SEARCHING');
    }

    function finish(result) {
      if (settled) return;
      settled = true;
      root.remove();
      resolve(result);
    }

    reducedBtn.addEventListener('click', () => {
      engine.stop();
      finish({ ok: false, faceVisible: false, lighting: 0, baseline: null, reduced: true });
    });

    continueBtn.addEventListener('click', () => {
      if (!ok) return;
      finish({
        ok: true,
        faceVisible: latest.faceVisible,
        lighting: latest.lighting,
        baseline: engine.getBaseline(),
        reduced: false,
      });
    });

    function onSample(sample) {
      latest = sample;
      faceCount = sample.faceLocked ? faceCount + 1 : 0;
      const lightingOk = sample.lighting >= LIGHTING_MIN && sample.lighting <= LIGHTING_MAX;
      lightCount = lightingOk ? lightCount + 1 : 0;
      breathCount += 1; // just needs time to build a baseline, not a threshold to clear

      const faceLocked = faceCount >= LOCK_FRAMES;
      const lightLocked = lightCount >= LOCK_FRAMES;
      const breathLocked = breathCount >= BREATH_WARMUP_FRAMES;

      setRow('face', faceLocked);
      setRow(
        'breath',
        breathLocked,
        breathLocked ? 'LOCKED' : `CALIBRATING ${Math.min(99, Math.round((breathCount / BREATH_WARMUP_FRAMES) * 100))}%`
      );
      setRow(
        'light',
        lightLocked,
        lightLocked ? 'LOCKED' : sample.lighting < LIGHTING_MIN ? 'TOO DARK' : sample.lighting > LIGHTING_MAX ? 'TOO BRIGHT' : 'SEARCHING'
      );

      ok = faceLocked && lightLocked && breathLocked;
      continueBtn.disabled = !ok;
    }

    engine
      .start(onSample)
      .then((result) => {
        if (settled) return;
        if (!result.ok) {
          errorEl.hidden = false;
          errorEl.textContent =
            'CAPTURE HARDWARE UNAVAILABLE — camera/microphone could not be reached. You may still proceed unregistered.';
          return;
        }
        if (result.videoEl) {
          result.videoEl.className = 'presage-video';
          videoSlot.replaceWith(result.videoEl);
        }
      })
      .catch(() => {
        if (settled) return;
        errorEl.hidden = false;
        errorEl.textContent = 'CAPTURE HARDWARE UNAVAILABLE — you may still proceed unregistered.';
      });
  });
}
