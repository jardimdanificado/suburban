import {finishActivityRoute} from './helpers/city.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, totalMoney, finishShipment } from './helpers/city.mjs';
import { HOUSING_RULES, floorCells } from '../js/city_housing.js';
import { LIFE_RULES } from '../js/city_life.js';
import { SANITATION_RULES } from '../js/city_sanitation.js';
import { GOODS } from '../js/city_economy.js';

function build(city, type, options = {}) {
  for (const site of city.economy.locateBuilding(type)) {
    const b = city.addBuilding(type, site.x, site.y, { ...site, floors: 1, free: true, ...options });
    if (b) return b;
  }
  throw Error(`No site for ${type}`);
}
function business(city, type) {
  const b = build(city, type), owner = city.citizens.find(c => c.fixtureInvestor);
  for(const u of b.units)u.price=1000; assert(city.economy.purchasePremises(b, owner)); return b;
}
const freshNeeds = c => { for (const k of Object.keys(c.needs)) c.needs[k] = 90; };
function lease(city) {
  const b = build(city, 'residential', { width: 3, depth: 3 }), [owner, tenant] = [city.citizens[0], city.citizens[3]];
  const home = city.housing.homes.get(b.units[0].homeId);
  for (const u of city.housing.units(home)) { u.ownerId = owner.accountId; u.forRent = true; }
  assert(city.housing.rentHome(tenant, home)); return { b, owner, tenant, home };
}

test('child names inherit a surname and remain unique without numeric IDs', () => {
  const city = setup({ starter: true, funded: true }), parent = city.citizens[0], names = new Set();
  for (let i = 0; i < 150; i++) {
    const c = city.addCitizen(60, 60, 24, { age: 0, parentIds: [parent.id], grant: false }), name = c.entity.properties.name;
    assert(!/\d/.test(name)); assert(name.endsWith(parent.entity.properties.name.split(' ').at(-1))); assert(!names.has(name)); names.add(name);
  }
});

test('facade units exclude the core and adjacent home rooms never exceed two tiles in both dimensions', () => {
  for (let width = 1; width <= 7; width++) for (let depth = 1; depth <= 7; depth++) {
    const cells = floorCells({ width, depth }, 0); assert.equal(new Set(cells.map(c => `${c.x}:${c.y}`)).size, cells.length);
    for (const p of cells) assert(p.x === 0 || p.y === 0 || p.x === width - 1 || p.y === depth - 1);
    for (let i = 0; i + 1 < cells.length; i += 2) assert.equal(Math.abs(cells[i].x - cells[i+1].x) + Math.abs(cells[i].y - cells[i+1].y), 1);
  }
  const city = setup({ starter: true, funded: true }), b = build(city, 'residential', { width: 3, depth: 3, floors: 2 });
  assert.equal(b.units.length, 16); assert.equal(b.circulation.length, 2);
  assert(b.units.every(u => u.price === HOUSING_RULES.roomPrice && u.rent === HOUSING_RULES.roomRent));
  assert(HOUSING_RULES.roomPrice / HOUSING_RULES.roomRent > 300);
});

test('whole-home rent charges both rooms, families share them and eviction releases everyone', () => {
  const city = setup({ starter: true, funded: true }), before = totalMoney(city), { owner, tenant, home } = lease(city), partner = city.citizens[4];
  const child = city.addCitizen(60, 60, 25, { age: 0, parentIds: [tenant.id], grant: false });
  tenant.partnerId = partner.id; partner.partnerId = tenant.id; city.housing.assign();
  assert.equal(partner.homeId, home.id); assert.equal(child.homeId, home.id);
  const income = owner.balance; city.housing.collectRent(); assert.equal(owner.balance - income, HOUSING_RULES.roomRent * 2);
  city.transfer(tenant.accountId, 'treasury', tenant.balance, 'Test unemployment');
  for (let i = 0; i < HOUSING_RULES.defaultDays; i++) city.housing.collectRent();
  for (const c of [tenant, partner, child]) assert.equal(c.homeUnitId, null);
  assert(city.events.some(e => e.data.kind === 'eviction')); assert.equal(totalMoney(city), before);
});

test('municipal homes cannot be rented and affordable complete homes are preferred', () => {
  const city = setup({ starter: true, funded: true }), b = build(city, 'residential', { width: 3, depth: 3 }), tenant = city.citizens[3];
  const home = city.housing.homes.get(b.units[0].homeId); assert.equal(city.housing.rentHome(tenant, home), false);
  const owner = city.citizens[0]; for (const u of b.units) { u.ownerId = owner.accountId; u.forRent = true; }
  city.housing.assign(); assert(city.housing.hasBathroom(city.housing.home(tenant)));
});

