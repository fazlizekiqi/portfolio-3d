precision highp float;

uniform sampler2D uImage;    // project screenshot
uniform sampler2D uOverlay;  // text / UI canvas (transparent bg)
uniform float     uTime;
uniform float     uOpacity;
uniform float     uHasImage; // 1.0 = has image, 0.0 = no image

varying vec2 vUv;

void main() {
    vec2 uv = vUv;

    // ── 1. Deep navy base ─────────────────────────────────────────────────────
    vec3 col = vec3(0.004, 0.059, 0.122);

    // ── 2. Blueprint grid ─────────────────────────────────────────────────────
    vec2 gridUv   = uv * vec2(24.0, 16.0);          // minor grid density
    vec2 gridFrac = fract(gridUv);
    float minor   = step(0.97, gridFrac.x) + step(0.97, gridFrac.y);
    minor         = clamp(minor, 0.0, 1.0);

    vec2 majorUv  = uv * vec2(6.0, 4.0);
    vec2 majorFrac = fract(majorUv);
    float major   = step(0.95, majorFrac.x) + step(0.95, majorFrac.y);
    major         = clamp(major, 0.0, 1.0);

    col += vec3(0.0, 0.55, 0.75) * minor * 0.09;
    col += vec3(0.0, 0.65, 0.90) * major * 0.17;

    // ── 3. Project image (right ~58% of card) ─────────────────────────────────
    float imgStartU = 0.40;
    if (uHasImage > 0.5 && uv.x > imgStartU) {
        // Remap uv into image area
        vec2 imgUv = vec2(
            (uv.x - imgStartU) / (1.0 - imgStartU),
            uv.y
        );
        // Clamp with small inset border
        float brd = 0.025;
        if (imgUv.x > brd && imgUv.x < 1.0 - brd &&
            imgUv.y > brd && imgUv.y < 1.0 - brd) {

            vec2 sampleUv = imgUv;   // flipY=true on TextureLoader — no manual flip needed
            vec4 photo    = texture2D(uImage, sampleUv);

            // Desaturate
            float lum  = dot(photo.rgb, vec3(0.299, 0.587, 0.114));
            vec3  grey = vec3(lum);

            // Blueprint tint: map grey to dark-navy → cyan
            vec3  dark  = vec3(0.004, 0.06, 0.18);
            vec3  light = vec3(0.55,  0.88, 1.00);
            vec3  tinted = mix(dark, light, lum * 0.85 + 0.08);

            // Slight blue hue add
            tinted += vec3(0.0, 0.06, 0.14) * (1.0 - lum);

            // Scan lines
            float scan = step(0.5, fract(imgUv.y * 80.0));
            tinted *= 0.88 + 0.12 * scan;

            // Blend over grid base
            col = mix(col, tinted, 0.92);

            // Thin cyan border at image edges
            float edgeDist = min(min(imgUv.x - brd, 1.0 - brd - imgUv.x),
                                 min(imgUv.y - brd, 1.0 - brd - imgUv.y));
            float border = 1.0 - smoothstep(0.0, 0.012, edgeDist);
            col = mix(col, vec3(0.0, 0.78, 1.0), border * 0.7);
        }
    }

    // ── 4. Vignette ───────────────────────────────────────────────────────────
    vec2  vc   = uv - 0.5;
    float vig  = 1.0 - dot(vc, vc) * 1.2;
    col       *= clamp(vig, 0.0, 1.0);

    // ── 5. Outer glow border ─────────────────────────────────────────────────
    float brd2 = 0.018;
    float edgeX = min(uv.x, 1.0 - uv.x);
    float edgeY = min(uv.y, 1.0 - uv.y);
    float edge  = 1.0 - smoothstep(0.0, brd2, min(edgeX, edgeY));
    col = mix(col, vec3(0.0, 0.72, 1.0), edge * 0.55);

    // ── 6. Overlay (text canvas) ──────────────────────────────────────────────
    vec4 ov = texture2D(uOverlay, uv);   // CanvasTexture flipY=true — no manual flip
    col     = mix(col, ov.rgb, ov.a);

    // ── 7. Corner brackets (screen-space lines) ───────────────────────────────
    float bl = 0.08;                           // bracket length in uv space
    float bw = 0.007;                          // bracket width
    // top-left
    float tlX = step(uv.x, bl) * step(uv.y, bw) + step(uv.x, bw) * step(uv.y, bl);
    // top-right
    float trX = step(1.0 - bl, uv.x) * step(uv.y, bw) + step(1.0 - bw, uv.x) * step(uv.y, bl);
    // bottom-left
    float blX = step(uv.x, bl) * step(1.0 - bw, uv.y) + step(uv.x, bw) * step(1.0 - bl, uv.y);
    // bottom-right
    float brX = step(1.0 - bl, uv.x) * step(1.0 - bw, uv.y) + step(1.0 - bw, uv.x) * step(1.0 - bl, uv.y);
    float brackets = clamp(tlX + trX + blX + brX, 0.0, 1.0);
    col = mix(col, vec3(0.3, 0.92, 1.0), brackets * 0.9);

    gl_FragColor = vec4(col, uOpacity);
}

