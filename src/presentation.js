import * as THREE from 'three';
import { camera, controls } from './scene.js';
import { playClip } from './model.js';
import { goToWhiteWorld, goToBlueWorld, isWhiteWorld } from './transition.js';


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
//  name      — unique identifier used in all call sites
//  camPos    — where the camera moves to
//  camTarget — what the camera looks at
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
    // Camera orbits behind the character, still looking at them.
    // After 3.8 s the burn-iris fires and the white world is revealed.
    camPos:    new THREE.Vector3(0, 2.6, -9.0),
    camTarget: new THREE.Vector3(0, 0.9, 0),
    duration:  6000,
    easing:    'inOut',
    clip:      'idle',
    drift:     { x: 0.014, y: 0.008, xf: 0.18, yf: 0.12 },
    title:     "Step into my world.",
    body:      "A space where I live, create, and build.\nLet's explore it together.",
    onEnter() {
      showExploreUI();
      frozen     = false;
      ctaTimeout = setTimeout(() => {
        ctaTimeout = null;
        frozen     = true;
        goToWhiteWorld();
        endFromCta();
      }, 3800);
    },
  },
];

// ── Lookup helpers ────────────────────────────────────────────────────────────
const slideByName = Object.fromEntries(SLIDES.map(s => [s.name, s]));
const indexOf     = name => SLIDES.findIndex(s => s.name === name);
const isLastSlide = name => indexOf(name) >= SLIDES.length - 1;

// ── State ─────────────────────────────────────────────────────────────────────
let active       = false;
let currentSlide = SLIDES[0];
let slideTimer   = 0;
let slideElapsed = 0;
let settledTime  = 0;
let ctaTimeout   = null;
let frozen       = false;  // blocks camera writes once the white-world transition fires

const camPosStart   = new THREE.Vector3();
const camLookStart  = new THREE.Vector3();
const camPosTarget  = new THREE.Vector3();
const camLookTarget = new THREE.Vector3();
export const currentCamLook = new THREE.Vector3(0, 0.6, 0);

// ── DOM — slide card ──────────────────────────────────────────────────────────
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

// ── DOM — progress bar ────────────────────────────────────────────────────────
const progressWrap = document.createElement('div');
progressWrap.style.cssText = `
  position:fixed;bottom:0;left:0;right:0;height:2px;
  background:rgba(0,150,200,0.12);display:none;z-index:20;`;
const progressFill = document.createElement('div');
progressFill.style.cssText = `width:0%;height:100%;background:linear-gradient(90deg,#005577,#00aacc);`;
progressWrap.appendChild(progressFill);
document.body.appendChild(progressWrap);

// ── DOM — buttons ─────────────────────────────────────────────────────────────
const BTN_BASE = `
  position:fixed;bottom:56px;z-index:20;
  background:rgba(2,8,18,0.88);
  border-radius:3px;font-size:11px;letter-spacing:.18em;cursor:pointer;
  font-family:'Share Tech Mono','Courier New',monospace;
  backdrop-filter:blur(10px);transition:color 0.2s,border-color 0.2s;`;

const nextBtn = document.createElement('button');
nextBtn.textContent = '→';
nextBtn.style.cssText = BTN_BASE + `
  right:32px;color:#2299bb;font-size:14px;
  border:1px solid rgba(0,150,200,0.4);
  padding:10px 20px;display:none;`;
document.body.appendChild(nextBtn);

const presentBtn = document.createElement('button');
presentBtn.textContent = '▶\u00a0\u00a0PRESENT';
presentBtn.style.cssText = BTN_BASE + `
  left:50%;transform:translateX(-50%);color:#2299bb;
  border:1px solid rgba(0,150,200,0.4);
  padding:10px 32px;`;
document.body.appendChild(presentBtn);

const exploreBtn = document.createElement('button');
exploreBtn.textContent = 'EXPLORE';
exploreBtn.style.cssText = BTN_BASE + `
  left:32px;color:#336677;
  border:1px solid rgba(0,150,200,0.2);
  padding:10px 20px;`;
document.body.appendChild(exploreBtn);

const backBtn = document.createElement('button');
backBtn.textContent = '← BACK';
backBtn.style.cssText = BTN_BASE + `
  left:32px;color:#336677;
  border:1px solid rgba(0,150,200,0.2);
  padding:10px 20px;display:none;`;
document.body.appendChild(backBtn);

// ── UI mode helpers ───────────────────────────────────────────────────────────
function showIdleUI() {
  backBtn.style.display    = 'none';
  presentBtn.style.display = 'block';
  exploreBtn.style.display = 'block';
}

function showPresentingUI() {
  backBtn.style.display    = 'none';
  presentBtn.style.display = 'block';
  exploreBtn.style.display = 'block';
  presentBtn.textContent   = '✕  EXIT';
  presentBtn.style.color   = '#cc6666';
  presentBtn.style.borderColor = 'rgba(180,60,60,0.5)';
  progressWrap.style.display = 'block';
}

function showExploreUI() {
  presentBtn.style.display = 'none';
  exploreBtn.style.display = 'none';
  // backBtn is shown only once the white world is fully revealed (endFromCta)
}

