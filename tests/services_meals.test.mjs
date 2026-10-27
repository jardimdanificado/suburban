import {advanceCitizenInterior} from '../js/city_interiors.js';
import {finishActivityRoute} from './helpers/city.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, totalMoney, finishShipment } from './helpers/city.mjs';
import { DEVELOPMENT_RULES } from '../js/city_development.js';
import { GOODS } from '../js/city_economy.js';
import { WORK_MEAL_RULES } from '../js/city_work_meals.js';
import { flatSiteLevel, surfaceBounds, tileHeight, ROAD_TILES } from '../js/city_terrain.js';
import { inventoryUsed, incomingItems } from '../js/city_inventory.js';
import { World } from '../js/world.js';
import { CitySimulation } from '../js/city_simulation.js';

const live = city => city.development.projects.filter(p => !p.cancelled && p.status !== 'completed');
const builderOf = city => city.economy.businesses.find(b => b.type === 'builder');
function prepare(city, project) {
  const quarry = city.economy.businesses.find(b => b.type === 'quarry');
  quarry.inventory.pedra += project.stone; quarry.stoneReserve -= project.stone; city.economy.produced.pedra += project.stone;
  while (project.inventory.pedra < project.stone) {
    const s = city.logistics.order(quarry, project, 'pedra', Math.min(24, project.stone - project.inventory.pedra), GOODS.pedra.price); assert(s); finishShipment(city, s);
  }
}
function finish(city, project) {
  const builder = city.building(project.builderId), worker = city.society.citizen(builder.workers[0]);
  for (let i = 0; i < 10000 && project.status !== 'completed'; i++) {
    if(worker.path.length){const last=worker.path.at(-1);worker.entity.x=last.x;worker.entity.y=last.y;worker.path=[];}if(worker.indoorLocation)advanceCitizenInterior(city,worker,100);assert(city.development.work(project,worker));
  }
  assert.equal(project.status, 'completed');
}
function audit(city) {
  assert.equal(totalMoney(city), city.currency.netIssued());
  const holders = [...city.buildings, ...city.development.projects, ...city.logistics.shipments];
  for (const h of holders) { assert(inventoryUsed(h) + incomingItems(h) <= h.inventoryCapacity); for (const qty of Object.values(h.inventory)) assert(Number.isSafeInteger(qty) && qty >= 0); }
  for (const good of Object.keys(GOODS)) assert.equal(city.economy.initialStock[good] + city.economy.produced[good], city.economy.consumed[good] + city.economy.lost[good] + city.goodsStock(good), good);
}

test('ordinary plots have varied dimensions and level surfaces; extraction plots contain rock', () => {
  for (const [preset, seed] of [[0, 42], [1, 1337], [2, 23811]]) {
    const world = new World(preset, seed); let id = 0;
    const city = new CitySimulation({ world, createEntity: data => ({ id: ++id, destroyed: false, ...data }) }); city.initialize();
    const plots = city.development.plots.filter(p => !p.buildingId);
    assert(plots.length >= 8); assert(new Set(plots.map(p => `${p.width}x${p.depth}`)).size >= 3);
    for (const p of plots) { if (p.type === 'quarry') { assert(Array.from({length:p.width*p.depth}, (_, i) => world.getTile(p.x + i % p.width, p.y + Math.floor(i / p.width))).includes(4)); continue; }if(p.type==='farm'){assert(city.development.isFarmPlot(p));continue;} assert.notEqual(flatSiteLevel(world, p.x, p.y, p.width, p.depth), null); assert(surfaceBounds(world, p.x, p.y, p.width, p.depth).variation < .001); }
  }
});

test('mixed elevation and ramps are rejected for plots without altering any tile', () => {
  const city = setup({ starter: true, funded: true }); city.world.setTile(12, 12, 9);
  const before = Array.from({ length: 36 }, (_, i) => city.world.getTile(9 + i % 6, 9 + Math.floor(i / 6)));
  assert.equal(city.development.createPlot(10, 10, 4, 4), null);
  assert.deepEqual(Array.from({ length: 36 }, (_, i) => city.world.getTile(9 + i % 6, 9 + Math.floor(i / 6))), before);
});

