import { isWhiteWorld, isTransitioning } from './transition.js';

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

function ticks(r1, r2, count, w, op) {
  let s = '';
  for (let i = 0; i < count; i++) {
    const a = (360 / count) * i;
    const [x1, y1] = pt(a, r1);
    const [x2, y2] = pt(a, r2);
    s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#39e6ff" stroke-width="${w}" stroke-opacity="${op}"/>`;
  }
  return s;
}

function buildSVG() {
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <!-- outer scanning ring (breathing) -->
    <g class="_brk">
      <circle cx="100" cy="100" r="80" fill="none" stroke="#2ec8ff" stroke-width=".6" stroke-opacity=".35"/>
      <circle cx="100" cy="100" r="80" fill="none" stroke="#39e6ff" stroke-width="1" stroke-opacity=".5"
              stroke-dasharray="1.2 9.27" stroke-linecap="round"/>
      ${ticks(73, 80, 12, 1.4, .55)}
    </g>

    <!-- broken geometric ring, slow CCW -->
    <g class="_sp _ccwSlow">
      <circle cx="100" cy="100" r="60" fill="none" stroke="#1fb4ff" stroke-width="1.4" stroke-opacity=".45"
              stroke-dasharray="36 16 22 28 30 18" stroke-linecap="round"/>
      ${ticks(54, 60, 8, 1.6, .6)}
    </g>

    <!-- segmented radar arcs, fast CW -->
    <g class="_sp _cwMed">
      <circle cx="100" cy="100" r="44" fill="none" stroke="#39e6ff" stroke-width="2" stroke-opacity=".7"
              stroke-dasharray="48 21" stroke-linecap="round"/>
    </g>

    <!-- inner precision ring + calibration ticks every 15°, slow CW -->
    <g class="_sp _cwSlow">
      <circle cx="100" cy="100" r="30" fill="none" stroke="#7af4ff" stroke-width="1" stroke-opacity=".8"/>
      ${ticks(26, 30, 24, 1, .7)}
      ${ticks(24, 31, 4, 1.6, .95)}
    </g>

    <!-- orbiting particles -->
    <g class="_sp _cwMed2"><circle cx="100" cy="38" r="2.3" fill="#bff8ff"/></g>
    <g class="_sp _ccwFast"><circle cx="100" cy="52" r="1.8" fill="#39e6ff"/></g>
    <g class="_sp _cwFast"><circle cx="100" cy="70" r="1.6" fill="#7af4ff"/></g>

    <!-- neural flash lines -->
    <g class="_sp _ccwSlow">
      <line class="_nl" x1="100" y1="100" x2="100" y2="40" stroke="#9ff" stroke-width=".5"/>
      <line class="_nl _nl2" x1="100" y1="100" x2="100" y2="58" stroke="#9ff" stroke-width=".5"/>
    </g>

    <!-- static readouts -->
    <text class="_coord" x="100" y="11" text-anchor="middle">X:0000 Y:0000</text>
    <text class="_st" x="100" y="196" text-anchor="middle">STANDBY</text>
  </svg>`;
}

const CSS = `
* { cursor: none !important; }

#_cur {
  position:fixed; top:0; left:0; width:170px; height:170px;
  margin:-85px 0 0 -85px;
  pointer-events:none; z-index:99999;
  transition:opacity .35s ease;
  will-change:transform;
}
#_cur svg { position:absolute; inset:0; width:100%; height:100%; overflow:visible; }

#_cur .core {
  position:absolute; top:50%; left:50%; width:14px; height:14px; margin:-7px 0 0 -7px;
  border-radius:50%;
  background:radial-gradient(circle,#fff 0%,#aef6ff 30%,#00e5ff 55%,#0077ff 100%);
  box-shadow:0 0 8px 3px #39e6ff,0 0 18px 7px #00aaff,0 0 36px 12px rgba(0,140,255,.5);
  animation:_cp 1.9s ease-in-out infinite;
  transition:width .2s,height .2s,margin .2s;
}
#_cur.h .core { width:18px; height:18px; margin:-9px 0 0 -9px;
  box-shadow:0 0 12px 5px #39e6ff,0 0 28px 10px #00bbff,0 0 50px 18px rgba(0,180,255,.65); }

