import test from 'node:test';
import assert from 'node:assert/strict';
import {syncSkybridges} from '../js/city_skybridges.js';
import {CitySimulation} from '../js/city_simulation.js';
import {World} from '../js/world.js';
import {TILE_ROAD_GRASS} from '../js/world_gen.js';
import {buildingEntrance,buildingEntranceDoor} from '../js/city_building_geometry.js';
class Group {constructor(){this.children=[];this.userData={};this.visible=true;}add(o){this.children.push(o);}traverse(f){f(this);for(const o of this.children)o.traverse?.(f);}}
class Mesh {constructor(geometry,material){this.geometry=geometry;this.material=material;this.position={set:(...xyz)=>this.xyz=xyz};}traverse(f){f(this);}}
class Geometry {constructor(...args){this.args=args;}dispose(){}}
class Material {constructor(options={}){this.options=options;}dispose(){}}
class Matrix4 {makeTranslation(...xyz){this.xyz=xyz;return this;}}
class InstancedMesh extends Mesh {constructor(geometry,material,count){super(geometry,material);this.count=count;this.transforms=[];this.instanceMatrix={needsUpdate:false};}setMatrixAt(index,matrix){this.transforms[index]=matrix.xyz;}}
const THREE={Group,Mesh,InstancedMesh,Matrix4,BoxGeometry:Geometry,MeshLambertMaterial:Material};

test('the ground-floor entrance opens the correct exterior wall for every building rotation',()=>{
 for(let rotation=0;rotation<4;rotation++){
  const entity={x:10,y:20},width=3,depth=2,units=[];for(let y=0;y<depth;y++)for(let x=0;x<width;x++)units.push({id:`${x}:${y}`,x,y,z:0});
  const building={entity,width,depth,rotation,door:buildingEntrance(entity.x,entity.y,width,depth,rotation),units};
  const opening=buildingEntranceDoor(building),expectedBit=[2,8,1,4][rotation];
  assert(opening,'the exterior entry must map to a ground-floor wall cell');assert.equal(opening.bit,expectedBit,`rotation ${rotation} must cut the facade facing the entrance`);
 }
});

test('each skybridge has openings on the second floor of both buildings',()=>{
 const a={id:1,entity:{x:0,y:0},width:2,depth:2,floors:2,constructionKind:'building',terrain:{base:0},units:[{id:'a',x:1,y:1,z:1,roomType:'workspace'}]};
 const b={id:2,entity:{x:4,y:0},width:2,depth:2,floors:2,constructionKind:'building',terrain:{base:0},units:[{id:'b',x:0,y:1,z:1,roomType:'bedroom'}]};
 const entities=[a,b].map(cityBuilding=>({properties:{cityBuilding}}));
 const renderer={cityDevelopment:{city:{structureRevision:1}},scene:{add(){},remove(){}}};
 const world={revision:1,getTile(x,y){return x===2&&y===1?TILE_ROAD_GRASS:0;}};
 syncSkybridges(renderer,THREE,entities,world);
 assert.equal(renderer.skybridgeDoors.get(1).get('a'),8);assert.equal(renderer.skybridgeDoors.get(2).get('b'),4);
 assert.equal(renderer.skybridgeGroup.children.length,1);
 const bridge=renderer.skybridgeGroup.children[0],parts=[];bridge.traverse(o=>parts.push(o));const deck=parts.find(o=>o.geometry?.args?.[1]===.14),rails=parts.filter(o=>o.geometry?.args?.[1]===.075),posts=parts.find(o=>o instanceof InstancedMesh);
 assert(deck,'the link has a visible elevated deck');assert.equal(deck.xyz[1],1.8-.07);assert.equal(rails.length,2,'both exposed sides receive a guardrail');
 assert(posts.count>=4,'both guardrails receive supports along their span');assert.equal(posts.transforms.length,posts.count);assert(posts.transforms.every(([,y])=>y===1.8-.07+.33));
});

test('pedestrian pathfinding keeps the shorter street route when a skybridge is unnecessary',()=>{
 const world=new World(1,1337,256);let id=0;const city=new CitySimulation({world,population:64,seed:1337,createEntity:data=>({id:++id,destroyed:false,...data})});city.initialize();
 const route=city.findPath({x:108.5,y:129.5},{x:120.5,y:137.5});
 assert(route?.length,'the route must reach the destination');
 assert(!route.some(point=>point.skybridgeId),'a longer detour through the generated bridge must not replace a shorter street route');
 const reverse=city.findPath({x:120.5,y:137.5},{x:108.5,y:129.5});
 assert(reverse?.length,'the reverse street route must also reach its destination');
 assert(!reverse.some(point=>point.skybridgeId),'the reverse route must also avoid the unnecessary detour');
});
