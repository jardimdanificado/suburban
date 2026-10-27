import {ROAD_TILES,tileAt} from '../js/city_terrain.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney,finishShipment} from './helpers/city.mjs';
import {INITIAL_CYCLE_STAGES} from '../js/city_cycle_startup.js';
import {VEHICLE_RECIPES} from '../js/city_vehicles.js';
import {renderVehicle,renderParking} from '../js/city_vehicles_ui.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
function firstBike(city){return [...city.vehicles.units.values()].find(v=>v.good==='bicicleta_carga');}
function panel(){const text=[],buttons=[];return {text,actions:buttons,buttons:items=>buttons.push(...items),heading:s=>text.push(s),status:(...s)=>text.push(s.join(' ')),note:s=>text.push(s),metrics(){},kv:(...s)=>text.push(s.join(': ')),button:(label,click)=>buttons.push({label,click}),record:(...s)=>text.push(s.slice(0,2).join(' ')),table:(cols,rows)=>text.push(...rows.map(r=>r.cells.join(' ')))};}
test('foundation starts the public cycle chain with funded premises and real raw-material reserves',()=>{
 const city=setup({starter:true,population:128});for(const type of INITIAL_CYCLE_STAGES){const b=city.buildings.find(b=>b.type===type&&b.initialCycleChain);assert(b,`Missing ${type}`);assert(b.active&&b.municipal);assert(b.balance>0);assert(b.workers.length>0,`No workers in ${type}`);assert(b.units.every(u=>u.ownerId==='treasury'));}
 const assembler=city.buildings.find(b=>b.type==='cycle_assembler');assert.equal(assembler.inventory.bicicleta,0);assert.equal(assembler.inventory.quadro,0);assert(city.economy.initialStock.aco>0);assert.equal(totalMoney(city),city.currency.netIssued());
});
test('initial bicycles occupy unique real rack slots and reservations cannot double-book',()=>{
 const city=setup({starter:true,population:64}),system=city.vehicles,report=system.parkingReport(),units=[...system.units.values()];assert.equal(report.sites.length,2);assert.equal(report.capacity,32);assert.equal(report.occupied,units.length);
 const slots=new Set(units.map(v=>`${v.parking.rackId}:${v.parking.index}`));assert.equal(slots.size,units.length);
 const rack=report.sites[0],a=system.reserveParking(units[0],rack.door),b=system.reserveParking(units[1],rack.door);assert(a&&b);assert.notEqual(a.index,b.index);
 units[0].reservedParking=a;system.freeParking(units[0],true);assert.equal(rack.bikeSlots[a.index].reservedBy,null);
});
test('a trip frees the original rack, parks at its reserved destination and continues on foot',()=>{
 const city=setup({starter:true,population:64}),system=city.vehicles,v=firstBike(city),c=city.accounts.get(v.ownerAccountId),origin=v.parking,dest=system.parkingSites()[1],spot=system.reserveParking(v,dest.door);assert(spot);
 c.entity.x=v.x;c.entity.y=v.y;c.path=[];c.task='work';c.targetId=city.buildings.find(b=>b.type==='builder').id;c.mobilityTrip={kind:'cycle',vehicleId:v.id,goal:dest.door,stage:'boarding'};v.driverId=c.id;v.reservedParking=spot;
 system.update(.01);assert.equal(city.building(origin.rackId).bikeSlots[origin.index].vehicleId,null);
 for(let i=0;i<1000&&c.ridingVehicleId;i++)system.update(.05);
 assert.equal(v.parking.rackId,dest.id);assert.equal(dest.bikeSlots[spot.index].vehicleId,v.id);assert.equal(c.ridingVehicleId,null);assert.equal(v.reservedParking,null);assert(v.parkingHistory.length>0);
});
test('bicycles offer a nearby passenger a ride toward a shared destination and can turn the ride into friendship',()=>{
 const city=setup({starter:true,population:64}),system=city.vehicles,v=firstBike(city),[driver,passenger]=city.citizens.filter(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c)).slice(0,2),goal={x:91,y:91};
 driver.entity.x=v.x;driver.entity.y=v.y;driver.mobilityTrip={vehicleId:v.id,goal,stage:'riding'};v.driverId=driver.id;v.passengerIds=[];
 passenger.entity.x=v.x+.8;passenger.entity.y=v.y;passenger.path=[{x:goal.x+.5,y:goal.y}];passenger.task='walk';
 const hostile=city.society.getRelation(driver,passenger,true);hostile.views[driver.id].affection=-10;hostile.views[passenger.id].affection=10;
 assert.equal(system.tryCarpool(v,driver),false,'the rider refuses someone they dislike');
 hostile.views[driver.id].affection=10;hostile.views[passenger.id].affection=-10;
 assert.equal(system.tryCarpool(v,driver),false,'the pedestrian can also refuse the rider');
 hostile.views[passenger.id].affection=10;passenger.path=[{x:goal.x+2,y:goal.y}];
 assert.equal(system.tryCarpool(v,driver),true);assert.deepEqual(v.passengerIds,[passenger.id]);assert.equal(passenger.ridingVehicleId,v.id);assert(passenger.ridingAsPassenger);assert.equal(hostile.views[driver.id].status,'friend');assert.equal(hostile.views[passenger.id].status,'friend');
 system.detachPassenger(passenger,v,false);assert.equal(passenger.ridingVehicleId,null);assert.equal(v.passengerIds.length,0);
});
test('full racks refuse additional reservations and cancellation frees a reserved slot',()=>{
 const city=setup({starter:true,population:64}),system=city.vehicles,v=firstBike(city),rack=system.parkingSites()[0];
 for(const b of system.parkingSites())for(const slot of b.bikeSlots)if(slot.vehicleId==null)slot.reservedBy=99999;
 assert.equal(system.reserveParking(v,rack.door),null);
 const slot=rack.bikeSlots.find(s=>s.reservedBy===99999);slot.reservedBy=v.id;v.reservedParking={rackId:rack.id,index:slot.index,x:slot.x,y:slot.y};const c=city.accounts.get(v.ownerAccountId);c.mobilityTrip={vehicleId:v.id};system.releaseTrip(c);assert.equal(slot.reservedBy,null);
});
test('scooters use real component sets and can occupy bicycle rack slots',()=>{
 const city=setup({starter:true,population:64}),b=city.buildings.find(b=>b.type==='cycle_assembler'),worker=city.society.citizen(b.workers[0]);assert(city.vehicles.configureAssembly(b.id,'patinete',1));
 for(const [g,n]of Object.entries(VEHICLE_RECIPES.patinete))b.inventory[g]=n;
 for(let i=0;i<100;i++)city.vehicles.assemblyWork(b,worker);const v=[...city.vehicles.units.values()].find(v=>v.good==='patinete');assert(v);city.vehicles.activate(v,worker.accountId,b);assert(city.vehicles.parkNearby(v,city.vehicles.parkingSites()[0].door));assert(v.parking);
});
test('commercial transfers and used sales retain owners, brand and every part supplier',()=>{
 const city=setup({starter:true,funded:true,population:64}),system=city.vehicles,assembler=city.buildings.find(b=>b.type==='cycle_assembler'),shop=city.buildings.find(b=>b.type==='cycle_shop'),worker=city.society.citizen(assembler.workers[0]);system.configureAssembly(assembler.id,'bicicleta',1);
 for(const [g,n]of Object.entries(VEHICLE_RECIPES.bicicleta)){const producer=city.buildings.find(b=>city.buildingTypes[b.type].outputs?.[g]);assembler.inventory[g]=n;(assembler.componentLots??={})[g]=[{producerId:producer.id,producerName:producer.entity.properties.name,design:2,quantity:n}];}
 for(let i=0;i<100;i++)system.assemblyWork(assembler,worker);const v=[...system.units.values()].find(v=>v.batchId);assert(v);const sale=city.logistics.order(assembler,shop,'bicicleta',1,0);assert(sale);finishShipment(city,sale);const buyer=city.citizens.find(c=>c.fixtureInvestor);assert(system.buyVehicle(buyer.accountId,v.id));
 const next=city.citizens.find(c=>c.id!==buyer.id&&c.fixtureInvestor);assert(system.transferVehicle(v.id,next.accountId,100));assert.equal(v.ownerAccountId,next.accountId);assert(v.ownershipHistory.length>=4);assert(system.model(v).components.every(p=>p.producerName&&p.design===2));
 const p=panel();renderVehicle({city,openCitizen(){},openBuilding(){},openPanel(){},openHistory(){},camera(){}},p,v);assert(p.text.includes('TODOS OS PROPRIETÁRIOS'));assert(p.text.some(t=>t.includes(buyer.entity.properties.name)));assert(p.text.some(t=>t.includes(system.model(v).brand)));
});
test('rack reservations and dossiers survive worker snapshots',()=>{
 const city=setup({starter:true,population:64}),v=firstBike(city);v.reservedParking=city.vehicles.reserveParking(v,city.vehicles.parkingSites()[1].door);v.driverId=city.accounts.get(v.ownerAccountId).id;
 const mirror=new CityStateGraph().apply(new CityStateGraph().encode({city})).city;bindCityState(mirror);assert.equal(mirror.vehicles.units.get(v.id).reservedParking.rackId,v.reservedParking.rackId);
 const p=panel();renderParking({city:mirror,openPanel(){},camera(){}},p);assert(p.text.includes('BICICLETÁRIOS · BIKES E PATINETES'));assert(p.text.some(t=>t.includes('Reservado')));
});