#_cur .glow {
  position:absolute; top:50%; left:50%; width:90px; height:90px; margin:-45px 0 0 -45px;
  border-radius:50%;
  background:radial-gradient(circle,rgba(0,200,255,.10) 0%,transparent 68%);
  animation:_cp 3.4s ease-in-out infinite;
}

#_cur .radar {
  position:absolute; top:50%; left:50%; width:88px; height:88px; margin:-44px 0 0 -44px;
  border-radius:50%; overflow:hidden;
  background:conic-gradient(from 0deg, rgba(0,230,255,0) 0deg, rgba(0,230,255,0) 296deg, rgba(0,230,255,.28) 352deg, rgba(140,250,255,.5) 360deg);
  -webkit-mask:radial-gradient(circle, #000 62%, transparent 63%);
          mask:radial-gradient(circle, #000 62%, transparent 63%);
  animation:_cw 3s linear infinite;
}

#_cur .sonar {
  position:absolute; top:50%; left:50%; width:120px; height:120px; margin:-60px 0 0 -60px;
  border-radius:50%; border:1px solid rgba(0,210,255,.5);
  animation:_sonar 3.2s ease-out infinite;
}
#_cur .sonar.s2 { animation-delay:1.6s; }

/* SVG rotation groups (origin = viewBox centre) */
#_cur .core, #_cur .glow, #_cur .radar { will-change:transform; }
._sp, ._brk { transform-box:view-box; transform-origin:100px 100px; }
._cwSlow  { animation:_cw  9s   linear infinite; }
._cwMed   { animation:_cw  3.6s linear infinite; }
._cwMed2  { animation:_cw  5s   linear infinite; }
._cwFast  { animation:_cw  2.4s linear infinite; }
._ccwSlow { animation:_ccw 14s  linear infinite; }
._ccwFast { animation:_ccw 3.2s linear infinite; }
._brk     { animation:_breathe 3.2s ease-in-out infinite; }

._nl  { animation:_flash 2.6s ease-in-out infinite; }
._nl2 { animation:_flash 2.6s ease-in-out infinite 1.3s; }

._coord, ._st {
  font:700 7px 'Share Tech Mono',monospace; fill:#39e6ff;
  letter-spacing:.12em;
  filter:drop-shadow(0 0 4px rgba(0,200,255,.9));
}
._st { fill:#39e6ff; transition:fill .15s; }
#_cur.h ._st { fill:#39ffc8; }

#_cur svg     { transition:transform .2s ease; }
#_cur.h svg   { transform:scale(1.14); }
#_cur.h .radar{ animation:_cw 1.3s linear infinite; }

/* trail */
._ctwrap { position:fixed; top:0; left:0; pointer-events:none; z-index:99998; transition:opacity .35s; }
._ctp {
  position:fixed; width:4px; height:4px; margin:-2px 0 0 -2px; border-radius:50%;
  background:rgba(0,210,255,.75); box-shadow:0 0 5px 1px rgba(0,170,255,.5);
  opacity:0;
}
._ctp.go { animation:_prtcl .55s ease-out forwards; }

@keyframes _cp     { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.28);opacity:.82} }
@keyframes _cw     { to{transform:rotate(360deg)} }
@keyframes _ccw    { to{transform:rotate(-360deg)} }
@keyframes _breathe{ 0%,100%{transform:scale(1);opacity:.85} 50%{transform:scale(1.07);opacity:1} }
@keyframes _sonar  { 0%{transform:scale(.55);opacity:.8} 100%{transform:scale(1.25);opacity:0} }
@keyframes _flash  { 0%,72%,100%{opacity:0} 80%{opacity:.55} }
@keyframes _prtcl  { 0%{opacity:.8;transform:scale(1)} 100%{opacity:0;transform:scale(.1)} }
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
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.appendChild(s);

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
  const show = !isWhiteWorld() && !isTransitioning();
  if (show !== _vis) {
    _vis = show;
    _el.style.opacity   = show ? '1' : '0';
    _wrap.style.opacity = show ? '1' : '0';
  }
  _el.style.transform = `translate(${_mx}px,${_my}px)`;
}
