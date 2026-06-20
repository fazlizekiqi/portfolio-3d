/**
 * whiteworld.js — Everything visible and ticking in the white world.
 *
 * Owns:
 *   - Cartoon / cel-style ground plane and decorative cubes
 *   - Iris-alpha shader uniforms (synced to transition progress)
 *   - 5 waypoint buttons that teleport the character via a tornado-cloud effect
 *
 * Objects use LAYER.WHITE so they are only visible when the camera
 * has that layer enabled (controlled by transition.js).
 *
 * Public API
 * ──────────
 *   tickWhiteWorld()  – call every frame from main.js
 *   setWhiteWorldCharacterRef(getPos, getMeshes, setPos) – wire up to character
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { scene } from '../scene.js';
import { LAYER, setWorldLayer } from '../layers.js';
import { getProgress, isTransitioning, isWhiteWorld, getElapsed } from '../transition.js';
import { tickTornado, isTornadoActive, disposeCloud, focusSpawnAndTravel } from './tornado-travel.js';
import IRIS_ALPHA_GLSL from '../shaders/whiteworld.iris.glsl?raw';
import VERT            from '../shaders/whiteworld.vert.glsl?raw';
import FRAG_BODY       from '../shaders/whiteworld.frag.glsl?raw';
import WATER_VERT      from '../shaders/water.vert.glsl?raw';
import WATER_FRAG      from '../shaders/water.frag.glsl?raw';

// ─────────────────────────────────────────────────────────────────────────────
//  Iris-alpha shader uniforms
// ─────────────────────────────────────────────────────────────────────────────
const _dpr = () => Math.min(window.devicePixelRatio, 2);
const _uniforms = {
  uProgress: { value: 1.0 },
  uTime:     { value: 0.0 },
  uRes:      { value: new THREE.Vector2(window.innerWidth * _dpr(), window.innerHeight * _dpr()) },
};

function _initResizeListener() {
  window.addEventListener('resize', () => {
    _uniforms.uRes.value.set(window.innerWidth * _dpr(), window.innerHeight * _dpr());
  });
}
_initResizeListener();

// ─────────────────────────────────────────────────────────────────────────────
//  Cartoon shader FRAG (iris-alpha prefix + body)
// ─────────────────────────────────────────────────────────────────────────────
const FRAG = IRIS_ALPHA_GLSL + '\n' + FRAG_BODY;



// ─────────────────────────────────────────────────────────────────────────────
//  Toon water plane
// ─────────────────────────────────────────────────────────────────────────────

/** Plain params object — mutated by dat.gui, applied every tick. */
export const waterParams = {
  baseColor:  '#d4f3ff',   // light cyan edge tint
  mainColor:  '#00c8f8',   // saturated turquoise body
  rippling:   0.08,        // wave offset strength
  foamScale:  1.5,         // foam feature scale
  posY:      -1.6,        // water plane Y position
  speed:      1.0,         // uTime multiplier
};

const _waterUniforms = {
  uBaseColor:  { value: new THREE.Color(waterParams.baseColor) },
  uMainColor:  { value: new THREE.Color(waterParams.mainColor) },
  uTime:       { value: 0.0 },
  uRippling:   { value: waterParams.rippling },
  uFoamScale:  { value: waterParams.foamScale },
  // Shared iris-alpha uniforms — point at the same objects as _uniforms
  uProgress:   _uniforms.uProgress,
  uRes:        _uniforms.uRes,
};

const _waterMat = new THREE.ShaderMaterial({
  uniforms:       _waterUniforms,
  vertexShader:   WATER_VERT,
  fragmentShader: IRIS_ALPHA_GLSL + '\n' + WATER_FRAG,  // same pattern as env materials
  transparent:    true,
  depthWrite:     true,
  depthTest:      true,
  side:           THREE.FrontSide,
});

