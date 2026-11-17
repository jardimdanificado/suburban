// Fine dust grains lit by the actual scene sun and ambient lights. Each grain
// gets a spherical normal from its point coordinates, so shading is per-grain
// and follows day/night light changes instead of a hard-coded brightness hack.
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
  gl_PointSize=clamp(aSize*uScale/max(0.5,-mv.z),3.0,25.0);
  gl_Position=projectionMatrix*mv;
}`;
const FRAG=`
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunIntensity;
uniform vec3 uAmbColor;
uniform float uAmbIntensity;
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
  vec3 normal=normalize(vec3(p,sqrt(max(0.0,1.0-r*r))));
  float ndl=max(dot(normal,normalize(uSunDir)),0.0);
  vec3 lit=uAmbColor*uAmbIntensity+uSunColor*uSunIntensity*ndl;
  lit=floor(lit*4.0+(threshold-0.5))/4.0;
  gl_FragColor=vec4(vColor*lit,1.0);
}`;

export function rgb(hex){
  return [((hex>>16)&255)/255,((hex>>8)&255)/255,(hex&255)/255];
}

export class DustField {
  constructor(THREE,group,capacity=2048){
    this.capacity=capacity;this.count=0;this.THREE=THREE;
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
      uScale:{value:205},
      uSunDir:{value:new THREE.Vector3(.45,.85,.3).normalize()},
      uSunColor:{value:new THREE.Color(0xffffff)},uSunIntensity:{value:1.4},
      uAmbColor:{value:new THREE.Color(0xdde8f5)},uAmbIntensity:{value:.9},
    },transparent:true,depthWrite:false,depthTest:true,fog:false});
    this.points=new THREE.Points(geometry,material);
    this.points.frustumCulled=false;group.add(this.points);
  }
  syncLighting(renderer){
    const sun=renderer.sunLight,amb=renderer.ambientLight;
    if(!sun?.color||!amb?.color)return;
    const u=this.points.material.uniforms;
    u.uSunColor.value.setRGB(sun.color.r,sun.color.g,sun.color.b);
    u.uAmbColor.value.setRGB(amb.color.r,amb.color.g,amb.color.b);
    u.uSunIntensity.value=sun.intensity??1;
    u.uAmbIntensity.value=amb.intensity??1;
    const p=sun.position||{x:0,y:1,z:0},t=sun.target?.position||{x:0,y:0,z:0};
    u.uSunDir.value.set(p.x-t.x,p.y-t.y,p.z-t.z).normalize();
  }
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
