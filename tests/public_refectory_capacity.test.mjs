import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,finishActivityRoute} from './helpers/city.mjs';
import {activityRoomReady,workCellReady} from '../js/city_interiors.js';

function fixture(){
 const city=setup({starter:true,population:64}),b=city.buildings.find(b=>b.type==='popular_refectory'),c=city.citizens.find(c=>!city.politics.officeHolder(c)&&!c.businessIds.length);
 city.economy.leaveJob(c);c.indoorLocation=null;c.workCell=null;c.conversation=null;for(const key in c.needs)c.needs[key]=95;
 return {city,b,c};
}
test('dedicated public refectories have dining rooms on every floor and no generic business cells',()=>{
 const {city,b}=fixture();assert(b.floors>=3);
 for(let floor=0;floor<b.floors;floor++){const rooms=b.units.filter(u=>u.z===floor);assert(rooms.some(u=>u.roomType==='dining'));assert(rooms.every(u=>['dining','bathroom','circulation'].includes(u.roomType)));}
 assert(b.circulation.length>0);assert([...city.sanitation.facilities.values()].some(f=>f.buildingId===b.id&&f.access==='public'));
});
test('reconciliation repairs existing public refectories without recreating rooms or changing food stock',()=>{
 const {city,b}=fixture(),units=[...b.units],stock=b.inventory.pao;
 for(const u of units)if(u.roomType!=='bathroom')u.roomType='workspace';b.layoutRevision++;const revision=b.layoutRevision;
 city.sanitation.reconcile();assert(b.layoutRevision>revision);assert(b.units.every((u,i)=>u===units[i]));assert(b.units.every(u=>u.roomType!=='workspace'));assert.equal(b.inventory.pao,stock);
 const corrected=b.layoutRevision;city.sanitation.reconcile();assert.equal(b.layoutRevision,corrected);
});
test('newly added refectory floors become dining rooms as well',()=>{
 const {city,b}=fixture(),floor=b.floors++;const rooms=city.housing.addFloor(b,floor,'treasury');assert(rooms.some(u=>u.roomType==='workspace'));
 city.sanitation.setupBuilding(b);city.sanitation.setupBusinessRooms(b);assert(rooms.every(u=>u.roomType==='dining'));assert(b.units.filter(u=>u.z===0).some(u=>u.roomType==='dining'));
});
test('staff can work inside a dedicated dining building without requiring a generic office cell',()=>{
 const {city,b,c}=fixture();c.jobId=b.id;b.workers.push(c.id);c.task='work';c.targetId=b.id;c.entity.x=b.door.x;c.entity.y=b.door.y;c.path=[];
 finishActivityRoute(city,c);assert.equal(c.indoorLocation.buildingId,b.id);assert.equal(c.indoorLocation.targetRoomType,'workspace');assert.equal(city.units.get(c.indoorLocation.unitId).roomType,'dining');assert(workCellReady(city,c,b));
});
test('an upper floor has a real accessible seat where food can be consumed',()=>{
 const {city,b,c}=fixture(),room=b.units.find(u=>u.z===b.floors-1&&u.roomType==='dining');c.task='food';c.targetId=b.id;c.entity.x=b.door.x;c.entity.y=b.door.y;c.path=[];c.needs.food=5;
 activityRoomReady(city,c,b,room,'dining');finishActivityRoute(city,c);assert.equal(c.indoorLocation.floor,b.floors-1);const stock=b.inventory.pao;city.performTask(c);assert(c.needs.food>5);assert(b.inventory.pao<stock);
});

test('a stocked market serves food at its counter without demanding an nonexistent dining room',()=>{
 const {city,c}=fixture(),shop=city.buildings.find(b=>b.type==='cycle_shop');assert(shop);shop.type='market';shop.inventory.maca=30;shop.inventory.pao=0;shop.active=true;
 assert(!shop.units.some(u=>u.roomType==='dining'));city.transfer('treasury',c.accountId,100000,'Fixture food budget');
 c.task='food';c.targetId=shop.id;c.path=[];c.entity.x=shop.door.x;c.entity.y=shop.door.y;c.needs.food=5;
 finishActivityRoute(city,c);assert.equal(c.indoorLocation.targetRoomType,'service');const before=shop.inventory.maca;city.performTask(c);assert(c.needs.food>5);assert(shop.inventory.maca<before);
});
test('an exhausted food offer releases its waiting customer to look elsewhere',()=>{
 const {city,b,c}=fixture();for(const good in b.inventory)b.inventory[good]=0;
 c.task='food';c.targetId=b.id;c.path=[];c.entity.x=b.door.x;c.entity.y=b.door.y;c.needs.food=5;
 city.performTask(c);assert.equal(c.task,null);assert.equal(c.targetId,null);assert.equal(c.serviceQueue,null);assert.match(c.action,/Alimento indisponível/);
});
