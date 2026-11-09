import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, totalMoney, finishActivityRoute, putAtWorkCell } from './helpers/city.mjs';
import { SOCIAL_RULES } from '../js/city_society.js';
import { qualification } from '../js/city_employment.js';
import { advanceCitizenInterior } from '../js/city_interiors.js';

function pair(city) {
  const [a, b] = city.citizens;
  a.entity.x = 64.5; b.entity.x = 65.5; a.entity.y = b.entity.y = 64.5;
  for (const c of [a, b]) { c.path = []; c.task = 'social'; c.personality=Object.freeze({...c.personality,wantsRomance:true,wantsChildren:true,interest:0});c.socialProfile=Object.freeze({...c.socialProfile,orientation:'bi',temper:.1});c.prejudices={}; }
  const r=city.society.getRelation(a,b,true);for(const view of Object.values(r.views)){view.attraction=90;view.affection=50;view.trust=45;}
  return [a, b];
}
function bond(city, a, b) {
  const random = city.random;
  city.random = () => .2;
  for (let i = 0; i < 36; i++) {
    city.minute += 40;
    a.lastConversationAt = b.lastConversationAt = city.minute - SOCIAL_RULES.conversationCooldown - 1;
    for (const c of [a, b]) { c.task = 'social'; c.path = []; c.needs.food = c.needs.water = c.needs.energy = 80; }
    assert(city.society.startConversation(a, b));
    city.minute = a.conversation.until;
    city.society.finishConversation(a, b, a.conversation);
  }
  city.random = random;
  return city.society.getRelation(a, b);
}

test('conversations need proximity, availability and cooldown; each person talks to one other', () => {
  const city = setup(), [a, b] = pair(city), third = city.citizens[2];
  b.entity.x += 20;
  assert.equal(city.society.startConversation(a, b), false);
  b.entity.x = a.entity.x + 1;
  assert(city.society.startConversation(a, b));
  assert.equal(a.conversation, b.conversation);
  assert.equal(city.society.startConversation(a, third), false);
  assert.equal(city.society.startConversation(a, a), false);
  const conversation = a.conversation;
  city.minute = conversation.until;
  city.society.finishConversation(a, b, conversation);
  assert.equal(a.conversation, null); assert.equal(b.conversation, null);
  assert.equal(city.society.startConversation(a, b), false);
  const r = city.society.getRelation(a, b);
  assert.equal(r.conversations, 1); assert.equal(city.society.getRelation(b, a), r);
  assert(city.events.some(e => e.data.kind === 'conversation' && e.citizenIds.includes(a.id)));
});

test('daily social cleanup forgets stale weak acquaintances and keeps meaningful bonds',()=>{
  const city=setup({population:24}),[a,b,c,d]=city.citizens;
  const cold=city.society.getRelation(a,b,true);cold.contexts=[];cold.familiarity=5;cold.lastContact=city.minute-SOCIAL_RULES.forgetAfter-1;
  const strong=city.society.getRelation(c,d,true);strong.contexts=[];strong.familiarity=20;strong.lastContact=city.minute-SOCIAL_RULES.forgetAfter-1;
  for(const view of Object.values(strong.views)){view.affection=50;view.trust=45;}
  city.relationships.sync(strong);city.society.daily();
  assert.equal(city.society.getRelation(a,b),undefined);
  assert.equal(city.society.contactIndex.has(a.id),false);assert.equal(city.society.contactIndex.has(b.id),false);
  assert.equal(city.society.getRelation(c,d),strong);
  const renewed=city.society.getRelation(a,b,true);assert(renewed);assert.notEqual(renewed,cold);
});

test('repeated mutual encounters form friendships and adult partnerships', () => {
  const city = setup(), [a, b] = pair(city);
  const r = bond(city, a, b);
  assert.equal(a.partnerId, b.id); assert.equal(b.partnerId, a.id);
  assert.equal(r.status, 'partner');
  for (const status of ['friend','close']) assert(city.getEvents({limit:500,category:'relationship'}).some(e=>e.data.kind==='personal-bond-changed'&&e.data.status===status));
  assert(city.getEvents({limit:500,category:'relationship'}).some(e=>e.data.kind==='partnership'));
  const third = city.citizens[2];
  assert.equal(city.society.canPartner(a, third), false);
});

test('romance excludes minors and relatives, including shared ancestors', () => {
  const city = setup(), [a, b] = pair(city), child = city.addCitizen(64, 64, 25, { age: 5, parentIds: [a.id], grant: false });
  assert.equal(city.society.canPartner(child, b), false);
  child.initialAge = 20;
  assert.equal(city.society.canPartner(child, a), false);
  const sibling = city.addCitizen(64, 64, 26, { age: 22, parentIds: [a.id], grant: false });
  assert.equal(city.society.canPartner(child, sibling), false);
  const cousin = city.addCitizen(64, 64, 27, { age: 20, parentIds: [sibling.id], grant: false });
  assert(city.society.related(child, cousin));
  b.personality=Object.freeze({...b.personality,wantsRomance:false});
  assert.equal(city.society.canPartner(a, b), false);
});

