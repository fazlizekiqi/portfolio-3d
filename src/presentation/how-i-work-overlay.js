/**
 * how-i-work-overlay.js — "Developer Philosophy Hub" treatment of the How I Work
 * slide.
 *
 * The avatar is the embodiment of an engineering operating system. Around it:
 *  - 4 corner principle cards (Design First / Clean Code / Observe / Collaborate)
 *    each carrying its illustration and a title that typewrites in. The cards
 *    cycle one-at-a-time (expand → collapse).
 *  - Segmented HUD "data pathways" route from each card, bend at a glowing
 *    junction node, and terminate just outside the avatar — with animated data
 *    packets flowing toward the avatar (the principles feeding the developer).
 *  - A centre "Core Directive" statement anchored above the avatar's head:
 *    MY APPROACH · "Purposeful. Practical. People-first." · a supporting line,
 *    framed by angular HUD brackets.
 *  - A "BUILT ON" glassmorphism panel below the avatar listing 4 character
 *    traits (Curiosity / Discipline / Empathy / Consistency).
 *
 * The avatar moves on screen (the slide's camera pulls back + tilts down), so
 * the statement, the panel and the connector endpoints are re-anchored every
 * frame by projecting the avatar's world position to screen (`tickHowIWorkOverlay`).
 *
 * Desktop — full hub. Mobile — connectors hidden, compact statement, 2×2 BUILT ON.
 *
 * Public API:
 *   showHowIWorkOverlay(durationMs)
 *   hideHowIWorkOverlay()
 *   tickHowIWorkOverlay(delta)        // called every frame from tickPresentation
 */

import * as THREE from 'three';
import { audio } from '../audio.js';
import { camera } from '../scene.js';
import { modelGroup } from '../character/model.js';

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

// ── Character traits (BUILT ON panel) ───────────────────────────────────────
const TRAITS = [
  { title: 'Curiosity',   meaning: 'Always exploring better solutions.',
    icon: '<circle cx="9" cy="9" r="6"/><line x1="13.5" y1="13.5" x2="19" y2="19"/>' },
  { title: 'Discipline',  meaning: 'Consistent engineering practices.',
    icon: '<circle cx="11" cy="11" r="8"/><circle cx="11" cy="11" r="4"/><circle cx="11" cy="11" r="0.6" fill="currentColor"/>' },
  { title: 'Empathy',     meaning: 'Understanding users and teammates.',
    icon: '<path d="M11 18.5C11 18.5 3 13.5 3 8.2 3 5.6 5 4 7.1 4 8.8 4 10.2 5 11 6.3 11.8 5 13.2 4 14.9 4 17 4 19 5.6 19 8.2 19 13.5 11 18.5 11 18.5Z"/>' },
  { title: 'Consistency', meaning: 'Reliable delivery over time.',
    icon: '<path d="M3 11C3 8.8 4.8 7 7 7 9.2 7 10.5 8.6 11 10 11.5 11.4 12.8 13 15 13 17.2 13 19 11.2 19 9 19 6.8 17.2 5 15 5"/><path d="M19 11C19 13.2 17.2 15 15 15 12.8 15 11.5 13.4 11 12 10.5 10.6 9.2 9 7 9 4.8 9 3 10.8 3 13 3 15.2 4.8 17 7 17"/>' },
];

const FONT       = `'Share Tech Mono','Courier New',monospace`;
const CYCLE_MS   = 2600;
const STAGGER_MS = 170;

const NODE_GAP    = 44;   // px the connector terminus is pushed outside the avatar
const AVATAR_HALF = 70;   // px approx half-width of the avatar's projected band
const PACKET_MS   = 3000; // data-packet travel period

