/**
 * how-i-work-overlay.js
 *
 * Renders the "How I Work" segmental-arch SVG animation as a fixed
 * full-viewport overlay that sits on top of the 3D canvas.
 *
 * Public API
 * ──────────
 *   showHowIWorkOverlay()  – fade in + start dot animation
 *   hideHowIWorkOverlay()  – fade out + stop animation
 */

// ── Data ─────────────────────────────────────────────────────────────────────
// Images are numbered 1–4 right-to-left in the folder, so card 0 (leftmost) = 4.png
// Paths are relative to the Vite base (/portfolio-3d/ in prod, / in dev via import.meta.env.BASE_URL)
const _base = import.meta.env.BASE_URL;
const CARDS = [
  { title: 'Design',      caption: 'Scalability & Reliability',  img: `${_base}how-i-work/1.png` },
  { title: 'Clean',       caption: 'Maintainable Architecture',  img: `${_base}how-i-work/2.png` },
  { title: 'Observe',     caption: 'Observability & Monitoring', img: `${_base}how-i-work/3.png` },
  { title: 'Collaborate', caption: 'Teams & Stakeholders',       img: `${_base}how-i-work/4.png` },
];

// ── DOM Setup ─────────────────────────────────────────────────────────────────
const _wrap = document.createElement('div');
_wrap.id = '_how-i-work-overlay';
_wrap.style.cssText = `
  position: fixed;
  inset: 0;
  z-index: 15;
  pointer-events: none;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.7s ease;
  padding-top: 48px;
`;

const _svgNS = 'http://www.w3.org/2000/svg';
const _svg = document.createElementNS(_svgNS, 'svg');
_svg.setAttribute('id', '_arch-svg');
_svg.setAttribute('viewBox', '0 0 960 310');
_svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
_svg.style.cssText = 'width: min(920px, 94vw); overflow: visible;';

// ── Layout constants (must be above defs loop) ────────────────────────────────
const CARD_W = 160, CARD_H = 156, IMG_H = 100, CONN_LEN = 38;

// ── Defs ──────────────────────────────────────────────────────────────────────
const defs = document.createElementNS(_svgNS, 'defs');
for (let i = 0; i < 4; i++) {
  const cp = document.createElementNS(_svgNS, 'clipPath');
  cp.setAttribute('id', `_card-clip-${i}`);
  const r = document.createElementNS(_svgNS, 'rect');
  r.setAttribute('x', 8); r.setAttribute('y', 8);
  r.setAttribute('rx', 6); r.setAttribute('width', CARD_W - 16); r.setAttribute('height', IMG_H);
  cp.appendChild(r);
  defs.appendChild(cp);
}
_svg.appendChild(defs);

// ── Arch path ─────────────────────────────────────────────────────────────────
const _archPath = document.createElementNS(_svgNS, 'path');
_archPath.setAttribute('id', '_arch-path');
_archPath.setAttribute('d', 'M 80 260 A 480 480 0 0 1 880 260');
_archPath.setAttribute('fill', 'none');
_archPath.setAttribute('stroke', '#1a4a7a');
_archPath.setAttribute('stroke-width', '2');
_archPath.style.filter = 'drop-shadow(0 0 6px rgba(10,143,255,0.3))';
_svg.appendChild(_archPath);

// ── Cards root ────────────────────────────────────────────────────────────────
const _cardsRoot = document.createElementNS(_svgNS, 'g');
_svg.appendChild(_cardsRoot);

// ── Travel dot ────────────────────────────────────────────────────────────────
const _dot = document.createElementNS(_svgNS, 'circle');
_dot.setAttribute('r', '5.5');
_dot.setAttribute('fill', '#00d4ff');
_dot.style.filter = 'drop-shadow(0 0 5px #00d4ff) drop-shadow(0 0 10px #0a8fff)';
// dot is appended after cards so it renders on top

_wrap.appendChild(_svg);
document.body.appendChild(_wrap);

