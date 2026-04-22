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

/* ─── experience slide — body on left, character on right ────────────────── */
#_slide-body-panel.slide-experience {
  justify-content: center;
  align-items: center;
  padding-left: 0;
  bottom: 0;
  top: 60px;
}
#_slide-body-panel.slide-experience #_sBodyInner {
  text-align: left;
  width: 46%;
  margin-left: -4%;
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
  gap: 14px;
}
._exp-tl-svg {
  flex-shrink: 0;
  width: 24px;
  overflow: visible;
}

/* ── cards column ── */
._exp-cards {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ── job block — card style ── */
._exp-block {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
  background: rgba(4, 14, 36, 0.78);
  border: 1px solid rgba(0, 140, 200, 0.18);
  border-radius: 8px;
  margin-bottom: 0;
}
._exp-logo {
  width: 52px;
  height: 52px;
  object-fit: contain;
  flex-shrink: 0;
  filter: brightness(1.1) drop-shadow(0 0 6px rgba(0,180,255,0.3));
}
._exp-logo-placeholder {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
}
._exp-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
._exp-role {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: .12em;
  color: #e8f4ff;
  text-shadow: 0 0 14px rgba(0,180,255,0.6);
}
._exp-company {
  font-size: 11px;
  letter-spacing: .09em;
  color: #7ecfea;
}
._exp-stack {
  font-size: 10px;
  letter-spacing: .07em;
  color: rgba(150,210,228,0.75);
  text-shadow: none;
  margin-top: 2px;
}

@media (max-width: 640px) {
  #_slide-body-panel.slide-experience {
    justify-content: flex-start;
    padding-left: 16px;
    top: 50px;
  }
  #_slide-body-panel.slide-experience #_sBodyInner {
    width: 56%;
    margin-left: 0;
  }
  ._exp-role    { font-size: 10px; }
  ._exp-company { font-size: 9px; }
  ._exp-stack   { font-size: 8px; }
  ._exp-block   { gap: 10px; padding: 8px 10px; }
  ._exp-logo    { width: 36px; height: 36px; }
  ._exp-tl-svg  { width: 18px; }
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

  // Wait for stagger animations + layout to settle before measuring
  setTimeout(() => {
    const svg    = slideBody.querySelector('#_exp-tl-svg');
    const dot    = slideBody.querySelector('#_exp-tl-dot');
    const line   = slideBody.querySelector('#_exp-tl-line');
    const nodes  = Array.from(slideBody.querySelectorAll('._exp-tl-node'));
    const blocks = Array.from(slideBody.querySelectorAll('._exp-block'));
    if (!svg || !dot || !blocks.length) return;

    // Measure node Y centres relative to the SVG element
    const svgRect = svg.getBoundingClientRect();
    const svgH    = svg.closest('._exp-timeline-wrap').getBoundingClientRect().height;

    // Update SVG dimensions to match actual cards height
    svg.setAttribute('height', svgH);
    svg.setAttribute('viewBox', `0 0 24 ${svgH}`);

    // Y centre of each block relative to the SVG top
    const nodeYs = blocks.map(b => {
      const r = b.getBoundingClientRect();
      return (r.top - svgRect.top) + r.height / 2;
    });

    // Update line to span first → last node
    line.setAttribute('y1', nodeYs[0]);
    line.setAttribute('y2', nodeYs[nodeYs.length - 1]);

    // Update node circle positions: blocks are [SEB(0), Cepheid(1), Expleo(2)]
    nodes.forEach((n, i) => { if (nodeYs[i] != null) n.setAttribute('cy', nodeYs[i]); });

    // Dot travels Expleo(2) → Cepheid(1) → SEB(0)  =  bottom → top
    const startY = nodeYs[2];
    const endY   = nodeYs[0];
    dot.setAttribute('cy', startY);

    const TRAVEL_MS = 2800;
    const PAUSE_MS  = 700;
    const PULSE_MS  = 320;

    let startTime  = null;
    let pauseUntil = 0;
    let activeNode = -1;

    function pulseNode(nodeEl) {
      let t0 = null;
      (function step(ts) {
        if (!t0) t0 = ts;
        const p = Math.min((ts - t0) / PULSE_MS, 1);
        const s = p < 0.5 ? p * 2 : (1 - p) * 2;
        nodeEl.setAttribute('r', 4 + s * 5);
        if (p < 1) requestAnimationFrame(step);
        else nodeEl.setAttribute('r', 4);
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

      const cy = startY + (endY - startY) * ease;  // startY > endY → travels up
      dot.setAttribute('cy', cy);

      // Check proximity to each node (travel order: 2 → 1 → 0)
      for (const idx of [2, 1, 0]) {
        if (activeNode !== idx && Math.abs(cy - nodeYs[idx]) < 5) {
          activeNode = idx;
          pulseNode(nodes[idx]);
          pauseUntil = ts + PAUSE_MS;
          startTime  = ts + PAUSE_MS - elapsed;
          return;
        }
      }

      if (progress >= 1) {
        // Reset to bottom and loop
        startTime  = null;
        pauseUntil = ts + 900;
        activeNode = -1;
        dot.setAttribute('cy', startY);
      }
    }

    requestAnimationFrame(tick);
  }, 900); // after stagger completes (3 blocks × 220ms ≈ 660ms + buffer)
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

  return body.split('\n\n').map(block => {
    const [role, company, stack] = block.split('\n');
    const img = _imgFor(company ?? '');
    const imgHTML = img
      ? `<img class="_exp-logo" src="${img}" alt="" />`
      : `<div class="_exp-logo _exp-logo-placeholder"></div>`;

    return `<div class="_exp-block">
      ${imgHTML}
      <div class="_exp-text">
        <div class="_exp-role">${role ?? ''}</div>
        <div class="_exp-company">${company ?? ''}</div>
        <div class="_exp-stack">${stack ?? ''}</div>
      </div>
    </div>`;
  }).join('');
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
          el.style.transform = 'translateX(-12px)';
          setTimeout(() => {
            el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            el.style.opacity    = '1';
            el.style.transform  = 'translateX(0)';
          }, i * 220);
        });
        _startExperienceTimeline();
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
