import {leaveParty} from '../js/city_party_membership.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney} from './helpers/city.mjs';
import {characterMinute,canControl} from '../js/character_game.js';
import {playerRecipes,playerSalePrice} from '../js/character_player_actions.js';
import {roomFurniture} from '../js/city_furniture_catalog.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
import {selectClothes,manufactureClothes} from '../js/city_clothing.js';

function start(){const city=setup(),c=city.citizens.find(c=>canControl(city,c)&&!city.politics.officeHolder(c));assert(city.gameAction('start',{citizenId:c.id}),city.lastError);return {city,c};}
function site(city,c,type='artisan',x=10){const b=city.addBuilding(type,x,10,{width:3,depth:3,floors:1,ownerAccountId:c.accountId,free:true});assert(b,city.lastError);b.ownerId=c.id;b.active=true;b.municipal=false;if(!c.businessIds.includes(b.id))c.businessIds.push(b.id);return b;}
function at(c,b){c.indoorLocation=null;c.path=[];Object.assign(c.entity,b.door);}
function ok(city,action,options){assert(city.gameAction(action,options),`${action}: ${city.lastError}`);}

test('physical buying queues arrival, conserves money and goods, and rejects invalid quantities',()=>{
 const {city,c}=start(),b=site(city,c);b.inventory.madeira=5;c.inventory.madeira=0;
 c.entity.x=b.door.x+5;const cash=c.balance,stock=city.goodsStock('madeira');
 ok(city,'buy-good',{buildingId:b.id,good:'madeira',quantity:2});assert.equal(b.inventory.madeira,5);assert.equal(c.balance,cash);assert.equal(city.characterGame.intent.kind,'player-action');
 const money=totalMoney(city);at(c,b);characterMinute(city,c);assert.equal(c.inventory.madeira,2);assert.equal(b.inventory.madeira,3);assert.equal(c.balance,cash-playerSalePrice(city,b,'madeira')*2);assert.equal(city.goodsStock('madeira'),stock);assert.equal(totalMoney(city),money);
 for(const quantity of [0,-1,1.5,Infinity,1000])assert(!city.gameAction('buy-good',{buildingId:b.id,good:'madeira',quantity}));
 c.inventoryCapacity=2;assert(!city.gameAction('buy-good',{buildingId:b.id,good:'madeira',quantity:1}));
});

test('arrival rechecks disappearing stock and changing ownership without spending money',()=>{
 const {city,c}=start(),b=site(city,c);b.inventory.madeira=2;c.entity.x=b.door.x+5;const cash=c.balance;
 ok(city,'buy-good',{buildingId:b.id,good:'madeira',quantity:2});b.inventory.madeira=0;at(c,b);characterMinute(city,c);assert.equal(c.balance,cash);assert.match(city.characterGame.message,/estoque/);
 b.inventory.madeira=1;const other=city.citizens.find(p=>p!==c&&!p.entity.destroyed);b.ownerId=other.id;b.units.forEach(u=>u.ownerId=other.accountId);
 assert(!city.gameAction('take-good',{buildingId:b.id,good:'madeira',quantity:1}));assert(!city.gameAction('price',{buildingId:b.id,good:'madeira',amount:1}));
});

test('dropping, partial pickup, gifts and storage preserve real inventory through save/restore',()=>{
 const {city,c}=start(),b=site(city,c);at(c,b);c.inventory.madeira=5;const stock=city.goodsStock('madeira');
 ok(city,'drop-good',{good:'madeira',quantity:3});const item=city.playerGroundItems[0];assert.equal(city.goodsStock('madeira'),stock);
 ok(city,'pickup-good',{entityId:item.id,quantity:1});assert.equal(item.properties.item.quantity,2);assert.equal(city.goodsStock('madeira'),stock);
 ok(city,'store-good',{buildingId:b.id,good:'madeira',quantity:1});ok(city,'take-good',{buildingId:b.id,good:'madeira',quantity:1});assert.equal(city.goodsStock('madeira'),stock);
 const other=city.citizens.find(p=>p!==c&&!p.entity.destroyed);other.indoorLocation=null;Object.assign(other.entity,c.entity);ok(city,'give-good',{citizenId:other.id,good:'madeira',quantity:1});assert.equal(city.goodsStock('madeira'),stock);
 const mirror=new CityStateGraph().apply(new CityStateGraph().encode({city})).city;bindCityState(mirror);assert.equal(mirror.goodsStock('madeira'),stock);assert(mirror.gameAction('pickup-good',{entityId:item.id,quantity:2}));assert.equal(mirror.goodsStock('madeira'),stock);assert.equal(mirror.playerGroundItems.length,0);
});

