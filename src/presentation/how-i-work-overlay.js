/**
 * how-i-work-overlay.js
 *
 * "How I Work" — four principle cards with staggered reveal. A pulse
 * cycle highlights each card in sequence.
 *
 * Layout:
 *   Desktop — two cards per side column, character free in the middle:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ [DESIGN]                                       [OBSERVE] │
 *   │              3D character fully visible                   │
 *   │ [CLEAN]                                   [COLLABORATE]  │
 *   └──────────────────────────────────────────────────────────┘
 *   Mobile — compact 2×2 grid anchored to the bottom, camera frames
 *   the character above it.
 *
 * Public API
 * ──────────
 *   showHowIWorkOverlay()  – stagger-in + start pulse cycle
 *   hideHowIWorkOverlay()  – stagger-out + stop animation
 */

const _base = import.meta.env.BASE_URL;

const CARDS = [
  { title: 'Design',      caption: 'Scalability & Reliability',  img: `${_base}how-i-work/1.png` },
  { title: 'Clean',       caption: 'Maintainable Architecture',  img: `${_base}how-i-work/2.png` },
  { title: 'Observe',     caption: 'Observability & Monitoring', img: `${_base}how-i-work/3.png` },
  { title: 'Collaborate', caption: 'Teams & Stakeholders',       img: `${_base}how-i-work/4.png` },
];

// ── Styles ────────────────────────────────────────────────────────────────────
const _style = document.createElement('style');
_style.textContent = `
#_hiw-wrap {
  position: fixed;
  inset: 0;
  z-index: 15;
  pointer-events: none;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 64px 28px 84px;
  box-sizing: border-box;
}
#_hiw-row {
  display: grid;
  width: 100%;
  max-width: 1480px;
  grid-template-columns: clamp(170px, 18vw, 235px) 1fr clamp(170px, 18vw, 235px);
  grid-template-rows: auto auto;
  row-gap: 18px;
  align-items: center;
}
._hiw-card:nth-child(1) { grid-column: 1; grid-row: 1; }
._hiw-card:nth-child(2) { grid-column: 1; grid-row: 2; }
._hiw-card:nth-child(3) { grid-column: 3; grid-row: 1; }
._hiw-card:nth-child(4) { grid-column: 3; grid-row: 2; }
._hiw-card {
  border-radius: 8px;
  overflow: hidden;
  background: rgba(2, 10, 28, 0.88);
  border: 1px solid rgba(0, 180, 255, 0.22);
  box-shadow: 0 0 0 1px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.6),
              inset 0 1px 0 rgba(0,200,255,0.08);
  opacity: 0;
  transition: opacity 0.55s ease, transform 0.55s cubic-bezier(0.22,0.61,0.36,1),
              border-color 0.35s ease, box-shadow 0.35s ease;
}
/* left column slides in from the left, right column from the right */
._hiw-card:nth-child(-n+2) { transform: translateX(-44px); }
._hiw-card:nth-child(n+3)  { transform: translateX(44px); }
._hiw-card.hiw-visible {
  opacity: 1;
  transform: translateX(0);
}
._hiw-card.hiw-active {
  border-color: rgba(0, 225, 255, 0.60);
  box-shadow: 0 0 0 1px rgba(0,0,0,0.4), 0 8px 28px rgba(0,0,0,0.6),
              0 0 18px rgba(0,200,255,0.28), inset 0 1px 0 rgba(0,220,255,0.15);
}
._hiw-img-wrap {
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  position: relative;
}
._hiw-img-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  filter: brightness(0.72) saturate(0.85);
  transition: filter 0.35s ease;
}
._hiw-card.hiw-active ._hiw-img-wrap img {
  filter: brightness(1.05) saturate(1.1);
}
._hiw-img-wrap::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom,
    transparent 0%, rgba(0,200,255,0.06) 48%,
    rgba(0,200,255,0.12) 50%, rgba(0,200,255,0.06) 52%, transparent 100%);
  opacity: 0;
  transition: opacity 0.35s ease;
  pointer-events: none;
}
._hiw-card.hiw-active ._hiw-img-wrap::after { opacity: 1; }
._hiw-footer { padding: 10px 12px 11px; }
._hiw-title {
  font-family: 'Share Tech Mono','Courier New',monospace;
  font-size: 11px;
  font-weight: 700;
  color: #e0f4ff;
  letter-spacing: .12em;
  margin: 0 0 4px;
  text-shadow: 0 0 12px rgba(0,200,255,0.40);
  transition: color 0.3s, text-shadow 0.3s;
}
._hiw-card.hiw-active ._hiw-title {
  color: #00e5ff;
  text-shadow: 0 0 18px rgba(0,230,255,0.80);
}
._hiw-caption {
  font-family: 'Share Tech Mono','Courier New',monospace;
  font-size: 9px;
  color: rgba(0,190,255,0.50);
  letter-spacing: .09em;
  margin: 0;
  line-height: 1.4;
  transition: color 0.3s;
}
._hiw-card.hiw-active ._hiw-caption { color: rgba(0,220,255,0.78); }

#_hiw-rail {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: 2px;
  background: rgba(0,150,200,0.10);
  z-index: 16;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.5s;
}
#_hiw-rail-fill {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, #005577, #00ccff);
}

@media (max-width: 640px) {
  #_hiw-wrap { align-items: flex-end; padding: 0 10px 60px; }
  #_hiw-row {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto;
    gap: 10px;
    align-items: end;
    max-width: none;
  }
  ._hiw-card:nth-child(1) { grid-column: 1; grid-row: 1; }
  ._hiw-card:nth-child(2) { grid-column: 2; grid-row: 1; }
  ._hiw-card:nth-child(3) { grid-column: 1; grid-row: 2; }
  ._hiw-card:nth-child(4) { grid-column: 2; grid-row: 2; }
  /* on mobile all cards rise from the bottom */
  ._hiw-card:nth-child(-n+2), ._hiw-card:nth-child(n+3) { transform: translateY(32px); }
  ._hiw-card.hiw-visible { transform: translateY(0); }
  ._hiw-img-wrap { aspect-ratio: 21 / 9; }
  ._hiw-title   { font-size: 9px; }
  ._hiw-caption { font-size: 8px; }
  ._hiw-footer  { padding: 7px 9px 8px; }
}
`;
document.head.appendChild(_style);

