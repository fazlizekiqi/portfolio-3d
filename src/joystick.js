/**
 * joystick.js — On-screen virtual joystick for mobile / touch devices.
 *
 * Shows only on touch-capable screens (hidden when mouse is the primary input).
 * Feeds the same key-state object that player.js already reads so no player
 * logic needs changing.
 *
 * Layout
 * ──────
 *   Left side  – movement joystick  (W/A/S/D simulation)
 *   Right side – sprint button      (ShiftLeft simulation)
 *
 * Public API
 * ──────────
 *   initJoystick()          – call once after DOM is ready (or any time)
 *   showJoystick()          – make visible (called when player takes control)
 *   hideJoystick()          – hide  (called when player releases control)
 *   getJoystickKeys()       – returns the live keys object {code:bool}
 *   destroyJoystick()       – remove from DOM
 */

// ── Touch-device detection ────────────────────────────────────────────────────
// Only show the joystick on genuine touch screens (phones / tablets).
// We check navigator.maxTouchPoints rather than a UA sniff so it works on
// desktop-mode emulators too (they report 0).
const _isTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
const _keys = {};

// ── Joystick geometry ─────────────────────────────────────────────────────────
const STICK_RADIUS  = 56;   // outer ring radius in px
const THUMB_RADIUS  = 20;   // moveable dot radius in px
const DEAD_ZONE     = 0.18; // normalised magnitude below which = no input

// ── DOM ───────────────────────────────────────────────────────────────────────
let _root     = null;
let _joyEl    = null;
let _sprintEl = null;
let _thumb    = null;

let _joyTouch    = null;
let _joyCenter   = { x: 0, y: 0 };
let _joyActive   = false;
let _sprintTouch = null;

