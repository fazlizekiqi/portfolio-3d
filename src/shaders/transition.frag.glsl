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
  // Clamp radius to 0 so that when the iris is fully closed the smoothstep
  // ranges never invert and produce a phantom glow at the screen centre.
  radius = max(radius, 0.0);

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

