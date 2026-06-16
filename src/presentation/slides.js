/**
 * slides.js — Pure slide data. No side-effects, no imports from the app.
 *
 * Each slide is a plain object:
 *   name      — unique string id
 *   cam       — camera sub-object:
 *     pos / target          — THREE.Vector3 (for non-anchor slides)
 *     mobile.pos / target   — optional mobile override
 *     phase2                — { pos, target, delay, ms } second camera move (desktop)
 *     mobilePhase2          — { pos, target, delay, ms } second move (mobile only)
 *     anchor                — { dist, offsetX, camY, targetOffsetX, targetY } character-relative
 *     mobile.anchor         — mobile override for anchor slides
 *     moveMs                — ms for the camera lerp
 *     easing                — key into the EASE map in camera.js
 *     drift                 — optional idle breathing { x, y, xf, yf [, z, zf] }
 *   anim      — animation sub-object:
 *     clip                  — single clip name
 *     clips                 — array of clip names (played as a sequence)
 *     loop                  — if true, clip loops; if false/absent, plays once
 *   duration  — ms the slide plays before auto-advancing
 *   title     — slide card heading
 *   subtitle  — slide card subtitle
 *   body      — slide card body (newline = line break)
 *
 * There are NO onEnter callbacks here — side-effects are handled by the
 * presentation orchestrator (presentation.js) which reads `name` to decide
 * what to do when a slide becomes active.
 */

import * as THREE from 'three';