// ── DOM ───────────────────────────────────────────────────────────────────────
const _wrap = document.createElement('div');
_wrap.id = '_hiw-wrap';
const _row = document.createElement('div');
_row.id = '_hiw-row';
_wrap.appendChild(_row);
document.body.appendChild(_wrap);

const _rail = document.createElement('div');
_rail.id = '_hiw-rail';
_rail.innerHTML = `<div id="_hiw-rail-fill"></div>`;
document.body.appendChild(_rail);
const _railFill = _rail.querySelector('#_hiw-rail-fill');

const _cardEls = CARDS.map(c => {
  const el = document.createElement('div');
  el.className = '_hiw-card';
  el.innerHTML = `
    <div class="_hiw-img-wrap">
      <img src="${c.img}" alt="${c.title}" loading="lazy" />
    </div>
    <div class="_hiw-footer">
      <div class="_hiw-title">${c.title.toUpperCase()}</div>
      <div class="_hiw-caption">${c.caption}</div>
    </div>`;
  _row.appendChild(el);
  return el;
});

// ── Animation ─────────────────────────────────────────────────────────────────
const CYCLE_MS   = 1900;
const STAGGER_MS = 150;

let _rafId      = null;
let _staggerIds = [];
let _activeIdx  = -1;
let _cycleStart = null;

function _setActive(idx) {
  _cardEls.forEach((el, i) => el.classList.toggle('hiw-active', i === idx));
  _activeIdx = idx;
}

function _tick(ts) {
  _rafId = requestAnimationFrame(_tick);
  if (!_cycleStart) { _cycleStart = ts; return; }
  const elapsed = ts - _cycleStart;
  const total   = CYCLE_MS * CARDS.length;
  const idx     = Math.floor((elapsed % total) / CYCLE_MS) % CARDS.length;
  if (idx !== _activeIdx) _setActive(idx);
  _railFill.style.width = `${((elapsed % total) / total) * 100}%`;
}

// ── Public API ────────────────────────────────────────────────────────────────
export function showHowIWorkOverlay() {
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  _staggerIds.forEach(clearTimeout); _staggerIds = [];
  _cardEls.forEach(el => el.classList.remove('hiw-visible', 'hiw-active'));
  _cycleStart = null; _activeIdx = -1;

  _cardEls.forEach((el, i) => {
    _staggerIds.push(setTimeout(() => el.classList.add('hiw-visible'), i * STAGGER_MS));
  });
  _staggerIds.push(setTimeout(() => { _rail.style.opacity = '1'; }, CARDS.length * STAGGER_MS + 250));
  _staggerIds.push(setTimeout(() => { _rafId = requestAnimationFrame(_tick); }, CARDS.length * STAGGER_MS + 380));
}

export function hideHowIWorkOverlay() {
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  _staggerIds.forEach(clearTimeout); _staggerIds = [];
  _cycleStart = null;
  [..._cardEls].reverse().forEach((el, i) => {
    _staggerIds.push(setTimeout(() => el.classList.remove('hiw-visible', 'hiw-active'), i * 80));
  });
  _rail.style.opacity = '0';
  _railFill.style.width = '0%';
}