function _createDOM() {
  // ── Styles ──────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.id = '_joy-style';
  style.textContent = `
/* ── Desktop guard: hide entirely when device has a real pointer ── */
@media (hover:hover) and (pointer:fine) {
  #_joy-root { display:none !important; }
}

#_joy-root {
  position:fixed;inset:0;z-index:50;
  pointer-events:none;
  user-select:none;-webkit-user-select:none;
  display:none;
  font-family:'Share Tech Mono','Courier New',monospace;
}
#_joy-root.visible { display:block; }

/* ════════════════════════════════════════════════
   JOYSTICK RING  — toon ink style
   matches the BACK / WASD key-cap: white fill,
   black ink border, offset drop-shadow
   ════════════════════════════════════════════════ */
#_joy-stick {
  position:absolute;
  bottom:32px;left:32px;
  width:${STICK_RADIUS * 2}px;
  height:${STICK_RADIUS * 2}px;
  border-radius:50%;
  background:#ffffff;
  border:2px solid #111111;
  box-shadow:3px 3px 0 #111111;
  pointer-events:auto;
  touch-action:none;
}

/* four cardinal tick marks — thin black lines at N/E/S/W */
#_joy-stick::before {
  content:'';
  position:absolute;inset:0;border-radius:50%;
  background:
    conic-gradient(
      transparent 0deg,
      #11111122 0.8deg,
      transparent 1.6deg,
      transparent 89.2deg,
      #11111122 90deg,
      transparent 90.8deg,
      transparent 179.2deg,
      #11111122 180deg,
      transparent 180.8deg,
      transparent 269.2deg,
      #11111122 270deg,
      transparent 270.8deg
    );
  pointer-events:none;
}

/* ── cardinal labels ── */
#_joy-labels {
  position:absolute;inset:0;pointer-events:none;
}
#_joy-labels span {
  position:absolute;
  font-size:9px;font-weight:600;letter-spacing:0;
  color:rgba(0,0,0,0.22);
}
#_joy-n { top:8px;   left:50%;transform:translateX(-50%); }
#_joy-s { bottom:8px;left:50%;transform:translateX(-50%); }
#_joy-w { left:8px;  top:50%; transform:translateY(-50%); }
#_joy-e { right:8px; top:50%; transform:translateY(-50%); }

/* ── thumb puck — same key-cap toon style, square ── */
#_joy-thumb {
  position:absolute;
  width:${THUMB_RADIUS * 2}px;
  height:${THUMB_RADIUS * 2}px;
  border-radius:4px;
  background:#ffffff;
  border:2px solid #111111;
  box-shadow:2px 2px 0 #111111;
  top:50%;left:50%;
  transform:translate(-50%,-50%);
  pointer-events:none;
  transition:background .07s, box-shadow .07s, transform .07s, border-color .07s;
}
/* crosshair */
#_joy-thumb::before,
#_joy-thumb::after {
  content:'';position:absolute;
  background:rgba(0,0,0,0.18);border-radius:1px;
}
#_joy-thumb::before { width:10px;height:1.5px;top:50%;left:50%;transform:translate(-50%,-50%); }
#_joy-thumb::after  { width:1.5px;height:10px;top:50%;left:50%;transform:translate(-50%,-50%); }

/* active: cyan pressed state — same as ._hk.pressed */
#_joy-stick.active #_joy-thumb {
  background:#c8f5ff;
  border-color:#005566;
  box-shadow:1px 1px 0 #005566;
  transform:translate(calc(-50% + 1px), calc(-50% + 1px));
}

/* ════════════════════════════════════════════════
   RUN BUTTON — exact same toon key-cap as BACK
   ════════════════════════════════════════════════ */
#_joy-sprint {
  position:absolute;
  bottom:40px;right:40px;
  width:64px;height:64px;
  border-radius:4px;
  background:#ffffff;
  border:2px solid #111111;
  box-shadow:2px 2px 0 #111111;
  pointer-events:auto;
  touch-action:none;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
  color:#111111;
  font-size:8px;font-weight:600;letter-spacing:.18em;
  transition:background .07s, box-shadow .07s, transform .07s, border-color .07s, color .07s;
}
/* » chevron icon rotated to point up */
#_joy-sprint::before {
  content:'»';
  font-size:15px;font-weight:700;color:#111111;
  transform:rotate(-90deg);
  line-height:1;
  transition:color .07s;
}
/* active: cyan pressed state */
#_joy-sprint.active {
  background:#c8f5ff;
  color:#003344;
  border-color:#005566;
  box-shadow:1px 1px 0 #005566;
  transform:translate(1px,1px);
}
#_joy-sprint.active::before { color:#003344; }
`;
  document.head.appendChild(style);

  // ── Root wrapper ──────────────────────────────────────────────────────────
  _root = document.createElement('div');
  _root.id = '_joy-root';

  // ── Left joystick ─────────────────────────────────────────────────────────
  _joyEl = document.createElement('div');
  _joyEl.id = '_joy-stick';

  // Cardinal labels
  const labels = document.createElement('div');
  labels.id = '_joy-labels';
  labels.innerHTML = `
    <span id="_joy-n">▲</span>
    <span id="_joy-s">▼</span>
    <span id="_joy-w">◀</span>
    <span id="_joy-e">▶</span>
  `;
  _joyEl.appendChild(labels);

  // Thumb puck
  _thumb = document.createElement('div');
  _thumb.id = '_joy-thumb';
  _joyEl.appendChild(_thumb);

  _root.appendChild(_joyEl);

  // ── Sprint button ──────────────────────────────────────────────────────────
  _sprintEl = document.createElement('div');
  _sprintEl.id = '_joy-sprint';
  _sprintEl.innerHTML = `<span>RUN</span>`;
  _root.appendChild(_sprintEl);

  document.body.appendChild(_root);
}

// ── Touch helpers ──────────────────────────────────────────────────────────────

function _setKeys(nx, ny) {
  _keys['KeyW'] = ny < -DEAD_ZONE;
  _keys['KeyS'] = ny >  DEAD_ZONE;
  _keys['KeyA'] = nx < -DEAD_ZONE;
  _keys['KeyD'] = nx >  DEAD_ZONE;
}

function _clearMoveKeys() {
  _keys['KeyW'] = false;
  _keys['KeyS'] = false;
  _keys['KeyA'] = false;
  _keys['KeyD'] = false;
}

function _updateThumb(nx, ny) {
  if (!_thumb) return;
  const dx = nx * STICK_RADIUS;
  const dy = ny * STICK_RADIUS;
  // When active the CSS rule shifts +1px to simulate ink-shadow collapse;
  // compensate so the centring base stays correct.
  const offset = _joyActive ? 1 : 0;
  _thumb.style.transform = `translate(calc(-50% + ${dx + offset}px), calc(-50% + ${dy + offset}px))`;
}