test('an entrepreneur contracts exact dimensions and floors from a chosen construction company', () => {
  const city = setup({ starter: true, funded: true }), builder = builderOf(city), client = city.citizens.find(c => c.fixtureInvestor && c.id !== builder.ownerId), plot = city.development.plots.find(p => !p.buildingId && p.width >= 3 && p.depth >= 3);
  assert.equal(city.development.serviceOffers(builder.id).length, 3); city.development.buyPlot(client.accountId, plot.id);
  const p = city.development.beginProject(client.accountId, plot.id, 'market', { width: 3, depth: 2, floors: 2, builderId: builder.id }); assert(p);
  assert.equal(p.stone, 24); assert.equal(p.fee, 12 * DEVELOPMENT_RULES.constructionFeePerCell); assert.equal(p.builderId, builder.id); assert.equal(city.accounts.get(p.feeAccountId).balance, p.fee);
  assert.equal(city.development.beginProject(client.accountId, plot.id, 'bakery'), null);
  prepare(city, p); const revenue = builder.totalRevenue; finish(city, p);
  const b = city.building(plot.buildingId); assert.deepEqual([b.width, b.depth, b.floors], [3, 2, 2]); assert.equal(b.units.length, 12); assert.equal(builder.totalRevenue - revenue, p.fee); audit(city);
});

test('municipal roads need a paid construction contract, delivered stone and work, and preserve all terrain heights', () => {
  const city = setup({ starter: true, funded: true }), builder = builderOf(city);
  const p = city.development.beginRoad('treasury', { x: 5.5, y: 5.5 }, { x: 12.5, y: 5.5 }, { builderId: builder.id }); assert(p);
  const before = p.route.map(t => city.world.getTile(Math.floor(t.x), Math.floor(t.y)));
  assert.equal(city.development.complete(p), null); assert(p.path.every(t => !ROAD_TILES.has(city.world.getTile(Math.floor(t.x), Math.floor(t.y)))));
  prepare(city, p); const revenue = builder.totalRevenue; finish(city, p);
  assert.equal(builder.totalRevenue - revenue, p.fee);
  p.route.forEach((t, i) => { const tile = city.world.getTile(Math.floor(t.x), Math.floor(t.y)); assert(ROAD_TILES.has(tile)); assert.equal(tileHeight(tile), tileHeight(before[i])); });
  assert.equal(city.accounts.get(p.feeAccountId).balance, 0); audit(city);
});

test('hall expansion retains existing cells and accounts, adds floors and releases the service payment exactly once', () => {
  const city = setup({ starter: true, funded: true }), hall = city.buildings[0], oldUnits = [...hall.units], oldCapacity = hall.inventoryCapacity, builder = builderOf(city);
  assert.equal(city.development.beginExpansion(city.citizens[0].accountId, hall.id), null);
  const p = city.development.beginExpansion('treasury', hall.id, { floors: 2 }); assert(p); assert.equal(city.development.beginExpansion('treasury', hall.id), null);
  prepare(city, p); const revenue = builder.totalRevenue; finish(city, p);
  assert.equal(hall.floors, 4); assert.equal(hall.units.length, oldUnits.length * 2); assert(hall.inventoryCapacity > oldCapacity);
  for (const u of oldUnits) assert.equal(city.units.get(u.id), u);
  for (const u of hall.units) { assert.equal(u.ownerId, 'treasury'); assert(u.forSale); assert(!u.forRent); }
  assert.equal(builder.totalRevenue - revenue, p.fee); assert.equal(city.development.complete(p), null); assert.equal(builder.totalRevenue - revenue, p.fee); audit(city);
});

test('public service contracts survive a change of mayor', () => {
  const city = setup({ starter: true, funded: true }), hall = city.buildings[0], p = city.development.beginExpansion('treasury', hall.id); assert(p);
  city.society.citizen(city.economy.mayorId).entity.destroyed = true; city.reconcile(); city.development.reconcile();
  assert(!p.cancelled); assert.equal(p.ownerId, city.economy.mayorId); audit(city);
});

test('onsite meals consume real food, preserve the work position and resume work without charging the employee', () => {
  const city = setup(), b = city.economy.businesses.find(b => b.type === 'quarry'), c = city.society.citizen(b.workers[0]);
  b.inventory.pao = 6; city.economy.produced.pao += 6; c.needs.food = 30; c.needs.water = c.needs.energy = c.needs.toilet = c.needs.health = 90;
  c.entity.x = b.door.x; c.entity.y = b.door.y; c.task = 'work'; c.path = []; const balance = c.balance, consumed = city.economy.consumed.pao;
  assert(city.workMeals.tryStart(c));finishActivityRoute(city,c);city.workMeals.tryStart(c); assert.equal(b.inventory.pao, 3);
  for (let i = 0; i < WORK_MEAL_RULES.duration; i++) city.workMeals.advance(c);
  assert(c.needs.food >= 95); assert.equal(c.balance, balance); assert.equal(c.indoorLocation.position.x, b.entity.x+b.units.find(u=>u.roomType==='dining').x+.5); assert.equal(c.task, 'work'); assert.equal(c.workMeal, null); assert.equal(b.mealsServed, 1); assert.equal(city.economy.consumed.pao, consumed + 3); audit(city);
});

