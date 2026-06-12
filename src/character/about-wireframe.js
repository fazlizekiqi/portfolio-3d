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
 *                          wireframe reveals beneath as fragments are discarded.
 *                          DOM scan labels appear as burn passes each region.
 *   5.5+     BUILD       — full wireframe glow, electric pulses, oscillation
 *
 * The burn is a SHADER inject — no opacity/transparent hacks.
 * uBurnY uniform drives the dissolve: 999 = full char, sweeps to -999 = gone.
 */

import * as THREE from 'three';
import { scene, renderer } from '../scene.js';

// ── Timing ────────────────────────────────────────────────────────────────────
const T_HEADER_IN     = 0.5;
const T_DOTS_START    = 3.2;   // particles start AFTER T-pose fully settled
const T_DOTS_END      = 4.4;
const T_DOTS_FADE_OUT = 4.0;
const T_BURN_START    = 3.8;   // burn starts after T-pose is held for ~1.5s
const T_BURN_END      = 7.0;
const T_BUILD_START   = 6.5;
const T_BUILD_END     = 17.0;
const PULSE_INTERVAL  = 1.8;
const PULSE_DECAY     = 0.28;
const ROW_BURN_T      = [0.12, 0.35, 0.60, 0.82];

// ── Wireframe layers ──────────────────────────────────────────────────────────
const LAYER_DEFS = [
  [ 1.000,  0.55,  0x00d4ff, THREE.NormalBlending   ],
  [ 0.996,  0.28,  0x00ffff, THREE.AdditiveBlending ],
  [ 1.004,  0.16,  0x0077ff, THREE.AdditiveBlending ],
];

// ── Vertex-cloud scatter shader ───────────────────────────────────────────────
const _dotsVert = /* glsl */`
  attribute vec3 aOffset;
  uniform float uSettle;
  uniform float uOpacity;
  varying float vOpacity;
  void main() {
    float e = 1.0 - pow(1.0 - uSettle, 3.0);
    vec3  p = mix(position + aOffset, position, e);
    gl_Position  = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = 2.8;
    vOpacity     = uOpacity;
  }
`;
const _dotsFrag = /* glsl */`
  varying float vOpacity;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    if (dot(uv,uv) > 0.25) discard;
    gl_FragColor = vec4(0.0, 0.85, 1.0, vOpacity);
  }
`;

// ── Burn-edge glow stripe shader ──────────────────────────────────────────────
const _burnVert = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;
const _burnFrag = /* glsl */`
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float cy    = abs(vUv.y - 0.5) * 2.0;
    float cx    = abs(vUv.x - 0.5) * 2.0;
    float edgeX = 1.0 - smoothstep(0.55, 1.0, cx);
    float core  = pow(1.0 - cy, 3.0);
    float flame = pow(1.0 - cy, 9.0);
    vec3 col = mix(vec3(0.0,0.30,0.80), vec3(0.0,0.85,1.0), core);
    col      = mix(col, vec3(0.95,0.97,1.0), flame * 0.85);
    float alpha = (core * 0.88 + flame * 0.12) * edgeX * uOpacity;
    gl_FragColor = vec4(col, alpha);
  }
`;

