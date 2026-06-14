/**
 * how-i-work-overlay.js
 *
 * Desktop — two cards per side column, character free in the middle.
 * Mobile  — single-card crossfade showcase at the bottom of the screen
 *           with a 4-dot progress indicator. Cards cycle automatically;
 *           the character fills the upper ~65% of the viewport.
 */

const _base = import.meta.env.BASE_URL;

const CARDS = [
  {
    num: '01',
    title: 'Design First',
    caption: 'Scalability & Reliability',
    tags: ['API CONTRACTS', 'FAIL FAST', 'SCALE BY DEFAULT'],
    img: `${_base}how-i-work/1.png`,
  },
  {
    num: '02',
    title: 'Clean Code',
    caption: 'Maintainable Architecture',
    tags: ['SOLID', 'DRY', 'READABLE'],
    img: `${_base}how-i-work/2.png`,
  },
  {
    num: '03',
    title: 'Observe',
    caption: 'Observability & Monitoring',
    tags: ['METRICS', 'TRACING', 'ALERTING'],
    img: `${_base}how-i-work/3.png`,
  },
  {
    num: '04',
    title: 'Collaborate',
    caption: 'Teams & Stakeholders',
    tags: ['ASYNC-FIRST', 'FEEDBACK LOOPS', 'SHARED OWNERSHIP'],
    img: `${_base}how-i-work/4.png`,
  },
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
  background: rgba(2,8,24,0.92);
  border: 1px solid rgba(0,150,200,0.18);
  border-radius: 6px;
  overflow: hidden;
  position: relative;
  opacity: 0;
  transition:
    opacity 0.55s ease,
    transform 0.55s cubic-bezier(0.22,0.61,0.36,1),
    border-color 0.35s ease,
    box-shadow 0.35s ease;
}
/* left column slides in from the left, right column from the right */
._hiw-card:nth-child(-n+2) { transform: translateX(-44px); }
._hiw-card:nth-child(n+3)  { transform: translateX(44px); }
._hiw-card.hiw-visible {
  opacity: 1;
  transform: translateX(0);
}
._hiw-card.hiw-active {
  border-color: rgba(0,220,255,0.70);
  box-shadow:
    0 0 0 1px rgba(0,0,0,0.4),
    0 8px 28px rgba(0,0,0,0.6),
    0 0 22px rgba(0,200,255,0.35),
    0 0 6px rgba(0,220,255,0.20),
    inset 0 1px 0 rgba(0,220,255,0.12);
}

/* ── Corner brackets ─────────────────────────────────────────────────────── */
._hiw-c {
  position: absolute;
  width: 10px;
  height: 10px;
  pointer-events: none;
  z-index: 3;
}
._hiw-c-tl {
  top: 5px; left: 5px;
  border-top: 1.5px solid rgba(0,200,255,0.45);
  border-left: 1.5px solid rgba(0,200,255,0.45);
  transition: border-color 0.35s ease;
}
._hiw-c-tr {
  top: 5px; right: 5px;
  border-top: 1.5px solid rgba(0,200,255,0.45);
  border-right: 1.5px solid rgba(0,200,255,0.45);
  transition: border-color 0.35s ease;
}
._hiw-card.hiw-active ._hiw-c-tl,
._hiw-card.hiw-active ._hiw-c-tr {
  border-color: rgba(0,240,255,0.90);
}

/* ── Number badge ────────────────────────────────────────────────────────── */
._hiw-num {
  position: absolute;
  top: 8px; left: 10px;
  font-size: 9px;
  letter-spacing: .16em;
  color: rgba(0,180,255,0.40);
  font-family: 'Share Tech Mono','Courier New',monospace;
  z-index: 2;
  transition: color 0.35s ease;
}
._hiw-card.hiw-active ._hiw-num { color: rgba(0,220,255,0.85); }

