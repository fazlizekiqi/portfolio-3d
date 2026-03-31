uniform float uProgress;
uniform float uStaggerSpread;
uniform float uStaggerWindow;
uniform float uFlyMin;
uniform float uFlyRand;
uniform float uCollapseAmt;
uniform float uRotTurns;
uniform float uRotRandTurns;

attribute vec3  aCenter;
attribute float aRand;

varying float vExplodeFade; // 0 = assembled, 1 = fully flown → frag uses this for alpha

mat4 buildRotMat(vec3 axis, float angle) {
  axis = normalize(axis);
  float s = sin(angle), c = cos(angle), oc = 1.0 - c;
  return mat4(
    oc*axis.x*axis.x + c,        oc*axis.x*axis.y - axis.z*s, oc*axis.z*axis.x + axis.y*s, 0.0,
    oc*axis.x*axis.y + axis.z*s, oc*axis.y*axis.y + c,         oc*axis.y*axis.z - axis.x*s, 0.0,
    oc*axis.z*axis.x - axis.y*s, oc*axis.y*axis.z + axis.x*s, oc*axis.z*axis.z + c,         0.0,
    0.0, 0.0, 0.0, 1.0
  );
}

