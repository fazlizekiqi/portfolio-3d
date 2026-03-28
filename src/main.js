import * as THREE from 'three';
import { renderer, scene, camera } from './scene.js';
import { tickLighting } from './lighting.js';
import { loadModel, mixer } from './model.js';
import { tickPresentation, initCameraState } from './presentation.js';
import { tickBackground } from './background.js';
import { fpsEl, pGeo, pPhase, PARTICLE_COUNT, tickCloud } from './environment.js';
import { tickExplode, updateExplodeLights } from './explode.js';
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

  const clock = new THREE.Clock();
  let elapsed = 0;

  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    elapsed += delta;

    // 1. Shader background (renders first, no depth clear)
    tickBackground(renderer, elapsed);

    // 2. Camera — presentation drives it, otherwise free orbit
    tickPresentation(delta, elapsed);

    // 3. Fill light follows camera
    tickLighting(camera);

    // 4. Nimbus cloud platform animation
    tickCloud(elapsed);

    // 5. Exploding-object effect + sync lights
    updateExplodeLights();
    tickExplode(delta);


    // 4. Dust particles drift upward
    const pos = pGeo.attributes.position.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pos[i * 3 + 1] += delta * (0.03 + 0.018 * Math.sin(pPhase[i] + elapsed * 0.4));
      if (pos[i * 3 + 1] > 2.8) pos[i * 3 + 1] = -0.8;
    }
    pGeo.attributes.position.needsUpdate = true;

    // 5. Animation mixer
    const m = mixer;
    if (m) m.update(delta);

    updateFps();

    // 6. Main scene on top of background
    renderer.render(scene, camera);
  }

  animate();
});