/* ── Pulse indicator ─────────────────────────────────────────────────────── */
._hiw-pulse {
  position: absolute;
  top: 8px; right: 10px;
  display: flex;
  align-items: center;
  gap: 5px;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 3;
}
._hiw-card.hiw-active ._hiw-pulse { opacity: 1; }
._hiw-pulse-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: #00ff99;
  animation: _hiw-pulse-anim 1.2s ease-in-out infinite;
  display: inline-block;
}
@keyframes _hiw-pulse-anim {
  0%,100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.4; transform: scale(0.7); }
}
._hiw-pulse-label {
  font-size: 8px;
  letter-spacing: .18em;
  color: #00ff99;
  font-family: 'Share Tech Mono','Courier New',monospace;
}

/* ── Image ───────────────────────────────────────────────────────────────── */
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
  filter: brightness(0.60) saturate(0.75);
  transition: filter 0.4s ease;
}
._hiw-card.hiw-active ._hiw-img-wrap img {
  filter: brightness(1.0) saturate(1.15);
}

/* ── Scan line ───────────────────────────────────────────────────────────── */
._hiw-scan {
  position: absolute;
  left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(0,220,255,0.65), transparent);
  top: 0;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}
._hiw-card.hiw-active ._hiw-scan {
  opacity: 1;
  animation: _hiw-scan-move 2.0s linear infinite;
}
@keyframes _hiw-scan-move {
  0%   { top: 0%; }
  100% { top: 100%; }
}

/* ── Footer ──────────────────────────────────────────────────────────────── */
._hiw-footer {
  padding: 10px 12px 12px;
}
._hiw-title {
  font-family: 'Share Tech Mono','Courier New',monospace;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .14em;
  color: #c8eaff;
  margin: 0;
  transition: color 0.3s ease, text-shadow 0.3s ease;
}
._hiw-card.hiw-active ._hiw-title {
  color: #00e5ff;
  text-shadow: 0 0 14px rgba(0,230,255,0.75), 0 0 4px rgba(0,220,255,0.50);
}
._hiw-rule {
  height: 1px;
  background: linear-gradient(90deg, rgba(0,180,255,0.30), transparent);
  margin: 6px 0;
  border: none;
}
._hiw-caption {
  font-family: 'Share Tech Mono','Courier New',monospace;
  font-size: 9px;
  letter-spacing: .09em;
  color: rgba(0,170,220,0.55);
  margin: 0;
  line-height: 1.4;
  transition: color 0.3s ease;
}
._hiw-card.hiw-active ._hiw-caption { color: rgba(0,220,255,0.80); }
._hiw-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 7px;
}
._hiw-tag {
  font-family: 'Share Tech Mono','Courier New',monospace;
  font-size: 7.5px;
  letter-spacing: .12em;
  color: rgba(0,170,220,0.45);
  background: rgba(0,100,180,0.12);
  border: 1px solid rgba(0,150,200,0.20);
  border-radius: 2px;
  padding: 2px 5px;
  transition: color 0.3s ease, background 0.3s ease, border-color 0.3s ease;
}
._hiw-card.hiw-active ._hiw-tag {
  color: rgba(0,220,255,0.80);
  background: rgba(0,120,200,0.20);
  border-color: rgba(0,200,255,0.40);
}

/* ── Progress rail (desktop) ─────────────────────────────────────────────── */
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

/* ── Dot indicator (mobile only) ─────────────────────────────────────────── */
#_hiw-dots {
  display: none;
}
._hiw-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(0,150,200,0.22);
  border: 1px solid rgba(0,180,220,0.18);
  transition: background 0.35s ease, box-shadow 0.35s ease, transform 0.35s ease;
}
._hiw-dot.hiw-dot-active {
  background: #00ccff;
  border-color: rgba(0,220,255,0.55);
  box-shadow: 0 0 8px rgba(0,200,255,0.70);
  transform: scale(1.3);
}