function resetPresentBtn() {
  presentBtn.textContent   = '▶\u00a0\u00a0PRESENT';
  presentBtn.style.color   = '#2299bb';
  presentBtn.style.borderColor = 'rgba(0,150,200,0.4)';
}

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

// ── Camera helpers ────────────────────────────────────────────────────────────
function startCameraMove(toPos, toLook) {
  camPosStart.copy(camera.position);
  camLookStart.copy(currentCamLook);
  camPosTarget.copy(toPos);
  camLookTarget.copy(toLook);
  slideElapsed = 0;
}

function glideHome() {
  startCameraMove(
    new THREE.Vector3(0, 1.8, 11.0),
    new THREE.Vector3(0, 0.6, 0),
  );
  slideTimer = 1400;
}

// ── Presentation flow ─────────────────────────────────────────────────────────

export function goToSlide(name) {
  const slide = slideByName[name];
  if (!slide) { console.warn(`goToSlide: unknown slide "${name}"`); return; }

  if (ctaTimeout) { clearTimeout(ctaTimeout); ctaTimeout = null; }
  frozen = false;

  currentSlide = slide;
  slideTimer   = slide.duration;
  slideElapsed = 0;
  settledTime  = 0;

  nextBtn.style.display = isLastSlide(name) ? 'none' : 'block';

  startCameraMove(slide.camPos, slide.camTarget);
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
  const next = SLIDES[indexOf(currentSlide.name) + 1];
  if (!next) { endFromCta(); return; }
  goToSlide(next.name);
}

function startPresentation() {
  active = true;
  controls.enabled = false;
  showPresentingUI();
  goToSlide('intro');
}

function endPresentation() {
  active = false;
  if (ctaTimeout) { clearTimeout(ctaTimeout); ctaTimeout = null; }

  card.style.opacity         = '0';
  progressWrap.style.display = 'none';
  nextBtn.style.display      = 'none';
  resetPresentBtn();
  showIdleUI();

  controls.enabled     = true;
  controls.maxDistance = 20;
  playClip(slideByName['intro'].clip);
  glideHome();
}

function endFromCta() {
  // Called when the CTA burn-iris fires — frozen is already true,
  // camera is locked, white world owns the scene from here.
  active = false;
  if (ctaTimeout) { clearTimeout(ctaTimeout); ctaTimeout = null; }

  card.style.opacity         = '0';
  progressWrap.style.display = 'none';
  nextBtn.style.display      = 'none';
  resetPresentBtn();

  slideTimer   = 0;
  slideElapsed = 0;
  settledTime  = 0;
  controls.maxDistance = 32;

  // Re-enable controls once the iris has fully closed
  setTimeout(() => {
    frozen = false;
    controls.target.copy(currentCamLook);
    controls.enabled = true;
    backBtn.style.display = 'block';
  }, 3200);
}

function returnHome() {
  // Shared logic for the back button — transition out of white world if needed,
  // then glide the camera back to the default position.
  frozen           = true;
  controls.enabled = false;

  const arrive = () => {
    frozen               = false;
    active               = false;
    controls.maxDistance = 20;
    controls.enabled     = true;
    showIdleUI();
    glideHome();
  };

  if (isWhiteWorld()) {
    goToBlueWorld();
    setTimeout(arrive, 3200);
  } else {
    arrive();
  }
}

// ── Button wiring ─────────────────────────────────────────────────────────────
nextBtn.addEventListener('click', () => {
  if (active) goToNextSlide();
});

exploreBtn.addEventListener('click', () => {
  showExploreUI();
  if (!active) {
    active = true;
    controls.enabled = false;
    progressWrap.style.display = 'block';
  }
  goToSlide('cta');
});

backBtn.addEventListener('click', () => {
  backBtn.style.display = 'none';
  returnHome();
});

presentBtn.addEventListener('click', () => {
  active ? endPresentation() : startPresentation();
});

// ── Per-frame tick ────────────────────────────────────────────────────────────
export function tickPresentation(delta, elapsed) {
  if (!active && slideTimer <= 0) {
    if (!frozen) controls.update();
    return false;
  }

  slideElapsed += delta * 1000;
  const totalDur = active ? currentSlide.duration : 1400;
  const rawT     = Math.min(slideElapsed / totalDur, 1.0);
  const easeFn   = active ? EASE[currentSlide.easing] ?? EASE.inOut : EASE.out;
  const easedT   = easeFn(rawT);

  if (!frozen) {
    camera.position.lerpVectors(camPosStart, camPosTarget, easedT);
    currentCamLook.lerpVectors(camLookStart, camLookTarget, easedT);

    // Drift — fades in over 0.8 s once the camera has fully arrived
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
  }

  if (active) {
    slideTimer -= delta * 1000;
    progressFill.style.width = `${Math.max(0, 1 - slideTimer / currentSlide.duration) * 100}%`;
    if (slideTimer <= 0 && !frozen) goToNextSlide();
  } else if (!frozen && rawT >= 1.0) {
    slideTimer = 0;
    controls.target.copy(camLookTarget);
    controls.update();
  }

  return true;
}

// ── Init (call once after model loads) ───────────────────────────────────────
export function initCameraState() {
  camPosTarget.copy(camera.position);
  camPosStart.copy(camera.position);
  camLookTarget.copy(controls.target);
  camLookStart.copy(controls.target);
  currentCamLook.copy(controls.target);
}
