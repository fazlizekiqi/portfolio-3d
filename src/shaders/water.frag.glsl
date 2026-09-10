// water.frag.glsl — toon / low-poly water
// Direct port of the Godot shader the user provided.
// All texture lookups are replaced with matching procedural GLSL noise,
// so no external images are needed.
//
// irisOutsideAlpha() is prepended from whiteworld.iris.glsl at build time
// (same pattern as the env materials) — do NOT define it here.

uniform vec3  uBaseColor;   // base_color  (light cyan edge tint)
uniform vec3  uMainColor;   // main_color  (saturated turquoise body)
uniform float uTime;        // TIME
uniform float uRippling;    // rippling  (0 – 0.01 range → we accept 0–1 and scale)
uniform float uFoamScale;   // foam_scale

// Iris-alpha uniforms (shared with env materials)
uniform float uProgress;
uniform vec2  uRes;

varying vec2 vWorldXZ;

// ─── Noise helpers (replace texture(noise, ...) lookups) ─────────────────────
float hash12(vec2 p) {
  p  = fract(p * vec2(443.897, 441.423));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

// Smooth value noise — stands in for texture(noise, uv)
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// FBM — stands in for texture(gradient_edge_texture, uv) / foam depth variation
float fbmNoise(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * valueNoise(p);
    p  = p * 2.1 + vec2(1.3, 1.7);
    a *= 0.5;
  }
  return v;
}

// ─── Blend modes (direct ports from the Godot shader) ────────────────────────
vec4 blendOverlay(vec4 Base, vec4 Blend) {
  vec4 result1 = 1.0 - 2.0 * (1.0 - Base) * (1.0 - Blend);
  vec4 result2 = 2.0 * Base * Blend;
  vec4 zeroOrOne = step(Base, vec4(0.5));
  return result2 * zeroOrOne + (1.0 - zeroOrOne) * result1;
}

vec4 blendSubtract(vec4 Base, vec4 Blend) {
  return clamp(Base - Blend, 0.0, 1.0);
}

// ─── Highlight flicker (port of Godot highlight()) ────────────────────────────
// floor_pixels = 1024, scale = 20
float highlight(vec2 uv) {
  // pixelate to 1024 steps
  float pixels = 1024.0;
  uv = floor(uv * pixels) / pixels;

  vec4 n1 = vec4(valueNoise(uv * 20.0 + uTime * 0.2));
  vec4 n2 = vec4(valueNoise(uv * 20.0 - uTime * 0.2));
  vec4 ov = blendOverlay(n1, n2);

  vec4 n3  = vec4(valueNoise(uv));
  vec4 sub = blendSubtract(n3, ov);
  return step(sub.x, 0.6);
}

// ─── Foam feature (port of Godot foam_feature()) ─────────────────────────────
vec3 foamFeature(vec3 color, vec2 originUV) {
  // gradient_edge_texture → fbm gives a smooth 0-1 depth value
  float grayValue = fbmNoise(originUV * 2.5);

  // foam_texture → high-frequency value noise
  vec2 foamUV = originUV * uFoamScale;
  float foamVal = valueNoise(foamUV * 16.0);

  // Godot: alpha = step(gray_value, 85.0/255.0)
  float edgeMask = step(grayValue, 0.333);

  // Godot animated foam dissolve: t based on TIME sine
  float dissolve = step(grayValue,
      (1.0 - abs(sin(uTime * 1.0 + 3.14159265 / 2.0))) * (95.0 / 255.0) + (14.0 / 255.0));
  float t = step(grayValue, 0.333) * dissolve;

  // mix base color with white foam
  vec3 foamColor = vec3(0.95 + foamVal * 0.05);
  vec3 result    = mix(color, foamColor, foamVal * 0.6 * edgeMask);

  // dissolve alpha — fade out dissolved foam pixels (darken = fade toward base)
  result = mix(result, color, t);

  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
void main() {
  // Godot: vec2 uv = world_pos / tile_cell_size   (tile_cell_size = 16)
  const float TILE_CELL = 16.0;
  vec2 uv = vWorldXZ / TILE_CELL;

  // Godot: noise_uv = uv * tile_cell_size / noise_texture_size  (512)
  vec2 noiseUV = uv * TILE_CELL / 512.0;

  // Godot: noise_color = texture(noise, noise_uv + TIME*0.1)  → two-channel
  float noiseX = valueNoise(noiseUV + uTime * 0.1);
  float noiseY = valueNoise(noiseUV + uTime * 0.1 + vec2(5.2, 1.3));
  vec2  offsetRand = vec2(noiseX, noiseY);

  // Godot: noise_fade = texture(noise, noise_uv).x
  float noiseFade = valueNoise(noiseUV);

  // Godot: water_uv offset by rippling, then pixelate to water_base_texture_size (340)
  const float WATER_TEX = 340.0;
  vec2 waterUV = uv * TILE_CELL / WATER_TEX;
  waterUV = mix(waterUV, waterUV - offsetRand, vec2(uRippling));
  // pixelate
  waterUV = floor(waterUV * WATER_TEX) / WATER_TEX;

  // Godot: water_color = texture(water_base, waterUV * scale)
  // We replicate the water_base sprite with value noise that reads turquoise tones
  float waterSample = valueNoise(waterUV * 8.0);

  // Godot alpha channel of water_base → use waterSample as alpha proxy
  float whiteAlpha = waterSample;
  whiteAlpha *= clamp(noiseFade - 0.2, 0.0, 1.0);

  // Godot: water_color = mix(water_color, main_color, 1.0 - white_alpha)
  //        water_color = mix(water_color, water_color * base_color, white_alpha)
  vec3 waterCol = mix(vec3(waterSample), uMainColor, 1.0 - whiteAlpha);
  waterCol      = mix(waterCol, waterCol * uBaseColor, whiteAlpha);

  // Godot: highlight
  float light = highlight(noiseUV);
  waterCol = mix(waterCol, vec3(1.0), step(light, 0.3) * whiteAlpha);

  // Foam at shoreline edges
  waterCol = foamFeature(waterCol, uv);

  // Iris-alpha: water must hide outside the iris circle, just like env meshes
  float irisA = irisOutsideAlpha(uRes, uProgress, uTime);
  if (irisA < 0.001) discard;

  gl_FragColor = vec4(waterCol, irisA);
}

