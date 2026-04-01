// ── Tornado pars — injected after #include <common> ──────────────────────────
// Two-phase tornado travel, all in model-local space.
//
//  uCloudProgress  0→1 : pieces drift apart into a small floating cloud
//  uTravelProgress 0→1 : cloud spirals toward uDestinationLocal and converges

uniform float uCloudProgress;   // drives small scatter (phase 0)
uniform float uTravelProgress;  // drives tornado travel (phase 1)

uniform float uStaggerSpread;
uniform float uStaggerWindow;

uniform float uFlyMin;       // cloud puff radius (very small)
uniform float uFlyRand;
uniform float uCollapseAmt;

// Both in MODEL-LOCAL space (converted from world by JS each frame)
uniform vec3  uOriginLocal;
uniform vec3  uDestinationLocal;

uniform float uTornadoRadius;
uniform float uTornadoHeight;
uniform float uRotTurns;
uniform float uRotRandTurns;

uniform float uFadeStart;
uniform float uFadeEnd;

attribute vec3  aCenter;
attribute float aRand;

varying float vTornadoFade;

mat4 _tBuildRotMat(vec3 axis, float angle) {
  axis = normalize(axis);
  float s = sin(angle), c = cos(angle), oc = 1.0 - c;
  return mat4(
    oc*axis.x*axis.x + c,        oc*axis.x*axis.y - axis.z*s, oc*axis.z*axis.x + axis.y*s, 0.0,
    oc*axis.x*axis.y + axis.z*s, oc*axis.y*axis.y + c,        oc*axis.y*axis.z - axis.x*s, 0.0,
    oc*axis.z*axis.x - axis.y*s, oc*axis.y*axis.z + axis.x*s, oc*axis.z*axis.z + c,        0.0,
    0.0, 0.0, 0.0, 1.0
  );
}
