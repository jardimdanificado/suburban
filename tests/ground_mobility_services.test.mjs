import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney,finishShipment,putAtWorkCell} from './helpers/city.mjs';
import {VEHICLE_SPECS,VEHICLE_RECIPES} from '../js/city_vehicles.js';
import {CIVIC_SERVICES,civicStatus,civicVisit,renderCivicServices,planCivicServices} from '../js/city_public_services.js';
import {TILE_ROAD_GRASS_STONE} from '../js/world_gen.js';
import {surfaceElevation} from '../js/city_terrain.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
function building(city,type){
 for(const site of city.economy.locateBuilding(type)){
  const b=city.addBuilding(type,site.x,site.y,{...site,floors:1,free:true});if(!b)continue;
  city.economy.activateMunicipalBusiness(b,100000);return b;
 }
 throw Error(`Missing site: ${type}`);
}
function hospital(){
 const city=setup({starter:true,population:64}),b=building(city,'hospital'),people=city.citizens.filter(c=>!city.politics.officeHolder(c)&&!c.businessIds.length);
 for(const c of people.slice(0,2)){city.economy.leaveJob(c);c.jobId=b.id;b.workers.push(c.id);c.task='work';c.path=[];c.targetId=b.id;c.entity.x=b.door.x;c.entity.y=b.door.y;putAtWorkCell(city,c,b);}
 const c=people[2];city.economy.leaveJob(c);c.entity.x=b.door.x;c.entity.y=b.door.y;c.task='health';c.targetId=b.id;c.needs.health=20;
 b.inventory.remedio=10;b.inventory.sabao=10;return {city,b,c,people};
}
test('only human-powered mobility is offered and recipes need actual industrial inputs',()=>{
 const city=setup({starter:true});assert.deepEqual(Object.keys(VEHICLE_SPECS),['bicicleta','bicicleta_carga','patinete','patins','skate']);
 for(const old of ['carro','caminhao','onibus','carruagem'])assert.equal(city.economy.goods[old],undefined);
 for(const old of ['automaker','dealership','fuel_station','bus_operator'])assert.equal(city.buildingTypes[old],undefined);
 for(const recipe of Object.values(VEHICLE_RECIPES))for(const g of Object.keys(recipe))assert(city.economy.goods[g]);
 assert.equal(city.vehicles.air,undefined);
});
test('every bicycle, skate and skating model assembles from consumed parts without oil',()=>{
 const city=setup({starter:true,population:64}),b=building(city,'cycle_assembler'),c=city.citizens.find(c=>!city.politics.officeHolder(c)),initialUnits=city.vehicles.units.size;
 for(const kind of ['bicicleta','bicicleta_carga','patins']){
  assert(city.vehicles.configureAssembly(b.id,kind,1));const recipe=VEHICLE_RECIPES[kind];for(const [g,n]of Object.entries(recipe))b.inventory[g]=n;
  for(let i=0;i<100;i++)city.vehicles.assemblyWork(b,c);
  assert.equal(b.inventory[kind],1);for(const g of Object.keys(recipe))assert.equal(b.inventory[g],0);
 }
 const skate=building(city,'skate_workshop');for(const [g,n]of Object.entries(VEHICLE_RECIPES.skate))skate.inventory[g]=n;
 for(let i=0;i<100;i++)city.vehicles.assemblyWork(skate,c);assert.equal(skate.inventory.skate,1);
 assert.equal(city.vehicles.units.size,initialUnits+4);
});
test('a citizen rides on road paths, stays on the ground and equipment wears down',()=>{
 const city=setup({starter:true,population:48}),b=building(city,'cycle_assembler'),c=city.citizens.find(c=>!city.politics.officeHolder(c));
 city.vehicles.registerUnits(b,'bicicleta',1);const v=[...city.vehicles.units.values()].at(-1);city.vehicles.activate(v,c.accountId,b);
 for(let x=10;x<=30;x++)city.world.setTile(x,10,TILE_ROAD_GRASS_STONE);
 c.entity.x=v.x=v.entity.x=10.5;c.entity.y=v.y=v.entity.y=10.5;c.path=Array.from({length:20},(_,i)=>({x:11.5+i,y:10.5}));c.task='leisure';
 assert(city.vehicles.tryTrip(c));city.vehicles.update(.1);assert.equal(c.ridingVehicleId,v.id);assert(v.distance>0);
 for(let i=0;i<100&&c.ridingVehicleId;i++)city.vehicles.update(.1);
 assert.equal(c.ridingVehicleId,null);assert(Math.abs(c.entity.x-30.5)<.001);assert(v.condition<100);assert.equal(v.altitude,surfaceElevation(city.world,v.x,v.y));assert.equal(v.fuelStore,undefined);
});
test('road equipment never crosses water even if its path becomes invalid',()=>{
 const city=setup({starter:true,population:48}),b=building(city,'cycle_assembler'),c=city.citizens.find(c=>!city.politics.officeHolder(c));
 city.vehicles.registerUnits(b,'patins',1);const v=[...city.vehicles.units.values()].at(-1);city.vehicles.activate(v,c.accountId,b);
 c.entity.x=v.x=v.entity.x=10.5;c.entity.y=v.y=v.entity.y=10.5;city.world.setTile(11,10,2);
 v.driverId=c.id;c.ridingVehicleId=v.id;c.mobilityTrip={vehicleId:v.id,stage:'riding'};c.path=[{x:11.5,y:10.5}];city.vehicles.update(.5);assert.equal(c.entity.x,10.5);assert.equal(c.ridingVehicleId,null);
});
test('hospital treatment requires present staff and consumes real supplies once per visit',()=>{
 const {city,b,c}=hospital(),money=totalMoney(city);assert(civicStatus(city,b,c).ready);
 assert(civicVisit(city,c,b));assert.equal(c.needs.health,24);assert.equal(b.inventory.remedio,9);assert.equal(b.inventory.sabao,9);
 civicVisit(city,c,b);assert.equal(b.inventory.remedio,9);assert.equal(totalMoney(city),money);
 c.needs.health=94;civicVisit(city,c,b);assert.equal(b.completedVisits,1);assert.equal(c.task,null);
 city.minute++;b.workers=[];assert.equal(civicStatus(city,b).ready,false);
});
test('open-air civic visitors are checked at the entrance without requiring a work cell',()=>{
 const {city,b,c}=hospital();b.constructionKind='open-air';for(const id of b.workers){const worker=city.society.citizen(id);worker.workCell={buildingId:b.id,target:{x:b.door.x,y:b.door.y}};}c.workCell=null;c.civicVisit={buildingId:b.id,need:'health',startedAt:city.minute};
 assert(civicVisit(city,c,b));assert(c.civicVisit);assert(civicVisit(city,c,b));assert.equal(c.needs.health,28);
});
test('hospital capacity prevents extra patients and shortages are explained',()=>{
 const {city,b,c,people}=hospital();for(const patient of people.slice(2,11)){patient.entity.x=b.door.x;patient.entity.y=b.door.y;patient.targetId=b.id;patient.task='health';patient.needs.health=20;civicVisit(city,patient,b);}
 assert.equal(b.serviceVisits,8);const last=people[10];assert.equal(last.civicVisit,undefined);assert.match(last.action,/Lotação/);
 const fresh=hospital();fresh.b.inventory.remedio=0;assert.match(civicStatus(fresh.city,fresh.b,fresh.c).reason,/Remédio/);
});
test('library uses durable books and real staff; sports and parks improve leisure',()=>{
 const {city,c,people}=hospital();
 for(const type of ['library','park','sports_center','theater']){
  const b=building(city,type),spec=CIVIC_SERVICES[type];
  for(const worker of people.slice(0,spec.minStaff)){city.economy.leaveJob(worker);worker.jobId=b.id;b.workers.push(worker.id);worker.task='work';worker.path=[];worker.entity.x=b.door.x;worker.entity.y=b.door.y;putAtWorkCell(city,worker,b);}
  c.entity.x=b.door.x;c.entity.y=b.door.y;c.task='leisure';c.targetId=b.id;c.needs.leisure=20;c.civicVisit=null;city.minute++;
  if(type==='library'){assert(!civicStatus(city,b,c).ready);b.inventory.livros=1;}
  assert(civicStatus(city,b,c).ready);civicVisit(city,c,b);assert(c.needs.leisure>20);if(type==='library')assert.equal(b.inventory.livros,1);
 }
});
test('new services enter demand, buy supplies through logistics and survive snapshots',()=>{
 const {city,b}=hospital();city.economy.updateDemand();for(const type of Object.keys(CIVIC_SERVICES))assert(city.economy.demands.some(d=>d.type===type));
 assert(city.economy.accepts(b,'remedio'));assert(city.economy.accepts(b,'sabao'));
 const library=building(city,'library');assert(city.economy.accepts(library,'livros'));assert(!city.economy.accepts(library,'papel'));
 const mirror=new CityStateGraph().apply(new CityStateGraph().encode({city})).city;bindCityState(mirror);assert.equal(mirror.building(b.id).type,'hospital');assert.equal(mirror.vehicles.air,undefined);
 const rows=[],p={heading:s=>rows.push(s),metrics(){},note:s=>rows.push(s),table:(cols,rs)=>rows.push(...rs.map(r=>r.cells.join(' '))),kv(){},button(){}};
 renderCivicServices({city:mirror,matches:()=>true,openBuilding(){}},p);assert(rows.some(s=>s.includes('SAÚDE')));assert(rows.some(s=>s.includes(mirror.building(b.id).entity.properties.name)));
});

