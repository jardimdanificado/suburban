import {cachedWaterGeometry} from './water_geometry_cache.js?v=terrain-revision-1';
import {TILE_WATER} from './world_gen.js';
import {WATER_LEVEL} from './water_surface.js?v=shore-runup-2';
import {terrainSurfaceElevation} from './road_terrain_geometry.js?v=low-water-shore-4';
import {sandShoreTileSurface} from './sand_shore.js?v=zoom-coast-7';

// Derive one normal field from world heights, independent of triangle density,
// material buckets and chunk boundaries. Dry sand and the apron share it.
export function sandNormalField(world){
  return cachedWaterGeometry(world,'sand-normals','field',()=>createSandNormalField(world));
}
function createSandNormalField(world){
  const profiles=new Map(),corners=new Map(),normals=new Map();
  const height=(x,z)=>{
    const tx=Math.floor(x),tz=Math.floor(z),key=`${tx},${tz}`;
    if(!profiles.has(key)&&profiles.size>=2048)profiles.delete(profiles.keys().next().value);
    if(!profiles.has(key))profiles.set(key,world.getTile(tx,tz)===TILE_WATER?sandShoreTileSurface(world,tx,tz,{profileOnly:true}):null);
    return profiles.get(key)?.sample(x,z).height??terrainSurfaceElevation(world,x,z);
  };
  const corner=(x,z)=>{
    const key=`${x},${z}`;if(corners.has(key))return corners.get(key);
    const dx=(height(x+1,z)-height(x-1,z))*.5,dz=(height(x,z+1)-height(x,z-1))*.5,length=Math.hypot(dx,1,dz);
    const n=[-dx/length,1/length,-dz/length];if(corners.size>=4096)corners.delete(corners.keys().next().value);corners.set(key,n);return n;
  };
  return (x,z)=>{
    const key=`${x},${z}`;if(normals.has(key))return normals.get(key);
    const tx=Math.floor(x),tz=Math.floor(z),u=x-tx,v=z-tz;
    const a=corner(tx,tz),b=corner(tx+1,tz),c=corner(tx+1,tz+1),d=corner(tx,tz+1);
    const n=a.map((value,i)=>value*(1-u)*(1-v)+b[i]*u*(1-v)+c[i]*u*v+d[i]*(1-u)*v),length=Math.hypot(...n);
    const result=n.map(value=>value/length);if(normals.size>=16384)normals.delete(normals.keys().next().value);normals.set(key,result);return result;
  };
}
export function applySandSurfaceNormals(geometry,normalAt){
  const positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal');
  for(let i=0;i<positions.count;i++){
    if(normals.getY(i)<.35)continue;
    const n=normalAt(positions.getX(i),positions.getZ(i));normals.setXYZ(i,...n);
  }
  normals.needsUpdate=true;
}
export function addSandWetnessShader(material){
  const compile=material.onBeforeCompile,key=material.customProgramCacheKey?.()||'';
  material.onBeforeCompile=shader=>{
    compile?.call(material,shader);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vSandWorld;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvSandWorld=(modelMatrix*vec4(position,1.0)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vSandWorld;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        float sandGrain=fract(sin(dot(floor(vSandWorld.xz*48.0),vec2(127.1,311.7)))*43758.5453)-.5;
        float drySand=smoothstep(${WATER_LEVEL.toFixed(3)},${(WATER_LEVEL+.35).toFixed(3)},vSandWorld.y+sandGrain*.035);
        diffuseColor.rgb*=mix(.78,1.0,drySand);`);
  };
  material.customProgramCacheKey=()=>`${key}|continuous-sand-wetness-v1`;
}
