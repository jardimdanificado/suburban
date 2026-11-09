import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldCoordinator} from '../js/world_coordinator.js';

function session(minute=0){
  const time={paused:false,speed:1,tick:0,elapsed:0};
  const bridge={time,active:true,controls:0,control(){this.controls++;},worker:{terminate(){}}};
  return {city:{minute},bridge,time,metadata:{name:'Teste'}};
}

test('world minute waits for every registered city and then runs due transfer handlers once',async()=>{
  const departed=[],delivered=[],world=new WorldCoordinator({transferHandlers:{depart:transfer=>departed.push(transfer.id),deliver:transfer=>delivered.push(transfer.id)}});
  world.registerCity('a',session());world.registerCity('b',session());
  world.scheduleTransfer({id:'goods-1',kind:'goods',originCityId:'a',destinationCityId:'b',payload:{good:'pao',quantity:4},departureMinute:1,arrivalMinute:3});
  assert.equal(world.reportCityMinute('a',3),0);
  assert.equal(world.minute,0);
  assert.deepEqual(departed,[]);
  assert.equal(world.reportCityMinute('b',1),1);
  await world.flushTransfers();
  assert.deepEqual(departed,['goods-1']);
  assert.equal(world.reportCityMinute('a',4),1);
  assert.equal(world.reportCityMinute('b',3),3);
  await world.flushTransfers();
  assert.deepEqual(delivered,['goods-1']);
  assert.equal(world.transfers.get('goods-1').status,'delivered');
  world.reportCityMinute('b',3);
  assert.deepEqual(delivered,['goods-1']);
});

test('world snapshot restores session progress, time controls, and transfer ledger',async()=>{
  const world=new WorldCoordinator();world.registerCity('a',session());world.registerCity('b',session());
  world.addVessel({id:'snapshot-ferry',capacity:50});world.connectPorts({id:'snapshot-route',originPortId:'a:port',destinationPortId:'b:port',travelMinutes:12,capacity:50});
  world.setTime({paused:true,speed:4});
  world.reportCityMinute('a',7);world.reportCityMinute('b',5);
  world.scheduleTransfer({id:'goods-2',kind:'goods',originCityId:'a',destinationCityId:'b',payload:{good:'madeira',quantity:2},departureMinute:6,arrivalMinute:8});
  const saved=world.snapshot(),restored=new WorldCoordinator();
  restored.registerCity('a',session());restored.registerCity('b',session());restored.restore(saved);
  await restored.flushTransfers();
  assert.equal(restored.minute,5);
  assert.equal(restored.paused,true);
  assert.equal(restored.speed,4);
  assert.equal(restored.cities.get('a').reportedMinute,7);
  assert.equal(restored.cities.get('b').reportedMinute,5);
  assert.equal(restored.transfers.get('goods-2').status,'scheduled');
  assert.equal(restored.routes.get('snapshot-route').travelMinutes,12);
  assert.equal(restored.vessels.get('snapshot-ferry').capacity,50);
});

test('restoring during departure or arrival resumes from an idempotent phase boundary',async()=>{
  for(const [status,expected] of [['departing','scheduled'],['arriving','in-transit']]){
    const world=new WorldCoordinator(),a=session(),b=session();world.registerCity('a',a);world.registerCity('b',b);
    world.addVessel({id:'recovery-ferry',capacity:8});world.connectPorts({id:'recovery-route',originPortId:'a:port',destinationPortId:'b:port',travelMinutes:4,capacity:8});
    const transfer=world.scheduleVoyage({id:`recovery-${status}`,routeId:'recovery-route',manifest:{kind:'goods',good:'pao',quantity:1},departureMinute:1});
    transfer.status=status;world.minute=status==='departing'?transfer.departureMinute:transfer.arrivalMinute;const vessel=world.vessels.get(transfer.vesselId);vessel.status=status==='departing'?'reserved':'at-sea';
    const saved=world.snapshot(),restored=new WorldCoordinator();restored.registerCity('a',session());restored.registerCity('b',session());restored.restore(saved);await restored.flushTransfers();
    assert.equal(restored.transfers.get(transfer.id).status,expected);
  }
});