test('critical health does not trap a hungry worker in an endless refused meal', () => {
  const city = setup({ starter: true, funded: true }), employer = city.economy.businesses.find(b => b.workers.length), c = city.society.citizen(employer.workers[0]);
  city.minute = 9 * 60; freshNeeds(c); c.needs.food = 0; c.needs.health = 1; c.needs.water = 1; c.needs.toilet = 1;
  c.entity.x = employer.door.x; c.entity.y = employer.door.y; c.conversation = null; c.task = 'workmeal'; employer.inventory.pao += 3;
  assert.equal(city.workMeals.tryStart(c),false);assert.equal(c.workMeal,null);
  for(let i=0;i<10&&c.task!=='health';i++)city.stepMinute();assert.equal(c.task,'health');assert.equal(c.workMeal,null);
});

test('stalled routines recover and invalid needs are repaired instead of propagating NaN', () => {
  const city = setup({ starter: true, funded: true }), c = city.citizens[3]; freshNeeds(c); c.task = 'food'; c.path = [];
  city.life.minute(c); city.minute += LIFE_RULES.stalledMinutes + 1; city.life.minute(c); assert.equal(c.task, null);
  c.needs.water = NaN; city.life.minute(c); assert(Number.isFinite(c.needs.water)); assert(city.life.stallRecoveries >= 2);
});

test('deprivation emits a single death event and inheritance preserves currency and assets', () => {
  const city = setup({ starter: true, funded: true }), [c, heir] = city.citizens, cash = totalMoney(city), business = city.economy.businesses.find(b => b.ownerId === c.id);
  c.partnerId = heir.id; heir.partnerId = c.id; freshNeeds(c); c.needs.water = 0; c.deprivation = { food: 0, water: LIFE_RULES.dehydrationMinutes - 1, health: 0 };
  assert(city.life.minute(c)); assert.equal(city.life.die(c, 'duplicada'), false); assert.equal(city.life.deathCount, 1);
  city.reconcile(); assert(!city.citizens.includes(c)); assert.equal(c.balance, 0); assert.equal(totalMoney(city), cash);
  if (business) assert.equal(business.ownerId, heir.id);
  assert.equal(city.events.filter(e => e.data.kind === 'death').length, 1);
});

test('bathroom access distinguishes public, paid, employees, residents and close friends', () => {
  const city = setup({ starter: true, funded: true }), { tenant, home } = lease(city), outsider = city.citizens[5];
  const f = [...city.sanitation.facilities.values()].find(f => f.homeId === home.id);
  assert(city.sanitation.allowed(tenant, f)); assert(!city.sanitation.allowed(outsider, f));
  const relation=city.society.getRelation(tenant,outsider,true);Object.assign(relation.views[tenant.id],{affection:80,trust:80,status:'close'});city.relationships.sync(relation);assert(city.sanitation.allowed(outsider,f));
  const company = city.economy.businesses.find(b => b.workers.length), privateToilet = [...city.sanitation.facilities.values()].find(f => f.buildingId === company.id);
  outsider.jobId = null; assert(!city.sanitation.allowed(outsider, privateToilet)); outsider.jobId = company.id; assert(city.sanitation.allowed(outsider, privateToilet));
  const paid = build(city, 'paid_toilet'), fee = [...city.sanitation.facilities.values()].find(f => f.buildingId === paid.id);
  city.transfer(outsider.accountId, 'treasury', outsider.balance, 'Test poverty'); assert(!city.sanitation.allowed(outsider, fee));
  const free = [...city.sanitation.facilities.values()].find(f => f.access === 'public'); free.cleanliness = 0; assert(city.sanitation.allowed(outsider, free));
});

test('each toilet visit produces waste once, charges once and applies cleanliness happiness', () => {
  const city = setup({ starter: true, funded: true }), c = city.citizens[3], b = build(city, 'paid_toilet'), f = [...city.sanitation.facilities.values()].find(f => f.buildingId === b.id);
  const cash = c.balance, stock = city.goodsStock('lixo'); c.toiletTargetId = f.id; c.needs.toilet = 0; c.servicePaid = null; c.mood = 0;
  c.task='toilet';c.targetId=b.id;c.entity.x=b.door.x;c.entity.y=b.door.y;city.sanitation.use(c);finishActivityRoute(city,c);assert(city.sanitation.use(c)); city.sanitation.use(c); assert.equal(c.balance, cash - f.price); assert.equal(city.goodsStock('lixo'), stock + 1); assert.equal(c.mood, 6); assert.equal(f.uses, 1);
  c.needs.toilet = 95; city.sanitation.use(c); c.toiletTargetId = f.id; c.needs.toilet = 0; f.cleanliness = 0; c.mood = 0; city.sanitation.use(c); assert(c.mood < 0);
});

