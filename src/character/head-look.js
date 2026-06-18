import * as THREE from 'three';

const MAX_YAW    = 35;   // degrees left/right — comfortable human head turn
const MAX_PITCH  = 38;   // degrees up/down
const LERP_SPEED = 4;    // higher = snappier

const DEG2RAD = Math.PI / 180;

let _headBone     = null;
let _enabled      = false;
let _lerpingOut   = false;
let _currentYaw   = 0;
let _currentPitch = 0;

const _mouse = { x: 0, y: 0, inside: false };

window.addEventListener('mousemove', (e) => {
  _mouse.x      = (e.clientX / window.innerWidth)  * 2 - 1;
  _mouse.y      = (e.clientY / window.innerHeight) * 2 - 1;
  _mouse.inside = true;
}, { passive: true });

document.addEventListener('mouseleave', () => { _mouse.inside = false; }, { passive: true });
document.addEventListener('mouseenter', () => { _mouse.inside = true;  }, { passive: true });

export function initHeadLook(modelGroup) {
  modelGroup.traverse(o => {
    if (!o.isSkinnedMesh || _headBone) return;
    const sk  = o.skeleton;
    _headBone = sk.bones.find(b => b.name.toLowerCase().endsWith('head'))
             || sk.bones.find(b => b.name.toLowerCase().includes('head'));
  });
}

export function enableHeadLook() {
  _enabled    = true;
  _lerpingOut = false;
}

export function disableHeadLook() {
  _enabled    = false;
  _lerpingOut = true;  // smooth lerp back to zero before fully handing control back
}

export function tickHeadLook(delta) {
  if (!_headBone || (!_enabled && !_lerpingOut)) return;

  const targetYaw   = (_enabled && _mouse.inside) ? _mouse.x * MAX_YAW   : 0;
  const targetPitch = (_enabled && _mouse.inside) ? _mouse.y * MAX_PITCH : 0;

  const t = Math.min(1, LERP_SPEED * delta);
  _currentYaw   += (targetYaw   - _currentYaw)   * t;
  _currentPitch += (targetPitch - _currentPitch) * t;

  if (_lerpingOut && Math.abs(_currentYaw) < 0.05 && Math.abs(_currentPitch) < 0.05) {
    _currentYaw   = 0;
    _currentPitch = 0;
    _lerpingOut   = false;
    return;
  }

  _headBone.rotation.y = _currentYaw   * DEG2RAD;
  _headBone.rotation.x = _currentPitch * DEG2RAD;
}