test('neglect and disagreements can end a partnership on both sides', () => {
  const city = setup(), [a, b] = pair(city), r = bond(city, a, b);
  for(const v of Object.values(r.views)){v.affection=-1;v.trust=10;}r.lastContact=city.minute-3*1440;city.relationships.sync(r);
  city.society.daily();
  assert.equal(a.partnerId, null); assert.equal(b.partnerId, null);
  assert(city.events.some(e => e.data.kind === 'breakup'));
});

test('families require stability, preferences and resources and create a child once after the due date', () => {
  const city = setup(), [a, b] = pair(city), r = bond(city, a, b);
  assert.equal(city.society.planChild(a, b), null);
  city.minute = r.partnerSince + 2 * 1440;
  a.personality=Object.freeze({...a.personality,wantsChildren:false});
  assert.equal(city.society.planChild(a, b), null);
  a.personality=Object.freeze({...a.personality,wantsChildren:true});
  const pregnancy = city.society.planChild(a, b);
  assert(pregnancy); assert.equal(city.society.planChild(a, b), null);
  assert.equal(city.society.giveBirth(pregnancy), null);
  const population = city.citizens.length, money = totalMoney(city);
  city.minute = pregnancy.dueAt;
  const child = city.society.giveBirth(pregnancy);
  assert(child); assert.equal(city.citizens.length, population + 1);
  assert.deepEqual(child.parentIds, [a.id, b.id]);
  assert(a.childIds.includes(child.id)); assert(b.childIds.includes(child.id));
  assert.equal(child.initialAge, 0); assert.equal(child.balance, 0);
  assert.equal(child.jobId, null); assert.equal(child.expectingId, null);
  assert.equal(a.expectingId, null); assert.equal(b.expectingId, null);
  assert(child.homeUnitId); assert.equal(child.homeUnitId, a.homeUnitId);
  assert.equal(child.homeId, city.housing.home(city.society.guardian(child)).id);
  assert.equal(city.units.get(child.homeUnitId).tenantId, a.accountId);
  assert.equal(totalMoney(city), money);
  assert.equal(city.society.giveBirth(pregnancy), null);
  assert.equal(city.society.planChild(a, b), null);
  city.assignHousingAndJobs(); assert.equal(child.jobId, null);
  assert(city.events.some(e => e.data.kind === 'birth' && e.data.childId === child.id));
});

test('guardians provide care at home and children receive public health services', () => {
  const city = setup(), [a, b] = pair(city), r = bond(city, a, b);
  city.minute = r.partnerSince + 2 * 1440;
  const pregnancy = city.society.planChild(a, b); city.minute = pregnancy.dueAt;
  const child = city.society.giveBirth(pregnancy), home = city.building(city.units.get(child.homeUnitId).buildingId);
  a.entity.x = child.entity.x = home.door.x; a.entity.y = child.entity.y = home.door.y;
  child.path = a.path = []; a.task = 'caregiving'; a.careChildId = child.id; a.targetId = home.id;
  child.needs.food = 20;a.provisions=1;
  const cash = a.balance, money = totalMoney(city);
  city.performTask(a);for(let i=0;i<1000&&a.indoorLocation?.path?.length;i++)advanceCitizenInterior(city,a,1);child.entity.x=a.entity.x;child.entity.y=a.entity.y;city.performTask(a);
  assert.equal(a.balance, cash); assert.equal(child.balance, 0); assert(child.needs.food > 20);
  assert(city.events.some(e => e.data.kind === 'childcare'));
  child.initialAge = 8; child.needs.health=20;const clinic = city.buildings.find(b => b.type === 'clinic'); child.task = 'health'; child.targetId = clinic.id; child.servicePaid = null;
  const clinician=city.citizens.find(c=>city.society.isAdult(c)&&c!==a&&c!==b&&!c.jobId&&!city.politics.officeHolder(c));assert(clinician);clinician.jobId=clinic.id;clinic.workers.push(clinician.id);clinic.inventory.remedio=10;clinic.inventory.sabao=10;putAtWorkCell(city,clinician,clinic);
  const payer=city.accounts.get(city.payerFor(child)),parentCash = payer.balance; city.performTask(child);if(child.path.length)finishActivityRoute(city,child);city.performTask(child);for(let i=0;i<1000&&child.indoorLocation?.path?.length;i++)advanceCitizenInterior(city,child,1);city.performTask(child);assert.equal(payer.balance,parentCash);assert(child.needs.health>20);
  assert.equal(totalMoney(city), money);
});

