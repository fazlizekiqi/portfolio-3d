// ── Tornado vertex displacement (replaces #include <begin_vertex>) ─────────────
// All maths in model-local space — no inverse(modelMatrix) needed.
//
// Phase 0 (cloud): uCloudProgress 0→1, uTravelProgress = 0
//   Pieces scatter a tiny distance like a mini explode, floating cloud.
//
// Phase 1 (travel): uCloudProgress held at 1, uTravelProgress 0→1
//   Cloud spirals along the local-space axis toward uDestinationLocal.

vec3 transformed = vec3(position);

// ── PHASE 0: cloud scatter ────────────────────────────────────────────────────
float faceStart = aRand * uStaggerSpread;
float faceEnd   = faceStart + uStaggerWindow;
float cloudFP   = clamp((uCloudProgress - faceStart) / (faceEnd - faceStart), 0.0, 1.0);
float cloudT    = smoothstep(0.0, 1.0, cloudFP);

// Collapse each vertex toward its face centroid
vec3 toCenter = aCenter - transformed;
transformed   = transformed + toCenter * cloudT * uCollapseAmt;

// Scatter outward with a gentle float
vec3  flyDir  = normalize(aCenter - uOriginLocal + vec3(aRand - 0.5, aRand * 0.8, aRand * 0.6 - 0.3));
float flyDist = cloudT * (uFlyMin + aRand * uFlyRand);
transformed  += flyDir * flyDist;

// Slow lazy spin during cloud float
vec3  cloudSpinAxis  = normalize(vec3(aRand - 0.5, aRand * 2.0 - 1.0, aRand * 0.7 - 0.35));
float cloudSpinAngle = cloudT * (3.14159 * 0.5 * (0.6 + aRand * 0.8));
mat4  cloudSpinMat   = _tBuildRotMat(cloudSpinAxis, cloudSpinAngle);
vec3  cloudPos       = (cloudSpinMat * vec4(transformed - aCenter, 1.0)).xyz + aCenter;

// ── PHASE 1: tornado travel ───────────────────────────────────────────────────
float travelFP = clamp((uTravelProgress - faceStart) / (faceEnd - faceStart), 0.0, 1.0);
// Cubic ease-in so pieces accelerate into the tornado gently
float travelT  = travelFP * travelFP * (3.0 - 2.0 * travelFP); // smoothstep

// vTornadoFade drives frag alpha — only brightens near full travel
vTornadoFade = travelFP * 0.6;

vec3 travelVec = uDestinationLocal - uOriginLocal;
float travelLen = length(travelVec);
vec3 travelDir  = travelLen > 0.001 ? travelVec / travelLen : vec3(0.0, 0.0, 1.0);

// Each face travels at a slightly different speed (stagger already applied via travelT)
vec3 axisPoint = uOriginLocal + travelVec * travelT;

// Spiral radius: wide at the start, tight spiral as pieces approach destination
// Extra ease: radius fades in softly so pieces don't immediately lurch sideways
float radiusEase = smoothstep(0.0, 0.15, travelT);
float radius = uTornadoRadius * radiusEase * (1.0 - travelT * 0.88) * (0.25 + aRand * 0.75);

// Spiral angle — accumulates many full rotations
float angle  = travelT * 6.28318 * (uRotTurns + aRand * uRotRandTurns);

// Local frame perpendicular to travel direction
vec3 tUp      = abs(travelDir.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
vec3 tRight   = normalize(cross(travelDir, tUp));
vec3 tForward = normalize(cross(tRight, travelDir));

vec3 swirl = tRight * cos(angle) * radius + tForward * sin(angle) * radius;

// Arc lift — sine peak at midpoint, eases in/out naturally
float lift = uTornadoHeight * sin(travelT * 3.14159) * (0.4 + aRand * 0.6);

vec3 tornadoCentroid  = axisPoint + swirl;
tornadoCentroid.y    += lift;

// Face spins around its own centroid while traveling
// Spin speed also eases in so pieces don't snap into rotation at t=0
vec3  spinAxis  = normalize(vec3(aRand - 0.5, aRand * 1.5 - 0.75, 1.0 - aRand));
float spinAngle = travelT * 6.28318 * (uRotTurns * 0.7 + aRand * uRotRandTurns * 0.8);
mat4  spinMat   = _tBuildRotMat(spinAxis, spinAngle);

vec3 faceOffset  = cloudPos - aCenter;  // carry shape from cloud phase
vec3 spunOffset  = (spinMat * vec4(faceOffset, 0.0)).xyz;

vec3 travelPos  = tornadoCentroid + spunOffset;

// Blend cloud position → tornado position with a smooth ease
// travelT=0: pure cloud. travelT=1: fully in tornado trajectory.
transformed = mix(cloudPos, travelPos, travelT);
