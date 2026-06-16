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

// Inline-SVG glyphs (viewBox 0 0 24 24, stroke=currentColor) — used on mobile only;
// desktop keeps the text `hex` glyph so its appearance is unchanged.
const ICON_LINKEDIN = '<path d="M4.5 9.5H7.5V19H4.5z"/><circle cx="6" cy="6" r="1.6"/><path d="M10.5 19V9.5H13.3V11C13.8 10 14.9 9.2 16.4 9.2C18.8 9.2 19.8 10.8 19.8 13.4V19H17V13.9C17 12.5 16.5 11.6 15.3 11.6C14.3 11.6 13.8 12.3 13.5 13C13.4 13.3 13.3 13.6 13.3 14V19z" fill="currentColor" stroke="none"/>';
const ICON_GITHUB   = '<path d="M9 19c-4 1.2-4-2-5.5-2.5M14.5 21v-3.1c0-.9-.3-1.5-.7-1.9 2.4-.3 4.9-1.2 4.9-5.3 0-1.2-.4-2.1-1.1-2.9.1-.3.5-1.4-.1-2.9 0 0-.9-.3-3 .1.8-.3-1.8-.4-2.7 0-2.1-.4-3-.1-3-.1-.6 1.5-.2 2.6-.1 2.9-.7.8-1.1 1.7-1.1 2.9 0 4.1 2.5 5 4.9 5.3-.3.3-.6.8-.7 1.5-.6.3-2.1.7-3-.9 0 0-.5-1-1.5-1.1 0 0-1 0-.1.6 0 0 .7.3 1.1 1.4 0 0 .6 2 3.6 1.3V21"/>';
const ICON_EMAIL    = '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7L12 13L20.5 7"/>';
const ICON_X        = '<path d="M4 4L20 20M20 4L4 20" stroke-width="2"/>';
const ICON_DISCORD  = '<path d="M8 7.5C9.5 7 10.7 7 12 7s2.5 0 4 .5c1.6 2 2.4 4.4 2.5 7.2-1.2 1-2.5 1.6-3.7 1.8l-.8-1.3M8 7.5C6.4 7.5 5.6 9.9 5.5 12.7c1.2 1 2.5 1.6 3.7 1.8l.8-1.3M8 7.5 7.4 6M16 7.5 16.6 6"/><circle cx="9.5" cy="12.5" r="1"/><circle cx="14.5" cy="12.5" r="1"/>';
const ICON_CODE     = '<path d="M8.5 8L4.5 12L8.5 16M15.5 8L19.5 12L15.5 16M13.5 6L10.5 18"/>';

const CONTACTS = [
  { hex: 'in',         icon: ICON_LINKEDIN, label: 'LinkedIn', detail: 'linkedin.com/in/fazli-zekiqi', href: 'https://linkedin.com/in/fazli-zekiqi', external: true },
  { hex: '&lt;/&gt;',  icon: ICON_GITHUB,   label: 'GitHub',   detail: 'github.com/fazlizekiqi',       href: 'https://github.com/fazlizekiqi',       external: true },
  { hex: '&#9993;',    icon: ICON_EMAIL,    label: 'Email',    detail: 'fazlizekiqi1@hotmail.com',     href: 'mailto:fazlizekiqi1@hotmail.com',      external: false },
];

