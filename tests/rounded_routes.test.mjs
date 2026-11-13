import test from 'node:test';
import assert from 'node:assert/strict';
import {queueMotion,sampleRoundedMotion,MOTION_BUFFER_MS} from '../js/city_motion.js';
import {sampleCitizenMotion} from '../js/city_sim_bridge.js';
const route=()=>{const s={entity:{x:1.5,y:1.5},to:{}};for(const [x,y,at]of [[1.5,1.5,0],[2.5,1.5,100],[2.5,2.5,200],[3.5,2.5,300]])queueMotion(s,x,y,at);return s;};
test('open corners round inside their route triangle instead of touching the square waypoint',()=>{
 const s=route();sampleRoundedMotion(s,100+MOTION_BUFFER_MS);
 assert.ok(s.entity.x<2.5&&s.entity.x>2.25);assert.ok(s.entity.y>1.5&&s.entity.y<1.75);
 for(let t=101;t<124;t++){sampleRoundedMotion(s,t+MOTION_BUFFER_MS);assert(s.entity.x<=2.5&&s.entity.y>=1.5);}
});
test('blocked corner retains the original waypoint without crossing a building',()=>{
 const s=route();s.cornerClear=()=>false;sampleRoundedMotion(s,100+MOTION_BUFFER_MS);assert.deepEqual(s.entity,{x:2.5,y:1.5});
});
test('clearance checks are cached across render frames and invalidated by obstacle changes',()=>{
 const s=route();let segments=0,corners=0;s.segmentClear=()=>{segments++;return true;};s.cornerClear=()=>{corners++;return true;};
 for(let i=0;i<120;i++)sampleRoundedMotion(s,100+MOTION_BUFFER_MS+i*.1);
 assert.equal(segments,1);assert.equal(corners,2);
 s.motionRevision=1;sampleRoundedMotion(s,112+MOTION_BUFFER_MS);assert.equal(segments,2);assert.equal(corners,4);
});
test('bridge rounds open ground, rejects nearby buildings, and avoids repeated terrain reads',()=>{
 let reads=0;const world={revision:1,getTile(){reads++;return 0;}},city={occupied:new Set(),obstacleRevision:1};
 const s=route();s.city=city;sampleCitizenMotion(world,s,100+MOTION_BUFFER_MS);assert(s.entity.x<2.5&&s.entity.y>1.5);
 const firstReads=reads;for(let i=0;i<100;i++)sampleCitizenMotion(world,s,100+MOTION_BUFFER_MS+i*.01);assert.equal(reads,firstReads);
 city.occupied.add('2,1');city.obstacleRevision++;const before={...s.entity};sampleCitizenMotion(world,s,101+MOTION_BUFFER_MS);assert.deepEqual(s.entity,before);
});
test('stops and teleport resets retain the exact endpoint',()=>{
 const s=route();sampleRoundedMotion(s,800);assert.deepEqual(s.entity,{x:3.5,y:2.5});
 queueMotion(s,30,40,900,{reset:true});sampleRoundedMotion(s,900);assert.deepEqual(s.entity,{x:30,y:40});
});
test('rounded corner velocity joins both legs continuously with jittered packet times',()=>{
 const at=time=>{const s={entity:{},to:{}};for(const [x,y,t]of [[1.5,1.5,0],[2.5,1.5,100],[2.5,2.5,220]])queueMotion(s,x,y,t);sampleRoundedMotion(s,time+MOTION_BUFFER_MS);return s.entity;};
 const d=.001;
 for(const time of [76,124]){const a=at(time-d),b=at(time),c=at(time+d);assert(Math.abs((b.x-a.x)/d-(c.x-b.x)/d)<1e-6);assert(Math.abs((b.y-a.y)/d-(c.y-b.y)/d)<1e-6);}
});
test('packet diagonals cannot cut across the corners of occupied building cells',()=>{
 const world={revision:1,getTile:()=>0},s={entity:{x:1.5,y:1.5},to:{},city:{occupied:new Set(['1,2']),obstacleRevision:1}};
 queueMotion(s,1.5,1.5,0);queueMotion(s,2.5,2.5,100);
 assert.equal(sampleCitizenMotion(world,s,50+MOTION_BUFFER_MS),false);assert.deepEqual(s.entity,{x:1.5,y:1.5});
});
test('turning smoothing off restores discrete movement; turning it on restores rounded corners',()=>{
 const world={revision:1,getTile:()=>0},smooth=route(),discrete=route();
 sampleCitizenMotion(world,smooth,100+MOTION_BUFFER_MS,true);
 assert(smooth.entity.x<2.5&&smooth.entity.y>1.5);
 assert.equal(sampleCitizenMotion(world,discrete,100+MOTION_BUFFER_MS,false),true);
 assert.deepEqual(discrete.entity,{x:3.5,y:2.5});assert.equal(discrete.points.length,0);
 const resumed=route();sampleCitizenMotion(world,resumed,100+MOTION_BUFFER_MS,true);
 assert(resumed.entity.x<2.5&&resumed.entity.y>1.5);
});
test('a running bridge reads preference changes immediately without recreation',async()=>{
 const {CitySimulationBridge}=await import('../js/city_sim_bridge.js');
 const bridge=Object.create(CitySimulationBridge.prototype),options={smoothMovement:true},sample=route();sample.id=1;
 Object.assign(bridge,{motionOptions:options,city:{world:{revision:1,getTile:()=>0}},time:{paused:false},motion:new Map([[1,sample]]),interiorMotion:new Map(),synchronizeRiders(){}});
 bridge.interpolate(100+MOTION_BUFFER_MS);assert(sample.entity.x<2.5);
 options.smoothMovement=false;bridge.interpolate(101+MOTION_BUFFER_MS);assert.deepEqual(sample.entity,{x:3.5,y:2.5});assert.equal(bridge.motion.size,0);
 options.smoothMovement=true;const next=route();next.id=1;bridge.motion.set(1,next);bridge.interpolate(100+MOTION_BUFFER_MS);assert(next.entity.x<2.5&&next.entity.y>1.5);
});
