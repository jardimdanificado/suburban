import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../js/world.js';
import { CitySimulation } from '../js/city_simulation.js';

function cityOn(population, settlementPreset, seed = 1337) {
  const world = new World(0, seed, 128);
  let id = 0;
  return new CitySimulation({
    world,
    population,
    settlementPreset,
    createEntity: data => ({ id: ++id, destroyed: false, ...data }),
  });
}

test('growing settlement starts with some housing and services, not the full developed city', () => {
  const city = cityOn(512, 'growing');
  city.initialize();
  const types = new Set(city.buildings.map(building => building.type));

  for (const type of ['townhall', 'office_tower', 'quarry', 'popular_refectory', 'public_toilet', 'super_popular_housing']) {
    assert(types.has(type), `missing ${type}`);
  }
  for (const type of ['mint', 'cleaner', 'bike_rack', 'cycle_assembler']) {
    assert(!types.has(type), `unexpected ${type}`);
  }
  assert.equal(city.buildings.filter(building => building.type === 'super_popular_housing').length, 4);
  const housed = city.citizens.filter(citizen => citizen.homeId).length;
  assert(housed > 0, 'no residents started housed');
  assert(housed < city.citizens.length, 'every resident started housed');
});
