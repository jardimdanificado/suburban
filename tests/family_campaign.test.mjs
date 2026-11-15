import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney} from './helpers/city.mjs';
import {familyMembers,familyBusinesses,familyOffers,updateFamilyCampaign} from '../js/city_family_campaign.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
import {renderFamilyCampaign} from '../js/city_family_ui.js';

function start(options={}) {
  const city=setup({starter:true,population:24,...options});
  const person=city.citizens.find(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c));
  assert(city.familyAction('start',{citizenId:person.id,profile:'artisan'}),city.lastError);
  return {city,person};
}
function farm(city) {
  const project=city.familyAction('found',{type:'farm'});assert(project,city.lastError);
  assert.equal(project.status,'completed');assert.equal(project.stone,0);
  const b=familyBusinesses(city).find(b=>b.type==='farm');assert(b);
  return b;
}
function accept(city,b) {
  const offer=familyOffers(city).find(o=>o.good==='milho');assert(offer);
  assert(city.familyAction('accept',{offerId:offer.id,buildingId:b.id}),city.lastError);
  return city.familyCampaign.contracts.at(-1);
}

test('campaign grants one finite transfer and does not create money or goods',()=>{
  const city=setup({starter:true,population:24});
  const person=city.citizens.find(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c));
  const money=totalMoney(city),treasury=city.treasury,balance=person.balance;
  const stock={...city.economy.initialStock};
  assert(city.familyAction('start',{citizenId:person.id,profile:'artisan'}));
  assert.equal(person.balance,balance+1200000);assert.equal(city.treasury,treasury-1200000);
  assert.equal(totalMoney(city),money);assert.deepEqual(city.economy.initialStock,stock);
  assert(!city.familyAction('start',{citizenId:person.id,profile:'artisan'}));
  assert.equal(person.balance,balance+1200000);
});

test('invalid origin or public official cannot start a campaign',()=>{
  const city=setup({starter:true,population:24});const before=totalMoney(city);
  assert(!city.familyAction('start',{citizenId:city.economy.mayorId,profile:'artisan'}));
  assert(!city.familyAction('start',{citizenId:city.citizens[0].id,profile:'missing'}));
  assert.equal(city.familyCampaign,null);assert.equal(totalMoney(city),before);
});

test('player business uses actual land, seeds, capital, ownership and founder work',()=>{
  const {city,person}=start();const money=totalMoney(city),b=farm(city);
  assert.equal(b.constructionKind,'open-air');assert.equal(b.width,6);assert.equal(b.depth,6);
  assert.equal(b.ownerId,person.id);assert.equal(person.jobId,b.id);
  assert.equal(city.development.plots.find(p=>p.id===b.plotId).ownerId,person.accountId);
  assert(b.inventory.sementes>0);assert.equal(b.inventory.milho,0);
  assert.equal(totalMoney(city),city.currency.netIssued());
  assert(totalMoney(city)<=money,'seed imports may transfer money outside the city');
});

test('contracts reserve customer funds, reject duplicate acceptance and cannot invent dispatch stock',()=>{
  const {city}=start(),b=farm(city),money=totalMoney(city),r=accept(city,b);
  assert.equal(city.accounts.get(r.accountId).balance,r.budget);
  assert(!city.familyAction('accept',{offerId:r.offerId,buildingId:b.id}));
  assert(!city.familyAction('dispatch',{contractId:r.id}));
  assert.equal(r.delivered,0);assert.equal(totalMoney(city),money);
  const score=city.reputation.score(city.society.citizen(r.ownerId),'commerce');
  assert(city.familyAction('cancel',{contractId:r.id}));
  assert.equal(r.status,'cancelled');assert.equal(city.accounts.get(r.accountId).balance,0);
  assert.equal(city.reputation.score(city.society.citizen(r.ownerId),'commerce'),score-4);
  assert.equal(totalMoney(city),money);
});

test('real production and physical freight fulfill a first contract within the first workday',()=>{
  const {city,person}=start(),b=farm(city);
  assert(city.familyAction('fund',{buildingId:b.id,amount:100000}));
  const r=accept(city,b);
  for(let i=0;i<1000&&r.status==='active';i++){
    city.update(.25);
    if(b.inventory.milho>0)city.familyAction('dispatch',{contractId:r.id});
  }
  assert.equal(r.status,'completed',JSON.stringify({minute:city.minute,task:person.task,office:person.role,stock:b.inventory.milho,delivered:r.delivered,error:city.lastError}));
  assert.equal(r.delivered,r.quantity);assert.equal(r.revenue,r.quantity*r.unitPrice);
  assert(city.economy.produced.milho>=r.quantity);
  assert(city.logistics.shipments.some(s=>s.familyContractId===r.id&&s.status==='delivered'&&s.completedAt>s.createdAt&&s.routeLength>0));
  assert.equal(b.ownerId,person.id,'automatic appointment must not take the player business');
  assert.equal(city.accounts.get(r.accountId).balance,0);
  assert.equal(totalMoney(city),city.currency.netIssued());
});

