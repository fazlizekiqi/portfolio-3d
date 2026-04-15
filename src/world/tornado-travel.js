/**
 * tornado-travel.js
 *
 * Explodes the character into a mini tornado that travels to a destination
 * and reassembles there. Uses the same onBeforeCompile injection pattern
 * as explode.js — same geometry, same material clones, same aCenter/aRand.
 *
 * Lifecycle
 * ─────────
 *   spawnCloud(meshes, modelGroup)  – hide originals, spawn clones, start cloud.
 *   travelTo(destination, onDone)   – spiral toward destination.
 *   disposeCloud()                  – force cleanup.
 *   tickTornado(delta)              – call every frame.
 */

import * as THREE from 'three';
import { scene, camera, controls } from '../scene.js';
import VERT_PARS     from '../shaders/tornado.vert.pars.glsl?raw';
import VERT_POSITION from '../shaders/tornado.vert.position.glsl?raw';
import FRAG_PARS     from '../shaders/tornado.frag.pars.glsl?raw';
import FRAG_ALPHA    from '../shaders/tornado.frag.alpha.glsl?raw';
import CARTOON_EFFECT from '../shaders/cartoon.frag.glsl?raw';


export const tornadoParams = {
  // Cloud shape (shader uniforms at progress=0 = assembled)
  flyMin:         0.22,
  flyRand:        0.38,
  collapseAmt:    0.25,
  staggerSpread:  0.7,
  staggerWindow:  0.5,

  // Tornado spiral geometry
  tornadoRadius:  0.85,
  tornadoHeight:  1.25,
  rotTurns:       2.5,
  rotRandTurns:   3.0,

  // Fade during arrival
  fadeStart:      0.88,
  fadeEnd:        1.0,

  // Timing
  travelSpeed:      0.10,
  reassembleSpeed:  0.25,
};


let _group          = null;    // THREE.Group — mirrors modelGroup transform
let _tornadoMats    = [];      // cloned materials with tornado shader injected
let _tornadoMeshes  = [];      // cloned THREE.Mesh objects (parallel to _tornadoMats)
let _originalMeshes = [];      // hidden originals (restored on arrival)
let _modelGroupRef  = null;    // reference to the character's root group

let _phase          = -1;      // -1=off | 1=travel | 2=reassembly
let _cloudProgress  = 0;       // 0→1
let _travelProgress = 0;       // 0→1

let _destination    = new THREE.Vector3();
let _onArrived      = null;

// Reusable scratch vectors for local-space conversion
const _invModelMat = new THREE.Matrix4();
const _originLocal = new THREE.Vector3();
const _destLocal   = new THREE.Vector3();

const _tornadoWorldPos   = new THREE.Vector3();
const _camPos            = new THREE.Vector3();
const _camPosSmoothed    = new THREE.Vector3();
const _camLookAtSmoothed = new THREE.Vector3();
let   _camFollowing      = false;
let   _originWorldPos    = new THREE.Vector3();

let   _settling          = false;
const _settleTarget      = new THREE.Vector3();
let   _settleT           = 0.0;
const _settleCamStart    = new THREE.Vector3();
const _settleCamEnd      = new THREE.Vector3();
const _settleLookStart   = new THREE.Vector3();

export const tornadoCamParams = {
  // Follow
  followHeight:   0.5,
  followDist:     10,
  lerpPos:        0.6,
  lerpLook:       0.4,

  // Entry crane shot
  entryDuration:  1.1,
  entryHeight:    5.0,

  // Post-arrival settle
  settleDuration: 2.8,
  settlePosLerp:  5,
  settleLookLerp: 3,
};

let _camEntryT = 0.0;


/**
 * Seed smoothed camera state from the current OrbitControls so there
 * is zero first-frame jump, then disable controls so they can't fight us.
 */
function _camStartFollow() {
  _camPosSmoothed.copy(camera.position);
  _camPos.copy(camera.position);
  _camLookAtSmoothed.copy(controls ? controls.target : _group.position);
  _camEntryT    = 0.0;
  _camFollowing = true;
  if (controls) controls.enabled = false;
}

/**
 * Overhead pull-back arc at the start of travel. The camera rises above
 * followPos while looking down at the dissolving origin, then descends
 * into the normal follow position.
 */
