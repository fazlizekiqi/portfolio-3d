import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { scene, camera } from '../scene.js';
import { LAYER } from '../layers.js';
import { aimLights } from '../world/blueworld.js';
import { initExplode, setOnReassembled, setExplodeCartoon } from './explode.js';
import { initAboutWireframe } from './about-wireframe.js';
import { setTornadoCartoon } from '../world/tornado-travel.js';
import CARTOON_EFFECT from '../shaders/cartoon.frag.glsl?raw';
import { showIdleUI } from '../presentation/ui.js';

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

// Incremented each time a new featured clip starts, cancels pending idle loops.
let _idleLoopToken = 0;

/** Call before any clip change to cancel pending idle-loop and random-idle timeouts. */
export function cancelIdleLoop() {
  _idleLoopToken++;
  _randomIdleToken++;
}

/**
 * Play a clip ONCE, then smoothly alternate idle ↔ talking until the next
 * slide overrides by calling playFeaturedClip / playClip again.
 * If the clip is not found, falls back straight to idle.
 */
export function playFeaturedClip(name, fadeDuration = 0.45, onFinished = null) {
  if (!mixer || !clips.length) return;
  _idleLoopToken++;
  const token = _idleLoopToken;

  const clip = clips.find(c => c.name === name);
  if (!clip) {
    console.warn(`[model] playFeaturedClip: clip "${name}" not found. Available:`, clips.map(c => c.name));
    _crossfadeToIdle(token, fadeDuration);
    return;
  }

  const next = mixer.clipAction(clip);
  next.setLoop(THREE.LoopOnce, 1);
  next.clampWhenFinished = true;
  next.enabled   = true;
  next.timeScale = 1.0;

  if (activeAction && activeAction !== next) {
    next.reset();
    activeAction.crossFadeTo(next, fadeDuration, true);
  } else {
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fadeDuration);
  }
  next.play();
  activeAction = next;

  const handler = (e) => {
    if (e.action !== next) return;
    mixer.removeEventListener('finished', handler);
    if (_idleLoopToken !== token) return;
    if (onFinished) onFinished();
    _crossfadeToIdle(token, 0.5);
  };
  mixer.addEventListener('finished', handler);
}

function _crossfadeToIdle(token, fadeDuration = 0.5) {
  if (_idleLoopToken !== token) return;
  playClip('idle', 1.0, fadeDuration);
}

// ── Random idle animations ────────────────────────────────────────────────────
// Curated pool: fun/expressive clips that play while the user hasn't interacted.
// Split into tiers so rare gems (gangnam, push-up) don't appear too often.
const _IDLE_COMMON = [
  'yawn', 'relieved-sigh', 'whatever', 'bored',
  'waving', 'waving-both-hands', 'wiping-sweat',
  'head-nod-yes', 'annoyed-head-shake', 'telling-a-secret',
  'listen-to-music', 'praying', 'victory', 'salute',
];
const _IDLE_RARE = [
  'gangam-style', 'pick-fruit', 'jump',
];

let _randomIdleToken = 0;

/**
 * Start the random idle loop: plays idle, waits, then fires a random
 * expressive clip, returns to idle, repeats. Runs until cancelRandomIdle()
 * or a new slide takes over (cancelIdleLoop is called).
 */
export function playRandomIdleAnim() {
  _randomIdleToken++;
  _idleLoopToken++;
  const rToken  = _randomIdleToken;
  const iToken  = _idleLoopToken;

  // Start in idle, then kick off the loop
  playClip('briefcase-standing', 1.0, 0.6);
  _scheduleNextRandom(rToken, iToken);
}

export function cancelRandomIdle() {
  _randomIdleToken++;
}

function _scheduleNextRandom(rToken, iToken) {
  const wait = 4000 + Math.random() * 5000;
  setTimeout(() => {
    if (_randomIdleToken !== rToken || _idleLoopToken !== iToken) return;

    const roll = Math.random();

    // 20 % — dedicated push-up sequence
    if (roll < 0.20) {
      const hasAll = ['idle-to-push-up', 'push-up', 'push-up-to-idle']
        .every(n => clips.find(c => c.name === n));
      if (hasAll) {
        _playPushUpSequence(rToken, iToken);
        return;
      }
    }

    // 10 % — rare pool (gangnam, pick-fruit, jump — push-up removed from here)
    const pool = roll < 0.30 ? _IDLE_RARE : _IDLE_COMMON;
    const available = pool.filter(n => clips.find(c => c.name === n));
    if (!available.length) { _scheduleNextRandom(rToken, iToken); return; }

    const name = available[Math.floor(Math.random() * available.length)];


    _playOnceRandom(name, rToken, iToken, () => {
      playClip('idle', 1.0, 0.5);
      _scheduleNextRandom(rToken, iToken);
    });
  }, wait);
}

