varying float vOpacity;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  if (dot(uv,uv) > 0.25) discard;
  gl_FragColor = vec4(0.0, 0.85, 1.0, vOpacity);
}