test('the public chain autonomously assembles a new bike or scooter from delivered local components',()=>{
 const city=setup({starter:true,population:128});city.currency.policy.mode='paused';let product;
 for(let i=0;i<2880&&!product;i++){city.update(.25);product=[...city.vehicles.units.values()].find(v=>v.batchId&&['bicicleta','bicicleta_carga','patinete'].includes(v.good));}
 assert(product,'The initial chain must complete a genuine equipment batch');const model=city.vehicles.model(product);assert(model.components.length>0);assert(model.components.every(p=>city.building(p.producerId)?.municipal&&p.producerName));assert(city.logistics.shipments.some(s=>s.buyer.id===model.manufacturerId&&s.status==='delivered'));assert.equal(totalMoney(city),city.currency.netIssued());
});
test('missing or full racks fall back to reserved spaces beside roads, never on the road',()=>{
 const city=setup({starter:true,population:64}),system=city.vehicles,v=firstBike(city),goal=system.parkingSites()[0].door;
 for(const b of system.parkingSites())for(const slot of b.bikeSlots)if(slot.vehicleId==null)slot.reservedBy=99999;
 const spot=system.destinationParking(v,goal);assert(spot);assert.equal(spot.kind,'roadside');
 assert(!ROAD_TILES.has(tileAt(city.world,Math.floor(spot.x),Math.floor(spot.y))));
 assert([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>ROAD_TILES.has(tileAt(city.world,Math.floor(spot.x)+dx,Math.floor(spot.y)+dy))));
 v.reservedParking=spot;const other=[...system.units.values()].find(o=>o.id!==v.id);const second=system.roadsideParking(other,goal);assert(second);assert.notDeepEqual(second,spot);
 assert(system.occupyParking(v,spot));assert.equal(v.status,'Estacionado ao lado da rua');
 for(const b of system.parkingSites())b.active=false;
 assert.equal(system.destinationParking(v,goal).kind,'roadside');
 const mirror=new CityStateGraph().apply(new CityStateGraph().encode({city})).city;bindCityState(mirror);assert.equal(mirror.vehicles.units.get(v.id).parking.kind,'roadside');
 system.freeParking(v);assert.equal(v.parking,null);
 const c=city.accounts.get(v.ownerAccountId);c.entity.x=v.x;c.entity.y=v.y;v.driverId=c.id;v.reservedParking=spot;c.ridingVehicleId=v.id;c.mobilityTrip={vehicleId:v.id,goal,stage:'riding'};
 system.releaseTrip(c,true);assert.equal(v.parking.kind,'roadside');assert.equal(c.ridingVehicleId,null);assert.equal(v.reservedParking,null);assert.equal(v.parkingHistory.at(-1).rackName,'Ao lado da rua');
});
