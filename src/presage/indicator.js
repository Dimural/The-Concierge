// Small "CAPTURE ACTIVE" indicator (pulsing red dot + label). Exported so
// the game HUD can adopt the same element instead of building its own.
// Fully lazy: no DOM is touched until `.element` is first read or
// `setActive()` is first called, so simply importing/creating this object
// stays safe under Node.

import { injectPresageStyles } from './styles.js';

export function createCaptureIndicator() {
  let el = null;
  let active = false;

  function ensure() {
    if (el) return el;
    injectPresageStyles();
    el = document.createElement('div');
    el.className = 'presage-capture-indicator';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.hidden = true;

    const dot = document.createElement('span');
    dot.className = 'presage-dot';
    dot.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'presage-label';
    label.textContent = 'CAPTURE ACTIVE';

    el.appendChild(dot);
    el.appendChild(label);
    return el;
  }

  return {
    /** The indicator DOM element (created on first access). */
    get element() {
      return ensure();
    },
    /** Show/hide the indicator. */
    setActive(value) {
      active = !!value;
      const node = ensure();
      node.hidden = !active;
      node.classList.toggle('is-active', active);
    },
    get active() {
      return active;
    },
  };
}