// Large flat plane — sits just below y=0 so it fills all gaps around the island
const _waterGeo  = new THREE.PlaneGeometry(600, 600, 80, 80);
const _waterMesh = new THREE.Mesh(_waterGeo, _waterMat);
_waterMesh.rotation.x = -Math.PI / 2;
_waterMesh.position.y = -0.35;
setWorldLayer(_waterMesh, LAYER.WHITE);

// ─────────────────────────────────────────────────────────────────────────────
//  Environment GLB (archipelago)
// ─────────────────────────────────────────────────────────────────────────────

/** All ShaderMaterial instances created for env meshes, kept for uniform sync. */
const _envMaterials = [];

// ─────────────────────────────────────────────────────────────────────────────
//  Environment walkability (raycaster against the loaded env meshes)
// ─────────────────────────────────────────────────────────────────────────────

/** Raycaster re-used every check for walkability tests. */
const _walkRaycaster = new THREE.Raycaster();
_walkRaycaster.near = 0;
_walkRaycaster.far  = 100;
// Env meshes live on LAYER.WHITE — enable it so the raycaster can see them.
_walkRaycaster.layers.enable(LAYER.WHITE);

/** All non-line env meshes — populated after GLB load. */
const _walkMeshes = [];

// Minimum dot product between the surface normal and world-up for a face to
// count as "walkable". 0.85 ≈ surfaces tilted less than ~32° from horizontal.
// Raise toward 1.0 to be stricter; lower toward 0.0 to allow steeper slopes.
const WALKABLE_NORMAL_Y = 0.85;

/**
 * Shoots a ray straight down from well above (x, z) and returns the Y of the
 * first *walkable* surface hit (face normal pointing mostly upward).
 * Returns null if the point is off the env or only walls/bevels are hit.
 */
export function getGroundY(x, z) {
  if (_walkMeshes.length === 0) return null;
  _walkRaycaster.set(new THREE.Vector3(x, 50, z), new THREE.Vector3(0, -1, 0));
  const hits = _walkRaycaster.intersectObjects(_walkMeshes, false);
  for (const hit of hits) {
    // face.normal is in local space — convert to world space
    if (!hit.face) continue;
    const worldNormal = hit.face.normal.clone()
      .transformDirection(hit.object.matrixWorld);
    if (worldNormal.y >= WALKABLE_NORMAL_Y) return hit.point.y;
  }
  return null;
}

function _makeEnvFillMaterial(baseColor) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ..._uniforms,
      uColor: { value: baseColor.clone() },
    },
    vertexShader:   VERT,
    fragmentShader: FRAG,
    transparent: true, depthWrite: true, depthTest: true, side: THREE.FrontSide,
  });
  _envMaterials.push(mat);
  return mat;
}

function _makeEnvLineMaterial(color) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ..._uniforms,
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader:   VERT,
    fragmentShader: FRAG,
    transparent: true, depthWrite: false, depthTest: true,
  });
  _envMaterials.push(mat);
  return mat;
}

/**
 * Decode the display colour for a GLB mesh.
 * Checks `color` first (diffuse/albedo), then `emissive` (Blender emission
 * materials export their hue here), then falls back to white.
 */
function _colorFromMesh(mesh) {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const m of mats) {
    if (!m) continue;
    // Non-black albedo wins first
    if (m.color && m.color.r + m.color.g + m.color.b > 0.01) return m.color.clone();
    // Blender "Emission" shader → emissive in MeshStandardMaterial
    if (m.emissive && m.emissive.r + m.emissive.g + m.emissive.b > 0.01) return m.emissive.clone();
  }
  return new THREE.Color(0xffffff);
}

