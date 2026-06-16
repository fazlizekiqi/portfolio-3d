/**
 * cta-hud.js — Sci-fi "command center" overlay for the "Let's Connect" slide.
 *
 * A left-side glass HUD panel (headline + 3 contact cards + status line), a
 * top-right resume button, three floating "data panel" callouts connected to
 * the character by animated SVG leader lines (same technique as
 * how-i-work-overlay.js: stroke-dasharray draw-in + crosshair reference marks
 * + a traveling pulse dot), and light background decoration (radar rings,
 * drifting particles). The leader-line targets and radar crosshair are
 * projected live from the character's 3D world position every frame (via
 * tickCtaHud), so they stay locked on regardless of camera drift or resize —
 * only the HUD panels themselves are CSS-positioned at fixed screen anchors.
 *
 * Public API
 * ──────────
 *   showCtaHud()
 *   hideCtaHud()
 *   tickCtaHud(delta)
 */

import * as THREE from 'three';
import { camera } from '../scene.js';
import { modelGroup } from '../character/model.js';
import { isMobile } from '../constants.js';

const _base = import.meta.env.BASE_URL.replace(/\/$/, '');

// Approximate chest height of the character — no head/chest bone reference
// exists, so we offset from the root position (matches the camY/targetY
// convention used by the about/experience anchor-camera slides).
const ANCHOR_Y_OFFSET = 1.3;
const _anchorWorld = new THREE.Vector3();

const CONTACTS = [
  { hex: 'in',  label: 'LinkedIn', detail: 'linkedin.com/in/fazli-zekiqi', href: 'https://linkedin.com/in/fazli-zekiqi', external: true },
  { hex: '</>', label: 'GitHub',   detail: 'github.com/fazlizekiqi',       href: 'https://github.com/fazlizekiqi',       external: true },
  { hex: '@',   label: 'Email',    detail: 'fazlizekiqi1@hotmail.com',     href: 'mailto:fazlizekiqi1@hotmail.com',      external: false },
];

// Floating HUD data panels: pos = CSS placement class, anchor = fixed
// screen-space target point (fraction of viewport) near the character.
const HUD_PANELS = [
  { pos: 'avail', title: 'AVAILABLE FOR', body: 'Freelance<br>Full-time<br>Collaborations', blink: true,  anchor: { x: 0.60, y: 0.30 } },
  { pos: 'based', title: 'BASED IN',      body: '\u{1F310} Earth',                          blink: false, anchor: { x: 0.58, y: 0.80 } },
  { pos: 'focus', title: 'FOCUS AREAS',   body: 'Software Engineering<br>Backend Systems<br>Kafka &amp; Distributed Systems<br>Cloud Architecture', blink: false, anchor: { x: 0.76, y: 0.46 } },
];

const FONT = `'Share Tech Mono','Courier New',monospace`;

