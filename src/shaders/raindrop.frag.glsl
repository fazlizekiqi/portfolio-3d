// raindrop.frag.glsl — fragment shader for raindrop bubble spheres
precision highp float;

uniform float uTime;
uniform vec3  uColor;     // group accent colour
uniform float uOpacity;
uniform vec2  uResolution;

varying vec3  vNormal;
varying vec3  vViewDir;
varying vec2  vUv;
varying vec3  vWorldPos;

// ── Noise helpers ─────────────────────────────────────────────────────────────
float hash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash(i),            hash(i + vec2(1,0)), u.x),
        mix(hash(i + vec2(0,1)),hash(i + vec2(1,1)), u.x),
        u.y
    );
}

// ── Small circular raindrop at position c, radius r ──────────────────────────
float dropCircle(vec2 uv, vec2 c, float r) {
    return smoothstep(r, r * 0.6, length(uv - c));
}

// ── Raindrop trail (elongated teardrop) ───────────────────────────────────────
float dropTrail(vec2 uv, vec2 c, float t) {
    vec2 d  = uv - c;
    float len = length(d);
    // tail stretches upward
    float tail = smoothstep(0.0, 0.12, d.y) * (1.0 - smoothstep(0.12, 0.28, d.y));
    float wide = smoothstep(0.025, 0.0, abs(d.x) - 0.012 * (1.0 - d.y / 0.28));
    return tail * wide * smoothstep(0.0, 0.3, t);
}

void main() {
    vec2 uv = vUv;  // 0..1

    // ── Fresnel rim ──────────────────────────────────────────────────────────
    float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.5);

    // ── Base: dark water interior ─────────────────────────────────────────────
    vec3 deepWater  = vec3(0.01, 0.06, 0.14);
    vec3 shallowWater = uColor * 0.55;
    vec3 baseColor  = mix(deepWater, shallowWater, fresnel * 0.7 + 0.15);

    // ── Caustic shimmer ───────────────────────────────────────────────────────
    float caustic = noise(uv * 6.0 + vec2(uTime * 0.18, uTime * 0.11));
    caustic      *= noise(uv * 11.0 - vec2(uTime * 0.09, uTime * 0.22));
    caustic       = pow(caustic, 2.5) * 0.5;
    baseColor    += uColor * caustic;

    // ── Raindrop layer — several animated drops sliding down the sphere ───────
    float dropMask = 0.0;
    float trailMask = 0.0;

    // 6 independent drops with different columns & speeds
    for (int i = 0; i < 6; i++) {
        float fi    = float(i);
        float col   = fract(fi * 0.1732 + 0.07);          // X position 0..1
        float speed = 0.18 + fract(fi * 0.3141) * 0.22;
        float phase = fract(fi * 0.6180);
        // drops fall top→bottom (uv.y = 1 top, 0 bottom on sphere front)
        float y     = 1.0 - fract(uTime * speed + phase);

        vec2  center = vec2(col, y);
        float r      = 0.030 + fract(fi * 0.2341) * 0.018;

        dropMask  = max(dropMask,  dropCircle(uv, center, r));
        trailMask = max(trailMask, dropTrail(uv, center + vec2(0.0, r * 1.2), fract(uTime * speed + phase)));
    }

    // ── Highlight inside each drop (refraction glint) ─────────────────────────
    vec3 dropColor   = mix(baseColor, vec3(0.85, 0.95, 1.0), dropMask * 0.65);
    dropColor       += vec3(0.9, 1.0, 1.0) * dropMask * 0.3;
    dropColor        = mix(dropColor, vec3(0.7, 0.9, 1.0) * 0.6, trailMask * 0.4);

    // ── Top specular glint ────────────────────────────────────────────────────
    float glint = smoothstep(0.55, 0.80, vUv.y) * smoothstep(0.62, 0.50, abs(vUv.x - 0.38));
    glint      *= pow(max(dot(vNormal, vViewDir), 0.0), 6.0) * 1.2;
    dropColor  += vec3(1.0) * glint;

    // ── Rim glow using accent colour ──────────────────────────────────────────
    dropColor += uColor * fresnel * 0.65;

    // ── Accent border ring ────────────────────────────────────────────────────
    // Use distance from sphere edge (fresnel) as a border
    float border = smoothstep(0.55, 0.75, fresnel);
    dropColor    = mix(dropColor, uColor, border * 0.5);

    // ── Label area: slightly more opaque in sphere centre ─────────────────────
    float dist = length(vUv - 0.5) * 2.0;          // 0 at centre, 1 at edge
    float alpha = uOpacity * mix(0.82, 0.40, dist);
    alpha       = mix(alpha, uOpacity * 0.95, border);

    gl_FragColor = vec4(dropColor, alpha);
}

