import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, totalMoney, finishShipment } from './helpers/city.mjs';
import { GOODS, ECONOMY_RULES } from '../js/city_economy.js';
import { inventoryUsed, inventoryFree, incomingItems } from '../js/city_inventory.js';

const freePlot = city => city.development.plots.find(p => p.ownerId === 'treasury' && !p.buildingId && !p.projectId);
const investor = city => city.citizens.filter(c => c.wealthTier === 'wealthy').sort((a, b) => b.balance - a.balance)[0];
function seedStone(city, quarry, qty = 24) {
  quarry.inventory.pedra += qty; quarry.stoneReserve -= qty; city.economy.produced.pedra += qty;
}
function audit(city) {
  assert.equal(totalMoney(city), 2000000);
  for (const holder of [...city.buildings, ...city.development.projects, ...city.logistics.shipments]) {
    for (const value of Object.values(holder.inventory)) assert(Number.isSafeInteger(value) && value >= 0);
    assert(inventoryUsed(holder) + incomingItems(holder) <= holder.inventoryCapacity, holder.name || holder.type || holder.id);
  }
  for (const good of Object.keys(GOODS)) {
    const holders = [...city.buildings, ...city.development.projects, ...city.logistics.shipments];
    const stock = city.goodsStock(good);
    assert.equal(city.economy.initialStock[good] + city.economy.produced[good], city.economy.consumed[good] + city.economy.lost[good] + stock, good);
  }
}

test('a new city starts with exactly the hall, builder and quarry, finite public food and municipal land for sale', () => {
  const city = setup({ starter: true });
  assert.deepEqual(city.buildings.map(b => b.type), ['townhall', 'builder', 'quarry']);
  assert.equal(city.citizens.length, 24); assert.equal(city.stats().wealthy, 3);
  const hall = city.buildings[0]; assert(hall.inventory.pao >= 24 * 3 * 20);
  assert.equal(hall.inventory.pao, city.economy.initialStock.pao);
  const c = city.citizens[10], balance = c.balance, stock = hall.inventory.pao;
  assert(city.economy.consumeMeal(c, hall)); assert.equal(c.balance, balance); assert.equal(hall.inventory.pao, stock - 3);
  assert(city.development.plots.filter(p => !p.buildingId).length >= 10);
  for (const p of city.development.plots.filter(p => !p.buildingId)) { assert.equal(p.ownerId, 'treasury'); assert(p.forSale); assert(!p.forRent); }
  assert(city.buildings.find(b => b.type === 'quarry').workers.length > 0);
  audit(city);
});

test('land purchases, resales and municipal listing policy transfer money without changing the natural terrain', () => {
  const city = setup({ starter: true }), p = freePlot(city), a = investor(city), b = city.citizens.find(c => c.wealthTier === 'wealthy' && c.id !== a.id);
  const before = [], cash = a.balance, treasury = city.treasury;
  for (let y = p.y; y < p.y + p.depth; y++) for (let x = p.x; x < p.x + p.width; x++) before.push(city.world.getTile(x, y));
  assert(city.development.listPlot('treasury', p.id, { price: p.price, forSale: false, forRent: true })); assert(p.forSale); assert(!p.forRent);
  assert(city.development.buyPlot(a.accountId, p.id)); assert.equal(a.balance, cash - p.price); assert.equal(city.treasury, treasury + p.price);
  assert.equal(city.development.buyPlot(b.accountId, p.id), null);
  assert(city.development.listPlot(a.accountId, p.id, { price: 5000, rent: 100, forSale: true, forRent: true }));
  assert(city.development.buyPlot(b.accountId, p.id)); assert.equal(p.ownerId, b.accountId);
  assert.equal(city.development.listPlot(a.accountId, p.id, { price: 1 }), false);
  const after = []; for (let y = p.y; y < p.y + p.depth; y++) for (let x = p.x; x < p.x + p.width; x++) after.push(city.world.getTile(x, y));
  assert.deepEqual(after, before); audit(city);
});

test('an open-air farm requires only purchased land, and creates no walls or stone consumption', () => {
  const city = setup({ starter: true }), a = investor(city), p = freePlot(city);
  assert(city.development.buyPlot(a.accountId, p.id));
  const beforeStone = city.economy.consumed.pedra;
  const project = city.development.beginProject(a.accountId, p.id, 'farm', { kind: 'open-air', crop: 'maca' }); assert(project);
  assert.equal(project.stone, 0); assert.equal(project.status, 'completed');
  const farm = city.building(p.buildingId); assert.equal(farm.constructionKind, 'open-air'); assert.equal(farm.floors, 1); assert.equal(farm.ownerId, a.id);
  assert.equal(city.economy.consumed.pedra, beforeStone); assert(city.walkable(p.x, p.y));
  assert(farm.units.every(u => u.ownerId === a.accountId && !u.forSale && !u.forRent)); audit(city);
});

