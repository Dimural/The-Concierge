// In-fiction HUD: objective line (typewriter), clue journal (Tab toggle),
// interaction prompt, capture-active indicator slot, New Arrival banner,
// and the "HE CAN SEE" alertness hint.
import { injectStyles } from './styles.js';

export function createHud() {
  injectStyles();

  const root = document.createElement('div');
  root.className = 'cg-hud';
  root.innerHTML = `
    <div class="cg-objective" id="cg-objective"></div>
    <div class="cg-prompt" id="cg-prompt" hidden></div>
    <div class="cg-eyes" id="cg-eyes" hidden>HE CAN SEE</div>
    <div class="cg-capture" id="cg-capture" hidden>
      <span class="cg-capture-dot"></span><span class="cg-capture-label">CAPTURE ACTIVE</span>
    </div>
    <div class="cg-journal" id="cg-journal" hidden>
      <header>GUEST FILE — RECOVERED RECORDS</header>
      <div class="cg-journal-list" id="cg-journal-list"></div>
      <footer>TAB TO CLOSE</footer>
    </div>
    <div class="cg-arrival-banner" id="cg-arrival-banner" hidden></div>
    <div class="cg-toast" id="cg-toast" hidden></div>
  `;
  document.body.appendChild(root);

  const objectiveEl = root.querySelector('#cg-objective');
  const promptEl = root.querySelector('#cg-prompt');
  const eyesEl = root.querySelector('#cg-eyes');
  const captureEl = root.querySelector('#cg-capture');
  const journalEl = root.querySelector('#cg-journal');
  const journalList = root.querySelector('#cg-journal-list');
  const arrivalBanner = root.querySelector('#cg-arrival-banner');
  const toastEl = root.querySelector('#cg-toast');

  let lastObjective = '';

  function typewrite(el, text, speedMs = 16) {
    el.textContent = '';
    let i = 0;
    clearInterval(el._cgTimer);
    el._cgTimer = setInterval(() => {
      i++;
      el.textContent = text.slice(0, i);
      if (i >= text.length) clearInterval(el._cgTimer);
    }, speedMs);
  }

  function setObjective(text) {
    if (text === lastObjective) return;
    lastObjective = text;
    typewrite(objectiveEl, text);
  }

  function setPrompt(text) {
    if (!text) { promptEl.hidden = true; promptEl.textContent = ''; return; }
    promptEl.hidden = false;
    promptEl.textContent = text;
  }

  let journalOpen = false;
  function setJournalOpen(open) {
    journalOpen = open;
    journalEl.hidden = !open;
  }
  function toggleJournal() { setJournalOpen(!journalOpen); }

  function addClue(id, label, text) {
    const row = document.createElement('div');
    row.className = 'cg-clue';
    row.innerHTML = `<span class="cg-clue-id">${id}</span><span class="cg-clue-label">${escapeHtml(label)}</span><span class="cg-clue-text"></span>`;
    journalList.appendChild(row);
    typewrite(row.querySelector('.cg-clue-text'), text, 13);
  }

  function setEyesHint(open) { eyesEl.hidden = !open; }

  // Adopts a DOM element from Presage if it exposes one, otherwise this HUD
  // drives its own dot from mode/active flags via the (el=null, active, label) form.
  function setCapture(el, active, label) {
    if (el) {
      captureEl.innerHTML = '';
      captureEl.appendChild(el);
      captureEl.hidden = false;
      return;
    }
    captureEl.hidden = !active;
    const lbl = captureEl.querySelector('.cg-capture-label');
    if (lbl) lbl.textContent = label || 'CAPTURE ACTIVE';
  }

  let bannerTimer = null;
  function showBanner(lines, ms = 3200) {
    arrivalBanner.innerHTML = lines.map((l) => `<div>${escapeHtml(l)}</div>`).join('');
    arrivalBanner.hidden = false;
    arrivalBanner.classList.remove('cg-flash');
    void arrivalBanner.offsetWidth;
    arrivalBanner.classList.add('cg-flash');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { arrivalBanner.hidden = true; }, ms);
  }

  let toastTimer = null;
  function toast(text, ms = 2600) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add('cg-in'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('cg-in');
      setTimeout(() => { toastEl.hidden = true; }, 350);
    }, ms);
  }

  function destroy() {
    clearInterval(objectiveEl._cgTimer);
    clearTimeout(bannerTimer);
    clearTimeout(toastTimer);
    root.remove();
  }

  return {
    root, setObjective, setPrompt, toggleJournal, setJournalOpen,
    addClue, setEyesHint, setCapture, showBanner, toast, destroy,
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
