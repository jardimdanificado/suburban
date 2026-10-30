import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';

test('an unconscious pedestrian does not continue an old route and wakes after the timer',()=>{
 const city=setup({starter:true,population:32}),citizen=city.citizens.find(c=>city.society.isAdult(c)&&!c.entity.destroyed);assert.ok(citizen);
 const origin={x:citizen.entity.x,y:citizen.entity.y};citizen.path=[{x:origin.x+8,y:origin.y+8}];citizen.task='work';citizen.targetId=99;citizen.unconsciousUntil=city.minute+30;
 city.update(.25);assert.deepEqual({x:citizen.entity.x,y:citizen.entity.y},origin);assert.deepEqual(citizen.path,[]);assert.equal(citizen.task,null);assert.ok(citizen.unconsciousUntil>city.minute);
 citizen.unconsciousUntil=city.minute+1;city.update(.25);assert.equal(citizen.unconsciousUntil,null);
});