// Decorative floating icons framing the character on mobile (not links).
const FLOAT_ICONS = [
  { icon: ICON_LINKEDIN, cls: 'fl-1' },
  { icon: ICON_GITHUB,   cls: 'fl-2' },
  { icon: ICON_EMAIL,    cls: 'fl-3' },
  { icon: ICON_X,        cls: 'fl-4' },
  { icon: ICON_DISCORD,  cls: 'fl-5' },
  { icon: ICON_CODE,     cls: 'fl-6' },
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

/* ── Mobile-only elements: hidden on desktop so the desktop layout is
   byte-for-byte unchanged ── */
._cta2-svg, ._cta2-sub-mobile, ._cta2-card-scan { display: none; }
#_cta2-floats { position: absolute; inset: 0; pointer-events: none; }
._cta2-float { display: none; }

/* ── Mobile: floating holographic icons frame the character, and the command
   panel becomes a premium "control panel" contact card docked at the bottom ── */
@media (max-width: 767px) {
  /* ── Floating holographic icon cards (decorative) ── */
  ._cta2-float {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 54px; height: 54px;
    box-sizing: border-box;
    border-radius: 16px;
    color: #4fd9ff;
    background: linear-gradient(155deg, rgba(4,16,34,0.62), rgba(2,10,24,0.40));
    border: 1.5px solid rgba(0,200,255,0.42);
    backdrop-filter: blur(8px);
    box-shadow:
      0 0 22px rgba(0,180,255,0.22),
      0 8px 24px rgba(0,0,0,0.45),
      inset 0 0 16px rgba(0,170,255,0.14);
    overflow: hidden;
    opacity: 0;
    animation:
      _cta2-fl-in 0.6s ease forwards,
      _cta2-fl-float 5.5s ease-in-out infinite,
      _cta2-fl-tilt 9s ease-in-out infinite,
      _cta2-fl-glow 3.4s ease-in-out infinite,
      _cta2-fl-flicker 7s steps(1) infinite;
    transition: scale 0.2s ease;
  }
  ._cta2-float svg { width: 24px; height: 24px; filter: drop-shadow(0 0 5px rgba(0,210,255,0.6)); }
  ._cta2-float::after {  /* subtle scan-line */
    content: '';
    position: absolute;
    left: 0; right: 0; height: 14px; top: -14px;
    background: linear-gradient(to bottom, transparent, rgba(0,225,255,0.16), transparent);
    animation: _cta2-fl-scan 3.6s linear infinite;
    pointer-events: none;
  }
  ._cta2-float:hover { scale: 1.08; }

  /* tiny drifting particles around each icon */
  ._cta2-float-dot {
    position: absolute;
    width: 2px; height: 2px;
    border-radius: 50%;
    background: rgba(120,235,255,0.9);
    box-shadow: 0 0 5px rgba(0,220,255,0.85);
    animation: _cta2-fl-dot 4.5s ease-in-out infinite;
  }
  ._cta2-float-dot-a { left: 14%; top: 70%; animation-delay: 0s;   }
  ._cta2-float-dot-b { left: 78%; top: 30%; animation-delay: 1.4s; }
  ._cta2-float-dot-c { left: 60%; top: 82%; animation-delay: 2.7s; }

  /* placement — frame the centred mobile character (upper/mid band), ~80px out */
  .fl-1 { top: 21%;  left: 5%;  transform: rotateY(-8deg); animation-delay: 0s,   0s,   0s,   0s,   0s;   }
  .fl-2 { top: 47%;  left: 4%;  transform: rotateY(6deg);  animation-delay: 0.1s, 0.8s, 1.1s, 0.5s, 1.2s; }
  .fl-3 { top: 35%;  right: 5%; transform: rotateY(8deg);  animation-delay: 0.2s, 1.6s, 0.4s, 1.0s, 2.3s; }
  .fl-4 { top: 15%;  right: 8%; transform: rotateY(7deg);  animation-delay: 0.3s, 2.2s, 1.8s, 1.5s, 3.1s; }
  .fl-5 { top: 52%;  right: 6%; transform: rotateY(5deg);  animation-delay: 0.4s, 0.5s, 2.4s, 2.0s, 0.7s; }
  .fl-6 { top: 9%;   left: 13%; transform: rotateY(-6deg); animation-delay: 0.5s, 1.2s, 0.9s, 2.5s, 1.9s; }

  @keyframes _cta2-fl-in    { to { opacity: 1; } }
  @keyframes _cta2-fl-float { 0%,100% { translate: 0 0; } 50% { translate: 0 -11px; } }
  @keyframes _cta2-fl-tilt  { 0%,100% { rotate: y -6deg; } 50% { rotate: y 8deg; } }
  @keyframes _cta2-fl-glow  {
    0%,100% { box-shadow: 0 0 18px rgba(0,180,255,0.18), 0 8px 24px rgba(0,0,0,0.45), inset 0 0 14px rgba(0,170,255,0.12); }
    50%     { box-shadow: 0 0 30px rgba(0,210,255,0.40), 0 8px 24px rgba(0,0,0,0.45), inset 0 0 20px rgba(0,200,255,0.22); }
  }
  @keyframes _cta2-fl-flicker { 0%,96%,100% { opacity: 1; } 97% { opacity: 0.55; } 98.5% { opacity: 0.9; } }
  @keyframes _cta2-fl-scan  { 0% { top: -14px; } 100% { top: 100%; } }
  @keyframes _cta2-fl-dot   { 0%,100% { transform: translate(0,0); opacity: 0.2; } 50% { transform: translate(4px,-7px); opacity: 1; } }

  #_cta2-resume { top: 12px; right: 12px; font-size: 9px; padding: 6px 12px; }

  /* ── Premium contact-card hub, docked at the bottom ── */
  #_cta2-panel {
    top: auto; bottom: 56px; left: 50%;
    transform: translateX(-50%) translateY(18px);
    width: 88vw; max-width: 360px; max-height: none;
    min-height: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 14px 13px;
    border-radius: 22px;
    background: rgba(2,9,22,0.78);
    border: 1px solid rgba(0,200,255,0.34);
    box-shadow:
      0 0 34px rgba(0,170,255,0.22),
      0 16px 48px rgba(0,0,0,0.6),
      inset 0 0 26px rgba(0,150,255,0.08);
    backdrop-filter: blur(12px);
    overflow: hidden;
  }
  #_cta2-wrap.cta2-visible #_cta2-panel { transform: translateX(-50%) translateY(0); }

  ._cta2-corner, ._cta2-scanline { display: none; }

  /* faint scan-line sweeping the card for the "control panel" feel */
  ._cta2-card-scan {
    display: block;
    position: absolute;
    left: 0; right: 0; top: 0; height: 40px;
    background: linear-gradient(to bottom, transparent, rgba(0,210,255,0.10), transparent);
    animation: _cta2-scan 5s linear infinite;
    pointer-events: none;
  }

  ._cta2-headline { order: 1; margin-bottom: 0; text-align: center; }
  ._cta2-h1, ._cta2-br, ._cta2-h2, ._cta2-sub, ._cta2-status { display: none; }
  ._cta2-h-mobile {
    display: block;
    font-size: 17px;
    letter-spacing: .04em;
    color: #eaf8ff;
    text-shadow: 0 0 18px rgba(0,210,255,0.6);
  }
  ._cta2-sub-mobile {
    display: block;
    order: 2;
    text-align: center;
    max-width: 88%;
    margin: -1px auto 1px;
    font-size: 9.5px;
    line-height: 1.45;
    letter-spacing: .02em;
    color: rgba(190,225,240,0.72);
  }

  ._cta2-cards {
    order: 3;
    flex-direction: row;
    justify-content: center;
    align-items: flex-start;
    gap: 16px;
    width: 100%;
  }
  /* each card = a circular button with a label below */
  ._cta2-card {
    flex: 0 0 auto;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-height: 0;
    width: auto; padding: 0;
    background: none;
    border: none;
    overflow: visible;
  }
  ._cta2-card:hover { background: none; box-shadow: none; transform: none; }
  ._cta2-hex { display: none; }
  ._cta2-svg {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 54px; height: 54px;
    border-radius: 50%;
    color: #7df3ff;
    background: rgba(3,14,30,0.55);
    border: 1.5px solid rgba(0,205,255,0.50);
    box-shadow:
      0 0 16px rgba(0,180,255,0.26),
      inset 0 0 12px rgba(0,170,255,0.16);
    transition: scale 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  }
  ._cta2-svg svg { width: 25px; height: 25px; filter: drop-shadow(0 0 5px rgba(0,210,255,0.55)); }
  ._cta2-card:hover ._cta2-svg,
  ._cta2-card:active ._cta2-svg {
    scale: 1.12;
    border-color: rgba(0,230,255,0.9);
    box-shadow:
      0 0 30px rgba(0,210,255,0.55),
      inset 0 0 22px rgba(0,200,255,0.28);
  }
  ._cta2-card-text { display: flex; }
  ._cta2-card-label {
    font-size: 8px;
    letter-spacing: .18em;
    text-transform: uppercase;
    color: rgba(0,215,255,0.85);
    text-shadow: 0 0 9px rgba(0,200,255,0.4);
  }
  ._cta2-card-detail, ._cta2-card-arrow { display: none; }

  ._cta2-hud, #_cta2-radar, #_cta2-particles, ._cta2-stub-line, ._cta2-stub-dot { display: none; }
}

