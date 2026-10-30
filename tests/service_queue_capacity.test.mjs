import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
import {reserveService} from '../js/city_service_queue.js';
import {syncCitizenInterior,activityCellAvailable} from '../js/city_interiors.js';

function prepare(city,c,b){
 city.economy.leaveJob(c);c.businessIds=[];c.path=[];c.indoorLocation=null;c.deliveryId=null;c.cleaningJobId=null;c.informalJobId=null;c.conversation=null;c.workMeal=null;c.mobilityTrip=null;c.ridingVehicleId=null;
 for(const key in c.needs)c.needs[key]=95;c.needs.water=0;c.provisions=4;c.pocket={water:0,food:[],receivedWater:0};c.entity.x=b.door.x;c.entity.y=b.door.y;c.task='supplies';c.supplyNeed='water';c.targetId=b.id;
}

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
