import test from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers/city.mjs';

test('environment secretary launches mass cleanup gigs only when cash, dirt, and unemployment align', () => {
  const city = setup({ starter: true, population: 48 });
  city.minute = 720;
  city.syncClock();
  city.politics.ensureSecretaries();

  // Baseline: clean city should not trigger cleanup program.
  assert.equal(city.gigs.runEnvironmentCleanupProgram(), null);

  // Create high unemployment (>25% of adults).
  const adults = city.citizens.filter(c => !c.entity.destroyed && city.society.isAdult(c) && !c.role?.includes('councilor'));
  for (const c of adults.slice(0, Math.ceil(adults.length * 0.55))) {
    if (c.jobId) city.economy.leaveJob(c);
    c.businessIds = [];
  }

  // Dirty buildings, streets, and stains across the city.
  for (const b of city.buildings) {
    if (b.entity.destroyed || !b.active || b.constructionKind === 'open-air') continue;
    b.cleanliness = 25;
    b.frontageCleanliness = 25;
    b.litter = 3;
  }
  const hall = city.buildings.find(b => b.type === 'townhall');
  let placed = 0;
  for (let dy = -12; dy <= 12 && placed < 18; dy += 3) {
    for (let dx = -12; dx <= 12 && placed < 18; dx += 3) {
      const tx = Math.floor(hall.door.x) + dx, ty = Math.floor(hall.door.y) + dy;
      if (!city.walkable(tx, ty)) continue;
      city.sanitation.streetFeces.set(`${tx},${ty}`, { amount: 2, jobId: null });
      city.sanitation.addStain({ kind: 'mud', scope: 'street', x: tx + 0.5, y: ty + 0.5, radius: 0.45, amount: 0.8 });
      placed++;
    }
  }

  // Without surplus treasury cash, program must NOT launch.
  const treasury = city.accounts.get('treasury');
  const originalTreasury = treasury.balance;
  treasury.balance = Math.max(0, Math.floor(city.fiscal.reserve() * 0.5));
  assert.equal(city.gigs.runEnvironmentCleanupProgram(), null);

  // With surplus treasury cash, program launches dozens of gigs.
  treasury.balance = originalTreasury + city.currency.price(200000);
  const program = city.gigs.runEnvironmentCleanupProgram();
  assert(program, 'expected environment cleanup program to launch');
  assert(program.opened >= 20, `expected dozens of gigs opened, got ${program.opened}`);
  const programJobs = city.gigs.jobs.filter(j => j.program === 'environment-cleanup');
  assert.equal(programJobs.length, program.opened);
  assert(programJobs.some(j => j.kind === 'public-cleaning'), 'expected street public-cleaning gigs');

  // Verify unemployed worker can complete a public-cleaning gig and clean the street spot.
  const pubJob = programJobs.find(j => j.kind === 'public-cleaning');
  const worker = adults.find(c => !c.jobId && !c.businessIds?.length && !c.custody && !c.role?.includes('councilor'));
  assert(worker);
  const beforeBalance = worker.balance;
  pubJob.workerId = worker.id;
  pubJob.status = 'working';
  worker.informalJobId = pubJob.id;
  worker.task = 'informal-frontage';
  worker.path = [];
  worker.entity.x = pubJob.point.x;
  worker.entity.y = pubJob.point.y;
  pubJob.progress = pubJob.required - 1;
  city.gigs.updateMinute();
  assert.equal(pubJob.status, 'completed');
  assert(worker.balance > beforeBalance, 'expected worker to receive temporary gig income');
});
