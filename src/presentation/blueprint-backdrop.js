/**
 * blueprint-backdrop.js — Fullscreen blueprint-grid backdrop for the How I Work slide.
 *
 * Renders a trimmed copy of the project-card blueprint shader (grid + vignette +
 * brackets) as a fullscreen WebGL pass BEHIND the character. Mirrors the
 * fullscreen-quad pattern used for the blue-world background (world/blueworld.js).
 *
 * The main render loop calls tickBlueprintBackdrop() right after the blue-world
 * background and before the main scene render, so the grid sits behind the
 * character while the character renders on top — they "stand inside" the blueprint.
 *
 * Public API:
 *   showBlueprintBackdrop()              — ramp in
 *   hideBlueprintBackdrop()              — ramp out
 *   tickBlueprintBackdrop(renderer, t)   — call every frame from the render loop
 */

import * as THREE from 'three';
import VERT from '../shaders/background.vert.glsl?raw';
import FRAG from '../shaders/blueprint-bg.frag.glsl?raw';

const _scene  = new THREE.Scene();
const _camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const _uniforms = {
  uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  uTime:       { value: 0.0 },
  uOpacity:    { value: 0.0 },
};

const _mat = new THREE.ShaderMaterial({
  vertexShader:   VERT,
  fragmentShader: FRAG,
  uniforms:       _uniforms,
  transparent:    true,
  depthTest:      false,
  depthWrite:     false,
});

// Oversized fullscreen triangle — covers the viewport with 3 vertices.
const _geo = new THREE.BufferGeometry();
_geo.setAttribute('position', new THREE.BufferAttribute(
  new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3
));
_scene.add(new THREE.Mesh(_geo, _mat));

window.addEventListener('resize', () => {
  _uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
});

let _target = 0; // opacity target (0 hidden, 1 shown)

export function showBlueprintBackdrop() { _target = 1; }
export function hideBlueprintBackdrop() { _target = 0; }

/** Advance time, ease opacity toward target, and render if visible. */
export function tickBlueprintBackdrop(renderer, elapsed) {
  _uniforms.uTime.value = elapsed;

  // Ease opacity toward target (~0.5 s either way).
  const cur = _uniforms.uOpacity.value;
  _uniforms.uOpacity.value += (_target - cur) * 0.08;

  if (_uniforms.uOpacity.value < 0.002) {
    _uniforms.uOpacity.value = 0;
    return; // fully hidden — skip the draw entirely
  }
  renderer.render(_scene, _camera);
}
