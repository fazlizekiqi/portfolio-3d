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
import { isMobile } from '../constants.js';
import { trackSlide } from '../analytics.js';
import { audio } from '../audio.js';

import { SLIDES, slideByName, indexOf, isLastSlide } from './slides.js';
import { showSkillBubbles, showProjectBubbles, hideBubbles } from './bubbles.js';
import {
  startCameraMove, glideHome, tickCamera, startOrbitSweep,
  camLookTarget, currentCamLook,
  resetCameraMove,
} from './camera.js';
import {
  progressWrap, nextBtn, prevBtn, presentBtn, exploreBtn, backBtn,
  showIdleUI, showPresentingUI, showExploreUI, showWhiteWorldUI, showBackBtn,
  resetPresentBtn, setProgressFill, hideCard, showCard,
} from './ui.js';
import { showHowIWorkOverlay, hideHowIWorkOverlay, tickHowIWorkOverlay } from './slides/mindset/how-i-work-view.js';
import { showAboutWireframe, hideAboutWireframe, tickAboutWireframe } from '../character/about-wireframe.js';

export { initCameraState } from './camera.js';
export { currentCamLook }  from './camera.js';

// ── Timing constants ──────────────────────────────────────────────────────────
const MYWORLD_IRIS_DELAY_MS    = 2800;
const MYWORLD_PLAYER_DELAY_MS  = 3200;
const CARD_DELAY_MS            = 550;
const MYWORLD_CARD_DELAY_MS    = 200;
const MINDSET_OVERLAY_DELAY_MS = 1600;

// ── Camera helpers ────────────────────────────────────────────────────────────

/** Resolve { pos, target } from an anchor descriptor + spawn position. */
function _anchorCam(a) {
  const base = spawnPosition;
  return {
    pos:    new THREE.Vector3(base.x + a.offsetX,       base.y + a.camY,    base.z + a.dist),
    target: new THREE.Vector3(base.x + a.targetOffsetX, base.y + a.targetY, base.z),
  };
}

/** Single source of truth for picking camera pos/target from a slide. */
function _resolveCamera(slide) {
  const c      = slide.cam;
  const mobile = isMobile() && c.mobile;
  if (c.anchor || (mobile && mobile.anchor)) {
    return _anchorCam(mobile ? mobile.anchor : c.anchor);
  }
  return {
    pos:    mobile ? mobile.pos    : c.pos,
    target: mobile ? mobile.target : c.target,
  };
}

/** Re-applies a slide's camera live — pass the slide object from the GUI. */
export function applySlideCam(slide) {
  const s = slide || _currentSlide;
  if (!s) return;
  const { pos, target } = _resolveCamera(s);
  _camMoveDuration = 600;
  startCameraMove(pos, target);
}

// ── State ─────────────────────────────────────────────────────────────────────
let _active        = false;
let _currentSlide  = SLIDES[0];
let _slideTimer    = 0;
let _glideDuration = 1400;
let _frozen        = false;
let _ctaTimeout    = null;
let _cam2Timeout   = null;
let _overlayTimeout = null;
let _camMoveDuration = 1400;

// ── CTA slide — just show contact info, no auto-transition ───────────────────
function _onEnterCta() {
  _frozen = false;
}

// ── My World slide — camera sweeps behind character, then iris to white world ──
function _onEnterMyWorld() {
  showExploreUI();
  _frozen = false;
  _ctaTimeout = setTimeout(() => {
    _ctaTimeout = null;
    _frozen     = true;
    hideCard();
    audio.playIrisWhoosh();
    audio.stopAmbient(1.0);
    goToWhiteWorld();
    _endFromCta();
  }, MYWORLD_IRIS_DELAY_MS);
}

// ── After iris opens — player takes control ───────────────────────────────────
function _endFromCta() {
  _active = false;

  hideBubbles();
  hideCard();

  _slideTimer = 0;
  resetCameraMove();
  controls.maxDistance = 32;

  setTimeout(() => {
    _frozen = false;
    controls.target.copy(currentCamLook);
    playerTakeControl();
    showWhiteWorldUI();
  }, MYWORLD_PLAYER_DELAY_MS);
}


// ── goToSlide helpers ─────────────────────────────────────────────────────────

function _applyCameraForSlide(slide, name) {
  const { pos, target } = _resolveCamera(slide);
  const c = slide.cam;

  if (name === 'skills') {
    startOrbitSweep(target.clone(), 1300, () => {
      _camMoveDuration = 1200;
      startCameraMove(pos, target);
    });
    return;
  }

  startCameraMove(pos, target);

  // Optional phase-2 camera move (e.g. mindset: gentle push-in while cards reveal).
  // mobilePhase2 is mobile-only; phase2 is desktop-only (skip on mobile if no mobile override).
  const onMobile = isMobile();
  const p2 = onMobile && c.mobilePhase2 ? c.mobilePhase2
           : !onMobile && c.phase2       ? c.phase2
           : null;

  if (p2 && !(onMobile && !c.mobilePhase2 && c.phase2)) {
    _cam2Timeout = setTimeout(() => {
      _cam2Timeout     = null;
      _camMoveDuration = p2.ms ?? 2000;
      startCameraMove(p2.pos, p2.target);
    }, p2.delay ?? 0);
  }
}

