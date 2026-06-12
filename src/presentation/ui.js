/**
 * ui.js — All presentation DOM elements and their visibility helpers.
 */

// ── Slide title strip (top) ───────────────────────────────────────────────────
const card = document.createElement('div');
card.id = '_slide-card';
card.style.cssText = `
  position:fixed;top:0;left:0;right:0;
  z-index:20;pointer-events:none;
  opacity:0;transition:opacity 0.6s ease;`;
card.innerHTML = `
  <div id="_sInner">
    <div id="_sTitle"></div>
    <div id="_sSubtitle"></div>
  </div>`;
document.body.appendChild(card);

const slideTitle    = card.querySelector('#_sTitle');
const slideSubtitle = card.querySelector('#_sSubtitle');

// ── Slide body — centered subtitle ───────────────────────────────────────────
const bodyPanel = document.createElement('div');
bodyPanel.id = '_slide-body-panel';
bodyPanel.style.cssText = `
  position:fixed;bottom:80px;left:0;right:0;
  z-index:20;pointer-events:none;
  display:flex;
  opacity:0;transition:opacity 0.5s ease;`;
bodyPanel.innerHTML = `<div id="_sBodyInner"><div id="_sBody"></div></div>`;
document.body.appendChild(bodyPanel);

const slideBody = bodyPanel.querySelector('#_sBody');

// ── Progress bar ──────────────────────────────────────────────────────────────
export const progressWrap = document.createElement('div');
progressWrap.style.cssText = `
  position:fixed;bottom:0;left:0;right:0;height:2px;
  background:rgba(0,150,200,0.12);display:none;z-index:20;`;
const progressFill = document.createElement('div');
progressFill.style.cssText = `width:0%;height:100%;background:linear-gradient(90deg,#005577,#00aacc);`;
progressWrap.appendChild(progressFill);
document.body.appendChild(progressWrap);

