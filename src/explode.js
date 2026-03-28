import * as THREE from 'three';
import { scene } from './scene.js';
import { fadeOutAnimation, fadeInAnimation } from './model.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Tunable parameters
// ─────────────────────────────────────────────────────────────────────────────
export const explodeParams = {
  speed:         0.38,
  animDelay:     1.2,   // seconds to wait after reassembly before playing clip
  explodeDelay:  0.6,   // seconds to hold the exploded state before reassembling

  staggerSpread: 0.6,
  staggerWindow: 0.4,

  flyMin:        2.5,
  flyRand:       3.5,
  collapseAmt:   0.3,

  rotTurns:      2.0,
  rotRandTurns:  4.0,

  fadeStart:     0.4,
  fadeEnd:       1.0,
};

// ─────────────────────────────────────────────────────────────────────────────
//  GLSL snippets injected into MeshStandardMaterial via onBeforeCompile
//  Three.js token replacement: we insert custom attributes/uniforms/logic
//  right before the existing vertex/fragment chunks.
// ─────────────────────────────────────────────────────────────────────────────

const VERT_PARS = /* glsl */`
  uniform float uProgress;
  uniform float uStaggerSpread;
  uniform float uStaggerWindow;
  uniform float uFlyMin;
  uniform float uFlyRand;
  uniform float uCollapseAmt;
  uniform float uRotTurns;
  uniform float uRotRandTurns;

  attribute vec3  aCenter;
  attribute float aRand;

  varying float vExplodeFade; // 0 = assembled, 1 = fully flown → frag uses this for alpha

  mat4 buildRotMat(vec3 axis, float angle) {
    axis = normalize(axis);
    float s = sin(angle), c = cos(angle), oc = 1.0 - c;
    return mat4(
      oc*axis.x*axis.x + c,        oc*axis.x*axis.y - axis.z*s, oc*axis.z*axis.x + axis.y*s, 0.0,
      oc*axis.x*axis.y + axis.z*s, oc*axis.y*axis.y + c,         oc*axis.y*axis.z - axis.x*s, 0.0,
      oc*axis.z*axis.x - axis.y*s, oc*axis.y*axis.z + axis.x*s, oc*axis.z*axis.z + c,         0.0,
      0.0, 0.0, 0.0, 1.0
    );
  }
`;

// Replaces Three.js's "#include <begin_vertex>" token
const VERT_POSITION = /* glsl */`
  // ── Standard Three.js begin_vertex ──────────────────────────────────────
  vec3 transformed = vec3(position);

  // ── Explode displacement ─────────────────────────────────────────────────
  float faceStart = aRand * uStaggerSpread;
  float faceEnd   = faceStart + uStaggerWindow;
  float fp = clamp((uProgress - faceStart) / (faceEnd - faceStart), 0.0, 1.0);
  vExplodeFade = fp;

  float t = smoothstep(0.0, 1.0, fp);

  vec3  toCenter  = aCenter - transformed;
  transformed     = transformed + toCenter * t * uCollapseAmt;

  vec3  flyDir   = normalize(aCenter);
  float flyDist  = t * (uFlyMin + aRand * uFlyRand);
  transformed   += flyDir * flyDist;

  vec3  rotAxis  = normalize(vec3(aRand - 0.5, aRand * 2.0 - 1.0, aRand * 0.7 - 0.35));
  float rotAngle = t * (3.14159265 * 2.0 * uRotTurns + aRand * 3.14159265 * 2.0 * uRotRandTurns);
  mat4  rMat     = buildRotMat(rotAxis, rotAngle);

  // Rotate position around face centroid
  transformed = (rMat * vec4(transformed - aCenter, 1.0)).xyz + aCenter;
`;

// Replaces "#include <beginnormal_vertex>" — rotate the normal with the face
const VERT_NORMAL = /* glsl */`
  // ── Standard Three.js beginnormal_vertex ────────────────────────────────
  vec3 objectNormal = vec3(normal);
  #ifdef USE_TANGENT
    vec3 objectTangent = vec3(tangent.xyz);
  #endif

  // ── Rotate normal with face so PBR lighting stays correct mid-flight ────
  float _fp2 = clamp((uProgress - aRand * uStaggerSpread) /
                     (uStaggerWindow), 0.0, 1.0);
  float _t2  = smoothstep(0.0, 1.0, _fp2);
  vec3  _rAxis2  = normalize(vec3(aRand - 0.5, aRand * 2.0 - 1.0, aRand * 0.7 - 0.35));
  float _rAngle2 = _t2 * (3.14159265 * 2.0 * uRotTurns + aRand * 3.14159265 * 2.0 * uRotRandTurns);
  mat4  _rMat2   = buildRotMat(_rAxis2, _rAngle2);
  objectNormal   = normalize((_rMat2 * vec4(objectNormal, 0.0)).xyz);
`;

