varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos     = worldPos.xyz;
  // No non-uniform scale on the env root, so mat3(modelMatrix) is fine here.
  vWorldNormal  = normalize(mat3(modelMatrix) * normal);
  gl_Position   = projectionMatrix * viewMatrix * worldPos;
}
