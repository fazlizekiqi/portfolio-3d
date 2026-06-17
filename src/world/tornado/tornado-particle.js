import * as THREE from 'three';
import VERT_PARS     from '../../shaders/tornado.vert.pars.glsl?raw';
import VERT_POSITION from '../../shaders/tornado.vert.position.glsl?raw';
import FRAG_PARS     from '../../shaders/tornado.frag.pars.glsl?raw';
import FRAG_ALPHA    from '../../shaders/tornado.frag.alpha.glsl?raw';
import CARTOON_EFFECT from '../../shaders/cartoon.frag.glsl?raw';

export const tornadoParams = {
  flyMin:         0.22,
  flyRand:        0.38,
  collapseAmt:    0.25,
  staggerSpread:  0.7,
  staggerWindow:  0.5,
  tornadoRadius:  0.85,
  tornadoHeight:  1.25,
  rotTurns:       2.5,
  rotRandTurns:   3.0,
  fadeStart:      0.88,
  fadeEnd:        1.0,
  travelSpeed:    0.10,
  reassembleSpeed: 0.25,
};

// Reusable scratch vectors for local-space conversion
const _invModelMat = new THREE.Matrix4();
const _originLocal = new THREE.Vector3();
const _destLocal   = new THREE.Vector3();

// ── Shader injection ──────────────────────────────────────────────────────────

function _createUniforms() {
  return {
    uCloudProgress:    { value: 0.0 },
    uTravelProgress:   { value: 0.0 },
    uStaggerSpread:    { value: tornadoParams.staggerSpread },
    uStaggerWindow:    { value: tornadoParams.staggerWindow },
    uFlyMin:           { value: tornadoParams.flyMin },
    uFlyRand:          { value: tornadoParams.flyRand },
    uCollapseAmt:      { value: tornadoParams.collapseAmt },
    uOriginLocal:      { value: new THREE.Vector3() },
    uDestinationLocal: { value: new THREE.Vector3() },
    uTornadoRadius:    { value: tornadoParams.tornadoRadius },
    uTornadoHeight:    { value: tornadoParams.tornadoHeight },
    uRotTurns:         { value: tornadoParams.rotTurns },
    uRotRandTurns:     { value: tornadoParams.rotRandTurns },
    uFadeStart:        { value: tornadoParams.fadeStart },
    uFadeEnd:          { value: tornadoParams.fadeEnd },
    uCartoon:          { value: 0.0 },
  };
}

function _injectShader(shader, uniforms, prevOBC, mat) {
  Object.assign(shader.uniforms, uniforms);

  shader.vertexShader = shader.vertexShader
    .replace('#include <common>',       '#include <common>\n'   + VERT_PARS)
    .replace('#include <begin_vertex>', VERT_POSITION);

  const FRAG_PARS_WITH_CARTOON  = FRAG_PARS + '\nuniform float uCartoon;';
  const FRAG_ALPHA_WITH_CARTOON = FRAG_ALPHA + '\n' + CARTOON_EFFECT;

  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n' + FRAG_PARS_WITH_CARTOON)
    .replace('#include <dithering_fragment>',
             '#include <dithering_fragment>\n' + FRAG_ALPHA_WITH_CARTOON);

  if (prevOBC) prevOBC(shader);
  shader.uniforms.uCartoon = uniforms.uCartoon;
  mat.userData.shader = shader;
}

export function buildTornadoMaterial(srcMat) {
  const mat = srcMat.clone();
  mat.transparent = true;
  mat.side        = THREE.DoubleSide;

  const uniforms  = _createUniforms();
  mat.userData.tornadoUniforms = uniforms;

  const prevOBC = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader) => _injectShader(shader, uniforms, prevOBC, mat);
  mat.needsUpdate = true;
  return mat;
}

// ── Geometry baking ───────────────────────────────────────────────────────────

function _ensureSkeletonUpToDate(skinnedMesh) {
  skinnedMesh.updateWorldMatrix(true, false);
  skinnedMesh.skeleton.update();
}

function _toNonIndexed(geometry) {
  return geometry.index ? geometry.toNonIndexed() : geometry.clone();
}

function _computeBoneMatrices(skinnedMesh) {
  const meshInv = new THREE.Matrix4().copy(skinnedMesh.matrixWorld).invert();
  return skinnedMesh.skeleton.bones.map((bone, i) => {
    const m = new THREE.Matrix4();
    m.multiplyMatrices(bone.matrixWorld, skinnedMesh.skeleton.boneInverses[i]);
    m.premultiply(meshInv);
    return m;
  });
}

