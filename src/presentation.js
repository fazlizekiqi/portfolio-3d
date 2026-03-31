import * as THREE from 'three';
import { camera, controls } from './scene.js';
import { playClip } from './model.js';


// ── Easing library ────────────────────────────────────────────────────────────
const EASE = {
  inOut:   t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3) / 2,
  in:      t => t * t * t,
  out:     t => 1 - Math.pow(1 - t, 3),
  outBack: t => { const c1=1.70158, c3=c1+1; return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2); },
  linear:  t => t,
};

// ── Slides ────────────────────────────────────────────────────────────────────
//
//  name      — unique identifier, used in all call sites below
//  camPos    — where the camera moves to
//  camTarget — what point the camera looks at
//  duration  — slide duration in ms
//  easing    — key from EASE above
//  clip      — GLB animation name to play
//  drift     — idle breathing after the camera settles (absolute world-unit offsets)
//  onEnter   — optional fn called once when the slide becomes active
//
const SLIDES = [
  {
    name:      'intro',
    camPos:    new THREE.Vector3(0, 0.4, 7.2),
    camTarget: new THREE.Vector3(0, 0.5, 0),
    duration:  6500,
    easing:    'out',
    clip:      'praying',
    drift:     { x: 0.018, y: 0.010, xf: 0.28, yf: 0.18 },
    title:     "Hello.",
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
    title:     "Full-Stack Development",
    body:      "React · Node.js · TypeScript · Python\nPixel-perfect UIs. Robust, scalable APIs.",
  },
  {
    name:      'creative',
    camPos:    new THREE.Vector3(-2.6, 1.8, 3.8),
    camTarget: new THREE.Vector3(0, 1.0, 0),
    duration:  7000,
    easing:    'outBack',
    clip:      'praying',
    drift:     { x: 0.016, y: 0.022, xf: 0.19, yf: 0.27 },
    title:     "3D & Creative Engineering",
    body:      "Three.js · WebGL · Shaders\nI push the web beyond the flat screen.",
  },
  {
    name:      'problem-solver',
    camPos:    new THREE.Vector3(0.4, 0.7, 3.2),
    camTarget: new THREE.Vector3(0, 0.75, 0),
    duration:  7000,
    easing:    'in',
    clip:      'idle',
    drift:     { x: 0.012, y: 0.008, xf: 0.31, yf: 0.20 },
    title:     "Problem Solver at Heart",
    body:      "Clean architecture · System design · Performance\nComplexity turned into elegant solutions.",
  },
  {
    name:      'cta',
    camPos:    new THREE.Vector3(0, 1.6, 6.0),
    camTarget: new THREE.Vector3(0, 0.55, 0),
    duration:  5500,
    easing:    'out',
    clip:      'praying',
    drift:     { x: 0.028, y: 0.010, xf: 0.15, yf: 0.10 },
    title:     "Let's build something great.",
    body:      "Drag to explore  ·  Scroll to zoom",
  },
];

// ── Lookup helpers ────────────────────────────────────────────────────────────
const slideByName = Object.fromEntries(SLIDES.map(s => [s.name, s]));
const indexOf     = name => SLIDES.findIndex(s => s.name === name);

// ── Internal state ────────────────────────────────────────────────────────────
let active       = false;
let currentSlide = SLIDES[0];
let slideTimer   = 0;
let slideElapsed = 0;
let settledTime  = 0;

const camPosStart   = new THREE.Vector3();
const camLookStart  = new THREE.Vector3();
const camPosTarget  = new THREE.Vector3();
const camLookTarget = new THREE.Vector3();
export const currentCamLook = new THREE.Vector3(0, 0.6, 0);

// ── DOM ───────────────────────────────────────────────────────────────────────
const card = document.createElement('div');
card.style.cssText = `
  position:fixed;left:48px;top:50%;transform:translateY(-50%);
  z-index:20;pointer-events:none;max-width:320px;
  opacity:0;transition:opacity 0.6s ease;`;
