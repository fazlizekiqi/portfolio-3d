/**
 * cta-platform.js — Holographic ring platform under the character for the
 * "Let's Connect" slide.
 *
 * Owns a single THREE.Group: concentric rotating rings (alternating spin
 * directions), a small segmented "loading-indicator" ring, a soft additive
 * ground glow, and a rising-particle cloud that loops vertically. Built once
 * and added to the scene at startup; toggled visible only for the cta slide.
 *
 * Public API
 * ──────────
 *   initCtaPlatform()              – call once after scene exists
 *   showCtaPlatform()/hideCtaPlatform()
 *   tickCtaPlatform(delta, elapsed)
 */

import * as THREE from 'three';
import { scene } from '../scene.js';
import { LAYER, setWorldLayer } from '../layers.js';

const GROUP_Y     = -0.95; // matches the existing blueworld floor ring height
const RISE_HEIGHT = 2.2;
const FADE_MS     = 600;

const _platform = new THREE.Group();
_platform.position.y = GROUP_Y;
_platform.visible = false;

// ── Ground glow ────────────────────────────────────────────────────────────
const _glowMat = new THREE.MeshBasicMaterial({
  color: 0x00d9ff, transparent: true, opacity: 0.10,
  blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
});
const _glow = new THREE.Mesh(new THREE.CircleGeometry(2.1, 48), _glowMat);
_glow.rotation.x = -Math.PI / 2;
_platform.add(_glow);

// ── Concentric rings — alternating spin direction ────────────────────────────
const _ringDefs = [
  { radius: 2.0, tube: 0.012, color: 0x00d9ff, opacity: 0.45, speed:  0.12 },
  { radius: 1.6, tube: 0.010, color: 0x0088bb, opacity: 0.32, speed: -0.20 },
  { radius: 1.2, tube: 0.008, color: 0x33eaff, opacity: 0.48, speed:  0.34 },
];
const _rings = _ringDefs.map(d => {
  const mat  = new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: d.opacity });
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(d.radius, d.tube, 8, 96), mat);
  mesh.rotation.x = Math.PI / 2;
  _platform.add(mesh);
  return mesh;
});

// ── Small segmented ring (loading-indicator style) ───────────────────────────
const _segGroup  = new THREE.Group();
const _segCount  = 18;
const _segRadius = 0.85;
const _segMat    = new THREE.MeshBasicMaterial({ color: 0x9af6ff, transparent: true, opacity: 0.6 });
for (let i = 0; i < _segCount; i++) {
  if (i % 3 === 0) continue; // skip every 3rd tick to read as "segmented"
  const seg = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.012, 0.012), _segMat);
  const a   = (i / _segCount) * Math.PI * 2;
  seg.position.set(Math.cos(a) * _segRadius, 0, Math.sin(a) * _segRadius);
  seg.rotation.y = -a;
  _segGroup.add(seg);
}
_platform.add(_segGroup);

// ── Rising particle cloud — loops vertically, respawns at the base ───────────
const PARTICLE_COUNT = 60;
const _positions = new Float32Array(PARTICLE_COUNT * 3);
const _speeds     = new Float32Array(PARTICLE_COUNT);
for (let i = 0; i < PARTICLE_COUNT; i++) {
  const r = 0.3 + Math.random() * 1.7;
  const a = Math.random() * Math.PI * 2;
  _positions[i * 3 + 0] = Math.cos(a) * r;
  _positions[i * 3 + 1] = Math.random() * RISE_HEIGHT;
  _positions[i * 3 + 2] = Math.sin(a) * r;
  _speeds[i] = 0.25 + Math.random() * 0.35;
}
const _particleGeo = new THREE.BufferGeometry();
_particleGeo.setAttribute('position', new THREE.BufferAttribute(_positions, 3));
const _particleMat = new THREE.PointsMaterial({
  color: 0x66f0ff, size: 0.035, transparent: true, opacity: 0.75,
  depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
});
const _particles = new THREE.Points(_particleGeo, _particleMat);
_platform.add(_particles);

setWorldLayer(_platform, LAYER.BLUE, true);

// ── Visibility / fade state ───────────────────────────────────────────────
let _target = false; // desired visibility
let _fade   = 0;      // 0..1, drives opacity of every material above

export function initCtaPlatform() {
  scene.add(_platform);
}

export function showCtaPlatform() { _target = true; }
export function hideCtaPlatform() { _target = false; }

export function tickCtaPlatform(delta) {
  _fade = THREE.MathUtils.clamp(_fade + (_target ? 1 : -1) * (delta * 1000) / FADE_MS, 0, 1);
  if (_fade <= 0 && !_target) { _platform.visible = false; return; }
  _platform.visible = true;

  _glowMat.opacity = 0.10 * _fade;
  _rings.forEach((mesh, i) => {
    mesh.rotation.z += _ringDefs[i].speed * delta;
    mesh.material.opacity = _ringDefs[i].opacity * _fade;
  });
  _segGroup.rotation.y += 0.6 * delta;
  _segMat.opacity = 0.6 * _fade;

  const posAttr = _particleGeo.getAttribute('position');
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    let y = posAttr.array[i * 3 + 1] + _speeds[i] * delta;
    if (y > RISE_HEIGHT) y -= RISE_HEIGHT;
    posAttr.array[i * 3 + 1] = y;
  }
  posAttr.needsUpdate = true;
  _particleMat.opacity = 0.75 * _fade;
}
