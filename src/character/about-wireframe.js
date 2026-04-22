/**
 * about-wireframe.js
 *
 * T-pose wireframe ghost shown on the "about" slide.
 *
 * Visual sequence (slide = 10 s):
 *   0.0 – 1.2 s  DOTS   — vertex-cloud (Points) fades in over the whole silhouette
 *   0.8 – 3.5 s  SCAN   — clipping plane sweeps feet→head building wireframe edges;
 *                          dots fade out as edges take over
 *   3.0 – 10 s   BUILD  — glow layers thicken, ghost oscillates, electric pulses fire
 *
 * Thickness is simulated with 3 stacked wireframe groups:
 *   core  (scale 1.000)  max opacity 0.30  #00d4ff  Normal
 *   inner (scale 0.994)  max opacity 0.14  #00ffff  Additive
 *   outer (scale 1.006)  max opacity 0.09  #0077ff  Additive
 *
 * Clipping plane math (THREE.js discards where dot(n,p)+c < 0):
 *   normal=(0,-1,0)  →  discard when  -y + c < 0  →  y > c
 *   so  c = scanY  means "show geometry at or below scanY". ✓
 *
 * Public API
 * ──────────
 *   initAboutWireframe(skinnedMeshes, modelGroup)
 *   showAboutWireframe()
 *   hideAboutWireframe()
 *   tickAboutWireframe(delta)
 */

import * as THREE from 'three';
import { scene, renderer } from '../scene.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const GHOST_OFFSET_X  = -2.2;

const DOTS_FADE_IN        = 1.2;
const DOTS_SETTLE_END     = 1.8;   // s — dots finish flying to position
const SCAN_START          = 1.4;   // s — scan begins after dots have mostly settled
const SCAN_END            = 3.5;
const DOTS_FADE_OUT_START = 1.6;
const DOTS_FADE_OUT_END   = 3.0;

const BUILD_START  = 3.0;
const BUILD_END    = 9.5;

const PULSE_INTERVAL = 2.2;
const PULSE_DECAY    = 0.35;

// Thickness reduced 90% from original values
const LAYER_DEFS = [
  //  scale    maxOpacity  colour     blending
  [ 1.000,   0.030,  0x00d4ff, THREE.NormalBlending   ],
  [ 0.994,   0.014,  0x00ffff, THREE.AdditiveBlending ],
  [ 1.006,   0.009,  0x0077ff, THREE.AdditiveBlending ],
];

// ── Dots shader — vertices scatter from random offsets then settle ─────────────
const _dotsVert = /* glsl */`
  attribute vec3 aOffset;   // random world-space displacement baked at init
  uniform   float uSettle;  // 0 = scattered, 1 = in T-pose position
  uniform   float uOpacity;

  varying float vOpacity;

  void main() {
    // ease-out cubic settle
    float t  = uSettle;
    float e  = 1.0 - pow(1.0 - t, 3.0);
    vec3  p  = mix(position + aOffset, position, e);
    gl_Position  = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = 2.0;
    vOpacity     = uOpacity;
  }
`;
const _dotsFrag = /* glsl */`
  varying float vOpacity;
  void main() {
    // circular point
    vec2 uv = gl_PointCoord - 0.5;
    if (dot(uv, uv) > 0.25) discard;
    gl_FragColor = vec4(0.0, 0.82, 1.0, vOpacity);
  }
`;

// ── Module state ──────────────────────────────────────────────────────────────
let _ghostGroup  = null;
let _layers      = [];
let _dotsUniforms = null;   // { uSettle, uOpacity }
let _scanPlane   = null;
let _yMin = 0, _yMax = 2;

let _active    = false;
let _slideTime = 0;
let _nextPulse = PULSE_INTERVAL;
let _pulseT    = 0;

// ── Init ──────────────────────────────────────────────────────────────────────
export function initAboutWireframe(skinnedMeshes, modelGroup) {
  renderer.localClippingEnabled = true;

  const box = new THREE.Box3().setFromObject(modelGroup);
  _yMin = box.min.y - 0.1;
  _yMax = box.max.y + 0.1;

  _scanPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), _yMin);

  _ghostGroup = new THREE.Group();
  _ghostGroup.position.copy(modelGroup.position);
  _ghostGroup.position.x += GHOST_OFFSET_X;
  _ghostGroup.quaternion.copy(modelGroup.quaternion);
  _ghostGroup.scale.copy(modelGroup.scale);

  // ── Dots layer — shader-driven scatter → settle ───────────────────────────
  _dotsUniforms = {
    uSettle:  { value: 0.0 },
    uOpacity: { value: 0.0 },
  };
  const dotsMat = new THREE.ShaderMaterial({
    vertexShader:   _dotsVert,
    fragmentShader: _dotsFrag,
    uniforms:       _dotsUniforms,
    transparent:    true,
    depthWrite:     false,
    blending:       THREE.AdditiveBlending,
  });

  const dotsGroup = new THREE.Group();
  skinnedMeshes.forEach(mesh => {
    // Bake random offsets as a buffer attribute — cheap, one-time CPU cost
    const pos     = mesh.geometry.attributes.position;
    const offsets = new Float32Array(pos.count * 3);
    const SPREAD  = 1.8;
    for (let i = 0; i < pos.count; i++) {
      offsets[i * 3]     = (Math.random() - 0.5) * SPREAD;
      offsets[i * 3 + 1] = (Math.random() - 0.5) * SPREAD;
      offsets[i * 3 + 2] = (Math.random() - 0.5) * SPREAD;
    }
    const geo = mesh.geometry.clone();
    geo.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 3));

    const pts = new THREE.Points(geo, dotsMat);
    pts.matrix.copy(mesh.matrix);
    pts.matrixAutoUpdate = false;
    dotsGroup.add(pts);
  });
  _ghostGroup.add(dotsGroup);

  // ── Wireframe layers ──────────────────────────────────────────────────────
  _layers = LAYER_DEFS.map(([scaleFactor, maxOpacity, colour, blending]) => {
    const mat = new THREE.MeshBasicMaterial({
      color:          colour,
      wireframe:      true,
      transparent:    true,
      opacity:        0,
      depthWrite:     false,
      blending,
      clippingPlanes: [_scanPlane],
    });
    const group = new THREE.Group();
    group.scale.setScalar(scaleFactor);
    skinnedMeshes.forEach(mesh => {
      const wire = new THREE.Mesh(mesh.geometry.clone(), mat);
      wire.matrix.copy(mesh.matrix);
      wire.matrixAutoUpdate = false;
      group.add(wire);
    });
    _ghostGroup.add(group);
    return { mat, maxOpacity };
  });

  _ghostGroup.visible = false;
  scene.add(_ghostGroup);
}

