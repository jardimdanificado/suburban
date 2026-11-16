import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney} from './helpers/city.mjs';
import {updateMayorCampaign,municipalOfficeVacancies} from '../js/city_mayor_campaign.js';
import {TILE_FLOOR,TILE_ROAD_GRASS_STONE} from '../js/world_gen.js?v=terrain-generation-reset-2-map-default-128';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
import {renderMayorCampaign} from '../js/city_mayor_ui.js';
const start=()=>{const city=setup({starter:true,population:24});assert(city.mayorAction('start'),city.lastError);return city;};

test('mayor mode uses incumbent party without creating funds and rejects restart or competing modes',()=>{
  const city=setup({starter:true,population:24}),cash=totalMoney(city),treasury=city.treasury;
  assert(city.mayorAction('start'));
  assert.equal(city.mayorCampaign.partyId,city.society.citizen(city.economy.mayorId).political.partyId);
  assert.equal(totalMoney(city),cash);assert.equal(city.treasury,treasury);
  assert(!city.mayorAction('start'));assert(!city.familyAction('start',{}));
  const person=city.citizens.find(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c));
  assert(!city.gameAction('start',{citizenId:person.id}));
  assert(!city.politics.executePlayerAction('divineTreasury',null,{amount:1000000}));
  assert(!city.politics.startPublicWork('farm','milho',{observer:true}));
  assert.equal(totalMoney(city),cash);
});

test('player assumes planning while existing work and ordinary simulation continue',()=>{
  const city=start(),projects=city.development.projects.length;
  const before=city.politics.agenda.lastPeriod;
  city.politics.agenda.hourly(true);city.development.planPublicWorks();city.fiscal.requestRevenueReview();
  assert.equal(city.politics.agenda.lastPeriod,before);assert.equal(city.development.projects.length,projects);
  const minute=city.minute;city.update(.25);assert.equal(city.minute,minute+1);
});

test('works require real budget, keep construction pending and allow only public priorities',()=>{
  const city=start();city.politics.fundInitialWorksBudget();
  const project=city.mayorAction('build',{type:'clinic'});assert(project,city.lastError);
  assert.equal(project.accountId,'treasury');assert.notEqual(project.status,'completed');
  assert.equal(project.inventory.pedra||0,0);assert(project.worksBudgetCharge>0);
  assert(city.mayorAction('priority',{projectId:project.id,value:200}));assert.equal(project.priority,200);
  assert(!city.mayorAction('priority',{projectId:project.id,value:Infinity}));
  project.accountId=city.citizens[0].accountId;
  assert(!city.mayorAction('priority',{projectId:project.id,value:10}));
  const beforeOffice=city.treasury,officeBudget=city.politics.ensureWorksBudget();
  assert(!city.mayorAction('build',{type:'bank'}));
  assert.equal(city.treasury,beforeOffice);assert.equal(city.politics.ensureWorksBudget(),officeBudget);
  const budget=city.politics.worksAccount();city.transfer('works-budget','treasury',budget.balance,'Fixture empty works');
  assert(!city.mayorAction('build',{type:'clinic'}));
  assert.equal(totalMoney(city),city.currency.netIssued());
});

test('funding and services spend municipal funds and do not instantly repair',()=>{
  const city=start(),b=city.buildings.find(b=>city.fiscal.municipal(b)&&b.units.length&&b.constructionKind!=='open-air');
  const cash=totalMoney(city),treasury=city.treasury,balance=b.balance;
  assert(city.mayorAction('fund',{buildingId:b.id,amount:10000}),city.lastError);
  assert.equal(b.balance,balance+10000);assert.equal(city.treasury,treasury-10000);
  assert(!city.mayorAction('fund',{buildingId:b.id,amount:city.treasury}));
  assert(!city.mayorAction('fund',{buildingId:b.id,amount:-1}));
  b.condition=40;const job=city.mayorAction('service',{buildingId:b.id,service:'repair'});assert(job,city.lastError);
  assert.equal(job.payerAccountId,'treasury');assert.equal(job.status,'open');assert.equal(b.condition,40);
  assert(!city.mayorAction('service',{buildingId:b.id,service:'repair'}));
  assert.equal(totalMoney(city),cash);
});

test('budget requests follow the council and player decides sanction',()=>{
  const city=start(),p=city.politics;
  const before=p.ensureWorksBudget();
  const bill=city.mayorAction('bill',{type:'worksTransfer',value:10000});assert(bill,city.lastError);
  assert.equal(p.ensureWorksBudget(),before);assert.notEqual(bill.status,'executed');
  assert(!city.mayorAction('sanction',{billId:bill.id}));
  bill.status='awaiting-sanction';bill.sanctionAt=city.minute-1;
  p.council.hourly();assert.equal(bill.status,'awaiting-sanction');
  assert(city.mayorAction('sanction',{billId:bill.id}));assert.equal(p.ensureWorksBudget(),before+10000);
});

