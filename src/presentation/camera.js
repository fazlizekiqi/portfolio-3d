/**
 * camera.js — Presentation camera movement.
 *
 * Owns:
 *   - startCameraMove(toPos, toLook)
 *   - glideHome() → returns computed duration ms
 *   - tickCamera(delta, elapsed, activeSlide, frozen) → drives the lerp
 *   - initCameraState()
 *
 * Has NO knowledge of slides content, UI, player, or worlds.
 */

import * as THREE from 'three';
import { camera, controls } from '../scene.js';

// ── Easing ────────────────────────────────────────────────────────────────────
export const EASE = {
  inOut:   t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3) / 2,
  in:      t => t * t * t,
  out:     t => 1 - Math.pow(1 - t, 3),
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3*Math.pow(t-1,3) + c1*Math.pow(t-1,2); },
};

// ── State ─────────────────────────────────────────────────────────────────────
export const camPosStart   = new THREE.Vector3();
export const camLookStart  = new THREE.Vector3();
export const camPosTarget  = new THREE.Vector3();
export const camLookTarget = new THREE.Vector3();
export const currentCamLook = new THREE.Vector3(0, 0.6, 0);

export let slideElapsed = 0;
let settledTime  = 0;

// Orbit state — computed once when the lerp finishes
let _orbitAngle  = 0;
let _orbitRadius = 0;
let _orbitHeight = 0;
let _orbitActive = false;

// Pre-settle orbit sweep (360° spin before camera moves to final position)
let _orbitSweep = null;

export function resetSlideElapsed() {
  slideElapsed = 0;
  settledTime  = 0;
  _orbitActive = false;
  _orbitAngle  = 0;
  _orbitSweep  = null;
}

/**
 * Spin the camera 360° around `target` at current radius/height,
 * then call `onDone` when the sweep completes.
 * @param {THREE.Vector3} target
 * @param {number} duration  ms for the full 360°
 * @param {Function} onDone  called once on completion
 */
export function startOrbitSweep(target, duration, onDone) {
  const dx = camera.position.x - target.x;
  const dz = camera.position.z - target.z;
  _orbitSweep = {
    target,
    radius:     Math.sqrt(dx * dx + dz * dz),
    height:     camera.position.y,
    duration,
    elapsed:    0,
    startAngle: Math.atan2(dx, dz),
    onDone,
  };
}

// ── Initialise from current camera state ─────────────────────────────────────
export function initCameraState() {
  camPosTarget.copy(camera.position);
  camPosStart.copy(camera.position);
  camLookTarget.copy(controls.target);
  camLookStart.copy(controls.target);
  currentCamLook.copy(controls.target);
}

// ── Move camera to a target ───────────────────────────────────────────────────
export function startCameraMove(toPos, toLook) {
  camPosStart.copy(camera.position);
  camLookStart.copy(currentCamLook);
  camPosTarget.copy(toPos);
  camLookTarget.copy(toLook);
  slideElapsed = 0;
}

// ── Glide back to the default home position ───────────────────────────────────
const _HOME_POS  = new THREE.Vector3(0, 1.8, 11.0);
const _HOME_LOOK = new THREE.Vector3(0, 0.6, 0);

/** @returns {number} computed glide duration in ms */
export function glideHome() {
  const dist     = camera.position.distanceTo(_HOME_POS);
  const duration = THREE.MathUtils.clamp(dist * 80, 900, 2200);
  startCameraMove(_HOME_POS, _HOME_LOOK);
  return duration;
}

/**
 * Drive the camera lerp every frame.
 *
 * @param {number}  delta
 * @param {number}  elapsed       — total scene time (for drift)
 * @param {object|null} activeSlide — current slide data (or null for glide)
 * @param {number}  slideIndex    — index of the active slide (for drift phase)
 * @param {number}  totalDur      — ms to complete the move
 * @param {boolean} frozen        — if true, suppress all camera writes
 * @returns {{ rawT: number, done: boolean }}
 */
export function tickCamera(delta, elapsed, activeSlide, slideIndex, totalDur, frozen) {
  // ── Pre-settle orbit sweep (skills 360° intro) ───────────────────────────
  if (_orbitSweep) {
    _orbitSweep.elapsed += delta * 1000;
    const t     = Math.min(_orbitSweep.elapsed / _orbitSweep.duration, 1.0);
    const eased = t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t; // ease in-out quad
    const angle = _orbitSweep.startAngle + eased * Math.PI * 2;
    if (!frozen) {
      camera.position.set(
        _orbitSweep.target.x + _orbitSweep.radius * Math.sin(angle),
        _orbitSweep.height,
        _orbitSweep.target.z + _orbitSweep.radius * Math.cos(angle)
      );
      camera.lookAt(_orbitSweep.target.x, _orbitSweep.target.y, _orbitSweep.target.z);
    }
    if (t >= 1.0) { const cb = _orbitSweep.onDone; _orbitSweep = null; cb?.(); }
    return { rawT: 0, done: false };
  }

  slideElapsed += delta * 1000;
  const rawT   = Math.min(slideElapsed / totalDur, 1.0);
  const easeFn = activeSlide ? (EASE[activeSlide.easing] ?? EASE.inOut) : EASE.out;
  const easedT = easeFn(rawT);

  if (!frozen) {
    camera.position.lerpVectors(camPosStart, camPosTarget, easedT);
    currentCamLook.lerpVectors(camLookStart, camLookTarget, easedT);

    if (activeSlide && rawT >= 1.0) {
      settledTime += delta;

      if (activeSlide.orbit) {
        // ── Orbital mode — camera circles the look target ─────────────────
        const speed = activeSlide.orbit.speed ?? 0.28;

        // Initialise orbit radius/height from the settled camera position
        if (!_orbitActive) {
          _orbitActive = true;
          const dx = camPosTarget.x - camLookTarget.x;
          const dz = camPosTarget.z - camLookTarget.z;
          _orbitRadius = Math.sqrt(dx * dx + dz * dz);
          _orbitHeight = camPosTarget.y;
          _orbitAngle  = Math.atan2(dz, dx);   // start exactly where lerp landed
        }

        _orbitAngle += delta * speed;

        camera.position.x = camLookTarget.x + Math.cos(_orbitAngle) * _orbitRadius;
        camera.position.z = camLookTarget.z + Math.sin(_orbitAngle) * _orbitRadius;
        camera.position.y = _orbitHeight;

      } else {
        // ── Normal drift ─────────────────────────────────────────────────
        const s = Math.min(settledTime / 0.8, 1.0);
        const d = activeSlide.drift;
        if (d) {
          camera.position.x = camPosTarget.x + Math.sin(elapsed * d.xf + slideIndex * 1.3) * d.x * s;
          camera.position.y = camPosTarget.y + Math.sin(elapsed * d.yf + slideIndex * 0.9) * d.y * s;
          if (d.z) camera.position.z = camPosTarget.z + Math.sin(elapsed * d.zf + slideIndex * 0.5) * d.z * s;
        }
      }
    }

    camera.lookAt(currentCamLook);
  }

  return { rawT, done: rawT >= 1.0 };
}

