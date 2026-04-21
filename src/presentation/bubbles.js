/**
 * bubbles.js — Floating skill & project bubbles rendered as Three.js objects.
 *
 * Skill bubbles:  3D spheres arranged in a parabolic arch BEHIND the character
 *                 (negative Z) so they naturally sit behind the character mesh.
 * Project cards:  3D planes flanking and behind the character.
 *
 * Exports
 * ───────
 *   showSkillBubbles()
 *   showProjectBubbles()
 *   hideBubbles()
 *   tickBubbles(delta, elapsed)   ← call from the animation loop
 */

import * as THREE from 'three';
import { scene, camera, renderer } from '../scene.js';
import { LAYER } from '../layers.js';
import RAINDROP_VERT from '../shaders/raindrop.vert.glsl?raw';
import RAINDROP_FRAG from '../shaders/raindrop.frag.glsl?raw';
import BLUEPRINT_VERT from '../shaders/blueprint.vert.glsl?raw';
import BLUEPRINT_FRAG from '../shaders/blueprint.frag.glsl?raw';

// ── Data ──────────────────────────────────────────────────────────────────────
const SKILL_ITEMS = [
    {label: 'Java',          group: 'backend'},
    {label: 'Spring Boot',   group: 'backend'},
    {label: 'Kafka',         group: 'backend'},
    {label: 'Quarkus',       group: 'backend'},
    {label: 'REST APIs',     group: 'backend'},
    {label: 'Microservices', group: 'backend'},
    {label: 'Angular',       group: 'frontend'},
    {label: 'TypeScript',    group: 'frontend'},
    {label: 'Three.js',      group: 'frontend'},
    {label: '3D Graphics',   group: 'frontend'},
    {label: 'PostgreSQL',    group: 'data'},
    {label: 'MongoDB',       group: 'data'},
    {label: 'Redis',         group: 'data'},
    {label: 'Git',           group: 'tooling'},
    {label: 'GitHub',        group: 'tooling'},
    {label: 'Bash',          group: 'tooling'},
    {label: 'JIRA',          group: 'tooling'},
    {label: 'GCP',           group: 'cloud'},
    {label: 'AWS',           group: 'cloud'},
    {label: 'Docker',        group: 'cloud'},
    {label: 'Kubernetes',    group: 'cloud'},
    {label: 'OpenShift',     group: 'cloud'},
    {label: 'ArgoCD',        group: 'cloud'},
    {label: 'GitOps',        group: 'cloud'},
    {label: 'CI/CD',         group: 'cloud'},
    {label: 'Helm',          group: 'cloud'},
    {label: 'Terraform',     group: 'cloud'},
    {label: 'AI / ML',       group: 'ai'},
    {label: 'Vertex AI',     group: 'ai'},
];

const _base = import.meta.env.BASE_URL.replace(/\/$/, ''); // e.g. '/portfolio-3d' or ''

const PROJECT_ITEMS = [
    {label: 'EnVar',              sub: 'IntelliJ plugin · 26 900+ downloads',     url: 'https://plugins.jetbrains.com/plugin/26912-envar',               img: `${_base}/projects/envar.png`},
    {label: 'Dino Card Collector',sub: 'Location-based web game for families',    url: 'https://fazlizekiqi.github.io/dinosaur-card-collector',         img: `${_base}/projects/dinosaur-card-collector.png`},
    {label: 'MPlayer',            sub: 'YouTube-backed CLI music player',         url: 'https://github.com/fazlizekiqi/mplayer',                         img: `${_base}/projects/mplayer.png`},
    {label: 'K8s Application',    sub: 'GKE · Terraform · Cert-Manager · Helm',  url: 'https://github.com/fazlizekiqi/k8s-application',                 img: `${_base}/projects/k8s.png`},
    {label: 'Train with Mii',     sub: 'AI-powered exam trainer with flashcards', url: 'https://fazlizekiqi.github.io/train-with-mii/flashcards',                  img: `${_base}/projects/train-with-mii.png`},
    {label: 'Tradita Grill',      sub: 'Static site for a restaurant',            url: 'https://traditagrill.ch/',                                       img: `${_base}/projects/tradita-grill.png`},
    {label: 'Clips',              sub: 'Static portfolio showcase site',          url: 'https://fazlizekiqi.github.io/clips/',                           img: `${_base}/projects/clips.png`},
    {label: 'Birthday Party',     sub: 'Birthday party planning web app',         url: 'https://fazlizekiqi.github.io/pokemon-bingo/',                  img: `${_base}/projects/birthday-party.png`},
    {label: 'Kafka Connect',      sub: 'Kafka Connect pipeline & integrations',   url: 'https://github.com/fazlizekiqi/kafka-connect-local',                   img: `${_base}/projects/kafka-connect.png`},
];

