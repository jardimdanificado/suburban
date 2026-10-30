import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';

function fixture(){
 const city=setup({starter:true,population:64}),c=city.citizens.find(c=>!city.politics.officeHolder(c));
 city.economy.leaveJob(c);c.businessIds=[];c.homeUnitId=null;c.homeId=null;c.path=[];c.indoorLocation=null;c.conversation=null;
 for(const k in c.needs)c.needs[k]=95;c.needs.energy=0;city.routeHomelessToSleep(c);
 assert(c.homelessSleepSpot);const oldSpot={...c.homelessSleepSpot},oldKey=c.cardboardShelterKey;c.path=[];return {city,c,oldSpot,oldKey};
}
function assertCanRest({city,c,oldSpot,oldKey}){
 city.routeHomelessToSleep(c);assert(c.homelessSleepSpot);assert.notDeepEqual(c.homelessSleepSpot,oldSpot);assert(!city.cardboardShelters.has(oldKey));
 assert.equal([...city.cardboardShelters.values()].filter(s=>s.citizenId===c.id).length,1);assert.equal(c.inventory.papelao,0);
 c.entity.x=c.homelessSleepSpot.x;c.entity.y=c.homelessSleepSpot.y;c.path=[];const energy=c.needs.energy;city.performTask(c);assert(c.needs.energy>energy);
}

test('a sleeping place made impassable by a terrain change is replaced instead of retried forever',()=>{
 const f=fixture();f.city.world.setTile(Math.floor(f.oldSpot.x),Math.floor(f.oldSpot.y),2);assertCanRest(f);
});

test('a sleeping place isolated from the resident is replaced even when its own tile remains walkable',()=>{
 const f=fixture(),x=Math.floor(f.oldSpot.x),y=Math.floor(f.oldSpot.y);
 for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])f.city.world.setTile(x+dx,y+dy,2);
 assert(f.city.walkable(x,y));assert.equal(f.city.findPath(f.c.entity,f.oldSpot),null);assertCanRest(f);
});

test('an accessible sleeping place is reused without consuming another piece of cardboard',()=>{
 const {city,c,oldSpot,oldKey}=fixture();city.routeHomelessToSleep(c);assert.deepEqual(c.homelessSleepSpot,oldSpot);assert.equal(c.cardboardShelterKey,oldKey);assert.equal(c.inventory.papelao,0);
});
