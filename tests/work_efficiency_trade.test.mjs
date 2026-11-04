import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney,putAtWorkCell,finishActivityRoute} from './helpers/city.mjs';
import {externalTradeHourly,orderImport,EXTERNAL_TRADE_RULES} from '../js/city_external_trade.js';
import {shipmentPriority} from '../js/city_logistics.js';
import {CURRENCY_RULES,EXTERNAL_ACCOUNT_BALANCE} from '../js/city_currency.js';
import {TILE_STONE} from '../js/world_gen.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
const fixture=()=>{
 const city=setup({starter:true,funded:true,population:128}),types=['quarry','farm','iron_mine','paintworks','carrier','builder','tire_factory','cycle_assembler'];let workers=city.citizens.filter(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c)&&!c.jobId);
 for(const type of types){let building=city.buildings.find(b=>b.type===type&&!b.entity.destroyed);if(!building)for(const site of city.economy.locateBuilding(type)){building=city.addBuilding(type,site.x,site.y,{...site,free:true});if(building)break;}if(!building)throw Error(`Fixture cannot construct ${type}`);if(!building.active)city.economy.activateMunicipalBusiness(building,city.currency.price(100000));if(type==='farm')building.crop='trigo';building.workers??=[];if(!building.workers.length){const worker=workers.shift();if(!worker)throw Error(`Fixture has no worker for ${type}`);city.economy.leaveJob(worker,'Fixture de atividade produtiva');worker.jobId=building.id;worker.task='work';building.workers.push(worker.id);}building.jobs=Math.max(building.jobs||0,building.workers.length);if(type==='carrier'){const driver=city.society.citizen(building.workers[0]);driver.equipment={...(driver.equipment||{}),carrinho:{boughtAt:city.minute}};}}
 return city;
};
const healthy=c=>{for(const k of Object.keys(c.needs))c.needs[k]=90;c.conversation=null;c.path=[];c.indoorLocation=null;};
test('food at work never interrupts a worker drinking or undergoing urgent treatment',()=>{
 const city=fixture(),b=city.buildings.find(b=>b.type==='quarry'),c=city.society.citizen(b.workers[0]);healthy(c);city.minute=9*60;c.entity.x=b.door.x;c.entity.y=b.door.y;b.inventory.pao=12;c.needs.food=15;c.needs.water=0;c.task='water';c.targetId=1;
 assert.equal(city.workMeals.tryStart(c),false);assert.equal(c.task,'water');assert.equal(b.inventory.pao,12);assert.equal(c.workMeal,null);
 c.task='work';assert.equal(city.workMeals.tryStart(c),false);assert.equal(c.task,'work');
});
test('larger farms advertise enough positions and farmers plant multiple fields while visiting each cell',()=>{
 const city=fixture(),b=city.buildings.find(b=>b.type==='farm'),c=city.society.citizen(b.workers[0]);healthy(c);city.minute=9*60;c.task='work';c.targetId=b.id;c.entity.x=b.door.x;c.entity.y=b.door.y;b.inventory.sementes=100;
 assert(b.width*b.depth>54);assert(b.jobs>3);
 const visited=new Set();for(let i=0;i<100;i++){if(c.path.length){const p=c.path.at(-1);c.entity.x=p.x;c.entity.y=p.y;c.path=[];}city.economy.farmWork(b,c);if(!c.path.length&&c.workCell)visited.add(c.workCell.unitId);city.minute++;}
 assert(visited.size>=3);assert(b.fields.filter(f=>f.plantedAt!==null).length>=2);
});
test('a rock quarry uses a reachable deposit and opens a depleted rock cell',()=>{
 const city=fixture(),b=city.buildings.find(b=>b.type==='quarry'),c=city.society.citizen(b.workers[0]);healthy(c);city.minute=9*60;
 city.world.map=new Array(city.world.width*city.world.height).fill(0);
 const cell={x:b.entity.x+b.width,y:b.entity.y};
 city.world.setTile(cell.x,cell.y,TILE_STONE);city.world.map[cell.y*city.world.width+cell.x]=TILE_STONE;
 city.world.quarryReserves=new Map([[`${cell.x},${cell.y}`,1]]);b.depositRevision=-1;b.stoneReserve=100;b.inventory.pedra=0;
 c.task='work';c.targetId=b.id;c.entity.x=b.door.x;c.entity.y=b.door.y;
 for(let i=0;i<12&&!b.inventory.pedra;i++){city.economy.productionWork(b,c);if(c.path.length){const p=c.path.at(-1);c.entity.x=p.x;c.entity.y=p.y;c.path=[];}}
 assert.equal(b.inventory.pedra,1);assert.notEqual(city.world.getTile(cell.x,cell.y),TILE_STONE);assert(city.walkable(cell.x,cell.y));
});
test('external customers buy only excess goods using existing money, keeping inflation and goods balanced',()=>{
 const city=fixture(),b=city.buildings.find(b=>b.type==='iron_mine'),external=city.accounts.get('supplier'),base=totalMoney(city),index=city.currency.priceIndex;for(const exporter of city.economy.businesses.filter(x=>x.type==='import_exporter'))exporter.active=false;
 assert(external.externalMoney);assert.equal(external.balance,EXTERNAL_ACCOUNT_BALANCE);b.inventory.minerio=80;city.economy.produced.minerio+=80;city.economy.market.minerio={demand:0};
 const stock=b.inventory.minerio,money=b.balance,net=city.currency.externalNet,broker=city.accounts.get('trade-import-export')?.balance||0,treasury=city.treasury;assert(externalTradeHourly(city)>0);
 const q=stock-b.inventory.minerio;assert(q>0);assert(b.inventory.minerio>=EXTERNAL_TRADE_RULES.minimumFirmStock);assert.equal(b.balance-money+(city.accounts.get('trade-import-export')?.balance||0)-broker+city.treasury-treasury,city.currency.externalNet-net);assert.equal(totalMoney(city)-base,city.currency.externalNet-net);assert.equal(city.currency.priceIndex,index);city.minute+=1440;city.currency.daily();assert(city.currency.priceIndex>index);assert(city.marketHistory.some(s=>s.reason==='Exportação: Minério de ferro'||s.reason.startsWith('Exportação:')));assert.equal(city.economy.externalTrade.units,q);
 city.economy.externalTrade.importedGoods={marmita_simples:5};assert(city.economy.goodsLedger.some(r=>r.kind==='export'));const mirror=new CityStateGraph().apply(new CityStateGraph().encode({city})).city;bindCityState(mirror);assert.equal(mirror.economy.externalTrade.units,q);assert.equal(mirror.economy.externalTrade.importedGoods.marmita_simples,5);
});
test('foreign food deliveries are recorded by good for exact stock conservation',()=>{
 const seller={id:'import:marmita_simples',importBrand:'Armazém Exterior',door:{x:2,y:2},inventory:{marmita_simples:0}},buyer={id:4,active:true,entity:{destroyed:false},door:{x:3,y:3}},city={economy:{goods:{marmita_simples:{price:600}},businesses:[],externalImporters:new Map([['marmita_simples',seller]])},accounts:new Map(),findPath:()=>[],logistics:{order:()=>({id:1,fee:1})},politics:{policy:{}},log:()=>{}};
 const shipment=orderImport(city,buyer,'marmita_simples',5);
 assert(shipment);assert.equal(city.economy.externalTrade.importedGoods.marmita_simples,5);
});
test('exports preserve local demand and use the direct-sale path when no export depot is active',()=>{
 const city=fixture(),b=city.buildings.find(b=>b.type==='iron_mine');for(const exporter of city.economy.businesses.filter(x=>x.type==='import_exporter'))exporter.active=false;for(const firm of city.economy.businesses)for(const g of Object.keys(firm.inventory))firm.inventory[g]=0;b.inventory.minerio=50;city.economy.market.minerio={demand:100};assert.equal(externalTradeHourly(city),0);assert.equal(b.inventory.minerio,50);
 city.economy.market.minerio.demand=0;const before=b.balance;assert(externalTradeHourly(city)>0);assert(b.balance>before);assert(b.inventory.minerio<50);assert.equal(totalMoney(city),city.currency.netIssued());
});

