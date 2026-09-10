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
import { scene, camera } from '../scene.js';
import { LAYER, setWorldLayer } from '../layers.js';
import { getProgress, isTransitioning, isWhiteWorld, getElapsed } from '../transition.js';
import { tickTornado, isTornadoActive, disposeCloud, focusSpawnAndTravel } from './tornado-travel.js';
import { audio } from '../audio.js';
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
//  Environment lighting
//  The env shader is otherwise unlit (flat colour). These uniforms add a cheap
//  ambient term plus up to MAX_LAMPS point lamps so real light can affect the
//  GLB. They are SHARED across every env fill/line material (spread by
//  reference into each material), so editing them here updates the whole world.
//  Defaults (white ambient @ 1.0, no lamps) reproduce the original flat look.
// ─────────────────────────────────────────────────────────────────────────────
const USER_LAMPS = 8;                  // user-placeable playground lamps
const MAX_LAMPS  = USER_LAMPS + 3;     // + 3 fixed fixtures bound to lab objects (shader array size)

const _lightUniforms = {
  uAmbientColor:     { value: new THREE.Color(0xffffff) },
  uAmbientIntensity: { value: 1.0 },
  uToonSteps:        { value: 0.0 },
  uLampPos:          { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector3()) },
  uLampColor:        { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Color(0xffffff)) },
  uLampIntensity:    { value: new Array(MAX_LAMPS).fill(0) },
  uLampRange:        { value: new Array(MAX_LAMPS).fill(12) },
  uSunDir:           { value: new THREE.Vector3(0, 1, 0) },
  uSunColor:         { value: new THREE.Color(0xfff2d0) },
  uSunIntensity:     { value: 0.0 },
};

/** Plain params object — mutated by dat.gui, pushed to uniforms every tick. */
export const envLightParams = {
  ambientColor:     '#ffffff',
  ambientIntensity: 1.0,
  toonSteps:        0,        // 0 = smooth; try 3–4 for a banded cel look
  lamps: [
    { enabled: false, x:  0, y: 5, z:  0, color: '#ffd9a0', intensity: 2.5, range: 14 },
    { enabled: false, x:  8, y: 4, z:  0, color: '#a0c8ff', intensity: 2.5, range: 14 },
    { enabled: false, x:  0, y: 4, z:  8, color: '#ffffff', intensity: 2.5, range: 14 },
    { enabled: false, x: -8, y: 4, z:  0, color: '#ff9ad0', intensity: 2.5, range: 14 },
    { enabled: false, x:  0, y: 4, z: -8, color: '#9affc8', intensity: 2.5, range: 14 },
    { enabled: false, x:  8, y: 4, z:  8, color: '#00e5ff', intensity: 2.5, range: 14 },
    { enabled: false, x: -8, y: 4, z: -8, color: '#ffb000', intensity: 2.5, range: 14 },
    { enabled: false, x: -8, y: 4, z:  8, color: '#ffffff', intensity: 2.5, range: 14 },
  ],
};

// Fixed "work lights" bound to specific lab objects by name. Their X/Z come from
// the object's real world position (resolved on load), so they always sit on the
// right machine; only colour/intensity/range/height are tuneable. The kiosk one
// sits higher with a wide range to read as a soft ambient glow on top of it.
export const labFixtures = [
  { name: 'Assembly_Table', enabled: true, color: '#fff0d0', intensity: 3.0, range:  8, heightOffset: 2.6 },
  { name: 'Printer_3D',     enabled: true, color: '#bfe8ff', intensity: 3.5, range:  7, heightOffset: 3.0 },
  { name: 'Terminal_Kiosk', enabled: true, color: '#cfe0ff', intensity: 2.0, range: 11, heightOffset: 3.8 },
];
const _fixtureBasePos = new Array(labFixtures.length).fill(null); // world pos resolved on load

// Each lamp gets:
//   • a small unlit "bulb" marker so it's visible in the scene, and
//   • a real THREE.PointLight so the CHARACTER (a lit MeshStandardMaterial)
//     also reacts to it. The env's custom shader ignores real lights, so the
//     point light affects only the character — and we gate its intensity to the
//     white world so it never leaks into the blue presentation.
const _lampBulbs  = [];
const _lampLights = [];
function _initLampMarkers() {
  const geo = new THREE.SphereGeometry(0.18, 14, 14);
  for (let i = 0; i < MAX_LAMPS; i++) {
    const mat  = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const bulb = new THREE.Mesh(geo, mat);
    bulb.visible = false;
    setWorldLayer(bulb, LAYER.WHITE, true);
    scene.add(bulb);
    _lampBulbs.push(bulb);

    const light = new THREE.PointLight(0xffffff, 0, 12, 1.0); // (color, intensity, distance, decay)
    scene.add(light);
    _lampLights.push(light);
  }
}
_initLampMarkers();

/** Push envLightParams → shared uniforms + bulb markers. Called every tick. */
// Write one light into shader slot `slot`: env-shader uniform, bulb marker, and
// the real point light that lights the character (white world only).
function _writeLight(slot, on, x, y, z, color, intensity, range, inWhite, showBulb) {
  _lightUniforms.uLampPos.value[slot].set(x, y, z);
  _lightUniforms.uLampColor.value[slot].set(color);
  _lightUniforms.uLampIntensity.value[slot] = on ? intensity : 0.0;
  _lightUniforms.uLampRange.value[slot]     = range;

  const bulb = _lampBulbs[slot];
  bulb.visible = on && showBulb;
  bulb.position.set(x, y, z);
  bulb.material.color.set(color);

  const light = _lampLights[slot];
  light.position.set(x, y, z);
  light.color.set(color);
  light.distance  = range;
  light.intensity = (on && inWhite) ? intensity : 0.0;
}