/* ── Mobile — single-card crossfade showcase ─────────────────────────────── */
@media (max-width: 640px) {
  /* Column layout: card row on top, dot strip below — all anchored to bottom */
  #_hiw-wrap {
    flex-direction: column;
    justify-content: flex-end;
    align-items: stretch;
    padding: 0 12px 72px;
    gap: 8px;
  }

  /* Fixed-height card container; all 4 cards stack here and crossfade */
  #_hiw-row {
    display: block;
    position: relative;
    width: 100%;
    height: 26vh;
    min-height: 170px;
    max-height: 215px;
  }

  /* Stack all cards at the same position */
  ._hiw-card {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    border-radius: 5px;
  }

  /* Override desktop slide-in transforms — start faintly raised */
  ._hiw-card:nth-child(-n+2),
  ._hiw-card:nth-child(n+3) { transform: translateY(8px); }

  /* Visible but NOT active = invisible (we crossfade between them) */
  ._hiw-card.hiw-visible              { opacity: 0; transform: translateY(0); }
  ._hiw-card.hiw-visible.hiw-active   { opacity: 1; }

  /* Image fills everything above the footer */
  ._hiw-img-wrap {
    position: absolute;
    top: 0; left: 0; right: 0;
    bottom: 68px;          /* reserve space for footer */
    aspect-ratio: unset;
    height: unset;
  }

  /* Footer is pinned to the bottom of the card */
  ._hiw-footer {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    padding: 8px 14px 10px;
    background: rgba(2,8,24,0.85);
    backdrop-filter: blur(4px);
  }

  ._hiw-title   { font-size: 12px; letter-spacing: .12em; }
  ._hiw-rule    { margin: 4px 0; }
  ._hiw-caption { font-size: 8.5px; }
  ._hiw-tags    { gap: 4px; margin-top: 4px; }
  ._hiw-tag     { font-size: 7px; }

  /* Show dot indicator, hide progress rail */
  #_hiw-dots {
    display: flex;
    justify-content: center;
    gap: 8px;
    padding: 0;
    flex-shrink: 0;
  }
  #_hiw-rail { display: none; }
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

// ── Dot indicator (mobile) ────────────────────────────────────────────────────
const _dotsEl = document.createElement('div');
_dotsEl.id = '_hiw-dots';
_wrap.appendChild(_dotsEl);

const _dotEls = CARDS.map(() => {
  const d = document.createElement('span');
  d.className = '_hiw-dot';
  _dotsEl.appendChild(d);
  return d;
});

// ── Cards ─────────────────────────────────────────────────────────────────────
const _cardEls = CARDS.map(c => {
  const el = document.createElement('div');
  el.className = '_hiw-card';
  const tagsHtml = c.tags.map(t => `<span class="_hiw-tag">${t}</span>`).join('');
  el.innerHTML = `
    <div class="_hiw-c _hiw-c-tl"></div>
    <div class="_hiw-c _hiw-c-tr"></div>
    <div class="_hiw-num">${c.num}</div>
    <div class="_hiw-pulse">
      <span class="_hiw-pulse-dot"></span>
      <span class="_hiw-pulse-label">ONLINE</span>
    </div>
    <div class="_hiw-img-wrap">
      <img src="${c.img}" alt="${c.title}" loading="lazy" />
      <div class="_hiw-scan"></div>
    </div>
    <div class="_hiw-footer">
      <div class="_hiw-title">${c.title.toUpperCase()}</div>
      <div class="_hiw-rule"></div>
      <div class="_hiw-caption">${c.caption}</div>
      <div class="_hiw-tags">${tagsHtml}</div>
    </div>`;
  _row.appendChild(el);
  return el;
});

// ── Animation ─────────────────────────────────────────────────────────────────
const CYCLE_MS   = 2400;
const STAGGER_MS = 150;

let _rafId      = null;
let _staggerIds = [];
let _activeIdx  = -1;
let _cycleStart = null;

function _setActive(idx) {
  _cardEls.forEach((el, i) => el.classList.toggle('hiw-active', i === idx));
  _dotEls.forEach((d,  i) => d.classList.toggle('hiw-dot-active', i === idx));
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
  _dotEls.forEach(d => d.classList.remove('hiw-dot-active'));
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
  _dotEls.forEach(d => d.classList.remove('hiw-dot-active'));
  _rail.style.opacity = '0';
  _railFill.style.width = '0%';
}
