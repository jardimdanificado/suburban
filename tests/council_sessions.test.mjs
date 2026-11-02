import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';

test('the council can present and vote in the town hall while its dedicated chamber is under construction',()=>{
 const city=setup({starter:true,population:64}),gov=city.politics,council=gov.council,chamber=council.getChamber();
 assert.equal(chamber.buildings().length,0);const hall=chamber.hall();assert.equal(hall.type,'townhall');const rooms=hall.units.filter(u=>u.roomType==='plenary');assert(rooms.length>=Math.ceil(council.members.length/4));
 for(const [i,c]of council.people().entries()){const room=rooms[Math.floor(i/4)];c.task='council-session';c.targetId=hall.id;c.path=[];c.deliveryId=null;c.councilSession={buildingId:hall.id};c.indoorLocation={buildingId:hall.id,targetUnitId:room.id,unitId:room.id,roomType:'plenary',targetRoomType:'plenary',path:[],exiting:false};c.entity.x=hall.entity.x+room.x+.5;c.entity.y=hall.entity.y+room.y+.5;assert(Math.hypot(c.entity.x-hall.door.x,c.entity.y-hall.door.y)>=1.5,'the member is physically inside the room, away from the exterior door');}
 city.minute=10*60;for(const c of council.people()){chamber.arrive(c);assert.equal(c.task,'council-session','arriving inside the building must not be mistaken for leaving its exterior door');}const author=council.people()[0],bill=gov.submitBill('tax',{value:city.taxRate+.01},author.id);assert(bill);chamber.minute();assert.equal(bill.status,'proposed');assert.equal(bill.plenaryBuildingId,hall.id);city.minute+=60;chamber.minute();assert.notEqual(bill.status,'proposed');assert.equal(bill.attendance.length,council.members.length);assert(bill.votes.length>0);assert.equal(bill.waitingForQuorum,false);
});

test('the temporary town hall plenary is restored after the permanent chamber opens',()=>{
 const city=setup({starter:true,population:32}),chamber=city.politics.council.getChamber(),townhall=city.buildings.find(b=>b.type==='townhall'),interim=chamber.hall(),units=interim.units.filter(u=>u.roomType==='plenary');assert(units.length>0);const permanent={id:999,type:'council_chamber',active:true,entity:{destroyed:false},units:[],door:{x:0,y:0}};city.buildings.push(permanent);assert.equal(chamber.hall(),permanent);assert(units.every(u=>u.roomType==='workspace'));assert.equal(townhall.layoutRevision>0,true);
});

test('the running city presents and records council votes before the permanent chamber is complete',()=>{
 const city=setup({starter:true,population:64});for(let i=0;i<700&&!city.politics.council.bills.some(b=>['rejected','awaiting-sanction','approved','executing','executed'].includes(b.status));i++)city.update(.25);const council=city.politics.council,voted=council.bills.find(b=>['rejected','awaiting-sanction','approved','executing','executed'].includes(b.status));assert(voted,'a bill should pass through presentation and voting');assert.equal(council.getChamber().buildings().length,0);assert.equal(voted.attendance.length,council.members.length);assert(voted.votes.length>0);assert(voted.participationWeight>=voted.requiredQuorum);
});
