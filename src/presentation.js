import * as THREE from 'three';
import { camera, controls } from './scene.js';
import { playClip } from './model.js';

// ── Easing ────────────────────────────────────────────────────────────────────
function easeInOut(t) {
  return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3) / 2;
}

// ── Slide definitions ─────────────────────────────────────────────────────────
// Camera z never closer than 2.8 — always upper body, never face close-up
// Duration in ms — 7 s for detail slides gives time to read + feel the camera
const SLIDES = [
  {
    // Wide opening — full body, generous distance
    camPos:    new THREE.Vector3(0, 0.8, 5.8),
    camTarget: new THREE.Vector3(0, 0.6, 0),
    duration:  6000,
    clipIndex: 0,
    title:     "Hello.",
    body:      "I'm a Software Engineer.\nI build fast, scalable, and beautiful digital products.",
  },
  {
    // Right arc — upper body with plenty of breathing room
    camPos:    new THREE.Vector3(2.8, 1.3, 4.0),
    camTarget: new THREE.Vector3(0, 0.9, 0),
    duration:  7000,
    clipIndex: 1,
    title:     "Full-Stack Development",
    body:      "React · Node.js · TypeScript · Python\nPixel-perfect UIs. Robust, scalable APIs.",
  },
  {
    // Left arc — mirror, upper body
    camPos:    new THREE.Vector3(-2.8, 1.3, 4.0),
    camTarget: new THREE.Vector3(0, 0.9, 0),
    duration:  7000,
    clipIndex: 1,
    title:     "3D & Creative Engineering",
    body:      "Three.js · WebGL · Shaders\nI push the web beyond the flat screen.",
  },
  {
    // Centred, slightly low — confident wide shot
    camPos:    new THREE.Vector3(0, 0.9, 4.2),
    camTarget: new THREE.Vector3(0, 0.85, 0),
    duration:  7000,
    clipIndex: 1,
    title:     "Problem Solver at Heart",
    body:      "Clean architecture · System design · Performance\nComplexity turned into elegant solutions.",
  },
  {
    // Pull fully back — graceful hand-off
    camPos:    new THREE.Vector3(0, 1.2, 5.0),
    camTarget: new THREE.Vector3(0, 0.6, 0),
    duration:  5000,
    clipIndex: 0,
    title:     "Let's build something great.",
    body:      "Drag to explore  ·  Scroll to zoom",
  },
];

// ── Internal state ────────────────────────────────────────────────────────────
let active       = false;
let slideIndex   = 0;
let slideTimer   = 0;
let slideElapsed = 0;

const camPosStart  = new THREE.Vector3();
const camLookStart = new THREE.Vector3();
const camPosTarget  = new THREE.Vector3();
const camLookTarget = new THREE.Vector3();
export const currentCamLook = new THREE.Vector3(0, 0.6, 0);

// ── Slide card (left sidebar) ─────────────────────────────────────────────────
const card = document.createElement('div');
card.style.cssText = `
  position:fixed;left:48px;top:50%;transform:translateY(-50%);
  z-index:20;pointer-events:none;
  font-family:'Share Tech Mono','Courier New',monospace;
  transition:opacity 0.6s ease;opacity:0;max-width:320px;`;
card.innerHTML = `
  <div style="width:2px;height:60px;background:linear-gradient(to bottom,transparent,#00aacc);margin-bottom:16px;"></div>
  <div id="slide-title" style="color:#e8f4ff;font-size:19px;letter-spacing:.05em;line-height:1.3;margin-bottom:14px;text-shadow:0 0 24px rgba(0,180,255,0.4);"></div>
  <div style="width:40px;height:1px;background:#1a5577;margin-bottom:14px;"></div>
  <div id="slide-body" style="color:#5599aa;font-size:11px;letter-spacing:.10em;line-height:2.0;white-space:pre-line;"></div>
  <div style="width:2px;height:40px;background:linear-gradient(to bottom,#00aacc,transparent);margin-top:16px;"></div>`;
document.body.appendChild(card);

const slideTitle = document.getElementById('slide-title');
const slideBody  = document.getElementById('slide-body');

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

// ── Progress bar ──────────────────────────────────────────────────────────────
const progressBar = document.createElement('div');
progressBar.style.cssText = `
  position:fixed;bottom:0;left:0;width:0%;height:1px;
  background:linear-gradient(90deg,#005577,#00aacc,#005577);
  z-index:20;display:none;`;
document.body.appendChild(progressBar);