function _syncEnvLights() {
  _lightUniforms.uAmbientColor.value.set(envLightParams.ambientColor);
  _lightUniforms.uAmbientIntensity.value = envLightParams.ambientIntensity;
  _lightUniforms.uToonSteps.value        = envLightParams.toonSteps;

  // Real point lights only illuminate the character, and only in the white world.
  const inWhite = isWhiteWorld() || isTransitioning();

  // User-placed playground lamps (slots 0..USER_LAMPS-1) — show a bulb marker.
  for (let i = 0; i < USER_LAMPS; i++) {
    const l = envLightParams.lamps[i];
    _writeLight(i, l.enabled, l.x, l.y, l.z, l.color, l.intensity, l.range, inWhite, true);
  }

  // Fixed fixtures bound to lab objects (slots USER_LAMPS..) — no bulb marker.
  for (let i = 0; i < labFixtures.length; i++) {
    const f    = labFixtures[i];
    const base = _fixtureBasePos[i];
    _writeLight(
      USER_LAMPS + i,
      f.enabled && !!base,
      base ? base.x : 0,
      base ? base.y + f.heightOffset : 0,
      base ? base.z : 0,
      f.color, f.intensity, f.range, inWhite, false,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Sun — a single directional light shared by the env shader (uSunDir/Color/
//  Intensity, above) and a real THREE.DirectionalLight so the character reacts
//  to it too. Follows the exact same rule as the lamps/fixtures: only lights
//  the character while in (or transitioning into) the white world, and stays
//  matched to the app's warm daylight palette used elsewhere in the env.
//
//  Intensity can be dampened per-zone: some areas (e.g. the robotics lab,
//  which is roofed) shouldn't receive direct sunlight. We reuse the lab's
//  proximity centre (derived from its animated nodes, see _setupLabAnimations)
//  and fade the sun out smoothly as the character walks inside it.
// ─────────────────────────────────────────────────────────────────────────────
export const sunParams = {
  enabled:       true,
  color:         '#e5d1b0',   // warm daylight — matches the lab fixtures' warm tones
  intensity:     1.45,
  elevationDeg:  57,          // angle above the horizon
  azimuthDeg:    38,          // compass heading
  distance:      40,          // how far the (visual) light source sits from the character
  indoorRadius:  17,          // sun starts fading this far from the lab centre
  indoorFalloff: 8,           // extra blend distance until sun is fully out
};

const _sunDirWorld = new THREE.Vector3(0, 1, 0);
function _updateSunDirection() {
  const elev = THREE.MathUtils.degToRad(sunParams.elevationDeg);
  const azim = THREE.MathUtils.degToRad(sunParams.azimuthDeg);
  _sunDirWorld.set(
    Math.cos(elev) * Math.sin(azim),
    Math.sin(elev),
    Math.cos(elev) * Math.cos(azim),
  ).normalize();
}

const _sunLight  = new THREE.DirectionalLight(0xffffff, 0);
const _sunTarget = new THREE.Object3D();
_sunLight.target = _sunTarget;
scene.add(_sunLight, _sunTarget);

function _smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / Math.max(1e-5, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** 0 = fully indoors (no sun), 1 = fully outdoors (full sun). */
function _sunZoneWeight() {
  if (!_labHasCenter || !_getModelGroup) return 1;
  const mg = _getModelGroup();
  if (!mg) return 1;
  const dx   = mg.position.x - _labCenter.x;
  const dz   = mg.position.z - _labCenter.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  return _smoothstep(sunParams.indoorRadius, sunParams.indoorRadius + sunParams.indoorFalloff, dist);
}

function _syncSun() {
  _updateSunDirection();

  const inWhite       = isWhiteWorld() || isTransitioning();
  const zoneWeight     = _sunZoneWeight();
  const effIntensity   = sunParams.enabled ? sunParams.intensity * zoneWeight : 0;

  // Shared env-shader uniform (lights the GLB world).
  _lightUniforms.uSunDir.value.copy(_sunDirWorld);
  _lightUniforms.uSunColor.value.set(sunParams.color);
  _lightUniforms.uSunIntensity.value = effIntensity;

  // Real light — only illuminates the character, and only in the white world.
  _sunLight.color.set(sunParams.color);
  _sunLight.intensity = inWhite ? effIntensity : 0;

  const mg     = _getModelGroup ? _getModelGroup() : null;
  const anchor = mg ? mg.position : _sunTarget.position;
  _sunLight.position.set(
    anchor.x + _sunDirWorld.x * sunParams.distance,
    anchor.y + _sunDirWorld.y * sunParams.distance,
    anchor.z + _sunDirWorld.z * sunParams.distance,
  );
  _sunTarget.position.copy(anchor);
  _sunTarget.updateMatrixWorld();
}

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

/** The loaded env GLB root — set after load, null before. */
let _envRoot = null;

/** Returns the env scene root Object3D (or null if not yet loaded). */
export function getEnvRoot() { return _envRoot; }

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

// Footprint sample offsets (centre + ring). Used to make ground tests tolerant
// of small holes such as the gaps between the planks of the wooden bridge: a
// single straight-down ray can fall through a gap and report "no ground", which
// would block movement and drop the character. Sampling a small ring keeps the
// character on the bridge as long as any part of its footprint is over wood.
const FOOT_SAMPLE_R = 0.26;
const _FOOT_OFFSETS = [
  [0, 0],
  [ FOOT_SAMPLE_R, 0], [-FOOT_SAMPLE_R, 0],
  [0,  FOOT_SAMPLE_R], [0, -FOOT_SAMPLE_R],
];

/**
 * Footprint-aware ground height. Samples getGroundY at the centre and four
 * points on a small ring, returning the HIGHEST walkable surface found (or
 * null if the whole footprint is over empty space). Taking the highest keeps
 * the character standing on top of bridge planks instead of sinking into the
 * gaps between them (or onto whatever lies far below the bridge).
 */
export function getGroundYFootprint(x, z) {
  let best = null;
  for (const [ox, oz] of _FOOT_OFFSETS) {
    const y = getGroundY(x + ox, z + oz);
    if (y !== null && (best === null || y > best)) best = y;
  }
  return best;
}

// ── Horizontal collision (walls / fences / building sides) ────────────────────
const _horizRaycaster = new THREE.Raycaster();
_horizRaycaster.near  = 0;
_horizRaycaster.layers.enable(LAYER.WHITE);

const _horizOrigin = new THREE.Vector3();
const _horizDir    = new THREE.Vector3();

/**
 * Casts a HORIZONTAL ray from (x, y, z) in direction (dirX, 0, dirZ).
 * Returns the distance to the nearest env mesh hit, or Infinity if clear.
 * Used by player.js to detect walls, fences and building sides.
 */
export function getCollisionDistance(x, y, z, dirX, dirZ, maxDist) {
  if (_walkMeshes.length === 0) return Infinity;
  _horizOrigin.set(x, y, z);
  _horizDir.set(dirX, 0, dirZ).normalize();
  _horizRaycaster.far = maxDist;
  _horizRaycaster.set(_horizOrigin, _horizDir);
  const hits = _horizRaycaster.intersectObjects(_walkMeshes, false);
  return hits.length > 0 ? hits[0].distance : Infinity;
}

// ── Camera spring arm (obstruction between pivot and desired camera pos) ──────
const _camSpringRaycaster = new THREE.Raycaster();
_camSpringRaycaster.near  = 0;
_camSpringRaycaster.layers.enable(LAYER.WHITE);

const _springOrigin = new THREE.Vector3();
const _springDir    = new THREE.Vector3();

/**
 * Casts a ray from `from` toward `to` against all env meshes.
 * Returns the hit distance, or the full from→to distance if the line is clear.
 * Used by the player camera spring arm to avoid clipping through walls.
 */
export function getCameraObstructionDist(from, to) {
  if (_walkMeshes.length === 0) return from.distanceTo(to);

  _springDir.subVectors(to, from);
  const fullDist = _springDir.length();
  if (fullDist < 0.001) return 0;

  _springDir.normalize();
  _springOrigin.copy(from);
  _camSpringRaycaster.far = fullDist;
  _camSpringRaycaster.set(_springOrigin, _springDir);

  const hits = _camSpringRaycaster.intersectObjects(_walkMeshes, false);
  return hits.length > 0 ? hits[0].distance : fullDist;
}

function _makeEnvFillMaterial(baseColor) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ..._uniforms,
      ..._lightUniforms,
      uLit:   { value: 1.0 },             // lit surface
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
      ..._lightUniforms,
      uLit:   { value: 0.0 },             // outlines stay flat (unlit)
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
    `${import.meta.env.BASE_URL}models/new-model-test-3.glb`,
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

      // The bbox top is NOT the walkable surface for models with tall features
      // (peaks, trees) — using it leaves the actual ground far below y = 0 and
      // the character spawns floating, then snaps down. Raycast the real ground
      // under the spawn point and lift the env so that surface sits at y = 0.
      const spawnGroundY = getGroundY(0, 0);
      if (spawnGroundY !== null) {
        root.position.y -= spawnGroundY;
        root.updateMatrixWorld(true);
      }

      _envRoot = root;

      // Wire up the lab robot animations + fixture lights now that the env is
      // in its final pose (world matrices settled).
      _setupLabAnimations(gltf, root);
      _setupLabFixtures(root);

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
// scene.add(_waterMesh);   // toon water plane — always present in the white world

// ─────────────────────────────────────────────────────────────────────────────
//  Lab machine animations (proximity-triggered, looping)
//  The env GLB ships 9 clips that animate the lab robots (industrial arm,
//  hexapod + legs, 3D printer, compactor bot, desk toy). They start looping when
//  the character walks within `radius` of the lab and pause when they leave.
// ─────────────────────────────────────────────────────────────────────────────
let _envMixer       = null;   // AnimationMixer bound to the env GLB
let _envActions     = [];     // one looping action per clip
const _labCenter    = new THREE.Vector3();
let _labHasCenter   = false;
let _labAnimRunning = false;
let _labRing        = null;   // optional debug ring drawn at the lab centre

export const labAnimParams = {
  enabled:    true,   // master switch for the proximity trigger
  radius:     14,     // start the machines when the character is this close (X/Z)
  timeScale:  1.0,    // global playback speed of the machines
  showRadius: false,  // draw a ring on the ground at the trigger boundary

  // Wall-E (Desk_Toy_Bot) — its head tracks the character instead of looping.
  headFollow:       true,
  headTurnSpeed:    6.0,   // how snappy the head turn is
  headYawOffsetDeg: 0,     // tweak if the head ends up facing the wrong way
};

// Toy-head follow working objects (allocated once).
const _toyHeadUp     = new THREE.Vector3(0, 1, 0);
const _dummyLook     = new THREE.Object3D();
const _headWorldPos  = new THREE.Vector3();
const _headTarget    = new THREE.Vector3();
const _headParentQ   = new THREE.Quaternion();
const _headDesiredQ  = new THREE.Quaternion();
const _headOffsetQ   = new THREE.Quaternion();
let _toyHead = null;     // the Toy_Head node, driven manually to face the player

/**
 * Bind the GLB's animation clips to a mixer and derive the lab centre from the
 * world positions of the nodes those clips actually drive — so the trigger
 * follows the real geometry instead of a hard-coded coordinate.
 */
function _setupLabAnimations(gltf, root) {
  if (!gltf.animations || gltf.animations.length === 0) return;

  _envMixer = new THREE.AnimationMixer(root);

  // The Wall-E head is driven manually (it follows the player), so keep its
  // clip out of the looping set to avoid fighting over the head's rotation.
  _toyHead = root.getObjectByName('Toy_Head') || null;
  _envActions = [];
  for (const clip of gltf.animations) {
    if (_toyHead && /Toy_Head/i.test(clip.name)) continue;
    const action = _envMixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    _envActions.push(action);
  }

  // Lab centre = average world position of every node the clips animate.
  const targetNames = new Set();
  for (const clip of gltf.animations) {
    for (const track of clip.tracks) {
      // track.name is "<nodeName>.<property>"; the property is the last segment.
      targetNames.add(track.name.split('.').slice(0, -1).join('.'));
    }
  }
  const sum = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let n = 0;
  for (const name of targetNames) {
    const obj = root.getObjectByName(name);
    if (obj) { obj.getWorldPosition(tmp); sum.add(tmp); n++; }
  }
  if (n > 0) {
    _labCenter.copy(sum.multiplyScalar(1 / n));
    _labHasCenter = true;
  }
}

/** Resolve each fixture's world position from its named lab object. */
function _setupLabFixtures(root) {
  for (let i = 0; i < labFixtures.length; i++) {
    const obj = root.getObjectByName(labFixtures[i].name);
    if (obj) {
      _fixtureBasePos[i] = obj.getWorldPosition(new THREE.Vector3());
    } else {
      console.warn('[whiteworld] lab fixture object not found:', labFixtures[i].name);
    }
  }
}

/** Aim the Wall-E head's yaw at the character (smoothed). */
function _tickToyHeadFollow(delta) {
  if (!_toyHead || !labAnimParams.headFollow) return;
  const mg = _getModelGroup ? _getModelGroup() : null;
  if (!mg) return;

  _toyHead.getWorldPosition(_headWorldPos);

  // Yaw-only: look at the character but keep the head level.
  _headTarget.copy(mg.position);
  _headTarget.y = _headWorldPos.y;

  // World-space look orientation via a parent-less dummy, then convert into the
  // head's local space by cancelling the parent's world rotation.
  _dummyLook.position.copy(_headWorldPos);
  _dummyLook.up.copy(_toyHeadUp);
  _dummyLook.lookAt(_headTarget);

  if (_toyHead.parent) _toyHead.parent.getWorldQuaternion(_headParentQ);
  else _headParentQ.identity();
  _headDesiredQ.copy(_headParentQ).invert().multiply(_dummyLook.quaternion);

  // Correction in case the head's "face" axis isn't -Z.
  const off = labAnimParams.headYawOffsetDeg * Math.PI / 180;
  if (off !== 0) {
    _headOffsetQ.setFromAxisAngle(_toyHeadUp, off);
    _headDesiredQ.multiply(_headOffsetQ);
  }

  const t = 1 - Math.exp(-labAnimParams.headTurnSpeed * delta);
  _toyHead.quaternion.slerp(_headDesiredQ, t);
}

function _ensureLabRing() {
  if (_labRing || !_labHasCenter) return;
  const geo = new THREE.RingGeometry(1.0, 1.06, 72);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x00e5ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
  });
  _labRing = new THREE.Mesh(geo, mat);
  _labRing.rotation.x = -Math.PI / 2;          // lie flat on the ground
  _labRing.position.copy(_labCenter);
  _labRing.position.y += 0.05;
  setWorldLayer(_labRing, LAYER.WHITE, true);
  scene.add(_labRing);
}

function _tickLabAnimations(delta) {
  if (!_envMixer) return;
  _envMixer.timeScale = labAnimParams.timeScale;

  // Should the machines be running this frame?
  let inRange = labAnimParams.enabled;
  if (inRange && _labHasCenter) {
    const mg = _getModelGroup ? _getModelGroup() : null;
    if (mg) {
      const dx = mg.position.x - _labCenter.x;
      const dz = mg.position.z - _labCenter.z;
      inRange = (dx * dx + dz * dz) <= labAnimParams.radius * labAnimParams.radius;
    }
  }

  if (inRange && !_labAnimRunning) {
    _envActions.forEach(a => { a.paused = false; a.play(); });
    _labAnimRunning = true;
  } else if (!inRange && _labAnimRunning) {
    _envActions.forEach(a => { a.paused = true; });  // freeze in place
    _labAnimRunning = false;
  }

  _envMixer.update(delta);

  // Wall-E head tracks the player (after the mixer so it always wins).
  if (inRange) _tickToyHeadFollow(delta);

  // Optional debug ring at the trigger boundary.
  if (labAnimParams.showRadius) {
    _ensureLabRing();
    if (_labRing) {
      _labRing.visible = true;
      _labRing.scale.set(labAnimParams.radius, labAnimParams.radius, 1);
    }
  } else if (_labRing) {
    _labRing.visible = false;
  }
}

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
  new THREE.Vector3( 2.4483, 0.1649, -55.7543),  // Zone1_Swedish
  new THREE.Vector3(  -47.5394, -0.1601,  -14.4251),  // Zone2_Kosovo
  new THREE.Vector3(  21.5683, 0,  77.5616),  // Zone3_Suburb  x: 21.5683  y: 0  z: 77.5616
  new THREE.Vector3(  72.1912, 0.2427,  36.2862),  // Zone4_Gym  x: 72.1912  y: 0.2427  z: 36.2862
  new THREE.Vector3( -35.6675, 0.6285,  49.2623),  // Zone5_SEB  x: -35.6675  y: 0.6285  z: 49.2623
];

// Simple monochrome line icons (currentColor) — kept intentionally plain so
// they read at small sizes and stay in the game's hand-drawn, low-poly voice.
const _ICON = {
  mountain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18.5L9 8l4 6 2-3 6 7.5H3z"/><circle cx="9" cy="8" r="1" fill="currentColor" stroke="none"/></svg>`,
  star:     `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2.5l2.6 6.3 6.8.5-5.2 4.4 1.7 6.6L12 16.8l-5.9 3.5 1.7-6.6-5.2-4.4 6.8-.5L12 2.5z"/></svg>`,
  house:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11.5L12 4l8 7.5"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/></svg>`,
  dumbbell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="9" width="3" height="6" rx="1"/><rect x="19" y="9" width="3" height="6" rx="1"/><line x1="5" y1="12" x2="19" y2="12"/><rect x="6.2" y="7" width="2.6" height="10" rx="1"/><rect x="15.2" y="7" width="2.6" height="10" rx="1"/></svg>`,
  flask:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 3h5"/><path d="M10.2 3v6.3L4.9 18c-.8 1.4.2 3.2 1.8 3.2h10.6c1.6 0 2.6-1.8 1.8-3.2l-5.3-8.7V3"/><path d="M7.6 15.3h8.8"/></svg>`,
  compass:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15.3 8.7l-2.1 4.9-4.9 2.1 2.1-4.9 4.9-2.1z"/></svg>`,
  pin:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6.5-6.02-6.5-11A6.5 6.5 0 0 1 18.5 10c0 4.98-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.2"/></svg>`,
};

/**
 * Single source of truth for the Fast Travel panel: one entry per waypoint,
 * in the same order as WAYPOINTS. Add/remove/reorder destinations here —
 * everything else (DOM, click routing) is generated from this list.
 */
const DESTINATIONS = [
  { name: 'Sweden',  icon: _ICON.mountain },
  { name: 'Kosovo',  icon: _ICON.star     },
  { name: 'Family',  icon: _ICON.house    },
  { name: 'Gym',     icon: _ICON.dumbbell },
  { name: 'Lab',     icon: _ICON.flask    },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Fast Travel panel — a single cohesive card (not five loose buttons).
//  Visual language matches the rest of the white world: warm beige card,
//  charcoal ink outlines, the env's warm-amber accent, subtle offset shadows.
//  All tunable knobs live as CSS custom properties on #ft-panel so the panel
//  can be restyled from one place without touching the structural rules.
// ─────────────────────────────────────────────────────────────────────────────
_injectFastTravelStyles();
const _ftPanel = _createFastTravelPanel();
const _waypointBtns = Array.from(_ftPanel.querySelectorAll('.ft-btn'));
let _ftHideTimer  = null;
let _ftActiveIdx  = null;   // index of the destination the player currently stands at

function _injectFastTravelStyles() {
  if (document.getElementById('ft-style')) return;
  const style = document.createElement('style');
  style.id = 'ft-style';
  style.textContent = `
/* ── Tunables — edit here to restyle the whole panel ─────────────────────── */
#ft-panel {
  --ft-width:        224px;
  --ft-width-collapsed: 68px;
  --ft-right:        26px;
  --ft-btn-height:   50px;
  --ft-gap:          7px;
  --ft-radius:       11px;
  --ft-btn-radius:   8px;
  --ft-border:       2px;
  --ft-icon-size:    19px;
  --ft-font-title:   11px;
  --ft-font-sub:     10px;
  --ft-font-name:    13.5px;
  --ft-anim-speed:   180ms;
  --ft-expand-speed: 220ms;

  --ft-ink:      #241d15;         /* charcoal outline / primary text */
  --ft-bg:       #f9f5ec;         /* warm off-white card */
  --ft-bg-alt:   #f1e9d8;         /* hover fill */
  --ft-bg-btn:   #fdfbf6;         /* button resting fill (slightly lighter than card) */
  --ft-accent:   #e08a2e;         /* the env's warm-amber accent (matches the lamp/fixture glow) */
  --ft-accent-ink: #3a2306;
  --ft-shadow:   rgba(36,29,21,0.30);
}

#ft-panel {
  position:fixed;right:var(--ft-right);top:50%;
  transform:translateY(-50%) translateX(14px);
  z-index:25;display:none;
  width:var(--ft-width);
  padding:12px 12px 13px;
  box-sizing:border-box;
  background:var(--ft-bg);
  border:var(--ft-border) solid var(--ft-ink);
  border-radius:var(--ft-radius);
  box-shadow:4px 5px 0 var(--ft-shadow);
  font-family:'Share Tech Mono','Courier New',monospace;
  opacity:0;
  transition:opacity 260ms ease, transform 260ms ease, width var(--ft-expand-speed) ease;
}
#ft-panel.ft-in { opacity:1; transform:translateY(-50%) translateX(0); }

#ft-panel .ft-head {
  text-align:center;margin-bottom:10px;overflow:hidden;
  max-height:60px;
  transition:max-height var(--ft-expand-speed) ease, opacity 140ms ease, margin var(--ft-expand-speed) ease;
}
#ft-panel .ft-title {
  font-size:var(--ft-font-title);font-weight:700;letter-spacing:.22em;
  color:var(--ft-ink);white-space:nowrap;
}
#ft-panel .ft-sub {
  font-size:var(--ft-font-sub);letter-spacing:.04em;
  color:var(--ft-ink);opacity:.55;margin-top:3px;white-space:nowrap;
}

#ft-panel .ft-list { display:flex;flex-direction:column;gap:var(--ft-gap); }

.ft-btn {
  position:relative;
  display:flex;align-items:center;gap:10px;
  height:var(--ft-btn-height);width:100%;
  padding:0 12px;
  background:var(--ft-bg-btn);
  border:var(--ft-border) solid var(--ft-ink);
  border-radius:var(--ft-btn-radius);
  box-shadow:2px 2px 0 var(--ft-ink);
  cursor:pointer;text-align:left;
  color:var(--ft-ink);
  transition:background var(--ft-anim-speed) ease,
             border-color var(--ft-anim-speed) ease,
             transform var(--ft-anim-speed) ease,
             box-shadow var(--ft-anim-speed) ease,
             color var(--ft-anim-speed) ease,
             justify-content var(--ft-expand-speed) ease,
             gap var(--ft-expand-speed) ease;
}

.ft-icon {
  flex:0 0 auto;width:var(--ft-icon-size);height:var(--ft-icon-size);
  color:var(--ft-ink);
  transition:color var(--ft-anim-speed) ease, transform var(--ft-anim-speed) ease;
}
.ft-icon svg { width:100%;height:100%;display:block; }

.ft-name {
  flex:1 1 auto;min-width:0;
  font-size:var(--ft-font-name);font-weight:600;letter-spacing:.01em;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  max-width:140px;opacity:1;
  transition:max-width var(--ft-expand-speed) ease, opacity 120ms ease;
}

.ft-arrow {
  flex:0 0 auto;min-width:0;font-size:14px;line-height:1;color:var(--ft-ink);opacity:.45;
  max-width:14px;overflow:hidden;
  transform:translateX(0);
  transition:transform var(--ft-anim-speed) ease, opacity var(--ft-anim-speed) ease,
             max-width var(--ft-expand-speed) ease;
}


/* ── Collapsed-by-default, expand-on-hover (desktop only) ─────────────────
   Touch/coarse-pointer devices have no hover, so they keep the panel fully
   expanded at all times (see the mobile block further down). ────────────── */
@media (hover:hover) and (pointer:fine) {
  #ft-panel { width:var(--ft-width-collapsed); }
  #ft-panel:hover,
  #ft-panel:focus-within { width:var(--ft-width); }

  #ft-panel .ft-head {
    max-height:0;opacity:0;margin-bottom:0;pointer-events:none;
  }
  #ft-panel:hover .ft-head,
  #ft-panel:focus-within .ft-head {
    max-height:60px;opacity:1;margin-bottom:10px;
    transition-delay:60ms, 100ms, 60ms;
  }

  .ft-btn { justify-content:center;padding:0 8px;gap:0; }
  #ft-panel:hover .ft-btn,
  #ft-panel:focus-within .ft-btn { justify-content:flex-start;padding:0 12px;gap:10px; }

  .ft-name, .ft-arrow { max-width:0;opacity:0; }
  #ft-panel:hover .ft-name,
  #ft-panel:focus-within .ft-name {
    max-width:140px;opacity:1;transition-delay:70ms;
  }
  #ft-panel:hover .ft-arrow,
  #ft-panel:focus-within .ft-arrow {
    max-width:14px;opacity:.45;transition-delay:90ms;
  }
}

/* ── Hover (desktop only — real pointer) ─────────────────────────────────── */
@media (hover:hover) and (pointer:fine) {
  .ft-btn:not(:disabled):not(.is-active):hover {
    background:var(--ft-bg-alt);
    border-color:var(--ft-accent-ink);
    transform:translateX(-3px);
    box-shadow:3px 3px 0 var(--ft-ink);
  }
  .ft-btn:not(:disabled):not(.is-active):hover .ft-icon {
    color:var(--ft-accent);
    transform:scale(1.12);
  }
  .ft-btn:not(:disabled):not(.is-active):hover .ft-arrow {
    transform:translateX(3px);
    opacity:.85;
  }
}

/* ── Pressed (both desktop + touch) ──────────────────────────────────────── */
.ft-btn:not(:disabled):active {
  transform:translate(1px,2px) !important;
  box-shadow:1px 1px 0 var(--ft-ink) !important;
}

/* ── Selected / current-location state ───────────────────────────────────── */
.ft-btn.is-active {
  background:var(--ft-accent);
  border-color:var(--ft-accent-ink);
  color:var(--ft-accent-ink);
  box-shadow:2px 2px 0 var(--ft-accent-ink);
}
.ft-btn.is-active .ft-icon,
.ft-btn.is-active .ft-arrow { color:var(--ft-accent-ink);opacity:.9; }
/* small notch pointing at the currently-active destination */
.ft-btn.is-active::after {
  content:'';position:absolute;right:-9px;top:50%;
  width:0;height:0;transform:translateY(-50%);
  border-top:6px solid transparent;border-bottom:6px solid transparent;
  border-left:7px solid var(--ft-accent-ink);
}

/* brief confirmation pulse once travel completes */
.ft-btn.ft-pulse { animation:ftPulse 850ms ease-out; }
@keyframes ftPulse {
  0%   { box-shadow:2px 2px 0 var(--ft-accent-ink), 0 0 0 0   rgba(224,138,46,0.55); }
  60%  { box-shadow:2px 2px 0 var(--ft-accent-ink), 0 0 0 8px rgba(224,138,46,0); }
  100% { box-shadow:2px 2px 0 var(--ft-accent-ink), 0 0 0 0   rgba(224,138,46,0); }
}

/* disabled while a travel is in progress */
.ft-btn:disabled { opacity:.5;cursor:not-allowed; }

/* ── Narrow desktop windows (mouse) — same hover behaviour, just smaller ──── */
@media (max-width:640px) and (hover:hover) and (pointer:fine) {
  #ft-panel {
    --ft-width:      190px;
    --ft-btn-height: 46px;
    --ft-gap:        6px;
    --ft-icon-size:  17px;
    --ft-font-title: 10px;
    --ft-font-sub:   9px;
    --ft-font-name:  12px;
  }
}

/* ── Real touch devices — always-visible icon row spread across the FULL
   screen width, docked near the top with no card/background — just the
   individual icon tiles floating over the world, out of the way of both
   thumb zones (joystick bottom-left, run button bottom-right). Anchored by
   left+right (not width/vw), which position:fixed resolves reliably against
   the real viewport — no "100vw" ambiguity to worry about. ─────────────── */
@media (pointer:coarse) {
  #ft-panel {
    --ft-tile:   38px;   /* smaller, compact icon tile */
    --ft-margin: 14px;

    top:16px;left:var(--ft-margin);right:var(--ft-margin);bottom:auto;
    width:auto;height:auto;
    padding:0;
    background:none;border:none;box-shadow:none;
    display:flex;flex-direction:row;align-items:center;
    transform:translateY(-6px);
  }
  #ft-panel.ft-in { transform:translateY(0); }

  #ft-panel .ft-head { display:none; }

  #ft-panel .ft-list {
    display:flex;flex-direction:row;align-items:center;justify-content:space-between;
    width:100%;
  }

  /* icon-only square tiles — no name/arrow on mobile */
  .ft-btn {
    width:var(--ft-tile);height:var(--ft-tile);
    flex:0 0 auto;padding:0;gap:0;
    justify-content:center;
  }
  .ft-name, .ft-arrow { display:none; }

  /* the desktop "current location" side-notch doesn't read well in a packed
     horizontal row — the accent fill alone is a clear enough indicator */
  .ft-btn.is-active::after { display:none; }
}

/* very small screens — shrink further and drop the subtitle to save space */
@media (max-width:380px) {
  #ft-panel .ft-sub { display:none; }
}
@media (max-width:380px) and (hover:hover) and (pointer:fine) {
  #ft-panel { --ft-btn-height:42px;--ft-width:168px; }
}
`;
  document.head.appendChild(style);
}

function _createFastTravelPanel() {
  const panel = document.createElement('div');
  panel.id = 'ft-panel';
  panel.innerHTML = `
    <div class="ft-head">
      <div class="ft-title">FAST TRAVEL</div>
      <div class="ft-sub">Choose a destination</div>
    </div>
    <div class="ft-list">
      ${DESTINATIONS.map((d, i) => `
        <button class="ft-btn" type="button" data-index="${i}" title="Travel to ${d.name}">
          <span class="ft-icon">${d.icon}</span>
          <span class="ft-name">${d.name}</span>
          <span class="ft-arrow">&#8594;</span>
        </button>
      `).join('')}
    </div>`;
  document.body.appendChild(panel);

  panel.querySelectorAll('.ft-btn').forEach((btn) => {
    const index = Number(btn.dataset.index);
    btn.addEventListener('click', () => _onWaypointClick(index));
  });

  return panel;
}


function _setButtonsEnabled(enabled) {
  _waypointBtns.forEach(b => { b.disabled = !enabled; });
}

/** Mark `index` as the player's current location (accent fill + notch). */
function _setActiveDestination(index) {
  _ftActiveIdx = index;
  _waypointBtns.forEach((b, i) => b.classList.toggle('is-active', i === index));
}

/** Brief confirmation pulse on arrival — removed automatically after it plays. */
function _pulseDestination(index) {
  const btn = _waypointBtns[index];
  if (!btn) return;
  btn.classList.remove('ft-pulse');
  void btn.offsetWidth; // restart animation
  btn.classList.add('ft-pulse');
  setTimeout(() => btn.classList.remove('ft-pulse'), 900);
}

export function showWaypointButtons() {
  if (_ftHideTimer) { clearTimeout(_ftHideTimer); _ftHideTimer = null; }
  _ftPanel.style.display = 'block';
  // Force reflow so the opacity/transform transition actually plays.
  void _ftPanel.offsetWidth;
  _ftPanel.classList.add('ft-in');
  _setButtonsEnabled(true);
  _showDevBadge();
}

export function hideWaypointButtons() {
  _ftPanel.classList.remove('ft-in');
  disposeCloud();
  _ftHideTimer = setTimeout(() => { _ftPanel.style.display = 'none'; }, 260);
  _hideDevBadge();
}

// ─────────────────────────────────────────────────────────────────────────────
//  "Under development" notice — small, unobtrusive, same toon-ink language as
//  the Fast Travel panel. Docked top-left on desktop (the only fully free
//  corner: audio button is top-right, FT panel is right/top-row, Back is
//  bottom-center). On touch devices it drops below the Fast Travel icon row
//  instead of overlapping it.
// ─────────────────────────────────────────────────────────────────────────────
function _injectDevBadgeStyles() {
  if (document.getElementById('dev-badge-style')) return;
  const style = document.createElement('style');
  style.id = 'dev-badge-style';
  style.textContent = `
#dev-badge {
  position:fixed;top:16px;left:16px;z-index:18;display:none;
  align-items:center;gap:6px;
  padding:6px 11px 6px 9px;border-radius:999px;
  background:#fdfbf6;border:2px solid #241d15;
  box-shadow:2px 3px 0 #241d15;
  font-family:'Share Tech Mono','Courier New',monospace;
  font-size:10px;font-weight:700;letter-spacing:.04em;color:#241d15;
  opacity:0;transform:translateY(-6px);
  transition:opacity 300ms ease, transform 300ms ease;
  pointer-events:none;
  white-space:nowrap;
}
#dev-badge.dev-badge-in { opacity:.92;transform:translateY(0); }
#dev-badge .dev-badge-dot {
  width:6px;height:6px;border-radius:50%;flex:0 0 auto;
  background:#e08a2e;border:1.5px solid #241d15;
  animation:devBadgePulse 1.8s ease-in-out infinite;
}
@keyframes devBadgePulse { 0%,100% { opacity:.55; } 50% { opacity:1; } }

@media (pointer:coarse) {
  #dev-badge { top:64px;left:12px;font-size:9px;padding:5px 9px 5px 7px; }
}
@media (max-width:360px) {
  #dev-badge { font-size:8.3px; }
}
`;
  document.head.appendChild(style);
}

function _createDevBadge() {
  const badge = document.createElement('div');
  badge.id = 'dev-badge';
  badge.innerHTML = `<span class="dev-badge-dot"></span><span>World still under construction</span>`;
  document.body.appendChild(badge);
  return badge;
}

_injectDevBadgeStyles();
const _devBadge = _createDevBadge();
let _devBadgeHideTimer = null;

function _showDevBadge() {
  if (_devBadgeHideTimer) { clearTimeout(_devBadgeHideTimer); _devBadgeHideTimer = null; }
  _devBadge.style.display = 'flex';
  void _devBadge.offsetWidth; // force reflow so the transition plays
  _devBadge.classList.add('dev-badge-in');
}

function _hideDevBadge() {
  _devBadge.classList.remove('dev-badge-in');
  _devBadgeHideTimer = setTimeout(() => { _devBadge.style.display = 'none'; }, 300);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Waypoint click → tornado travel
// ─────────────────────────────────────────────────────────────────────────────
function _onWaypointClick(index) {
  if (!_hasCharacterRef()) return;
  if (isTornadoActive())  return;
  if (index === _ftActiveIdx) return; // already there

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
    _setActiveDestination(index);
    _pulseDestination(index);
  });
}

function _hasCharacterRef() {
  return !!(_getCharPos && _getCharMeshes && _setCharPos);
}

// ─────────────────────────────────────────────────────────────────────────────
//  World-space discovery markers — Sweden / Kosovo / The Lab
//  NOT a UI card. A tiny marker floats above each location in actual 3D space
//  (projected every frame from its world X/Y/Z through the camera), grows into
//  a compact label as the player approaches, offers a quiet "E · Explore" /
//  "Tap to explore" affordance once close enough, and only THEN reveals a
//  short description — as a small world-anchored tooltip on desktop, or a
//  compact bottom sheet on mobile. Walk away and it fades back to nothing.
//  Only one location is ever surfaced at a time (the nearest in range).
// ─────────────────────────────────────────────────────────────────────────────
const _isPoiTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;

const POI_ZONES = [
  {
    key: 'lab', title: 'The Lab', subtitle: 'Unreleased', icon: _ICON.flask,
    accent: '#1798ab', anchorOffsetY: 2.1,
    detectRadius: 20, interactRadius: 9,
    getCenter: () => (_labHasCenter ? _labCenter : null),
    body: `Mechanics, robotics and electronics — a personal playground for experimenting, prototyping and rebuilding things. Nothing here has shipped publicly yet.`,
  },
  {
    key: 'kosovo', title: 'Kosovo', subtitle: 'Origin', icon: _ICON.pin,
    accent: '#3a5fd9', anchorOffsetY: 1.5,
    detectRadius: 18, interactRadius: 8,
    getCenter: () => WAYPOINTS[1],
    body: `Born and raised here, surrounded by close family and a hard-working community that shaped who I am — resilience I still lean on as an engineer today.`,
  },
  {
    key: 'sweden', title: 'Sweden', subtitle: 'Home', icon: _ICON.pin,
    accent: '#1f7fc2', anchorOffsetY: 1.5,
    detectRadius: 18, interactRadius: 8,
    getCenter: () => WAYPOINTS[0],
    body: `Home since 2017. I learned the language, finished my software engineering education, and landed my first developer job here in 2020 — my second home.`,
  },
];

let _poiActiveKey  = null;    // key of the zone currently surfaced (nearest in range)
let _poiInRange    = false;   // is the player within THAT zone's interactRadius
let _poiExpanded   = false;   // has the player interacted (E / tap) to see the description
let _poiHideTimer  = null;    // delayed display:none after fade-out finishes

function _injectPoiStyles() {
  if (document.getElementById('poi-style')) return;
  const style = document.createElement('style');
  style.id = 'poi-style';
  style.textContent = `
/* ── world-anchored marker — position is set every frame via left/top.
   Toon-ink visual language (warm paper, black ink outline, offset shadow) —
   the SAME family as the Fast Travel panel / BACK key-cap / joystick, so a
   discovery here reads as part of THIS world, not an imported HUD. ───────── */
#poi-marker {
  position:fixed;left:0;top:0;
  z-index:16;display:none;
  transform:translate(-50%,-100%);
  display:flex;flex-direction:column;align-items:center;
  font-family:'Share Tech Mono','Courier New',monospace;
  pointer-events:none;
  opacity:0;
  transition:opacity 260ms ease;
  --poi-accent:#3a5fd9;
  --poi-ink:#241d15;
}
#poi-marker.poi-shown { opacity:1; }

/* world-space tooltip (desktop expanded state) — grows upward above the label */
#poi-marker .poi-tooltip {
  width:212px;margin-bottom:9px;
  padding:11px 13px;border-radius:12px;
  background:#fdfbf6;
  border:2px solid var(--poi-ink);
  box-shadow:3px 4px 0 var(--poi-ink);
  opacity:0;transform:translateY(6px) scale(.97);transform-origin:bottom center;
  transition:opacity 260ms ease, transform 260ms ease;
  pointer-events:none;
}
#poi-marker .poi-tooltip-head { display:flex;align-items:center;gap:8px;margin-bottom:6px; }
#poi-marker .poi-tooltip-icon {
  width:20px;height:20px;flex:0 0 auto;padding:3px;box-sizing:content-box;
  color:#fff;background:var(--poi-accent);
  border:1.5px solid var(--poi-ink);border-radius:7px;
}
#poi-marker .poi-tooltip-icon svg { width:100%;height:100%;display:block; }
#poi-marker .poi-tooltip-title {
  font-size:13px;font-weight:700;color:var(--poi-ink);letter-spacing:.01em;
}
#poi-marker .poi-tooltip-subtitle {
  font-size:9px;font-weight:700;letter-spacing:.10em;text-transform:uppercase;
  color:var(--poi-accent);opacity:.9;margin-top:1px;
}
#poi-marker .poi-tooltip-body {
  margin:0;font-size:11.5px;line-height:1.55;color:var(--poi-ink);opacity:.82;
}
@media (hover:hover) and (pointer:fine) {
  #poi-marker.poi-expanded .poi-tooltip {
    opacity:1;transform:translateY(0) scale(1);pointer-events:auto;
  }
}
@media (pointer:coarse) {
  #poi-marker .poi-tooltip { display:none; } /* mobile uses the bottom sheet instead */
}

/* compact floating label — icon + title + subtitle */
#poi-marker .poi-label {
  display:flex;align-items:center;gap:7px;
  padding:6px 12px 6px 6px;border-radius:999px;
  background:#fdfbf6;
  border:2px solid var(--poi-ink);
  box-shadow:2px 3px 0 var(--poi-ink);
  opacity:0;transform:translateY(5px) scale(.94);
  transition:opacity 300ms ease, transform 300ms ease, box-shadow 120ms ease, background 120ms ease;
  pointer-events:none;
  cursor:default;
  font:inherit;color:inherit;
}
#poi-marker.poi-shown .poi-label {
  opacity:1;transform:translateY(0) scale(1);
  transition-delay:160ms;
}
#poi-marker.poi-inrange .poi-label { pointer-events:auto;cursor:pointer; }
#poi-marker.poi-inrange .poi-label:hover { background:#f1e9d8; }
#poi-marker.poi-inrange .poi-label:active { transform:translate(1px,2px); box-shadow:1px 1px 0 var(--poi-ink); }
#poi-marker .poi-label-icon {
  width:22px;height:22px;flex:0 0 auto;padding:3px;box-sizing:content-box;
  display:flex;align-items:center;justify-content:center;
  color:#fff;background:var(--poi-accent);
  border:1.5px solid var(--poi-ink);border-radius:50%;
}
#poi-marker .poi-label-icon svg { width:100%;height:100%;display:block; }
#poi-marker .poi-label-title {
  font-size:12.5px;font-weight:700;letter-spacing:.01em;color:var(--poi-ink);white-space:nowrap;
}
#poi-marker .poi-label-sub {
  font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  color:var(--poi-accent);opacity:.85;white-space:nowrap;
}
#poi-marker .poi-label-sub::before { content:'• '; }

/* interaction hint — appears only inside interactRadius, disappears once expanded */
#poi-marker .poi-hint {
  display:flex;align-items:center;gap:5px;margin-top:7px;
  font-size:9.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
  color:var(--poi-ink);opacity:0;transform:translateY(3px);
  transition:opacity 220ms ease, transform 220ms ease;
  pointer-events:none;
}
#poi-marker.poi-inrange:not(.poi-expanded) .poi-hint {
  opacity:.85;transform:translateY(0);transition-delay:120ms;
}
/* the "E" reads as an actual key-cap — same toon style as the WASD/BACK caps */
#poi-marker .poi-hint kbd {
  display:inline-flex;align-items:center;justify-content:center;
  min-width:15px;height:15px;padding:0 3px;border-radius:4px;
  background:#fff;border:1.5px solid var(--poi-ink);box-shadow:1px 1px 0 var(--poi-ink);
  font:inherit;font-size:9px;font-weight:700;color:var(--poi-ink);
}
@media (pointer:coarse) { #poi-marker .poi-hint kbd { display:none; } }

/* connector — thin ink line + small dot pinned exactly to the world anchor */
#poi-marker .poi-connector {
  width:2px;height:14px;margin-top:2px;
  background:var(--poi-ink);opacity:.3;
  transform:scaleY(0);transform-origin:top;
  transition:transform 280ms ease;
}
#poi-marker.poi-shown .poi-connector { transform:scaleY(1); }
#poi-marker .poi-dot {
  width:8px;height:8px;border-radius:50%;margin-top:-1px;
  background:var(--poi-accent);border:1.5px solid var(--poi-ink);
  opacity:0;transition:opacity 200ms ease;
}
#poi-marker.poi-shown .poi-dot { opacity:1; }

/* ── mobile bottom sheet (expanded state on touch devices) — same warm
   paper / ink-outline family, docked with a top border like a drawn card.
   z-index sits ABOVE the joystick (50) so it isn't shown poking out from
   underneath the movement controls while it's open. ─────────────────────── */
#poi-sheet {
  position:fixed;left:0;right:0;bottom:0;z-index:55;
  display:none;
  max-height:30vh;
  padding:10px 18px calc(16px + env(safe-area-inset-bottom, 0px));
  border-radius:18px 18px 0 0;
  background:#fdfbf6;
  border:2px solid var(--poi-ink,#241d15);
  border-bottom:none;
  box-shadow:0 -6px 0 0 var(--poi-ink,#241d15);
  font-family:'Share Tech Mono','Courier New',monospace;
  transform:translateY(100%);
  transition:transform 320ms cubic-bezier(.22,.61,.36,1);
  color:#241d15;
}
@media (pointer:coarse) {
  #poi-sheet { display:block; }
  #poi-sheet.is-open { transform:translateY(0); }
}
#poi-sheet .poi-sheet-handle {
  width:36px;height:4px;border-radius:2px;margin:2px auto 10px;
  background:rgba(36,29,21,0.25);
}
#poi-sheet .poi-sheet-head { display:flex;align-items:center;gap:10px; }
#poi-sheet .poi-sheet-icon {
  width:26px;height:26px;flex:0 0 auto;padding:4px;box-sizing:content-box;
  color:#fff;background:var(--poi-sheet-accent,#3a5fd9);
  border:1.5px solid #241d15;border-radius:8px;
}
#poi-sheet .poi-sheet-icon svg { width:100%;height:100%;display:block; }
#poi-sheet .poi-sheet-title { font-size:16px;font-weight:700;color:#241d15; }
#poi-sheet .poi-sheet-subtitle {
  font-size:9.5px;font-weight:700;letter-spacing:.10em;text-transform:uppercase;
  color:var(--poi-sheet-accent,#3a5fd9);opacity:.9;margin-top:1px;
}
#poi-sheet .poi-sheet-close {
  margin-left:auto;flex:0 0 auto;width:26px;height:26px;border-radius:7px;
  border:1.5px solid #241d15;background:#fff;box-shadow:1.5px 1.5px 0 #241d15;
  color:#241d15;font-size:15px;line-height:1;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  transition:transform .1s ease, box-shadow .1s ease;
}
#poi-sheet .poi-sheet-close:active { transform:translate(1px,1px); box-shadow:0.5px 0.5px 0 #241d15; }
#poi-sheet .poi-sheet-body {
  margin:10px 0 0;font-size:12.5px;line-height:1.58;color:#241d15;opacity:.9;
}
`;
  document.head.appendChild(style);
}


function _createPoiDom() {
  const marker = document.createElement('div');
  marker.id = 'poi-marker';
  marker.innerHTML = `
    <div class="poi-tooltip">
      <div class="poi-tooltip-head">
        <span class="poi-tooltip-icon"></span>
        <div>
          <div class="poi-tooltip-title"></div>
          <div class="poi-tooltip-subtitle"></div>
        </div>
      </div>
      <p class="poi-tooltip-body"></p>
    </div>
    <button type="button" class="poi-label">
      <span class="poi-label-icon"></span>
      <span class="poi-label-title"></span>
      <span class="poi-label-sub"></span>
    </button>
    <div class="poi-hint">${_isPoiTouch ? '<span>Tap to explore</span>' : '<kbd>E</kbd><span>Explore</span>'}</div>
    <div class="poi-connector"></div>
    <div class="poi-dot"></div>`;
  document.body.appendChild(marker);

  const sheet = document.createElement('div');
  sheet.id = 'poi-sheet';
  sheet.innerHTML = `
    <div class="poi-sheet-handle"></div>
    <div class="poi-sheet-head">
      <span class="poi-sheet-icon"></span>
      <div>
        <div class="poi-sheet-title"></div>
        <div class="poi-sheet-subtitle"></div>
      </div>
      <button type="button" class="poi-sheet-close" aria-label="Close">×</button>
    </div>
    <p class="poi-sheet-body"></p>`;
  document.body.appendChild(sheet);

  marker.querySelector('.poi-label').addEventListener('click', () => {
    if (!_poiInRange) return;
    audio.playHover();
    _setPoiExpanded(!_poiExpanded);
  });
  sheet.querySelector('.poi-sheet-close').addEventListener('click', () => {
    audio.playButtonClick();
    _setPoiExpanded(false);
  });

  return { marker, sheet };
}

_injectPoiStyles();
const { marker: _poiMarkerEl, sheet: _poiSheetEl } = _createPoiDom();

function _setPoiExpanded(expanded) {
  if (_poiExpanded === expanded) return;
  _poiExpanded = expanded;
  _poiMarkerEl.classList.toggle('poi-expanded', expanded);
  _poiSheetEl.classList.toggle('is-open', expanded);
  if (expanded) audio.playCardOpen();
}

// Desktop: press E while inside a location's interact radius to reveal it.
window.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyE' || e.repeat) return;
  if (!_poiActiveKey || !_poiInRange) return;
  _setPoiExpanded(!_poiExpanded);
});

