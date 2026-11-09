import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {WorldCoordinator} from '../js/world_coordinator.js';
import {WorldTradeService} from '../js/world_trade_service.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';

function attach(city,id){
  city.worldPort.cityId=id;
  const bridge={active:true,time:{paused:false,speed:1},async request(method,args){try{return {ok:true,value:city[method](...args)}}catch(error){return {ok:false,message:error.message}}}};
  return {id,city,world:city.world,entities:[],nextId:1,time:bridge.time,bridge,metadata:{name:id}};
}

test('citizen migration reserves, sails, and reconstructs one stable global identity exactly once',async()=>{
  const originCity=setup({starter:true,population:24}),destinationCity=setup({starter:true,population:24});
  const citizen=originCity.citizens.find(c=>originCity.society.isAdult(c)&&!c.entity.destroyed&&!c.dead&&!c.jobId&&!c.homeUnitId&&!c.businessIds.length&&!c.partnerId&&!c.childIds.length&&!c.custody&&!c.deliveryId&&!c.mobilityTrip&&!c.ridingVehicleId&&!c.indoorLocation&&!c.expectingId);
  assert(citizen,'fixture needs an eligible adult citizen');
  citizen.balance=12345;originCity.accounts.get(citizen.accountId).balance=12345;citizen.skills.management=87.25;citizen.needs.food=72;citizen.social.memories=[{kind:'friendship',minute:originCity.minute,factId:1,eventId:1,actorId:citizen.id,otherId:3,description:'Uma amizade lembrada.'}];citizen.political.partyId='party-stable';citizen.reputation.score=74;citizen.pocket.water=5;
  const acquaintance=originCity.citizens.find(other=>other!==citizen&&!other.dead);citizen.social.memories[0].otherId=acquaintance.id;const relation=originCity.society.getRelation(citizen,acquaintance,true);relation.views[citizen.id].affection=81;
  const beforeOrigin=originCity.citizens.length,globalId=`origin:${citizen.id}`;
  const world=new WorldCoordinator({minute:originCity.minute}),origin=attach(originCity,'origin'),destination=attach(destinationCity,'destination');
  world.registerCity('origin',origin);world.registerCity('destination',destination);world.addVessel({id:'migration-ferry',capacity:100});world.connectPorts({id:'route:origin>destination',originPortId:'origin:port',destinationPortId:'destination:port',travelMinutes:30,capacity:100});
  const service=new WorldTradeService(world),departure=world.minute+1;await service.scheduleMigration({id:'move-1',originCityId:'origin',destinationCityId:'destination',citizenId:citizen.id,departureMinute:departure});
  assert.equal(originCity.citizens.length,beforeOrigin);assert.equal(world.transfers.get('move-1').payload.package.globalId,globalId);
  await world.advanceTo(departure,world.transferHandlers);
  assert.equal(world.transfers.get('move-1').status,'in-transit');assert.equal(originCity.citizens.includes(citizen),false);assert.equal(originCity.accounts.has(citizen.accountId),false);
  world.reportCityMinute('origin',departure+30);world.reportCityMinute('destination',departure+30);await world.flushTransfers();
  const arrived=destinationCity.citizens.find(c=>c.globalId===globalId);assert(arrived);assert.equal(arrived.balance,12345);assert.equal(arrived.skills.management,87.25);assert.equal(arrived.needs.food,72);assert.deepEqual(arrived.social.memories,[]);const archived=arrived.worldLinks.socialHistory.memories[0];assert.equal(archived.description,'Uma amizade lembrada.');assert.equal(archived.worldRefs.otherIdGlobalId,`origin:${acquaintance.id}`);assert.equal(Object.hasOwn(archived,'factId'),false);assert.equal(Object.hasOwn(archived,'eventId'),false);assert.equal(arrived.political.partyId,'party-stable');assert.equal(arrived.reputation.score,74);assert.equal(arrived.pocket.water,5);assert.deepEqual(arrived.worldLinks.relationships.find(item=>item.globalId===`origin:${acquaintance.id}`).view.affection,81);assert.equal(world.transfers.get('move-1').status,'delivered');
  await world.flushTransfers();assert.equal(destinationCity.citizens.filter(c=>c.globalId===globalId).length,1);const onward=destinationCity.worldCitizenMigrationPackage('move-again',arrived.id);assert.equal(onward.socialHistory.memories.length,1);assert.equal(onward.relationships.some(item=>item.globalId===`origin:${acquaintance.id}`),true);
});

