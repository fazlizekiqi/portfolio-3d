import { isWhiteWorld, isTransitioning } from './transition.js';
import { isMobile } from './constants.js';

const POOL = 32;
const MSGS = ['STANDBY', 'SCANNING', 'ANALYZING', 'TARGET LOCKED'];

let _el, _wrap, _coord, _status;
let _pool = [], _pi = 0;
let _mx = -400, _my = -400;
let _lx = -999, _ly = -999;
let _hot = false, _cycle = null, _mi = 0;
let _vis = true;

// ── Geometry helpers (viewBox 0 0 200 200, centre 100,100) ────────────────────
const C = 100;
const pt = (a, r) => {
  const rad = (a - 90) * Math.PI / 180;
  return [C + r * Math.cos(rad), C + r * Math.sin(rad)];
};

function ticks(r1, r2, count, w, op, col = '#39e6ff') {
  let s = '';
  for (let i = 0; i < count; i++) {
    const a = (360 / count) * i;
    const [x1, y1] = pt(a, r1);
    const [x2, y2] = pt(a, r2);
    s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${col}" stroke-width="${w}" stroke-opacity="${op}"/>`;
  }
  return s;
}

function diamonds(r, angles, size, col, op) {
  return angles.map(a => {
    const [cx, cy] = pt(a, r);
    return `<rect x="${(cx - size / 2).toFixed(1)}" y="${(cy - size / 2).toFixed(1)}" width="${size}" height="${size}" transform="rotate(45 ${cx.toFixed(1)} ${cy.toFixed(1)})" fill="${col}" fill-opacity="${op}"/>`;
  }).join('');
}

