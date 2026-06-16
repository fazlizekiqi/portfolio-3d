/**
 * cta-hud.js — Sci-fi "command center" overlay for the "Let's Connect" slide.
 *
 * A left-side glass HUD panel (headline + 3 contact cards + status line), a
 * top-right resume button, three floating "data panel" callouts near the
 * character, and light background decoration (radar rings, drifting
 * particles). Each HUD panel has a short leader line that points toward the
 * radar's second ring (a stand-in for "the character's general area")
 * and stops there — never reaching all the way to the character itself.
 * The line's start point, length and angle are computed once from real DOM
 * geometry (panel rect → radar center) in `_layout()`, called on show/resize
 * only — there's no per-frame tracking or animation.
 *
 * Public API
 * ──────────
 *   showCtaHud()
 *   hideCtaHud()
 */

const _base = import.meta.env.BASE_URL.replace(/\/$/, '');

const CONTACTS = [
  { hex: 'in',         label: 'LinkedIn', detail: 'linkedin.com/in/fazli-zekiqi', href: 'https://linkedin.com/in/fazli-zekiqi', external: true },
  { hex: '&lt;/&gt;',  label: 'GitHub',   detail: 'github.com/fazlizekiqi',       href: 'https://github.com/fazlizekiqi',       external: true },
  { hex: '&#9993;',    label: 'Email',    detail: 'fazlizekiqi1@hotmail.com',     href: 'mailto:fazlizekiqi1@hotmail.com',      external: false },
];

const HUD_PANELS = [
  { pos: 'avail', title: 'AVAILABLE FOR', body: 'Freelance<br>Full-time<br>Collaborations', blink: true },
  { pos: 'based', title: 'BASED IN',      body: '\u{1F310} Earth',                          blink: false },
  { pos: 'focus', title: 'FOCUS AREAS',   body: 'Software Engineering<br>Backend Systems<br>Kafka &amp; Distributed Systems<br>Cloud Architecture', blink: false },
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
   back in via pointer-events:auto, so the decorative radar/particle layers
   never swallow clicks meant for the contact cards. */
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

/* ── Leader lines: point from each HUD panel toward the radar's second
   ring — never all the way to the character. Geometry is computed once in
   _layout() from real bounding rects; no per-frame work, no animation. ── */
._cta2-stub-line {
  position: absolute;
  top: 0; left: 0;
  height: 1px;
  background: linear-gradient(90deg, rgba(0,210,255,0.60), rgba(0,200,255,0.12));
  transform-origin: left center;
  pointer-events: none;
}
._cta2-stub-dot {
  position: absolute;
  top: 0; left: 0;
  width: 8px; height: 8px;
  border: 1px solid rgba(0,215,255,0.70);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
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
._cta2-h-mobile { display: none; }
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

/* ── Mobile: compact bottom dock — 3 icon-only contact buttons arched
   above a short one-line message, docked above the nav bar so the
   character stays fully visible above it ── */
@media (max-width: 767px) {
  #_cta2-resume { top: 12px; right: 12px; font-size: 9px; padding: 6px 12px; }

  #_cta2-panel {
    top: auto; bottom: 70px; left: 50%;
    transform: translateX(-50%) translateY(16px);
    width: auto; max-height: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 14px 20px;
    border-radius: 16px;
  }
  #_cta2-wrap.cta2-visible #_cta2-panel { transform: translateX(-50%) translateY(0); }

  ._cta2-corner, ._cta2-scanline { display: none; }

  ._cta2-headline {
    order: 2;
    margin-bottom: 0;
    text-align: center;
  }
  ._cta2-h1, ._cta2-br, ._cta2-h2, ._cta2-sub, ._cta2-status { display: none; }
  ._cta2-h-mobile {
    display: block;
    font-size: 13px;
    letter-spacing: .05em;
    color: #d9f8ff;
    text-shadow: 0 0 14px rgba(0,210,255,0.5);
  }

  ._cta2-cards {
    order: 1;
    flex-direction: row;
    align-items: flex-end;
    gap: 20px;
  }
  ._cta2-card {
    min-height: 0;
    width: 48px; height: 48px;
    padding: 0;
    border-radius: 50%;
    justify-content: center;
  }
  /* Arch: the middle button (GitHub) sits slightly higher than the two sides. */
  ._cta2-card:nth-child(2) { transform: translateY(-14px); }
  ._cta2-card-text, ._cta2-card-arrow { display: none; }
  ._cta2-hex { width: 100%; height: 100%; font-size: 15px; }

  ._cta2-hud, #_cta2-radar, #_cta2-particles, ._cta2-stub-line, ._cta2-stub-dot { display: none; }
}
`;
document.head.appendChild(_style);

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
_panel.innerHTML = `
  <span class="_cta2-corner _cta2-corner-tl"></span>
  <span class="_cta2-corner _cta2-corner-br"></span>
  <div class="_cta2-scanline"></div>
  <div class="_cta2-headline">
    <span class="_cta2-h1">Let's build something</span><br class="_cta2-br"><span class="_cta2-h2">amazing together.</span>
    <span class="_cta2-h-mobile">Let's connect</span>
  </div>
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

// Floating HUD panels + their leader-line elements (geometry filled in by _layout()).
const _hudEls  = [];
const _stubEls = [];
HUD_PANELS.forEach(p => {
  const el = document.createElement('div');
  el.className = `_cta2-hud _cta2-hud-${p.pos}`;
  el.innerHTML = `
    <div class="_cta2-hud-title">${p.blink ? '<span class="_cta2-hud-blink"></span>' : ''}${p.title}</div>
    <div class="_cta2-hud-body">${p.body}</div>`;
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
