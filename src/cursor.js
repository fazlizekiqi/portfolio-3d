import { isWhiteWorld, isTransitioning } from './transition.js';

const POOL = 28;
const MSGS = ['STANDBY', 'SCANNING...', 'ANALYZING...', 'TARGET LOCKED'];

let _el, _data, _wrap;
let _pool = [], _pi = 0;
let _mx = -300, _my = -300;
let _lx = -999, _ly = -999;
let _hot = false, _cycle = null, _mi = 0;
let _vis = true;

const CSS = `
*  { cursor: none !important; }

#_cur {
  position: fixed; top:0; left:0;
  width:60px; height:60px;
  pointer-events:none; z-index:99999;
  transition: opacity .35s ease;
  will-change: transform;
}

._cc {
  position:absolute; top:50%; left:50%;
  width:12px; height:12px; margin:-6px 0 0 -6px;
  border-radius:50%;
  background: radial-gradient(circle, #fff 0%, #00ffff 45%, #0077ff 100%);
  box-shadow: 0 0 6px 2px #00ffff, 0 0 14px 5px #0077ff, 0 0 28px 8px rgba(0,120,255,.45);
  animation: _cp 1.9s ease-in-out infinite;
  transition: width .18s, height .18s, margin .18s, box-shadow .18s;
  z-index:2;
}
#_cur.h ._cc {
  width:16px; height:16px; margin:-8px 0 0 -8px;
  box-shadow: 0 0 10px 4px #00ffff, 0 0 22px 8px #0077ff, 0 0 40px 14px rgba(0,180,255,.6);
}

._cg {
  position:absolute; top:50%; left:50%;
  width:36px; height:36px; margin:-18px 0 0 -18px;
  border-radius:50%;
  background: radial-gradient(circle, rgba(0,200,255,.12) 0%, transparent 70%);
  animation: _cp 1.9s ease-in-out infinite reverse;
  transition: width .2s, height .2s, margin .2s;
}
#_cur.h ._cg { width:56px; height:56px; margin:-28px 0 0 -28px; }

._cr1 {
  position:absolute; top:50%; left:50%;
  width:32px; height:32px; margin:-16px 0 0 -16px;
  border-radius:50%;
  border:1.5px solid rgba(0,220,255,.75);
  border-top-color:transparent; border-right-color:rgba(0,200,255,.25);
  animation:_rccw 2.8s linear infinite;
  transition: width .2s, height .2s, margin .2s, border-color .15s;
}
#_cur.h ._cr1 {
  width:52px; height:52px; margin:-26px 0 0 -26px;
  border-color:rgba(0,255,200,.95); border-top-color:transparent;
  animation:_rccw 1.1s linear infinite;
}

._cr2 {
  position:absolute; top:50%; left:50%;
  width:22px; height:22px; margin:-11px 0 0 -11px;
  border-radius:50%;
  border:1px dashed rgba(0,170,255,.5);
  animation:_rcw 1.6s linear infinite;
  transition: width .2s, height .2s, margin .2s, border-color .15s;
}
#_cur.h ._cr2 {
  width:40px; height:40px; margin:-20px 0 0 -20px;
  border-color:rgba(0,255,180,.8);
  animation:_rcw .8s linear infinite;
}

._cr3 {
  position:absolute; top:50%; left:50%;
  width:42px; height:42px; margin:-21px 0 0 -21px;
  border-radius:50%;
  border:.8px solid rgba(0,140,255,.22);
  border-bottom-color:rgba(0,220,255,.6); border-top-color:transparent;
  animation:_rcw 5s linear infinite;
  opacity:0; transition:opacity .2s, width .2s, height .2s, margin .2s;
}
#_cur.h ._cr3 {
  width:60px; height:60px; margin:-30px 0 0 -30px;
  opacity:1; border-color:rgba(0,200,255,.3); border-bottom-color:rgba(0,255,180,.7);
}

._csc {
  position:absolute; top:50%; left:50%;
  width:30px; margin-left:-15px; height:1px;
  background:linear-gradient(90deg,transparent,rgba(0,220,255,.75),transparent);
  animation:_scan 2.2s ease-in-out infinite;
  transition: width .2s, margin .2s;
}
#_cur.h ._csc { width:50px; margin-left:-25px; }

._crt {
  position:absolute; top:50%; left:50%;
  width:26px; height:26px; margin:-13px 0 0 -13px;
  transition: width .2s, height .2s, margin .2s;
}
#_cur.h ._crt { width:46px; height:46px; margin:-23px 0 0 -23px; }

._crt i {
  position:absolute; width:7px; height:7px;
  border:0 solid rgba(0,220,255,.9); transition:all .2s;
}
#_cur.h ._crt i { width:9px; height:9px; border-color:rgba(0,255,200,1); }
._crt i:nth-child(1){ top:0;    left:0;   border-top-width:1.5px; border-left-width:1.5px; }
._crt i:nth-child(2){ top:0;    right:0;  border-top-width:1.5px; border-right-width:1.5px; }
._crt i:nth-child(3){ bottom:0; left:0;   border-bottom-width:1.5px; border-left-width:1.5px; }
._crt i:nth-child(4){ bottom:0; right:0;  border-bottom-width:1.5px; border-right-width:1.5px; }

._cdt {
  position:absolute; top:calc(50% + 24px); left:50%;
  transform:translateX(-50%);
  font:700 7px 'Share Tech Mono',monospace;
  color:rgba(0,210,255,.85); letter-spacing:.14em;
  white-space:nowrap; text-shadow:0 0 7px rgba(0,200,255,.9);
  transition: top .2s, color .15s;
}
#_cur.h ._cdt { top:calc(50% + 34px); color:rgba(0,255,190,1); }

/* Data segs — 3 small tick marks around ring */
._cds {
  position:absolute; top:50%; left:50%;
  width:40px; height:40px; margin:-20px 0 0 -20px;
  opacity:0; transition:opacity .2s;
}
#_cur.h ._cds { opacity:1; }
._cds span {
  position:absolute; width:5px; height:1px;
  background:rgba(0,220,255,.6);
}
._cds span:nth-child(1){ top:0; left:50%; margin-left:-2px; }
._cds span:nth-child(2){ bottom:0; left:50%; margin-left:-2px; }
._cds span:nth-child(3){ left:0; top:50%; width:1px; height:5px; margin-top:-2px; }

/* Trail */
._ctwrap { position:fixed; top:0; left:0; pointer-events:none; z-index:99998; transition:opacity .35s; }
._ctp {
  position:fixed; width:4px; height:4px; margin:-2px 0 0 -2px;
  border-radius:50%; background:rgba(0,200,255,.75);
  box-shadow:0 0 4px 1px rgba(0,160,255,.5);
  pointer-events:none; opacity:0;
}
._ctp.go { animation:_prtcl .5s ease-out forwards; }

@keyframes _cp   { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.3);opacity:.8} }
@keyframes _rccw { to{transform:rotate(-360deg)} }
@keyframes _rcw  { to{transform:rotate(360deg)} }
@keyframes _scan {
  0%  {transform:translateY(-11px);opacity:0}
  20% {opacity:.85} 80%{opacity:.85}
  100%{transform:translateY(11px);opacity:0}
}
@keyframes _prtcl {
  0%  {opacity:.85;transform:scale(1)}
  100%{opacity:0;transform:scale(.1)}
}
`;