/* very small phones — keep the hub and buttons within the viewport */
@media (max-width: 380px) {
  ._cta2-svg { width: 48px; height: 48px; }
  ._cta2-svg svg { width: 22px; height: 22px; }
  ._cta2-cards { gap: 12px; }
  ._cta2-h-mobile { font-size: 15px; }
  ._cta2-float { width: 46px; height: 46px; border-radius: 14px; }
  ._cta2-float svg { width: 20px; height: 20px; }
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

// Decorative floating holographic icons framing the character (mobile only).
const _floatLayer = document.createElement('div');
_floatLayer.id = '_cta2-floats';
FLOAT_ICONS.forEach(f => {
  const el = document.createElement('div');
  el.className = `_cta2-float ${f.cls}`;
  el.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${f.icon}</svg>
    <span class="_cta2-float-dot _cta2-float-dot-a"></span>
    <span class="_cta2-float-dot _cta2-float-dot-b"></span>
    <span class="_cta2-float-dot _cta2-float-dot-c"></span>`;
  _floatLayer.appendChild(el);
});
_wrap.appendChild(_floatLayer);

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
    <span class="_cta2-h-mobile">Let's Connect</span>
  </div>
  <div class="_cta2-sub">I'm always open to new opportunities, collaborations, and interesting projects.</div>
  <div class="_cta2-sub-mobile">Open to opportunities, freelance projects and collaborations.</div>
  <div class="_cta2-card-scan"></div>
  <div class="_cta2-cards">
    ${CONTACTS.map(c => `
      <a class="_cta2-card" href="${c.href}" ${c.external ? 'target="_blank" rel="noopener"' : ''}>
        <span class="_cta2-hex">${c.hex}</span>
        <span class="_cta2-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${c.icon}</svg></span>
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
