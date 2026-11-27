import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ANIMAL_SPECIES, ANIMAL_CLIPS, ANIMAL_SPECIES_IDS } from '../js/animal_catalog.js';
import { parseCitizenOBJ } from '../js/city_citizen_models.js';
import { CityFauna, FAUNA_RULES } from '../js/city_fauna.js';
import { CitySanitation } from '../js/city_sanitation.js';
import { CityWater } from '../js/city_water.js';
import { CityAnimalModels, animalAnimation, animalFrame } from '../js/city_animal_models.js';
import { TILE_WATER } from '../js/world_gen.js';

function createWorld(width = 32, height = 32, defaultTile = 0) {
  const map = Array.from({ length: height }, () => Array.from({ length: width }, () => defaultTile));
  for (let y = 0; y < height; y++) {
    map[y][0] = TILE_WATER;
    map[y][1] = 3; // sand shore
  }
  return {
    width,
    height,
    map,
    revision: 1,
    getTile: (x, y) => map[y]?.[x] ?? 0,
    hasSidewalk: () => false,
  };
}

function createMockCity(world) {
  let nextId = 1;
  const entities = [];
  const city = {
    world,
    minute: 600,
    citizens: [],
    occupied: new Set(),
    development: { plots: [] },
    nature: { plants: new Map() },
    createEntity({ x, y, properties }) {
      const entity = { id: nextId++, x, y, destroyed: false, properties: properties || {} };
      entities.push(entity);
      return entity;
    },
    entities,
  };
  city.fauna = new CityFauna(city);
  return city;
}

test('animal catalog defines at least 20 wild and livestock species', () => {
  assert.ok(ANIMAL_SPECIES_IDS.length >= 20, `expected >= 20 species, got ${ANIMAL_SPECIES_IDS.length}`);
  const wild = ANIMAL_SPECIES_IDS.filter(id => ANIMAL_SPECIES[id].category === 'wild');
  const livestock = ANIMAL_SPECIES_IDS.filter(id => ANIMAL_SPECIES[id].category === 'livestock');
  assert.ok(wild.length >= 12);
  assert.ok(livestock.length >= 6);
  assert.equal(ANIMAL_SPECIES.vaca.grazesGrass, true);
  assert.equal(ANIMAL_SPECIES.boi.grazesGrass, true);
});

test('all 24 species have grounded low-poly OBJ frames for every clip', () => {
  for (const species of ANIMAL_SPECIES_IDS) {
    for (const [clip, frames] of Object.entries(ANIMAL_CLIPS)) {
      for (const frame of frames) {
        const filePath = path.join('data', 'animals', species, clip, `${frame}.obj`);
        assert.ok(fs.existsSync(filePath), `missing ${filePath}`);
        const parsed = parseCitizenOBJ(fs.readFileSync(filePath, 'utf8'));
        assert.ok(parsed.triangles >= 40, `${filePath} should have >= 40 triangles`);
        assert.ok(parsed.bounds.min[1] >= -1e-4, `${filePath} should be grounded at y=0`);
      }
    }
  }
});

test('CityFauna spawns wild animals in habitats and cows/oxen graze wild grass', () => {
  const world = createWorld(48, 48, 0);
  const city = createMockCity(world);
  city.fauna.initialize();
  assert.ok(city.fauna.animals.size > 0);
  assert.ok(city.fauna.wildCount() <= FAUNA_RULES.maxWildAnimals);

  // Spawn a hungry cow and a hungry ox on grass tiles and verify they graze
  const cow = city.fauna.spawn(10, 10, 'vaca', { hunger: 40 });
  const ox = city.fauna.spawn(12, 10, 'boi', { hunger: 40 });
  assert.ok(cow && ox);
  cow.stateUntil = city.minute;
  ox.stateUntil = city.minute;

  for (let i = 0; i < 10; i++) {
    city.minute++;
    city.fauna.update(0.25);
    city.fauna.updateMinute();
  }
  assert.ok(cow.hunger > 40 || cow.state === 'eat' || cow.state === 'walk', 'cow should graze or seek grass');
  assert.ok(ox.hunger > 40 || ox.state === 'eat' || ox.state === 'walk', 'ox should graze or seek grass');
});

