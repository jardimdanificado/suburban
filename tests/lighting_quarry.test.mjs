import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, totalMoney, finishShipment } from './helpers/city.mjs';
import { LIGHTING_RULES } from '../js/city_lighting.js';
import { World } from '../js/world.js';
import { CitySimulation } from '../js/city_simulation.js';
import { quarryDeposits, terrainWalkable, ROAD_TILES, tileAt } from '../js/city_terrain.js';

function finishLamp(city, post) {
  const quarry = city.economy.businesses.find(b => b.type === 'quarry');
  const finish = project => {
    quarry.inventory.pedra += project.stone; city.economy.produced.pedra += project.stone;
    city.development.requestMaterials(project);
    for (const shipment of city.logistics.shipments.filter(s => s.buyer === project && !['delivered','cancelled'].includes(s.status))) finishShipment(city, shipment);
    assert.equal(project.inventory.pedra, project.stone);
    const builder = city.building(project.builderId), worker = city.society.citizen(builder.workers[0]);
    worker.entity.x = project.door.x; worker.entity.y = project.door.y;
    for (let i = 0; i < 50 && project.status !== 'completed'; i++) city.development.work(project, worker);
    assert.equal(project.status, 'completed');
  };
  for (const project of city.development.projects.filter(p => p.service === 'lamp' && p.status !== 'completed')) finish(project);
  if (!post.built) { city.lighting.reserve(post); const project = city.development.projects.find(p => p.id === post.projectId); assert(project); finish(project); }
}