// ── CSS ───────────────────────────────────────────────────────────────────────
const _style = document.createElement('style');
_style.textContent = `
._hiw-connector { stroke: #1e3a5f; stroke-width: 1.5; stroke-dasharray: 4 4; }
._hiw-node-ring { fill: #080d24; stroke: #0a8fff; stroke-width: 2; }
._hiw-node-inner { fill: #00d4ff; }
._hiw-card-group { transition: filter 0.35s ease-in-out; }
._hiw-card-group.active { filter: drop-shadow(0 8px 18px rgba(0,212,255,0.4)); }
._hiw-card-title { fill: #e8f4ff; font-size: 13px; font-weight: 600; font-family: system-ui,sans-serif; dominant-baseline: middle; text-anchor: middle; }
._hiw-card-caption { fill: #8bc8f0; font-size: 10px; letter-spacing: 0.08em; font-family: ui-monospace,Consolas,monospace; dominant-baseline: middle; text-anchor: middle; }
`;
document.head.appendChild(_style);

// ── Build nodes & cards ───────────────────────────────────────────────────────
const NODE_T = [0.14, 0.36, 0.64, 0.86];

// These are populated lazily on first show (path length needs layout)
let _built      = false;
const _nodeRings  = [];
const _nodeInners = [];
const _cardGroups = [];
const _origCardY  = []; // store original Y for reset

function _build() {
  if (_built) return;
  _built = true;

  const totalLen = _archPath.getTotalLength();

  NODE_T.forEach((t, i) => {
    const pt = _archPath.getPointAtLength(t * totalLen);

    // connector
    const conn = document.createElementNS(_svgNS, 'line');
    conn.setAttribute('class', '_hiw-connector');
    conn.setAttribute('x1', pt.x); conn.setAttribute('y1', pt.y + 8);
    conn.setAttribute('x2', pt.x); conn.setAttribute('y2', pt.y + 8 + CONN_LEN);
    _cardsRoot.appendChild(conn);

    // card
    const cardY = pt.y + 8 + CONN_LEN;
    const cardX = pt.x - CARD_W / 2;
    _origCardY.push(cardY);

    const g = document.createElementNS(_svgNS, 'g');
    g.setAttribute('class', '_hiw-card-group');
    g.setAttribute('transform', `translate(${cardX},${cardY})`);

    const bg = document.createElementNS(_svgNS, 'rect');
    bg.setAttribute('width', CARD_W); bg.setAttribute('height', CARD_H);
    bg.setAttribute('rx', 10);
    bg.setAttribute('stroke', '#1a4a7a'); bg.setAttribute('stroke-width', 1);
    bg.setAttribute('fill', 'rgba(10,20,50,0.88)');
    g.appendChild(bg);

    const imgEl = document.createElementNS(_svgNS, 'image');
    imgEl.setAttribute('x', 8); imgEl.setAttribute('y', 8);
    imgEl.setAttribute('width', CARD_W - 16); imgEl.setAttribute('height', IMG_H);
    imgEl.setAttribute('href', CARDS[i].img);
    imgEl.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    imgEl.setAttribute('clip-path', `url(#_card-clip-${i})`);
    g.appendChild(imgEl);

    const titleEl = document.createElementNS(_svgNS, 'text');
    titleEl.setAttribute('class', '_hiw-card-title');
    titleEl.setAttribute('x', CARD_W / 2); titleEl.setAttribute('y', 8 + IMG_H + 18);
    titleEl.textContent = CARDS[i].title;
    g.appendChild(titleEl);

    const capEl = document.createElementNS(_svgNS, 'text');
    capEl.setAttribute('class', '_hiw-card-caption');
    capEl.setAttribute('x', CARD_W / 2); capEl.setAttribute('y', 8 + IMG_H + 36);
    capEl.textContent = CARDS[i].caption;
    g.appendChild(capEl);

    _cardsRoot.appendChild(g);
    _cardGroups.push(g);

    // node ring
    const ring = document.createElementNS(_svgNS, 'circle');
    ring.setAttribute('class', '_hiw-node-ring');
    ring.setAttribute('cx', pt.x); ring.setAttribute('cy', pt.y); ring.setAttribute('r', 8);
    _cardsRoot.appendChild(ring);
    _nodeRings.push(ring);

    const inner = document.createElementNS(_svgNS, 'circle');
    inner.setAttribute('class', '_hiw-node-inner');
    inner.setAttribute('cx', pt.x); inner.setAttribute('cy', pt.y); inner.setAttribute('r', 3.5);
    _cardsRoot.appendChild(inner);
    _nodeInners.push(inner);
  });

  _cardsRoot.appendChild(_dot);
  // Place dot at start
  const startPt = _archPath.getPointAtLength(NODE_T[0] * _archPath.getTotalLength());
  _dot.setAttribute('cx', startPt.x);
  _dot.setAttribute('cy', startPt.y);
}

