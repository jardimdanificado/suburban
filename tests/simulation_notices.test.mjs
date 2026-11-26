import test from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers/city.mjs';
import { createSimulationNoticeTracker, pollSimulationNotices, dismissSimulationNotice, takeSimulationNotice } from '../js/city_simulation_notices.js';

test('simulation notices collect deaths, combat, council votes, decrees, and cleanup programs', () => {
  const city = setup({ starter: true, population: 24 });
  city.minute = 720;
  city.syncClock();

  const tracker = createSimulationNoticeTracker();
  // First poll initializes cursor without flooding historical startup events.
  assert.deepEqual(pollSimulationNotices(city, tracker), []);

  // 1. Death event
  const victim = city.citizens[0];
  city.log(`${victim.entity.properties.name} faleceu de causas naturais.`, 'health', [victim.id], { kind: 'death' });

  // 2. Combat injury (with cooldown deduplication)
  const fighter = city.citizens[1];
  city.log(`${fighter.entity.properties.name} foi ferido em combate.`, 'justice', [fighter.id], { kind: 'combat-injury' });
  city.log(`${fighter.entity.properties.name} levou outro golpe.`, 'justice', [fighter.id], { kind: 'combat-injury' });

  // 3. Council vote
  city.log('Projeto #1 aprovado na Câmara.', 'government', [], { kind: 'bill-voted', billId: 1 });

  // 4. Mayor decree
  city.politics.council.bills.push({
    id: 99,
    title: 'Decreto de Emergência Sanitária',
    decree: true,
    status: 'awaiting-secretary-review',
    eventId: null,
  });

  // 5. Environment cleanup program
  city.log('Secretaria lançou programa de faxina urbana.', 'politics', [], { kind: 'environment-cleanup-program' });

  // 6. Detailed criminal occurrence
  const offender = city.citizens[2], targetVictim = city.citizens[3];
  const building = city.buildings[0];
  const crimeRecord = city.justice.crimeRecord('assault', offender.id, targetVictim.id, {
    buildingId: building.id,
    reason: 'agressão em via',
    position: { x: building.door.x, y: building.door.y },
  });

  const notices = pollSimulationNotices(city, tracker, 1000, { ttlMs: 5000 });
  assert.equal(notices.length, 6);
  assert.deepEqual(
    notices.map(n => n.category),
    ['death', 'combat', 'council', 'environment', 'justice', 'decree']
  );
  assert.equal(notices[3].title, 'Programa de Faxina Urbana');
  const crimeNotice = notices[4];
  assert.equal(crimeNotice.justiceCaseId, crimeRecord.id);
  assert(crimeNotice.text.includes(offender.entity.properties.name), 'expected offender name');
  assert(crimeNotice.text.includes(targetVictim.entity.properties.name), 'expected victim name');
  assert(crimeNotice.text.includes(building.entity.properties.name), 'expected location name');
  assert(crimeNotice.text.includes('agressão em via'), 'expected how/reason');
  assert.equal(notices[5].title, 'Decreto do Prefeito');
  assert.equal(notices[5].billId, 99);

  // Player can dismiss a single notice or open/take one, and remaining expire after ttlMs.
  assert.equal(dismissSimulationNotice(tracker, notices[0].id), true);
  assert.equal(tracker.queue.length, 5);
  const opened = takeSimulationNotice(tracker, crimeNotice.id);
  assert.equal(opened?.id, crimeNotice.id);
  assert.equal(tracker.queue.length, 4);
  assert.equal(pollSimulationNotices(city, tracker, 6500, { ttlMs: 5000 }).length, 0);
});
