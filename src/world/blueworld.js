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

// ── Particles ─────────────────────────────────────────────────────────────────
const PARTICLE_COUNT = 180;
const _pGeo   = new THREE.BufferGeometry();
const _pPhase = new Float32Array(PARTICLE_COUNT);
const _pPos   = new Float32Array(PARTICLE_COUNT * 3);

for (let i = 0; i < PARTICLE_COUNT; i++) {
  _pPos[i * 3]     = (Math.random() - 0.5) * 2.4;
  _pPos[i * 3 + 1] = (Math.random() - 0.5) * 3.8;
  _pPos[i * 3 + 2] = (Math.random() - 0.5) * 2.4;
  _pPhase[i] = Math.random() * Math.PI * 2;
}
_pGeo.setAttribute('position', new THREE.BufferAttribute(_pPos, 3));

const _pMat = new THREE.PointsMaterial({
  color: 0x55ccff, size: 0.018,
  transparent: true, opacity: 0.55,
  depthWrite: false, blending: THREE.AdditiveBlending,
});
const _pPoints = new THREE.Points(_pGeo, _pMat);
setWorldLayer(_pPoints, LAYER.BLUE);

// ── Public API ────────────────────────────────────────────────────────────────

export function initBlueWorld() {
  scene.add(_ambient, _keyLight, _keyLight.target,
            _fillLight, _fillLight.target,
            _rimLight, _rimLight.target,
            _ring, _ring2, _pPoints);
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

  // Particles
  const pos = _pGeo.attributes.position.array;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    pos[i * 3 + 1] += delta * (0.03 + 0.018 * Math.sin(_pPhase[i] + elapsed * 0.4));
    if (pos[i * 3 + 1] > 2.8) pos[i * 3 + 1] = -0.8;
  }
  _pGeo.attributes.position.needsUpdate = true;

  // Fill light tracks camera
  _fillLight.position.copy(camera.position).multiplyScalar(0.6).add(new THREE.Vector3(-2, 1, 0));
}

