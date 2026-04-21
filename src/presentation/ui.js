/**
 * ui.js — All presentation DOM elements and their visibility helpers.
 */

// ── Slide card ────────────────────────────────────────────────────────────────
const card = document.createElement('div');
card.id = '_slide-card';
card.style.cssText = `
  position:fixed;left:48px;top:50%;transform:translateY(-50%);
  z-index:20;pointer-events:none;max-width:320px;
  opacity:0;transition:opacity 0.6s ease;`;
card.innerHTML = `
  <div class="_sc-line-top"></div>
  <div id="_sTitle"></div>
  <div class="_sc-divider"></div>
  <div id="_sBody"></div>
  <div class="_sc-line-bot"></div>`;
document.body.appendChild(card);

const slideTitle = card.querySelector('#_sTitle');
const slideBody  = card.querySelector('#_sBody');

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
/* ─── slide card ─────────────────────────────────────────────────────────── */
#_slide-card {
  font-family:'Share Tech Mono','Courier New',monospace;
}
#_slide-card ._sc-line-top {
  width:2px;height:60px;
  background:linear-gradient(to bottom,transparent,#00aacc);
  margin-bottom:16px;
}
#_slide-card ._sc-line-bot {
  width:2px;height:40px;
  background:linear-gradient(to bottom,#00aacc,transparent);
  margin-top:16px;
}
#_slide-card ._sc-divider {
  width:40px;height:1px;
  background:#1a5577;
  margin-bottom:14px;
}
#_sTitle {
  color:#e8f4ff;
  font-size:19px;
  letter-spacing:.05em;
  line-height:1.3;
  margin-bottom:14px;
  text-shadow:0 0 24px rgba(0,180,255,0.4);
}
#_sBody {
  color:#5599aa;
  font-size:11px;
  letter-spacing:.10em;
  line-height:2.0;
  white-space:pre-line;
}

/* ─── mobile: compact strip above the nav buttons ──────────────────────────── */
@media (max-width: 640px) {
  #_slide-card {
    left: 0 !important;
    right: 0 !important;
    top: auto !important;
    bottom: 58px !important;
    transform: none !important;
    max-width: 100vw !important;
    width: 100%;
    max-height: 28vh;
    overflow: hidden;
    box-sizing: border-box;
    padding: 8px 16px 6px;
    background: rgba(2,8,18,0.88);
    backdrop-filter: blur(8px);
    border-top: 1px solid rgba(0,150,200,0.28);
  }
  #_slide-card ._sc-line-top,
  #_slide-card ._sc-line-bot { display: none; }
  #_slide-card ._sc-divider  { margin-bottom: 4px; width: 24px; }
  #_sTitle { font-size: 13px; margin-bottom: 4px; }
  #_sBody  { font-size: 9px; line-height: 1.6; letter-spacing: .06em; }

  /* Projects slide — minimal padding only, body text shows normally */
  #_slide-card.slide-projects { padding: 6px 16px 5px; }
  #_slide-card.slide-projects #_sTitle { font-size: 12px; margin-bottom: 3px; }
  #_slide-card.slide-projects ._sc-divider { margin-bottom: 3px; }
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
    gap: 7px;
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
_bar.appendChild(exploreBtn);

export const presentBtn = _mkLb('▶ &nbsp;PRESENT');
_bar.appendChild(presentBtn);

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
  card.style.opacity = '0';
  card.className = '';   // clear any slide-specific classes
  if (_timerA) clearInterval(_timerA);
  if (_timerB) clearInterval(_timerB);
  slideTitle.textContent = '';
  slideBody.textContent  = '';
}

export function showCard(title, body, delay = 550, slideName = '') {
  hideCard();
  if (slideName) card.classList.add(`slide-${slideName}`);
  setTimeout(() => {
    card.style.opacity = '1';
    _timerA = _typeWrite(slideTitle, title, 38, () => {
      _timerB = _typeWrite(slideBody, body, 20);
    });
  }, delay);
}

// ── internal ──────────────────────────────────────────────────────────────────
function _setPresentExit() {
  const span = presentBtn.querySelector('span:last-child');
  if (span) span.textContent = '✕  EXIT';
  presentBtn.classList.add('_lb-exit');
}
