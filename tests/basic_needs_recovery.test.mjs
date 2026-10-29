import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {syncCitizenInterior,advanceCitizenInterior} from '../js/city_interiors.js?v=needs-recovery-1';
const person=city=>{const c=city.citizens.find(c=>!city.politics.officeHolder(c));city.economy.leaveJob(c);c.businessIds=[];c.homeUnitId=null;c.homeId=null;c.indoorLocation=null;c.path=[];c.deliveryId=null;c.conversation=null;for(const k of Object.keys(c.needs))c.needs[k]=95;return c;};
test('a homeless person can recover energy even when another need is critical',()=>{
 const city=setup({starter:true,population:64}),c=person(city);c.needs.energy=0;c.needs.toilet=0;c.task='energy';c.targetId=null;city.performTask(c);assert.equal(c.task,'energy');assert(c.needs.energy>0);
 for(let i=0;i<60;i++)city.update(.25);assert(c.needs.energy>1||c.needs.toilet>1);
});
test('a homeless person can leave an overcrowded shelter and sleep outdoors',()=>{
 const city=setup({starter:true,population:64}),c=person(city),hall=city.buildings.find(b=>b.type==='townhall');for(const u of hall.units)if(u.roomType==='workspace'||u.roomType==='bedroom')u.roomType='service';hall.layoutRevision++;
 c.needs.energy=2;c.task='energy';c.targetId=hall.id;c.entity.x=hall.door.x;c.entity.y=hall.door.y;
 assert.equal(syncCitizenInterior(city,c),false);city.minute+=31;syncCitizenInterior(city,c);assert.equal(c.targetId,null);
 for(let i=0;i<8&&c.indoorLocation;i++){advanceCitizenInterior(city,c,100);syncCitizenInterior(city,c);}assert.equal(c.indoorLocation,null);c.path=[];const before=c.needs.energy;city.performTask(c);assert(c.needs.energy>before);
});
test('voting does not interrupt essential recovery before the voter can travel',()=>{
 const city=setup({starter:true,population:64}),c=person(city),hall=city.buildings.find(b=>b.type==='townhall'),voting=city.politics.voting,e={id:777,pollingBuildingId:hall.id},row={citizenId:c.id};
 c.needs.energy=30;c.task='energy';c.targetId=null;assert.equal(voting.route(e,row),false);assert.equal(c.task,'energy');assert.equal(row.reason,'Recuperando energia');
 city.minute+=30;c.needs.energy=60;c.task=null;assert.equal(voting.route(e,row),true);assert.equal(c.task,'vote');
});
test('a well rested person is not forced back to sleep solely because it is night',()=>{
 const city=setup({starter:true,population:64}),c=person(city);city.minute=23*60;c.needs.energy=95;c.task=null;c.startupProjectId=null;city.chooseTask(c);assert.notEqual(c.task,'energy');
});

test('an election can recover turnout after widespread simultaneous exhaustion and bathroom need',()=>{
 const city=setup({starter:true,population:128}),p=city.politics;p.termNumber=3;p.beginElection();const e=p.active;city.minute=e.voteAt;e.status='campaign';
 for(const c of city.citizens){c.task=null;c.path=[];c.indoorLocation=null;c.deliveryId=null;c.workMeal=null;c.cleaningJobId=null;Object.assign(c.needs,{energy:2,toilet:3,food:95,water:95,health:95,hygiene:95});}
 p.voting.open(e);while(city.minute<e.closesAt+20&&p.active===e)city.update(.25);
 assert(e.ballots.length>=100,`only ${e.ballots.length} of ${e.electorate.length} voted`);assert.equal(city.citizens.filter(c=>!c.entity.destroyed).length,128);assert(city.citizens.filter(c=>city.urgentNeed(c)==='energy').length<10);
});

test('a critically urgent person abandons a stalled bathroom queue at a real hygiene cost',async()=>{
 const {queueService}=await import('../js/city_service_queue.js');const city=setup({starter:true,population:64}),c=person(city),hall=city.buildings.find(b=>b.type==='townhall'),f=[...city.sanitation.facilities.values()].find(f=>f.buildingId===hall.id);
 c.entity.x=hall.door.x;c.entity.y=hall.door.y;c.task='toilet';c.targetId=hall.id;c.toiletTargetId=f.id;c.needs.toilet=1;c.needs.hygiene=90;queueService(city,c,hall,'toilet',f.id,false);city.minute+=90;c.path=[];
 queueService(city,c,hall,'toilet',f.id,false);assert.equal(c.task,null);assert.equal(c.needs.toilet,66);assert.equal(c.needs.hygiene,78);assert.equal(hall.serviceQueue.some(q=>q.citizenId===c.id),false);assert.equal(city.sanitation.outdoorIncidents,1);
});