// ── Styles ────────────────────────────────────────────────────────────────
const _style = document.createElement('style');
_style.textContent = `
#_cta2-wrap {
  position: fixed;
  inset: 0;
  z-index: 19;
  pointer-events: none;
  font-family: ${FONT};
  opacity: 0;
  transition: opacity 0.5s ease;
}
/* Wrapper itself stays click-through; only the panel + resume button below opt
   back in via pointer-events:auto, so the decorative full-screen SVG/radar/
   particle layers never swallow clicks meant for the contact cards. */
#_cta2-wrap.cta2-visible { opacity: 1; }

/* ── Resume button ─────────────────────────────────────────────────────── */
#_cta2-resume {
  position: absolute;
  top: 18px; right: 20px;
  pointer-events: auto;
  font-size: 10px;
  letter-spacing: .18em;
  color: rgba(0,210,255,0.80);
  background: rgba(0,12,30,0.65);
  border: 1px solid rgba(0,190,230,0.45);
  padding: 8px 16px;
  text-decoration: none;
  backdrop-filter: blur(6px);
  transition: color .15s, border-color .15s, background .15s, box-shadow .15s;
}
#_cta2-resume:hover {
  color: #d9f8ff;
  border-color: rgba(0,220,255,0.85);
  background: rgba(0,24,55,0.92);
  box-shadow: 0 0 16px rgba(0,180,255,0.30);
}

/* ── Background decoration ─────────────────────────────────────────────── */
#_cta2-radar {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  opacity: 0.35;
}
._cta2-radar-ring { fill: none; stroke: rgba(0,150,200,0.18); stroke-width: 1; }
._cta2-radar-cross { stroke: rgba(0,150,200,0.14); stroke-width: 1; }

#_cta2-particles { position: absolute; inset: 0; overflow: hidden; }
._cta2-dot {
  position: absolute;
  width: 3px; height: 3px;
  border-radius: 50%;
  background: rgba(0,210,255,0.55);
  box-shadow: 0 0 6px rgba(0,200,255,0.6);
  animation: _cta2-drift linear infinite;
}
@keyframes _cta2-drift {
  0%   { transform: translateY(0) translateX(0); opacity: 0; }
  10%  { opacity: 0.8; }
  90%  { opacity: 0.8; }
  100% { transform: translateY(-90px) translateX(14px); opacity: 0; }
}

/* ── Left command panel ────────────────────────────────────────────────── */
#_cta2-panel {
  position: absolute;
  top: 50%; left: 4%;
  transform: translateY(-50%) translateX(-24px);
  width: min(38vw, 480px);
  max-height: 78vh;
  box-sizing: border-box;
  padding: clamp(22px, 3vw, 36px) clamp(20px, 2.6vw, 32px);
  background: rgba(2,9,22,0.72);
  border: 1px solid rgba(0,200,255,0.34);
  backdrop-filter: blur(10px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.55), 0 0 30px rgba(0,160,255,0.10);
  pointer-events: auto;
  opacity: 0;
  transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.22,0.61,0.36,1);
}
#_cta2-wrap.cta2-visible #_cta2-panel { opacity: 1; transform: translateY(-50%) translateX(0); }

._cta2-corner { position: absolute; width: 14px; height: 14px; pointer-events: none; }
._cta2-corner-tl { top: -1px; left: -1px; border-top: 1.5px solid rgba(0,220,255,0.75); border-left: 1.5px solid rgba(0,220,255,0.75); }
._cta2-corner-br { bottom: -1px; right: -1px; border-bottom: 1.5px solid rgba(0,220,255,0.75); border-right: 1.5px solid rgba(0,220,255,0.75); }

._cta2-scanline {
  position: absolute;
  left: 0; right: 0;
  height: 2px;
  top: 0;
  background: linear-gradient(90deg, transparent, rgba(0,225,255,0.55), transparent);
  animation: _cta2-scan 5s linear infinite;
  pointer-events: none;
}
@keyframes _cta2-scan { 0% { top: 0%; } 100% { top: 100%; } }

._cta2-headline {
  font-size: clamp(24px, 3vw, 38px);
  line-height: 1.25;
  letter-spacing: .03em;
  color: #d9f8ff;
  text-shadow: 0 0 26px rgba(0,210,255,0.55);
  margin-bottom: 14px;
}
._cta2-sub {
  font-size: 12.5px;
  line-height: 1.7;
  letter-spacing: .03em;
  color: rgba(255,255,255,0.68);
  margin-bottom: 22px;
}

._cta2-cards { display: flex; flex-direction: column; gap: 10px; }
._cta2-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 64px;
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(0,18,38,0.55);
  border: 1px solid rgba(0,190,230,0.32);
  text-decoration: none;
  overflow: hidden;
  transition: background .2s ease, border-color .2s ease, box-shadow .2s ease, transform .2s ease;
}
._cta2-card:hover {
  background: rgba(0,30,58,0.80);
  border-color: rgba(0,225,255,0.80);
  box-shadow: 0 0 22px rgba(0,190,255,0.30);
  transform: translateX(2px) scale(1.012);
}
._cta2-hex {
  flex-shrink: 0;
  width: 38px; height: 38px;
  display: flex; align-items: center; justify-content: center;
  clip-path: polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%);
  background: rgba(0,40,70,0.65);
  border: 1px solid rgba(0,220,255,0.55);
  color: #9af6ff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  animation: _cta2-hex-pulse 2.6s ease-in-out infinite;
}
@keyframes _cta2-hex-pulse {
  0%, 100% { box-shadow: 0 0 6px rgba(0,210,255,0.35); }
  50%      { box-shadow: 0 0 16px rgba(0,230,255,0.70); }
}
._cta2-card-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
._cta2-card-label { font-size: 13px; letter-spacing: .08em; color: #eaf8ff; }
._cta2-card-detail { font-size: 10px; letter-spacing: .04em; color: rgba(150,205,225,0.65); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
._cta2-card-arrow {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 14px;
  color: rgba(0,210,255,0.55);
  transform: translateX(-6px);
  opacity: 0;
  transition: transform .2s ease, opacity .2s ease;
}
._cta2-card:hover ._cta2-card-arrow { transform: translateX(0); opacity: 1; }

._cta2-status {
  margin-top: 18px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  letter-spacing: .06em;
  color: rgba(150,205,225,0.55);
}
._cta2-status-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #00e5a0;
  box-shadow: 0 0 8px rgba(0,230,160,0.8);
  animation: _cta2-pulse-dot 1.8s ease-in-out infinite;
}
@keyframes _cta2-pulse-dot { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }

/* ── Floating HUD data panels ──────────────────────────────────────────── */
._cta2-hud {
  position: absolute;
  width: clamp(150px, 14vw, 220px);
  padding: 10px 14px;
  background: rgba(2,9,22,0.80);
  border: 1px solid rgba(0,180,230,0.40);
  border-radius: 3px;
  backdrop-filter: blur(6px);
  opacity: 0;
  transform: scale(0.92);
  transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.22,0.61,0.36,1);
}
#_cta2-wrap.cta2-visible ._cta2-hud { opacity: 1; transform: scale(1); }
._cta2-hud-avail { top: 14%; left: 56%; }
._cta2-hud-based { bottom: 12%; left: 54%; }
._cta2-hud-focus { top: 38%; right: 5%; }

._cta2-hud-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 9.5px; letter-spacing: .14em;
  color: #7df3ff;
  text-shadow: 0 0 10px rgba(0,220,255,0.5);
  margin-bottom: 6px;
}
._cta2-hud-blink {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #00e5a0;
  box-shadow: 0 0 6px rgba(0,230,160,0.8);
  animation: _cta2-pulse-dot 1.4s ease-in-out infinite;
  flex-shrink: 0;
}
._cta2-hud-body { font-size: 10.5px; line-height: 1.6; color: rgba(200,230,245,0.75); }

/* ── Leader-line / connector SVG layer ─────────────────────────────────── */
#_cta2-svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
._cta2-leader { fill: none; stroke: rgba(0,200,255,0.45); stroke-width: 1.1; }
._cta2-mark circle { fill: none; stroke: rgba(0,210,255,0.55); stroke-width: 1; }
._cta2-mark line   { stroke: rgba(0,210,255,0.45); stroke-width: 1; }
._cta2-pulse { fill: #7df3ff; filter: drop-shadow(0 0 4px rgba(0,220,255,0.9)); }

/* ── Mobile: compact bottom dock — short headline + icon-only contact row,
   docked above the nav bar so the character stays fully visible above it ── */
@media (max-width: 767px) {
  #_cta2-resume { top: 12px; right: 12px; font-size: 9px; padding: 6px 12px; }

  #_cta2-panel {
    top: auto; bottom: 54px; left: 50%;
    transform: translateX(-50%) translateY(16px);
    width: 92vw; max-height: none;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-radius: 10px;
  }
  #_cta2-wrap.cta2-visible #_cta2-panel { transform: translateX(-50%) translateY(0); }

  ._cta2-corner, ._cta2-scanline { display: none; }

  ._cta2-headline {
    flex: 1;
    font-size: 12px;
    line-height: 1.3;
    margin-bottom: 0;
    /* Collapse to the first line only — "amazing together." is dropped on mobile. */
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  ._cta2-headline br { display: none; }
  ._cta2-sub, ._cta2-status { display: none; }

  ._cta2-cards { flex-direction: row; gap: 8px; }
  ._cta2-card {
    min-height: 0;
    width: 42px; height: 42px;
    padding: 0;
    border-radius: 50%;
    justify-content: center;
  }
  ._cta2-card-text, ._cta2-card-arrow { display: none; }
  ._cta2-hex { width: 100%; height: 100%; }

  ._cta2-hud, #_cta2-svg, #_cta2-radar, #_cta2-particles { display: none; }
}
`;
document.head.appendChild(_style);