test('workers at their work cell are paid while waiting for inputs',()=>{
 const city=fixture(),b=city.buildings.find(b=>b.type==='paintworks'),c=city.society.citizen(b.workers[0]);healthy(c);city.minute=9*60;for(const good of ['oleo','argila','ervas'])b.inventory[good]=0;putAtWorkCell(city,c,b);const cash=c.balance,balance=b.balance,total=totalMoney(city);city.performTask(c);assert(c.balance>cash);assert(b.balance<balance);assert.equal(totalMoney(city),total);assert.equal(b.productionLabor||0,0);
});
test('quarry bathrooms remain reachable inside the quarry when their underlying tile is rock',()=>{
 const city=fixture(),b=city.buildings.find(b=>b.type==='quarry'),c=city.society.citizen(b.workers[0]),f=[...city.sanitation.facilities.values()].find(f=>f.buildingId===b.id);healthy(c);city.minute=9*60;city.world.map={};for(let y=b.entity.y;y<b.entity.y+b.depth;y++)for(let x=b.entity.x;x<b.entity.x+b.width;x++)city.world.setTile(x,y,TILE_STONE);c.entity.x=b.door.x;c.entity.y=b.door.y;c.task='toilet';c.targetId=b.id;c.toiletTargetId=f.id;c.needs.toilet=0;const uses=f.uses;city.sanitation.use(c);finishActivityRoute(city,c);city.sanitation.use(c);assert.equal(f.uses,uses+1);assert.equal(c.indoorLocation.unitId,f.unitId);
});