function _applyAnimationForSlide(slide, name) {
  cancelIdleLoop();

  if (name === 'experience' && modelGroup) {
    modelGroup.rotation.y = spawnRotation.y + 0.62;
  } else if (modelGroup) {
    modelGroup.rotation.copy(spawnRotation);
  }

  const { clip, clips, loop } = slide.anim;

  if (name === 'about') {
    showAboutWireframe(() => {
      cancelIdleLoop();
      playClip(clip, 1.0, 1.2);
    });
  } else if (name === 'mindset') {
    hideAboutWireframe();
    playFeaturedClip('ide-to-walk', 0.45, () => {
      playClip('walking', 1.0, 0.5);
    });
  } else {
    hideAboutWireframe();
    if (loop)               playClip(clip);
    else if (clips?.length > 1) playClipSequence(clips);
    else                    playFeaturedClip(clip);
  }
}

// Listener handle so we can remove it if the user navigates away early.
let _expDoneListener = null;

function _clearExpDoneListener() {
  if (_expDoneListener) {
    document.removeEventListener('_exp-timeline-done', _expDoneListener);
    _expDoneListener = null;
  }
}

function _applyUIForSlide(slide, name) {
  hideCard();
  _clearExpDoneListener();

  hideBubbles();
  if (name === 'skills')   showSkillBubbles();
  if (name === 'projects') showProjectBubbles();

  if (name === 'mindset') {
    _overlayTimeout = setTimeout(() => {
      _overlayTimeout = null;
      showHowIWorkOverlay(slide.duration - MINDSET_OVERLAY_DELAY_MS);
    }, MINDSET_OVERLAY_DELAY_MS);
  } else {
    hideHowIWorkOverlay();
  }

  // Experience: slide advances when the timeline finishes one pass (not on timer).
  if (name === 'experience') {
    _expDoneListener = () => { _expDoneListener = null; _goToNextSlide(); };
    document.addEventListener('_exp-timeline-done', _expDoneListener, { once: true });
  }

  const bodyText = name === 'mindset' ? '' : slide.body;
  const delay    = name === 'myworld' ? MYWORLD_CARD_DELAY_MS : CARD_DELAY_MS;
  showCard(slide.title, bodyText, delay, name, slide.subtitle ?? '');
}

// ── Flow ──────────────────────────────────────────────────────────────────────
export function goToSlide(name) {
  const slide = slideByName[name];
  if (!slide) { console.warn(`goToSlide: unknown slide "${name}"`); return; }

  if (_ctaTimeout)     { clearTimeout(_ctaTimeout);     _ctaTimeout     = null; }
  if (_cam2Timeout)    { clearTimeout(_cam2Timeout);    _cam2Timeout    = null; }
  if (_overlayTimeout) { clearTimeout(_overlayTimeout); _overlayTimeout = null; hideHowIWorkOverlay(); }
  _clearExpDoneListener();

  _frozen = false;
  _currentSlide    = slide;
  _slideTimer      = slide.duration;
  _camMoveDuration = slide.cam.moveMs ?? slide.duration;
  resetCameraMove();

  nextBtn.style.display = isLastSlide(name) ? 'none' : 'inline-flex';
  if (_active) {
    prevBtn.style.display = indexOf(name) > 0 ? 'inline-flex' : 'none';
  }

  trackSlide(name);
  audio.playSlideWhoosh();

  _applyCameraForSlide(slide, name);
  _applyAnimationForSlide(slide, name);
  _applyUIForSlide(slide, name);

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
  controls.enabled = false;
  playerReleaseControl();
  showPresentingUI();
  prevBtn.style.display  = 'none';
  goToSlide('intro');
}

export function startPresentation() { _startPresentation(); }

function _endPresentation() {
  _active = false;
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
  playClip(slideByName['intro'].anim.clip);
  const dur = _glideHome();
  setTimeout(() => { controls.enabled = true; }, dur + 200);
}

function _returnHome() {
  _frozen          = true;
  _active          = false;
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
    audio.playIrisWhoosh();
    goToBlueWorld();

    const irisOpenMs = (1.0 / 0.55 + 0.1) * 1000;
    setTimeout(() => {
      if (modelGroup) {
        modelGroup.position.copy(spawnPosition);
        modelGroup.rotation.copy(spawnRotation);
      }
      resetExplodeGroupTransform(spawnPosition, spawnRotation);
      audio.startAmbient();

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
nextBtn.addEventListener('click',    () => { audio.resume(); audio.playButtonClick(); if (_active) _goToNextSlide(); });
prevBtn.addEventListener('click',    () => { audio.resume(); audio.playButtonClick(); if (_active) _goToPrevSlide(); });
backBtn.addEventListener('click',    () => { audio.resume(); audio.playButtonClick(); backBtn.style.display = 'none'; _returnHome(); });
presentBtn.addEventListener('click', () => { audio.resume(); audio.playButtonClick(); _active ? _endPresentation() : _startPresentation(); });

exploreBtn.addEventListener('click', () => {
  audio.resume(); audio.playButtonClick();
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

  const totalDur   = _active ? _camMoveDuration : _glideDuration;
  const slideIndex = _active ? indexOf(_currentSlide.name) : 0;
  const { done }   = tickCamera(delta, elapsed, _active ? _currentSlide : null, slideIndex, totalDur, _frozen);

  if (_active) {
    if (_currentSlide.name === 'about')   tickAboutWireframe(delta);
    if (_currentSlide.name === 'mindset') tickHowIWorkOverlay(delta);
    _slideTimer -= delta * 1000;
    if (_slideTimer <= 0 && !_frozen) _goToNextSlide();
    setProgressFill(1 - _slideTimer / _currentSlide.duration);
  } else if (!_frozen && done) {
    _slideTimer = 0;
    controls.target.copy(camLookTarget);
    controls.update();
  }

  return true;
}
