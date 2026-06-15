/**
 * presentation.js — Orchestrator.
 *
 * Wires slides, camera, animations, and UI together.
 * Has no inline DOM math, no inline camera math, no slide data.
 *
 * Public API
 * ──────────
 *   initCameraState()               – call once after model loads
 *   startPresentation()             – begin from slide 0
 *   goToSlide(name)                 – jump to a named slide
 *   applySlideCam(slide)            – re-apply camera live (GUI helper)
 *   tickPresentation(delta, elapsed) – per-frame driver
 */

import { controls } from '../scene.js';
import {
  playClip, playFeaturedClip, playClipSequence, cancelIdleLoop,
  playRandomIdleAnim, modelGroup, spawnPosition, spawnRotation,
} from '../character/model.js';
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
  startCameraMove, glideHome, tickCamera,
  camLookTarget, currentCamLook, resetCameraMove,
} from './camera.js';
import {
  progressWrap, nextBtn, prevBtn, presentBtn, exploreBtn, backBtn, skipBtn,
  showIdleUI, showPresentingUI, showExploreUI, showWhiteWorldUI,
  resetPresentBtn, setProgressFill, hideCard, showCard,
} from './ui.js';
import { showHowIWorkOverlay, hideHowIWorkOverlay } from './how-i-work-overlay.js';
import { showAboutWireframe, hideAboutWireframe, tickAboutWireframe } from '../character/about-wireframe.js';

export { initCameraState } from './camera.js';
export { currentCamLook }  from './camera.js';

// ── Timing constants ──────────────────────────────────────────────────────────
const MYWORLD_IRIS_DELAY_MS    = 2800;   // ms after entering myworld before iris fires
const MYWORLD_PLAYER_DELAY_MS  = 3200;   // ms after iris before player takes control
const CARD_DELAY_MS            = 550;    // standard card show delay
const MYWORLD_CARD_DELAY_MS    = 200;    // card shows sooner on the last slide
const MINDSET_OVERLAY_DELAY_MS = 1600;   // delay before HIW cards reveal

// ── Camera helpers ────────────────────────────────────────────────────────────

/** Resolve a camera anchor definition to world-space pos + target. */
function _anchorCam(a) {
  const base = spawnPosition;
  return {
    pos:    new THREE.Vector3(base.x + a.offsetX,       base.y + a.camY,    base.z + a.dist),
    target: new THREE.Vector3(base.x + a.targetOffsetX, base.y + a.targetY, base.z),
  };
}

/** Pick pos + target for the current device, handling anchor vs explicit coords. */
function _resolveCamera(slide) {
  const c   = slide.cam;
  const mob = isMobile() && c.mobile;
  if (c.anchor || (mob && mob.anchor)) return _anchorCam(mob ? mob.anchor : c.anchor);
  return { pos: mob ? mob.pos : c.pos, target: mob ? mob.target : c.target };
}

/** Re-apply a slide's camera live — exposed for the GUI debug panel. */
export function applySlideCam(slide) {
  const s = slide || _currentSlide;
  if (!s) return;
  const { pos, target } = _resolveCamera(s);
  _camMoveDuration = 600;
  startCameraMove(pos, target);
}

// ── State ─────────────────────────────────────────────────────────────────────
let _active          = false;
let _currentSlide    = SLIDES[0];
let _slideTimer      = 0;
let _glideDuration   = 1400;
let _frozen          = false;
let _ctaTimeout      = null;
let _cam2Timeout     = null;
let _overlayTimeout  = null;
let _camMoveDuration = 1400;

// ── Slide entry side-effects ──────────────────────────────────────────────────

function _onEnterCta() {
  _frozen = false;
}

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

