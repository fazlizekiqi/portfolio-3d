import * as THREE from 'three';

const VERT = `void main() { gl_Position = vec4(position, 1.0); }`;

// Simple sky gradient — zero noise, zero loops, runs in ~5 instructions per pixel
const FRAG = `
precision mediump float;
uniform vec2  uResolution;
uniform float uTime;

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  // Top → bottom: deep navy to dark teal
  vec3 top    = vec3(0.03, 0.05, 0.14);
  vec3 bottom = vec3(0.04, 0.14, 0.22);
  vec3 col    = mix(top, bottom, uv.y);

  // Subtle slow-pulsing horizon glow (no texture, no loops)
  float glow = smoothstep(0.62, 0.0, uv.y) * (0.5 + 0.5 * sin(uTime * 0.25));
  col += vec3(0.0, 0.08, 0.18) * glow;

  // Vignette
  vec2 centered = uv - 0.5;
  float vig = 1.0 - dot(centered * vec2(1.1, 1.3), centered * vec2(1.1, 1.3));
  col *= clamp(vig, 0.0, 1.0);

  gl_FragColor = vec4(col, 1.0);
}
`;

// ── Three.js boilerplate ──────────────────────────────────────────────────────
const bgScene  = new THREE.Scene();
const bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const bgMaterial = new THREE.ShaderMaterial({
  vertexShader:   VERT,
  fragmentShader: FRAG,
  uniforms: {
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uTime:       { value: 0.0 },
  },
  depthTest:  false,
  depthWrite: false,
});

const bgGeo = new THREE.BufferGeometry();
bgGeo.setAttribute('position', new THREE.BufferAttribute(
  new Float32Array([-1,-1,0, 3,-1,0, -1,3,0]), 3
));
bgScene.add(new THREE.Mesh(bgGeo, bgMaterial));

window.addEventListener('resize', () => {
  bgMaterial.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
});

export function tickBackground(renderer, elapsed) {
  bgMaterial.uniforms.uTime.value = elapsed;
  renderer.clearColor();
  renderer.clearDepth();
  renderer.render(bgScene, bgCamera);
}
