// The front-desk DOM form: the 4 session.frontDesk questions rendered as a
// corrupted property record with missing fields to reconstruct.
import { injectStyles } from './styles.js';

export function showDeskForm(questions, { onSubmit, onClose, forgivenessNote } = {}) {
  injectStyles();
  if (typeof document !== 'undefined' && document.pointerLockElement) {
    document.exitPointerLock();
  }

  document.getElementById('cg-desk')?.remove();
  const el = document.createElement('div');
  el.id = 'cg-desk';
  el.className = 'cg-screen cg-modal-screen cg-desk-screen';

  const rows = questions.map((q) => `
    <fieldset class="cg-desk-q" data-qid="${escapeAttr(q.id)}">
      <legend>${escapeHtml(q.label)}</legend>
      ${q.options.map((opt, i) => `
        <label class="cg-desk-opt">
          <input type="radio" name="cg-q-${escapeAttr(q.id)}" value="${i}" />
          <span>${escapeHtml(opt)}</span>
        </label>`).join('')}
    </fieldset>`).join('');

  el.innerHTML = `
    <div class="cg-modal cg-ledger">
      <h2>PROPERTY RECORD — CORRUPTED</h2>
      <p class="cg-ledger-sub">Reconstruct the missing fields. Select the entry that matches the recovered archive.</p>
      <form id="cg-desk-form">
        ${rows}
        ${forgivenessNote ? `<p class="cg-forgiveness">${escapeHtml(forgivenessNote)}</p>` : ''}
        <button type="submit" class="cg-submit-btn">SUBMIT</button>
      </form>
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('cg-in'));

  const form = el.querySelector('#cg-desk-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const selections = {};
    for (const q of questions) {
      const checked = form.querySelector(`input[name="cg-q-${cssEscape(q.id)}"]:checked`);
      selections[q.id] = checked ? Number(checked.value) : -1;
    }
    onSubmit?.(selections);
  });

  function close() {
    el.classList.remove('cg-in');
    setTimeout(() => el.remove(), 300);
    onClose?.();
  }

  return { el, close };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}
function cssEscape(s) {
  return String(s).replace(/["\\]/g, '\\$&');
}
