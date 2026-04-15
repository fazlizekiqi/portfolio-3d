// water.vert.glsl — toon low-poly water
// Passes world-space XZ to the fragment shader (mirrors Godot world_pos logic).

varying vec2 vWorldXZ;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldXZ      = worldPos.xz;
  gl_Position   = projectionMatrix * viewMatrix * worldPos;
}

