import test from 'node:test';
import assert from 'node:assert/strict';
import {crowdDirection,crowdGroupKey} from '../js/citizen_crowd.js';

test('crowd direction matches the former atan2 octant and tie behavior',()=>{
  const values=[-8,-2,-1,-.5,-(Math.SQRT2-1),-.25,-.01,0,.01,.25,Math.SQRT2-1,.5,1,2,8];
  for(const dx of values)for(const dy of values){
    if(dx===0&&dy===0)continue;
    assert.equal(crowdDirection(dx,dy)||0,Math.round(Math.atan2(dy,dx)/(Math.PI/4))||0,`${dx},${dy}`);
  }
  const threshold=Math.SQRT2-1;
  for(const [dx,dy] of [[1,threshold],[-1,threshold],[1,-threshold],[-1,-threshold],[threshold,1],[-threshold,1],[threshold,-1],[-threshold,-1]]){
    assert.equal(crowdDirection(dx,dy)||0,Math.round(Math.atan2(dy,dx)/(Math.PI/4))||0,`boundary ${dx},${dy}`);
  }
});

test('numeric crowd keys uniquely identify ordinary map cells and all octants',()=>{
  const keys=new Set();
  for(let x=0;x<128;x++)for(let y=0;y<128;y++)for(let direction=-4;direction<=4;direction++){
    const key=crowdGroupKey(x,y,direction);assert.equal(typeof key,'number');assert(!keys.has(key));keys.add(key);
  }
  assert.notEqual(crowdGroupKey(2,7,0),crowdGroupKey(2,7,1));
  assert.notEqual(crowdGroupKey(2,7,0),crowdGroupKey(2,8,0));
  assert.equal(crowdGroupKey(-1,7,0),'-1,7,0');
});
