import test from 'node:test';
import assert from 'node:assert/strict';
import { CitySimulation } from '../js/city_simulation.js';
import { WorldClock } from '../js/world.js';
import { updateMarket, planSupplyChains, bootstrapEnterprise, carryCapacity } from '../js/city_markets.js';
import { scandalEligible, organizeScheme } from '../js/city_political_institutions.js';
import { CityStateGraph, bindCityState } from '../js/city_state.js';
import { renderPolitics } from '../js/city_politics_ui.js';

function cityOf(population=80){
  const tiles=new Uint8Array(128*128);let id=0;
  const world={width:128,height:128,revision:0,spawnCenter:{x:64,y:64},clock:new WorldClock(),getTile(x,y){return tiles[y*128+x];},setTile(x,y,t){tiles[y*128+x]=t;this.revision++;}};
  const city=new CitySimulation({world,population,createEntity:data=>({id:++id,destroyed:false,...data})});city.initialize();return city;
}
function addFirm(city,type){
  for(const site of city.economy.locateBuilding(type)){const b=city.addBuilding(type,site.x,site.y,{...site,width:3,depth:3,floors:1,free:true});if(b){city.economy.activateMunicipalBusiness(b,100000);return b;}}
  throw Error(`Missing site: ${type}`);
}
function money(city){return [...city.accounts.values()].reduce((n,a)=>n+a.balance,0);}
function plenary(city,minute=city.minute){
  const chamber=city.politics.council.getChamber(),hall=chamber.hall()||addFirm(city,'council_chamber');
  if(hall.floors<2){city.housing.addFloor(hall,1,'treasury');hall.floors=2;}
  city.minute=Math.floor(minute/1440)*1440+600;
  for(const c of city.politics.council.people()){c.task='council-session';c.path=[];c.councilSession={buildingId:hall.id};c.entity.x=hall.door.x;c.entity.y=hall.door.y;for(const k of Object.keys(c.needs))c.needs[k]=95;}
  chamber.minute();return hall;
}

test('chamber follows population bounds, elects president halfway and divides a fixed salary budget',()=>{
  const city=cityOf(),p=city.politics,c=p.council;c.ensure();assert.equal(c.seats,4);assert.equal(c.members.length,4);assert.deepEqual(c.bounds(),{population:80,min:4,max:10});plenary(city);
  assert.equal(p.submitBill('councilSeats',{value:11}),null);assert.match(city.lastError,/entre 4 e 10/);
  p.policy.councilBudget=1001;p.policy.mayorBudget=333;city.welfare.policy.reserve=0;
  const treasury=city.treasury;c.hourly();assert.equal(treasury-city.treasury,1334);
  plenary(city,p.termStartedAt+p.termRules.termMinutes/2);c.hourly();assert(c.leaderId);assert.equal(c.weight(c.leaderId),2);assert.equal(c.totalWeight(),5);assert.equal(c.leaderElections.at(-1).ballots.length,4);
});

test('proven small cases do not auto-impeach; serious cases need widespread awareness and may stay undiscovered',()=>{
  const city=cityOf(),p=city.politics,mayor=city.society.citizen(city.economy.mayorId),before=money(city);
  const record=p.crime(mayor,'embezzlement','treasury',mayor.accountId,1000);assert(record);assert.equal(money(city),before);
  record.proven=true;record.severity=30;record.awareIds=city.citizens.map(c=>c.id);assert.equal(scandalEligible(p,record),false);
  record.severity=80;record.awareIds=[];assert.equal(scandalEligible(p,record),false);record.awareIds=city.citizens.map(c=>c.id);assert(scandalEligible(p,record));
  const hidden=p.crime(mayor,'embezzlement','treasury',mayor.accountId,1000);const random=city.random;city.random=()=>.99;
  for(let day=1;day<=30;day++){city.minute=480+day*1440;p.investigate();}city.random=random;assert.equal(hidden.discoveredAt,null);assert(hidden.archived);assert(!p.council.bills.some(b=>b.type==='impeach'&&b.payload.caseId===hidden.id));
});

