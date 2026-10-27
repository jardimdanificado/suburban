import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney} from './helpers/city.mjs';

test('initial government staff have normal bikes and builders and carriers have cargo bikes',()=>{
 const city=setup({starter:true,population:64}),units=[...city.vehicles.units.values()];
 for(const type of ['townhall','builder','carrier']){
  const b=city.buildings.find(b=>b.type===type);assert(b?.active);assert(b.workers.length>0);
  for(const id of b.workers){const c=city.society.citizen(id),bikes=units.filter(v=>v.ownerAccountId===c.accountId);assert.equal(bikes.length,1);const bike=bikes[0];
   assert.equal(bike.good,type==='townhall'?'bicicleta':'bicicleta_carga');assert.equal(bike.initialEmployerId,b.id);assert(bike.initial&&bike.active&&!bike.scrapped);assert(bike.entity&&!bike.entity.destroyed);assert.equal(bike.entity.properties.cityVehicle,bike);assert(bike.parking);const rack=city.building(bike.parking.rackId);assert.equal(rack.bikeSlots[bike.parking.index].vehicleId,bike.id);assert.equal(bike.entity.x,bike.parking.x);assert.equal(bike.entity.y,bike.parking.y);assert.equal(bike.manufacturerId,null);assert.equal(city.vehicles.model(bike).brand,'Equipamento inicial');
  }
 }
 const expected=city.buildings.filter(b=>['townhall','builder','carrier'].includes(b.type)).reduce((n,b)=>n+b.workers.length,0);assert.equal(units.length,expected);
 assert.equal(totalMoney(city),32000000);
 for(const good of ['bicicleta','bicicleta_carga']){assert.equal(city.economy.initialStock[good],units.filter(v=>v.good===good).length);assert.equal(city.goodsStock(good),city.economy.initialStock[good]);assert.equal(city.economy.produced[good],0);}
});
test('the initial equipment grant is idempotent and does not keep issuing new bicycles',()=>{
 const city=setup({starter:true,population:64}),count=city.vehicles.units.size,money=totalMoney(city),stock=city.economy.initialStock.bicicleta_carga;
 city.vehicles.equipInitialWorkers();city.vehicles.hourly();assert.equal(city.vehicles.units.size,count);assert.equal(city.economy.initialStock.bicicleta_carga,stock);assert.equal(totalMoney(city),money);
});
test('initial bikes are usable on a normal citizen trip from the beginning',()=>{
 const city=setup({starter:true,population:64}),b=city.buildings.find(b=>b.type==='carrier'),c=city.society.citizen(b.workers[0]),bike=[...city.vehicles.units.values()].find(v=>v.ownerAccountId===c.accountId);
 c.path=city.findPath(c.entity,b.door);c.task='work';c.targetId=b.id;c.lastVehicleSearchAt=-Infinity;c.conversation=null;c.workMeal=null;
 assert(city.vehicles.tryTrip(c));for(let i=0;i<30&&!bike.distance;i++)city.update(1/16);assert(bike.distance>0);assert.equal(bike.good,'bicicleta_carga');
});
