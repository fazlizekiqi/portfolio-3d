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
    name:      'intro',
    camPos:    new THREE.Vector3(0, 0.4, 7.2),
    camTarget: new THREE.Vector3(0, 0.5, 0),
    duration:  10000,
    easing:    'out',
    clip:      'idle',
    clips:      ['idle', 'waving'],
    clipLoop:  false,
    drift:     { x: 0.018, y: 0.010, xf: 0.28, yf: 0.18 },
    title:     'Fazli Zekiqi',
    body:      'Senior Software Engineer · Stockholm\nBuilding scalable systems that handle millions of events.',
  },
  {
    name:      'skills',
    camPos:    new THREE.Vector3(0, 1.2, 7.2),
    camTarget: new THREE.Vector3(0, 0.9, 0),
    duration:  22000,
    easing:    'inOut',
    clip:      'arm-gesture',
    clips:     ['arm-gesture','briefcase-standing', 'arm-gesture-mirror.001','idle'],
    clipLoop:  false,
    drift:     { x: 0.022, y: 0.012, xf: 0.22, yf: 0.14 },
    title:     'What I Do',
    body:      'Have a look around and see for yourself — click the skill bubbles to explore my tech stack and workflow.',
  },
  {
    name:      'projects',
    camPos:    new THREE.Vector3(0, -0.2, 8.5),
    camTarget: new THREE.Vector3(0, 1.8, 1.0),
    // On mobile the card sits at the bottom, so we pull the camera back a bit
    // and look straight at the character's torso — this centres them in the
    // upper 70 % of the screen above the card strip.
    mobileCamPos:    new THREE.Vector3(0, 0.5, 10),
    mobileCamTarget: new THREE.Vector3(0, -0.5, 0),
    duration:  20000,
    easing:    'outBack',
    clip:      'happy-idle',
    clips:      ['happy-idle','briefcase-standing', 'whatever' ],
    clipLoop:  false,
    drift:     { x: 0.016, y: 0.022, xf: 0.19, yf: 0.27 },
    title:     'Selected Work',
    body:      'These are some of the projects I\'ve worked on recently. Click the cards to see them. Some of them were doing for different clients and some of them are personal projects where i had the freedom to explore and experiment with new technologies and ideas.',
  },
  {
    name:      'mindset',
    camPos:    new THREE.Vector3(0.4, 0.7, 3.2),
    camTarget: new THREE.Vector3(0, 0.75, 0),
    duration:  10000,
    easing:    'in',
    clip:      'pointing',
    clips:     ['pointing', 'idle'],
    clipLoop:  false,
    drift:     { x: 0.012, y: 0.008, xf: 0.31, yf: 0.20 },
    title:     'How I Work',
    body:      'Design for scalability & reliability first\nClean, maintainable architecture\nObservability and monitoring by default\nClose collaboration with teams & stakeholders',
  },
  {
    name:      'experience',
    camPos:    new THREE.Vector3(-1.8, 1.4, 4.2),
    camTarget: new THREE.Vector3(0, 0.9, 0),
    duration:  10000,
    easing:    'inOut',
    clip:      'wiping-sweat',
    clips:      ['relieved-sigh', 'relieved-sigh'],
    clipLoop:  false,
    drift:     { x: 0.014, y: 0.010, xf: 0.24, yf: 0.16 },
    title:     'Experience',
    body:      'Senior Software Engineer · SEB Stockholm\nDigital documents & notifications at scale\nJava · Kafka · GCP · OpenShift · Angular\n\nSoftware Engineer · Cepheid AB Stockholm\nLaboratory test-result platform\nJava · Spring Boot · Angular · AWS · Jenkins ' +
        '\n\nSoftware Engineer · Expleo Stockholm\nCustom software solutions for clients\nJava · React · AWS · MySql · Agile',
  },
  {
    name:      'about',
    camPos:    new THREE.Vector3(1.6, 1.6, 4.0),
    camTarget: new THREE.Vector3(0, 1.0, 0),
    duration:  10000,
    easing:    'outBack',
    clip:      'briefcase-standing',
    clips:     ['briefcase-standing', 'listen-to-music'],
    clipLoop:  false,
    drift:     { x: 0.018, y: 0.014, xf: 0.20, yf: 0.22 },
    title:     'About Me',
    body:      'Based in Stockholm\nI enjoy building robust, scalable, innovative systems\nand solving complex problems.\n\nOutside work: Training / Running · Electronics / Robots',
  },
  {
    name:      'cta',
    camPos:    new THREE.Vector3(0, 2.2, 7.0),
    camTarget: new THREE.Vector3(0, 0.8, 0),
    duration:  13000,
    easing:    'inOut',
    clip:      'hands-forward-gesture',
    clips:     [ 'hands-forward-gesture', 'head-nod-yes', 'idle'],
    clipLoop:  true,
    drift:     { x: 0.014, y: 0.008, xf: 0.18, yf: 0.12 },
    title:     "Let's Connect",
    body:      'fazlizekiqi1@hotmail.com\nlinkedin.com/in/fazli-zekiqi\ngithub.com/fazlizekiqi\n\nOpen to opportunities & collaborations.',
  },
  {
    name:      'myworld',
    // Camera sweeps from wherever it was all the way behind the character.
    // Character faces -Z, so behind them is also -Z. Height matches player.js camHeight=2.2.
    camPos:    new THREE.Vector3(0, 2.2, -5.5),
    camTarget: new THREE.Vector3(0, 1.0, 0),
    // duration = camera lerp time. _onEnterMyWorld fires iris at 2800ms (after lerp).
    // _goToNextSlide returns early (no slide after myworld) so expiry is harmless.
    duration:  2500,
    easing:    'inOut',
    clip:      'acknowledge',
    clipLoop:  false,
    drift:     { x: 0.0, y: 0.0, xf: 0.0, yf: 0.0 },
    title:     'My World',
    body:      'Step inside — use WASD or the joystick to move.\nExplore freely. The world is yours.',
  },
];

// ── Lookup helpers ────────────────────────────────────────────────────────────
export const slideByName = Object.fromEntries(SLIDES.map(s => [s.name, s]));
export const indexOf     = name => SLIDES.findIndex(s => s.name === name);
export const isLastSlide = name => indexOf(name) >= SLIDES.length - 1;

