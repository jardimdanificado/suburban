import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';

test('a resident can resume life after waiting for an unavailable toilet, at a real personal cost',()=>{
 const city=setup({starter:true,population:64}),c=city.citizens.find(c=>!city.politics.officeHolder(c));
 city.economy.leaveJob(c);for(const k of Object.keys(c.needs))c.needs[k]=90;c.needs.toilet=2;c.task=null;c.path=[];
 city.sanitation.choose=()=>false;const hygiene=c.needs.hygiene,mood=c.mood||0;
 city.chooseTask(c);assert.equal(c.action,'Aguardando banheiro acessível');assert.equal(c.needs.toilet,2);
 city.minute+=29;city.chooseTask(c);assert.equal(c.needs.toilet,2);
 city.minute++;city.chooseTask(c);assert.equal(c.needs.toilet,67);assert.equal(c.needs.hygiene,hygiene-12);assert.equal(c.mood,mood-8);assert.equal(city.sanitation.outdoorIncidents,1);assert.equal(city.urgentNeed(c),undefined);
 city.chooseTask(c);assert.notEqual(c.action,'Aguardando banheiro acessível');
});

test('a 256-person town starts with a separate multi-floor public toilet building',()=>{
 const city=setup({starter:true,population:256}),hall=city.buildings.find(b=>b.type==='townhall'),toilet=city.buildings.find(b=>b.type==='public_toilet'),publicFacilities=[...city.sanitation.facilities.values()].filter(f=>f.buildingId===toilet.id&&f.access==='public');
 assert(toilet);assert(toilet.floors>=3);assert.equal(publicFacilities.length,8);assert.equal(new Set(publicFacilities.map(f=>f.unitId)).size,8);
 assert.equal([...city.sanitation.facilities.values()].filter(f=>f.buildingId===hall.id&&f.access==='public').length,0);
});

test('adults with no pressing needs take an outdoor walk instead of crowding the town hall',()=>{
 const city=setup({starter:true,population:64}),c=city.citizens.find(c=>!city.politics.officeHolder(c));city.economy.leaveJob(c);c.businessIds=[];c.startupProjectId=null;c.guardianId=null;for(const k of Object.keys(c.needs))c.needs[k]=95;c.task=null;c.path=[];
 city.chooseTask(c);assert.equal(c.task,'walk');assert(c.path.length>0);assert.equal(c.targetId,null);const start={x:c.entity.x,y:c.entity.y};city.stepMinute();city.update(.25);assert(Math.hypot(c.entity.x-start.x,c.entity.y-start.y)>0);
});