test('shy animals flee nearby citizens and provoked predators react', () => {
  const world = createWorld(32, 32, 0);
  const city = createMockCity(world);
  const deer = city.fauna.spawn(10, 10, 'veado');
  const jaguar = city.fauna.spawn(20, 20, 'onca', { hunger: 20 });
  const citizen = { id: 1, dead: false, needs: { health: 100 }, entity: { x: 11, y: 10, destroyed: false } };
  const preyCitizen = { id: 2, dead: false, needs: { health: 100 }, entity: { x: 20.5, y: 20, destroyed: false } };
  city.citizens.push(citizen, preyCitizen);

  city.minute++;
  city.fauna.updateMinute();
  assert.equal(deer.state, 'flee');
  assert.ok(preyCitizen.needs.health < 100, 'hungry jaguar within range should attack');
});

test('CityAnimalModels loads OBJ frames and batches visible animals', async () => {
  class Group { constructor() { this.children = []; } add(c) { this.children.push(c); } remove(c) { this.children = this.children.filter(x => x !== c); } }
  class BufferAttribute { constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; } }
  class BufferGeometry {
    constructor() { this.attributes = {}; }
    setAttribute(k, v) { this.attributes[k] = v; }
    computeBoundingSphere() {}
    dispose() {}
  }
  class MeshLambertMaterial { constructor(opts) { Object.assign(this, opts); } dispose() {} }
  class Matrix4 { compose() { return this; } }
  class Vector3 { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } }
  class Quaternion { setFromAxisAngle() { return this; } }
  class Color { setHex() { return this; } }
  class InstancedMesh {
    constructor(geo, mat, cap) {
      this.geometry = geo; this.material = mat; this.capacity = cap; this.count = 0;
      this.instanceMatrix = { setUsage() {}, needsUpdate: false };
      this.instanceColor = { needsUpdate: false };
    }
    setMatrixAt() {}
    getMatrixAt() {}
    setColorAt() {}
    getColorAt() {}
    dispose() {}
  }
  const THREE = { Group, BufferGeometry, Float32BufferAttribute: BufferAttribute, MeshLambertMaterial, Matrix4, Vector3, Quaternion, Color, InstancedMesh, DynamicDrawUsage: 1 };
  const group = new Group();
  const models = new CityAnimalModels(THREE, group, {
    fetchAsset: async (url) => {
      const rel = url.pathname.replace(/^.*\/data\/animals\//, '');
      const text = fs.readFileSync(path.join('data', 'animals', rel), 'utf8');
      return { ok: true, text: async () => text };
    },
  });
  const ok = await models.loading;
  assert.equal(ok, true);
  assert.equal(models.frames.size, 832);

  const world = createWorld(24, 24, 0);
  const city = createMockCity(world);
  const cow = city.fauna.spawn(8, 8, 'vaca', { hunger: 95 });
  assert.ok(cow.entity.properties.brain?.animal);
  cow.state = 'walk';
  cow.stateTimer = 2;
  cow.targetX = 12;
  cow.targetY = 8;
  const startX = cow.x;
  city.fauna.update(0.5);
  assert.ok(cow.x > startX, 'update(dt) should move walking animal smoothly');
  assert.equal(animalAnimation(cow, true), 'walk');
  assert.equal(animalAnimation(cow, false), 'idle');
  assert.equal(animalFrame('walk', 0).clip, 'walk');

  models.begin(0.016, 1);
  assert.equal(models.add(cow.entity, 1.0), true);
  models.end();
  assert.equal(group.children.length, 1);
  assert.equal(group.children[0].count, 1);
});

