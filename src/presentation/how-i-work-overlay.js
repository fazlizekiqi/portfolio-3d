/**
 * how-i-work-overlay.js — "Patent Diagram" treatment of the How I Work slide.
 *
 * The character standing centre-stage becomes the SUBJECT of an engineering
 * blueprint. Four engineering-principle callout blocks sit in the corners with
 * leader lines + reference crosshairs pointing AT the character, each card
 * carrying its illustration and a title that typewrites in. A drawing-sheet
 * cartouche reads "FIG. 01 — THE ENGINEER · SHEET 1 OF 1". The scene's normal
 * blue-world gradient shows behind the character.
 *
 * Desktop — 4 corner callouts, leader lines converge on the character.
 * Mobile  — callouts stack top/bottom, leader lines hidden, character framed
 *           in the central band.
 *
 * Public API (unchanged):
 *   showHowIWorkOverlay()
 *   hideHowIWorkOverlay()
 */

import { audio } from '../audio.js';

const _base = import.meta.env.BASE_URL;

// ── Principle data ──────────────────────────────────────────────────────────
// pos = which corner the callout lives in; ref = patent-style reference letter.
const CARDS = [
  { idx: '01', ref: 'A', pos: 'tl', title: 'Design First',
    caption: 'Scalable, reliable systems — by design, not by accident.',
    tags: ['API CONTRACTS', 'FAIL FAST', 'SCALE BY DEFAULT'],
    img: `${_base}how-i-work/1.png` },
  { idx: '02', ref: 'B', pos: 'tr', title: 'Clean Code',
    caption: 'Maintainable architecture that outlives the sprint.',
    tags: ['SOLID', 'DRY', 'READABLE'],
    img: `${_base}how-i-work/2.png` },
  { idx: '03', ref: 'C', pos: 'bl', title: 'Observe',
    caption: 'Measure everything, alert on what actually matters.',
    tags: ['METRICS', 'TRACING', 'ALERTING'],
    img: `${_base}how-i-work/3.png` },
  { idx: '04', ref: 'D', pos: 'br', title: 'Collaborate',
    caption: 'Async-first, feedback loops, shared ownership.',
    tags: ['ASYNC-FIRST', 'FEEDBACK LOOPS', 'SHARED OWNERSHIP'],
    img: `${_base}how-i-work/4.png` },
];

const FONT       = `'Share Tech Mono','Courier New',monospace`;
const CYCLE_MS   = 2600;
const STAGGER_MS = 170;

