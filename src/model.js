import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { scene, camera } from './scene.js';
import { LAYER } from './layers.js';
import { aimLights } from './lighting.js';
import { initExplode, setOnReassembled } from './explode.js';

// ── Wireframe overlay state ───────────────────────────────────────────────────
export const wireState     = { opacity: 0.045 };
export const wireMaterials = [];

// ── Animation state ───────────────────────────────────────────────────────────
export let mixer        = null;
export let clips        = [];
export let activeAction = null;

// ── Model group reference (set after load) ────────────────────────────────────
export let modelGroup = null;

export function playClip(index, timeScale = 1.0) {
  if (!mixer || !clips.length) return;
  const clip = clips[index];
  if (!clip) return;
  if (activeAction) activeAction.fadeOut(0.5);
  activeAction = mixer.clipAction(clip);
  activeAction.reset().setEffectiveTimeScale(timeScale).setEffectiveWeight(1).fadeIn(0.5).play();
}

export function fadeOutAnimation(fadeDuration = 0.5, onDone) {
  if (!activeAction) { if (onDone) onDone(); return; }
  activeAction.fadeOut(fadeDuration);
  setTimeout(() => {
    if (activeAction) { activeAction.stop(); activeAction = null; }
    if (onDone) onDone();
  }, fadeDuration * 1000);
}

export function fadeInAnimation(index = 0) {
  playClip(index);
}

// ── Load ──────────────────────────────────────────────────────────────────────
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
      model.traverse(child => { if (child.isMesh) meshes.push(child); });

      meshes.forEach(child => {
        const mat = child.material;
        mat.side = THREE.FrontSide;
        if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
        mat.envMapIntensity = 0.5;
        child.castShadow = true;
        child.receiveShadow = true;
      });

      scene.add(model);
      modelGroup = model;

      initExplode(meshes, model);

      meshes.forEach(child => {
        const wireMat = new THREE.MeshBasicMaterial({
          color: 0x0088aa, wireframe: true,
          transparent: true, opacity: wireState.opacity, depthWrite: false,
        });
        wireMaterials.push(wireMat);
        const clone = new THREE.Mesh(child.geometry, wireMat);
        clone.scale.setScalar(1.002);
        clone.layers.set(LAYER.BLUE);
        child.add(clone);
      });

      const targetPos = new THREE.Vector3();
      new THREE.Box3().setFromObject(model).getCenter(targetPos);
      targetPos.y += 0.2;
      aimLights(targetPos);

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

// ── World switching ───────────────────────────────────────────────────────────
// Called by transition.js when the burn iris completes.
// "Blue world"  = environment visible, PBR lighting active.
// "White world" = environment hidden, character renders on plain background.

export function enterWhiteWorld() {
  camera.layers.disable(LAYER.BLUE);
  camera.layers.enable(LAYER.WHITE);
}

export function exitWhiteWorld() {
  camera.layers.disable(LAYER.WHITE);
  camera.layers.enable(LAYER.BLUE);
}