test('equipment uses carried stock and cannot be removed into an overfull bag',()=>{
 const {city,c}=start();c.inventory={cesta:1,madeira:23};c.inventoryCapacity=24;const stock=city.goodsStock('cesta');
 ok(city,'equip',{good:'cesta'});assert.equal(c.inventoryCapacity,36);assert.equal(city.goodsStock('cesta'),stock);
 c.inventory.madeira=25;assert(!city.gameAction('unequip',{good:'cesta'}));assert(c.equipment.cesta);c.inventory.madeira=1;ok(city,'unequip',{good:'cesta'});assert.equal(c.inventory.cesta,1);assert.equal(city.goodsStock('cesta'),stock);
});

test('bank operations conserve money, isolate accounts and amortize interest before principal',()=>{
 const {city,c}=start(),b=city.bank.available()[0];assert(b);at(c,b);const money=totalMoney(city),cash=c.balance;
 ok(city,'bank-deposit',{buildingId:b.id,amount:100});assert.equal(c.balance,cash-100);ok(city,'bank-withdraw',{buildingId:b.id,amount:100});assert.equal(c.balance,cash);
 const loan={id:city.bank.nextId++,bankId:b.id,clientId:c.accountId,principal:100,remaining:100,interest:20,paid:0,status:'active',rate:.001,dailyPayment:5,dueDay:city.day+1};city.bank.loans.push(loan);
 const other=city.citizens.find(p=>p!==c&&!p.entity.destroyed);city.bank.loans.push({...loan,id:city.bank.nextId++,clientId:other.accountId});
 assert(!city.gameAction('bank-repay',{buildingId:b.id,loanId:city.bank.loans.at(-1).id,amount:20}));
 ok(city,'bank-repay',{buildingId:b.id,loanId:loan.id,amount:30});assert.equal(loan.interest,0);assert.equal(loan.remaining,90);ok(city,'bank-repay',{buildingId:b.id,loanId:loan.id,amount:90});assert.equal(loan.status,'paid');assert.equal(totalMoney(city),money);
});

test('manual fabrication takes time, consumes real inputs, and cancellation does not consume them',()=>{
 const {city,c}=start(),b=site(city,c,'sawmill');at(c,b);const pair=playerRecipes(city,c).find(([type])=>type==='sawmill');assert(pair);const spec=pair[1];
 for(const[g,q]of Object.entries(spec.inputs))c.inventory[g]=q;const before={...c.inventory};
 ok(city,'craft',{buildingId:b.id,type:b.type});characterMinute(city,c);if(city.characterGame.intent)ok(city,'stop');assert.deepEqual(c.inventory,before);
 ok(city,'craft',{buildingId:b.id,type:b.type});for(let i=0;i<spec.labor+2&&city.characterGame.intent;i++)characterMinute(city,c);
 for(const[g,q]of Object.entries(spec.inputs))assert.equal(c.inventory[g],before[g]-q);for(const[g,q]of Object.entries(spec.outputs))assert.equal(c.inventory[g],(before[g]||0)+q);
});

test('furniture uses actual goods, renders in the room, and can be retrieved',()=>{
 const {city,c}=start(),b=site(city,c);at(c,b);const u=b.units.find(u=>u.roomType==='workspace');assert(u);c.inventory.moveis=1;const stock=city.goodsStock('moveis');
 ok(city,'furnish',{buildingId:b.id,unitId:u.id,type:'chair'});assert.equal(c.inventory.moveis,0);assert.equal(city.goodsStock('moveis'),stock);assert(roomFurniture(b,u).some(f=>f.id===u.playerFurniture[0].id));
 assert(!city.gameAction('furnish',{buildingId:b.id,unitId:u.id,type:'chair'}));ok(city,'unfurnish',{buildingId:b.id,unitId:u.id,furnitureId:u.playerFurniture[0].id});assert.equal(c.inventory.moveis,1);assert.equal(city.goodsStock('moveis'),stock);
});

test('demolition requires confirmation and vacancy, uses a paid contract and clears the plot after work',()=>{
 const {city,c}=start(),b=site(city,c),plot=city.development.plots.find(p=>p.id===b.plotId);plot.ownerId=c.accountId;
 b.workers=[];b.inventory=Object.fromEntries(Object.keys(city.economy.goods).map(g=>[g,0]));at(c,b);const money=totalMoney(city);
 assert(!city.gameAction('demolish',{buildingId:b.id}));ok(city,'demolish',{buildingId:b.id,confirmed:true});assert(city.building(b.id));
 const project=city.development.projects.at(-1);assert.equal(project.service,'demolition');project.labor=project.requiredLabor;
 assert(city.development.completeService(project));assert(!city.building(b.id));assert.equal(plot.buildingId,null);assert.equal(totalMoney(city),money);assert(!city.units.has(b.units[0].id));
});

