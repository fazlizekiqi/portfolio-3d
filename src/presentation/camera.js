/**
 * camera.js — Presentation camera movement.
 *
 * Owns:
 *   startCameraMove(toPos, toLook)        – begin a linear lerp
 *   startOrbitSweep(target, ms, onDone)   – 360° sweep then call onDone
 *   glideHome()                           – return to home, returns duration ms
 *   tickCamera(delta, elapsed, slide, idx, totalMs, frozen) – per-frame driver
 *   resetCameraMove()                     – reset lerp clock (call on slide change)
 *   initCameraState()                     – seed state from current THREE camera
 *
 * Has no knowledge of slides content, UI, player, or worlds.
 */

import * as THREE from 'three';
import { camera, controls } from '../scene.js';

// ── Easing ────────────────────────────────────────────────────────────────────
export const EASE = {
  inOut:   t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3) / 2,
  in:      t => t * t * t,
  out:     t => 1 - Math.pow(1 - t, 3),
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3*Math.pow(t-1,3) + c1*Math.pow(t-1,2); },
  quad:    t => t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t,
};

// ── Lerp state ────────────────────────────────────────────────────────────────
const camPosStart   = new THREE.Vector3();
const camLookStart  = new THREE.Vector3();
export const camPosTarget  = new THREE.Vector3();
export const camLookTarget = new THREE.Vector3();
export const currentCamLook = new THREE.Vector3(0, 0.6, 0);

let slideElapsed = 0;
let settledTime  = 0;

// ── Orbit sweep state (used for the skills slide entry animation) ─────────────
let _orbitSweep = null;

export function resetCameraMove() {
  slideElapsed = 0;
  settledTime  = 0;
  _orbitSweep  = null;
}

// ── Initialise from the current camera state ──────────────────────────────────
export function initCameraState() {
  camPosTarget.copy(camera.position);
  camPosStart.copy(camera.position);
  camLookTarget.copy(controls.target);
  camLookStart.copy(controls.target);
  currentCamLook.copy(controls.target);
}

// ── Start a linear lerp to a new position ────────────────────────────────────
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

// ── Orbit sweep ───────────────────────────────────────────────────────────────
/**
 * Spin the camera around `target` for `duration` ms, then call `onDone`.
 *
 * @param {THREE.Vector3} target
 * @param {number}        duration   ms for the full sweep
 * @param {Function}      onDone     called once on completion
 * @param {object}        [opts]
 * @param {number}        [opts.turns=1]       full revolutions
 * @param {string}        [opts.easing='quad'] key into EASE
 * @param {number}        [opts.endRadius]     lerp radius start→end across sweep
 * @param {number}        [opts.endHeight]     lerp height start→end across sweep
 */
export function startOrbitSweep(target, duration, onDone, opts = {}) {
  const dx = camera.position.x - target.x;
  const dz = camera.position.z - target.z;
  const radius = Math.sqrt(dx * dx + dz * dz);
  _orbitSweep = {
    target,
    radius,
    height:     camera.position.y,
    endRadius:  opts.endRadius ?? radius,
    endHeight:  opts.endHeight ?? camera.position.y,
    turns:      opts.turns ?? 1,
    ease:       EASE[opts.easing] ?? EASE.quad,
    duration,
    elapsed:    0,
    startAngle: Math.atan2(dx, dz),
    onDone,
  };
}

// ── Per-frame camera driver ───────────────────────────────────────────────────
/**
 * @param {number}      delta
 * @param {number}      elapsed      total scene time (for drift phase offset)
 * @param {object|null} activeSlide  current slide data (or null during glide-home)
 * @param {number}      slideIndex   index of the active slide (for drift phase offset)
 * @param {number}      totalMs      duration of the current camera move in ms
 * @param {boolean}     frozen       when true, no camera writes
 * @returns {{ rawT: number, done: boolean }}
 */
export function tickCamera(delta, elapsed, activeSlide, slideIndex, totalMs, frozen) {
  // ── Orbit sweep takes full control until it completes ─────────────────────
  if (_orbitSweep) {
    const s     = _orbitSweep;
    s.elapsed  += delta * 1000;
    const t     = Math.min(s.elapsed / s.duration, 1.0);
    const eased = s.ease(t);
    const angle = s.startAngle + eased * Math.PI * 2 * s.turns;
    const rad   = s.radius + (s.endRadius - s.radius) * eased;
    const hgt   = s.height + (s.endHeight - s.height) * eased;
    if (!frozen) {
      camera.position.set(
        s.target.x + rad * Math.sin(angle),
        hgt,
        s.target.z + rad * Math.cos(angle),
      );
      camera.lookAt(s.target.x, s.target.y, s.target.z);
    }
    if (t >= 1.0) { const cb = s.onDone; _orbitSweep = null; cb?.(); }
    return { rawT: 0, done: false };
  }

  // ── Linear lerp toward target ─────────────────────────────────────────────
  slideElapsed += delta * 1000;
  const rawT   = Math.min(slideElapsed / totalMs, 1.0);
  const easeFn = activeSlide ? (EASE[activeSlide.cam.easing] ?? EASE.inOut) : EASE.out;
  const easedT = easeFn(rawT);

  if (!frozen) {
    camera.position.lerpVectors(camPosStart, camPosTarget, easedT);
    currentCamLook.lerpVectors(camLookStart, camLookTarget, easedT);

    // ── Drift — gentle breathing once the lerp settles ────────────────────
    if (activeSlide && rawT >= 1.0) {
      settledTime += delta;
      const s = Math.min(settledTime / 0.8, 1.0);   // fade drift in over 0.8 s
      const d = activeSlide.cam.drift;
      if (d) {
        camera.position.x = camPosTarget.x + Math.sin(elapsed * d.xf + slideIndex * 1.3) * d.x * s;
        camera.position.y = camPosTarget.y + Math.sin(elapsed * d.yf + slideIndex * 0.9) * d.y * s;
        if (d.z) camera.position.z = camPosTarget.z + Math.sin(elapsed * d.zf + slideIndex * 0.5) * d.z * s;
      }
    }

    camera.lookAt(currentCamLook);
  }

  return { rawT, done: rawT >= 1.0 };
}