// ── DOM ───────────────────────────────────────────────────────────────────
const SVGNS = 'http://www.w3.org/2000/svg';

const _wrap = document.createElement('div');
_wrap.id = '_cta2-wrap';

// Background radar rings (decorative, locked to the character's projected position)
const _radar = document.createElementNS(SVGNS, 'svg');
_radar.id = '_cta2-radar';
_radar.setAttribute('preserveAspectRatio', 'none');
const _radarRings = [3, 6, 9].map(n => {
  const c = document.createElementNS(SVGNS, 'circle');
  c.setAttribute('class', '_cta2-radar-ring');
  c.dataset.scale = n;
  _radar.appendChild(c);
  return c;
});
const _radarCrossH = document.createElementNS(SVGNS, 'line');
const _radarCrossV = document.createElementNS(SVGNS, 'line');
_radarCrossH.setAttribute('class', '_cta2-radar-cross');
_radarCrossV.setAttribute('class', '_cta2-radar-cross');
_radar.appendChild(_radarCrossH);
_radar.appendChild(_radarCrossV);
_wrap.appendChild(_radar);

// Drifting particles
const _particleLayer = document.createElement('div');
_particleLayer.id = '_cta2-particles';
for (let i = 0; i < 14; i++) {
  const dot = document.createElement('span');
  dot.className = '_cta2-dot';
  dot.style.left            = `${50 + Math.random() * 45}%`;
  dot.style.top             = `${20 + Math.random() * 65}%`;
  dot.style.animationDuration = `${6 + Math.random() * 7}s`;
  dot.style.animationDelay    = `${Math.random() * 6}s`;
  _particleLayer.appendChild(dot);
}
_wrap.appendChild(_particleLayer);

