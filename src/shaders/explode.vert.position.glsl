// ── Standard Three.js begin_vertex ──────────────────────────────────────
vec3 transformed = vec3(position);

// ── Explode displacement ─────────────────────────────────────────────────
float faceStart = aRand * uStaggerSpread;
float faceEnd   = faceStart + uStaggerWindow;
float fp = clamp((uProgress - faceStart) / (faceEnd - faceStart), 0.0, 1.0);
vExplodeFade = fp;

float t = smoothstep(0.0, 1.0, fp);

vec3  toCenter  = aCenter - transformed;
transformed     = transformed + toCenter * t * uCollapseAmt;

vec3  flyDir   = normalize(aCenter);
float flyDist  = t * (uFlyMin + aRand * uFlyRand);
transformed   += flyDir * flyDist;

vec3  rotAxis  = normalize(vec3(aRand - 0.5, aRand * 2.0 - 1.0, aRand * 0.7 - 0.35));
float rotAngle = t * (3.14159265 * 2.0 * uRotTurns + aRand * 3.14159265 * 2.0 * uRotRandTurns);
mat4  rMat     = buildRotMat(rotAxis, rotAngle);

// Rotate position around face centroid
transformed = (rMat * vec4(transformed - aCenter, 1.0)).xyz + aCenter;

