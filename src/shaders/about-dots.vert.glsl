attribute vec3 aOffset;
uniform float uSettle;
uniform float uOpacity;
varying float vOpacity;
void main() {
  float e = 1.0 - pow(1.0 - uSettle, 3.0);
  vec3  p = mix(position + aOffset, position, e);
  gl_Position  = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = 2.8;
  vOpacity     = uOpacity;
}