// ── Styles ──────────────────────────────────────────────────────────────────
const _style = document.createElement('style');
_style.textContent = `
#_hiw-wrap {
  position: fixed;
  inset: 0;
  z-index: 15;
  pointer-events: none;
  font-family: ${FONT};
}

/* ── Leader-line SVG layer ─────────────────────────────────────────────────── */
#_hiw-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
._hiw-leader {
  fill: none;
  stroke: rgba(0,180,235,0.40);
  stroke-width: 1.2;
  transition: stroke 0.4s ease, stroke-width 0.4s ease;
}
._hiw-leader.hiw-lead-active {
  stroke: rgba(0,235,255,0.95);
  stroke-width: 1.8;
  filter: drop-shadow(0 0 4px rgba(0,220,255,0.7));
}
._hiw-mark circle {
  fill: none;
  stroke: rgba(0,200,240,0.55);
  stroke-width: 1.2;
  transition: stroke 0.4s ease;
}
._hiw-mark line {
  stroke: rgba(0,200,240,0.55);
  stroke-width: 1;
  transition: stroke 0.4s ease;
}
._hiw-mark text {
  fill: rgba(0,220,255,0.75);
  font-family: ${FONT};
  font-size: 11px;
  letter-spacing: .08em;
}
._hiw-mark.hiw-mark-active circle,
._hiw-mark.hiw-mark-active line { stroke: #00eaff; }
._hiw-mark.hiw-mark-active text { fill: #7df3ff; }
._hiw-mark { opacity: 0; transition: opacity 0.4s ease; }
._hiw-mark.hiw-mark-vis { opacity: 1; }

/* ── Callout blocks ─────────────────────────────────────────────────────────── */
._hiw-blk {
  position: absolute;
  width: clamp(196px, 19vw, 252px);
  background: rgba(2,9,24,0.86);
  border: 1px solid rgba(0,150,200,0.30);
  border-radius: 4px;
  padding: 11px 13px 12px;
  box-sizing: border-box;
  backdrop-filter: blur(7px);
  opacity: 0;
  transition:
    opacity 0.5s ease,
    transform 0.5s cubic-bezier(0.22,0.61,0.36,1),
    border-color 0.35s ease,
    box-shadow 0.35s ease;
}
._hiw-blk-tl { top: 92px;    left: 3%;  transform: translate(-30px,-14px) scale(0.94); }
._hiw-blk-tr { top: 92px;    right: 3%; transform: translate( 30px,-14px) scale(0.94); }
._hiw-blk-bl { bottom: 70px; left: 3%;  transform: translate(-30px, 14px) scale(0.94); }
._hiw-blk-br { bottom: 70px; right: 3%; transform: translate( 30px, 14px) scale(0.94); }
._hiw-blk.hiw-visible { opacity: 1; transform: translate(0,0) scale(1); }
._hiw-blk.hiw-active {
  border-color: rgba(0,225,255,0.75);
  box-shadow:
    0 8px 26px rgba(0,0,0,0.55),
    0 0 22px rgba(0,200,255,0.30),
    inset 0 1px 0 rgba(0,220,255,0.12);
}

/* Collapsed by default (index + title only); reveals on the active card. */
._hiw-blk-body {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transition:
    max-height 0.5s cubic-bezier(0.22,0.61,0.36,1),
    opacity 0.4s ease,
    margin-top 0.4s ease;
}
._hiw-blk.hiw-expanded ._hiw-blk-body {
  max-height: 240px;
  opacity: 1;
  margin-top: 8px;
}

/* corner brackets */
._hiw-cb {
  position: absolute;
  width: 9px; height: 9px;
  pointer-events: none;
}
._hiw-cb-tl { top: 4px; left: 4px;
  border-top: 1.5px solid rgba(0,210,255,0.55);
  border-left: 1.5px solid rgba(0,210,255,0.55); }
._hiw-cb-br { bottom: 4px; right: 4px;
  border-bottom: 1.5px solid rgba(0,210,255,0.55);
  border-right: 1.5px solid rgba(0,210,255,0.55); }

._hiw-blk-hd {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
._hiw-blk-idx {
  font-size: 9px;
  letter-spacing: .12em;
  color: rgba(0,200,255,0.85);
  border: 1px solid rgba(0,180,230,0.45);
  border-radius: 50%;
  width: 18px; height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
._hiw-blk-ref {
  font-size: 8px;
  letter-spacing: .20em;
  color: rgba(0,170,210,0.55);
  flex: 1;
}
._hiw-blk-dim {
  font-size: 7.5px;
  letter-spacing: .10em;
  color: rgba(120,180,210,0.40);
}
/* card picture banner */
._hiw-blk-img {
  position: relative;
  height: 56px;
  margin-bottom: 8px;
  border-radius: 3px;
  overflow: hidden;
  border: 1px solid rgba(0,150,200,0.20);
}
._hiw-blk-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  filter: brightness(0.5) saturate(0.7) hue-rotate(-8deg);
  transition: filter 0.4s ease, transform 0.6s ease;
}
._hiw-blk.hiw-active ._hiw-blk-img img {
  filter: brightness(0.95) saturate(1.1);
  transform: scale(1.04);
}
._hiw-blk-img-scan {
  position: absolute;
  left: 0; right: 0;
  height: 2px;
  top: 0;
  background: linear-gradient(90deg, transparent, rgba(0,225,255,0.7), transparent);
  opacity: 0;
  pointer-events: none;
}
._hiw-blk.hiw-active ._hiw-blk-img-scan {
  opacity: 1;
  animation: _hiw-img-scan 2s linear infinite;
}
@keyframes _hiw-img-scan {
  0%   { top: 0%; }
  100% { top: 100%; }
}

._hiw-blk-title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: .10em;
  color: #cfeeff;
  min-height: 15px;
  transition: color 0.3s ease, text-shadow 0.3s ease;
}
._hiw-blk.hiw-active ._hiw-blk-title {
  color: #00e9ff;
  text-shadow: 0 0 14px rgba(0,230,255,0.7);
}
._hiw-blk-tw-cursor { color: #00e5ff; animation: _hiw-blink 1s step-end infinite; }
@keyframes _hiw-blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
._hiw-blk-rule {
  height: 1px;
  background: linear-gradient(90deg, rgba(0,180,255,0.40), transparent);
  margin: 6px 0 7px;
}
._hiw-blk-cap {
  font-size: 9px;
  letter-spacing: .04em;
  line-height: 1.55;
  color: rgba(150,205,225,0.70);
  margin-bottom: 8px;
}
._hiw-blk-tags { display: flex; flex-wrap: wrap; gap: 4px; }
._hiw-blk-tag {
  font-size: 7px;
  letter-spacing: .11em;
  color: rgba(0,175,220,0.55);
  background: rgba(0,90,160,0.14);
  border: 1px solid rgba(0,150,200,0.22);
  border-radius: 2px;
  padding: 2px 5px;
  transition: color 0.3s ease, background 0.3s ease, border-color 0.3s ease;
}
._hiw-blk.hiw-active ._hiw-blk-tag {
  color: rgba(0,225,255,0.85);
  background: rgba(0,120,200,0.22);
  border-color: rgba(0,200,255,0.42);
}

/* ── Progress rail ──────────────────────────────────────────────────────────── */
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
  height: 100%; width: 0%;
  background: linear-gradient(90deg, #004f6e, #00ccff);
}

/* ── Mobile ─────────────────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  ._hiw-blk {
    width: 43vw;
    padding: 6px 8px 7px;
    backdrop-filter: blur(5px);
  }
  ._hiw-blk-tl { top: 60px;    left: 7px;  transform: translateY(-12px) scale(0.94); }
  ._hiw-blk-tr { top: 60px;    right: 7px; transform: translateY(-12px) scale(0.94); }
  ._hiw-blk-bl { bottom: 58px; left: 7px;  top: auto; transform: translateY(12px) scale(0.94); }
  ._hiw-blk-br { bottom: 58px; right: 7px; top: auto; transform: translateY(12px) scale(0.94); }
  ._hiw-blk.hiw-visible { transform: translateY(0) scale(1); }
  ._hiw-blk.hiw-expanded ._hiw-blk-body { max-height: 200px; margin-top: 6px; }
  ._hiw-blk-img   { height: 42px; margin-bottom: 6px; }
  ._hiw-blk-cap   { font-size: 8px; margin-bottom: 6px; }
  ._hiw-blk-tag   { font-size: 6.5px; padding: 1px 4px; }
  ._hiw-blk-title { font-size: 10px; letter-spacing: .08em; }
  ._hiw-blk-hd    { margin-bottom: 0; }
  ._hiw-blk-ref, ._hiw-blk-dim { display: none; }
  #_hiw-rail { display: none; }
}
`;
document.head.appendChild(_style);

