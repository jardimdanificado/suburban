import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
import {reserveService,queueService} from '../js/city_service_queue.js';
import {syncCitizenInterior,activityCellAvailable,advanceCitizenInterior} from '../js/city_interiors.js';
import {beginActivitySearch,endActivitySearch} from '../js/city_activity_search.js';

function prepare(city,c,b){
 city.economy.leaveJob(c);c.businessIds=[];c.path=[];c.indoorLocation=null;c.deliveryId=null;c.cleaningJobId=null;c.informalJobId=null;c.conversation=null;c.workMeal=null;c.mobilityTrip=null;c.ridingVehicleId=null;
 for(const key in c.needs)c.needs[key]=95;c.needs.water=0;c.provisions=4;c.pocket={water:0,food:[],receivedWater:0};c.entity.x=b.door.x;c.entity.y=b.door.y;c.task='supplies';c.supplyNeed='water';c.targetId=b.id;
}

test('a room freed during a shared search admits the next waiting customer immediately',()=>{
 const city=setup({starter:true,population:24}),b=city.buildings.find(b=>b.type==='popular_refectory'),people=city.citizens.slice(0,5),room=b.units.find(u=>u.z===0);
 for(const u of b.units)u.roomType=u===room?'service':'laundry';b.layoutRevision=(b.layoutRevision||0)+1;
 for(const c of people)prepare(city,c,b);
 beginActivitySearch(city);
 try{
  for(const c of people)syncCitizenInterior(city,c);
  assert.equal(room.activityReservedIds.length,4);
  assert.equal(people[4].indoorLocation.targetRoomType,'waiting');
  people[0].task=null;people[0].targetId=null;syncCitizenInterior(city,people[0]);
  syncCitizenInterior(city,people[4]);
  assert.equal(people[4].indoorLocation.targetUnitId,room.id);
  assert.equal(room.activityReservedIds.length,4);
  assert(!room.activityReservedIds.includes(people[0].id));
 }finally{endActivitySearch(city);}
});

test('waiting customers enter circulation and leave the indoor queue when a counter opens',()=>{
 const city=setup({starter:true,population:64}),b=city.buildings.find(b=>b.type==='popular_refectory'),people=city.citizens.slice(0,24);
 for(const [i,c]of people.entries()){
  prepare(city,c,b);
  queueService(city,c,b,'supplies',i%2?'water':'food',false);
  const s=c.indoorLocation,target=s?.path.at(-1)||s?.position;
  assert.equal(s?.buildingId,b.id,'customers enter even when the counters are full');
  assert(s.path.length,'waiting customers walk away from the doorway');
  assert(b.circulation.some(u=>u.z===Math.round(target.z/1.8)&&Math.floor(target.x-b.entity.x)===u.x&&Math.floor(target.y-b.entity.y)===u.y),'waiting destinations are in circulation');
  assert.equal(c.path.length,0,'waiting does not send anyone back outside');
 }
 assert.equal(new Set(people.map(c=>c.indoorLocation.queueSlot)).size,people.length,'service types share distinct waiting positions');
 const first=people[0];advanceCitizenInterior(city,first,1000);
 const room=b.units.find(u=>u.roomType==='dining');
 assert.equal(queueService(city,first,b,'supplies','food',true,room,'service'),true);
 assert.equal(b.serviceQueue.some(q=>q.citizenId===first.id),false);
 assert.equal(first.indoorLocation.buildingId,b.id,'admission retains the indoor position');
});

test('office customers enter the tower and wait on the service floor',()=>{
 const city=setup({starter:true,population:64}),b=city.buildings.find(b=>b.officeTenantOf&&b.officeFloor>0),c=city.citizens.find(c=>!city.politics.officeHolder(c));assert(b);
 prepare(city,c,b);queueService(city,c,b,'supplies','dining',false);
 const s=c.indoorLocation,target=s?.path.at(-1);
 assert.equal(s?.buildingId,b.id);assert(target,'the waiting route crosses the interior stairs');assert.equal(target.z,b.officeFloor*1.8);assert.equal(c.path.length,0);
});

test('waiting pedestrians reserve available rooms while walking in the queue without overbooking a counter',()=>{
 const city=setup({starter:true,population:64}),b=city.buildings.find(b=>b.type==='popular_refectory'),people=city.citizens.slice(0,6);
 for(const c of people){prepare(city,c,b);c.entity.x=b.door.x+5;c.path=[{x:c.entity.x+2,y:c.entity.y}];reserveService(city,c,b,'supplies','dining');}
 for(const c of people)syncCitizenInterior(city,c);
 const rooms=new Map();for(const c of people){assert(c.serviceQueue?.unitId,'an available counter is reserved before reaching the entrance');rooms.set(c.serviceQueue.unitId,(rooms.get(c.serviceQueue.unitId)||0)+1);assert(c.path.length);assert.deepEqual(c.path.at(-1),b.door);}
 assert.deepEqual([...rooms.values()],[4,2]);
 const firstRoom=city.units.get(people[0].serviceQueue.unitId);assert.equal(activityCellAvailable(city,firstRoom,city.citizens[10],'service'),false);
 people[0].task=null;people[0].targetId=null;
 assert.equal(activityCellAvailable(city,firstRoom,city.citizens[10],'service'),true,'a cancelled pickup releases its reservation');
});

test('512 simultaneous water pickups finish before dehydration and retain actual room capacity',()=>{
 const city=setup({starter:true,population:512}),b=city.buildings.find(b=>b.type==='popular_refectory'),people=[...city.citizens],start=city.minute;
 for(const c of people)prepare(city,c,b);
 while(city.minute<start+360){
  city.update(.25);
  for(const room of b.units){const reserved=(room.activityReservedIds||[]).map(id=>city.society.citizen(id)).filter(c=>{const s=c?.indoorLocation,p=c?.serviceQueue;return c&&(p?.unitId===room.id&&p.roomKind==='service'||!s?.exiting&&s?.targetUnitId===room.id&&s.targetRoomType==='service');});assert(reserved.length<=4,'real counter capacity bounds admission');}
  if(city.minute===start+120)assert(people.every(c=>c.pocket.receivedWater>0),'the whole population can replenish water within two hours');
 }
 assert.equal(city.life.deathCount,0);assert(people.every(c=>c.needs.water>0));assert(people.every(c=>c.pocket.receivedWater>0));
});

test('counter reservations retain their capacity across the worker state transfer',()=>{
 const city=setup({starter:true,population:64}),b=city.buildings.find(b=>b.type==='popular_refectory'),people=city.citizens.slice(0,4);
 for(const c of people){prepare(city,c,b);c.entity.x=b.door.x+5;c.path=[{x:c.entity.x+2,y:c.entity.y}];reserveService(city,c,b,'supplies','dining');syncCitizenInterior(city,c);}
 const mirror=new CityStateGraph().apply(structuredClone(new CityStateGraph().encode({city}))).city;bindCityState(mirror);
 const room=mirror.units.get(people[0].serviceQueue.unitId),other=mirror.citizens[10];
 assert.equal(activityCellAvailable(mirror,room,other,'service'),false);
 const cancelled=mirror.society.citizen(people[0].id);cancelled.task=null;cancelled.targetId=null;
 assert.equal(activityCellAvailable(mirror,room,other,'service'),true);
});
