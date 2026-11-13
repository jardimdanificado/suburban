import test from 'node:test';
import assert from 'node:assert/strict';
import {grassRoots,createVolumetricGrassMaterial} from '../js/volumetric_grass.js';
import {grassDetailInstances,grassDetailSurface} from '../js/grass_details.js';
import {shoreFoamSurface,shoreFoamTileSurface,FOAM_WIDTH} from '../js/water_foam.js';
import {floweringShrubSurfaceTextures} from '../js/flowering_shrub_surface.js';
const tile=(x,z)=>[x,x*.1,z,x,x*.1,z+1,x+1,(x+1)*.1,z+1,x,x*.1,z,x+1,(x+1)*.1,z+1,x+1,(x+1)*.1,z];
test('meadow details stay sparse, rooted, deterministic and absent from excluded lots',()=>{
  const surface=[];for(let x=0;x<12;x++)for(let z=0;z<12;z++)surface.push(...tile(x,z));
  const grass=grassRoots(surface,undefined,new Set(['2,3','8,9'])),details=grassDetailInstances(grass.roots,grass.shades);
  assert.deepEqual(details,grassDetailInstances(grass.roots,grass.shades));
  const count=details.roots.length/3;assert.ok(count>0&&count<15,`${count} details for 142 tiles`);
  const source=new Set(Array.from({length:grass.roots.length/3},(_,i)=>Array.from(grass.roots.slice(i*3,i*3+3)).join(',')));
  for(let i=0;i<details.roots.length;i+=3){
    assert.ok(source.has(Array.from(details.roots.slice(i,i+3)).join(',')));
    assert.ok(!['2,3','8,9'].includes(`${Math.floor(details.roots[i])},${Math.floor(details.roots[i+2])}`));
  }
  const half=Math.floor(grass.roots.length/6)*3;
  const a=grassDetailInstances(grass.roots.slice(0,half),grass.shades.slice(0,half/3));
  const b=grassDetailInstances(grass.roots.slice(half),grass.shades.slice(half/3));
  assert.deepEqual(details.roots,new Float32Array([...a.roots,...b.roots]));
  assert.ok(grassDetailSurface().length/9<=16);
});
test('detail material keeps contact removal and the canopy tick cadence',()=>{
  class Material{constructor(options){Object.assign(this,options);}}
  const tick={value:0},tracks={terrainTrackTime:{value:0}};
  const material=createVolumetricGrassMaterial({MeshStandardMaterial:Material,DoubleSide:2},null,tick,tracks,{details:true});
  const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.grassSimTick,tick);assert.equal(shader.uniforms.terrainTrackTime,tracks.terrainTrackTime);
  assert.equal((shader.vertexShader.match(/varying vec3 vDetailColor;/g)||[]).length,1);
  assert.ok(shader.vertexShader.includes('terrainTrackStrength(grassRoot.xz'));
  assert.ok(shader.fragmentShader.includes('discard'));assert.ok(shader.fragmentShader.includes('vDetailColor * vBladeShade'));
});
test('foam has cross-shore geometry for raised crests and upward faces on every coast',()=>{
  assert.ok(FOAM_WIDTH>.6);
  for(let side=0;side<4;side++){
    const g=shoreFoamSurface(2,3,side);assert.equal(g.positions.length/9,128);
    assert.equal(g.uvs.length,g.positions.length/3*2);assert.equal(g.inward.length,g.uvs.length);
    assert.ok(new Set(g.uvs.filter((_,i)=>i%2===1)).size>=7);
    for(let i=0;i<g.positions.length;i+=9){const p=g.positions;const up=(p[i+5]-p[i+2])*(p[i+6]-p[i])-(p[i+3]-p[i])*(p[i+8]-p[i+2]);assert.ok(up>0);}
    for(let i=0;i<g.positions.length;i+=3){assert.ok(g.positions[i]>=2&&g.positions[i]<=3);assert.ok(g.positions[i+2]>=3&&g.positions[i+2]<=4);}
  }
});
test('leaf and bract surfaces contain color detail and normalized non-flat normal maps',()=>{
  class Texture{constructor(data,width,height){this.image={data,width,height};}}
  const T={DataTexture:Texture,RGBAFormat:1,RepeatWrapping:2,NearestFilter:3,LinearMipmapLinearFilter:4,SRGBColorSpace:'srgb'};
  const leaf=floweringShrubSurfaceTextures(T),bract=floweringShrubSurfaceTextures(T,true);
  assert.notDeepEqual(leaf.map.image.data,bract.map.image.data);
  for(const surface of [leaf,bract]){
    assert.equal(surface.map.colorSpace,'srgb');assert.equal(surface.normalMap.colorSpace,undefined);
    assert.ok(new Set(surface.map.image.data).size>20);
    const data=surface.normalMap.image.data;let tilted=0;
    for(let i=0;i<data.length;i+=4){const n=Array.from(data.slice(i,i+3),v=>v/255*2-1);assert.ok(Math.abs(Math.hypot(...n)-1)<.02);if(Math.abs(n[0])>.02||Math.abs(n[1])>.02)tilted++;}
    assert.ok(tilted>500);assert.equal(surface.map.magFilter,T.NearestFilter);
  }
});

