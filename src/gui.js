import { GUI } from 'dat.gui';
import { wwLightParams } from './world/blueworld.js';
import { tornadoCamParams, tornadoParams } from './world/tornado-travel.js';
import { playerParams } from './character/player.js';
import { waterParams } from './world/whiteworld.js';
import { skillLayoutParams, showSkillBubbles } from './presentation/bubbles.js';

// ── dat.gui panel — starts closed ─────────────────────────────────────────────
const gui = new GUI({ width: 280, closed: true });
gui.domElement.style.cssText += 'z-index:200;';

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

