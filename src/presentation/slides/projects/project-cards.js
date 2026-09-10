import * as THREE from 'three';
import { scene, camera } from '../../../scene.js';
import { LAYER } from '../../../layers.js';
import { isMobile } from '../../../constants.js';
import { pushEntry, hideBubbles, onHide, ensureClickListener, getHoveredEntry, wrapText } from '../bubbles-shared.js';
import BLUEPRINT_VERT from '../../../shaders/blueprint.vert.glsl?raw';
import BLUEPRINT_FRAG from '../../../shaders/blueprint.frag.glsl?raw';

// ── Data ──────────────────────────────────────────────────────────────────────
const _base = import.meta.env.BASE_URL.replace(/\/$/, '');

const PROJECT_ITEMS = [
    {label: 'EnVar',              sub: 'IntelliJ plugin · 26 900+ downloads',     url: 'https://plugins.jetbrains.com/plugin/26912-envar',              img: `${_base}/projects/envar.png`},
    {label: 'Dino Card Collector',sub: 'Location-based web game for families',    url: 'https://fazlizekiqi.github.io/dinosaur-card-collector',        img: `${_base}/projects/dinosaur-card-collector.png`},
    {label: 'MPlayer',            sub: 'YouTube-backed CLI music player',         url: 'https://github.com/fazlizekiqi/mplayer',                        img: `${_base}/projects/mplayer.png`},
    {label: 'K8s Application',    sub: 'GKE · Terraform · Cert-Manager · Helm',  url: 'https://github.com/fazlizekiqi/k8s-application',                img: `${_base}/projects/k8s.png`},
    {label: 'Train with Mii',     sub: 'AI-powered exam trainer with flashcards', url: 'https://fazlizekiqi.github.io/train-with-mii/flashcards',       img: `${_base}/projects/train-with-mii.png`},
    {label: 'Tradita Grill',      sub: 'Static site for a restaurant',            url: 'https://traditagrill.ch/',                                      img: `${_base}/projects/tradita-grill.png`},
    {label: 'Clips',              sub: 'Static portfolio showcase site',          url: 'https://fazlizekiqi.github.io/clips/',                          img: `${_base}/projects/clips.png`},
    {label: 'Birthday Party',     sub: 'Birthday party planning web app',         url: 'https://fazlizekiqi.github.io/pokemon-bingo/',                  img: `${_base}/projects/birthday-party.png`},
    {label: 'Kafka Connect',      sub: 'Kafka Connect pipeline & integrations',   url: 'https://github.com/fazlizekiqi/kafka-connect-local',            img: `${_base}/projects/kafka-connect.png`},
];

// ── Mobile helpers ────────────────────────────────────────────────────────────
function _cardScale() { return isMobile() ? 0.72 : 1.0; }

// ── Orbit constants (mobile) ─────────────────────────────────────────────────
const ORBIT_R_X      = 1.75;
const ORBIT_R_Y      = 2.25;
const ORBIT_Z        = 0.8;
const ORBIT_CENTER_Y = 0.3;
const ORBIT_SPEED    = 0.05;

// Mobile orbit angle — starts at 0 each time the cards are shown so the first
// settled frame lands exactly on each card's basePos (no jump). Advanced once
// per frame (guarded by the elapsed timestamp since onTick runs per-card).
let _orbitAngle       = 0;
let _orbitLastElapsed = -1;

function _advanceOrbit(delta, elapsed) {
  if (elapsed === _orbitLastElapsed) return;
  _orbitLastElapsed = elapsed;
  _orbitAngle += delta * ORBIT_SPEED;
}

// Reset orbit state when bubbles are hidden so the next visit starts clean.
onHide(() => { _orbitAngle = 0; _orbitLastElapsed = -1; });

// ── Project image preloader ───────────────────────────────────────────────────
const _texLoader   = new THREE.TextureLoader();
const _imgTextures = new Map();

