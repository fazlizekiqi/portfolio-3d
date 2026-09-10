#define MAX_LAMPS 11   // 8 user lamps + 3 fixed lab fixtures

uniform vec2  uRes;
uniform float uProgress;
uniform float uTime;
uniform vec3  uColor;

// Lighting (shared across all env materials via JS uniforms)
uniform float uLit;              // 1 = lit fill surface, 0 = flat (edge outlines)
uniform vec3  uAmbientColor;
uniform float uAmbientIntensity;
uniform float uToonSteps;        // 0 = smooth shading, >= 2 = banded cel look
uniform vec3  uLampPos[MAX_LAMPS];
uniform vec3  uLampColor[MAX_LAMPS];
uniform float uLampIntensity[MAX_LAMPS];
uniform float uLampRange[MAX_LAMPS];

// Sun — a single directional light shared with the real THREE.DirectionalLight
// that lights the character. uSunDir points FROM the surface TOWARD the sun.
// Intensity is gated to the white world and can be dampened per-zone (e.g. 0
// near indoor/lab areas) in JS before being pushed into this uniform.
uniform vec3  uSunDir;
uniform vec3  uSunColor;
uniform float uSunIntensity;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;

// iris helper inserted at build time via JS string concatenation
// (irisOutsideAlpha is prepended from whiteworld.iris.glsl)

void main() {
  float a = irisOutsideAlpha(uRes, uProgress, uTime);
  if (a < 0.001) discard;

  vec3 rgb = uColor;

  if (uLit > 0.5) {
    vec3 N = normalize(vWorldNormal);

    // Ambient fill — keeps shadowed sides from going pure black.
    vec3 light = uAmbientColor * uAmbientIntensity;

    // Point lamps — diffuse term with smooth range falloff.
    for (int i = 0; i < MAX_LAMPS; i++) {
      if (uLampIntensity[i] <= 0.0) continue;

      vec3  toLamp = uLampPos[i] - vWorldPos;
      float dist   = length(toLamp);
      vec3  L      = toLamp / max(dist, 0.0001);

      float ndl = max(dot(N, L), 0.0);
      if (uToonSteps >= 2.0) {
        // Quantise into flat bands for a cel-shaded falloff.
        ndl = clamp(floor(ndl * uToonSteps) / (uToonSteps - 1.0), 0.0, 1.0);
      }

      float atten = 1.0 - smoothstep(0.0, uLampRange[i], dist);
      light += uLampColor[i] * (uLampIntensity[i] * ndl * atten);
    }

    // Sun — directional, no range falloff.
    if (uSunIntensity > 0.0) {
      float sndl = max(dot(N, uSunDir), 0.0);
      if (uToonSteps >= 2.0) {
        sndl = clamp(floor(sndl * uToonSteps) / (uToonSteps - 1.0), 0.0, 1.0);
      }
      light += uSunColor * (uSunIntensity * sndl);
    }

    rgb = uColor * light;
  }

  gl_FragColor = vec4(rgb, a);
}
