import test from 'node:test';
import assert from 'node:assert/strict';
import {cultivateFarmTerrain,farmSurfaceTile} from '../js/city_farm_ground.js';
import {FARM_TILES,baseTerrainTile} from '../js/world_gen.js';
test('the entire farm footprint gets soil, even cells without a workstation',()=>{
 const data=new Uint8Array([0,3,9,6,0,0,0,0,0,0,0,0]),world={getTile:(x,y)=>data[y*4+x],setTile:(x,y,v)=>data[y*4+x]=v};
 const farm={type:'farm',entity:{x:0,y:0},width:3,depth:2,units:[]};cultivateFarmTerrain({world},farm);
 for(const i of [0,1,2,4,5,6])assert.ok(FARM_TILES.has(data[i]));
 assert.equal(baseTerrainTile(data[0]),0);assert.equal(baseTerrainTile(data[1]),3);assert.equal(baseTerrainTile(data[2]),9);
 assert.equal(data[3],6);assert.equal(data[7],0);assert.equal(farm.farmSoilReady,true);
});
test('old farms render soil on natural terrain without repainting roads or water',()=>{
 for(const tile of [0,3,9,4,1,10])assert.ok(FARM_TILES.has(farmSurfaceTile(tile,true)));
 for(const tile of [2,5,6,7,8,11,12,13])assert.equal(farmSurfaceTile(tile,true),tile);
 assert.equal(farmSurfaceTile(0,false),0);
});
