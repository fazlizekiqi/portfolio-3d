/**
 * loader.js — Full-screen loading overlay themed to the blue world.
 *
 * Usage
 * ─────
 *   import { showLoader, updateLoader, hideLoader } from './loader.js';
 *
 *   showLoader();                   // show immediately
 *   updateLoader(0.65, 'ENV');      // update progress bar + label
 *   hideLoader();                   // fade out & remove
 */

// ── Colours matching blueworld shader ────────────────────────────────────────
// bg top:    rgb(  8, 13,  36)  #080d24
// bg bottom: rgb( 10, 36,  56)  #0a2438
// accent:    #00aacc / #2299bb

const OVERLAY = document.createElement('div');
OVERLAY.id = '_loader';
OVERLAY.innerHTML = `
  <canvas id="_loader-bg"></canvas>

  <div id="_loader-center">
    <div id="_loader-rings">
      <div class="_lr" id="_lr1"></div>
      <div class="_lr" id="_lr2"></div>
      <div class="_lr" id="_lr3"></div>
    </div>

    <div id="_loader-label">INITIALISING</div>

    <div id="_loader-bar-wrap">
      <div id="_loader-bar"></div>
    </div>

    <div id="_loader-pct">0%</div>
  </div>
`;

const STYLE = document.createElement('style');
STYLE.textContent = `
#_loader {
  position:fixed;inset:0;z-index:9999;
  display:flex;align-items:center;justify-content:center;
  background:#020d1a;
  font-family:'Share Tech Mono','Courier New',monospace;
  transition:opacity 0.9s ease;
}
#_loader.hiding { opacity:0; pointer-events:none; }
#_loader-bg {
  position:absolute;inset:0;width:100%;height:100%;
  pointer-events:none;
}

/* ── centred column ── */
#_loader-center {
  position:relative;z-index:1;
  display:flex;flex-direction:column;
  align-items:center;gap:22px;
}

/* ── spinning rings ── */
#_loader-rings {
  position:relative;width:110px;height:110px;
}
._lr {
  position:absolute;inset:0;border-radius:50%;border-style:solid;
}
#_lr1 {
  border-width:2px;
  border-color:#00aacc transparent transparent transparent;
  animation:_lrSpin 1.6s linear infinite;
}
#_lr2 {
  inset:12px;
  border-width:2px;
  border-color:transparent #1a5577 transparent #1a5577;
  animation:_lrSpin 2.4s linear infinite reverse;
}
#_lr3 {
  inset:24px;
  border-width:1.5px;
  border-color:#2299bb transparent transparent transparent;
  animation:_lrSpin 1.0s linear infinite;
}
@keyframes _lrSpin {
  to { transform:rotate(360deg); }
}

/* ── label ── */
#_loader-label {
  color:#2299bb;font-size:10px;letter-spacing:.28em;
  text-shadow:0 0 12px rgba(0,170,204,0.55);
  min-width:180px;text-align:center;
}

/* ── progress bar ── */
#_loader-bar-wrap {
  width:220px;height:2px;
  background:rgba(0,150,200,0.15);
  border-radius:2px;overflow:hidden;
  position:relative;
}
#_loader-bar {
  height:100%;width:0%;
  background:linear-gradient(90deg,#004466,#00aacc,#55eeff);
  border-radius:2px;
  transition:width 0.3s ease;
  box-shadow:0 0 8px rgba(0,170,255,0.6);
}

/* ── percentage ── */
#_loader-pct {
  color:#1a5577;font-size:9px;letter-spacing:.22em;
}
`;

document.head.appendChild(STYLE);
document.body.appendChild(OVERLAY);

// ── Animated canvas background (mirrors blueworld shader) ────────────────────
const _canvas = OVERLAY.querySelector('#_loader-bg');
const _ctx    = _canvas.getContext('2d');
let   _raf    = null;
let   _t      = 0;

function _resizeCanvas() {
  _canvas.width  = window.innerWidth;
  _canvas.height = window.innerHeight;
}
_resizeCanvas();
window.addEventListener('resize', _resizeCanvas);