test('cabinet appointments replace and release municipal secretaries',()=>{
  const city=start(),p=city.politics,mayorId=city.economy.mayorId,row=()=>p.secretaries.find(item=>item.officeId==='finance');
  const first=city.citizens.find(c=>c.id!==mayorId&&city.society.isAdult(c)&&!p.officeHolder(c));
  assert(city.mayorAction('appoint',{officeId:'finance',citizenId:first.id}),city.lastError);
  assert.equal(row().citizenId,first.id);assert.equal(first.role,'secretary');assert.equal(first.secretaryOffice,'finance');assert.equal(row().appointedByMayorId,mayorId);
  const second=city.citizens.find(c=>c.id!==mayorId&&c.id!==first.id&&city.society.isAdult(c)&&!p.officeHolder(c));
  assert(city.mayorAction('appoint',{officeId:'finance',citizenId:second.id}),city.lastError);
  assert.equal(row().citizenId,second.id);assert.equal(first.secretaryOffice,undefined);
  assert(!city.mayorAction('appoint',{officeId:'finance',citizenId:mayorId}));
  assert(city.mayorAction('dismiss',{officeId:'finance'}),city.lastError);
  assert.equal(row().citizenId,null);assert.equal(second.secretaryOffice,undefined);
  assert(!city.mayorAction('dismiss',{officeId:'finance'}));
});

test('executive decrees use the approved interval and leave constitutional matters to the council',()=>{
  const city=start(),p=city.politics;
  p.lastDecreeAt=city.minute-p.policy.mayorDecreeDays*1440;
  const decree=city.mayorAction('decree',{type:'roads',payload:{value:'lamps'}});assert(decree,city.lastError);
  assert.equal(decree.decree,true);assert.equal(decree.status,'awaiting-secretary-review');
  assert(!city.mayorAction('decree',{type:'worksTransfer',payload:{value:10000}}));
  assert(!city.mayorAction('decree',{type:'reelectionLimit',payload:{value:9}}));
});

test('general legislative agenda reaches the council for any policy',()=>{
  const city=start(),p=city.politics;
  const wage=city.mayorAction('bill',{type:'minimumWage',payload:{value:p.policy.minimumWage+1}});
  assert(wage,city.lastError);assert.equal(wage.type,'minimumWage');assert.equal(wage.title,'Salário mínimo');
  const transport=city.mayorAction('bill',{type:'transportPolicy',payload:{policy:'cycling'}});
  assert(transport,city.lastError);assert.equal(transport.type,'transportPolicy');
  assert(!city.mayorAction('bill',{type:'inexistente',payload:{}}));
});

test('ownership bills, road access and expansion stay in the institutional flow',()=>{
  const city=start(),p=city.politics,firm=city.economy.businesses.find(b=>b.municipal&&!['townhall','mint'].includes(b.type));
  const nationalize=city.mayorAction('nationalize',{buildingId:firm.id});assert(nationalize,city.lastError);assert.equal(nationalize.type,'nationalize');
  const privatize=city.mayorAction('privatize',{buildingId:firm.id,percent:25});assert(privatize,city.lastError);assert.equal(privatize.payload.percent,25);
  const target=city.buildings.find(b=>!b.entity.destroyed&&b.type!=='townhall'&&b.accessPath?.length);target.accessPath=[];
  assert(!p.roadConnected(target));
  const road=city.mayorAction('road',{buildingId:target.id});assert(road,city.lastError);assert.equal(road.accountId,'treasury');assert.equal(road.service,'road');
  const hall=city.townhall(),expansion=city.mayorAction('expand',{buildingId:hall.id,floors:1});assert(expansion,city.lastError);assert.equal(expansion.accountId,'treasury');assert.equal(expansion.service,'expansion');
});

