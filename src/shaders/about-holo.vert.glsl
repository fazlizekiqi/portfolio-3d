varying vec3  vNormal;
varying vec3  vViewDir;
varying float vWorldY;
void main() {
  vNormal  = normalize(normalMatrix * normal);
  vec4 mv  = modelViewMatrix * vec4(position, 1.0);
  vViewDir = normalize(-mv.xyz);
  vWorldY  = (modelMatrix * vec4(position, 1.0)).y;
  gl_Position = projectionMatrix * mv;
}