function _loadEnvironment(onProgress, onComplete) {
  new GLTFLoader().load(
    `${import.meta.env.BASE_URL}models/env-2-redone-bigger.glb`,
    (gltf) => {
      const root = gltf.scene;

      // Measure the raw geometry before any repositioning.
      const box    = new THREE.Box3().setFromObject(root);
      const center = box.getCenter(new THREE.Vector3());

      // Centre horizontally and sit the TOP surface of the model at y = 0.
      // This way the walkable surface is always at a known world-space Y,
      // regardless of how the GLB was exported or scaled in Blender.
      root.position.x -= center.x;
      root.position.z -= center.z;
      root.position.y  = -box.max.y;   // top surface → y = 0

      // Apply the position so child world-matrices are correct before
      // we traverse and push meshes into _walkMeshes.
      root.updateMatrixWorld(true);

      // Replace every mesh material with the iris-alpha cartoon shader.
      root.traverse((child) => {
        if (!child.isMesh) return;

        const baseColor = _colorFromMesh(child);
        child.material  = _makeEnvFillMaterial(baseColor);

        const edges    = new THREE.EdgesGeometry(child.geometry, 15);
        const outColor = baseColor.getHSL({}).l < 0.5 ? 0x000000 : 0x111111;
        const lines    = new THREE.LineSegments(edges, _makeEnvLineMaterial(outColor));
        child.add(lines);

        // Register mesh for walkability raycasts.
        _walkMeshes.push(child);
      });

      setWorldLayer(root, LAYER.WHITE, true);
      scene.add(root);
      root.updateMatrixWorld(true);
      if (onComplete) onComplete();
    },
    (xhr) => {
      if (onProgress && xhr.total) onProgress(xhr.loaded / xhr.total);
    },
    (err) => console.error('[whiteworld] Failed to load env glb:', err),
  );
}
export function loadEnvironment(onProgress, onComplete) {
  _loadEnvironment(onProgress, onComplete);
}
scene.add(_waterMesh);   // toon water plane — always present in the white world

// ─────────────────────────────────────────────────────────────────────────────
//  Character reference (set from main.js after model load)
// ─────────────────────────────────────────────────────────────────────────────
let _getCharPos    = null;   // () => THREE.Vector3 (copy)
let _getCharMeshes = null;   // () => THREE.Mesh[]
let _setCharPos    = null;   // (THREE.Vector3) => void
let _getModelGroup = null;   // () => THREE.Object3D

