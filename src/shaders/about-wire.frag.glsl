uniform float uOpacity;
uniform float uTime;
uniform float uClipY;   // same boundary as hologram uClipY
varying vec3  vWorldPos;

void main() {
  if (uOpacity <= 0.001) discard;
  if (vWorldPos.y < uClipY) discard;   // sync with burn / reveal front

  float y = vWorldPos.y;

  // Two flowing current bands moving up the body
  float f1  = fract(y * 2.5 - uTime * 1.6);
  float b1  = pow(1.0 - clamp(abs(f1 - 0.5) * 5.0, 0.0, 1.0), 3.0);

  float f2  = fract(y * 5.0 - uTime * 3.0);
  float b2  = pow(1.0 - clamp(abs(f2 - 0.5) * 8.0, 0.0, 1.0), 3.0) * 0.5;

  float total = b1 + b2;

  // Colour: dim-cyan → bright-cyan → near-white
  vec3 c0 = vec3(0.00, 0.40, 0.75);
  vec3 c1 = vec3(0.00, 0.75, 1.00);
  vec3 c2 = vec3(0.70, 0.93, 1.00);

  vec3 col = mix(c0, c1, clamp(total,       0.0, 1.0));
  col      = mix(col, c2, clamp(total - 1.0, 0.0, 1.0));

  float alpha = (0.20 + clamp(total, 0.0, 1.0) * 0.50) * uOpacity;
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
