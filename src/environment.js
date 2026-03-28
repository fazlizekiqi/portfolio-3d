import * as THREE from 'three';
import { scene } from './scene.js';

// ── Nimbus / glowing platform rings ──────────────────────────────────────────
const ringGeo = new THREE.TorusGeometry(0.9, 0.018, 12, 80);
const ringMat = new THREE.MeshBasicMaterial({ color: 0x00aacc, transparent: true, opacity: 0.55 });
const ring = new THREE.Mesh(ringGeo, ringMat);
ring.rotation.x = Math.PI / 2;
ring.position.y = -0.95;
scene.add(ring);

const ringGeo2 = new THREE.TorusGeometry(0.93, 0.006, 8, 80);
const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x0055aa, transparent: true, opacity: 0.3 });
const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
ring2.rotation.x = Math.PI / 2;
ring2.position.y = -0.95;
scene.add(ring2);

export function tickCloud(elapsed) {
  const pulse = 0.5 + 0.5 * Math.sin(elapsed * 1.8);
  ringMat.opacity = 0.35 + 0.25 * pulse;
  ring.rotation.z  =  elapsed * 0.3;
  ring2.rotation.z = -elapsed * 0.18;
}

// ── Dust / sparkle particles ──────────────────────────────────────────────────
export const PARTICLE_COUNT = 180;
export const pGeo   = new THREE.BufferGeometry();
export const pPhase = new Float32Array(PARTICLE_COUNT);

const _positions = new Float32Array(PARTICLE_COUNT * 3);
for (let i = 0; i < PARTICLE_COUNT; i++) {
  _positions[i * 3]     = (Math.random() - 0.5) * 2.4;
  _positions[i * 3 + 1] = (Math.random() - 0.5) * 3.8;
  _positions[i * 3 + 2] = (Math.random() - 0.5) * 2.4;
  pPhase[i] = Math.random() * Math.PI * 2;
}
pGeo.setAttribute('position', new THREE.BufferAttribute(_positions, 3));

const pMat = new THREE.PointsMaterial({
  color: 0x55ccff, size: 0.018,
  transparent: true, opacity: 0.55,
  depthWrite: false, blending: THREE.AdditiveBlending,
});
const pPoints = new THREE.Points(pGeo, pMat);
scene.add(pPoints);

export function tickParticles(delta, elapsed) {
  const pos = pGeo.attributes.position.array;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    pos[i * 3 + 1] += delta * (0.03 + 0.018 * Math.sin(pPhase[i] + elapsed * 0.4));
    if (pos[i * 3 + 1] > 2.8) pos[i * 3 + 1] = -0.8;
  }
  pGeo.attributes.position.needsUpdate = true;
}

// ── Blue-world-only test cube ─────────────────────────────────────────────────
const cubeGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
const cubeMat = new THREE.MeshStandardMaterial({ color: 0x00ccff, roughness: 0.4, metalness: 0.3 });
const cube = new THREE.Mesh(cubeGeo, cubeMat);
cube.position.set(1.4, 0.2, 0);
cube.castShadow = true;
scene.add(cube);

// ── Blue-world visibility toggle (called by transition) ───────────────────────
export function setEnvironmentVisible(visible) {
  ring.visible    = visible;
  ring2.visible   = visible;
  pPoints.visible = visible;
  cube.visible    = visible;
}