PROJECT_ITEMS.forEach(item => {
    if (!item.img) return;
    const p = new Promise(resolve => {
        _texLoader.load(
            item.img,
            tex  => { _imgTextures.set(item.img, tex); resolve(tex); },
            undefined,
            ()   => { console.warn('[project-cards] texture failed:', item.img); resolve(null); }
        );
    });
    _imgTextures.set(item.img, p);
});

// ── Canvas texture helpers ────────────────────────────────────────────────────
function _makeProjectCardMobile(item, imgTex) {
    const { label, sub } = item;
    const W = 800, H = 540;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#020d1e';
    ctx.fillRect(0, 0, W, H);

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

    if (imgTex && imgTex.image) {
        const imgX = Math.round(W * 0.44);
        const imgW = W - imgX - 10;
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.drawImage(imgTex.image, imgX, 8, imgW, H - 16);
        ctx.restore();
        const fade = ctx.createLinearGradient(imgX, 0, imgX + imgW * 0.45, 0);
        fade.addColorStop(0, 'rgba(2,13,30,1)');
        fade.addColorStop(1, 'rgba(2,13,30,0)');
        ctx.fillStyle = fade;
        ctx.fillRect(imgX, 0, imgW, H);
    }

    ctx.strokeStyle = 'rgba(0,200,255,0.55)';
    ctx.lineWidth   = 3;
    ctx.strokeRect(4, 4, W - 8, H - 8);

    const TEXT_X   = 28;
    const MAX_TW   = Math.round(W * 0.40);
    const titleFS  = label.length > 14 ? 62 : 72;
    ctx.font        = `800 ${titleFS}px "Courier New", monospace`;
    ctx.textAlign   = 'left';
    ctx.textBaseline = 'alphabetic';

    const titleLines = [];
    let cur = '';
    for (const w of label.split(' ')) {
        const test = cur ? cur + ' ' + w : w;
        if (ctx.measureText(test).width > MAX_TW) { titleLines.push(cur); cur = w; }
        else cur = test;
    }
    if (cur) titleLines.push(cur);

    const titleLineH  = titleFS + 10;
    const titleStartY = 80;
    titleLines.forEach((ln, li) => {
        const y = titleStartY + li * titleLineH;
        ctx.strokeStyle = 'rgba(0,0,0,0.95)';
        ctx.lineWidth   = 12;
        ctx.lineJoin    = 'round';
        ctx.strokeText(ln, TEXT_X, y);
        ctx.shadowColor  = 'rgba(0,220,255,0.85)';
        ctx.shadowBlur   = 20;
        ctx.fillStyle    = '#ffffff';
        ctx.fillText(ln, TEXT_X, y);
        ctx.shadowBlur   = 0;
    });

    if (sub) {
        const subY  = titleStartY + titleLines.length * titleLineH + 18;
        const subFS = 28;
        ctx.font     = `600 ${subFS}px "Courier New", monospace`;
        ctx.lineWidth  = 8;
        ctx.lineJoin   = 'round';
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

function _makeProjectOverlay(item) {
    const { label, sub } = item;
    const W = 768, H = 512;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const TEXT_X    = 24;
    const IMG_START = Math.round(W * 0.42);
    const MAX_W     = IMG_START - TEXT_X - 12;

    const grad = ctx.createLinearGradient(0, 0, IMG_START, 0);
    grad.addColorStop(0,   'rgba(0,5,18,0.82)');
    grad.addColorStop(0.85,'rgba(0,5,18,0.60)');
    grad.addColorStop(1,   'rgba(0,5,18,0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, IMG_START, H);

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

    const subY = 62 + titleLines.length * 52 + 14;
    ctx.font        = '700 24px "Courier New", monospace';
    ctx.fillStyle   = '#55ddff';
    ctx.shadowColor = 'rgba(0,180,255,0.8)';
    ctx.shadowBlur  = 8;
    const charsPerLine = Math.floor(MAX_W / 14);
    wrapText(sub, charsPerLine).forEach((ln, li) => {
        ctx.fillText(ln, TEXT_X, subY + li * 30);
    });

    ctx.font        = '700 22px "Courier New", monospace';
    ctx.fillStyle   = '#00ccff';
    ctx.shadowColor = 'rgba(0,200,255,0.9)';
    ctx.shadowBlur  = 10;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('↗ OPEN PROJECT', TEXT_X, H - 20);

    return new THREE.CanvasTexture(cv);
}

// ── Layout ────────────────────────────────────────────────────────────────────
function _projectPositions() {
    if (isMobile()) {
        return Array.from({ length: PROJECT_ITEMS.length }, (_, i) => {
            const a = (i / PROJECT_ITEMS.length) * Math.PI * 2;
            return new THREE.Vector3(
                Math.sin(a) * ORBIT_R_X,
                ORBIT_CENTER_Y + Math.cos(a) * ORBIT_R_Y,
                ORBIT_Z,
            );
        });
    }

    const Z_CARDS = 0.8, FOV_DEG = 44;
    const CAM_Z = 8.5, CAM_Y = -0.2, TGT_Y = 1.8, TGT_Z = 1.0;
    const dist   = CAM_Z - Z_CARDS;
    const halfH  = Math.tan((FOV_DEG * 0.5) * Math.PI / 180) * dist;
    const halfW  = halfH * (window.innerWidth / window.innerHeight);
    const dirLen = Math.hypot(TGT_Y - CAM_Y, TGT_Z - CAM_Z);
    const centerY = CAM_Y + ((TGT_Y - CAM_Y) / dirLen) * dist;

    const mX = halfW * 0.78, mY = halfH * 0.82;
    const cY = centerY, z = Z_CARDS;
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

// ── Spawn ─────────────────────────────────────────────────────────────────────
function _spawnProjectCard(item, pos3, seed, imgTex, idx = 0) {
    const sc = _cardScale();
    const n  = PROJECT_ITEMS.length;

    let mat;
    if (isMobile()) {
        const cardTex = _makeProjectCardMobile(item, imgTex);
        mat = new THREE.MeshBasicMaterial({
            map: cardTex, transparent: true, depthWrite: false, opacity: 0, side: THREE.DoubleSide,
        });
    } else {
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
    if (!isMobile()) {
        mesh.rotation.y = pos3.x * -0.10;
        mesh.rotation.x = (pos3.y - 1.5) * 0.06;
    }
    mesh.layers.set(LAYER.BLUE);
    scene.add(mesh);

    const entry = {
        mesh, basePos: pos3.clone(), seed, item, isProject: true,
        orbitBaseAngle: (idx / n) * Math.PI * 2,
        rising: true, riseTime: 0,
        riseDelay: idx * 0.10,
        popping: false, popTime: 0,
        labelMat: null,
        targetOpacity: 0.92,
    };

    entry.onTick = (e, delta, elapsed) => {
        if (isMobile()) {
            _advanceOrbit(delta, elapsed);
            const a = _orbitAngle + e.orbitBaseAngle;
            e.mesh.position.x = Math.sin(a) * ORBIT_R_X;
            e.mesh.position.y = ORBIT_CENTER_Y + Math.cos(a) * ORBIT_R_Y;
            e.mesh.position.z = ORBIT_Z;
            e.mesh.quaternion.copy(camera.quaternion);
        } else {
            e.mesh.position.copy(e.basePos);
            const targetScale = (e === getHoveredEntry()) ? 1.07 : 1.0;
            e.mesh.scale.x += (targetScale - e.mesh.scale.x) * 0.10;
            e.mesh.scale.y += (targetScale - e.mesh.scale.y) * 0.10;
            e.mesh.scale.z += (targetScale - e.mesh.scale.z) * 0.10;
        }
    };

    pushEntry(entry);
}

// ── Public API ────────────────────────────────────────────────────────────────
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
    ensureClickListener();
}