test('ranches spawn livestock, feed restores hunger, and hunting harvests products', async () => {
  const { INDUSTRIES, INDUSTRIAL_FOODS } = await import('../js/city_industries.js');
  assert.ok(INDUSTRIES.feed_mill && INDUSTRIES.cattle_ranch && INDUSTRIES.hunting_lodge && INDUSTRIES.tannery);
  assert.ok(INDUSTRIAL_FOODS.includes('carne_bovina') && INDUSTRIAL_FOODS.includes('carne_caca') && INDUSTRIAL_FOODS.includes('churrasco'));

  const world = createWorld(32, 32, 0);
  const city = createMockCity(world);
  const ranch = { id: 101, type: 'cattle_ranch', active: true, door: { x: 10, y: 10 }, entity: { x: 10, y: 10, destroyed: false }, units: [{}], inventory: { racao_bovina: 3 } };
  city.buildings = [ranch];
  city.fauna.syncRanches();
  const herd = [...city.fauna.animals.values()].filter(a => a.buildingId === ranch.id);
  assert.ok(herd.length >= 2);
  herd.forEach(a => { a.hunger = 30; });
  const fed = city.fauna.feedLivestock(ranch, 'racao_bovina');
  assert.equal(fed, herd.length);
  assert.ok(herd[0].hunger > 30);

  const deer = city.fauna.spawn(20, 20, 'veado');
  const hunter = { id: 5, entity: { x: 20.5, y: 20, destroyed: false }, inventory: { arco_caca: 1 } };
  const hit1 = city.fauna.huntNearest(hunter, { species: 'veado' });
  assert.equal(hit1.status, 'wounded');
  const hit2 = city.fauna.huntNearest(hunter, { species: 'veado' });
  assert.equal(hit2.status, 'harvested');
  assert.equal(deer.dead, true);
  assert.ok(hunter.inventory.carne_caca > 0);
  assert.ok(hunter.inventory.couro > 0);
});

test('CitySimulationBridge smoothly interpolates animal motion between worker packets', async () => {
  const { CitySimulationBridge } = await import('../js/city_sim_bridge.js');
  const world = createWorld(32, 32, 0);
  const city = createMockCity(world);
  const cow = city.fauna.spawn(10, 10, 'vaca');
  const bridge = new CitySimulationBridge({ city, entities: city.entities, nextId: 100, time: { paused: false } });

  // Packet 1 at t=1000, Packet 2 at t=1100, Packet 3 at t=1200
  bridge.applyAnimalPositions(new Float64Array([cow.id, 10, 10, 0, 1, 0]), 1000);
  bridge.applyAnimalPositions(new Float64Array([cow.id, 11, 10, 0, 1, 0]), 1100);
  bridge.applyAnimalPositions(new Float64Array([cow.id, 12, 10, 0, 1, 0]), 1200);

  // Sample at t=1230 (buffer target = 1050 -> halfway between 10 and 11)
  bridge.interpolate(1230);
  assert.ok(cow.entity.x > 10.1 && cow.entity.x < 10.9, `expected smooth mid-segment x, got ${cow.entity.x}`);
  assert.equal(cow._renderMoving, true);
});

test('animals die from starvation, decay, and omnivores forage', () => {
  const world = createWorld(32, 32, 0);
  const city = createMockCity(world);
  const pig = city.fauna.spawn(10, 10, 'porco', { hunger: 50 });
  const starving = city.fauna.spawn(14, 14, 'veado', { hunger: 0 });
  starving.health = 5;
  starving.stateTimer = 10;

  city.minute++;
  city.fauna.updateMinute();
  city.minute++;
  city.fauna.updateMinute();
  assert.equal(starving.dead, true);
  assert.equal(starving.action, 'Morto por inanição');

  city.minute += 120;
  city.fauna.updateMinute();
  assert.equal(starving.entity.destroyed, true);
  assert.equal(city.fauna.animals.has(starving.id), false);

  // Omnivore foraging restores hunger
  pig.state = 'eat';
  pig.stateTimer = 3;
  const before = pig.hunger;
  city.fauna.update(0.25);
  assert.ok(pig.hunger > before, 'eating should restore hunger');
});

