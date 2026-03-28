import * as THREE from 'three';
import { renderer, scene, camera } from './scene.js';
import { tickLighting } from './lighting.js';
import { loadModel, mixer, modelGroup } from './model.js';
import { tickPresentation, initCameraState } from './presentation.js';
import { tickBackground } from './background.js';
import { fpsEl, pGeo, pPhase, PARTICLE_COUNT, tickCloud } from './environment.js';
import { tickExplode, updateExplodeLights, getExplodeGroup } from './explode.js';
import { tickTransition, isCartoonMode, isTransitioning } from './transition.js';
import './gui.js';

// ── FPS counter ───────────────────────────────────────────────────────────────
let frameCount = 0, lastFpsTime = performance.now();
function updateFps() {
  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 600) {
    fpsEl.textContent = `FPS ${Math.round(frameCount * 1000 / (now - lastFpsTime))}`;
    frameCount = 0; lastFpsTime = now;
  }
}

// ── Load model, then start loop ───────────────────────────────────────────────
loadModel(() => {
  initCameraState();

  const charMeshes = [];

  function updateCharMeshes() {
    charMeshes.length = 0;
    const roots = [modelGroup, getExplodeGroup()].filter(Boolean);
    roots.forEach(root => {
      root.traverse(obj => {
        if (obj.isMesh && obj.visible) charMeshes.push(obj);
      });
    });
  }

  const clock = new THREE.Clock();
  let elapsed = 0;

  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    elapsed += delta;

    const cartoon       = isCartoonMode();
    const transitioning = isTransitioning();

    updateCharMeshes();

    // 1. Background
    // Settled cartoon mode → white. Everything else (3D, entering, exiting) → blue env.
    if (cartoon && !transitioning) {
      renderer.setClearColor(0xf0efe8, 1);
      renderer.clearColor();
      renderer.clearDepth();
    } else {
      tickBackground(renderer, elapsed);
    }

    // 2. Camera
    tickPresentation(delta, elapsed);

    // 3. Lighting — always run
    tickLighting(camera);

    // 4. Nimbus cloud + particles — only when blue env is active
    if (!cartoon || transitioning) {
      tickCloud(elapsed);
      const pos = pGeo.attributes.position.array;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        pos[i * 3 + 1] += delta * (0.03 + 0.018 * Math.sin(pPhase[i] + elapsed * 0.4));
        if (pos[i * 3 + 1] > 2.8) pos[i * 3 + 1] = -0.8;
      }
      pGeo.attributes.position.needsUpdate = true;
    }

    // 5. Exploding-object effect + sync lights
    updateExplodeLights();
    tickExplode(delta);

    // 6. Animation mixer
    const m = mixer;
    if (m) m.update(delta);

    updateFps();

    // 7. Render main scene
    renderer.render(scene, camera);

    // 8. Burn overlay (ortho pass, composites on top)
    tickTransition(delta);

    // 9. Re-render character ON TOP of the burn overlay in all transition states
    //    and in cartoon mode — keeps character fully visible regardless of circle position.
    if ((transitioning || cartoon) && charMeshes.length) {
      // Hide everything except character meshes
      scene.traverse(obj => {
        if (obj.isMesh || obj.isPoints) {
          obj.userData._visSnap = obj.visible;
          if (!charMeshes.includes(obj)) obj.visible = false;
        }
      });

      // Clear only depth — keeps depthTest ON so character self-occludes correctly
      // (no see-through). The depth clear puts character "in front" of the overlay.
      renderer.clearDepth();
      renderer.render(scene, camera);

      // Restore visibility
      scene.traverse(obj => {
        if ((obj.isMesh || obj.isPoints) && obj.userData._visSnap !== undefined) {
          obj.visible = obj.userData._visSnap;
          delete obj.userData._visSnap;
        }
      });
    }
  }

  animate();
});