// Resume button
const _resumeBtn = document.createElement('a');
_resumeBtn.id = '_cta2-resume';
_resumeBtn.href = `${_base}/cv.pdf`;
_resumeBtn.download = 'Fazli_Zekiqi_CV.pdf';
_resumeBtn.textContent = '[ RESUME ]';
_wrap.appendChild(_resumeBtn);

// Left command panel
const _panel = document.createElement('div');
_panel.id = '_cta2-panel';
_panel.innerHTML = `
  <span class="_cta2-corner _cta2-corner-tl"></span>
  <span class="_cta2-corner _cta2-corner-br"></span>
  <div class="_cta2-scanline"></div>
  <div class="_cta2-headline">Let's build something<br>amazing together.</div>
  <div class="_cta2-sub">I'm always open to new opportunities, collaborations, and interesting projects.</div>
  <div class="_cta2-cards">
    ${CONTACTS.map(c => `
      <a class="_cta2-card" href="${c.href}" ${c.external ? 'target="_blank" rel="noopener"' : ''}>
        <span class="_cta2-hex">${c.hex}</span>
        <span class="_cta2-card-text">
          <span class="_cta2-card-label">${c.label}</span>
          <span class="_cta2-card-detail">${c.detail}</span>
        </span>
        <span class="_cta2-card-arrow">→</span>
      </a>`).join('')}
  </div>
  <div class="_cta2-status"><span class="_cta2-status-dot"></span>I typically respond within 24 hours</div>
`;
_wrap.appendChild(_panel);

// Floating HUD panels
const _hudEls = HUD_PANELS.map(p => {
  const el = document.createElement('div');
  el.className = `_cta2-hud _cta2-hud-${p.pos}`;
  el.innerHTML = `
    <div class="_cta2-hud-title">${p.blink ? '<span class="_cta2-hud-blink"></span>' : ''}${p.title}</div>
    <div class="_cta2-hud-body">${p.body}</div>`;
  _wrap.appendChild(el);
  return el;
});

// Leader-line / connector SVG
const _svg = document.createElementNS(SVGNS, 'svg');
_svg.id = '_cta2-svg';
_svg.setAttribute('preserveAspectRatio', 'none');
_wrap.appendChild(_svg);

const _pathEls  = [];
const _markEls  = [];
const _pulseEls = [];
HUD_PANELS.forEach(() => {
  const path = document.createElementNS(SVGNS, 'path');
  path.setAttribute('class', '_cta2-leader');
  _svg.appendChild(path);
  _pathEls.push(path);

  const g = document.createElementNS(SVGNS, 'g');
  g.setAttribute('class', '_cta2-mark');
  g.innerHTML = `
    <circle r="6"></circle>
    <line x1="-10" y1="0" x2="-3" y2="0"></line>
    <line x1="3"  y1="0" x2="10" y2="0"></line>
    <line x1="0" y1="-10" x2="0" y2="-3"></line>
    <line x1="0" y1="3"  x2="0" y2="10"></line>`;
  _svg.appendChild(g);
  _markEls.push(g);

  const pulse = document.createElementNS(SVGNS, 'circle');
  pulse.setAttribute('class', '_cta2-pulse');
  pulse.setAttribute('r', '3');
  _svg.appendChild(pulse);
  _pulseEls.push(pulse);
});