test('pastures preserve grass and grazed cells clear temporarily then regrow', async () => {
  const { buildingClearsGrass } = await import('../js/city_site_footprints.js');
  const world = createWorld(32, 32, 0);
  const city = createMockCity(world);
  const ranch = { id: 200, type: 'cattle_ranch', active: true, width: 7, depth: 7, door: { x: 10, y: 10 }, entity: { x: 10, y: 10, destroyed: false }, units: [{}], inventory: {} };
  assert.equal(buildingClearsGrass(ranch), false, 'pastures must keep grass');
  city.buildings = [ranch];
  city.fauna.syncRanches();
  const herd = [...city.fauna.animals.values()].filter(a => a.buildingId === ranch.id);
  assert.ok(herd.length >= 2);
  for (const a of herd) {
    assert.ok(a.x >= 10 && a.x <= 17 && a.y >= 10 && a.y <= 17, 'ranch animals should spawn inside pasture');
  }

  city.fauna.grazeCell(25, 25, 90);
  assert.equal(city.fauna.grazedTiles.has('25,25'), true);
  assert.ok(city.fauna.grazeRevision > 0);
  city.minute += 90;
  city.fauna.updateMinute();
  assert.equal(city.fauna.grazedTiles.has('25,25'), false, 'grazed grass should regrow after 90 minutes');
});

test('all 24 species generate diffuse textures and tangent-space normal maps', async () => {
  const { generateAnimalTextureData, createAnimalSpeciesTextures } = await import('../js/animal_textures.js');
  class DataTexture { constructor(data, w, h) { this.data = data; this.width = w; this.height = h; } }
  const THREE = { DataTexture, RGBAFormat: 1, NearestFilter: 1, RepeatWrapping: 1, SRGBColorSpace: 'srgb' };
  for (const species of ANIMAL_SPECIES_IDS) {
    const tex = generateAnimalTextureData(species, 32);
    assert.equal(tex.diffuse.length, 32 * 32 * 4);
    assert.equal(tex.normal.length, 32 * 32 * 4);
    const created = createAnimalSpeciesTextures(THREE, species);
    assert.ok(created.map && created.normalMap);
  }
});

test('wild animals can be tamed, traded, ridden as mounts, or kept as companions', () => {
  const world = createWorld(32, 32, 0);
  const city = createMockCity(world);
  const balances = { c1: 50000, c2: 50000 };
  city.transfer = (from, to, amt) => {
    if ((balances[from] || 0) < amt) return false;
    balances[from] -= amt;
    balances[to] = (balances[to] || 0) + amt;
    return true;
  };
  const seller = { id: 1, accountId: 'c1', dead: false, entity: { x: 10, y: 10, destroyed: false } };
  const buyer = { id: 2, accountId: 'c2', dead: false, entity: { x: 11, y: 10, destroyed: false } };
  city.citizens.push(seller, buyer);

  const horse = city.fauna.spawn(10, 10, 'cavalo');
  const rabbit = city.fauna.spawn(15, 15, 'coelho');
  assert.equal(city.fauna.tameAnimal(seller, horse), true);
  assert.equal(city.fauna.tameAnimal(seller, rabbit), true);
  assert.equal(horse.role, 'mount');
  assert.equal(rabbit.role, 'companion');

  // Smaller companion cannot be mounted, and follows owner
  assert.equal(city.fauna.mountAnimal(seller, rabbit), false);
  city.fauna.decideBehavior(rabbit, false);
  assert.equal(rabbit.action, 'Acompanhando tutor');

  // Mount can be ridden, boosts speed, and dismounted
  assert.equal(city.fauna.mountAnimal(seller, horse), true);
  assert.ok(city.fauna.mountSpeedFor(seller) > 2);
  seller.entity.x = 13;
  city.fauna.update(0.1);
  assert.equal(horse.x, 13);
  assert.equal(city.fauna.dismountAnimal(seller), true);
  assert.equal(city.fauna.mountSpeedFor(seller), 1);

  // Trading transfers ownership and conserves money
  assert.equal(city.fauna.tradeAnimal(seller, buyer, horse, 18000), true);
  assert.equal(horse.ownerId, buyer.id);
  assert.equal(balances.c1, 68000);
  assert.equal(balances.c2, 32000);
});

