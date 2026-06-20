import * as THREE from 'three';
import { scene, camera } from '../../../scene.js';
import { LAYER } from '../../../layers.js';
import { isMobile } from '../../../constants.js';
import { pushEntry, hideBubbles, ensureClickListener } from '../bubbles-shared.js';
import BUBBLE_VERT from '../../../shaders/bubble.vert.glsl?raw';
import BUBBLE_FRAG from '../../../shaders/bubble.frag.glsl?raw';

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

const GROUP_COLOR = {
    backend:  { hex: 0x00ccff, css: '#00ccff' },
    frontend: { hex: 0x00eedd, css: '#00eedd' },
    cloud:    { hex: 0x4499ee, css: '#4499ee' },
    data:     { hex: 0x55bbdd, css: '#55bbdd' },
    tooling:  { hex: 0xaaccff, css: '#aaccff' },
    ai:       { hex: 0x00ffcc, css: '#00ffcc' },
};

// ── Layout params (tweakable via GUI) ─────────────────────────────────────────
export const skillLayoutParams = { offsetX: 0, offsetY: 0, spread: 1.0 };

// ── Mobile helpers ────────────────────────────────────────────────────────────
function _bubbleScale() { return isMobile() ? 0.92 : 1.0; }
function _fontScale()   { return isMobile() ? 1.5  : 1.0; }

function _bubbleSizeForLabel(label) {
    const sc  = _bubbleScale();
    const len = label.length;
    const r   = sc * Math.max(0.48, Math.min(0.82, 0.38 + len * 0.028));
    const planeSize = r * 1.25;
    return { r, planeSize };
}

// ── Canvas texture ────────────────────────────────────────────────────────────
function _makeLabelTexture(label, groupKey) {
    const c   = GROUP_COLOR[groupKey] ?? GROUP_COLOR.tooling;
    const SZ  = isMobile() ? 256 : 1024;
    const cv  = document.createElement('canvas');
    cv.width  = cv.height = SZ;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, SZ, SZ);

    const cx = SZ / 2, cy = SZ / 2;
    const maxW = Math.floor(SZ * 0.62);
    const fs0 = Math.round((label.length > 12 ? 148 : label.length > 8 ? 170 : 192) * _fontScale());
    let fs = fs0;
    ctx.font = `800 ${fs}px "Courier New", monospace`;

    const words = label.split(' ');
    const buildLines = () => {
        const ls = [];
        let cur = '';
        for (const w of words) {
            const test = cur ? cur + ' ' + w : w;
            if (ctx.measureText(test).width > maxW && cur) { ls.push(cur); cur = w; }
            else cur = test;
        }
        if (cur) ls.push(cur);
        return ls;
    };

    let lines = words.length === 1 ? [label] : buildLines();

    let safety = 0;
    while (safety++ < 20) {
        const strokeOverhang = fs * 0.16;
        const fits = lines.every(l => ctx.measureText(l).width + strokeOverhang * 2 <= maxW);
        if (fits) break;
        fs -= 8;
        ctx.font = `800 ${fs}px "Courier New", monospace`;
        lines = words.length === 1 ? [label] : buildLines();
    }

    const BADGE_H   = 48;
    const BADGE_GAP = 20;
    const lineH     = fs + 16;
    const totalH    = BADGE_H + BADGE_GAP + lines.length * lineH;
    const blockTop  = cy - totalH / 2;

    const GROUP_LABEL = { backend:'BACKEND', frontend:'FRONTEND', cloud:'CLOUD', data:'DATA', tooling:'TOOLING', ai:'AI' };
    const badge = GROUP_LABEL[groupKey] ?? groupKey.toUpperCase();
    ctx.font         = `700 34px "Courier New", monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    const bw = ctx.measureText(badge).width + 28, bh = BADGE_H, br = bh / 2;
    const bx = cx - bw / 2, by = blockTop;
    ctx.fillStyle = c.css + '30';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, br);
    ctx.fill();
    ctx.strokeStyle = c.css;
    ctx.lineWidth   = 2.5;
    ctx.stroke();
    ctx.fillStyle   = c.css;
    ctx.fillText(badge, cx, by + bh / 2);

    ctx.font         = `800 ${fs}px "Courier New", monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin     = 'round';

    const textTop = blockTop + BADGE_H + BADGE_GAP;
    lines.forEach((ln, li) => {
        const y = textTop + li * lineH + lineH / 2;
        ctx.lineWidth   = fs * 0.16;
        ctx.strokeStyle = 'rgba(1,5,18,1.0)';
        ctx.strokeText(ln, cx, y);
        ctx.fillStyle = '#dff0ff';
        ctx.fillText(ln, cx, y);
    });

    return new THREE.CanvasTexture(cv);
}

// ── Layout ────────────────────────────────────────────────────────────────────
const BUBBLE_Z = -5.5;

function _frustumExtents(worldZ) {
    const camZ    = camera.position.z;
    const dist    = camZ - worldZ;
    const halfH   = Math.tan((camera.fov * 0.5) * Math.PI / 180) * dist;
    const halfW   = halfH * camera.aspect;
    const centerY = camera.position.y + (camera.getWorldDirection(new THREE.Vector3()).y * dist);
    return { halfW, halfH, centerY };
}

function fract(x) { return x - Math.floor(x); }

