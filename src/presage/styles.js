// Self-contained CSS for the Presage adapter's own UI (consent modal,
// calibration screen, capture-active indicator). Injected lazily as a
// single <style> tag on first use — never at module import time — so this
// file stays node-importable and doesn't depend on index.html.
//
// Colors are hardcoded to match the game's established palette (aged
// paper / ink / blood / bone / void — see index.html's :root) rather than
// reading CSS custom properties from the host page, so this module has no
// coupling to files owned by other tasks.

const STYLE_ID = 'presage-injected-styles';

const CSS = `
.presage-root, .presage-root * { box-sizing: border-box; }
.presage-root {
  --p-void: #070605;
  --p-paper: #d6c9a3;
  --p-paper-dark: #b3a47c;
  --p-ink: #1c1712;
  --p-blood: #7d1f1a;
  --p-bone: #e9e3d0;
  font-family: 'Special Elite', 'Courier New', monospace;
}

.presage-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 1.1rem;
  padding: 4vh 1.2rem;
  overflow: auto;
  background:
    radial-gradient(ellipse 90% 70% at 50% 30%, rgba(58, 48, 36, 0.35), transparent 70%),
    var(--p-void);
  color: var(--p-paper);
  z-index: 500;
}

/* film grain, self-contained (does not depend on index.html's .grain) */
.presage-overlay.presage-grain {
  position: absolute;
}
.presage-overlay.presage-grain::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E");
  mix-blend-mode: multiply;
  opacity: 0.3;
}

.presage-panel {
  position: relative;
  width: min(560px, 94vw);
  background: linear-gradient(178deg, #efe9da, #cdc3ab);
  color: var(--p-ink);
  padding: 1.6rem 1.7rem 1.5rem;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.75);
  border: 1px solid rgba(0, 0, 0, 0.25);
}

.presage-tape {
  display: inline-block;
  font-size: 0.62rem;
  letter-spacing: 0.28em;
  text-indent: 0.28em;
  color: #6b6250;
  border: 1px solid #6b6250;
  padding: 0.2rem 0.5rem;
  margin-bottom: 0.8rem;
  opacity: 0.85;
}

.presage-panel h2 {
  margin: 0 0 0.35rem;
  font-size: 1.15rem;
  letter-spacing: 0.08em;
}

.presage-lede {
  margin: 0 0 0.9rem;
  font-style: italic;
  opacity: 0.85;
}

.presage-list {
  margin: 0 0 0.9rem;
  padding-left: 1.15rem;
  line-height: 1.5;
  font-size: 0.92rem;
}
.presage-list li { margin-bottom: 0.35rem; }

.presage-panel p {
  font-size: 0.88rem;
  line-height: 1.5;
  margin: 0 0 0.7rem;
}

.presage-fiction {
  color: var(--p-blood);
  font-style: italic;
}

.presage-fineprint {
  font-size: 0.72rem;
  opacity: 0.7;
  margin-top: 0.6rem;
}

.presage-error {
  font-size: 0.8rem;
  color: var(--p-blood);
  margin: 0 0 0.6rem;
}

.presage-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
  margin-top: 0.9rem;
}

.presage-btn {
  font-family: inherit;
  font-size: 0.78rem;
  letter-spacing: 0.14em;
  text-indent: 0.1em;
  padding: 0.65rem 1.1rem;
  cursor: pointer;
  border: 1px solid var(--p-ink);
  background: transparent;
  color: var(--p-ink);
  transition: background 0.2s ease, color 0.2s ease, opacity 0.2s ease;
}
.presage-btn:hover:not(:disabled), .presage-btn:focus-visible:not(:disabled) {
  background: var(--p-ink);
  color: var(--p-bone);
  outline: none;
}
.presage-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.presage-btn-primary {
  background: var(--p-blood);
  color: var(--p-bone);
  border-color: var(--p-blood);
}
.presage-btn-primary:hover:not(:disabled), .presage-btn-primary:focus-visible:not(:disabled) {
  background: #59110d;
}
.presage-btn-ghost {
  opacity: 0.85;
}

/* ---------------------------- calibration ---------------------------- */

.presage-camframe {
  position: relative;
  width: min(420px, 90vw);
  aspect-ratio: 4 / 3;
  background: #000;
  overflow: hidden;
  border: 2px solid var(--p-bone);
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.8);
}

.presage-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(0.35) contrast(1.05) brightness(0.95);
  transform: scaleX(-1);
}

.presage-scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.22) 0px,
    rgba(0, 0, 0, 0.22) 1px,
    transparent 2px,
    transparent 3px
  );
  mix-blend-mode: multiply;
}
.presage-camframe::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E");
  mix-blend-mode: overlay;
  opacity: 0.4;
}

.presage-crosshair {
  position: absolute;
  inset: 18% 26%;
  border: 1px solid rgba(233, 227, 208, 0.55);
  pointer-events: none;
}
.presage-crosshair::before, .presage-crosshair::after {
  content: '';
  position: absolute;
  background: rgba(233, 227, 208, 0.55);
}
.presage-crosshair::before { left: 50%; top: -8px; bottom: -8px; width: 1px; }
.presage-crosshair::after { top: 50%; left: -8px; right: -8px; height: 1px; }

.presage-recdot {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.62rem;
  letter-spacing: 0.16em;
  color: #ff6a5e;
  text-shadow: 0 0 6px rgba(255, 60, 40, 0.7);
}
.presage-recdot span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff3b2e;
  box-shadow: 0 0 8px 2px rgba(255, 59, 46, 0.85);
  animation: presage-blink 1.4s ease-in-out infinite;
}
@keyframes presage-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }

.presage-status {
  margin: 0.9rem 0;
  display: grid;
  gap: 0.45rem;
}
.presage-status-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.8rem;
  font-size: 0.82rem;
  border-bottom: 1px dashed rgba(0, 0, 0, 0.25);
  padding-bottom: 0.25rem;
}
.presage-status-row dt { letter-spacing: 0.1em; opacity: 0.75; }
.presage-status-row dd { margin: 0; font-weight: bold; letter-spacing: 0.06em; }
.presage-status-row[data-state='searching'] dd { color: #6b6250; animation: presage-pulse-dim 1.8s ease-in-out infinite; }
.presage-status-row[data-state='locked'] dd { color: var(--p-blood); }
@keyframes presage-pulse-dim { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }

/* ------------------------- capture-active indicator ------------------- */

.presage-capture-indicator {
  position: fixed;
  right: 14px;
  bottom: 14px;
  z-index: 400;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.65rem;
  background: rgba(7, 6, 5, 0.72);
  border: 1px solid rgba(233, 227, 208, 0.35);
  color: var(--p-bone, #e9e3d0);
  font-family: 'Special Elite', 'Courier New', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  pointer-events: none;
  user-select: none;
}
.presage-capture-indicator .presage-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff3b2e;
  box-shadow: 0 0 8px 2px rgba(255, 59, 46, 0.85);
  animation: presage-blink 1.4s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .presage-recdot span, .presage-capture-indicator .presage-dot, .presage-status-row[data-state='searching'] dd {
    animation: none;
  }
}
`;

/**
 * Inject the Presage stylesheet into `document.head`, once. Safe to call
 * repeatedly; safe to call in environments without `document` (no-ops).
 */
export function injectPresageStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}
