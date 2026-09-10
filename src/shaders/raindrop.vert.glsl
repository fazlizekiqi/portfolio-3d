// raindrop.vert.glsl — vertex shader for raindrop bubble spheres
varying vec3  vNormal;
varying vec3  vViewDir;
varying vec2  vUv;
varying vec3  vWorldPos;

void main() {
    vUv       = uv;
    vNormal   = normalize(normalMatrix * normal);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewDir  = normalize(-mvPos.xyz);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * mvPos;
}