function _camTickEntry(delta, followPos) {
  _camEntryT = Math.min(_camEntryT + delta / tornadoCamParams.entryDuration, 1.0);
  const ease = _cubicEaseOut(_camEntryT);

  const entryPos    = _computeEntryPosition(followPos, ease);
  const entryLookAt = _computeEntryLookAt(ease);

  _camPos.copy(entryPos);
  _applyCameraLerp(delta, entryLookAt);
  return _camEntryT >= 1.0;
}

function _computeEntryPosition(followPos, ease) {
  return new THREE.Vector3()
    .copy(_camPosSmoothed)
    .lerp(
      new THREE.Vector3().copy(followPos).setY(followPos.y + tornadoCamParams.entryHeight * (1.0 - ease)),
      ease
    );
}

function _computeEntryLookAt(ease) {
  return new THREE.Vector3()
    .copy(_originWorldPos).setY(_originWorldPos.y + 1.2)
    .lerp(_tornadoWorldPos, ease);
}
/**
 * Chase camera — sits behind and above the tornado centroid, lazily
 * following with exponential lerp. Delegates to entry arc until complete.
 */
function _camTickFollow(delta) {
  _updateTornadoWorldPos();
  const followPos = _computeFollowPosition();

  if (_camEntryT < 1.0) {
    _camTickEntry(delta, followPos);
    return;
  }

  _camPos.copy(followPos);
  _applyCameraLerp(delta, _tornadoWorldPos);
}

function _updateTornadoWorldPos() {
  _tornadoWorldPos.lerpVectors(_originWorldPos, _destination, _travelProgress);
  const charY = _modelGroupRef ? _modelGroupRef.position.y : 0;
  _tornadoWorldPos.y = charY + 1.2;
}

