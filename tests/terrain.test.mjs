import test from 'node:test';
import assert from 'node:assert/strict';
import { World, WorldClock } from '../js/world.js';
import { CitySimulation } from '../js/city_simulation.js';
import { ROAD_TILES, tileHeight, terrainWalkable, canStep, findTerrainPath, inspectBuildingSite, roadFor, buildingGround } from '../js/city_terrain.js';
import { resolveWorldSettings, randomWorldSeed } from '../js/world_settings.js';

function cityOn(world, seed = world.seed ?? 42) {
  let id = 0;
  return new CitySimulation({ world, seed, createEntity: data => ({ id: ++id, destroyed: false, ...data }) });
}
function terrainFixture() {
  const width = 64, height = 64, tiles = new Uint8Array(width * height);
  return { width, height, spawnCenter: { x: 32, y: 32 }, clock: new WorldClock(), map: tiles, getTile(x, y) { return x < 0 || y < 0 || x >= width || y >= height ? 5 : tiles[y * width + x]; }, setTile(x, y, tile) { tiles[y * width + x] = tile; }, isWalkable(x, y) { return terrainWalkable(this, x, y); } };
}

test('seeds are random by default, validated in URLs and repeatable when specified', () => {
  const seeds = new Set(Array.from({ length: 16 }, randomWorldSeed)); assert(seeds.size > 1);
  const settings = resolveWorldSettings(new URLSearchParams('seed=12345&terrain=highlands'));
  assert.deepEqual(settings, { seed: 12345, preset: 'highlands', presetId: 2 });
  assert.deepEqual(settings, resolveWorldSettings(new URLSearchParams('seed=12345&terrain=highlands')));
  for (const bad of ['0', '-1', 'NaN', '123x', '4294967296']) {
    const s = resolveWorldSettings(new URLSearchParams(`seed=${bad}&terrain=bad`));
    assert(s.seed >= 1 && s.seed <= 2147483647); assert([0, 1, 2].includes(s.presetId));
  }
  const a = new World(0, 12345), b = new World(0, 12345), c = new World(0, 98765);
  assert.deepEqual(a.map, b.map); assert.notDeepEqual(a.map, c.map);
});

test('settlements across all landscape presets preserve every natural height and connect all basic services', () => {
  for (const [preset, seed] of [[0, 42], [1, 1337], [2, 23811]]) {
    const world = new World(preset, seed), natural = world.map.slice(), city = cityOn(world);
    city.initialize();
    assert(city.buildings.length >= 7); assert.equal(city.citizens.length, 24);
    assert.equal(city.stats().homeless, 0); assert(city.stats().employed > 0); assert.equal(city.stats().wealthy, 3);
    let roads = 0;
    for (let i = 0; i < natural.length; i++) if (natural[i] !== world.map[i]) {
      roads++; assert(ROAD_TILES.has(world.map[i]));
      assert.equal(world.map[i], roadFor(natural[i]));
      assert.equal(tileHeight(natural[i]), tileHeight(world.map[i]));
    }
    assert(roads > 0);
    for (const b of city.buildings) {
      assert(b.terrain.variation <= 1.3);
      assert(b.terrain.base >= b.terrain.max);
      for (let y = b.entity.y; y < b.entity.y + b.depth; y++) for (let x = b.entity.x; x < b.entity.x + b.width; x++) {
        assert.equal(world.getTile(x, y), natural[y * world.width + x]);
        assert(terrainWalkable(world, x, y));
      }
      const route = city.findPath(city.spawn, b.door); assert(route !== null);
      let last = city.spawn;
      for (const p of route) { assert(canStep(world, Math.floor(last.x), Math.floor(last.y), Math.floor(p.x), Math.floor(p.y))); last = p; }
    }
    for (const c of city.citizens) assert(city.walkable(Math.floor(c.entity.x), Math.floor(c.entity.y)));
  }
});

test('terrain and town layout are reproducible, and another seed produces different lots and streets', () => {
  const run = seed => {
    const city = cityOn(new World(0, seed)); city.initialize();
    return { map: city.world.map, sites: city.buildings.map(b => [b.type, b.entity.x, b.entity.y, b.width, b.depth, b.floors]) };
  };
  const a = run(42), b = run(42), c = run(99);
  assert.deepEqual(a, b); assert.notDeepEqual(a.sites, c.sites);
});

test('roads follow shores and ramps while water, cliffs and peaks remain barriers', () => {
  const world = terrainFixture();
  for (let y = 0; y < world.height; y++) world.setTile(30, y, 2);
  world.setTile(30, 20, 0); // A natural land passage, not a bridge or landfill.
  const path = findTerrainPath(world, { x: 25.5, y: 25.5 }, { x: 35.5, y: 25.5 });
  assert(path); assert(path.some(p => p.x === 30.5 && p.y === 20.5));
  world.setTile(30, 20, 2);
  assert.equal(findTerrainPath(world, { x: 25.5, y: 25.5 }, { x: 35.5, y: 25.5 }), null);
  world.setTile(10, 10, 9); assert(canStep(world, 9, 10, 10, 10));
  world.setTile(9, 10, 3); assert.equal(canStep(world, 9, 10, 10, 10), false);
  for (const tile of [1, 2, 4, 5, 10]) { world.setTile(10, 10, tile); assert.equal(terrainWalkable(world, 10, 10), false); }
});

test('construction accepts gentle slopes using raised foundations without changing the ground', () => {
  const world = terrainFixture(), city = cityOn(world);
  for (let y = 10; y < 20; y++) for (let x = 12; x < 20; x++) world.setTile(x, y, 9);
  const before = world.map.slice(), site = inspectBuildingSite(city, 10, 12, 4, 3);
  assert.equal(site.error, undefined); assert(site.variation > 0);
  const b = city.addBuilding('residential', 10, 12, { width: 4, depth: 3, floors: 2 });
  assert(b); assert.equal(b.terrain.base, buildingGround(world, 10, 12, 4, 3).base);
  for (let y = 12; y < 15; y++) for (let x = 10; x < 14; x++) assert.equal(world.getTile(x, y), before[y * world.width + x]);
  const treasury = city.treasury;
  world.setTile(23, 13, 10);
  assert.equal(city.addBuilding('market', 22, 12, { width: 3, depth: 3 }), null);
  assert.equal(city.treasury, treasury);
});

test('isolated plots are rejected without construction charges, roads or terrain edits', () => {
  const world = terrainFixture(), city = cityOn(world);
  assert(city.addBuilding('townhall', 10, 10, { width: 4, depth: 4, floors: 3 }));
  for (let y = 0; y < world.height; y++) world.setTile(30, y, 2);
  const before = world.map.slice(), treasury = city.treasury;
  assert.equal(city.addBuilding('residential', 40, 20, { width: 4, depth: 4, floors: 3 }), null);
  assert.match(city.lastError, /isolado/); assert.equal(city.treasury, treasury); assert.deepEqual(world.map, before);
});
