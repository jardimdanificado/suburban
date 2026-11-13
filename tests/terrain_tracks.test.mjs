import test from 'node:test';
import assert from 'node:assert/strict';
import {TerrainTrackMotion,SandCarry,VEHICLE_CONTACTS,trackStrength,GRASS_TRACK_HOLD,GRASS_TRACK_LIFE,SAND_TRACK_HOLD,SAND_TRACK_LIFE,addSandTracksToMaterial} from '../js/terrain_tracks.js';
import {createVolumetricGrassMaterial} from '../js/volumetric_grass.js';

test('footprints alternate left/right at fixed stride without depending on frame rate',()=>{
  const walk=steps=>{const motion=new TerrainTrackMotion(),entity={},stamps=[];motion.move(entity,{x:5,z:0},0);for(let i=1;i<=steps;i++)stamps.push(...motion.move(entity,{x:5,z:i/steps},i/steps));return stamps;};
  const a=walk(4),b=walk(60);assert.equal(a.length,4);assert.equal(b.length,4);
  a.forEach((s,i)=>{assert.ok(Math.abs(s.x-b[i].x)<1e-8);assert.ok(Math.abs(s.z-b[i].z)<1e-8);assert.equal(s.width,.1);assert.equal(s.length,.22);});
  assert.deepEqual(a.map(s=>s.kind),[-1,1,-1,1]);assert.equal(a[0].x,4.925);assert.equal(a[1].x,5.075);
});
test('stationary entities, teleports and boarding never paint connecting lines',()=>{
  const motion=new TerrainTrackMotion(),entity={};motion.move(entity,{x:0,z:0},0);
  assert.deepEqual(motion.move(entity,{x:0,z:0},.1),[]);
  assert.deepEqual(motion.move(entity,{x:40,z:0},.2),[]);
  assert.deepEqual(motion.move(entity,{x:40,z:0,vehicle:'bicicleta'},.3),[]);
  motion.reset(entity);assert.deepEqual(motion.move(entity,{x:20,z:20},.4),[]);
});
test('carts produce two narrow wheel paths separated by the actual axle width',()=>{
  const motion=new TerrainTrackMotion(),entity={};motion.move(entity,{x:4,z:4,vehicle:'carrinho'},0);
  const stamps=motion.move(entity,{x:4,z:4.6,vehicle:'carrinho'},.1);
  assert.ok(stamps.length>=20);const xs=new Set(stamps.map(s=>s.x.toFixed(2)));
  assert.deepEqual([...xs].sort(),['3.67','4.33']);assert.ok(stamps.every(s=>s.width===.044&&s.kind===0));
  assert.ok(!stamps.some(s=>Math.abs(s.x-4)<.1),'the gap between wheels stays untouched');
});
test('wheel contacts rotate with the vehicle and sweep arcs when turning in place',()=>{
  const motion=new TerrainTrackMotion(),entity={};motion.move(entity,{x:4,z:4,vehicle:'carrinho'},0);
  const stamps=motion.move(entity,{x:4,z:4,angle:Math.PI/2,vehicle:'carrinho'},.1);
  assert.ok(stamps.length>10);assert.ok(stamps.some(s=>s.angle<0));
  assert.equal(VEHICLE_CONTACTS.skate.length,4);assert.equal(VEHICLE_CONTACTS.patins.length,8);
});
test('grass regrows and sand tracks vanish smoothly at their own deadlines',()=>{
  for(const [hold,life]of [[GRASS_TRACK_HOLD,GRASS_TRACK_LIFE],[SAND_TRACK_HOLD,SAND_TRACK_LIFE]]){
    assert.equal(trackStrength(0,hold,life),1);assert.equal(trackStrength(hold,hold,life),1);
    assert.equal(trackStrength((hold+life)/2,hold,life),.5);assert.equal(trackStrength(life,hold,life),0);assert.equal(trackStrength(1e6,hold,life),0);
  }
});
test('sand preserves its existing material hook; grass shares the same timestamp atlas',()=>{
  const uniforms={terrainTrackMap:{value:{}},terrainTrackTime:{value:0}};
  const sand={onBeforeCompile(shader){shader.uniforms.original={value:1};},customProgramCacheKey(){return 'sand-original';}};
  addSandTracksToMaterial(sand,uniforms);
  const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};sand.onBeforeCompile(shader);
  assert.equal(shader.uniforms.original.value,1);assert.equal(shader.uniforms.terrainTrackMap,uniforms.terrainTrackMap);assert.ok(sand.customProgramCacheKey().includes('sand-original'));
  class Material{constructor(options){Object.assign(this,options);}}
  const grass=createVolumetricGrassMaterial({MeshStandardMaterial:Material,DoubleSide:2},null,{value:0},uniforms);
  const g={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>\n#include <normal_fragment_begin>'};grass.onBeforeCompile(g);
  assert.equal(g.uniforms.terrainTrackMap,uniforms.terrainTrackMap);assert.ok(g.vertexShader.includes('transformed = grassRoot + (transformed - grassRoot) * recovery;'));
});

