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

// Floating HUD panels (sensor stubs are CSS ::before/::after, no JS geometry).
HUD_PANELS.forEach(p => {
  const el = document.createElement('div');
  el.className = `_cta2-hud _cta2-hud-${p.pos}`;
  el.innerHTML = buildHudPanelHTML(p);
  _wrap.appendChild(el);
});

document.body.appendChild(_wrap);

// ── Layout ────────────────────────────────────────────────────────────────
function _layout() {
  const w = window.innerWidth, h = window.innerHeight;
  _radar.setAttribute('viewBox', `0 0 ${w} ${h}`);

  // Radar: faint concentric circles + crosshair, fixed near the character's area.
  const rcx = w * 0.64, rcy = h * 0.48;
  _radar.innerHTML = [3, 6, 9].map(n =>
    `<circle class="_cta2-radar-ring" cx="${rcx}" cy="${rcy}" r="${n * Math.min(w, h) * 0.04}"></circle>`
  ).join('') +
    `<line class="_cta2-radar-cross" x1="${rcx - 60}" y1="${rcy}" x2="${rcx + 60}" y2="${rcy}"></line>
     <line class="_cta2-radar-cross" x1="${rcx}" y1="${rcy - 60}" x2="${rcx}" y2="${rcy + 60}"></line>`;
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
