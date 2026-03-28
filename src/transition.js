import * as THREE from 'three';
import { renderer } from './scene.js';
import { enterCartoonMode, exitCartoonMode } from './model.js';
import { setEnvironmentVisible } from './environment.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Burn-iris transition
//  Rendered as a separate ortho scene on top of the main scene.
//  ShaderMaterial (not Raw) so Three.js handles attribute/precision injection.
// ─────────────────────────────────────────────────────────────────────────────

const FRAG = /* glsl */`
  uniform vec2  uRes;
  uniform float uProgress;
  uniform float uTime;

  float hash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i),           hash(i+vec2(1,0)), u.x),
               mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v=0.0, a=0.5;
    for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.1+vec2(1.3,1.7); a*=0.5; }
    return v;
  }

  void main() {
    vec2  uv     = gl_FragCoord.xy / uRes;
    vec2  aspect = vec2(uRes.x / uRes.y, 1.0);
    vec2  cent   = (uv - 0.5) * aspect;
    float dist   = length(cent);
    float maxD   = length(vec2(0.5 * aspect.x, 0.5));

    float angle = atan(cent.y, cent.x);
    vec2  nUV   = vec2(angle * 0.8, dist * 2.5) + vec2(uTime*0.6, uTime*0.4);
    float warp  = fbm(nUV * 3.0 + uTime * 0.3) * 2.0 - 1.0;

    float edgeW  = 0.055 * maxD;
    float radius = uProgress * maxD * 1.08
                 + warp * edgeW * 1.6
                 * smoothstep(0.0, 0.1, uProgress)
                 * smoothstep(1.0, 0.9, uProgress);

    // inside circle = transparent (3D shows through)
    // outside       = white (new world)
    float inside    = smoothstep(radius, radius - edgeW * 0.25, dist);
    float outerEdge = radius + edgeW * (0.8 + 0.5 * fbm(nUV * 1.5));
    float burnRing  = max(smoothstep(outerEdge, radius - edgeW*0.1, dist) - inside, 0.0);

    vec3 hotYellow = vec3(1.0, 0.92, 0.3);
    vec3 orange    = vec3(1.0, 0.38, 0.04);
    vec3 ember     = vec3(0.55, 0.08, 0.01);
    vec3 darkEdge  = vec3(0.08, 0.02, 0.0);
    vec3 white     = vec3(0.94, 0.94, 0.91);

    float ringT      = clamp((dist - (radius - edgeW)) / (edgeW * 1.8), 0.0, 1.0);
    float flameNoise = fbm(nUV * 4.0 + uTime * 0.8);
    vec3  flame      = mix(hotYellow, orange,   smoothstep(0.0, 0.5, ringT));
    flame            = mix(flame,     ember,     smoothstep(0.4, 1.0, ringT));
    flame            = mix(flame,     darkEdge,  flameNoise * smoothstep(0.5, 1.0, ringT));
    float halo = smoothstep(radius - edgeW*2.5, radius - edgeW*0.5, dist) * inside;
    flame      = mix(flame, hotYellow, halo * 0.35);

    vec3  color = mix(white, flame, burnRing);
    float alpha = max((1.0 - inside) * (1.0 - burnRing), burnRing * 0.97);

    // Fully open → invisible
    alpha *= 1.0 - smoothstep(0.92, 1.0, uProgress);

    gl_FragColor = vec4(color, alpha);
  }
`;

// ── Ortho scene setup ─────────────────────────────────────────────────────────
const _orthoScene  = new THREE.Scene();
const _orthoCam    = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const _uniforms = {
  uRes:      { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  uProgress: { value: 1.0 },
  uTime:     { value: 0.0 },
};

const _mat = new THREE.ShaderMaterial({
  fragmentShader: FRAG,
  uniforms:       _uniforms,
  transparent:    true,
  depthTest:      false,
  depthWrite:     false,
});

// fullscreen quad covering NDC [-1,1]
const _quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), _mat);
_quad.frustumCulled = false;
_quad.visible       = false;
_orthoScene.add(_quad);

window.addEventListener('resize', () => {
  _uniforms.uRes.value.set(window.innerWidth, window.innerHeight);
});

// ── State ─────────────────────────────────────────────────────────────────────
let _progress    = 1.0;
let _direction   = 0;
let _elapsed     = 0.0;
let _cartoonMode = false;
const SPEED      = 0.32;

export function isCartoonMode()   { return _cartoonMode; }
export function isTransitioning() { return _direction !== 0; }
export function isExiting()       { return _direction === 1; } // circle growing back to 3D

// ── Public API ────────────────────────────────────────────────────────────────

export function startBurnTransition() {
  if (_direction === -1) return;
  _progress     = 1.0;
  _elapsed      = 0.0;
  _direction    = -1;
  _quad.visible = true;
}

export function reverseBurnTransition() {
  if (!_cartoonMode) return;
  setEnvironmentVisible(true);  // restore env immediately so it shows inside the growing circle
  _direction    = 1;
  _elapsed      = 0.0;          // reset time so fire flicker restarts cleanly
  _quad.visible = true;
}

export function tickTransition(delta) {
  if (_direction === 0 && _progress >= 1.0) {
    _quad.visible = false;
    return;
  }

  _elapsed += delta;

  if (_direction !== 0) {
    _progress += _direction * SPEED * delta;
    _progress  = Math.max(0, Math.min(1, _progress));
  }

  _uniforms.uProgress.value = _progress;
  _uniforms.uTime.value     = _elapsed;
  _quad.visible             = true;

  // Render the overlay on top of whatever is already in the framebuffer
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(_orthoScene, _orthoCam);
  renderer.autoClear = false; // keep false (main.js relies on it)

  // Circle fully closed → white world
  if (_progress <= 0.0 && _direction === -1) {
    _direction    = 0;
    _cartoonMode  = true;
    _quad.visible = false;
    enterCartoonMode();
  }

  // Circle fully open → back to 3D
  if (_progress >= 1.0 && _direction === 1) {
    _direction    = 0;
    _cartoonMode  = false;
    _quad.visible = false;
    exitCartoonMode();
  }
}
