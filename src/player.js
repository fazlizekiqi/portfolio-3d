/**
 * player.js — Third-person WASD character controller
 *
 * Controls
 * ────────
 *   W / S          – move forward / backward
 *   A / D          – rotate character left / right
 *   Shift + W      – run
 *
 * Camera
 * ──────
 *   Trails behind the character at a fixed distance.
 *   Position lerps toward camDesired only while the player is moving
 *   (velocityT > MOVE_EPSILON).  camera.lookAt(pivot) likewise only
 *   fires while moving — camera is frozen while idle so it doesn't
 *   drift or snap.
 *
 *   camDesired.x = pivot.x − sin(facingAngle) * CAM_DISTANCE
 *   camDesired.z = pivot.z − cos(facingAngle) * CAM_DISTANCE
 *
 * Animations
 * ──────────
 *   velocityT drives crossfade: idle → walk (velocityT > 0) → run (Shift held)
 *   facingAngle is seeded from pivot.rotation.y on takeover — never from
 *   camera geometry.
 *
 * Public API
 * ──────────
 *   playerTakeControl()    – freeze OrbitControls, inherit character facing.
 *   playerReleaseControl() – return to OrbitControls / presentation.
 *   tickPlayer(delta)      – call every frame from main.js after tickPresentation.
 *   isPlayerActive()       – boolean guard used by presentation.js.
 */

import * as THREE from 'three';
import { camera, controls } from './scene.js';
import { modelGroup, playClip } from './model.js';

// ── Tuning ────────────────────────────────────────────────────────────────────
const WALK_SPEED      = 2.8;   // units / second
const RUN_SPEED       = 6.2;   // units / second  (Shift held)
const ROTATE_SPEED    = 2.2;   // radians / second  (A / D)

const CAM_DISTANCE    = 5.5;   // how far behind the character
const CAM_HEIGHT      = 2.2;   // camera Y above pivot
const CAM_LERP_MOVE   = 6.0;   // camera position lerp speed while moving  (per-second factor)

const MOVE_EPSILON    = 0.001; // velocityT threshold below which camera freezes

// Crossfade thresholds
const VT_WALK_IN      = 0.05;  // velocityT at which idle→walk fade starts
const VT_RUN_IN       = 0.85;  // velocityT at which walk→run fade starts

// ── State ─────────────────────────────────────────────────────────────────────
let active      = false;
let facingAngle = 0;       // radians, Y-axis, seeded from pivot.rotation.y
let velocityT   = 0;       // 0 = idle, 1 = full run  (smoothed input magnitude)
let currentAnim = 'idle';  // 'idle' | 'walk' | 'run'

// Working vectors — allocated once
const _camDesired = new THREE.Vector3();
const _pivotPos   = new THREE.Vector3();

// Live key map
const keys = {};

// ── Key listeners (always registered, guarded by active) ─────────────────────
function onKeyDown(e) { keys[e.code] = true; }
function onKeyUp(e)   { keys[e.code] = false; }
document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup',   onKeyUp);

// ── DOM — hint label ──────────────────────────────────────────────────────────
const hint = document.createElement('div');
hint.style.cssText = `
  position:fixed;bottom:28px;left:50%;transform:translateX(-50%);
  z-index:30;color:#2299bb;font-size:10px;letter-spacing:.20em;
  font-family:'Share Tech Mono','Courier New',monospace;
  background:rgba(2,8,18,0.82);border:1px solid rgba(0,150,200,0.28);
  padding:7px 20px;border-radius:3px;backdrop-filter:blur(10px);
  opacity:0;transition:opacity 0.5s ease;pointer-events:none;`;
hint.textContent = 'W A S D  TO  MOVE   ·   SHIFT  TO  RUN';
document.body.appendChild(hint);

function showHint() { hint.style.opacity = '1'; }
function hideHint() { hint.style.opacity = '0'; }