test('adulthood ends financial dependency and makes a citizen eligible for employment', () => {
  const city = setup(), [parent] = pair(city);
  const child = city.addCitizen(64.5, 64.5, 26, { age: 0, parentIds: [parent.id], grant: false });
  city.society.houseChild(child);
  city.minute = child.bornAt + 18 * SOCIAL_RULES.daysPerYear * 1440;
  child.skills.commerce = 100; city.buildings.find(b => b.type === 'market').jobs++;
  city.society.daily(); city.assignHousingAndJobs();
  assert.equal(child.guardianId, null); assert.equal(child.jobId,null);assert(city.society.isAdult(child));assert(qualification(city,child,city.buildings.find(b=>b.type==='market')).eligible);
  assert.equal(city.units.get(child.homeUnitId).rentPayerId, null);
});

test('general history has categories, people, search, stable pagination and bounded memory', () => {
  const city = setup(), c = city.citizens[0];
  const first = city.log('Ana fez amizade no mercado', 'relationship', [c.id]);
  const second = city.log('Ana conversou com alguém', 'social', [c.id]);
  city.log('Outro acontecimento', 'city');
  assert.deepEqual(city.getEvents({ category: 'social', citizenId: c.id, query: 'CONVERSOU' }).map(e => e.id), [second.id]);
  assert.deepEqual(city.getEvents({ beforeId: second.id, query: 'amizade' }).map(e => e.id), [first.id]);
  assert.equal(city.getEvents({ citizenId: -1 }).length, 0);
  for (let i = 0; i < 5100; i++) city.log(`Registro ${i}`, 'city');
  assert(city.events.length<=192);assert(city.getEvents({limit:5000}).length>=5000);
  assert(city.events[0].id < city.events.at(-1).id);
  assert.doesNotThrow(() => JSON.stringify(city.events));
});

test('departures clear partners and conversations and assign the surviving parent as guardian', () => {
  const city = setup(), [a, b] = pair(city), r = bond(city, a, b);
  city.minute = r.partnerSince + 2 * 1440;
  const pregnancy = city.society.planChild(a, b); city.minute = pregnancy.dueAt;
  const child = city.society.giveBirth(pregnancy);
  a.entity.destroyed = true; city.reconcile();
  assert.equal(b.partnerId, null); assert.equal(child.guardianId, b.id);
  assert.equal(child.homeUnitId, b.homeUnitId);
  assert(child.parentIds.includes(a.id));
  assert.equal(totalMoney(city), city.currency.netIssued());
});

test('urgent needs finish paid essential services without repeatedly charging or resetting them', () => {
  const city = setup(), c = city.citizens[0], water = city.buildings.find(b => b.type === 'utility');
  for(const building of city.buildings)if(['townhall','popular_refectory'].includes(building.type))building.active=false;
  c.entity.x = water.door.x; c.entity.y = water.door.y;
  c.path = []; c.task = 'water'; c.targetId = water.id; c.servicePaid = null;
  c.needs.water = 30; c.needs.energy = 90; c.needs.food = c.needs.health = c.needs.toilet = 90;
  c.pocket.water=0;c.pocket.food=[{inputs:{},quality:1},{inputs:{},quality:1},{inputs:{},quality:1},{inputs:{},quality:1}];
  assert(city.supplies.route(c));assert.equal(c.task,'supplies');city.supplies.arrive(c);
  assert.equal(city.ledger.filter(row=>row.from===c.accountId&&row.to===water.accountId&&row.reason==='Enchimento de garrafas de água').reduce((n,row)=>n+row.amount,0),city.currency.price(35)*6);
  assert(c.needs.water > 60);
  c.task = null; c.needs.water = 80;c.needs.energy=0;c.pocket.water=6; city.chooseTask(c);
  assert.equal(c.task, 'energy');
});

test('a fifteen-day city develops families with coherent private contracts, needs and conserved currency', () => {
  const city = setup(),[a,b]=pair(city),r=bond(city,a,b);
  city.minute=r.partnerSince+2*1440;assert(city.society.planChild(a,b));
  let childcare=false;
  for (let i = 0; i < 15 * 1440 * 4; i++) {city.update(1 / 16);if(i%240===0)childcare ||= city.events.some(e=>e.data.kind==='childcare');}
  const children = city.citizens.filter(c => c.parentIds.length);
  assert(children.length > 0);
  assert(city.stats().couples > 0);
  assert.equal(city.stats().births, children.length + [...city.accounts.values()].filter(c => c.dead && c.parentIds?.length).length);
  assert.equal(totalMoney(city), city.currency.netIssued());
  for (const child of children) {
    if (child.homeUnitId) assert.equal(child.homeId, city.housing.home(city.society.guardian(child)).id);
    assert.equal(child.jobId, null);
    assert(child.needs.health >= 0 && child.needs.health <= 100);
    assert(city.society.guardian(child));
  }
  assert(childcare);
  for (const r of city.society.relations.values()) if (r.status === 'partner') {
    const a = city.society.citizen(r.a), b = city.society.citizen(r.b);
    assert.equal(a.partnerId, b.id); assert.equal(b.partnerId, a.id);
    assert(city.society.isAdult(a) && city.society.isAdult(b));
    assert.equal(city.society.related(a, b), false);
  }
});
