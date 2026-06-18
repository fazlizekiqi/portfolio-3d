import * as THREE from 'three';

// All sliders use world-space units (metres at character scale).
// Internally, positions are multiplied by _invScale to convert to bone-local space.
export const skeletonDebugParams = {
  showJoints: true,
  showLines:  true,
  jointSize:  0.035,                                // world radius of each joint sphere
  eyeL:  { on: true,  x: -0.08, y:  0.14, z:  0.09 },
  eyeR:  { on: true,  x:  0.08, y:  0.14, z:  0.09 },
  head:  { on: true,  x:  0.00, y:  0.23, z:  0.00, radius: 0.12 },
  chest: { on: true,  x:  0.00, y:  0.00, z:  0.09 },
  handL: { on: true,  x:  0.00, y:  0.00, z:  0.00 },
  handR: { on: true,  x:  0.00, y:  0.00, z:  0.00 },
  footL: { on: true,  x:  0.00, y:  0.00, z:  0.00 },
  footR: { on: true,  x:  0.00, y:  0.00, z:  0.00 },
};

// Head bone rotation override (degrees). Non-zero values layer on top of the
// animation clip's head rotation — applied in tickSkeletonDebug() after mixer.update().
export const headRotation = { x: 0, y: 0, z: 0 };

const DEG2RAD = Math.PI / 180;

// Bone-local units are typically much larger than world units because the GLB
// model is scaled down (2 / maxDimension) by modelGroup. We record the inverse
// so GUI params (world units) can be converted to bone-local positions.
let _invScale = 1;
let _helper   = null;
let _headRing = null;
let _headBone = null;
const _joints    = [];  // { mesh } — parented to their bone, scale updated by GUI
const _landmarks = [];  // { mesh, params } — parented to their bone, position from GUI

// Bone name search: try exact suffix first (mixamorigHead → 'head'), then substring.
function _find(sk, ...keys) {
  for (const k of keys) {
    const b = sk.bones.find(o => o.name.toLowerCase().endsWith(k));
    if (b) return b;
  }
  for (const k of keys) {
    const b = sk.bones.find(o => o.name.toLowerCase().includes(k));
    if (b) return b;
  }
  return sk.bones[0]; // fallback to root bone if no match
}

function _dot(color) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.02 * _invScale, 8, 8),
    new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false }),
  );
}

export function initSkeletonDebug(modelGroup, scene) {
  let skinned = null;
  modelGroup.traverse(o => { if (o.isSkinnedMesh && !skinned) skinned = o; });
  if (!skinned) { console.warn('[SkeletonDebug] no SkinnedMesh found in modelGroup'); return; }

  const sk = skinned.skeleton;
  console.log('[SkeletonDebug] bone names:', sk.bones.map(b => b.name));

  // Report morph targets so we know if facial expressions are possible.
  const morphKeys = skinned.morphTargetDictionary
    ? Object.keys(skinned.morphTargetDictionary)
    : [];
  const morphMsg = morphKeys.length
    ? 'Morph targets found:\n' + morphKeys.join('\n')
    : 'No morph targets on this mesh — facial expressions need blend shapes added in Blender.';
  setTimeout(() => alert(morphMsg), 2000);

  // The GLB is scaled to ~2 world units by modelGroup.scale.
  // A bone's local 1 unit ≈ 1 / modelGroup.scale.x world units.
  _invScale = 1 / Math.max(modelGroup.scale.x, 1e-4);

  // SkeletonHelper — draws lines between parent→child bones, lives in scene space.
  // Three.js updates its geometry automatically each render by reading bone.matrixWorld.
  _helper = new THREE.SkeletonHelper(skinned);
  _helper.material.depthTest  = false;
  _helper.material.depthWrite = false;
  _helper.renderOrder = 999;
  scene.add(_helper);

  // One yellow sphere per bone, PARENTED TO THE BONE — follows every animation
  // automatically via the scene graph. No tick positioning needed.
  const jGeo = new THREE.SphereGeometry(1, 6, 6); // unit sphere; scale set per-frame
  const jMat = new THREE.MeshBasicMaterial({ color: 0xffff00, depthTest: false, depthWrite: false });
  for (const bone of sk.bones) {
    const m = new THREE.Mesh(jGeo, jMat);
    m.scale.setScalar(skeletonDebugParams.jointSize * _invScale);
    m.renderOrder = 999;
    bone.add(m);                    // ← parented to bone
    _joints.push(m);
  }

  // Named landmark markers: each is parented to a specific bone.
  // The mesh's LOCAL position (in bone space) is the offset from the bone.
  const _addLandmark = (key, bone, mesh) => {
    const p = skeletonDebugParams[key];
    mesh.position.set(p.x * _invScale, p.y * _invScale, p.z * _invScale);
    mesh.renderOrder = 999;
    bone.add(mesh);                 // ← parented to bone
    _landmarks.push({ mesh, params: p });
  };

  const head  = _find(sk, 'head');
  _headBone   = head;
  const spine = _find(sk, 'spine2', 'spine1', 'spine', 'chest');
  _addLandmark('eyeL',  head,                               _dot(0x00ffff));
  _addLandmark('eyeR',  head,                               _dot(0x00ffff));
  _addLandmark('chest', spine,                              _dot(0xffaa00));
  _addLandmark('handL', _find(sk, 'lefthand'),              _dot(0xff6600));
  _addLandmark('handR', _find(sk, 'righthand'),             _dot(0xff6600));
  _addLandmark('footL', _find(sk, 'leftfoot', 'lefttoe'),   _dot(0x00ff44));
  _addLandmark('footR', _find(sk, 'rightfoot', 'righttoe'), _dot(0x00ff44));

  // Head ring: parented to head bone; rotation.x makes it lie in the XZ plane
  _headRing = new THREE.Mesh(
    new THREE.TorusGeometry(skeletonDebugParams.head.radius * _invScale, 0.005 * _invScale, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xff44ff, depthTest: false, depthWrite: false }),
  );
  _headRing.rotation.x = Math.PI / 2;
  _addLandmark('head', head, _headRing);

  applyParams();
}

// Called every frame after mixer.update(delta). Applies GUI head rotation on top
// of the animation clip — non-zero values override that axis of the head animation.
export function tickSkeletonDebug() {
  if (_headBone) {
    _headBone.rotation.x = headRotation.x * DEG2RAD;
    _headBone.rotation.y = headRotation.y * DEG2RAD;
    _headBone.rotation.z = headRotation.z * DEG2RAD;
  }
}

// Called by every dat.GUI onChange to push visibility + offset changes live.
export function applyParams() {
  if (!_invScale) return;
  if (_helper) _helper.visible = skeletonDebugParams.showLines;

  for (const m of _joints) {
    m.visible = skeletonDebugParams.showJoints;
    m.scale.setScalar(skeletonDebugParams.jointSize * _invScale);
  }

  for (const lm of _landmarks) {
    lm.mesh.visible = lm.params.on;
    lm.mesh.position.set(
      lm.params.x * _invScale,
      lm.params.y * _invScale,
      lm.params.z * _invScale,
    );
  }

  if (_headRing) {
    _headRing.geometry.dispose();
    _headRing.geometry = new THREE.TorusGeometry(
      skeletonDebugParams.head.radius * _invScale, 0.005 * _invScale, 8, 24,
    );
  }
}

export function hideDebugOverlay() {
  skeletonDebugParams.showJoints = false;
  skeletonDebugParams.showLines  = false;
  for (const v of Object.values(skeletonDebugParams)) {
    if (v && typeof v === 'object' && 'on' in v) v.on = false;
  }
  applyParams();
}