test('circular grazing clears only a circle, arboreal animals climb trees, and 20+ birds nest on trees/balconies/fences/roofs', async () => {
  const { grassRoots } = await import('../js/volumetric_grass.js');
  // 1x1 tile from (0,0) to (1,1)
  const pos = new Float32Array([0,0,0, 0,0,1, 1,0,1, 0,0,0, 1,0,1, 1,0,0]);
  const col = new Float32Array(pos.length).fill(1);
  const full = grassRoots(pos, col, new Set(), { bladesPerAxis: 6 });
  const grazed = grassRoots(pos, col, new Set(), { bladesPerAxis: 6, excludedCircles: [{ x: 0.5, z: 0.5, r2: 0.35 * 0.35 }] });
  assert.ok(grazed.roots.length > 0 && grazed.roots.length < full.roots.length, 'only circular patch should be cleared, not whole tile');

  const birds = ANIMAL_SPECIES_IDS.filter(id => ANIMAL_SPECIES[id].canFly);
  assert.ok(birds.length >= 20, `expected >= 20 flying bird species, got ${birds.length}`);
  assert.ok(ANIMAL_SPECIES.preguica.speed <= 0.2 && ANIMAL_SPECIES.preguica.arboreal);
  for (const id of ['mico_leao', 'sagui', 'quati', 'iguana']) {
    assert.equal(ANIMAL_SPECIES[id].arboreal, true);
  }

  const world = createWorld(32, 32, 0);
  const city = createMockCity(world);
  // Non-timber plant or seedling must not be climbed
  city.nature.plants.set(1, { id: 1, species: 'monstera', stage: 'mature', x: 10, y: 10, entity: { destroyed: false, properties: { tree: true, render: { size: 0.8 } } } });
  const sloth = city.fauna.spawn(10, 10, 'preguica', { hunger: 50 });
  sloth.stateTimer = 0;
  city.fauna.decideBehavior(sloth, false);
  assert.equal(sloth.altitude, 0, 'sloth must not float on non-timber plant');

  // Mature timber tree can be climbed at its canopy altitude
  city.nature.plants.set(2, { id: 2, species: 'oak', stage: 'mature', visualScale: 1.1, x: 10, y: 10, entity: { destroyed: false, properties: { tree: true, render: { size: 1.0 } } } });
  sloth.stateTimer = 0;
  city.fauna.decideBehavior(sloth, false);
  assert.ok(sloth.altitude > 1.0, 'sloth should climb into mature timber tree canopy');

  // Nests on all 4 surface types
  for (const surface of ['tree', 'balcony', 'fence', 'roof']) {
    const nest = city.fauna.placeNest({ x: 10.5, y: 10.5, z: 2.0, surface, species: 'bem_te_vi' });
    assert.equal(nest.surface, surface);
    assert.equal(nest.entity.properties.cityNest, nest);
  }
  const bird = city.fauna.spawn(10, 10, 'bem_te_vi');
  assert.ok(city.fauna.tryBuildNest(bird), 'bird should build a nest');

  // Garça cannot walk on water, only fly over it
  assert.equal(city.fauna.canOccupy(0, 0, 'garca', null, 0), false);
  assert.equal(city.fauna.canOccupy(0, 0, 'garca', null, 2.5), true);

  // Bird ascends progressively and never picks water as landing spot
  const hawk = city.fauna.spawn(12, 12, 'gaviao');
  hawk.stateTimer = 0;
  city.fauna.decideBehavior(hawk, false);
  if (hawk.action === 'Voando') {
    assert.notEqual(world.getTile(Math.floor(hawk.targetX), Math.floor(hawk.targetY)), TILE_WATER);
    const startAlt = hawk.altitude;
    city.fauna.update(0.1);
    assert.ok(hawk.altitude > startAlt && hawk.altitude < hawk.targetAltitude, 'bird should ascend progressively');
  }

  // Wild animals penalize urban centers, and nest/perch heights match CITY_FLOOR_HEIGHT & fence cap
  city.buildings = [
    { id: 300, type: 'residential', floors: 2, width: 3, depth: 3, entity: { x: 20, y: 20, destroyed: false }, units: [] },
    { id: 301, type: 'cattle_ranch', width: 7, depth: 7, door: { x: 14, y: 10 }, entity: { x: 10, y: 10, destroyed: false } },
  ];
  assert.ok(city.fauna.urbanPenalty(21, 21) > city.fauna.urbanPenalty(2, 2));
  const perches = city.fauna.surfacePerchCandidates(15, 15, 20);
  const roof = perches.find(p => p.surface === 'roof');
  const fence = perches.find(p => p.surface === 'fence');
  assert.ok(roof && Math.abs(roof.z - (2 * 1.8 + 0.12)) < 0.01);
  assert.ok(fence && Math.abs(fence.z - 0.8) < 0.01);

  // Destroying host tree/building grounds arboreal animals and prunes orphaned nests
  const oak = city.nature.plants.get(2);
  const treeNest = city.fauna.placeNest({ x: oak.x + 0.5, y: oak.y + 0.5, z: 1.6, surface: 'tree', plantId: oak.id, species: 'bem_te_vi' });
  const roofNest = city.fauna.placeNest({ x: 20.35, y: 20.35, z: 3.72, surface: 'roof', buildingId: 300, species: 'bem_te_vi' });
  city.building = id => city.buildings.find(b => b.id === id) || null;
  sloth.stateTimer = 0;
  city.fauna.decideBehavior(sloth, false);
  assert.ok(sloth.altitude > 1.0 && sloth.targetAltitude > 1.0);
  oak.entity.destroyed = true;
  city.buildings[0].entity.destroyed = true;
  city.fauna.update(0.1);
  assert.equal(sloth.altitude, 0, 'arboreal animal must drop to ground when tree is destroyed');
  assert.equal(sloth.targetAltitude, 0, 'arboreal targetAltitude must reset to 0');
  assert.equal(city.fauna.nests.has(treeNest.id), false, 'tree nest must be pruned when tree is destroyed');
  assert.equal(city.fauna.nests.has(roofNest.id), false, 'roof nest must be pruned when building is destroyed');

  // Dead animal carcass feeds carnivores/omnivores until completely consumed
  const deer = city.fauna.spawn(5, 5, 'veado');
  city.fauna.markDead(deer, 'Abatido');
  assert.ok(deer.carcassFood > 25);
  const vulture = city.fauna.spawn(5.5, 5, 'urubu', { hunger: 20 });
  while (deer.carcassFood > 0) {
    vulture.hunger = 20;
    vulture.stateTimer = 0;
    city.fauna.decideBehavior(vulture, false);
  }
  assert.equal(deer.entity.destroyed, true, 'consumed carcass entity must be destroyed');
  assert.equal(city.fauna.animals.has(deer.id), false, 'consumed carcass must be removed from fauna');

  // Human corpses attract wild scavengers into urban tiles and get consumed
  const corpseEntity = city.createEntity({ x: 14.5, y: 14.5, properties: { name: 'Corpo', cityCorpse: true } });
  const body = { id: 99, citizenId: 50, name: 'Aldo', entity: corpseEntity, position: { x: 14.5, y: 14.5 }, status: 'waiting', carcassFood: 50, carcassMaxFood: 50 };
  city.justice = { bodies: [body], corpseRevision: 0 };
  const jaguar = city.fauna.spawn(14, 14, 'onca', { hunger: 20, force: true });
  while (body.carcassFood > 0) {
    jaguar.hunger = 20;
    jaguar.stateTimer = 0;
    city.fauna.decideBehavior(jaguar, false);
  }
  assert.equal(body.status, 'cremated', 'consumed human corpse must be marked done');
  assert.equal(body.entity.destroyed, true, 'consumed human corpse entity must be destroyed');
});