test('mayor veto hurts approval and the chamber can override it with weighted supermajority',()=>{
  const city=cityOf(),p=city.politics,c=p.council;const bill=c.propose(c.people()[0],'tax',{value:.12});plenary(city);c.preference=()=>({yes:true,reason:'test electorate'});c.vote(bill);assert.equal(bill.status,'awaiting-sanction');
  p.updateApproval();const before=p.approval;assert(p.vetoBill(bill.id));assert.equal(bill.status,'vetoed');assert(p.approval<before);c.vote(bill,true);assert.equal(bill.status,'executed');assert.equal(city.taxRate,.12);assert(bill.vetoOverridden);
});

test('vice mayor succeeds first, and chamber president succeeds when both executive offices are vacant',()=>{
  const city=cityOf(),p=city.politics,vice=p.viceMayorId;assert(vice);plenary(city);p.council.electLeader();const president=p.council.leaderId,deadline=p.nextElectionAt;
  city.society.citizen(city.economy.mayorId).entity.destroyed=true;p.ensureMayor();assert.equal(city.economy.mayorId,vice);assert.equal(p.nextElectionAt,deadline);
  city.society.citizen(vice).entity.destroyed=true;p.ensureMayor();assert.equal(city.economy.mayorId,president);assert.equal(p.nextElectionAt,deadline);
});

test('kitchen consumes ingredients before making meals and ingredient dislikes survive the transformation',()=>{
  const city=cityOf(),b=addFirm(city,'kitchen'),c=city.citizens.find(c=>!city.politics.officeHolder(c));
  Object.assign(b.inventory,{feijao:2,arroz:2,alface:1,tomate:1});b.cookingLabor=17;c.skills.baking=100;assert(city.economy.productionWork(b,c));assert.equal(b.inventory.marmita,3);assert.equal(b.inventory.arroz,0);assert.equal(b.inventory.tomate,0);
  city.transfer('treasury',c.accountId,10000,'Test income');c.foodPreferences={marmita:0,feijao:-1,arroz:-1,alface:-1,tomate:-1};const offer=city.economy.mealOffer(b,c);assert.deepEqual(offer.inputs,{marmita:1});assert(offer.ingredients.tomate);assert(city.economy.mealTaste(c,offer)<0);
  const food=c.needs.food;c.task='food';assert(city.economy.consumeMeal(c,b));assert.equal(b.inventory.marmita,2);assert(c.needs.food>food);assert(c.mood<0);
});

test('liked foods create demand and market prices move up on scarcity and down with surplus',()=>{
  const city=cityOf();for(const c of city.citizens)c.foodPreferences={tomate:1,alface:0};city.economy.updateDemand();const d=g=>city.economy.demands.find(d=>d.crop===g);assert(d('tomate').required>d('alface').required);assert(d('tomate').score>=100);
  const before=city.economy.goods.tomate.price;updateMarket(city.economy);assert(city.economy.goods.tomate.price>before);const hall=city.buildings.find(b=>b.type==='townhall');hall.inventory.tomate=10000;const high=city.economy.goods.tomate.price;updateMarket(city.economy);assert(city.economy.goods.tomate.price<high);
});

test('artisans make real carrying equipment; ownership expands actual order and driver capacity',()=>{
  const city=cityOf(),artisan=addFirm(city,'artisan'),c=city.citizens.find(c=>!city.politics.officeHolder(c));Object.assign(artisan.inventory,{madeira:3,fibras:2});artisan.productionLabor=24;assert(city.economy.productionWork(artisan,c));assert.equal(artisan.inventory.cesta,2);assert.equal(artisan.inventory.madeira,0);
  city.transfer('treasury',c.accountId,10000,'Test income');c.entity.x=artisan.door.x;c.entity.y=artisan.door.y;assert(city.economy.buyConsumerGood(c,artisan));assert.equal(carryCapacity(c),36);
  const seller=addFirm(city,'market'),buyer=addFirm(city,'market');seller.inventory.pao=100;buyer.ownerId=c.id;const shipment=city.logistics.order(seller,buyer,'pao',36,0);assert(shipment);assert(city.logistics.candidates(shipment).every(c=>carryCapacity(c)>=36));assert.equal(city.logistics.order(seller,buyer,'pao',37,0),false);const total=money(city);c.equipment={};city.logistics.splitLoad(shipment);const pieces=city.logistics.shipments.filter(s=>s.buyer===buyer);assert.equal(pieces.reduce((n,s)=>n+s.quantity,0),36);assert(pieces.every(s=>s.quantity<=24));assert.equal(buyer.incoming.pao,36);assert.equal(money(city),total);
  Object.assign(artisan.inventory,{madeira:5,fibras:1});artisan.productionLabor=24;assert(city.economy.productionWork(artisan,c));assert.equal(artisan.inventory.carrinho,1);assert.equal(artisan.inventory.madeira,0);assert(city.economy.buyConsumerGood(c,artisan));assert.equal(carryCapacity(c),72);
});