test('due transfers stay pending until their side-effect handlers exist',async()=>{
  const world=new WorldCoordinator();world.registerCity('a',session());world.registerCity('b',session());
  world.scheduleTransfer({id:'goods-3',kind:'goods',originCityId:'a',destinationCityId:'b',payload:{good:'pao',quantity:1},departureMinute:1,arrivalMinute:2});
  world.reportCityMinute('a',2);world.reportCityMinute('b',2);
  await world.flushTransfers();
  assert.equal(world.transfers.get('goods-3').status,'scheduled');
  assert.equal(world.minute,2);
  const departed=[];await world.advanceTo(2,{depart:transfer=>departed.push(transfer.id)});
  assert.deepEqual(departed,['goods-3']);
  assert.equal(world.transfers.get('goods-3').status,'in-transit');
});

test('maritime routes reserve a compatible vessel and release it after arrival',async()=>{
  const sailed=[],arrived=[],world=new WorldCoordinator({transferHandlers:{depart:t=>sailed.push(t.id),deliver:t=>arrived.push(t.id)}});
  world.registerCity('a',{...session(),metadata:{port:{x:4,y:8}}});
  world.registerCity('b',{...session(),metadata:{port:{x:12,y:3}}});
  world.addVessel({id:'ferry',capacity:40});
  world.connectPorts({id:'a-b',originPortId:'a:port',destinationPortId:'b:port',travelMinutes:3,capacity:40});
  assert.throws(()=>world.scheduleVoyage({id:'too-large',routeId:'a-b',manifest:{kind:'goods',good:'pao',quantity:41}}),/capacidade/);
  const trip=world.scheduleVoyage({id:'shipment',routeId:'a-b',manifest:{kind:'goods',good:'pao',quantity:24},departureMinute:1});
  assert.equal(trip.arrivalMinute,4);
  assert.equal(world.vessels.get('ferry').status,'reserved');
  await world.advanceTo(1);assert.equal(world.vessels.get('ferry').status,'at-sea');assert.deepEqual(sailed,['shipment']);
  await world.advanceTo(4);assert.equal(world.vessels.get('ferry').status,'idle');assert.deepEqual(arrived,['shipment']);
});

test('separate vessels allow parallel voyages across a multi-city route network',()=>{
  const world=new WorldCoordinator();world.registerCity('a',session());world.registerCity('b',session());world.registerCity('c',session());
  world.connectPorts({id:'a-b',originPortId:'a:port',destinationPortId:'b:port',travelMinutes:10,capacity:20});
  world.connectPorts({id:'b-c',originPortId:'b:port',destinationPortId:'c:port',travelMinutes:10,capacity:20});
  world.addVessel({id:'ferry:a-b',capacity:20});world.addVessel({id:'ferry:b-c',capacity:20});
  const first=world.scheduleVoyage({id:'ab-1',routeId:'a-b',manifest:{kind:'goods',good:'pao',quantity:5},departureMinute:1});
  const second=world.scheduleVoyage({id:'bc-1',routeId:'b-c',manifest:{kind:'goods',good:'pao',quantity:5},departureMinute:1});
  assert.equal(first.vesselId,'ferry:a-b');assert.equal(second.vesselId,'ferry:b-c');
  assert.equal(world.vessels.get('ferry:a-b').status,'reserved');assert.equal(world.vessels.get('ferry:b-c').status,'reserved');
});

