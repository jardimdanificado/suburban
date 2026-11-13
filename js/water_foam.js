// Shore-local distance keeps the moving foam front aligned to every coast orientation.
export const FOAM_WIDTH = .68;
// Every water tile owns one surface, even where several banks meet. Sampling
// the nearest shoreline merges intersecting wave fronts without layered strips.
export function shoreFoamTileSurface(tx,ty,isWaterAt){
  if(!isWaterAt(tx,ty))return null;
  const segments=[];
  for(let z=ty-1;z<=ty+1;z++)for(let x=tx-1;x<=tx+1;x++){
    if(!isWaterAt(x,z))continue;
    if(!isWaterAt(x,z-1))segments.push([x,z,x+1,z,0,1]);
    if(!isWaterAt(x,z+1))segments.push([x,z+1,x+1,z+1,0,-1]);
    if(!isWaterAt(x-1,z))segments.push([x,z,x,z+1,1,0]);
    if(!isWaterAt(x+1,z))segments.push([x+1,z,x+1,z+1,-1,0]);
  }
  if(!segments.length)return null;
  const grid=[],steps=8;
  for(let z=0;z<=steps;z++)for(let x=0;x<=steps;x++){
    const px=tx+x/steps,pz=ty+z/steps;
    let best=Infinity,nx=0,nz=0;
    for(const [ax,az,bx,bz,ix,iz]of segments){
      const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((px-ax)*dx+(pz-az)*dz)/(dx*dx+dz*dz)));
      const vx=px-ax-dx*t,vz=pz-az-dz*t,distance=Math.hypot(vx,vz);
      const gx=distance>1e-8?vx/distance:ix,gz=distance>1e-8?vz/distance:iz;
      if(distance<best-1e-8){best=distance;nx=gx;nz=gz;}
      else if(Math.abs(distance-best)<1e-8){nx+=gx;nz+=gz;}
    }
    const length=Math.hypot(nx,nz)||1;
    grid.push({x:px,z:pz,d:best/FOAM_WIDTH,nx:nx/length,nz:nz/length});
  }
  if(grid.every(p=>p.d>1.0))return null;
  const positions=[],uvs=[],inward=[];
  for(let z=0;z<steps;z++)for(let x=0;x<steps;x++){
    const a=z*(steps+1)+x,b=a+steps+1;
    for(const index of [a,b,b+1,a,b+1,a+1]){
      const p=grid[index];positions.push(p.x,.09,p.z);uvs.push(p.x,p.d);inward.push(p.nx,p.nz);
    }
  }
  return {positions,uvs,inward};
}
// Straight-bank fixture and standalone callers use the same merged geometry.
export function shoreFoamSurface(tx,ty,side){
  return shoreFoamTileSurface(tx,ty,(x,z)=>side===0?z>=ty:side===1?z<=ty:side===2?x>=tx:x<=tx);
}
const FOAM_FIELD=`
  float foamHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float foamNoise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(foamHash(i),foamHash(i+vec2(1,0)),f.x),mix(foamHash(i+vec2(0,1)),foamHash(i+vec2(1,1)),f.x),f.y);
  }
  float foamFront(vec2 p){float section=foamNoise(p*.83);
    float reach=.07+section*.22;
    return reach+.055*sin(uCaribbeanWaterTime*.95+foamNoise(p*.42)*5.0)+(foamNoise(p*6.0)-.5)*.045;}
  float foamLift(vec2 p,float d){
    float crest=1.0-smoothstep(.0,.25,abs(d-foamFront(p)));
    return crest*crest*.10+sin(d*16.0-uCaribbeanWaterTime*1.6)*.010*sin(d*3.14159);
  }
`;
export function addShoreFoamShader(material){
  const compile=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
    compile(shader);
    shader.vertexShader=shader.vertexShader.replace('uniform float uCaribbeanWaterTime;','');
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      uniform float uCaribbeanWaterTime;
      attribute vec2 foamInward;
      varying vec2 vFoamUV; varying vec2 vFoamWorld;
      ${FOAM_FIELD}`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
      vFoamUV=uv; vFoamWorld=position.xz;`)
      .replace('#include <project_vertex>',`
      transformed.y += foamLift(position.xz,uv.y);
      #include <project_vertex>`)
      .replace('#include <defaultnormal_vertex>',`
      float slope=(foamLift(position.xz+foamInward*.015,uv.y+.022)-foamLift(position.xz-foamInward*.015,uv.y-.022))/.03;
      objectNormal=normalize(objectNormal+vec3(-foamInward.x*slope,0.0,-foamInward.y*slope));
      #include <defaultnormal_vertex>`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      uniform float uCaribbeanWaterTime;
      varying vec2 vFoamUV; varying vec2 vFoamWorld;
      ${FOAM_FIELD}`)
      .replace('#include <color_fragment>',`#include <color_fragment>
      float d=vFoamUV.y,front=foamFront(vFoamWorld);
      float crest=1.0-smoothstep(.035,.18,abs(d-front));
      float wash=(1.0-smoothstep(.0,front+.10,d))*.54;
      float backwash=(1.0-smoothstep(.02,.10,abs(d-front*.42)))*.22;
      float bubbles=smoothstep(.25,.68,foamNoise(vFoamWorld*38.0));
      diffuseColor.rgb *= mix(vec3(.70,.87,.86),vec3(1.07,1.07,1.03),crest);
      diffuseColor.a *= min(1.0,crest*1.05+wash+backwash)*(.65+.35*bubbles)*smoothstep(0.0,.010,d)*(1.0-smoothstep(.86,1.0,d));
      if(diffuseColor.a<.025)discard;`);
  };
  material.customProgramCacheKey=()=> 'shore-foam-near-bank-v5';
  return material;
}
