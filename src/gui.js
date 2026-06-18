import { GUI } from 'dat.gui';
import { audio } from './audio.js';
import { skeletonDebugParams, applyParams, hideDebugOverlay } from './character/skeleton-debug.js';
import { wwLightParams } from './world/blueworld.js';
import { tornadoCamParams, tornadoParams } from './world/tornado-travel.js';
import { playerParams } from './character/player.js';
import { waterParams } from './world/whiteworld.js';
import { skillLayoutParams, showSkillBubbles } from './presentation/slides/skills/skill-bubbles.js';
import { SLIDES } from './presentation/slides.js';
import { applySlideCam } from './presentation/presentation.js';

// ── dat.gui panel — starts closed ─────────────────────────────────────────────
const gui = new GUI({ width: 280, closed: true });
gui.domElement.style.cssText += 'z-index:200;';

// ── Audio folder — live mixer for the ambient bed + UI/SFX ────────────────────
// Each layer gets a Volume slider (0…max) and an On/Off toggle so the ambient
// soundscape can be balanced against the interface sounds in real time.
const fAudio = gui.addFolder('🔊 Audio');
const AUDIO_LAYERS = [
  ['master',    'Ambient master', 0.6],
  ['pad',       'Organ pad',      2.0],
  ['bass',      'Bass',           2.0],
  ['reverb',    'Reverb',         2.0],
  ['arp',       'Arpeggio',       2.0],
  ['pulse',     'Orbital pulse',  2.0],
  ['harmonica', 'Space harmonica',2.0],
  ['choir',     'Cosmic choir',   2.0],
];
for (const [key, label, max] of AUDIO_LAYERS) {
  const sub = fAudio.addFolder(label);
  sub.add(audio.ambientMix, key, 0, max, 0.01).name('Volume')
     .onChange(v => audio.setAmbientLevel(key, v));
  sub.add(audio.ambientOn, key).name('On')
     .onChange(v => audio.setAmbientEnabled(key, v));
}
fAudio.add(audio, 'sfxVolume', 0, 2, 0.01).name('UI / SFX vol')
      .onChange(v => audio.setSfxVolume(v));

// ── Skeleton debug folder ─────────────────────────────────────────────────────
// Markers track actual skeleton bones every frame — they follow all animations.
// Offsets: x=left/right, y=up/down, z=forward — relative to each bone's facing.
// Adjust offsets until each marker sits on the right spot, then "Hide all".
const fSkel = gui.addFolder('🦴 Skeleton Debug');
fSkel.open(); // open by default so debug overlay is immediately accessible
fSkel.add(skeletonDebugParams, 'showJoints').name('Show joints (all bones)').onChange(applyParams);
fSkel.add(skeletonDebugParams, 'showLines' ).name('Show skeleton lines'    ).onChange(applyParams);
fSkel.add(skeletonDebugParams, 'jointSize',  0.005, 0.10, 0.002).name('Joint size').onChange(applyParams);
fSkel.add({ hideDebugOverlay }, 'hideDebugOverlay').name('Hide all');

// [key, label, hasRadius, openByDefault]
const SKEL_LANDMARKS = [
  ['eyeL',  'Eye L (cyan)',     false, true ],
  ['eyeR',  'Eye R (cyan)',     false, true ],
  ['head',  'Head ring (pink)', true,  true ],
  ['chest', 'Chest (orange)',   false, false],
  ['handL', 'Hand L (orange)',  false, false],
  ['handR', 'Hand R (orange)',  false, false],
  ['footL', 'Foot L (green)',   false, false],
  ['footR', 'Foot R (green)',   false, false],
];
for (const [key, label, hasRadius, openByDefault] of SKEL_LANDMARKS) {
  const f = fSkel.addFolder(label);
  if (openByDefault) f.open();
  f.add(skeletonDebugParams[key], 'on'             ).name('Show'  ).onChange(applyParams);
  f.add(skeletonDebugParams[key], 'x', -0.4, 0.4, 0.005).name('X (←→)').onChange(applyParams);
  f.add(skeletonDebugParams[key], 'y', -0.4, 0.4, 0.005).name('Y (↑↓)').onChange(applyParams);
  f.add(skeletonDebugParams[key], 'z', -0.4, 0.4, 0.005).name('Z (fwd)').onChange(applyParams);
  if (hasRadius)
    f.add(skeletonDebugParams[key], 'radius', 0.04, 0.30, 0.005).name('Radius').onChange(applyParams);
}

// ── White-world lighting folder ───────────────────────────────────────────────
const fWL = gui.addFolder('☀ White World Lighting');