const _poiAnchorWorld = new THREE.Vector3();
const _poiAnchorProj  = new THREE.Vector3();

/** Populate the marker DOM (icon/title/subtitle/body/accent) for `zone`. */
function _populatePoiMarker(zone) {
  _poiMarkerEl.style.setProperty('--poi-accent', zone.accent);
  _poiSheetEl.style.setProperty('--poi-sheet-accent', zone.accent);

  _poiMarkerEl.querySelector('.poi-label-icon').innerHTML  = zone.icon;
  _poiMarkerEl.querySelector('.poi-label-title').textContent = zone.title;
  _poiMarkerEl.querySelector('.poi-label-sub').textContent   = zone.subtitle;
  _poiMarkerEl.querySelector('.poi-tooltip-icon').innerHTML  = zone.icon;
  _poiMarkerEl.querySelector('.poi-tooltip-title').textContent    = zone.title;
  _poiMarkerEl.querySelector('.poi-tooltip-subtitle').textContent = zone.subtitle;
  _poiMarkerEl.querySelector('.poi-tooltip-body').textContent     = zone.body;

  _poiSheetEl.querySelector('.poi-sheet-icon').innerHTML  = zone.icon;
  _poiSheetEl.querySelector('.poi-sheet-title').textContent    = zone.title;
  _poiSheetEl.querySelector('.poi-sheet-subtitle').textContent = zone.subtitle;
  _poiSheetEl.querySelector('.poi-sheet-body').textContent     = zone.body;
}