const _style = document.createElement('style');
_style.textContent = `
/* ─── slide title strip (top) ────────────────────────────────────────────── */
#_slide-card {
  font-family:'Share Tech Mono','Courier New',monospace;
}
#_sInner {
  padding: 16px 48px 14px;
  background: linear-gradient(to bottom, rgba(2,8,20,0.80) 0%, rgba(2,8,20,0.50) 70%, transparent 100%);
  backdrop-filter: blur(10px);
}
#_sTitle {
  color: #e8f4ff;
  font-size: 22px;
  letter-spacing: .08em;
  line-height: 1.2;
  text-shadow: 0 0 28px rgba(0,180,255,0.50);
  white-space: nowrap;
}
#_sSubtitle {
  color: rgba(0,200,255,0.75);
  font-size: 12px;
  letter-spacing: .14em;
  margin-top: 4px;
  text-shadow: 0 0 14px rgba(0,180,255,0.45);
  white-space: nowrap;
  min-height: 16px;
}

/* ─── slide body — movie subtitle style ──────────────────────────────────── */
#_slide-body-panel {
  font-family:'Share Tech Mono','Courier New',monospace;
  justify-content: center;
}
#_sBodyInner {
  text-align: center;
  padding: 0 24px;
}
#_sBody {
  display: inline-block;
  color: #c8eaf5;
  font-size: 12px;
  letter-spacing: .10em;
  line-height: 2.1;
  white-space: pre-line;
  text-align: center;
  text-shadow:
    0 0 12px rgba(0,180,255,0.55),
    0 1px 3px rgba(0,0,0,0.98),
    0 2px 14px rgba(0,0,0,0.90);
}

/* ─── mobile ─────────────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  #_slide-body-panel { bottom: 52px; }
  #_sTitle { font-size: 16px; letter-spacing: .06em; }
  #_sSubtitle { font-size: 10px; letter-spacing: .10em; }
  #_sInner { padding: 12px 20px 10px; }
  #_sBody {
    font-size: 10px;
    line-height: 1.75;
    letter-spacing: .05em;
    max-width: 95vw;
    word-break: break-word;
    white-space: pre-line;
  }
}

/* ─── experience slide — panel pinned to left third ─────────────────────── */
#_slide-body-panel.slide-experience {
  justify-content: flex-start;
  align-items: center;
  padding-left: 20%;
  padding-right: 0;
  bottom: 0;
  top: 56px;
}
#_slide-body-panel.slide-experience #_sBodyInner {
  text-align: left;
  width: 38%;
  max-width: 440px;
  margin-left: 0;
  padding: 0;
}
#_slide-body-panel.slide-experience #_sBody {
  display: block;
  text-align: left;
  white-space: normal;
}

/* ── timeline wrap — svg left, cards right ── */
._exp-timeline-wrap {
  display: flex;
  align-items: stretch;
  gap: 16px;
}
._exp-tl-svg {
  flex-shrink: 0;
  width: 26px;
  overflow: visible;
}

/* ── cards column ── */
._exp-cards {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── job block — card style ── */
._exp-block {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 4px;
  background: none;
  border: none;
  border-radius: 0;
  margin-bottom: 0;
  cursor: pointer;
  transition: transform 0.35s ease, opacity 0.35s ease;
  will-change: transform;
}
._exp-block:hover {
  transform: translateX(4px) scale(1.016);
  animation: none;
}
._exp-block.exp-active {
  transform: translateX(2px) scale(1.020);
}
@keyframes _exp-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.85; }
}
@keyframes _exp-pulse {
  0%, 100% { box-shadow: 0 0 22px rgba(0, 180, 255, 0.28); }
  50%       { box-shadow: 0 0 36px rgba(0, 210, 255, 0.48); }
}

._exp-logo {
  width: 50px;
  height: 50px;
  object-fit: contain;
  flex-shrink: 0;
  filter: brightness(1.1) drop-shadow(0 0 6px rgba(0,180,255,0.3));
  transition: filter 0.3s ease;
}
._exp-block:hover ._exp-logo,
._exp-block.exp-active ._exp-logo {
  filter: brightness(1.35) drop-shadow(0 0 10px rgba(0,210,255,0.55));
}
._exp-logo-placeholder {
  width: 50px;
  height: 50px;
  flex-shrink: 0;
}
._exp-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
/* ── Visual hierarchy: Role > Company > Stack ── */
._exp-role {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: .12em;
  color: #eef6ff;
  text-shadow: 0 0 16px rgba(0,190,255,0.55);
  transition: color 0.3s, text-shadow 0.3s;
}
._exp-block.exp-active ._exp-role {
  color: #ffffff;
  text-shadow: 0 0 22px rgba(0, 210, 255, 0.75), 0 0 6px rgba(255,255,255,0.3);
}
._exp-company {
  font-size: 11px;
  letter-spacing: .10em;
  color: #4dcfea;
  text-shadow: 0 0 8px rgba(0,200,255,0.35);
  transition: color 0.3s, text-shadow 0.3s;
}
._exp-block:hover ._exp-company {
  color: #00e5ff;
  text-shadow: 0 0 14px rgba(0,230,255,0.70);
}
._exp-block.exp-active ._exp-company {
  color: #00f0ff;
  text-shadow: 0 0 16px rgba(0,240,255,0.90);
}
._exp-stack {
  font-size: 9.5px;
  letter-spacing: .07em;
  color: rgba(130, 195, 215, 0.55);
  text-shadow: none;
  margin-top: 2px;
  transition: color 0.3s;
}
._exp-block.exp-active ._exp-stack {
  color: rgba(160, 215, 235, 0.72);
}

@media (max-width: 640px) {
  #_slide-body-panel.slide-experience {
    justify-content: flex-start;
    padding-left: 12px;
    top: 50px;
  }
  #_slide-body-panel.slide-experience #_sBodyInner {
    width: 58%;
    max-width: none;
    margin-left: 0;
  }
  ._exp-role    { font-size: 10px; }
  ._exp-company { font-size: 9px; }
  ._exp-stack   { font-size: 8px; }
  ._exp-block   { gap: 10px; padding: 8px 10px; }
  ._exp-logo    { width: 36px; height: 36px; }
  ._exp-tl-svg  { width: 18px; }
}

/* ─── intro terminal boot sequence ──────────────────────────────────────── */
._term-boot {
  font-family: 'Share Tech Mono', 'Courier New', monospace;
  font-size: 12px;
  letter-spacing: .09em;
  color: #c8eaf5;
  text-align: left;
  line-height: 2.15;
  text-shadow: 0 1px 4px rgba(0,0,0,0.95);
}
._tb-row {
  opacity: 0;
  animation: _tb-appear 0.45s ease forwards;
  display: flex;
  align-items: center;
  gap: 7px;
}
@keyframes _tb-appear {
  from { opacity: 0; transform: translateX(-10px); }
  to   { opacity: 1; transform: translateX(0); }
}
._tb-prompt { color: #00e5ff; flex-shrink: 0; }
._tb-key    { color: rgba(0,200,255,0.60); min-width: 88px; }
._tb-val    { color: #eef6ff; text-shadow: 0 0 10px rgba(0,200,255,0.35); }
._tb-bar    { color: #00ccff; text-shadow: 0 0 10px rgba(0,200,255,0.80); letter-spacing: .02em; }
._tb-pct    { color: #00ffaa; font-weight: bold; text-shadow: 0 0 12px rgba(0,255,160,0.65); }
._tb-blink-cursor {
  color: #00e5ff;
  animation: _tb-blink-anim 1s step-end infinite;
  text-shadow: 0 0 8px rgba(0,230,255,0.9);
}
@keyframes _tb-blink-anim { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

/* ─── about stats dashboard ──────────────────────────────────────────────── */
._about-wrap { text-align: center; }
._about-stats-row {
  display: flex;
  justify-content: center;
  gap: 26px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
._ab-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  opacity: 0;
  animation: _ab-pop 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards;
}
._ab-stat:nth-child(1) { animation-delay: 0.30s; }
._ab-stat:nth-child(2) { animation-delay: 0.55s; }
._ab-stat:nth-child(3) { animation-delay: 0.80s; }
._ab-stat:nth-child(4) { animation-delay: 1.05s; }
@keyframes _ab-pop {
  from { opacity: 0; transform: translateY(14px) scale(0.82); }
  to   { opacity: 1; transform: translateY(0)    scale(1);    }
}
._ab-val {
  font-size: 28px;
  font-weight: bold;
  color: #00e5ff;
  text-shadow: 0 0 22px rgba(0,230,255,0.70), 0 0 6px rgba(0,230,255,0.4);
  line-height: 1;
  letter-spacing: .03em;
}
._ab-lbl {
  font-size: 9px;
  color: rgba(0,200,255,0.55);
  letter-spacing: .16em;
}
._ab-divider {
  width: 60%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0,180,255,0.30), transparent);
  margin: 8px auto 12px;
  opacity: 0;
  animation: _ab-pop 0.3s ease forwards;
  animation-delay: 1.25s;
}
._ab-bio {
  font-size: 11px;
  color: #c8eaf5;
  line-height: 2.1;
  letter-spacing: .08em;
  text-shadow: 0 1px 3px rgba(0,0,0,0.98);
  opacity: 0;
  animation: _ab-pop 0.4s ease forwards;
  animation-delay: 1.45s;
}
._ab-tag {
  color: #00ccff;
  text-shadow: 0 0 10px rgba(0,200,255,0.55);
}

/* ─── CTA interactive contact links ─────────────────────────────────────── */
/* (full styles are defined above, in the slide-specific positioning block)  */

@media (max-width: 640px) {
  ._cta-link { min-width: 0; width: 90vw; font-size: 10px; padding: 8px 14px; }
  ._ab-val   { font-size: 22px; }
  ._about-stats-row { gap: 16px; }
  ._term-boot { font-size: 10px; }
}

/* ─── intro slide — terminal pinned bottom-left so character is free ─────── */
#_slide-body-panel.slide-intro {
  justify-content: flex-start;
  align-items: flex-end;
  padding-left: 5%;
}
#_slide-body-panel.slide-intro #_sBodyInner {
  text-align: left;
  max-width: 420px;
  padding: 0;
}
#_slide-body-panel.slide-intro #_sBody {
  text-align: left;
  white-space: normal;
}

/* ─── skills / projects slide — body text bottom-right corner ────────────── */
#_slide-body-panel.slide-skills,
#_slide-body-panel.slide-projects {
  justify-content: flex-end;
  align-items: flex-end;
  padding-right: 5%;
}
#_slide-body-panel.slide-skills #_sBodyInner,
#_slide-body-panel.slide-projects #_sBodyInner {
  text-align: right;
  max-width: 360px;
  padding: 0;
}
#_slide-body-panel.slide-skills #_sBody,
#_slide-body-panel.slide-projects #_sBody {
  text-align: right;
}

/* ─── mindset — body panel hidden (how-i-work overlay carries the content) ── */
#_slide-body-panel.slide-mindset {
  display: none !important;
}

/* ─── about slide — stats panel bottom-right ─────────────────────────────── */
#_slide-body-panel.slide-about {
  justify-content: flex-end;
  align-items: flex-end;
  padding-right: 4%;
}
#_slide-body-panel.slide-about #_sBodyInner {
  text-align: right;
  max-width: 340px;
  padding: 0;
}
#_slide-body-panel.slide-about ._about-wrap { text-align: right; }
#_slide-body-panel.slide-about ._about-stats-row { justify-content: flex-end; }
#_slide-body-panel.slide-about ._ab-bio { text-align: right; }

/* ─── CTA — wider centered panel with proper spacing ────────────────────── */
#_slide-body-panel.slide-cta {
  pointer-events: auto;
  justify-content: center;
  align-items: flex-end;
  padding-bottom: 0;
}
#_slide-body-panel.slide-cta #_sBodyInner {
  text-align: center;
  width: auto;
  padding: 0;
}

/* ─── CTA redesigned links ────────────────────────────────────────────────── */
._cta-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
._cta-link {
  display: grid;
  grid-template-columns: 36px 1fr 24px;
  align-items: center;
  gap: 0;
  color: #c8eaf5;
  text-decoration: none;
  font-family: 'Share Tech Mono', 'Courier New', monospace;
  font-size: 12px;
  letter-spacing: .08em;
  padding: 13px 20px 13px 0;
  border: 1px solid rgba(0,180,255,0.20);
  border-radius: 4px;
  background: linear-gradient(135deg, rgba(0,12,30,0.92) 0%, rgba(0,25,55,0.88) 100%);
  backdrop-filter: blur(12px);
  transition: color .22s, border-color .22s, box-shadow .22s, transform .15s, background .22s;
  width: 340px;
  position: relative;
  overflow: hidden;
  opacity: 0;
  animation: _cta-in 0.55s ease forwards;
  box-shadow: 3px 3px 0 rgba(0,55,90,0.55), 0 0 0 0 rgba(0,200,255,0);
}
._cta-link::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: linear-gradient(to bottom, rgba(0,200,255,0.4), rgba(0,100,200,0.2));
  transition: background .22s;
}
._cta-link::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(0,200,255,0.04) 50%, transparent 100%);
  transform: translateX(-100%);
  transition: transform 0.5s ease;
}
._cta-link:hover::after { transform: translateX(100%); }
._cta-link:nth-child(1) { animation-delay: 0.30s; }
._cta-link:nth-child(2) { animation-delay: 0.52s; }
._cta-link:nth-child(3) { animation-delay: 0.74s; }
._cta-link:hover {
  color: #00e5ff;
  border-color: rgba(0,220,255,0.60);
  background: linear-gradient(135deg, rgba(0,20,50,0.96) 0%, rgba(0,45,90,0.92) 100%);
  box-shadow: 4px 4px 0 rgba(0,70,120,0.75), 0 0 22px rgba(0,180,255,0.22);
  transform: translateY(-2px) translateX(-1px);
}
._cta-link:hover::before {
  background: linear-gradient(to bottom, rgba(0,230,255,0.85), rgba(0,130,255,0.55));
}
._cta-link:active { transform: translateY(1px) translateX(1px); }
._cta-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  flex-shrink: 0;
}
._cta-icon {
  font-size: 15px;
  color: rgba(0,200,255,0.60);
  width: 20px;
  text-align: center;
  transition: color .22s, text-shadow .22s;
}
._cta-link:hover ._cta-icon {
  color: #00e5ff;
  text-shadow: 0 0 12px rgba(0,230,255,0.90);
}
._cta-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
._cta-label {
  font-size: 9px;
  color: rgba(0,190,255,0.45);
  letter-spacing: .18em;
  line-height: 1;
}
._cta-value {
  font-size: 11.5px;
  letter-spacing: .06em;
  color: #c8eaf5;
  transition: color .22s;
  line-height: 1;
}
._cta-link:hover ._cta-value { color: #ffffff; }
._cta-arrow {
  font-size: 13px;
  color: rgba(0,190,255,0.35);
  transition: color .22s, transform .22s;
  text-align: right;
  padding-right: 4px;
}
._cta-link:hover ._cta-arrow {
  color: rgba(0,230,255,0.75);
  transform: translateX(3px);
}
._cta-tagline {
  margin-top: 8px;
  font-family: 'Share Tech Mono', 'Courier New', monospace;
  font-size: 10px;
  color: rgba(0,200,255,0.40);
  letter-spacing: .14em;
  text-align: center;
  opacity: 0;
  animation: _cta-in 0.4s ease forwards;
  animation-delay: 1.0s;
  text-shadow: 0 0 12px rgba(0,180,255,0.25);
}
@keyframes _cta-in {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}

@media (max-width: 640px) {
  ._cta-link { width: 88vw; font-size: 10px; }
  ._cta-value { font-size: 10px; }
  ._ab-val   { font-size: 22px; }
  ._about-stats-row { gap: 16px; }
  ._term-boot { font-size: 10px; }
  #_slide-body-panel.slide-intro { padding-left: 3%; }
  #_slide-body-panel.slide-skills,
  #_slide-body-panel.slide-projects { padding-right: 3%; }
  #_slide-body-panel.slide-about { padding-right: 3%; }
}

/* ─── bottom bar ─────────────────────────────────────────────────────────── */
#_ui-bar {
  position:fixed;
  bottom:28px;
  left:50%;
  transform:translateX(-50%);
  z-index:20;
  display:flex;
  align-items:center;
  gap:10px;
  font-family:'Share Tech Mono','Courier New',monospace;
}
@media (max-width: 640px) {
  #_ui-bar {
    bottom: 10px;
    gap: 5px;
  }
  ._lb {
    padding: 6px 12px;
    font-size: 8px;
    letter-spacing: .14em;
    gap: 5px;
  }
  ._lb._lb-arrow {
    padding: 6px 10px;
    font-size: 11px;
  }
  ._lb-dot {
    width: 4px;
    height: 4px;
  }
  ._back-cap {
    padding: 5px 12px;
    font-size: 8px;
    letter-spacing: .10em;
  }
}

/* ─── loader-style button (PRESENT / EXPLORE / EXIT / →) ─────────────────── */
._lb {
  position:relative;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:7px;
  padding:9px 22px;
  background:rgba(2,8,18,0.88);
  border:1.5px solid rgba(0,150,200,0.45);
  border-radius:3px;
  box-shadow:3px 3px 0 rgba(0,80,120,0.70), 0 0 14px rgba(0,100,180,0.15);
  color:#2299bb;
  font-family:inherit;
  font-size:10px;
  letter-spacing:.22em;
  cursor:pointer;
  outline:none;
  backdrop-filter:blur(10px);
  transition:color .15s, border-color .15s, box-shadow .12s, background .12s, transform .08s;
  white-space:nowrap;
  overflow:hidden;
}
._lb::before {
  content:'';
  position:absolute;
  inset:-6px;
  border-radius:50%;
  border:1.5px solid transparent;
  border-top-color:rgba(0,170,204,0);
  transition:border-top-color .15s;
}
._lb:hover {
  color:#55eeff;
  border-color:rgba(0,200,255,0.75);
  background:rgba(0,25,50,0.94);
  box-shadow:4px 4px 0 rgba(0,80,120,0.80), 0 0 20px rgba(0,150,220,0.30);
  transform:translate(-1px,-1px);
}
._lb:hover::before {
  border-top-color:rgba(0,200,255,0.55);
  animation:_lb-spin 1.2s linear infinite;
}
._lb:active {
  transform:translate(2px,2px);
  box-shadow:1px 1px 0 rgba(0,80,120,0.70);
}

/* spinning ring on hover */
@keyframes _lb-spin { to { transform:rotate(360deg); } }

/* ── dot indicator left of text ── */
._lb-dot {
  width:5px;height:5px;
  border-radius:50%;
  background:#2299bb;
  flex-shrink:0;
  transition:background .15s, box-shadow .15s;
}
._lb:hover ._lb-dot {
  background:#55eeff;
  box-shadow:0 0 6px rgba(0,220,255,0.8);
}

/* ── EXIT / danger variant ── */
._lb._lb-exit {
  color:#cc4444;
  border-color:rgba(180,60,60,0.55);
  box-shadow:3px 3px 0 rgba(120,30,30,0.70);
}
._lb._lb-exit ._lb-dot { background:#cc4444; }
._lb._lb-exit:hover {
  color:#ff8888;
  border-color:rgba(220,80,80,0.80);
  box-shadow:4px 4px 0 rgba(150,40,40,0.80), 0 0 20px rgba(200,60,60,0.28);
}
._lb._lb-exit:hover ._lb-dot { background:#ff8888; box-shadow:0 0 6px rgba(255,80,80,0.8); }
._lb._lb-exit:hover::before  { border-top-color:rgba(220,80,80,0.55); }

/* ── → next arrow button — slimmer ── */
._lb._lb-arrow {
  padding:9px 16px;
  font-size:13px;
  letter-spacing:0;
}

/* ─── BACK button — identical to WASD key-cap ────────────────────────────── */
._back-cap {
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding:8px 18px;
  border-radius:4px;
  background:#ffffff;
  border:2px solid #111111;
  box-shadow:2px 2px 0 #111111;
  color:#111111;
  font-family:'Share Tech Mono','Courier New',monospace;
  font-size:10px;
  font-weight:600;
  letter-spacing:.14em;
  cursor:pointer;
  outline:none;
  transition:background .07s, box-shadow .07s, transform .07s, color .07s;
  white-space:nowrap;
}
._back-cap:hover {
  background:#c8f5ff;
  color:#003344;
  border-color:#005566;
  box-shadow:3px 3px 0 #005566;
  transform:translate(-1px,-1px);
}
._back-cap:active {
  box-shadow:1px 1px 0 #005566;
  transform:translate(1px,1px);
}
`;
document.head.appendChild(_style);

