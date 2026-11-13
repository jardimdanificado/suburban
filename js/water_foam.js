import {cachedWaterGeometry} from './water_geometry_cache.js?v=terrain-revision-1';
import {WATER_LEVEL} from './water_surface.js?v=shore-runup-2';
// Shore-local distance keeps the moving foam front aligned to every coast orientation.
export const FOAM_WIDTH = .68;
// Every water tile owns one surface, even where several banks meet. Sampling
// the nearest shoreline merges intersecting wave fronts without layered strips.
export function cachedShoreFoamTileSurface(world,tx,ty,isWaterAt,beach=null,isBeachAt=null,{steps=8}={}){
  const allowed=!!isBeachAt?.(tx,ty);
  return cachedWaterGeometry(world,'foam',`${tx},${ty}:${allowed?1:0}:${beach?1:0}:${steps}`,()=>shoreFoamTileSurface(tx,ty,isWaterAt,beach,isBeachAt,{steps}));
}
export function shoreFoamTileSurface(tx,ty,isWaterAt,beach=null,isBeachAt=null,{steps=8}={}){
  const water=isWaterAt(tx,ty);
  if(!water&&!isBeachAt?.(tx,ty))return null;
  const segments=[];
  for(let z=ty-2;z<=ty+2;z++)for(let x=tx-2;x<=tx+2;x++){
    if(!isWaterAt(x,z))continue;
    if(!isWaterAt(x,z-1))segments.push([x,z,x+1,z,0,1]);
    if(!isWaterAt(x,z+1))segments.push([x,z+1,x+1,z+1,0,-1]);
    if(!isWaterAt(x-1,z))segments.push([x,z,x,z+1,1,0]);
    if(!isWaterAt(x+1,z))segments.push([x+1,z,x+1,z+1,-1,0]);
  }
  if(!segments.length)return null;
  // Concentrate the existing vertices near banks, where the narrow raised
  // crest needs support. Symmetric coordinates still match neighboring tiles.
  const grid=[],coordinates=steps===8?[0,.04,.10,.22,.5,.78,.90,.96,1]:steps===4?[0,.10,.5,.90,1]:[0,.5,1];
  for(let z=0;z<=steps;z++)for(let x=0;x<=steps;x++){
    const px=tx+coordinates[x],pz=ty+coordinates[z];
    let best=Infinity,nx=0,nz=0;
    for(const [ax,az,bx,bz,ix,iz]of segments){
      const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((px-ax)*dx+(pz-az)*dz)/(dx*dx+dz*dz)));
      const vx=px-ax-dx*t,vz=pz-az-dz*t,distance=Math.hypot(vx,vz);
      const gx=distance>1e-8?vx/distance:ix,gz=distance>1e-8?vz/distance:iz;
      if(distance<best-1e-8){best=distance;nx=gx;nz=gz;}
      else if(Math.abs(distance-best)<1e-8){nx+=gx;nz+=gz;}
    }
    const length=Math.hypot(nx,nz)||1,normalSign=water||best<1e-8?1:-1;
    const sand=beach?.sample(px,pz);
    const blend=sand?Math.max(0,1-Math.max(0,sand.distance-best)/.30):0;
    const weight=blend*blend*(3-2*blend);
    const shoreDistance=(water?best:-best)/FOAM_WIDTH;
    const beachDistance=sand?(WATER_LEVEL-sand.groundHeight)*sand.shiftPerHeight/FOAM_WIDTH:shoreDistance;
    grid.push({x:px,z:pz,d:shoreDistance+(beachDistance-shoreDistance)*weight,nx:normalSign*nx/length,nz:normalSign*nz/length,slope:sand?sand.shiftPerHeight*weight/FOAM_WIDTH:0});
  }
  if(grid.every(p=>p.d>1.0)||grid.every(p=>p.d< -1.5))return null;
  const positions=[],uvs=[],inward=[],beachSlope=[];
  for(let z=0;z<steps;z++)for(let x=0;x<steps;x++){
    const a=z*(steps+1)+x,b=a+steps+1;
    for(const index of [a,b,b+1,a,b+1,a+1]){
      const p=grid[index];positions.push(p.x,WATER_LEVEL+.01,p.z);uvs.push(p.x,p.d);inward.push(p.nx,p.nz);beachSlope.push(p.slope);
    }
  }
  return {positions,uvs,inward,beachSlope};
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
  vec2 foamThickness(vec2 p){
    float width=.11+.23*foamNoise(p*1.13+vec2(17.0,43.0));
    float height=.08+.07*foamNoise(p*1.67+vec2(31.0,7.0));
    return vec2(width,height);
  }
  float foamLift(vec2 p,float d){
    vec2 thickness=foamThickness(p);
    float crest=1.0-smoothstep(.0,thickness.x,abs(d-foamFront(p)));
    return crest*crest*thickness.y+sin(d*16.0-uCaribbeanWaterTime*1.6)*.010*sin(d*3.14159);
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
      attribute float foamBeachSlope;
      varying vec2 vFoamUV; varying vec2 vFoamWorld;
      ${FOAM_FIELD}`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
      vFoamUV=uv; vFoamWorld=position.xz;`)
      .replace('#include <project_vertex>',`
      // The beach's wet line moves with the existing water waves and bob.
      float foamWaveHeight=transformed.y-position.y+sin(uCaribbeanWaterTime*2.8)*.005;
      float foamDistance=uv.y+foamWaveHeight*foamBeachSlope;
      vFoamUV.y=foamDistance;
      transformed.y += foamLift(position.xz,foamDistance);
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
      float width=foamThickness(vFoamWorld).x;
      float crest=1.0-smoothstep(width*.22,width,abs(d-front));
      float wash=(1.0-smoothstep(.0,front+.10,d))*.54;
      float backwash=(1.0-smoothstep(.02,.10,abs(d-front*.42)))*.22;
      float bubbles=smoothstep(.25,.68,foamNoise(vFoamWorld*38.0));
      diffuseColor.rgb *= mix(vec3(.70,.87,.86),vec3(1.07,1.07,1.03),crest);
      diffuseColor.a *= min(1.0,crest*1.05+wash+backwash)*(.65+.35*bubbles)*smoothstep(0.0,.010,d)*(1.0-smoothstep(.86,1.0,d));
      if(diffuseColor.a<.025)discard;`);
  };
  material.customProgramCacheKey=()=> 'shore-foam-beach-runup-v9';
  return material;
}