function _hidePoiMarker() {
  _poiMarkerEl.classList.remove('poi-shown', 'poi-inrange');
  _setPoiExpanded(false);
  if (_poiHideTimer) clearTimeout(_poiHideTimer);
  _poiHideTimer = setTimeout(() => {
    if (!_poiActiveKey) _poiMarkerEl.style.display = 'none';
  }, 300);
}

/** Called every frame — finds the nearest in-range zone, projects it to screen
 *  space, and drives the reveal/hint/expand states. This is the whole
 *  "world-space discovery" system: no fixed screen position, no persistent
 *  overlay — it only exists where and while the location does. */
function _tickPoiProximity() {
  if (!isWhiteWorld() && !isTransitioning()) {
    if (_poiActiveKey) { _poiActiveKey = null; _hidePoiMarker(); }
    return;
  }

  const mg = _getModelGroup ? _getModelGroup() : null;
  if (!mg) return;

  let closest     = null;
  let closestDist = Infinity;
  for (const zone of POI_ZONES) {
    const c = zone.getCenter();
    if (!c) continue;
    const dx   = mg.position.x - c.x;
    const dz   = mg.position.z - c.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist <= zone.detectRadius && dist < closestDist) {
      closestDist = dist;
      closest     = zone;
    }
  }

  const key = closest ? closest.key : null;
  if (key !== _poiActiveKey) {
    _poiActiveKey = key;
    if (closest) {
      if (_poiHideTimer) { clearTimeout(_poiHideTimer); _poiHideTimer = null; }
      _populatePoiMarker(closest);
      _poiMarkerEl.style.display = 'flex';
      void _poiMarkerEl.offsetWidth; // force reflow so the transition plays
      _poiMarkerEl.classList.add('poi-shown');
    } else {
      _hidePoiMarker();
    }
  }

  if (!closest) return;

  // Inside-radius state drives the "E · Explore" hint independently of the
  // reveal animation above (pure distance check, re-evaluated every frame).
  _poiInRange = closestDist <= closest.interactRadius;
  _poiMarkerEl.classList.toggle('poi-inrange', _poiInRange);
  if (!_poiInRange && _poiExpanded) _setPoiExpanded(false);

  // Project the anchor (world position, lifted above the location) to screen
  // space every frame so the marker tracks the camera exactly like a real
  // object in the scene, not a screen-locked UI element.
  const c = closest.getCenter();
  _poiAnchorWorld.set(c.x, c.y + closest.anchorOffsetY, c.z);
  _poiAnchorProj.copy(_poiAnchorWorld).project(camera);

  if (_poiAnchorProj.z > 1) { _poiMarkerEl.style.opacity = '0'; return; }

  const sx = (_poiAnchorProj.x * 0.5 + 0.5) * window.innerWidth;
  const sy = (1 - (_poiAnchorProj.y * 0.5 + 0.5)) * window.innerHeight;
  _poiMarkerEl.style.left = `${sx}px`;
  _poiMarkerEl.style.top  = `${sy}px`;

  // Soft edge fade in the outer ring of the detect radius so the threshold
  // never pops — "approaching increases visibility, moving away fades".
  const edge = _smoothstep(closest.detectRadius * 0.82, closest.detectRadius, closestDist);
  _poiMarkerEl.style.opacity = String(1 - edge * 0.8);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Env material transparency toggle
//  The iris-alpha effect only ever produces alpha < 1 WHILE the iris wipe is
//  actually playing (see whiteworld.iris.glsl — alpha is forced to 1 outside
//  of that). Leaving every ground/stone material permanently `transparent`
//  forces Three.js to sort them by per-object distance instead of using
//  pixel-perfect depth testing — with many adjacent/overlapping tiles that
//  sort is unstable and tiles can render in the wrong order, letting you see
//  "through" one stone into whatever's behind it (or its own outline lines).
//  Only opt into transparent sorting while the wipe is actually in flight;
//  the rest of the time render fully opaque so normal depth-buffer occlusion
//  handles it correctly.
// ─────────────────────────────────────────────────────────────────────────────
let _envTransparentNow = true; // materials start as `transparent:true` at creation
function _syncEnvTransparency() {
  const wantTransparent = isTransitioning();
  if (wantTransparent === _envTransparentNow) return;
  _envTransparentNow = wantTransparent;
  for (const mat of _envMaterials) mat.transparent = wantTransparent;
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
  _syncEnvTransparency();
  _syncEnvLights();
  _syncSun();
  _tickLabAnimations(delta);
  _tickPoiProximity();

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