test('a working independent adult may reserve a passage and only leaves work and rental housing at departure',()=>{
  const city=setup({starter:true,population:24}),citizen=city.citizens.find(person=>city.society.isAdult(person)&&!person.partnerId&&!person.childIds?.length&&!person.businessIds?.length&&![...city.units.values()].some(unit=>unit.ownerId===person.accountId)&&![...city.vehicles.units.values()].some(vehicle=>vehicle.ownerAccountId===person.accountId));
  assert(citizen);city.worldPort.cityId='home';
  const employer=city.buildings.find(building=>building.active&&!building.entity.destroyed&&building.jobs>0),rental=[...city.units.values()].find(unit=>unit.roomType==='bedroom'&&unit.ownerId!==citizen.accountId);
  assert(employer&&rental);citizen.jobId=employer.id;employer.workers.push(citizen.id);citizen.homeUnitId=rental.id;citizen.homeId=rental.homeId;rental.tenantId=citizen.accountId;
  const reservation=city.reserveWorldCitizenMigration('work-and-rent',citizen.id);assert(reservation);assert.equal(citizen.jobId,employer.id);assert.equal(citizen.homeUnitId,rental.id);
  const checkpoint=new CityStateGraph().apply(structuredClone(new CityStateGraph().encode({city,entities:[],nextId:10000}))).city;bindCityState(checkpoint);
  assert.equal(checkpoint.cancelWorldCitizenMigration('work-and-rent'),true);assert.equal(checkpoint.society.citizen(citizen.id).jobId,employer.id);assert.equal(checkpoint.society.citizen(citizen.id).homeUnitId,rental.id);assert.equal(checkpoint.units.get(rental.id).tenantId,citizen.accountId);
  assert.equal(city.cancelWorldCitizenMigration('work-and-rent'),true);assert.equal(citizen.jobId,employer.id);assert.equal(citizen.homeUnitId,rental.id);
  assert(city.reserveWorldCitizenMigration('work-and-rent-again',citizen.id));
  assert.equal(city.departWorldCitizenMigration('work-and-rent-again'),true);
  assert.equal(employer.workers.includes(citizen.id),false);assert.equal(citizen.jobId,null);assert.equal(citizen.homeUnitId,null);assert.equal(rental.tenantId,null);
  const familyCandidate=city.citizens.find(person=>city.society.isAdult(person));familyCandidate.partnerId=999;
  assert.equal(city.reserveWorldCitizenMigration('family',familyCandidate.id),false);familyCandidate.partnerId=null;
  const transitCandidate=city.citizens.find(person=>city.society.isAdult(person));transitCandidate.deliveryId='shipment';
  assert.equal(city.reserveWorldCitizenMigration('transit',transitCandidate.id),false);
});

test('an in-flight migration reservation survives a complete city-state graph checkpoint',()=>{
  const city=setup({starter:true,population:24});city.worldPort.cityId='checkpoint';
  const citizen=city.citizens.find(c=>city.society.isAdult(c)&&!c.jobId&&!c.homeUnitId&&!c.businessIds.length&&!c.partnerId&&!c.childIds?.length&&!c.deliveryId&&!c.custody&&!c.indoorLocation&&!c.expectingId);
  assert(citizen);const packageData=city.reserveWorldCitizenMigration('move-checkpoint',citizen.id);assert(packageData);
  const graph=new CityStateGraph(),snapshot=structuredClone(graph.encode({city,entities:[],nextId:10000})),restored=new CityStateGraph().apply(snapshot).city;bindCityState(restored);
  assert.equal(restored.worldPort.migrations['move-checkpoint'].package.globalId,packageData.globalId);
  assert.equal(restored.society.citizen(citizen.id).worldMigrationPending,'move-checkpoint');
  assert.equal(restored.departWorldCitizenMigration('move-checkpoint'),true);
  assert.equal(restored.society.citizen(citizen.id),undefined);
});