// ── Animation ─────────────────────────────────────────────────────────────────
const TRAVEL_MS = 7000, PAUSE_MS = 700, PULSE_MS = 380;

let _rafId     = null;
let _startTime = null;
let _pauseUntil = 0;
let _activeNode = -1;
const _pulsing = new Set();

function _setDotPos(len) {
  const pt = _archPath.getPointAtLength(len);
  _dot.setAttribute('cx', pt.x);
  _dot.setAttribute('cy', pt.y);
}

function _triggerPulse(i) {
  if (_pulsing.has(i)) return;
  _pulsing.add(i);

  const g    = _cardGroups[i];
  g.classList.add('active');
  const cardX = pt_x(g);
  const cardY0 = _origCardY[i];
  g.setAttribute('transform', `translate(${cardX},${cardY0 - 6})`);

  const ring = _nodeRings[i];
  let t0 = null;
  function animRing(ts) {
    if (!t0) t0 = ts;
    const p = Math.min((ts - t0) / PULSE_MS, 1);
    const scale = p < 0.5 ? p * 2 : (1 - p) * 2;
    ring.setAttribute('r', 8 + scale * 5);
    if (p < 1) requestAnimationFrame(animRing);
    else { ring.setAttribute('r', 8); _pulsing.delete(i); }
  }
  requestAnimationFrame(animRing);

  setTimeout(() => {
    g.classList.remove('active');
    g.setAttribute('transform', `translate(${cardX},${cardY0})`);
  }, PAUSE_MS + 80);
}

function pt_x(g) {
  return parseFloat(g.getAttribute('transform').match(/translate\(([^,]+)/)[1]);
}

function _resetAll() {
  _nodeRings.forEach(r => r.setAttribute('r', 8));
  _cardGroups.forEach((g, i) => {
    const cx = pt_x(g);
    g.setAttribute('transform', `translate(${cx},${_origCardY[i]})`);
    g.classList.remove('active');
  });
  _pulsing.clear();
  _activeNode = -1;
}

function _tick(ts) {
  _rafId = requestAnimationFrame(_tick);

  if (!_startTime) {
    _startTime = ts;
    const totalLen = _archPath.getTotalLength();
    _setDotPos(NODE_T[0] * totalLen);
    return;
  }

  if (ts < _pauseUntil) return;

  const totalLen   = _archPath.getTotalLength();
  const nodeLens   = NODE_T.map(t => t * totalLen);
  const startLen   = nodeLens[0];
  const travelSpan = nodeLens[nodeLens.length - 1] - startLen;

  const elapsed  = ts - _startTime;
  const progress = Math.min(elapsed / TRAVEL_MS, 1);
  const ease = progress < 0.5
    ? 4 * progress ** 3
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;

  const currentLen = startLen + ease * travelSpan;
  _setDotPos(currentLen);

  for (let i = 0; i < nodeLens.length; i++) {
    if (_activeNode !== i && Math.abs(currentLen - nodeLens[i]) < 4) {
      _activeNode = i;
      _triggerPulse(i);
      _pauseUntil = ts + PAUSE_MS;
      _startTime  = ts + PAUSE_MS - elapsed;
      return;
    }
  }

  if (progress >= 1) {
    _startTime  = null;
    _pauseUntil = ts + 1200;
    _resetAll();
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export function showHowIWorkOverlay() {
  _build();
  _resetAll();
  _startTime  = null;
  _pauseUntil = 0;
  _activeNode = -1;

  _wrap.style.opacity = '1';

  if (_rafId) cancelAnimationFrame(_rafId);
  _rafId = requestAnimationFrame(_tick);
}

export function hideHowIWorkOverlay() {
  _wrap.style.opacity = '0';
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
}

