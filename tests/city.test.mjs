import test from 'node:test';
import assert from 'node:assert/strict';
import { floorCells } from '../js/city_housing.js';
import { NEED_LABELS } from '../js/city_simulation.js';
import { setup, totalMoney } from './helpers/city.mjs';

test('developed city fixture has accessible basic services, homes, jobs and individual cubic spaces', () => {
  const city = setup();
  assert.equal(city.citizens.length, 24);
  for (const type of ['market', 'townhall', 'clinic', 'utility', 'residential', 'leisure']) assert(city.buildings.some(b => b.type === type));
  for (const b of city.buildings) {
    assert.equal(b.units.length, floorCells(b, 0).length * b.floors);
    for (const u of b.units) { assert.equal(city.units.get(u.id), u); assert(u.z < b.floors); }
    assert(city.findPath(city.citizens[0].entity, b.door));
  }
  for (const c of city.citizens) { assert(c.homeUnitId); if (c.fixtureInvestor) assert.equal(c.jobId, null); assert.equal(Object.keys(c.needs).length, Object.keys(NEED_LABELS).length); }
  assert.equal(totalMoney(city), city.currency.netIssued());
});

test('private rent, occupied sales and resale transfer money and preserve the current tenant', () => {
  const city = setup(), tenant = city.citizens.find(c => !c.fixtureInvestor), buyer = city.citizens.find(c => c.fixtureInvestor && c.balance >= city.units.get(tenant.homeUnitId).price && c.accountId !== city.units.get(tenant.homeUnitId).ownerId);
  const u = city.units.get(tenant.homeUnitId), seller = city.accounts.get(u.ownerId);
  city.listUnit(u.id, { rent: u.rent, price: u.price, forSale: true, forRent: true });
  const cash = buyer.balance, sellerCash = seller.balance;
  assert(city.buyUnit(buyer.id, u.id));
  assert.equal(buyer.balance, cash - u.price); assert.equal(seller.balance, sellerCash + u.price);
  assert.equal(u.tenantId, tenant.accountId); assert.equal(tenant.homeUnitId, u.id);
  assert.equal(u.forSale, false); assert.equal(city.buyUnit(buyer.id, u.id), null);
  const ownerCash = buyer.balance;
  const rentDue = [...city.units.values()].filter(s => s.ownerId === buyer.accountId && s.tenantId && s.tenantId !== s.ownerId).reduce((sum, s) => sum + s.rent, 0);
  city.collectRent(); assert.equal(buyer.balance, ownerCash + rentDue);
  assert(city.listUnit(u.id, { price: 200, rent: 20, forSale: true, forRent: true }));
  assert(city.buyUnit(tenant.id, u.id));
  const selfCash = tenant.balance, remainingRent = city.housing.rent(city.housing.home(tenant), tenant); city.collectRent(); assert.equal(tenant.balance, selfCash - remainingRent);
  assert.equal(totalMoney(city), city.currency.netIssued());
});

test('unaffordable purchases and invalid listings do not mutate ownership or cash', () => {
  const city = setup(), c = city.citizens.find(c => !c.fixtureInvestor), u = [...city.units.values()].find(u => u.ownerId === 'treasury' && city.building(u.buildingId).type === 'residential'), balance = c.balance;
  assert.equal(city.buyUnit(c.id, u.id), null); assert.equal(u.ownerId, 'treasury'); assert.equal(c.balance, balance);
  assert.equal(city.listUnit(u.id, { price: Infinity, rent: -1 }), null);
  assert.equal(city.transfer(c.accountId, 'treasury', NaN), false); assert.equal(city.transfer(c.accountId, 'treasury', .5), false);
});

test('three unpaid days evict a private tenant and make the unit available', () => {
  const city = setup(), c = city.citizens.find(c => !c.fixtureInvestor), u = city.units.get(c.homeUnitId);
  city.transfer(c.accountId, 'treasury', c.balance, 'Test drain');
  city.collectRent(); assert.equal(u.missedDays, 1); assert.equal(u.arrears, u.rent);
  city.collectRent(); assert.equal(c.homeUnitId, u.id);
  city.collectRent(); assert.equal(c.homeUnitId, null); assert.equal(u.tenantId, null);
});

