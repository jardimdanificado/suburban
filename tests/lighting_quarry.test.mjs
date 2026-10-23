import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, totalMoney } from './helpers/city.mjs';
import { World } from '../js/world.js';
import { CitySimulation } from '../js/city_simulation.js';
import { quarryDeposits, terrainWalkable } from '../js/city_terrain.js';

test('private lighting orders debit property owners and road lighting debits treasury', () => {
  const city = setup(), mill = city.economy.businesses.find(b => b.type === 'farm');
  mill.type = 'mill'; mill.inventory.oleo = 24; city.economy.produced.oleo += 24;
  const supply = totalMoney(city); city.lighting.hourly();
  const orders = city.logistics.shipments.filter(s => /lighting/.test(s.purpose));
  assert(orders.some(s => s.purpose === 'public-lighting' && s.payerAccountId === 'treasury'));
  assert(orders.some(s => s.purpose === 'property-lighting' && s.payerAccountId.startsWith('citizen:')));
  for (const s of orders) assert.equal(s.cost, s.quantity * Math.ceil(city.economy.goods.oleo.price * (s.payerAccountId === 'treasury' ? 1.5 : 1)));
  assert.equal(totalMoney(city), supply);
});

test('a private lamp cannot burn municipal oil and a retired depot conserves its inventory', () => {
  const city = setup(); city.lighting.hourly();
  const store = [...city.lighting.propertyStores.values()].find(h => h.post.payerId.startsWith('citizen:'));
  const hall = city.buildings.find(b => b.type === 'utility'); hall.inventory.oleo = 5; city.economy.produced.oleo += 5;
  city.minute = 18 * 60; city.lighting.hourly(); assert.equal(store.post.lit, false);
  store.inventory.oleo = 2; city.economy.produced.oleo += 2;
  city.lighting.hourly(); assert.equal(store.post.lit, true); assert.equal(store.inventory.oleo, 1);
  const b = city.building(store.post.buildingId);
  for (const u of b.units.filter(u => u.ownerId === store.post.payerId)) u.ownerId = 'treasury';
  city.lighting.hourly(); assert.equal(store.active, false); assert.equal(store.post.lit, false);
  assert.equal(city.economy.initialStock.oleo + city.economy.produced.oleo, city.economy.consumed.oleo + city.economy.lost.oleo + city.goodsStock('oleo'));
});

test('quarries occupy rocks and expose real bathroom and dining rooms on generated terrain', () => {
  const world = new World(0, 42); let id = 0;
  const city = new CitySimulation({ world, createEntity: data => ({ id: ++id, destroyed: false, ...data }) }); city.initialize();
  const quarry = city.buildings.find(b => b.type === 'quarry');
  assert(quarryDeposits(world, quarry.entity.x, quarry.entity.y, quarry.width, quarry.depth).length > 0);
  assert(terrainWalkable(world, Math.floor(quarry.door.x), Math.floor(quarry.door.y)));
  const count = city.sanitation.facilities.size;
  city.sanitation.setupBusinessRooms(quarry); city.sanitation.setupBusinessRooms(quarry);
  assert.equal(city.sanitation.facilities.size, count);
  assert(quarry.units.some(u => u.roomType === 'bathroom')); assert(quarry.units.some(u => u.roomType === 'dining'));
  const farmCity = setup(), farm = farmCity.buildings.find(b => b.type === 'farm');
  assert(farm.units.some(u => u.roomType === 'bathroom')); assert(farm.units.some(u => u.roomType === 'dining'));
});

test('road repair lookup visits damaged entries instead of scanning the whole world', () => {
  const city = setup(); let reads = 0; const read = city.world.getTile.bind(city.world);
  city.world.getTile = (...args) => { reads++; return read(...args); };
  city.world.roadCondition = new Map(); assert.deepEqual(city.development.cityRoadNeedsRepair(), []); assert.equal(reads, 0);
});