test('medical supplies actually travel from a producer into hospital inventory',()=>{
 const {city,b}=hospital(),pharmacy=building(city,'pharmacy');b.inventory.remedio=0;pharmacy.inventory.remedio=4;
 const before=totalMoney(city),shipment=city.logistics.order(pharmacy,b,'remedio',2,city.economy.goods.remedio.price,{purpose:'hospital-supplies'});
 assert(shipment);finishShipment(city,shipment);assert.equal(b.inventory.remedio,2);assert.equal(pharmacy.inventory.remedio,2);assert.equal(totalMoney(city),before);
});
test('mobility units survive worker snapshots and repair consumes parts rather than fuel',()=>{
 const city=setup({starter:true,population:64}),assembler=building(city,'cycle_assembler'),workshop=building(city,'cycle_workshop'),c=city.citizens.find(c=>!city.politics.officeHolder(c));
 city.vehicles.registerUnits(assembler,'bicicleta',1);const v=[...city.vehicles.units.values()].at(-1);city.vehicles.activate(v,workshop.accountId,assembler);v.condition=40;workshop.inventory.pecas=1;
 city.economy.leaveJob(c);c.jobId=workshop.id;workshop.workers.push(c.id);c.entity.x=v.x;c.entity.y=v.y;c.path=[];
 for(let i=0;i<40&&v.condition<100;i++)city.vehicles.garageWork(workshop,c);
 assert.equal(v.condition,100);assert.equal(workshop.inventory.pecas,0);assert.equal(city.economy.consumed.pecas,1);
  const mirror=new CityStateGraph().apply(new CityStateGraph().encode({city})).city;bindCityState(mirror);assert.equal(mirror.vehicles.units.get(v.id).good,'bicicleta');assert.equal(mirror.vehicles.air,undefined);assert.equal(mirror.vehicles.spec(mirror.vehicles.units.get(v.id)).seats,2);
});