// ── Next button ───────────────────────────────────────────────────────────────
const nextBtn = document.createElement('button');
nextBtn.textContent = '→';
nextBtn.style.cssText = `
  position:fixed;bottom:56px;right:32px;z-index:20;
  background:rgba(2,8,18,0.88);color:#2299bb;
  border:1px solid rgba(0,150,200,0.4);
  padding:10px 20px;border-radius:3px;font-size:14px;cursor:pointer;
  font-family:'Share Tech Mono','Courier New',monospace;
  backdrop-filter:blur(10px);display:none;`;
nextBtn.addEventListener('click', () => {
  if (!active) return;
  slideIndex++;
  if (slideIndex >= SLIDES.length) { end(); return; }
  showSlide(slideIndex);
  progressBar.style.width = '0%';
});
document.body.appendChild(nextBtn);

// ── Present button ────────────────────────────────────────────────────────────
const presentBtn = document.createElement('button');
presentBtn.textContent = '▶  PRESENT';
presentBtn.style.cssText = `
  position:fixed;bottom:56px;left:50%;transform:translateX(-50%);z-index:20;
  background:rgba(2,8,18,0.88);color:#2299bb;
  border:1px solid rgba(0,150,200,0.4);
  padding:10px 32px;border-radius:3px;font-size:11px;cursor:pointer;
  font-family:'Share Tech Mono','Courier New',monospace;letter-spacing:.18em;
  backdrop-filter:blur(10px);transition:color 0.2s,border-color 0.2s;`;
presentBtn.addEventListener('click', () => { active ? end() : start(); });
document.body.appendChild(presentBtn);

// ── Core helpers ──────────────────────────────────────────────────────────────
function showSlide(index) {
  const slide = SLIDES[index];
  camPosStart.copy(camera.position);
  camLookStart.copy(currentCamLook);
  camPosTarget.copy(slide.camPos);
  camLookTarget.copy(slide.camTarget);
  slideTimer   = slide.duration;
  slideElapsed = 0;
  playClip(slide.clipIndex);

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

function start() {
  active = true;
  slideIndex = 0;
  controls.enabled = false;
  presentBtn.textContent = '✕  EXIT';
  presentBtn.style.borderColor = 'rgba(180,60,60,0.5)';
  presentBtn.style.color = '#cc6666';
  progressBar.style.display = 'block';
  showSlide(0);
}

function end() {
  active = false;
  controls.enabled = true;
  card.style.opacity = '0';
  progressBar.style.display = 'none';
  presentBtn.textContent = '▶  PRESENT';
  presentBtn.style.borderColor = 'rgba(0,150,200,0.4)';
  presentBtn.style.color = '#2299bb';
  playClip(0);

  camPosStart.copy(camera.position);
  camLookStart.copy(currentCamLook);
  camPosTarget.set(0, 1.2, 5.0);
  camLookTarget.set(0, 0.6, 0);
  slideElapsed = 0;
  slideTimer   = 1400;
}

// ── Per-frame tick — call from animate loop ───────────────────────────────────
// Returns true while camera is being driven (presentation OR return glide)
export function tickPresentation(delta, elapsed) {
  if (!active && slideTimer <= 0) {
    nextBtn.style.display = 'none';
    controls.update();
    return false;
  }

  slideElapsed += delta * 1000;
  const totalDur = active ? SLIDES[slideIndex].duration : 1400;
  const rawT     = Math.min(slideElapsed / totalDur, 1.0);
  const easedT   = easeInOut(rawT);

  camera.position.lerpVectors(camPosStart, camPosTarget, easedT);
  currentCamLook.lerpVectors(camLookStart, camLookTarget, easedT);

  // Micro-drift once camera has settled (last 15% of slide)
  if (active && rawT > 0.85) {
    const s = (rawT - 0.85) / 0.15;
    camera.position.x += Math.sin(elapsed * 0.35 + slideIndex * 1.1) * 0.006 * s;
    camera.position.y += Math.sin(elapsed * 0.22 + slideIndex * 0.7) * 0.003 * s;
  }

  camera.lookAt(currentCamLook);

  if (active) {
    nextBtn.style.display = 'block';
    slideTimer -= delta * 1000;
    progressBar.style.width = `${Math.max(0, 1 - slideTimer / SLIDES[slideIndex].duration) * 100}%`;

    if (slideTimer <= 0) {
      slideIndex++;
      if (slideIndex >= SLIDES.length) end(true);  // natural end → burn transition
      else { showSlide(slideIndex); progressBar.style.width = '0%'; }
    }
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

