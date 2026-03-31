import * as THREE from 'three';
import { scene } from '../scene.js';
import { playClip, modelGroup } from './model.js';
import VERT_PARS      from '../shaders/explode.vert.pars.glsl?raw';
import VERT_POSITION  from '../shaders/explode.vert.position.glsl?raw';
import VERT_NORMAL    from '../shaders/explode.vert.normal.glsl?raw';
import FRAG_PARS      from '../shaders/explode.frag.pars.glsl?raw';
import FRAG_ALPHA     from '../shaders/explode.frag.alpha.glsl?raw';

// ─────────────────────────────────────────────────────────────────────────────
//  Tunable parameters
// ─────────────────────────────────────────────────────────────────────────────
export const explodeParams = {
  speed:         0.9, animDelay:     0.6,

  explodeDelay:  0.1,

  staggerSpread: 0.6,
  staggerWindow: 0.4,

  flyMin:        2.5,
  flyRand:       3.5,
  collapseAmt:   0.3,

  rotTurns:      2.0,
  rotRandTurns:  4.0,

  fadeStart:     0.4,
  fadeEnd:       1.0,
};

// ─────────────────────────────────────────────────────────────────────────────
//  Progress convention
//  ─────────────────
//  progress = 0  →  fully assembled  (pieces sit in their rest positions)
//  progress = 1  →  fully exploded   (pieces scattered in space)
//
//  direction =  1  →  exploding   (progress 0 → 1)
//  direction = -1  →  reassembling (progress 1 → 0)
//  direction =  0  →  idle
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
//  Material / geometry builders  (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────
function buildExplodeMaterial(srcMat) {
  const mat = srcMat.clone();
  mat.transparent = true;
  mat.side        = THREE.DoubleSide;

  mat.userData.explodeUniforms = {
    uProgress:      { value: 0.0 },   // start assembled
    uStaggerSpread: { value: explodeParams.staggerSpread },
    uStaggerWindow: { value: explodeParams.staggerWindow },
    uFlyMin:        { value: explodeParams.flyMin },
    uFlyRand:       { value: explodeParams.flyRand },
    uCollapseAmt:   { value: explodeParams.collapseAmt },
    uRotTurns:      { value: explodeParams.rotTurns },
    uRotRandTurns:  { value: explodeParams.rotRandTurns },
    uFadeStart:     { value: explodeParams.fadeStart },
    uFadeEnd:       { value: explodeParams.fadeEnd },
  };

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.explodeUniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>',        '#include <common>\n'        + VERT_PARS)
      .replace('#include <beginnormal_vertex>', VERT_NORMAL)
      .replace('#include <begin_vertex>',  VERT_POSITION);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',        '#include <common>\n'        + FRAG_PARS)
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + FRAG_ALPHA);

    mat.userData.shader = shader;
  };

  return mat;
}

