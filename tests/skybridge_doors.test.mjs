import test from 'node:test';
import assert from 'node:assert/strict';
import {syncSkybridges} from '../js/city_skybridges.js';
import {TILE_ROAD_GRASS} from '../js/world_gen.js';
class Group {constructor(){this.children=[];this.userData={};this.visible=true;}add(o){this.children.push(o);}traverse(f){f(this);for(const o of this.children)o.traverse?.(f);}}
class Mesh {constructor(geometry,material){this.geometry=geometry;this.material=material;this.position={set:(...xyz)=>this.xyz=xyz};}traverse(f){f(this);}}
class Geometry {constructor(...args){this.args=args;}dispose(){}}
class Material {dispose(){}}
const THREE={Group,Mesh,BoxGeometry:Geometry,MeshLambertMaterial:Material};

test('each skybridge has openings on the second floor of both buildings',()=>{
 const a={id:1,entity:{x:0,y:0},width:2,depth:2,floors:2,constructionKind:'building',terrain:{base:0},units:[{id:'a',x:1,y:1,z:1,roomType:'workspace'}]};
 const b={id:2,entity:{x:4,y:0},width:2,depth:2,floors:2,constructionKind:'building',terrain:{base:0},units:[{id:'b',x:0,y:1,z:1,roomType:'bedroom'}]};
 const entities=[a,b].map(cityBuilding=>({properties:{cityBuilding}}));
 const renderer={cityDevelopment:{city:{structureRevision:1}},scene:{add(){},remove(){}}};
 const world={revision:1,getTile(x,y){return x===2&&y===1?TILE_ROAD_GRASS:0;}};
 syncSkybridges(renderer,THREE,entities,world);
 assert.equal(renderer.skybridgeDoors.get(1).get('a'),8);assert.equal(renderer.skybridgeDoors.get(2).get('b'),4);
 assert.equal(renderer.skybridgeGroup.children.length,1);
});
