/**
 * blueworld.js — Everything visible and ticking in the blue world.
 *
 * Owns:
 *   - Dark shader background (fullscreen ortho quad)
 *   - Nimbus platform rings
 *   - Dust / sparkle particles
 *   - Directional / ambient lighting
 *
 * Public API
 * ──────────
 *   initBlueWorld()              – call once after scene exists
 *   tickBlueWorld(renderer, delta, elapsed)
 *   aimLights(targetPos)         – point lights at character centre
 */

import * as THREE from 'three';
import { scene, camera } from '../scene.js';
import { LAYER, setWorldLayer } from '../layers.js';
import VERT_BG from '../shaders/background.vert.glsl?raw';
import FRAG_BG from '../shaders/background.frag.glsl?raw';

// ── Background shader (ortho fullscreen quad) ─────────────────────────────────
const _bgScene  = new THREE.Scene();
const _bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const _bgUniforms = {
  uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  uTime:       { value: 0.0 },
};
const _bgMat = new THREE.ShaderMaterial({
  vertexShader:   VERT_BG,
  fragmentShader: FRAG_BG,
  uniforms:    _bgUniforms,
  depthTest:   false,
  depthWrite:  false,
});
const _bgGeo = new THREE.BufferGeometry();
_bgGeo.setAttribute('position', new THREE.BufferAttribute(
  new Float32Array([-1,-1,0, 3,-1,0, -1,3,0]), 3
));
_bgScene.add(new THREE.Mesh(_bgGeo, _bgMat));

window.addEventListener('resize', () => {
  _bgUniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
});

// ── Lighting ──────────────────────────────────────────────────────────────────
const _ambient = new THREE.AmbientLight(0x8899bb, 0.6);

const _keyLight = new THREE.DirectionalLight(0xfff0dd, 1.6);
_keyLight.position.set(3, 5, 4);
_keyLight.castShadow = true;
_keyLight.shadow.mapSize.set(2048, 2048);
_keyLight.shadow.camera.near   =  0.5;
_keyLight.shadow.camera.far    = 20;
_keyLight.shadow.camera.left   = -3;
_keyLight.shadow.camera.right  =  3;
_keyLight.shadow.camera.top    =  3;
_keyLight.shadow.camera.bottom = -3;
_keyLight.shadow.bias          = -0.001;
_keyLight.shadow.normalBias    =  0.02;

const _fillLight = new THREE.DirectionalLight(0xaaccff, 0.5);
_fillLight.position.set(-4, 2, 3);

const _rimLight = new THREE.DirectionalLight(0x00ccff, 0.4);
_rimLight.position.set(0, 3, -5);

// ── White-world back light ─────────────────────────────────────────────────────
// A DirectionalLight whose position is updated every frame to always sit
// directly behind the character (opposite of their facing direction).
// Intensity is 0 in the blue world and fades in with the white world.
const _backLight        = new THREE.DirectionalLight(0xffffff, 0.0);
const _backLightTarget  = new THREE.Object3D();   // placed at character centre
_backLight.position.set(0, 1, -3);               // initial dummy position

// ── Platform rings ─────────────────────────────────────────────────────────────
const _ringMat = new THREE.MeshBasicMaterial({ color: 0x00aacc, transparent: true, opacity: 0.55 });
const _ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.018, 12, 80), _ringMat);
_ring.rotation.x = Math.PI / 2;
_ring.position.y = -0.95;
setWorldLayer(_ring, LAYER.BLUE);

const _ringMat2 = new THREE.MeshBasicMaterial({ color: 0x0055aa, transparent: true, opacity: 0.3 });
const _ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.93, 0.006, 8, 80), _ringMat2);
_ring2.rotation.x = Math.PI / 2;
_ring2.position.y = -0.95;
setWorldLayer(_ring2, LAYER.BLUE);

// ── Public API ────────────────────────────────────────────────────────────────

export function initBlueWorld() {
  scene.add(_ambient, _keyLight, _keyLight.target,
            _fillLight, _fillLight.target,
            _rimLight, _rimLight.target,
            _backLight, _backLight.target, _backLightTarget,
            _ring, _ring2);
  _backLight.target = _backLightTarget;
}

/** Point all lights at the character's centre — call after model loads. */
export function aimLights(targetPos) {
  _keyLight.target.position.copy(targetPos);
  _keyLight.target.updateMatrixWorld();
  _fillLight.target.position.copy(targetPos);
  _fillLight.target.updateMatrixWorld();
  _rimLight.target.position.copy(targetPos);
  _rimLight.target.updateMatrixWorld();
}

