/**
 * about-view.js
 *
 * Synchronized "About Me" visual sequence (≈18 s) — orchestrator. Owns the
 * 5-phase timeline math (settle/particles/burn/build/outro) and drives the
 * character burn shader (about-burn.js), the hologram ghost (about-ghost.js)
 * and the DOM biometric panel (about-ui.js) every frame.
 *
 *   0.0–1.8  SETTLE      — character transitions to T-pose (briefcase-standing)
 *   1.8–2.8  PARTICLES   — vertex cloud scatters in around the T-pose
 *   2.8–5.5  BURN        — per-fragment noise dissolve sweeps HEAD → FEET:
 *                          the character mesh literally burns away like paper —
 *                          noisy jagged edge, cyan→gold glow at the boundary,
 *                          the hologram ghost reveals beneath as fragments are
 *                          discarded. DOM scan labels appear per body region.
 *   5.5+     BUILD       — hologram glow ramps up, electric pulses, oscillation
 *
 * The ghost is a fresnel HOLOGRAM shell (bright rim, faint fill, scanlines)
 * plus ONE low-opacity wireframe pass — the old triple wireframe stack was so
 * dense on the high-poly mesh that it read as a solid blob.
 *
 * The burn is a SHADER inject — no opacity/transparent hacks.
 * uBurnY uniform drives the dissolve: 999 = full char, sweeps to -999 = gone.
 * castShadow is disabled while burning — the shadow pass ignores the discard
 * and would keep a full character shadow on the ground.
 */

import * as THREE from 'three';
import { renderer } from '../../../scene.js';
import { audio } from '../../../audio.js';
import { createBurnUniforms, injectBurnIntoMat, setBurnY, setBurnTime } from './about-burn.js';
import {
  initGhost, resetGhost, setDots, setHolo, setWire, setScanPlane, setSway,
  setBurnStripe, hideGhost, fadeOutGhost,
} from './about-ghost.js';
import {
  resetAboutUI, setBioOpacity, showBar, setRowVisible, setProgress,
  setDoneVisible, setScanLine, hideAboutUI,
} from './about-ui.js';

// ── Timing ────────────────────────────────────────────────────────────────────
const T_HEADER_IN     = 0.5;
const T_DOTS_START    = 3.2;   // particles start AFTER T-pose fully settled
const T_DOTS_END      = 4.4;
const T_DOTS_FADE_OUT = 4.0;
const T_BURN_START    = 3.8;   // burn starts after T-pose is held for ~1.5s
const T_BURN_END      = 7.0;
const T_BUILD_START   = 6.5;
const T_OUTRO_START   = 13.0;  // hologram burns head→feet, character re-materializes feet→head
const T_OUTRO_END     = 17.0;  // outro complete — character fully back, ghost gone
const PULSE_INTERVAL  = 1.8;
const PULSE_DECAY     = 0.28;
const ROW_BURN_T      = [0.12, 0.35, 0.60, 0.82];

// ── Ghost look ────────────────────────────────────────────────────────────────
const WIRE_MAX_OP   = 0.55;  // electricity shader opacity gate — higher = more visible
const HOLO_BUILD_OP = 1.00;  // hologram opacity — full brightness throughout all phases

// ── Module state ──────────────────────────────────────────────────────────────
let _initialized  = false;
let _charMeshes   = [];
let _shadowOff    = false;
let _yMin = 0, _yMax = 2;
let _burnUniforms = []; // [{ uBurnY, uBurnEdge, uBurnTime }]

let _active    = false;
let _slideTime = 0;
let _nextPulse = PULSE_INTERVAL;
let _pulseT    = 0;
let _rowsDone  = [false,false,false,false];
let _doneDone  = false;
let _outroDone = false;

// ── Init ──────────────────────────────────────────────────────────────────────
export function initAboutWireframe(charMeshes, modelGroup) {
  renderer.localClippingEnabled = true;
  _charMeshes = charMeshes;

  const box = new THREE.Box3().setFromObject(modelGroup);
  _yMin = box.min.y - 0.05;
  _yMax = box.max.y + 0.05;

  // ── Inject burn shader into every character material ─────────────────────
  // Guard against shared material instances — a double inject would redeclare
  // the varying and break the shader compile (character would never burn).
  const _injected = new Set();
  charMeshes.forEach(mesh => {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach(mat => {
      if (_injected.has(mat)) return;
      _injected.add(mat);
      const uni = createBurnUniforms();
      _burnUniforms.push(uni);
      injectBurnIntoMat(mat, uni);
    });
  });

  initGhost(charMeshes, modelGroup, _yMax);

  _initialized = true;
}