test('private treatment charges once, covers supplies and records genuine provider revenue',()=>{
 const {city,b,c,people}=hospital();b.ownerId=people[0].id;city.transfer('treasury',c.accountId,10000,'Fixture treatment funding');
 const cash=c.balance,revenue=b.totalRevenue,before=totalMoney(city);civicVisit(city,c,b);const fee=cash-c.balance;
 assert(fee>city.economy.goods.remedio.price+city.economy.goods.sabao.price);assert.equal(b.totalRevenue-revenue,fee);
 civicVisit(city,c,b);assert.equal(c.balance,cash-fee);assert.equal(totalMoney(city),before);
});

test('municipal service planning creates funded, material-dependent public works with a queue limit',()=>{
 const city=setup({starter:true,population:64}),before=totalMoney(city);
 assert(planCivicServices(city));const first=city.development.projects.find(p=>p.type==='hospital');assert(first);assert(first.builderId);assert.equal(first.status,'materials');assert(first.stone>0);assert(first.worksBudgetCharge>0);
 assert(!planCivicServices(city));city.minute+=1440;assert(planCivicServices(city));
 city.minute+=1440;assert(!planCivicServices(city));assert.equal(city.development.projects.filter(p=>CIVIC_SERVICES[p.type]&&!p.cancelled&&p.status!=='completed').length,2);assert.equal(totalMoney(city),before);
});
