import * as THREE from 'three';
import { renderer, scene, camera } from './scene.js';
import { loadModel, mixer, modelGroup, setCharacterWhiteWorld } from './character/model.js';
import { tickExplode, getExplodeGroup, introScene } from './character/explode.js';
import { tickPlayer } from './character/player.js';
import { tickPresentation, initCameraState } from './presentation/presentation.js';
import { initBlueWorld, tickBlueWorld, tickLightsForWorld } from './world/blueworld.js';
import { tickWhiteWorld, setWhiteWorldCharacterRef, showWaypointButtons, hideWaypointButtons, loadEnvironment } from './world/whiteworld.js';
import { isTornadoCameraActive } from './world/tornado-travel.js';
import { tickTransition, isWhiteWorld, isTransitioning, getProgress } from './transition.js';
import { tickFps } from './fps.js';
import { tickBubbles } from './presentation/bubbles.js';
import { showLoader, updateLoader, hideLoader } from './loader.js';
import { initJoystick } from './joystick.js';
import './gui.js';

// ── Initialise blue world objects + lights ────────────────────────────────────
initBlueWorld();

// ── Initialise joystick (touch devices) ──────────────────────────────────────
initJoystick();

// ── Boot: show loader, load both models, then start ──────────────────────────
showLoader();
updateLoader(0, 'LOADING');

// Track progress of both assets independently (0‥1 each).
// Character = 60 % weight, environment = 40 % weight.
let _charProg = 0;
let _envProg  = 0;
function _updateOverallProgress() {
  updateLoader(_charProg * 0.6 + _envProg * 0.4,
    _charProg < 1 ? 'CHARACTER' : 'ENVIRONMENT');
}

// ── Start loading environment ─────────────────────────────────────────────────
let _envDone = false;
loadEnvironment((p) => {
  _envProg = p;
  _updateOverallProgress();
});

// We cannot easily hook the env "loaded" callback from here since whiteworld
// loads it internally. Instead poll: check every tick in _tryStart.
// The env is considered ready when _walkMeshes are populated — we detect that
// by watching if the env raycaster can find ground (takes ~1 frame after load).
// Simpler: just use a flag driven by a settled progress value.

// ── Load model, then start loop ───────────────────────────────────────────────
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

// Poll for env completion (progress reaches 1 or close enough)
const _envPollId = setInterval(() => {
  if (_envProg >= 0.999) {
    clearInterval(_envPollId);
    _envDone = true;
    _envProg = 1;
    _updateOverallProgress();
    _tryStart();
  }
}, 100);

// Safety timeout: if env progress never fires (e.g. already cached)
// give it 3 s max before forcing start anyway.
const _envTimeout = setTimeout(() => {
  clearInterval(_envPollId);
  _envDone = true;
  _tryStart();
}, 3000);

function _tryStart() {
  if (!_charDone || !_envDone) return;
  clearTimeout(_envTimeout);
  updateLoader(1, 'READY');
  setTimeout(() => {
    hideLoader();
    _startApp();
  }, 400);
}

function _startApp() {
  initCameraState();
  introScene(); // character starts scattered and reassembles into the blue world

  // ── Wire white-world character reference ────────────────────────────────
  setWhiteWorldCharacterRef(
    // getPos
    () => modelGroup ? modelGroup.position.clone() : new THREE.Vector3(),
    // getMeshes
    () => {
      const meshes = [];
      if (modelGroup) {
        modelGroup.traverse(obj => {
          if (obj.isMesh && obj.visible) meshes.push(obj);
        });
      }
      return meshes;
    },
    // setPos
    (pos) => {
      if (modelGroup) {
        modelGroup.position.copy(pos);
        modelGroup.position.y = 0;
      }
    },
    // getModelGroup
    () => modelGroup,
  );

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

    // Show / hide waypoint buttons when world state changes
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
    }

    // 2. White world tick (includes tornado camera — must run before tickPresentation
    //    so OrbitControls damping in tickPresentation bakes our camera position)
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
    // progress 1.0 = blue world, 0.0 = white world → invert for cartoon/light amount
    const wwAmount = 1.0 - getProgress();
    setCharacterWhiteWorld(wwAmount);
    tickLightsForWorld(1.0 - wwAmount, modelGroup);   // same t: 1=blue, 0=white

    tickFps();

    // 5. Main scene render
    let whiteWasEnabled = false;
    if (transitioning) {
      whiteWasEnabled = (camera.layers.mask & (1 << 2)) !== 0;
      if (whiteWasEnabled) camera.layers.disable(2);
    }
    renderer.render(scene, camera);
    if (transitioning && whiteWasEnabled) camera.layers.enable(2);

    // 6. Iris overlay
    const postFrame = tickTransition(delta);

    // 7. White objects over iris
    if (transitioning) {
      const savedMask = camera.layers.mask;
      camera.layers.set(2);
      renderer.clearDepth();
      renderer.render(scene, camera);
      camera.layers.mask = savedMask;
    }

    // 8. Character on top
    if (transitioning || inWhite) renderCharOnTop();

    // 9. Post-frame world switch
    if (postFrame) postFrame();
  }

  animate();
}