export function setWhiteWorldCharacterRef(getPos, getMeshes, setPos, getModelGroup) {
  _getCharPos    = getPos;
  _getCharMeshes = getMeshes;
  _setCharPos    = setPos;
  _getModelGroup = getModelGroup;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Waypoint data
// ─────────────────────────────────────────────────────────────────────────────
const WAYPOINTS = [
  new THREE.Vector3( -15.0, 0, -68.0),  // α Zone1_Swedish
  new THREE.Vector3(  55.0, 0,  30.0),  // β Zone2_Kosovo
  new THREE.Vector3(  65.0, 0,  30.0),  // γ Zone3_Suburb
  new THREE.Vector3(  13.0, 0,  70.0),  // δ Zone4_Gym
  new THREE.Vector3( -55.0, 0,  33.0),  // ε Zone5_SEB
];

const WAYPOINT_LABELS = ['α', 'β', 'γ', 'δ', 'ε'];

// ─────────────────────────────────────────────────────────────────────────────
//  Waypoint button UI
// ─────────────────────────────────────────────────────────────────────────────
const _btnContainer = _createButtonContainer();
const _waypointBtns = _createWaypointButtons();

function _createButtonContainer() {
  const el = document.createElement('div');
  el.id = 'ww-waypoints';
  el.style.cssText = `
    position:fixed;right:28px;top:50%;transform:translateY(-50%);
    z-index:25;display:none;flex-direction:column;gap:10px;
    font-family:'Share Tech Mono','Courier New',monospace;`;
  document.body.appendChild(el);
  return el;
}

function _createWaypointButtons() {
  return WAYPOINTS.map((wp, i) => {
    const btn = _createSingleWaypointButton(i);
    _btnContainer.appendChild(btn);
    return btn;
  });
}

function _createSingleWaypointButton(index) {
  const btn = document.createElement('button');
  btn.textContent = WAYPOINT_LABELS[index];
  btn.title       = `Travel to waypoint ${WAYPOINT_LABELS[index]}`;
  btn.style.cssText = `
    width:42px;height:42px;border-radius:50%;cursor:pointer;
    background:rgba(255,255,255,0.82);
    border:2px solid rgba(80,60,120,0.35);
    color:#7755aa;font-size:15px;font-weight:bold;
    letter-spacing:0;
    backdrop-filter:blur(8px);
    box-shadow:0 2px 12px rgba(100,80,160,0.12);
    transition:background 0.18s,border-color 0.18s,color 0.18s,transform 0.12s;`;

  btn.addEventListener('mouseenter', () => _applyButtonHoverStyle(btn));
  btn.addEventListener('mouseleave', () => _applyButtonIdleStyle(btn));
  btn.addEventListener('click',      () => _onWaypointClick(index));
  return btn;
}

function _applyButtonHoverStyle(btn) {
  btn.style.background  = 'rgba(180,140,255,0.22)';
  btn.style.borderColor = 'rgba(150,100,220,0.7)';
  btn.style.color       = '#5533aa';
  btn.style.transform   = 'scale(1.12)';
}

function _applyButtonIdleStyle(btn) {
  btn.style.background  = 'rgba(255,255,255,0.82)';
  btn.style.borderColor = 'rgba(80,60,120,0.35)';
  btn.style.color       = '#7755aa';
  btn.style.transform   = 'scale(1)';
}

function _setButtonsEnabled(enabled) {
  _waypointBtns.forEach(b => {
    b.disabled      = !enabled;
    b.style.opacity = enabled ? '1' : '0.38';
    b.style.cursor  = enabled ? 'pointer' : 'not-allowed';
  });
}

export function showWaypointButtons() {
  _btnContainer.style.display = 'flex';
  _setButtonsEnabled(true);
}

export function hideWaypointButtons() {
  _btnContainer.style.display = 'none';
  disposeCloud();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Waypoint click → tornado travel
// ─────────────────────────────────────────────────────────────────────────────
function _onWaypointClick(index) {
  if (!_hasCharacterRef()) return;
  if (isTornadoActive())  return;

  const meshes      = _getCharMeshes();
  const modelGroup  = _getModelGroup ? _getModelGroup() : null;
  const destination = WAYPOINTS[index].clone();
  if (!modelGroup) return;

  // Resolve the destination Y to the actual surface so the tornado travels
  // at the correct height and the camera doesn't dive toward y=0.
  const groundY = getGroundY(destination.x, destination.z);
  if (groundY !== null) destination.y = groundY;

  _setButtonsEnabled(false);

  focusSpawnAndTravel(meshes, modelGroup, destination, () => {
    _setCharPos(destination.clone());
    _setButtonsEnabled(true);
  });
}

function _hasCharacterRef() {
  return !!(_getCharPos && _getCharMeshes && _setCharPos);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Iris-alpha uniform sync
// ─────────────────────────────────────────────────────────────────────────────
function _syncIrisUniforms() {
  if (isTransitioning()) {
    _uniforms.uProgress.value = getProgress();
    _uniforms.uTime.value     = getElapsed();
  } else if (isWhiteWorld()) {
    _uniforms.uProgress.value = 0.0;
    _uniforms.uTime.value     = 0.0;
  } else {
    _uniforms.uProgress.value = 1.0;
    _uniforms.uTime.value     = 0.0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Per-frame tick
// ─────────────────────────────────────────────────────────────────────────────
export function tickWhiteWorld(delta = 0) {
  _syncIrisUniforms();

  // Sync water params → uniforms + mesh
  _waterUniforms.uTime.value    += delta * waterParams.speed;
  _waterUniforms.uRippling.value = waterParams.rippling;
  _waterUniforms.uFoamScale.value= waterParams.foamScale;
  _waterUniforms.uBaseColor.value.set(waterParams.baseColor);
  _waterUniforms.uMainColor.value.set(waterParams.mainColor);
  _waterMesh.position.y          = waterParams.posY;

  if (isWhiteWorld() || isTransitioning()) {
    tickTornado(delta);
  }
}
