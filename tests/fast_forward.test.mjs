import test from 'node:test';
import assert from 'node:assert/strict';
import {OccurrenceQueue,beginFastForwardMinute,deferFastForwardCitizen,nextRoutineReview,routineRevision} from '../js/city_fast_forward.js';
import {timeInteriorJourney,advanceCitizenInterior} from '../js/city_interiors.js';
import {bodyMovementSpeedFactor} from '../js/city_body_metrics.js';
import {CityLogistics} from '../js/city_logistics.js';
import {setup,totalMoney,ensureBusiness,finishShipment} from './helpers/city.mjs';

function journey(){
 const c={id:1,initialAge:25,task:'work',path:[{x:5,y:0}],entity:{},needs:{food:80,water:80,energy:80,hygiene:80,toilet:80,health:80},businessIds:[]};
 const city={minute:481,fastForward:true,world:{revision:0},structureRevision:0,childrenOf:()=>[]};
 return {city,c};
}
test('occurrences run by time, with stable ordering and future entries retained',()=>{
 const q=new OccurrenceQueue();q.schedule(8,'later');q.schedule(3,'first');q.schedule(3,'second');q.schedule(1,'early');
 assert.deepEqual(q.takeUntil(3).map(e=>e.value),['early','first','second']);assert.deepEqual(q.takeUntil(7),[]);assert.deepEqual(q.takeUntil(8).map(e=>e.value),['later']);
});
test('ff wakes journeys on deadline, arrival, emergency, map change and return to detailed mode',()=>{
 for(const change of [({city})=>city.minute+=4,({c})=>c.path=[],({c})=>c.needs.food=10,({city})=>city.world.revision++,({city})=>city.fastForward=false]){
  const f=journey();beginFastForwardMinute(f.city);assert.equal(deferFastForwardCitizen(f.city,f.c),false);
  f.city.minute++;beginFastForwardMinute(f.city);assert.equal(deferFastForwardCitizen(f.city,f.c),true);
  change(f);beginFastForwardMinute(f.city);assert.equal(deferFastForwardCitizen(f.city,f.c),false);
 }
});
test('children, injuries, custody and dependants retain minute precision',()=>{
 for(const change of [({c})=>c.initialAge=8,({c})=>c.combatInjuries=[{}],({c})=>c.custody={},({city})=>city.childrenOf=()=>[{}]]){
  const f=journey();change(f);beginFastForwardMinute(f.city);deferFastForwardCitizen(f.city,f.c);f.city.minute++;beginFastForwardMinute(f.city);assert.equal(deferFastForwardCitizen(f.city,f.c),false);
 }
});
test('routine revisions wake at shift boundaries and respond to home/job/map changes',()=>{
 const {city,c}=journey(),old=routineRevision(city,c);assert(nextRoutineReview(city,c,true)>city.minute);
 city.minute=539;assert.equal(nextRoutineReview(city,c,true),540);city.minute=540;assert.notEqual(routineRevision(city,c),old);
 for(const change of [()=>c.jobId=4,()=>c.homeUnitId=2,()=>city.world.revision++]){const previous=routineRevision(city,c);change();assert.notEqual(routineRevision(city,c),previous);}
});
test('ordinary interior access conserves the physical polyline, destination and reservation',()=>{
 const c={entity:{x:0,y:0},indoorLocation:{position:{x:0,y:0,z:0},path:[{x:3,y:0,z:0},{x:3,y:4,z:0}],targetUnitId:'desk',targetRoomType:'workspace'}};
 timeInteriorJourney(c.indoorLocation);assert.equal(c.indoorLocation.travelRemaining,undefined);assert.equal(c.indoorLocation.path.length,2);
 advanceCitizenInterior({minute:1},c,6/bodyMovementSpeedFactor(c));assert.equal(c.indoorLocation.unitId,undefined);assert.equal(c.indoorLocation.path.length,1);
 advanceCitizenInterior({minute:2},c,1/bodyMovementSpeedFactor(c));assert.equal(c.indoorLocation.unitId,'desk');assert.deepEqual(c.indoorLocation.position,{x:3,y:4,z:0});assert.equal(c.indoorLocation.path.length,0);
});
function freight(){
 const c={id:1,entity:{x:7,y:9},deliveryId:1,deliveryLeg:'pickup'},seller={},buyer={door:{x:7,y:9},inventory:{}};
 const shipments=[1,2,3].map(id=>({id,quantity:4,seller,buyer,carrierId:5,purpose:'trade',status:'waiting',position:{x:0,y:0}}));shipments[0].driverId=1;
 const city={minute:20,society:{citizen:()=>c},furniture:{release(){}},vehicles:{cargoCapacity:()=>10}};
 const logistics=new CityLogistics(city);logistics.shipments=shipments;return {c,shipments,logistics};
}
test('freight bundles respect total capacity, keep orders distinct and hand off delivery',()=>{
 const {c,shipments,logistics}=freight();logistics.groupJourney(shipments[0],c);
 assert.deepEqual(c.deliveryBatchIds,[1,2]);assert.equal(c.deliveryLoad,8);assert.equal(shipments[2].driverId,undefined);
 logistics.completeDriver(shipments[0]);assert.equal(c.deliveryId,2);assert.equal(c.deliveryLoad,4);assert.equal(shipments[0].driverId,null);
 logistics.completeDriver(shipments[1]);assert.equal(c.deliveryId,null);assert.equal(c.deliveryLoad,0);
});
test('interrupting a bundle releases every order at its physical position',()=>{
 const {c,shipments,logistics}=freight();logistics.groupJourney(shipments[0],c);for(const s of shipments.slice(0,2))s.pickedUp=true;
 logistics.releaseDriver(shipments[1]);for(const s of shipments.slice(0,2)){assert.equal(s.driverId,null);assert.equal(s.status,'waiting');assert.deepEqual(s.position,{x:7,y:9});}assert.equal(c.deliveryId,null);
});
test('ff round trip preserves money, materials and finite individual needs',()=>{
 const city=setup({starter:true,population:24});
 for(let minute=0;minute<180;minute++){city.fastForward=minute<120;city.update(.25);}
 assert.equal(totalMoney(city),city.currency.netIssued());
 for(const good of Object.keys(city.economy.goods))assert.equal(city.economy.initialStock[good]+city.economy.produced[good]+(city.economy.externalTrade?.importedGoods?.[good]||0),city.economy.consumed[good]+city.goodsStock(good)+city.economy.lost[good],good);
 for(const c of city.citizens)for(const value of Object.values(c.needs))assert(Number.isFinite(value)&&value>=0&&value<=100);
});

