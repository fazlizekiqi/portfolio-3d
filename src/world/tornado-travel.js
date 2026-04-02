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

// ─────────────────────────────────────────────────────────────────────────────
//  Tunable
// ─────────────────────────────────────────────────────────────────────────────
export const tornadoParams = {
  // These are still passed to the shader (cloud phase at progress=0 = assembled)
  flyMin:         0.22,
  flyRand:        0.38,
  collapseAmt:    0.25,
  staggerSpread:  0.7,
  staggerWindow:  0.5,

  // Tornado travel — wide, elegant spiral
  tornadoRadius:  2.2,
  tornadoHeight:  2.0,
  rotTurns:       2.5,
  rotRandTurns:   3.0,

  // Fade during arrival
  fadeStart:      0.88,
  fadeEnd:        1.0,

  // Timing
  travelSpeed:    0.10,   // tornado travels over ~10 s
  reassembleSpeed: 0.18,  // pieces converge at destination
};

// ─────────────────────────────────────────────────────────────────────────────
//  Internal state
// ─────────────────────────────────────────────────────────────────────────────
let _group         = null;    // THREE.Group — mirrors modelGroup transform
let _tornadoMats   = [];      // cloned materials with tornado shader injected
let _tornadoMeshes = [];      // cloned THREE.Mesh objects (parallel to _tornadoMats)
let _originalMeshes = [];     // hidden originals (restored on arrival)
let _modelGroupRef = null;    // reference to the character's root group

let _phase         = -1;      // -1=off | 0=cloud | 1=travel | 2=reassemble
let _cloudProgress = 0;       // 0→1
let _travelProgress = 0;      // 0→1

let _destination   = new THREE.Vector3();
let _onArrived     = null;

// Reusable for local-space conversion
const _invModelMat = new THREE.Matrix4();
const _originLocal = new THREE.Vector3();
const _destLocal   = new THREE.Vector3();

// ── Camera follow ─────────────────────────────────────────────────────────────
const _tornadoWorldPos    = new THREE.Vector3();
const _camPos             = new THREE.Vector3();
const _camPosSmoothed     = new THREE.Vector3();
const _camLookAtSmoothed  = new THREE.Vector3();
let   _camFollowing       = false;
let   _originWorldPos     = new THREE.Vector3();

// Settle after reassembly
let   _settling           = false;
const _settleTarget       = new THREE.Vector3();

// Camera tuning
const CAM_FOLLOW_HEIGHT   = 4.0;   // height above tornado centroid during travel
const CAM_FOLLOW_DIST     = 7.0;   // distance behind tornado during travel
const CAM_LERP_POS        = 0.6;   // camera position smoothing (lower = lazier)
const CAM_LERP_LOOK       = 0.4;   // look-at smoothing

// Entry arc tuning
const CAM_ENTRY_DURATION  = 1.1;   // seconds for the entry crane shot
const CAM_ENTRY_HEIGHT    = 5.0;   // extra height added at start of entry arc
let   _camEntryT          = 0.0;   // 0→1 as entry progresses

// ─────────────────────────────────────────────────────────────────────────────
//  Camera methods — each owns one distinct moment of the journey
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Called once when travelTo() fires.
 * Seeds all smoothed state from the current OrbitControls camera so there
 * is zero first-frame jump, then disables controls so they can't fight us.
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
 * Entry crane shot — runs for CAM_ENTRY_DURATION seconds at the start of
 * travel. The camera pulls back to an overhead position while looking down
 * at the origin (the character dissolving), then arcs into the follow
 * position as entryEase → 1.
 *
 * @returns {boolean} true once the entry arc is complete
 */
function _camTickEntry(delta, followPos) {
  _camEntryT = Math.min(_camEntryT + delta / CAM_ENTRY_DURATION, 1.0);
  const ease = 1.0 - Math.pow(1.0 - _camEntryT, 3);   // cubic ease-out

  // Position: start where camera was, rise above followPos, descend into it
  const entryPos = new THREE.Vector3()
    .copy(_camPosSmoothed)
    .lerp(
      new THREE.Vector3().copy(followPos).setY(followPos.y + CAM_ENTRY_HEIGHT * (1.0 - ease)),
      ease
    );

  // Look-at: origin → tornado centroid
  const entryLookAt = new THREE.Vector3()
    .copy(_originWorldPos).setY(_originWorldPos.y + 1.2)
    .lerp(_tornadoWorldPos, ease);

  _camPos.copy(entryPos);
  _applyCameraLerp(delta, entryLookAt);
  return _camEntryT >= 1.0;
}

