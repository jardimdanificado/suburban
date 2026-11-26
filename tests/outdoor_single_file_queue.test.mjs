import test from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers/city.mjs';
import { queueService } from '../js/city_service_queue.js';

test('outdoor queue forms a single-file line instead of piling everyone on the door tile', () => {
  const city = setup({ starter: true, population: 24 });
  const b = city.buildings.find((building) => building.door);
  assert(b);
  b.constructionKind = 'open-air';
  b.serviceQueue = [];
  if (city.furniture) city.furniture.benches = [];

  const people = city.citizens.slice(0, 6);
  for (const c of people) {
    c.indoorLocation = null;
    c.path = [];
    c.task = 'supplies';
    c.targetId = b.id;
    c.entity.x = b.door.x;
    c.entity.y = b.door.y;
    assert.equal(queueService(city, c, b, 'supplies', 'dining', false), false);
  }

  const goals = people.map((c) => (c.path.length ? c.path.at(-1) : { x: c.entity.x, y: c.entity.y }));
  for (let i = 1; i < goals.length; i++) {
    const distFromPrev = Math.hypot(goals[i].x - goals[i - 1].x, goals[i].y - goals[i - 1].y);
    assert(distFromPrev >= 0.35 && distFromPrev <= 0.65, `expected single-file spacing, got ${distFromPrev}`);
  }
  assert.deepEqual(b.serviceQueue.map((q) => q.slot), [0, 1, 2, 3, 4, 5]);

  // Serve the first citizen and verify followers advance once they finish their current step
  assert.equal(queueService(city, people[0], b, 'supplies', 'dining', true), true);
  people[1].path = [];
  assert.equal(queueService(city, people[1], b, 'supplies', 'dining', false), false);
  assert.equal(b.serviceQueue.find((q) => q.citizenId === people[1].id).slot, 0);
});