test('private lighting orders debit property owners and road lighting debits treasury', () => {
  const city = setup(), mill = city.economy.businesses.find(b => b.type === 'farm');
  mill.type = 'mill'; mill.inventory.oleo = 24; city.economy.produced.oleo += 24;
  city.lighting.hourly();
  finishLamp(city, [...city.lighting.roadPosts.values()][0]);
  finishLamp(city, [...city.lighting.propertyStores.values()].find(h => h.post.payerId.startsWith('citizen:')).post);
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
  finishLamp(city, store.post);
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


test('lamp construction requires delivered material, physical labour and pays the builder once', () => {
  const city = setup(); city.lighting.hourly();
  assert.equal(city.lighting.posts.length, 0); assert.equal(city.world.cityLampPosts.length, 0);
  const project = city.development.projects.find(p => p.service === 'lamp' && p.accountId === 'treasury'); assert(project);
  const post = city.lighting.sites.get(project.lampId), builder = city.building(project.builderId), worker = city.society.citizen(builder.workers[0]);
  assert.equal(project.fee, city.currency.price(LIGHTING_RULES.installationFee) * 1.5);
  assert.equal(city.development.complete(project), null);
  worker.entity.x = project.door.x; worker.entity.y = project.door.y;
  assert.equal(city.development.work(project, worker), false);
  const quarry = city.economy.businesses.find(b => b.type === 'quarry');
  quarry.inventory.pedra += project.stone; city.economy.produced.pedra += project.stone;
  city.development.requestMaterials(project);
  const shipment = city.logistics.shipments.find(s => s.buyer === project && s.good === 'pedra'); assert(shipment);
  assert.equal(project.inventory.pedra, 0); assert.equal(post.built, false);
  finishShipment(city, shipment); assert.equal(project.inventory.pedra, project.stone); assert.equal(post.built, false);
  worker.entity.x = project.door.x + 10; assert.equal(city.development.work(project, worker), false);
  worker.entity.x = project.door.x; worker.entity.y = project.door.y;
  const revenue = builder.totalRevenue;
  while (project.status !== 'completed') city.development.work(project, worker);
  assert.equal(post.built, true); assert(city.world.cityLampPosts.includes(post));
  assert.equal(project.inventory.pedra, 0); assert.equal(builder.totalRevenue - revenue, project.fee);
  city.development.complete(project); assert.equal(builder.totalRevenue - revenue, project.fee);
});

test('road lamps reserve one roadside tile and spacing is global across repeated access paths', () => {
  const city = setup(); city.lighting.hourly();
  const planned = [...city.lighting.roadPosts.values()]; assert(planned.length > 0);
  for (const post of planned) {
    assert(!ROAD_TILES.has(tileAt(city.world, Math.floor(post.x), Math.floor(post.y))));
    assert(ROAD_TILES.has(tileAt(city.world, Math.floor(post.door.x), Math.floor(post.door.y))));
    assert.equal(Math.abs(post.x - post.door.x) + Math.abs(post.y - post.door.y), 1);
    assert(!city.development.plots.some(p => Math.floor(p.door.x) === Math.floor(post.x) && Math.floor(p.door.y) === Math.floor(post.y)));
    if (post.projectId) assert(city.occupied.has(`${Math.floor(post.x)},${Math.floor(post.y)}`));
    for (const other of planned) if (other !== post) assert(Math.hypot(post.x - other.x, post.y - other.y) >= LIGHTING_RULES.roadSpacing);
  }
  const roads = planned.length; city.lighting.hourly(); assert.equal(city.lighting.roadPosts.size, roads);
  const active = city.development.projects.filter(p => p.service === 'lamp' && !p.cancelled && p.status !== 'completed');
  assert(active.length <= LIGHTING_RULES.maxActiveSites);
});

test('cancelling a private installation refunds the contract and releases its tile', () => {
  const city = setup(); city.lighting.hourly();
  const store = [...city.lighting.propertyStores.values()].find(h => h.post.projectId && !h.post.public); assert(store);
  const post = store.post, project = city.development.projects.find(p => p.id === post.projectId);
  const balance = city.accounts.get(post.payerId).balance;
  city.lighting.cancelPost(post);
  assert.equal(city.accounts.get(post.payerId).balance, balance + project.fee);
  assert.equal(project.status, 'cancelled'); assert(!city.occupied.has(`${Math.floor(post.x)},${Math.floor(post.y)}`));
  assert.equal(post.built, false);
});

function oilQueueFixture() {
  const city = setup(), carrier = city.buildings.find(b => b.type === 'market');
  carrier.type = 'carrier'; carrier.ownerId = null;
  const worker = city.citizens.find(c => c.id !== city.economy.mayorId && !c.businessIds.length);
  city.economy.leaveJob(worker); carrier.workers = [worker.id]; worker.jobId = carrier.id;
  worker.deliveryId = worker.cleaningJobId = worker.workMeal = worker.conversation = null;
  for (const key of Object.keys(worker.needs)) worker.needs[key] = 95;
  const seller = city.economy.businesses.find(b => b.type === 'farm'), buyer = city.buildings.find(b => b.type === 'utility');
  seller.inventory.oleo = 2; seller.inventory.maca = 6; city.economy.produced.oleo += 2; city.economy.produced.maca += 6;
  worker.entity.x = seller.door.x; worker.entity.y = seller.door.y; worker.path = [];
  const oil = city.logistics.order(seller, buyer, 'oleo', 1, city.economy.goods.oleo.price, { payerAccountId: 'treasury', purpose: 'public-lighting' }); assert(oil); assert.equal(oil.carrierId, carrier.id);
  return { city, worker, carrier, seller, buyer, oil };
}

test('old oil orders advance ahead of newly queued food without teleporting their cargo', () => {
  const { city, worker, seller, buyer, oil } = oilQueueFixture();
  city.minute += 1440;
  const food = city.logistics.order(seller, buyer, 'maca', 3, city.economy.goods.maca.price); assert(food);
  city.logistics.updateMinute();
  assert.equal(worker.deliveryId, oil.id); assert.equal(food.driverId, null);
  assert.equal(buyer.inventory.oleo, 0); assert.equal(oil.inventory.oleo, 1);
  finishShipment(city, oil); assert.equal(buyer.inventory.oleo, 1); assert.equal(oil.inventory.oleo, 0);
});

test('fresh oil orders still yield to fresh food deliveries', () => {
  const { city, worker, seller, buyer, oil } = oilQueueFixture();
  city.minute += 60;
  const food = city.logistics.order(seller, buyer, 'maca', 3, city.economy.goods.maca.price); assert(food);
  city.logistics.updateMinute(); assert.equal(worker.deliveryId, food.id); assert.equal(oil.driverId, null);
});

test('an insolvent carrier releases an order to owner collection instead of holding it forever', () => {
  const { city, carrier, oil } = oilQueueFixture();
  carrier.ownerId = null; carrier.balance = 0;
  const candidates = city.logistics.candidates(oil);
  assert.equal(oil.carrierId, null); assert(candidates.length > 0);
});

test('a burning lamp orders replacement oil before running out', () => {
  const city = setup(); city.lighting.hourly();
  const post = [...city.lighting.roadPosts.values()][0]; finishLamp(city, post);
  const utility = city.buildings.find(b => b.type === 'utility') || city.buildings[0];
  const mill = city.economy.businesses.find(b => b.type === 'farm'); mill.type = 'mill'; mill.inventory.oleo = 12; city.economy.produced.oleo += 12;
  utility.inventory.oleo = 1; city.economy.produced.oleo++;
  city.minute = 18 * 60; city.lighting.hourly();
  assert(post.lit); assert(post.fuel > 0);
  assert(city.logistics.shipments.some(s => s.good === 'oleo' && s.buyer === utility && s.purpose === 'public-lighting'));
});


test('a generated city builds, supplies and lights a public lamp without injected resources', () => {
  const world = new World(0, 42); let id = 0;
  const city = new CitySimulation({ world, createEntity: data => ({ id: ++id, destroyed: false, ...data }) });
  city.initialize();
  let firstNight = null;
  const hourly = city.lighting.hourly.bind(city.lighting);
  city.lighting.hourly = () => {
    hourly();
    if (city.lighting.posts.some(p => p.public && p.lit)) firstNight ??= { day: city.day, hour: city.hour };
  };
  for (let i = 0; i < 8 * 1440 * 4 && !firstNight; i++) city.update(1 / 16);
  assert(firstNight, 'public illumination must receive oil through real deliveries within the first eight days');
  assert(firstNight.hour >= 18 || firstNight.hour < 6);
  assert(city.economy.produced.girassol > 0); assert(city.economy.produced.oleo > 0);
  assert(city.logistics.shipments.some(s => s.good === 'oleo' && s.purpose === 'public-lighting' && s.status === 'delivered'));
  assert(city.development.projects.some(p => p.service === 'lamp' && p.status === 'completed'));
  assert.equal(totalMoney(city), city.currency.issued);
  for (const good of ['girassol', 'oleo', 'pedra']) assert.equal(city.economy.initialStock[good] + city.economy.produced[good], city.economy.consumed[good] + city.economy.lost[good] + city.goodsStock(good));
  city.minute = Math.floor(city.minute / 1440) * 1440 + 6 * 60;
  city.lighting.hourly(); assert(city.lighting.posts.every(p => !p.lit));
});