// ── Per-material burn shader inject ───────────────────────────────────────────
// Injected into THREE.js MeshStandardMaterial via onBeforeCompile.
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
        `varying float vBurnWorldY;\n#include <common>`
      )
      .replace(
        '#include <skinning_vertex>',
        `#include <skinning_vertex>
         vBurnWorldY = (modelMatrix * vec4(transformed, 1.0)).y;`
      );

    // 4. Fragment: declare varying + uniforms + compact noise functions
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `varying float vBurnWorldY;
         uniform float uBurnY;
         uniform float uBurnEdge;
         uniform float uBurnTime;
         // value noise hash
         float _bh(vec2 p){p=fract(p*vec2(127.1,311.7));p+=dot(p,p+19.19);return fract(p.x*p.y);}
         // bilinear noise
         float _bn(vec2 p){
           vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
           return mix(mix(_bh(i),_bh(i+vec2(1,0)),u.x),
                      mix(_bh(i+vec2(0,1)),_bh(i+vec2(1,1)),u.x),u.y);
         }
         // 4-octave fbm
         float _bf(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*_bn(p);p=p*2.1;a*=.5;}return v;}
         #include <common>`
      );

    // 5. Append burn discard + flame glow just before the shader's final closing brace
    const lastBrace = shader.fragmentShader.lastIndexOf('}');
    shader.fragmentShader =
      shader.fragmentShader.slice(0, lastBrace) +
      `
      {
        // ── Paper-burn dissolve: top → bottom ─────────────────────────────
        // Noisy threshold creates the ragged burning-paper edge
        float _bNoise = _bf(vec2(vBurnWorldY * 5.5, uBurnTime * 0.45)) * uBurnEdge * 1.9
                      + _bn(vec2(vBurnWorldY * 13.0, uBurnTime * 0.35)) * uBurnEdge * 0.6;
        float _threshold = uBurnY + _bNoise;
        // Above threshold = burned away → discard
        if (vBurnWorldY > _threshold) discard;
        // Edge proximity: 0=far from edge, 1=right at edge
        float _edgeT = clamp((_threshold - vBurnWorldY) / uBurnEdge, 0.0, 1.0);
        float _atEdge = 1.0 - _edgeT;   // 1=at burn front, 0=far inside
        // Cyan core → gold/orange outer flame (like the iris transition shader)
        vec3  _fCyan  = vec3(0.0, 0.85, 1.0);
        vec3  _fGold  = vec3(1.0, 0.82, 0.05);
        vec3  _fEdge  = mix(_fCyan, _fGold, pow(_atEdge, 0.5));
        float _edgeMix = pow(_atEdge, 1.8) * 0.96;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, _fEdge, _edgeMix);
        // Slightly fade the very edge so it dissolves rather than hard-cuts
        gl_FragColor.a  *= mix(1.0, 0.0, pow(_atEdge, 3.5));
        if (gl_FragColor.a < 0.005) discard;
      }
      ` +
      shader.fragmentShader.slice(lastBrace);
  };

  // Force a unique cache key so THREE.js never reuses an un-injected program
  mat.customProgramCacheKey = () => 'about_burn_v2';
  mat.needsUpdate = true;
}

// ── DOM — Biometric scan panel (LEFT side) ────────────────────────────────────
const _css = document.createElement('style');
_css.textContent = `
#_bio-scan {
  position: fixed; left: 5%; top: 50%; transform: translateY(-50%);
  z-index: 18; pointer-events: none;
  font-family: 'Share Tech Mono','Courier New',monospace;
  opacity: 0; transition: opacity 0.5s ease; min-width: 250px;
}
._bio-hdr { font-size:10px; color:rgba(0,200,255,0.55); letter-spacing:.22em;
  margin-bottom:16px; display:flex; align-items:center; gap:9px; }
._bio-hdr-dot { width:7px; height:7px; border-radius:50%; background:#00e5ff;
  box-shadow:0 0 9px rgba(0,230,255,0.9); flex-shrink:0;
  animation:_bdot 1.1s ease-in-out infinite; }
@keyframes _bdot {
  0%,100%{opacity:1;box-shadow:0 0 9px rgba(0,230,255,0.9);}
  50%    {opacity:0.35;box-shadow:0 0 3px rgba(0,180,255,0.3);}
}
._bio-sep { height:1px; background:linear-gradient(90deg,rgba(0,200,255,0.40),transparent);
  margin:0 0 14px; }
._bio-row { display:flex; gap:0; margin-bottom:10px;
  opacity:0; transform:translateX(-14px);
  transition:opacity 0.42s ease,transform 0.42s cubic-bezier(0.22,0.61,0.36,1);
  font-size:11px; letter-spacing:.08em; line-height:1.5; }
._bio-row.vis { opacity:1; transform:translateX(0); }
._bio-k { color:rgba(0,200,255,0.50); min-width:112px; font-size:9px; letter-spacing:.14em; }
._bio-v { color:#eef6ff; text-shadow:0 0 10px rgba(0,200,255,0.28); }
._bio-bar-wrap { margin:16px 0 10px; opacity:0; transition:opacity 0.4s ease; }
._bio-bar-wrap.vis { opacity:1; }
._bio-bar-lbl { font-size:9px; color:rgba(0,200,255,0.45); letter-spacing:.14em;
  margin-bottom:5px; display:flex; justify-content:space-between; }
._bio-bar-track { height:3px; background:rgba(0,150,200,0.18); border-radius:2px;
  width:230px; position:relative; overflow:hidden; }
._bio-bar-fill { position:absolute; left:0; top:0; bottom:0; width:0%;
  background:linear-gradient(90deg,#005577,#00e5ff); border-radius:2px;
  box-shadow:0 0 6px rgba(0,220,255,0.6); transition:width 0.10s linear; }
._bio-done { margin-top:14px; font-size:10px; color:#00ffaa; letter-spacing:.18em;
  text-shadow:0 0 14px rgba(0,255,160,0.65); opacity:0; transition:opacity 0.7s ease;
  display:flex; align-items:center; gap:9px; }
._bio-done.vis { opacity:1; }
._bio-done-bar { height:1px; flex:1; background:linear-gradient(90deg,rgba(0,255,160,0.50),transparent); }
._bio-scanline { position:fixed; left:0; right:0; height:3px;
  background:linear-gradient(90deg,transparent 0%,rgba(0,220,255,0.0) 10%,
    rgba(0,220,255,0.55) 40%,rgba(0,220,255,0.95) 50%,
    rgba(0,220,255,0.55) 60%,rgba(0,220,255,0.0) 90%,transparent 100%);
  pointer-events:none; z-index:17; opacity:0; transition:opacity 0.25s; filter:blur(0.5px); }
@media (max-width:640px) {
  #_bio-scan { left:2%; top:auto; bottom:20%; transform:none; min-width:0; max-width:45vw; }
  ._bio-k { min-width:72px; font-size:8px; } ._bio-row { font-size:9.5px; }
  ._bio-bar-track { width:140px; }
}
`;
document.head.appendChild(_css);