// ── DOM ─────────────────────────────────────────────────────────────────────
const _wrap = document.createElement('div');
_wrap.id = '_hiw-wrap';
_wrap.style.display = 'none';

// Leader-line SVG layer
const SVGNS = 'http://www.w3.org/2000/svg';
const _svg  = document.createElementNS(SVGNS, 'svg');
_svg.id = '_hiw-svg';
_svg.setAttribute('preserveAspectRatio', 'none');
// arrowhead marker
_svg.innerHTML = `
  <defs>
    <marker id="_hiw-arrow" markerWidth="7" markerHeight="7" refX="5.5" refY="3"
            orient="auto" markerUnits="userSpaceOnUse">
      <path d="M0,0 L6,3 L0,6" fill="none" stroke="rgba(0,220,255,0.85)" stroke-width="1"/>
    </marker>
  </defs>`;
_wrap.appendChild(_svg);

// Leader paths + reference marks (one per card)
const _pathEls = [];
const _markEls = [];
CARDS.forEach((c) => {
  const path = document.createElementNS(SVGNS, 'path');
  path.setAttribute('class', '_hiw-leader');
  path.setAttribute('marker-end', 'url(#_hiw-arrow)');
  _svg.appendChild(path);
  _pathEls.push(path);

  const g = document.createElementNS(SVGNS, 'g');
  g.setAttribute('class', '_hiw-mark');
  g.innerHTML = `
    <circle r="8"></circle>
    <line x1="-12" y1="0" x2="-4" y2="0"></line>
    <line x1="4"  y1="0" x2="12" y2="0"></line>
    <line x1="0" y1="-12" x2="0" y2="-4"></line>
    <line x1="0" y1="4"  x2="0" y2="12"></line>
    <text x="11" y="-9">${c.ref}</text>`;
  _svg.appendChild(g);
  _markEls.push(g);
});

