/**
 * presentation.js — Orchestrator.
 *
 * Imports slides data, camera helpers, and UI helpers and wires them
 * together. Has no inline DOM, no inline math, no inline slide data.
 *
 * Public API
 * ──────────
 *   initCameraState()       – call once after model loads
 *   goToSlide(name)         – jump to a named slide
 *   tickPresentation(delta, elapsed)
 */

import { controls } from '../scene.js';
import { playClip, playFeaturedClip, playClipSequence, cancelIdleLoop, playRandomIdleAnim, modelGroup, spawnPosition, spawnRotation } from '../character/model.js';
import * as THREE from 'three';
import { goToWhiteWorld, goToBlueWorld, isWhiteWorld } from '../transition.js';
import { isPlayerActive, playerTakeControl, playerReleaseControl, playerStop } from '../character/player.js';
import { explodeAndThen, triggerReassemble, setOnReassembled, resetExplodeGroupTransform } from '../character/explode.js';

import { SLIDES, slideByName, indexOf, isLastSlide } from './slides.js';
import { showSkillBubbles, showProjectBubbles, hideBubbles } from './bubbles.js';
import {
  startCameraMove, glideHome, tickCamera,
  camLookTarget, currentCamLook,
  resetSlideElapsed,
} from './camera.js';
import {
  progressWrap, nextBtn, prevBtn, presentBtn, exploreBtn, backBtn,
  showIdleUI, showPresentingUI, showExploreUI, showWhiteWorldUI, showBackBtn,
  resetPresentBtn, setProgressFill, hideCard, showCard,
} from './ui.js';
import { showHowIWorkOverlay, hideHowIWorkOverlay } from './how-i-work-overlay.js';
import { showAboutWireframe, hideAboutWireframe, tickAboutWireframe } from '../character/about-wireframe.js';

export { initCameraState } from './camera.js';
export { currentCamLook }  from './camera.js';

/** Compute the news-anchor camera pos/target for the experience slide. */
function _experienceCam(slide) {
  const isMobile = window.innerWidth < 768;
  const a      = (isMobile && slide.mobileAnchor) ? slide.mobileAnchor : slide.anchor;
  const base   = spawnPosition;
  // New anchor format: camOffsetX, camY, targetOffsetX, targetY
  // Legacy format: chestHeight, targetOffset (kept for backwards compat)
  const camY      = a.camY    ?? (base.y + (a.chestHeight ?? 1.1));
  const targetY   = a.targetY ?? camY;
  const camX      = a.camOffsetX    != null ? base.x + a.camOffsetX    : base.x;
  const targetX   = a.targetOffsetX != null ? base.x + a.targetOffsetX : base.x - (a.targetOffset ?? 0);
  const pos    = new THREE.Vector3(camX,    base.y + camY,    base.z + a.dist);
  const target = new THREE.Vector3(targetX, base.y + targetY, base.z);
  return { pos, target };
}

/** Camera for the about slide — character right, wireframe ghost left. */
function _aboutCam(slide) {
  const isMobile = window.innerWidth < 768;
  const a      = (isMobile && slide.mobileAnchor) ? slide.mobileAnchor : slide.anchor;
  const base   = spawnPosition;
  const chestY = base.y + a.chestHeight;
  const pos    = new THREE.Vector3(base.x + a.camOffsetX, chestY, base.z + a.dist);
  const target = new THREE.Vector3(base.x + a.targetOffsetX, chestY, base.z);
  return { pos, target };
}

/** Re-applies a slide's camera live — pass the slide object from the GUI. */
export function applySlideCam(slide) {
  const s = slide || _currentSlide;
  if (!s) return;

  let pos, target;

  if (s.name === 'experience') {
    ({ pos, target } = _experienceCam(s));
  } else if (s.name === 'about') {
    ({ pos, target } = _aboutCam(s));
  } else {
    const isMobile = window.innerWidth < 768;
    pos    = (isMobile && s.mobileCamPos)    ? s.mobileCamPos    : s.camPos;
    target = (isMobile && s.mobileCamTarget) ? s.mobileCamTarget : s.camTarget;
  }

  _camMoveDuration = 600;
  startCameraMove(pos, target);
}