test('employees choose the stocked company refectory before an external establishment or a voucher', () => {
  const city = setup(), b = city.economy.businesses.find(b => b.type === 'quarry'), c = city.society.citizen(b.workers[0]);
  b.inventory.pao = 6; c.needs.food = 15; c.needs.water = c.needs.energy = c.needs.toilet = c.needs.health = 90; c.task = null; c.provisions = 0;
  city.chooseTask(c); assert.equal(c.task, 'workmeal'); assert.equal(c.targetId, b.id); assert.equal(c.foodVoucher, null);
  for (let i = 0; i < 800 && b.mealsServed === 0; i++) city.update(1 / 16);
  assert(b.mealsServed > 0); assert.equal(c.mealAllowanceToday, 0);
});

test('a meal voucher is generous, comes from the employer and cannot be repeatedly claimed for the same hunger episode', () => {
  const city = setup(), b = city.economy.businesses.find(b => b.type === 'quarry'), c = city.society.citizen(b.workers[0]), shop = city.economy.businesses.find(b => b.type === 'market');
  shop.inventory.maca = 9; c.needs.food = 30; const offer = city.economy.mealOffer(shop), workerCash = c.balance, businessCash = b.balance, expense = b.totalExpenses;
  assert(city.workMeals.issueVoucher(c, shop)); const amount = c.foodVoucher.amount;
  assert(amount >= 3000 && amount >= offer.price * 6); assert.equal(c.balance, workerCash + amount); assert.equal(b.balance, businessCash - amount); assert.equal(b.totalExpenses - expense, amount);
  assert.equal(city.workMeals.issueVoucher(c, shop), false); assert.equal(b.vouchersIssued, 1); assert.equal(c.mealAllowanceToday, amount); assert.equal(totalMoney(city), city.currency.netIssued());
});

test('food for a construction site is bought by its employer, shipped physically and eaten at that site', () => {
  const city = setup(), b = builderOf(city), p = city.development.beginExpansion('treasury', city.buildings[0].id); assert(p);
  city.workMeals.purchase(); const s = city.logistics.shipments.find(s => s.buyer === p && s.purpose === 'work-meals'); assert(s); assert.equal(s.payerAccountId, b.accountId); assert.equal(p.inventory[s.good], 0);
  finishShipment(city, s); const worker = city.society.citizen(b.workers[0]); worker.task = 'construction'; worker.workProjectId = p.id; worker.entity.x = p.door.x; worker.entity.y = p.door.y; worker.needs.food = 30; worker.needs.water = worker.needs.energy = worker.needs.health = worker.needs.toilet = 90;
  const stock = p.inventory[s.good]; assert(city.workMeals.tryStart(worker)); assert.equal(p.inventory[s.good], stock - 3); assert.equal(worker.workMeal.siteId, p.id); assert(b.mealPurchaseCost >= s.cost); audit(city);
});

test('completing a site cancels incoming catering and refunds the employer instead of the public client', () => {
  const city = setup(), b = builderOf(city), p = city.development.beginExpansion('treasury', city.buildings[0].id); assert(p);
  city.workMeals.purchase(); const s = city.logistics.shipments.find(s => s.buyer === p && s.purpose === 'work-meals'); assert(s);
  const cash = b.balance; city.workMeals.closeSite(p, city.buildings[0]);
  assert.equal(s.status, 'cancelled'); assert.equal(b.balance, cash + s.cost + s.fee); assert.equal(p.incoming[s.good], 0); audit(city);
});

test('autonomous public works and employee meals keep all currency and goods conserved over multiple days', () => {
  const city = setup({ starter: true, funded: true,population:128 });
  for (let i = 0; i < 10 * 1440 * 4; i++) { city.update(1 / 16); if (i % 480 === 0) audit(city); }
  assert(city.development.projects.some(p => p.service === 'road' && p.status === 'completed'));
  assert(city.development.projects.some(p => p.type === 'popular_housing' && p.status === 'completed')); // Basic housing precedes luxury hall expansion.
  assert(city.buildings.some(b => b.mealsServed > 0)); assert(city.buildings.some(b => b.mealPurchaseCost > 0)); assert(city.logistics.shipments.some(s => s.purpose === 'work-meals'));
  assert(live(city).every(p => p.inventory.pedra + (p.incoming.pedra || 0) <= p.stone)); audit(city);
});
