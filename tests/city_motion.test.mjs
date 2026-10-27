import test from 'node:test';
import assert from 'node:assert/strict';
import {queueMotion,sampleMotion,MOTION_BUFFER_MS} from '../js/city_motion.js';
const motion=()=>({entity:{x:0,y:0},to:{x:0,y:0}});
test('buffered movement stays continuous across jittered motion and full-state packets',()=>{
 const m=motion(),packets=[0,100,215,300,337,440,550,660,700,805,920,1030];let next=0,last=0;
 for(let now=0;now<=1000;now+=5){
  while(next<packets.length&&packets[next]<=now){const t=packets[next++];queueMotion(m,t*.004,0,t);}
  sampleMotion(m,now);
  if(now>MOTION_BUFFER_MS){assert(m.entity.x>last,`unwanted stop at ${now} ms`);if(now>MOTION_BUFFER_MS+100)assert(Math.abs(m.entity.x-(now-MOTION_BUFFER_MS)*.004)<1e-9);}
  last=m.entity.x;
 }
 assert(m.points.length<=5);
});
test('a real stop holds the endpoint without predicting movement past it',()=>{
 const m=motion();queueMotion(m,0,0,0);queueMotion(m,1,0,100);queueMotion(m,1,0,200);
 for(let now=100;now<600;now+=10){sampleMotion(m,now);assert(m.entity.x>=0&&m.entity.x<=1);}
 assert.equal(m.entity.x,1);assert(sampleMotion(m,600));
});
test('teleports and resets discard old walking segments',()=>{
 const m=motion();queueMotion(m,0,0,0);queueMotion(m,1,0,100);queueMotion(m,40,50,120,{reset:true});sampleMotion(m,120);
 assert.deepEqual(m.entity,{x:40,y:50});
});

test('velocity stays continuous at a simulation tick with different incoming and outgoing speeds',()=>{
 const m=motion();for(const [at,x]of [[0,0],[100,.2],[200,.8],[300,1],[400,1.7]])queueMotion(m,x,0,at);
 const value=t=>{sampleMotion(m,t+MOTION_BUFFER_MS);return m.entity.x;},delta=.01;
 const left=value(200-delta),center=value(200),right=value(200+delta);
 assert(Math.abs((center-left)/delta-(right-center)/delta)<.00001);
 assert(center>=left&&right>=center);
});