// ── Bottom bar container ──────────────────────────────────────────────────────
const _bar = document.createElement('div');
_bar.id = '_ui-bar';
document.body.appendChild(_bar);

// ── Helper: create a loader-style button ──────────────────────────────────────
function _mkLb(text, extraClass = '') {
  const btn = document.createElement('button');
  btn.className = `_lb${extraClass ? ' ' + extraClass : ''}`;
  btn.innerHTML = `<span class="_lb-dot"></span><span>${text}</span>`;
  return btn;
}

// ── Buttons ───────────────────────────────────────────────────────────────────
export const backBtn = document.createElement('button');
backBtn.className = '_back-cap';
backBtn.innerHTML = '← BACK';
backBtn.style.display = 'none';
_bar.appendChild(backBtn);

export const exploreBtn = _mkLb('EXPLORE');
exploreBtn.style.display = 'none';
_bar.appendChild(exploreBtn);

export const presentBtn = _mkLb('▶ &nbsp;PRESENT');
presentBtn.style.display = 'none';
_bar.appendChild(presentBtn);

export const prevBtn = _mkLb('←', '_lb-arrow');
prevBtn.style.display = 'none';
_bar.appendChild(prevBtn);


export const nextBtn = _mkLb('→', '_lb-arrow');
nextBtn.style.display = 'none';
_bar.appendChild(nextBtn);