test('cleaning contracts obey weekly public and frequent paid intervals and require physical work', () => {
  const city = setup({ starter: true, funded: true }), cleaner = business(city, 'cleaner'), paid = build(city, 'paid_toilet');
  const free = [...city.sanitation.facilities.values()].find(f => f.access === 'public'), f = [...city.sanitation.facilities.values()].find(f => f.buildingId === paid.id);
  free.cleanliness=40;f.cleanliness=10;
  city.transfer('treasury', paid.accountId, 1000, 'Test cleaning budget'); city.minute = f.lastCleanedAt + SANITATION_RULES.paidCleaningInterval; assert.equal(city.sanitation.requestCleaning(free.id), null);
  const job = city.sanitation.requestCleaning(f.id, paid.accountId, cleaner.id); assert(job); assert.equal(f.cleanliness, 10);
  const worker = city.society.citizen(cleaner.ownerId); freshNeeds(worker); worker.conversation = null; worker.workMeal = null; worker.deliveryId = null;
  worker.cleaningJobId = job.id; worker.entity.x = paid.door.x; worker.entity.y = paid.door.y; worker.path = []; job.workerId = worker.id; job.status = 'working';
  const before = cleaner.balance, expenses=cleaner.totalExpenses; for (let i = 0; i < 25; i++) { city.minute++;city.sanitation.updateMinute();finishActivityRoute(city,worker);city.sanitation.updateMinute(); }
  assert.equal(job.status, 'completed'); assert.equal(f.cleanliness, 100); assert.equal(cleaner.balance - before+(cleaner.totalExpenses-expenses), job.fee);
  f.cleanliness = 40; assert.equal(city.sanitation.requestCleaning(f.id), null);
  city.minute = free.lastCleanedAt + SANITATION_RULES.freeCleaningInterval; assert(city.sanitation.requestCleaning(free.id, 'treasury', cleaner.id));
  assert.equal(totalMoney(city), city.currency.netIssued());
});

test('private home cleaning is paid by its resident through a cleaning company', () => {
  const city = setup({ starter: true, funded: true }), { tenant, home } = lease(city), cleaner = business(city, 'cleaner');
  const f = [...city.sanitation.facilities.values()].find(f => f.homeId === home.id); f.cleanliness = 0; city.minute = f.lastCleanedAt + SANITATION_RULES.privateCleaningInterval;
  const before = tenant.balance; const job = city.sanitation.requestCleaning(f.id, tenant.accountId, cleaner.id); assert(job); assert.equal(before - tenant.balance, SANITATION_RULES.cleaningPrice);
});

test('garbage collection carries physical stock and pays a service, recycling consumes waste into stone', () => {
  const city = setup({ starter: true, funded: true }), collector = business(city, 'waste_collector'), recycler = business(city, 'recycler'), hall = city.buildings.find(b => b.type === 'townhall');
  city.sanitation.addWaste(hall, 24); city.sanitation.hourly();
  const collection = city.logistics.shipments.find(s => s.purpose === 'waste-collection'); assert(collection); assert.equal(hall.inventory.lixo, 0); assert.equal(collector.inventory.lixo, 0);
  const before = collector.balance,expenses=collector.totalExpenses; finishShipment(city, collection); assert.equal(collector.inventory.lixo, 24); assert.equal(collector.balance - before+(collector.totalExpenses-expenses), collection.serviceFee+collection.fee);
  city.sanitation.hourly(); const transfer = city.logistics.shipments.find(s => s.buyer === recycler && s.good === 'lixo'); assert(transfer); finishShipment(city, transfer);
  const c = city.society.citizen(recycler.ownerId), stone = recycler.inventory.pedra; for (let i = 0; i < 8; i++) city.sanitation.recycle(recycler, c);
  assert(recycler.inventory.pedra > stone); assert(city.economy.consumed.lixo > 0); assert.equal(totalMoney(city), city.currency.netIssued());
  for (const good of ['lixo','pedra']) assert.equal(city.economy.initialStock[good] + city.economy.produced[good], city.economy.consumed[good] + city.economy.lost[good] + city.goodsStock(good));
});

test('overflowing bathroom waste remains accounted for outside a full inventory', () => {
  const city = setup({ starter: true, funded: true }), b = city.buildings[0], before = city.goodsStock('lixo'); b.inventoryCapacity = Object.values(b.inventory).reduce((a,b) => a+b,0);
  city.sanitation.addWaste(b, 5); assert.equal(b.litter, 5); assert.equal(city.goodsStock('lixo'), before + 5);
});

test('twenty days sustain routines, food supply, sanitation and exact money/material accounting', () => {
  const city = setup({ starter: true,population:128 }); for (let i = 0; i < 20 * 1440 * 4; i++) city.update(1 / 16);
  assert(city.citizens.length >= 20); assert(city.economy.produced.pao > 0); assert(city.sanitation.cleaned > 0); assert(city.economy.consumed.lixo > 0);
  for (const c of city.citizens) for (const value of Object.values(c.needs)) assert(Number.isFinite(value) && value >= 0 && value <= 100);
  assert.equal(totalMoney(city), city.currency.netIssued());
  for (const good of Object.keys(GOODS)) assert.equal(city.economy.initialStock[good] + city.economy.produced[good], city.economy.consumed[good] + city.economy.lost[good] + city.goodsStock(good), good);
});