test('combat blood splatters street/walls/plants, soilCitizen tracks dirt types, and cleaner removes stains', () => {
  const world = createWorld(16, 16, 0);
  const accounts = new Map([['treasury', { balance: 100000 }], ['cleaner:1', { balance: 0 }], ['c:1', { balance: 0 }]]);
  const building = { id: 1, type: 'residential', width: 2, depth: 2, door: { x: 4, y: 6 }, entity: { x: 4, y: 4, destroyed: false }, units: [] };
  const cleaner = { id: 2, type: 'cleaner', active: true, accountId: 'cleaner:1', balance: 5000, wage: 10, ownerId: 1, workers: [], door: { x: 8, y: 8 }, entity: { x: 8, y: 8, destroyed: false } };
  const worker = { id: 1, accountId: 'c:1', skills: { cleaning: 20 }, needs: { hygiene: 100 }, wardrobe: [{ dirt: 0 }], wearingIndex: 0, path: [], entity: { x: 4, y: 6, destroyed: false } };
  const city = {
    world,
    minute: 600,
    hour: 10,
    buildings: [building, cleaner],
    citizens: [worker],
    units: new Map(),
    accounts,
    nature: { plants: new Map([[1, { id: 1, x: 3, y: 5, entity: { destroyed: false } }]]) },
    building: id => city.buildings.find(b => b.id === id) || null,
    society: { citizen: id => city.citizens.find(c => c.id === id) || null },
    economy: { isBusiness: b => b.type === 'cleaner', workingOwner: b => b.ownerId != null, connected: () => true, practice() {} },
    currency: { price: n => n },
    findPath: () => [],
    urgentNeed: () => false,
    payWage() {},
    transfer(from, to, amt) {
      const a = accounts.get(from), b = accounts.get(to);
      if (!a || !b || a.balance < amt) return false;
      a.balance -= amt; b.balance += amt; return true;
    },
    history: { record() {} },
    reputation: { completed() {} },
    log() {},
  };
  const sanitation = new CitySanitation(city);
  sanitation.emitCombatBlood(3.8, 5.2, 1.0);
  const scopes = new Set([...sanitation.stains.values()].map(s => s.scope));
  assert.ok(scopes.has('street'), 'blood should splatter street');

  sanitation.soilCitizen(worker, 'sangue', 20);
  sanitation.soilCitizen(worker, 'bosta', 10);
  assert.equal(worker.dirtSources.sangue, 20);
  assert.equal(worker.dirtSources.bosta, 10);
  assert.ok(worker.needs.hygiene < 100);
  sanitation.washCitizenDirt(worker, 1);
  assert.equal(worker.dirtSources.sangue, 0);

  const streetStain = [...sanitation.stains.values()].find(s => s.scope === 'street');
  const job = sanitation.requestStainCleaning(streetStain);
  assert.ok(job, 'cleaner company should accept stain cleaning job');
  for (let i = 0; i < 10 && job.status !== 'completed'; i++) {
    city.minute++;
    sanitation.updateStainJobs([job]);
  }
  assert.equal(job.status, 'completed');
  assert.equal(sanitation.stains.has(streetStain.id), false, 'cleaned stain must be removed');
});