function buildSVG() {
  // Blueprint cardinal alignment marks outside main ring (r=83→91)
  const cardinals = [0, 90, 180, 270].map(a => {
    const [x1, y1] = pt(a, 83);
    const [x2, y2] = pt(a, 91);
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#39e6ff" stroke-width="1.2" stroke-opacity=".3"/>`;
  }).join('');

  // Tiny square modules on the r=60 ring at 45° and 225°
  const squares = [45, 225].map(a => {
    const [cx, cy] = pt(a, 60);
    return `<rect x="${(cx - 1.5).toFixed(1)}" y="${(cy - 1.5).toFixed(1)}" width="3" height="3" fill="#1fb4ff" fill-opacity=".7" transform="rotate(15 ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`;
  }).join('');

  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">

    <!-- blueprint outer ghost ring (static, engineering baseline) -->
    <circle cx="100" cy="100" r="84" fill="none" stroke="#39e6ff" stroke-width=".4" stroke-opacity=".15"
            stroke-dasharray="2 5"/>
    <!-- cardinal alignment marks (blueprint engineering style) -->
    ${cardinals}

    <!-- outer scanning ring (breathing) — enhanced with minor ticks + diamond markers -->
    <g class="_brk">
      <circle cx="100" cy="100" r="80" fill="none" stroke="#2ec8ff" stroke-width=".5" stroke-opacity=".28"/>
      <circle cx="100" cy="100" r="80" fill="none" stroke="#39e6ff" stroke-width="1" stroke-opacity=".5"
              stroke-dasharray="1.2 9.27" stroke-linecap="round"/>
      ${ticks(73, 80, 12, 1.4, .55)}
      ${ticks(78, 80, 36, 0.6, .2)}
      ${diamonds(80, [45, 165, 285], 3, '#39e6ff', .72)}
    </g>

    <!-- asymmetric blueprint arc ring (r=68), very slow CW — measurement calibration wheel -->
    <g class="_sp _cwVSlow">
      <circle cx="100" cy="100" r="68" fill="none" stroke="#2ec8ff" stroke-width="1.2" stroke-opacity=".38"
              stroke-dasharray="90 12 50 5 20 8 80 6 60 10" stroke-linecap="round"/>
      ${ticks(64, 68, 4, 1, .42)}
    </g>

    <!-- broken geometric ring (r=60), slow CCW + rotating square modules -->
    <g class="_sp _ccwSlow">
      <circle cx="100" cy="100" r="60" fill="none" stroke="#1fb4ff" stroke-width="1.4" stroke-opacity=".45"
              stroke-dasharray="36 16 22 28 30 18" stroke-linecap="round"/>
      ${ticks(54, 60, 8, 1.6, .6)}
      ${squares}
    </g>

    <!-- segmented radar arcs (r=44), medium CW + sweep target indicator -->
    <g class="_sp _cwMed">
      <circle cx="100" cy="100" r="44" fill="none" stroke="#39e6ff" stroke-width="2" stroke-opacity=".7"
              stroke-dasharray="48 21" stroke-linecap="round"/>
      <!-- L-bracket sweep marker -->
      <path d="M100,51 L100,56 L106,56" fill="none" stroke="#7af4ff" stroke-width="1" stroke-opacity=".85"/>
    </g>

    <!-- intermediate scan ring (r=37), medium CCW — contra-rotation against radar -->
    <g class="_sp _ccwMed">
      <circle cx="100" cy="100" r="37" fill="none" stroke="#39e6ff" stroke-width=".8" stroke-opacity=".5"
              stroke-dasharray="12 4 28 4 18 4 42 4 15 4 25 4" stroke-linecap="round"/>
      ${ticks(33, 37, 8, 0.7, .38)}
    </g>

    <!-- inner precision ring (r=30) + calibration ticks every 15°, slow CW -->
    <g class="_sp _cwSlow">
      <circle cx="100" cy="100" r="30" fill="none" stroke="#7af4ff" stroke-width="1" stroke-opacity=".8"/>
      ${ticks(26, 30, 24, 1, .7)}
      ${ticks(24, 31, 4, 1.6, .95)}
    </g>

    <!-- micro inner orbit ring (r=19), very fast CW — innermost layer -->
    <g class="_sp _cwXFast">
      <circle cx="100" cy="100" r="19" fill="none" stroke="#39e6ff" stroke-width=".7" stroke-opacity=".45"
              stroke-dasharray="8 3 18 3 8 3 30 3 12 3" stroke-linecap="round"/>
    </g>

    <!-- inner holographic field fill (depth layer) -->
    <circle cx="100" cy="100" r="22" fill="rgba(0,200,255,0.04)" stroke="none"/>

    <!-- orbiting particles (5 at different radii and directions) -->
    <g class="_sp _cwMed2" ><circle cx="100" cy="38" r="2.3" fill="#bff8ff"/></g>
    <g class="_sp _ccwMed" ><circle cx="100" cy="44" r="1.5" fill="#39e6ff" fill-opacity=".8"/></g>
    <g class="_sp _ccwFast"><circle cx="100" cy="52" r="1.8" fill="#39e6ff"/></g>
    <g class="_sp _cwFast" ><circle cx="100" cy="70" r="1.6" fill="#7af4ff"/></g>
    <g class="_sp _cwXFast"><circle cx="100" cy="81" r="1.2" fill="#fff"   fill-opacity=".85"/></g>

    <!-- neural flash lines (3 lines, rotating CCW slow) -->
    <g class="_sp _ccwSlow">
      <line class="_nl"           x1="100" y1="100" x2="100" y2="40" stroke="#9ff" stroke-width=".5"/>
      <line class="_nl _nl2"      x1="100" y1="100" x2="100" y2="58" stroke="#9ff" stroke-width=".5"/>
      <line class="_nl _nl3"      x1="100" y1="100" x2="128" y2="68" stroke="#9ff" stroke-width=".4"/>
    </g>

    <!-- centre micro cross (static, precision anchor) -->
    <line x1="96" y1="100" x2="104" y2="100" stroke="#39e6ff" stroke-width=".5" stroke-opacity=".38"/>
    <line x1="100" y1="96"  x2="100" y2="104" stroke="#39e6ff" stroke-width=".5" stroke-opacity=".38"/>

    <!-- static readouts -->
    <text class="_coord" x="100" y="11"  text-anchor="middle">X:0000 Y:0000</text>
    <text class="_st"    x="100" y="196" text-anchor="middle">STANDBY</text>
  </svg>`;
}

const CSS = `
body._curhide, body._curhide * { cursor: none !important; }

#_cur {
  position:fixed; top:0; left:0; width:136px; height:136px;
  margin:-68px 0 0 -68px;
  pointer-events:none; z-index:99999;
  transition:opacity .35s ease;
  will-change:transform;
}
#_cur svg { position:absolute; inset:0; width:100%; height:100%; overflow:visible; }

