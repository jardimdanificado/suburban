import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney,finishActivityRoute,ensureBusiness} from './helpers/city.mjs';
import {advanceCitizenInterior,syncCitizenInterior} from '../js/city_interiors.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';

function fixture(){
 const city=setup({starter:true,population:48}),company=city.economy.businesses.find(b=>b.type==='cleaner'),worker=city.society.citizen(company.workers[0]),site=city.buildings.find(b=>b.type==='public_toilet');
 const facility=[...city.sanitation.facilities.values()].find(f=>f.buildingId===site.id&&city.units.get(f.unitId)?.z===site.floors-1&&Math.hypot(site.entity.x+city.units.get(f.unitId).x+.5-site.door.x,site.entity.y+city.units.get(f.unitId).y+.5-site.door.y)>3);
 assert(facility);for(const key of Object.keys(worker.needs))worker.needs[key]=95;worker.task=null;worker.path=[];worker.indoorLocation=null;worker.conversation=null;worker.workMeal=null;worker.sleep=null;
 facility.cleanliness=0;city.minute=540;const job=city.sanitation.requestCleaning(facility.id,'treasury',company.id);assert(job);
 return {city,company,worker,site,facility,job};
}
function tick(city,people){
 city.minute++;city.sanitation.updateMinute();
 for(const person of people){if(person.indoorLocation)advanceCitizenInterior(city,person,1);else if(person.path.length){const next=person.path.shift();person.entity.x=next.x;person.entity.y=next.y;}syncCitizenInterior(city,person);}
}

test('a cleaner reaches a distant upper-floor bathroom and finishes without being sent back to the entrance',()=>{
 const {city,worker,site,facility,job}=fixture(),money=totalMoney(city);worker.entity.x=site.door.x;worker.entity.y=site.door.y;
 for(let i=0;i<180&&job.status!=='completed';i++)tick(city,[worker]);
 assert.equal(job.status,'completed');assert.equal(facility.cleanliness,100);assert.equal(totalMoney(city),money);
});

test('a cleaner can leave the company interior and travel physically to a contracted bathroom',()=>{
 const {city,company,worker,facility,job}=fixture();worker.task='work';worker.targetId=company.id;worker.entity.x=company.door.x;worker.entity.y=company.door.y;finishActivityRoute(city,worker);assert(worker.indoorLocation);
 for(let i=0;i<240&&job.status!=='completed';i++)tick(city,[worker]);
 assert.equal(job.status,'completed');assert.equal(facility.cleanliness,100);
});

test('a closed provider is replaced using the existing escrow without charging the owner again',()=>{
 const {city,company,site,facility,job}=fixture();company.active=false;
 const replacement=ensureBusiness(city,'cleaner'),worker=city.society.citizen(replacement.workers[0]);for(const key of Object.keys(worker.needs))worker.needs[key]=95;worker.sleep=null;worker.conversation=null;worker.task=null;worker.path=[];worker.indoorLocation=null;worker.entity.x=site.door.x;worker.entity.y=site.door.y;
 const treasury=city.treasury,money=totalMoney(city);
 for(let i=0;i<180&&job.status!=='completed';i++)tick(city,[worker]);
 assert.equal(job.providerId,replacement.id);assert.equal(job.status,'completed');assert.equal(facility.cleanliness,100);assert(city.treasury>=treasury);assert.equal(city.accounts.get(job.accountId).balance,0);assert.equal(totalMoney(city),money);
});

test('a stale cancelled cleaning reference cannot block new maintenance in an existing city',()=>{
 const {city,facility,job}=fixture();job.status='cancelled';city.transfer(job.accountId,job.payerId,job.fee,'Reembolso do contrato cancelado');
 city.sanitation.reconcile();assert.equal(facility.cleaningJobId,null);assert(city.sanitation.requestCleaning(facility.id));
});

test('a sleeping cleaner finishes the eight-hour rest instead of being pulled into a new contract',()=>{
 const {city,worker,job}=fixture();worker.sleep={active:true,minutes:120};city.minute=545;city.sanitation.updateMinute();assert.equal(job.workerId,null);assert.equal(worker.sleep.active,true);
});

test('one crew completes successive bathrooms across floors instead of getting stuck on its first room',()=>{
 const {city,company,worker,site,job}=fixture(),jobs=[job];
 for(const floor of [0,1,2]){const f=[...city.sanitation.facilities.values()].find(f=>f.buildingId===site.id&&city.units.get(f.unitId)?.z===floor);f.cleanliness=0;jobs.push(city.sanitation.requestCleaning(f.id,'treasury',company.id));}
 worker.entity.x=site.door.x;worker.entity.y=site.door.y;const money=totalMoney(city);
 for(let minute=0;minute<360&&jobs.some(j=>j.status!=='completed');minute++)tick(city,[worker]);
 assert(jobs.every(j=>j.status==='completed'));assert(jobs.every(j=>city.sanitation.facilities.get(j.facilityId).cleanliness===100));assert.equal(totalMoney(city),money);
});

test('removing a bathroom cancels the obsolete contract and refunds its reserved payment',()=>{
 const {city,site,facility,job}=fixture(),treasury=city.treasury,money=totalMoney(city);city.units.delete(facility.unitId);site.units=site.units.filter(u=>u.id!==facility.unitId);site.layoutRevision++;
 city.sanitation.reconcile();city.sanitation.updateMinute();assert.equal(job.status,'cancelled');assert.equal(city.treasury,treasury+job.fee);assert.equal(totalMoney(city),money);assert.equal(city.accounts.get(job.accountId).balance,0);
});

test('a saved cleaner with a stale street route inside a bathroom resumes the existing contract',()=>{
 const {city,worker,site,facility,job}=fixture();worker.cleaningJobId=job.id;job.workerId=worker.id;job.status='working';worker.task='clean';worker.targetId=site.id;worker.entity.x=site.door.x;worker.entity.y=site.door.y;finishActivityRoute(city,worker);worker.path=[{...site.door}];
 const sender=new CityStateGraph(),receiver=new CityStateGraph(),restored=receiver.apply(sender.encode({city})).city;bindCityState(restored);
 const copy=restored.society.citizen(worker.id),contract=restored.sanitation.jobs.find(j=>j.id===job.id);
 for(let minute=0;minute<60&&contract.status!=='completed';minute++)tick(restored,[copy]);
 assert.equal(contract.status,'completed');assert.equal(restored.sanitation.facilities.get(facility.id).cleanliness,100);
});