// Callout blocks
const _blockEls = CARDS.map((c) => {
  const el = document.createElement('div');
  el.className = `_hiw-blk _hiw-blk-${c.pos}`;
  const tags = c.tags.map(t => `<span class="_hiw-blk-tag">${t}</span>`).join('');
  el.innerHTML = `
    <span class="_hiw-cb _hiw-cb-tl"></span>
    <span class="_hiw-cb _hiw-cb-br"></span>
    <div class="_hiw-blk-hd">
      <span class="_hiw-blk-idx">${c.idx}</span>
      <span class="_hiw-blk-ref">REF ${c.ref}</span>
      <span class="_hiw-blk-dim">1:1</span>
    </div>
    <div class="_hiw-blk-title"></div>
    <div class="_hiw-blk-body">
      <div class="_hiw-blk-img">
        <img src="${c.img}" alt="" loading="lazy" />
        <span class="_hiw-blk-img-scan"></span>
      </div>
      <div class="_hiw-blk-rule"></div>
      <div class="_hiw-blk-cap">${c.caption}</div>
      <div class="_hiw-blk-tags">${tags}</div>
    </div>`;
  _wrap.appendChild(el);
  return el;
});
const _titleEls = _blockEls.map(b => b.querySelector('._hiw-blk-title'));

document.body.appendChild(_wrap);

const _rail = document.createElement('div');
_rail.id = '_hiw-rail';
_rail.innerHTML = '<div id="_hiw-rail-fill"></div>';
document.body.appendChild(_rail);
const _railFill = _rail.querySelector('#_hiw-rail-fill');

// ── Animation state ─────────────────────────────────────────────────────────
let _rafId      = null;
let _staggerIds = [];
let _typeIds    = [];
let _activeIdx  = -1;
let _cycleStart = null;
let _showing    = false;
let _stepMs     = CYCLE_MS;   // per-card expand window, set from slide duration

// ── Leader-line geometry ──────────────────────────────────────────────────────
function _blockAnchor(pos, r) {
  switch (pos) {
    case 'tl': return { x: r.right - 6, y: r.bottom - 4 };
    case 'tr': return { x: r.left + 6,  y: r.bottom - 4 };
    case 'bl': return { x: r.right - 6, y: r.top + 4 };
    case 'br': return { x: r.left + 6,  y: r.top + 4 };
  }
}

/** Lay out the SVG, the 4 reference crosshairs around the character, and the
 *  leader paths. When `drawn` is false the paths start fully dashed-out so they
 *  can animate in; when true they stay drawn (used on resize while active). */
function _layoutLeaders(drawn) {
  const w = window.innerWidth, h = window.innerHeight;
  _svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

  const cx = w / 2, cy = h * 0.46;
  const dx = Math.min(w * 0.075, 92);
  const dy = Math.min(h * 0.135, 150);
  const targets = {
    tl: { x: cx - dx, y: cy - dy }, tr: { x: cx + dx, y: cy - dy },
    bl: { x: cx - dx, y: cy + dy }, br: { x: cx + dx, y: cy + dy },
  };

  // Measure the blocks at their RESTING position. Their hidden state carries a
  // translate/scale transform that getBoundingClientRect would otherwise include,
  // so neutralise it for the measurement and restore it before the next paint.
  _blockEls.forEach(el => { el.style.transform = 'none'; });
  void _wrap.offsetWidth; // force reflow so the measurement sees transform:none

  CARDS.forEach((c, i) => {
    const a = _blockAnchor(c.pos, _blockEls[i].getBoundingClientRect());
    const t = targets[c.pos];
    // Stop the arrow a touch short of the crosshair circle.
    const ang = Math.atan2(t.y - a.y, t.x - a.x);
    const ex  = t.x - Math.cos(ang) * 13;
    const ey  = t.y - Math.sin(ang) * 13;

    const path = _pathEls[i];
    path.setAttribute('d', `M${a.x},${a.y} L${ex},${ey}`);
    const len = path.getTotalLength();
    path.style.transition    = 'none';
    path.style.strokeDasharray  = `${len}`;
    path.style.strokeDashoffset = drawn ? '0' : `${len}`;

    _markEls[i].setAttribute('transform', `translate(${t.x},${t.y})`);
  });

  // Restore the class-driven transform (hidden offset, or none when visible).
  _blockEls.forEach(el => { el.style.transform = ''; });
}

function _drawLeadersIn() {
  _pathEls.forEach((path, i) => {
    _staggerIds.push(setTimeout(() => {
      path.style.transition    = 'stroke-dashoffset 0.9s ease, stroke 0.4s ease';
      path.style.strokeDashoffset = '0';
      _markEls[i].classList.add('hiw-mark-vis');
    }, 120 + i * 150));
  });
}