test('bundled deliveries settle individual escrow and conserve actual stock and money',()=>{
 const city=setup(),seller=city.economy.businesses.find(b=>b.type==='farm'),buyer=ensureBusiness(city,'bakery'),carrier=ensureBusiness(city,'carrier');
 const driver=city.society.citizen(carrier.workers[0]||carrier.ownerId);assert(driver);
 for(const key of Object.keys(driver.needs))driver.needs[key]=95;
 driver.indoorLocation=null;driver.workMeal=null;driver.mobilityTrip=null;driver.conversation=null;driver.path=[];
 seller.inventory.trigo+=12;city.economy.initialStock.trigo+=12;
 const before=totalMoney(city),stock=city.goodsStock('trigo'),buyerStock=buyer.inventory.trigo;
 const orders=[city.logistics.order(seller,buyer,'trigo',4,90),city.logistics.order(seller,buyer,'trigo',4,90)];assert(orders.every(Boolean));
 for(const s of orders)s.carrierId=carrier.id;
 city.logistics.candidates=()=>[driver];
 city.logistics.updateMinute();assert.equal(orders[0].driverId,driver.id);assert.equal(orders[1].driverId,driver.id);assert.equal(driver.deliveryLoad,8);
 finishShipment(city,orders[1]);assert.equal(orders[0].status,'delivered');assert.equal(buyer.inventory.trigo,buyerStock+8);
 for(const order of orders){assert.equal(order.balance,0);assert.equal(order.inventory.trigo,0);}
 assert.equal(city.goodsStock('trigo'),stock);assert.equal(totalMoney(city),before);
});
test('small orders await a lot, but empty inventory and ten-minute age dispatch immediately',()=>{
 const {c,shipments,logistics}=freight(),s=shipments[0];s.createdAt=logistics.city.minute;s.good='trigo';s.buyer.inventory.trigo=20;
 logistics.shipments=[s];s.driverId=null;assert.equal(logistics.readyForDispatch(s),false);
 s.buyer.inventory.trigo=0;assert.equal(logistics.readyForDispatch(s),true);
 s.buyer.inventory.trigo=20;logistics.city.minute+=10;assert.equal(logistics.readyForDispatch(s),true);
});
test('a bundled journey continues to the next nearby destination',()=>{
 const {c,shipments,logistics}=freight();shipments[1].buyer={door:{x:8,y:9}};
 logistics.city.findPath=(from,to)=>[{...to}];logistics.groupJourney(shipments[0],c);logistics.completeDriver(shipments[0]);
 assert.equal(c.deliveryId,2);assert.deepEqual(c.path,[{x:8,y:9}]);
});

