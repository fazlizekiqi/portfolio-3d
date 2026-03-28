import * as THREE from 'three';
import { renderer, camera } from './scene.js';
import { enterWhiteWorld, exitWhiteWorld } from './model.js';
import { LAYER } from './layers.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Burn-iris transition
//  An ortho fullscreen quad drawn on top of the main scene each frame.
//  progress 1 = fully open (blue world visible)
//  progress 0 = fully closed (white world)
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

    // Ease the progress for smoother acceleration / deceleration
    float eased = uProgress * uProgress * (3.0 - 2.0 * uProgress);

    float sinA  = cent.y / max(dist, 0.0001);
    float cosA  = cent.x / max(dist, 0.0001);
    vec2  nUV   = vec2(cosA * 0.8 + sinA * 0.6, dist * 2.5) + vec2(uTime*0.6, uTime*0.4);

    float edgeW  = 0.055 * maxD;
    float warp   = fbm(nUV * 3.0 + uTime * 0.3) * 2.0 - 1.0;
    float radius = eased * maxD * 1.08
                 + warp * edgeW * 1.6
                 * smoothstep(0.0, 0.1, eased)
                 * smoothstep(1.0, 0.9, eased);

    float inside    = smoothstep(radius, radius - edgeW * 0.25, dist);
    float outerEdge = radius + edgeW * (0.8 + 0.5 * fbm(nUV * 1.5));
    float burnRing  = max(smoothstep(outerEdge, radius - edgeW*0.1, dist) - inside, 0.0);

    float ringT      = clamp((dist - (radius - edgeW)) / (edgeW * 1.8), 0.0, 1.0);
    float flameNoise = fbm(nUV * 4.0 + uTime * 0.8);
    vec3  flame      = mix(vec3(1.0, 0.92, 0.3), vec3(1.0, 0.38, 0.04), smoothstep(0.0, 0.5, ringT));
    flame            = mix(flame, vec3(0.55, 0.08, 0.01),                smoothstep(0.4, 1.0, ringT));
    flame            = mix(flame, vec3(0.08, 0.02, 0.0), flameNoise *    smoothstep(0.5, 1.0, ringT));
    flame            = mix(flame, vec3(1.0, 0.92, 0.3),
                       smoothstep(radius - edgeW*2.5, radius - edgeW*0.5, dist) * inside * 0.35);

    vec3  color = mix(vec3(0.94, 0.94, 0.91), flame, burnRing);
    float alpha = max((1.0 - inside) * (1.0 - burnRing), burnRing * 0.97);
    alpha      *= 1.0 - smoothstep(0.92, 1.0, eased);

    gl_FragColor = vec4(color, alpha);
  }
`;

// ── Ortho setup ───────────────────────────────────────────────────────────────
const _orthoScene = new THREE.Scene();
const _orthoCam   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const _uniforms   = {
  uRes:      { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  uProgress: { value: 1.0 },
  uTime:     { value: 0.0 },
};
const _quad = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({ fragmentShader: FRAG, uniforms: _uniforms, transparent: true, depthTest: false, depthWrite: false })
);
_quad.frustumCulled = false;
_quad.visible       = false;
_orthoScene.add(_quad);

window.addEventListener('resize', () => _uniforms.uRes.value.set(window.innerWidth, window.innerHeight));

// ── State ─────────────────────────────────────────────────────────────────────
let _progress     = 1.0;
let _direction    = 0;        // -1 = closing → white,  1 = opening → blue
let _elapsed      = 0.0;
let _inWhiteWorld = false;
const SPEED       = 0.32;

export function isWhiteWorld()    { return _inWhiteWorld; }
export function isTransitioning() { return _direction !== 0; }
export function getProgress()     { return _progress; }
export function getElapsed()      { return _elapsed; }

// ── Go to white world (iris closes: 1 → 0) ───────────────────────────────────
export function goToWhiteWorld() {
  if (_direction === -1) return;
  _progress  = 1.0;
  _elapsed   = 0.0;
  _direction = -1;
  // Enable WHITE layer immediately so the iris-alpha shader can reveal
  // white objects outside the shrinking circle during the transition.
  camera.layers.enable(LAYER.WHITE);
}

// ── Return to blue world (iris opens: 0 → 1) ─────────────────────────────────
export function goToBlueWorld() {
  if (!_inWhiteWorld) return;
  // Mark state as no longer in white world, but keep the WHITE layer enabled
  // so white objects remain visible and fade out via their shader alpha
  // as the iris circle expands.  The layer is disabled once fully open.
  _inWhiteWorld = false;
  // Re-enable BLUE layer now so blue objects are ready behind the iris
  camera.layers.enable(LAYER.BLUE);
  _progress  = 0.0;
  _elapsed   = 0.0;
  _direction = 1;
}

// ── Tick (called every frame by main.js) ──────────────────────────────────────
// Returns a post-frame callback when the iris finishes closing, null otherwise.
// The callback is deferred so the layer switch never affects the frame already drawn.
export function tickTransition(delta) {
  if (_direction === 0) {
    _quad.visible = false;
    return null;
  }

  _elapsed  += delta;
  _progress += _direction * SPEED * delta;
  _progress  = Math.max(0, Math.min(1, _progress));

  _uniforms.uProgress.value = _progress;
  _uniforms.uTime.value     = _elapsed;
  _quad.visible             = true;

  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(_orthoScene, _orthoCam);

  // Iris fully closed → switch to white world after this frame is composited
  if (_progress <= 0.0 && _direction === -1) {
    _direction    = 0;
    _quad.visible = false;
    return () => {
      _inWhiteWorld = true;
      enterWhiteWorld();       // disables BLUE, keeps WHITE enabled
    };
  }

  // Iris fully open → transition complete, clean up white layer
  if (_progress >= 1.0 && _direction === 1) {
    _direction    = 0;
    _quad.visible = false;
    // Now that the iris is fully open and white objects are completely hidden
    // by the shader alpha, safely disable the WHITE layer.
    exitWhiteWorld();          // disables WHITE (BLUE already re-enabled)
  }

  return null;
}
