import {WATER_LEVEL,SAND_WATERLINE_HEIGHT} from '../js/water_surface.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {sandShoreTileSurface,BEACH_BED_HEIGHT,BEACH_RAMP_WIDTH,isSlopingBeachTile} from '../js/sand_shore.js';
import {terrainCornerHeight} from '../js/road_terrain_geometry.js';
import {shoreFoamTileSurface} from '../js/water_foam.js';
const world=(shore=z=>z<2)=>({width:8,height:8,revision:1,getTile(x,z){return x<0||z<0||x>=8||z>=8?5:shore(z,x)?3:2;}});
test('sandy beach joins the dry bank and descends continuously below the water',()=>{
 const w=world(),bed=sandShoreTileSurface(w,3,2);assert.ok(bed);
 assert.equal(bed.sample(3.5,2).height,(terrainCornerHeight(w,3,2)+terrainCornerHeight(w,4,2))/2);
 let previous=Infinity;
 for(let step=0;step<=20;step++){const height=bed.sample(3.5,2+step/20*BEACH_RAMP_WIDTH).height;assert.ok(height<=previous+1e-8);previous=height;}
 assert.ok(Math.abs(previous-BEACH_BED_HEIGHT)<1e-8);
 const s=bed.sample(3.5,2),wet=bed.sample(3.5,2+s.waterline);assert.ok(Math.abs(wet.height-WATER_LEVEL)<1e-8);assert.ok(s.waterline>0&&s.waterline<BEACH_RAMP_WIDTH);
 assert.ok(bed.positions.every(Number.isFinite));
});
test('neighboring beach tiles match at corners and foam follows the wet edge',()=>{
 const w=world((z,x)=>z<(x===4?3:2)),isWater=(x,z)=>w.getTile(x,z)===2,heights=new Map();
 for(let z=2;z<4;z++)for(let x=2;x<6;x++){
   const bed=sandShoreTileSurface(w,x,z);if(!bed)continue;
   for(let i=0;i<bed.positions.length;i+=3){const p=bed.positions,key=`${p[i].toFixed(6)},${p[i+2].toFixed(6)}`;if(heights.has(key))assert.ok(Math.abs(heights.get(key)-p[i+1])<1e-7);heights.set(key,p[i+1]);}
 }
 const bed=sandShoreTileSurface(w,3,2),foam=shoreFoamTileSurface(3,2,isWater,bed),old=shoreFoamTileSurface(3,2,isWater);
 assert.ok(foam.uvs.some((value,i)=>i%2===1&&value<0),'foam starts after the dry extension, at the wet edge');
 assert.ok(foam.uvs.some((value,i)=>i%2===1&&value<old.uvs[i]));
});
test('roads, rock edges and land tiles keep their existing boundary behavior',()=>{
 const w=world();assert.equal(sandShoreTileSurface(w,3,1),null);
 const rock={...w,getTile(x,z){return x===3&&z===1?4:w.getTile(x,z);}};
 assert.equal(isSlopingBeachTile(rock,3,1),false);assert.equal(isSlopingBeachTile(rock,2,1),false);
 const sidewalk={...w,hasSidewalk(x,z){return z===1;}};assert.equal(sandShoreTileSurface(sidewalk,3,2),null);
 const road={...w,getTile(x,z){return z===1?7:w.getTile(x,z);}};assert.equal(sandShoreTileSurface(road,3,2),null);
 assert.equal(w.getTile(3,2),2,'the visual ramp does not repaint water tiles');
});

