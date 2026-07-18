// Landing page + case-file board. Only the Royal York case opens the game;
// sealed cases refuse with a shake.

// Each photo is a small noir silhouette; the active case has one lit window.
function photo(id, buildings, litWindow) {
  const win = litWindow
    ? `<rect x="${litWindow[0]}" y="${litWindow[1]}" width="3" height="4" fill="#e8a54a">
         <animate attributeName="opacity" values="1;1;0.2;1;0.6;1" dur="6s" repeatCount="indefinite"/>
       </rect>`
    : '';
  return `
  <svg viewBox="0 0 160 120" role="img">
    <defs>
      <linearGradient id="sky-${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#35322a"/>
        <stop offset="0.7" stop-color="#141210"/>
        <stop offset="1" stop-color="#0a0908"/>
      </linearGradient>
      <radialGradient id="moon-${id}" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#cfc8b0" stop-opacity="0.5"/>
        <stop offset="1" stop-color="#cfc8b0" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="160" height="120" fill="url(#sky-${id})"/>
    <circle cx="126" cy="22" r="17" fill="url(#moon-${id})"/>
    ${buildings.map((d) => `<path d="${d}" fill="#0b0a09"/>`).join('')}
    ${win}
    <rect width="160" height="34" y="86" fill="#8d8571" opacity="0.08"/>
    <rect width="160" height="120" fill="none" stroke="#0a0908" stroke-width="2"/>
  </svg>`;
}

const HOTELS = [
  {
    id: 'royal-york', name: 'Fairmont Royal York', city: 'Toronto', active: true,
    pos: { left: '41%', top: '32%' }, tilt: '-2deg',
    // chateau-style stepped mass with steep copper roof
    buildings: [
      'M20 120 L20 78 L44 78 L44 66 L58 66 L58 50 L66 38 L74 30 L82 38 L90 50 L90 66 L104 66 L104 78 L128 78 L128 120 Z',
      'M0 120 L0 92 L18 92 L18 120 Z M132 120 L132 90 L160 90 L160 120 Z',
    ],
    lit: [72, 58],
  },
  {
    id: 'stanley', name: 'The Stanley', city: 'Estes Park',
    pos: { left: '6%', top: '5%' }, tilt: '3deg',
    // long colonial block with central cupola
    buildings: [
      'M12 120 L12 72 L70 72 L70 60 L76 52 L84 52 L90 60 L90 72 L148 72 L148 120 Z',
      'M74 52 L74 42 L86 42 L86 52 Z M78 42 L80 34 L82 42 Z',
    ],
  },
  {
    id: 'banff', name: 'Fairmont Banff Springs', city: 'Banff',
    pos: { left: '72%', top: '4%' }, tilt: '-3deg',
    // castle in the mountains
    buildings: [
      'M0 120 L28 74 L52 96 L84 58 L118 92 L160 66 L160 120 Z',
      'M56 120 L56 58 L64 48 L72 40 L80 48 L88 58 L88 74 L102 74 L102 120 Z',
      'M40 120 L40 80 L54 80 L54 120 Z',
    ],
  },
  {
    id: 'frontenac', name: 'Château Frontenac', city: 'Québec',
    pos: { left: '5%', top: '57%' }, tilt: '2.5deg',
    // dominant steep-roofed central tower
    buildings: [
      'M62 120 L62 54 L70 30 L78 22 L86 30 L94 54 L94 120 Z',
      'M18 120 L18 84 L60 84 L60 120 Z M96 120 L96 80 L142 80 L142 120 Z',
      'M14 84 L20 70 L26 84 Z M136 80 L142 66 L148 80 Z',
    ],
  },
  {
    id: 'coronado', name: 'Hotel del Coronado', city: 'San Diego',
    pos: { left: '76%', top: '55%' }, tilt: '-2.5deg',
    // seaside wing with the cone-roofed turret
    buildings: [
      'M10 120 L10 82 L96 82 L96 120 Z',
      'M100 120 L100 66 L118 66 L118 120 Z M100 66 L109 40 L118 66 Z',
      'M120 120 L120 90 L152 90 L152 120 Z',
    ],
  },
  {
    id: 'drake', name: 'The Drake', city: 'Chicago',
    pos: { left: '38%', top: '64%' }, tilt: '1.8deg',
    // stepped urban block
    buildings: [
      'M28 120 L28 62 L56 62 L56 48 L104 48 L104 62 L132 62 L132 120 Z',
      'M0 120 L0 88 L26 88 L26 120 Z M134 120 L134 78 L160 78 L160 120 Z',
    ],
  },
];

export function initUI({ onEnter }) {
  const landing = document.getElementById('landing');
  const cases = document.getElementById('cases');
  const board = document.getElementById('board');
  const string = document.getElementById('string');

  let activePin = null;
  const pins = [];
  for (const h of HOTELS) {
    const el = document.createElement('button');
    el.className = `polaroid ${h.active ? 'active-case' : 'sealed'}`;
    el.style.setProperty('--tilt', h.tilt);
    el.style.left = h.pos.left;
    el.style.top = h.pos.top;
    if (!h.active) el.setAttribute('aria-disabled', 'true');
    el.innerHTML = `
      <span class="pin"></span>
      <figure>
        ${photo(h.id, h.buildings, h.lit)}
        <span class="stamp">${h.active ? 'ACTIVE' : 'SEALED'}</span>
      </figure>
      <figcaption>${h.name}<br/>${h.city}</figcaption>`;
    board.appendChild(el);

    // pin position in string viewBox units (100 x 62), for the red thread
    const pin = [parseFloat(h.pos.left) + 8, (parseFloat(h.pos.top) / 100) * 62 + 1];
    if (h.active) activePin = pin;
    else pins.push(pin);

    el.addEventListener('click', () => {
      if (h.active) {
        cases.classList.add('gone');
        onEnter();
      } else {
        el.classList.remove('shake');
        void el.offsetWidth; // restart the animation
        el.classList.add('shake');
      }
    });
  }

  // every sealed case is tied to the one active case
  string.innerHTML = pins
    .map(([x, y]) => `<line x1="${x}" y1="${y}" x2="${activePin[0]}" y2="${activePin[1]}"/>`)
    .join('');

  document.getElementById('begin').addEventListener('click', () => {
    landing.classList.add('gone');
    cases.hidden = false;
    requestAnimationFrame(() => cases.classList.remove('gone'));
  });
}
