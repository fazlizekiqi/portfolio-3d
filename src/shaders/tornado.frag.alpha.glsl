// Fade out only during the arrival phase (vTornadoFade near 1.0)
float _tFade   = 1.0 - smoothstep(uFadeStart, uFadeEnd, vTornadoFade);
float _tFlying = smoothstep(0.0, 0.05, vTornadoFade);
gl_FragColor.a *= mix(1.0, _tFade, _tFlying);
if (gl_FragColor.a < 0.001) discard;