const GROUP_COLOR = {
    backend:  {hex: 0x00bbdd, css: '#00bbdd', glow: 'rgba(0,187,221,0.55)',   icon: '⚙'},
    frontend: {hex: 0x2ecfaa, css: '#2ecfaa', glow: 'rgba(46,207,170,0.55)',  icon: '◈'},
    cloud:    {hex: 0x4488ee, css: '#4488ee', glow: 'rgba(68,136,238,0.55)',  icon: '⬡'},
    data:     {hex: 0x6699cc, css: '#6699cc', glow: 'rgba(102,153,204,0.55)', icon: '◉'},
    tooling:  {hex: 0xcc88ff, css: '#cc88ff', glow: 'rgba(200,136,255,0.55)', icon: '⌥'},
    ai:       {hex: 0xff9944, css: '#ff9944', glow: 'rgba(255,153,68,0.55)',  icon: '◎'},
};

// ── Layout params (tweakable via GUI) ─────────────────────────────────────────
export const skillLayoutParams = { offsetX: 0, offsetY: 0, spread: 1.0 };

// ── Mobile helpers ────────────────────────────────────────────────────────────
function _isMobile() { return window.innerWidth < 768; }
function _bubbleScale()  { return _isMobile() ? 0.75 : 1.0; }
// Mobile cards: smaller scale so 3 columns fit comfortably on 375px-wide screens
function _cardScale()    { return _isMobile() ? 0.72 : 1.0; }

// ── Project image preloader — use THREE.TextureLoader (reliable, GPU-native) ──
const _texLoader  = new THREE.TextureLoader();
const _imgTextures = new Map();   // img path → Promise<THREE.Texture|null>

PROJECT_ITEMS.forEach(item => {
    if (!item.img) return;
    const p = new Promise(resolve => {
        _texLoader.load(
            item.img,
            tex  => { _imgTextures.set(item.img, tex); resolve(tex); },
            undefined,
            ()   => { console.warn('[bubbles] texture failed:', item.img); resolve(null); }
        );
    });
    _imgTextures.set(item.img, p);   // store Promise first, replaced by Texture on load
});

// ── State ─────────────────────────────────────────────────────────────────────
/** @type {Array<{mesh:THREE.Mesh, basePos:THREE.Vector3, seed:number, item:object, isProject:boolean, rising:boolean, riseTime:number, riseDelay:number}>} */
let _entries   = [];
let _orbitAngle = 0;          // global spinning angle for mobile project orbit
const ORBIT_R_X      = 1.75;   // horizontal sway — wider spread around character
const ORBIT_R_Y      = 2.25;   // vertical travel (tall Ferris-wheel arc)
const ORBIT_Z        = 0.8;   // fixed depth — always in front of character
const ORBIT_CENTER_Y = 0.3;   // world Y of orbit centre (character torso)
const ORBIT_SPEED    = 0.05;  // radians/second — slow, smooth rotation
let _raycaster = new THREE.Raycaster();
_raycaster.layers.enable(LAYER.BLUE);   // bubbles live on layer 1
let _mouse     = new THREE.Vector2(-9999, -9999);
let _listening = false;

// ── Canvas Texture helpers ────────────────────────────────────────────────────

