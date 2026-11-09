import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,finishShipment} from './helpers/city.mjs';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
import {WorldCoordinator} from '../js/world_coordinator.js';
import {WorldTradeService} from '../js/world_trade_service.js';

function session(id,city){
  city.worldPort.cityId=id;
  const time={paused:false,speed:1,tick:0,elapsed:0};
  const bridge={active:true,time,async request(method,args){try{return {ok:true,value:city[method](...args)}}catch(error){return {ok:false,message:error.message}}}};
  return {id,city,world:city.world,entities:[],nextId:1,time,bridge,metadata:{name:id}};
}

function saveCity(value){return structuredClone(new CityStateGraph().encode({city:value.city,entities:value.entities,nextId:value.nextId}));}
function loadCity(id,packet){
  const state=new CityStateGraph().apply(structuredClone(packet));bindCityState(state.city);let nextId=state.nextId||1;
  state.city.createEntity=({x=0,y=0,properties={},...data})=>({id:nextId++,x,y,destroyed:false,...data,properties});
  return session(id,state.city);
}

test('restoring both city graphs mid-voyage finishes goods delivery and payment once',async()=>{
  const originCity=setup({starter:true,population:24}),destinationCity=setup({starter:true,population:24});
  const seller=originCity.buildings.find(building=>building.active&&!building.entity.destroyed&&(building.inventory.pao||0)>0&&originCity.findPath(building.door,originCity.worldPort.door)!==null);
  const buyer=destinationCity.buildings.find(building=>building.active&&!building.entity.destroyed&&building!==seller&&Object.hasOwn(building.inventory,'pao')&&destinationCity.findPath(destinationCity.worldPort.door,building.door)!==null);
  assert(seller&&buyer,'fixtures need a walkable bakery seller and destination buyer');
  destinationCity.transfer('treasury',buyer.accountId,50000,'Recovery test funding');
  const world=new WorldCoordinator({minute:originCity.minute}),origin=session('origin',originCity),destination=session('destination',destinationCity);
  world.registerCity('origin',origin);world.registerCity('destination',destination);world.addVessel({id:'recovery-ferry',capacity:10});world.connectPorts({id:'route:origin>destination',originPortId:'origin:port',destinationPortId:'destination:port',travelMinutes:30,capacity:10,freightPerUnit:10});
  const service=new WorldTradeService(world),buyerStock=buyer.inventory.pao;
  const departure=world.minute+1;
  await service.schedule({id:'trade-world-recovery',originCityId:'origin',destinationCityId:'destination',sellerBuildingId:seller.id,destinationBuildingId:buyer.id,good:'pao',quantity:1,unitPrice:100,departureMinute:departure});
  const exportShipment=originCity.logistics.shipments.find(shipment=>shipment.id===originCity.worldPort.reservations['trade-world-recovery'].localShipmentId);
  assert(exportShipment);finishShipment(originCity,exportShipment);
  await world.advanceTo(departure,world.transferHandlers);
  assert.equal(world.transfers.get('trade-world-recovery').status,'in-transit');

  const buyerBalanceAtCheckpoint=destinationCity.accounts.get(buyer.accountId).balance,sellerBalanceAtCheckpoint=originCity.accounts.get(seller.accountId).balance;
  const saved={coordinator:world.snapshot(),origin:saveCity(origin),destination:saveCity(destination)};
  const restoredOrigin=loadCity('origin',saved.origin),restoredDestination=loadCity('destination',saved.destination),restoredWorld=new WorldCoordinator();
  restoredWorld.registerCity('origin',restoredOrigin);restoredWorld.registerCity('destination',restoredDestination);restoredWorld.restore(saved.coordinator);
  new WorldTradeService(restoredWorld);
  // Isolate world-ledger recovery here; local carrier routing is covered by world_trade_port.test.mjs.
  restoredDestination.city.logistics=null;restoredDestination.city.building(buyer.id).inventoryCapacity+=1000;
  const arrival=world.transfers.get('trade-world-recovery').arrivalMinute;
  await restoredWorld.advanceTo(arrival,restoredWorld.transferHandlers);
  assert.equal(restoredWorld.transfers.get('trade-world-recovery').status,'delivered');
  assert.equal(restoredDestination.city.building(buyer.id).inventory.pao,buyerStock+1);
  assert.equal(restoredDestination.city.accounts.get(buyer.accountId).balance,buyerBalanceAtCheckpoint);
  assert.equal(restoredOrigin.city.accounts.get(seller.accountId).balance,sellerBalanceAtCheckpoint+100);
  assert.equal(restoredOrigin.city.accounts.get('world-fleet').balance,10);
  assert.equal(restoredOrigin.city.worldPort.reservations['trade-world-recovery'].status,'delivered');
  assert.equal(restoredDestination.city.worldPort.payments['trade-world-recovery'].status,'settled');
  await restoredWorld.advanceTo(arrival,restoredWorld.transferHandlers);
  assert.equal(restoredDestination.city.building(buyer.id).inventory.pao,buyerStock+1);
});
