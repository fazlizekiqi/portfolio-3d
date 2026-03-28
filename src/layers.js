// ── World Layers ──────────────────────────────────────────────────────────────
// Single source of truth for layer indices.
//
//   SHARED (0) — default Three.js layer, visible in both worlds.
//                Character mesh, lights, camera always live here.
//
//   BLUE   (1) — blue-world-only objects (rings, particles, future content).
//                Camera enables this layer while in the blue world.
//
//   WHITE  (2) — white-world-only objects (future portfolio panels, UI planes…).
//                Camera enables this layer while in the white world.
//
// Usage:
//   import { LAYER, setWorldLayer } from './layers.js';
//
//   // Assign an object to the blue world:
//   setWorldLayer(myMesh, LAYER.BLUE);
//
//   // The camera switches layers automatically via enterWhiteWorld / exitWhiteWorld.
// ─────────────────────────────────────────────────────────────────────────────

export const LAYER = Object.freeze({
  SHARED: 0,
  BLUE:   1,
  WHITE:  2,
});

/**
 * Assign `object` (and optionally all its descendants) to a single layer,
 * clearing all others.  Pass `recursive = true` for a whole model group.
 */
export function setWorldLayer(object, layer, recursive = false) {
  const assign = (obj) => {
    obj.layers.set(layer);
    // Lights need to enable the layer too or they won't illuminate objects on it
    if (obj.isLight) obj.layers.enable(LAYER.SHARED);
  };

  if (recursive) {
    object.traverse(assign);
  } else {
    assign(object);
  }
}

