import test from 'node:test';
import assert from 'node:assert/strict';
import {boatVisualPosition,hideLocalBoat} from '../js/boat_visual_state.js';
test('an idle ferry remains visible until a world mesh actually replaces its local model',()=>{
 const boat={id:'municipal-ferry',status:'idle'};
 assert.equal(hideLocalBoat(boat,new Set(),null),false);
 assert.equal(hideLocalBoat(boat,new Set(['municipal-ferry']),null),true);
 boat.status='reserved';assert.equal(hideLocalBoat(boat,new Set(),null),false);
});
test('traveling boats do not leave a second model behind at their home port',()=>{
 for(const status of ['at-sea','returning'])assert.equal(hideLocalBoat({id:'ferry',status},new Set(),null),true);
});
test('a locally driven boat uses its local model',()=>{
 assert.equal(hideLocalBoat({id:'ferry',status:'idle'},new Set(['ferry']),123),false);
});
test('moored boats use finite entity positions even while separate coordinates are stale or missing',()=>{
 assert.deepEqual(boatVisualPosition({entity:{x:12,y:9},x:NaN,y:undefined}),{x:12,y:9});
 assert.deepEqual(boatVisualPosition({entity:{x:NaN,y:NaN},x:7,y:8}),{x:7,y:8});
 assert.equal(boatVisualPosition({x:NaN,y:NaN}),null);
});