/**
 * Normal follow — camera sits behind and above the tornado centroid,
 * lazily chasing it with exponential lerp.
 */
function _camTickFollow(delta) {
  _tornadoWorldPos.lerpVectors(_originWorldPos, _destination, _travelProgress);
  _tornadoWorldPos.y += 1.2;

  const travelDir = new THREE.Vector3()
    .subVectors(_destination, _originWorldPos)
    .setY(0).normalize();

  const dist      = THREE.MathUtils.clamp(
    _camPosSmoothed.distanceTo(_tornadoWorldPos),
    CAM_FOLLOW_DIST, CAM_FOLLOW_DIST * 1.5
  );
  const followPos = new THREE.Vector3()
    .copy(_tornadoWorldPos)
    .addScaledVector(travelDir, -dist * 0.85)
    .setY(_tornadoWorldPos.y + CAM_FOLLOW_HEIGHT);

  const entryDone = _camEntryT >= 1.0;
  if (!entryDone) {
    // Still in entry arc — run it, hand off once complete
    _camTickEntry(delta, followPos);
    return;
  }

  _camPos.copy(followPos);
  _applyCameraLerp(delta, _tornadoWorldPos);
}

/**
 * Reassembly — tornado has arrived; camera holds its position and watches
 * the pieces converge at the destination.
 */
function _camTickReassemble(delta) {
  _tornadoWorldPos.set(_destination.x, _destination.y + 1.2, _destination.z);
  // _camPos intentionally unchanged — hold the last follow position
  _applyCameraLerp(delta, _tornadoWorldPos);
}

// Settle tuning
const CAM_SETTLE_DURATION  = 2.8;  // total seconds for the camera glide
const CAM_SETTLE_POS_LERP  = 1.8;  // exponential speed for position  (lower = slower)
const CAM_SETTLE_LOOK_LERP = 2.2;  // exponential speed for look-at   (lower = slower)

// Settle runtime state
let _settleT             = 0.0;
const _settleCamStart    = new THREE.Vector3();  // where camera was when settle began
const _settleCamEnd      = new THREE.Vector3();  // where camera should rest
const _settleLookStart   = new THREE.Vector3();  // look-at when settle began
// _settleTarget is the final look-at (character position) — already declared above

/**
 * Settle — keeps OrbitControls DISABLED and manually glides the camera from
 * its current follow position to a comfortable resting spot over
 * CAM_SETTLE_DURATION seconds using exponential lerp for a natural ease-out.
 * Only re-enables OrbitControls once the camera has fully arrived, seeding it
 * with the exact final state so there is zero positional jump.
 */
function _camTickSettle(delta) {
  if (!controls) { _settling = false; return; }

  _settleT = Math.min(_settleT + delta / CAM_SETTLE_DURATION, 1.0);

  // Exponential lerp — fast at first, very slow tail-end
  const pt = 1.0 - Math.exp(-CAM_SETTLE_POS_LERP  * delta);
  const lt = 1.0 - Math.exp(-CAM_SETTLE_LOOK_LERP * delta);

  _camPosSmoothed.lerp(_settleCamEnd, pt);
  _camLookAtSmoothed.lerp(_settleTarget, lt);

  camera.position.copy(_camPosSmoothed);
  camera.lookAt(_camLookAtSmoothed);

  if (_settleT >= 1.0) {
    // Snap to exact final state, then hand to OrbitControls with zero velocity
    camera.position.copy(_settleCamEnd);
    camera.lookAt(_settleTarget);
    controls.target.copy(_settleTarget);
    controls.enabled = true;
    controls.update();
    _settling = false;
  }
}

/**
 * Begins the settle phase.
 * Computes a comfortable resting camera position (same distance/angle as the
 * last follow frame, just lowered to a normal height) and starts the glide.
 * OrbitControls stays disabled until the glide completes.
 */
