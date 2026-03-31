/**
 * ui.js — All presentation DOM elements and their visibility helpers.
 *
 * Exports pure DOM manipulation functions. Has NO knowledge of
 * slides content, camera, player, or worlds.
 */

// ── Slide card ────────────────────────────────────────────────────────────────
const card = document.createElement('div');
card.style.cssText = `
  position:fixed;left:48px;top:50%;transform:translateY(-50%);
  z-index:20;pointer-events:none;max-width:320px;
  opacity:0;transition:opacity 0.6s ease;`;
card.innerHTML = `
  <div style="width:2px;height:60px;background:linear-gradient(to bottom,transparent,#00aacc);margin-bottom:16px;"></div>
  <div id="_sTitle" style="color:#e8f4ff;font-size:19px;letter-spacing:.05em;line-height:1.3;margin-bottom:14px;text-shadow:0 0 24px rgba(0,180,255,0.4);"></div>
  <div style="width:40px;height:1px;background:#1a5577;margin-bottom:14px;"></div>
  <div id="_sBody"  style="color:#5599aa;font-size:11px;letter-spacing:.10em;line-height:2.0;white-space:pre-line;"></div>
  <div style="width:2px;height:40px;background:linear-gradient(to bottom,#00aacc,transparent);margin-top:16px;"></div>`;
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

// ── Buttons ───────────────────────────────────────────────────────────────────
const BTN = `
  position:fixed;bottom:56px;z-index:20;
  background:rgba(2,8,18,0.88);border-radius:3px;
  font-size:11px;letter-spacing:.18em;cursor:pointer;
  font-family:'Share Tech Mono','Courier New',monospace;
  backdrop-filter:blur(10px);transition:color 0.2s,border-color 0.2s;`;

export const nextBtn = document.createElement('button');
nextBtn.textContent = '→';
nextBtn.style.cssText = BTN + `right:32px;color:#2299bb;font-size:14px;
  border:1px solid rgba(0,150,200,0.4);padding:10px 20px;display:none;`;
document.body.appendChild(nextBtn);

export const presentBtn = document.createElement('button');
presentBtn.textContent = '▶\u00a0\u00a0PRESENT';
presentBtn.style.cssText = BTN + `left:50%;transform:translateX(-50%);color:#2299bb;
  border:1px solid rgba(0,150,200,0.4);padding:10px 32px;`;
document.body.appendChild(presentBtn);

export const exploreBtn = document.createElement('button');
exploreBtn.textContent = 'EXPLORE';
exploreBtn.style.cssText = BTN + `left:32px;color:#336677;
  border:1px solid rgba(0,150,200,0.2);padding:10px 20px;`;
document.body.appendChild(exploreBtn);

export const backBtn = document.createElement('button');
backBtn.textContent = '← BACK';
backBtn.style.cssText = BTN + `left:32px;color:#336677;
  border:1px solid rgba(0,150,200,0.2);padding:10px 20px;display:none;`;
document.body.appendChild(backBtn);

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
  presentBtn.style.display = 'block';
  exploreBtn.style.display = 'block';
}

export function showPresentingUI() {
  backBtn.style.display        = 'none';
  presentBtn.style.display     = 'block';
  exploreBtn.style.display     = 'block';
  presentBtn.textContent       = '✕  EXIT';
  presentBtn.style.color       = '#cc6666';
  presentBtn.style.borderColor = 'rgba(180,60,60,0.5)';
  progressWrap.style.display   = 'block';
}

export function showExploreUI() {
  presentBtn.style.display = 'none';
  exploreBtn.style.display = 'none';
}

export function showBackBtn() {
  backBtn.style.display = 'block';
}

export function resetPresentBtn() {
  presentBtn.textContent       = '▶\u00a0\u00a0PRESENT';
  presentBtn.style.color       = '#2299bb';
  presentBtn.style.borderColor = 'rgba(0,150,200,0.4)';
}

export function setProgressFill(fraction) {
  progressFill.style.width = `${Math.max(0, fraction) * 100}%`;
}

export function hideCard() {
  card.style.opacity = '0';
  if (_timerA) clearInterval(_timerA);
  if (_timerB) clearInterval(_timerB);
  slideTitle.textContent = '';
  slideBody.textContent  = '';
}

export function showCard(title, body, delay = 550) {
  hideCard();
  setTimeout(() => {
    card.style.opacity = '1';
    _timerA = _typeWrite(slideTitle, title, 38, () => {
      _timerB = _typeWrite(slideBody, body, 20);
    });
  }, delay);
}

