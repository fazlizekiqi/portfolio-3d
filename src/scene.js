import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LAYER } from './layers.js';

// ── Renderer ──────────────────────────────────────────────────────────────────
export const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.autoClear = false; // we manually clear each frame so the shader bg persists
document.body.appendChild(renderer.domElement);

// ── Scene ─────────────────────────────────────────────────────────────────────
export const scene = new THREE.Scene();
// No background color, no fog — the cloud shader owns the entire background

// ── Camera ────────────────────────────────────────────────────────────────────
export const camera = new THREE.PerspectiveCamera(
  44,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 1.8, 8.0);
// Blue world is the default starting state — enable its layer.
// SHARED (0) is always on by default in Three.js.
camera.layers.enable(LAYER.BLUE);

// ── Controls ──────────────────────────────────────────────────────────────────
export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 3.0;
controls.maxDistance = 20;
controls.target.set(0, 0.6, 0);
controls.maxPolarAngle = Math.PI * 0.60;
controls.enabled = true;

// ── Resize handler ────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

