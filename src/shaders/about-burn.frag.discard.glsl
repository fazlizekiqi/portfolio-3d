{
  // ── Dissolve / reveal boundary ────────────────────────────────────
  // Noisy threshold gives the ragged burning-paper edge. During the
  // reconstruction (outro) the noise is reduced so the scan plane reads
  // as a clean reveal boundary rather than a ragged burn.
  float _noiseAmp = (uReconstruct > 0.5) ? 0.3 : 1.0;
  float _bNoise = (_bf(vec2(vBurnWorldY * 5.5,  uBurnTime * 0.45)) * 1.9
                 + _bn(vec2(vBurnWorldY * 13.0, uBurnTime * 0.35)) * 0.6) * uBurnEdge * _noiseAmp;
  float _threshold = uBurnY + _bNoise;
  // Above threshold = not yet built / burned away → discard
  if (vBurnWorldY > _threshold) discard;

  float _below  = _threshold - vBurnWorldY;          // distance below the front
  float _edgeT  = clamp(_below / uBurnEdge, 0.0, 1.0);
  float _atEdge = 1.0 - _edgeT;                       // 1=at front, 0=far inside

  if (uReconstruct > 0.5) {
    // ── Reconstruction: bottom-up materialization (hologram → solid) ──
    // A slice just below the scan front starts holographic-cyan and
    // settles into the real shaded colour over uBuildBand world-units,
    // so the character feels printed/assembled rather than just appearing.
    float _b    = clamp(_below / uBuildBand, 0.0, 1.0);   // 0=front, 1=solid
    float _scan = 0.5 + 0.5 * sin(vBurnWorldY * 80.0 - uBurnTime * 6.0);
    vec3  _holo = vec3(0.25, 0.95, 1.0) * (0.55 + 0.55 * _scan);
    gl_FragColor.rgb = mix(_holo, gl_FragColor.rgb, _b);
    // Bright construction line riding the very front
    float _line = 1.0 - smoothstep(0.0, uBurnEdge * 1.2, _below);
    gl_FragColor.rgb += vec3(0.45, 0.90, 1.0) * _line * 1.4;
    // Soft fade-in over the first sliver so the new geometry eases in
    gl_FragColor.a *= mix(0.2, 1.0, clamp(_below / (uBurnEdge * 0.8), 0.0, 1.0));
  } else {
    // ── Burn / dissolve (intro): cyan core → gold/orange outer flame ──
    vec3  _fCyan  = vec3(0.0, 0.85, 1.0);
    vec3  _fGold  = vec3(1.0, 0.82, 0.05);
    vec3  _fEdge  = mix(_fCyan, _fGold, pow(_atEdge, 0.5));
    float _edgeMix = pow(_atEdge, 1.8) * 0.96;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, _fEdge, _edgeMix);
    // Slightly fade the very edge so it dissolves rather than hard-cuts
    gl_FragColor.a  *= mix(1.0, 0.0, pow(_atEdge, 3.5));
  }
  if (gl_FragColor.a < 0.005) discard;
}
