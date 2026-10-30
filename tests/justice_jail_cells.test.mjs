import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {advanceCitizenInterior} from '../js/city_interiors.js';

test('a detainee reserves and physically enters a real cell in the assigned jail',()=>{
 const city=setup({starter:true,population:32});let jail;
 for(const site of city.economy.locateBuilding('jail')){jail=city.addBuilding('jail',site.x,site.y,{...site,width:3,depth:3,floors:1,free:true});if(jail)break;}
 assert.ok(jail);const [prisoner,guard]=city.citizens.filter(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c));assert.ok(guard);
 city.economy.leaveJob(guard,'Designação de teste');guard.jobId=jail.id;jail.workers=[guard.id];guard.task='work';guard.path=[];
 const workUnit=jail.units.find(u=>u.roomType==='workspace');guard.indoorLocation={buildingId:jail.id,unitId:workUnit?.id,path:[],floor:0,exiting:false};
 const cell=city.justice.jailCells(jail)[0];assert.ok(cell);assert.equal(cell.roomType,'cell');assert.ok(city.justice.jailCapacity(jail)>=1);
 prisoner.entity.x=jail.door.x;prisoner.entity.y=jail.door.y;prisoner.path=[];prisoner.indoorLocation=null;prisoner.task='custody';prisoner.targetId=jail.id;Object.assign(prisoner.needs,{food:90,water:90,health:90,energy:80,hygiene:90,toilet:90});
 prisoner.custody={caseId:900,jailId:jail.id,status:'detained',startedAt:city.minute,releaseAt:city.minute+5000};city.justice.cases.push({id:900,status:'arrested',chargedCitizenId:prisoner.id,investigation:{suspectId:prisoner.id}});
 city.justice.updateDetainee(prisoner);assert.equal(prisoner.custody.cellUnitId,cell.id);assert.equal(prisoner.custody.cellStatus,'moving-to-cell');
 for(let i=0;i<100&&prisoner.indoorLocation?.unitId!==cell.id;i++){city.minute++;advanceCitizenInterior(city,prisoner,100);city.justice.updateDetainee(prisoner);}
 assert.equal(prisoner.indoorLocation?.buildingId,jail.id);assert.equal(prisoner.indoorLocation?.unitId,cell.id);assert.equal(prisoner.indoorLocation?.roomType,'cell');assert.equal(prisoner.custody.cellStatus,'occupied');
 assert.equal(city.justice.release(prisoner,'Teste de soltura'),true);assert.equal(prisoner.custody,null);assert.equal(prisoner.indoorLocation.exiting,true);assert.ok(prisoner.indoorLocation.path.length);
});
