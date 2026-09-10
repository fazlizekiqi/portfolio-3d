float ww_hash(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}
float ww_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(ww_hash(i),           ww_hash(i+vec2(1,0)), u.x),
             mix(ww_hash(i+vec2(0,1)), ww_hash(i+vec2(1,1)), u.x), u.y);
}
float ww_fbm(vec2 p) {
  float v=0.0, a=0.5;
  for(int i=0;i<5;i++){ v+=a*ww_noise(p); p=p*2.1+vec2(1.3,1.7); a*=0.5; }
  return v;
}

// 1.0 outside the iris circle, 0.0 inside, feathered at the edge.
float irisOutsideAlpha(vec2 res, float progress, float time) {
  vec2  uv     = gl_FragCoord.xy / res;
  vec2  aspect = vec2(res.x / res.y, 1.0);
  vec2  cent   = (uv - 0.5) * aspect;
  float dist   = length(cent);
  float maxD   = length(vec2(0.5 * aspect.x, 0.5));

  float eased = progress * progress * (3.0 - 2.0 * progress);

  float sinA = cent.y / max(dist, 0.0001);
  float cosA = cent.x / max(dist, 0.0001);
  vec2  nUV  = vec2(cosA * 0.8 + sinA * 0.6, dist * 2.5) + vec2(time*0.6, time*0.4);

  float edgeW = 0.055 * maxD;
  float warp  = ww_fbm(nUV * 3.0 + time * 0.3) * 2.0 - 1.0;
  float radius = eased * maxD * 1.08
               + warp * edgeW * 1.6
               * smoothstep(0.0, 0.1, eased)
               * smoothstep(1.0, 0.9, eased);
  // Prevent inverted smoothstep ranges when the iris is fully closed.
  radius = max(radius, 0.0);

  float feather = edgeW * 2.5;
  float alpha   = smoothstep(radius - feather * 0.3, radius + feather, dist);
  alpha *= 1.0 - smoothstep(0.88, 1.0, eased);
  // When iris is fully closed (eased=0) everything must be fully visible (alpha=1).
  // The feather around radius=0 would produce <1 near screen centre, so we
  // blend toward 1 as eased approaches 0.
  alpha = mix(1.0, alpha, smoothstep(0.0, 0.04, eased));
  return alpha;
}

