import * as THREE from 'three';
import { scene } from './scene.js';

// ── Ambient ───────────────────────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0x8899bb, 0.6);
scene.add(ambient);

// ── Key light (warm, top-right) ───────────────────────────────────────────────
const keyLight = new THREE.DirectionalLight(0xfff0dd, 1.6);
keyLight.position.set(3, 5, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 20;
keyLight.shadow.camera.left = -3;
keyLight.shadow.camera.right = 3;
keyLight.shadow.camera.top = 3;
keyLight.shadow.camera.bottom = -3;
scene.add(keyLight);

// ── Fill light (cool, left) ───────────────────────────────────────────────────
const fillLight = new THREE.DirectionalLight(0xaaccff, 0.5);
fillLight.position.set(-4, 2, 3);
scene.add(fillLight);

// ── Rim light (back, teal) ────────────────────────────────────────────────────
const rimLight = new THREE.DirectionalLight(0x00ccff, 0.4);
rimLight.position.set(0, 3, -5);
scene.add(rimLight);

// ── Point the lights at the model centre ─────────────────────────────────────
export function aimLights(targetPos) {
  keyLight.target.position.copy(targetPos);
  keyLight.target.updateMatrixWorld();
  fillLight.target.position.copy(targetPos);
  fillLight.target.updateMatrixWorld();
  rimLight.target.position.copy(targetPos);
  rimLight.target.updateMatrixWorld();
}

export function tickLighting(cam) {
  fillLight.position.copy(cam.position).multiplyScalar(0.6).add(new THREE.Vector3(-2, 1, 0));
}

// Returns live references so explode.js can read directions/colors each frame
export function getLights() {
  return { ambient, keyLight, fillLight, rimLight };
}

