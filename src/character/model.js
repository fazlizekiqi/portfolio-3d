import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { scene, camera } from '../scene.js';
import { LAYER } from '../layers.js';
import { aimLights } from '../world/blueworld.js';
import { initExplode, setOnReassembled, setExplodeCartoon } from './explode.js';
import { setTornadoCartoon } from '../world/tornado-travel.js';
import CARTOON_EFFECT from '../shaders/cartoon.frag.glsl?raw';

// ── Wireframe overlay state ───────────────────────────────────────────────────
export const wireState     = { opacity: 0.045 };
export const wireMaterials = [];

// ── Cartoon uniform tracking for skinned meshes ───────────────────────────────
// Each entry: { value: 0.0} — direct reference so we can update in-place
const _cartoonUniforms = [];

// ── Animation state ───────────────────────────────────────────────────────────
export let mixer        = null;
export let clips        = [];
export let activeAction = null;

// ── Model group reference (set after load) ────────────────────────────────────
export let modelGroup      = null;
export const spawnPosition = new THREE.Vector3();
export const spawnRotation = new THREE.Euler();

export function playClip(indexOrName, timeScale = 1.0, fadeDuration = 0.5) {
  if (!mixer || !clips.length) return;
  const index = typeof indexOrName === 'string'
    ? clips.findIndex(c => c.name === indexOrName)
    : indexOrName;
  const clip = clips[index];
  if (!clip) return;

  const next = mixer.clipAction(clip);
  if (next === activeAction) return;

  next.enabled   = true;
  next.timeScale = timeScale;

  if (activeAction) {
    next.reset();
    activeAction.crossFadeTo(next, fadeDuration, true);
  } else {
    next.reset().setEffectiveTimeScale(timeScale).setEffectiveWeight(1).fadeIn(fadeDuration);
  }

  next.play();
  activeAction = next;
}

// ── Root-motion stripping ─────────────────────────────────────────────────────
function stripRootMotion(clip) {
  let stripped = false;
  clip.tracks = clip.tracks.filter(track => {
    if (stripped) return true;
    if (!track.name.endsWith('.position')) return true;
    const values = track.values.slice();
    for (let i = 0; i < track.times.length; i++) {
      values[i * 3]     = 0;
      values[i * 3 + 2] = 0;
    }
    track.values = values;
    stripped = true;
    return true;
  });
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
        if (child.isSkinnedMesh) child.frustumCulled = false;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(mat => {
          if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
          mat.envMapIntensity = 0.5;

          // ── Inject cartoon effect via onBeforeCompile ─────────────────────
          const cartoonUniform = { value: 0.0 };
          _cartoonUniforms.push(cartoonUniform);

          const _prevOBC = mat.onBeforeCompile;
          mat.onBeforeCompile = (shader) => {
            if (_prevOBC) _prevOBC(shader);
            shader.uniforms.uCartoon = cartoonUniform;

            // Declare uniform in fragment shader
            shader.fragmentShader = shader.fragmentShader
              .replace(
                '#include <common>',
                '#include <common>\nuniform float uCartoon;'
              )
              .replace(
                '#include <dithering_fragment>',
                '#include <dithering_fragment>\n' + CARTOON_EFFECT
              );
          };

          mat.needsUpdate = true;
        });
        child.castShadow    = true;
        child.receiveShadow = false;
      });

      scene.add(model);
      modelGroup = model;
      spawnPosition.copy(model.position);
      spawnRotation.copy(model.rotation);

      initExplode(meshes, model);
      const targetPos = new THREE.Vector3();
      new THREE.Box3().setFromObject(model).getCenter(targetPos);
      targetPos.y += 0.2;
      aimLights(targetPos);

      if (gltf.animations?.length) {
        clips = gltf.animations;
        clips.forEach(stripRootMotion);
        mixer = new THREE.AnimationMixer(model);

        setOnReassembled(() => playClip('idle'));
      }

      if (onReady) onReady();
    },
    undefined,
    (err) => console.error('GLB error:', err)
  );
}

// ── World switching ───────────────────────────────────────────────────────────
export function enterWhiteWorld() {
  camera.layers.disable(LAYER.BLUE);
  camera.layers.enable(LAYER.WHITE);
}

export function exitWhiteWorld() {
  camera.layers.disable(LAYER.WHITE);
  camera.layers.enable(LAYER.BLUE);
}

/**
 * Drive the cartoon / cel-shading effect on all character meshes.
 *   t = 0 → normal PBR look (blue world)
 *   t = 1 → full cartoon look (white world)
 * Call this every frame (or on transition tick) with the transition progress.
 */
export function setCharacterWhiteWorld(t) {
  // Skinned meshes
  _cartoonUniforms.forEach(u => { u.value = t; });
  // Explode meshes
  setExplodeCartoon(t);
  // Tornado travel meshes
  setTornadoCartoon(t);
}

