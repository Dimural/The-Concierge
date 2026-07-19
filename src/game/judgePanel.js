// Judge panel (Backquote key): clearly out-of-fiction plain dark terminal
// styling. Session live/fallback badge, Presage mode + live meters, entity
// state + alertness, and demo-control buttons. Exposes window.__judge.
import { injectStyles } from './styles.js';

export function createJudgePanel(hooks) {
  injectStyles();
  let open = false;
  let root = null;
  let rafId = null;

  function build() {
    document.getElementById('cg-judge')?.remove();
    root = document.createElement('div');
    root.id = 'cg-judge';
    root.className = 'cg-judge-panel';
    root.innerHTML = `
      <header>JUDGE PANEL — DEMO CONTROLS</header>
      <div class="cg-judge-body">
        <section>
          <h3>Session (Stay22)</h3>
          <div id="cg-j-session"></div>
        </section>
        <section>
          <h3>Presage</h3>
          <div id="cg-j-presage"></div>
        </section>
        <section>
          <h3>Entity</h3>
          <div id="cg-j-ghost"></div>
        </section>
        <section class="cg-judge-actions">
          <h3>Controls</h3>
          <button id="cg-j-book">Simulate Booking (SIMULATED)</button>
          <button id="cg-j-arrival">Force New Arrival</button>
          <button id="cg-j-gens">Complete All Generators</button>
          <button id="cg-j-desk">Skip To Desk</button>
          <button id="cg-j-win">Win</button>
        </section>
      </div>
      <footer>backquote (\`) to close</footer>
    `;
    document.body.appendChild(root);

    root.querySelector('#cg-j-book').addEventListener('click', () => hooks.onSimulateBooking?.());
    root.querySelector('#cg-j-arrival').addEventListener('click', () => hooks.onForceNewArrival?.());
    root.querySelector('#cg-j-gens').addEventListener('click', () => hooks.onCompleteAllGenerators?.());
    root.querySelector('#cg-j-desk').addEventListener('click', () => hooks.onSkipToDesk?.());
    root.querySelector('#cg-j-win').addEventListener('click', () => hooks.onWin?.());

    // exposed once the panel first opens, per the Task 4 brief
    window.__judge = {
      simulateBooking: () => hooks.onSimulateBooking?.(),
      forceNewArrival: () => hooks.onForceNewArrival?.(),
      completeAllGenerators: () => hooks.onCompleteAllGenerators?.(),
      skipToDesk: () => hooks.onSkipToDesk?.(),
      win: () => hooks.onWin?.(),
    };
  }

  function fmt(v) { return typeof v === 'number' ? v.toFixed(2) : '—'; }

  function tick() {
    if (!open || !root) return;
    const s = hooks.getSessionInfo?.() || {};
    const p = hooks.getPresageInfo?.() || {};
    const g = hooks.getGhostInfo?.() || {};
    root.querySelector('#cg-j-session').innerHTML = `
      <div>status: <b style="color:${s.live ? '#7ee787' : '#ffb454'}">${s.live ? 'LIVE' : 'FALLBACK'}</b></div>
      <div>property: ${escapeHtml(s.propertyName ?? '—')}</div>`;
    root.querySelector('#cg-j-presage').innerHTML = `
      <div>mode: <b>${escapeHtml(p.mode ?? '—')}</b></div>
      <div>talking: ${fmt(p.talking)} (conf ${fmt(p.talkingConfidence)})</div>
      <div>breathing: ${fmt(p.breathingIntensity)} (conf ${fmt(p.breathingConfidence)})</div>`;
    root.querySelector('#cg-j-ghost').innerHTML = `
      <div>state: <b>${escapeHtml(g.state ?? '—')}</b></div>
      <div>alertness: ${fmt(g.alertness)}</div>
      <div>eyes open: ${g.eyesOpen ? 'YES' : 'no'}</div>`;
    rafId = requestAnimationFrame(tick);
  }

  function setOpen(next) {
    open = next;
    if (open && !root) build();
    if (root) root.hidden = !open;
    if (open) tick(); else if (rafId) cancelAnimationFrame(rafId);
  }

  function toggle() { setOpen(!open); }

  return { toggle, setOpen, get isOpen() { return open; } };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
