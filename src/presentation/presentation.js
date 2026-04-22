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
  progressWrap, nextBtn, presentBtn, exploreBtn, backBtn,
  showIdleUI, showPresentingUI, showExploreUI, showBackBtn,
  resetPresentBtn, setProgressFill, hideCard, showCard,
} from './ui.js';

export { initCameraState } from './camera.js';
export { currentCamLook }  from './camera.js';

// ── State ─────────────────────────────────────────────────────────────────────
let _active        = false;
let _currentSlide  = SLIDES[0];
let _slideTimer    = 0;
let _glideDuration = 1400;
let _frozen        = false;
let _ctaTimeout    = null;
let _cam2Timeout   = null;
let _camMoveDuration = 1400; // tracks current camera-move leg duration

// ── CTA slide — just show contact info, no auto-transition ───────────────────
function _onEnterCta() {
  showExploreUI();
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

  hideBubbles();
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


// ── Flow ──────────────────────────────────────────────────────────────────────
export function goToSlide(name) {
  const slide = slideByName[name];
  if (!slide) { console.warn(`goToSlide: unknown slide "${name}"`); return; }

  if (_ctaTimeout) { clearTimeout(_ctaTimeout); _ctaTimeout = null; }
  if (_cam2Timeout) { clearTimeout(_cam2Timeout); _cam2Timeout = null; }


  _frozen = false;

  _currentSlide = slide;
  _slideTimer   = slide.duration;
  _camMoveDuration = slide.camMoveDuration ?? slide.duration;
  resetSlideElapsed();

  nextBtn.style.display = isLastSlide(name) ? 'none' : 'inline-flex';
  const isMobile = window.innerWidth < 768;
  const camPos    = (isMobile && slide.mobileCamPos)    ? slide.mobileCamPos    : slide.camPos;
  const camTarget = (isMobile && slide.mobileCamTarget) ? slide.mobileCamTarget : slide.camTarget;
  startCameraMove(camPos, camTarget);

  // Schedule phase-2 camera sweep (e.g. experience: side → front after turn)
  if (slide.camPos2 && slide.cam2Delay) {
    _cam2Timeout = setTimeout(() => {
      _cam2Timeout = null;
      _camMoveDuration = slide.cam2Duration ?? 2000;
      startCameraMove(slide.camPos2, slide.camTarget2);
    }, slide.cam2Delay);
  }

  cancelIdleLoop();
  if (slide.clipLoop) {
    playClip(slide.clip);
  } else if (slide.clips?.length > 1) {
    playClipSequence(slide.clips, slide.clipIdleBetweenMs ?? 2500);
  } else {
    playFeaturedClip(slide.clip);
  }
  hideCard();

  // bubbles
  hideBubbles();
  if (name === 'skills')   showSkillBubbles();
  if (name === 'projects') showProjectBubbles();

  // myworld card shows immediately in the blue world while camera sweeps behind character
  if (name !== 'myworld') showCard(slide.title, slide.body, 550, name);
  else                    showCard(slide.title, slide.body, 200, name);

  if (name === 'cta')     _onEnterCta();
  if (name === 'myworld') _onEnterMyWorld();
}

function _goToNextSlide() {
  const next = SLIDES[indexOf(_currentSlide.name) + 1];
  if (!next) return;   // myworld handles its own exit via _onEnterMyWorld
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
  if (_ctaTimeout)  { clearTimeout(_ctaTimeout);  _ctaTimeout  = null; }
  if (_cam2Timeout) { clearTimeout(_cam2Timeout); _cam2Timeout = null; }

  hideBubbles();
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

function _returnHome() {
  _frozen          = true;
  _active          = false;
  controls.enabled = false;
  playerStop();
  if (_cam2Timeout) { clearTimeout(_cam2Timeout); _cam2Timeout = null; }

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

