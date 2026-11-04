import test from 'node:test';
import assert from 'node:assert/strict';
import {CityLife} from '../js/city_life.js?v=position-validation-cache-1';
import {setup} from './helpers/city.mjs';
import {CityStateGraph,bindCityState} from '../js/city_state.js?v=worker-local-caches-2';

test('ground validation skips unchanged cells and rechecks movement or obstacle changes',()=>{
 let reads=0;
 const city={world:{revision:1},obstacleRevision:1,occupied:new Set(),buildings:[],walkable(){reads++;return true;}};
 const life=new CityLife(city),citizen={entity:{x:12.2,y:8.1,destroyed:false}};
 assert.equal(life.recoverBlockedPosition(citizen),false);assert.equal(reads,1);
 citizen.entity.x=12.8;citizen.entity.y=8.9;
 assert.equal(life.recoverBlockedPosition(citizen),false);assert.equal(reads,1);
 citizen.entity.x=13.1;
 assert.equal(life.recoverBlockedPosition(citizen),false);assert.equal(reads,2);
 city.world.revision++;
 assert.equal(life.recoverBlockedPosition(citizen),false);assert.equal(reads,3);
 city.obstacleRevision++;
 assert.equal(life.recoverBlockedPosition(citizen),false);assert.equal(reads,4);
 city.occupied.add('12,8');
 assert.equal(life.recoverBlockedPosition(citizen),false);assert.equal(reads,5);
});

test('worker state binding recreates the local ground-validation cache',()=>{
 const city=setup({starter:true,population:12}),graph=new CityStateGraph(),mirror=new CityStateGraph();
 const restored=mirror.apply(structuredClone(graph.encode({city}))).city;
 assert.equal(restored.life.positionChecks,undefined);
 bindCityState(restored);
 assert.ok(restored.life.positionChecks instanceof WeakMap);
});