// ── State ─────────────────────────────────────────────────────────────────────
let _active        = false;
let _paused        = false;
let _currentSlide  = SLIDES[0];
let _slideTimer    = 0;
let _glideDuration = 1400;
let _frozen        = false;
let _ctaTimeout    = null;
let _cam2Timeout   = null;
let _overlayTimeout = null;   // delayed show of how-i-work overlay
let _camMoveDuration = 1400; // tracks current camera-move leg duration

// ── CTA slide — just show contact info, no auto-transition ───────────────────
function _onEnterCta() {
  _frozen = false;
}

// ── My World slide — camera sweeps behind character, then iris to white world ──
function _onEnterMyWorld() {
  showExploreUI();
  _frozen = false;
  // Fire iris just after the camera lerp finishes (slide duration = 2500ms)
  _ctaTimeout = setTimeout(() => {
    _ctaTimeout = null;
    _frozen     = true;
    hideCard();
    goToWhiteWorld();
    _endFromCta();
  }, 2800);
}

// ── After iris opens — player takes control ───────────────────────────────────
function _endFromCta() {
  _active = false;
  _paused = false;

  hideBubbles();
  hideCard();

  _slideTimer = 0;
  resetSlideElapsed();
  controls.maxDistance = 32;

  setTimeout(() => {
    _frozen = false;
    controls.target.copy(currentCamLook);
    playerTakeControl();
    showWhiteWorldUI();
  }, 3200);
}