function _makeLabelTexture(label, groupKey) {
    const c  = GROUP_COLOR[groupKey] ?? GROUP_COLOR.tooling;
    const SZ = 768;                          // higher resolution for crisp text on mobile
    const cv = document.createElement('canvas');
    cv.width = cv.height = SZ;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, SZ, SZ);

    const cx = SZ / 2, cy = SZ / 2;

    // ── Icon ──────────────────────────────────────────────────────────────────
    ctx.font         = '160px serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = c.css;
    ctx.shadowColor  = c.glow;
    ctx.shadowBlur   = 30;
    ctx.fillText(c.icon, cx, cy - 110);
    ctx.shadowBlur = 0;

    // ── Label: dark pill background first ─────────────────────────────────────
    const words    = label.split(' ');
    const fontSize = label.length > 10 ? 64 : 72;
    ctx.font       = `700 ${fontSize}px "Courier New", monospace`;
    ctx.textBaseline = 'middle';

    // measure lines
    const lines = [];
    if (words.length > 1 && label.length > 10) {
        const half = Math.ceil(words.length / 2);
        lines.push(words.slice(0, half).join(' '));
        lines.push(words.slice(half).join(' '));
    } else {
        lines.push(label);
    }

    const lineH  = fontSize + 8;
    const startY = cy + 62;

    // draw pill behind each line
    lines.forEach((line, li) => {
        const w   = ctx.measureText(line).width + 24;
        const h   = lineH + 6;
        const lx  = cx - w / 2;
        const ly  = startY + li * (lineH + 4) - h / 2;
        const r   = h / 2;
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.beginPath();
        ctx.moveTo(lx + r, ly);
        ctx.lineTo(lx + w - r, ly);
        ctx.quadraticCurveTo(lx + w, ly, lx + w, ly + r);
        ctx.lineTo(lx + w, ly + h - r);
        ctx.quadraticCurveTo(lx + w, ly + h, lx + w - r, ly + h);
        ctx.lineTo(lx + r, ly + h);
        ctx.quadraticCurveTo(lx, ly + h, lx, ly + h - r);
        ctx.lineTo(lx, ly + r);
        ctx.quadraticCurveTo(lx, ly, lx + r, ly);
        ctx.closePath();
        ctx.fill();
    });

    // draw text on top of pills — stroke first for crisp outline, then fill
    ctx.lineJoin    = 'round';
    ctx.lineWidth   = 14;
    ctx.strokeStyle = 'rgba(0,0,0,1.0)';
    lines.forEach((line, li) => {
        ctx.strokeText(line, cx, startY + li * (lineH + 4));
    });
    ctx.fillStyle    = '#ffffff';
    ctx.shadowColor  = 'rgba(0,220,255,0.8)';
    ctx.shadowBlur   = 12;
    lines.forEach((line, li) => {
        ctx.fillText(line, cx, startY + li * (lineH + 4));
    });
    ctx.shadowBlur = 0;

    return new THREE.CanvasTexture(cv);
}


/**
 * Mobile: draws a full opaque card onto a canvas — no shader compositing needed.
 * Solid dark background + large bold white title + coloured sub-text.
 * Returned as a CanvasTexture used directly with MeshBasicMaterial.
 */
