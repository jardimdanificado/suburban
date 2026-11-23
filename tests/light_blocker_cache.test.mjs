import test from 'node:test';
import assert from 'node:assert/strict';
import {cachedLightBlockerBoxes} from '../js/light_blocker_cache.js';
import {CITY_FLOOR_HEIGHT} from '../js/city_building_geometry.js';

function building(id,{x=id,z=id*2,width=3,depth=2,floors=1,base=0.5,type='residential',constructionKind='building',destroyed=false,terrain}={}){
  return {type,constructionKind,width,depth,floors,terrain:terrain===undefined?{base}:terrain,entity:{id,x,y:z,destroyed}};
}

test('unchanged city structure reuses the exact blocker list without elevation reads',()=>{
  const city={structureRevision:4,buildings:[building(1),building(2)]},cache={},map={};
  let reads=0;
  const first=cachedLightBlockerBoxes(cache,city,map,()=>{reads++;return 0;},7);
  assert.equal(reads,0);
  assert.equal(first.revision,'7:4');
  assert.deepEqual(first.map(box=>box.min),[ [1,.5,2], [2,.5,4] ]);
  assert.deepEqual(first.map(box=>box.max[1]),[.5+CITY_FLOOR_HEIGHT,.5+CITY_FLOOR_HEIGHT]);
  const second=cachedLightBlockerBoxes(cache,city,map,()=>{reads++;return 0;},7);
  assert.equal(second,first);
  assert.equal(reads,0);
});

test('structure, terrain, map, city and elevation fallbacks rebuild the list',()=>{
  const cache={},map={};let reads=0;
  const city={structureRevision:1,buildings:[building(1,{terrain:null})]};
  const getElevation=()=>{reads++;return 2;};
  const first=cachedLightBlockerBoxes(cache,city,map,getElevation,1);
  assert.equal(reads,1);
  assert.equal(first[0].min[1],2);
  assert.notEqual(cachedLightBlockerBoxes(cache,city,map,getElevation,2),first);
  assert.equal(reads,2);
  city.structureRevision=2;
  const structural=cachedLightBlockerBoxes(cache,city,map,getElevation,2);
  assert.equal(structural.revision,'2:2');
  assert.notEqual(structural,first);
  const otherMap={};
  const remapped=cachedLightBlockerBoxes(cache,city,otherMap,getElevation,2);
  assert.notEqual(remapped,structural);
  const otherCity={structureRevision:2,buildings:[building(9)]};
  assert.notEqual(cachedLightBlockerBoxes(cache,otherCity,otherMap,getElevation,2),remapped);
});

test('destroyed, open-air and quarry buildings are not occluders',()=>{
  const city={structureRevision:1,buildings:[
    building(1),
    building(2,{destroyed:true}),
    building(3,{constructionKind:'open-air'}),
    building(4,{type:'quarry'}),
  ]};
  const boxes=cachedLightBlockerBoxes({},city,{},()=>0,0);
  assert.deepEqual(boxes.map(box=>box.min[0]),[1]);
});
