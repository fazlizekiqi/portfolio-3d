import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { scene } from './scene.js';
import { aimLights } from './lighting.js';
import { initExplode, setOnReassembled } from './explode.js';
import { setEnvironmentVisible } from './environment.js';

export const wireState     = { opacity: 0.045 };
export const wireMaterials = [];

// Cartoon mode state — just tracks whether env is hidden
let _cartoonActive = false;
const _modelMeshes = [];   // all scene meshes

export let mixer        = null;
export let clips        = [];
export let activeAction = null;
export let modelGroup   = null;   // set after load, used for always-on-top pass

export function playClip(index, timeScale = 1.0) {
  if (!mixer || !clips.length) return;
  const clip = clips[index];
  if (!clip) return;
  if (activeAction) activeAction.fadeOut(0.5);
  activeAction = mixer.clipAction(clip);
  activeAction.reset().setEffectiveTimeScale(timeScale).setEffectiveWeight(1).fadeIn(0.5).play();
}

// Smoothly fade out the running animation, then call onDone once it's silent.
// fadeDuration – seconds for the crossfade out
export function fadeOutAnimation(fadeDuration = 0.5, onDone) {
  if (!activeAction) { if (onDone) onDone(); return; }
  activeAction.fadeOut(fadeDuration);
  // Wait for the fade to finish before calling back
  setTimeout(() => {
    if (activeAction) { activeAction.stop(); activeAction = null; }
    if (onDone) onDone();
  }, fadeDuration * 1000);
}

// Fade the idle clip back in (used after reassembly)
export function fadeInAnimation(index = 0) {
  playClip(index);
}

export function loadModel(onReady) {
  new GLTFLoader().load(
    '/models/good-result.glb',
    (gltf) => {
      const model = gltf.scene;
      const box    = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size   = box.getSize(new THREE.Vector3());
      model.position.sub(center);
      model.position.y += size.y * 0.5 - 1;
      model.scale.setScalar(2 / Math.max(size.x, size.y, size.z));

      const meshes = [];
      model.traverse((child) => {
        if (child.isMesh) {
          meshes.push(child);
          _modelMeshes.push(child);
        }
      });

      // 1. Fix up original materials first
      meshes.forEach((child) => {
        const mat = child.material;
        mat.side = THREE.FrontSide;
        if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
        mat.envMapIntensity = 0.5;
        child.castShadow = true;
        child.receiveShadow = true;
      });

      scene.add(model);
      modelGroup = model;

      // 2. Exploding-object effect (hides originals, plays intro reassembly)
      initExplode(meshes, model);

      // 3. Wireframe overlays
      meshes.forEach((child) => {
        const wireMat = new THREE.MeshBasicMaterial({
          color: 0x0088aa, wireframe: true,
          transparent: true, opacity: wireState.opacity, depthWrite: false,
        });
        wireMaterials.push(wireMat);
        const clone = new THREE.Mesh(child.geometry, wireMat);
        clone.scale.setScalar(1.002);
        child.add(clone);
      });


      const targetPos = new THREE.Vector3();
      new THREE.Box3().setFromObject(model).getCenter(targetPos);
      targetPos.y += 0.2;
      aimLights(targetPos);

      // 4. Set up animation mixer — play only after intro reassembly finishes
      if (gltf.animations?.length) {
        clips = gltf.animations;
        mixer = new THREE.AnimationMixer(model);
        setOnReassembled(() => playClip(0));
      }

      if (onReady) onReady();
    },
    (xhr) => console.log(`Loading: ${((xhr.loaded / xhr.total) * 100).toFixed(1)}%`),
    (err) => console.error('GLB error:', err)
  );
}

// ── Cartoon mode ──────────────────────────────────────────────────────────────
export function enterCartoonMode() {
  if (_cartoonActive) return;
  _cartoonActive = true;
  setEnvironmentVisible(false);
}

export function exitCartoonMode() {
  if (!_cartoonActive) return;
  _cartoonActive = false;
  setEnvironmentVisible(true);
}