// ── Typewriter ────────────────────────────────────────────────────────────────
let _timerA = null, _timerB = null;

function _typeWrite(el, text, speed, cb) {
  el.textContent = '';
  let i = 0;
  const t = setInterval(() => {
    el.textContent += text[i++];
    if (i >= text.length) { clearInterval(t); if (cb) cb(); }
  }, speed);
  return t;
}

// ── Experience timeline dot animation ─────────────────────────────────────────
let _expRafId = null;

function _stopExperienceTimeline() {
  if (_expRafId) { cancelAnimationFrame(_expRafId); _expRafId = null; }
}

function _startExperienceTimeline() {
  _stopExperienceTimeline();

  // Attach hover listeners to each block
  slideBody.querySelectorAll('._exp-block').forEach((el, i) => {
    el.addEventListener('mouseenter', () => {
      document.dispatchEvent(new CustomEvent('exp-block-hover', { detail: { index: i } }));
    });
  });

  // Wait for stagger animations + layout to settle before measuring
  setTimeout(() => {
    const svg       = slideBody.querySelector('#_exp-tl-svg');
    const dot       = slideBody.querySelector('#_exp-tl-dot');
    const trackLine = slideBody.querySelector('#_exp-tl-line');
    const glowLine  = slideBody.querySelector('#_exp-tl-glow-line');
    const nodes     = Array.from(slideBody.querySelectorAll('._exp-tl-node'));
    const blocks    = Array.from(slideBody.querySelectorAll('._exp-block'));
    if (!svg || !dot || !blocks.length) return;

    const svgRect = svg.getBoundingClientRect();
    const wrapH   = svg.closest('._exp-timeline-wrap').getBoundingClientRect().height;

    // Resize SVG to match actual content height
    svg.setAttribute('height', wrapH);
    svg.setAttribute('viewBox', `0 0 26 ${wrapH}`);
    trackLine.setAttribute('y2', wrapH);

    // Y centre of each block relative to SVG top
    const nodeYs = blocks.map(b => {
      const r = b.getBoundingClientRect();
      return (r.top - svgRect.top) + r.height / 2;
    });

    // Update track line & glow line extents
    trackLine.setAttribute('y1', nodeYs[0]);
    trackLine.setAttribute('y2', nodeYs[nodeYs.length - 1]);
    glowLine.setAttribute('y1', nodeYs[0]);
    glowLine.setAttribute('y2', nodeYs[0]); // starts at top, fills down

    // Place node circles
    nodes.forEach((n, i) => { if (nodeYs[i] != null) n.setAttribute('cy', nodeYs[i]); });

    // Dot travels top (SEB=0) → bottom (Expleo=last) — newest-first ordering
    const startY = nodeYs[0];
    const endY   = nodeYs[nodeYs.length - 1];
    dot.setAttribute('cy', startY);

    const TRAVEL_MS = 3200;
    const PAUSE_MS  = 750;
    const PULSE_MS  = 380;

    let startTime  = null;
    let pauseUntil = 0;
    let activeIdx  = -1;

    function setActive(idx) {
      blocks.forEach((b, i) => b.classList.toggle('exp-active', i === idx));
      // light up node: bright fill for active, dim for others
      nodes.forEach((n, i) => {
        if (i === idx) {
          n.setAttribute('fill', '#00e5ff');
          n.setAttribute('r', '5.5');
          n.setAttribute('stroke', 'rgba(0,230,255,0.8)');
          n.setAttribute('stroke-width', '2');
        } else {
          n.setAttribute('fill', 'rgba(0,120,180,0.6)');
          n.setAttribute('r', '4');
          n.setAttribute('stroke', 'rgba(0,180,255,0.45)');
          n.setAttribute('stroke-width', '1');
        }
      });
    }

    function pulseNode(nodeEl) {
      let t0 = null;
      (function step(ts) {
        if (!t0) t0 = ts;
        const p = Math.min((ts - t0) / PULSE_MS, 1);
        const s = p < 0.5 ? p * 2 : (1 - p) * 2;
        nodeEl.setAttribute('r', 5.5 + s * 5);
        if (p < 1) requestAnimationFrame(step);
        else nodeEl.setAttribute('r', '5.5');
      })(performance.now());
    }

    function tick(ts) {
      _expRafId = requestAnimationFrame(tick);
      if (!startTime) { startTime = ts; return; }
      if (ts < pauseUntil) return;

      const elapsed  = ts - startTime;
      const progress = Math.min(elapsed / TRAVEL_MS, 1);
      // ease-in-out cubic
      const ease = progress < 0.5
        ? 4 * progress ** 3
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const cy = startY + (endY - startY) * ease;
      dot.setAttribute('cy', cy);

      // Advance glow line to current dot position
      glowLine.setAttribute('y2', cy);

      // Check proximity to each node (travel order: 0 → 1 → 2 → ...)
      for (let idx = 0; idx < nodeYs.length; idx++) {
        if (activeIdx !== idx && Math.abs(cy - nodeYs[idx]) < 6) {
          activeIdx  = idx;
          setActive(idx);
          pulseNode(nodes[idx]);
          pauseUntil = ts + PAUSE_MS;
          startTime  = ts + PAUSE_MS - elapsed;
          return;
        }
      }

      if (progress >= 1) {
        // Reset to top and loop
        startTime  = null;
        pauseUntil = ts + 1100;
        activeIdx  = -1;
        dot.setAttribute('cy', startY);
        glowLine.setAttribute('y2', startY);
        setActive(-1);
      }
    }

    // Set first block active immediately
    setActive(0);
    requestAnimationFrame(tick);
  }, 950);
}