const fWLamb = fWL.addFolder('Ambient');
fWLamb.addColor(wwLightParams, 'ambientColor'    ).name('Color');
fWLamb.add(    wwLightParams,  'ambientIntensity', 0, 3, 0.01).name('Intensity');

const fWLkey = fWL.addFolder('Key light');
fWLkey.addColor(wwLightParams, 'keyColor'    ).name('Color');
fWLkey.add(    wwLightParams,  'keyIntensity', 0, 4, 0.01).name('Intensity');
fWLkey.add(    wwLightParams,  'keyX', -10, 10, 0.1).name('X');
fWLkey.add(    wwLightParams,  'keyY',   0, 15, 0.1).name('Y');
fWLkey.add(    wwLightParams,  'keyZ', -10, 10, 0.1).name('Z');

const fWLfill = fWL.addFolder('Fill light');
fWLfill.addColor(wwLightParams, 'fillColor'    ).name('Color');
fWLfill.add(    wwLightParams,  'fillIntensity', 0, 3, 0.01).name('Intensity');

const fWLrim = fWL.addFolder('Rim light');
fWLrim.addColor(wwLightParams, 'rimColor'    ).name('Color');
fWLrim.add(    wwLightParams,  'rimIntensity', 0, 2, 0.01).name('Intensity');

const fWLback = fWL.addFolder('Back light');
fWLback.addColor(wwLightParams, 'backLightColor'    ).name('Color');
fWLback.add(    wwLightParams,  'backLightIntensity', 0, 10,  0.1 ).name('Intensity');
fWLback.add(    wwLightParams,  'backLightHeight',    0,  5,  0.05).name('Height');
fWLback.add(    wwLightParams,  'backLightDist',      0.5, 10, 0.1).name('Distance');

// ── Tornado camera folder ────────────────────────────────────────────────────
const fTC = gui.addFolder('🌪 Tornado Camera');

const fTCfollow = fTC.addFolder('Follow');
fTCfollow.add(tornadoCamParams, 'followHeight',  0.5, 15.0, 0.1).name('Height');
fTCfollow.add(tornadoCamParams, 'followDist',    1.0, 20.0, 0.1).name('Distance');
fTCfollow.add(tornadoCamParams, 'lerpPos',       0.05, 5.0, 0.05).name('Pos lerp');
fTCfollow.add(tornadoCamParams, 'lerpLook',      0.05, 5.0, 0.05).name('Look lerp');

const fTCentry = fTC.addFolder('Entry crane');
fTCentry.add(tornadoCamParams, 'entryDuration',  0.2, 5.0, 0.1).name('Duration (s)');
fTCentry.add(tornadoCamParams, 'entryHeight',    0.0, 15.0, 0.1).name('Height');

const fTCsettle = fTC.addFolder('Settle');
fTCsettle.add(tornadoCamParams, 'settleDuration', 0.5, 8.0, 0.1).name('Duration (s)');
fTCsettle.add(tornadoCamParams, 'settlePosLerp',  0.1, 8.0, 0.1).name('Pos lerp');
fTCsettle.add(tornadoCamParams, 'settleLookLerp', 0.1, 8.0, 0.1).name('Look lerp');

const fTCreassemble = fTC.addFolder('Reassembly');
fTCreassemble.add(tornadoParams, 'reassembleSpeed', 0.05, 2.0, 0.01).name('Speed');

const fTCshape = fTC.addFolder('Tornado shape');
fTCshape.add(tornadoParams, 'tornadoRadius', 0.1, 5.0, 0.1).name('Radius');
fTCshape.add(tornadoParams, 'tornadoHeight', 0.0, 5.0, 0.1).name('Height');

// ── Player camera folder ──────────────────────────────────────────────────────
const fPC = gui.addFolder('🎮 Player Camera');
fPC.add(playerParams, 'camDistance',  1.0, 20.0, 0.1).name('Distance');
fPC.add(playerParams, 'camHeight',    0.0, 10.0, 0.1).name('Height');
fPC.add(playerParams, 'camLerp',      0.5, 20.0, 0.1).name('Lerp speed');
fPC.add(playerParams, 'camEntryTime', 0.1,  3.0, 0.1).name('Entry glide (s)');
fPC.add(playerParams, 'walkSpeed',    0.5, 12.0, 0.1).name('Walk speed');
fPC.add(playerParams, 'runSpeed',     1.0, 20.0, 0.1).name('Run speed');
fPC.add(playerParams, 'rotateSpeed',  0.5,  8.0, 0.1).name('Rotate speed');

