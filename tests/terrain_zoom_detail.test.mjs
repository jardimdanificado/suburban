import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainZoomDetail} from '../js/terrain_zoom_detail.js';
import {grassRoots} from '../js/volumetric_grass.js';
import {sandShoreTileSurface} from '../js/sand_shore.js';
import {cachedShoreFoamTileSurface} from '../js/water_foam.js';
const tile=(x,z)=>[x,x*.2,z,x,x*.2,z+1,x+1,(x+1)*.2,z+1,x,x*.2,z,x+1,(x+1)*.2,z+1,x+1,(x+1)*.2,z];
test('zoom bands reduce invisible geometry and preserve full detail in close and perspective views',()=>{
 const near=terrainZoomDetail(2),mid=terrainZoomDetail(.7),far=terrainZoomDetail(.3);
 assert.equal(terrainZoomDetail(1),near);assert.equal(near.grassAxis,10);assert.ok(near.smallDetails);assert.equal(mid.grassAxis,4);assert.equal(far.grassAxis,0);
 assert.equal(terrainZoomDetail(.3,true),near);assert.equal(terrainZoomDetail(.4),far);
 assert.ok(far.beachSteps<mid.beachSteps&&mid.beachSteps<near.beachSteps);
 assert.ok(far.foamSteps<mid.foamSteps&&mid.foamSteps<near.foamSteps);
});
test('grass density falls from 100 to 16 to zero roots per tile, retaining slope and lot exclusions',()=>{
 for(const zoom of [2,.7,.3]){
   const {grassAxis}=terrainZoomDetail(zoom),options={bladesPerAxis:grassAxis},positions=[...tile(0,0),...tile(1,0)];
   const roots=grassRoots(positions,undefined,new Set(['1,0']),options).roots;
   assert.equal(roots.length/3,grassAxis*grassAxis);
   assert.deepEqual(roots,grassRoots(positions,undefined,new Set(['1,0']),options).roots);
   for(let i=0;i<roots.length;i+=3){assert.ok(roots[i]<1);assert.ok(Math.abs(roots[i+1]-(roots[i]*.2-.003))<1e-6);}
 }
});
test('coarse coast meshes use separate caches and keep the same physical shoreline',()=>{
 const w={width:12,height:12,revision:1,getTile(x,z){return x<0||z<0||x>=12||z>=12?5:z<5?3:2;}},water=(x,z)=>w.getTile(x,z)===2,sand=(x,z)=>w.getTile(x,z)===3;
 let firstBed,firstFoam;
 for(const zoom of [2,.7,.3]){
   const lod=terrainZoomDetail(zoom),bed=sandShoreTileSurface(w,4,5,{steps:lod.beachSteps});
   const foam=cachedShoreFoamTileSurface(w,4,5,water,bed,sand,{steps:lod.foamSteps});
   assert.equal(bed.positions.length/9,2*lod.beachSteps**2);assert.equal(foam.positions.length/9,2*lod.foamSteps**2);
   if(firstBed){assert.notEqual(bed,firstBed);assert.notEqual(foam,firstFoam);assert.deepEqual(bed.sample(4.5,5.5),firstBed.sample(4.5,5.5));}
   else{firstBed=bed;firstFoam=foam;}
 }
 assert.equal(sandShoreTileSurface(w,4,5),firstBed);assert.equal(cachedShoreFoamTileSurface(w,4,5,water,firstBed,sand),firstFoam);
});
