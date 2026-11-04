import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {activityRoomReady,advanceCitizenInterior,syncCitizenInterior} from '../js/city_interiors.js';
import {queueService} from '../js/city_service_queue.js';
import {buildingEntrance,buildingEntranceDoor} from '../js/city_building_geometry.js';
import {bodyMovementSpeedFactor} from '../js/city_body_metrics.js?v=body-morph-4';
import {injuryMovementFactor} from '../js/city_injury_effects.js';

function followEntry(city,c,b,start){
 const s=c.indoorLocation,door=buildingEntranceDoor(b),entry=b.units.find(u=>u.id===door.unitId);
 assert.deepEqual(s.position,start,'changing to indoor movement preserves the last outdoor position');
 assert(s.path.length,'the doorway is part of a walking route');
 const inside=p=>p.x>=b.entity.x&&p.x<b.entity.x+b.width&&p.y>=b.entity.y&&p.y<b.entity.y+b.depth;
 let crossed=false,steps=0;
 while(s.path.length&&steps++<2000){
  const before={...s.position};advanceCitizenInterior(city,c,.05);
  assert.equal(c.entity.x,s.position.x,'the real entity crosses the tiles, not just its indoor drawing');
  assert.equal(c.entity.y,s.position.y);
  assert(Math.hypot(s.position.x-before.x,s.position.y-before.y,s.position.z-before.z)<=.05*injuryMovementFactor(c)*(c.substanceModifiers?.mobility||1)*bodyMovementSpeedFactor(c)+1e-6,'every displayed step respects walking distance');
  if(!crossed&&inside(s.position)){
   assert.equal(Math.floor(s.position.x-b.entity.x),entry.x,'cross the entrance cell rather than another wall');
   assert.equal(Math.floor(s.position.y-b.entity.y),entry.y);crossed=true;
  }
 }
 assert(crossed,'the resident physically crosses the exterior wall through the door');
 assert.equal(s.path.length,0);assert(inside(s.position));
 assert(inside(c.entity),'the real entity reaches the tile inside the building');
}

test('entry to a free service and to an indoor queue walks through every door orientation without teleporting',()=>{
 const city=setup({starter:true,population:64}),b=city.buildings.find(b=>b.type==='popular_refectory');
 let person=0;
 for(let rotation=0;rotation<4;rotation++)for(const waiting of [false,true]){
  b.rotation=rotation;b.door=buildingEntrance(b.entity.x,b.entity.y,b.width,b.depth,rotation);b.layoutRevision++;
  const c=city.citizens[person++];city.economy.leaveJob(c);c.path=[];c.indoorLocation=null;c.mobilityTrip=null;c.ridingVehicleId=null;c.workMeal=null;c.task='food';c.targetId=b.id;c.entity.x=b.door.x;c.entity.y=b.door.y;
  const start={x:c.entity.x,y:c.entity.y,z:0};
  if(waiting)queueService(city,c,b,'food','dining',false);
  else assert.equal(activityRoomReady(city,c,b,b.units.find(u=>u.z===1&&u.roomType==='dining'),'dining'),false);
  followEntry(city,c,b,start);
  if(waiting)assert.equal(c.indoorLocation.targetRoomType,'waiting');
  else assert.equal(c.indoorLocation.floor,1);
 }
});

test('simulation frames move the real entity onto the indoor tile and back through the exit',()=>{
 const city=setup({starter:true,population:64}),b=city.buildings.find(b=>b.type==='townhall'),c=city.citizens.find(c=>!city.politics.officeHolder(c));
 city.economy.leaveJob(c);c.businessIds=[];c.path=[];c.indoorLocation=null;c.conversation=null;c.deliveryId=null;c.cleaningJobId=null;c.workMeal=null;c.mobilityTrip=null;c.ridingVehicleId=null;
 for(const key in c.needs)c.needs[key]=95;c.needs.water=30;c.task='work';c.jobId=b.id;b.workers.push(c.id);b.jobs=Math.max(b.jobs,b.workers.length);c.targetId=b.id;c.entity.x=b.door.x;c.entity.y=b.door.y;
 const room=b.units.find(u=>u.z===1&&u.roomType==='workspace');assert(room);
 activityRoomReady(city,c,b,room,'workspace');city.stepMinute();
 const start={x:c.entity.x,y:c.entity.y};city.update(1/60);
 assert(Math.hypot(c.entity.x-start.x,c.entity.y-start.y)>0,'the entity moves on subminute frames');
 let steps=0;
  while(!c.indoorLocation?.unitId&&steps++<1000){
  const before={x:c.entity.x,y:c.entity.y,z:c.indoorLocation.position.z};city.update(1/60);
  assert(Math.hypot(c.entity.x-before.x,c.entity.y-before.y,c.indoorLocation.position.z-before.z)<=4/60*city.justice.mobilityFactor(c)*bodyMovementSpeedFactor(c)+1e-6,'physical movement is bounded each frame');
 }
 assert.equal(c.indoorLocation.unitId,room.id);assert.equal(c.indoorLocation.floor,1);
 assert.equal(Math.floor(c.entity.x-b.entity.x),room.x);assert.equal(Math.floor(c.entity.y-b.entity.y),room.y);
 c.task='walk';c.targetId=null;c.path=city.findPath(c.entity,{x:b.door.x+1,y:b.door.y});assert.notEqual(c.path,null,'an indoor entity can plan its next outdoor trip');
 syncCitizenInterior(city,c);
 while(c.indoorLocation){advanceCitizenInterior(city,c,.05);assert(steps++<2000);}
 assert(Math.hypot(c.entity.x-b.door.x,c.entity.y-b.door.y)<1e-6,'the entity walks back to the exterior doorway');
});