function _computeFollowPosition() {
  const travelDir = new THREE.Vector3()
    .subVectors(_destination, _originWorldPos)
    .setY(0).normalize();

  const dist = THREE.MathUtils.clamp(
    _camPosSmoothed.distanceTo(_tornadoWorldPos),
    tornadoCamParams.followDist, tornadoCamParams.followDist * 1.5
  );

  return new THREE.Vector3()
    .copy(_tornadoWorldPos)
    .addScaledVector(travelDir, -dist * 0.85)
    .setY(_tornadoWorldPos.y + tornadoCamParams.followHeight);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Camera: reassembly (hold position, watch triangles converge)
// ─────────────────────────────────────────────────────────────────────────────

function _camTickReassemble(delta) {
  const charY = _modelGroupRef ? _modelGroupRef.position.y : 0;
  _tornadoWorldPos.set(_destination.x, charY + 1.2, _destination.z);
  _applyCameraLerp(delta, _tornadoWorldPos);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Camera: settle (post-arrival glide back to OrbitControls)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Begin the settle phase — compute a comfortable resting position and
 * start the glide. Controls stay disabled until the glide completes.
 */
function _camBeginSettle() {
  const charY = _modelGroupRef ? _modelGroupRef.position.y : 0;
  _settleTarget.set(_destination.x, charY + 1.2, _destination.z);
  _settleT = 0.0;

  _settleCamStart.copy(camera.position);
  _camPosSmoothed.copy(camera.position);
  _settleLookStart.copy(_camLookAtSmoothed);

  _settleCamEnd.copy(_settleTarget)
    .add(_computeSettleOffset())
    .setY(_settleTarget.y + 2.8);

  _settling = true;
}

function _computeSettleOffset() {
  const offset = new THREE.Vector3().subVectors(camera.position, _settleTarget);
  offset.y = 0;
  const horizontalDist = THREE.MathUtils.clamp(offset.length(), 4.5, 9.0);
  return offset.normalize().multiplyScalar(horizontalDist);
}

/**
 * Per-frame settle tick — exponential-lerp glide from current position
 * to the resting position. Re-enables OrbitControls on completion.
 */
function _camTickSettle(delta) {
  if (!controls) { _settling = false; return; }

  _settleT = Math.min(_settleT + delta / tornadoCamParams.settleDuration, 1.0);

  const pt = 1.0 - Math.exp(-tornadoCamParams.settlePosLerp  * delta);
  const lt = 1.0 - Math.exp(-tornadoCamParams.settleLookLerp * delta);

  _camPosSmoothed.lerp(_settleCamEnd, pt);
  _camLookAtSmoothed.lerp(_settleTarget, lt);

  camera.position.copy(_camPosSmoothed);
  camera.lookAt(_camLookAtSmoothed);

  if (_settleT >= 1.0) {
    _snapCameraToSettleTarget();
  }
}

function _snapCameraToSettleTarget() {
  camera.position.copy(_settleCamEnd);
  camera.lookAt(_settleTarget);
  controls.target.copy(_settleTarget);
  controls.enabled = true;
  controls.update();
  _settling = false;
}

function _applyCameraLerp(delta, lookTarget) {
  const pt = 1.0 - Math.exp(-tornadoCamParams.lerpPos  * delta);
  const lt = 1.0 - Math.exp(-tornadoCamParams.lerpLook * delta);
  _camPosSmoothed.lerp(_camPos, pt);
  _camLookAtSmoothed.lerp(lookTarget, lt);
  camera.position.copy(_camPosSmoothed);
  camera.lookAt(_camLookAtSmoothed);
}

function _cubicEaseOut(t) {
  return 1.0 - Math.pow(1.0 - t, 3);
}

function _buildTornadoMaterial(srcMat) {
  const mat = srcMat.clone();
  mat.transparent = true;
  mat.side        = THREE.DoubleSide;

  const uniforms = _createTornadoUniforms();
  mat.userData.tornadoUniforms = uniforms;

  const _prevOBC = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader) => _injectTornadoShader(shader, uniforms, _prevOBC, mat);
  mat.needsUpdate = true;
  return mat;
}

function _createTornadoUniforms() {
  return {
    uCloudProgress:    { value: 0.0 },
    uTravelProgress:   { value: 0.0 },
    uStaggerSpread:    { value: tornadoParams.staggerSpread },
    uStaggerWindow:    { value: tornadoParams.staggerWindow },
    uFlyMin:           { value: tornadoParams.flyMin },
    uFlyRand:          { value: tornadoParams.flyRand },
    uCollapseAmt:      { value: tornadoParams.collapseAmt },
    uOriginLocal:      { value: new THREE.Vector3() },
    uDestinationLocal: { value: new THREE.Vector3() },
    uTornadoRadius:    { value: tornadoParams.tornadoRadius },
    uTornadoHeight:    { value: tornadoParams.tornadoHeight },
    uRotTurns:         { value: tornadoParams.rotTurns },
    uRotRandTurns:     { value: tornadoParams.rotRandTurns },
    uFadeStart:        { value: tornadoParams.fadeStart },
    uFadeEnd:          { value: tornadoParams.fadeEnd },
    uCartoon:          { value: 0.0 },
  };
}

function _injectTornadoShader(shader, uniforms, prevOBC, mat) {
  // 1. Inject all tornado uniforms
  Object.assign(shader.uniforms, uniforms);

  // 2. Vertex: tornado displacement
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>',       '#include <common>\n'   + VERT_PARS)
    .replace('#include <begin_vertex>', VERT_POSITION);

  // 3. Fragment: fade + cartoon
  const FRAG_PARS_WITH_CARTOON  = FRAG_PARS + '\nuniform float uCartoon;';
  const FRAG_ALPHA_WITH_CARTOON = FRAG_ALPHA + '\n' + CARTOON_EFFECT;

  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n' + FRAG_PARS_WITH_CARTOON)
    .replace('#include <dithering_fragment>',
             '#include <dithering_fragment>\n' + FRAG_ALPHA_WITH_CARTOON);

  // 4. Chain the inherited model.js callback
  if (prevOBC) prevOBC(shader);

  // 5. Re-claim uCartoon ownership from model.js
  shader.uniforms.uCartoon = uniforms.uCartoon;

  mat.userData.shader = shader;
}

export function setTornadoCartoon(t) {
  _tornadoMats.forEach(mat => {
    const u = mat.userData.shader?.uniforms ?? mat.userData.tornadoUniforms;
    if (u?.uCartoon) u.uCartoon.value = t;
  });
}

function _bakeSkinnedPose(skinnedMesh) {
  _ensureSkeletonUpToDate(skinnedMesh);

  const base       = _toNonIndexedGeometry(skinnedMesh.geometry);
  const skinIndex  = base.attributes.skinIndex;
  const skinWeight = base.attributes.skinWeight;
  if (!skinIndex || !skinWeight) return base;

  const boneMatrices = _computeBoneMatrices(skinnedMesh);
  const bakedPos     = _bakeVertexPositions(base.attributes.position, skinIndex, skinWeight, boneMatrices);

  base.setAttribute('position', new THREE.BufferAttribute(bakedPos, 3));
  base.deleteAttribute('skinIndex');
  base.deleteAttribute('skinWeight');
  return base;
}

function _ensureSkeletonUpToDate(skinnedMesh) {
  skinnedMesh.updateWorldMatrix(true, false);
  skinnedMesh.skeleton.update();
}

function _toNonIndexedGeometry(geometry) {
  return geometry.index ? geometry.toNonIndexed() : geometry.clone();
}

function _computeBoneMatrices(skinnedMesh) {
  const meshInv = new THREE.Matrix4().copy(skinnedMesh.matrixWorld).invert();
  return skinnedMesh.skeleton.bones.map((bone, i) => {
    const m = new THREE.Matrix4();
    m.multiplyMatrices(bone.matrixWorld, skinnedMesh.skeleton.boneInverses[i]);
    m.premultiply(meshInv);
    return m;
  });
}

function _bakeVertexPositions(posAttr, skinIndex, skinWeight, boneMatrices) {
  const bakedPos = new Float32Array(posAttr.count * 3);
  const vertex   = new THREE.Vector3();
  const _tmp     = new THREE.Vector3();
  const _accum   = new THREE.Vector3();

  for (let i = 0; i < posAttr.count; i++) {
    vertex.fromBufferAttribute(posAttr, i);
    _accum.set(0, 0, 0);

    for (let j = 0; j < 4; j++) {
      const boneIdx = skinIndex.getComponent(i, j);
      const weight  = skinWeight.getComponent(i, j);
      if (weight === 0) continue;
      _tmp.copy(vertex).applyMatrix4(boneMatrices[boneIdx]).multiplyScalar(weight);
      _accum.add(_tmp);
    }

    bakedPos[i * 3]     = _accum.x;
    bakedPos[i * 3 + 1] = _accum.y;
    bakedPos[i * 3 + 2] = _accum.z;
  }
  return bakedPos;
}

function _buildTornadoGeo(srcMesh) {
  const base = _resolveBaseGeometry(srcMesh);
  base.computeVertexNormals();
  _addPerTriangleAttributes(base);
  return base;
}

function _resolveBaseGeometry(srcMesh) {
  if (srcMesh.isSkinnedMesh) return _bakeSkinnedPose(srcMesh);
  return srcMesh.geometry.index ? srcMesh.geometry.toNonIndexed() : srcMesh.geometry.clone();
}

function _addPerTriangleAttributes(geometry) {
  const pos    = geometry.attributes.position;
  const count  = pos.count;
  const center = new Float32Array(count * 3);
  const rand   = new Float32Array(count);

  for (let i = 0; i < count; i += 3) {
    const mx = (pos.getX(i) + pos.getX(i+1) + pos.getX(i+2)) / 3;
    const my = (pos.getY(i) + pos.getY(i+1) + pos.getY(i+2)) / 3;
    const mz = (pos.getZ(i) + pos.getZ(i+1) + pos.getZ(i+2)) / 3;
    const r  = Math.random();
    for (let v = 0; v < 3; v++) {
      center[(i+v)*3]   = mx;
      center[(i+v)*3+1] = my;
      center[(i+v)*3+2] = mz;
      rand[i+v]         = r;
    }
  }

  geometry.setAttribute('aCenter', new THREE.BufferAttribute(center, 3));
  geometry.setAttribute('aRand',   new THREE.BufferAttribute(rand,   1));
}

// ─────────────────────────────────────────────────────────────────────────────
//  Uniform sync helpers
// ─────────────────────────────────────────────────────────────────────────────

function _syncProgressToMaterials() {
  _tornadoMats.forEach(mat => {
    const u = mat.userData.shader?.uniforms ?? mat.userData.tornadoUniforms;
    if (!u) return;
    u.uCloudProgress.value  = _cloudProgress;
    u.uTravelProgress.value = _travelProgress;
    u.uTornadoRadius.value  = tornadoParams.tornadoRadius;
    u.uTornadoHeight.value  = tornadoParams.tornadoHeight;
  });
}

function _syncLocalPositionsToMaterials() {
  if (!_group || !_tornadoMeshes.length) return;
  _group.updateMatrixWorld(true);

  const worldOrigin = _group.position;

  _tornadoMeshes.forEach((mesh, i) => {
    const mat = _tornadoMats[i];
    if (!mat) return;
    const u = mat.userData.shader?.uniforms ?? mat.userData.tornadoUniforms;
    if (!u) return;

    _invModelMat.copy(mesh.matrixWorld).invert();
    _originLocal.copy(worldOrigin).applyMatrix4(_invModelMat);
    _destLocal.copy(_destination).applyMatrix4(_invModelMat);

    u.uOriginLocal.value.copy(_originLocal);
    u.uDestinationLocal.value.copy(_destLocal);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Public API: state queries
// ─────────────────────────────────────────────────────────────────────────────

export function isTornadoActive()       { return _phase >= 0; }
export function isTornadoCameraActive() { return _camFollowing; }

// ─────────────────────────────────────────────────────────────────────────────
//  Public API: focusSpawnAndTravel (high-level entry point)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Focus the camera on the character, spawn the tornado cloud, and travel
 * to the destination. Calls onArrived() once the character has reassembled
 * and the camera controls have been restored.
 *
 * This is the single entry point that external code (e.g. whiteworld.js)
 * should use — it handles the full focus → disassemble → travel → arrive
 * sequence, including snapping the camera and updating OrbitControls.
 */
export function focusSpawnAndTravel(meshes, modelGroup, destination, onArrived) {
  _focusCameraOnCharacter(modelGroup);
  spawnCloud(meshes, modelGroup);
  travelTo(destination, () => {
    _updateControlsAfterArrival(destination);
    if (onArrived) onArrived();
  });
}

/**
 * Snap the camera to look at the character's current position so the
 * tornado disassembly is visible even if the player has walked away.
 */
function _focusCameraOnCharacter(modelGroup) {
  if (!controls) return;

  const charPos = modelGroup.position;
  const lookAt  = new THREE.Vector3(charPos.x, charPos.y + 1.0, charPos.z);
  controls.target.copy(lookAt);

  const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
  const dist   = THREE.MathUtils.clamp(offset.length(), 4.5, 12.0);
  offset.normalize().multiplyScalar(dist);
  camera.position.copy(lookAt).add(offset);

  controls.update();
}

/** Re-seat OrbitControls target on the destination after arrival. */
function _updateControlsAfterArrival(destination) {
  if (!controls) return;
  const charY = _modelGroupRef ? _modelGroupRef.position.y : 0;
  controls.target.set(destination.x, charY + 1.0, destination.z);
  controls.update();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Public API: spawnCloud
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hide the original character meshes, spawn tornado clones, start cloud phase.
 */
export function spawnCloud(meshes, modelGroup) {
  _abortActiveSettle();
  _disposeCloud();
  _initCloudState(modelGroup);
  _hideOriginalMeshes(meshes);
  _createTornadoGroup(modelGroup);
  _createTornadoClones(meshes);
  _syncProgressToMaterials();
  _syncLocalPositionsToMaterials();
}

function _abortActiveSettle() {
  if (!_settling) return;
  _settling = false;
  _settleT  = 0.0;
  if (controls && !controls.enabled) controls.enabled = true;
}

function _initCloudState(modelGroup) {
  _modelGroupRef  = modelGroup;
  _phase          = 1;
  _cloudProgress  = 0.0;
  _travelProgress = 0.0;
  _tornadoMats    = [];
  _tornadoMeshes  = [];
  _originalMeshes = [];
  _settling       = false;
  _camEntryT      = 0.0;
  _destination.copy(modelGroup.position);
}

function _hideOriginalMeshes(meshes) {
  meshes.forEach(m => {
    _originalMeshes.push({ mesh: m, wasVisible: m.visible });
    m.visible = false;
  });
}

function _createTornadoGroup(modelGroup) {
  _group = new THREE.Group();
  _group.position.copy(modelGroup.position);
  _group.quaternion.copy(modelGroup.quaternion);
  _group.scale.copy(modelGroup.scale);
  scene.add(_group);
}

function _createTornadoClones(meshes) {
  meshes.forEach(mesh => {
    if (!mesh.geometry) return;
    const srcMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const mat    = _buildTornadoMaterial(srcMat);
    const geo    = _buildTornadoGeo(mesh);

    const m = new THREE.Mesh(geo, mat);
    m.castShadow      = true;
    m.frustumCulled    = false;
    m.matrix.copy(mesh.matrix);
    m.matrixAutoUpdate = false;

    _group.add(m);
    _tornadoMats.push(mat);
    _tornadoMeshes.push(m);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Public API: travelTo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Begin tornado travel toward world-space destination.
 * onArrived() fires after pieces converge.
 */
export function travelTo(destination, onArrived) {
  if (_phase < 0 || !_group) return;
  _destination.copy(destination);
  _onArrived      = onArrived || null;
  _phase          = 1;
  _travelProgress = 0;

  _originWorldPos.copy(_group.position);
  _camStartFollow();

  _syncLocalPositionsToMaterials();
  _syncProgressToMaterials();
}

export function disposeCloud() { _disposeCloud(); }

// ─────────────────────────────────────────────────────────────────────────────
//  Per-frame tick
// ─────────────────────────────────────────────────────────────────────────────

export function tickTornado(delta) {
  if (_phase < 0 && !_settling) return;

  if (_phase >= 0) _syncLocalPositionsToMaterials();

  if (_phase === 1) _tickTravel(delta);
  if (_phase === 2) _tickReassembly(delta);
  if (_settling)    _camTickSettle(delta);
}

// ── Phase 1: tornado travel ───────────────────────────────────────────────────

function _tickTravel(delta) {
  _travelProgress = Math.min(_travelProgress + tornadoParams.travelSpeed * delta, 1.0);
  _syncProgressToMaterials();

  if (_camFollowing) _camTickFollow(delta);

  if (_travelProgress >= 1.0) {
    _snapGroupToDestination();
    _beginReassembly();
  }
}

function _snapGroupToDestination() {
  _group.position.copy(_destination);
  _group.position.y = _modelGroupRef ? _modelGroupRef.position.y : 0;
}

// ── Phase 2: smooth reassembly ────────────────────────────────────────────────

/** Enter reassembly — countdown from current progress to 0. */
function _beginReassembly() {
  _phase = 2;
}

function _tickReassembly(delta) {
  _travelProgress = Math.max(_travelProgress - tornadoParams.reassembleSpeed * delta, 0.0);
  _syncProgressToMaterials();

  if (_camFollowing) _camTickReassemble(delta);

  if (_travelProgress <= 0.0) {
    _finishReassembly();
  }
}

function _finishReassembly() {
  _phase        = -1;
  _camFollowing = false;
  _camBeginSettle();

  const cb = _onArrived;
  _onArrived = null;
  setTimeout(() => { if (cb) cb(); _disposeCloud(); }, 80);
}


function _disposeCloud() {
  _camFollowing = false;
  _camEntryT    = 0.0;

  _restoreControlsIfNotSettling();
  _restoreOriginalMeshes();
  _destroyTornadoGroup();
  _resetTornadoState();
}

function _restoreControlsIfNotSettling() {
  if (!_settling && controls && !controls.enabled) {
    controls.enabled = true;
  }
}

function _restoreOriginalMeshes() {
  _originalMeshes.forEach(({ mesh, wasVisible }) => { mesh.visible = wasVisible; });
  _originalMeshes = [];
}

function _destroyTornadoGroup() {
  if (!_group) return;
  _group.traverse(obj => {
    if (!obj.isMesh) return;
    obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
  scene.remove(_group);
  _group = null;
}

function _resetTornadoState() {
  _tornadoMats   = [];
  _tornadoMeshes = [];
  _phase         = -1;
  _onArrived     = null;
  _modelGroupRef = null;
}