test('housing freight starts ahead of ordinary orders and old shipments eventually advance',()=>{
 const housing={purpose:'trade',buyer:{type:'popular_housing'},createdAt:0},ordinary={purpose:'trade',buyer:{type:'factory'},createdAt:0},meal={purpose:'work-meals',buyer:{type:'farm'},createdAt:2160};assert(shipmentPriority(housing,0,12)<shipmentPriority(ordinary,0,12));assert(shipmentPriority(ordinary,2160,12)<shipmentPriority(meal,2160,12));
});

test('export receipts are tracked as foreign money entering the local economy',()=>{
 const city=fixture(),b=city.buildings.find(b=>b.type==='iron_mine');for(const exporter of city.economy.businesses.filter(x=>x.type==='import_exporter'))exporter.active=false;for(const firm of city.economy.businesses)for(const g of Object.keys(firm.inventory))firm.inventory[g]=0;b.inventory.minerio=50;city.economy.market.minerio={demand:0};const before=city.currency.externalNet,total=totalMoney(city);assert(externalTradeHourly(city));assert(city.currency.externalNet>before);assert.equal(totalMoney(city)-total,city.currency.externalNet-before);
});

test('cargo bicycles qualify carrier staff for large construction deliveries',()=>{
 const city=fixture(),carrier=city.buildings.find(b=>b.type==='carrier'),quarry=city.buildings.find(b=>b.type==='quarry'),recipient=city.buildings.find(b=>b.type==='builder'),driver=carrier.workers.map(id=>city.society.citizen(id)).find(c=>city.logistics.capacity(c)>24);assert(driver);healthy(driver);driver.task=null;quarry.inventory.pedra=60;const shipment=city.logistics.order(quarry,recipient,'pedra',48,0,{requireCarrier:true});assert(shipment);assert.equal(shipment.carrierId,carrier.id);assert(city.logistics.candidates(shipment).some(c=>c.id===driver.id));assert.equal(shipment.carrierId,carrier.id);
});

