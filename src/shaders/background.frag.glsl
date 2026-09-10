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

