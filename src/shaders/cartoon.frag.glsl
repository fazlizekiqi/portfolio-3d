// ── Cartoon / cel-shading effect (white-world overlay) ─────────────────────
// Injected just before gl_FragColor output.
// uCartoon: 0.0 = normal look, 1.0 = full cartoon style
//
// Effect stack:
//   1. Saturation boost   – vivid colours that pop on the white background
//   2. Brightness lift    – slight overall lift so nothing goes muddy
//   3. Cel quantisation   – snap luminance into 4 discrete bands (toon shading)
//   4. Outline darkening  – pixels facing away from camera get extra darkened
//      to fake the thick ink-line look without geometry tricks

{
  // ── helpers ──────────────────────────────────────────────────────────────
  vec3 _c = gl_FragColor.rgb;

  // 1. Saturation + brightness lift
  float _lum     = dot(_c, vec3(0.299, 0.587, 0.114));
  float _satBoost = mix(1.0, 2.2, uCartoon);         // pump saturation
  vec3  _vivid   = mix(vec3(_lum), _c, _satBoost);
  _vivid         = mix(_c, _vivid, uCartoon);

  // Slight brightness lift so it doesn't wash out on white
  _vivid += vec3(0.04) * uCartoon;

  // 2. Cel quantisation – 4 bands
  float _v    = dot(_vivid, vec3(0.299, 0.587, 0.114));
  float _band = floor(_v * 4.0) / 4.0;               // snap to 4 steps
  float _bandMix = mix(0.0, 0.55, uCartoon);          // blend amount
  _vivid = mix(_vivid, _vivid * (_band / max(_v, 0.001)), _bandMix);

  // 3. Contrast punch
  _vivid = mix(_vivid, (_vivid - 0.5) * 1.35 + 0.5, uCartoon * 0.5);
  _vivid = clamp(_vivid, 0.0, 1.0);

  gl_FragColor.rgb = _vivid;
}