// ── UI mode helpers ───────────────────────────────────────────────────────────
export function showIdleUI() {
  backBtn.style.display    = 'none';
  exploreBtn.style.display = 'inline-flex';
  presentBtn.style.display = 'inline-flex';
}

export function showPresentingUI() {
  backBtn.style.display    = 'none';
  exploreBtn.style.display = 'inline-flex';
  presentBtn.style.display = 'inline-flex';
  _setPresentExit();
  progressWrap.style.display = 'block';
}

export function showExploreUI() {
  presentBtn.style.display = 'none';
  exploreBtn.style.display = 'none';
  prevBtn.style.display    = 'none';
  nextBtn.style.display    = 'none';
  progressWrap.style.display = 'none';
}

export function showWhiteWorldUI() {
  // Hide everything except the back button
  presentBtn.style.display = 'none';
  exploreBtn.style.display = 'none';
  prevBtn.style.display    = 'none';
  nextBtn.style.display    = 'none';
  progressWrap.style.display = 'none';
  backBtn.style.display    = 'inline-flex';
}

export function showBackBtn() {
  backBtn.style.display = 'inline-flex';
}

export function resetPresentBtn() {
  const span = presentBtn.querySelector('span:last-child');
  if (span) span.innerHTML = '▶ &nbsp;PRESENT';
  presentBtn.classList.remove('_lb-exit');
}