function _makeProjectCardMobile(item, imgTex) {
    const { label, sub } = item;
    const W = 800, H = 540;          // high-res, aspect ≈ 2:1.35
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    // ── Background ────────────────────────────────────────────────────────────
    ctx.fillStyle = '#020d1e';
    ctx.fillRect(0, 0, W, H);

    // Subtle blueprint grid
    ctx.strokeStyle = 'rgba(0,160,220,0.12)';
    ctx.lineWidth   = 1;
    const COLS = 16, ROWS = 11;
    for (let c = 0; c <= COLS; c++) {
        const x = (c / COLS) * W;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
        const y = (r / ROWS) * H;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // ── Project image on the right half (if available) ────────────────────────
    if (imgTex && imgTex.image) {
        const imgX = Math.round(W * 0.44);
        const imgW = W - imgX - 10;
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.drawImage(imgTex.image, imgX, 8, imgW, H - 16);
        ctx.restore();
        // Fade left edge of image so text side stays clean
        const fade = ctx.createLinearGradient(imgX, 0, imgX + imgW * 0.45, 0);
        fade.addColorStop(0, 'rgba(2,13,30,1)');
        fade.addColorStop(1, 'rgba(2,13,30,0)');
        ctx.fillStyle = fade;
        ctx.fillRect(imgX, 0, imgW, H);
    }

    // ── Cyan accent border ────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(0,200,255,0.55)';
    ctx.lineWidth   = 3;
    ctx.strokeRect(4, 4, W - 8, H - 8);

    // ── Title ─────────────────────────────────────────────────────────────────
    const TEXT_X   = 28;
    const MAX_TW   = Math.round(W * 0.40);
    const titleFS  = label.length > 14 ? 62 : 72;
    ctx.font        = `800 ${titleFS}px "Courier New", monospace`;
    ctx.textAlign   = 'left';
    ctx.textBaseline = 'alphabetic';

    // Word-wrap title
    const titleLines = [];
    let cur = '';
    for (const w of label.split(' ')) {
        const test = cur ? cur + ' ' + w : w;
        if (ctx.measureText(test).width > MAX_TW) { titleLines.push(cur); cur = w; }
        else cur = test;
    }
    if (cur) titleLines.push(cur);

    const titleLineH = titleFS + 10;
    const titleStartY = 80;

    titleLines.forEach((ln, li) => {
        const y = titleStartY + li * titleLineH;
        // Dark halo for contrast
        ctx.strokeStyle = 'rgba(0,0,0,0.95)';
        ctx.lineWidth   = 12;
        ctx.lineJoin    = 'round';
        ctx.strokeText(ln, TEXT_X, y);
        // Glow
        ctx.shadowColor  = 'rgba(0,220,255,0.85)';
        ctx.shadowBlur   = 20;
        ctx.fillStyle    = '#ffffff';
        ctx.fillText(ln, TEXT_X, y);
        ctx.shadowBlur   = 0;
    });

    // ── Sub-text ──────────────────────────────────────────────────────────────
    if (sub) {
        const subY  = titleStartY + titleLines.length * titleLineH + 18;
        const subFS = 28;
        ctx.font      = `600 ${subFS}px "Courier New", monospace`;
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineWidth   = 8;
        ctx.lineJoin    = 'round';
        // word-wrap sub too
        const subLines = [];
        let sc2 = '';
        for (const w of sub.split(' ')) {
            const test = sc2 ? sc2 + ' ' + w : w;
            if (ctx.measureText(test).width > MAX_TW - 10) { subLines.push(sc2); sc2 = w; }
            else sc2 = test;
        }
        if (sc2) subLines.push(sc2);
        subLines.forEach((ln, li) => {
            const y = subY + li * (subFS + 8);
            ctx.strokeText(ln, TEXT_X, y);
            ctx.shadowColor = 'rgba(0,200,255,0.7)';
            ctx.shadowBlur  = 10;
            ctx.fillStyle   = '#55eeff';
            ctx.fillText(ln, TEXT_X, y);
            ctx.shadowBlur  = 0;
        });
    }

    // ── "↗ OPEN" hint ─────────────────────────────────────────────────────────
    ctx.font        = `700 26px "Courier New", monospace`;
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineWidth   = 7;
    ctx.strokeText('↗ OPEN PROJECT', TEXT_X, H - 22);
    ctx.shadowColor = 'rgba(0,200,255,0.9)';
    ctx.shadowBlur  = 12;
    ctx.fillStyle   = '#00ccff';
    ctx.fillText('↗ OPEN PROJECT', TEXT_X, H - 22);
    ctx.shadowBlur  = 0;

    return new THREE.CanvasTexture(cv);
}

/** Builds a transparent canvas with just the text/UI — used as uOverlay in the blueprint shader. */
function _makeProjectOverlay(item) {
    const { label, sub } = item;
    const W = 768, H = 512;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const TEXT_X    = 24;
    const IMG_START = Math.round(W * 0.42);   // must match shader imgStartU * W
    const MAX_W     = IMG_START - TEXT_X - 12;

    // ── Semi-transparent backdrop on the text side so text always pops ────────
    const grad = ctx.createLinearGradient(0, 0, IMG_START, 0);
    grad.addColorStop(0,   'rgba(0,5,18,0.82)');
    grad.addColorStop(0.85,'rgba(0,5,18,0.60)');
    grad.addColorStop(1,   'rgba(0,5,18,0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, IMG_START, H);

    // ── Title ─────────────────────────────────────────────────────────────────
    ctx.font         = '700 44px "Courier New", monospace';
    ctx.fillStyle    = '#ffffff';
    ctx.shadowColor  = 'rgba(0,200,255,1.0)';
    ctx.shadowBlur   = 18;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign    = 'left';
    const titleWords = label.split(' ');
    const titleLines = [];
    let cur = '';
    for (const w of titleWords) {
        const test = cur ? cur + ' ' + w : w;
        if (ctx.measureText(test).width > MAX_W) { titleLines.push(cur); cur = w; }
        else cur = test;
    }
    if (cur) titleLines.push(cur);
    titleLines.forEach((ln, li) => ctx.fillText(ln, TEXT_X, 62 + li * 52));

    // ── Sub-text ──────────────────────────────────────────────────────────────
    const subY = 62 + titleLines.length * 52 + 14;
    ctx.font        = '700 24px "Courier New", monospace';
    ctx.fillStyle   = '#55ddff';
    ctx.shadowColor = 'rgba(0,180,255,0.8)';
    ctx.shadowBlur  = 8;
    const charsPerLine = Math.floor(MAX_W / 14);
    _wrapText(sub, charsPerLine).forEach((ln, li) => {
        ctx.fillText(ln, TEXT_X, subY + li * 30);
    });

    // ── "↗ OPEN" link at the bottom ───────────────────────────────────────────
    ctx.font        = '700 22px "Courier New", monospace';
    ctx.fillStyle   = '#00ccff';
    ctx.shadowColor = 'rgba(0,200,255,0.9)';
    ctx.shadowBlur  = 10;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('↗ OPEN PROJECT', TEXT_X, H - 20);

    return new THREE.CanvasTexture(cv);
}


function _wrapText(text, maxLen) {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
        if ((cur + w).length > maxLen) { lines.push(cur.trim()); cur = ''; }
        cur += w + ' ';
    }
    if (cur.trim()) lines.push(cur.trim());
    return lines;
}

// ── 3-D layout helpers ────────────────────────────────────────────────────────
// Bubbles sit at z ≈ BUBBLE_Z (behind the character which is at z=0).
// We unproject the camera frustum at that depth to get the visible rect,
// then scatter bubbles to fill it edge-to-edge.

const BUBBLE_Z = -1.5;

/** Returns the half-width and half-height visible at a world-Z plane. */
function _frustumExtents(worldZ) {
    // camera is at ~z=7.2, looking roughly at y=0.9
    const camZ     = camera.position.z;
    const dist     = camZ - worldZ;                          // always positive
    const halfH    = Math.tan((camera.fov * 0.5) * Math.PI / 180) * dist;
    const halfW    = halfH * camera.aspect;
    const centerY  = camera.position.y + (camera.getWorldDirection(new THREE.Vector3()).y * dist);
    return { halfW, halfH, centerY };
}

function _skillPositions(n) {
    const { offsetX, offsetY, spread } = skillLayoutParams;
    const { halfW, halfH, centerY } = _frustumExtents(BUBBLE_Z);

    // Usable rect (leave a small margin so bubbles don't clip at edges)
    const marginX = 0.5, marginY = 0.4;
    const W = (halfW - marginX) * spread;
    const H = (halfH - marginY) * spread;

    // Use a seeded pseudo-random scatter so layout is deterministic
    const pts = [];
    for (let i = 0; i < n; i++) {
        const sx = fract(Math.sin(i * 127.1 + 31.7) * 43758.5) * 2 - 1;   // -1..1
        const sy = fract(Math.sin(i * 311.7 + 74.2) * 43758.5) * 2 - 1;
        const sz = fract(Math.sin(i * 73.1  + 19.9) * 43758.5);            // 0..1
        const x  = sx * W + offsetX * 0.1;
        const y  = centerY + sy * H + offsetY * 0.1;
        const z  = BUBBLE_Z - sz * 0.8;   // vary depth a little
        pts.push(new THREE.Vector3(x, y, z));
    }

    // Collision repulsion — push overlapping bubbles apart
    const MIN_D = 1.0 * _bubbleScale();
    for (let iter = 0; iter < 80; iter++) {
        for (let a = 0; a < pts.length; a++) {
            for (let b = a + 1; b < pts.length; b++) {
                const d = pts[a].distanceTo(pts[b]);
                if (d < MIN_D && d > 0.001) {
                    const push = (MIN_D - d) * 0.5;
                    const dir  = new THREE.Vector3().subVectors(pts[b], pts[a]).normalize();
                    pts[a].addScaledVector(dir, -push);
                    pts[b].addScaledVector(dir,  push);
                }
            }
            // Clamp back into bounds
            pts[a].x = Math.max(-halfW + marginX, Math.min(halfW - marginX, pts[a].x));
            pts[a].y = Math.max(centerY - H,      Math.min(centerY + H,     pts[a].y));
            if (pts[a].z > -0.5) pts[a].z = -0.5;
        }
    }
    return pts;
}

function fract(x) { return x - Math.floor(x); }

function _projectPositions() {

    if (_isMobile()) {
        // Evenly spaced around a vertical ellipse in front of the character.
        // x = sin(a)*R_X  (slight side sway)
        // y = center + cos(a)*R_Y  (big vertical arc — Ferris wheel)
        // z = ORBIT_Z  (constant depth, always in front of character = always visible)
        return Array.from({ length: PROJECT_ITEMS.length }, (_, i) => {
            const a = (i / PROJECT_ITEMS.length) * Math.PI * 2;
            return new THREE.Vector3(
                Math.sin(a) * ORBIT_R_X,
                ORBIT_CENTER_Y + Math.cos(a) * ORBIT_R_Y,
                ORBIT_Z,
            );
        });
    }

    // Desktop — compute from known destination camera
    // camPos=(0,-0.2,8.5)  camTarget=(0,1.8,1.0)  FOV=44°
    const Z_CARDS = 0.8, FOV_DEG = 44;
    const CAM_Z = 8.5, CAM_Y = -0.2, TGT_Y = 1.8, TGT_Z = 1.0;
    const dist   = CAM_Z - Z_CARDS;
    const halfH  = Math.tan((FOV_DEG * 0.5) * Math.PI / 180) * dist;
    const halfW  = halfH * (window.innerWidth / window.innerHeight);
    const dirLen = Math.hypot(TGT_Y - CAM_Y, TGT_Z - CAM_Z);
    const centerY = CAM_Y + ((TGT_Y - CAM_Y) / dirLen) * dist;

    const mX = halfW * 0.78, mY = halfH * 0.82;
    const cY = centerY  , z = Z_CARDS;
    return [
        new THREE.Vector3(-mX * 0.72, cY + mY * 0.82, z),
        new THREE.Vector3( 0.0,       cY + mY,         z),
        new THREE.Vector3( mX * 0.72, cY + mY * 0.82, z),
        new THREE.Vector3(-mX,        cY + mY * 0.38,  z),
        new THREE.Vector3( mX,        cY + mY * 0.38,  z),
        new THREE.Vector3(-mX * 0.78, cY - mY * 0.24,  z),
        new THREE.Vector3( mX * 0.78, cY - mY * 0.24,  z),
        new THREE.Vector3(-mX * 0.42, cY - mY * 0.76,  z),
        new THREE.Vector3( mX * 0.42, cY - mY * 0.76,  z),
    ];
}

// ── Spawn helpers ─────────────────────────────────────────────────────────────

function _spawnSphere(item, pos3, seed) {
    const c   = GROUP_COLOR[item.group] ?? GROUP_COLOR.tooling;
    const sc  = _bubbleScale();
    const geo = new THREE.SphereGeometry(0.44 * sc, 48, 48);
    const mat = new THREE.ShaderMaterial({
        vertexShader:   RAINDROP_VERT,
        fragmentShader: RAINDROP_FRAG,
        uniforms: {
            uTime:    { value: 0 },
            uColor:   { value: new THREE.Color(c.hex) },
            uOpacity: { value: 0 },
        },
        transparent: true,
        depthWrite:  false,
        side: THREE.FrontSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos3); mesh.position.y -= 1.5;
    mesh.layers.set(LAYER.BLUE);

    // label sprite — larger plane so text is clearly readable, especially on mobile
    const labelTex  = _makeLabelTexture(item.label, item.group);
    const labelSize = _isMobile() ? 1.6 * sc : 1.1 * sc;
    const labelGeo  = new THREE.PlaneGeometry(labelSize, labelSize);
    const labelMat  = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, depthWrite: false, opacity: 0 });
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.layers.set(LAYER.BLUE);
    labelMesh.raycast = () => {};   // never intercept raycasts — parent sphere handles them
    mesh.add(labelMesh); // child — moves with sphere

    scene.add(mesh);

    _entries.push({
        mesh, basePos: pos3.clone(), seed, item, isProject: false,
        rising: true, riseTime: 0,
        riseDelay: 0.2 + Math.abs(Math.sin(seed * 47.3 + 1.7)) * 2.2,
        labelMat,
        popping: false, popTime: 0,
    });
}

