/**
 * how-i-work-view.js — "Developer Philosophy Hub" treatment of the How I Work
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
import { audio } from '../../../audio.js';
import { camera } from '../../../scene.js';
import { modelGroup } from '../../../character/model.js';
import { isMobile } from '../../../constants.js';
import { CARDS, TRAITS, buildStatementHTML, buildBuiltOnHTML, buildCalloutHTML } from './mindset.templates.js';
import './how-i-work.css';

const CYCLE_MS   = 2600;
const STAGGER_MS = 170;

const NODE_GAP    = 44;   // px the connector terminus is pushed outside the avatar
const AVATAR_HALF = 70;   // px approx half-width of the avatar's projected band
const PACKET_MS   = 3000; // data-packet travel period

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
_statement.innerHTML = buildStatementHTML();
_wrap.appendChild(_statement);

// BUILT ON panel
const _builton = document.createElement('div');
_builton.id = '_hiw-builton';
_builton.innerHTML = buildBuiltOnHTML();
_wrap.appendChild(_builton);

// Callout blocks
const _blockEls = CARDS.map((c) => {
  const el = document.createElement('div');
  el.className = `_hiw-blk _hiw-blk-${c.pos}`;
  el.innerHTML = buildCalloutHTML(c);
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
    if (i % 2 === 0 && !isMobile()) audio.playTypewriterClick?.();
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
  if (idx >= 0 && !isMobile()) audio.playTimelineNode?.();
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