export function setProgressFill(fraction) {
  progressFill.style.width = `${Math.max(0, fraction) * 100}%`;
}

export function hideCard() {
  _stopExperienceTimeline();
  card.style.opacity      = '0';
  bodyPanel.style.opacity = '0';
  card.className = '';
  bodyPanel.className = '';
  if (_timerA) clearInterval(_timerA);
  if (_timerB) clearInterval(_timerB);
  slideTitle.textContent    = '';
  slideSubtitle.textContent = '';
  slideBody.textContent  = '';
  slideBody.innerHTML    = '';
}

/** Parse the experience body text into structured HTML blocks. */
function _buildExperienceHTML(body) {
  const base = import.meta.env.BASE_URL;

  const _imgMap = {
    'seb':      `${base}experience/seb-wireframe.png`,
    'cepheid':  `${base}experience/cepheid-wireframe.png`,
    'expleo':   `${base}experience/expleo-wireframe.png`,
  };

  function _imgFor(company) {
    const key = Object.keys(_imgMap).find(k => company.toLowerCase().includes(k));
    return key ? _imgMap[key] : null;
  }

  const blocks = body.split('\n\n').map((block, idx) => {
    const [role, company, stack] = block.split('\n');
    const img = _imgFor(company ?? '');
    const imgHTML = img
      ? `<img class="_exp-logo" src="${img}" alt="" />`
      : `<div class="_exp-logo _exp-logo-placeholder"></div>`;

    return `<div class="_exp-block" data-index="${idx}">
      ${imgHTML}
      <div class="_exp-text">
        <div class="_exp-role">${role ?? ''}</div>
        <div class="_exp-company">${company ?? ''}</div>
        <div class="_exp-stack">${stack ?? ''}</div>
      </div>
    </div>`;
  });

  // SVG timeline — height is placeholder; JS will update after layout
  const svgH = 300;
  const svgMarkup = `<svg id="_exp-tl-svg" class="_exp-tl-svg" width="26" height="${svgH}" viewBox="0 0 26 ${svgH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="_exp-tl-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#00ccff" stop-opacity="0.90"/>
        <stop offset="100%" stop-color="#003388" stop-opacity="0.25"/>
      </linearGradient>
      <filter id="_exp-glow" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="2.5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="_exp-dot-glow" x="-120%" y="-120%" width="340%" height="340%">
        <feGaussianBlur stdDeviation="3.5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <!-- track line -->
    <line id="_exp-tl-line" x1="13" y1="0" x2="13" y2="${svgH}"
          stroke="rgba(0,100,180,0.35)" stroke-width="1.5" stroke-dasharray="3 4"/>
    <!-- glow line (progress fill) -->
    <line id="_exp-tl-glow-line" x1="13" y1="0" x2="13" y2="0"
          stroke="url(#_exp-tl-grad)" stroke-width="2" stroke-linecap="round"/>
    <!-- node circles (one per block) — cy updated by JS -->
    ${blocks.map((_, i) =>
      `<circle class="_exp-tl-node" data-ni="${i}" cx="13" cy="${(i + 0.5) * (svgH / blocks.length)}" r="4"
        fill="rgba(0,120,180,0.6)" stroke="rgba(0,180,255,0.45)" stroke-width="1"
        filter="url(#_exp-glow)"/>`
    ).join('\n    ')}
    <!-- travelling dot -->
    <circle id="_exp-tl-dot" cx="13" cy="0" r="5.5"
            fill="#00e5ff" filter="url(#_exp-dot-glow)" opacity="0.95"/>
  </svg>`;

  return `<div class="_exp-timeline-wrap">
    ${svgMarkup}
    <div class="_exp-cards">
      ${blocks.join('')}
    </div>
  </div>`;
}

