import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {queueService} from '../js/city_service_queue.js';
import {officeSpaceDemand} from '../js/city_offices.js?v=office-demand-rollout-1';
import {productionPlan} from '../js/city_production_planner.js?v=office-demand-rollout-1';

test('a busy service assigns distinct places and respects order of arrival',()=>{
 const city=setup({starter:true,population:64}),b=city.buildings.find(b=>b.type==='public_toilet'),people=city.citizens.filter(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c)).slice(0,2),f=[...city.sanitation.facilities.values()].find(f=>f.buildingId===b.id);
 for(const c of people){c.entity.x=b.door.x;c.entity.y=b.door.y;c.task='toilet';c.targetId=b.id;c.toiletTargetId=f.id;c.path=[];assert.equal(queueService(city,c,b,'toilet',f.id,false),false);}
 const [first,second]=b.serviceQueue;assert.notEqual(first.slot,second.slot);assert(first.sequence<second.sequence);
 for(const c of people)c.path=[];assert.equal(queueService(city,people[1],b,'toilet',f.id,true),false);assert.equal(queueService(city,people[0],b,'toilet',f.id,true),true);people[1].path=[];assert.equal(queueService(city,people[1],b,'toilet',f.id,true),true);
});
test('a later meal customer cannot overtake an earlier one',()=>{
 const city=setup({starter:true,population:64}),b=city.buildings.find(b=>b.type==='popular_refectory'),people=city.citizens.filter(c=>city.society.isAdult(c)).slice(0,2);
 for(const c of people){c.entity.x=b.door.x;c.entity.y=b.door.y;c.task='food';c.targetId=b.id;c.path=[];assert.equal(queueService(city,c,b,'food','dining',false),false);}
 for(const c of people)c.path=[];assert.equal(queueService(city,people[1],b,'food','dining',true),false);assert.equal(queueService(city,people[0],b,'food','dining',true),true);people[1].path=[];assert.equal(queueService(city,people[1],b,'food','dining',true),true);
});
test('office demand plans another tower when required activities exceed vacant floors',()=>{
 const city=setup({starter:true,population:128}),tower=city.buildings.find(b=>b.type==='office_tower');assert(tower);
 for(const u of tower.units)if(!u.occupantId)u.occupantId='occupied:test';
 const need=officeSpaceDemand(city);assert(need.missing>0);city.economy.updateDemand();const row=productionPlan(city.economy).find(r=>r.type==='office_tower');assert(row.missing);assert(city.economy.demands.find(d=>d.type==='office_tower').score>0);
 const founder=city.citizens.find(c=>city.politics.canOwnBusiness(c));assert.equal(city.economy.foundBusiness(founder.id,'research_institute'),null);assert.match(city.lastError,/empresarial/);
});

test('bathroom tasks enter the real queue and reserve the room in arrival order',async()=>{
 const {syncCitizenInterior}=await import('../js/city_interiors.js?v=needs-recovery-1');
 const city=setup({starter:true,population:64}),b=city.buildings.find(b=>b.type==='public_toilet'),people=city.citizens.filter(c=>city.society.isAdult(c)).slice(0,2),f=[...city.sanitation.facilities.values()].find(f=>f.buildingId===b.id);
 f.occupantId='occupied';f.busyUntil=city.minute+10;
 for(const c of people){c.entity.x=b.door.x;c.entity.y=b.door.y;c.task='toilet';c.targetId=b.id;c.toiletTargetId=f.id;c.path=[];assert.equal(syncCitizenInterior(city,c),false);}
 assert.deepEqual(b.serviceQueue.map(q=>q.citizenId),people.map(c=>c.id));
 f.occupantId=null;for(const c of people){c.path=[];c.entity.x=b.door.x;c.entity.y=b.door.y;}
 syncCitizenInterior(city,people[1]);assert.equal(people[1].indoorLocation,null);
 syncCitizenInterior(city,people[0]);assert.equal(people[0].indoorLocation?.buildingId,b.id);assert.equal(b.serviceQueue[0].citizenId,people[1].id);
});