function _skillPositions(n) {
    const { offsetX, offsetY, spread } = skillLayoutParams;
    const { halfW, halfH, centerY } = _frustumExtents(BUBBLE_Z);

    const marginX = 0.5, marginY = 0.4;
    const rawW = (halfW - marginX) * spread;
    const W    = rawW;
    const rawH = (halfH - marginY) * spread;
    const H    = isMobile() ? rawH : rawH * 0.60;

    const pts = [];
    for (let i = 0; i < n; i++) {
        const sx = fract(Math.sin(i * 127.1 + 31.7) * 43758.5) * 2 - 1;
        const sy = fract(Math.sin(i * 311.7 + 74.2) * 43758.5) * 2 - 1;
        const sz = fract(Math.sin(i * 73.1  + 19.9) * 43758.5);
        const x  = sx * W + offsetX * 0.1;
        const y  = centerY + sy * H + offsetY * 0.1;
        const z  = BUBBLE_Z + sz * 3.5;
        pts.push(new THREE.Vector3(x, y, z));
    }

    const MIN_D = 1.2 * _bubbleScale();
    for (let iter = 0; iter < (isMobile() ? 30 : 80); iter++) {
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
            pts[a].x = Math.max(-halfW + marginX, Math.min(halfW - marginX, pts[a].x));
            pts[a].y = Math.max(centerY - H,       Math.min(centerY + H,    pts[a].y));
            if (pts[a].z > -0.7) pts[a].z = -0.7;
        }
    }
    return pts;
}

// ── Spawn ─────────────────────────────────────────────────────────────────────
function _spawnSphere(item, pos3, seed) {
    const c   = GROUP_COLOR[item.group] ?? GROUP_COLOR.tooling;
    const { r, planeSize } = _bubbleSizeForLabel(item.label);
    const geo = new THREE.SphereGeometry(r, isMobile() ? 16 : 64, isMobile() ? 10 : 32);

    const mat = new THREE.ShaderMaterial({
        vertexShader:   BUBBLE_VERT,
        fragmentShader: BUBBLE_FRAG,
        uniforms: {
            uTime:    { value: 0 },
            uColor:   { value: new THREE.Color(c.hex) },
            uOpacity: { value: 0 },
        },
        transparent: true,
        depthWrite:  false,
        side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos3); mesh.position.y -= 1.5;
    mesh.layers.set(LAYER.BLUE);

    const labelTex  = _makeLabelTexture(item.label, item.group);
    const labelGeo  = new THREE.PlaneGeometry(planeSize, planeSize);
    const labelMat  = new THREE.MeshBasicMaterial({
        map: labelTex, transparent: true, depthWrite: false, opacity: 0,
    });
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.position.z = 0;
    labelMesh.layers.set(LAYER.BLUE);
    labelMesh.raycast = () => {};
    mesh.add(labelMesh);

    scene.add(mesh);

    const entry = {
        mesh, basePos: pos3.clone(), seed, item, isProject: false,
        rising: true, riseTime: 0,
        riseDelay: 0.2 + Math.abs(Math.sin(seed * 47.3 + 1.7)) * 2.2,
        labelMat,
        popping: false, popTime: 0,
        targetOpacity: 0.88,
    };

    entry.riseMotion = (e, ease) => {
        e.mesh.position.x = e.basePos.x;
        e.mesh.position.z = e.basePos.z;
        e.mesh.position.y = (e.basePos.y - 1.5) + ease * 1.5;
    };

    entry.onTick = (e, _delta, elapsed) => {
        const s    = e.seed;
        const t    = elapsed - (e.floatStartTime ?? 0);
        const ramp = Math.min(1.0, t / 1.5);

        const ftX  = 3.0 + Math.abs(Math.sin(s * 47.3)) * 2.5;
        const ftY  = 2.5 + Math.abs(Math.sin(s * 31.7)) * 2.0;
        const ftX2 = 7.0 + Math.abs(Math.sin(s * 23.1)) * 3.5;
        const ftY2 = 6.0 + Math.abs(Math.sin(s * 17.3)) * 2.5;
        const ftX3 = 14.0 + Math.abs(Math.sin(s * 7.9)) * 5.0;
        const ftY3 = 12.0 + Math.abs(Math.sin(s * 5.3)) * 4.0;

        const dx = Math.sin(t / ftX  + s)       * 0.55
                 + Math.sin(t / ftX2 + s * 1.3) * 0.35
                 + Math.sin(t / ftX3 + s * 0.6) * 0.45;
        const dy = Math.sin(t / ftY  + s * 2.1) * 0.45
                 + Math.cos(t / ftY2 + s * 0.7) * 0.28
                 + Math.sin(t / ftY3 + s * 1.8) * 0.32;

        e.mesh.position.x = e.basePos.x + dx * ramp;
        e.mesh.position.y = e.basePos.y + dy * ramp;
        e.mesh.position.z = e.basePos.z;
        e.mesh.quaternion.copy(camera.quaternion);
    };

    entry.respawn = () => {
        setTimeout(() => _spawnSphere(entry.item, entry.basePos.clone(), entry.seed), 600);
    };

    pushEntry(entry);
}

// ── Public API ────────────────────────────────────────────────────────────────
export function showSkillBubbles() {
    hideBubbles();
    const positions = _skillPositions(SKILL_ITEMS.length);
    SKILL_ITEMS.forEach((item, i) => _spawnSphere(item, positions[i], i));
    ensureClickListener();
}
