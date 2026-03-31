uniform vec2  uRes;
uniform float uProgress;
uniform float uTime;
uniform vec3  uColor;

// iris helper inserted at build time via JS string concatenation
// (irisOutsideAlpha is prepended from whiteworld.iris.glsl)

void main() {
  float a = irisOutsideAlpha(uRes, uProgress, uTime);
  if (a < 0.001) discard;
  gl_FragColor = vec4(uColor, a);
}