// ── Show / Hide ───────────────────────────────────────────────────────────────
export function showAboutWireframe() {
  if (!_ghostGroup) return;
  _slideTime = 0;
  _nextPulse = PULSE_INTERVAL;
  _pulseT    = 0;
  _active    = true;

  _scanPlane.constant        = _yMin;
  _dotsUniforms.uSettle.value  = 0.0;
  _dotsUniforms.uOpacity.value = 0.0;
  _layers.forEach(l => { l.mat.opacity = 0; });

  _ghostGroup.rotation.y = 0;
  _ghostGroup.visible    = true;
}

export function hideAboutWireframe() {
  if (!_ghostGroup) return;
  _active = false;

  const snapDots   = _dotsUniforms.uOpacity.value;
  const snapLayers = _layers.map(l => l.mat.opacity);
  const t0 = performance.now();
  const FADE = 500;

  (function step(ts) {
    const p = Math.min((ts - t0) / FADE, 1);
    _dotsUniforms.uOpacity.value = snapDots * (1 - p);
    _layers.forEach((l, i) => { l.mat.opacity = snapLayers[i] * (1 - p); });
    if (p < 1) requestAnimationFrame(step);
    else       _ghostGroup.visible = false;
  })(performance.now());
}

// ── Per-frame tick ─────────────────────────────────────────────────────────────
export function tickAboutWireframe(delta) {
  if (!_active || !_ghostGroup) return;
  _slideTime += delta;
  const t = _slideTime;

  // ── Dots: fade in + settle ────────────────────────────────────────────────
  _dotsUniforms.uSettle.value = _clamp01(t / DOTS_SETTLE_END);

  if (t < DOTS_FADE_OUT_START) {
    _dotsUniforms.uOpacity.value = _easeOut(_clamp01(t / DOTS_FADE_IN)) * 0.045;
  } else {
    const fo = _clamp01((t - DOTS_FADE_OUT_START) / (DOTS_FADE_OUT_END - DOTS_FADE_OUT_START));
    _dotsUniforms.uOpacity.value = 0.045 * (1 - _easeIn(fo));
  }

  // ── Scan ──────────────────────────────────────────────────────────────────
  if (t >= SCAN_START) {
    const sp   = _clamp01((t - SCAN_START) / (SCAN_END - SCAN_START));
    _scanPlane.constant        = _yMin + (_yMax - _yMin) * _easeOut(sp);
    _layers[0].mat.opacity     = _easeOut(sp) * _layers[0].maxOpacity;
  }

  // ── Build / glow ──────────────────────────────────────────────────────────
  if (t >= BUILD_START) {
    const bp = _clamp01((t - BUILD_START) / (BUILD_END - BUILD_START));
    const be = _easeInOut(bp);

    _layers[1].mat.opacity = be * _layers[1].maxOpacity;
    _layers[2].mat.opacity = be * _layers[2].maxOpacity;

    _ghostGroup.rotation.y = Math.sin(t * 0.55) * 0.12;

    _nextPulse -= delta;
    if (_nextPulse <= 0) {
      _nextPulse = PULSE_INTERVAL + Math.random() * 1.5;
      _pulseT    = 1.0;
    }
    if (_pulseT > 0) {
      _pulseT = Math.max(0, _pulseT - delta / PULSE_DECAY);
      const spike = _pulseT * _pulseT;
      _layers[0].mat.opacity = _layers[0].maxOpacity             + spike * 0.018;
      _layers[1].mat.opacity = be * _layers[1].maxOpacity        + spike * 0.025;
      _layers[2].mat.opacity = be * _layers[2].maxOpacity        + spike * 0.018;
    }
  }
}

// ── Easing & utils ────────────────────────────────────────────────────────────
function _clamp01(v)   { return Math.max(0, Math.min(1, v)); }
function _easeOut(t)   { return 1 - (1 - t) * (1 - t); }
function _easeIn(t)    { return t * t; }
function _easeInOut(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }
