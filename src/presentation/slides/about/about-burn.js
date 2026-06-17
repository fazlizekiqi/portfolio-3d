/**
 * about-burn.js — character mesh "paper burn" shader-uniform mechanics for the
 * About Me sequence. Injects the burn dissolve into every character material
 * via onBeforeCompile and exposes helpers to drive the shared uBurnY/uBurnTime
 * uniforms that sweep the dissolve front.
 *
 * uBurnY = 999  → nothing discarded (full char visible)
 * uBurnY sweeps from yMax → yMin → burns head-to-feet
 * uBurnY = -999 → everything discarded (fully burned)
 */

import BURN_VERT_PARS     from '../../../shaders/about-burn.vert.pars.glsl?raw';
import BURN_VERT_POSITION from '../../../shaders/about-burn.vert.position.glsl?raw';
import BURN_FRAG_PARS     from '../../../shaders/about-burn.frag.pars.glsl?raw';
import BURN_FRAG_DISCARD  from '../../../shaders/about-burn.frag.discard.glsl?raw';

export function createBurnUniforms() {
  return {
    uBurnY:       { value: 999.0 },  // 999 = nothing burned yet
    uBurnEdge:    { value: 0.20  },  // world-units width of burn edge
    uBurnTime:    { value: 0.0   },
    uReconstruct: { value: 0.0   },  // 0 = dissolve (intro), 1 = reconstruct (outro)
    uBuildBand:   { value: 0.45  },  // world-units a revealed slice takes to solidify
  };
}

export function injectBurnIntoMat(mat, uniforms) {
  const prevOBC = mat.onBeforeCompile;

  mat.onBeforeCompile = (shader) => {
    // 1. Chain existing OBC first (e.g. cartoon effect)
    if (prevOBC) prevOBC(shader);

    // 2. Bind uniforms
    shader.uniforms.uBurnY       = uniforms.uBurnY;
    shader.uniforms.uBurnEdge    = uniforms.uBurnEdge;
    shader.uniforms.uBurnTime    = uniforms.uBurnTime;
    shader.uniforms.uReconstruct = uniforms.uReconstruct;
    shader.uniforms.uBuildBand   = uniforms.uBuildBand;

    // 3. Vertex: declare varying + compute world-Y after skinning.
    //    We CANNOT use worldpos_vertex because it's gated behind USE_ENVMAP etc.
    //    After #include <skinning_vertex>, `transformed` holds the skinned position.
    //    Multiply by modelMatrix to get world position.
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `${BURN_VERT_PARS}\n#include <common>`
      )
      .replace(
        '#include <skinning_vertex>',
        `#include <skinning_vertex>\n${BURN_VERT_POSITION}`
      );

    // 4. Fragment: declare varying + uniforms + compact noise functions
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `${BURN_FRAG_PARS}\n#include <common>`
      );

    // 5. Append burn discard + flame glow just before the shader's final closing brace
    const lastBrace = shader.fragmentShader.lastIndexOf('}');
    shader.fragmentShader =
      shader.fragmentShader.slice(0, lastBrace) +
      `\n${BURN_FRAG_DISCARD}\n` +
      shader.fragmentShader.slice(lastBrace);
  };

  // Force a unique cache key so THREE.js never reuses an un-injected program
  mat.customProgramCacheKey = () => 'about_burn_v3';
  mat.needsUpdate = true;
}

export function setBurnY(uniformsList, y) {
  uniformsList.forEach(u => { u.uBurnY.value = y; });
}

export function setBurnTime(uniformsList, t) {
  uniformsList.forEach(u => { u.uBurnTime.value = t; });
}

export function setBurnReconstruct(uniformsList, v) {
  uniformsList.forEach(u => { u.uReconstruct.value = v; });
}