test('business management rejects foreign ownership and preserves wages and hiring requirements',()=>{
 const {city,c}=start(),b=site(city,c),cash=b.balance;
 ok(city,'fund-business',{buildingId:b.id,amount:2000});assert.equal(b.balance,cash+2000);
 ok(city,'employment',{buildingId:b.id,baseWage:8,minSkill:20,allowTraining:true,manualHiring:true});assert.equal(b.baseWage,8);assert.equal(b.hiringPolicy.minSkill,20);assert(b.playerHiring);
 ok(city,'price',{buildingId:b.id,good:'madeira',amount:100});assert.equal(playerSalePrice(city,b,'madeira'),100);
 const other=city.buildings.find(other=>other.ownerId!==c.id&&other.active);assert(!city.gameAction('employment',{buildingId:other.id,baseWage:1}));assert(!city.gameAction('fund-business',{buildingId:other.id,amount:1}));
});

test('political participation requires the controlled citizen mandate and maintains party membership',()=>{
 const {city,c}=start();ok(city,'political-ambition',{enabled:true});assert(c.playerPoliticalAmbition);
 const party=city.politics.parties.find(p=>p.active);const member=city.citizens.find(p=>p!==c&&p.political?.partyId&&!city.politics.officeHolder(p));if(member)leaveParty(city.politics,member,'Fixture slot');ok(city,'join-party',{partyId:party.id});assert(party.memberIds.includes(c.id));
 assert(!city.gameAction('public-work',{type:'clinic'}));assert(!city.gameAction('veto',{billId:1}));assert(!city.gameAction('bill',{type:'tax',payload:{value:.2}}));
 city.politics.council.members.push({citizenId:c.id,partyId:party.id});ok(city,'bill',{type:'tax',payload:{value:.2}});assert.equal(city.politics.council.bills.at(-1).authorId,c.id);
 ok(city,'simulation');const mayor=city.society.citizen(city.economy.mayorId);assert(canControl(city,mayor));ok(city,'start',{citizenId:mayor.id});
});

test('romance respects rejection, marriage requires mutual commitment, and separation updates the relationship',()=>{
 const {city,c}=start(),p=city.citizens.find(p=>p!==c&&!p.entity.destroyed&&city.society.isAdult(p)&&!city.society.related(c,p));c.indoorLocation=p.indoorLocation=null;Object.assign(p.entity,c.entity);
 c.partnerId=p.partnerId=null;c.personality={...c.personality,wantsRomance:true};p.personality={...p.personality,wantsRomance:true};c.socialProfile={...c.socialProfile,orientation:'bi'};p.socialProfile={...p.socialProfile,orientation:'bi'};
 const r=city.society.getRelation(c,p,true);for(const id of [c.id,p.id])Object.assign(r.views[id],{affection:80,trust:80,attraction:80,resentment:0,fear:0});
 const random=city.random;city.random=()=>.999;ok(city,'propose',{citizenId:p.id});assert.equal(c.partnerId,null);assert(!city.gameAction('propose',{citizenId:p.id}));
 city.minute+=1441;city.random=()=>0;ok(city,'propose',{citizenId:p.id});assert.equal(c.partnerId,p.id);ok(city,'marry',{citizenId:p.id});assert.equal(r.marriedAt,city.minute);assert(!city.gameAction('marry',{citizenId:p.id}));ok(city,'separate',{citizenId:p.id});assert.equal(c.partnerId,null);assert.equal(p.partnerId,null);assert.equal(r.marriedAt,null);city.random=random;
});

test('chosen clothing survives automatic outfit selection and purchase keeps garment provenance',()=>{
 const {city,c}=start(),b=site(city,c,'tailor');at(c,b);manufactureClothes(city,b,2);b.inventory.roupas=2;const garment=b.garments[0],stock=city.goodsStock('roupas');
 ok(city,'buy-clothes',{buildingId:b.id,garmentId:garment.garmentId});const index=c.wardrobe.findIndex(g=>g.garmentId===garment.garmentId);assert(index>=0);assert.equal(city.goodsStock('roupas'),stock);ok(city,'wear',{index});selectClothes(c);assert(Object.values(c.playerOutfit).includes(garment.garmentId));assert.equal(c.wardrobe[index].manufacturerId,garment.manufacturerId);
});

