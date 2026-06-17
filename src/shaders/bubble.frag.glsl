uniform vec3  uColor;
uniform float uOpacity;
uniform float uTime;
varying vec3  vNormal;
varying vec3  vViewDir;

// Blue-world iridescence: deep navy → cyan → teal → ice blue
vec3 blueIrid(float h) {
  h = mod(h, 1.0) * 4.0;
  vec3 navy  = vec3(0.02, 0.08, 0.28);
  vec3 cyan  = vec3(0.0,  0.80, 1.0);
  vec3 teal  = vec3(0.0,  0.90, 0.82);
  vec3 ice   = vec3(0.65, 0.88, 1.0);
  if (h < 1.0) return mix(navy, cyan, h);
  if (h < 2.0) return mix(cyan, teal, h - 1.0);
  if (h < 3.0) return mix(teal, ice,  h - 2.0);
  return mix(ice, navy, h - 3.0);
}

void main() {
  float ndv     = abs(dot(vNormal, vViewDir));
  float fresnel = pow(1.0 - ndv, 2.5);

  // Thin-film shift: varies across surface + drifts slowly over time
  float film = dot(vNormal, vec3(0.3, 0.7, 0.4)) * 0.5 + 0.5;
  float hue  = film * 1.0 + uTime * 0.06;
  vec3  irid = blueIrid(hue);

  // Blend group accent into the iridescence
  vec3  col  = mix(uColor * 1.2, irid, 0.55);

  // Rim glows bright, centre is nearly transparent — soap bubble look
  float alpha = (fresnel * 0.88 + 0.03) * uOpacity;
  gl_FragColor = vec4(col * (0.5 + fresnel * 1.2), alpha);
}
