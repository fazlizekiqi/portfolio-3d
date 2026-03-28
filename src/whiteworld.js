import * as THREE from 'three';
import { scene } from './scene.js';
import { LAYER, setWorldLayer } from './layers.js';
import { getProgress, isTransitioning, isWhiteWorld, getElapsed } from './transition.js';

// ─────────────────────────────────────────────────────────────────────────────
//  White world — cartoon / cel style objects
//
//  Visibility is controlled per-pixel by an iris-alpha shader that mirrors
//  the burn-iris transition overlay.  Objects appear outside the shrinking
//  circle and hide as it expands back.
// ─────────────────────────────────────────────────────────────────────────────

const LINE_COLOR = 0x111111;
const FILL_COLOR = 0xffffff;

// ── Shared uniforms ───────────────────────────────────────────────────────────
const whiteWorldUniforms = {
  uProgress: { value: 1.0 },
  uTime:     { value: 0.0 },
  uRes:      { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
};
window.addEventListener('resize', () => {
  whiteWorldUniforms.uRes.value.set(window.innerWidth, window.innerHeight);
});

// ── GLSL iris-alpha helper ────────────────────────────────────────────────────
const IRIS_ALPHA_GLSL = /* glsl */`
  float ww_hash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }
  float ww_noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(ww_hash(i),           ww_hash(i+vec2(1,0)), u.x),
               mix(ww_hash(i+vec2(0,1)), ww_hash(i+vec2(1,1)), u.x), u.y);
  }
  float ww_fbm(vec2 p) {
    float v=0.0, a=0.5;
    for(int i=0;i<5;i++){ v+=a*ww_noise(p); p=p*2.1+vec2(1.3,1.7); a*=0.5; }
    return v;
  }

  // 1.0 outside the iris circle, 0.0 inside, feathered at the edge.
  float irisOutsideAlpha(vec2 res, float progress, float time) {
    vec2  uv     = gl_FragCoord.xy / res;
    vec2  aspect = vec2(res.x / res.y, 1.0);
    vec2  cent   = (uv - 0.5) * aspect;
    float dist   = length(cent);
    float maxD   = length(vec2(0.5 * aspect.x, 0.5));

    float eased = progress * progress * (3.0 - 2.0 * progress);

    float sinA = cent.y / max(dist, 0.0001);
    float cosA = cent.x / max(dist, 0.0001);
    vec2  nUV  = vec2(cosA * 0.8 + sinA * 0.6, dist * 2.5) + vec2(time*0.6, time*0.4);

    float edgeW = 0.055 * maxD;
    float warp  = ww_fbm(nUV * 3.0 + time * 0.3) * 2.0 - 1.0;
    float radius = eased * maxD * 1.08
                 + warp * edgeW * 1.6
                 * smoothstep(0.0, 0.1, eased)
                 * smoothstep(1.0, 0.9, eased);

    float feather = edgeW * 2.5;
    float alpha   = smoothstep(radius - feather * 0.3, radius + feather, dist);
    alpha *= 1.0 - smoothstep(0.88, 1.0, eased);
    return alpha;
  }
`;

// ── Shared vertex shader ──────────────────────────────────────────────────────
const VERT = /* glsl */`
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ── Fill material — opaque faces with depth write for correct ordering ────────
const fillMat = new THREE.ShaderMaterial({
  uniforms: whiteWorldUniforms,
  vertexShader: VERT,
  fragmentShader: /* glsl */`
    uniform vec2  uRes;
    uniform float uProgress;
    uniform float uTime;
    ${IRIS_ALPHA_GLSL}
    void main() {
      float a = irisOutsideAlpha(uRes, uProgress, uTime);
      if (a < 0.001) discard;
      gl_FragColor = vec4(${new THREE.Color(FILL_COLOR).r.toFixed(3)},
                          ${new THREE.Color(FILL_COLOR).g.toFixed(3)},
                          ${new THREE.Color(FILL_COLOR).b.toFixed(3)}, a);
    }
  `,
  transparent: true,
  depthWrite:  true,
  depthTest:   true,
  side: THREE.FrontSide,
});

// ── Line material — edge outlines, no depth write (decorative overlay) ────────
const lineMat = new THREE.ShaderMaterial({
  uniforms: whiteWorldUniforms,
  vertexShader: VERT,
  fragmentShader: /* glsl */`
    uniform vec2  uRes;
    uniform float uProgress;
    uniform float uTime;
    ${IRIS_ALPHA_GLSL}
    void main() {
      float a = irisOutsideAlpha(uRes, uProgress, uTime);
      if (a < 0.001) discard;
      gl_FragColor = vec4(${new THREE.Color(LINE_COLOR).r.toFixed(3)},
                          ${new THREE.Color(LINE_COLOR).g.toFixed(3)},
                          ${new THREE.Color(LINE_COLOR).b.toFixed(3)}, a);
    }
  `,
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
  new THREE.PlaneGeometry(6, 6, 3, 3),
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
