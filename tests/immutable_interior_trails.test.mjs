import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceCitizenInterior} from '../js/city_interiors.js';

test('walking records a shared immutable waypoint without freezing the moving position',()=>{
 const target=Object.freeze({x:.5,y:0,z:0}),position={x:0,y:0,z:0};
 const c={entity:{x:0,y:0},indoorLocation:{path:[target],position,targetUnitId:'room',targetRoomType:'service'}};
 advanceCitizenInterior({minute:12},c,1);
 assert.equal(c.entity.x,.5);assert.deepEqual(c.indoorLocation.position,target);
 assert.notEqual(c.indoorLocation.position,target);assert.ok(!Object.isFrozen(position));
 assert.equal(c.indoorLocation.trail.at(-1),target);assert.ok(c.indoorLocation.trail.every(Object.isFrozen));
 assert.equal(c.indoorLocation.unitId,'room');assert.equal(c.indoorLocation.path.length,0);
});