// ── Show ──────────────────────────────────────────────────────────────────────
export function showAboutWireframe(onTPoseCue) {
  if (!_initialized) return;

  _slideTime = 0; _nextPulse = PULSE_INTERVAL; _pulseT = 0;
  _rowsDone = [false,false,false,false]; _doneDone = false; _outroDone = false;
  _active = true;

  // Reset: ghost fully clipped (not visible), burn not started
  resetGhost(_yMax);

  // Character casts its full shadow again until the burn starts
  _shadowOff = false;
  _charMeshes.forEach(m => { m.castShadow = true; });

  // Char burn: 999 = nothing burned (full character)
  setBurnY(_burnUniforms, 999.0);
  setBurnTime(_burnUniforms, 0.0);

  // DOM reset
  resetAboutUI();

  if (onTPoseCue) onTPoseCue();
  setTimeout(() => { if (_active) setBioOpacity(1); }, T_HEADER_IN * 1000);
  setTimeout(() => { if (_active) showBar(); }, T_BURN_START * 1000 - 300);
}

// ── Hide ──────────────────────────────────────────────────────────────────────
export function hideAboutWireframe() {
  if (!_initialized) return;
  _active = false;
  hideAboutUI();
  // Reset burn — character fully visible (and casting shadow) on other slides
  setBurnY(_burnUniforms, 999.0);
  _shadowOff = false;
  _charMeshes.forEach(m => { m.castShadow = true; });
  // Reset hologram outro clip so it's clean for the next show
  setHolo({ clipYMax: 999.0 });

  fadeOutGhost(700, () => hideGhost());
}

