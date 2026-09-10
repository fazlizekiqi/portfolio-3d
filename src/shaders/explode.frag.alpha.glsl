float _fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, vExplodeFade);
float _flying = smoothstep(0.0, 0.05, vExplodeFade);
gl_FragColor.a *= mix(1.0, _fade, _flying);
if (gl_FragColor.a < 0.001) discard;

// ── Cartoon effect placeholder (replaced at build time in explode.js) ──────
%%CARTOON_EFFECT%%

