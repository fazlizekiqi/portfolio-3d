/**
 * slides.js — The eight presentation slides, in order.
 *
 * Each slide has three sections:
 *   cam    — where the camera goes (pos/target, optional mobile override,
 *             optional phase2 move, move duration, easing, drift)
 *   anim   — what the character does (clip | clips sequence | loop flag)
 *   text   — title / subtitle / body shown in the slide card
 *
 * Special cases handled entirely by presentation.js (not driven by anim fields):
 *   mindset  — plays 'ide-to-walk' once then loops 'walking'
 *   about    — about-wireframe sequence; anim.clip used in the wireframe callback
 *
 * Camera anchor format (experience, about):
 *   cam.anchor / cam.mobile.anchor = { dist, offsetX, camY, targetOffsetX, targetY }
 *   dist          — Z distance from character spawn
 *   offsetX       — camera X offset from character (positive = right)
 *   camY          — camera Y (absolute world units)
 *   targetOffsetX — look-at X offset from character
 *   targetY       — look-at Y (absolute world units)
 */

import * as THREE from 'three';

export const SLIDES = [
  {
    // ── INTRO — wide establishing shot, then gentle pull-in ──────────────────
    name: 'intro',
    cam: {
      pos:    new THREE.Vector3(0, 1.8, 11.5),
      target: new THREE.Vector3(0, 0.7,  0),
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
    // ── SKILLS — panoramic view of the full bubble arch ───────────────────────
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
    subtitle: '29 technologies · 7 domains · production-proven',
    body:     'Click any bubble to explore that domain.',
  },

  {
    // ── PROJECTS — camera matches the baked card positions exactly ────────────
    // _projectPositions() in bubbles.js is calibrated for cam Z=8.5, Y=-0.2,
    // target Y=1.8 — keep those values so all 9 cards sit in the frustum.
    name: 'projects',
    cam: {
      pos:    new THREE.Vector3(0, -0.2, 8.5),
      target: new THREE.Vector3(0,  1.8, 1.0),
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
    // ── MINDSET / HOW I WORK — blueprint patent diagram ───────────────────────
    // Animation: special-cased in presentation.js → ide-to-walk once, then walking loop.
    name: 'mindset',
    cam: {
      pos:    new THREE.Vector3(0, 1.0, 7.2),
      target: new THREE.Vector3(0, 0.95, 0),
      mobile: {
        pos:    new THREE.Vector3(0, 1.0, 11.0),
        target: new THREE.Vector3(0, -0.5, 0),
      },
      phase2: {
        pos:    new THREE.Vector3(0, 1.05, 12),
        target: new THREE.Vector3(0, -0.5,  0),
        delay:  1600,
        ms:     6000,
        // no mobile.phase2 → phase2 is skipped on mobile
      },
      moveMs: 1400,
      easing: 'inOut',
      drift:  { x: 0.010, y: 0.006, xf: 0.24, yf: 0.17 },
    },
    anim: { clip: 'ide-to-walk' },   // presentation.js chains → walking loop
    duration: 19000,
    title:    'How I Work',
    subtitle: 'Four principles I carry into every project',
    body:     '',
  },

  {
    // ── EXPERIENCE — cinematic news-anchor side angle ─────────────────────────
    // anchor: camera positioned relative to the character's spawn point.
    // The slide ends when the experience timeline dispatches '_exp-timeline-done'.
    name: 'experience',
    cam: {
      anchor: { dist: 4.95, offsetX: 1.6, camY: 0.85, targetOffsetX: -0.55, targetY: 1 },
      mobile: {
        anchor: { dist: 7.5, offsetX: 0, camY: 1.0, targetOffsetX: 0, targetY: 1.3 },
      },
      moveMs: 2200,
      easing: 'out',
      drift:  { x: 0.028, y: 0.006, xf: 0.09, yf: 0.13, z: 0.055, zf: 0.07 },
    },
    anim: { clip: 'idle', loop: true },
    duration: 12000,
    title:    'Experience',
    subtitle: '6+ years building production systems at scale',
    body:     'SENIOR SOFTWARE ENGINEER\n· SEB Stockholm\nJava  Kafka  GCP  OpenShift  Angular\n\nSOFTWARE ENGINEER\n· Cepheid AB Stockholm\nJava  Spring Boot  Angular  AWS\n\nSOFTWARE ENGINEER\n· Expleo Stockholm\nJava  React  AWS  MySQL  Agile',
  },

  {
    // ── ABOUT — centred camera, biometric scan sequence ───────────────────────
    // Animation: special-cased in presentation.js → about-wireframe sequence.
    // anim.clip is used directly inside the wireframe callback.
    name: 'about',
    cam: {
      anchor: { dist: 5.8, offsetX: 0, camY: 1.3, targetOffsetX: 0, targetY: 1.3 },
      mobile: {
        anchor: { dist: 9.5, offsetX: 0, camY: 1.0, targetOffsetX: 0, targetY: 1.0 },
      },
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
    // ── LET'S CONNECT — upper-body close-up, contact buttons above head ───────
    name: 'cta',
    cam: {
      pos:    new THREE.Vector3(0, 2.2, 8.0),
      target: new THREE.Vector3(0, 0.7, 0),
      phase2: {
        pos:    new THREE.Vector3(-1.15, 1.5, 7.0),
        target: new THREE.Vector3(-1.15, 0.9, 0),
        delay:  1800,
        ms:     2400,
      },
      mobile: {
        pos:    new THREE.Vector3(0, 2.4, 12.0),
        target: new THREE.Vector3(0, -0.2, 0),
        phase2: {
          pos:    new THREE.Vector3(0, 1.5, 10.5),
          target: new THREE.Vector3(0, -0.55, 0),
          delay:  1800,
          ms:     2400,
        },
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
    // ── MY WORLD — camera sweeps behind character → iris to white world ────────
    // duration = camera lerp time; iris fires at MYWORLD_IRIS_DELAY_MS in presentation.js.
    name: 'myworld',
    cam: {
      pos:    new THREE.Vector3(0, 2.2, -5.5),
      target: new THREE.Vector3(0, 1.0,  0),
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
export const slideByName  = Object.fromEntries(SLIDES.map(s => [s.name, s]));
export const indexOf      = name => SLIDES.findIndex(s => s.name === name);
export const isLastSlide  = name => indexOf(name) >= SLIDES.length - 1;