const FRAG_PARS = /* glsl */`
  uniform float uFadeStart;
  uniform float uFadeEnd;
  varying float vExplodeFade;
`;

// Injected at the very end of the fragment shader, after all PBR lighting
const FRAG_ALPHA = /* glsl */`
  float _fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, vExplodeFade);
  float _flying = smoothstep(0.0, 0.05, vExplodeFade);
  gl_FragColor.a *= mix(1.0, _fade, _flying);
  if (gl_FragColor.a < 0.001) discard;
`;

// ─────────────────────────────────────────────────────────────────────────────
//  Create the explode material by cloning MeshStandardMaterial and injecting
// ─────────────────────────────────────────────────────────────────────────────
function buildExplodeMaterial(srcMat) {
  const mat = srcMat.clone();
  mat.transparent = true;
  mat.side        = THREE.DoubleSide;

  // Extra uniforms the injected code needs
  mat.userData.explodeUniforms = {
    uProgress:      { value: 1.0 },
    uStaggerSpread: { value: explodeParams.staggerSpread },
    uStaggerWindow: { value: explodeParams.staggerWindow },
    uFlyMin:        { value: explodeParams.flyMin },
    uFlyRand:       { value: explodeParams.flyRand },
    uCollapseAmt:   { value: explodeParams.collapseAmt },
    uRotTurns:      { value: explodeParams.rotTurns },
    uRotRandTurns:  { value: explodeParams.rotRandTurns },
    uFadeStart:     { value: explodeParams.fadeStart },
    uFadeEnd:       { value: explodeParams.fadeEnd },
  };

  mat.onBeforeCompile = (shader) => {
    // Attach extra uniforms to the shader
    Object.assign(shader.uniforms, mat.userData.explodeUniforms);

    // ── Vertex ─────────────────────────────────────────────────────────────
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>',
        '#include <common>\n' + VERT_PARS)
      .replace('#include <beginnormal_vertex>',
        VERT_NORMAL)
      .replace('#include <begin_vertex>',
        VERT_POSITION);

    // ── Fragment ───────────────────────────────────────────────────────────
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
        '#include <common>\n' + FRAG_PARS)
      .replace('#include <dithering_fragment>',
        '#include <dithering_fragment>\n' + FRAG_ALPHA);

    // Keep a reference so we can update uProgress each frame
    mat.userData.shader = shader;
  };

  return mat;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Build per-face geometry (3 verts per triangle, with aCenter + aRand)