test('migration delivery retries after a committed but unacknowledged arrival without duplicating the citizen',async()=>{
  const originCity=setup({starter:true,population:24}),destinationCity=setup({starter:true,population:24});
  const citizen=originCity.citizens.find(c=>originCity.society.isAdult(c)&&!c.entity.destroyed&&!c.dead&&!c.jobId&&!c.homeUnitId&&!c.businessIds.length&&!c.partnerId&&!c.childIds.length&&!c.custody&&!c.deliveryId&&!c.mobilityTrip&&!c.ridingVehicleId&&!c.indoorLocation&&!c.expectingId);
  const world=new WorldCoordinator({minute:originCity.minute}),origin=attach(originCity,'origin'),destination=attach(destinationCity,'destination');
  world.registerCity('origin',origin);world.registerCity('destination',destination);world.addVessel({id:'migration-ferry',capacity:100});world.connectPorts({id:'route:origin>destination',originPortId:'origin:port',destinationPortId:'destination:port',travelMinutes:30,capacity:100});
  const service=new WorldTradeService(world),departure=world.minute+1;await service.scheduleMigration({id:'move-retry',originCityId:'origin',destinationCityId:'destination',citizenId:citizen.id,departureMinute:departure});
  await world.advanceTo(departure,world.transferHandlers);
  const transfer=world.transfers.get('move-retry'),globalId=transfer.payload.globalId,baseRequest=destination.bridge.request.bind(destination.bridge);let loseFirstAck=true;
  destination.bridge.request=async(method,args)=>{const result=await baseRequest(method,args);if(method==='receiveWorldCitizenMigration'&&loseFirstAck){loseFirstAck=false;return {ok:false,value:false,message:'ack perdido após commit'};}return result;};
  await world.advanceTo(departure+30,world.transferHandlers);
  assert.equal(transfer.status,'in-transit');assert.equal(destinationCity.citizens.filter(c=>c.globalId===globalId).length,1);
  await world.advanceTo(departure+30,world.transferHandlers);
  assert.equal(transfer.status,'delivered');assert.equal(destinationCity.citizens.filter(c=>c.globalId===globalId).length,1);assert.equal(originCity.citizens.some(c=>c.globalId===globalId),false);
});