test('unemployed founders can pool money for a small real business, and supply agreements connect producers',()=>{
  const city=cityOf();city.welfare.policy.reserve=0;for(const c of city.citizens.filter(c=>!city.politics.officeHolder(c)&&!c.jobId).slice(0,6))city.transfer('treasury',c.accountId,4000,'Test savings');
  city.economy.demands=[{type:'market',score:120}];const total=money(city);assert(bootstrapEnterprise(city.economy));assert(city.buildings.some(b=>b.type==='market'&&b.micro));assert.equal(money(city),total);
  const mill=addFirm(city,'sawmill'),forestry=addFirm(city,'forestry');forestry.inventory.madeira=20;city.economy.updateDemand();planSupplyChains(city.economy);assert(city.economy.supplyAgreements.some(a=>a.sellerId===forestry.id&&a.buyerId===mill.id&&a.good==='madeira'));
});

test('campaigns expose unfulfilled promises and candidate programs differ',()=>{
  const city=cityOf(),p=city.politics;p.beginElection();assert(p.active.candidates.every(n=>n.viceId&&n.promises.length===1));const programs=p.active.candidates.map(n=>n.promises.map(pr=>pr.title).join('|'));assert(new Set(programs).size>2);
  const incumbent=p.active.candidates.find(n=>n.citizenId===city.economy.mayorId),challenger=p.active.candidates.find(n=>n.citizenId!==incumbent.citizenId);assert(challenger);p.campaigns.criticize(challenger,p.active);assert(p.active.events.some(e=>e.kind==='campaign-accountability'));
});

test('a real public contract can fund a multi-person kickback scheme without creating currency',()=>{
  const city=cityOf(),p=city.politics,mayor=city.society.citizen(city.economy.mayorId),builder=city.economy.businesses.find(b=>b.type==='builder');
  const entrepreneur=city.citizens.find(c=>!p.officeHolder(c));builder.ownerId=entrepreneur.id;builder.municipal=false;entrepreneur.businessIds=[builder.id];
  for(const member of p.council.people())member.traits={...member.traits,honesty:1};const accomplice=p.council.people()[0];accomplice.traits={...accomplice.traits,honesty:.05};accomplice.political.partyId=mayor.political.partyId;
  const lot=city.development.plots.find(l=>!l.type&&!l.buildingId&&!l.projectId);assert(lot);const project=city.development.beginProject('treasury',lot.id,'kitchen',{width:3,depth:3,floors:1,builderId:builder.id});assert(project);
  const total=money(city),record=organizeScheme(p,mayor);assert(record);assert.equal(record.type,'contract-overbilling');assert.equal(record.projectId,project.id);assert(record.participantIds.includes(accomplice.id));assert(record.participantIds.includes(entrepreneur.id));assert.equal(record.steps.length,3);assert.equal(money(city),total);assert.equal(builder.favoredBy,mayor.id);
});

test('allies and accomplices can protect a politician even when a major scandal is proven',()=>{
  const city=cityOf(),p=city.politics,c=p.council,mayor=city.society.citizen(city.economy.mayorId),voter=c.people()[0],author=c.people()[1];
  const record={id:800,accusedId:mayor.id,severity:90,proven:true,awareIds:city.citizens.map(c=>c.id),participantIds:[voter.id]};p.scandals.push(record);
  voter.traits={...voter.traits,honesty:0};voter.political.partyId=mayor.political.partyId;voter.political.loyalty=1;
  const bill=c.propose(author,'impeach',{targetId:mayor.id,caseId:record.id});assert(bill);assert.equal(c.preference(voter,bill).yes,false);
});