test('buildings cannot bypass land ownership, stone delivery or construction labor', () => {
  const city = setup({ starter: true }), a = investor(city), p = freePlot(city), quarry = city.buildings.find(b => b.type === 'quarry');
  assert.equal(city.addBuilding('market', p.x, p.y, { width: p.width, depth: p.depth, floors: 1 }), null);
  assert(city.development.buyPlot(a.accountId, p.id));
  const project = city.development.beginProject(a.accountId, p.id, 'market'); assert(project); assert.equal(project.stone, p.width * p.depth * 2);
  assert.equal(city.development.complete(project), null); assert.equal(p.buildingId, null);
  seedStone(city, quarry, project.stone);
  while (project.inventory.pedra < project.stone) {
    const s = city.logistics.order(quarry, project, 'pedra', Math.min(24, project.stone - project.inventory.pedra), GOODS.pedra.price); assert(s); finishShipment(city, s);
  }
  assert.equal(city.development.complete(project), null);
  const builder = city.building(project.builderId), worker = city.society.citizen(builder.workers[0]);
  worker.entity.x = project.door.x; worker.entity.y = project.door.y;
  const before = worker.skills.construction;
  for (let i = 0; i < 1000 && project.status !== 'completed'; i++) assert(city.development.work(project, worker));
  assert.equal(project.status, 'completed'); assert(worker.skills.construction > before);
  assert.equal(city.economy.consumed.pedra, project.stone); assert.equal(project.inventory.pedra, 0);
  assert.equal(city.building(p.buildingId).ownerId, a.id); assert.equal(city.accounts.get(project.feeAccountId).balance, 0); audit(city);
});

test('full warehouses stop both agricultural harvests and recipes without losing their inputs', () => {
  const city = setup(), farm = city.economy.businesses.find(b => b.type === 'farm'), bakery = city.economy.businesses.find(b => b.type === 'bakery');
  farm.inventoryCapacity = inventoryUsed(farm);
  const field = { plantedAt: city.minute - 1000, labor: ECONOMY_RULES.farmLabor }, old = farm.inventory[farm.crop];
  assert.equal(city.economy.harvest(farm, field), false); assert.equal(farm.inventory[farm.crop], old); assert.notEqual(field.plantedAt, null);
  bakery.inventory.trigo = 2; bakery.inventoryCapacity = inventoryUsed(bakery);
  assert.equal(city.economy.productionWork(bakery, city.citizens[0]), false); assert.equal(bakery.inventory.trigo, 2); assert.equal(bakery.inventory.pao, 0);
});

test('cargo reserves destination capacity and cash until actual arrival; duplicate reservations and invalid quantities fail', () => {
  const city = setup(), farm = city.economy.businesses.find(b => b.type === 'farm'), buyer = city.economy.businesses.find(b => b.type === 'market');
  farm.inventory.maca = 12; city.economy.produced.maca += 12; buyer.inventoryCapacity = 6;
  const cash = buyer.balance, sellerCash = farm.balance;
  const s = city.logistics.order(farm, buyer, 'maca', 6, 100); assert(s);
  assert.equal(buyer.inventory.maca, 0); assert.equal(s.inventory.maca, 6); assert.equal(buyer.incoming.maca, 6); assert.equal(inventoryFree(buyer), 0);
  assert.equal(buyer.balance, cash - 600); assert.equal(farm.balance, sellerCash); assert.equal(s.balance, 600);
  assert.equal(city.logistics.order(farm, buyer, 'maca', 1, 100), false);
  assert.equal(city.logistics.order(farm, buyer, 'maca', -1, 100), false);
  assert.equal(city.logistics.order(farm, buyer, 'maca', 1.5, 100), false);
  finishShipment(city, s); assert.equal(buyer.inventory.maca, 6); assert.equal(buyer.incoming.maca, 0); assert.equal(farm.balance, sellerCash + 600); assert.equal(s.balance, 0); audit(city);
});

test('cancelling a shipment refunds escrow, releases capacity and returns its real cargo', () => {
  const city = setup(), farm = city.economy.businesses.find(b => b.type === 'farm'), buyer = city.economy.businesses.find(b => b.type === 'market');
  farm.inventory.maca = 12; city.economy.produced.maca += 12; const cash = buyer.balance;
  const s = city.logistics.order(farm, buyer, 'maca', 6, 100); assert(s); city.logistics.cancel(s);
  assert.equal(buyer.balance, cash); assert.equal(farm.inventory.maca, 12); assert.equal(buyer.incoming.maca, 0); assert.equal(s.inventory.maca, 0);
  city.logistics.cancel(s); assert.equal(farm.inventory.maca, 12); audit(city);
});

test('interrupted courier paths cannot teleport cargo to its destination or move cargo before pickup', () => {
  const city = setup(), farm = city.economy.businesses.find(b => b.type === 'farm'), buyer = city.economy.businesses.find(b => b.type === 'market');
  farm.inventory.maca = 6; const s = city.logistics.order(farm, buyer, 'maca', 6, 100); assert(s);
  city.minute = 8 * 60; city.logistics.updateMinute(); const c = city.society.citizen(s.driverId); assert(c);
  c.path = []; c.entity.x = 2.5; c.entity.y = 2.5; city.logistics.updateMinute();
  assert.notEqual(s.status, 'delivered'); assert.equal(buyer.inventory.maca, 0); assert(c.path.length);
  c.needs.food = 0; const position = { ...s.position }; city.logistics.updateMinute();
  assert.equal(s.driverId, null); assert.deepEqual(s.position, position); assert.equal(s.inventory.maca, 6);
});