#_cur .core {
  position:absolute; top:50%; left:50%; width:11px; height:11px; margin:-6px 0 0 -6px;
  border-radius:50%;
  background:radial-gradient(circle,#fff 0%,#e0fdff 20%,#aef6ff 38%,#00e5ff 62%,#0055ff 100%);
  box-shadow:0 0 5px 2px #fff,0 0 10px 4px #39e6ff,0 0 22px 8px #00aaff,0 0 42px 14px rgba(0,140,255,.42);
  animation:_cp 1.9s ease-in-out infinite;
  transition:width .2s,height .2s,margin .2s;
}
#_cur.h .core { width:14px; height:14px; margin:-7px 0 0 -7px;
  box-shadow:0 0 7px 3px #fff,0 0 16px 6px #39e6ff,0 0 34px 12px #00bbff,0 0 58px 20px rgba(0,180,255,.58); }

#_cur .glow {
  position:absolute; top:50%; left:50%; width:72px; height:72px; margin:-36px 0 0 -36px;
  border-radius:50%;
  background:radial-gradient(circle,rgba(0,220,255,.12) 0%,rgba(0,140,255,.04) 50%,transparent 70%);
  animation:_cp 3.4s ease-in-out infinite;
}

/* extra CCW-rotating transparent ring for holographic depth */
#_cur .ring2 {
  position:absolute; top:50%; left:50%; width:46px; height:46px; margin:-23px 0 0 -23px;
  border-radius:50%;
  border:.7px solid rgba(57,230,255,.25);
  animation:_ccw 5.5s linear infinite;
  will-change:transform;
}

#_cur .radar {
  position:absolute; top:50%; left:50%; width:70px; height:70px; margin:-35px 0 0 -35px;
  border-radius:50%; overflow:hidden;
  background:conic-gradient(from 0deg, rgba(0,230,255,0) 0deg, rgba(0,230,255,0) 296deg, rgba(0,230,255,.28) 352deg, rgba(140,250,255,.5) 360deg);
  -webkit-mask:radial-gradient(circle, #000 62%, transparent 63%);
          mask:radial-gradient(circle, #000 62%, transparent 63%);
  animation:_cw 3s linear infinite;
}

#_cur .sonar {
  position:absolute; top:50%; left:50%; width:96px; height:96px; margin:-48px 0 0 -48px;
  border-radius:50%; border:1px solid rgba(0,210,255,.5);
  animation:_sonar 3.2s ease-out infinite;
}
#_cur .sonar.s2 { animation-delay:1.6s; }

/* SVG rotation groups (origin = viewBox centre) */
#_cur .core, #_cur .glow, #_cur .radar, #_cur .ring2 { will-change:transform; }
._sp, ._brk { transform-box:view-box; transform-origin:100px 100px; }
._cwVSlow { animation:_cw  18s  linear infinite; }
._cwSlow  { animation:_cw   9s  linear infinite; }
._cwMed   { animation:_cw   3.6s linear infinite; }
._cwMed2  { animation:_cw   5s  linear infinite; }
._cwFast  { animation:_cw   2.4s linear infinite; }
._cwXFast { animation:_cw   2s  linear infinite; }
._ccwSlow { animation:_ccw 14s  linear infinite; }
._ccwMed  { animation:_ccw  7s  linear infinite; }
._ccwFast { animation:_ccw  3.2s linear infinite; }
._brk     { animation:_breathe 3.2s ease-in-out infinite; }

._nl      { animation:_flash 2.6s ease-in-out infinite; }
._nl2     { animation:_flash 2.6s ease-in-out infinite 1.3s; }
._nl3     { animation:_flash 2.6s ease-in-out infinite 0.65s; }