function _bakeVertexPositions(posAttr, skinIndex, skinWeight, boneMatrices) {
  const bakedPos = new Float32Array(posAttr.count * 3);
  const vertex   = new THREE.Vector3();
  const _tmp     = new THREE.Vector3();
  const _accum   = new THREE.Vector3();

  for (let i = 0; i < posAttr.count; i++) {
    vertex.fromBufferAttribute(posAttr, i);
    _accum.set(0, 0, 0);
    for (let j = 0; j < 4; j++) {
      const boneIdx = skinIndex.getComponent(i, j);
      const weight  = skinWeight.getComponent(i, j);
      if (weight === 0) continue;
      _tmp.copy(vertex).applyMatrix4(boneMatrices[boneIdx]).multiplyScalar(weight);
      _accum.add(_tmp);
    }
    bakedPos[i * 3]     = _accum.x;
    bakedPos[i * 3 + 1] = _accum.y;
    bakedPos[i * 3 + 2] = _accum.z;
  }
  return bakedPos;
}

function _bakeSkinnedPose(skinnedMesh) {
  _ensureSkeletonUpToDate(skinnedMesh);
  const base       = _toNonIndexed(skinnedMesh.geometry);
  const skinIndex  = base.attributes.skinIndex;
  const skinWeight = base.attributes.skinWeight;
  if (!skinIndex || !skinWeight) return base;
  const boneMatrices = _computeBoneMatrices(skinnedMesh);
  const bakedPos     = _bakeVertexPositions(base.attributes.position, skinIndex, skinWeight, boneMatrices);
  base.setAttribute('position', new THREE.BufferAttribute(bakedPos, 3));
  base.deleteAttribute('skinIndex');
  base.deleteAttribute('skinWeight');
  return base;
}

function _addPerTriangleAttributes(geometry) {
  const pos    = geometry.attributes.position;
  const count  = pos.count;
  const center = new Float32Array(count * 3);
  const rand   = new Float32Array(count);

  for (let i = 0; i < count; i += 3) {
    const mx = (pos.getX(i) + pos.getX(i+1) + pos.getX(i+2)) / 3;
    const my = (pos.getY(i) + pos.getY(i+1) + pos.getY(i+2)) / 3;
    const mz = (pos.getZ(i) + pos.getZ(i+1) + pos.getZ(i+2)) / 3;
    const r  = Math.random();
    for (let v = 0; v < 3; v++) {
      center[(i+v)*3]   = mx;
      center[(i+v)*3+1] = my;
      center[(i+v)*3+2] = mz;
      rand[i+v]         = r;
    }
  }

  geometry.setAttribute('aCenter', new THREE.BufferAttribute(center, 3));
  geometry.setAttribute('aRand',   new THREE.BufferAttribute(rand,   1));
}

export function buildTornadoGeo(srcMesh) {
  const base = srcMesh.isSkinnedMesh
    ? _bakeSkinnedPose(srcMesh)
    : (srcMesh.geometry.index ? srcMesh.geometry.toNonIndexed() : srcMesh.geometry.clone());
  base.computeVertexNormals();
  _addPerTriangleAttributes(base);
  return base;
}

// ── Uniform sync (called every frame from lifecycle) ──────────────────────────

export function syncProgressToMaterials(tornadoMats, cloudProgress, travelProgress) {
  tornadoMats.forEach(mat => {
    const u = mat.userData.shader?.uniforms ?? mat.userData.tornadoUniforms;
    if (!u) return;
    u.uCloudProgress.value  = cloudProgress;
    u.uTravelProgress.value = travelProgress;
    u.uTornadoRadius.value  = tornadoParams.tornadoRadius;
    u.uTornadoHeight.value  = tornadoParams.tornadoHeight;
  });
}

export function syncLocalPositionsToMaterials(group, tornadoMeshes, tornadoMats, destination) {
  if (!group || !tornadoMeshes.length) return;
  group.updateMatrixWorld(true);
  const worldOrigin = group.position;

  tornadoMeshes.forEach((mesh, i) => {
    const mat = tornadoMats[i];
    if (!mat) return;
    const u = mat.userData.shader?.uniforms ?? mat.userData.tornadoUniforms;
    if (!u) return;
    _invModelMat.copy(mesh.matrixWorld).invert();
    _originLocal.copy(worldOrigin).applyMatrix4(_invModelMat);
    _destLocal.copy(destination).applyMatrix4(_invModelMat);
    u.uOriginLocal.value.copy(_originLocal);
    u.uDestinationLocal.value.copy(_destLocal);
  });
}

export function applyCartoonToMaterials(t, tornadoMats) {
  tornadoMats.forEach(mat => {
    const u = mat.userData.shader?.uniforms ?? mat.userData.tornadoUniforms;
    if (u?.uCartoon) u.uCartoon.value = t;
  });
}
