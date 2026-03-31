import * as THREE from 'three';
import { scene } from './scene.js';
import { LAYER, setWorldLayer } from './layers.js';
import { getProgress, isTransitioning, isWhiteWorld, getElapsed } from './transition.js';
import IRIS_ALPHA_GLSL  from './shaders/whiteworld.iris.glsl?raw';
import VERT             from './shaders/whiteworld.vert.glsl?raw';
import FRAG_BODY        from './shaders/whiteworld.frag.glsl?raw';

// ─────────────────────────────────────────────────────────────────────────────
//  White world — cartoon / cel style objects
//
//  Visibility is controlled per-pixel by an iris-alpha shader that mirrors
//  the burn-iris transition overlay.  Objects appear outside the shrinking
//  circle and hide as it expands back.
// ─────────────────────────────────────────────────────────────────────────────

const LINE_COLOR = new THREE.Color(0x111111);
const FILL_COLOR = new THREE.Color(0xffffff);

// ── Shared uniforms ───────────────────────────────────────────────────────────
const whiteWorldUniforms = {
  uProgress: { value: 1.0 },
  uTime:     { value: 0.0 },
  uRes:      { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
};
window.addEventListener('resize', () => {
  whiteWorldUniforms.uRes.value.set(window.innerWidth, window.innerHeight);
});

// Combined fragment shader: iris helper + body (loaded from .glsl files)
const FRAG = IRIS_ALPHA_GLSL + '\n' + FRAG_BODY;

// ── Fill material — opaque faces with depth write for correct ordering ────────
const fillMat = new THREE.ShaderMaterial({
  uniforms: { ...whiteWorldUniforms, uColor: { value: FILL_COLOR } },
  vertexShader: VERT,
  fragmentShader: FRAG,
  transparent: true,
  depthWrite:  true,
  depthTest:   true,
  side: THREE.FrontSide,
});

// ── Line material — edge outlines, no depth write (decorative overlay) ────────
const lineMat = new THREE.ShaderMaterial({
  uniforms: { ...whiteWorldUniforms, uColor: { value: LINE_COLOR } },
  vertexShader: VERT,
  fragmentShader: FRAG,
  transparent: true,
  depthWrite:  false,
  depthTest:   true,
});

// ── Object factory ────────────────────────────────────────────────────────────
function makeCartoonObject(geometry, position, rotation = null) {
  const group = new THREE.Group();
  group.position.copy(position);
  if (rotation) group.rotation.copy(rotation);

  const fill  = new THREE.Mesh(geometry, fillMat);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), lineMat);

  group.add(fill, edges);
  setWorldLayer(group, LAYER.WHITE, true);
  scene.add(group);
  return group;
}

// ── White world objects ───────────────────────────────────────────────────────
const whitePlane = makeCartoonObject(
  new THREE.PlaneGeometry(60, 60, 20, 20),
  new THREE.Vector3(0, -0.95, 0),
  new THREE.Euler(-Math.PI / 2, 0, 0)
);

const whiteCube = makeCartoonObject(
  new THREE.BoxGeometry(0.6, 0.6, 0.6),
  new THREE.Vector3(1.4, -0.65, 0)
);

const whiteCube2 = makeCartoonObject(
  new THREE.BoxGeometry(0.4, 0.4, 0.4),
  new THREE.Vector3(-1.5, -0.75, 0.5)
);

const whiteCube3 = makeCartoonObject(
  new THREE.BoxGeometry(0.3, 0.3, 0.3),
  new THREE.Vector3(0.8, -0.8, -1.2)
);

// ── Per-frame tick ────────────────────────────────────────────────────────────
export function tickWhiteWorld() {
  const transitioning = isTransitioning();
  const inWhite       = isWhiteWorld();

  if (transitioning) {
    whiteWorldUniforms.uProgress.value = getProgress();
    whiteWorldUniforms.uTime.value     = getElapsed();
  } else if (inWhite) {
    whiteWorldUniforms.uProgress.value = 0.0;
    whiteWorldUniforms.uTime.value     = 0.0;
  } else {
    whiteWorldUniforms.uProgress.value = 1.0;
    whiteWorldUniforms.uTime.value     = 0.0;
  }
}