// ─────────────────────────────────────────────────────────────────────────────
function buildExplodeGeometry(srcGeo) {
  const base = srcGeo.index ? srcGeo.toNonIndexed() : srcGeo.clone();
  base.computeVertexNormals();

  const pos    = base.attributes.position;
  const count  = pos.count;
  const center = new Float32Array(count * 3);
  const rand   = new Float32Array(count);

  for (let i = 0; i < count; i += 3) {
    const ax = pos.getX(i),   ay = pos.getY(i),   az = pos.getZ(i);
    const bx = pos.getX(i+1), by = pos.getY(i+1), bz = pos.getZ(i+1);
    const cx = pos.getX(i+2), cy = pos.getY(i+2), cz = pos.getZ(i+2);
    const mx = (ax+bx+cx)/3,  my = (ay+by+cy)/3,  mz = (az+bz+cz)/3;
    const r  = Math.random();
    for (let v = 0; v < 3; v++) {
      center[(i+v)*3]     = mx;
      center[(i+v)*3 + 1] = my;
      center[(i+v)*3 + 2] = mz;
      rand[i+v] = r;
    }
  }

  base.setAttribute('aCenter', new THREE.BufferAttribute(center, 3));
  base.setAttribute('aRand',   new THREE.BufferAttribute(rand,   1));
  return base;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Public state
// ─────────────────────────────────────────────────────────────────────────────
export const explodeState = {
  progress:  1,
  direction: -1,
};

const explodeMeshes  = [];
const originalMeshes = [];
let   explodeGroup   = null;
let   onReassembled  = null;

export function getExplodeGroup() { return explodeGroup; }

export function setOnReassembled(fn) { onReassembled = fn; }

// Sync all tunable params to the shader uniforms
function syncUniforms() {
  const p = explodeParams;
  explodeMeshes.forEach(m => {
    const u = m.material.userData.shader?.uniforms ?? m.material.userData.explodeUniforms;
    if (!u) return;
    u.uStaggerSpread.value = p.staggerSpread;
    u.uStaggerWindow.value = p.staggerWindow;
    u.uFlyMin.value        = p.flyMin;
    u.uFlyRand.value       = p.flyRand;
    u.uCollapseAmt.value   = p.collapseAmt;
    u.uRotTurns.value      = p.rotTurns;
    u.uRotRandTurns.value  = p.rotRandTurns;
    u.uFadeStart.value     = p.fadeStart;
    u.uFadeEnd.value       = p.fadeEnd;
  });
}

export function applyExplodeParams() { syncUniforms(); }

// no-op now — Three.js handles all lighting automatically
export function updateExplodeLights() {}

// ─────────────────────────────────────────────────────────────────────────────
//  initExplode
// ─────────────────────────────────────────────────────────────────────────────
export function initExplode(meshes, modelGroup) {
  explodeGroup = new THREE.Group();
  explodeGroup.visible = true;

  explodeGroup.position.copy(modelGroup.position);
  explodeGroup.quaternion.copy(modelGroup.quaternion);
  explodeGroup.scale.copy(modelGroup.scale);

  meshes.forEach((mesh) => {
    const srcMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;

    const mat  = buildExplodeMaterial(srcMat);
    const geo  = buildExplodeGeometry(mesh.geometry);
    const explMesh = new THREE.Mesh(geo, mat);
    explMesh.castShadow    = true;
    explMesh.receiveShadow = true;
    explMesh.matrix.copy(mesh.matrix);
    explMesh.matrixAutoUpdate = false;

    explodeGroup.add(explMesh);
    explodeMeshes.push(explMesh);

    mesh.visible = false;
    originalMeshes.push(mesh);
  });

  scene.add(explodeGroup);
}

// ─────────────────────────────────────────────────────────────────────────────
//  triggerExplode / triggerReassemble / toggleExplode
// ─────────────────────────────────────────────────────────────────────────────
export function triggerExplode() {
  if (explodeState.direction === 1) return;
  fadeOutAnimation(0.5, () => {
    explodeState.direction = 1;
    explodeGroup.visible   = true;
    originalMeshes.forEach(m => { m.visible = false; });
  });
}

export function triggerReassemble() {
  if (explodeState.direction === -1) return;
  explodeState.direction = -1;
}

export function toggleExplode() {
  if (explodeState.progress < 0.5) triggerExplode();
  else triggerReassemble();
}

// ─────────────────────────────────────────────────────────────────────────────
//  tickExplode
// ─────────────────────────────────────────────────────────────────────────────
export function tickExplode(delta) {
  if (explodeState.direction === 0) return;

  explodeState.progress += explodeState.direction * explodeParams.speed * delta;
  explodeState.progress  = Math.max(0, Math.min(1, explodeState.progress));

  const p = explodeState.progress;

  explodeMeshes.forEach(m => {
    // Prefer the live compiled shader uniforms; fall back to pre-compile store
    const u = m.material.userData.shader?.uniforms ?? m.material.userData.explodeUniforms;
    if (u) u.uProgress.value = p;
  });

  if (p <= 0 && explodeState.direction === -1) {
    explodeState.direction = 0;
    explodeGroup.visible   = false;
    originalMeshes.forEach(m => { m.visible = true; });
    if (onReassembled) {
      const cb = onReassembled;
      onReassembled = null;
      setTimeout(cb, explodeParams.animDelay * 1000);
    } else {
      setTimeout(() => fadeInAnimation(0), explodeParams.animDelay * 1000);
    }
  }

  if (p >= 1 && explodeState.direction === 1) {
    explodeState.direction = 0;
  }
}