// ── Typewriter ────────────────────────────────────────────────────────────────
function _type(el, text, speed = 34) {
  el.textContent = '';
  let i = 0;
  const id = setInterval(() => {
    el.textContent = text.slice(0, ++i);
    if (i % 2 === 0) audio.playTypewriterClick?.();
    if (i >= text.length) clearInterval(id);
  }, speed);
  _typeIds.push(id);
}

// ── Active-callout cycling ────────────────────────────────────────────────────
function _setActive(idx) {
  _blockEls.forEach((el, i) => {
    el.classList.toggle('hiw-active',   i === idx);
    el.classList.toggle('hiw-expanded', i === idx);
  });
  _pathEls.forEach((p,  i) => p.classList.toggle('hiw-lead-active', i === idx));
  _markEls.forEach((m,  i) => m.classList.toggle('hiw-mark-active', i === idx));
  _activeIdx = idx;
  if (idx >= 0) audio.playTimelineNode?.();
}

// One forward pass: each card expands for a `_stepMs` window (collapsing the
// previous), then the sequence ends with everything collapsed. No looping.
function _tick(ts) {
  if (!_cycleStart) _cycleStart = ts;
  const elapsed = ts - _cycleStart;
  const total   = _stepMs * CARDS.length;

  _railFill.style.width = `${Math.min(elapsed / total, 1) * 100}%`;

  if (elapsed >= total) {
    _setActive(-1);     // collapse the last card; sequence complete
    _rafId = null;
    return;
  }
  const idx = Math.min(Math.floor(elapsed / _stepMs), CARDS.length - 1);
  if (idx !== _activeIdx) _setActive(idx);
  _rafId = requestAnimationFrame(_tick);
}

// ── Resize ────────────────────────────────────────────────────────────────────
function _onResize() {
  if (_showing) _layoutLeaders(true);
}
window.addEventListener('resize', _onResize);

// ── Public API ────────────────────────────────────────────────────────────────
// Intro + outro reserved out of the slide window so the last card finishes
// collapsing just before the slide auto-advances.
const INTRO_MS = 1500;
const OUTRO_MS = 800;

export function showHowIWorkOverlay(durationMs = CYCLE_MS * CARDS.length + INTRO_MS + OUTRO_MS) {
  _clearTimers();
  _showing    = true;
  _cycleStart = null;
  _activeIdx  = -1;

  // Fit the 4 expand windows into the slide's remaining time.
  _stepMs = Math.max(1800, (durationMs - INTRO_MS - OUTRO_MS) / CARDS.length);

  _wrap.style.display   = '';
  _rail.style.opacity   = '0';
  _railFill.style.width = '0%';

  // Reset visuals (all cards collapsed)
  _blockEls.forEach(el => el.classList.remove('hiw-visible', 'hiw-active', 'hiw-expanded'));
  _pathEls.forEach(p => p.classList.remove('hiw-lead-active'));
  _markEls.forEach(m => m.classList.remove('hiw-mark-vis', 'hiw-mark-active'));
  _titleEls.forEach(t => (t.textContent = ''));

  // Position leader lines now (blocks already have their CSS-fixed positions).
  _layoutLeaders(false);

  // Stagger the collapsed callouts in, typewrite each title as it lands.
  CARDS.forEach((c, i) => {
    _staggerIds.push(setTimeout(() => {
      _blockEls[i].classList.add('hiw-visible');
      _type(_titleEls[i], c.title);
    }, 220 + i * STAGGER_MS));
  });

  // Leader lines draw after the blocks are placed.
  _staggerIds.push(setTimeout(_drawLeadersIn, 260));

  // Rail + sequential expand/collapse pass once everything has settled.
  _staggerIds.push(setTimeout(() => { _rail.style.opacity = '1'; }, INTRO_MS - 100));
  _staggerIds.push(setTimeout(() => { _rafId = requestAnimationFrame(_tick); }, INTRO_MS));
}

export function hideHowIWorkOverlay() {
  _showing = false;
  _clearTimers();

  _blockEls.forEach(el => el.classList.remove('hiw-visible', 'hiw-active', 'hiw-expanded'));
  _pathEls.forEach(p => p.classList.remove('hiw-lead-active'));
  _markEls.forEach(m => m.classList.remove('hiw-mark-vis', 'hiw-mark-active'));
  _rail.style.opacity   = '0';
  _railFill.style.width = '0%';

  setTimeout(() => { if (!_showing) _wrap.style.display = 'none'; }, 600);
}

function _clearTimers() {
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  _staggerIds.forEach(clearTimeout); _staggerIds = [];
  _typeIds.forEach(clearInterval);   _typeIds = [];
  _cycleStart = null;
}