// ── Styles ──────────────────────────────────────────────────────────────────
const _style = document.createElement('style');
_style.textContent = `
#_hiw-wrap {
  position: fixed;
  inset: 0;
  z-index: 21;
  pointer-events: none;
  font-family: ${FONT};
}

/* ── Connector SVG layer ───────────────────────────────────────────────────── */
#_hiw-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
._hiw-conn {
  fill: none;
  stroke: rgba(0,180,235,0.45);
  stroke-width: 1.3;
  stroke-linejoin: round;
  transition: stroke 0.4s ease, stroke-width 0.4s ease;
}
._hiw-conn.hiw-conn-active {
  stroke: rgba(0,235,255,0.95);
  stroke-width: 1.8;
  filter: drop-shadow(0 0 4px rgba(0,220,255,0.7));
}
._hiw-node {
  fill: rgba(0,225,255,0.9);
  filter: drop-shadow(0 0 5px rgba(0,210,255,0.8));
}
._hiw-packet {
  fill: #9af6ff;
  filter: drop-shadow(0 0 6px rgba(0,235,255,0.95));
}
._hiw-reticle circle { fill: none; stroke: rgba(0,210,255,0.65); stroke-width: 1; }
._hiw-reticle line   { stroke: rgba(0,210,255,0.65); stroke-width: 1; }
._hiw-reticle-spin   { animation: _hiw-reticle-spin 6s linear infinite; }
@keyframes _hiw-reticle-spin { to { transform: rotate(360deg); } }

/* ── Centre philosophy statement (Core Directive) ──────────────────────────── */
#_hiw-statement {
  position: absolute;
  left: 0; top: 0;
  transform: translate(-50%, -100%);
  text-align: center;
  white-space: normal;
  opacity: 0;
  transition: opacity 0.6s ease;
  padding: 0 26px;
  width: max-content;
  max-width: 640px;
  box-sizing: border-box;
}
#_hiw-wrap.hiw-anchor-visible #_hiw-statement { opacity: 1; }
._hiw-stmt-label {
  font-size: 10px;
  letter-spacing: .42em;
  color: rgba(0,210,255,0.80);
  margin-bottom: 8px;
  text-shadow: 0 0 10px rgba(0,210,255,0.5);
}
._hiw-stmt-main {
  font-size: clamp(18px, 2.6vw, 44px);
  font-weight: 700;
  letter-spacing: .06em;
  color: #00d2ff;
  text-shadow: 0 0 24px rgba(0,210,255,0.6), 0 0 4px rgba(0,230,255,0.8);
  line-height: 1.15;
  white-space: normal;
}
._hiw-stmt-sub {
  font-size: clamp(11px, 1vw, 14px);
  letter-spacing: .04em;
  color: rgba(255,255,255,0.7);
  margin-top: 9px;
}
/* angular HUD brackets framing the statement */
._hiw-bracket {
  position: absolute;
  top: 50%;
  width: 16px; height: 64px;
  transform: translateY(-50%);
  animation: _hiw-bracket-pulse 2.4s ease-in-out infinite;
}
._hiw-bracket-l {
  left: 0;
  border-left: 2px solid rgba(0,215,255,0.75);
  border-top: 2px solid rgba(0,215,255,0.75);
  border-bottom: 2px solid rgba(0,215,255,0.75);
  box-shadow: -4px 0 10px rgba(0,200,255,0.25);
}
._hiw-bracket-r {
  right: 0;
  border-right: 2px solid rgba(0,215,255,0.75);
  border-top: 2px solid rgba(0,215,255,0.75);
  border-bottom: 2px solid rgba(0,215,255,0.75);
  box-shadow: 4px 0 10px rgba(0,200,255,0.25);
}
@keyframes _hiw-bracket-pulse { 0%,100% { opacity: .55; } 50% { opacity: 1; } }

/* ── BUILT ON glassmorphism panel ──────────────────────────────────────────── */
#_hiw-builton {
  position: absolute;
  left: 50%; bottom: 96px; top: auto;
  width: clamp(500px, 46vw, 600px);
  box-sizing: border-box;
  padding: 14px 22px 16px;
  background: rgba(2,9,22,0.82);
  border: 1px solid rgba(0,200,255,0.34);
  border-radius: 6px;
  backdrop-filter: blur(10px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 30px rgba(0,160,255,0.12);
  opacity: 0;
  transition: opacity 0.6s ease;
  /* anchored clear above the bottom nav bar — not avatar-tracked, so it never
     overlaps the Explore/Present buttons regardless of the camera move */
  animation: _hiw-bo-float 5s ease-in-out infinite;
}
#_hiw-wrap.hiw-anchor-visible #_hiw-builton { opacity: 1; }
@keyframes _hiw-bo-float {
  0%,100% { transform: translate(-50%, 0); }
  50%     { transform: translate(-50%, -6px); }
}
._hiw-bo-header {
  text-align: center;
  font-size: 10px;
  letter-spacing: .34em;
  color: rgba(0,210,255,0.85);
  text-shadow: 0 0 10px rgba(0,210,255,0.5);
  margin-bottom: 12px;
}
._hiw-bo-cols { display: flex; gap: 10px; }
._hiw-bo-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 5px;
}
._hiw-bo-icon {
  width: 26px; height: 26px;
  color: #7df3ff;
  filter: drop-shadow(0 0 6px rgba(0,220,255,0.55));
}
._hiw-bo-icon svg { width: 100%; height: 100%; display: block; }
._hiw-bo-title {
  font-size: 12px;
  letter-spacing: .10em;
  color: #eaf8ff;
}
._hiw-bo-meaning {
  font-size: 8.5px;
  letter-spacing: .02em;
  line-height: 1.45;
  color: rgba(160,210,230,0.70);
}

/* ── Callout blocks ─────────────────────────────────────────────────────────── */
._hiw-blk {
  position: absolute;
  width: clamp(200px, 22vw, 420px);
  background: rgba(2,9,24,0.86);
  border: 1px solid rgba(0,150,200,0.30);
  border-radius: 4px;
  padding: clamp(11px, 1.1vw, 20px) clamp(13px, 1.3vw, 24px);
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
  max-height: clamp(220px, 46vh, 560px);
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
  height: clamp(56px, 5vw, 90px);
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
  font-size: clamp(13px, 1.1vw, 18px);
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
@media (max-width: 767px) {
  /* The 4 principle cards and all their connector decorations are removed on
     mobile — the slide reduces to the centre statement + BUILT ON panel. */
  ._hiw-blk,
  ._hiw-conn, ._hiw-node, ._hiw-packet, ._hiw-reticle, ._hiw-bracket {
    display: none;
  }
  #_hiw-rail { display: none; }

  #_hiw-statement { white-space: normal; padding: 0; width: 64vw; max-width: 64vw; }
  ._hiw-stmt-main { font-size: 16px; letter-spacing: .04em; }
  ._hiw-stmt-sub  { display: none; }
  ._hiw-stmt-label { font-size: 8px; letter-spacing: .3em; margin-bottom: 4px; }

  #_hiw-builton {
    width: min(92vw, 420px);
    padding: 10px 12px 12px;
    bottom: 84px;          /* lifted well clear of the bottom nav bar */
  }
  ._hiw-bo-cols { flex-wrap: wrap; }
  ._hiw-bo-col  { flex: 0 0 46%; }
  ._hiw-bo-meaning { font-size: 7.5px; }
}
`;
document.head.appendChild(_style);