function _camBeginSettle() {
  _settleTarget.set(_destination.x, _destination.y + 1.2, _destination.z);
  _settleT = 0.0;

  // Start from exactly where the camera is right now — no jump
  _settleCamStart.copy(camera.position);
  _camPosSmoothed.copy(camera.position);
  _settleLookStart.copy(_camLookAtSmoothed);

  // Compute a natural resting position: same XZ offset from character as the
  // current camera, but normalised to a comfortable distance and height.
  const offset = new THREE.Vector3().subVectors(camera.position, _settleTarget);
  offset.y = 0;
  const horizontalDist = THREE.MathUtils.clamp(offset.length(), 4.5, 9.0);
  offset.normalize().multiplyScalar(horizontalDist);

  _settleCamEnd.copy(_settleTarget)
    .add(offset)
    .setY(_settleTarget.y + 2.8);

  _settling = true;
  // Controls remain disabled — _camTickSettle drives the camera manually
}

/**
 * Shared lerp step used by follow, entry and reassemble.
 */
function _applyCameraLerp(delta, lookTarget) {
  const pt = 1.0 - Math.exp(-CAM_LERP_POS  * delta);
  const lt = 1.0 - Math.exp(-CAM_LERP_LOOK * delta);
  _camPosSmoothed.lerp(_camPos, pt);
  _camLookAtSmoothed.lerp(lookTarget, lt);
  camera.position.copy(_camPosSmoothed);
  camera.lookAt(_camLookAtSmoothed);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Material builder — identical pattern to buildExplodeMaterial
// ─────────────────────────────────────────────────────────────────────────────
function _buildTornadoMaterial(srcMat) {
  const mat = srcMat.clone();
  mat.transparent = true;
  mat.side        = THREE.DoubleSide;

  const uniforms = {
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
  mat.userData.tornadoUniforms = uniforms;

  // Capture the inherited onBeforeCompile from model.js (declares uCartoon,
  // injects CARTOON_EFFECT) so we can chain it.
  const _prevOBC = mat.onBeforeCompile;

  mat.onBeforeCompile = (shader) => {
    // 1. Inject all tornado uniforms (including our own uCartoon)
    Object.assign(shader.uniforms, uniforms);

    // 2. Inject tornado vertex displacement
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>',       '#include <common>\n'   + VERT_PARS)
      .replace('#include <begin_vertex>', VERT_POSITION);

    // 3. Inject frag pars (declares uFadeStart/uFadeEnd/vTornadoFade) +
    //    uCartoon declaration + alpha fade + cartoon effect.
    //    We do this ourselves so we don't depend on model.js finding the
    //    #include <common> anchor (which we've already replaced above).
    const FRAG_PARS_WITH_CARTOON = FRAG_PARS + '\nuniform float uCartoon;';
    const FRAG_ALPHA_WITH_CARTOON = FRAG_ALPHA + '\n' + CARTOON_EFFECT;

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_PARS_WITH_CARTOON)
      .replace('#include <dithering_fragment>',
               '#include <dithering_fragment>\n' + FRAG_ALPHA_WITH_CARTOON);

    // 4. Run the inherited model.js callback only for any OTHER uniforms or
    //    vertex work it may do — but its fragment shader replacements will
    //    be no-ops since the anchors are already consumed (that's fine).
    if (_prevOBC) _prevOBC(shader);

    // 5. After model.js OBC runs, it overwrites shader.uniforms.uCartoon with
    //    its own cartoonUniform reference — redirect it back to ours so that
    //    setTornadoCartoon() can drive it via tornadoUniforms.
    shader.uniforms.uCartoon = uniforms.uCartoon;

    mat.userData.shader = shader;
  };

  mat.needsUpdate = true;
  return mat;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Drive cartoon effect on active tornado meshes
//  Called by model.js setCharacterWhiteWorld() so the tornado respects the
//  white-world transition just like the skinned and explode meshes.
// ─────────────────────────────────────────────────────────────────────────────
export function setTornadoCartoon(t) {
  _tornadoMats.forEach(mat => {
    const u = mat.userData.shader?.uniforms ?? mat.userData.tornadoUniforms;
    if (u?.uCartoon) u.uCartoon.value = t;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Pose baker — converts a SkinnedMesh's current animated pose into a flat
//  BufferGeometry so tornado clones show the right pose instead of T-pose.
// ─────────────────────────────────────────────────────────────────────────────
function _bakeSkinnedPose(skinnedMesh) {
  // Ensure world matrices and bone matrices are up to date
  skinnedMesh.updateWorldMatrix(true, false);
  skinnedMesh.skeleton.update();

  const srcGeo = skinnedMesh.geometry;
  const base   = srcGeo.index ? srcGeo.toNonIndexed() : srcGeo.clone();

  const posAttr    = base.attributes.position;
  const skinIndex  = base.attributes.skinIndex;
  const skinWeight = base.attributes.skinWeight;

  if (!skinIndex || !skinWeight) return base;  // not actually skinned

  const vertex   = new THREE.Vector3();
  const bakedPos = new Float32Array(posAttr.count * 3);

  // Precompute bone matrices: boneMatrix = bone.matrixWorld * boneInverse
  // (same as what the GPU shader does)
  const boneMatrices = skinnedMesh.skeleton.bones.map((bone, i) => {
    const m = new THREE.Matrix4();
    m.multiplyMatrices(bone.matrixWorld, skinnedMesh.skeleton.boneInverses[i]);
    // Transform into mesh's local space
    const meshInv = new THREE.Matrix4().copy(skinnedMesh.matrixWorld).invert();
    m.premultiply(meshInv);
    return m;
  });

  const _tmp  = new THREE.Vector3();
  const _accum = new THREE.Vector3();

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

  base.setAttribute('position', new THREE.BufferAttribute(bakedPos, 3));
  base.deleteAttribute('skinIndex');
  base.deleteAttribute('skinWeight');
  return base;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Geometry builder — identical to buildExplodeGeometry in explode.js
// ─────────────────────────────────────────────────────────────────────────────
function _buildTornadoGeo(srcMesh) {
  // If this is a SkinnedMesh, bake the current animated pose first
  const base = srcMesh.isSkinnedMesh
    ? _bakeSkinnedPose(srcMesh)
    : (srcMesh.geometry.index ? srcMesh.geometry.toNonIndexed() : srcMesh.geometry.clone());

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
      center[(i+v)*3]   = mx;
      center[(i+v)*3+1] = my;
      center[(i+v)*3+2] = mz;
      rand[i+v]         = r;
    }
  }

  base.setAttribute('aCenter', new THREE.BufferAttribute(center, 3));
  base.setAttribute('aRand',   new THREE.BufferAttribute(rand,   1));
  return base;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Uniform sync helpers
// ─────────────────────────────────────────────────────────────────────────────
function _syncProgress() {
  _tornadoMats.forEach(mat => {
    const u = mat.userData.shader?.uniforms ?? mat.userData.tornadoUniforms;
    if (!u) return;
    u.uCloudProgress.value  = _cloudProgress;
    u.uTravelProgress.value = _travelProgress;
  });
}

function _syncLocalPositions() {
  if (!_group || !_tornadoMeshes.length) return;
  _group.updateMatrixWorld(true);

  const worldOrigin = _group.position; // world-space origin = group's world position

  _tornadoMeshes.forEach((mesh, i) => {
    const mat = _tornadoMats[i];
    if (!mat) return;
    const u = mat.userData.shader?.uniforms ?? mat.userData.tornadoUniforms;
    if (!u) return;

    // Each tornado mesh has matrixWorld = _group.matrixWorld * mesh.localMatrix
    // To convert world positions to this mesh's local space:
    _invModelMat.copy(mesh.matrixWorld).invert();
    _originLocal.copy(worldOrigin).applyMatrix4(_invModelMat);
    _destLocal.copy(_destination).applyMatrix4(_invModelMat);

    u.uOriginLocal.value.copy(_originLocal);
    u.uDestinationLocal.value.copy(_destLocal);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────────────────────────────────────
export function isTornadoActive()       { return _phase >= 0; }
export function isTornadoCameraActive() { return _camFollowing; }  // only during active travel

/**
 * Hide the original character meshes, spawn tornado clones, start cloud phase.
 * meshes: visible THREE.Mesh[] from the character
 * modelGroup: the character's root THREE.Group
 */
export function spawnCloud(meshes, modelGroup) {
  // If a settle glide is still running, abort it and re-enable controls now
  // so _disposeCloud finds them in a clean state.
  if (_settling) {
    _settling = false;
    _settleT  = 0.0;
    if (controls && !controls.enabled) controls.enabled = true;
  }
  _disposeCloud();

  _modelGroupRef = modelGroup;
  _phase          = 1;   // go straight to travel, no cloud scatter phase
  _cloudProgress  = 0.0; // pieces start assembled
  _travelProgress = 0.0;
  _tornadoMats    = [];
  _tornadoMeshes  = [];
  _originalMeshes = [];
  _settling       = false;
  _camEntryT      = 0.0;
  _destination.copy(modelGroup.position);

  // Hide originals — tornado clones take over visually
  meshes.forEach(m => {
    _originalMeshes.push({ mesh: m, wasVisible: m.visible });
    m.visible = false;
  });

  // Build tornado group with same transform as modelGroup
  _group = new THREE.Group();
  _group.position.copy(modelGroup.position);
  _group.quaternion.copy(modelGroup.quaternion);
  _group.scale.copy(modelGroup.scale);
  scene.add(_group);

  meshes.forEach(mesh => {
    if (!mesh.geometry) return;
    const srcMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const mat    = _buildTornadoMaterial(srcMat);
    const geo    = _buildTornadoGeo(mesh);

    const m = new THREE.Mesh(geo, mat);
    m.castShadow       = true;
    m.frustumCulled    = false;
    m.matrix.copy(mesh.matrix);
    m.matrixAutoUpdate = false;

    _group.add(m);
    _tornadoMats.push(mat);
    _tornadoMeshes.push(m);
  });

  _syncProgress();
  _syncLocalPositions();
}

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

  _syncLocalPositions();
  _syncProgress();
}

export function disposeCloud() { _disposeCloud(); }

// ─────────────────────────────────────────────────────────────────────────────
//  Per-frame tick
// ─────────────────────────────────────────────────────────────────────────────
export function tickTornado(delta) {
  if (_phase < 0 && !_settling) return;

  if (_phase >= 0) _syncLocalPositions();


  // ── Phase 1: tornado travel ─────────────────────────────────────────────
  if (_phase === 1) {
    _travelProgress = Math.min(_travelProgress + tornadoParams.travelSpeed * delta, 1.0);
    _syncProgress();

    if (_camFollowing) _camTickFollow(delta);

    if (_travelProgress >= 1.0) {
      _group.position.copy(_destination);
      _group.position.y = _modelGroupRef ? _modelGroupRef.position.y : 0;
      _phase = 2;
    }
  }

  // ── Phase 2: reassembly ─────────────────────────────────────────────────
  if (_phase === 2) {
    _travelProgress = Math.max(_travelProgress - tornadoParams.reassembleSpeed * delta, 0.0);
    _syncProgress();

    if (_camFollowing) _camTickReassemble(delta);

    if (_travelProgress <= 0.0) {
      _phase        = -1;
      _camFollowing = false;
      _camBeginSettle();

      const cb = _onArrived;
      _onArrived = null;
      setTimeout(() => { if (cb) cb(); _disposeCloud(); }, 80);
    }
  }

  // ── Settle ───────────────────────────────────────────────────────────────
  if (_settling) _camTickSettle(delta);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Internal helpers
// ─────────────────────────────────────────────────────────────────────────────
function _disposeCloud() {
  // Stop active travel/follow — but leave _settling alone if it is already
  // running: _camTickSettle owns controls and will re-enable them when done.
  _camFollowing = false;
  _camEntryT    = 0.0;

  // Only force-enable controls here if we are NOT mid-settle.
  // If a settle is in progress it will re-enable controls itself on completion.
  if (!_settling && controls && !controls.enabled) {
    controls.enabled = true;
  }

  _originalMeshes.forEach(({ mesh, wasVisible }) => { mesh.visible = wasVisible; });
  _originalMeshes = [];

  if (_group) {
    _group.traverse(obj => {
      if (!obj.isMesh) return;
      obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
    scene.remove(_group);
    _group = null;
  }
  _tornadoMats   = [];
  _tornadoMeshes = [];
  _phase         = -1;
  _onArrived     = null;
  _modelGroupRef = null;
}