test('restoring city graphs and the world ledger during a voyage completes migration exactly once',async()=>{
  const originCity=setup({starter:true,population:24}),destinationCity=setup({starter:true,population:24});
  const citizen=originCity.citizens.find(c=>originCity.society.isAdult(c)&&!c.entity.destroyed&&!c.dead&&!c.jobId&&!c.homeUnitId&&!c.businessIds.length&&!c.partnerId&&!c.childIds.length&&!c.custody&&!c.deliveryId&&!c.mobilityTrip&&!c.ridingVehicleId&&!c.indoorLocation&&!c.expectingId);
  assert(citizen,'fixture needs an eligible adult citizen');
  const originalGlobalId=`origin:${citizen.id}`,world=new WorldCoordinator({minute:originCity.minute});
  const origin=attach(originCity,'origin'),destination=attach(destinationCity,'destination');
  world.registerCity('origin',origin);world.registerCity('destination',destination);world.addVessel({id:'recovery-ferry',capacity:10});world.connectPorts({id:'route:origin>destination',originPortId:'origin:port',destinationPortId:'destination:port',travelMinutes:30,capacity:10});
  const service=new WorldTradeService(world),departure=world.minute+1;
  await service.scheduleMigration({id:'migration-world-recovery',originCityId:'origin',destinationCityId:'destination',citizenId:citizen.id,departureMinute:departure});
  await world.advanceTo(departure,world.transferHandlers);
  assert.equal(world.transfers.get('migration-world-recovery').status,'in-transit');

  const saveCity=session=>structuredClone(new CityStateGraph().encode({city:session.city,entities:[],nextId:1}));
  const loadCity=(id,packet)=>{const state=new CityStateGraph().apply(structuredClone(packet));bindCityState(state.city);let nextId=10000;state.city.createEntity=({x=0,y=0,properties={},...data})=>({id:nextId++,x,y,destroyed:false,...data,properties});return attach(state.city,id);};
  const saved={coordinator:world.snapshot(),origin:saveCity(origin),destination:saveCity(destination)};
  const restoredOrigin=loadCity('origin',saved.origin),restoredDestination=loadCity('destination',saved.destination),restoredWorld=new WorldCoordinator();
  const recoveryErrors=[];restoredWorld.onChange=event=>{if(event.type==='transfer-processing-error')recoveryErrors.push(event.message);};
  restoredWorld.registerCity('origin',restoredOrigin);restoredWorld.registerCity('destination',restoredDestination);restoredWorld.restore(saved.coordinator);
  new WorldTradeService(restoredWorld);
  await restoredWorld.advanceTo(departure+30,restoredWorld.transferHandlers);

  const arrivals=restoredDestination.city.citizens.filter(person=>person.globalId===originalGlobalId);
  assert.equal(restoredWorld.transfers.get('migration-world-recovery').status,'delivered',recoveryErrors.join('; '));
  assert.equal(arrivals.length,1);
  assert.equal(restoredOrigin.city.citizens.some(person=>person.globalId===originalGlobalId),false);
  assert.equal(restoredOrigin.city.worldPort.migrations['migration-world-recovery'].status,'delivered');
  assert.equal(restoredDestination.city.worldPort.migrantArrivals['migration-world-recovery'].status,'delivered');
  await restoredWorld.advanceTo(departure+30,restoredWorld.transferHandlers);
  assert.equal(restoredDestination.city.citizens.filter(person=>person.globalId===originalGlobalId).length,1);
});

