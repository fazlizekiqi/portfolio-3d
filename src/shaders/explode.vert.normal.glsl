// ── Standard Three.js beginnormal_vertex ────────────────────────────────
vec3 objectNormal = vec3(normal);
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(tangent.xyz);
#endif

// ── Rotate normal with face so PBR lighting stays correct mid-flight ────
float _fp2 = clamp((uProgress - aRand * uStaggerSpread) /
                   (uStaggerWindow), 0.0, 1.0);
float _t2  = smoothstep(0.0, 1.0, _fp2);
vec3  _rAxis2  = normalize(vec3(aRand - 0.5, aRand * 2.0 - 1.0, aRand * 0.7 - 0.35));
float _rAngle2 = _t2 * (3.14159265 * 2.0 * uRotTurns + aRand * 3.14159265 * 2.0 * uRotRandTurns);
mat4  _rMat2   = buildRotMat(_rAxis2, _rAngle2);
objectNormal   = normalize((_rMat2 * vec4(objectNormal, 0.0)).xyz);

