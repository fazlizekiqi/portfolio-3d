import * as THREE from 'three';
import { camera, controls } from '../../scene.js';

export const tornadoCamParams = {
  followHeight:   0.5,
  followDist:     10,
  lerpPos:        0.6,
  lerpLook:       0.4,
  entryDuration:  1.1,
  entryHeight:    5.0,
  settleDuration: 2.8,
  settlePosLerp:  5,
  settleLookLerp: 3,
};

// ── Camera state ──────────────────────────────────────────────────────────────
const _tornadoWorldPos   = new THREE.Vector3();
const _camPos            = new THREE.Vector3();
const _camPosSmoothed    = new THREE.Vector3();
const _camLookAtSmoothed = new THREE.Vector3();
const _originWorldPos    = new THREE.Vector3();

let _camFollowing = false;
let _camEntryT    = 0.0;

let _settling          = false;
const _settleTarget    = new THREE.Vector3();
let _settleT           = 0.0;
const _settleCamStart  = new THREE.Vector3();
const _settleCamEnd    = new THREE.Vector3();
const _settleLookStart = new THREE.Vector3();

// ── Queries ───────────────────────────────────────────────────────────────────
export function isCamFollowing() { return _camFollowing; }
export function isCamSettling()  { return _settling; }

// ── Entry ─────────────────────────────────────────────────────────────────────

export function startFollow(group) {
  _camPosSmoothed.copy(camera.position);
  _camPos.copy(camera.position);
  _camLookAtSmoothed.copy(controls ? controls.target : group.position);
  _originWorldPos.copy(group.position);
  _camEntryT    = 0.0;
  _camFollowing = true;
  if (controls) controls.enabled = false;
}

export function abortSettle() {
  if (!_settling) return;
  _settling = false;
  _settleT  = 0.0;
  if (controls && !controls.enabled) controls.enabled = true;
}

export function onDisposeCloud() {
  _camFollowing = false;
  _camEntryT    = 0.0;
  if (!_settling && controls && !controls.enabled) {
    controls.enabled = true;
  }
}

// ── Follow (phase 1) ──────────────────────────────────────────────────────────

export function tickFollow(delta, travelProgress, destination, modelGroupRef) {
  const charY = modelGroupRef ? modelGroupRef.position.y : 0;
  _tornadoWorldPos.lerpVectors(_originWorldPos, destination, travelProgress);
  _tornadoWorldPos.y = charY + 1.2;

  const followPos = _computeFollowPosition(destination);

  if (_camEntryT < 1.0) {
    _tickEntry(delta, followPos);
    return;
  }

  _camPos.copy(followPos);
  _applyCameraLerp(delta, _tornadoWorldPos);
}

function _tickEntry(delta, followPos) {
  _camEntryT = Math.min(_camEntryT + delta / tornadoCamParams.entryDuration, 1.0);
  const ease = _cubicEaseOut(_camEntryT);

  const entryPos = new THREE.Vector3()
    .copy(_camPosSmoothed)
    .lerp(
      new THREE.Vector3().copy(followPos).setY(followPos.y + tornadoCamParams.entryHeight * (1.0 - ease)),
      ease
    );

  const entryLookAt = new THREE.Vector3()
    .copy(_originWorldPos).setY(_originWorldPos.y + 1.2)
    .lerp(_tornadoWorldPos, ease);

  _camPos.copy(entryPos);
  _applyCameraLerp(delta, entryLookAt);
}

function _computeFollowPosition(destination) {
  const travelDir = new THREE.Vector3()
    .subVectors(destination, _originWorldPos)
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

// ── Reassemble (phase 2) ──────────────────────────────────────────────────────

export function tickReassemble(delta, destination, modelGroupRef) {
  const charY = modelGroupRef ? modelGroupRef.position.y : 0;
  _tornadoWorldPos.set(destination.x, charY + 1.2, destination.z);
  _applyCameraLerp(delta, _tornadoWorldPos);
}

// ── Settle ────────────────────────────────────────────────────────────────────

export function beginSettle(destination, modelGroupRef) {
  const charY = modelGroupRef ? modelGroupRef.position.y : 0;
  _settleTarget.set(destination.x, charY + 1.2, destination.z);
  _settleT = 0.0;

  _settleCamStart.copy(camera.position);
  _camPosSmoothed.copy(camera.position);
  _settleLookStart.copy(_camLookAtSmoothed);

  const offset = new THREE.Vector3().subVectors(camera.position, _settleTarget);
  offset.y = 0;
  const horizontalDist = THREE.MathUtils.clamp(offset.length(), 4.5, 9.0);

  _settleCamEnd.copy(_settleTarget)
    .add(offset.normalize().multiplyScalar(horizontalDist))
    .setY(_settleTarget.y + 2.8);

  _settling = true;
}

export function tickSettle(delta) {
  if (!controls) { _settling = false; return; }

  _settleT = Math.min(_settleT + delta / tornadoCamParams.settleDuration, 1.0);

  const pt = 1.0 - Math.exp(-tornadoCamParams.settlePosLerp  * delta);
  const lt = 1.0 - Math.exp(-tornadoCamParams.settleLookLerp * delta);

  _camPosSmoothed.lerp(_settleCamEnd, pt);
  _camLookAtSmoothed.lerp(_settleTarget, lt);

  camera.position.copy(_camPosSmoothed);
  camera.lookAt(_camLookAtSmoothed);

  if (_settleT >= 1.0) {
    camera.position.copy(_settleCamEnd);
    camera.lookAt(_settleTarget);
    controls.target.copy(_settleTarget);
    controls.enabled = true;
    controls.update();
    _settling = false;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
