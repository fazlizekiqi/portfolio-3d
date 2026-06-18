import * as THREE from 'three';

// Offsets are in the bone's local orientation:
//   x = left/right relative to that bone's facing
//   y = up along the bone's axis
//   z = forward relative to that bone (towards camera for the head)
export const skeletonDebugParams = {
  showJoints: true,          // white sphere at every bone
  showLines:  true,          // SkeletonHelper lines
  jointSize:  0.022,
  eyeL:  { on: true,  x: -0.05, y:  0.04, z:  0.09 },
  eyeR:  { on: true,  x:  0.05, y:  0.04, z:  0.09 },
  head:  { on: true,  x:  0.00, y:  0.06, z:  0.00, radius: 0.12 },
  chest: { on: true,  x:  0.00, y:  0.00, z:  0.09 },
  handL: { on: true,  x:  0.00, y:  0.00, z:  0.00 },
  handR: { on: true,  x:  0.00, y:  0.00, z:  0.00 },
  footL: { on: true,  x:  0.00, y:  0.00, z:  0.00 },
  footR: { on: true,  x:  0.00, y:  0.00, z:  0.00 },
};

// Reused scratch objects to avoid per-frame allocations
const _wp  = new THREE.Vector3();
const _wq  = new THREE.Quaternion();
const _off = new THREE.Vector3();

let _skinned  = null;
let _helper   = null;
let _headRing = null;
const _joints    = [];   // THREE.Mesh, one per bone
const _landmarks = [];   // { mesh, bone, params, oriented }

// Fuzzy bone search: tries exact suffix match first, then substring.
function _find(sk, ...keys) {
  for (const k of keys) {
    const b = sk.bones.find(o => o.name.toLowerCase().endsWith(k));
    if (b) return b;
  }
  for (const k of keys) {
    const b = sk.bones.find(o => o.name.toLowerCase().includes(k));
    if (b) return b;
  }
  return sk.bones[0]; // fallback to root if bone not found
}

function _dot(color) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 8, 8),
    new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false }),
  );
}

export function initSkeletonDebug(modelGroup, scene) {
  modelGroup.traverse(o => { if (o.isSkinnedMesh && !_skinned) _skinned = o; });
  if (!_skinned) return;

  const sk = _skinned.skeleton;
  console.log('[SkeletonDebug] bone names:', sk.bones.map(b => b.name));

  // Bright skeleton lines — SkeletonHelper auto-reads bone matrixWorld each frame
  _helper = new THREE.SkeletonHelper(_skinned);
  _helper.material.depthTest  = false;
  _helper.material.depthWrite = false;
  _helper.renderOrder = 999;
  scene.add(_helper);

  // White joint sphere at every bone (unit sphere, scaled per frame via jointSize)
  const jGeo = new THREE.SphereGeometry(1, 6, 6);
  const jMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false });
  for (let i = 0; i < sk.bones.length; i++) {
    const m = new THREE.Mesh(jGeo, jMat);
    m.renderOrder = 999;
    scene.add(m);
    _joints.push(m);
  }

  // Named landmark markers. Each tracks a specific bone and applies a
  // dat.GUI-controlled offset. oriented=true: offset is rotated by the bone's
  // world quaternion so "z = forward" always means "in front of that bone",
  // regardless of how the limb is posed. The head ring uses oriented=false
  // so it stays horizontal (flat ring around the head, not tilted by head nod).
  const register = (key, bone, mesh, oriented = true) => {
    mesh.renderOrder = 999;
    scene.add(mesh);
    _landmarks.push({ mesh, bone: bone ?? sk.bones[0], params: skeletonDebugParams[key], oriented });
  };

  const head  = _find(sk, 'head');
  const spine = _find(sk, 'spine2', 'spine1', 'spine', 'chest');
  register('eyeL',  head,                                _dot(0x00ffff));
  register('eyeR',  head,                                _dot(0x00ffff));
  register('chest', spine,                               _dot(0xffff00));
  register('handL', _find(sk, 'lefthand'),               _dot(0xff8800));
  register('handR', _find(sk, 'righthand'),              _dot(0xff8800));
  register('footL', _find(sk, 'leftfoot', 'lefttoe'),    _dot(0x00ff00));
  register('footR', _find(sk, 'rightfoot', 'righttoe'),  _dot(0x00ff00));

  // Head ring sits at head bone position + Y offset, stays horizontal
  _headRing = new THREE.Mesh(
    new THREE.TorusGeometry(skeletonDebugParams.head.radius, 0.004, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xff44ff, depthTest: false, depthWrite: false }),
  );
  _headRing.rotation.x = Math.PI / 2; // flat ring in XZ plane
  register('head', head, _headRing, false);

  applyParams();
}

// Call every frame AFTER mixer.update(delta) so bone matrices are current.
export function tickSkeletonDebug() {
  if (!_skinned) return;

  const s  = skeletonDebugParams.jointSize;
  const sk = _skinned.skeleton;
  for (let i = 0; i < _joints.length; i++) {
    if (!_joints[i].visible) continue;
    sk.bones[i].getWorldPosition(_wp);
    _joints[i].position.copy(_wp);
    _joints[i].scale.setScalar(s);
  }

  for (const lm of _landmarks) {
    if (!lm.mesh.visible) continue;
    lm.bone.getWorldPosition(_wp);
    lm.bone.getWorldQuaternion(_wq);
    _off.set(lm.params.x, lm.params.y, lm.params.z);
    if (lm.oriented) _off.applyQuaternion(_wq);
    lm.mesh.position.copy(_wp).add(_off);
  }
}

// Called by every dat.GUI onChange — apply visibility toggles and head-ring radius.
export function applyParams() {
  if (_helper) _helper.visible = skeletonDebugParams.showLines;
  for (const j of _joints) j.visible = skeletonDebugParams.showJoints;
  for (const lm of _landmarks) lm.mesh.visible = lm.params.on;
  if (_headRing) {
    _headRing.geometry.dispose();
    _headRing.geometry = new THREE.TorusGeometry(skeletonDebugParams.head.radius, 0.004, 8, 24);
  }
}

export function hideDebugOverlay() {
  skeletonDebugParams.showJoints = false;
  skeletonDebugParams.showLines  = false;
  for (const val of Object.values(skeletonDebugParams)) {
    if (val && typeof val === 'object' && 'on' in val) val.on = false;
  }
  applyParams();
}