test('restoring both city graphs during a family voyage reconnects the household exactly once',async()=>{
  const originCity=setup({starter:true,population:24}),destinationCity=setup({starter:true,population:24});
  const candidates=originCity.citizens.filter(person=>originCity.society.isAdult(person)&&!person.jobId&&!person.businessIds?.length&&!person.partnerId&&!person.childIds?.length&&!person.expectingId&&![...originCity.units.values()].some(unit=>unit.ownerId===person.accountId)&&![...originCity.vehicles.units.values()].some(vehicle=>vehicle.ownerAccountId===person.accountId));
  const parent=candidates[0],child=candidates[1];assert(parent&&child);
  for(const person of [parent,child]){person.jobId=null;person.businessIds=[];person.deliveryId=null;person.mobilityTrip=null;person.ridingVehicleId=null;person.custody=null;person.indoorLocation=null;person.expectingId=null;person.worldMigrationPending=null;person.childIds=[];person.partnerId=null;person.guardianId=null;}
  child.initialAge=10;child.bornAt=originCity.minute;child._ageValue=10;child._nextBirthdayAt=originCity.minute+1440*12;child.parentIds=[parent.id];child.guardianId=parent.id;parent.childIds=[child.id];parent.parentIds=[];originCity.society.getRelation(parent,child,true);
  const originalIds=new Map([parent,child].map(person=>[person.id,`${'origin'}:${person.id}`]));
  const world=new WorldCoordinator({minute:originCity.minute}),origin=attach(originCity,'origin'),destination=attach(destinationCity,'destination');
  world.registerCity('origin',origin);world.registerCity('destination',destination);world.addVessel({id:'family-recovery-ferry',capacity:10});world.connectPorts({id:'route:origin>destination',originPortId:'origin:port',destinationPortId:'destination:port',travelMinutes:30,capacity:10});
  const service=new WorldTradeService(world),departure=world.minute+1;
  await service.scheduleHouseholdMigration({id:'family-world-recovery',originCityId:'origin',destinationCityId:'destination',citizenId:parent.id,departureMinute:departure});
  await world.advanceTo(departure,world.transferHandlers);assert.equal(world.transfers.get('family-world-recovery').status,'in-transit');
  const saveCity=session=>structuredClone(new CityStateGraph().encode({city:session.city,entities:[],nextId:1}));
  const loadCity=(id,packet)=>{const state=new CityStateGraph().apply(structuredClone(packet));bindCityState(state.city);let nextId=10000;state.city.createEntity=({x=0,y=0,properties={},...data})=>({id:nextId++,x,y,destroyed:false,...data,properties});return attach(state.city,id);};
  const saved={coordinator:world.snapshot(),origin:saveCity(origin),destination:saveCity(destination)};
  const restoredOrigin=loadCity('origin',saved.origin),restoredDestination=loadCity('destination',saved.destination),restoredWorld=new WorldCoordinator();
  restoredWorld.registerCity('origin',restoredOrigin);restoredWorld.registerCity('destination',restoredDestination);restoredWorld.restore(saved.coordinator);new WorldTradeService(restoredWorld);
  await restoredWorld.advanceTo(departure+30,restoredWorld.transferHandlers);
  const arrived=[...originalIds].map(([id,globalId])=>({id,globalId,citizen:restoredDestination.city.citizens.find(person=>person.globalId===globalId)}));
  assert.equal(restoredWorld.transfers.get('family-world-recovery').status,'delivered');
  assert(arrived.every(item=>item.citizen));assert(arrived.every(item=>restoredOrigin.city.citizens.every(person=>person.globalId!==item.globalId)));
  const arrivedParent=arrived.find(item=>item.id===parent.id).citizen,arrivedChild=arrived.find(item=>item.id===child.id).citizen;
  assert.equal(arrivedParent.childIds.includes(arrivedChild.id),true);assert.equal(arrivedChild.guardianId,arrivedParent.id);assert.equal(arrivedChild.parentIds.includes(arrivedParent.id),true);
  await restoredWorld.advanceTo(departure+30,restoredWorld.transferHandlers);
  for(const item of arrived)assert.equal(restoredDestination.city.citizens.filter(person=>person.globalId===item.globalId).length,1);
});