test('construction rejects roads, overlaps, invalid dimensions and insufficient municipal funds', () => {
  const city = setup(), balance = city.treasury, count = city.buildings.length;
  const road = city.buildings[0].door;
  assert.equal(city.addBuilding('market', Math.floor(road.x), Math.floor(road.y)), null);
  assert.equal(city.addBuilding('residential', city.buildings[0].entity.x, city.buildings[0].entity.y), null);
  assert.equal(city.addBuilding('residential', 44, 44, { width: 20 }), null);
  assert.equal(city.treasury, balance); assert.equal(city.buildings.length, count);
  const plot = city.development.createPlot(8, 8, 3, 3); assert(plot); const buyer = city.citizens[0]; assert(city.development.buyPlot(buyer.accountId, plot.id));
  const source = { inventory: { pedra: 72 } };
  const afterLand = city.treasury;
  const b = city.addBuilding('residential', 8, 8, { width: 3, depth: 3, floors: 4, plotId: plot.id, ownerAccountId: buyer.accountId, materialSource: source });
  assert(b); assert.equal(b.units.length, 32); assert.equal(b.circulation.length, 4); assert.equal(city.treasury, afterLand); assert.equal(source.inventory.pedra, 0);
  city.transfer('treasury', 'supplier', city.treasury, 'Test drain');
  assert.equal(city.addBuilding('market', 79, 80), null);
  assert.equal(totalMoney(city), city.currency.netIssued());
});

test('navigation routes around buildings and rejects inaccessible entrances', () => {
  const city = setup(), start = city.citizens[0].entity, b = city.buildings[1];
  const path = city.findPath(start, b.door);
  assert(path.length);
  for (const p of path) assert(city.walkable(Math.floor(p.x), Math.floor(p.y)));
  city.world.setTile(Math.floor(b.door.x), Math.floor(b.door.y), 2);
  assert.equal(city.findPath(start, b.door), null);
});

test('several days of movement, needs, wages, services and rent conserve currency', () => {
  const city = setup();
  const reasons=new Set();
  for (let i = 0; i < 3 * 1440 * 4; i++) {city.update(1 / 16);if(i%240===0)for(const e of city.ledger)reasons.add(e.reason);}
  assert.equal(city.day, 4);
  assert.equal(city.world.clock.day, city.day);
  assert.equal(totalMoney(city), city.currency.netIssued());
  assert(reasons.has('Salário'));
  assert(reasons.has('Aluguel diário'));
  assert([...reasons].some(reason=>reason.startsWith('Serviço:')));
  for (const a of city.accounts.values()) assert(Number.isSafeInteger(a.balance) && a.balance >= 0);
  for (const c of city.citizens) {
    assert(city.walkable(Math.floor(c.entity.x), Math.floor(c.entity.y)));
    for (const n of Object.values(c.needs)) assert(Number.isFinite(n) && n >= 0 && n <= 100);
  }
});

test('demolition releases contracts, jobs and navigation cells without losing money', () => {
  const city = setup(), residence = city.buildings.find(b => b.type === 'residential'), office = city.buildings.find(b => b.workers.length);
  const resident = city.citizens.find(c => city.units.get(c.homeUnitId).buildingId === residence.id);
  const worker = city.citizens.find(c => c.jobId === office.id);
  residence.entity.destroyed = true; office.entity.destroyed = true;
  city.reconcile();
  assert.equal(resident.homeUnitId, null); assert.equal(worker.jobId, null);
  assert.equal(city.building(residence.id), undefined);
  assert(city.walkable(residence.entity.x, residence.entity.y));
  assert.equal(totalMoney(city), city.currency.netIssued());
});

test('fractional salary taxes accumulate to the advertised ten percent', () => {
  const city = setup(), c = city.citizens.find(c => city.building(c.jobId)?.ownerId), b = city.building(c.jobId);
  c.skills.governance = 0;
  b.wage = 4; c.task = 'work'; c.targetId = b.id;
  const treasury = city.treasury, cash = c.balance, company = b.balance;
  for (let i = 0; i < 10; i++) assert(city.payWage(c,b,4));
  assert.equal(city.treasury - treasury, 4);
  assert.equal(c.balance - cash, 36);
  assert.equal(company - b.balance, 40);
  assert.equal(totalMoney(city), city.currency.netIssued());
});