test('municipal firms, offices, programs, upkeep and paving are playable orders',()=>{
  const city=start(),p=city.politics;
  const farm=city.mayorAction('firm',{type:'farm',crop:'milho'});assert(farm,city.lastError);
  assert.equal(farm.accountId,'treasury');assert.equal(farm.type,'farm');assert.equal(farm.executiveInitiative,true);
  const vacancy=municipalOfficeVacancies(city)[0];assert(vacancy);
  const office=city.mayorAction('office',{type:'newsroom',towerId:vacancy.tower.id,floor:vacancy.floor});
  assert(office,city.lastError);assert.equal(office.type,'newsroom');assert.equal(office.municipal,true);
  assert(!city.mayorAction('office',{type:'newsroom',towerId:vacancy.tower.id,floor:vacancy.floor}));
  const firm=city.economy.businesses.find(b=>b.municipal&&b.active&&!b.entity.destroyed&&b.type!=='townhall');
  firm.totalRevenue=(firm.totalExpenses||0)+city.currency.price(80000);firm.balance=Math.max(firm.balance||0,city.currency.price(300000));
  const treasury=city.treasury,result=city.mayorAction('dividend',{buildingId:firm.id});
  assert(result>0,city.lastError);assert.equal(city.treasury,treasury+result);
  const offer=city.mayorAction('offerShares',{buildingId:firm.id,percent:1});assert(offer,city.lastError);assert(offer.offer.id);
  const waif=city.citizens.find(c=>city.society.isAdult(c)&&!c.homeUnitId&&c.balance<city.currency.price(20000));assert(waif);
  const balance=waif.balance,voucher=city.mayorAction('rentVoucher',{citizenId:waif.id});assert(voucher,city.lastError);
  assert.equal(waif.balance,balance+voucher.amount);
  const resident=city.citizens.find(c=>city.society.isAdult(c)&&!c.businessIds?.length&&!c.homeUnitId);
  const loan=city.mayorAction('equityLoan',{citizenId:resident.id,buildingId:firm.id});assert(loan,city.lastError);
  assert(p.stateEquityLoans.some(row=>row.citizenId===resident.id&&row.remaining>0));
  const municipal=city.buildings.find(b=>city.fiscal.municipal(b)&&b.type!=='townhall');municipal.condition=40;
  const repair=city.mayorAction('maintain',{buildingId:municipal.id});assert(repair,city.lastError);assert.equal(repair.service,'repair');
  let paved=null;for(let y=0;y<city.world.height&&!paved;y++)for(let x=0;x<city.world.width&&!paved;x++)if(city.world.getTile(x,y)===TILE_FLOOR&&!city.occupied.has(`${x},${y}`))paved={x,y};
  assert(paved);city.world.setTile(paved.x,paved.y,TILE_ROAD_GRASS_STONE);(city.world.roadCondition??=new Map()).set(`${paved.x},${paved.y}`,0);
  const roads=city.development.cityRoadNeedsRepair();assert(roads.some(point=>Math.floor(point.x)===paved.x&&Math.floor(point.y)===paved.y));
  const repaired=city.mayorAction('roadRepair');assert(repaired,city.lastError);assert.equal(repaired.service,'road-repair');
  assert.equal(city.mayorAction('paving')?.service,'road');
  const lighting=city.mayorAction('lighting');
  if(lighting)assert(lighting.count>0);else assert(city.lastError);
  const restock=city.mayorAction('restock');
  if(restock)assert(restock.shipments>0);else assert(city.lastError);
  for(const home of [...city.housing.homes.values()])if(city.housing.isSocial(home))city.housing.homes.delete(home.id);
  const housing=city.mayorAction('housing');assert(housing,city.lastError);assert(housing.executiveInitiative);
  assert.doesNotThrow(()=>city.mayorAction('rally'));
});

test('same-party succession continues; opposing takeover ends once and freezes until observation',()=>{
  const city=start(),p=city.politics,partyId=city.mayorCampaign.partyId;
  const successor=city.citizens.find(c=>c.id!==city.economy.mayorId&&city.society.isAdult(c));
  p.initializeCitizen(successor);successor.political.partyId=partyId;
  p.takeOffice(successor,'Teste de sucessão');assert.equal(city.mayorCampaign.status,'active');
  const other=p.parties.find(p=>p.id!==partyId&&p.active);successor.political.partyId=other.id;
  p.syncGoverningFlag();assert.equal(city.mayorCampaign.status,'defeated');
  const orders=city.mayorCampaign.orders.length,minute=city.minute,ended=city.mayorCampaign.endedAt;
  updateMayorCampaign(city);city.update(10);city.stepMinute();
  assert.equal(city.minute,minute);assert.equal(city.mayorCampaign.endedAt,ended);
  assert(!city.mayorAction('fund',{buildingId:city.buildings[0].id,amount:100}));assert.equal(city.mayorCampaign.orders.length,orders);
  assert(city.mayorAction('observe'));city.update(.25);assert.equal(city.minute,minute+1);
  assert(!city.mayorAction('start'));
});

test('campaign and command methods survive state serialization; UI renders every view',()=>{
  const city=start(),graph=new CityStateGraph(),packet=graph.encode({city,entities:city.entities||[],nextId:10000});
  const restored=new CityStateGraph().apply(packet).city;bindCityState(restored);
  assert.equal(restored.mayorCampaign.partyId,city.mayorCampaign.partyId);
  assert.equal(typeof restored.mayorAction,'function');
  const page=new Proxy({}, {get:()=>()=>{}});
  const ui={city:restored,matches:()=>true,selectControl(){},openPanel(){},resetScroll(){}};
  for(const view of ['agenda','build','operations','cabinet','policies','council','orders']){ui.mayorView=view;renderMayorCampaign(ui,page);}
  for(const section of ['tax','labor','social','order','transport','economy','elections','justice','identity']){ui.mayorPolicyView=section;ui.mayorView='policies';renderMayorCampaign(ui,page);}
  for(const instrument of ['bill','decree']){ui.mayorInstrument=instrument;renderMayorCampaign(ui,page);}
  for(const office of ['finance','security','labor']){ui.mayorOffice=office;ui.mayorView='cabinet';renderMayorCampaign(ui,page);}
  assert(restored.mayorAction('observe'));renderMayorCampaign(ui,page);
});