test('washing pollutes water and open sea recovers faster than landlocked lakes', () => {
  const width = 16, height = 16;
  const flatMap = new Array(width * height).fill(0);
  // Sea touching top border (many border tiles)
  for (let x = 0; x < 16; x++) flatMap[x] = TILE_WATER;
  for (let x = 4; x < 12; x++) flatMap[1 * width + x] = TILE_WATER;
  // Landlocked lake in middle
  for (let y = 7; y <= 9; y++) for (let x = 7; x <= 9; x++) flatMap[y * width + x] = TILE_WATER;
  const city = {
    world: { width, height, map: flatMap, waterTopologyRevision: 0 },
    sanitation: { streetFeces: new Map() },
    buildings: [],
  };
  const water = new CityWater(city);
  water.reconcile();
  assert.equal(water.bodies.length, 2);
  const [sea, lake] = water.bodies;
  assert.ok(sea.borderTiles > 10 && lake.borderTiles === 0);

  water.polluteAt(5.5, 0.5, 5000);
  water.polluteAt(8.5, 8.5, 5000);
  const seaInitial = sea.pollutants, lakeInitial = lake.pollutants;
  assert.ok(seaInitial > 0 && lakeInitial > 0);

  for (let h = 0; h < 10; h++) water.hourly();
  assert.ok(sea.pollutants / seaInitial < lake.pollutants / lakeInitial, 'sea with border tiles must recover faster than lake');
  assert.ok(lake.pollutants / lakeInitial > 0.95, 'landlocked lake must recover very slowly');
});