test('a transport company hires a courier, earns delivery fees and pays wages from a separate business account', () => {
  const city = setup(), a = investor(city); let carrier;
  for (const site of city.economy.locateBuilding('carrier')) { carrier = city.addBuilding('carrier', site.x, site.y, { ...site, free: true }); if (carrier) break; }
  assert(carrier); assert(city.economy.purchasePremises(carrier, a, null));
  const worker = city.citizens.find(c => c.wealthTier === 'worker' && c.id !== city.economy.mayorId); city.economy.leaveJob(worker); worker.jobId = carrier.id; carrier.workers = [worker.id];
  const farm = city.economy.businesses.find(b => b.type === 'farm'), buyer = city.economy.businesses.find(b => b.type === 'market'); farm.inventory.maca = 12; city.economy.produced.maca += 12;
  const revenue = carrier.totalRevenue, expenses = carrier.totalExpenses, skill = worker.skills.logistics;
  const s = city.logistics.order(farm, buyer, 'maca', 6, 100); assert(s); assert.equal(s.carrierId, carrier.id); assert(s.fee > 0);
  finishShipment(city, s); assert.equal(carrier.totalRevenue - revenue, s.fee); assert(carrier.totalExpenses > expenses); assert(worker.skills.logistics > skill); audit(city);
});

test('a starter city autonomously builds, sells and rents housing, grows food and transports every material with conserved stocks', () => {
  const city = setup({ starter: true });
  for (let i = 0; i < 10 * 1440 * 4; i++) { city.update(1 / 16); if (i % 240 === 0) audit(city); }
  for (const type of ['residential', 'farm', 'market', 'bakery', 'greengrocer', 'carrier']) assert(city.buildings.some(b => b.type === type), type);
  assert(city.economy.produced.pedra > 0); assert(city.economy.consumed.pedra > 0); assert(city.economy.produced.pao > 0); assert(city.logistics.delivered > 0);
  assert(city.events.some(e => e.data.kind === 'shipment-delivered'));
  const residence = city.buildings.find(b => b.type === 'residential'), builder = city.economy.businesses.find(b => b.type === 'builder');
  assert(residence.units.some(u => u.ownerId !== builder.accountId)); assert(residence.units.some(u => u.tenantId && u.tenantId !== u.ownerId));
  assert(city.stats().homeless < city.stats().population); assert(city.buildings[0].inventory.pao > 0); audit(city);
});

test('demolishing a supplier cancels its active cargo with a refund and conserved items', () => {
  const city = setup({ starter: true }), owner = investor(city), lot = freePlot(city), quarry = city.buildings.find(b => b.type === 'quarry');
  city.development.buyPlot(owner.accountId, lot.id); const project = city.development.beginProject(owner.accountId, lot.id, 'market');
  seedStone(city, quarry, 24); const s = city.logistics.order(quarry, project, 'pedra', 12, GOODS.pedra.price); assert(s);
  quarry.entity.destroyed = true; city.reconcile(); city.development.reconcile(); city.logistics.updateMinute();
  assert.equal(s.status, 'cancelled'); assert.equal(project.incoming.pedra, 0); assert.equal(s.inventory.pedra, 0); audit(city);
});

test('an abandoned project releases its land, materials and escrow when its owner leaves', () => {
  const city = setup({ starter: true }), owner = investor(city), lot = freePlot(city), quarry = city.buildings.find(b => b.type === 'quarry');
  city.development.buyPlot(owner.accountId, lot.id); const project = city.development.beginProject(owner.accountId, lot.id, 'market');
  seedStone(city, quarry, 24); const s = city.logistics.order(quarry, project, 'pedra', 12, GOODS.pedra.price); assert(s);
  owner.entity.destroyed = true; city.reconcile(); city.development.reconcile(); city.logistics.updateMinute();
  assert.equal(project.status, 'cancelled'); assert.equal(s.status, 'cancelled'); assert.equal(lot.ownerId, 'treasury'); assert(lot.forSale); assert.equal(owner.balance, 0); audit(city);
});

test('residential buildings can receive and store deliveries even though they are not active businesses', () => {
  const city = setup(), home = city.buildings.find(b => b.type === 'residential'), farm = city.economy.businesses.find(b => b.type === 'farm');
  farm.inventory.maca = 6; city.economy.produced.maca += 6;
  assert(city.transfer(investor(city).accountId, home.accountId, 1000, 'Compra para depósito residencial'));
  const s = city.logistics.order(farm, home, 'maca', 6, 100); assert(s); finishShipment(city, s);
  assert.equal(home.inventory.maca, 6); audit(city);
});
