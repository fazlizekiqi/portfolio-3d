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

export function playClip(indexOrName, timeScale = 1.0, fadeDuration = 0.5) {
  if (!mixer || !clips.length) return;
  const index = typeof indexOrName === 'string'
    ? clips.findIndex(c => c.name === indexOrName)
    : indexOrName;
  const clip = clips[index];
  if (!clip) return;

  const next = mixer.clipAction(clip);

  // Don't restart if already playing this clip
  if (next === activeAction) return;

  next.enabled   = true;
  next.timeScale = timeScale;

  if (activeAction) {
    // crossFadeTo keeps total weight at 1.0 throughout — no T-pose flash
    next.reset();
    activeAction.crossFadeTo(next, fadeDuration, true);
  } else {
    // Nothing playing yet — just fade in from zero
    next.reset().setEffectiveTimeScale(timeScale).setEffectiveWeight(1).fadeIn(fadeDuration);
  }

  next.play();
  activeAction = next;
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
  playClip('idle');
}

// ── Load ──────────────────────────────────────────────────────────────────────
export function loadModel(onReady) {
  new GLTFLoader().load(
      '/models/locomotive-character.glb',
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
        // Disable frustum culling on skinned meshes — Three.js computes the
        // bounding sphere from the rest pose, so bones that move parts far
        // from their origin (eyes, accessories, etc.) get incorrectly culled
        // and disappear the moment the animation starts.
        if (child.isSkinnedMesh) child.frustumCulled = false;

        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(mat => {
          // Do NOT force FrontSide — eyes/eyelashes/accessories are often
          // exported as DoubleSide planes; overriding them makes them invisible.
          if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
          mat.envMapIntensity = 0.5;
          mat.needsUpdate = true;
        });
        child.castShadow    = true;
        child.receiveShadow = false;  // skinned mesh self-shadow = acne
      });

      scene.add(model);
      modelGroup = model;

      initExplode(meshes, model);
      const targetPos = new THREE.Vector3();
      new THREE.Box3().setFromObject(model).getCenter(targetPos);
      targetPos.y += 0.2;
      aimLights(targetPos);

      if (gltf.animations?.length) {
        clips = gltf.animations;
        mixer = new THREE.AnimationMixer(model);
        setOnReassembled(() => playClip('idle'));
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
