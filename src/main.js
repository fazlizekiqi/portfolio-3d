import * as THREE from 'three';
import { renderer, scene, camera } from './scene.js';
import { tickLighting } from './lighting.js';
import { loadModel, mixer, modelGroup } from './model.js';
import { tickPresentation, initCameraState } from './presentation.js';
import { tickBackground } from './background.js';
import { tickCloud, tickParticles } from './environment.js';
import { tickExplode, updateExplodeLights, getExplodeGroup } from './explode.js';
import { tickTransition, isWhiteWorld, isTransitioning } from './transition.js';
import { tickFps } from './fps.js';
import './gui.js';

// ── Load model, then start loop ───────────────────────────────────────────────
loadModel(() => {
  initCameraState();

  // ── Character mesh collector ──────────────────────────────────────────────
  // Rebuilt every frame so explode-group swaps are handled automatically.
  const charMeshes = [];
  function collectCharMeshes() {
    charMeshes.length = 0;
    [modelGroup, getExplodeGroup()].filter(Boolean).forEach(root => {
      root.traverse(obj => { if (obj.isMesh && obj.visible) charMeshes.push(obj); });
    });
  }

  // ── Character on-top render pass ──────────────────────────────────────────
  // Re-renders only the character after the burn overlay so it's always
  // fully visible regardless of where the iris circle is.
  function renderCharOnTop() {
    if (!charMeshes.length) return;
    scene.traverse(obj => {
      if (obj.isMesh || obj.isPoints) {
        obj.userData._vis = obj.visible;
        if (!charMeshes.includes(obj)) obj.visible = false;
      }
    });
    renderer.clearDepth();
    renderer.render(scene, camera);
    scene.traverse(obj => {
      if ((obj.isMesh || obj.isPoints) && obj.userData._vis !== undefined) {
        obj.visible = obj.userData._vis;
        delete obj.userData._vis;
      }
    });
  }

  const clock = new THREE.Clock();
  let elapsed  = 0;

  function animate() {
    requestAnimationFrame(animate);
    const delta        = clock.getDelta();
    elapsed           += delta;
    const inWhite      = isWhiteWorld();
    const transitioning = isTransitioning();

    collectCharMeshes();

    // ── 1. Background ─────────────────────────────────────────────────────────
    // Blue world (and during any transition) → dark shader background.
    // Settled white world → plain white clear.
    if (inWhite && !transitioning) {
      renderer.setClearColor(0xf0efe8, 1);
      renderer.clearColor();
      renderer.clearDepth();
    } else {
      tickBackground(renderer, elapsed);
    }

    // ── 2. Camera ─────────────────────────────────────────────────────────────
    tickPresentation(delta, elapsed);

    // ── 3. Lighting ───────────────────────────────────────────────────────────
    tickLighting(camera);

    // ── 4. Blue-world environment (rings + particles) ─────────────────────────
    if (!inWhite || transitioning) {
      tickCloud(elapsed);
      tickParticles(delta, elapsed);
    }

    // ── 5. Explode effect + animation mixer ───────────────────────────────────
    updateExplodeLights();
    tickExplode(delta);
    if (mixer) mixer.update(delta);

    tickFps();

    // ── 6. Main scene render ──────────────────────────────────────────────────
    renderer.render(scene, camera);

    // ── 7. Burn-iris overlay (ortho pass, composites on top of scene) ─────────
    tickTransition(delta);

    // ── 8. Character on-top pass ──────────────────────────────────────────────
    // During transition or in white world the character is re-rendered after the
    // iris overlay so it's never hidden by the white mask or the fire ring.
    if (transitioning || inWhite) renderCharOnTop();
  }

  animate();
});
