import test from 'node:test';
import assert from 'node:assert/strict';
import { TRAIT_LABELS, initializeCharacter } from '../js/city_culture.js';
import { hygieneThresholds, cleanlinessMood } from '../js/city_simulation.js';

test('TRAIT_LABELS includes cleanliness, patience, vitality, openness and initializeCharacter populates them', () => {
  for (const key of ['cleanliness', 'patience', 'vitality', 'openness']) {
    assert(key in TRAIT_LABELS, `missing trait label for ${key}`);
  }
  const citizen = { id: 1, givenNames: ['Ana'], surnames: ['Silva'] };
  const city = { initialSeed: 1234, random: () => 0.5 };
  initializeCharacter(city, citizen);
  for (const key of Object.keys(TRAIT_LABELS)) {
    assert(Number.isFinite(citizen.traits[key]), `missing generated trait ${key}`);
    assert(citizen.traits[key] >= 0.1 && citizen.traits[key] <= 0.9);
  }
});

test('hygieneThresholds triggers bathing sooner for high-cleanliness citizens', () => {
  const neat = hygieneThresholds({ traits: { cleanliness: 0.9 } });
  const sloppy = hygieneThresholds({ traits: { cleanliness: 0.1 } });
  assert(neat.normalHygiene > sloppy.normalHygiene);
  assert(neat.normalDirt < sloppy.normalDirt);
  assert(neat.highHygiene > sloppy.highHygiene);
  assert(neat.highDirt < sloppy.highDirt);
});

test('cleanlinessMood penalizes dirt and low hygiene more for high-cleanliness citizens', () => {
  const dirtyNeat = { traits: { cleanliness: 0.9 }, needs: { hygiene: 20 }, dirtSources: { barro: 35 } };
  const dirtySloppy = { traits: { cleanliness: 0.1 }, needs: { hygiene: 20 }, dirtSources: { barro: 35 } };
  const cleanNeat = { traits: { cleanliness: 0.9 }, needs: { hygiene: 95 }, dirtSources: { barro: 0 } };
  assert(cleanlinessMood(dirtyNeat) < cleanlinessMood(dirtySloppy));
  assert.equal(cleanlinessMood(cleanNeat), 0);
});