function _spawnProjectCard(item, pos3, seed, imgTex, idx = 0) {
    const sc = _cardScale();
    const n  = PROJECT_ITEMS.length;

    let mat;
    if (_isMobile()) {
        // ── Mobile: plain MeshBasicMaterial — no shader compositing, max clarity ──
        const cardTex = _makeProjectCardMobile(item, imgTex);
        mat = new THREE.MeshBasicMaterial({
            map:         cardTex,
            transparent: true,
            depthWrite:  false,
            opacity:     0,
            side:        THREE.DoubleSide,
        });
    } else {
        // ── Desktop: blueprint shader ─────────────────────────────────────────
        const overlayTex = _makeProjectOverlay(item);
        const fallbackTex = new THREE.DataTexture(new Uint8Array([0,0,0,0]), 1, 1, THREE.RGBAFormat);
        fallbackTex.needsUpdate = true;
        mat = new THREE.ShaderMaterial({
            vertexShader:   BLUEPRINT_VERT,
            fragmentShader: BLUEPRINT_FRAG,
            uniforms: {
                uImage:    { value: imgTex ?? fallbackTex },
                uOverlay:  { value: overlayTex },
                uTime:     { value: 0 },
                uOpacity:  { value: 0 },
                uHasImage: { value: imgTex ? 1.0 : 0.0 },
            },
            transparent: true,
            depthWrite:  false,
            side: THREE.DoubleSide,
        });
    }

    const W   = 2.0 * sc, H = 1.35 * sc;
    const geo = new THREE.PlaneGeometry(W, H);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos3);
    if (!_isMobile()) {
        // Desktop: fan cards outward slightly
        mesh.rotation.y = pos3.x * -0.10;
        mesh.rotation.x = (pos3.y - 1.5) * 0.06;
    }
    mesh.layers.set(LAYER.BLUE);
    scene.add(mesh);

    _entries.push({
        mesh, basePos: pos3.clone(), seed, item, isProject: true,
        orbitBaseAngle: (idx / n) * Math.PI * 2,  // evenly spaced starting angles
        rising: true, riseTime: 0,
        riseDelay: idx * 0.10,
        popping: false, popTime: 0,
        labelMat: null,
    });
}

