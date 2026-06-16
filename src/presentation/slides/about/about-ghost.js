/**
 * about-ghost.js — hologram-ghost rendering for the About Me sequence: the
 * vertex-cloud particle scatter, the fresnel hologram shell, the animated
 * electricity wireframe, and the burn-edge glow stripe. Builds the meshes
 * once in `initGhost()` and exposes setters that about-view.js drives every
 * frame with values computed from its own 5-phase timeline.
 */

import * as THREE from 'three';
import { scene } from '../../../scene.js';
import _holoVert from '../../../shaders/about-holo.vert.glsl?raw';
import _holoFrag from '../../../shaders/about-holo.frag.glsl?raw';
import _dotsVert from '../../../shaders/about-dots.vert.glsl?raw';
import _dotsFrag from '../../../shaders/about-dots.frag.glsl?raw';
import _stripeVert from '../../../shaders/about-burn-stripe.vert.glsl?raw';
import _stripeFrag from '../../../shaders/about-burn-stripe.frag.glsl?raw';
import _wireVert from '../../../shaders/about-wire.vert.glsl?raw';
import _wireFrag from '../../../shaders/about-wire.frag.glsl?raw';

let _ghostGroup   = null;
let _wireMat      = null;
let _holoUniforms = null;
let _dotsUniforms = null;
let _scanPlane    = null;
let _burnMesh     = null;
let _burnMat      = null;

/** Build the ghost group (dots + hologram + wire) and the burn-edge stripe. */
export function initGhost(charMeshes, modelGroup, yMax) {
  // Clipping plane for wireframe reveal (top → bottom, same direction as burn)
  _scanPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -yMax);

  _ghostGroup = new THREE.Group();
  _ghostGroup.position.copy(modelGroup.position);
  _ghostGroup.quaternion.copy(modelGroup.quaternion);
  _ghostGroup.scale.copy(modelGroup.scale);

  modelGroup.updateWorldMatrix(true, true);

  const _relMat = (mesh) => {
    const rel = new THREE.Matrix4();
    rel.copy(modelGroup.matrixWorld).invert().multiply(mesh.matrixWorld);
    return rel;
  };

  // ── Dots ──────────────────────────────────────────────────────────────────
  _dotsUniforms = { uSettle: { value: 0.0 }, uOpacity: { value: 0.0 } };
  const dotsMat = new THREE.ShaderMaterial({
    vertexShader: _dotsVert, fragmentShader: _dotsFrag,
    uniforms: _dotsUniforms, transparent: true,
    depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
  const dotsGrp = new THREE.Group();
  charMeshes.forEach(mesh => {
    const pos     = mesh.geometry.attributes.position;
    const offsets = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      offsets[i*3]   = (Math.random()-0.5)*2.4;
      offsets[i*3+1] = (Math.random()-0.5)*2.4;
      offsets[i*3+2] = (Math.random()-0.5)*2.4;
    }
    const geo = mesh.geometry.clone();
    geo.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 3));
    const pts = new THREE.Points(geo, dotsMat);
    pts.matrix.copy(_relMat(mesh)); pts.matrixAutoUpdate = false;
    dotsGrp.add(pts);
  });
  _ghostGroup.add(dotsGrp);

  // ── Hologram shell (fresnel rim — carries the ghost's shape) ──────────────
  _holoUniforms = {
    uOpacity:  { value: 0.0 },
    uTime:     { value: 0.0 },
    uClipY:    { value: yMax },
    uClipYMax: { value: 999.0 },  // 999 = no outro clip active
    uPulse:    { value: 0.0 },
  };
  const holoMat = new THREE.ShaderMaterial({
    vertexShader: _holoVert, fragmentShader: _holoFrag,
    uniforms: _holoUniforms, transparent: true,
    depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending, side: THREE.FrontSide,
  });
  const holoGrp = new THREE.Group();
  charMeshes.forEach(mesh => {
    const shell = new THREE.Mesh(mesh.geometry.clone(), holoMat);
    shell.matrix.copy(_relMat(mesh)); shell.matrixAutoUpdate = false;
    holoGrp.add(shell);
  });
  _ghostGroup.add(holoGrp);

  // ── Electric wireframe (animated current flowing through edges) ──────────
  _wireMat = new THREE.ShaderMaterial({
    vertexShader:   _wireVert,
    fragmentShader: _wireFrag,
    uniforms: {
      uOpacity: { value: 0.0 },
      uTime:    { value: 0.0 },
      uClipY:   { value: 999.0 },  // 999 = everything clipped (invisible at start)
    },
    transparent: true, wireframe: true,
    depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending,
  });
  const wireGrp = new THREE.Group();
  charMeshes.forEach(mesh => {
    const wire = new THREE.Mesh(mesh.geometry.clone(), _wireMat);
    wire.matrix.copy(_relMat(mesh)); wire.matrixAutoUpdate = false;
    wireGrp.add(wire);
  });
  _ghostGroup.add(wireGrp);

  // ── Burn-edge glow stripe ─────────────────────────────────────────────────
  _burnMat = new THREE.ShaderMaterial({
    vertexShader: _stripeVert, fragmentShader: _stripeFrag,
    uniforms: { uOpacity: { value: 0.0 } },
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  _burnMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.28), _burnMat);
  _burnMesh.visible = false;
  scene.add(_burnMesh);

  _ghostGroup.visible = false;
  scene.add(_ghostGroup);

  return { ghostGroup: _ghostGroup, scanPlane: _scanPlane };
}

