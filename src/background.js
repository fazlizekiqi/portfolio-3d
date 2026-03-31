import * as THREE from 'three';
import VERT from './shaders/background.vert.glsl?raw';
import FRAG from './shaders/background.frag.glsl?raw';

// ── Three.js boilerplate ──────────────────────────────────────────────────────
const bgScene  = new THREE.Scene();
const bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const bgMaterial = new THREE.ShaderMaterial({
  vertexShader:   VERT,
  fragmentShader: FRAG,
  uniforms: {
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uTime:       { value: 0.0 },
  },
  depthTest:  false,
  depthWrite: false,
});

const bgGeo = new THREE.BufferGeometry();
bgGeo.setAttribute('position', new THREE.BufferAttribute(
  new Float32Array([-1,-1,0, 3,-1,0, -1,3,0]), 3
));
bgScene.add(new THREE.Mesh(bgGeo, bgMaterial));

window.addEventListener('resize', () => {
  bgMaterial.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
});

export function tickBackground(renderer, elapsed) {
  bgMaterial.uniforms.uTime.value = elapsed;
  renderer.clearColor();
  renderer.clearDepth();
  renderer.render(bgScene, bgCamera);
}