// ── DOM ─────────────────────────────────────────────────────────────────────
const _wrap = document.createElement('div');
_wrap.id = '_hiw-wrap';
_wrap.style.display = 'none';

// Connector SVG layer
const SVGNS = 'http://www.w3.org/2000/svg';
const _svg  = document.createElementNS(SVGNS, 'svg');
_svg.id = '_hiw-svg';
_svg.setAttribute('preserveAspectRatio', 'none');
_wrap.appendChild(_svg);

// Per-card connector pieces: path (route) + node (elbow) + reticle (terminus) + packet
const _conns = CARDS.map(() => {
  const path = document.createElementNS(SVGNS, 'path');
  path.setAttribute('class', '_hiw-conn');
  _svg.appendChild(path);

  const node = document.createElementNS(SVGNS, 'circle');
  node.setAttribute('class', '_hiw-node');
  node.setAttribute('r', '2.6');
  _svg.appendChild(node);

  // reticle: outer <g> we translate, inner <g> spins via CSS
  const reticle = document.createElementNS(SVGNS, 'g');
  reticle.setAttribute('class', '_hiw-reticle');
  const spin = document.createElementNS(SVGNS, 'g');
  spin.setAttribute('class', '_hiw-reticle-spin');
  spin.innerHTML = `
    <circle r="7"></circle>
    <line x1="-10" y1="0" x2="-4" y2="0"></line>
    <line x1="4"  y1="0" x2="10" y2="0"></line>
    <line x1="0" y1="-10" x2="0" y2="-4"></line>
    <line x1="0" y1="4"  x2="0" y2="10"></line>`;
  reticle.appendChild(spin);
  _svg.appendChild(reticle);

  const packet = document.createElementNS(SVGNS, 'circle');
  packet.setAttribute('class', '_hiw-packet');
  packet.setAttribute('r', '3');
  _svg.appendChild(packet);

  return { path, node, reticle, packet, len: 0, d: '' };
});