// ── Flow ──────────────────────────────────────────────────────────────────────
export function goToSlide(name) {
  const slide = slideByName[name];
  if (!slide) { console.warn(`goToSlide: unknown slide "${name}"`); return; }

  if (_ctaTimeout)     { clearTimeout(_ctaTimeout);     _ctaTimeout     = null; }
  if (_cam2Timeout)    { clearTimeout(_cam2Timeout);    _cam2Timeout    = null; }
  if (_overlayTimeout) { clearTimeout(_overlayTimeout); _overlayTimeout = null; hideHowIWorkOverlay(); }


  _frozen = false;

  _currentSlide = slide;
  _slideTimer   = slide.duration;
  _camMoveDuration = slide.camMoveDuration ?? slide.duration;
  resetSlideElapsed();

  nextBtn.style.display = isLastSlide(name) ? 'none' : 'inline-flex';
  if (_active) {
    prevBtn.style.display = indexOf(name) > 0 ? 'inline-flex' : 'none';
  }
  const isMobile = window.innerWidth < 768;
  let camPos, camTarget;
  if (name === 'experience') {
    ({ pos: camPos, target: camTarget } = _experienceCam(slide));
  } else if (name === 'about') {
    ({ pos: camPos, target: camTarget } = _aboutCam(slide));
  } else {
    camPos    = (isMobile && slide.mobileCamPos)    ? slide.mobileCamPos    : slide.camPos;
    camTarget = (isMobile && slide.mobileCamTarget) ? slide.mobileCamTarget : slide.camTarget;
  }
  startCameraMove(camPos, camTarget);

  // Schedule phase-2 camera sweep (e.g. experience: side → front after turn)
  if (slide.camPos2 && slide.cam2Delay) {
    const camPos2    = (isMobile && slide.mobileCamPos2)    ? slide.mobileCamPos2    : slide.camPos2;
    const camTarget2 = (isMobile && slide.mobileCamTarget2) ? slide.mobileCamTarget2 : slide.camTarget2;
    _cam2Timeout = setTimeout(() => {
      _cam2Timeout = null;
      _camMoveDuration = slide.cam2Duration ?? 2000;
      startCameraMove(camPos2, camTarget2);
    }, slide.cam2Delay);
  }

  cancelIdleLoop();
  // Cinematic character rotation for experience slide
  if (name === 'experience' && modelGroup) {
    modelGroup.rotation.y = spawnRotation.y + 0.62;
  } else if (modelGroup) {
    modelGroup.rotation.copy(spawnRotation);
  }
  // about: animation is driven by the wireframe T-pose cue callback below
  if (name !== 'about') {
    if (slide.clipLoop) {
      playClip(slide.clip);
    } else if (slide.clips?.length > 1) {
      playClipSequence(slide.clips, slide.clipIdleBetweenMs ?? 2500);
    } else {
      playFeaturedClip(slide.clip);
    }
  }  hideCard();

  // bubbles
  hideBubbles();
  if (name === 'skills')   showSkillBubbles();
  if (name === 'projects') showProjectBubbles();

  // how-i-work arch overlay — shown only on mindset, after camera has settled
  if (name === 'mindset') {
    _overlayTimeout = setTimeout(() => {
      _overlayTimeout = null;
      showHowIWorkOverlay();
    }, 1600);
  } else {
    hideHowIWorkOverlay();
  }

  // about wireframe — T-pose cue: slow crossfade into briefcase-standing,
  // then freeze on idle at t=2.5s so character is fully static before burn (3.8s)
  if (name === 'about') showAboutWireframe(() => {
    cancelIdleLoop();
    // Slow 1.2s crossfade so the pose change is deliberate, not snappy
    playClip('briefcase-standing', 1.0, 1.2);
    // After 2.5s freeze on idle so character stops any micro-animations
    setTimeout(() => {
      if (_currentSlide?.name === 'about') playClip('idle', 1.0, 0.8);
    }, 2500);
  });
  else hideAboutWireframe();

  // myworld card shows immediately in the blue world while camera sweeps behind character
  // mindset: title + subtitle only — the arch overlay carries the body content
  const mindsetBody = name === 'mindset' ? '' : slide.body;
  if (name !== 'myworld') showCard(slide.title, mindsetBody, 550, name, slide.subtitle ?? '');
  else                    showCard(slide.title, slide.body,  200, name, slide.subtitle ?? '');

  if (name === 'cta')     _onEnterCta();
  if (name === 'myworld') _onEnterMyWorld();
}

function _goToNextSlide() {
  const next = SLIDES[indexOf(_currentSlide.name) + 1];
  if (!next) return;
  goToSlide(next.name);
}

function _goToPrevSlide() {
  const idx = indexOf(_currentSlide.name);
  if (idx <= 0) return;
  goToSlide(SLIDES[idx - 1].name);
}


function _startPresentation() {
  _active = true;
  _paused = false;
  controls.enabled = false;
  playerReleaseControl();
  showPresentingUI();
  prevBtn.style.display  = 'none'; // hidden on first slide
  goToSlide('intro');
}

function _endPresentation() {
  _active = false;
  _paused = false;
  if (_ctaTimeout)     { clearTimeout(_ctaTimeout);     _ctaTimeout     = null; }
  if (_cam2Timeout)    { clearTimeout(_cam2Timeout);    _cam2Timeout    = null; }
  if (_overlayTimeout) { clearTimeout(_overlayTimeout); _overlayTimeout = null; }

  hideBubbles();
  hideCard();
  hideHowIWorkOverlay();
  hideAboutWireframe();
  progressWrap.style.display = 'none';
  nextBtn.style.display      = 'none';
  prevBtn.style.display      = 'none';
  resetPresentBtn();
  showIdleUI();

  controls.enabled     = false;
  controls.maxDistance = 20;
  playClip(slideByName['intro'].clip);
  const dur = _glideHome();
  setTimeout(() => { controls.enabled = true; }, dur + 200);
}

