/**
 * ui.js — All presentation DOM elements and their visibility helpers.
 */
import { buildExperienceHTML } from './slides/experience/experience.templates.js';
import { buildIntroHTML } from './slides/intro/intro.templates.js';
import { buildAboutHTML } from './slides/about/about.templates.js';
import { showCtaHud, hideCtaHud } from './cta-hud.js';
import { audio } from '../audio.js';
import './slides/intro/intro.css';
import './slides/experience/experience.css';
import './slides/about/about.css';

// ── Slide title strip (top) ───────────────────────────────────────────────────
const card = document.createElement('div');
card.id = '_slide-card';
card.style.opacity = '0'; // layout lives in the stylesheet
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
bodyPanel.style.opacity = '0'; // layout lives in the stylesheet
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
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 20;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.6s ease;
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
  position: fixed;
  bottom: 80px;
  left: 0; right: 0;
  z-index: 20;
  pointer-events: none;
  display: flex;
  opacity: 0;
  transition: opacity 0.5s ease;
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
  display: none;
}

/* ─── CTA — top title/subtitle restyled for the sci-fi HUD redesign;       */
/* ─── the body panel itself is unused (content lives in cta-hud.js)       */
#_slide-body-panel.slide-cta { display: none; }
#_slide-card.slide-cta #_sTitle { text-transform: uppercase; }

@media (max-width: 640px) {
  #_slide-body-panel.slide-skills,
  #_slide-body-panel.slide-projects { padding-right: 3%; }
}

/* ─── audio mute button ───────────────────────────────────────────────────── */
#_audio-btn {
  position: fixed;
  top: 16px;
  right: 20px;
  z-index: 25;
  padding: 6px 10px;
  background: rgba(2,8,18,0.70);
  border: 1px solid rgba(0,150,200,0.30);
  border-radius: 3px;
  color: rgba(0,180,220,0.55);
  font-family: 'Share Tech Mono', 'Courier New', monospace;
  font-size: 11px;
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: color .15s, border-color .15s, background .15s;
  line-height: 1;
}
#_audio-btn:hover {
  color: #55eeff;
  border-color: rgba(0,200,255,0.65);
  background: rgba(0,20,45,0.90);
}
#_audio-btn.muted { color: rgba(0,180,220,0.28); border-color: rgba(0,150,200,0.15); }

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

// ── Audio mute toggle (top-right corner) ─────────────────────────────────────
const _audioBtn = document.createElement('button');
_audioBtn.id = '_audio-btn';
_audioBtn.title = 'Toggle sound';
_audioBtn.textContent = '♪';
document.body.appendChild(_audioBtn);
_audioBtn.addEventListener('click', () => {
  audio.resume();
  const muted = audio.toggle();
  _audioBtn.textContent = muted ? '♪̸' : '♪';
  _audioBtn.classList.toggle('muted', muted);
});

// ── Timing constants ──────────────────────────────────────────────────────────
const EXP_TIMELINE_DELAY_MS = 950;
const TRAVEL_MS             = 4500;
const PAUSE_MS              = 2500;
const PULSE_MS              = 380;

// ── Typewriter ────────────────────────────────────────────────────────────────
let _timerA = null, _timerB = null;

function _typeWrite(el, text, speed, cb) {
  el.textContent = '';
  let i = 0;
  const t = setInterval(() => {
    el.textContent += text[i++];
    // Play click on every other character so it's noticeable but not overwhelming
    if (i % 2 === 0) audio.playTypewriterClick();
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

  // Wait for stagger animations + layout to settle before measuring DOM positions
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
          audio.playTimelineNode();
          pauseUntil = ts + PAUSE_MS;
          startTime  = ts + PAUSE_MS - elapsed;
          return;
        }
      }

      if (progress >= 1) {
        // One pass complete — leave the last node highlighted and signal done.
        document.dispatchEvent(new CustomEvent('_exp-timeline-done'));
        return;  // don't re-queue; timeline ends after one pass
      }
    }

    // Set first block active immediately
    setActive(0);
    requestAnimationFrame(tick);
  }, EXP_TIMELINE_DELAY_MS);
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
  hideCtaHud();
  card.style.opacity           = '0';
  bodyPanel.style.opacity      = '0';
  bodyPanel.style.pointerEvents = 'none';  // restore non-interactive default
  card.className = '';
  bodyPanel.className = '';
  if (_timerA) clearInterval(_timerA);
  if (_timerB) clearInterval(_timerB);
  slideTitle.textContent    = '';
  slideSubtitle.textContent = '';
  slideBody.textContent  = '';
  slideBody.innerHTML    = '';
}

// HTML builders are in templates.js — imported at the top of this file.

export function showCard(title, body, delay = 550, slideName = '', subtitle = '') {
  hideCard();
  if (slideName) {
    card.classList.add(`slide-${slideName}`);
    bodyPanel.classList.add(`slide-${slideName}`);
  }
  bodyPanel.style.pointerEvents = 'none';
  setTimeout(() => {
    card.style.opacity = '1';
    _timerA = _typeWrite(slideTitle, title, 38, () => {
      if (subtitle) slideSubtitle.textContent = subtitle;
      bodyPanel.style.opacity = '1';
      if (slideName === 'experience') {
        slideBody.innerHTML = buildExperienceHTML(body);
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
      } else if (slideName === 'intro') {
        slideBody.innerHTML = buildIntroHTML();
      } else if (slideName === 'about') {
        slideBody.innerHTML = buildAboutHTML();
      } else if (slideName === 'cta') {
        showCtaHud();
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