// Centre philosophy statement
const _statement = document.createElement('div');
_statement.id = '_hiw-statement';
_statement.innerHTML = `
  <span class="_hiw-bracket _hiw-bracket-l"></span>
  <span class="_hiw-bracket _hiw-bracket-r"></span>
  <div class="_hiw-stmt-label">MY APPROACH</div>
  <div class="_hiw-stmt-main">Purposeful. Practical. People-first.</div>
  <div class="_hiw-stmt-sub">Building software that solves real problems and creates meaningful impact.</div>`;
_wrap.appendChild(_statement);

// BUILT ON panel
const _builton = document.createElement('div');
_builton.id = '_hiw-builton';
_builton.innerHTML = `
  <div class="_hiw-bo-header">BUILT ON</div>
  <div class="_hiw-bo-cols">
    ${TRAITS.map(t => `
      <div class="_hiw-bo-col">
        <span class="_hiw-bo-icon"><svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">${t.icon}</svg></span>
        <span class="_hiw-bo-title">${t.title}</span>
        <span class="_hiw-bo-meaning">${t.meaning}</span>
      </div>`).join('')}
  </div>`;
_wrap.appendChild(_builton);

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
let _rafId       = null;
let _staggerIds  = [];
let _typeIds     = [];
let _activeIdx   = -1;
let _cycleStart  = null;
let _showing     = false;
let _stepMs      = CYCLE_MS;   // per-card expand window, set from slide duration
let _packetClock = 0;         // accumulates delta for packet progress

const _v = new THREE.Vector3();  // scratch — avoid per-frame allocation

// ── Projection helper ─────────────────────────────────────────────────────────
function _worldToScreen(v, w, h) {
  v.project(camera);
  return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, behind: v.z > 1 };
}

// ── Connector geometry ────────────────────────────────────────────────────────
// All connectors start at the horizontal midpoint of the card's bottom edge,
// regardless of which corner the card lives in.
function _blockAnchor(r) {
  return { x: r.left + r.width / 2, y: r.bottom };
}

/** Orthogonal "Manhattan" route from a card's inner corner to a terminus just
 *  outside the avatar. Routes vertically (along the card's inner edge) down to
 *  the terminus height, then horizontally into the avatar — keeping the run at
 *  chest height, clear of the centre statement and the BUILT ON panel.
 *  Returns { d, elbow:{x,y}, end:{x,y} }. */
function _buildConnectorPath(a, end) {
  const elbow = { x: a.x, y: end.y };
  const d = `M${a.x.toFixed(1)},${a.y.toFixed(1)} L${elbow.x.toFixed(1)},${elbow.y.toFixed(1)} L${end.x.toFixed(1)},${end.y.toFixed(1)}`;
  return { d, elbow, end };
}

// ── Per-frame anchoring ────────────────────────────────────────────────────────
export function tickHowIWorkOverlay(delta) {
  if (!_showing || !modelGroup) return;

  const w = window.innerWidth, h = window.innerHeight;
  const mobile = w <= 767;
  const baseY = modelGroup.position.y;

  // Project head / chest / feet world points (capture x/y before reusing _v).
  const head  = _worldToScreen(_v.copy(modelGroup.position).setY(baseY + 1.7), w, h);
  const headX = head.x, headY = head.y;
  const chest = _worldToScreen(_v.copy(modelGroup.position).setY(baseY + 0.95), w, h);
  const chestX = chest.x, chestY = chest.y;

  // Statement — ~120px above the head, clamped within a top band.
  const topMargin = mobile ? 80 : 150;
  let sx = Math.min(Math.max(headX, w * 0.5 - 200), w * 0.5 + 200);
  let sy = Math.min(Math.max(headY - 120, topMargin), h * 0.42);
  _statement.style.left = `${sx}px`;
  _statement.style.top  = `${sy}px`;

  // BUILT ON is anchored above the bottom nav bar via CSS (not avatar-tracked).

  if (mobile) {
    _statement.style.maxWidth = '';
    return; // connectors + width clamp both need the (desktop-only) card rects
  }

  // Connectors — re-route each card toward a terminus just outside the avatar.
  const endYMin = topMargin + 40;
  const endYMax = h - 200;
  _packetClock += delta;
  const progress = (_packetClock % (PACKET_MS / 1000)) / (PACKET_MS / 1000);

  const rects = _blockEls.map(el => el.getBoundingClientRect());

  // Keep the statement from overflowing into the side cards by capping its
  // width to the gap between the top-left and top-right card edges.
  const avail = Math.max(220, rects[1].left - rects[0].right - 40);
  _statement.style.maxWidth = `${Math.min(avail, 640)}px`;

  CARDS.forEach((c, i) => {
    const conn = _conns[i];
    const left = c.pos === 'tl' || c.pos === 'bl';
    const a = _blockAnchor(rects[i]);

    // Terminus: avatar chest, pushed outward to the card's side, clamped vertically.
    const endX = chestX + (left ? -(AVATAR_HALF + NODE_GAP) : (AVATAR_HALF + NODE_GAP));
    const endY = Math.min(Math.max(chestY, endYMin), endYMax);
    const { d, elbow, end } = _buildConnectorPath(a, { x: endX, y: endY });

    if (d !== conn.d) {
      conn.path.setAttribute('d', d);
      conn.d   = d;
      conn.len = conn.path.getTotalLength();
    }
    conn.node.setAttribute('cx', elbow.x.toFixed(1));
    conn.node.setAttribute('cy', elbow.y.toFixed(1));
    conn.reticle.setAttribute('transform', `translate(${end.x.toFixed(1)},${end.y.toFixed(1)})`);

    if (conn.len > 0) {
      const p = conn.path.getPointAtLength(progress * conn.len);
      conn.packet.setAttribute('cx', p.x.toFixed(1));
      conn.packet.setAttribute('cy', p.y.toFixed(1));
    }
  });
}

