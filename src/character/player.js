/**
 * player.js — Third-person WASD character controller
 *
 * Controls
 * ────────
 *   W / S              – move forward / backward
 *   A / D              – rotate character left / right (also strafes when combined with W)
 *   Shift + W          – run
 *   Shift + W + A/D    – strafe run
 *
 * Camera
 * ──────
 *   Trails behind the character at a fixed distance.
 *   Position lerps toward camDesired only while the player is moving.
 *   camera.lookAt(pivot) only fires while moving — frozen while idle.
 *
 *   camDesired.x = pivot.x − sin(facingAngle) * CAM_DISTANCE
 *   camDesired.z = pivot.z − cos(facingAngle) * CAM_DISTANCE
 *
 * Animation map
 * ─────────────
 *   idle                                      → 'idle'
 *   idle → walk start                         → 'idle-to-walk'  (one-shot → walking)
 *   W                                         → 'walking'
 *   W + Shift                                 → 'running'
 *   W + A                                     → 'walk-turn-left'
 *   W + D                                     → 'walk-turn-right'
 *   W + A + Shift                             → 'left strafe running'
 *   W + D + Shift                             → 'right strafe running'
 *   W + A  (no shift, low speed)              → 'left strafe walking'
 *   W + D  (no shift, low speed)              → 'right strafe walking'
 *   S                                         → 'backward walking'
 *   A only (no W/S)                           → 'left turn'
 *   D only (no W/S)                           → 'right turn'
 *   A only + Shift                            → 'left turn 90'
 *   D only + Shift                            → 'right turn 90'
 *   walk → stop                               → 'walking-to-idle' (one-shot → idle)
 *
 * Public API
 * ──────────
 *   playerTakeControl()    – freeze OrbitControls, inherit character facing.
 *   playerReleaseControl() – return to OrbitControls / presentation.
 *   tickPlayer(delta)      – call every frame from main.js after tickPresentation.
 *   isPlayerActive()       – boolean guard used by presentation.js.
 */

import * as THREE from 'three';
import { camera, controls } from '../scene.js';
import { modelGroup, mixer, clips, playClip } from './model.js';
import { getGroundY } from '../world/whiteworld.js';

// ── Tuning (exported so dat.gui can mutate them live) ─────────────────────────
export const playerParams = {
  walkSpeed:    2.8,
  runSpeed:     6.2,
  rotateSpeed:  2.2,
  camDistance:  5.5,
  camHeight:    2.2,
  camLerp:      6.0,
  camEntryTime: 0.6,   // seconds to smoothly glide into position on takeover
};

// Keep local aliases that the code below reads — they now read from the object
// via the tick, so the constants are gone; just reference playerParams directly.
const VT_WALK_IN    = 0.05;
const VT_RUN_IN     = 0.85;
const MOVE_EPSILON  = 0.12;   // raised: character must be meaningfully moving before translation starts
const TRANSITION_FADE = 0.18;
const EDGE_MARGIN   = 0.35;   // extra raycasts this far ahead to keep feet on island

// ── State ─────────────────────────────────────────────────────────────────────
let active      = false;
let facingAngle = 0;    // radians Y, seeded from modelGroup.rotation.y on takeover
let velocityT   = 0;    // −1..0..+1  (negative = backward, positive = forward)
let currentAnim = '';   // name of the clip currently playing
let inTransition = false; // true while a one-shot (idle-to-walk / walking-to-idle) plays
let transitionTimer = 0;  // counts down remaining one-shot time
let transitionNext  = ''; // clip to crossfade into once one-shot finishes
let entryTimer  = 0;      // counts down while camera glides into player position

// Working vectors — allocated once
const _camDesired = new THREE.Vector3();
const _pivotPos   = new THREE.Vector3();

// Live key map { 'KeyW': bool, … }
const keys = {};

// ── Key listeners ─────────────────────────────────────────────────────────────
function onKeyDown(e) {
  keys[e.code] = true;
  if (active && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }
}
function onKeyUp(e) { keys[e.code] = false; }
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
hint.textContent = 'W A S D  ·  ↑ ↓ ← →  TO  MOVE   ·   SHIFT  TO  RUN';
document.body.appendChild(hint);

function showHint() { hint.style.opacity = '1'; }
function hideHint() { hint.style.opacity = '0'; }

// ── Animation helpers ─────────────────────────────────────────────────────────

/** Play a clip immediately if it isn't already playing. */
function setAnim(name, fadeDuration = 0.20) {
  if (name === currentAnim) return;
  currentAnim  = name;
  inTransition = false;
  playClip(name, 1.0, fadeDuration);
}

