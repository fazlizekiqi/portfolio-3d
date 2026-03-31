import * as THREE from 'three';
import { renderer, camera } from './scene.js';
import { enterWhiteWorld, exitWhiteWorld } from './character/model.js';
import { LAYER } from './layers.js';
import FRAG from './shaders/transition.frag.glsl?raw';

// ─────────────────────────────────────────────────────────────────────────────
//  Burn-iris transition
//  An ortho fullscreen quad drawn on top of the main scene each frame.
//  progress 1 = fully open (blue world visible)
//  progress 0 = fully closed (white world)
//  Fragment shader loaded from src/shaders/transition.frag.glsl
// ─────────────────────────────────────────────────────────────────────────────


// ── Ortho setup ───────────────────────────────────────────────────────────────
const _orthoScene = new THREE.Scene();
const _orthoCam   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const _uniforms   = {
  uRes:      { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  uProgress: { value: 1.0 },
  uTime:     { value: 0.0 },
};
const _quad = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({ fragmentShader: FRAG, uniforms: _uniforms, transparent: true, depthTest: false, depthWrite: false })
);
_quad.frustumCulled = false;
_quad.visible       = false;
_orthoScene.add(_quad);

window.addEventListener('resize', () => _uniforms.uRes.value.set(window.innerWidth, window.innerHeight));

// ── State ─────────────────────────────────────────────────────────────────────
let _progress     = 1.0;
let _direction    = 0;        // -1 = closing → white,  1 = opening → blue
let _elapsed      = 0.0;
let _inWhiteWorld = false;
const SPEED       = 0.55;

export function isWhiteWorld()    { return _inWhiteWorld; }
export function isTransitioning() { return _direction !== 0; }
export function getProgress()     { return _progress; }
export function getElapsed()      { return _elapsed; }

// ── Go to white world (iris closes: 1 → 0) ───────────────────────────────────
export function goToWhiteWorld() {
  if (_direction === -1) return;
  _progress  = 1.0;
  _elapsed   = 0.0;
  _direction = -1;
  // Enable WHITE layer immediately so the iris-alpha shader can reveal
  // white objects outside the shrinking circle during the transition.
  camera.layers.enable(LAYER.WHITE);
}

// ── Return to blue world (iris opens: 0 → 1) ─────────────────────────────────
export function goToBlueWorld() {
  if (!_inWhiteWorld) return;
  // Mark state as no longer in white world, but keep the WHITE layer enabled
  // so white objects remain visible and fade out via their shader alpha
  // as the iris circle expands.  The layer is disabled once fully open.
  _inWhiteWorld = false;
  // Re-enable BLUE layer now so blue objects are ready behind the iris
  camera.layers.enable(LAYER.BLUE);
  _progress  = 0.0;
  _elapsed   = 0.0;
  _direction = 1;
}

// ── Tick (called every frame by main.js) ──────────────────────────────────────
// Returns a post-frame callback when the iris finishes closing, null otherwise.
// The callback is deferred so the layer switch never affects the frame already drawn.
export function tickTransition(delta) {
  if (_direction === 0) {
    _quad.visible = false;
    return null;
  }

  _elapsed  += delta;
  _progress += _direction * SPEED * delta;
  _progress  = Math.max(0, Math.min(1, _progress));

  _uniforms.uProgress.value = _progress;
  _uniforms.uTime.value     = _elapsed;
  _quad.visible             = true;

  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(_orthoScene, _orthoCam);

  // Iris fully closed → switch to white world after this frame is composited
  if (_progress <= 0.0 && _direction === -1) {
    _direction    = 0;
    _quad.visible = false;
    return () => {
      _inWhiteWorld = true;
      enterWhiteWorld();       // disables BLUE, keeps WHITE enabled
    };
  }

  // Iris fully open → transition complete, clean up white layer
  if (_progress >= 1.0 && _direction === 1) {
    _direction    = 0;
    _quad.visible = false;
    // Now that the iris is fully open and white objects are completely hidden
    // by the shader alpha, safely disable the WHITE layer.
    exitWhiteWorld();          // disables WHITE (BLUE already re-enabled)
  }

  return null;
}
