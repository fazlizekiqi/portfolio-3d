uniform float uOpacity;
uniform float uTime;
uniform float uClipY;      // hide fragments below this world-Y (reveal sweep)
uniform float uClipYMax;   // outro burn: discard fragments above this + noise (head→feet)
uniform float uPulse;
varying vec3  vNormal;
varying vec3  vViewDir;
varying float vWorldY;
// compact value noise — same functions used in the character burn shader
float _hh(vec2 p){p=fract(p*vec2(127.1,311.7));p+=dot(p,p+19.19);return fract(p.x*p.y);}
float _hn(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
  return mix(mix(_hh(i),_hh(i+vec2(1,0)),u.x),mix(_hh(i+vec2(0,1)),_hh(i+vec2(1,1)),u.x),u.y);}
float _hf(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*_hn(p);p=p*2.1;a*=.5;}return v;}
void main() {
  if (vWorldY < uClipY) discard;
  // Outro: noisy dissolve from head down (mirrors character intro burn direction)
  if (uClipYMax < 900.0) {
    float _e = 0.20;
    float _n = _hf(vec2(vWorldY * 5.5, uTime * 0.45)) * _e * 1.9
             + _hn(vec2(vWorldY * 13.0, uTime * 0.35)) * _e * 0.6;
    if (vWorldY > uClipYMax + _n) discard;
  }
  float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 2.0);
  float scan = 0.5 + 0.5 * sin(vWorldY * 70.0 - uTime * 2.6);
  vec3  col  = mix(vec3(0.0, 0.35, 0.65), vec3(0.25, 0.95, 1.0), fres);
  float a    = (0.05 + fres * 0.75 + scan * 0.04) * uOpacity * (1.0 + uPulse * 0.9);
  gl_FragColor = vec4(col, a);
}