// ── Water folder ─────────────────────────────────────────────────────────────
const fW = gui.addFolder('🌊 Water');
fW.addColor(waterParams, 'mainColor' ).name('Main color');
fW.addColor(waterParams, 'baseColor' ).name('Edge color');
fW.add(     waterParams, 'rippling',   0.0,  0.5,  0.001).name('Rippling');
fW.add(     waterParams, 'foamScale',  0.1,  5.0,  0.1  ).name('Foam scale');
fW.add(     waterParams, 'speed',      0.0,  4.0,  0.05 ).name('Speed');
fW.add(     waterParams, 'posY',      -2.0,  0.5,  0.01 ).name('Height (Y)');

// ── Skills bubble layout folder ───────────────────────────────────────────────
const fSK = gui.addFolder('🔵 Skills Bubbles');
const _refreshSpheres = () => showSkillBubbles();
fSK.add(skillLayoutParams, 'offsetX', -20, 20, 0.5).name('Shift X %').onChange(_refreshSpheres);
fSK.add(skillLayoutParams, 'offsetY', -20, 20, 0.5).name('Shift Y %').onChange(_refreshSpheres);
fSK.add(skillLayoutParams, 'spread',  0.4,  2.0, 0.05).name('Spread').onChange(_refreshSpheres);

// ── Slides camera folder ──────────────────────────────────────────────────────
const fSlides = gui.addFolder('🎬 Slides Camera');
for (const slide of SLIDES) {
  const f = fSlides.addFolder(slide.name);
  const c = slide.cam;
  const apply = () => applySlideCam(slide);

  if (c.pos && c.target) {
    const fD = f.addFolder('Desktop');
    const fDPos = fD.addFolder('pos');
    fDPos.add(c.pos, 'x', -15, 15, 0.05).name('X').onChange(apply);
    fDPos.add(c.pos, 'y',  -2, 10, 0.05).name('Y').onChange(apply);
    fDPos.add(c.pos, 'z',  -8, 20, 0.05).name('Z').onChange(apply);
    const fDTgt = fD.addFolder('target');
    fDTgt.add(c.target, 'x', -10, 10, 0.05).name('X').onChange(apply);
    fDTgt.add(c.target, 'y',  -2,  6, 0.05).name('Y').onChange(apply);
    fDTgt.add(c.target, 'z', -10, 10, 0.05).name('Z').onChange(apply);
  }

  if (c.anchor) {
    const fA = f.addFolder('⚓ Anchor (spawn-relative)');
    fA.add(c.anchor, 'dist',         0.5, 12.0, 0.05).name('Cam Z distance').onChange(apply);
    fA.add(c.anchor, 'camY',        -1.0,  4.0, 0.05).name('Cam Y').onChange(apply);
    fA.add(c.anchor, 'targetY',     -1.0,  4.0, 0.05).name('Target Y').onChange(apply);
    fA.add(c.anchor, 'offsetX',     -5.0,  5.0, 0.05).name('Cam offset X').onChange(apply);
    fA.add(c.anchor, 'targetOffsetX',-5.0, 5.0, 0.05).name('Target offset X').onChange(apply);
  }

  if (c.mobile?.pos && c.mobile?.target) {
    const fM = f.addFolder('Mobile');
    const fMPos = fM.addFolder('pos');
    fMPos.add(c.mobile.pos, 'x', -15, 15, 0.05).name('X').onChange(apply);
    fMPos.add(c.mobile.pos, 'y',  -2, 10, 0.05).name('Y').onChange(apply);
    fMPos.add(c.mobile.pos, 'z',  -8, 20, 0.05).name('Z').onChange(apply);
    const fMTgt = fM.addFolder('target');
    fMTgt.add(c.mobile.target, 'x', -10, 10, 0.05).name('X').onChange(apply);
    fMTgt.add(c.mobile.target, 'y',  -2,  6, 0.05).name('Y').onChange(apply);
    fMTgt.add(c.mobile.target, 'z', -10, 10, 0.05).name('Z').onChange(apply);
  }

  if (c.mobile?.anchor) {
    const fMA = f.addFolder('⚓ Mobile Anchor');
    fMA.add(c.mobile.anchor, 'dist',          0.5, 15.0, 0.05).name('Cam Z distance').onChange(apply);
    fMA.add(c.mobile.anchor, 'camY',         -1.0,  4.0, 0.05).name('Cam Y').onChange(apply);
    fMA.add(c.mobile.anchor, 'targetY',      -1.0,  4.0, 0.05).name('Target Y').onChange(apply);
    fMA.add(c.mobile.anchor, 'offsetX',      -5.0,  5.0, 0.05).name('Cam offset X').onChange(apply);
    fMA.add(c.mobile.anchor, 'targetOffsetX',-5.0,  5.0, 0.05).name('Target offset X').onChange(apply);
  }
}