// ── Animation crossfade helper ────────────────────────────────────────────────
function setAnim(name) {
  if (name === currentAnim) return;
  currentAnim = name;
  playClip(name, 1.0, 0.25);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Hand camera control to the player.
 * facingAngle is seeded from the model's current Y rotation so the character
 * always continues in the direction it was facing — never from camera geometry.
 */
export function playerTakeControl() {
  if (active) return;
  active    = true;
  velocityT = 0;

  // Disable OrbitControls — we own the camera from here
  controls.enabled = false;

  // Seed facing from the character's actual world Y rotation
  if (modelGroup) {
    facingAngle = modelGroup.rotation.y;
  }

  // Start at idle
  setAnim('idle');
  showHint();

  // Position camera immediately behind the character (no lerp snap on entry)
  _snapCameraToDesired();
}

/**
 * Return control to OrbitControls / presentation.
 * Camera is left exactly where the player stopped.
 */
export function playerReleaseControl() {
  if (!active) return;
  active    = false;
  velocityT = 0;

  hideHint();

  // Sync OrbitControls target to the character so orbit resumes smoothly
  if (modelGroup) {
    _getPivotPos(_pivotPos);
    controls.target.copy(_pivotPos);
  }
  controls.enabled = true;
  controls.update();
}

/** @returns {boolean} */
export function isPlayerActive() { return active; }

// ── Per-frame tick ────────────────────────────────────────────────────────────

/**
 * Called every frame from main.js, AFTER tickPresentation().
 * @param {number} delta  seconds since last frame
 */
export function tickPlayer(delta) {
  if (!active) return;

  const isSprinting = keys['ShiftLeft'] || keys['ShiftRight'];
  const movingFwd   = keys['KeyW'];
  const movingBack  = keys['KeyS'];
  const rotLeft     = keys['KeyA'];
  const rotRight    = keys['KeyD'];
  const anyMove     = movingFwd || movingBack;

  // ── Rotation ──────────────────────────────────────────────────────────────
  if (rotLeft)  facingAngle += ROTATE_SPEED * delta;
  if (rotRight) facingAngle -= ROTATE_SPEED * delta;

  // ── Target velocity scalar ────────────────────────────────────────────────
  //  0 = idle   |   ~0.5 = walk   |   1 = run
  let targetVT = 0;
  if (anyMove) targetVT = isSprinting ? 1.0 : 0.45;

  // Smooth velocity toward target
  const blend = anyMove ? 8.0 : 10.0; // faster stop than start
  velocityT += (targetVT - velocityT) * Math.min(blend * delta, 1.0);
  if (velocityT < 0.0001) velocityT = 0;

  // ── Character movement ────────────────────────────────────────────────────
  if (velocityT > MOVE_EPSILON) {
    const speed = velocityT > VT_RUN_IN
      ? THREE.MathUtils.lerp(WALK_SPEED, RUN_SPEED, (velocityT - VT_RUN_IN) / (1.0 - VT_RUN_IN))
      : WALK_SPEED * (velocityT / VT_WALK_IN < 1 ? velocityT / VT_WALK_IN : 1.0);

    const dir   = movingBack ? -1 : 1;   // W = forward (+), S = backward (−)
    const dist  = speed * delta;

    if (modelGroup) {
      modelGroup.position.x += Math.sin(facingAngle) * dir * dist;
      modelGroup.position.z += Math.cos(facingAngle) * dir * dist;
      modelGroup.rotation.y  = facingAngle;
    }
  } else if (modelGroup) {
    // Keep rotation in sync even while still, for A/D-only rotation
    modelGroup.rotation.y = facingAngle;
  }

  // ── Animation state machine ───────────────────────────────────────────────
  if (velocityT < VT_WALK_IN) {
    setAnim('idle');
  } else if (velocityT < VT_RUN_IN) {
    setAnim('walking');
  } else {
    setAnim('running');
  }

  // ── Third-person camera ───────────────────────────────────────────────────
  _getPivotPos(_pivotPos);

  _camDesired.set(
    _pivotPos.x - Math.sin(facingAngle) * CAM_DISTANCE,
    _pivotPos.y + CAM_HEIGHT,
    _pivotPos.z - Math.cos(facingAngle) * CAM_DISTANCE,
  );

  if (velocityT > MOVE_EPSILON) {
    // Moving — lerp camera position and update lookAt
    const t = 1.0 - Math.exp(-CAM_LERP_MOVE * delta);
    camera.position.lerp(_camDesired, t);
    camera.lookAt(_pivotPos);
  }
  // Idle — camera frozen (no position write, no lookAt call)
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Get the world-space pivot point (hip height of character). */
function _getPivotPos(out) {
  if (modelGroup) {
    out.copy(modelGroup.position);
    out.y += 1.0; // approximate hip/chest height
  } else {
    out.set(0, 1.0, 0);
  }
}

/** Hard-place the camera at camDesired without lerp — used on takeover. */
function _snapCameraToDesired() {
  _getPivotPos(_pivotPos);
  camera.position.set(
    _pivotPos.x - Math.sin(facingAngle) * CAM_DISTANCE,
    _pivotPos.y + CAM_HEIGHT,
    _pivotPos.z - Math.cos(facingAngle) * CAM_DISTANCE,
  );
  camera.lookAt(_pivotPos);
}