// ── White-world light target values (exported so dat.gui can tweak them) ─────
export const wwLightParams = {
  ambientColor:     '#fff8f0',
  ambientIntensity: 1.2,

  keyColor:         '#ffffff',
  keyIntensity:     2.0,
  keyX:             0,
  keyY:             0,
  keyZ:             0,

  fillColor:        '#ffeedd',
  fillIntensity:    0.6,

  rimColor:         '#ffffff',
  rimIntensity:     0.0,

  // White-world back light — always shines from directly behind the character
  backLightColor:     '#ffffff',
  backLightIntensity: 5,
  backLightHeight:    1.5,   // how high above character centre the light source sits
  backLightDist:      3.0,   // how far behind the character the light is placed
};

// ── Cached colour helpers (avoid per-frame allocations) ──────────────────────
const _colA = new THREE.Color();
const _colB = new THREE.Color();

/**
 * Cross-fade all scene lights between worlds.
 *   t = 1  → blue world  (original values)
 *   t = 0  → white world (wwLightParams values)
 *
 * @param {number} t
 * @param {THREE.Object3D|null} charModel  – the character modelGroup (for follow light)
 */
export function tickLightsForWorld(t, charModel) {
  const p = wwLightParams;

  // Ambient
  _colA.set(p.ambientColor);
  _colB.set(0x8899bb);
  _ambient.color.lerpColors(_colA, _colB, t);
  _ambient.intensity = THREE.MathUtils.lerp(p.ambientIntensity, 0.6, t);

  // Key
  _colA.set(p.keyColor);
  _colB.set(0xfff0dd);
  _keyLight.color.lerpColors(_colA, _colB, t);
  _keyLight.intensity = THREE.MathUtils.lerp(p.keyIntensity, 1.6, t);
  _keyLight.position.set(
    THREE.MathUtils.lerp(p.keyX, 3, t),
    THREE.MathUtils.lerp(p.keyY, 5, t),
    THREE.MathUtils.lerp(p.keyZ, 4, t),
  );

  // Fill
  _colA.set(p.fillColor);
  _colB.set(0xaaccff);
  _fillLight.color.lerpColors(_colA, _colB, t);
  _fillLight.intensity = THREE.MathUtils.lerp(p.fillIntensity, 0.5, t);

  // Rim
  _colA.set(p.rimColor);
  _colB.set(0x00ccff);
  _rimLight.color.lerpColors(_colA, _colB, t);
  _rimLight.intensity = THREE.MathUtils.lerp(p.rimIntensity, 0.4, t);

  // ── Back light (white world only) ──────────────────────────────────────────
  // DirectionalLight: position defines where light comes FROM, target is where
  // it points TO. We place the source directly behind the character so the
  // light always travels forward through the mesh, regardless of position.
  const wwAmt = 1.0 - t; // 0 = blue world, 1 = white world
  _backLight.color.set(p.backLightColor);
  _backLight.intensity = p.backLightIntensity * wwAmt;

  if (charModel) {
    const facingY = charModel.rotation.y;
    const cx = charModel.position.x;
    const cy = charModel.position.y + p.backLightHeight;
    const cz = charModel.position.z;

    // Source: behind the character (opposite of facing direction)
    _backLight.position.set(
      cx - Math.sin(facingY) * p.backLightDist,
      cy,
      cz - Math.cos(facingY) * p.backLightDist,
    );

    // Target: in front of the character — light always travels through the mesh
    _backLightTarget.position.set(
      cx + Math.sin(facingY) * p.backLightDist,
      cy,
      cz + Math.cos(facingY) * p.backLightDist,
    );
    _backLightTarget.updateMatrixWorld();
  }
}

/**
 * Tick the blue world each frame.
 * @param {THREE.WebGLRenderer} renderer
 * @param {number} delta
 * @param {number} elapsed
 */
export function tickBlueWorld(renderer, delta, elapsed) {
  // Background shader
  _bgUniforms.uTime.value = elapsed;
  renderer.clearColor();
  renderer.clearDepth();
  renderer.render(_bgScene, _bgCamera);

  // Rings
  const pulse = 0.5 + 0.5 * Math.sin(elapsed * 1.8);
  _ringMat.opacity  = 0.35 + 0.25 * pulse;
  _ring.rotation.z  =  elapsed * 0.3;
  _ring2.rotation.z = -elapsed * 0.18;

  // Fill light tracks camera
  _fillLight.position.copy(camera.position).multiplyScalar(0.6).add(new THREE.Vector3(-2, 1, 0));
}
