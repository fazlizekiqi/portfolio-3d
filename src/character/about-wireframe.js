/**
 * about-wireframe.js
 *
 * Synchronized "About Me" visual sequence (≈18 s):
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
import { scene, renderer } from '../scene.js';
import { audio } from '../audio.js';
import { buildBioScanHTML } from '../presentation/slides/about/about.templates.js';
import '../presentation/slides/about/about-bioscan.css';
import _holoVert from '../shaders/about-holo.vert.glsl?raw';
import _holoFrag from '../shaders/about-holo.frag.glsl?raw';
import _dotsVert from '../shaders/about-dots.vert.glsl?raw';
import _dotsFrag from '../shaders/about-dots.frag.glsl?raw';
import _burnVert from '../shaders/about-burn-stripe.vert.glsl?raw';
import _burnFrag from '../shaders/about-burn-stripe.frag.glsl?raw';
import _wireVert from '../shaders/about-wire.vert.glsl?raw';
import _wireFrag from '../shaders/about-wire.frag.glsl?raw';
import BURN_VERT_PARS     from '../shaders/about-burn.vert.pars.glsl?raw';
import BURN_VERT_POSITION from '../shaders/about-burn.vert.position.glsl?raw';
import BURN_FRAG_PARS     from '../shaders/about-burn.frag.pars.glsl?raw';
import BURN_FRAG_DISCARD  from '../shaders/about-burn.frag.discard.glsl?raw';

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

// ── Per-material burn shader inject ───────────────────────────────────────────
// uBurnY = 999  → nothing discarded (full char visible)
// uBurnY sweeps from yMax → yMin  → burns head-to-feet
// uBurnY = -999 → everything discarded (fully burned)
function _injectBurnIntoMat(mat, uniforms) {
  const prevOBC = mat.onBeforeCompile;

  mat.onBeforeCompile = (shader) => {
    // 1. Chain existing OBC first (e.g. cartoon effect)
    if (prevOBC) prevOBC(shader);

    // 2. Bind uniforms
    shader.uniforms.uBurnY    = uniforms.uBurnY;
    shader.uniforms.uBurnEdge = uniforms.uBurnEdge;
    shader.uniforms.uBurnTime = uniforms.uBurnTime;

    // 3. Vertex: declare varying + compute world-Y after skinning.
    //    We CANNOT use worldpos_vertex because it's gated behind USE_ENVMAP etc.
    //    After #include <skinning_vertex>, `transformed` holds the skinned position.
    //    Multiply by modelMatrix to get world position.
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `${BURN_VERT_PARS}\n#include <common>`
      )
      .replace(
        '#include <skinning_vertex>',
        `#include <skinning_vertex>\n${BURN_VERT_POSITION}`
      );

    // 4. Fragment: declare varying + uniforms + compact noise functions
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `${BURN_FRAG_PARS}\n#include <common>`
      );

    // 5. Append burn discard + flame glow just before the shader's final closing brace
    const lastBrace = shader.fragmentShader.lastIndexOf('}');
    shader.fragmentShader =
      shader.fragmentShader.slice(0, lastBrace) +
      `\n${BURN_FRAG_DISCARD}\n` +
      shader.fragmentShader.slice(lastBrace);
  };

  // Force a unique cache key so THREE.js never reuses an un-injected program
  mat.customProgramCacheKey = () => 'about_burn_v2';
  mat.needsUpdate = true;
}

// ── DOM — Biometric scan panel (LEFT side) ────────────────────────────────────
// CSS lives in presentation/slides/about/about-bioscan.css (imported above);
// markup is built by buildBioScanHTML() in about.templates.js.
const _bioEl = document.createElement('div');
_bioEl.id = '_bio-scan';
_bioEl.innerHTML = buildBioScanHTML();
document.body.appendChild(_bioEl);

const _scanLine = document.createElement('div');
_scanLine.className = '_bio-scanline';
document.body.appendChild(_scanLine);

const _rows = [0,1,2,3].map(i => _bioEl.querySelector(`#_br${i}`));
const _fill = _bioEl.querySelector('#_brFill');
const _pct  = _bioEl.querySelector('#_brPct');
const _bar  = _bioEl.querySelector('#_brBar');
const _done = _bioEl.querySelector('#_brDone');

// ── Module state ──────────────────────────────────────────────────────────────
let _ghostGroup   = null;
let _wireMat      = null;
let _holoUniforms = null;
let _dotsUniforms = null;
let _scanPlane    = null;
let _burnMesh     = null;
let _burnMat      = null;
let _charMeshes   = [];
let _shadowOff    = false;
let _yMin = 0, _yMax = 2;

// Per-material burn uniforms injected at init
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

  // Clipping plane for wireframe reveal (top → bottom, same direction as burn)
  _scanPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -_yMax);

  // ── Inject burn shader into every character material ─────────────────────
  // Guard against shared material instances — a double inject would redeclare
  // the varying and break the shader compile (character would never burn).
  const _injected = new Set();
  charMeshes.forEach(mesh => {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach(mat => {
      if (_injected.has(mat)) return;
      _injected.add(mat);
      const uni = {
        uBurnY:    { value: 999.0 },  // 999 = nothing burned yet
        uBurnEdge: { value: 0.20  },  // world-units width of burn edge
        uBurnTime: { value: 0.0   },
      };
      _burnUniforms.push(uni);
      _injectBurnIntoMat(mat, uni);
    });
  });

  // ── Ghost group for wireframe (at same position as character) ─────────────
  _ghostGroup = new THREE.Group();
  _ghostGroup.position.copy(modelGroup.position);
  _ghostGroup.quaternion.copy(modelGroup.quaternion);
  _ghostGroup.scale.copy(modelGroup.scale);

  modelGroup.updateWorldMatrix(true, true);

  const _relMat = (mesh) => {
    const rel = new THREE.Matrix4();
    rel.copy(modelGroup.matrixWorld).invert().multiply(mesh.matrixWorld);
    return rel;
  };

  // ── Dots ──────────────────────────────────────────────────────────────────
  _dotsUniforms = { uSettle: { value: 0.0 }, uOpacity: { value: 0.0 } };
  const dotsMat = new THREE.ShaderMaterial({
    vertexShader: _dotsVert, fragmentShader: _dotsFrag,
    uniforms: _dotsUniforms, transparent: true,
    depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
  const dotsGrp = new THREE.Group();
  charMeshes.forEach(mesh => {
    const pos     = mesh.geometry.attributes.position;
    const offsets = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      offsets[i*3]   = (Math.random()-0.5)*2.4;
      offsets[i*3+1] = (Math.random()-0.5)*2.4;
      offsets[i*3+2] = (Math.random()-0.5)*2.4;
    }
    const geo = mesh.geometry.clone();
    geo.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 3));
    const pts = new THREE.Points(geo, dotsMat);
    pts.matrix.copy(_relMat(mesh)); pts.matrixAutoUpdate = false;
    dotsGrp.add(pts);
  });
  _ghostGroup.add(dotsGrp);

  // ── Hologram shell (fresnel rim — carries the ghost's shape) ──────────────
  _holoUniforms = {
    uOpacity:  { value: 0.0 },
    uTime:     { value: 0.0 },
    uClipY:    { value: _yMax },
    uClipYMax: { value: 999.0 },  // 999 = no outro clip active
    uPulse:    { value: 0.0 },
  };
  const holoMat = new THREE.ShaderMaterial({
    vertexShader: _holoVert, fragmentShader: _holoFrag,
    uniforms: _holoUniforms, transparent: true,
    depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending, side: THREE.FrontSide,
  });
  const holoGrp = new THREE.Group();
  charMeshes.forEach(mesh => {
    const shell = new THREE.Mesh(mesh.geometry.clone(), holoMat);
    shell.matrix.copy(_relMat(mesh)); shell.matrixAutoUpdate = false;
    holoGrp.add(shell);
  });
  _ghostGroup.add(holoGrp);

  // ── Electric wireframe (animated current flowing through edges) ──────────
  _wireMat = new THREE.ShaderMaterial({
    vertexShader:   _wireVert,
    fragmentShader: _wireFrag,
    uniforms: {
      uOpacity: { value: 0.0 },
      uTime:    { value: 0.0 },
      uClipY:   { value: 999.0 },  // 999 = everything clipped (invisible at start)
    },
    transparent: true, wireframe: true,
    depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending,
  });
  const wireGrp = new THREE.Group();
  charMeshes.forEach(mesh => {
    const wire = new THREE.Mesh(mesh.geometry.clone(), _wireMat);
    wire.matrix.copy(_relMat(mesh)); wire.matrixAutoUpdate = false;
    wireGrp.add(wire);
  });
  _ghostGroup.add(wireGrp);

  // ── Burn-edge glow stripe ─────────────────────────────────────────────────
  _burnMat = new THREE.ShaderMaterial({
    vertexShader: _burnVert, fragmentShader: _burnFrag,
    uniforms: { uOpacity: { value: 0.0 } },
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  _burnMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.28), _burnMat);
  _burnMesh.visible = false;
  scene.add(_burnMesh);

  _ghostGroup.visible = false;
  scene.add(_ghostGroup);
}

// ── Reset burn uniforms ───────────────────────────────────────────────────────
function _setBurnY(y) {
  _burnUniforms.forEach(u => { u.uBurnY.value = y; });
}
function _setBurnTime(t) {
  _burnUniforms.forEach(u => { u.uBurnTime.value = t; });
}

// ── Show ──────────────────────────────────────────────────────────────────────
export function showAboutWireframe(onTPoseCue) {
  if (!_ghostGroup) return;

  _slideTime = 0; _nextPulse = PULSE_INTERVAL; _pulseT = 0;
  _rowsDone = [false,false,false,false]; _doneDone = false; _outroDone = false;
  _active = true;

  // Reset: ghost fully clipped (not visible), burn not started
  _scanPlane.constant = -_yMax;
  _dotsUniforms.uSettle.value  = 0.0;
  _dotsUniforms.uOpacity.value = 0.0;
  _wireMat.uniforms.uOpacity.value = 0;
  _wireMat.uniforms.uClipY.value   = 999.0;  // fully hidden until burn starts
  _holoUniforms.uOpacity.value = 0.0;
  _holoUniforms.uClipY.value   = _yMax;
  _holoUniforms.uClipYMax.value = 999.0;
  _holoUniforms.uPulse.value   = 0.0;
  _ghostGroup.rotation.y = 0;
  _ghostGroup.visible    = true;

  // Character casts its full shadow again until the burn starts
  _shadowOff = false;
  _charMeshes.forEach(m => { m.castShadow = true; });

  // Char burn: 999 = nothing burned (full character)
  _setBurnY(999.0);
  _setBurnTime(0.0);

  _burnMesh.visible = false;
  _burnMat.uniforms.uOpacity.value = 0;

  // DOM reset
  _rows.forEach(r => r.classList.remove('vis'));
  _done.classList.remove('vis');
  _bar.classList.remove('vis');
  _fill.style.width = '0%'; _pct.textContent = '0%';
  _scanLine.style.opacity = '0';
  _bioEl.style.opacity = '0';

  if (onTPoseCue) onTPoseCue();
  setTimeout(() => { if (_active) _bioEl.style.opacity = '1'; }, T_HEADER_IN * 1000);
  setTimeout(() => { if (_active) _bar.classList.add('vis'); }, T_BURN_START * 1000 - 300);
}

// ── Hide ──────────────────────────────────────────────────────────────────────
export function hideAboutWireframe() {
  if (!_ghostGroup) return;
  _active = false;
  _bioEl.style.opacity    = '0';
  _scanLine.style.opacity = '0';
  _burnMesh.visible       = false;
  // Reset burn — character fully visible (and casting shadow) on other slides
  _setBurnY(999.0);
  _shadowOff = false;
  _charMeshes.forEach(m => { m.castShadow = true; });
  // Reset hologram outro clip so it's clean for the next show
  if (_holoUniforms) _holoUniforms.uClipYMax.value = 999.0;

  const sD = _dotsUniforms.uOpacity.value;
  const sW = _wireMat.uniforms.uOpacity.value;
  const sH = _holoUniforms.uOpacity.value;
  const t0 = performance.now();
  (function fade(ts) {
    const p = Math.min((ts - t0) / 700, 1);
    _dotsUniforms.uOpacity.value     = sD * (1 - p);
    _wireMat.uniforms.uOpacity.value = sW * (1 - p);
    _holoUniforms.uOpacity.value     = sH * (1 - p);
    if (p < 1) requestAnimationFrame(fade);
    else _ghostGroup.visible = false;
  })(performance.now());
}

// ── Per-frame tick ─────────────────────────────────────────────────────────────
export function tickAboutWireframe(delta) {
  if (!_active || !_ghostGroup) return;
  _slideTime += delta;
  const t = _slideTime;

  // ── Particles ─────────────────────────────────────────────────────────────
  if (t >= T_DOTS_START) {
    _dotsUniforms.uSettle.value = _clamp01((t - T_DOTS_START) / (T_DOTS_END - T_DOTS_START));
    if (t < T_DOTS_FADE_OUT) {
      _dotsUniforms.uOpacity.value = _easeOut(_clamp01((t - T_DOTS_START) / 0.8)) * 0.072;
    } else {
      const fo = _clamp01((t - T_DOTS_FADE_OUT) / (T_BURN_END - T_DOTS_FADE_OUT));
      _dotsUniforms.uOpacity.value = 0.072 * (1 - _easeIn(fo));
    }
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
    _setBurnY(burnY);
    _setBurnTime(t);

    // Ghost reveal follows the burn front — exactly the burned region.
    // Plane normal=(0,1,0), constant c: discards y < -c → set c=-burnY → shows y > burnY
    // Full brightness from the first burned pixel — same as outro ghost above revealY.
    _scanPlane.constant           = -burnY;
    _holoUniforms.uClipY.value    = burnY;
    _wireMat.uniforms.uClipY.value = burnY;   // wire clips below burn front (in-shader)
    _holoUniforms.uClipYMax.value = 999.0;      // no top clip during intro
    _holoUniforms.uOpacity.value  = HOLO_BUILD_OP;  // match outro brightness
    _holoUniforms.uPulse.value    = 0.0;
    _wireMat.uniforms.uOpacity.value = WIRE_MAX_OP;

    // Burn-edge glow stripe at the burn front
    _burnMesh.visible = sp > 0.005 && sp < 0.995;
    if (_burnMesh.visible) {
      _burnMesh.position.set(_ghostGroup.position.x, burnY, _ghostGroup.position.z);
      _burnMesh.lookAt(_burnMesh.position.x, _burnMesh.position.y, _burnMesh.position.z + 10);
      _burnMat.uniforms.uOpacity.value = Math.sin(sp * Math.PI) * 1.1;
    }

    // Screen scan line
    _scanLine.style.opacity = sp > 0.02 && sp < 0.98 ? '1' : '0';
    _scanLine.style.top     = `${4 + eased * 88}%`;

    // Progress bar
    const pv = Math.round(sp * 100);
    _fill.style.width = `${pv}%`; _pct.textContent = `${pv}%`;

    // DOM rows at body-region milestones
    ROW_BURN_T.forEach((thr, i) => {
      if (!_rowsDone[i] && sp >= thr) {
        _rowsDone[i] = true;
        _rows[i].classList.add('vis');
        audio.playScanBeep();
      }
    });

    // Complete
    if (!_doneDone && sp >= 0.98) {
      _doneDone = true;
      _fill.style.width = '100%'; _pct.textContent = '100%';
      _scanLine.style.opacity = '0';
      _burnMesh.visible = false;
      // Character fully burned away — only the hologram ghost remains
      _setBurnY(-999.0);
      _scanPlane.constant = -_yMin + 0.1;
      _holoUniforms.uClipY.value     = _yMin - 0.1;
      _wireMat.uniforms.uClipY.value = _yMin - 0.1;  // fully open — wire visible everywhere
      setTimeout(() => { if (_active) _done.classList.add('vis'); }, 300);
    }
  }

  // ── Build: glow + pulses (stops when outro begins) ───────────────────────
  _holoUniforms.uTime.value = t;
  if (t >= T_BUILD_START && t < T_OUTRO_START && !_outroDone) {
    // Opacity is already at HOLO_BUILD_OP from the intro burn — no ramp needed.
    _holoUniforms.uOpacity.value = HOLO_BUILD_OP;
    _ghostGroup.rotation.y = Math.sin(t * 0.45) * 0.12;

    _nextPulse -= delta;
    if (_nextPulse <= 0) { _nextPulse = PULSE_INTERVAL + Math.random() * 1.6; _pulseT = 1.0; }
    if (_pulseT > 0) {
      _pulseT = Math.max(0, _pulseT - delta / PULSE_DECAY);
      const s = _pulseT * _pulseT;
      _holoUniforms.uPulse.value       = s;
      _wireMat.uniforms.uOpacity.value = WIRE_MAX_OP + s * 0.10;
    } else {
      _holoUniforms.uPulse.value = 0.0;
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
    _setBurnY(revealY);
    _setBurnTime(t);

    // Re-enable shadow casting once the lower half has materialised
    if (_shadowOff && op > 0.35) {
      _shadowOff = false;
      _charMeshes.forEach(m => { m.castShadow = true; });
    }

    // 2. Ghost: show only ABOVE the boundary (same uClipY logic as intro)
    //    uClipY rises from yMin → yMax, clipping ghost from the bottom up.
    _scanPlane.constant          = -clipY;
    _holoUniforms.uClipY.value   = clipY;
    _holoUniforms.uClipYMax.value = 999.0;      // no top-clip needed
    _holoUniforms.uOpacity.value     = HOLO_BUILD_OP;  // full opacity above the boundary
    _wireMat.uniforms.uOpacity.value = WIRE_MAX_OP;    // clip (not fade) handles the hide
    _wireMat.uniforms.uClipY.value   = clipY;          // wire shrinks from bottom in sync
    _holoUniforms.uPulse.value       = 0.0;
    // Settle the gentle sway back to forward-facing
    _ghostGroup.rotation.y = Math.sin(T_OUTRO_START * 0.45) * 0.12 * (1.0 - eased);

    // 3. Burn-edge glow at the shared boundary (moving upward)
    const glowActive = clipY > _yMin && clipY < _yMax;
    _burnMesh.visible = glowActive;
    if (glowActive) {
      _burnMesh.position.set(_ghostGroup.position.x, clipY, _ghostGroup.position.z);
      _burnMesh.lookAt(_burnMesh.position.x, _burnMesh.position.y, _burnMesh.position.z + 10);
      _burnMat.uniforms.uOpacity.value = Math.sin(op * Math.PI) * 1.1;
    }

    // 4. Scan line sweeps UPWARD (reversal of the intro downward pass)
    _scanLine.style.opacity = op > 0.02 && op < 0.98 ? '1' : '0';
    _scanLine.style.top     = `${92 - eased * 88}%`;

    // 5. DOM biometric panel fades out during the first half of the outro
    _bioEl.style.opacity = String(Math.max(0, 1.0 - op * 2.5).toFixed(3));

    // 6. Progress bar reverses to 0
    const pv = Math.round((1.0 - op) * 100);
    _fill.style.width = `${pv}%`; _pct.textContent = `${pv}%`;

    // Complete — character is fully back, ghost fully gone
    if (op >= 1.0) {
      _outroDone = true;
      _scanLine.style.opacity = '0';
      _burnMesh.visible = false;
      _setBurnY(999.0);
      _holoUniforms.uClipYMax.value = 999.0;
      _holoUniforms.uOpacity.value     = 0.0;
      _wireMat.uniforms.uOpacity.value = 0;
      _ghostGroup.visible = false;
      _bioEl.style.opacity = '0';
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