test('vehicle journeys use an owned physical vehicle and block conflicting commands until disembarking',()=>{
 const {city,c}=start(),dealer=site(city,c,'cycle_shop');dealer.inventory.bicicleta=1;city.vehicles.registerUnits(dealer,'bicicleta',1);const v=[...city.vehicles.units.values()].find(v=>v.holderAccountId===dealer.accountId&&!v.active);assert(v);at(c,dealer);const money=totalMoney(city);
 ok(city,'buy-vehicle',{buildingId:dealer.id,vehicleId:v.id});assert.equal(v.ownerAccountId,c.accountId);assert.equal(totalMoney(city),money);
 const goal={x:dealer.door.x+4,y:dealer.door.y};ok(city,'ride-vehicle',{vehicleId:v.id,...goal});assert.equal(v.driverId,c.id);assert(c.mobilityTrip);assert(!city.gameAction('buy-good',{buildingId:dealer.id,good:'madeira',quantity:1}));
 Object.assign(c.entity,{x:v.x,y:v.y});c.path=[];city.vehicles.update(.05);assert.equal(c.ridingVehicleId,v.id);const before={x:v.x,y:v.y};city.vehicles.update(.1);assert(Math.hypot(v.x-before.x,v.y-before.y)>0);ok(city,'leave-vehicle');assert.equal(v.driverId,null);assert.equal(c.ridingVehicleId,null);assert.equal(c.mobilityTrip,null);
 const p=city.citizens.find(p=>p!==c&&!p.entity.destroyed);v.ownerAccountId=p.accountId;assert(!city.gameAction('ride-vehicle',{vehicleId:v.id,...goal}));
});

test('owned plots create real construction contracts and reject another citizen plot',()=>{
 const {city,c}=start();assert(city.transfer('treasury',c.accountId,500000,'Fixture construction capital'));const plot=city.development.plots.find(p=>p.forSale&&!p.buildingId&&!p.projectId&&p.type!=='quarry'&&p.type!=='farm');assert(plot);const money=totalMoney(city);
 ok(city,'buy-plot',{plotId:plot.id});assert.equal(plot.ownerId,c.accountId);assert.equal(totalMoney(city),money);
 ok(city,'build',{plotId:plot.id,type:'residential',width:2,depth:2,floors:1});const project=city.development.projects.find(pr=>pr.id===plot.projectId);assert(project);assert(project.stone>0);assert.notEqual(project.status,'completed');assert.equal(project.accountId,c.accountId);assert.equal(totalMoney(city),money);
 assert(!city.gameAction('build',{plotId:plot.id,type:'residential',width:2,depth:2,floors:1}));
 const foreign=city.development.plots.find(p=>p.ownerId!==c.accountId);assert(!city.gameAction('build',{plotId:foreign.id,type:'residential',width:2,depth:2,floors:1}));
});

test('private entry offers an explicit trespass and interior room routing includes vertical paths',()=>{
 const {city,c}=start(),b=site(city,c,'artisan'),stranger=city.citizens.find(p=>p!==c&&!p.entity.destroyed);b.ownerId=stranger.id;b.units.forEach(u=>u.ownerId=stranger.accountId);at(c,b);
 assert(!city.gameAction('enter',{buildingId:b.id}));ok(city,'enter',{buildingId:b.id,force:true});assert(city.characterGame.intent.unauthorized);
 const room=b.units.find(u=>u.roomType!=='circulation');c.indoorLocation={buildingId:b.id,position:{x:b.entity.x+room.x+.5,y:b.entity.y+room.y+.5,z:0},floor:0,unitId:room.id,targetUnitId:room.id,path:[],exiting:false,layoutRevision:b.layoutRevision||0};characterMinute(city,c);assert(city.justice.cases.some(r=>r.type==='trespass'&&r.offenderId===c.id));
 assert(city.gameAction('explore-room',{unitId:room.id}),city.lastError);assert.equal(city.characterGame.intent.kind,'player-room');assert(!city.gameAction('explore-room',{unitId:-1}));
});

