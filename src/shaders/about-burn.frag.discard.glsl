{
  // ── Paper-burn dissolve: top → bottom ─────────────────────────────
  // Noisy threshold creates the ragged burning-paper edge
  float _bNoise = _bf(vec2(vBurnWorldY * 5.5, uBurnTime * 0.45)) * uBurnEdge * 1.9
                + _bn(vec2(vBurnWorldY * 13.0, uBurnTime * 0.35)) * uBurnEdge * 0.6;
  float _threshold = uBurnY + _bNoise;
  // Above threshold = burned away → discard
  if (vBurnWorldY > _threshold) discard;
  // Edge proximity: 0=far from edge, 1=right at edge
  float _edgeT = clamp((_threshold - vBurnWorldY) / uBurnEdge, 0.0, 1.0);
  float _atEdge = 1.0 - _edgeT;   // 1=at burn front, 0=far inside
  // Cyan core → gold/orange outer flame (like the iris transition shader)
  vec3  _fCyan  = vec3(0.0, 0.85, 1.0);
  vec3  _fGold  = vec3(1.0, 0.82, 0.05);
  vec3  _fEdge  = mix(_fCyan, _fGold, pow(_atEdge, 0.5));
  float _edgeMix = pow(_atEdge, 1.8) * 0.96;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, _fEdge, _edgeMix);
  // Slightly fade the very edge so it dissolves rather than hard-cuts
  gl_FragColor.a  *= mix(1.0, 0.0, pow(_atEdge, 3.5));
  if (gl_FragColor.a < 0.005) discard;
}