// ── Public API ────────────────────────────────────────────────────────────────
export function showSkillBubbles() {
    hideBubbles();
    const positions = _skillPositions(SKILL_ITEMS.length);
    SKILL_ITEMS.forEach((item, i) => _spawnSphere(item, positions[i], i));
    _ensureClickListener();
}

export function showProjectBubbles() {
    hideBubbles();
    const positions = _projectPositions();
    const promises  = PROJECT_ITEMS.map(item =>
        item.img ? (_imgTextures.get(item.img) instanceof Promise
            ? _imgTextures.get(item.img)
            : Promise.resolve(_imgTextures.get(item.img)))
        : Promise.resolve(null)
    );
    Promise.all(promises).then(textures => {
        PROJECT_ITEMS.forEach((item, i) =>
            _spawnProjectCard(item, positions[i] ?? new THREE.Vector3(0, ORBIT_CENTER_Y, ORBIT_Z), i, textures[i], i));
    });
    _ensureClickListener();
}

export function hideBubbles() {
    for (const e of _entries) _destroyEntry(e);
    _entries = [];
    _orbitAngle = 0;
}

// ── Tick ──────────────────────────────────────────────────────────────────────
const _RISE_DUR = 0.85;

export function tickBubbles(delta, elapsed) {
    if (!_entries.length) return;

    // Advance global orbit angle on mobile
    if (_isMobile()) _orbitAngle += delta * ORBIT_SPEED;

    for (let i = _entries.length - 1; i >= 0; i--) {
        const e   = _entries[i];
        const mat = e.mesh.material;

        // Always tick shader time
        if (mat.isShaderMaterial && mat.uniforms) {
            mat.uniforms.uTime.value = elapsed;
        }

        // ── Pop / burst animation ────────────────────────────────────────────
        if (e.popping) {
            e.popTime += delta;
            const t = e.popTime / 0.28;
            if (t < 1.0) {
                const s  = 1.0 + t * 0.9;
                const op = Math.max(0, 1.0 - t);
                e.mesh.scale.setScalar(s);
                if (mat.isShaderMaterial) mat.uniforms.uOpacity.value = op * 0.88;
                else mat.opacity = op;
                if (e.labelMat) e.labelMat.opacity = op * 0.95;
            } else {
                const item    = e.item;
                const basePos = e.basePos.clone();
                const seed    = e.seed;
                _destroyEntry(e, i);
                setTimeout(() => _spawnSphere(item, basePos, seed), 600);
            }
            continue;
        }

        // ── Rise animation ───────────────────────────────────────────────────
        if (e.rising) {
            e.riseTime += delta;
            const t = Math.max(0, e.riseTime - e.riseDelay) / _RISE_DUR;
            if (t <= 0) continue;
            const progress = Math.min(1, t);
            const ease     = 1 - Math.pow(1 - progress, 3);
            const targetOp = e.isProject ? 0.92 : 0.88;
            if (mat.isShaderMaterial && mat.uniforms) mat.uniforms.uOpacity.value = ease * targetOp;
            else mat.opacity = ease * targetOp;
            if (e.labelMat) e.labelMat.opacity = ease * 0.95;

            if (!e.isProject) {
                e.mesh.position.x = e.basePos.x;
                e.mesh.position.z = e.basePos.z;
                e.mesh.position.y = (e.basePos.y - 1.5) + ease * 1.5;
            }

            if (progress >= 1) {
                e.rising         = false;
                e.floatStartTime = elapsed;
                e.mesh.position.copy(e.basePos);
            }
            continue;
        }

        // ── Mobile project orbit — vertical Ferris wheel ─────────────────────
        if (e.isProject && _isMobile()) {
            const a = _orbitAngle + e.orbitBaseAngle;
            e.mesh.position.x = Math.sin(a) * ORBIT_R_X;
            e.mesh.position.y = ORBIT_CENTER_Y + Math.cos(a) * ORBIT_R_Y;
            e.mesh.position.z = ORBIT_Z;           // fixed z — always visible
            e.mesh.quaternion.copy(camera.quaternion); // always face camera
            continue;
        }

        // ── Desktop project cards: static ────────────────────────────────────
        if (e.isProject) {
            e.mesh.position.copy(e.basePos);
            continue;
        }

        // ── Skill bubble perpetual float ─────────────────────────────────────
        const s    = e.seed;
        const t    = elapsed - (e.floatStartTime ?? 0);
        const ramp = Math.min(1.0, t / 1.5);

        // Primary waves — fast, different period per axis per bubble
        const ftX  = 3.0 + Math.abs(Math.sin(s * 47.3)) * 2.5;
        const ftY  = 2.5 + Math.abs(Math.sin(s * 31.7)) * 2.0;
        const ftZ  = 3.5 + Math.abs(Math.sin(s * 19.1)) * 1.5;
        // Secondary waves — slower, adds organic unpredictability
        const ftX2 = 7.0 + Math.abs(Math.sin(s * 23.1)) * 3.5;
        const ftY2 = 6.0 + Math.abs(Math.sin(s * 17.3)) * 2.5;
        const ftZ2 = 8.5 + Math.abs(Math.sin(s * 11.7)) * 3.0;
        // Tertiary drift — very slow, makes bubbles wander far over time
        const ftX3 = 14.0 + Math.abs(Math.sin(s * 7.9)) * 5.0;
        const ftY3 = 12.0 + Math.abs(Math.sin(s * 5.3)) * 4.0;

        const dx = Math.sin(t / ftX  + s)        * 0.55
                 + Math.sin(t / ftX2 + s * 1.3)  * 0.35
                 + Math.sin(t / ftX3 + s * 0.6)  * 0.45;
        const dy = Math.sin(t / ftY  + s * 2.1)  * 0.45
                 + Math.cos(t / ftY2 + s * 0.7)  * 0.28
                 + Math.sin(t / ftY3 + s * 1.8)  * 0.32;
        const dz = Math.cos(t / ftZ  + s * 0.9)  * 0.38
                 + Math.sin(t / ftZ2 + s * 1.7)  * 0.22;

        e.mesh.position.x = e.basePos.x + dx * ramp;
        e.mesh.position.y = e.basePos.y + dy * ramp;
        e.mesh.position.z = e.basePos.z + dz * ramp;

        // Billboard: sphere parent faces camera.
        // Label child sits at local (0,0,0) and inherits the parent rotation — correct.
        if (!e.isProject) {
            e.mesh.quaternion.copy(camera.quaternion);
        }
    }
}

