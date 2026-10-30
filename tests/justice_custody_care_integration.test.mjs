import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {advanceCitizenInterior} from '../js/city_interiors.js';

test('a detainee actually reaches the jail bathroom and uses the existing sanitation cycle',()=>{
 const city=setup({starter:true,population:32});let jail;
 for(const site of city.economy.locateBuilding('jail')){jail=city.addBuilding('jail',site.x,site.y,{...site,width:3,depth:3,floors:1,free:true});if(jail)break;}assert(jail);
 const people=city.citizens.filter(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c)),[prisoner,guard]=people;assert(guard);city.economy.leaveJob(guard,'Designação de teste');guard.jobId=jail.id;jail.workers=[guard.id];guard.task='work';guard.path=[];guard.indoorLocation={buildingId:jail.id,path:[],floor:0};
 const facility=[...city.sanitation.facilities.values()].find(f=>f.buildingId===jail.id);assert(facility);jail.inventory.sabao=2;city.minute=600;Object.assign(prisoner.needs,{food:100,water:100,health:80,energy:80,toilet:10,hygiene:20});prisoner.entity.x=jail.door.x;prisoner.entity.y=jail.door.y;prisoner.indoorLocation=null;prisoner.path=[];prisoner.task='custody';prisoner.targetId=jail.id;prisoner.custody={caseId:999,jailId:jail.id,status:'detained',startedAt:600,releaseAt:1200};city.justice.cases.push({id:999,status:'arrested',chargedCitizenId:prisoner.id,investigation:{suspectId:prisoner.id}});
 let entered=false;for(let i=0;i<50&&prisoner.needs.toilet<95;i++){city.minute++;advanceCitizenInterior(city,prisoner,100);city.justice.updateDetainee(prisoner);if(prisoner.indoorLocation?.unitId===facility.unitId&&!prisoner.indoorLocation.path.length)entered=true;}
 assert.ok(entered);assert.ok(prisoner.needs.toilet>=95);assert.equal(jail.inventory.sabao,1);assert.equal(prisoner.needs.hygiene,45);assert.equal(facility.uses,1);assert.equal(prisoner.custody.caseId,999);assert.ok(jail.inventory.fezes>0);
});
