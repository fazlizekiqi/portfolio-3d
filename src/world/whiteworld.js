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
import { scene } from '../scene.js';
import { LAYER, setWorldLayer } from '../layers.js';
import { getProgress, isTransitioning, isWhiteWorld, getElapsed } from '../transition.js';
import { tickTornado, isTornadoActive, disposeCloud, focusSpawnAndTravel } from './tornado-travel.js';
import IRIS_ALPHA_GLSL from '../shaders/whiteworld.iris.glsl?raw';
import VERT            from '../shaders/whiteworld.vert.glsl?raw';
import FRAG_BODY       from '../shaders/whiteworld.frag.glsl?raw';

// ─────────────────────────────────────────────────────────────────────────────
//  Iris-alpha shader uniforms
// ─────────────────────────────────────────────────────────────────────────────
const _uniforms = {
  uProgress: { value: 1.0 },
  uTime:     { value: 0.0 },
  uRes:      { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
};

function _initResizeListener() {
  window.addEventListener('resize', () => {
    _uniforms.uRes.value.set(window.innerWidth, window.innerHeight);
  });
}
_initResizeListener();

// ─────────────────────────────────────────────────────────────────────────────
//  Cartoon materials (fill + outline)
// ─────────────────────────────────────────────────────────────────────────────
const FRAG = IRIS_ALPHA_GLSL + '\n' + FRAG_BODY;

function _createFillMaterial() {
  return new THREE.ShaderMaterial({
    uniforms:       { ..._uniforms, uColor: { value: new THREE.Color(0xffffff) } },
    vertexShader:   VERT,
    fragmentShader: FRAG,
    transparent: true, depthWrite: true, depthTest: true, side: THREE.FrontSide,
  });
}

function _createLineMaterial() {
  return new THREE.ShaderMaterial({
    uniforms:       { ..._uniforms, uColor: { value: new THREE.Color(0x111111) } },
    vertexShader:   VERT,
    fragmentShader: FRAG,
    transparent: true, depthWrite: false, depthTest: true,
  });
}

const _fillMat = _createFillMaterial();
const _lineMat = _createLineMaterial();

// ─────────────────────────────────────────────────────────────────────────────
//  Scene object factory
// ─────────────────────────────────────────────────────────────────────────────
function _addCartoonObject(geometry, position, rotation = null) {
  const group = new THREE.Group();
  group.position.copy(position);
  if (rotation) group.rotation.copy(rotation);
  group.add(
    new THREE.Mesh(geometry, _fillMat),
    new THREE.LineSegments(new THREE.EdgesGeometry(geometry), _lineMat),
  );
  setWorldLayer(group, LAYER.WHITE, true);
  scene.add(group);
  return group;
}

function _buildWhiteWorldScene() {
  _addCartoonObject(
    new THREE.PlaneGeometry(60, 60, 20, 20),
    new THREE.Vector3(0, -0.95, 0),
    new THREE.Euler(-Math.PI / 2, 0, 0),
  );
  _addCartoonObject(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.Vector3( 1.4, -0.65,  0));
  _addCartoonObject(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.Vector3(-1.5, -0.75,  0.5));
  _addCartoonObject(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.Vector3( 0.8, -0.80, -1.2));
}
_buildWhiteWorldScene();

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
  new THREE.Vector3( 14.0, -0.9,   6.0),
  new THREE.Vector3(-16.0, -0.9,  -5.0),
  new THREE.Vector3(  2.0, -0.9, -18.0),
  new THREE.Vector3(-10.0, -0.9,  15.0),
  new THREE.Vector3( 18.0, -0.9, -13.0),
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

  if (isWhiteWorld() || isTransitioning()) {
    tickTornado(delta);
  }
}
