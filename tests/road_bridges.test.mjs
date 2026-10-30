import test from 'node:test';
import assert from 'node:assert/strict';
import {CityDevelopment} from '../js/city_development.js';
import {terrainWalkable,findTerrainPath} from '../js/city_terrain.js';
import {TILE_FLOOR,TILE_WATER,TILE_ROAD_GRASS} from '../js/world_gen.js';
import {syncRoadBridges} from '../js/city_renderer_3d.js';

function fixture(){
 const size=64,map=new Uint8Array(size*size).fill(TILE_FLOOR);
 for(let y=0;y<size;y++)for(const x of [30,31])map[y*size+x]=TILE_WATER;
 map[30*size+28]=TILE_ROAD_GRASS;
 const world={width:size,height:size,revision:1,map,bridgeTiles:new Map(),getTile(x,y){return map[y*size+x];}};
 const hall={id:1,door:{x:28.5,y:30.5},entity:{}},target={id:2,door:{x:35.5,y:30.5},entity:{}};
 const city={world,occupied:new Set(),currency:{price:n=>n},economy:{goods:{pedra:{price:1}}},buildings:[hall,target],traffic:new Map(),treasury:1e9,accounts:new Map(),walkable:(x,y)=>terrainWalkable(world,x,y),trafficScore:()=>0,transfer:()=>true};
 const dev=Object.assign(Object.create(CityDevelopment.prototype),{city,projects:[],roadAccessTiles:()=>new Set(),roadPlotBlocked:()=>false,selectBuilder:()=>({id:10}),registerService:(account,builder,spec)=>{const p={id:1,...spec};dev.projects.push(p);return p;},beginRoad:()=>null});
 return {city,world,dev,hall,target};
}
test('municipal planning proposes a real water bridge when no land route connects the banks',()=>{
 const {city,world,dev,hall,target}=fixture();assert.equal(findTerrainPath(world,hall.door,target.door,city.occupied),null);
 dev.planRoadNetwork(hall,{reserve:0});const bridge=dev.projects.find(p=>p.service==='bridge');assert(bridge);
 assert.equal(bridge.path.length,2);assert.deepEqual(bridge.bridgeStart,{x:29,y:30});assert.deepEqual(bridge.bridgeEnd,{x:32,y:30});assert(bridge.materialAccountId);
});
test('bridges reject endpoints outside the map and accept a valid bank-to-bank span',()=>{
 const {dev}=fixture();assert.equal(dev.beginBridge('treasury',{x:-1,y:30},{x:32,y:30}),null);
 assert.equal(dev.beginBridge('treasury',{x:29,y:30},{x:64,y:30}),null);
 assert(dev.beginBridge('treasury',{x:29,y:30},{x:32,y:30}));
});
class Group{constructor(){this.children=[];}add(m){this.children.push(m);}traverse(fn){for(const c of this.children)fn(c);}}
class Mesh{constructor(geometry,material){Object.assign(this,{geometry,material,position:{set:(...p)=>this.xyz=p}});}}
class Geometry{constructor(...args){this.args=args;}dispose(){}}
class Material{dispose(){}}
const THREE={Group,Mesh,BoxGeometry:Geometry,MeshLambertMaterial:Material};
test('bridge decks use the absolute walkable height and never draw out-of-map tiles',()=>{
 const {world}=fixture();world.roadBridges=[{axis:'x',height:.8,tiles:[{x:30,y:30},{x:31,y:30},{x:-1,y:30}]}];
 const renderer={scene:{add(){},remove(){}}};syncRoadBridges(renderer,THREE,world);
 const decks=renderer.roadBridgeGroup.children.filter(m=>m.geometry.args[1]===.2);assert.equal(decks.length,2);
 for(const deck of decks)assert(Math.abs(deck.xyz[1]+.1-.8)<1e-9);
 assert(renderer.roadBridgeGroup.children.every(m=>m.xyz[0]>=0&&m.xyz[0]<world.width));
});
