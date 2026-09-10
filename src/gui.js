import { GUI } from 'dat.gui';
import { audio } from './audio.js';
import { camera, controls } from './scene.js';
import { modelGroup } from './character/model.js';
import { skeletonDebugParams, headRotation, applyParams, hideDebugOverlay } from './character/skeleton-debug.js';
import { wwLightParams } from './world/blueworld.js';
import { tornadoCamParams, tornadoParams } from './world/tornado-travel.js';
import { playerParams } from './character/player.js';
import { waterParams, getEnvRoot, envLightParams, labAnimParams, labFixtures, sunParams } from './world/whiteworld.js';
import { skillLayoutParams, showSkillBubbles } from './presentation/slides/skills/skill-bubbles.js';
import { SLIDES } from './presentation/slides.js';
import { applySlideCam } from './presentation/presentation.js';

// ── dat.gui panel — starts closed ─────────────────────────────────────────────
const gui = new GUI({ width: 280, closed: true });
gui.domElement.style.cssText += 'z-index:200;';

// ── Character debug folder ────────────────────────────────────────────────────
// Log the character's current world-space position so you can find the right
// WHITE_WORLD_SPAWN coords for new-model-test-3.glb.
const fChar = gui.addFolder('🎯 Character Debug');
fChar.open();
fChar.add({
  logPosition: () => {
    if (!modelGroup) { console.warn('[gui] modelGroup not ready yet'); return; }
    const p = modelGroup.position;
    const f = n => Number(n.toFixed(4));
    console.log(
      `%c[Character position]  x: ${f(p.x)}  y: ${f(p.y)}  z: ${f(p.z)}`,
      'color:#00e5ff;font-weight:bold;font-size:13px',
    );
    console.log(
      `WHITE_WORLD_SPAWN → new THREE.Vector3(${f(p.x)}, 0, ${f(p.z)})`,
    );
  },
}, 'logPosition').name('📌 Log character position');

fChar.add({
  logEnvPosition: () => {
    const root = getEnvRoot();
    if (!root) { console.warn('[gui] env root not loaded yet'); return; }
    const p = root.position;
    const f = n => Number(n.toFixed(4));
    console.log(
      `%c[Env root position]  x: ${f(p.x)}  y: ${f(p.y)}  z: ${f(p.z)}`,
      'color:#ffdd00;font-weight:bold;font-size:13px',
    );
    console.log(
      `  root.position.x = ${f(p.x)}\n  root.position.y = ${f(p.y)}\n  root.position.z = ${f(p.z)}`,
    );
  },
}, 'logEnvPosition').name('🌍 Log env position');

// ── Live camera readout ───────────────────────────────────────────────────────
// Real-time position / rotation / target of the OrbitControls camera. As you
// orbit or pan the scene (before entering present/explore mode) these fields
// update live via dat.GUI's .listen() polling. Rotation is shown in degrees.
// "Log camera" prints a copy-paste-ready slide-cam block to the console.
const camRotDeg = { x: 0, y: 0, z: 0 }; // derived each frame from camera.rotation
const fCam = gui.addFolder('📷 Camera (live)');

const fCamPos = fCam.addFolder('Position');
fCamPos.add(camera.position, 'x').step(0.01).listen();
fCamPos.add(camera.position, 'y').step(0.01).listen();
fCamPos.add(camera.position, 'z').step(0.01).listen();

const fCamRot = fCam.addFolder('Rotation (deg)');
fCamRot.add(camRotDeg, 'x').step(0.1).listen();
fCamRot.add(camRotDeg, 'y').step(0.1).listen();
fCamRot.add(camRotDeg, 'z').step(0.1).listen();

const fCamTgt = fCam.addFolder('Target (orbit)');
fCamTgt.add(controls.target, 'x').step(0.01).listen();
fCamTgt.add(controls.target, 'y').step(0.01).listen();
fCamTgt.add(controls.target, 'z').step(0.01).listen();

const RAD2DEG = 180 / Math.PI;
fCam.add({ copyCamera: () => {
  const p = camera.position, t = controls.target, r = camera.rotation;
  const f = (n) => Number(n.toFixed(3));
  const text =
    `pos:    { x: ${f(p.x)}, y: ${f(p.y)}, z: ${f(p.z)} }\n` +
    `target: { x: ${f(t.x)}, y: ${f(t.y)}, z: ${f(t.z)} }\n` +
    `rot(°): { x: ${f(r.x * RAD2DEG)}, y: ${f(r.y * RAD2DEG)}, z: ${f(r.z * RAD2DEG)} }`;
  navigator.clipboard?.writeText(text).then(
    ()  => alert('Camera values copied to clipboard!'),
    ()  => alert(text),   // fallback: show in alert so values are readable on mobile
  ) ?? alert(text);
} }, 'copyCamera').name('📋 Copy camera values');