test('manual conversation changes actual relationships and a child requires both parents consent',()=>{
 const {city,c}=start(),p=city.citizens.find(p=>p!==c&&!p.entity.destroyed&&city.society.isAdult(p));c.indoorLocation=p.indoorLocation=null;Object.assign(p.entity,c.entity);const r=city.society.getRelation(c,p,true),trust=r.views[p.id].trust;
 ok(city,'talk',{citizenId:p.id});for(let i=0;i<8;i++)characterMinute(city,c);assert(r.views[p.id].trust>trust);
 c.partnerId=p.id;p.partnerId=c.id;c.personality={...c.personality,wantsChildren:true};p.personality={...p.personality,wantsChildren:false};assert(!city.gameAction('plan-child',{citizenId:p.id}));assert(!c.expectingId&&!p.expectingId);
});

test('a controlled council member declares a vote and is never replaced by an automatic preference',()=>{
 const {city,c}=start(),council=city.politics.council;council.members.push({citizenId:c.id,partyId:c.political.partyId});
 ok(city,'bill',{type:'tax',payload:{value:.2}});const bill=council.bills.at(-1);bill.status='proposed';
 const chamber=council.getChamber(),hall=chamber.hall();chamber.open=()=>true;chamber.present=()=>[c];council.totalWeight=()=>1;council.weight=()=>1;
 council.vote(bill);assert.equal(bill.status,'proposed');assert(bill.waitingForPlayerVote);
 ok(city,'council-vote',{billId:bill.id,yes:false});council.vote(bill);assert.equal(bill.status,'rejected');assert.equal(bill.votes[0].yes,false);assert.match(bill.votes[0].reason,/jogador/);
 assert(hall);assert(!city.gameAction('council-vote',{billId:bill.id,yes:true}));
});

test('manual construction remains active after leaving the entrance and pays only productive employee minutes',()=>{
 const {city,c}=start(),builder=city.buildings.find(b=>b.type==='builder');c.jobId=builder.id;builder.ownerId=city.citizens.find(p=>p.id!==c.id).id;builder.workers.push(c.id);city.minute=9*60;
 const project={id:'manual-site',builderId:builder.id,accountId:'treasury',door:{...c.entity},status:'building'};city.development.projects.push(project);let productive=true;city.development.work=()=>productive;
 ok(city,'work-project',{projectId:project.id});c.path=[];const cash=c.balance;characterMinute(city,c);const paid=c.balance;assert(paid>cash&&paid<=cash+builder.wage);
 c.entity.x+=5;productive=false;characterMinute(city,c);assert.equal(city.characterGame.intent.kind,'player-project');assert.equal(c.balance,paid);
 c.jobId=null;characterMinute(city,c);assert.equal(city.characterGame.intent,null);
});

test('weapons use carried stock, retain wear when reequipped and stop being equipped when sold',()=>{
 const {city,c}=start(),b=site(city,c);at(c,b);c.inventory.porrete=1;
 ok(city,'equip',{good:'porrete'});const weapon=c.equipment.weapon;weapon.durability=2;ok(city,'unequip',{good:'porrete'});ok(city,'equip',{good:'porrete'});assert.equal(c.equipment.weapon.durability,2);assert.equal(c.inventory.porrete,1);
 ok(city,'drop-good',{good:'porrete',quantity:1});assert(!c.equipment.weapon);assert.equal(c.inventory.porrete,0);
});

test('component lots retain their producer and design through purchases, drops, pickup and storage',()=>{
 const {city,c}=start(),b=site(city,c);at(c,b);b.inventory.quadro=2;b.componentLots={quadro:[{producerId:b.id,producerName:'Fabricante original',design:3,quantity:2}]};
 ok(city,'buy-good',{buildingId:b.id,good:'quadro',quantity:1});assert.equal(c.componentLots.quadro[0].design,3);
 ok(city,'drop-good',{good:'quadro',quantity:1});const item=city.playerGroundItems[0];ok(city,'pickup-good',{entityId:item.id,quantity:1});ok(city,'store-good',{buildingId:b.id,good:'quadro',quantity:1});assert(b.componentLots.quadro.every(l=>l.producerName==='Fabricante original'&&l.design===3));
});

test('a mayor sanctions explicitly without the simulation choosing a veto on their behalf',()=>{
 const {city}=start();ok(city,'simulation');const mayor=city.society.citizen(city.economy.mayorId);ok(city,'start',{citizenId:mayor.id});
 const council=city.politics.council,bill={id:9999,type:'tax',payload:{value:.2},status:'awaiting-sanction',sanctionAt:city.minute-1,attempts:0,title:'Decisão do prefeito'};council.bills.push(bill);
 council.hourly();assert.equal(bill.status,'awaiting-sanction');ok(city,'sanction',{billId:bill.id});assert.notEqual(bill.status,'awaiting-sanction');assert.equal(city.taxRate,.2);
});
