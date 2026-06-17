import * as THREE from 'three';
import { scene, camera, controls } from '../../scene.js';
import {
  tornadoParams,
  buildTornadoMaterial, buildTornadoGeo,
  syncProgressToMaterials, syncLocalPositionsToMaterials,
  applyCartoonToMaterials,
} from './tornado-particle.js';
import {
  tornadoCamParams,
  startFollow, abortSettle, onDisposeCloud,
  tickFollow, tickReassemble, beginSettle, tickSettle,
  isCamFollowing, isCamSettling,
} from './tornado-camera.js';

export { tornadoParams, tornadoCamParams };

// ── Lifecycle state ───────────────────────────────────────────────────────────
let _group          = null;
let _modelGroupRef  = null;
let _tornadoMats    = [];
let _tornadoMeshes  = [];
let _originalMeshes = [];

let _phase          = -1;
let _cloudProgress  = 0;
let _travelProgress = 0;
let _destination    = new THREE.Vector3();
let _onArrived      = null;

// ── Queries ───────────────────────────────────────────────────────────────────
export function isTornadoActive()       { return _phase >= 0; }
export function isTornadoCameraActive() { return isCamFollowing(); }

// ── Public: setTornadoCartoon ─────────────────────────────────────────────────
export function setTornadoCartoon(t) {
  applyCartoonToMaterials(t, _tornadoMats);
}

// ── Public: focusSpawnAndTravel ───────────────────────────────────────────────
export function focusSpawnAndTravel(meshes, modelGroup, destination, onArrived) {
  _focusCameraOnCharacter(modelGroup);
  spawnCloud(meshes, modelGroup);
  travelTo(destination, () => {
    _updateControlsAfterArrival(destination);
    if (onArrived) onArrived();
  });
}

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

function _updateControlsAfterArrival(destination) {
  if (!controls) return;
  const charY = _modelGroupRef ? _modelGroupRef.position.y : 0;
  controls.target.set(destination.x, charY + 1.0, destination.z);
  controls.update();
}

// ── Public: spawnCloud ────────────────────────────────────────────────────────
export function spawnCloud(meshes, modelGroup) {
  abortSettle();
  _disposeCloud();
  _modelGroupRef  = modelGroup;
  _phase          = 1;
  _cloudProgress  = 0.0;
  _travelProgress = 0.0;
  _tornadoMats    = [];
  _tornadoMeshes  = [];
  _originalMeshes = [];
  _destination.copy(modelGroup.position);

  meshes.forEach(m => {
    _originalMeshes.push({ mesh: m, wasVisible: m.visible });
    m.visible = false;
  });

  _group = new THREE.Group();
  _group.position.copy(modelGroup.position);
  _group.quaternion.copy(modelGroup.quaternion);
  _group.scale.copy(modelGroup.scale);
  scene.add(_group);

  meshes.forEach(mesh => {
    if (!mesh.geometry) return;
    const srcMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const mat    = buildTornadoMaterial(srcMat);
    const geo    = buildTornadoGeo(mesh);
    const m      = new THREE.Mesh(geo, mat);
    m.castShadow      = true;
    m.frustumCulled   = false;
    m.matrix.copy(mesh.matrix);
    m.matrixAutoUpdate = false;
    _group.add(m);
    _tornadoMats.push(mat);
    _tornadoMeshes.push(m);
  });

  syncProgressToMaterials(_tornadoMats, _cloudProgress, _travelProgress);
  syncLocalPositionsToMaterials(_group, _tornadoMeshes, _tornadoMats, _destination);
}

// ── Public: travelTo ──────────────────────────────────────────────────────────
export function travelTo(destination, onArrived) {
  if (_phase < 0 || !_group) return;
  _destination.copy(destination);
  _onArrived      = onArrived || null;
  _phase          = 1;
  _travelProgress = 0;
  startFollow(_group);
  syncLocalPositionsToMaterials(_group, _tornadoMeshes, _tornadoMats, _destination);
  syncProgressToMaterials(_tornadoMats, _cloudProgress, _travelProgress);
}

export function disposeCloud() { _disposeCloud(); }

// ── Per-frame tick ────────────────────────────────────────────────────────────
// Tick order is load-bearing: sync-local → phase-advance+sync-progress → camera
export function tickTornado(delta) {
  if (_phase < 0 && !isCamSettling()) return;

  if (_phase >= 0) {
    syncLocalPositionsToMaterials(_group, _tornadoMeshes, _tornadoMats, _destination);
  }

  if (_phase === 1) _tickTravel(delta);
  if (_phase === 2) _tickReassembly(delta);
  if (isCamSettling()) tickSettle(delta);
}

function _tickTravel(delta) {
  _travelProgress = Math.min(_travelProgress + tornadoParams.travelSpeed * delta, 1.0);
  syncProgressToMaterials(_tornadoMats, _cloudProgress, _travelProgress);

  if (isCamFollowing()) tickFollow(delta, _travelProgress, _destination, _modelGroupRef);

  if (_travelProgress >= 1.0) {
    _group.position.copy(_destination);
    _group.position.y = _modelGroupRef ? _modelGroupRef.position.y : 0;
    _phase = 2;
  }
}

function _tickReassembly(delta) {
  _travelProgress = Math.max(_travelProgress - tornadoParams.reassembleSpeed * delta, 0.0);
  syncProgressToMaterials(_tornadoMats, _cloudProgress, _travelProgress);

  if (isCamFollowing()) tickReassemble(delta, _destination, _modelGroupRef);

  if (_travelProgress <= 0.0) {
    _phase = -1;
    beginSettle(_destination, _modelGroupRef);
    const cb = _onArrived;
    _onArrived = null;
    setTimeout(() => { if (cb) cb(); _disposeCloud(); }, 80);
  }
}

// ── Internal disposal ─────────────────────────────────────────────────────────
function _disposeCloud() {
  onDisposeCloud();

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