const _bioEl = document.createElement('div');
_bioEl.id = '_bio-scan';
_bioEl.innerHTML = `
  <div class="_bio-hdr"><div class="_bio-hdr-dot"></div>BIOMETRIC SCAN</div>
  <div class="_bio-sep"></div>
  <div class="_bio-row" id="_br0"><span class="_bio-k">HEAD / BRAIN </span><span class="_bio-v">ARCHITECTURE: DISTRIBUTED</span></div>
  <div class="_bio-row" id="_br1"><span class="_bio-k">CHEST / CORE </span><span class="_bio-v">6+ YEARS IN PRODUCTION</span></div>
  <div class="_bio-row" id="_br2"><span class="_bio-k">ARMS / STACK </span><span class="_bio-v">JAVA · KAFKA · GCP · K8S</span></div>
  <div class="_bio-row" id="_br3"><span class="_bio-k">LEGS / BASE  </span><span class="_bio-v">STOCKHOLM, SWEDEN</span></div>
  <div class="_bio-bar-wrap" id="_brBar">
    <div class="_bio-bar-lbl"><span>SCAN PROGRESS</span><span id="_brPct">0%</span></div>
    <div class="_bio-bar-track"><div class="_bio-bar-fill" id="_brFill"></div></div>
  </div>
  <div class="_bio-done" id="_brDone"><span>▋ ANALYSIS COMPLETE</span><div class="_bio-done-bar"></div></div>
`;
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
let _layers       = [];
let _dotsUniforms = null;
let _scanPlane    = null;
let _burnMesh     = null;
let _burnMat      = null;
let _yMin = 0, _yMax = 2;

// Per-material burn uniforms injected at init
let _burnUniforms = []; // [{ uBurnY, uBurnEdge, uBurnTime }]

let _active    = false;
let _slideTime = 0;
let _nextPulse = PULSE_INTERVAL;
let _pulseT    = 0;
let _rowsDone  = [false,false,false,false];
let _doneDone  = false;