/** Reset all ghost visuals to their pre-show state (called from showAboutWireframe). */
export function resetGhost(yMax) {
  _scanPlane.constant = -yMax;
  _dotsUniforms.uSettle.value  = 0.0;
  _dotsUniforms.uOpacity.value = 0.0;
  _wireMat.uniforms.uOpacity.value = 0;
  _wireMat.uniforms.uClipY.value   = 999.0;  // fully hidden until burn starts
  _holoUniforms.uOpacity.value = 0.0;
  _holoUniforms.uClipY.value   = yMax;
  _holoUniforms.uClipYMax.value = 999.0;
  _holoUniforms.uPulse.value   = 0.0;
  _ghostGroup.rotation.y = 0;
  _ghostGroup.visible    = true;
  _burnMesh.visible = false;
  _burnMat.uniforms.uOpacity.value = 0;
}

export function setDots(settle, opacity) {
  _dotsUniforms.uSettle.value  = settle;
  _dotsUniforms.uOpacity.value = opacity;
}

export function setHolo({ clipY, clipYMax, opacity, pulse, time }) {
  if (clipY    !== undefined) _holoUniforms.uClipY.value    = clipY;
  if (clipYMax !== undefined) _holoUniforms.uClipYMax.value = clipYMax;
  if (opacity  !== undefined) _holoUniforms.uOpacity.value  = opacity;
  if (pulse    !== undefined) _holoUniforms.uPulse.value    = pulse;
  if (time     !== undefined) _holoUniforms.uTime.value     = time;
}

export function setWire({ clipY, opacity }) {
  if (clipY   !== undefined) _wireMat.uniforms.uClipY.value   = clipY;
  if (opacity !== undefined) _wireMat.uniforms.uOpacity.value = opacity;
}

export function setScanPlane(constant) {
  _scanPlane.constant = constant;
}

export function setSway(angle) {
  _ghostGroup.rotation.y = angle;
}

export function setBurnStripe({ visible, y, opacity }) {
  _burnMesh.visible = visible;
  if (visible) {
    _burnMesh.position.set(_ghostGroup.position.x, y, _ghostGroup.position.z);
    _burnMesh.lookAt(_burnMesh.position.x, _burnMesh.position.y, _burnMesh.position.z + 10);
    _burnMat.uniforms.uOpacity.value = opacity;
  }
}

export function hideGhost() {
  _ghostGroup.visible = false;
}

export function fadeOutGhost(durationMs, onDone) {
  const sD = _dotsUniforms.uOpacity.value;
  const sW = _wireMat.uniforms.uOpacity.value;
  const sH = _holoUniforms.uOpacity.value;
  const t0 = performance.now();
  (function fade(ts) {
    const p = Math.min((ts - t0) / durationMs, 1);
    _dotsUniforms.uOpacity.value     = sD * (1 - p);
    _wireMat.uniforms.uOpacity.value = sW * (1 - p);
    _holoUniforms.uOpacity.value     = sH * (1 - p);
    if (p < 1) requestAnimationFrame(fade);
    else onDone();
  })(performance.now());
}