function _destroyEntry(e, idx) {
    scene.remove(e.mesh);
    e.mesh.geometry.dispose();
    const m = e.mesh.material;
    if (m.isShaderMaterial && m.uniforms) {
        if (m.uniforms.uOverlay?.value) m.uniforms.uOverlay.value.dispose();
        // uImage is shared from _imgTextures — don't dispose it
    } else if (Array.isArray(m)) {
        m.forEach(x => { if (x.map) x.map.dispose(); x.dispose(); });
    } else {
        if (m.map) m.map.dispose();
        m.dispose();
    }
    if (e.labelMat) { if (e.labelMat.map) e.labelMat.map.dispose(); e.labelMat.dispose(); }
    if (idx !== undefined) _entries.splice(idx, 1);
}

// ── Click / hover ─────────────────────────────────────────────────────────────
let _downX = 0, _downY = 0;

function _ensureClickListener() {
    if (_listening) return;
    _listening = true;
    // pointerdown on the canvas — record where the press started
    renderer.domElement.addEventListener('pointerdown', _onDown);
    // pointerup on document so OrbitControls pointer-capture can't swallow it
    document.addEventListener('pointerup', _onUp);
    renderer.domElement.addEventListener('pointermove', _onMove);
}

function _updateMouse(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    _mouse.x   =  ((clientX - rect.left) / rect.width)  * 2 - 1;
    _mouse.y   = -((clientY - rect.top)  / rect.height) * 2 + 1;
}

