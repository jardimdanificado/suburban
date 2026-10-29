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
class Material {dispose(){}}
const THREE={Group,Mesh,BoxGeometry:Geometry,MeshLambertMaterial:Material};

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
 const bridge=renderer.skybridgeGroup.children[0],treads=bridge.children.filter(o=>o.geometry.args.length===3&&o.geometry.args[0]===.78&&o.geometry.args[1]===.09&&o.geometry.args[2]===.17);
 assert.equal(treads.length,20,'both stair flights should contain ten steps');
 assert(treads.slice(0,10).every(o=>o.xyz[0]===2.5),'the first flight must align with the pedestrian route at x0 + 0.5');
 assert(treads.slice(10).every(o=>o.xyz[0]===3.5),'the second flight must align with the pedestrian route at x1 - 0.5');
});

test('pedestrian pathfinding selects a real elevated route and marks its vertical waypoints',()=>{
 const world=new World(1,1337,256);let id=0;const city=new CitySimulation({world,population:64,seed:1337,createEntity:data=>({id:++id,destroyed:false,...data})});city.initialize();
 const route=city.findPath({x:108.5,y:129.5},{x:120.5,y:137.5});
 assert(route?.some(point=>point.skybridgeId),'the route must use the generated skybridge');
 assert(route.some(point=>point.skybridgeId&&point.z>0),'the bridge route must rise above the road');
 assert(route.some(point=>point.skybridgeId&&point.z===0),'the bridge route must descend back to the sidewalk');
 const reverse=city.findPath({x:120.5,y:137.5},{x:108.5,y:129.5});
 assert(reverse?.some(point=>point.skybridgeId),'the same bridge must be walkable in both directions');
 const c=city.citizens[0];c.entity.x=108.5;c.entity.y=129.5;c.path=route;c.task='walk';c.targetId=null;city._movingCitizens=[c];city.society.isAdult=()=>true;
 let rose=false;for(let i=0;i<300&&c.path.length;i++){city.update(.05);if(c.skybridgeZ>0)rose=true;}
 assert(rose,'the movement update must carry the pedestrian above street level');
 assert.equal(c.path.length,0,'the pedestrian must reach the ground destination');
 assert.equal(c.skybridgeZ||0,0,'the pedestrian must descend to street level');
});