test('beach descends gradually on both sides of the waterline without filling narrow channels',()=>{
 const w=world(),bed=sandShoreTileSurface(w,3,2);
 const dry=terrainCornerHeight(w,3,0),edge=terrainCornerHeight(w,3,2);
 assert.ok(dry-edge>.20&&dry-edge<.32,'the sand tile itself supplies a gentle dry approach');
 assert.ok(Math.abs(edge-SAND_WATERLINE_HEIGHT)<.005,'waterline stays low instead of preserving the old ledge');
 let previous=bed.sample(3.5,2).height;
 for(let i=1;i<=100;i++){
   const next=bed.sample(3.5,2+i/100*BEACH_RAMP_WIDTH).height;
   assert.ok((previous-next)/(BEACH_RAMP_WIDTH/100)<.14,'submerged slope stays below 8 degrees');previous=next;
 }
 const channel={...w,getTile(x,z){return x<0||z<0||x>=8||z>=8?5:z===3?2:3;}};
 assert.ok(sandShoreTileSurface(channel,3,3).sample(3.5,3.5).height<WATER_LEVEL,'one-tile streams retain open water');
});

test('foam runs onto sand and shares position, distance and normals across the tile boundary',()=>{
 const w=world(),water=(x,z)=>w.getTile(x,z)===2,sand=(x,z)=>isSlopingBeachTile(w,x,z);
 const land=shoreFoamTileSurface(3,1,water,sandShoreTileSurface(w,3,1,{profileOnly:true}),sand);
 const sea=shoreFoamTileSurface(3,2,water,sandShoreTileSurface(w,3,2),sand);
 assert.ok(land&&sea,'the moving crest must have a surface on both sides of the tile boundary');
 const edge=g=>{const values=new Map();for(let i=0;i<g.positions.length/3;i++)if(g.positions[i*3+2]===2)values.set(g.positions[i*3],[g.uvs[i*2+1],g.beachSlope[i],...g.inward.slice(i*2,i*2+2)]);return values;};
 const a=edge(land),b=edge(sea);assert.equal(a.size,b.size);
 for(const [x,values]of a)values.forEach((v,i)=>assert.ok(Math.abs(v-b.get(x)[i])<1e-8,`seam at ${x}: component ${i}`));
 assert.equal(shoreFoamTileSurface(3,1,water,null,()=>false),null,'roads and built lots must not acquire foam');
});

test('sand normal field is continuous across the dry beach and apron, independent of chunk sampling',async()=>{
 const {sandNormalField,addSandWetnessShader}=await import('../js/sand_surface_lighting.js');
 const w=world(),a=sandNormalField(w),b=sandNormalField(w);
 for(let x=2;x<5;x+=.125){
   const n=a(x,2),left=a(x,2-1e-5),right=b(x,2+1e-5);
   assert.ok(Math.abs(Math.hypot(...n)-1)<1e-8);
   assert.ok(Math.hypot(...left.map((v,i)=>v-right[i]))<1e-4);
   assert.deepEqual(n,b(x,2));
 }
 let previousHook=false;const material={onBeforeCompile(){previousHook=true;},customProgramCacheKey(){return 'normal-mapped';}};
 addSandWetnessShader(material);
 const shader={vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};material.onBeforeCompile(shader);
 assert.ok(previousHook);assert.ok(shader.fragmentShader.includes('smoothstep('));assert.ok(shader.fragmentShader.includes('sandGrain*.035'));
 assert.ok(material.customProgramCacheKey().includes('normal-mapped'));
});

test('run-up coverage follows ground height in both wave phases instead of the tile mask',()=>{
 const w=world(),water=(x,z)=>w.getTile(x,z)===2,sand=(x,z)=>isSlopingBeachTile(w,x,z);
 const profile=sandShoreTileSurface(w,3,1,{profileOnly:true});
 const foam=shoreFoamTileSurface(3,1,water,profile,sand);
 for(let i=0;i<foam.positions.length/3;i++){
   const x=foam.positions[i*3],z=foam.positions[i*3+2],sample=profile.sample(x,z);
   for(const wave of [-.035,.079]){
     const coverage=foam.uvs[i*2+1]+wave*foam.beachSlope[i];
     const expected=(WATER_LEVEL+wave-sample.groundHeight)*sample.shiftPerHeight/.68;
     assert.ok(Math.abs(coverage-expected)<1e-7,'foam distance must track the moving water/ground intersection');
   }
 }
});
