import * as THREE from 'three';
import { scene } from './scene.js';

// ── FPS counter element ───────────────────────────────────────────────────────
export const fpsEl = document.createElement('div');
fpsEl.style.cssText = `
  position:fixed;top:12px;right:16px;z-index:100;
  font-family:'Share Tech Mono','Courier New',monospace;
  font-size:11px;color:#336677;letter-spacing:.08em;pointer-events:none;`;
fpsEl.textContent = 'FPS --';
document.body.appendChild(fpsEl);

// ── Nimbus / glowing platform ring ───────────────────────────────────────────
const ringGeo = new THREE.TorusGeometry(0.9, 0.018, 12, 80);
const ringMat = new THREE.MeshBasicMaterial({ color: 0x00aacc, transparent: true, opacity: 0.55 });
const ring = new THREE.Mesh(ringGeo, ringMat);
ring.rotation.x = Math.PI / 2;
ring.position.y = -0.95;
scene.add(ring);

// Outer glow ring
const ringGeo2 = new THREE.TorusGeometry(0.93, 0.006, 8, 80);
const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x0055aa, transparent: true, opacity: 0.3 });
const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
ring2.rotation.x = Math.PI / 2;
ring2.position.y = -0.95;
scene.add(ring2);

export function tickCloud(elapsed) {
  const pulse = 0.5 + 0.5 * Math.sin(elapsed * 1.8);
  ringMat.opacity = 0.35 + 0.25 * pulse;
  ring.rotation.z = elapsed * 0.3;
  ring2.rotation.z = -elapsed * 0.18;
}


// ── Dust / sparkle particles ──────────────────────────────────────────────────
export const PARTICLE_COUNT = 180;

const positions = new Float32Array(PARTICLE_COUNT * 3);
export const pPhase = new Float32Array(PARTICLE_COUNT);

for (let i = 0; i < PARTICLE_COUNT; i++) {
  positions[i * 3]     = (Math.random() - 0.5) * 2.4;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 3.8;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 2.4;
  pPhase[i] = Math.random() * Math.PI * 2;
}

export const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const pMat = new THREE.PointsMaterial({
  color: 0x55ccff,
  size: 0.018,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

const pPoints = new THREE.Points(pGeo, pMat);
scene.add(pPoints);

export function setEnvironmentVisible(visible) {
  ring.visible    = visible;
  ring2.visible   = visible;
  pPoints.visible = visible;
}

