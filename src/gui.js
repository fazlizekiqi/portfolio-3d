import { GUI } from 'dat.gui';
import { wireMaterials, wireState, playClip } from './model.js';
import { toggleExplode, explodeParams, applyExplodeParams, triggerExplode, triggerReassemble } from './explode.js';
import { goToWhiteWorld, goToBlueWorld, isWhiteWorld } from './transition.js';

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  switch (e.key.toLowerCase()) {
    case 'w': {
      wireState.opacity = wireState.opacity > 0.01 ? 0 : 0.045;
      wireMaterials.forEach(m => { m.opacity = wireState.opacity; });
      break;
    }
    case 'e': toggleExplode(); break;
    case 't': isWhiteWorld() ? goToBlueWorld() : goToWhiteWorld(); break;
    case '1': case '2': case '3': case '4': case '5':
      playClip(parseInt(e.key) - 1);
      break;
  }
});

// ── dat.gui panel ─────────────────────────────────────────────────────────────
const gui = new GUI({ width: 280 });
gui.domElement.style.cssText += 'z-index:200;';

// ── Explosion folder ──────────────────────────────────────────────────────────
const fEx = gui.addFolder('💥 Explosion');

fEx.add(explodeParams, 'speed',        0.05, 2.0, 0.01).name('Speed');
fEx.add(explodeParams, 'animDelay',    0.0,  5.0, 0.1 ).name('Anim delay (s)');
fEx.add(explodeParams, 'explodeDelay', 0.0,  3.0, 0.1 ).name('Explode hold (s)');

fEx.add(explodeParams, 'flyMin',     0.0,  8.0,  0.1 ).name('Fly min').onChange(applyExplodeParams);
fEx.add(explodeParams, 'flyRand',    0.0,  8.0,  0.1 ).name('Fly random').onChange(applyExplodeParams);
fEx.add(explodeParams, 'collapseAmt',0.0,  1.0,  0.01).name('Collapse amt').onChange(applyExplodeParams);

fEx.open();

// ── Stagger folder ────────────────────────────────────────────────────────────
const fSt = gui.addFolder('⏱ Stagger');
fSt.add(explodeParams, 'staggerSpread', 0.0, 1.0, 0.01).name('Spread').onChange(applyExplodeParams);
fSt.add(explodeParams, 'staggerWindow', 0.1, 1.0, 0.01).name('Window').onChange(applyExplodeParams);

// ── Rotation folder ───────────────────────────────────────────────────────────
const fRo = gui.addFolder('🔄 Rotation');
fRo.add(explodeParams, 'rotTurns',     0.0, 8.0, 0.1).name('Base turns').onChange(applyExplodeParams);
fRo.add(explodeParams, 'rotRandTurns', 0.0, 8.0, 0.1).name('Random turns').onChange(applyExplodeParams);

// ── Fade folder ───────────────────────────────────────────────────────────────
const fFa = gui.addFolder('🌫 Fade');
fFa.add(explodeParams, 'fadeStart', 0.0, 1.0, 0.01).name('Fade start').onChange(applyExplodeParams);
fFa.add(explodeParams, 'fadeEnd',   0.0, 1.0, 0.01).name('Fade end').onChange(applyExplodeParams);


// ── Actions ───────────────────────────────────────────────────────────────────
const actions = {
  explode:    () => triggerExplode(),
  reassemble: () => triggerReassemble(),
  transition: () => isWhiteWorld() ? goToBlueWorld() : goToWhiteWorld(),
};
const fAc = gui.addFolder('▶ Actions');
fAc.add(actions, 'explode').name('Explode  [E]');
fAc.add(actions, 'reassemble').name('Reassemble  [E]');
fAc.add(actions, 'transition').name('🔥 Toggle world  [T]');
fAc.open();

// ── Small hint label ─────────────────────────────────────────────────────────
const hint = document.createElement('div');
hint.style.cssText = `
  position:fixed;bottom:16px;right:16px;z-index:100;
  font-family:'Share Tech Mono','Courier New',monospace;
  font-size:10px;color:#224455;letter-spacing:.06em;
  pointer-events:none;line-height:1.8;text-align:right;`;
hint.innerHTML = `[W] wireframe &nbsp; [E] explode &nbsp; [T] transition &nbsp; [1-5] clip`;
document.body.appendChild(hint);
