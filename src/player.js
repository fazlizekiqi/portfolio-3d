import { controls } from './scene.js';

// ── Tuning ────────────────────────────────────────────────────────────────────
const MOVE_SPEED   = 2.2;   // units / second
const TURN_SPEED   = 2.8;   // radians / second (smooth yaw)
const ACCEL        = 8.0;   // how fast velocity ramps up
const DECEL        = 10.0;  // how fast velocity drops to zero

// ── State ─────────────────────────────────────────────────────────────────────
const keys = { w: false, a: false, s: false, d: false };

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k in keys) { keys[k] = true; e.preventDefault(); }
});
window.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = false;
});

// Smoothed velocity scalar (0 = still, 1 = full speed)
let velocityT = 0;

// The model's current facing angle (radians around Y)
let facingAngle = 0;

// Callbacks set by model.js once loaded
let onStartWalk  = null;
let onStopWalk   = null;

export function setWalkCallbacks(start, stop) {
  onStartWalk = start;
  onStopWalk  = stop;
}

// Reference to the pivot that player.js moves
let pivot = null;
export function setPlayerPivot(p) { pivot = p; }

// ─────────────────────────────────────────────────────────────────────────────
let wasMoving = false;

export function tickPlayer(delta) {
  if (!pivot) return;

  const forward = keys.w || keys.s;
  const turning = keys.a || keys.d;
  const moving  = forward || turning;

  // ── Smooth velocity scalar ────────────────────────────────────────────────
  if (moving) {
    velocityT = Math.min(1, velocityT + delta * ACCEL);
  } else {
    velocityT = Math.max(0, velocityT - delta * DECEL);
  }

  // ── Notify animation layer ────────────────────────────────────────────────
  if (velocityT > 0.05 && !wasMoving) { wasMoving = true;  if (onStartWalk) onStartWalk(); }
  if (velocityT < 0.05 &&  wasMoving) { wasMoving = false; if (onStopWalk)  onStopWalk();  }

  if (velocityT < 0.001) return;
  //
  // // ── Rotation (A / D) ──────────────────────────────────────────────────────
  //   if (keys.a) facingAngle += TURN_SPEED * delta * velocityT;
  //   if (keys.d) facingAngle -= TURN_SPEED * delta * velocityT;
  //
  // pivot.rotation.y = facingAngle;

  // ── Translation (W / S) ──────────────────────────────────────────────────
  if (forward) {
    const dir = keys.w ? 1 : -1;
    pivot.position.x -= Math.sin(facingAngle) * MOVE_SPEED * dir * delta * velocityT;
    pivot.position.z -= Math.cos(facingAngle) * MOVE_SPEED * dir * delta * velocityT;
  }

  // ── Chase the camera orbit target so OrbitControls stays centred ─────────
  controls.target.set(pivot.position.x, pivot.position.y + 0.6, pivot.position.z);
}