// Keep the derived degree readout in sync with the live camera rotation.
function _tickCamReadout() {
  camRotDeg.x = camera.rotation.x * RAD2DEG;
  camRotDeg.y = camera.rotation.y * RAD2DEG;
  camRotDeg.z = camera.rotation.z * RAD2DEG;
  requestAnimationFrame(_tickCamReadout);
}
requestAnimationFrame(_tickCamReadout);

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

// ── Audio preview — play any sound on demand for auditioning ─────────────────
const fAP = fAudio.addFolder('🎧 Preview sounds');

const FALLBACK_CHORD = [261.63, 329.63, 392.00, 587.33]; // C add9
const _ensureAudio = () => audio.resume();

fAP.add({ play: () => { _ensureAudio(); audio.playScanBeep(); } }, 'play')
   .name('▶ Scan beep ×1');
fAP.add({
  play: () => {
    _ensureAudio();
    for (let i = 0; i < 4; i++) setTimeout(() => audio.playScanBeep(), i * 220);
  },
}, 'play').name('▶ Scan beep ×4  (About sequence)');

const _arp = (style) => {
  _ensureAudio();
  const chord = audio._currentChord || FALLBACK_CHORD;
  const dest  = audio._sfx || audio._master;
  if (!dest) return;
  audio._playArpPattern(style, chord, dest);
};

const ARPS = [
  ['starfield',  'Intro — starfield'],
  ['cascade',    'Skills — cascade'],
  ['fanfare',    'Projects — fanfare'],
  ['breath',     'Mindset — breath'],
  ['timeline',   'Experience — timeline'],
  ['scan',       'About ★ — scan'],
  ['invitation', 'CTA — invitation'],
  ['ascent',     'MyWorld — ascent'],
];
for (const [style, label] of ARPS) {
  fAP.add({ play: () => _arp(style) }, 'play').name(`▶ Arp: ${label}`);
}

// ── Skeleton debug folder ─────────────────────────────────────────────────────
// Markers track actual skeleton bones every frame — they follow all animations.
// Offsets: x=left/right, y=up/down, z=forward — relative to each bone's facing.
// Adjust offsets until each marker sits on the right spot, then "Hide all".
const fSkel = gui.addFolder('🦴 Skeleton Debug');
fSkel.add(skeletonDebugParams, 'showJoints').name('Show joints (all bones)').onChange(applyParams);
fSkel.add(skeletonDebugParams, 'showLines' ).name('Show skeleton lines'    ).onChange(applyParams);
fSkel.add(skeletonDebugParams, 'jointSize',  0.005, 0.10, 0.002).name('Joint size').onChange(applyParams);
fSkel.add({ hideDebugOverlay }, 'hideDebugOverlay').name('Hide all');

// [key, label, hasRadius]
const SKEL_LANDMARKS = [
  ['eyeL',  'Eye L (cyan)',     false],
  ['eyeR',  'Eye R (cyan)',     false],
  ['head',  'Head ring (pink)', true ],
  ['chest', 'Chest (orange)',   false],
  ['handL', 'Hand L (orange)',  false],
  ['handR', 'Hand R (orange)',  false],
  ['footL', 'Foot L (green)',   false],
  ['footR', 'Foot R (green)',   false],
];
for (const [key, label, hasRadius] of SKEL_LANDMARKS) {
  const f = fSkel.addFolder(label);
  f.add(skeletonDebugParams[key], 'on'             ).name('Show'  ).onChange(applyParams);
  f.add(skeletonDebugParams[key], 'x', -0.4, 0.4, 0.005).name('X (←→)').onChange(applyParams);
  f.add(skeletonDebugParams[key], 'y', -0.4, 0.4, 0.005).name('Y (↑↓)').onChange(applyParams);
  f.add(skeletonDebugParams[key], 'z', -0.4, 0.4, 0.005).name('Z (fwd)').onChange(applyParams);
  if (hasRadius)
    f.add(skeletonDebugParams[key], 'radius', 0.04, 0.30, 0.005).name('Radius').onChange(applyParams);
}

const fHead = fSkel.addFolder('Head Bone');
fHead.add(headRotation, 'x', -90, 90, 1).name('rotate X (nod)');
fHead.add(headRotation, 'y', -90, 90, 1).name('rotate Y (turn)');
fHead.add(headRotation, 'z', -90, 90, 1).name('rotate Z (tilt)');

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

const fPCcol = fPC.addFolder('🧱 Collision');
fPCcol.add(playerParams, 'stepHeight', 0.05, 2.0, 0.05).name('Max step height');
fPCcol.add(playerParams, 'bodyRadius', 0.10, 1.0, 0.02).name('Body radius');

