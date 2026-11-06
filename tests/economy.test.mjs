import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, totalMoney, finishShipment, putAtWorkCell, ensureBusiness } from './helpers/city.mjs';
import { CitySimulation } from '../js/city_simulation.js';
import { generateSettlement } from '../js/city_terrain.js';
import { WorldClock } from '../js/world.js';
import { CROPS, GOODS, ECONOMY_RULES, JOB_SKILL } from '../js/city_economy.js';

function recordHarvest(city, farm) {
  farm.fields[0].plantedAt = city.minute - CROPS[farm.crop].grow;
  farm.fields[0].labor = ECONOMY_RULES.farmLabor;
  return city.economy.harvest(farm, farm.fields[0]);
}

test('initial public premises belong to the treasury or the municipal operator', () => {
  const tiles = new Uint8Array(128 * 128);
  const world = { width: 128, height: 128, spawnCenter: { x: 64, y: 64 }, clock: new WorldClock(), getTile(x, y) { return tiles[y * 128 + x]; }, setTile(x, y, t) { tiles[y * 128 + x] = t; } };
  let id = 0; const city = new CitySimulation({ world, createEntity: data => ({ id: ++id, ...data }) });
  city.initialize();
  for (const u of city.units.values()) { const building=city.building(u.buildingId),owner=city.accounts.get(u.ownerId); assert(u.ownerId==='treasury'||owner?.entity?.properties?.cityBuilding?.municipal,`${building.type} ${u.id} owner=${u.ownerId} account=${building.accountId} municipal=${building.municipal}`); }
  assert([...city.units.values()].some(u=>u.forSale));
});

test('an explicitly funded developed fixture supports owners, firms and private tenants', () => {
  const city = setup(), wealthy = city.citizens.filter(c => c.fixtureInvestor), workers = city.citizens.filter(c => !c.fixtureInvestor);
  assert.equal(wealthy.length, 3); assert.equal(workers.length, 21);
  assert.equal(city.stats().homeless, 0);
  assert(wealthy.every(c => c.businessIds.length));
  for (const c of workers) { const u = city.units.get(c.homeUnitId); assert(u); assert.equal(u.tenantId,c.accountId); assert.notEqual(u.ownerId,c.accountId); }
  assert(city.economy.businesses.every(b => b.ownerId==null || b.municipal || wealthy.some(c => c.id === b.ownerId)));
  assert.equal(totalMoney(city), city.currency.netIssued());
});

test('the mayor is a citizen with a separate bank account and is replaced after departure', () => {
  const city = setup(), mayor = city.economy.citizen(city.economy.mayorId);
  assert(mayor); assert.equal(mayor.role, 'provisional-mayor'); assert.equal(city.building(mayor.jobId).type, 'townhall');
  const personal = mayor.balance; city.transfer('treasury', 'supplier', 100, 'Test public expense'); assert.equal(mayor.balance, personal);
  const oldId = mayor.id; mayor.entity.destroyed = true; city.reconcile(); city.economy.appointMayor();
  assert(city.economy.citizen(city.economy.mayorId)); assert.notEqual(city.economy.mayorId, oldId);
  assert(city.events.some(e => e.data.kind === 'mayor-appointed'));
});

test('public residential listings support rentals and can be removed from sale', () => {
  const city=setup(),u=[...city.units.values()].find(u=>u.ownerId==='treasury'&&city.building(u.buildingId).type==='residential');
  assert(city.listUnit(u.id,{rent:1,price:18000,forRent:true,forSale:false}));assert.equal(u.forRent,true);assert.equal(u.forSale,false);
  city.economy.municipalPolicy();assert.equal(u.forRent,true);assert.equal(u.forSale,false);
});

test('skills and social ties both influence the hiring decision; business owners prefer their firms', () => {
  const city = setup(), b = city.economy.businesses.find(b => b.type === 'market'), owner = city.economy.citizen(b.ownerId), workers = city.citizens.filter(c => !c.fixtureInvestor && c.id !== city.economy.mayorId);
  const [skilled, friend] = workers;
  skilled.skills.commerce = friend.skills.commerce = 20;
  const r = city.society.getRelation(owner, friend, true); r.affection = r.trust = 100;
  assert(city.economy.hiringScore(friend, b) > city.economy.hiringScore(skilled, b));
  skilled.skills.commerce = 90; assert(city.economy.hiringScore(skilled, b) > city.economy.hiringScore(friend, b));
  assert(b.ownerId===owner.id); assert(owner.businessIds.includes(b.id));
});

