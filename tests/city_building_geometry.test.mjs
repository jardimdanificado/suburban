import test from 'node:test';
import assert from 'node:assert/strict';
import {CITY_FLOOR_HEIGHT,cityBuildingPickVerticalBounds} from '../js/city_building_geometry.js';

test('quarry picking bounds stay at ground level even if it is tagged as a one-floor building',()=>{
 const bounds=cityBuildingPickVerticalBounds({type:'quarry',constructionKind:'building',floors:1,base:3,surfaceBase:3.4});
 assert.deepEqual(bounds,{base:3.4,top:3.54});
 assert.ok(bounds.top-bounds.base<CITY_FLOOR_HEIGHT);
});

test('regular one-floor buildings keep a full-floor picking volume',()=>{
 const bounds=cityBuildingPickVerticalBounds({type:'clinic',constructionKind:'building',floors:1,base:3,surfaceBase:3.4});
 assert.deepEqual(bounds,{base:3,top:3+CITY_FLOOR_HEIGHT});
});
