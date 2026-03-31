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
    name:      'intro',
    camPos:    new THREE.Vector3(0, 0.4, 7.2),
    camTarget: new THREE.Vector3(0, 0.5, 0),
    duration:  6500,
    easing:    'out',
    clip:      'praying',
    drift:     { x: 0.018, y: 0.010, xf: 0.28, yf: 0.18 },
    title:     'Hello.',
    body:      "I'm a Software Engineer.\nI build fast, scalable, and beautiful digital products.",
  },
  {
    name:      'fullstack',
    camPos:    new THREE.Vector3(2.2, 1.1, 3.6),
    camTarget: new THREE.Vector3(0, 0.85, 0),
    duration:  7000,
    easing:    'inOut',
    clip:      'idle',
    drift:     { x: 0.022, y: 0.012, xf: 0.22, yf: 0.14 },
    title:     'Full-Stack Development',
    body:      'React · Node.js · TypeScript · Python\nPixel-perfect UIs. Robust, scalable APIs.',
  },
  {
    name:      'creative',
    camPos:    new THREE.Vector3(-2.6, 1.8, 3.8),
    camTarget: new THREE.Vector3(0, 1.0, 0),
    duration:  7000,
    easing:    'outBack',
    clip:      'praying',
    drift:     { x: 0.016, y: 0.022, xf: 0.19, yf: 0.27 },
    title:     '3D & Creative Engineering',
    body:      'Three.js · WebGL · Shaders\nI push the web beyond the flat screen.',
  },
  {
    name:      'problem-solver',
    camPos:    new THREE.Vector3(0.4, 0.7, 3.2),
    camTarget: new THREE.Vector3(0, 0.75, 0),
    duration:  7000,
    easing:    'in',
    clip:      'idle',
    drift:     { x: 0.012, y: 0.008, xf: 0.31, yf: 0.20 },
    title:     'Problem Solver at Heart',
    body:      'Clean architecture · System design · Performance\nComplexity turned into elegant solutions.',
  },
  {
    name:      'cta',
    camPos:    new THREE.Vector3(0, 2.6, -9.0),
    camTarget: new THREE.Vector3(0, 0.9, 0),
    duration:  6000,
    easing:    'inOut',
    clip:      'idle',
    drift:     { x: 0.014, y: 0.008, xf: 0.18, yf: 0.12 },
    title:     'Step into my world.',
    body:      "A space where I live, create, and build.\nLet's explore it together.",
  },
];

// ── Lookup helpers ────────────────────────────────────────────────────────────
export const slideByName = Object.fromEntries(SLIDES.map(s => [s.name, s]));
export const indexOf     = name => SLIDES.findIndex(s => s.name === name);
export const isLastSlide = name => indexOf(name) >= SLIDES.length - 1;

