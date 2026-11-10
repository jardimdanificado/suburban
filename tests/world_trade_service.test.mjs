import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../js/city_simulation.js';
import {WorldCoordinator} from '../js/world_coordinator.js';
import {WorldTradeService} from '../js/world_trade_service.js';

function fakeCity({minute=0,stock=0,balance=0,buildingId=1,accountId='account'}={}){
  const city=Object.create(CitySimulation.prototype),building={id:buildingId,accountId,type:'business',active:true,entity:{destroyed:false},inventory:{pao:stock},incoming:{},inventoryCapacity:100};
  city.citizens=[{id:900,globalId:`${accountId}:pilot`,entity:{properties:{name:'Piloto'}}}];city.society={isAdult:()=>true};city.worldMigrationHousehold=()=>[900];city.reserveWorldCitizenMigration=()=>({version:1,citizenId:900,globalId:`${accountId}:pilot`,name:'Piloto'});city.departWorldCitizenMigration=city.receiveWorldCitizenMigration=city.completeWorldCitizenMigration=city.cancelWorldCitizenMigration=()=>true;
  city.minute=minute;city.building=id=>id===building.id?building:null;
  city.economy={goods:{pao:{label:'Pão',price:100}},recordGoods(){},accepts:(_building,good)=>good==='pao'};
  city.worldPort={id:'world-port',cityId:null,inventory:{pao:0},inventoryCapacity:1000,reservations:{},receipts:{},payments:{}};
  city.accounts=new Map([[accountId,{balance,externalMoney:false}],[`seller-${buildingId}`,{balance:0,externalMoney:false}],['supplier',{balance:0,externalMoney:true}]]);
  city.transfer=(from,to,amount)=>{const a=city.accounts.get(from),b=city.accounts.get(to);if(!a||!b||!Number.isSafeInteger(amount)||amount<0||(!a.externalMoney&&a.balance<amount))return false;if(!a.externalMoney)a.balance-=amount;if(!b.externalMoney)b.balance+=amount;return true;};
  const bridge={active:true,time:{paused:false,speed:1},async request(method,args){try{return {ok:true,value:city[method](...args)}}catch(error){return {ok:false,message:error.message}}}};
  return {city,building,bridge};
}

function tradeWorld(){
  const world=new WorldCoordinator(),origin=fakeCity({stock:20,balance:0,buildingId:1,accountId:'exporter'}),destination=fakeCity({stock:0,balance:5000,buildingId:2,accountId:'buyer'});
  origin.city.accounts.set('exporter',{balance:0,externalMoney:false});destination.city.accounts.set('buyer',{balance:5000,externalMoney:false});
  world.registerCity('origin',{...origin,world:{spawnCenter:{x:8,y:8}},metadata:{}});
  world.registerCity('destination',{...destination,world:{spawnCenter:{x:18,y:18}},metadata:{}});
  world.addVessel({id:'ferry',capacity:40});world.connectPorts({id:'route:origin>destination',originPortId:'origin:port',destinationPortId:'destination:port',travelMinutes:180,capacity:40,freightPerUnit:10});
  const service=new WorldTradeService(world);return {world,service,origin,destination};
}

test('world trade reserves stock and payment, then delivers goods and settles money at arrival',async()=>{
  const {world,service,origin,destination}=tradeWorld();
  const trip=await service.schedule({id:'trade-1',originCityId:'origin',destinationCityId:'destination',sellerBuildingId:1,destinationBuildingId:2,good:'pao',quantity:5,unitPrice:100,departureMinute:1});
  assert.equal(trip.status,'scheduled');assert.equal(trip.payload.freightAmount,50);assert.equal(trip.payload.amount,550);assert.equal(origin.building.inventory.pao,15);assert.equal(origin.city.worldPort.inventory.pao,5);assert.equal(destination.city.accounts.get('buyer').balance,4450);
  world.reportCityMinute('origin',1);world.reportCityMinute('destination',1);await world.flushTransfers();
  assert.equal(world.transfers.get('trade-1').status,'in-transit');assert.equal(world.vessels.get('ferry').status,'at-sea');assert.equal(origin.city.worldPort.inventory.pao,0);
  world.reportCityMinute('origin',181);world.reportCityMinute('destination',181);await world.flushTransfers();
  assert.equal(world.transfers.get('trade-1').status,'delivered');assert.equal(world.vessels.get('ferry').status,'returning');
  assert.equal(destination.building.inventory.pao,5);assert.equal(origin.city.accounts.get('exporter').balance,500);assert.equal(origin.city.accounts.get('world-fleet').balance,50);assert.equal(destination.city.accounts.get('buyer').balance,4450);
  assert.equal(origin.city.worldPort.reservations['trade-1'].status,'delivered');assert.equal(destination.city.worldPort.payments['trade-1'].status,'settled');
});

test('cancelling a scheduled trade restores both stock and buyer funds',async()=>{
  const {world,service,origin,destination}=tradeWorld();
  await service.schedule({id:'trade-2',originCityId:'origin',destinationCityId:'destination',sellerBuildingId:1,destinationBuildingId:2,good:'pao',quantity:5,unitPrice:100,departureMinute:10});
  assert.equal(await service.cancel('trade-2'),true);
  assert.equal(world.transfers.get('trade-2').status,'cancelled');assert.equal(world.vessels.get('ferry').status,'idle');
  assert.equal(origin.building.inventory.pao,20);assert.equal(origin.city.worldPort.inventory.pao,0);assert.equal(destination.city.accounts.get('buyer').balance,5000);
});