function _returnHome() {
  _frozen          = true;
  _active          = false;
  _paused          = false;
  controls.enabled = false;
  playerStop();
  if (_cam2Timeout) { clearTimeout(_cam2Timeout); _cam2Timeout = null; }

  resetPresentBtn();
  hideCard();
  hideBubbles();
  hideHowIWorkOverlay();
  hideAboutWireframe();

  if (!isWhiteWorld()) {
    controls.maxDistance = 20;
    _frozen = false;
    const dur = _glideHome();
    setTimeout(() => { controls.enabled = true; showIdleUI(); }, dur + 200);
    return;
  }

  explodeAndThen(() => {
    goToBlueWorld();

    const irisOpenMs = (1.0 / 0.55 + 0.1) * 1000;
    setTimeout(() => {
      if (modelGroup) {
        modelGroup.position.copy(spawnPosition);
        modelGroup.rotation.copy(spawnRotation);
      }
      resetExplodeGroupTransform(spawnPosition, spawnRotation);

      controls.maxDistance = 20;
      _frozen = false;
      const dur = _glideHome();

      setOnReassembled(() => playRandomIdleAnim());
      triggerReassemble();

      setTimeout(() => { controls.enabled = true; showIdleUI(); }, dur + 200);
    }, irisOpenMs);
  });
}

/** Internal wrapper — records duration for tickPresentation. */
function _glideHome() {
  const dur    = glideHome();
  _glideDuration = dur;
  _slideTimer    = dur;
  return dur;
}

// ── Experience — subtle character reaction on hover ───────────────────────────
document.addEventListener('exp-block-hover', () => {
  if (_currentSlide?.name !== 'experience') return;
  playClip('head-nod-yes');
  setTimeout(() => {
    if (_currentSlide?.name === 'experience') playClip('idle');
  }, 1200);
});

// ── Projects — character reacts when user hovers a card ───────────────────────
let _lastProjHover = 0;
document.addEventListener('proj-card-hover', () => {
  if (_currentSlide?.name !== 'projects') return;
  const now = Date.now();
  if (now - _lastProjHover < 2200) return;
  _lastProjHover = now;
  playClip('head-nod-yes');
  setTimeout(() => {
    if (_currentSlide?.name === 'projects') playClip('happy-idle');
  }, 1400);
});

// ── Button wiring ─────────────────────────────────────────────────────────────
nextBtn.addEventListener('click',    () => { if (_active && !_paused) _goToNextSlide(); });
prevBtn.addEventListener('click',    () => { if (_active) _goToPrevSlide(); });
backBtn.addEventListener('click',    () => { backBtn.style.display = 'none'; _returnHome(); });
presentBtn.addEventListener('click', () => { _active ? _endPresentation() : _startPresentation(); });

exploreBtn.addEventListener('click', () => {
  _paused = false;
  showExploreUI();
  if (!_active) {
    _active = true;
    controls.enabled = false;
  }
  goToSlide('myworld');
});

// ── Per-frame tick ────────────────────────────────────────────────────────────
export function tickPresentation(delta, elapsed) {
  if (isPlayerActive()) return false;

  if (!_active && _slideTimer <= 0) {
    if (!_frozen) controls.update();
    return false;
  }

  const totalDur = _active ? _camMoveDuration : _glideDuration;
  const slideIndex = _active ? indexOf(_currentSlide.name) : 0;
  const { done } = tickCamera(delta, elapsed, _active ? _currentSlide : null, slideIndex, totalDur, _frozen);

  if (_active) {
    if (_currentSlide.name === 'about') tickAboutWireframe(delta);
    if (!_paused) {
      _slideTimer -= delta * 1000;
      if (_slideTimer <= 0 && !_frozen) _goToNextSlide();
    }
    setProgressFill(1 - _slideTimer / _currentSlide.duration);
  } else if (!_frozen && done) {
    _slideTimer = 0;
    controls.target.copy(camLookTarget);
    controls.update();
  }

  return true;
}