card.innerHTML = `
  <div style="width:2px;height:60px;background:linear-gradient(to bottom,transparent,#00aacc);margin-bottom:16px;"></div>
  <div id="_sTitle" style="color:#e8f4ff;font-size:19px;letter-spacing:.05em;line-height:1.3;margin-bottom:14px;text-shadow:0 0 24px rgba(0,180,255,0.4);"></div>
  <div style="width:40px;height:1px;background:#1a5577;margin-bottom:14px;"></div>
  <div id="_sBody"  style="color:#5599aa;font-size:11px;letter-spacing:.10em;line-height:2.0;white-space:pre-line;"></div>
  <div style="width:2px;height:40px;background:linear-gradient(to bottom,#00aacc,transparent);margin-top:16px;"></div>`;
document.body.appendChild(card);
const slideTitle = card.querySelector('#_sTitle');
const slideBody  = card.querySelector('#_sBody');

const progressWrap = document.createElement('div');
progressWrap.style.cssText = `
  position:fixed;bottom:0;left:0;right:0;height:2px;
  background:rgba(0,150,200,0.12);display:none;z-index:20;`;
const progressFill = document.createElement('div');
progressFill.style.cssText = `width:0%;height:100%;background:linear-gradient(90deg,#005577,#00aacc);`;
progressWrap.appendChild(progressFill);
document.body.appendChild(progressWrap);

const nextBtn = document.createElement('button');
nextBtn.textContent = '→';
nextBtn.style.cssText = `
  position:fixed;bottom:56px;right:32px;z-index:20;
  background:rgba(2,8,18,0.88);color:#2299bb;
  border:1px solid rgba(0,150,200,0.4);
  padding:10px 20px;border-radius:3px;font-size:14px;cursor:pointer;
  font-family:'Share Tech Mono','Courier New',monospace;
  backdrop-filter:blur(10px);display:none;`;
document.body.appendChild(nextBtn);

const presentBtn = document.createElement('button');
presentBtn.textContent = '▶\u00a0\u00a0PRESENT';
presentBtn.style.cssText = `
  position:fixed;bottom:56px;left:50%;transform:translateX(-50%);z-index:20;
  background:rgba(2,8,18,0.88);color:#2299bb;
  border:1px solid rgba(0,150,200,0.4);
  padding:10px 32px;border-radius:3px;font-size:11px;letter-spacing:.18em;cursor:pointer;
  font-family:'Share Tech Mono','Courier New',monospace;
  backdrop-filter:blur(10px);transition:color 0.2s,border-color 0.2s;`;
document.body.appendChild(presentBtn);

// ── Typewriter ────────────────────────────────────────────────────────────────
let typeTimerA = null, typeTimerB = null;
function typeWrite(el, text, speed, cb) {
  el.textContent = '';
  let i = 0;
  const t = setInterval(() => {
    el.textContent += text[i++];
    if (i >= text.length) { clearInterval(t); if (cb) cb(); }
  }, speed);
  return t;
}

// ── Presentation flow ─────────────────────────────────────────────────────────

function goToSlide(name) {
  const slide = slideByName[name];
  if (!slide) { console.warn(`goToSlide: unknown slide "${name}"`); return; }

  currentSlide = slide;
  slideTimer   = slide.duration;
  slideElapsed = 0;
  settledTime  = 0;

  camPosStart.copy(camera.position);
  camLookStart.copy(currentCamLook);
  camPosTarget.copy(slide.camPos);
  camLookTarget.copy(slide.camTarget);

  playClip(slide.clip);
  if (slide.onEnter) slide.onEnter();

  progressFill.style.width = '0%';

  card.style.opacity = '0';
  if (typeTimerA) clearInterval(typeTimerA);
  if (typeTimerB) clearInterval(typeTimerB);
  slideTitle.textContent = '';
  slideBody.textContent  = '';
  setTimeout(() => {
    card.style.opacity = '1';
    typeTimerA = typeWrite(slideTitle, slide.title, 38, () => {
      typeTimerB = typeWrite(slideBody, slide.body, 20);
    });
  }, 550);
}

