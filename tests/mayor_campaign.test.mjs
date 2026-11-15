import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney} from './helpers/city.mjs';
import {updateMayorCampaign} from '../js/city_mayor_campaign.js';
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
  for(const view of ['agenda','build','operations','council','orders']){ui.mayorView=view;renderMayorCampaign(ui,page);}
  assert(restored.mayorAction('observe'));renderMayorCampaign(ui,page);
});