function _onDown(event) {
    _downX = event.clientX;
    _downY = event.clientY;
}

function _onUp(event) {
    // Only treat as a click if the pointer barely moved (not an orbit drag)
    const dx = event.clientX - _downX;
    const dy = event.clientY - _downY;
    if (Math.sqrt(dx * dx + dy * dy) > 8) return;
    if (!_entries.length) return;

    _updateMouse(event.clientX, event.clientY);
    _raycaster.setFromCamera(_mouse, camera);

    // Force matrixWorld to be current for billboarded spheres
    const meshes = _entries.filter(e => !e.popping).map(e => {
        e.mesh.updateMatrixWorld(true);
        return e.mesh;
    });

    const hits = _raycaster.intersectObjects(meshes, false);
    if (!hits.length) return;

    const entry = _entries.find(e => e.mesh === hits[0].object && !e.popping);
    if (!entry) return;

    if (entry.isProject && entry.item.url) {
        window.open(entry.item.url, '_blank', 'noopener,noreferrer');
        return;
    }

    // Trigger burst pop
    entry.popping = true;
    entry.popTime = 0;
}

function _onMove(event) {
    if (!_entries.length) return;
    _updateMouse(event.clientX, event.clientY);
    _raycaster.setFromCamera(_mouse, camera);
    const hits = _raycaster.intersectObjects(_entries.map(e => e.mesh), false);
    renderer.domElement.style.cursor = hits.length ? 'pointer' : '';
}