// ── Per-frame tick ─────────────────────────────────────────────────────────────
export function tickAboutWireframe(delta) {
  if (!_active || !_initialized) return;
  _slideTime += delta;
  const t = _slideTime;

  // ── Particles ─────────────────────────────────────────────────────────────
  if (t >= T_DOTS_START) {
    const settle = _clamp01((t - T_DOTS_START) / (T_DOTS_END - T_DOTS_START));
    let opacity;
    if (t < T_DOTS_FADE_OUT) {
      opacity = _easeOut(_clamp01((t - T_DOTS_START) / 0.8)) * 0.072;
    } else {
      const fo = _clamp01((t - T_DOTS_FADE_OUT) / (T_BURN_END - T_DOTS_FADE_OUT));
      opacity = 0.072 * (1 - _easeIn(fo));
    }
    setDots(settle, opacity);
  }

  // ── Burn: HEAD → FEET ─────────────────────────────────────────────────────
  // !_doneDone guard: once complete, uBurnY stays at -999 (fully discarded).
  // Without it this block re-sets uBurnY to _yMin every frame and noise keeps
  // a band of foot fragments alive — the character never fully disappeared.
  if (t >= T_BURN_START && !_doneDone) {
    // The shadow pass ignores the burn discard — kill the shadow when burning
    if (!_shadowOff) {
      _shadowOff = true;
      _charMeshes.forEach(m => { m.castShadow = false; });
    }

    const sp    = _clamp01((t - T_BURN_START) / (T_BURN_END - T_BURN_START));
    const eased = _easeInOut(sp);

    // World-Y of the burn front — sweeps yMax → yMin (top to bottom)
    const burnY = _yMax - (_yMax - _yMin) * eased;

    // Drive character shader burn front
    setBurnY(_burnUniforms, burnY);
    setBurnTime(_burnUniforms, t);

    // Ghost reveal follows the burn front — exactly the burned region.
    // Plane normal=(0,1,0), constant c: discards y < -c → set c=-burnY → shows y > burnY
    // Full brightness from the first burned pixel — same as outro ghost above revealY.
    setScanPlane(-burnY);
    setHolo({ clipY: burnY, clipYMax: 999.0, opacity: HOLO_BUILD_OP, pulse: 0.0 });
    setWire({ clipY: burnY, opacity: WIRE_MAX_OP });

    // Burn-edge glow stripe at the burn front
    const stripeVisible = sp > 0.005 && sp < 0.995;
    setBurnStripe(stripeVisible
      ? { visible: true, y: burnY, opacity: Math.sin(sp * Math.PI) * 1.1 }
      : { visible: false });

    // Screen scan line
    setScanLine(sp > 0.02 && sp < 0.98 ? '1' : '0', 4 + eased * 88);

    // Progress bar
    const pv = Math.round(sp * 100);
    setProgress(pv);

    // DOM rows at body-region milestones
    ROW_BURN_T.forEach((thr, i) => {
      if (!_rowsDone[i] && sp >= thr) {
        _rowsDone[i] = true;
        setRowVisible(i);
        audio.playScanBeep();
      }
    });

    // Complete
    if (!_doneDone && sp >= 0.98) {
      _doneDone = true;
      setProgress(100);
      setScanLine('0');
      setBurnStripe({ visible: false });
      // Character fully burned away — only the hologram ghost remains
      setBurnY(_burnUniforms, -999.0);
      setScanPlane(-_yMin + 0.1);
      setHolo({ clipY: _yMin - 0.1 });
      setWire({ clipY: _yMin - 0.1 });  // fully open — wire visible everywhere
      setTimeout(() => { if (_active) setDoneVisible(); }, 300);
    }
  }

  // ── Build: glow + pulses (stops when outro begins) ───────────────────────
  setHolo({ time: t });
  if (t >= T_BUILD_START && t < T_OUTRO_START && !_outroDone) {
    // Opacity is already at HOLO_BUILD_OP from the intro burn — no ramp needed.
    setHolo({ opacity: HOLO_BUILD_OP });
    setSway(Math.sin(t * 0.45) * 0.12);

    _nextPulse -= delta;
    if (_nextPulse <= 0) { _nextPulse = PULSE_INTERVAL + Math.random() * 1.6; _pulseT = 1.0; }
    if (_pulseT > 0) {
      _pulseT = Math.max(0, _pulseT - delta / PULSE_DECAY);
      const s = _pulseT * _pulseT;
      setHolo({ pulse: s });
      setWire({ opacity: WIRE_MAX_OP + s * 0.10 });
    } else {
      setHolo({ pulse: 0.0 });
    }
  }

  // ── Outro: shared boundary sweeps FEET → HEAD ────────────────────────────
  // Exact mirror of the intro (which swept HEAD → FEET):
  //   above the boundary → wireframe/ghost visible, character burned away
  //   below the boundary → character visible (revealed), ghost clipped out
  // Both the character uBurnY and the ghost uClipY track the SAME revealY.
  if (t >= T_OUTRO_START && !_outroDone) {
    const op    = _clamp01((t - T_OUTRO_START) / (T_OUTRO_END - T_OUTRO_START));
    const eased = _easeInOut(op);

    // Shared boundary: starts just below feet, sweeps upward past the head
    const revealY = _yMin - 0.2 + (_yMax - _yMin + 0.4) * eased;
    const clipY   = Math.min(revealY, _yMax);  // keep clip within model bounds

    // 1. Character: reveal everything BELOW the boundary
    //    The burn shader discards vBurnWorldY > uBurnY+noise; raising uBurnY
    //    uncovers fragments from the bottom upward.
    setBurnY(_burnUniforms, revealY);
    setBurnTime(_burnUniforms, t);

    // Re-enable shadow casting once the lower half has materialised
    if (_shadowOff && op > 0.35) {
      _shadowOff = false;
      _charMeshes.forEach(m => { m.castShadow = true; });
    }

    // 2. Ghost: show only ABOVE the boundary (same uClipY logic as intro)
    //    uClipY rises from yMin → yMax, clipping ghost from the bottom up.
    setScanPlane(-clipY);
    setHolo({ clipY, clipYMax: 999.0, opacity: HOLO_BUILD_OP, pulse: 0.0 });
    setWire({ opacity: WIRE_MAX_OP, clipY });  // clip (not fade) handles the hide
    // Settle the gentle sway back to forward-facing
    setSway(Math.sin(T_OUTRO_START * 0.45) * 0.12 * (1.0 - eased));

    // 3. Burn-edge glow at the shared boundary (moving upward)
    const glowActive = clipY > _yMin && clipY < _yMax;
    setBurnStripe(glowActive
      ? { visible: true, y: clipY, opacity: Math.sin(op * Math.PI) * 1.1 }
      : { visible: false });

    // 4. Scan line sweeps UPWARD (reversal of the intro downward pass)
    setScanLine(op > 0.02 && op < 0.98 ? '1' : '0', 92 - eased * 88);

    // 5. DOM biometric panel fades out during the first half of the outro
    setBioOpacity(Math.max(0, 1.0 - op * 2.5).toFixed(3));

    // 6. Progress bar reverses to 0
    setProgress(Math.round((1.0 - op) * 100));

    // Complete — character is fully back, ghost fully gone
    if (op >= 1.0) {
      _outroDone = true;
      setScanLine('0');
      setBurnStripe({ visible: false });
      setBurnY(_burnUniforms, 999.0);
      setHolo({ clipYMax: 999.0, opacity: 0.0 });
      setWire({ opacity: 0 });
      hideGhost();
      setBioOpacity(0);
      _shadowOff = false;
      _charMeshes.forEach(m => { m.castShadow = true; });
    }
  }
}

// ── Easing ────────────────────────────────────────────────────────────────────
function _clamp01(v)   { return Math.max(0, Math.min(1, v)); }
function _easeOut(t)   { return 1 - (1-t)*(1-t); }
function _easeIn(t)    { return t*t; }
function _easeInOut(t) { return t<0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }
