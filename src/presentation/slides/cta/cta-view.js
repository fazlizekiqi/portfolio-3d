/**
 * cta-view.js — Sci-fi "command center" overlay for the "Let's Connect" slide.
 *
 * Desktop: a left-side glass HUD panel (headline + 3 contact cards + status
 * line), a top-right resume button, three floating "data panel" callouts near
 * the character, and light background decoration (radar rings, drifting
 * particles). Each HUD panel has a short leader line that points toward the
 * radar's second ring (a stand-in for "the character's general area")
 * and stops there — never reaching all the way to the character itself.
 * The line's start point, length and angle are computed once from real DOM
 * geometry (panel rect → radar center) in `_layout()`, called on show/resize
 * only — there's no per-frame tracking or animation.
 *
 * Mobile: the HUD panels, radar and leader lines are hidden. The command
 * panel collapses to bare text and 3 circular icon buttons (LinkedIn/GitHub/
 * Email) under the title strip, with no card chrome.
 *
 * Public API
 * ──────────
 *   showCtaHud()
 *   hideCtaHud()
 */

import { HUD_PANELS, buildPanelHTML, buildHudPanelHTML } from './cta.templates.js';
import './cta.css';

const _base = import.meta.env.BASE_URL.replace(/\/$/, '');

// ── DOM ───────────────────────────────────────────────────────────────────
const SVGNS = 'http://www.w3.org/2000/svg';

const _wrap = document.createElement('div');
_wrap.id = '_cta2-wrap';

// Background radar rings (purely decorative, fixed near the character's area)
const _radar = document.createElementNS(SVGNS, 'svg');
_radar.id = '_cta2-radar';
_radar.setAttribute('preserveAspectRatio', 'none');
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
_panel.innerHTML = buildPanelHTML();
_wrap.appendChild(_panel);

// Floating HUD panels + their leader-line elements (geometry filled in by _layout()).
const _hudEls  = [];
const _stubEls = [];
HUD_PANELS.forEach(p => {
  const el = document.createElement('div');
  el.className = `_cta2-hud _cta2-hud-${p.pos}`;
  el.innerHTML = buildHudPanelHTML(p);
  _wrap.appendChild(el);
  _hudEls.push(el);

  const line = document.createElement('div');
  line.className = '_cta2-stub-line';
  const dot = document.createElement('div');
  dot.className = '_cta2-stub-dot';
  _wrap.appendChild(line);
  _wrap.appendChild(dot);
  _stubEls.push({ line, dot });
});

document.body.appendChild(_wrap);

// ── Layout ────────────────────────────────────────────────────────────────
function _layout() {
  const w = window.innerWidth, h = window.innerHeight;
  _radar.setAttribute('viewBox', `0 0 ${w} ${h}`);

  // Radar: faint concentric circles + crosshair, fixed near the character's area.
  const rcx = w * 0.64, rcy = h * 0.48;
  const secondRingR = 6 * Math.min(w, h) * 0.04;
  _radar.innerHTML = [3, 6, 9].map(n =>
    `<circle class="_cta2-radar-ring" cx="${rcx}" cy="${rcy}" r="${n * Math.min(w, h) * 0.04}"></circle>`
  ).join('') +
    `<line class="_cta2-radar-cross" x1="${rcx - 60}" y1="${rcy}" x2="${rcx + 60}" y2="${rcy}"></line>
     <line class="_cta2-radar-cross" x1="${rcx}" y1="${rcy - 60}" x2="${rcx}" y2="${rcy + 60}"></line>`;

  // Leader lines: from each HUD panel's edge, aimed at the radar center,
  // stopping at the second ring's radius (so they point toward the
  // character's general area without ever overlapping it).
  if (window.innerWidth > 767) {
    _hudEls.forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const hw = rect.width / 2, hh = rect.height / 2;
      const dx = rcx - cx, dy = rcy - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const angleRad = Math.atan2(dy, dx);
      const cosA = Math.cos(angleRad), sinA = Math.sin(angleRad);

      // Exit point on the panel's own border, along the ray toward the radar center.
      const tx = cosA !== 0 ? hw / Math.abs(cosA) : Infinity;
      const ty = sinA !== 0 ? hh / Math.abs(sinA) : Infinity;
      const t  = Math.min(tx, ty);
      const exitX = cx + t * cosA;
      const exitY = cy + t * sinA;

      const length = Math.max(24, Math.min(260, dist - t - secondRingR));
      const angleDeg = angleRad * 180 / Math.PI;

      const { line, dot } = _stubEls[i];
      line.style.left      = `${exitX}px`;
      line.style.top       = `${exitY}px`;
      line.style.width     = `${length}px`;
      line.style.transform = `rotate(${angleDeg}deg)`;

      dot.style.left = `${exitX + length * cosA}px`;
      dot.style.top  = `${exitY + length * sinA}px`;
    });
  }
}

function _onResize() { if (_showing) _layout(); }
window.addEventListener('resize', _onResize);

let _showing = false;

export function showCtaHud() {
  _showing = true;
  _wrap.classList.add('cta2-visible');
  _layout();
}

export function hideCtaHud() {
  _showing = false;
  _wrap.classList.remove('cta2-visible');
}
