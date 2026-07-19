// Injects the CSS for every DOM surface Task 4 owns (HUD, screens, desk
// form, judge panel). Matches index.html's aged-paper / typewriter / noir
// look (Special Elite font, --void/--paper/--ink/--blood/--bone palette)
// but lives entirely in this module so src/game never touches index.html.

let injected = false;

export function injectStyles() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const style = document.createElement('style');
  style.id = 'cg-styles';
  style.textContent = CSS;
  document.head.appendChild(style);
}

const CSS = `
.cg-hud, .cg-screen, .cg-judge-panel {
  font-family: 'Special Elite', 'Courier New', monospace;
  box-sizing: border-box;
}
.cg-hud *, .cg-screen *, .cg-judge-panel * { box-sizing: border-box; }

/* ------------------------------- HUD ---------------------------------- */
.cg-hud { position: fixed; inset: 0; z-index: 20; pointer-events: none; color: var(--bone, #e9e3d0); }

.cg-objective {
  position: absolute; top: 2.2vh; left: 50%; transform: translateX(-50%);
  max-width: 86vw; text-align: center; letter-spacing: 0.12em;
  font-size: clamp(0.72rem, 1.6vw, 0.95rem); color: var(--paper, #d6c9a3);
  text-shadow: 0 2px 6px rgba(0,0,0,0.9);
  white-space: pre-wrap;
}

.cg-prompt {
  position: absolute; bottom: 10vh; left: 50%; transform: translateX(-50%);
  padding: 0.5em 1em; background: rgba(8,6,4,0.55); border: 1px solid rgba(214,201,163,0.35);
  font-size: clamp(0.68rem, 1.4vw, 0.85rem); letter-spacing: 0.08em; text-align: center;
  color: var(--paper, #d6c9a3);
}

.cg-eyes {
  position: absolute; top: 42%; left: 50%; transform: translateX(-50%);
  color: var(--blood, #7d1f1a); font-size: clamp(1rem, 2.4vw, 1.5rem); letter-spacing: 0.3em;
  text-shadow: 0 0 18px rgba(125,31,26,0.85); animation: cg-eyes-pulse 1.6s infinite;
}
@keyframes cg-eyes-pulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }

.cg-capture {
  position: absolute; top: 2vh; right: 2vw; display: flex; align-items: center; gap: 0.5em;
  font-size: 0.62rem; letter-spacing: 0.1em; color: #c98; background: rgba(8,6,4,0.5);
  padding: 0.35em 0.6em; border: 1px solid rgba(200,150,80,0.3);
}
.cg-capture-dot {
  width: 8px; height: 8px; border-radius: 50%; background: #d0463b;
  box-shadow: 0 0 8px #d0463b; animation: cg-dot-blink 1.4s infinite;
}
@keyframes cg-dot-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }

.cg-journal {
  position: absolute; top: 10vh; right: 2vw; width: min(340px, 40vw); max-height: 74vh;
  background: linear-gradient(180deg, rgba(20,16,11,0.92), rgba(10,8,5,0.94));
  border: 1px solid rgba(214,201,163,0.3); padding: 1em; overflow-y: auto; pointer-events: auto;
}
.cg-journal header { letter-spacing: 0.16em; font-size: 0.72rem; color: var(--paper, #d6c9a3); margin-bottom: 0.8em; }
.cg-journal footer { margin-top: 0.8em; font-size: 0.6rem; opacity: 0.55; letter-spacing: 0.12em; }
.cg-clue { margin-bottom: 0.9em; font-size: 0.72rem; line-height: 1.45; }
.cg-clue-id {
  display: inline-block; width: 1.4em; height: 1.4em; text-align: center; line-height: 1.4em;
  border: 1px solid var(--blood, #7d1f1a); color: var(--blood, #7d1f1a); margin-right: 0.5em; font-weight: bold;
}
.cg-clue-label { display: block; color: var(--paper, #d6c9a3); letter-spacing: 0.08em; margin: 0.2em 0; font-size: 0.68rem; }
.cg-clue-text { color: #cfc7ae; }

.cg-arrival-banner {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 0.6em; text-align: center; letter-spacing: 0.2em;
  font-size: clamp(1rem, 3vw, 1.8rem); background: rgba(30,4,4,0.35); color: var(--bone, #e9e3d0);
  text-shadow: 0 0 24px rgba(125,31,26,0.9);
}
.cg-arrival-banner.cg-flash { animation: cg-banner-flash 0.5s ease 2; }
@keyframes cg-banner-flash { 0%, 100% { background: rgba(30,4,4,0.35); } 50% { background: rgba(90,8,8,0.6); } }

.cg-toast {
  position: absolute; bottom: 18vh; left: 50%; transform: translateX(-50%);
  padding: 0.6em 1.1em; background: rgba(8,6,4,0.75); border: 1px solid rgba(214,201,163,0.3);
  font-size: clamp(0.7rem, 1.5vw, 0.9rem); letter-spacing: 0.06em; color: var(--paper, #d6c9a3);
  opacity: 0; transition: opacity 0.3s ease; text-align: center; max-width: 70vw;
}
.cg-toast.cg-in { opacity: 1; }

/* ------------------------------ screens -------------------------------- */
.cg-screen {
  position: fixed; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center;
  background: var(--void, #070605); color: var(--bone, #e9e3d0); opacity: 0; transition: opacity 0.6s ease;
  text-align: center; padding: 4vh 4vw; overflow-y: auto;
}
.cg-screen.cg-in { opacity: 1; }
.cg-screen.cg-out { opacity: 0; }

.cg-arrival-screen .cg-arrival-text p {
  letter-spacing: 0.14em; line-height: 2.1; font-size: clamp(0.85rem, 2vw, 1.15rem);
  color: var(--paper, #d6c9a3); max-width: 46em; margin: 0.6em auto;
}

.cg-modal-screen { background: rgba(4,3,2,0.94); z-index: 60; }
.cg-modal {
  max-width: 46em; display: flex; flex-direction: column; align-items: center; gap: 1.4em;
}
.cg-modal h1 { font-size: clamp(1.1rem, 2.8vw, 1.9rem); letter-spacing: 0.14em; line-height: 1.7; color: var(--paper, #d6c9a3); margin: 0; }
.cg-lose-screen .cg-modal h1 { color: var(--blood, #7d1f1a); }

.cg-property-card {
  border: 1px solid rgba(214,201,163,0.35); padding: 1.2em 1.6em; background: rgba(20,16,11,0.5);
}
.cg-property-card h2 { margin: 0 0 0.4em; letter-spacing: 0.08em; font-size: 1.1rem; }
.cg-property-card p { margin: 0.2em 0; font-size: 0.82rem; opacity: 0.85; }

.cg-book-link {
  display: inline-block; padding: 0.7em 1.4em; border: 1px solid var(--paper, #d6c9a3); color: var(--paper, #d6c9a3);
  text-decoration: none; letter-spacing: 0.12em; font-size: 0.85rem; transition: background 0.2s;
}
.cg-book-link:hover { background: rgba(214,201,163,0.12); }
.cg-affiliate-tag { display: block; font-size: 0.6rem; opacity: 0.65; letter-spacing: 0.1em; margin-top: 0.3em; }

.cg-disclaimer { font-size: 0.68rem; opacity: 0.6; line-height: 1.6; max-width: 40em; }

.cg-retry-btn, .cg-submit-btn {
  padding: 0.7em 2em; border: 1px solid var(--blood, #7d1f1a); color: var(--bone, #e9e3d0);
  background: rgba(125,31,26,0.15); letter-spacing: 0.2em; font-size: 0.9rem; cursor: pointer;
}
.cg-retry-btn:hover, .cg-submit-btn:hover { background: rgba(125,31,26,0.35); }

/* --------------------------- desk (ledger) form ------------------------- */
.cg-desk-screen .cg-ledger {
  max-width: 42em; text-align: left; background: rgba(20,16,11,0.6); padding: 2em;
  border: 1px solid rgba(214,201,163,0.25);
}
.cg-ledger h2 { text-align: center; letter-spacing: 0.14em; font-size: 1.05rem; color: var(--paper, #d6c9a3); margin-top: 0; }
.cg-ledger-sub { text-align: center; font-size: 0.75rem; opacity: 0.7; margin-bottom: 1.4em; }
.cg-desk-q { border: 1px solid rgba(214,201,163,0.2); margin-bottom: 1.1em; padding: 0.8em 1em; }
.cg-desk-q legend { padding: 0 0.4em; font-size: 0.78rem; letter-spacing: 0.06em; color: var(--paper, #d6c9a3); }
.cg-desk-opt { display: flex; align-items: center; gap: 0.6em; font-size: 0.78rem; padding: 0.3em 0; cursor: pointer; }
.cg-desk-opt input { accent-color: var(--blood, #7d1f1a); }
.cg-forgiveness { font-size: 0.72rem; color: #d0a94a; letter-spacing: 0.04em; margin: 0.6em 0; }
.cg-submit-btn { display: block; margin: 1.2em auto 0; }

/* ------------------------------ judge panel ----------------------------- */
.cg-judge-panel {
  position: fixed; top: 2vh; left: 2vw; z-index: 90; width: min(360px, 92vw); max-height: 92vh;
  overflow-y: auto; background: #0a0a0a; color: #7ee787; border: 1px solid #333;
  font-family: 'Courier New', monospace; font-size: 0.74rem; box-shadow: 0 10px 40px rgba(0,0,0,0.7);
}
.cg-judge-panel header {
  background: #161616; color: #ff8a65; padding: 0.6em 0.8em; letter-spacing: 0.08em; font-weight: bold;
  border-bottom: 1px solid #333;
}
.cg-judge-panel footer { padding: 0.5em 0.8em; color: #666; font-size: 0.65rem; border-top: 1px solid #222; }
.cg-judge-body { padding: 0.7em 0.8em; display: flex; flex-direction: column; gap: 0.9em; }
.cg-judge-body h3 { margin: 0 0 0.4em; color: #9aa0a6; font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; }
.cg-judge-body div { line-height: 1.5; }
.cg-judge-actions { display: flex; flex-direction: column; gap: 0.4em; }
.cg-judge-actions button {
  background: #161616; color: #e0e0e0; border: 1px solid #333; padding: 0.5em 0.7em; cursor: pointer;
  text-align: left; font-family: inherit; font-size: 0.72rem;
}
.cg-judge-actions button:hover { background: #222; border-color: #555; }

@media (prefers-reduced-motion: reduce) {
  .cg-eyes, .cg-capture-dot, .cg-arrival-banner.cg-flash { animation: none; }
}
`;
