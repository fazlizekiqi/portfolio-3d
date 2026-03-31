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
import { playClip, modelGroup, spawnPosition, spawnRotation } from '../character/model.js';
import { goToWhiteWorld, goToBlueWorld, isWhiteWorld } from '../transition.js';
import { isPlayerActive, playerTakeControl, playerReleaseControl, playerStop } from '../character/player.js';
import { explodeAndThen, triggerReassemble, setOnReassembled, resetExplodeGroupTransform } from '../character/explode.js';

import { SLIDES, slideByName, indexOf, isLastSlide } from './slides.js';
import {
  startCameraMove, glideHome, tickCamera,
  camLookTarget, currentCamLook,
  resetSlideElapsed,
} from './camera.js';
import {
  progressWrap, nextBtn, presentBtn, exploreBtn, backBtn,
  showIdleUI, showPresentingUI, showExploreUI, showBackBtn,
  resetPresentBtn, setProgressFill, hideCard, showCard,
} from './ui.js';

export { initCameraState } from './camera.js';
export { currentCamLook }  from './camera.js';

// ── State ─────────────────────────────────────────────────────────────────────
let _active       = false;
let _currentSlide = SLIDES[0];
let _slideTimer   = 0;
let _glideDuration = 1400;
let _ctaTimeout   = null;
let _frozen       = false;

// ── CTA slide side-effects ────────────────────────────────────────────────────
// Handled here, not in the slide data, keeping slides.js pure.
function _onEnterCta() {
  showExploreUI();
  _frozen     = false;
  _ctaTimeout = setTimeout(() => {
    _ctaTimeout = null;
    _frozen     = true;
    goToWhiteWorld();
    _endFromCta();
  }, 3800);
}

// ── Flow ──────────────────────────────────────────────────────────────────────
export function goToSlide(name) {
  const slide = slideByName[name];
  if (!slide) { console.warn(`goToSlide: unknown slide "${name}"`); return; }

  if (_ctaTimeout) { clearTimeout(_ctaTimeout); _ctaTimeout = null; }
  _frozen = false;

  _currentSlide = slide;
  _slideTimer   = slide.duration;
  resetSlideElapsed();

  nextBtn.style.display = isLastSlide(name) ? 'none' : 'block';
  startCameraMove(slide.camPos, slide.camTarget);
  playClip(slide.clip);
  hideCard();
  showCard(slide.title, slide.body);

  // CTA slide has a timed side-effect — handled here, not in slide data
  if (name === 'cta') _onEnterCta();
}

function _goToNextSlide() {
  const next = SLIDES[indexOf(_currentSlide.name) + 1];
  if (!next) { _endFromCta(); return; }
  goToSlide(next.name);
}

function _startPresentation() {
  _active = true;
  controls.enabled = false;
  playerReleaseControl();
  showPresentingUI();
  goToSlide('intro');
}

function _endPresentation() {
  _active = false;
  if (_ctaTimeout) { clearTimeout(_ctaTimeout); _ctaTimeout = null; }

  hideCard();
  progressWrap.style.display = 'none';
  nextBtn.style.display      = 'none';
  resetPresentBtn();
  showIdleUI();

  controls.enabled     = false;
  controls.maxDistance = 20;
  playClip(slideByName['intro'].clip);
  const dur = _glideHome();
  setTimeout(() => { controls.enabled = true; }, dur + 200);
}

function _endFromCta() {
  _active = false;
  if (_ctaTimeout) { clearTimeout(_ctaTimeout); _ctaTimeout = null; }

  hideCard();
  progressWrap.style.display = 'none';
  nextBtn.style.display      = 'none';
  resetPresentBtn();

  _slideTimer = 0;
  resetSlideElapsed();
  controls.maxDistance = 32;

  setTimeout(() => {
    _frozen = false;
    controls.target.copy(currentCamLook);
    playerTakeControl();
    showBackBtn();
  }, 3200);
}

function _returnHome() {
  _frozen          = true;
  _active          = false;
  controls.enabled = false;
  playerStop();

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

      setOnReassembled(() => { playClip('idle'); });
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

// ── Button wiring ─────────────────────────────────────────────────────────────
nextBtn.addEventListener('click',    () => { if (_active) _goToNextSlide(); });
backBtn.addEventListener('click',    () => { backBtn.style.display = 'none'; _returnHome(); });
presentBtn.addEventListener('click', () => { _active ? _endPresentation() : _startPresentation(); });

exploreBtn.addEventListener('click', () => {
  showExploreUI();
  if (!_active) {
    _active = true;
    controls.enabled = false;
    progressWrap.style.display = 'block';
  }
  goToSlide('cta');
});

// ── Per-frame tick ────────────────────────────────────────────────────────────
export function tickPresentation(delta, elapsed) {
  if (isPlayerActive()) return false;

  if (!_active && _slideTimer <= 0) {
    if (!_frozen) controls.update();
    return false;
  }

  const totalDur = _active ? _currentSlide.duration : _glideDuration;
  const slideIndex = _active ? indexOf(_currentSlide.name) : 0;
  const { done } = tickCamera(delta, elapsed, _active ? _currentSlide : null, slideIndex, totalDur, _frozen);

  if (_active) {
    _slideTimer -= delta * 1000;
    setProgressFill(1 - _slideTimer / _currentSlide.duration);
    if (_slideTimer <= 0 && !_frozen) _goToNextSlide();
  } else if (!_frozen && done) {
    _slideTimer = 0;
    controls.target.copy(camLookTarget);
    controls.update();
  }

  return true;
}

