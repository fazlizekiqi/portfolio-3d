uniform float uOpacity;
varying vec2 vUv;
void main() {
  float cy    = abs(vUv.y - 0.5) * 2.0;
  float cx    = abs(vUv.x - 0.5) * 2.0;
  float edgeX = 1.0 - smoothstep(0.55, 1.0, cx);
  float core  = pow(1.0 - cy, 3.0);
  float flame = pow(1.0 - cy, 9.0);
  vec3 col = mix(vec3(0.0,0.30,0.80), vec3(0.0,0.85,1.0), core);
  col      = mix(col, vec3(0.95,0.97,1.0), flame * 0.85);
  float alpha = (core * 0.88 + flame * 0.12) * edgeX * uOpacity;
  gl_FragColor = vec4(col, alpha);
}