test('render tracking falls back to entity positions until a body transform exists, and freezes when paused',async()=>{
  const {TerrainTracks}=await import('../js/terrain_tracks.js');
  const tracker=Object.create(TerrainTracks.prototype),entity={id:1,x:3,y:3,properties:{citizen:{}}};
  let painted=[];Object.assign(tracker,{time:0,motion:new TerrainTrackMotion(),sandCarry:new SandCarry(),dirtCarry:new SandCarry(),uniforms:{terrainTrackTime:{value:0}},ensureWorld(){},paint(_renderer,stamps){painted.push(...stamps);}});
  const models={motion:new WeakMap([[entity,{renderAngle:Math.PI/2}]])};
  tracker.update({}, {}, [entity],.1,models);entity.x+=.5;tracker.update({}, {}, [entity],.1,models);
  assert.equal(painted.length,2);assert.ok(painted.every(s=>Number.isFinite(s.x)&&Number.isFinite(s.z)));
  const time=tracker.time;painted=[];entity.x+=.5;tracker.update({}, {}, [entity],0,models);
  assert.equal(tracker.time,time);assert.equal(painted.length,0);
  entity.properties.citizen.indoorLocation={};tracker.update({}, {}, [entity],.1,models);
  delete entity.properties.citizen.indoorLocation;entity.x+=.5;tracker.update({}, {}, [entity],.1,models);assert.equal(painted.length,0);
});

test('sand carried per shoe fades over three contacts and water washes it off',async()=>{
  const {SandCarry}=await import('../js/terrain_tracks.js');
  const carry=new SandCarry(),entity={},world={width:20,height:4,getTile(x){return x===0?3:x===8?2:8;}};
  const step=(x,kind=-1)=>({x,z:1,kind,width:.1,length:.22,angle:0});
  carry.contacts(entity,[step(.5),step(.5,1)],world);
  const marks=carry.contacts(entity,[step(1.1),step(1.3),step(1.5),step(1.7)],world);
  assert.ok(marks.length>0);assert.ok(marks.every(s=>s.deposit>0&&s.deposit<=1));
  assert.deepEqual(carry.contacts(entity,[step(2.1)],world),[]);
  carry.contacts(entity,[step(8.1,1)],world);
  assert.deepEqual(carry.contacts(entity,[step(9.1,1)],world),[]);
  carry.contacts(entity,[step(.5)],world);carry.reset(entity);
  assert.deepEqual(carry.contacts(entity,[step(1.1)],world),[]);
});

test('dragged hulls leave broad pointed contacts matching the canoe and reset when afloat',async()=>{
 const {TerrainTracks}=await import('../js/terrain_tracks.js');
 const {BOAT_HULL_DIMENSIONS}=await import('../js/boat_types.js');
 const tracker=Object.create(TerrainTracks.prototype),boat={id:21,x:5,y:5,properties:{cityVehicle:{good:'canoe',boatClass:'canoe',towedByVehicleId:3}}};
 const painted=[];Object.assign(tracker,{time:0,motion:new TerrainTrackMotion(),sandCarry:new SandCarry(),dirtCarry:new SandCarry(),uniforms:{terrainTrackTime:{value:0}},ensureWorld(){},paint(_renderer,stamps){painted.push(...stamps);}});
 tracker.update({}, {}, [boat],.1);boat.y+=.5;tracker.update({}, {}, [boat],.1);
 assert(painted.length>0);assert(painted.every(s=>s.kind===2&&s.width===BOAT_HULL_DIMENSIONS.canoe.width&&s.length===BOAT_HULL_DIMENSIONS.canoe.length));
 const count=painted.length;boat.properties.cityVehicle.towedByVehicleId=null;boat.y+=.5;tracker.update({}, {}, [boat],.1);assert.equal(painted.length,count);
 boat.properties.cityVehicle.towedByVehicleId=3;tracker.update({}, {}, [boat],.1);assert.equal(painted.length,count);
});