// ── Joystick touch events ──────────────────────────────────────────────────────

function _onJoyStart(e) {
  e.preventDefault();
  if (_joyTouch !== null) return;

  const touch  = e.changedTouches[0];
  _joyTouch    = touch.identifier;
  _joyActive   = true;

  const rect   = _joyEl.getBoundingClientRect();
  _joyCenter.x = rect.left + rect.width  * 0.5;
  _joyCenter.y = rect.top  + rect.height * 0.5;

  _joyEl.classList.add('active');
  _processJoyMove(touch.clientX, touch.clientY);
}

function _onJoyMove(e) {
  e.preventDefault();
  if (!_joyActive) return;
  for (const touch of e.changedTouches) {
    if (touch.identifier === _joyTouch) {
      _processJoyMove(touch.clientX, touch.clientY);
      break;
    }
  }
}

function _onJoyEnd(e) {
  for (const touch of e.changedTouches) {
    if (touch.identifier === _joyTouch) {
      _joyTouch  = null;
      _joyActive = false;
      _clearMoveKeys();
      _updateThumb(0, 0);
      _joyEl.classList.remove('active');
      break;
    }
  }
}

function _processJoyMove(cx, cy) {
  const dx  = cx - _joyCenter.x;
  const dy  = cy - _joyCenter.y;
  const mag = Math.sqrt(dx * dx + dy * dy);

  const clampedMag = Math.min(mag, STICK_RADIUS);
  const nx = mag === 0 ? 0 : dx / mag;
  const ny = mag === 0 ? 0 : dy / mag;
  const normX = nx * (clampedMag / STICK_RADIUS);
  const normY = ny * (clampedMag / STICK_RADIUS);

  _updateThumb(normX, normY);
  _setKeys(normX, normY);
}

// ── Sprint touch events ────────────────────────────────────────────────────────

function _onSprintStart(e) {
  e.preventDefault();
  if (_sprintTouch !== null) return;
  _sprintTouch = e.changedTouches[0].identifier;
  _keys['ShiftLeft'] = true;
  _sprintEl.classList.add('active');
}

function _onSprintEnd(e) {
  for (const touch of e.changedTouches) {
    if (touch.identifier === _sprintTouch) {
      _sprintTouch = null;
      _keys['ShiftLeft'] = false;
      _sprintEl.classList.remove('active');
      break;
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

let _initialised = false;

export function initJoystick() {
  if (!_isTouch) return;          // desktop — skip entirely
  if (_initialised) return;
  _initialised = true;

  _createDOM();

  _joyEl.addEventListener('touchstart',  _onJoyStart, { passive: false });
  _joyEl.addEventListener('touchmove',   _onJoyMove,  { passive: false });
  _joyEl.addEventListener('touchend',    _onJoyEnd,   { passive: false });
  _joyEl.addEventListener('touchcancel', _onJoyEnd,   { passive: false });

  _sprintEl.addEventListener('touchstart',  _onSprintStart, { passive: false });
  _sprintEl.addEventListener('touchend',    _onSprintEnd,   { passive: false });
  _sprintEl.addEventListener('touchcancel', _onSprintEnd,   { passive: false });
}

export function showJoystick() {
  if (!_isTouch || !_root) return;
  _root.classList.add('visible');
}

export function hideJoystick() {
  if (!_root) return;
  _root.classList.remove('visible');
  _clearMoveKeys();
  _keys['ShiftLeft'] = false;
  if (_sprintEl) _sprintEl.classList.remove('active');
  if (_joyEl)    _joyEl.classList.remove('active');
  _updateThumb(0, 0);
}

export function destroyJoystick() {
  hideJoystick();
  if (_root) { _root.remove(); _root = null; }
  const s = document.getElementById('_joy-style');
  if (s) s.remove();
  _initialised = false;
}

/**
 * Returns the live synthetic key map.
 * player.js merges this with its own keyboard map each tick.
 */
export function getJoystickKeys() {
  return _keys;
}

