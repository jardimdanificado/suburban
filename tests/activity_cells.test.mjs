import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {syncCitizenInterior,advanceCitizenInterior,activityRoomReady,finishBuildingOccupants} from '../js/city_interiors.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
const fresh=c=>{for(const k of Object.keys(c.needs))c.needs[k]=95;c.conversation=null;c.workMeal=null;c.deliveryId=null;c.path=[];c.task=null;c.indoorLocation=null;};
const walk=c=>{if(c.path.length){const p=c.path.at(-1);c.entity.x=p.x;c.entity.y=p.y;c.path=[];}};
test('a worker must enter and reach their reserved work cell before production advances',()=>{
 const city=setup({starter:true,population:128}),b=city.buildings.find(b=>b.type==='paintworks'),c=city.society.citizen(b.workers[0]);fresh(c);c.entity.x=b.door.x;c.entity.y=b.door.y;c.task='work';c.targetId=b.id;const labor=b.productionLabor||0;
 city.performTask(c);assert.equal(city.economy.productionWork(b,c),false);assert.equal(b.productionLabor||0,labor);assert(c.indoorLocation.path.length);assert.equal(c.indoorLocation.unitId,null);
 const target=c.indoorLocation.targetUnitId;advanceCitizenInterior(city,c,.25);assert.equal(c.indoorLocation.unitId,null);
 advanceCitizenInterior(city,c,100);city.performTask(c);assert.equal(c.indoorLocation.unitId,target);assert(b.productionLabor>labor);
 c.task='social';c.targetId=null;c.path=[{x:b.door.x+1,y:b.door.y}];assert.equal(syncCitizenInterior(city,c),false);assert(c.indoorLocation.exiting);advanceCitizenInterior(city,c,100);assert.equal(c.indoorLocation,null);
});
test('a farmer visits separate crop cells and labor does not advance while travelling',()=>{
 const city=setup({starter:true,population:128}),b=city.buildings.find(b=>b.type==='farm'),c=city.society.citizen(b.workers[0]);fresh(c);c.task='work';c.targetId=b.id;c.entity.x=b.door.x;c.entity.y=b.door.y;const visited=new Set();
 assert(city.economy.farmWork(b,c));assert(c.path.length);assert.equal(b.fields[0].labor,0);
 for(let i=0;i<100&&visited.size<3;i++){walk(c);const before=b.fields.reduce((n,f)=>n+f.labor,0);city.economy.farmWork(b,c);if(c.path.length)assert.equal(b.fields.reduce((n,f)=>n+f.labor,0),before);else visited.add(c.workCell.unitId);}
 assert(visited.size>=3);assert(b.fields[0].cellLabor.filter(n=>n>0).length>=3);
});
test('a toilet visit has no effects at the entrance and only starts inside the assigned bathroom',()=>{
 const city=setup({starter:true,population:128}),b=city.buildings.find(b=>b.type==='farm'),c=city.society.citizen(b.workers[0]),f=[...city.sanitation.facilities.values()].find(f=>f.buildingId===b.id);fresh(c);c.entity.x=b.door.x;c.entity.y=b.door.y;c.task='toilet';c.targetId=b.id;c.toiletTargetId=f.id;c.needs.toilet=0;const uses=f.uses,waste=city.goodsStock('lixo');
 assert.equal(city.sanitation.use(c),false);assert.equal(f.uses,uses);assert.equal(c.needs.toilet,0);assert.equal(city.goodsStock('lixo'),waste);walk(c);assert(city.sanitation.use(c));assert.equal(c.indoorLocation.unitId,f.unitId);assert.equal(f.uses,uses+1);assert.equal(city.goodsStock('lixo'),waste+1);
});
test('workplace meals require the dining cell and no food is consumed in transit',()=>{
 const city=setup({starter:true,population:128}),b=city.buildings.find(b=>b.type==='farm'),c=city.society.citizen(b.workers[0]);fresh(c);b.inventory.pao=6;for(const g of city.workMeals.foodGoods())if(g!=='pao')b.inventory[g]=0;c.task='work';c.targetId=b.id;c.entity.x=b.door.x;c.entity.y=b.door.y;c.needs.food=20;const food=b.inventory.pao;
 assert(city.workMeals.tryStart(c));assert.equal(c.workMeal,null);assert.equal(b.inventory.pao,food);assert(c.path.length);walk(c);assert(city.workMeals.tryStart(c));assert(c.workMeal);assert.equal(c.indoorLocation.roomType,'dining');assert.equal(b.inventory.pao,food-3);assert.equal(c.needs.food,20);city.workMeals.advance(c);assert(c.needs.food>20);
});
test('workstation reservations are exclusive and interior circulation survives worker snapshots',()=>{
 const city=setup({starter:true,population:128}),b=city.buildings.find(b=>b.type==='bank'),[a,c]=city.citizens.slice(0,2),u=b.units.find(u=>u.roomType==='workspace');for(const person of [a,c]){fresh(person);person.entity.x=b.door.x;person.entity.y=b.door.y;person.task='work';person.targetId=b.id;}
 assert.equal(activityRoomReady(city,a,b,u),false);assert.equal(activityRoomReady(city,c,b,u),false);assert.equal(c.indoorLocation,null);assert.deepEqual(u.activityReservedIds,[a.id]);
 const mirror=new CityStateGraph().apply(new CityStateGraph().encode({city})).city;bindCityState(mirror);const ma=mirror.society.citizen(a.id);advanceCitizenInterior(mirror,ma,100);assert.equal(ma.indoorLocation.unitId,u.id);assert.deepEqual(mirror.units.get(u.id).activityReservedIds,[a.id]);
});
test('construction labor advances only at the current road cell',()=>{
 const city=setup({starter:true,population:128}),b=city.buildings.find(b=>b.type==='builder'),c=city.society.citizen(b.workers[0]),start=city.buildings.find(b=>b.type==='townhall').door;fresh(c);c.entity.x=start.x;c.entity.y=start.y;c.task='construction';
 const project={id:'project:test',service:'road',builderId:b.id,path:[{...b.door}],door:{...b.door},status:'ready',inventory:{pedra:1},stone:1,labor:0,requiredLabor:100};assert(city.development.work(project,c));assert.equal(project.labor,0);assert(c.path.length);walk(c);assert(city.development.work(project,c));assert(project.labor>0);assert.equal(c.workCell.target.x,b.door.x);assert.equal(c.workCell.target.y,b.door.y);
});
test('councilors count for quorum only after reaching the plenary, and use their office outside sessions',()=>{
 const city=setup({starter:true,population:128});let hall;for(const site of city.economy.locateBuilding('council_chamber')){hall=city.addBuilding('council_chamber',site.x,site.y,{...site,width:3,depth:3,floors:2,free:true});if(hall)break;}assert(hall);
 const chamber=city.politics.council.getChamber(),c=city.politics.council.people()[0],member=city.politics.council.members.find(m=>m.citizenId===c.id);fresh(c);city.minute=600;c.entity.x=hall.door.x;c.entity.y=hall.door.y;c.task='council-session';c.targetId=hall.id;c.councilSession={buildingId:hall.id};assert(!chamber.present().some(p=>p.id===c.id));syncCitizenInterior(city,c);assert(!chamber.present().some(p=>p.id===c.id));advanceCitizenInterior(city,c,100);assert(chamber.present().some(p=>p.id===c.id));
 const office=hall.units.find(u=>u.roomType==='office');assert(office);member.officeUnitId=office.id;city.minute=14*60;assert.equal(syncCitizenInterior(city,c),false);advanceCitizenInterior(city,c,100);assert.equal(c.indoorLocation.unitId,office.id);assert.equal(c.indoorLocation.roomType,'office');
});

test('construction crews can leave a completed building instead of being trapped on its blocked tiles',()=>{
 const city=setup({starter:true,population:128}),b=city.buildings.find(b=>b.type==='bank'),c=city.citizens[0];fresh(c);c.entity.x=b.entity.x+.5;c.entity.y=b.entity.y+.5;c.task='construction';c.workCell={z:0};finishBuildingOccupants(city,b);assert.equal(c.entity.x,b.door.x);assert.equal(c.entity.y,b.door.y);assert(c.indoorLocation.exiting);assert(c.indoorLocation.path.length);advanceCitizenInterior(city,c,100);assert.equal(c.indoorLocation,null);assert(city.walkable(Math.floor(c.entity.x),Math.floor(c.entity.y)));
});
