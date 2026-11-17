// World-sized dust billows with ordered dithering in render-target pixels.
import {DustField} from './dust_field.js?v=grain-dust-6';
const VERT=`
attribute float aSeed;
attribute float aSize;
attribute float aOpacity;
attribute vec3 aColor;
uniform float uViewportHeight;
varying vec3 vColor;
varying float vSeed;
varying float vOpacity;
void main(){
  vColor=aColor;vSeed=aSeed;vOpacity=aOpacity;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
  gl_PointSize=clamp(aSize*uViewportHeight*0.5*projectionMatrix[1][1]/max(0.01,gl_Position.w),1.0,256.0);
}`;
const FRAG=`
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunIntensity;
uniform vec3 uAmbColor;
uniform float uAmbIntensity;
varying vec3 vColor;
varying float vSeed;
varying float vOpacity;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+1.0),f.x),f.y);
}
// Ordered coverage stays fixed to the scene pixel grid instead of flickering per frame.
float bayer2(vec2 p){
  return p.y<1.0?(p.x<1.0?0.0:2.0):(p.x<1.0?3.0:1.0);
}
float bayer4(vec2 p){
  vec2 q=mod(floor(p),4.0);
  return (4.0*bayer2(mod(q,2.0))+bayer2(floor(q*0.5))+0.5)/16.0;
}
void main(){
  vec2 p=gl_PointCoord*2.0-1.0;
  float angle=vSeed*6.2831853;
  vec2 q=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*p;
  vec2 uv=q*2.3+vSeed*43.0;
  float billow=noise(uv)*0.7+noise(uv*2.03)*0.3;
  // Broad lobes form a cloud silhouette; fine noise breaks up its interior.
  float radius=length(q)+(billow-0.5)*0.30;
  float envelope=1.0-smoothstep(0.48,0.98,radius);
  float coverage=clamp(envelope*(0.72+0.28*billow)*vOpacity,0.0,1.0);
  float threshold=bayer4(gl_FragCoord.xy);
  if(coverage<threshold)discard;
  // Low-contrast surviving pixels keep ordered texture without bright, opaque speckles.
  vec3 normal=normalize(vec3(p.x,-p.y,sqrt(max(0.02,1.0-dot(p,p)))));
  float diffuse=max(0.0,dot(normal,normalize(uSunDir)));
  float shade=0.22+0.20*diffuse+0.08*billow;
  vec3 light=uAmbColor*uAmbIntensity*0.64+uSunColor*uSunIntensity*shade;
  vec3 color=vColor*light;
  color=floor(color*16.0+threshold)/16.0;
  gl_FragColor=vec4(color,0.42);
}`;

export class VehicleDustField extends DustField{
  constructor(THREE,group,capacity){
    super(THREE,group,capacity);
    this.opacities=new Float32Array(capacity);
    this.points.geometry.setAttribute('aOpacity',new THREE.BufferAttribute(this.opacities,1));
    const material=this.points.material;
    material.vertexShader=VERT;material.fragmentShader=FRAG;
    material.uniforms.uViewportHeight={value:800};
    material.needsUpdate=true;
  }
  syncLighting(renderer){
    super.syncLighting(renderer);
    const gl=renderer.renderer;
    // The drawing buffer follows the active render target, including reduced-resolution rendering.
    this.points.material.uniforms.uViewportHeight.value=gl?.getRenderTarget?.()?.height||gl?.domElement?.height||800;
  }
  add(x,y,z,size,color,seed,opacity){
    if(this.count>=this.capacity)return;
    this.opacities[this.count]=opacity;
    super.add(x,y,z,size,color,seed);
  }
  end(){super.end();this.points.geometry.getAttribute('aOpacity').needsUpdate=true;}
}

export function renderVehicleDust(particles,dt,field){
  field.begin();let write=0;
  const drag=Math.exp(-1.8*dt);
  for(const p of particles){
    p.age+=dt;if(p.age>=p.life)continue;
    p.x+=p.vx*dt;p.z+=p.vz*dt;p.h+=p.vh*dt;
    p.vx*=drag;p.vz*=drag;p.vh*=Math.exp(-.7*dt);
    particles[write++]=p;
    const t=p.age/p.life;
    const fadeIn=Math.min(1,t/.06);
    const fadeOut=(1-t)*(1-t);
    field.add(p.x,p.h,p.z,p.size*(1+1.0*t),p.color,p.seed,p.opacity*fadeIn*fadeOut);
  }
  particles.length=write;field.end();
}

