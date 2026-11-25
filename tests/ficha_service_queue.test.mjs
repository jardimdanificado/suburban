import test from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers/city.mjs';
import { queueService, ticketRoamBudget, tickServiceTickets } from '../js/city_service_queue.js';

test('ficha system frees waiting citizens without physical line and computes proportional roam radius', () => {
  const city = setup({ starter: true, population: 24 });
  const b = city.buildings.find((building) => building.door);
  assert(b);
  b.constructionKind = 'open-air';
  b.serviceQueue = [];

  const people = city.citizens.slice(0, 5);
  for (const c of people) {
    c.indoorLocation = null;
    c.path = [];
    c.task = 'toilet';
    c.targetId = b.id;
    c.toiletTargetId = 't1';
    c.needs.toilet = 25;
    c.entity.x = b.door.x;
    c.entity.y = b.door.y;
    assert.equal(queueService(city, c, b, 'toilet', 't1', false), false);
  }

  // First citizen is next in line (ahead === 0) with small roam radius
  const firstBudget = ticketRoamBudget(city, people[0]);
  assert.equal(firstBudget.ahead, 0);
  assert.equal(firstBudget.maxRadius, 2.5);

  // Later citizens are freed from physical line (task = null) and have proportional radius
  const fourthBudget = ticketRoamBudget(city, people[4]);
  assert.equal(people[4].task, null);
  assert.ok(people[4].serviceTicket);
  assert.equal(fourthBudget.ahead, 4);
  assert.ok(fourthBudget.maxRadius > firstBudget.maxRadius);
});

test('lazy cancellation checks need only when called, allowing reuse if need returns before turn', () => {
  const city = setup({ starter: true, population: 24 });
  const b = city.buildings.find((building) => building.door);
  assert(b);
  b.constructionKind = 'open-air';
  b.serviceQueue = [];

  const [p0, p1, p2] = city.citizens.slice(0, 3);
  for (const c of [p0, p1, p2]) {
    c.indoorLocation = null;
    c.path = [];
    c.task = 'toilet';
    c.targetId = b.id;
    c.toiletTargetId = 't1';
    c.needs.toilet = 25;
    c.entity.x = b.door.x;
    c.entity.y = b.door.y;
    queueService(city, c, b, 'toilet', 't1', false);
  }

  // p1 satisfies need elsewhere temporarily, then needs it again before being called
  p1.needs.toilet = 98;
  assert.ok(b.serviceQueue.some((q) => q.citizenId === p1.id && q.status !== 'cancelled'));
  p1.needs.toilet = 40;

  // p0 is served and leaves
  assert.equal(queueService(city, p0, b, 'toilet', 't1', true), true);
  // p1 is called and still needs it -> keeps original ticket and is served!
  assert.equal(queueService(city, p1, b, 'toilet', 't1', true), true);

  // p2 satisfied need elsewhere and STILL doesn't need it when called -> cancelled and skipped
  p2.needs.toilet = 95;
  tickServiceTickets(city);
  assert.equal(b.serviceQueue.some((q) => q.citizenId === p2.id), false);
  assert.equal(p2.serviceTicket, null);
});