/** Terminal boot sequence for the intro slide. */
function _buildIntroHTML() {
  const rows = [
    { delay: 0.25, prompt: true, content: `<span class="_tb-blink-cursor">▌</span>&nbsp;ESTABLISHING_CONNECTION<span class="_tb-blink-cursor">...</span>` },
    { delay: 0.85, prompt: false, content: `<span class="_tb-key">ENGINEER </span><span class="_tb-val">FAZLI ZEKIQI</span>` },
    { delay: 1.30, prompt: false, content: `<span class="_tb-key">ROLE     </span><span class="_tb-val">SR. SOFTWARE ENGINEER</span>` },
    { delay: 1.75, prompt: false, content: `<span class="_tb-key">LOCATION </span><span class="_tb-val">STOCKHOLM, SWEDEN</span>` },
    { delay: 2.20, prompt: false, content: `<span class="_tb-key">FOCUS    </span><span class="_tb-val">DISTRIBUTED SYSTEMS</span>` },
    { delay: 2.80, prompt: false, content: `<span class="_tb-key">SYSTEMS  </span><span class="_tb-bar">██████████</span>&nbsp;<span class="_tb-pct">100% ONLINE</span>` },
    { delay: 3.40, prompt: true,  content: `<span class="_tb-blink-cursor">▌</span>` },
  ];
  const html = rows.map(r => {
    const promptHtml = r.prompt ? `<span class="_tb-prompt">&gt;</span>` : `<span class="_tb-prompt" style="opacity:0.35">&gt;</span>`;
    return `<div class="_tb-row" style="animation-delay:${r.delay}s">${promptHtml}&nbsp;${r.content}</div>`;
  }).join('');
  return `<div class="_term-boot">${html}</div>`;
}

