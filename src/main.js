import * as THREE from 'three';
import { renderer, scene, camera } from './scene.js';
import { loadModel, mixer, modelGroup } from './character/model.js';
import { tickExplode, getExplodeGroup, introScene } from './character/explode.js';
import { tickPlayer } from './character/player.js';
import { tickPresentation, initCameraState } from './presentation/presentation.js';
import { initBlueWorld, tickBlueWorld } from './world/blueworld.js';
import { tickWhiteWorld } from './world/whiteworld.js';
import { tickTransition, isWhiteWorld, isTransitioning } from './transition.js';
import { tickFps } from './fps.js';
import './gui.js';

// ── Initialise blue world objects + lights ────────────────────────────────────
initBlueWorld();

// ── Load model, then start loop ───────────────────────────────────────────────
loadModel(() => {
  initCameraState();
  introScene(); // character starts scattered and reassembles into the blue world

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

  function animate() {
    requestAnimationFrame(animate);
    const delta         = clock.getDelta();
    elapsed            += delta;
    const inWhite       = isWhiteWorld();
    const transitioning = isTransitioning();

    collectCharMeshes();

    // 1. Background
    if (inWhite && !transitioning) {
      renderer.setClearColor(0xf0efe8, 1);
      renderer.clearColor();
      renderer.clearDepth();
    } else {
      tickBlueWorld(renderer, delta, elapsed);
    }

    // 2. Camera
    tickPresentation(delta, elapsed);
    tickPlayer(delta);

    // 3. Explode + mixer
    tickExplode(delta);
    if (mixer) mixer.update(delta);

    // 4. White world uniforms
    tickWhiteWorld();

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
});
