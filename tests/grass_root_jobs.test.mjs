import test from 'node:test';
import assert from 'node:assert/strict';
import {GrassRootJobs} from '../js/grass_root_jobs.js';
import {grassRoots} from '../js/volumetric_grass.js';
const positions=new Float32Array([0,0,0,0,0,1,1,0,1,0,0,0,1,0,1,1,0,0]);
const surface={getAttribute(name){return name==='position'?{array:positions}:null;}};
test('progressive roots preserve exact geometry, share requests and reuse completed data',()=>{
 const jobs=new GrassRootJobs(),w={revision:1,width:8,height:8};let first,second;
 assert.equal(jobs.request(w,'tile',surface,new Set(),10,()=>true,data=>first=data),null);
 assert.equal(jobs.request(w,'tile',surface,new Set(),10,()=>true,data=>second=data),null);
 assert.equal(first,undefined);assert.equal(jobs.queue.length,1);
 jobs.advance(1000);assert.equal(first,second);assert.deepEqual(first,grassRoots(positions));
 assert.equal(jobs.request(w,'tile',surface,new Set(),10,()=>true,()=>{}),first);
});
test('disposed chunks skip pending work and never receive completed roots',()=>{
 const jobs=new GrassRootJobs(),w={revision:1,width:8,height:8};let alive=true,updates=0;
 jobs.request(w,'tile',surface,new Set(),10,()=>alive,()=>updates++);alive=false;jobs.advance(1000);
 assert.equal(updates,0);assert.equal(jobs.running,null);assert.equal(jobs.queue.length,0);
});
test('frame budgets yield and only local terrain keys invalidate completed roots',()=>{
 let clock=0;const jobs=new GrassRootJobs(()=>clock++),w={revision:1,width:8,height:8};let result;
 jobs.request(w,'tile',surface,new Set(),10,()=>true,data=>result=data);jobs.advance(2);
 assert.equal(result,undefined,'a short budget must return control before completing the field');
 jobs.advance(1000);assert.deepEqual(result,grassRoots(positions));
 w.revision++;assert.equal(jobs.request(w,'tile',surface,new Set(),10,()=>true,()=>{}),result);
 assert.equal(jobs.request(w,'tile:r1',surface,new Set(),10,()=>true,()=>{}),null);
 w.map=new Uint8Array(64);assert.equal(jobs.request(w,'tile',surface,new Set(),10,()=>true,()=>{}),null);
});

test('clearing a world drops pending callbacks and completed cache entries',()=>{
 const jobs=new GrassRootJobs(),w={width:8,height:8};let updates=0;
 jobs.request(w,'tile',surface,new Set(),10,()=>true,()=>updates++);
 jobs.clear();jobs.advance(1000);assert.equal(updates,0);
 assert.equal(jobs.request(w,'tile',surface,new Set(),10,()=>true,()=>updates++),null);
 jobs.advance(1000);assert.equal(updates,1);
 jobs.clear();assert.equal(jobs.request(w,'tile',surface,new Set(),10,()=>true,()=>{}),null);
});
