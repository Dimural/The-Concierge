// Full-screen DOM states: arrival intro text, win screen, lose screen.
// All injected from JS with the same aged-paper/typewriter look as the rest
// of the game (see styles.js).
import { injectStyles } from './styles.js';

function makeScreenEl(id, extraClass = '') {
  document.getElementById(id)?.remove();
  const el = document.createElement('div');
  el.id = id;
  el.className = `cg-screen ${extraClass}`;
  document.body.appendChild(el);
  return el;
}

export function createScreens() {
  injectStyles();

  function showArrival(onDone) {
    const el = makeScreenEl('cg-arrival', 'cg-arrival-screen');
    el.innerHTML = `
      <div class="cg-arrival-text">
        <p>THE RECORDS ARE GONE.</p>
        <p>THE NAME OF THIS HOTEL HAS BEEN ERASED FROM ITS OWN LEDGER.</p>
        <p>FOUR ARCHIVE ENGINES STILL HOLD FRAGMENTS OF THE TRUTH.</p>
        <p>FIND THEM. RESTORE THE RECORD. GET OUT.</p>
      </div>`;
    requestAnimationFrame(() => el.classList.add('cg-in'));
    const t1 = setTimeout(() => {
      el.classList.remove('cg-in');
      el.classList.add('cg-out');
      const t2 = setTimeout(() => { el.remove(); onDone?.(); }, 900);
      el._cgTimers = [t2];
    }, 6200);
    el._cgTimers = [t1];
    return el;
  }

  function showWin({ property, bookingLink } = {}) {
    const el = makeScreenEl('cg-win', 'cg-modal-screen');
    const p = property || {};
    el.innerHTML = `
      <div class="cg-modal">
        <h1>THE NIGHTMARE WAS FICTIONAL.<br/>THE HOTEL IS REAL.<br/>YOU RESTORED ITS NAME.</h1>
        <div class="cg-property-card">
          <h2>${escapeHtml(p.name || 'Fairmont Royal York')}</h2>
          <p>${escapeHtml(p.address || '100 Front St W, Toronto, ON M5J 1E3')}</p>
          <p>${p.stars ? '★'.repeat(Math.round(p.stars)) : ''} ${p.rating ? `${p.rating} rating (${p.reviewCount ?? '—'} reviews)` : ''}</p>
        </div>
        <a class="cg-book-link" href="${escapeAttr(bookingLink || '#')}" target="_blank" rel="noopener noreferrer sponsored">
          BOOK THE REAL HOTEL
          <span class="cg-affiliate-tag">This is a tracked affiliate link — booking here may earn the makers of this game a commission.</span>
        </a>
        <p class="cg-disclaimer">This game — its haunting, its ghost, and its missing hotel record — is a work of
          fiction. Fairmont Royal York is a real, operating hotel; nothing depicted here reflects an actual
          event or claim about the property.</p>
      </div>`;
    requestAnimationFrame(() => el.classList.add('cg-in'));
    return el;
  }

  function showLose(onRetry) {
    const el = makeScreenEl('cg-lose', 'cg-modal-screen cg-lose-screen');
    el.innerHTML = `
      <div class="cg-modal">
        <h1>FINAL CHECKOUT DECLINED<br/>GUEST RETAINED</h1>
        <button class="cg-retry-btn" id="cg-retry">RETRY</button>
      </div>`;
    requestAnimationFrame(() => el.classList.add('cg-in'));
    el.querySelector('#cg-retry').addEventListener('click', () => {
      el.classList.remove('cg-in');
      setTimeout(() => el.remove(), 400);
      onRetry?.();
    });
    return el;
  }

  function removeIfPresent(id) {
    const el = document.getElementById(id);
    if (el && el._cgTimers) el._cgTimers.forEach(clearTimeout);
    el?.remove();
  }

  return { showArrival, showWin, showLose, removeIfPresent };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}
