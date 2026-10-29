import test from 'node:test';
import assert from 'node:assert/strict';
import {BUILDING_TYPES} from '../js/city_simulation.js';
import {BUILDING_ACTIVITY_PROFILE_TYPES,buildingActivityProfile} from '../js/city_building_activity_profiles.js';

test('every registered building has an explicit interior or outdoor activity fallback',()=>{
  const missing=Object.keys(BUILDING_TYPES).filter(type=>!buildingActivityProfile(type));
  assert.deepEqual(missing,[]);
  assert.equal(new Set(BUILDING_ACTIVITY_PROFILE_TYPES).size,BUILDING_ACTIVITY_PROFILE_TYPES.length);
  for(const type of Object.keys(BUILDING_TYPES)){
    const profile=buildingActivityProfile(type);
    assert.ok(profile.group,type);
    assert.ok(profile.station,type);
    assert.ok(profile.fallback,type);
    assert.ok(profile.roomTypes.length,type);
  }
  assert.equal(buildingActivityProfile('__unknown_building_type__'),null);
});
