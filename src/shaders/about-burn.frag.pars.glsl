varying float vBurnWorldY;
uniform float uBurnY;
uniform float uBurnEdge;
uniform float uBurnTime;
// value noise hash
float _bh(vec2 p){p=fract(p*vec2(127.1,311.7));p+=dot(p,p+19.19);return fract(p.x*p.y);}
// bilinear noise
float _bn(vec2 p){
  vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
  return mix(mix(_bh(i),_bh(i+vec2(1,0)),u.x),
             mix(_bh(i+vec2(0,1)),_bh(i+vec2(1,1)),u.x),u.y);
}
// 4-octave fbm
float _bf(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*_bn(p);p=p*2.1;a*=.5;}return v;}