test('worker snapshots retain dynamic prices, vice presidency and individual carrying equipment',()=>{
  const city=cityOf(),sender=new CityStateGraph(),receiver=new CityStateGraph();updateMarket(city.economy);city.citizens[0].equipment={carrinho:{boughtAt:city.minute}};
  const root=receiver.apply(sender.encode({city}));bindCityState(root.city);assert.equal(root.city.economy.goods.tomate.price,city.economy.goods.tomate.price);assert.equal(root.city.politics.viceMayorId,city.politics.viceMayorId);assert.equal(carryCapacity(root.city.citizens[0]),72);assert.equal(root.city.politics.council.bounds().max,10);
});

test('two election cycles retain lawful chamber sizes, tickets and money conservation',()=>{
  const city=cityOf(64),p=city.politics;
  for(let election=0;election<2;election++){
    city.minute=p.nextElectionAt-p.termRules.campaignMinutes;p.hourly();assert(p.active);const total=money(city);
    for(let round=0;round<2&&p.active;round++){
      const e=p.active;city.minute=e.voteAt;e.status='campaign';p.voting.open(e);assert.equal(e.status,'voting');
      for(const row of e.electorate){const c=city.society.citizen(row.citizenId);c.entity.x=city.buildings[0].door.x;c.entity.y=city.buildings[0].door.y;c.path=[];c.task='vote';c.voting={electionId:e.id};row.status='casting';p.voting.cast(e,row);}
      assert.equal(e.ballots.length,64);assert.equal(new Set(e.ballots.map(b=>b.citizenId)).size,64);p.voting.close(e);
    }
    assert(p.lastResult);assert.equal(p.active,null);assert.equal(p.council.seats,4);assert(!p.council.members.some(m=>m.citizenId===p.viceMayorId||m.citizenId===city.economy.mayorId));assert.equal(money(city),total);
  }
});

test('temporary suspension uses the vice and restores the mayor without resetting promises or election date',()=>{
  const city=cityOf(),p=city.politics,original=city.economy.mayorId,vice=p.viceMayorId,term=p.mandates.current,deadline=p.nextElectionAt;
  p.scandals.push({id:500,accusedId:original,proven:true});assert(p.suspendMayor(2,500,300));assert.equal(city.economy.mayorId,vice);assert.equal(p.mandates.current,term);
  city.minute+=2*1440;p.resumeExecutive();assert.equal(city.economy.mayorId,original);assert.equal(p.viceMayorId,vice);assert.equal(p.mandates.current,term);assert.equal(p.nextElectionAt,deadline);
});

test('a resident without a job can finance a microbusiness from existing bank capital',()=>{
  const city=cityOf(),founder=city.citizens.find(c=>!city.politics.officeHolder(c)&&!c.jobId);city.transfer('treasury',founder.accountId,500,'Test savings');city.economy.demands=[{type:'market',score:120}];const total=money(city);
  assert(bootstrapEnterprise(city.economy));const loan=city.bank.loans.find(l=>l.clientId===founder.accountId&&l.purpose==='business');assert(loan);assert(founder.businessIds.length);assert.equal(money(city),total);
});

test('politics panels render new constitutional and production metrics without missing values',()=>{
  const city=cityOf(),ui={city,matches:()=>true,resetScroll(){},openCitizen(){},openBuilding(){},openEvent(){}};
  const panel=new Proxy({ui,x:0,y:0,visible:()=>false},{get:(target,key)=>key in target?target[key]:(...args)=>{if(key==='kv'&&typeof args[1]==='number')assert(Number.isFinite(args[1]));}});
  city.politics.beginElection();city.politics.vote();for(const tab of ['overview','parties','council','campaign','polls','promises','scandals','results']){ui.politicsTab=tab;assert.doesNotThrow(()=>renderPolitics(ui,panel));}
});