test('professions and conversations increase the appropriate skills only through practice', () => {
  const city = setup(), c = city.citizens.find(c => city.building(c.jobId)?.type === 'townhall'), b = city.building(c.jobId);
  c.task = 'work'; c.targetId = b.id; const before = c.skills.governance, baking = c.skills.baking; putAtWorkCell(city,c,b);
  city.performTask(c); assert(c.skills.governance > before); assert.equal(c.skills.baking, baking);
  const farm = city.economy.businesses.find(b => b.type === 'farm'), worker = city.economy.citizen(farm.workers[0]);
  const agriculture = worker.skills.agriculture; putAtWorkCell(city,worker,farm); city.performTask(worker);
  assert(worker.skills.agriculture > agriculture);
});

test('farms preserve all twelve food and oil crops including sunflowers and cannot harvest without seeds, work and elapsed growth', () => {
  const city = setup(), farm = city.economy.businesses.find(b => b.type === 'farm');
  assert.deepEqual(Object.keys(CROPS).filter(g=>!CROPS[g].nonFood), ['arroz', 'alface', 'tomate', 'girassol', 'maca', 'goiaba', 'trigo', 'milho', 'mandioca', 'cebola', 'feijao', 'coentro']);
  for (const crop of Object.keys(CROPS).filter(g=>!CROPS[g].nonFood)) {
    farm.crop = crop; const field = { plantedAt: city.minute, labor: 0 };
    assert.equal(city.economy.harvest(farm, field), false);
    field.labor = ECONOMY_RULES.farmLabor; assert.equal(city.economy.harvest(farm, field), false);
    field.plantedAt -= CROPS[crop].grow; const quantity = farm.inventory[crop];
    assert(city.economy.harvest(farm, field)); assert.equal(farm.inventory[crop], quantity + ECONOMY_RULES.farmBatch);
    assert.equal(city.economy.harvest(farm, field), false);
  }
  farm.seedStock = 0; farm.balance = 0; farm.fields = [{ plantedAt: null, labor: 0 }];
  assert.equal(city.economy.farmWork(farm, city.economy.citizen(farm.workers[0])), false);
});

test('food moves from a real harvest to shops in exchange for money, then disappears on consumption', () => {
  const city = setup(), farm = city.economy.businesses.find(b => b.type === 'farm'), shop = city.economy.businesses.find(b => b.type === 'market'), c = city.citizens[0];
  farm.crop = 'maca'; recordHarvest(city, farm);
  const money = totalMoney(city), quantity = farm.inventory.maca, farmCash = farm.balance, shopCash = shop.balance;
  const shipment = city.economy.transferGoods(farm, shop, 'maca', 6, 100); assert(shipment); assert.equal(shop.inventory.maca, 0); finishShipment(city, shipment);
  assert.equal(farm.inventory.maca, quantity - 6); assert.equal(shop.inventory.maca, 6);
  assert.equal(farm.balance, farmCash + shipment.cost); assert.equal(shop.balance, shopCash - shipment.cost - shipment.fee);
  assert.equal(city.economy.transferGoods(farm, shop, 'maca', 999, 100), false);
  assert.equal(city.economy.transferGoods(farm, shop, 'unknown', 1, 100), false);
  const offer = city.economy.mealOffer(shop), buyerCash = c.balance;
  assert(city.economy.consumeMeal(c, shop)); assert.equal(c.balance, buyerCash - offer.price); assert.equal(shop.inventory.maca, 3);
  assert.equal(city.economy.consumed.maca, 3); assert.equal(totalMoney(city), money);
});

test('bakeries transform wheat instead of creating bread or restocking from an external food supplier', () => {
  const city = setup(), bakery = ensureBusiness(city,'bakery'), c = city.economy.citizen(bakery.workers[0]);
  const existingBread=bakery.inventory.pao; assert.equal(city.economy.productionWork(bakery, c), false); assert.equal(bakery.inventory.pao,existingBread);
  const farm = city.economy.businesses.find(b => b.type === 'farm'); farm.crop = 'trigo'; recordHarvest(city, farm);
  const shipment = city.economy.transferGoods(farm, bakery, 'trigo', 2, 90); assert(shipment); finishShipment(city, shipment);
  putAtWorkCell(city,c,bakery); for (let i = 0; i < 8; i++) city.performTask(c);
  assert.equal(bakery.inventory.trigo, 0); assert.equal(bakery.inventory.pao, existingBread+3);
  assert.equal(city.economy.consumed.trigo, 2); assert.equal(city.economy.produced.pao, 3);
});

