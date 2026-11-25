import test from 'node:test';
import assert from 'node:assert/strict';
import { CitySanitation } from '../js/city_sanitation.js';

const mockCity = () => ({ minute: 0, world: { width: 16, height: 16 } });
const mockCitizen = () => ({
  id: 1,
  dead: false,
  entity: { destroyed: false, x: 5, y: 5 },
  needs: { hygiene: 100 },
  wardrobe: [{ dirt: 0 }],
  wearingIndex: 0,
});

test('walking dirt fills feet first and rises to legs and torso on overflow', () => {
  const sanitation = new CitySanitation(mockCity());
  const c = mockCitizen();

  sanitation.soilCitizen(c, 'barro', 10, null, 'feet');
  assert.ok(c.dirtZones.feet > 0);
  assert.equal(c.dirtZones.legs, 0);
  assert.equal(c.dirtZones.arms, 0);

  sanitation.soilCitizen(c, 'barro', 40, null, 'feet');
  assert.ok(c.dirtZones.legs > 0);
});

test('combat, sitting and sleeping dirty their specific body zones', () => {
  const sanitation = new CitySanitation(mockCity());

  const fighter = mockCitizen();
  sanitation.soilCitizen(fighter, 'sangue', 12, null, 'braço');
  assert.ok(fighter.dirtZones.arms > 0);
  assert.equal(fighter.dirtZones.feet, 0);

  const sitter = mockCitizen();
  sanitation.soilCitizen(sitter, 'terra', 10, null, 'seat');
  assert.ok(sitter.dirtZones.seat > 0);
  assert.equal(sitter.dirtZones.head, 0);

  const sleeperSide = mockCitizen();
  sanitation.soilCitizen(sleeperSide, 'terra', 10, null, 'side');
  assert.ok(sleeperSide.dirtZones.side > 0);
  assert.equal(sleeperSide.dirtZones.back, 0);

  sanitation.washCitizenDirt(sleeperSide, 1);
  assert.equal(sleeperSide.dirtZones.side, 0);
});