test('sleep can accrue event intervals and still ends at exactly eight hours',async()=>{
 const {sleepMinute,SLEEP_MINUTES}=await import('../js/city_sleep.js');
 for(const step of [1,4]){
  const city={minute:0},c={task:'energy',needs:{energy:10},sleep:{active:true,minutes:0,lastMinute:0,lastWakeAt:-1000,completed:0}};
  for(let minute=step;minute<=SLEEP_MINUTES;minute+=step){city.minute=minute;sleepMinute(city,c);}
  assert.equal(c.task,null);assert.equal(c.sleep.lastDuration,480);assert.equal(c.sleep.lastWakeAt,480);assert.equal(c.sleep.completed,1);
 }
});
test('the ff queue wakes a sleeping resident at the exact end of sleep',()=>{
 const {city,c}=journey();c.task='energy';c.path=[];c.needs.energy=5;c.sleep={active:true,minutes:477,lastMinute:city.minute};
 beginFastForwardMinute(city);assert.equal(deferFastForwardCitizen(city,c),false);
 city.minute++;beginFastForwardMinute(city);assert.equal(deferFastForwardCitizen(city,c),true);
 city.minute+=2;beginFastForwardMinute(city);assert.equal(deferFastForwardCitizen(city,c),false);
});

test('removing a citizen preserves personal and domestic inventory with provenance',()=>{
 for(const inherit of [false,true]){
  const city=setup({starter:true,population:24}),c=city.citizens.find(c=>!city.politics.officeHolder(c)),heir=city.citizens.find(other=>other!==c&&!city.politics.officeHolder(other));
  const stock=city.substances.homeStock(c);stock.inventory.folha_coca=32;city.economy.initialStock.folha_coca+=32;city.substances.addLot(stock,'folha_coca',32,70,'estate-fixture');
  city.publications.stock(c,'livros');c.inventory.livros=1;city.economy.initialStock.livros++;const books=city.goodsStock('livros')+city.economy.lost.livros;
  if(inherit){c.dead=true;c.partnerId=heir.id;heir.inventoryCapacity=0;}
  const before=city.goodsStock('folha_coca'),money=totalMoney(city);c.entity.destroyed=true;city.reconcile();
  assert.equal(city.goodsStock('folha_coca')+city.economy.lost.folha_coca,before);assert.equal(totalMoney(city),money);assert.equal(city.goodsStock('livros')+city.economy.lost.livros,books);
  if(inherit){assert.equal(city.substances.homeStock(heir).inventory.folha_coca,32);assert.equal(city.substances.homeStock(heir).substanceLots.folha_coca[0].quality,70);}
 }
});

test('ff keeps exhausted sleep and invalid needs in the detailed recovery path',()=>{
 for(const value of [0,Infinity,NaN]){
  const {city,c}=journey();c.task='energy';c.path=[];c.needs.energy=value;c.sleep={active:true,minutes:10,lastMinute:city.minute};
  beginFastForwardMinute(city);deferFastForwardCitizen(city,c);city.minute++;beginFastForwardMinute(city);assert.equal(deferFastForwardCitizen(city,c),false);
 }
});
