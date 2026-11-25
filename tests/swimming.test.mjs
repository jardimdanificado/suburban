import test from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers/city.mjs';
import { TILE_WATER } from '../js/world_gen.js';
import { citizenAnimation } from '../js/city_citizen_models.js';

function createRiverWorld() {
  const city = setup({ starter: true, population: 4 });
  const w = city.world.width, h = city.world.height;
  // Create a 2-tile-wide vertical river at x = 80..81
  for (let y = 0; y < h; y++) {
    city.world.setTile(80, y, TILE_WATER);
    city.world.setTile(81, y, TILE_WATER);
  }
  return city;
}

function addCitizen(city, x = 78.5, y = 64.5) {
  const c = city.citizens[0];
  c.entity.x = x;
  c.entity.y = y;
  c.path = [];
  c.task = null;
  c.indoorLocation = null;
  c.conversation = null;
  c.workMeal = null;
  c.sleep = null;
  c.boatClass = null;
  c.ridingVehicleId = null;
  for (const k in c.needs) c.needs[k] = 90;
  return c;
}

test('citizen can swim across a river when no bridge or boat exists', () => {
  const city = createRiverWorld();
  const c = addCitizen(city, 78.5, 64.5);
  const path = city.findPath(c.entity, { x: 83.5, y: 64.5 });
  assert(path && path.length > 0, 'should find a swim path across the river');
  assert(path.some(p => city.world.getTile(Math.floor(p.x), Math.floor(p.y)) === TILE_WATER), 'path across river should include water tiles');

  c.path = path;
  c.task = 'walk';
  let sawSwimming = false;
  for (let i = 0; i < 60 && c.path.length; i++) {
    city.update(0.25);
    if (c.swimming) {
      sawSwimming = true;
      assert.equal(citizenAnimation(c, true), 'nadar');
    }
  }
  assert(sawSwimming, 'citizen should enter swimming state while crossing water');
  assert.equal(c.path.length, 0, 'citizen should reach the opposite bank');
  assert.equal(c.swimming, false, 'citizen should exit swimming state on land');
  assert(c.entity.x > 82, 'citizen should be on the far side of the river');
});

test('citizens avoid water for small detours but swim when crossing is much faster', () => {
  const city = setup({ starter: true, population: 4 });
  const c = addCitizen(city, 70.5, 64.5);
  // Single water tile directly ahead: citizen should walk around on land
  city.world.setTile(71, 64, TILE_WATER);
  const detour = city.findPath(c.entity, { x: 72.5, y: 64.5 });
  assert(detour && detour.length > 0);
  assert.equal(detour.some(p => city.world.getTile(Math.floor(p.x), Math.floor(p.y)) === TILE_WATER), false, 'citizen should walk around a small water obstacle');
});

test('citizen swims for leisure and hygiene depending on needs', () => {
  const city = createRiverWorld();
  const c = addCitizen(city, 78.5, 64.5);

  // Hygiene need -> swim-hygiene
  c.needs.hygiene = 20;
  c.dirt = 80;
  const spot = city.findSwimSpot(c, 10);
  assert(spot, 'should find nearby water spot from shore');
  c.path = [...spot.path, spot.water];
  c.task = 'swim-hygiene';
  c.swimSpot = spot;
  c.swimUntil = city.minute + 20;
  while (c.path.length) city.update(0.25);
  assert.equal(c.swimming, true);
  assert.equal(citizenAnimation(c, false), 'nadar');

  // Leisure need -> swim-leisure
  const c2 = city.citizens[1];
  c2.entity.x = 79.5;
  c2.entity.y = 65.5;
  c2.path = [];
  c2.indoorLocation = null;
  c2.needs.leisure = 30;
  c2.needs.hygiene = 70;
  const spot2 = city.findSwimSpot(c2, 10);
  assert(spot2);
  c2.path = [...spot2.path, spot2.water];
  c2.task = 'swim-leisure';
  c2.swimSpot = spot2;
  c2.swimUntil = city.minute + 35;
  while (c2.path.length) city.update(0.25);
  assert.equal(c2.swimming, true);
  assert.equal(citizenAnimation(c2, false), 'nadar');
});

test('new human animation clips map to the corresponding citizen states', () => {
  assert.equal(citizenAnimation({ swimming: true }, true), 'nadar');
  assert.equal(citizenAnimation({ deliveryId: 1 }, true), 'carregar');
  assert.equal(citizenAnimation({ task: 'walk' }, true), 'run');
  assert.equal(citizenAnimation({ conversation: {} }, false), 'conversar');
  assert.equal(citizenAnimation({ celebrating: true }, false), 'comemorar');
  assert.equal(citizenAnimation({ dancing: true }, false), 'dancar');
  assert.equal(citizenAnimation({ waving: true }, false), 'acenar');
  assert.equal(citizenAnimation({ task: 'clean', workCell: { x: 1, y: 1 } }, false), 'varrer');
  assert.equal(citizenAnimation({ task: 'construction', workProjectId: 1 }, false), 'cavar');
});