._coord, ._st {
  font:700 7px 'Share Tech Mono',monospace; fill:#39e6ff;
  letter-spacing:.12em;
  filter:drop-shadow(0 0 4px rgba(0,200,255,.9));
}
._st { fill:#39e6ff; transition:fill .15s; }
#_cur.h ._st { fill:#39ffc8; }

#_cur svg   { transition:transform .2s ease; }
#_cur.h svg { transform:scale(1.14); }
#_cur.h .radar { animation:_cw 1.3s linear infinite; }

/* trail */
._ctwrap { position:fixed; top:0; left:0; pointer-events:none; z-index:99998; transition:opacity .35s; }
._ctp {
  position:fixed; width:4px; height:4px; margin:-2px 0 0 -2px; border-radius:50%;
  background:rgba(57,230,255,.8); box-shadow:0 0 6px 2px rgba(0,200,255,.5);
  opacity:0;
}
._ctp.go { animation:_prtcl .55s ease-out forwards; }

@keyframes _cp      { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.28);opacity:.82} }
@keyframes _cw      { to{transform:rotate(360deg)} }
@keyframes _ccw     { to{transform:rotate(-360deg)} }
@keyframes _breathe { 0%,100%{transform:scale(1);opacity:.85} 50%{transform:scale(1.07);opacity:1} }
@keyframes _sonar   { 0%{transform:scale(.55);opacity:.8} 100%{transform:scale(1.25);opacity:0} }
@keyframes _flash   { 0%,72%,100%{opacity:0} 80%{opacity:.55} }
@keyframes _prtcl   { 0%{opacity:.85;transform:scale(1)} 60%{opacity:.3;transform:scale(.5)} 100%{opacity:0;transform:scale(.05)} }
`;

function _spawn(x, y) {
  const p = _pool[_pi % POOL]; _pi++;
  p.classList.remove('go');
  p.style.left = x + 'px'; p.style.top = y + 'px';
  void p.offsetWidth;
  p.classList.add('go');
}

function _setHot(on) {
  if (_hot === on) return;
  _hot = on;
  _el.classList.toggle('h', on);
  if (on) {
    _mi = 1; _status.textContent = MSGS[1];
    _cycle = setInterval(() => {
      _mi = _mi >= MSGS.length - 1 ? 1 : _mi + 1;
      _status.textContent = MSGS[_mi];
    }, 520);
  } else {
    clearInterval(_cycle); _cycle = null;
    _status.textContent = MSGS[0];
  }
}

export function initCursor() {
  if (isMobile()) return;

  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.appendChild(s);
  document.body.classList.add('_curhide'); // hide native cursor in the blue world

  _wrap = document.createElement('div');
  _wrap.className = '_ctwrap';
  for (let i = 0; i < POOL; i++) {
    const p = document.createElement('div');
    p.className = '_ctp';
    _wrap.appendChild(p); _pool.push(p);
  }
  document.body.appendChild(_wrap);

  _el = document.createElement('div');
  _el.id = '_cur';
  _el.innerHTML =
    '<div class="glow"></div>' +
    '<div class="sonar"></div><div class="sonar s2"></div>' +
    '<div class="ring2"></div>' +
    '<div class="radar"></div>' +
    buildSVG() +
    '<div class="core"></div>';
  document.body.appendChild(_el);
  _coord  = _el.querySelector('._coord');
  _status = _el.querySelector('._st');

  window.addEventListener('mousemove', (e) => {
    _mx = e.clientX; _my = e.clientY;
    const dx = _mx - _lx, dy = _my - _ly;
    if (dx * dx + dy * dy > 64) { _spawn(_mx, _my); _lx = _mx; _ly = _my; }
    _coord.textContent =
      `X:${String(_mx).padStart(4, '0')} Y:${String(_my).padStart(4, '0')}`;
    const t = document.elementFromPoint(_mx, _my);
    _setHot(!!(t && t.closest('a,button,[role="button"],label,input,select')));
  }, { passive: true });

  document.addEventListener('mouseleave', () => _setHot(false), { passive: true });
}

export function tickCursor() {
  if (!_el) return;
  const show = !isWhiteWorld() && !isTransitioning();
  if (show !== _vis) {
    _vis = show;
    _el.style.opacity   = show ? '1' : '0';
    _wrap.style.opacity = show ? '1' : '0';
    // White world / transition: drop the custom cursor and bring the native
    // pointer back so buttons and controls are usable.
    document.body.classList.toggle('_curhide', show);
  }
  _el.style.transform = `translate(${_mx}px,${_my}px)`;
}
