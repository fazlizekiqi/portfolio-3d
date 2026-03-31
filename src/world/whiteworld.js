/**
 * whiteworld.js — Everything visible and ticking in the white world.
 *
 * Owns:
 *   - Cartoon / cel-style ground plane and decorative cubes
 *   - Iris-alpha shader uniforms (synced to transition progress)
 *
 * Objects use LAYER.WHITE so they are only visible when the camera
 * has that layer enabled (controlled by transition.js).
 *
 * Public API
 * ──────────
 *   tickWhiteWorld()  – call every frame from main.js
 */

import * as THREE from 'three';
import { scene } from '../scene.js';
import { LAYER, setWorldLayer } from '../layers.js';
import { getProgress, isTransitioning, isWhiteWorld, getElapsed } from '../transition.js';
import IRIS_ALPHA_GLSL from '../shaders/whiteworld.iris.glsl?raw';
import VERT            from '../shaders/whiteworld.vert.glsl?raw';
import FRAG_BODY       from '../shaders/whiteworld.frag.glsl?raw';

// ── Shared iris-alpha uniforms ────────────────────────────────────────────────
const _uniforms = {
  uProgress: { value: 1.0 },
  uTime:     { value: 0.0 },
  uRes:      { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
};
window.addEventListener('resize', () => {
  _uniforms.uRes.value.set(window.innerWidth, window.innerHeight);
});

const FRAG = IRIS_ALPHA_GLSL + '\n' + FRAG_BODY;

const _fillMat = new THREE.ShaderMaterial({
  uniforms: { ..._uniforms, uColor: { value: new THREE.Color(0xffffff) } },
  vertexShader: VERT, fragmentShader: FRAG,
  transparent: true, depthWrite: true, depthTest: true, side: THREE.FrontSide,
});

const _lineMat = new THREE.ShaderMaterial({
  uniforms: { ..._uniforms, uColor: { value: new THREE.Color(0x111111) } },
  vertexShader: VERT, fragmentShader: FRAG,
  transparent: true, depthWrite: false, depthTest: true,
});

function _makeCartoonObject(geometry, position, rotation = null) {
  const group = new THREE.Group();
  group.position.copy(position);
  if (rotation) group.rotation.copy(rotation);
  group.add(
    new THREE.Mesh(geometry, _fillMat),
    new THREE.LineSegments(new THREE.EdgesGeometry(geometry), _lineMat),
  );
  setWorldLayer(group, LAYER.WHITE, true);
  scene.add(group);
  return group;
}

// ── White world objects ───────────────────────────────────────────────────────
_makeCartoonObject(
  new THREE.PlaneGeometry(60, 60, 20, 20),
  new THREE.Vector3(0, -0.95, 0),
  new THREE.Euler(-Math.PI / 2, 0, 0),
);
_makeCartoonObject(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.Vector3( 1.4, -0.65,  0));
_makeCartoonObject(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.Vector3(-1.5, -0.75,  0.5));
_makeCartoonObject(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.Vector3( 0.8, -0.80, -1.2));

// ── Per-frame tick ────────────────────────────────────────────────────────────
export function tickWhiteWorld() {
  if (isTransitioning()) {
    _uniforms.uProgress.value = getProgress();
    _uniforms.uTime.value     = getElapsed();
  } else if (isWhiteWorld()) {
    _uniforms.uProgress.value = 0.0;
    _uniforms.uTime.value     = 0.0;
  } else {
    _uniforms.uProgress.value = 1.0;
    _uniforms.uTime.value     = 0.0;
  }
}