/** Engineering stats dashboard for the about slide (bottom-right). */
function _buildAboutHTML() {
  return `<div class="_about-wrap">
    <div class="_about-stats-row">
      <div class="_ab-stat"><div class="_ab-val">6+</div><div class="_ab-lbl">YEARS EXP</div></div>
      <div class="_ab-stat"><div class="_ab-val">3</div><div class="_ab-lbl">COMPANIES</div></div>
      <div class="_ab-stat"><div class="_ab-val">29</div><div class="_ab-lbl">TECHNOLOGIES</div></div>
      <div class="_ab-stat"><div class="_ab-val">9+</div><div class="_ab-lbl">PROJECTS</div></div>
    </div>
    <div class="_ab-divider"></div>
    <div class="_ab-bio">
      Training · Running · Electronics · Robots
    </div>
  </div>`;
}

/** Interactive clickable contact links for the CTA slide. */
function _buildCtaHTML() {
  return `<div class="_cta-wrap">
    <a class="_cta-link" href="mailto:fazlizekiqi1@hotmail.com">
      <div class="_cta-icon-wrap"><span class="_cta-icon">✉</span></div>
      <div class="_cta-text">
        <span class="_cta-label">EMAIL</span>
        <span class="_cta-value">fazlizekiqi1@hotmail.com</span>
      </div>
      <span class="_cta-arrow">→</span>
    </a>
    <a class="_cta-link" href="https://linkedin.com/in/fazli-zekiqi" target="_blank" rel="noopener">
      <div class="_cta-icon-wrap"><span class="_cta-icon" style="font-weight:800;font-size:12px">in</span></div>
      <div class="_cta-text">
        <span class="_cta-label">LINKEDIN</span>
        <span class="_cta-value">fazli-zekiqi</span>
      </div>
      <span class="_cta-arrow">→</span>
    </a>
    <a class="_cta-link" href="https://github.com/fazlizekiqi" target="_blank" rel="noopener">
      <div class="_cta-icon-wrap"><span class="_cta-icon">⌥</span></div>
      <div class="_cta-text">
        <span class="_cta-label">GITHUB</span>
        <span class="_cta-value">fazlizekiqi</span>
      </div>
      <span class="_cta-arrow">→</span>
    </a>
    <div class="_cta-tagline">Ready to build something remarkable together.</div>
  </div>`;
}

export function showCard(title, body, delay = 550, slideName = '', subtitle = '') {
  hideCard();
  if (slideName) {
    card.classList.add(`slide-${slideName}`);
    bodyPanel.classList.add(`slide-${slideName}`);
  }
  setTimeout(() => {
    card.style.opacity = '1';
    _timerA = _typeWrite(slideTitle, title, 38, () => {
      if (subtitle) slideSubtitle.textContent = subtitle;
      bodyPanel.style.opacity = '1';
      if (slideName === 'experience') {
        slideBody.innerHTML = _buildExperienceHTML(body);
        slideBody.querySelectorAll('._exp-block').forEach((el, i) => {
          el.style.opacity   = '0';
          el.style.transform = 'translateX(-18px)';
          el.style.transition = 'none';
          setTimeout(() => {
            el.style.transition = 'opacity 0.50s ease, transform 0.50s cubic-bezier(0.22,0.61,0.36,1)';
            el.style.opacity    = '1';
            el.style.transform  = 'translateX(0)';
          }, 160 + i * 230);
        });
        _startExperienceTimeline();
      } else if (body === '__INTRO_TERMINAL__') {
        slideBody.innerHTML = _buildIntroHTML();
      } else if (body === '__ABOUT_STATS__') {
        slideBody.innerHTML = _buildAboutHTML();
      } else if (body === '__CTA_LINKS__') {
        slideBody.innerHTML = _buildCtaHTML();
      } else {
        _timerB = _typeWrite(slideBody, body, 18);
      }
    });
  }, delay);
}

// ── internal ──────────────────────────────────────────────────────────────────
function _setPresentExit() {
  const span = presentBtn.querySelector('span:last-child');
  if (span) span.textContent = '✕  EXIT';
  presentBtn.classList.add('_lb-exit');
}