// ── Static layout (SVG viewBox; routing happens per-frame in the tick) ─────────
function _layoutStatic() {
  const w = window.innerWidth, h = window.innerHeight;
  _svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
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
  _conns.forEach((conn, i) => conn.path.classList.toggle('hiw-conn-active', i === idx));
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
  if (_showing) _layoutStatic();
}
window.addEventListener('resize', _onResize);

// ── Public API ────────────────────────────────────────────────────────────────
// Intro + outro reserved out of the slide window so the last card finishes
// collapsing just before the slide auto-advances.
const INTRO_MS = 1500;
const OUTRO_MS = 800;

export function showHowIWorkOverlay(durationMs = CYCLE_MS * CARDS.length + INTRO_MS + OUTRO_MS) {
  _clearTimers();
  _showing     = true;
  _cycleStart  = null;
  _activeIdx   = -1;
  _packetClock = 0;

  // Fit the 4 expand windows into the slide's remaining time.
  _stepMs = Math.max(1800, (durationMs - INTRO_MS - OUTRO_MS) / CARDS.length);

  _wrap.style.display   = '';
  _wrap.classList.remove('hiw-anchor-visible');
  _rail.style.opacity   = '0';
  _railFill.style.width = '0%';

  // Reset visuals (all cards collapsed)
  _blockEls.forEach(el => el.classList.remove('hiw-visible', 'hiw-active', 'hiw-expanded'));
  _conns.forEach(conn => conn.path.classList.remove('hiw-conn-active'));
  _titleEls.forEach(t => (t.textContent = ''));

  // Static layout, then anchor everything to the avatar on this first frame so
  // nothing paints at (0,0) before the render loop's tick takes over.
  _layoutStatic();
  tickHowIWorkOverlay(0);

  // Stagger the collapsed callouts in, typewrite each title as it lands.
  CARDS.forEach((c, i) => {
    _staggerIds.push(setTimeout(() => {
      _blockEls[i].classList.add('hiw-visible');
      _type(_titleEls[i], c.title);
    }, 220 + i * STAGGER_MS));
  });

  // Statement, panel + connectors fade in once the blocks are placed.
  _staggerIds.push(setTimeout(() => { _wrap.classList.add('hiw-anchor-visible'); }, 260));

  // Rail + sequential expand/collapse pass once everything has settled.
  _staggerIds.push(setTimeout(() => { _rail.style.opacity = '1'; }, INTRO_MS - 100));
  _staggerIds.push(setTimeout(() => { _rafId = requestAnimationFrame(_tick); }, INTRO_MS));
}

export function hideHowIWorkOverlay() {
  _showing = false;
  _clearTimers();

  _wrap.classList.remove('hiw-anchor-visible');
  _blockEls.forEach(el => el.classList.remove('hiw-visible', 'hiw-active', 'hiw-expanded'));
  _conns.forEach(conn => conn.path.classList.remove('hiw-conn-active'));
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
