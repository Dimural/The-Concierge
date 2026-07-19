// In-fiction consent modal. Pure DOM builder + Promise; no device access
// happens here — that's calibrate()'s job. This screen only records the
// player's choice.

import { injectPresageStyles } from './styles.js';

/**
 * Render the consent screen into `container` and resolve with the
 * player's choice.
 * @param {HTMLElement} container
 * @returns {Promise<'granted'|'reduced'>}
 */
export function showConsent(container) {
  injectPresageStyles();

  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.className = 'presage-root';
    root.innerHTML = `
      <div class="presage-overlay presage-consent presage-grain">
        <div class="presage-panel">
          <div class="presage-tape">CONFIDENTIAL &mdash; GUEST SERVICES</div>
          <h2>BEFORE YOU CHECK IN</h2>
          <p class="presage-lede">The hotel would like to sense you, if you'll allow it.</p>
          <ul class="presage-list">
            <li><strong>Talking</strong> &mdash; your microphone estimates whether you are speaking, and how sure the hotel is.</li>
            <li><strong>Breathing</strong> &mdash; your camera watches for the small, ordinary rise and fall of stillness.</li>
            <li><strong>Presence</strong> &mdash; your camera checks only whether a face is somewhere in frame.</li>
          </ul>
          <p>This is <strong>not a medical device</strong>. It produces no diagnosis, no vitals report, no health advice of any kind.</p>
          <p>Nothing is recorded, saved, or uploaded. Every measurement happens locally, in the instant it happens, and is then discarded.</p>
          <p>Whenever capture is running, a small red <strong>CAPTURE ACTIVE</strong> mark stays on screen, so you always know.</p>
          <p class="presage-fiction">Stillness is not required of you. But the quiet ones tend to do better here.</p>
          <div class="presage-actions">
            <button type="button" class="presage-btn presage-btn-primary" data-action="grant">CONSENT &amp; CONTINUE</button>
            <button type="button" class="presage-btn presage-btn-ghost" data-action="reduced">PROCEED UNREGISTERED</button>
          </div>
          <p class="presage-fineprint">Proceeding unregistered disables all camera/microphone sensing. The hotel remains fully explorable either way.</p>
        </div>
      </div>
    `;
    container.appendChild(root);

    function cleanup() {
      root.remove();
    }

    root.querySelector('[data-action="grant"]').addEventListener('click', () => {
      cleanup();
      resolve('granted');
    });
    root.querySelector('[data-action="reduced"]').addEventListener('click', () => {
      cleanup();
      resolve('reduced');
    });
  });
}
