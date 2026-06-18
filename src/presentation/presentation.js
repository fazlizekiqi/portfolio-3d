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
import { disableHeadLook } from '../character/head-look.js';
import { playClip, playFeaturedClip, playClipSequence, cancelIdleLoop, playRandomIdleAnim, modelGroup, spawnPosition, spawnRotation } from '../character/model.js';
import * as THREE from 'three';
import { goToWhiteWorld, goToBlueWorld, isWhiteWorld } from '../transition.js';
import { isPlayerActive, playerTakeControl, playerReleaseControl, playerStop } from '../character/player.js';
import { explodeAndThen, triggerReassemble, setOnReassembled, resetExplodeGroupTransform } from '../character/explode.js';
import { isMobile } from '../constants.js';
import { trackSlide } from '../analytics.js';
import { audio } from '../audio.js';

import { SLIDES, slideByName, indexOf, isLastSlide } from './slides.js';
import { getHandler } from './slides/registry.js';
import { hideBubbles } from './slides/bubbles-shared.js';
import { hideAboutWireframe } from './slides/about/about-view.js';
import { hideHowIWorkOverlay } from './slides/mindset/how-i-work-view.js';
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

export { initCameraState } from './camera.js';
export { currentCamLook }  from './camera.js';

// ── Timing constants ──────────────────────────────────────────────────────────
const MYWORLD_IRIS_DELAY_MS    = 2800;
const MYWORLD_PLAYER_DELAY_MS  = 3200;
const CARD_DELAY_MS            = 550;
const MYWORLD_CARD_DELAY_MS    = 200;
const MINDSET_OVERLAY_DELAY_MS = 1600;

// ── Camera helpers ────────────────────────────────────────────────────────────

function _anchorCam(a) {
  const base = spawnPosition;
  return {
    pos:    new THREE.Vector3(base.x + a.offsetX,       base.y + a.camY,    base.z + a.dist),
    target: new THREE.Vector3(base.x + a.targetOffsetX, base.y + a.targetY, base.z),
  };
}

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
let _camMoveDuration = 1400;

// Generic keyed timeout registry — replaces the 3 individual timeout vars.
const _timeouts = {};

function _scheduleTimeout(key, fn, ms) {
  if (_timeouts[key]) { clearTimeout(_timeouts[key]); _timeouts[key] = null; }
  _timeouts[key] = setTimeout(() => { _timeouts[key] = null; fn(); }, ms);
}

function _clearAllTimeouts() {
  for (const key of Object.keys(_timeouts)) {
    if (_timeouts[key]) { clearTimeout(_timeouts[key]); _timeouts[key] = null; }
  }
}

// ── Exp-done listener ─────────────────────────────────────────────────────────
let _expDoneListener = null;

function _clearExpDoneListener() {
  if (_expDoneListener) {
    document.removeEventListener('_exp-timeline-done', _expDoneListener);
    _expDoneListener = null;
  }
}

function _setExpDoneListener(fn) {
  _expDoneListener = () => { _expDoneListener = null; fn(); };
  document.addEventListener('_exp-timeline-done', _expDoneListener, { once: true });
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

// ── Default slide hook implementations ───────────────────────────────────────

function _defaultCamera(ctx) {
  startCameraMove(ctx.pos, ctx.target);

  // Data-driven phase-2 camera move (intro/mindset/cta have one).
  const c      = ctx.slide.cam;
  const onMob  = isMobile();
  const p2     = onMob && c.mobilePhase2 ? c.mobilePhase2
               : !onMob && c.phase2       ? c.phase2
               : null;
  if (p2 && !(onMob && !c.mobilePhase2 && c.phase2)) {
    ctx.scheduleTimeout('cam2', () => {
      ctx.setCamMoveDuration(p2.ms ?? 2000);
      startCameraMove(p2.pos, p2.target);
    }, p2.delay ?? 0);
  }
}

function _defaultAnimation(ctx) {
  cancelIdleLoop();
  if (modelGroup) modelGroup.rotation.copy(spawnRotation);
  hideAboutWireframe();
  const { clip, clips, loop } = ctx.slide.anim;
  if (loop)               playClip(clip);
  else if (clips?.length > 1) playClipSequence(clips);
  else                    playFeaturedClip(clip);
}

function _defaultUI(ctx) {
  hideCard();
  hideBubbles();
  hideHowIWorkOverlay();
  showCard(ctx.slide.title, ctx.slide.body, CARD_DELAY_MS, ctx.name, ctx.slide.subtitle ?? '');
}

// ── goToSlide ─────────────────────────────────────────────────────────────────
export function goToSlide(name) {
  const slide = slideByName[name];
  if (!slide) { console.warn(`goToSlide: unknown slide "${name}"`); return; }

  const handler = getHandler(name);

  // 1. Clear all pending timeouts + listener
  _clearAllTimeouts();
  _clearExpDoneListener();
  hideHowIWorkOverlay();   // idempotent — covers overlay-scheduled-but-not-shown case
  disableHeadLook();       // skills slide re-enables it via its onEnter hook

  // 2. Reset state
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
  audio.ambientBrighten();   // background lifts in harmonic brightness for ~1 s
  audio.setArpStyle(name);   // switch arpeggio character to match this slide

  // 3. Build ctx — carries presentation-internal state accessors + constants
  const { pos, target } = _resolveCamera(slide);
  const ctx = {
    slide, name, pos, target,
    setCamMoveDuration: (ms) => { _camMoveDuration = ms; },
    scheduleTimeout: _scheduleTimeout,
    setFrozen: (v) => { _frozen = v; },
    setExpDoneListener: _setExpDoneListener,
    endFromCta: _endFromCta,
    goToNext: _goToNextSlide,
    CARD_DELAY_MS, MYWORLD_CARD_DELAY_MS, MINDSET_OVERLAY_DELAY_MS, MYWORLD_IRIS_DELAY_MS,
  };

  // 4. Dispatch hooks in exact order: camera → animation → UI → enter
  (handler.onCamera    ?? _defaultCamera)(ctx);
  (handler.onAnimation ?? _defaultAnimation)(ctx);
  (handler.onUI        ?? _defaultUI)(ctx);
  handler.onEnter?.(ctx);
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
  audio.playSectionInit();   // OS booting a new module — matches the intro boot UI
  showPresentingUI();
  prevBtn.style.display  = 'none';
  goToSlide('intro');
}

export function startPresentation() { _startPresentation(); }

function _endPresentation() {
  _active = false;
  _clearAllTimeouts();

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
  _clearAllTimeouts();

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
    getHandler(_currentSlide.name).tick?.(delta, elapsed);
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