test('a family voyage uses one berth per migrated household member',()=>{
  const world=new WorldCoordinator();world.registerCity('a',session());world.registerCity('b',session());world.connectPorts({id:'family-capacity-route',originPortId:'a:port',destinationPortId:'b:port',travelMinutes:10,capacity:1});world.addVessel({id:'family-capacity-ferry',capacity:1});
  const manifest={kind:'citizen',package:{version:2,members:[{citizenId:1},{citizenId:2}]}};
  assert.throws(()=>world.scheduleVoyage({id:'family-too-large',routeId:'family-capacity-route',manifest}),/capacidade/);
});

test('city ports register at the physically reachable local port door',()=>{
  const world=new WorldCoordinator(),city=session();city.city.worldPort={door:{x:12.5,y:8.5}};city.world={spawnCenter:{x:64,y:64}};
  world.registerCity('harbor',city);assert.deepEqual(world.ports.get('harbor:port'),{id:'harbor:port',cityId:'harbor',x:12.5,y:8.5});
});

test('world relationship references resolve to the living citizen in their current city',()=>{
  const world=new WorldCoordinator(),origin=session(),destination=session();
  const parent={id:14,globalId:'origin:14',entity:{destroyed:false,properties:{name:'Ada'}}},migrant={id:8,globalId:'origin:8',entity:{destroyed:false,properties:{name:'Bia'}},worldLinks:{parentGlobalIds:['origin:14'],partnerGlobalId:'origin:99',relationships:[{globalId:'origin:14',status:'close',view:{affection:88}}]}};
  origin.city.citizens=[parent];destination.city.citizens=[migrant];world.registerCity('origin',origin);world.registerCity('destination',destination);
  assert.equal(world.resolveCitizen('origin:14').cityId,'origin');
  const links=world.resolveCitizenLinks(migrant);assert.equal(links.parents[0].name,'Ada');assert.equal(links.relationships[0].view.affection,88);assert.equal(links.partner.unresolved,true);
});

test('registered citizens receive stable world identities used by cross-city references',()=>{
  const world=new WorldCoordinator(),origin=session(),destination=session();
  const relative={id:14,entity:{destroyed:false,properties:{name:'Ada'}}};
  const migrant={id:8,entity:{destroyed:false,properties:{name:'Bia'}},worldLinks:{parentGlobalIds:['origin:14']}};
  origin.city.citizens=[relative];destination.city.citizens=[migrant];
  world.registerCity('origin',origin);world.registerCity('destination',destination);
  assert.equal(relative.globalId,'origin:14');assert.equal(migrant.globalId,'destination:8');
  const link=world.resolveCitizenLinks(migrant).parents[0];
  assert.equal(link.cityId,'origin');assert.equal(link.name,'Ada');
});

test('the world rejects duplicate living global citizen identities',()=>{
  const world=new WorldCoordinator(),first=session(),second=session();
  first.city.citizens=[{id:1,globalId:'world:person-1'}];second.city.citizens=[{id:2,globalId:'world:person-1'}];
  world.registerCity('first',first);
  assert.throws(()=>world.registerCity('second',second),/Identidade global de cidadão duplicada/);
  assert.equal(world.cities.has('second'),false);
});

test('only the selected session receives detailed observation and summaries persist',()=>{
  const world=new WorldCoordinator(),observed=[];
  const create=id=>{const value=session();value.bridge.setObserved=flag=>observed.push([id,flag]);return value;};
  world.registerCity('a',create('a'));world.registerCity('b',create('b'));world.selectCity('b');
  assert.deepEqual(observed,[['a',true],['b',false],['a',false],['b',true]]);
  assert.equal(world.updateCitySummary('a',{minute:.5,population:12,averageHappiness:78}),true);
  const saved=world.snapshot(),restored=new WorldCoordinator();restored.registerCity('a',create('a'));restored.registerCity('b',create('b'));restored.restore(saved);
  assert.equal(restored.summaries.get('a').population,12);assert.equal(restored.summaries.get('a').averageHappiness,78);
  assert.equal(restored.updateCitySummary('a',{minute:.25,population:0}),false);
});