export const SLIDES = [
    {
        name: 'intro',
        cam: {
            pos:    new THREE.Vector3(0, 1.8, 11.5),
            target: new THREE.Vector3(0, 0.7, 0),
            phase2: {
                pos:    new THREE.Vector3(0, 0.9, 7.8),
                target: new THREE.Vector3(0, 0.9, 0),
                delay:  2200,
                ms:     3600,
            },
            moveMs: 2000,
            easing: 'out',
            drift:  { x: 0.014, y: 0.008, xf: 0.22, yf: 0.15 },
        },
        anim: { clips: ['waving', 'idle'] },
        duration: 14000,
        title:    'Fazli Zekiqi',
        subtitle: '> SENIOR SOFTWARE ENGINEER · STOCKHOLM',
        body:     '',
    },
    {
        name: 'skills',
        cam: {
            pos:    new THREE.Vector3(0, 1.4, 8.8),
            target: new THREE.Vector3(0, 0.95, 0),
            mobile: {
                pos:    new THREE.Vector3(0, 1.6, 13.5),
                target: new THREE.Vector3(0, 0.95, 0),
            },
            moveMs: 10000,
            easing: 'inOut',
            drift:  { x: 0.055, y: 0.042, xf: 0.13, yf: 0.10 },
        },
        anim: { clips: ['arm-gesture', 'briefcase-standing', 'arm-gesture-mirror.001', 'idle'] },
        duration: 22000,
        title:    'Skills',
        subtitle: '30 technologies · 7 domains · production-proven',
        body:     'Click any bubble.',
    },
    {
        name: 'projects',
        cam: {
            pos:    new THREE.Vector3(0, -0.2, 8.5),
            target: new THREE.Vector3(0, 1.8, 1.0),
            mobile: {
                pos:    new THREE.Vector3(0, 0.5, 14),
                target: new THREE.Vector3(0, 0.8, 0),
            },
            moveMs: 2800,
            easing: 'outBack',
            drift:  { x: 0.010, y: 0.008, xf: 0.14, yf: 0.10 },
        },
        anim: { clips: ['happy-idle', 'briefcase-standing'] },
        duration: 22000,
        title:    'Projects',
        subtitle: '9 shipped · hover any card · click to open',
        body:     'Click any card to open the project.',
    },
    {
        name: 'mindset',
        cam: {
            pos:    new THREE.Vector3(0, 1.0, 7.2),
            target: new THREE.Vector3(0, 0.95, 0),
            phase2: {
                pos:    new THREE.Vector3(0, 1.05, 12),
                target: new THREE.Vector3(0, -0.5, 0),
                delay:  1600,
                ms:     6000,
            },
            mobile: {
                pos:    new THREE.Vector3(0, 1.0, 11.0),
                target: new THREE.Vector3(0, -0.5, 0),
            },
            moveMs: 1400,
            easing: 'inOut',
            drift:  { x: 0.010, y: 0.006, xf: 0.24, yf: 0.17 },
        },
        anim: { clip: 'ide-to-walk' },
        duration: 19000,
        title:    'How I Work',
        subtitle: 'Four principles I carry into every project',
        body:     '',
    },
    {
        name: 'experience',
        cam: {
            anchor: { dist: 4.95, offsetX: 1.6, camY: 0.85, targetOffsetX: -0.55, targetY: 1 },
            mobile: { anchor: { dist: 9.5, offsetX: 0.4, camY: 0.9, targetOffsetX: -0.9, targetY: 1.0 } },
            moveMs: 2200,
            easing: 'out',
            drift:  { x: 0.028, y: 0.006, xf: 0.09, yf: 0.13, z: 0.055, zf: 0.07 },
        },
        anim: { clip: 'idle', loop: true },
        duration: 30000,
        title:    'Experience',
        subtitle: '6+ years building production systems at scale',
        body:     'SENIOR SOFTWARE ENGINEER\n· SEB Stockholm\nJava  Kafka  GCP  OpenShift  Angular\n\nSOFTWARE ENGINEER\n· Cepheid AB Stockholm\nJava  Spring Boot  Angular  AWS\n\nSOFTWARE ENGINEER\n· Expleo Stockholm\nJava  React  AWS  MySQL  Agile',
    },
    {
        name: 'about',
        cam: {
            anchor: { dist: 5.8, offsetX: 0, camY: 1.3, targetOffsetX: 0, targetY: 1.3 },
            mobile: { anchor: { dist: 9.5, offsetX: 0, camY: 1.0, targetOffsetX: 0, targetY: 1.0 } },
            moveMs: 2000,
            easing: 'out',
            drift:  { x: 0.008, y: 0.006, xf: 0.14, yf: 0.16 },
        },
        anim: { clip: 't-pose-frozen' },
        duration: 18000,
        title:    'About Me',
        subtitle: 'Transparent by design',
        body:     '',
    },
    {
        name: 'cta',
        cam: {
            pos:    new THREE.Vector3(1.8, 1.9, 6.6),
            target: new THREE.Vector3(1.1, 1.35, 0),
            mobile: {
                pos:    new THREE.Vector3(0, 1.8, 11.5),
                target: new THREE.Vector3(0, 0.6, 0),
            },
            mobilePhase2: {
                pos:    new THREE.Vector3(0, 1.6, 10.0),
                target: new THREE.Vector3(0, 0.5, 0),
                delay:  1800,
                ms:     2400,
            },
            moveMs: 1600,
            easing: 'inOut',
            drift:  { x: 0.012, y: 0.007, xf: 0.16, yf: 0.11 },
        },
        anim: { clips: ['hands-forward-gesture', 'head-nod-yes', 'idle'] },
        duration: 14000,
        title:    "Let's Connect",
        subtitle: 'Open to opportunities & collaborations',
        body:     '',
    },
    {
        name: 'myworld',
        cam: {
            pos:    new THREE.Vector3(0, 2.2, -5.5),
            target: new THREE.Vector3(0, 1.0, 0),
            moveMs: 2500,
            easing: 'inOut',
            drift:  { x: 0.0, y: 0.0, xf: 0.0, yf: 0.0 },
        },
        anim: { clip: 'acknowledge' },
        duration: 2500,
        title:    'My World',
        subtitle: 'Step inside and explore freely',
        body:     'Step inside — use WASD or the joystick to move.\nExplore freely. The world is yours.',
    },
];

// ── Lookup helpers ────────────────────────────────────────────────────────────
export const slideByName = Object.fromEntries(SLIDES.map(s => [s.name, s]));
export const indexOf = name => SLIDES.findIndex(s => s.name === name);
export const isLastSlide = name => indexOf(name) >= SLIDES.length - 1;