function goToNextSlide() {
  const nextIndex = indexOf(currentSlide.name) + 1;
  if (nextIndex >= SLIDES.length) { end(); return; }
  goToSlide(SLIDES[nextIndex].name);
}

function start() {
  active = true;
  controls.enabled = false;
  presentBtn.textContent = '✕  EXIT';
  presentBtn.style.color = '#cc6666';
  presentBtn.style.borderColor = 'rgba(180,60,60,0.5)';
  progressWrap.style.display = 'block';
  nextBtn.style.display = 'block';
  goToSlide('intro');
}

function end() {
  active = false;
  controls.enabled = true;
  card.style.opacity = '0';
  progressWrap.style.display = 'none';
  nextBtn.style.display = 'none';
  presentBtn.textContent = '▶\u00a0\u00a0PRESENT';
  presentBtn.style.color = '#2299bb';
  presentBtn.style.borderColor = 'rgba(0,150,200,0.4)';

  playClip(slideByName['intro'].clip);

  // Glide camera back to default position
  camPosStart.copy(camera.position);
  camLookStart.copy(currentCamLook);
  camPosTarget.set(0, 1.2, 5.0);
  camLookTarget.set(0, 0.6, 0);
  slideElapsed = 0;
  slideTimer   = 1400;
}

// ── Button listeners ──────────────────────────────────────────────────────────
nextBtn.addEventListener('click',    () => { if (active) goToNextSlide(); });
presentBtn.addEventListener('click', () => { active ? end() : start(); });

// ── Per-frame tick ────────────────────────────────────────────────────────────
export function tickPresentation(delta, elapsed) {
  if (!active && slideTimer <= 0) {
    controls.update();
    return false;
  }

  slideElapsed += delta * 1000;
  const totalDur = active ? currentSlide.duration : 1400;
  const rawT     = Math.min(slideElapsed / totalDur, 1.0);
  const easeFn   = active ? EASE[currentSlide.easing] ?? EASE.inOut : EASE.out;
  const easedT   = easeFn(rawT);

  camera.position.lerpVectors(camPosStart, camPosTarget, easedT);
  currentCamLook.lerpVectors(camLookStart, camLookTarget, easedT);

  // Drift — only after the camera has fully arrived, fades in over 0.8 s
  if (active && rawT >= 1.0) {
    settledTime += delta;
    const s = Math.min(settledTime / 0.8, 1.0);
    const d = currentSlide.drift;
    if (d) {
      camera.position.x = camPosTarget.x + Math.sin(elapsed * d.xf + indexOf(currentSlide.name) * 1.3) * d.x * s;
      camera.position.y = camPosTarget.y + Math.sin(elapsed * d.yf + indexOf(currentSlide.name) * 0.9) * d.y * s;
    }
  }

  camera.lookAt(currentCamLook);

  if (active) {
    slideTimer -= delta * 1000;
    progressFill.style.width = `${Math.max(0, 1 - slideTimer / currentSlide.duration) * 100}%`;
    if (slideTimer <= 0) goToNextSlide();
  } else if (rawT >= 1.0) {
    slideTimer = 0;
    controls.target.copy(camLookTarget);
    controls.update();
  }

  return true;
}

// ── Init camera lerp state (call once at startup) ─────────────────────────────
export function initCameraState() {
  camPosTarget.copy(camera.position);
  camPosStart.copy(camera.position);
  camLookTarget.copy(controls.target);
  camLookStart.copy(controls.target);
  currentCamLook.copy(controls.target);
}

// ── Public API ────────────────────────────────────────────────────────────────
export { goToSlide };
