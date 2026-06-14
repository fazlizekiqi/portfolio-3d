precision highp float;

// Fullscreen blueprint grid backdrop — a trimmed variant of blueprint.frag.glsl
// (grid + vignette + brackets only, no image/overlay compositing). Driven by
// gl_FragCoord/uResolution like background.frag.glsl so it reuses background.vert.glsl.

uniform vec2  uResolution;
uniform float uTime;
uniform float uOpacity;

void main() {
    vec2 uv     = gl_FragCoord.xy / uResolution;
    float aspect = uResolution.x / uResolution.y;

    // Grid coords: aspect-correct X so cells stay square, slow vertical drift.
    vec2 guv = vec2(uv.x * aspect, uv.y - uTime * 0.012);

    // ── 1. Deep navy base ─────────────────────────────────────────────────────
    vec3 col = vec3(0.004, 0.040, 0.090);

    // ── 2. Blueprint grid (minor + major) ─────────────────────────────────────
    vec2 gridUv   = guv * vec2(34.0, 20.0);
    vec2 gridFrac = fract(gridUv);
    float minor   = step(0.975, gridFrac.x) + step(0.975, gridFrac.y);
    minor         = clamp(minor, 0.0, 1.0);

    vec2 majorUv   = guv * vec2(8.5, 5.0);
    vec2 majorFrac = fract(majorUv);
    float major    = step(0.96, majorFrac.x) + step(0.96, majorFrac.y);
    major          = clamp(major, 0.0, 1.0);

    col += vec3(0.0, 0.50, 0.72) * minor * 0.060;
    col += vec3(0.0, 0.62, 0.90) * major * 0.120;

    // ── 3. Faint scanline sweep for life ──────────────────────────────────────
    float sweepY = fract(uTime * 0.06);
    float band   = smoothstep(0.06, 0.0, abs(uv.y - sweepY));
    col += vec3(0.0, 0.45, 0.70) * band * 0.05;

    // ── 4. Vignette ───────────────────────────────────────────────────────────
    vec2  vc  = uv - 0.5;
    float vig = 1.0 - dot(vc, vc) * 1.15;
    col      *= clamp(vig, 0.0, 1.0);

    // ── 5. Outer glow border ─────────────────────────────────────────────────
    float brd   = 0.012;
    float edgeX = min(uv.x, 1.0 - uv.x);
    float edgeY = min(uv.y, 1.0 - uv.y);
    float edge  = 1.0 - smoothstep(0.0, brd, min(edgeX, edgeY));
    col = mix(col, vec3(0.0, 0.68, 1.0), edge * 0.45);

    // ── 6. Corner brackets (screen-space lines) ───────────────────────────────
    float bl = 0.045;   // bracket length in uv space
    float bw = 0.004;   // bracket width
    float tl = step(uv.x, bl) * step(uv.y, bw) + step(uv.x, bw) * step(uv.y, bl);
    float tr = step(1.0 - bl, uv.x) * step(uv.y, bw) + step(1.0 - bw, uv.x) * step(uv.y, bl);
    float blc = step(uv.x, bl) * step(1.0 - bw, uv.y) + step(uv.x, bw) * step(1.0 - bl, uv.y);
    float brc = step(1.0 - bl, uv.x) * step(1.0 - bw, uv.y) + step(1.0 - bw, uv.x) * step(1.0 - bl, uv.y);
    float brackets = clamp(tl + tr + blc + brc, 0.0, 1.0);
    col = mix(col, vec3(0.3, 0.92, 1.0), brackets * 0.85);

    gl_FragColor = vec4(col, uOpacity);
}