test('a family migration moves parent and child together and reconnects their local family links',async()=>{
  const originCity=setup({starter:true,population:24}),destinationCity=setup({starter:true,population:24});
  const candidates=originCity.citizens.filter(c=>originCity.society.isAdult(c)&&!c.jobId&&!c.businessIds?.length&&!c.partnerId&&!c.childIds?.length&&!c.expectingId&&![...originCity.units.values()].some(unit=>unit.ownerId===c.accountId)&&![...originCity.vehicles.units.values()].some(vehicle=>vehicle.ownerAccountId===c.accountId));
  const parent=candidates[0],child=candidates[1];assert(parent&&child);
  for(const person of [parent,child]){person.jobId=null;person.businessIds=[];person.deliveryId=null;person.mobilityTrip=null;person.ridingVehicleId=null;person.custody=null;person.indoorLocation=null;person.expectingId=null;person.worldMigrationPending=null;person.childIds=[];person.partnerId=null;person.guardianId=null;}
  const employer=originCity.buildings.find(building=>building.active&&!building.entity.destroyed&&building.jobs>0);assert(employer);parent.jobId=employer.id;employer.workers.push(parent.id);
  child.initialAge=10;child.bornAt=originCity.minute;child._ageValue=10;child._nextBirthdayAt=originCity.minute+1440*12;child.parentIds=[parent.id];child.guardianId=parent.id;parent.parentIds=[];parent.childIds=[child.id];
  originCity.society.getRelation(parent,child,true);assert.deepEqual(originCity.worldMigrationHousehold(parent.id),[parent.id,child.id]);
  const origin=attach(originCity,'origin'),destination=attach(destinationCity,'destination'),world=new WorldCoordinator({minute:originCity.minute});
  world.registerCity('origin',origin);world.registerCity('destination',destination);world.addVessel({id:'family-ferry',capacity:10});world.connectPorts({id:'route:origin>destination',originPortId:'origin:port',destinationPortId:'destination:port',travelMinutes:30,capacity:10});
  const service=new WorldTradeService(world),departure=world.minute+1;await service.scheduleHouseholdMigration({id:'family-move',originCityId:'origin',destinationCityId:'destination',citizenId:parent.id,departureMinute:departure});
  assert.equal(world.transfers.get('family-move').payload.package.members.length,2);
  const checkpoint=new CityStateGraph().apply(structuredClone(new CityStateGraph().encode({city:originCity,entities:[],nextId:10000}))).city;bindCityState(checkpoint);
  assert.equal(checkpoint.cancelWorldHouseholdMigration('family-move'),true);for(const member of world.transfers.get('family-move').payload.package.members)assert.equal(checkpoint.society.citizen(member.citizenId).worldMigrationPending,undefined);
  assert.equal(originCity.departWorldCitizenMigration(world.transfers.get('family-move').payload.package.members[0].transferId),true);
  await world.advanceTo(departure,world.transferHandlers);assert.equal(originCity.citizens.includes(parent),false);assert.equal(originCity.citizens.includes(child),false);
  assert.equal(parent.jobId,null);assert.equal(employer.workers.includes(parent.id),false);
  await world.advanceTo(departure+30,world.transferHandlers);
  const parentGlobalId=world.transfers.get('family-move').payload.package.members.find(member=>member.citizenId===parent.id).globalId,childGlobalId=world.transfers.get('family-move').payload.package.members.find(member=>member.citizenId===child.id).globalId;
  const arrivedParent=destinationCity.citizens.find(person=>person.globalId===parentGlobalId),arrivedChild=destinationCity.citizens.find(person=>person.globalId===childGlobalId);
  assert(arrivedParent&&arrivedChild);assert.equal(arrivedParent.childIds.includes(arrivedChild.id),true);assert.equal(arrivedChild.guardianId,arrivedParent.id);assert.equal(arrivedChild.parentIds.includes(arrivedParent.id),true);
  assert.equal(world.transfers.get('family-move').status,'delivered');await world.advanceTo(departure+30,world.transferHandlers);
  assert.equal(destinationCity.citizens.filter(person=>person.globalId===parentGlobalId).length,1);assert.equal(destinationCity.citizens.filter(person=>person.globalId===childGlobalId).length,1);
});