test('an unassigned large shipment can find a carrier again when a cargo bicycle becomes available',()=>{
 const city=fixture(),carrier=city.buildings.find(b=>b.type==='carrier'),quarry=city.buildings.find(b=>b.type==='quarry'),buyer=city.buildings.find(b=>b.type==='builder'),driver=carrier.workers.map(id=>city.society.citizen(id)).find(c=>city.logistics.capacity(c)>24);healthy(driver);driver.task=null;quarry.inventory.pedra=60;const s=city.logistics.order(quarry,buyer,'pedra',48,0);assert(s);s.carrierId=null;const candidates=city.logistics.candidates(s);assert.equal(s.carrierId,carrier.id);assert(candidates.some(c=>c.id===driver.id));
});

test('splitting a large cargo preserves the origin and quantity of vehicle components',()=>{
 const city=fixture(),seller=city.buildings.find(b=>b.type==='tire_factory'),buyer=city.buildings.find(b=>b.type==='cycle_assembler');seller.inventory.rodas=50;seller.componentLots??={};seller.componentLots.rodas=[{producerId:seller.id,producerName:'Fábrica',design:3,quantity:50}];const shipment=city.logistics.order(seller,buyer,'rodas',50,0);assert(shipment);city.logistics.splitLoad(shipment,24);const parts=city.logistics.shipments.filter(s=>s.good==='rodas'&&[shipment.id,shipment.id+1,shipment.id+2].includes(s.id));assert.equal(parts.reduce((n,s)=>n+s.quantity,0),50);assert.equal(parts.reduce((n,s)=>n+(s.componentLots?.rodas||[]).reduce((a,l)=>a+l.quantity,0),0),50);assert(parts.every(s=>(s.componentLots?.rodas||[]).every(l=>l.producerId===seller.id&&l.design===3)));
});

test('the starting town hall has real public dining rooms and bathrooms sized for the population',()=>{
 const city=setup({starter:true,population:512}),hall=city.buildings.find(b=>b.type==='townhall'),refectory=city.buildings.find(b=>b.type==='popular_refectory'),toilet=city.buildings.find(b=>b.type==='public_toilet'),dining=refectory.units.filter(u=>u.roomType==='dining'),bathrooms=toilet.units.filter(u=>u.roomType==='bathroom');assert(refectory.floors>=4&&toilet.floors>=4);assert(dining.length>=8);assert(bathrooms.length>=16);assert(bathrooms.every(u=>city.sanitation.facilities.get(`toilet:${u.id}`)?.access==='public'));assert(hall.units.filter(u=>u.roomType==='workspace').length>=hall.jobs);city.sanitation.setupBusinessRooms(refectory);assert.equal(refectory.units.filter(u=>u.roomType==='dining').length,dining.length);
});

test('a large waiting order splits when its carrier has no available cargo-bike driver',()=>{
 const city=fixture(),carrier=city.buildings.find(b=>b.type==='carrier'),quarry=city.buildings.find(b=>b.type==='quarry'),buyer=city.buildings.find(b=>b.type==='builder');quarry.inventory.pedra=60;const s=city.logistics.order(quarry,buyer,'pedra',48,0,{requireCarrier:true});assert(s);city.minute=9*60;s.createdAt=city.minute-61;for(const id of carrier.workers){const c=city.society.citizen(id);c.needs.health=0;}const money=totalMoney(city),incoming=buyer.incoming.pedra;city.logistics.updateMinute();const parts=city.logistics.shipments.filter(x=>x.good==='pedra'&&x.buyer===buyer&&!['delivered','cancelled'].includes(x.status));assert(parts.length>=2);assert(parts.every(x=>x.quantity<=24));assert.equal(parts.reduce((n,x)=>n+x.quantity,0),48);assert.equal(buyer.incoming.pedra,incoming);assert.equal(totalMoney(city),money);
});