/**
 * Play a one-shot transition clip, then crossfade into `nextClip`.
 * Uses the clip's actual duration from the mixer so we don't need to
 * hard-code lengths — we query THREE.AnimationClip directly.
 */
function playOneShot(name, nextClip) {
  if (currentAnim === name) return;           // already in this transition
  if (inTransition && transitionNext === nextClip) return; // already queued

  // Look up the clip's actual duration so the timer fires at the right moment
  let duration = 0.5; // safe fallback
  if (mixer) {
    const c = clips.find(cl => cl.name === name);
    if (c) duration = c.duration;
  }

  currentAnim     = name;
  inTransition    = true;
  transitionTimer = duration;
  transitionNext  = nextClip;
  playClip(name, 1.0, TRANSITION_FADE);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function playerTakeControl() {
  if (active) return;
  active       = true;
  velocityT    = 0;
  currentAnim  = '';
  inTransition = false;
  entryTimer   = playerParams.camEntryTime;   // start smooth glide

  controls.enabled = false;

  if (modelGroup) facingAngle = modelGroup.rotation.y;

  setAnim('idle', 0.3);
  showHint();
  // Do NOT snap — entryTimer drives a smooth lerp in _tickCamera
}

export function playerReleaseControl() {
  if (!active) return;
  active       = false;
  velocityT    = 0;
  inTransition = false;
  entryTimer   = 0;

  hideHint();

  if (modelGroup) {
    _getPivotPos(_pivotPos);
    controls.target.copy(_pivotPos);
  }
  controls.enabled = true;
  controls.update();
}

export function playerStop() {
  if (!active) return;
  active       = false;
  velocityT    = 0;
  inTransition = false;
  entryTimer   = 0;
  hideHint();
}

/** @returns {boolean} */
export function isPlayerActive() { return active; }

// ── Per-frame tick ────────────────────────────────────────────────────────────
export function tickPlayer(delta) {
  if (!active) return;

  const sprint    = keys['ShiftLeft'] || keys['ShiftRight'];
  const fwd       = keys['KeyW']      || keys['ArrowUp'];
  const back      = keys['KeyS']      || keys['ArrowDown'];
  const turnLeft  = keys['KeyA']      || keys['ArrowLeft'];
  const turnRight = keys['KeyD']      || keys['ArrowRight'];

  // ── Rotation ────────────────────────────────────────────────────────────
  if (turnLeft)  facingAngle += playerParams.rotateSpeed * delta;
  if (turnRight) facingAngle -= playerParams.rotateSpeed * delta;

  // ── Signed target velocity ───────────────────────────────────────────────
  //   +1 = full forward run  |  +0.45 = walk  |  0 = idle  |  −0.45 = backward
  let targetVT = 0;
  if (fwd)  targetVT =  sprint ? 1.0 : 0.45;
  if (back) targetVT = -0.45;  // no sprint backward

  const blend = (fwd || back) ? 8.0 : 12.0;
  velocityT  += (targetVT - velocityT) * Math.min(blend * delta, 1.0);
  if (Math.abs(velocityT) < 0.0001) velocityT = 0;

  const absVT   = Math.abs(velocityT);
  const isMovingFwd  = velocityT >  MOVE_EPSILON;
  const isMovingBack = velocityT < -MOVE_EPSILON;
  const isMoving     = absVT > MOVE_EPSILON;

  // ── Character translation ────────────────────────────────────────────────
  if (isMoving && modelGroup) {
    const speed = absVT > VT_RUN_IN
      ? THREE.MathUtils.lerp(playerParams.walkSpeed, playerParams.runSpeed, (absVT - VT_RUN_IN) / (1.0 - VT_RUN_IN))
      : playerParams.walkSpeed * Math.min(absVT / VT_WALK_IN, 1.0);

    const dir  = velocityT < 0 ? -1 : 1;
    const dist = speed * delta;

    const newX = modelGroup.position.x + Math.sin(facingAngle) * dir * dist;
    const newZ = modelGroup.position.z + Math.cos(facingAngle) * dir * dist;

    // Check both the new centre position AND a point EDGE_MARGIN ahead
    // so the character's feet never overhang the island edge.
    const groundY      = getGroundY(newX, newZ);
    const footX        = newX + Math.sin(facingAngle) * dir * EDGE_MARGIN;
    const footZ        = newZ + Math.cos(facingAngle) * dir * EDGE_MARGIN;
    const groundYFront = getGroundY(footX, footZ);

    if (groundY !== null && groundYFront !== null) {
      modelGroup.position.x = newX;
      modelGroup.position.z = newZ;
    }
  }

  // ── Ground snap — pin Y to terrain surface every frame ───────────────────
  if (modelGroup) {
    const groundY = getGroundY(modelGroup.position.x, modelGroup.position.z);
    if (groundY !== null) {
      // Lerp for smooth snapping on slopes; instant would also work
      modelGroup.position.y = THREE.MathUtils.lerp(modelGroup.position.y, groundY, Math.min(20 * delta, 1.0));
    }
    modelGroup.rotation.y = facingAngle;
  }

  // ── One-shot transition tick ─────────────────────────────────────────────
  if (inTransition) {
    transitionTimer -= delta;

    // If the player started moving again while walking-to-idle was playing,
    // break out immediately so movement always has a matching animation.
    if (isMoving && currentAnim === 'walking-to-idle') {
      inTransition = false;
      currentAnim  = '';   // force setAnim to re-evaluate below
    } else if (transitionTimer <= TRANSITION_FADE) {
      // Timer expired — crossfade into the follow-up clip
      inTransition = false;
      setAnim(transitionNext, TRANSITION_FADE);
      _tickCamera(isMoving, delta);
      return;
    } else {
      _tickCamera(isMoving, delta);
      return;
    }
  }

  // ── Animation state machine ──────────────────────────────────────────────
  const wasIdle    = currentAnim === 'idle';  // walking-to-idle intentionally excluded — prevents re-triggering idle-to-walk mid-stop
  const wasWalking = currentAnim === 'walking' || currentAnim === 'idle-to-walk'
                  || currentAnim === 'walk-turn-left' || currentAnim === 'walk-turn-right'
                  || currentAnim === 'left strafe walking' || currentAnim === 'right strafe walking';

  if (!isMoving && !turnLeft && !turnRight) {
    // ── Idle ──────────────────────────────────────────────────────────────
    if (wasWalking) {
      // Walk → stop: play one-shot then settle into idle
      playOneShot('walking-to-idle', 'idle');
    } else {
      setAnim('idle');
    }

  } else if (isMovingBack) {
    // ── Backward ──────────────────────────────────────────────────────────
    setAnim('backward walking');

  } else if (isMovingFwd) {
    // ── Forward movement ──────────────────────────────────────────────────
    if (wasIdle) {
      // Idle → walk: play one-shot then continue into walking / running
      const dest = sprint ? 'running' : (turnLeft ? 'walk-turn-left' : turnRight ? 'walk-turn-right' : 'walking');
      playOneShot('idle-to-walk', dest);
    } else if (absVT >= VT_RUN_IN) {
      // Running
      if (turnLeft)       setAnim('left strafe running');
      else if (turnRight) setAnim('right strafe running');
      else                setAnim('running');
    } else {
      // Walking
      if (turnLeft)       setAnim('left strafe walking');
      else if (turnRight) setAnim('right strafe walking');
      else                setAnim('walking');
    }

  } else {
    // ── Turning in place (no forward/backward key) ────────────────────────
    if (turnLeft)       setAnim(sprint ? 'left turn 90'  : 'left turn');
    else if (turnRight) setAnim(sprint ? 'right turn 90' : 'right turn');
    else                setAnim('idle');
  }

  _tickCamera(isMoving, delta);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _tickCamera(isMoving, delta) {
  _getPivotPos(_pivotPos);

  _camDesired.set(
    _pivotPos.x - Math.sin(facingAngle) * playerParams.camDistance,
    _pivotPos.y + playerParams.camHeight,
    _pivotPos.z - Math.cos(facingAngle) * playerParams.camDistance,
  );

  if (entryTimer > 0) {
    // Smooth entry glide — lerp regardless of movement until timer expires
    entryTimer -= delta;
    // Use a stronger lerp so it arrives well within the entry window
    const t = 1.0 - Math.exp(-playerParams.camLerp * 1.5 * delta);
    camera.position.lerp(_camDesired, t);
    camera.lookAt(_pivotPos);
  } else if (isMoving) {
    const t = 1.0 - Math.exp(-playerParams.camLerp * delta);
    camera.position.lerp(_camDesired, t);
    camera.lookAt(_pivotPos);
  }
  // Idle after entry — camera frozen
}

function _getPivotPos(out) {
  if (modelGroup) {
    out.copy(modelGroup.position);
    out.y += 1.0;
  } else {
    out.set(0, 1.0, 0);
  }
}