test('an automatic migration policy can board an employed family together',async()=>{
  const originCity=setup({starter:true,population:24}),destinationCity=setup({starter:true,population:24});originCity.worldPort.cityId='origin';
  const candidates=originCity.citizens.filter(person=>originCity.society.isAdult(person)&&!person.jobId&&!person.businessIds?.length&&!person.partnerId&&!person.childIds?.length&&!person.expectingId&&![...originCity.units.values()].some(unit=>unit.ownerId===person.accountId)&&![...originCity.vehicles.units.values()].some(vehicle=>vehicle.ownerAccountId===person.accountId));
  const parent=candidates[0],child=candidates[1];assert(parent&&child);
  for(const person of [parent,child]){person.jobId=null;person.businessIds=[];person.deliveryId=null;person.mobilityTrip=null;person.ridingVehicleId=null;person.custody=null;person.indoorLocation=null;person.expectingId=null;person.worldMigrationPending=null;person.childIds=[];person.partnerId=null;person.guardianId=null;}
  child.initialAge=10;child.bornAt=originCity.minute;child._ageValue=10;child._nextBirthdayAt=originCity.minute+1440*12;child.parentIds=[parent.id];child.guardianId=parent.id;parent.childIds=[child.id];parent.parentIds=[];originCity.society.getRelation(parent,child,true);
  const employer=originCity.buildings.find(building=>building.active&&!building.entity.destroyed&&building.jobs>0);assert(employer);parent.jobId=employer.id;employer.workers.push(parent.id);
  const world=new WorldCoordinator({minute:originCity.minute}),origin=attach(originCity,'origin'),destination=attach(destinationCity,'destination');
  world.registerCity('origin',origin);world.registerCity('destination',destination);world.addVessel({id:'auto-family-ferry',capacity:2});world.connectPorts({id:'route:origin>destination',originPortId:'origin:port',destinationPortId:'destination:port',travelMinutes:30,capacity:2});
  const service=new WorldTradeService(world),policy=service.createMigrationPolicy({id:'family-policy',routeId:'route:origin>destination',intervalMinutes:1440,maxTransfers:1,nextDepartureMinute:world.minute+1});
  assert.equal(await service.processMigrationPolicies(world.minute+1),1);const transfer=world.transfers.get(`auto-migration:family-policy:${world.minute+1}`);
  assert.equal(transfer.payload.package.version,2);assert.equal(transfer.payload.package.members.length,2);assert.equal(parent.jobId,employer.id);assert.equal(policy.transfersCreated,1);assert.equal(policy.active,false);
  await world.advanceTo(transfer.departureMinute,world.transferHandlers);
  assert.equal(parent.jobId,null);assert.equal(employer.workers.includes(parent.id),false);assert.equal(originCity.citizens.includes(parent),false);assert.equal(originCity.citizens.includes(child),false);
});

test('an automatic migration policy retries daily scheduling until an eligible adult is available',async()=>{
  const originCity=setup({starter:true,population:24}),destinationCity=setup({starter:true,population:24});originCity.worldPort.cityId='origin';
  const citizen=originCity.citizens.find(person=>originCity.society.isAdult(person)&&!person.partnerId&&!person.childIds?.length&&!person.guardianId&&![...originCity.units.values()].some(unit=>unit.ownerId===person.accountId)&&![...originCity.vehicles.units.values()].some(vehicle=>vehicle.ownerAccountId===person.accountId));
  assert(citizen);for(const person of originCity.citizens){person.jobId=1;person.businessIds=[];person.deliveryId=null;person.mobilityTrip=null;person.ridingVehicleId=null;person.custody=null;person.indoorLocation=null;person.expectingId=null;person.worldMigrationPending='fixture-reservation';}
  citizen.businessIds=[];citizen.homeUnitId=null;citizen.childIds=[];citizen.partnerId=null;citizen.guardianId=null;
  const world=new WorldCoordinator({minute:originCity.minute}),origin=attach(originCity,'origin'),destination=attach(destinationCity,'destination');
  world.registerCity('origin',origin);world.registerCity('destination',destination);world.addVessel({id:'auto-ferry',capacity:10});world.connectPorts({id:'route:origin>destination',originPortId:'origin:port',destinationPortId:'destination:port',travelMinutes:30,capacity:10});
  const service=new WorldTradeService(world),firstAttempt=world.minute+1,policy=service.createMigrationPolicy({id:'policy-daily',routeId:'route:origin>destination',intervalMinutes:1440,maxTransfers:2,nextDepartureMinute:firstAttempt});
  assert.equal(await service.processMigrationPolicies(firstAttempt),1);assert.match(policy.lastError,/elegível/);assert.equal(world.transfers.size,0);
  citizen.jobId=null;citizen.worldMigrationPending=null;assert.equal(await service.processMigrationPolicies(firstAttempt+1),1);assert.equal(world.transfers.get(`auto-migration:policy-daily:${firstAttempt+1}`).kind,'citizen');assert.equal(policy.transfersCreated,1);assert.equal(policy.active,true);
  const saved=world.snapshot(),restored=new WorldCoordinator();restored.registerCity('origin',origin);restored.registerCity('destination',destination);restored.restore(saved);assert.equal(restored.migrationPolicies.get('policy-daily').transfersCreated,1);assert.equal(restored.migrationPolicies.get('policy-daily').active,true);
});
