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
import { scene, controls } from '../scene.js';
import { LAYER, setWorldLayer } from '../layers.js';
import { getProgress, isTransitioning, isWhiteWorld, getElapsed } from '../transition.js';
import { spawnCloud, travelTo, tickTornado, isTornadoActive, disposeCloud } from './tornado-travel.js';
import IRIS_ALPHA_GLSL from '../shaders/whiteworld.iris.glsl?raw';
import VERT            from '../shaders/whiteworld.vert.glsl?raw';
import FRAG_BODY       from '../shaders/whiteworld.frag.glsl?raw';

// ── Shared iris-alpha uniforms ────────────────────────────────────────────────
const _uniforms = {
  uProgress: { value: 1.0 },
  uTime:     { value: 0.0 },
  uRes:      { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
};
window.addEventListener('resize', () => {
  _uniforms.uRes.value.set(window.innerWidth, window.innerHeight);
});

const FRAG = IRIS_ALPHA_GLSL + '\n' + FRAG_BODY;

const _fillMat = new THREE.ShaderMaterial({
  uniforms: { ..._uniforms, uColor: { value: new THREE.Color(0xffffff) } },
  vertexShader: VERT, fragmentShader: FRAG,
  transparent: true, depthWrite: true, depthTest: true, side: THREE.FrontSide,
});

const _lineMat = new THREE.ShaderMaterial({
  uniforms: { ..._uniforms, uColor: { value: new THREE.Color(0x111111) } },
  vertexShader: VERT, fragmentShader: FRAG,
  transparent: true, depthWrite: false, depthTest: true,
});

function _makeCartoonObject(geometry, position, rotation = null) {
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

// ── White world objects ───────────────────────────────────────────────────────
_makeCartoonObject(
  new THREE.PlaneGeometry(60, 60, 20, 20),
  new THREE.Vector3(0, -0.95, 0),
  new THREE.Euler(-Math.PI / 2, 0, 0),
);
_makeCartoonObject(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.Vector3( 1.4, -0.65,  0));
_makeCartoonObject(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.Vector3(-1.5, -0.75,  0.5));
_makeCartoonObject(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.Vector3( 0.8, -0.80, -1.2));

// ── Character reference (set from main.js after model load) ──────────────────
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

// ── Waypoints ─────────────────────────────────────────────────────────────────
// 5 random positions spread across the white world ground plane.
const WAYPOINTS = [
  new THREE.Vector3( 14.0, -0.9,   6.0),
  new THREE.Vector3(-16.0, -0.9,  -5.0),
  new THREE.Vector3(  2.0, -0.9, -18.0),
  new THREE.Vector3(-10.0, -0.9,  15.0),
  new THREE.Vector3( 18.0, -0.9, -13.0),
];

const WAYPOINT_LABELS = ['α', 'β', 'γ', 'δ', 'ε'];

// ── Button container ──────────────────────────────────────────────────────────
const _btnContainer = document.createElement('div');
_btnContainer.id = 'ww-waypoints';
_btnContainer.style.cssText = `
  position:fixed;right:28px;top:50%;transform:translateY(-50%);
  z-index:25;display:none;flex-direction:column;gap:10px;
  font-family:'Share Tech Mono','Courier New',monospace;`;
document.body.appendChild(_btnContainer);

const _waypointBtns = WAYPOINTS.map((wp, i) => {
  const btn = document.createElement('button');
  btn.textContent = WAYPOINT_LABELS[i];
  btn.title       = `Travel to waypoint ${WAYPOINT_LABELS[i]}`;
  btn.style.cssText = `
    width:42px;height:42px;border-radius:50%;cursor:pointer;
    background:rgba(255,255,255,0.82);
    border:2px solid rgba(80,60,120,0.35);
    color:#7755aa;font-size:15px;font-weight:bold;
    letter-spacing:0;
    backdrop-filter:blur(8px);
    box-shadow:0 2px 12px rgba(100,80,160,0.12);
    transition:background 0.18s,border-color 0.18s,color 0.18s,transform 0.12s;`;

  btn.addEventListener('mouseenter', () => {
    btn.style.background    = 'rgba(180,140,255,0.22)';
    btn.style.borderColor   = 'rgba(150,100,220,0.7)';
    btn.style.color         = '#5533aa';
    btn.style.transform     = 'scale(1.12)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background    = 'rgba(255,255,255,0.82)';
    btn.style.borderColor   = 'rgba(80,60,120,0.35)';
    btn.style.color         = '#7755aa';
    btn.style.transform     = 'scale(1)';
  });

  btn.addEventListener('click', () => _onWaypointClick(i));
  _btnContainer.appendChild(btn);
  return btn;
});

function _setButtonsEnabled(enabled) {
  _waypointBtns.forEach(b => {
    b.disabled       = !enabled;
    b.style.opacity  = enabled ? '1' : '0.38';
    b.style.cursor   = enabled ? 'pointer' : 'not-allowed';
  });
}

// Show / hide the whole panel (called when entering/leaving the white world)
export function showWaypointButtons() {
  _btnContainer.style.display = 'flex';
  _setButtonsEnabled(true);
}
export function hideWaypointButtons() {
  _btnContainer.style.display = 'none';
  disposeCloud();
}

// ── Waypoint click handler ────────────────────────────────────────────────────
function _onWaypointClick(index) {
  if (!_getCharPos || !_getCharMeshes || !_setCharPos) return;
  if (isTornadoActive()) return;

  const meshes      = _getCharMeshes();
  const modelGroup  = _getModelGroup ? _getModelGroup() : null;
  const destination = WAYPOINTS[index].clone();

  if (!modelGroup) return;

  _setButtonsEnabled(false);

  spawnCloud(meshes, modelGroup);

  // After cloud fully forms, begin tornado travel
  setTimeout(() => {
    travelTo(destination, () => {
      _setCharPos(destination.clone());

      if (controls) {
        controls.target.set(destination.x, destination.y + 1.0, destination.z);
        controls.update();
      }
      _setButtonsEnabled(true);
    });
  }, 2400);
}

// ── Per-frame tick ────────────────────────────────────────────────────────────
export function tickWhiteWorld(delta = 0) {
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

  // Tick tornado-travel system when we're in the white world
  if (isWhiteWorld() || isTransitioning()) {
    tickTornado(delta);
  }
}