// ── Env lights folder ─────────────────────────────────────────────────────────
// Real lighting for the white-world GLB (the env shader is otherwise flat/unlit).
// Ambient lifts the whole world; each lamp is a movable point light with a
// visible bulb marker. Toon steps quantise the falloff into cel-shaded bands.
const fEL = gui.addFolder('💡 Env Lights');

const fELamb = fEL.addFolder('Ambient');
fELamb.addColor(envLightParams, 'ambientColor'    ).name('Color');
fELamb.add(    envLightParams,  'ambientIntensity', 0, 3, 0.01).name('Intensity');
fEL.add(envLightParams, 'toonSteps', 0, 6, 1).name('Toon steps (0=smooth)');

envLightParams.lamps.forEach((lamp, i) => {
  const fL = fEL.addFolder(`Lamp ${i + 1}`);
  const cEnabled = fL.add(   lamp, 'enabled'           ).name('Enabled');
                   fL.addColor(lamp, 'color'           ).name('Color');
                   fL.add(   lamp, 'intensity', 0, 8, 0.05).name('Intensity');
                   fL.add(   lamp, 'range',     0.5, 60, 0.5).name('Range');
  const cX       = fL.add(   lamp, 'x', -60, 60, 0.1).name('X');
  const cY       = fL.add(   lamp, 'y',   0, 40, 0.1).name('Y (height)');
  const cZ       = fL.add(   lamp, 'z', -60, 60, 0.1).name('Z');

  // Drop the lamp on the character's current spot (a bit above the head),
  // switch it on, and refresh the sliders so you can fine-tune from there.
  fL.add({ place: () => {
    if (!modelGroup) { console.warn('[gui] modelGroup not ready yet'); return; }
    const p = modelGroup.position;
    lamp.x = Number(p.x.toFixed(2));
    lamp.y = Number((p.y + 2.5).toFixed(2));   // ~head height + a little
    lamp.z = Number(p.z.toFixed(2));
    lamp.enabled = true;
    cX.updateDisplay(); cY.updateDisplay(); cZ.updateDisplay();
    cEnabled.updateDisplay();
  } }, 'place').name('📍 Place at character');
});

// ── Sun folder ────────────────────────────────────────────────────────────────
// Directional "sun" light for the white world — same gating as every other env
// light (only shines while in/entering the white world). Fades out near the
// lab (indoor, roofed) since it derives its centre from the lab's own clips.
const fSun = gui.addFolder('☀ Sun');
fSun.add(   sunParams, 'enabled'                   ).name('Enabled');
fSun.addColor(sunParams, 'color'                   ).name('Color');
fSun.add(   sunParams, 'intensity',     0,  8, 0.05 ).name('Intensity');
fSun.add(   sunParams, 'elevationDeg',  0, 90, 1    ).name('Elevation °');
fSun.add(   sunParams, 'azimuthDeg', -180,180, 1    ).name('Azimuth °');
fSun.add(   sunParams, 'distance',      5, 80, 1    ).name('Distance');
fSun.add(   sunParams, 'indoorRadius',  0, 60, 0.5  ).name('Indoor radius (lab)');
fSun.add(   sunParams, 'indoorFalloff', 0.5,30, 0.5 ).name('Indoor falloff');

// ── Lab machine animations folder ─────────────────────────────────────────────
// The robotics-lab machines (industrial arm, hexapod, 3D printer, compactor,
// desk toy) loop their GLB animations when the character walks within `radius`
// of the lab and pause when they leave. Toggle the ring to see the boundary.
const fLA = gui.addFolder('🤖 Lab Animations');
fLA.add(labAnimParams, 'enabled'              ).name('Enabled');
fLA.add(labAnimParams, 'radius',    1, 60, 0.5).name('Trigger radius');
fLA.add(labAnimParams, 'timeScale', 0,  3, 0.05).name('Speed');
fLA.add(labAnimParams, 'showRadius'           ).name('Show radius ring');
fLA.add(labAnimParams, 'headFollow'                  ).name('Wall-E head follows');
fLA.add(labAnimParams, 'headTurnSpeed',   0.5, 20, 0.5).name('Head turn speed');
fLA.add(labAnimParams, 'headYawOffsetDeg', -180, 180, 1).name('Head yaw offset °');

// ── Lab fixtures folder ───────────────────────────────────────────────────────
// Fixed work lights anchored to specific lab objects (table, printer, kiosk).
const fFX = gui.addFolder('🔦 Lab Fixtures');
labFixtures.forEach((fx) => {
  const f = fFX.addFolder(fx.name);
  f.add(   fx, 'enabled'                 ).name('Enabled');
  f.addColor(fx, 'color'                 ).name('Color');
  f.add(   fx, 'intensity',   0, 8, 0.05 ).name('Intensity');
  f.add(   fx, 'range',     0.5, 40, 0.5  ).name('Range');
  f.add(   fx, 'heightOffset', 0, 12, 0.1 ).name('Height above');
});

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