test('missing food inputs create explicit upstream investment demand', () => {
  const city = setup(), bakery = city.economy.businesses.find(b => b.type === 'bakery');
  for (const b of city.economy.businesses.filter(b => b.type === 'farm')) { b.active = false; }
  let demand = city.economy.updateDemand();
  const wheatWithBakery = demand.find(d => d.crop === 'trigo').score;
  bakery.active = false; demand = city.economy.updateDemand();
  for(const holder of [...city.buildings,...city.logistics.shipments])holder.inventory.pao=0; demand=city.economy.updateDemand();
  assert(wheatWithBakery>=120);assert(demand.find(d=>d.crop==='trigo').score>=120);
  const grocer = city.economy.businesses.find(b => b.type === 'greengrocer');
  assert(demand.find(d => d.crop === 'maca').score > 0); assert(grocer.inputDemand.maca > 0);
});

test('a multi-day autonomous city conserves money and every harvested or baked good', () => {
  const city = setup(), initialBusinesses = city.economy.businesses.length;
  for (let i = 0; i < 8 * 1440 * 4; i++) city.update(1 / 16);
  assert(city.development.projects.length > 0); // Turnover can include closures when employers cannot cover costs.
  assert.equal(totalMoney(city), city.currency.netIssued());
  for (const good of Object.keys(GOODS)) {
    const stock = city.goodsStock(good);
    assert.equal(city.economy.initialStock[good] + city.economy.produced[good] + (city.economy.externalTrade?.importedGoods?.[good] || 0), city.economy.consumed[good] + stock + city.economy.lost[good], good);
    for (const b of city.buildings) assert(Number.isSafeInteger(b.inventory[good]) && b.inventory[good] >= 0);
  }
  assert(city.economy.produced.pao > 0); assert(city.economy.consumed.trigo > 0);
  assert(city.getEvents({limit:16000}).some(e => e.data.kind === 'business-founded' || e.data.kind === 'harvest'));
  assert(!city.ledger.some(e => e.reason === 'Reposição de alimentos'));
  for (const u of city.units.values()) if (u.ownerId === 'treasury' && !city.building(u.buildingId)?.municipal && !['townhall','council_chamber','mint','office_tower','super_popular_housing','popular_housing','popular_luxury_housing','clinic','utility','leisure','public_toilet','popular_refectory'].includes(city.building(u.buildingId)?.type)) { assert(u.forSale || u.forRent,`${u.id} ${city.building(u.buildingId)?.type} tenant=${u.tenantId} occupant=${u.occupantId}`); assert.equal(u.tenantId, null); }
});

test('operating accounts include seeds, wages, tax and service revenue exactly once', () => {
  const city = setup(), farm = city.economy.businesses.find(b => b.type === 'farm');
  const expenses = farm.totalExpenses; farm.seedStock = 0;
  city.economy.buySeeds(farm); assert.equal(farm.totalExpenses - expenses, city.ledger.filter(e=>e.reason==='Compra de sementes').at(-1).amount);
  const worker = city.economy.citizen(farm.workers[0]);
  worker.task = 'work'; worker.targetId = farm.id;
  const payrollBefore = farm.totalExpenses, cash = farm.balance;
  city.performTask(worker); assert.equal(farm.totalExpenses - payrollBefore, cash - farm.balance);
  const clinic = city.buildings.find(b => b.type === 'clinic'), revenue = clinic.totalRevenue;
  const c = city.citizens[0]; c.task = 'health'; c.targetId = clinic.id; c.servicePaid = null; c.needs.health=20;
  // Public care is now free and requires medicine plus a present professional.
  const doctor=city.citizens.find(person=>person.id!==c.id&&!city.politics.officeHolder(person));city.economy.leaveJob(doctor);doctor.jobId=clinic.id;clinic.workers.push(doctor.id);clinic.inventory.remedio=1;putAtWorkCell(city,doctor,clinic);city.performTask(doctor);
  city.performTask(c);assert.equal(clinic.totalRevenue-revenue,0);assert.equal(clinic.inventory.remedio,0);
  assert.equal(totalMoney(city), city.currency.netIssued());
});