function _drawBg() {
  const { width: W, height: H } = _canvas;
  _t += 0.016;

  // Deep navy → dark teal gradient
  const grad = _ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgb(8,13,36)');
  grad.addColorStop(1, 'rgb(10,36,56)');
  _ctx.fillStyle = grad;
  _ctx.fillRect(0, 0, W, H);

  // Horizon glow
  const glow = 0.5 + 0.5 * Math.sin(_t * 0.25);
  const gy = _ctx.createRadialGradient(W * 0.5, H * 0.62, 0, W * 0.5, H * 0.62, W * 0.65);
  gy.addColorStop(0, `rgba(0,46,80,${0.45 * glow})`);
  gy.addColorStop(1, 'rgba(0,0,0,0)');
  _ctx.fillStyle = gy;
  _ctx.fillRect(0, 0, W, H);

  // Vignette
  const vg = _ctx.createRadialGradient(W * 0.5, H * 0.5, W * 0.2, W * 0.5, H * 0.5, W * 0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.72)');
  _ctx.fillStyle = vg;
  _ctx.fillRect(0, 0, W, H);

  // Sparse particles
  _ctx.fillStyle = 'rgba(0,170,204,0.45)';
  const seed = Math.floor(_t * 0.15);
  for (let i = 0; i < 38; i++) {
    const px = fract(Math.sin(i * 127.1 + seed * 0.01) * 43758.5) * W;
    const py = fract(Math.sin(i * 311.7 + seed * 0.01) * 53421.3) * H;
    const r  = 0.8 + fract(Math.sin(i * 78.233) * 23421.6) * 0.8;
    const a  = 0.2 + 0.8 * fract(Math.sin(i * 44.1 + _t * 0.4) * 12345.6);
    _ctx.globalAlpha = a * 0.5;
    _ctx.beginPath();
    _ctx.arc(px, py, r, 0, Math.PI * 2);
    _ctx.fill();
  }
  _ctx.globalAlpha = 1;
}

function fract(x) { return x - Math.floor(x); }

function _loop() {
  _drawBg();
  _raf = requestAnimationFrame(_loop);
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const _label = OVERLAY.querySelector('#_loader-label');
const _bar   = OVERLAY.querySelector('#_loader-bar');
const _pct   = OVERLAY.querySelector('#_loader-pct');

// ── Fake progress (fills to 88% while assets load; real progress overrides) ──
let _realProgress = 0;
let _fakeT        = 0;       // seconds since show
let _fakeRaf      = null;
const FAKE_FILL_S = 6.0;     // seconds to fill fake bar to 88%

function _fakeTick() {
  _fakeT += 0.016;
  const t = Math.min(_fakeT / FAKE_FILL_S, 1.0);
  // ease-out curve: fast at first, slows toward the cap
  const fakeP = 0.88 * (1 - Math.pow(1 - t, 2.5));
  if (fakeP > _realProgress) {
    const pct = Math.round(fakeP * 100);
    _bar.style.width  = `${pct}%`;
    _pct.textContent  = `${pct}%`;
  }
  _fakeRaf = requestAnimationFrame(_fakeTick);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function showLoader() {
  OVERLAY.style.opacity = '1';
  OVERLAY.classList.remove('hiding');
  _realProgress = 0;
  _fakeT        = 0;
  _fakeRaf      = requestAnimationFrame(_fakeTick);
  _loop();
}

/**
 * @param {number} progress  0..1
 * @param {string} [label]   short uppercase label, e.g. 'CHARACTER'
 */
export function updateLoader(progress, label) {
  _realProgress = progress;
  const pct = Math.round(progress * 100);
  _bar.style.width = `${pct}%`;
  _pct.textContent = `${pct}%`;
  if (label) _label.textContent = label;
}

export function hideLoader() {
  if (_fakeRaf) { cancelAnimationFrame(_fakeRaf); _fakeRaf = null; }
  OVERLAY.classList.add('hiding');
  setTimeout(() => {
    if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
    OVERLAY.remove();
    STYLE.remove();
  }, 950);
}

