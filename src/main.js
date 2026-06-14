import * as THREE from 'three';
import { renderer, scene, camera } from './scene.js';
import { loadModel, mixer, modelGroup, setCharacterWhiteWorld } from './character/model.js';
import { tickExplode, getExplodeGroup, introScene } from './character/explode.js';
import { tickPlayer } from './character/player.js';
import { tickPresentation, initCameraState, goToSlide, startPresentation } from './presentation/presentation.js';
import { initBlueWorld, tickBlueWorld, tickLightsForWorld } from './world/blueworld.js';
import { tickBlueprintBackdrop } from './presentation/blueprint-backdrop.js';
import { tickWhiteWorld, setWhiteWorldCharacterRef, showWaypointButtons, hideWaypointButtons, loadEnvironment } from './world/whiteworld.js';
import { isTornadoCameraActive } from './world/tornado-travel.js';
import { tickTransition, isWhiteWorld, isTransitioning, getProgress } from './transition.js';
import { tickFps } from './fps.js';
import { tickBubbles } from './presentation/bubbles.js';
import { showLoader, updateLoader, hideLoader } from './loader.js';
import { initJoystick } from './joystick.js';
import { CFG } from './config.js';
import { SLIDES } from './presentation/slides.js';
import { audio } from './audio.js';
import './gui.js';

// ── Initialise blue world objects + lights ────────────────────────────────────
initBlueWorld();

// ── Initialise joystick (touch devices) ──────────────────────────────────────
initJoystick();

// ── Boot: show loader, load both models, then start ──────────────────────────
showLoader();
updateLoader(0, 'LOADING');

let _charProg = 0;
let _envProg  = 0;
function _updateOverallProgress() {
  updateLoader(
    _charProg * CFG.CHAR_LOAD_WEIGHT + _envProg * CFG.ENV_LOAD_WEIGHT,
    _charProg < 1 ? 'CHARACTER' : 'ENVIRONMENT',
  );
}

// ── Load environment ──────────────────────────────────────────────────────────
let _envDone = false;
loadEnvironment(
  (p) => { _envProg = p; _updateOverallProgress(); },
  ()  => {
    if (_envDone) return;
    _envDone = true;
    _envProg = 1;
    _updateOverallProgress();
    _tryStart();
  },
);

// ── Load character model ──────────────────────────────────────────────────────
let _charDone = false;
loadModel(
  () => {
    _charProg = 1;
    _charDone = true;
    _updateOverallProgress();
    _tryStart();
  },
  (p) => {
    _charProg = p;
    _updateOverallProgress();
  },
);

// Safety timeout — if env load never fires (edge-case caching) start anyway.
const _envTimeout = setTimeout(() => {
  if (!_envDone) {
    _envDone = true;
    _tryStart();
  }
}, CFG.ENV_TIMEOUT_MS);

function _tryStart() {
  if (!_charDone || !_envDone) return;
  clearTimeout(_envTimeout);
  updateLoader(1, 'READY');
  setTimeout(() => {
    hideLoader();
    _startApp();
  }, 400);
}

// ── Audio: resume context + start ambient on first user gesture ───────────────
let _audioStarted = false;
function _onFirstInteraction() {
  if (_audioStarted) return;
  _audioStarted = true;
  audio.resume();
  audio.startAmbient();
}
document.addEventListener('click',   _onFirstInteraction, { once: false });
document.addEventListener('keydown', _onFirstInteraction, { once: false });
document.addEventListener('touchstart', _onFirstInteraction, { once: false, passive: true });

function _startApp() {
  initCameraState();
  introScene(); // character starts scattered and reassembles into the blue world

  // ── Wire white-world character reference ────────────────────────────────
  setWhiteWorldCharacterRef(
    () => modelGroup ? modelGroup.position.clone() : new THREE.Vector3(),
    () => {
      const meshes = [];
      if (modelGroup) {
        modelGroup.traverse(obj => {
          if (obj.isMesh && obj.visible) meshes.push(obj);
        });
      }
      return meshes;
    },
    (pos) => {
      if (modelGroup) {
        modelGroup.position.copy(pos);
        modelGroup.position.y = 0;
      }
    },
    () => modelGroup,
  );

  // ── Deep-link: ?slide=skills jumps straight to that slide ──────────────
  const _deepSlide = new URLSearchParams(location.search).get('slide');
  if (_deepSlide) {
    const validNames = SLIDES.map(s => s.name);
    if (validNames.includes(_deepSlide)) {
      setTimeout(() => {
        startPresentation();
        goToSlide(_deepSlide);
      }, 800);
    }
  }

  const charMeshes = [];
  function collectCharMeshes() {
    charMeshes.length = 0;
    [modelGroup, getExplodeGroup()].filter(Boolean).forEach(root => {
      root.traverse(obj => { if (obj.isMesh && obj.visible) charMeshes.push(obj); });
    });
  }

  function renderCharOnTop() {
    if (!charMeshes.length) return;
    const savedMask = camera.layers.mask;
    camera.layers.set(0);
    renderer.clearDepth();
    renderer.render(scene, camera);
    camera.layers.mask = savedMask;
  }

  const clock = new THREE.Clock();
  let elapsed = 0;
  let _wasInWhite = false;

  function animate() {
    requestAnimationFrame(animate);
    const delta         = clock.getDelta();
    elapsed            += delta;
    const inWhite       = isWhiteWorld();
    const transitioning = isTransitioning();

    if (inWhite && !_wasInWhite) {
      showWaypointButtons();
    } else if (!inWhite && _wasInWhite) {
      hideWaypointButtons();
    }
    _wasInWhite = inWhite;

    collectCharMeshes();

    // 1. Background
    if (inWhite && !transitioning) {
      renderer.setClearColor(0xf0efe8, 1);
      renderer.clearColor();
      renderer.clearDepth();
    } else {
      tickBlueWorld(renderer, delta, elapsed);
      // Blueprint grid backdrop for the How I Work slide — renders over the
      // gradient but behind the character. No-op when not active.
      tickBlueprintBackdrop(renderer, elapsed);
    }

    // 2. White world tick
    tickWhiteWorld(delta);

    // 3. Camera / player — skip while tornado owns the camera
    if (!isTornadoCameraActive()) {
      tickPresentation(delta, elapsed);
      tickPlayer(delta);
    }
    tickBubbles(delta, elapsed);

    // 4. Explode + mixer
    tickExplode(delta);
    if (mixer) mixer.update(delta);

    // 5. Character cartoon effect + lighting
    const wwAmount = 1.0 - getProgress();
    setCharacterWhiteWorld(wwAmount);
    tickLightsForWorld(1.0 - wwAmount, modelGroup);

    tickFps();

    // 6. Main scene render
    let whiteWasEnabled = false;
    if (transitioning) {
      whiteWasEnabled = (camera.layers.mask & (1 << 2)) !== 0;
      if (whiteWasEnabled) camera.layers.disable(2);
    }
    renderer.render(scene, camera);
    if (transitioning && whiteWasEnabled) camera.layers.enable(2);

    // 7. Iris overlay
    const postFrame = tickTransition(delta);

    // 8. White objects over iris
    if (transitioning) {
      const savedMask = camera.layers.mask;
      camera.layers.set(2);
      renderer.clearDepth();
      renderer.render(scene, camera);
      camera.layers.mask = savedMask;
    }

    // 9. Character on top
    if (transitioning || inWhite) renderCharOnTop();

    // 10. Post-frame world switch
    if (postFrame) postFrame();
  }

  animate();
}