test('deadline cancellation releases shipment goods, incoming capacity and both escrows',()=>{
  const {city}=start(),b=farm(city),r=accept(city,b);
  // Seed stock only to isolate the expiry transaction from agricultural timing.
  b.inventory.milho=6;city.economy.initialStock.milho+=6;
  const before=totalMoney(city);
  assert(city.familyAction('dispatch',{contractId:r.id}));
  const shipment=city.logistics.shipments.find(s=>s.familyContractId===r.id);
  assert(shipment);assert.equal(r.delivered,0);
  const buyer=city.building(r.buyerId),incoming=buyer.incoming.milho;
  city.minute=r.deadline;updateFamilyCampaign(city);
  assert.equal(r.status,'failed');assert.equal(shipment.status,'cancelled');
  assert.equal(buyer.incoming.milho,incoming-shipment.quantity);
  assert.equal(shipment.balance,0);assert.equal(city.accounts.get(r.accountId).balance,0);
  assert.equal(b.inventory.milho,6);assert.equal(totalMoney(city),before);
});

test('snapshot round trip retains campaign actions, escrow links and managed family',()=>{
  const {city,person}=start(),b=farm(city),r=accept(city,b);
  const graph=new CityStateGraph(),mirror=new CityStateGraph().apply(graph.encode({city})).city;
  bindCityState(mirror);
  assert.equal(mirror.familyCampaign.leaderId,person.id);
  assert.equal(typeof mirror.familyAction,'function');
  assert.equal(familyMembers(mirror)[0].playerManaged,true);
  assert(mirror.familyAction('cancel',{contractId:r.id}));
  assert.equal(mirror.familyCampaign.contracts[0].status,'cancelled');
  assert.equal(city.familyCampaign.contracts[0].status,'active');
  assert.equal(totalMoney(mirror),totalMoney(city));
});

test('family cannot operate another citizen company or act as an unrelated citizen',()=>{
  const {city}=start();const unrelated=city.citizens.find(c=>!c.playerManaged);
  const publicBusiness=city.economy.businesses.find(b=>b.municipal);
  assert(!city.familyAction('fund',{buildingId:publicBusiness.id,amount:100}));
  assert(!city.familyAction('found',{citizenId:unrelated.id,type:'farm'}));
  assert(!city.familyAction('employment',{buildingId:publicBusiness.id,baseWage:100}));
  assert(!city.familyAction('bill',{type:'build',payload:{buildingType:'bakery'}}));
});

test('political participation is opt-in and preserves normal eligibility checks',()=>{
  const {city,person}=start();
  assert.equal(city.politics.eligible(person),false);
  assert.equal(city.politics.canRun(person,'council'),false);
  assert(city.familyAction('politics',{enabled:true}));
  assert.equal(city.politics.eligible(person),true);
  assert(city.familyAction('politics',{enabled:false}));
  city.politics.ensureSecretaries();
  assert(!city.politics.officeHolder(person));
});

test('succession chooses a surviving relative without duplicating inherited wealth',()=>{
  const {city,person}=start();
  const heir=city.citizens.find(c=>c.id!==person.id&&city.society.isAdult(c));
  person.childIds.push(heir.id);heir.parentIds=[person.id];updateFamilyCampaign(city);
  assert(city.familyAction('heir',{citizenId:heir.id}));const money=totalMoney(city);
  person.entity.destroyed=true;updateFamilyCampaign(city);
  assert.equal(city.familyCampaign.leaderId,heir.id);assert.equal(city.familyCampaign.generation,2);
  assert.equal(totalMoney(city),money);assert.equal(heir.playerManaged,true);
});

test('victory requires sustained housing, health, completed deliveries and operating reserves',()=>{
  const {city,person}=start(),b=farm(city);
  assert(city.familyAction('fund',{buildingId:b.id,amount:100000}));
  // Isolate the sustained objective gate; delivery itself is exercised above.
  city.familyCampaign.contracts=[1,2,3].map(id=>({id,status:'completed'}));
  person.homeUnitId='fixture-home';person.needs.food=90;person.needs.health=90;
  updateFamilyCampaign(city);const since=city.familyCampaign.stableSince;assert.notEqual(since,null);
  city.minute=since+1439;updateFamilyCampaign(city);assert.equal(city.familyCampaign.wonAt,null);
  person.needs.food=39;updateFamilyCampaign(city);assert.equal(city.familyCampaign.stableSince,null);
  person.needs.food=90;updateFamilyCampaign(city);city.minute+=1440;updateFamilyCampaign(city);
  assert.equal(city.familyCampaign.status,'won');assert.equal(city.familyCampaign.wonAt,city.minute);
});

test('all campaign views render and offer family commands',()=>{
  const {city}=start();farm(city);
  const labels=[],p={heading(){},note(){},kv(){},status(){},record(){},windowLink(){},links(){},buttons(items){labels.push(...items.map(i=>i.label));},button(text){labels.push(text);}};
  const ui={city,matches:()=>true,resetScroll(){},section(page,key,title,render){render();}};
  for(const view of ['agenda','family','business','contracts','build','politics']){ui.familyView=view;assert.doesNotThrow(()=>renderFamilyCampaign(ui,p),view);}
  assert(labels.includes('DESPACHAR ESTOQUE')===false);assert(labels.includes('ENTRAR NA DISPUTA POLÍTICA'));
});
