// Fine dust grains: screen-facing points, ordered dither in screen space and
// quantized radial shading. No 3D spheres, no texture-based pseudo dither.
const VERT=`
attribute float aSeed;
attribute float aSize;
attribute vec3 aColor;
uniform float uScale;
varying vec3 vColor;
varying float vSeed;
void main(){
  vColor=aColor;vSeed=aSeed;
  vec4 mv=modelViewMatrix*vec4(position,1.0);
  gl_PointSize=clamp(aSize*uScale/max(0.5,-mv.z),3.0,28.0);
  gl_Position=projectionMatrix*mv;
}`;
const FRAG=`
uniform float uDaylight;
varying vec3 vColor;
varying float vSeed;
float b2(vec2 p){float x=mod(p.x,2.0),y=mod(p.y,2.0);return y<1.0?(x<1.0?0.0:2.0):(x<1.0?3.0:1.0);}
float bayer4(vec2 p){vec2 q=floor(mod(p,4.0));return 4.0*b2(mod(q,2.0))+b2(floor(q*0.5));}
void main(){
  vec2 p=gl_PointCoord*2.0-1.0;
  float r=length(p);
  float density=(1.0-smoothstep(0.5,1.1,r))*(0.9+0.1*vSeed);
  float threshold=(bayer4(gl_FragCoord.xy)+0.5)/16.0*0.55;
  if(density<threshold)discard;
  float shade=(0.7+0.3*(1.0-r))*pow(max(0.0,uDaylight),1.25)*(0.9+0.2*vSeed);
  gl_FragColor=vec4(vColor*shade,1.0);
}`;

export function rgb(hex){
  return [((hex>>16)&255)/255,((hex>>8)&255)/255,(hex&255)/255];
}

export class DustField {
  constructor(THREE,group,capacity=2048){
    this.capacity=capacity;this.count=0;
    this.positions=new Float32Array(capacity*3);
    this.colors=new Float32Array(capacity*3);
    this.sizes=new Float32Array(capacity);
    this.seeds=new Float32Array(capacity);
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3));
    geometry.setAttribute('aColor',new THREE.BufferAttribute(this.colors,3));
    geometry.setAttribute('aSize',new THREE.BufferAttribute(this.sizes,1));
    geometry.setAttribute('aSeed',new THREE.BufferAttribute(this.seeds,1));
    const material=new THREE.ShaderMaterial({vertexShader:VERT,fragmentShader:FRAG,uniforms:{
      uDaylight:{value:1},uScale:{value:225},
    },transparent:true,depthWrite:false,depthTest:true,fog:false});
    this.points=new THREE.Points(geometry,material);
    this.points.frustumCulled=false;group.add(this.points);
  }
  setDaylight(value){this.points.material.uniforms.uDaylight.value=value;}
  begin(){this.count=0;}
  add(x,y,z,size,color,seed){
    if(this.count>=this.capacity)return;
    const i=this.count++,j=i*3;
    this.positions[j]=x;this.positions[j+1]=y;this.positions[j+2]=z;
    this.colors[j]=color[0];this.colors[j+1]=color[1];this.colors[j+2]=color[2];
    this.sizes[i]=size;this.seeds[i]=seed;
  }
  end(){
    this.points.geometry.setDrawRange(0,this.count);
    for(const name of ['position','aColor','aSize','aSeed'])this.points.geometry.getAttribute(name).needsUpdate=true;
  }
}

export function renderGrains(grains,dt,field){
  field.begin();let write=0;
  for(const grain of grains){
    grain.age+=dt;if(grain.age>=grain.life)continue;
    grain.x+=grain.vx*dt;grain.z+=grain.vz*dt;grain.h+=grain.vh*dt;
    grain.vx*=1-dt*.8;grain.vz*=1-dt*.8;grain.vh*=1-dt*.5;
    grains[write++]=grain;
    const t=grain.age/grain.life,size=grain.size*(1+t*.25)*(t>.8?1-(t-.8)/.2:1);
    field.add(grain.x,grain.h,grain.z,size,grain.color,grain.seed);
  }
  grains.length=write;field.end();
}