document.body.appendChild(_wrap);

// ── Layout ────────────────────────────────────────────────────────────────
function _hudAnchor(el, r) {
  // Connect from the edge of the HUD block closest to its target.
  return { x: r.left < window.innerWidth / 2 ? r.right : r.left, y: r.top + r.height / 2 };
}

/** Projects the character's tracked world point to pixel coords, or null if not ready. */
function _projectCharacterScreenPos() {
  if (!modelGroup) return null;
  _anchorWorld.copy(modelGroup.position);
  _anchorWorld.y += ANCHOR_Y_OFFSET;
  _anchorWorld.project(camera);
  return {
    x: (_anchorWorld.x + 1) / 2 * window.innerWidth,
    y: (1 - _anchorWorld.y) / 2 * window.innerHeight,
  };
}

/** Re-targets the radar crosshair + each leader-line endpoint at `t` (pixel coords). */
function _updateAnchors(t) {
  const minDim = Math.min(window.innerWidth, window.innerHeight);
  _radarRings.forEach(c => {
    c.setAttribute('cx', t.x);
    c.setAttribute('cy', t.y);
    c.setAttribute('r', Number(c.dataset.scale) * minDim * 0.04);
  });
  _radarCrossH.setAttribute('x1', t.x - 60); _radarCrossH.setAttribute('y1', t.y);
  _radarCrossH.setAttribute('x2', t.x + 60); _radarCrossH.setAttribute('y2', t.y);
  _radarCrossV.setAttribute('x1', t.x); _radarCrossV.setAttribute('y1', t.y - 60);
  _radarCrossV.setAttribute('x2', t.x); _radarCrossV.setAttribute('y2', t.y + 60);

  _pathEls.forEach((path, i) => {
    const a = path._a;
    path.setAttribute('d', `M${a.x},${a.y} L${t.x},${t.y}`);
    _markEls[i].setAttribute('transform', `translate(${t.x},${t.y})`);
    path._t = t;
  });
}

function _layout() {
  const w = window.innerWidth, h = window.innerHeight;
  _svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  _radar.setAttribute('viewBox', `0 0 ${w} ${h}`);

  const t = _projectCharacterScreenPos() ?? { x: w * 0.66, y: h * 0.50 };

  HUD_PANELS.forEach((p, i) => {
    const r = _hudEls[i].getBoundingClientRect();
    const a = _hudAnchor(_hudEls[i], r);
    _pathEls[i]._a = a;
  });
  _updateAnchors(t);

  _pathEls.forEach(path => {
    const len = path.getTotalLength();
    path.style.strokeDasharray  = `${len}`;
    path.style.strokeDashoffset = `${len}`;
    path.style.transition = 'none';
    path._len = len;
  });
}

function _drawIn() {
  _pathEls.forEach((path, i) => {
    setTimeout(() => {
      path.style.transition    = 'stroke-dashoffset 0.8s ease';
      path.style.strokeDashoffset = '0';
    }, 200 + i * 160);
  });
}

// ── Traveling data-pulse along each connector ────────────────────────────
let _rafId = null;
function _tickPulse(ts) {
  _rafId = requestAnimationFrame(_tickPulse);
  _pathEls.forEach((path, i) => {
    const len = path._len ?? 0;
    if (!len) return;
    const speed = 0.00035; // fraction of path per ms
    const t = (ts * speed + i * 0.33) % 1;
    const pt = path.getPointAtLength(t * len);
    _pulseEls[i].setAttribute('cx', pt.x);
    _pulseEls[i].setAttribute('cy', pt.y);
  });
}

function _onResize() { if (_showing) _layout(); }
window.addEventListener('resize', _onResize);

let _showing = false;

export function showCtaHud() {
  _showing = true;
  _wrap.classList.add('cta2-visible');
  _layout();
  _drawIn();
  if (!_rafId) _rafId = requestAnimationFrame(_tickPulse);
}

export function hideCtaHud() {
  _showing = false;
  _wrap.classList.remove('cta2-visible');
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
}

/** Per-frame: keep the leader-line targets + radar crosshair locked to the
 *  character as the cta slide's camera drifts. Mobile hides all the elements
 *  this drives, so it's a no-op there. */
export function tickCtaHud() {
  if (!_showing || isMobile()) return;
  const t = _projectCharacterScreenPos();
  if (t) _updateAnchors(t);
}