function _endFromCta() {
  _active     = false;
  _slideTimer = 0;
  resetCameraMove();
  hideBubbles();
  hideCard();
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

  startCameraMove(pos, target);

  // Optional phase-2 move (e.g. mindset desktop: gentle pull-back while cards reveal).
  // Mobile skips if no mobile.phase2 — preserves the wider mobile framing.
  const onMobile = isMobile();
  const p2 = (onMobile && c.mobile?.phase2) ? c.mobile.phase2
           : (!onMobile  && c.phase2)         ? c.phase2
           : null;
  if (p2) {
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
    showAboutWireframe(() => { cancelIdleLoop(); playClip(clip, 1.0, 1.2); });
  } else if (name === 'mindset') {
    hideAboutWireframe();
    // GLB clip is 'ide-to-walk' (typo in the model — missing 'l').
    playFeaturedClip('ide-to-walk', 0.45, () => playClip('walking', 1.0, 0.5));
  } else {
    hideAboutWireframe();
    if (loop)     playClip(clip);
    else if (clips?.length) playClipSequence(clips);
    else          playFeaturedClip(clip);
  }
}

function _applyUIForSlide(slide, name) {
  hideCard();

  hideBubbles();
  if (name === 'skills')   showSkillBubbles();
  if (name === 'projects') showProjectBubbles();

  if (name === 'mindset') {
    _overlayTimeout = setTimeout(() => {
      _overlayTimeout = null;
      showHowIWorkOverlay();
    }, MINDSET_OVERLAY_DELAY_MS);
  } else {
    hideHowIWorkOverlay();
  }

  const body  = name === 'mindset' ? '' : slide.body;
  const delay = name === 'myworld' ? MYWORLD_CARD_DELAY_MS : CARD_DELAY_MS;
  showCard(slide.title, body, delay, name, slide.subtitle ?? '');
}

// ── Flow ──────────────────────────────────────────────────────────────────────

export function goToSlide(name) {
  const slide = slideByName[name];
  if (!slide) { console.warn(`goToSlide: unknown slide "${name}"`); return; }

  if (_ctaTimeout)     { clearTimeout(_ctaTimeout);     _ctaTimeout     = null; }
  if (_cam2Timeout)    { clearTimeout(_cam2Timeout);    _cam2Timeout    = null; }
  if (_overlayTimeout) { clearTimeout(_overlayTimeout); _overlayTimeout = null; hideHowIWorkOverlay(); }

  _frozen          = false;
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
  if (next) goToSlide(next.name);
}

function _goToPrevSlide() {
  const idx = indexOf(_currentSlide.name);
  if (idx > 0) goToSlide(SLIDES[idx - 1].name);
}

// ── Presentation lifecycle ────────────────────────────────────────────────────

function _startPresentation() {
  _active = true;
  controls.enabled = false;
  playerReleaseControl();
  showPresentingUI();
  prevBtn.style.display = 'none';
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

function _glideHome() {
  const dur    = glideHome();
  _glideDuration = dur;
  _slideTimer    = dur;
  return dur;
}

// ── Character reactions to UI events ─────────────────────────────────────────

document.addEventListener('exp-block-hover', () => {
  if (_currentSlide?.name !== 'experience') return;
  playClip('head-nod-yes');
  setTimeout(() => {
    if (_currentSlide?.name === 'experience') playClip('idle');
  }, 1200);
});

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

nextBtn.addEventListener('click', () => {
  audio.resume(); audio.playButtonClick();
  if (_active) _goToNextSlide();
});

prevBtn.addEventListener('click', () => {
  audio.resume(); audio.playButtonClick();
  if (_active) _goToPrevSlide();
});

backBtn.addEventListener('click', () => {
  audio.resume(); audio.playButtonClick();
  backBtn.style.display = 'none';
  _returnHome();
});

presentBtn.addEventListener('click', () => {
  audio.resume(); audio.playButtonClick();
  _active ? _endPresentation() : _startPresentation();
});

exploreBtn.addEventListener('click', () => {
  audio.resume(); audio.playButtonClick();
  showExploreUI();
  if (!_active) {
    _active = true;
    controls.enabled = false;
  }
  goToSlide('myworld');
});

skipBtn.addEventListener('click', () => {
  if (_active) {
    audio.playButtonClick();
    trackSlide('skip');
    goToSlide('myworld');
  }
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
    if (_currentSlide.name === 'about') tickAboutWireframe(delta);
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