test('foam corners cover water only once and share a continuous field between tiles',()=>{
  const isWater=(x,z)=>z>=2+(x===3||x===5?1:0)&&!(x===1&&z===3);
  const surfaces=new Map();
  for(let z=2;z<5;z++)for(let x=0;x<7;x++){
    const g=shoreFoamTileSurface(x,z,isWater);if(!g)continue;
    let area=0;
    for(let i=0;i<g.positions.length;i+=9){const p=g.positions;area+=((p[i+5]-p[i+2])*(p[i+6]-p[i])-(p[i+3]-p[i])*(p[i+8]-p[i+2]))/2;}
    assert.ok(Math.abs(area-1)<1e-8,'one surface per water tile, never overlapping shore strips');
    for(let i=0;i<g.positions.length;i+=3){
      const key=`${g.positions[i]},${g.positions[i+2]}`,d=g.uvs[i/3*2+1];
      if(surfaces.has(key))assert.ok(Math.abs(surfaces.get(key)-d)<1e-8,`shore distance must match at ${key}`);
      surfaces.set(key,d);
    }
  }
  assert.equal(shoreFoamTileSurface(1,3,isWater),null,'land has no foam surface');
  assert.equal(shoreFoamTileSurface(20,20,()=>true),null,'open water needs no extra geometry');
});

test('shells are rare, stable, follow sandy slopes and stay outside excluded cells',async()=>{
  const {beachShellInstances,beachShellSurface}=await import('../js/beach_shells.js');
  const surface=[];for(let x=0;x<30;x++)for(let z=0;z<30;z++)surface.push(...tile(x,z));
  const shells=beachShellInstances(surface);
  assert.ok(shells.length>10&&shells.length<100,`${shells.length} shells in 900 tiles`);
  assert.deepEqual(shells,beachShellInstances(surface));
  for(const s of shells){assert.ok(Math.abs(s.y-(s.x*.1+.009))<1e-6);assert.ok(s.size>=.065&&s.size<=.105);}
  const excluded=new Set(shells.map(s=>`${Math.floor(s.x)},${Math.floor(s.z)}`));
  assert.deepEqual(beachShellInstances(surface,excluded),[]);
  const geometry=beachShellSurface();assert.equal(geometry.positions.length/9,14);assert.equal(geometry.colors.length,geometry.positions.length);
  for(let i=0;i<geometry.positions.length;i+=9){const p=geometry.positions;assert.ok((p[i+5]-p[i+2])*(p[i+6]-p[i])-(p[i+3]-p[i])*(p[i+8]-p[i+2])>0);}
});
