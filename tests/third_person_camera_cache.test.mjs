import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../js/renderer_3d.js',import.meta.url),'utf8');
const start=source.indexOf('  thirdPersonBuildingIndex('),end=source.indexOf('\n  getTileBaseHeight(',start);
// Keep the production collision sweep, including its exact .18 sampling steps.
const methods=source.slice(start,end);
class Vector3{constructor(x,y,z){Object.assign(this,{x,y,z});}}
const Camera=new Function('THREE','CITY_FLOOR_HEIGHT',`return class {${methods}}`)({Vector3},1.2);
test('stationary 3P reuses the exact collision result and terrain/building edits invalidate it',()=>{
 const r=new Camera(),world={revision:1,map:new Uint8Array(100)},city={structureRevision:1,buildings:[]};let reads=0;
 r.currentWorld=world;r.currentMap=world.map;r.getSurfaceElevation=()=>{reads++;return 0;};
 const target={x:5,y:1,z:5},desired={x:5,y:2,z:1};const position=r.resolveThirdPersonCamera(target,desired,city);assert.deepEqual({...position},desired);assert.ok(reads>20);
 reads=0;for(let i=0;i<100;i++)assert.equal(r.resolveThirdPersonCamera(target,desired,city),position);assert.equal(reads,0);
 for(const edit of [()=>desired.x+=.01,()=>target.x+=.01,()=>world.revision++,()=>{world.map=new Uint8Array(100);r.currentMap=world.map;},()=>city.structureRevision++]){reads=0;edit();r.resolveThirdPersonCamera(target,desired,city);assert.ok(reads>0);}
 const building={id:1,entity:{x:4,y:2},width:3,depth:2,floors:5,terrain:{base:0}};city.buildings.push(building);city.structureRevision++;
 const blocked=r.resolveThirdPersonCamera(target,desired,city);assert.ok(blocked.z>desired.z,'camera must still stop at facade');
 reads=0;const inside=r.resolveThirdPersonCamera(target,desired,city,building.id);assert.ok(reads>0);assert.deepEqual({...inside},desired);
 const otherCity={structureRevision:city.structureRevision,buildings:[{...building,entity:{x:40,y:40}}]};
 assert.deepEqual({...r.resolveThirdPersonCamera(target,desired,otherCity)},desired,'same revision in another city must not reuse the previous collision index');
});
test('worlds without revision tracking keep sampling, rather than caching potentially mutable terrain',()=>{
 const r=new Camera();let reads=0;r.currentMap={};r.getSurfaceElevation=()=>{reads++;return 0;};
 r.resolveThirdPersonCamera({x:0,y:1,z:0},{x:0,y:2,z:4});reads=0;r.resolveThirdPersonCamera({x:0,y:1,z:0},{x:0,y:2,z:4});assert.ok(reads>0);
});