function buildExplodeGeometry(srcGeo) {
  const base  = srcGeo.index ? srcGeo.toNonIndexed() : srcGeo.clone();
  base.computeVertexNormals();

  const pos    = base.attributes.position;
  const count  = pos.count;
  const center = new Float32Array(count * 3);
  const rand   = new Float32Array(count);

  for (let i = 0; i < count; i += 3) {
    const ax = pos.getX(i),   ay = pos.getY(i),   az = pos.getZ(i);
    const bx = pos.getX(i+1), by = pos.getY(i+1), bz = pos.getZ(i+1);
    const cx = pos.getX(i+2), cy = pos.getY(i+2), cz = pos.getZ(i+2);
    const mx = (ax+bx+cx)/3,  my = (ay+by+cy)/3,  mz = (az+bz+cz)/3;
    const r  = Math.random();
    for (let v = 0; v < 3; v++) {
      center[(i+v)*3]     = mx;
      center[(i+v)*3+1]   = my;
      center[(i+v)*3+2]   = mz;
      rand[i+v]           = r;
    }
  }

  base.setAttribute('aCenter', new THREE.BufferAttribute(center, 3));
  base.setAttribute('aRand',   new THREE.BufferAttribute(rand,   1));
  return base;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Internal state
// ─────────────────────────────────────────────────────────────────────────────
export const explodeState = {
  progress:  0,   // 0 = assembled, 1 = exploded
  direction: 0,   // 0 = idle, 1 = exploding, -1 = reassembling
};

const explodeMeshes  = [];
const originalMeshes = [];
let   explodeGroup   = null;
let   onReassembled  = null;  // fires once after reassembly + animDelay

// Pending callback registered by explodeAndThen — fires once fully exploded
let _onExplodeDone  = null;

export function getExplodeGroup()        { return explodeGroup; }
export function setOnReassembled(fn)     { onReassembled = fn; }

// ─────────────────────────────────────────────────────────────────────────────
//  Uniform sync (GUI tuning)
// ─────────────────────────────────────────────────────────────────────────────
function syncUniforms() {
  const p = explodeParams;
  explodeMeshes.forEach(m => {
    const u = m.material.userData.shader?.uniforms ?? m.material.userData.explodeUniforms;
    if (!u) return;
    u.uStaggerSpread.value = p.staggerSpread;
    u.uStaggerWindow.value = p.staggerWindow;
    u.uFlyMin.value        = p.flyMin;
    u.uFlyRand.value       = p.flyRand;
    u.uCollapseAmt.value   = p.collapseAmt;
    u.uRotTurns.value      = p.rotTurns;
    u.uRotRandTurns.value  = p.rotRandTurns;
    u.uFadeStart.value     = p.fadeStart;
    u.uFadeEnd.value       = p.fadeEnd;
  });
}
export function applyExplodeParams() { syncUniforms(); }
export function updateExplodeLights() {}   // no-op, kept for API compat

// ─────────────────────────────────────────────────────────────────────────────
//  initExplode — called once after model load
// ─────────────────────────────────────────────────────────────────────────────
export function initExplode(meshes, modelGroup) {
  explodeGroup = new THREE.Group();

  explodeGroup.position.copy(modelGroup.position);
  explodeGroup.quaternion.copy(modelGroup.quaternion);
  explodeGroup.scale.copy(modelGroup.scale);

  meshes.forEach((mesh) => {
    const srcMat   = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const mat      = buildExplodeMaterial(srcMat);
    const geo      = buildExplodeGeometry(mesh.geometry);
    const explMesh = new THREE.Mesh(geo, mat);

    explMesh.castShadow       = true;
    explMesh.receiveShadow    = true;
    explMesh.matrix.copy(mesh.matrix);
    explMesh.matrixAutoUpdate = false;

    explodeGroup.add(explMesh);
    explodeMeshes.push(explMesh);

    mesh.visible = true;          // originals start visible
    originalMeshes.push(mesh);
  });

  // Start assembled, hidden — original skinned meshes are shown
  explodeGroup.visible   = false;
  explodeState.progress  = 0;
  explodeState.direction = 0;
  _setProgress(0);

  scene.add(explodeGroup);
}

// ─────────────────────────────────────────────────────────────────────────────
//  resetExplodeGroupTransform
//  Move the explode group to a new world position/rotation so reassembly
//  lands at the correct location when the character has been moved.
// ─────────────────────────────────────────────────────────────────────────────
export function resetExplodeGroupTransform(position, rotation) {
  if (!explodeGroup) return;
  explodeGroup.position.copy(position);
  if (rotation) explodeGroup.rotation.copy(rotation);
}

// ─────────────────────────────────────────────────────────────────────────────
//  introScene — initial reveal on first load
// ─────────────────────────────────────────────────────────────────────────────

const INTRO_SPEED  = 0.18;  // slow, cinematic reassembly for the intro
const NORMAL_SPEED = 0.9;   // speed used for all subsequent explode/reassemble

/**
 * Call once after loadModel() completes.
 * Starts the character fully scattered, then slowly reassembles it into
 * the blue world — the first thing the user sees is the character
 * piecing itself together from nothing.
 *
 * When reassembly finishes the normal speed is restored and the
 * onReassembled callback fires (model.js → playClip('idle')).
 */
export function introScene() {
  // Slow speed for the cinematic intro only
  explodeParams.speed = INTRO_SPEED;

  // Hide skinned originals — explode group owns the visuals
  originalMeshes.forEach(m => { m.visible = false; });

  // Seed to fully exploded state so pieces start scattered
  explodeState.progress  = 1;
  explodeState.direction = 0;
  _setProgress(1);
  explodeGroup.visible = true;

  // Wrap the existing onReassembled so we can restore speed first,
  // then let the original callback (playClip('idle')) run normally.
  const existingCb = onReassembled;
  onReassembled = () => {
    explodeParams.speed = NORMAL_SPEED;   // back to normal for all future interactions
    if (existingCb) existingCb();
  };

  // Begin reassembly — tickExplode drives progress 1 → 0
  triggerReassemble();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Core triggers  — fully decoupled from world state and animations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start exploding.
 * Shows the explode group immediately (progress=0, assembled) and
 * drives it toward 1 (scattered).  Hides the skinned originals.
 * Has NO knowledge of white/blue world.
 */
export function triggerExplode() {
  if (explodeState.direction === 1) return;   // already exploding

  // Sync explode group to wherever the character is right now.
  // The group was built at spawn — if the player has moved the character
  // this MUST be updated or the explosion plays at the wrong position.
  if (modelGroup) {
    explodeGroup.position.copy(modelGroup.position);
    explodeGroup.rotation.copy(modelGroup.rotation);
  }

  // Always start from assembled state (progress=0) so the full arc plays
  explodeState.progress = 0;
  _setProgress(0);

  // Swap visibility: show explode mesh, hide skinned originals
  explodeGroup.visible = true;
  originalMeshes.forEach(m => { m.visible = false; });


  explodeState.direction = 1;
}

/**
 * Start reassembling.
 * Drives progress from wherever it is back toward 0 (assembled).
 */
export function triggerReassemble() {
  if (explodeState.direction === -1) return;  // already reassembling
  explodeState.direction = -1;
}

export function toggleExplode() {
  if (explodeState.progress > 0.5 || explodeState.direction === 1) triggerReassemble();
  else triggerExplode();
}

/**
 * Explode, wait for fully exploded + explodeDelay, then call onDone.
 * Decoupled — caller decides what to do after (world switch, etc.).
 */
export function explodeAndThen(onDone) {
  _onExplodeDone = onDone;

  // Already fully exploded and idle — fire immediately after hold delay
  if (explodeState.progress >= 1 && explodeState.direction === 0) {
    const cb = _onExplodeDone;
    _onExplodeDone = null;
    setTimeout(cb, explodeParams.explodeDelay * 1000);
    return;
  }

  // triggerExplode will drive progress to 1; tickExplode will call _onExplodeDone
  triggerExplode();
}

// ─────────────────────────────────────────────────────────────────────────────
//  tickExplode — called every frame from main.js
// ─────────────────────────────────────────────────────────────────────────────
export function tickExplode(delta) {
  if (explodeState.direction === 0) return;

  explodeState.progress += explodeState.direction * explodeParams.speed * delta;
  explodeState.progress  = Math.max(0, Math.min(1, explodeState.progress));

  _setProgress(explodeState.progress);

  // ── Fully exploded ────────────────────────────────────────────────────────
  if (explodeState.progress >= 1 && explodeState.direction === 1) {
    explodeState.direction = 0;

    if (_onExplodeDone) {
      const cb   = _onExplodeDone;
      _onExplodeDone = null;
      setTimeout(cb, explodeParams.explodeDelay * 1000);
    }
  }

  // ── Fully reassembled ────────────────────────────────────────────────────
  if (explodeState.progress <= 0 && explodeState.direction === -1) {
    explodeState.direction = 0;
    explodeGroup.visible   = false;
    originalMeshes.forEach(m => { m.visible = true; });

    if (onReassembled) {
      const cb = onReassembled;
      onReassembled = null;
      setTimeout(cb, explodeParams.animDelay * 1000);
    } else {
      setTimeout(() => playClip('idle'), explodeParams.animDelay * 1000);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Internal helpers
// ─────────────────────────────────────────────────────────────────────────────
function _setProgress(p) {
  explodeMeshes.forEach(m => {
    const u = m.material.userData.shader?.uniforms ?? m.material.userData.explodeUniforms;
    if (u) u.uProgress.value = p;
  });
}
