import test from 'node:test';
import assert from 'node:assert/strict';
import {findTerrainPath,findSharedTerrainPath,canStep,roadTravelCost,tileHeight} from '../js/city_terrain.js';
import {TILE_FLOOR,TILE_WATER,TILE_ROAD_GRASS_STONE,TILE_SAND} from '../js/world_gen.js';
import {CitySimulation} from '../js/city_simulation.js';

function fixture(size=32){
  const world={width:size,height:size,revision:1,map:new Uint8Array(size*size).fill(TILE_FLOOR),bridgeTiles:new Map(),getTile(x,y){return this.map[y*this.width+x];}};
  return {world,occupied:new Set(),obstacleRevision:0,blocked:new Uint8Array(size*size)};
}
function route(city,start,goal){const shared=findSharedTerrainPath(city,start,goal,city.blocked);return shared===undefined?findTerrainPath(city.world,start,goal,city.occupied,{blockedGrid:city.blocked,preferRoads:false}):shared;}
function validate(city,start,path,goal){
  assert.notEqual(path,null);let previous=start;
  for(const p of path){assert.equal(Math.abs(Math.floor(p.x)-Math.floor(previous.x))+Math.abs(Math.floor(p.y)-Math.floor(previous.y)),1);assert(canStep(city.world,Math.floor(previous.x),Math.floor(previous.y),Math.floor(p.x),Math.floor(p.y)));assert(!city.blocked[Math.floor(p.y)*city.world.width+Math.floor(p.x)]);previous=p;}
  assert.deepEqual(previous,goal);
}
function cost(city,start,path){let last=start,total=0;for(const p of path){const tile=city.world.getTile(Math.floor(p.x),Math.floor(p.y));total+=roadTravelCost(tile)+Math.abs(tileHeight(tile)-tileHeight(city.world.getTile(Math.floor(last.x),Math.floor(last.y))))*.7;last=p;}return total;}

test('shared destinations preserve weighted shortest paths while expanding to new origins',()=>{
  const city=fixture();for(let x=0;x<32;x++)city.world.map[8*32+x]=TILE_ROAD_GRASS_STONE;
  for(let y=10;y<20;y++)for(let x=10;x<20;x++)city.world.map[y*32+x]=TILE_SAND;
  const goal={x:29.5,y:15.5};
  for(const start of [{x:28.5,y:15.5},{x:27.5,y:15.5},{x:26.5,y:15.5},{x:25.5,y:15.5},{x:2.5,y:2.5},{x:1.5,y:30.5}]){
    const actual=route(city,start,goal),reference=findTerrainPath(city.world,start,goal,city.occupied,{preferRoads:false});validate(city,start,actual,goal);assert(Math.abs(cost(city,start,actual)-cost(city,start,reference))<1e-8);
  }
});

test('shared destinations invalidate on obstacles and water changes',()=>{
  const city=fixture(),goal={x:25.5,y:15.5},start={x:2.5,y:15.5};
  for(let i=0;i<5;i++)validate(city,start,route(city,start,goal),goal);
  for(let y=0;y<32;y++){city.occupied.add(`16,${y}`);city.blocked[y*32+16]=1;}city.obstacleRevision++;
  for(let i=0;i<5;i++)assert.equal(route(city,start,goal),null);
  city.occupied.clear();city.blocked.fill(0);city.obstacleRevision++;
  for(let i=0;i<5;i++)validate(city,start,route(city,start,goal),goal);
  for(let y=0;y<32;y++)city.world.map[y*32+16]=TILE_WATER;city.world.revision++;
  for(let i=0;i<5;i++)assert.equal(route(city,start,goal),null);
});

test('shared paths cross road bridges over water and return separate route arrays',()=>{
  const city=fixture(),goal={x:25.5,y:15.5},start={x:2.5,y:15.5};
  for(let y=0;y<32;y++)city.world.map[y*32+16]=TILE_WATER;
  city.world.bridgeTiles.set('16,15',{height:1.1,id:1});
  for(let i=0;i<5;i++)validate(city,start,route(city,start,goal),goal);
  const first=route(city,start,goal);first.shift();validate(city,start,route(city,start,goal),goal);
});

test('simulation ground routing keeps bridge heights when using shared destinations',()=>{
  const city=Object.assign(Object.create(CitySimulation.prototype),fixture(),{citizens:[],pathCache:new Map()});
  for(let y=0;y<32;y++)city.world.map[y*32+16]=TILE_WATER;
  city.world.bridgeTiles.set('16,15',{height:1.1,id:7});
  const goal={x:25.5,y:15.5};
  for(let i=0;i<8;i++){
    const start={x:2.5,y:10.5+i},path=city.groundPath(start,goal);validate(city,start,path,goal);
    assert(path.some(p=>p.roadBridgeId===7&&p.z===1.1));
  }
});

test('one origin comparing distinct destinations shares a weighted forward search',()=>{
  const city=fixture(),start={x:2.5,y:16.5};city._pathSearchProfile={};
  for(let x=0;x<32;x++)city.world.map[8*32+x]=TILE_ROAD_GRASS_STONE;
  for(let y=10;y<20;y++)for(let x=10;x<20;x++)city.world.map[y*32+x]=TILE_SAND;
  for(let i=0;i<12;i++){
    const goal={x:25.5,y:i+2.5},actual=route(city,start,goal),reference=findTerrainPath(city.world,start,goal,city.occupied,{preferRoads:false});
    validate(city,start,actual,goal);assert(Math.abs(cost(city,start,actual)-cost(city,start,reference))<1e-8);
  }
  assert.equal(city._pathSearchProfile.sourceFields,1);
  city.blocked[16*32+3]=1;city.occupied.add('3,16');city.obstacleRevision++;
  validate(city,start,route(city,start,{x:25.5,y:4.5}),{x:25.5,y:4.5});
});

test('disconnected ground segments are rejected before an expensive search',()=>{
  const city=Object.assign(Object.create(CitySimulation.prototype),fixture(),{citizens:[],pathCache:new Map(),_pathSearchProfile:{}});
  const start={x:2.5,y:15.5},goal={x:25.5,y:15.5};
  city.buildings=[{entity:{destroyed:false},door:start},{entity:{destroyed:false},door:goal}];
  for(let y=0;y<32;y++)city.world.map[y*32+16]=TILE_WATER;
  assert.equal(city.groundPath(start,goal),null);assert.equal(city._pathSearchProfile.aStarCalls||0,0);assert.equal(city._pathSearchProfile.sharedCalls||0,0);
});