function _spawn(x, y) {
  const p = _pool[_pi % POOL];
  _pi++;
  p.classList.remove('go');
  p.style.left = x + 'px';
  p.style.top  = y + 'px';
  void p.offsetWidth;
  p.classList.add('go');
}

function _setHot(on) {
  if (_hot === on) return;
  _hot = on;
  _el.classList.toggle('h', on);
  if (on) {
    _mi = 1; _data.textContent = MSGS[1];
    _cycle = setInterval(() => {
      _mi = _mi >= MSGS.length - 1 ? 1 : _mi + 1;
      _data.textContent = MSGS[_mi];
    }, 520);
  } else {
    clearInterval(_cycle); _cycle = null;
    _data.textContent = MSGS[0];
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
    _wrap.appendChild(p);
    _pool.push(p);
  }
  document.body.appendChild(_wrap);

  _el = document.createElement('div');
  _el.id = '_cur';
  _el.innerHTML =
    '<div class="_cg"></div>' +
    '<div class="_cr3"></div>' +
    '<div class="_cr1"></div>' +
    '<div class="_cr2"></div>' +
    '<div class="_crt"><i></i><i></i><i></i><i></i></div>' +
    '<div class="_cds"><span></span><span></span><span></span></div>' +
    '<div class="_csc"></div>' +
    '<div class="_cc"></div>' +
    '<div class="_cdt">STANDBY</div>';
  document.body.appendChild(_el);
  _data = _el.querySelector('._cdt');

  window.addEventListener('mousemove', (e) => {
    _mx = e.clientX; _my = e.clientY;
    const dx = _mx - _lx, dy = _my - _ly;
    if (dx * dx + dy * dy > 64) { _spawn(_mx, _my); _lx = _mx; _ly = _my; }
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
  _el.style.transform = `translate(${_mx - 30}px,${_my - 30}px)`;
}