test('terrestrial species have distinct silhouettes and species-specific gaits', () => {
  const load = (species, clip, frame) => parseCitizenOBJ(fs.readFileSync(path.join('data', 'animals', species, clip, `${frame}.obj`), 'utf8'));
  // Rabbit hops off the ground mid-stride
  const rabbitGround = load('coelho', 'walk', 0);
  const rabbitAir = load('coelho', 'walk', 2);
  assert.ok(rabbitGround.bounds.min[1] < 1e-3);
  assert.ok(rabbitAir.bounds.min[1] > 0.08, 'rabbit walk frame 2 should hop airborne');

  // Reptile exhibits lateral S-curve / tail sway across opposite walk half-cycles
  const tailTipX = g => {
    const p = g.attributes ? g.attributes.position.array : g.positions;
    let minZ = Infinity, x = 0;
    for (let i = 0; i < p.length; i += 3) if (p[i + 2] < minZ) { minZ = p[i + 2]; x = p[i]; }
    return x;
  };
  const caiman0 = load('jacare', 'walk', 0);
  const caiman4 = load('jacare', 'walk', 4);
  assert.ok(Math.abs(tailTipX(caiman4) - tailTipX(caiman0)) > 0.25, 'caiman tail should sway laterally during walk');

  // Coati holds its tail high upright compared to a low-tailed capybara
  const coati = load('quati', 'idle', 0);
  const capy = load('capivara', 'idle', 0);
  assert.ok(coati.bounds.max[1] > capy.bounds.max[1], 'coati upright tail should raise its idle silhouette');
});

test('fish live in water, join the food chain, and sustainable reproduction prevents extinction', () => {
  const world = createWorld(48, 48, 0);
  for (let y = 8; y < 40; y++) for (let x = 20; x < 34; x++) world.map[y][x] = 2;
  world.revision++;
  const city = createMockCity(world);
  city.fauna.initialize();

  const freshFish = [...city.fauna.animals.values()].filter(a => !a.dead && ['tilapia', 'pacu'].includes(a.species));
  assert.ok(freshFish.length >= 4, 'should spawn freshwater fish in lake');
  assert.ok(freshFish.every(f => f.altitude < 0), 'fish should swim submerged');

  // Predators/piscivores must not hunt prey below minViableCount
  const heron = city.fauna.spawn(19, 20, 'garca', { hunger: 20, force: true });
  for (const sp of ['tilapia', 'pacu']) {
    const list = [...city.fauna.animals.values()].filter(a => a.species === sp && !a.dead);
    const minV = city.fauna.minViableCount(sp);
    for (let i = minV; i < list.length; i++) city.fauna.markDead(list[i], 'Teste');
  }
  assert.equal(city.fauna.findPrey(heron), null, 'piscivore respects minimum viable fish reserve');

  // Sustainable reproduction restores depleted populations
  const tilapias = [...city.fauna.animals.values()].filter(a => a.species === 'tilapia' && !a.dead);
  for (const t of tilapias) t.hunger = 80;
  const before = city.fauna.wildCount('tilapia');
  city.fauna.sustainEcosystem();
  assert.ok(city.fauna.wildCount('tilapia') > before, 'healthy adults reproduce toward carrying capacity');
});