test('arrival retries safely when the buyer has no storage space',async()=>{
  const {world,service,origin,destination}=tradeWorld();
  await service.schedule({id:'trade-3',originCityId:'origin',destinationCityId:'destination',sellerBuildingId:1,destinationBuildingId:2,good:'pao',quantity:5,unitPrice:100,departureMinute:1});
  world.reportCityMinute('origin',1);world.reportCityMinute('destination',1);await world.flushTransfers();
  destination.building.inventoryCapacity=0;
  world.reportCityMinute('origin',181);world.reportCityMinute('destination',181);await world.flushTransfers();
  assert.equal(world.transfers.get('trade-3').status,'in-transit');assert.equal(destination.city.worldPort.inventory.pao,5);assert.equal(origin.city.accounts.get('exporter').balance,0);
  destination.building.inventoryCapacity=100;
  world.reportCityMinute('origin',182);world.reportCityMinute('destination',182);await world.flushTransfers();
  assert.equal(world.transfers.get('trade-3').status,'delivered');assert.equal(destination.city.worldPort.inventory.pao,0);assert.equal(destination.building.inventory.pao,5);assert.equal(origin.city.accounts.get('exporter').balance,500);
});

test('restoring during a partially completed cancellation finishes both idempotent refunds',async()=>{
  const {world,service,origin,destination}=tradeWorld();
  await service.schedule({id:'trade-cancel-recovery',originCityId:'origin',destinationCityId:'destination',sellerBuildingId:1,destinationBuildingId:2,good:'pao',quantity:5,unitPrice:100,departureMinute:10});
  assert.equal(world.beginCancelTransfer('trade-cancel-recovery'),true);
  assert.equal(origin.city.returnWorldExport('trade-cancel-recovery'),true);
  assert.equal(destination.city.refundWorldPayment('trade-cancel-recovery'),true);
  const saved=world.snapshot();world.restore(saved);await world.flushTransfers();
  assert.equal(world.transfers.get('trade-cancel-recovery').status,'cancelled');
  assert.equal(origin.building.inventory.pao,20);assert.equal(destination.city.accounts.get('buyer').balance,5000);
});

test('recurring trade contracts retry without funds, schedule automatically, and persist with the world',async()=>{
  const {world,service,destination}=tradeWorld();destination.city.accounts.get('buyer').balance=0;
  const contract=service.createContract({id:'daily-bread',routeId:'route:origin>destination',sellerBuildingId:1,destinationBuildingId:2,good:'pao',quantity:3,unitPrice:100,intervalMinutes:60,nextDepartureMinute:1});
  assert.equal(await service.processContracts(1),1);assert.equal(contract.lastError,'A operação reserveWorldPayment falhou em destination.');assert.equal(world.transfers.size,0);
  destination.city.accounts.get('buyer').balance=5000;assert.equal(await service.processContracts(2),1);
  assert.equal(world.transfers.get('contract:daily-bread:2').status,'scheduled');assert.equal(world.transfers.get('contract:daily-bread:2').departureMinute,3);assert.equal(contract.nextDepartureMinute,62);
  assert.equal(await service.processContracts(2),0);
  const saved=world.snapshot();world.restore(saved);assert.equal(world.contracts.get('daily-bread').active,true);assert.equal(world.contracts.get('daily-bread').nextDepartureMinute,62);
  assert.equal(service.cancelContract('daily-bread'),true);assert.equal(world.contracts.get('daily-bread').active,false);
});

test('quiescing the trade service waits for an already-started reservation to finish',async()=>{
  const {world,service,destination}=tradeWorld(),base=destination.bridge.request.bind(destination.bridge);let release,entered=false;
  destination.bridge.request=(method,args)=>method==='reserveWorldPayment'?new Promise(resolve=>{entered=true;release=()=>base(method,args).then(resolve);}):base(method,args);
  const operation=service.schedule({id:'trade-quiesce',originCityId:'origin',destinationCityId:'destination',sellerBuildingId:1,destinationBuildingId:2,good:'pao',quantity:2,unitPrice:100,departureMinute:1});
  while(!entered)await Promise.resolve();
  let quiesced=false;const waiting=service.quiesce().then(()=>{quiesced=true;});await Promise.resolve();assert.equal(quiesced,false);
  release();const [transfer]=await Promise.all([operation,waiting]);assert.equal(transfer.id,'trade-quiesce');assert.equal(quiesced,true);service.resume();
});

test('freight cannot depart without an actual available navigator',async()=>{
  const {world,service,origin}=tradeWorld();origin.city.citizens=[];
  await service.schedule({id:'no-pilot',originCityId:'origin',destinationCityId:'destination',sellerBuildingId:1,destinationBuildingId:2,good:'pao',quantity:2,unitPrice:100,departureMinute:1});
  await world.advanceTo(1,world.transferHandlers);
  assert.equal(world.transfers.get('no-pilot').status,'scheduled');
  assert.equal(origin.city.worldPort.reservations['no-pilot'].status,'reserved');
});
