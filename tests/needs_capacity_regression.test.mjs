import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {pocket} from '../js/city_supplies.js';

const free=(city,c)=>{city.economy.leaveJob(c);c.businessIds=[];c.task=null;c.path=[];c.indoorLocation=null;c.deliveryId=null;c.cleaningJobId=null;c.informalJobId=null;c.conversation=null;c.mobilityTrip=null;c.ridingVehicleId=null;c.workMeal=null;for(const n in c.needs)c.needs[n]=95;};
test('simultaneous bathroom seekers spread across available cubicles before arriving',()=>{
 const city=setup({starter:true,population:64}),b=city.buildings.find(b=>b.type==='public_toilet'),people=city.citizens.filter(c=>!city.politics.officeHolder(c)).slice(0,20);
 for(const c of people){free(city,c);c.entity.x=b.door.x;c.entity.y=b.door.y;c.needs.toilet=20;assert(city.sanitation.choose(c));}
 assert.equal(new Set(people.map(c=>c.toiletTargetId)).size,people.length);
 assert(people.every(c=>!c.serviceQueue),'Travelling does not grant arrival priority');
});
test('stored food without a quality rating restores finite hunger, including damaged legacy needs',()=>{
 const city=setup({starter:true,population:24}),c=city.citizens[0];free(city,c);c.provisions=0;c.needs.food=NaN;pocket(c).food=[{good:'pao',inputs:{pao:3}}];const consumed=city.economy.consumed.pao;
 city.supplies.useCarried(c);assert.equal(c.needs.food,34);assert.equal(city.economy.consumed.pao,consumed+3);assert.equal(pocket(c).food.length,0);assert(Number.isFinite(c.lastMealQuality));
});
test('cleaning completes its contracted amount even when new feces are deposited during work',()=>{
 const city=setup({starter:true,population:48}),company=city.buildings.find(b=>b.type==='cleaner'),worker=city.citizens.find(c=>!city.politics.officeHolder(c));free(city,worker);company.workers=[worker.id];company.ownerId=null;city.transfer('treasury',company.accountId,100000,'Test working capital');worker.jobId=company.id;
 const p={x:company.door.x,y:company.door.y},key=`${Math.floor(p.x)},${Math.floor(p.y)}`;city.sanitation.streetFeces.set(key,{amount:1,jobId:null});const job=city.sanitation.requestFecesCleaning({scope:'street',cellKey:key,...p});assert(job);assert.equal(job.quantity,1);
 const pile=city.sanitation.streetFeces.get(key);pile.amount=8;worker.entity.x=p.x;worker.entity.y=p.y;worker.cleaningJobId=job.id;worker.task='clean';job.workerId=worker.id;job.status='working';job.labor=12;
 const before=company.inventory.fezes;city.sanitation.updateFecesJobs();assert.equal(job.status,'completed');assert.equal(job.cleanedAmount,1);assert.equal(company.inventory.fezes,before+1);assert.equal(pile.amount,7);assert.equal(pile.jobId,null);assert.equal(city.accounts.get(job.accountId).balance,0);
});
