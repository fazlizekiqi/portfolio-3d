import * as THREE from 'three';

// Positions are in modelGroup local space: 0,0,0 = feet, Y grows upward.
// Character is ~2 units tall, so eyes are around Y=1.65, head top ~Y=1.85.
export const skeletonDebugParams = {
  showSkeleton: true,
  showEyes:     true,
  showHeadRing: true,
  eyeL:  { x: -0.055, y: 1.65, z: 0.08 },
  eyeR:  { x:  0.055, y: 1.65, z: 0.08 },
  head:  { x: 0.0,    y: 1.70, z: 0.0,  radius: 0.12 },
};

let _helper = null, _eyeL = null, _eyeR = null, _headRing = null;

export function initSkeletonDebug(modelGroup, scene) {
  let skinnedMesh = null;
  modelGroup.traverse(o => { if (o.isSkinnedMesh && !skinnedMesh) skinnedMesh = o; });
  if (!skinnedMesh) return;

  // Log all bone names so we can reference them in future code
  console.log('[SkeletonDebug] bone names:', skinnedMesh.skeleton.bones.map(b => b.name));

  // SkeletonHelper — auto-draws lines between every bone in the skeleton.
  // depthTest:false so it's always visible on top of the character mesh.
  _helper = new THREE.SkeletonHelper(skinnedMesh);
  _helper.material.depthTest  = false;
  _helper.material.depthWrite = false;
  _helper.renderOrder = 999;
  scene.add(_helper);

  // Eye dots — cyan spheres parented to modelGroup so they follow the character.
  const dotGeo = new THREE.SphereGeometry(0.018, 8, 8);
  _eyeL = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0x00ffff, depthTest: false, depthWrite: false }));
  _eyeR = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0x00ffff, depthTest: false, depthWrite: false }));
  _eyeL.renderOrder = 999;
  _eyeR.renderOrder = 999;
  modelGroup.add(_eyeL, _eyeR);

  // Head ring — magenta torus lying flat (XZ plane) parented to modelGroup.
  _headRing = new THREE.Mesh(
    new THREE.TorusGeometry(skeletonDebugParams.head.radius, 0.004, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xff44ff, depthTest: false, depthWrite: false }),
  );
  _headRing.rotation.x = Math.PI / 2;
  _headRing.renderOrder = 999;
  modelGroup.add(_headRing);

  applyParams();
}

// Called by every dat.GUI onChange so positions update immediately.
export function applyParams() {
  if (_helper) _helper.visible = skeletonDebugParams.showSkeleton;

  if (_eyeL) {
    _eyeL.visible = skeletonDebugParams.showEyes;
    const { x, y, z } = skeletonDebugParams.eyeL;
    _eyeL.position.set(x, y, z);
  }
  if (_eyeR) {
    _eyeR.visible = skeletonDebugParams.showEyes;
    const { x, y, z } = skeletonDebugParams.eyeR;
    _eyeR.position.set(x, y, z);
  }
  if (_headRing) {
    _headRing.visible = skeletonDebugParams.showHeadRing;
    const { x, y, z, radius } = skeletonDebugParams.head;
    _headRing.position.set(x, y, z);
    // Rebuild torus only when radius changes (cheap for 8×32 segments)
    _headRing.geometry.dispose();
    _headRing.geometry = new THREE.TorusGeometry(radius, 0.004, 8, 32);
  }
}

export function hideDebugOverlay() {
  skeletonDebugParams.showSkeleton = false;
  skeletonDebugParams.showEyes     = false;
  skeletonDebugParams.showHeadRing = false;
  applyParams();
}
