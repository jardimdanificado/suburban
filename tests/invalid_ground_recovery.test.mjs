import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../js/world.js';
import {CitySimulation} from '../js/city_simulation.js';

test('a resident stranded over the lake in seed 2120920325 returns to reachable land and can obtain care and water',()=>{
 let id=0;const seed=2120920325,world=new World(2,seed,256),city=new CitySimulation({world,seed,population:512,createEntity:data=>({id:++id,destroyed:false,...data})});city.initialize();
 const c=city.citizens.find(c=>c.id===64);city.economy.leaveJob(c);c.businessIds=[];c.path=[];c.task=null;c.indoorLocation=null;c.deliveryId=null;c.cleaningJobId=null;c.mobilityTrip=null;c.ridingVehicleId=null;c.skybridgeTransit=null;c.skybridgeZ=0;c.conversation=null;
 c.entity.x=132.6622776601684;c.entity.y=139.98683298050514;for(const key in c.needs)c.needs[key]=95;c.needs.health=0;c.needs.water=0;c.pocket.water=0;c.deprivation={food:0,water:10,health:10};const needs={...c.needs};
 assert.equal(city.walkable(Math.floor(c.entity.x),Math.floor(c.entity.y)),false);assert.equal(city.occupied.has(`${Math.floor(c.entity.x)},${Math.floor(c.entity.y)}`),false,'the invalid cell is water rather than a building');
 assert(city.life.recoverBlockedPosition(c));assert.deepEqual(c.needs,needs);assert(city.walkable(Math.floor(c.entity.x),Math.floor(c.entity.y)));
 assert.notEqual(city.findPath(c.entity,city.buildings.find(b=>b.type==='townhall').door),null);
 for(let i=0;i<150&&!c.entity.destroyed;i++)city.update(.25);
 assert(!c.entity.destroyed);assert(c.needs.health>20);assert(c.needs.water>20);
});
