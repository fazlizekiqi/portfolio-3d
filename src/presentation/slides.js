/**
 * slides.js — Pure slide data. No side-effects, no imports from the app.
 *
 * Each slide is a plain object:
 *   name      — unique string id
 *   camPos    — THREE.Vector3 camera position
 *   camTarget — THREE.Vector3 camera look-at point
 *   duration  — ms the slide plays before auto-advancing
 *   easing    — key into the EASE map in camera.js
 *   clip      — animation clip name to play on entry
 *   clipLoop  — if true the clip loops (playClip); if false it plays once then
 *               fades to idle/talking (playFeaturedClip)
 *   drift     — optional idle breathing { x, y, xf, yf }
 *   title     — slide card heading
 *   body      — slide card body (newline = line break)
 *
 * There are NO onEnter callbacks here — side-effects are handled by the
 * presentation orchestrator (presentation.js) which reads `name` to decide
 * what to do when a slide becomes active.
 */

import * as THREE from 'three';

export const SLIDES = [
    {
        // ── INTRO: Wide establishing shot → gentle pull-in ────────────────────
        // Camera starts wide/high (like the scene is loading in) then eases back.
        // Body: terminal boot sequence shown in LEFT panel so character is clearly
        // visible on the right. Phase-2 is a subtle settle, NOT a jarring close-up.
        name: 'intro',
        camPos:    new THREE.Vector3(0,  1.8, 11.5),
        camTarget: new THREE.Vector3(0,  0.7,  0),
        camPos2:    new THREE.Vector3(0,  0.9, 7.8),
        camTarget2: new THREE.Vector3(0,  0.9, 0),
        cam2Delay:    2200,
        cam2Duration: 3600,
        duration: 14000,
        camMoveDuration: 2000,
        easing: 'out',
        clip: 'waving',
        clips: ['waving', 'idle'],
        clipLoop: false,
        drift: {x: 0.014, y: 0.008, xf: 0.22, yf: 0.15},
        title: 'Fazli Zekiqi',
        subtitle: '> SENIOR SOFTWARE ENGINEER · STOCKHOLM',
        body: '__INTRO_TERMINAL__',
    },
    {
        // ── SKILLS: Panoramic view of the full bubble arch ────────────────────
        // Camera wide enough to show ALL 29 bubbles. Short duration — user knows
        // what to do (click bubbles). Title changed to plain "Skills".
        name: 'skills',
        camPos: new THREE.Vector3(0, 1.4, 8.8),
        camTarget: new THREE.Vector3(0, 0.95, 0),
        mobileCamPos: new THREE.Vector3(0, 1.6, 13.5),
        mobileCamTarget: new THREE.Vector3(0, 0.95, 0),
        duration: 22000,
        camMoveDuration: 10000,
        easing: 'inOut',
        clip: 'arm-gesture',
        clips: ['arm-gesture', 'briefcase-standing', 'arm-gesture-mirror.001', 'idle'],
        clipLoop: false,
        drift: {x: 0.055, y: 0.042, xf: 0.13, yf: 0.10},
        title: 'Skills',
        subtitle: '29 technologies · 7 domains · production-proven',
        body: 'Click any bubble to explore that domain.',
    },
    {
        // ── PROJECTS: Camera matches the baked card positions exactly ─────────
        // _projectPositions() in bubbles.js is hardcoded for CAM_Z=8.5, CAM_Y=-0.2,
        // TGT_Y=1.8. Match those so all 9 cards sit perfectly in the frustum.
        // No orbit — users need a stable view to READ and CLICK cards.
        // Hover over a card triggers a character head-nod.
        name: 'projects',
        camPos: new THREE.Vector3(0, -0.2, 8.5),
        camTarget: new THREE.Vector3(0, 1.8, 1.0),
        mobileCamPos: new THREE.Vector3(0, 0.5, 14),
        mobileCamTarget: new THREE.Vector3(0, 0.8, 0),
        duration: 22000,
        camMoveDuration: 2800,
        easing: 'outBack',
        clip: 'happy-idle',
        clips: ['happy-idle', 'briefcase-standing'],
        clipLoop: false,
        drift: {x: 0.010, y: 0.008, xf: 0.14, yf: 0.10},
        title: 'Projects',
        subtitle: '9 shipped · hover any card · click to open',
        body: 'Click any card to open the project.',
    },
    {
        // ── MINDSET: Medium wide + side-column card overlay ───────────────────
        // NO phase-2 close-up. Desktop: two How-I-Work cards per side column,
        // character fully visible in the middle. Mobile: compact 2×2 grid at
        // the bottom — mobile camera frames the character above the grid.
        // Duration extended so the 4-card stagger animation fully completes.
        name: 'mindset',
        camPos:    new THREE.Vector3(0, 1.0, 6.2),
        camTarget: new THREE.Vector3(0, 0.9, 0),
        mobileCamPos:    new THREE.Vector3(0, 1.3, 9.5),
        mobileCamTarget: new THREE.Vector3(0, 0.25, 0),
        duration: 16000,
        camMoveDuration: 1400,
        easing: 'inOut',
        clip: 'idle',
        clips: ['idle', 'briefcase-standing'],
        clipLoop: false,
        drift: {x: 0.010, y: 0.006, xf: 0.24, yf: 0.17},
        title: 'How I Work',
        subtitle: 'Four principles I carry into every project',
        body: '',
    },
    {
        // ── EXPERIENCE: Cinematic news-anchor side angle ───────────────────────
        name: 'experience',
        anchor: {dist: 4.95, camOffsetX: 1.6, camY: 0.85, targetOffsetX: -0.55, targetY: 1},
        mobileAnchor: {dist: 7.5, camOffsetX: 0, camY: 1.0, targetOffsetX: 0, targetY: 1.3},
        duration: 12000,
        camMoveDuration: 2200,
        easing: 'out',
        clip: 'idle',
        clips: ['briefcase-standing','idle'],
        clipLoop: false,
        drift: {x: 0.028, y: 0.006, xf: 0.09, yf: 0.13, z: 0.055, zf: 0.07},
        title: 'Experience',
        subtitle: '6+ years building production systems at scale',
        body: 'SENIOR SOFTWARE ENGINEER\n· SEB Stockholm\nJava  Kafka  GCP  OpenShift  Angular\n\nSOFTWARE ENGINEER\n· Cepheid AB Stockholm\nJava  Spring Boot  Angular  AWS\n\nSOFTWARE ENGINEER\n· Expleo Stockholm\nJava  React  AWS  MySQL  Agile',
    },
    {
        // ── ABOUT: Centered camera — watch the biometric scan transform happen ─
        // GHOST_OFFSET_X=0 means wireframe is ON the character.
        // Centered camera (camOffsetX=0, targetOffsetX=0) frames the full body.
        // Left 30% of screen = biometric scan DOM overlay (from about-wireframe.js)
        // Bottom-right = stats panel (6+ yrs, 3 co, 29 tech, 9+ proj)
        // The character mesh fades to 4% opacity as the wireframe T-pose builds.
        name: 'about',
        anchor: {dist: 5.8, camOffsetX: 0, targetOffsetX: 0, chestHeight: 1.3},
        mobileAnchor: {dist: 9.5, camOffsetX: 0, targetOffsetX: 0, chestHeight: 1.0},
        duration: 18000,
        camMoveDuration: 2000,
        easing: 'out',
        clip: 't-pose-frozen',
        clips: ['t-pose-frozen'],
        clipLoop: true,
        drift: {x: 0.008, y: 0.006, xf: 0.14, yf: 0.16},
        title: 'About Me',
        subtitle: 'Transparent by design',
        body: '__ABOUT_STATS__',
    },
    {
        // ── CTA: Stable eye-level, clickable contact links ────────────────────
        // No orbit — user needs a stable scene to actually CLICK the links.
        // Desktop phase-2 settles with the camera shifted LEFT so the character
        // lands right-of-centre and the link panel owns the left third.
        // Mobile keeps the character centred but high in the frame, links below.
        name: 'cta',
        camPos:    new THREE.Vector3(0, 2.2, 8.0),
        camTarget: new THREE.Vector3(0, 0.7, 0),
        camPos2:    new THREE.Vector3(-1.15, 1.5, 7.0),
        camTarget2: new THREE.Vector3(-1.15, 0.9, 0),
        mobileCamPos:    new THREE.Vector3(0, 2.4, 12.0),
        mobileCamTarget: new THREE.Vector3(0, -0.2, 0),
        mobileCamPos2:    new THREE.Vector3(0, 1.5, 10.5),
        mobileCamTarget2: new THREE.Vector3(0, -0.55, 0),
        cam2Delay:    1800,
        cam2Duration: 2400,
        duration: 14000,
        camMoveDuration: 1600,
        easing: 'inOut',
        clip: 'hands-forward-gesture',
        clips: ['hands-forward-gesture', 'head-nod-yes', 'idle'],
        clipLoop: false,
        drift: {x: 0.012, y: 0.007, xf: 0.16, yf: 0.11},
        title: "Let's Connect",
        subtitle: 'Open to opportunities & collaborations',
        body: '__CTA_LINKS__',
    },
    {
        name: 'myworld',
        // Camera sweeps from wherever it was all the way behind the character.
        // Character faces -Z, so behind them is also -Z. Height matches player.js camHeight=2.2.
        camPos: new THREE.Vector3(0, 2.2, -5.5),
        camTarget: new THREE.Vector3(0, 1.0, 0),
        // duration = camera lerp time. _onEnterMyWorld fires iris at 2800ms (after lerp).
        // _goToNextSlide returns early (no slide after myworld) so expiry is harmless.
        duration: 2500,
        easing: 'inOut',
        clip: 'acknowledge',
        clipLoop: false,
        drift: {x: 0.0, y: 0.0, xf: 0.0, yf: 0.0},
        title: 'My World',
        subtitle: 'Step inside and explore freely',
        body: 'Step inside — use WASD or the joystick to move.\nExplore freely. The world is yours.',
    },
];

// ── Lookup helpers ────────────────────────────────────────────────────────────
export const slideByName = Object.fromEntries(SLIDES.map(s => [s.name, s]));
export const indexOf = name => SLIDES.findIndex(s => s.name === name);
export const isLastSlide = name => indexOf(name) >= SLIDES.length - 1;

