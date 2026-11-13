import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceCitizenGait} from '../js/city_citizen_gait.js';

test('gait consumes all distance and advances on every fast rendered step',()=>{
 const gait=(distance,frames)=>{const m={walkFrame:0,walkDistance:0};let steps=0;for(let i=0;i<frames;i++){m.walkDistance+=distance/frames;steps+=advanceCitizenGait(m);}return {...m,steps};};
 assert.equal(gait(4,60).walkFrame,16);assert.equal(gait(4,24).walkFrame,16);
 assert.equal(gait(16,60).steps,64);assert.equal(gait(16,15).steps,64);
 assert.equal(gait(16,60).walkFrame,60);assert.equal(gait(16,15).walkFrame,15);
 assert.ok(gait(16,60).walkDistance<1e-7);
});
test('sub-step distance is retained; pause never advances the walking pose',()=>{
 const motion={walkFrame:3,walkDistance:.24};advanceCitizenGait(motion);assert.equal(motion.walkFrame,3);
 motion.walkDistance+=.52;advanceCitizenGait(motion);assert.equal(motion.walkFrame,4);assert.ok(Math.abs(motion.walkDistance-.01)<1e-8);
 motion.walkDistance=1;advanceCitizenGait(motion,true);assert.deepEqual(motion,{walkFrame:4,walkDistance:1});
});