/** Play a single clip once, token-guarded, then call cb. */
function _playOnceRandom(name, rToken, iToken, cb) {
  const clip = clips.find(c => c.name === name);
  if (!clip) { if (cb) cb(); return; }

  const next = mixer.clipAction(clip);
  next.setLoop(THREE.LoopOnce, 1);
  next.clampWhenFinished = true;
  next.enabled   = true;
  next.timeScale = 1.0;

  if (activeAction && activeAction !== next) {
    next.reset();
    activeAction.crossFadeTo(next, 0.5, true);
  } else {
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.5);
  }
  next.play();
  activeAction = next;

  const handler = (e) => {
    if (e.action !== next) return;
    mixer.removeEventListener('finished', handler);
    if (_randomIdleToken !== rToken || _idleLoopToken !== iToken) return;
    if (cb) cb();
  };
  mixer.addEventListener('finished', handler);
}

/**
 * Full push-up sequence:
 *   idle-to-push-up → push-up × REPS → push-up-to-idle → idle → schedule next
 */
function _playPushUpSequence(rToken, iToken, reps = 5) {
  if (_randomIdleToken !== rToken || _idleLoopToken !== iToken) return;

  // Step 1 — get down
  _playOnceRandom('idle-to-push-up', rToken, iToken, () => {
    // Step 2 — do reps
    _playPushUpReps(rToken, iToken, reps, () => {
      // Step 3 — get back up
      _playOnceRandom('push-up-to-idle', rToken, iToken, () => {
        // Step 4 — back to idle loop
        playClip('idle', 1.0, 0.5);
        _scheduleNextRandom(rToken, iToken);
      });
    });
  });
}

function _playPushUpReps(rToken, iToken, reps, cb) {
  if (_randomIdleToken !== rToken || _idleLoopToken !== iToken) return;

  const clip = clips.find(c => c.name === 'push-up');
  if (!clip) { if (cb) cb(); return; }

  const next = mixer.clipAction(clip);
  next.setLoop(THREE.LoopRepeat, reps);
  next.clampWhenFinished = true;
  next.enabled   = true;
  next.timeScale = 1.0;

  if (activeAction && activeAction !== next) {
    next.reset();
    activeAction.crossFadeTo(next, 0.3, true);
  } else {
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.3);
  }
  next.play();
  activeAction = next;

  const handler = (e) => {
    if (e.action !== next) return;
    mixer.removeEventListener('finished', handler);
    if (_randomIdleToken !== rToken || _idleLoopToken !== iToken) return;
    if (cb) cb();
  };
  mixer.addEventListener('finished', handler);
}

/**
 * Play an array of clip names in sequence.
 * Between each clip the character idles for `idleBetweenMs` ms.
 * After the last clip it fades back to idle indefinitely.
 * Cancels cleanly when a new slide fires.
 */
export function playClipSequence(names, idleBetweenMs = 2500, fadeDuration = 0.45) {
  if (!mixer || !clips.length || !names.length) return;
  _idleLoopToken++;
  const token = _idleLoopToken;
  _playSequenceStep(names, 0, token, idleBetweenMs, fadeDuration);
}

function _playSequenceStep(names, index, token, idleBetweenMs, fadeDuration) {
  if (_idleLoopToken !== token) return;
  if (index >= names.length) {
    _crossfadeToIdle(token, 0.5);
    return;
  }

  const name = names[index];
  const clip = clips.find(c => c.name === name);
  if (!clip) {
    console.warn(`[model] playClipSequence: clip "${name}" not found. Available:`, clips.map(c => c.name));
    _playSequenceStep(names, index + 1, token, idleBetweenMs, fadeDuration);
    return;
  }

  const next = mixer.clipAction(clip);
  next.setLoop(THREE.LoopOnce, 1);
  next.clampWhenFinished = true;
  next.enabled   = true;
  next.timeScale = 1.0;

  if (activeAction && activeAction !== next) {
    next.reset();
    activeAction.crossFadeTo(next, fadeDuration, true);
  } else {
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fadeDuration);
  }
  next.play();
  activeAction = next;

  const handler = (e) => {
    if (e.action !== next) return;
    mixer.removeEventListener('finished', handler);
    if (_idleLoopToken !== token) return;

    if (index + 1 < names.length) {
      // Direct crossfade to the next clip — no idle bounce in between
      _playSequenceStep(names, index + 1, token, idleBetweenMs, fadeDuration);
    } else {
      _crossfadeToIdle(token, 0.5);
    }
  };
  mixer.addEventListener('finished', handler);
}


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
export function loadModel(onReady, onProgress) {
  new GLTFLoader().load(
    `${import.meta.env.BASE_URL}models/character.glb`,
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
      // ALL meshes — rigid attachments (hat/glasses) must burn away too,
      // otherwise they stay visible after the about-slide dissolve
      initAboutWireframe(meshes, model);
      const targetPos = new THREE.Vector3();
      new THREE.Box3().setFromObject(model).getCenter(targetPos);
      targetPos.y += 0.2;
      aimLights(targetPos);

      if (gltf.animations?.length) {
        clips = gltf.animations;
        clips.forEach(stripRootMotion);
        mixer = new THREE.AnimationMixer(model);

        console.log('[model] available clips:', clips.map(c => c.name));

        setOnReassembled(() => {
          showIdleUI();
          playRandomIdleAnim();
        });
      }

      if (onReady) onReady();
    },
    (xhr) => {
      if (onProgress && xhr.total) {
        onProgress(xhr.loaded / xhr.total);
      }
    },
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