// ── Init ──────────────────────────────────────────────────────────────────────
export function initAboutWireframe(skinnedMeshes, modelGroup) {
  renderer.localClippingEnabled = true;

  const box = new THREE.Box3().setFromObject(modelGroup);
  _yMin = box.min.y - 0.05;
  _yMax = box.max.y + 0.05;

  // Clipping plane for wireframe reveal (top → bottom, same direction as burn)
  _scanPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -_yMax);

  // ── Inject burn shader into every character material ─────────────────────
  skinnedMeshes.forEach(mesh => {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach(mat => {
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
  skinnedMeshes.forEach(mesh => {
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

  // ── Wireframe layers ──────────────────────────────────────────────────────
  _layers = LAYER_DEFS.map(([sc, maxOp, col, blend]) => {
    const mat = new THREE.MeshBasicMaterial({
      color: col, wireframe: true, transparent: true, opacity: 0,
      depthWrite: false, depthTest: false, blending: blend,
      clippingPlanes: [_scanPlane],
    });
    const grp = new THREE.Group();
    grp.scale.setScalar(sc);
    skinnedMeshes.forEach(mesh => {
      const wire = new THREE.Mesh(mesh.geometry.clone(), mat);
      wire.matrix.copy(_relMat(mesh)); wire.matrixAutoUpdate = false;
      grp.add(wire);
    });
    _ghostGroup.add(grp);
    return { mat, maxOp };
  });

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
  _rowsDone = [false,false,false,false]; _doneDone = false;
  _active = true;

  // Reset: wireframe fully clipped (not visible), burn not started
  _scanPlane.constant = -_yMax;
  _dotsUniforms.uSettle.value  = 0.0;
  _dotsUniforms.uOpacity.value = 0.0;
  _layers.forEach(l => { l.mat.opacity = 0; });
  _ghostGroup.rotation.y = 0;
  _ghostGroup.visible    = true;

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
  // Reset burn — character fully visible again on other slides
  _setBurnY(999.0);

  const sD = _dotsUniforms.uOpacity.value;
  const sL = _layers.map(l => l.mat.opacity);
  const t0 = performance.now();
  (function fade(ts) {
    const p = Math.min((ts - t0) / 700, 1);
    _dotsUniforms.uOpacity.value = sD * (1 - p);
    _layers.forEach((l, i) => { l.mat.opacity = sL[i] * (1 - p); });
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
  if (t >= T_BURN_START) {
    const sp    = _clamp01((t - T_BURN_START) / (T_BURN_END - T_BURN_START));
    const eased = _easeInOut(sp);

    // World-Y of the burn front — sweeps yMax → yMin (top to bottom)
    const burnY = _yMax - (_yMax - _yMin) * eased;

    // Drive character shader burn front
    _setBurnY(burnY);
    _setBurnTime(t);

    // Wireframe clipping plane shows where y > burnY — exactly the burned region
    // Plane normal=(0,1,0), constant c: discards y < -c → set c=-burnY → shows y > burnY
    _scanPlane.constant = -burnY;
    _layers[0].mat.opacity = eased * _layers[0].maxOp;

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
      if (!_rowsDone[i] && sp >= thr) { _rowsDone[i] = true; _rows[i].classList.add('vis'); }
    });

    // Complete
    if (!_doneDone && sp >= 0.98) {
      _doneDone = true;
      _fill.style.width = '100%'; _pct.textContent = '100%';
      _scanLine.style.opacity = '0';
      _burnMesh.visible = false;
      // Push burn Y way below so nothing is discarded (wireframe alone is visible)
      _setBurnY(-999.0);
      setTimeout(() => { if (_active) _done.classList.add('vis'); }, 300);
    }
  }

  // ── Build: glow + pulses ──────────────────────────────────────────────────
  if (t >= T_BUILD_START) {
    const be = _easeInOut(_clamp01((t - T_BUILD_START) / (T_BUILD_END - T_BUILD_START)));
    _layers[1].mat.opacity = be * _layers[1].maxOp;
    _layers[2].mat.opacity = be * _layers[2].maxOp;
    _ghostGroup.rotation.y = Math.sin(t * 0.45) * 0.12;

    _nextPulse -= delta;
    if (_nextPulse <= 0) { _nextPulse = PULSE_INTERVAL + Math.random() * 1.6; _pulseT = 1.0; }
    if (_pulseT > 0) {
      _pulseT = Math.max(0, _pulseT - delta / PULSE_DECAY);
      const s = _pulseT * _pulseT;
      _layers[0].mat.opacity = _layers[0].maxOp      + s * 0.24;
      _layers[1].mat.opacity = be * _layers[1].maxOp + s * 0.30;
      _layers[2].mat.opacity = be * _layers[2].maxOp + s * 0.18;
    }
  }
}

// ── Easing ────────────────────────────────────────────────────────────────────
function _clamp01(v)   { return Math.max(0, Math.min(1, v)); }
function _easeOut(t)   { return 1 - (1-t)*(1-t); }
function _easeIn(t)    { return t*t; }
function _easeInOut(t) { return t<0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }
