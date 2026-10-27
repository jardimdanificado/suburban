import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney,finishShipment,putAtWorkCell,finishActivityRoute} from './helpers/city.mjs';
import {COLOR_PALETTE,initializeColors,colorAffinity,favoriteColors,factoryColors} from '../js/city_colors.js';
import {garmentScore,selectClothes} from '../js/city_clothing.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
import {renderColorPreferences,renderFactoryPaint,renderBuildingPaint,renderVehiclePaint} from '../js/city_paint_ui.js';
const fixture=()=>setup({starter:true,funded:true,population:128});
function equipment(city){const v=[...city.vehicles.units.values()].find(v=>v.active&&v.good==='bicicleta_carga'),owner=city.accounts.get(v.ownerAccountId),garage=city.buildings.find(b=>b.type==='cycle_workshop'),worker=city.society.citizen(garage.workers[0]);city.transfer('treasury',owner.accountId,100000,'Fixture painting budget');return {v,owner,garage,worker};}
function paintStock(holder,color,n=1,premium=false){holder.inventory.tinta=n;holder.paintLots=[{color,quantity:n,producerId:123,producerName:'Tintas da cidade',premium}];}
const paintTotal=city=>city.goodsStock('tinta')+city.economy.consumed.tinta+city.economy.lost.tinta;
function panel(){const text=[],actions=[];return{text,actions,heading:s=>text.push(s),note:s=>text.push(s),kv:(...s)=>text.push(s.join(' ')),table:(cols,rows)=>text.push(...rows.map(r=>r.cells.join(' '))),buttons:items=>actions.push(...items),button:(label,click)=>actions.push({label,click}),record:(...s)=>text.push(s.slice(0,2).join(' '))};}
test('individual color tastes are stable, different and change garment desirability',()=>{
 const seeded=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const a={id:1},b={id:2},same={id:1};initializeColors(a,seeded(1));initializeColors(b,seeded(2));initializeColors(same,seeded(1));assert.deepEqual(a.colorPreferences,same.colorPreferences);assert.notDeepEqual(a.colorPreferences,b.colorPreferences);assert.equal(a.colorPreferenceAnchors.length,1+Math.floor((Math.imul(1,1664525)+1013904223>>>0)/4294967296*3));
 assert(a.dislikedColors.length>=2&&a.dislikedColors.some(hex=>colorAffinity(a,hex)<=-.65));assert(COLOR_PALETTE.some(color=>colorAffinity(a,color.hex)<0));
 const ranked=favoriteColors(a),favorite=ranked[0].hex,rgb=parseInt(favorite.slice(1),16),near=`#${((rgb+1)&0xffffff).toString(16).padStart(6,'0')}`,far=COLOR_PALETTE.reduce((best,color)=>colorAffinity(a,color.hex)<colorAffinity(a,best.hex)?color:best,COLOR_PALETTE[0]),g={condition:100,quality:70,piece:'camisa',style:'simples',brandId:4};
 assert(colorAffinity(a,near)>colorAffinity(a,far.hex));assert(garmentScore(a,{...g,color:favorite})>garmentScore(a,{...g,color:far.hex}));assert(Number.isFinite(colorAffinity(a,'#123456')));
 const disliked=a.dislikedColors[0];selectClothes(Object.assign(a,{wardrobe:[{...g,color:disliked},{...g,color:favorite}]}));assert.equal(a.wearingIndex,1);
});
test('factories consume actual inputs to produce normal and custom paint, sold with a premium',()=>{
 const city=fixture(),factory=city.buildings.find(b=>b.type==='paintworks'),worker=city.society.citizen(factory.workers[0]),c=city.citizens.find(c=>c.fixtureInvestor),color='#123456',money=totalMoney(city);
 factory.inventory.tinta=0;factory.paintLots=[];for(const [g,n]of Object.entries(city.buildingTypes.paintworks.inputs))factory.inventory[g]=n*4;
 assert(city.paint.requestPurchase(c.id,factory.id,color,true));assert(factory.paintColorOrders.length);assert.equal(factory.inventory.tinta,0);
 putAtWorkCell(city,worker,factory);for(let i=0;i<25;i++)city.economy.productionWork(factory,worker);
 assert(city.paint.available(factory,color)>0);assert(factory.paintLots.some(l=>l.color===color&&l.premium));const normal=city.economy.goods.tinta.price;assert(city.paint.quote(factory,color)>normal);
 const before=paintTotal(city);c.entity.x=factory.door.x;c.entity.y=factory.door.y;c.task='paint-purchase';city.paint.arrive(c);
 assert.equal(c.paintBag.inventory.tinta,1);assert.equal(c.paintBag.paintLots[0].color,color);assert.equal(c.paintPurchase,null);assert.equal(paintTotal(city),before);assert.equal(totalMoney(city),money);assert.equal(factoryColors(factory).length,4);
});
test('colored paint retains supplier and shade through physical freight',()=>{
 const city=fixture(),factory=city.buildings.find(b=>b.type==='paintworks'),garage=city.buildings.find(b=>b.type==='cycle_workshop'),color=COLOR_PALETTE[2].hex;paintStock(factory,color,4);garage.inventory.tinta=0;garage.paintLots=[];
 const before=paintTotal(city),shipment=city.logistics.order(factory,garage,'tinta',2,city.economy.goods.tinta.price);assert(shipment);assert.equal(shipment.paintLots[0].color,color);assert.equal(factory.inventory.tinta,2);finishShipment(city,shipment);
 assert.equal(garage.inventory.tinta,2);assert.equal(garage.paintLots[0].color,color);assert.equal(garage.paintLots[0].producerName,'Tintas da cidade');assert.equal(paintTotal(city),before);
});
test('painting a delivered bicycle uses workshop paint, real worker labor and exactly one payment',()=>{
 const city=fixture(),{v,owner,garage,worker}=equipment(city),color=COLOR_PALETTE[0].hex;paintStock(garage,color);const money=totalMoney(city),before=paintTotal(city),old=v.color;
 assert(city.paint.requestVehicle(v.id,garage.id,color));assert.equal(v.color,old);const job=city.paint.jobs.at(-1);assert.equal(job.status,'delivery');assert(city.paint.route(owner));assert.equal(owner.task,'paint-delivery');
 city.vehicles.releaseTrip(owner);city.vehicles.freeParking(v);v.x=v.entity.x=owner.entity.x=garage.door.x;v.y=v.entity.y=owner.entity.y=garage.door.y;owner.task='paint-delivery';city.paint.arrive(owner);assert.equal(job.status,'ready');
 worker.entity.x=v.x;worker.entity.y=v.y;const balance=owner.balance;assert(city.paint.work(garage,worker));const paid=balance-owner.balance;assert(paid>0);assert.equal(v.color,old);
 for(let i=0;i<30&&job.status!=='completed';i++)city.paint.work(garage,worker);
 assert.equal(job.status,'completed');assert.equal(v.color,color);assert.equal(v.paintHistory.length,1);assert.equal(balance-owner.balance,paid);assert.equal(garage.inventory.tinta,0);assert.equal(v.paintJobId,null);assert.equal(paintTotal(city),before);assert.equal(totalMoney(city),money);
});
test('the owner can bring paint to a garage and pays only labor',()=>{
 const city=fixture(),{v,owner,garage,worker}=equipment(city),color='#aabbcc';paintStock(city.paint.bag(owner),color);garage.inventory.tinta=0;garage.paintLots=[];
 assert(city.paint.requestVehicle(v.id,garage.id,color,true));const job=city.paint.jobs.at(-1);v.x=v.entity.x=worker.entity.x=owner.entity.x=garage.door.x;v.y=v.entity.y=worker.entity.y=owner.entity.y=garage.door.y;owner.task='paint-delivery';city.paint.arrive(owner);assert.equal(owner.paintBag.inventory.tinta,0);assert.equal(job.materials.length,1);assert.equal(job.price,undefined);
 worker.task='work';worker.targetId=garage.id;const before=paintTotal(city);for(let i=0;i<30&&job.status!=='completed';i++)city.economy.productionWork(garage,worker);
 assert.equal(job.status,'completed');assert.equal(v.color,color);assert.equal(owner.paintBag.inventory.tinta,0);assert.equal(job.price,Math.ceil(city.currency.price(job.requiredLabor*city.politics.policy.minimumWage)));assert.equal(paintTotal(city),before);
});
test('a property owner can paint only their own rooms with a real construction service',()=>{
 const city=fixture(),b=city.buildings.find(b=>b.type==='bank'),builder=city.buildings.find(b=>b.type==='builder'),worker=city.society.citizen(builder.workers[0]),c=city.citizens.find(c=>c.fixtureInvestor),color='#ddaaff';
 b.units[0].ownerId=c.accountId;b.units[1].ownerId=c.accountId;paintStock(builder,color);assert(city.paint.requestBuilding(b.id,c.accountId,color));const job=city.paint.jobs.at(-1);assert.equal(job.quantity,1);assert.equal(job.unitIds.length,2);const before=paintTotal(city);
 worker.task='work';worker.targetId=builder.id;worker.entity.x=b.door.x;worker.entity.y=b.door.y;for(let i=0;i<30&&job.status!=='completed';i++){city.economy.productionWork(builder,worker);finishActivityRoute(city,worker);}
 assert.equal(job.status,'completed');assert.equal(b.wallColors[b.units[0].id],color);assert.equal(b.wallColors[b.units[2].id],undefined);assert.equal(b.paintRevision,1);assert.equal(paintTotal(city),before);
});
test('vehicle flags are durable physical items and detach without duplication',()=>{
 const city=fixture(),{v,owner}=equipment(city),party=city.politics.parties.find(p=>p.active);owner.campaignInventory={bandeiras:1};const before=city.goodsStock('bandeiras');assert(city.vehicles.mountFlag(v.id,party.id));assert.equal(owner.campaignInventory.bandeiras,0);assert.equal(v.mountedFlag.partyId,party.id);assert(!city.vehicles.mountFlag(v.id,party.id));assert.equal(city.goodsStock('bandeiras'),before);assert(city.vehicles.removeFlag(v.id));assert.equal(owner.campaignInventory.bandeiras,1);assert.equal(city.goodsStock('bandeiras'),before);
});
test('paint jobs, personal preferences and all customization panels survive worker snapshots',()=>{
 const city=fixture(),{v,owner,garage}=equipment(city),color=COLOR_PALETTE[1].hex;paintStock(garage,color);city.paint.requestVehicle(v.id,garage.id,color);const mirror=new CityStateGraph().apply(new CityStateGraph().encode({city})).city;bindCityState(mirror);
 assert.equal(typeof mirror.paint.work,'function');assert.equal(mirror.paint.jobs.at(-1).color,color);assert.deepEqual(mirror.citizens[0].colorPreferences,city.citizens[0].colorPreferences);
 const ui={city:mirror},p=panel();renderColorPreferences(ui,p,mirror.society.citizen(owner.id));renderFactoryPaint(ui,p,mirror.buildings.find(b=>b.type==='paintworks'));renderBuildingPaint(ui,p,mirror.building(garage.id));renderVehiclePaint(ui,p,mirror.vehicles.units.get(v.id));assert(p.actions.some(a=>a.label.includes('LEVAR TINTA')));assert(p.text.includes('CORES E GOSTOS PESSOAIS'));
});

test('splitting and cancelling paint deliveries preserves every colored physical unit',()=>{
 const city=fixture(),factory=city.buildings.find(b=>b.type==='paintworks'),garage=city.buildings.find(b=>b.type==='cycle_workshop'),color='#225588';paintStock(factory,color,8);garage.inventory.tinta=0;garage.paintLots=[];
 const before=paintTotal(city),shipment=city.logistics.order(factory,garage,'tinta',6,city.economy.goods.tinta.price);assert(shipment);city.logistics.splitLoad(shipment,2);const parts=city.logistics.shipments.filter(s=>s.buyer===garage&&s.good==='tinta');assert.equal(parts.length,3);
 for(const s of parts){assert.equal(s.paintLots.reduce((n,l)=>n+l.quantity,0),2);assert(s.paintLots.every(l=>l.color===color));}
 for(const s of parts)city.logistics.cancel(s,'Fixture cancellation');assert.equal(factory.inventory.tinta,8);assert.equal(city.paint.available(factory,color),8);assert.equal(paintTotal(city),before);
});
test('a requested repaint autonomously travels to the workshop and completes during normal simulation',()=>{
 const city=fixture(),{v,owner,garage}=equipment(city),color='#2255bb';paintStock(garage,color);assert(city.paint.requestVehicle(v.id,garage.id,color));const job=city.paint.jobs.at(-1);
 for(let i=0;i<2880&&job.status!=='completed'&&job.status!=='cancelled';i++)city.update(.25);
 assert.equal(job.status,'completed',JSON.stringify({status:job.status,minute:city.minute,ownerAction:owner.action,ownerTask:owner.task,ownerPath:owner.path.length,vehicle:{x:v.x,y:v.y,driver:v.driverId,trip:owner.mobilityTrip},workers:garage.workers.map(id=>{const c=city.society.citizen(id);return{id,task:c?.task,path:c?.path.length,action:c?.action};})}));assert.equal(v.color,color);assert(job.deliveredAt);assert.equal(v.paintHistory.length,1);
});
test('buyers choose a preferred vehicle color when type, price and availability are equal',()=>{
  const city=fixture(),system=city.vehicles,shop=city.buildings.find(b=>b.type==='cycle_shop'),owners=new Set([...system.units.values()].filter(v=>v.active).map(v=>v.ownerAccountId)),c=city.citizens.find(c=>city.society.isAdult(c)&&!owners.has(c.accountId)&&!city.politics.officeHolder(c));
  const colors=favoriteColors(c),preferred=colors.find(color=>!c.dislikedColors.includes(color.hex)),rejected=colors.find(color=>c.dislikedColors.includes(color.hex));city.transfer('treasury',c.accountId,2200000,'Fixture purchasing power');for(const person of city.citizens)person.mobilityNeed=person===c?100:0;shop.inventory.bicicleta=2;system.registerUnits(shop,'bicicleta',2);const units=[...system.units.values()].filter(v=>!v.active&&v.holderAccountId===shop.accountId);units[0].color=rejected.hex;units[1].color=preferred.hex;
 system.lastHour=null;system.hourly();assert.equal(units[1].ownerAccountId,c.accountId);assert.notEqual(units[0].ownerAccountId,c.accountId);
});
test('a home buyer prefers their favored wall color among equally priced properties',()=>{
 const city=fixture(),c=city.citizens.find(c=>c.fixtureInvestor),colors=favoriteColors(c),homes=[];
 for(let i=0;i<2;i++){let b;for(const site of city.economy.locateBuilding('residential')){b=city.addBuilding('residential',site.x,site.y,{...site,width:2,depth:2,floors:1,free:true});if(b)break;}assert(b);b.wallColor=i?colors[0].hex:colors.at(-1).hex;homes.push(b);}
 city.housing.invest();assert.equal(city.housing.home(c).buildingId,homes[1].id);
 const home=city.housing.home(c),room=city.housing.units(home).find(u=>u.roomType==='bedroom');homes[1].wallColors={[room.id]:'#112233'};assert.equal(city.housing.homeColor(home),'#112233');
});
