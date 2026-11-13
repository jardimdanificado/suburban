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

test('visible grass preempts an already running background field without losing its progress',()=>{
 let clock=0,foreground=false,background=false,visible=false;
 const jobs=new GrassRootJobs(()=>clock++),w={width:32,height:32},large=Float32Array.from(Array.from({length:200},()=>[...positions]).flat());
 jobs.request(w,'background',{getAttribute:key=>key==='position'?{array:large}:null},new Set(),10,()=>true,()=>background=true,()=>0);
 jobs.advance(4);const partial=jobs.running;assert(partial);assert.equal(background,false);
 jobs.request(w,'foreground',surface,new Set(),10,()=>true,()=>foreground=true,()=>visible?1:0);
 visible=true;jobs.advance(4);
 assert.equal(foreground,true);assert.equal(background,false);assert.equal(jobs.running,partial);
 jobs.advance(2000);assert.equal(background,true);assert.equal(jobs.running,null);
});

test('installation yields across budgets without losing a live field',()=>{
 let clock=0,installed=0;
 const jobs=new GrassRootJobs(()=>clock++),world={width:8,height:8};
 jobs.request(world,'field',surface,new Set(),10,()=>true,function*(data){assert.equal(data.roots.length,300);for(let i=0;i<20;i++){installed++;yield;}});
 jobs.advance(9);assert.ok(installed>0&&installed<20);assert.ok(jobs.running);
 jobs.advance(100);assert.equal(installed,20);assert.equal(jobs.running,null);
});

test('worker replies install the exact transferred roots and clearing rejects stale replies',t=>{
 const OriginalWorker=globalThis.Worker;let worker;
 globalThis.Worker=class{constructor(){worker=this;}postMessage(message){this.message=message;}terminate(){this.terminated=true;}};
 t.after(()=>{if(OriginalWorker)globalThis.Worker=OriginalWorker;else delete globalThis.Worker;});
 const jobs=new GrassRootJobs(),world={width:8,height:8};let actual;
 jobs.request(world,'field',surface,new Set(),10,()=>true,data=>actual=data);
 jobs.advance(100);assert.equal(actual,undefined);assert.deepEqual(worker.message.positions,positions);
 assert.notEqual(worker.message.positions,positions,'transferring a job must not detach the terrain geometry');
 const data=grassRoots(positions);worker.onmessage({data:{id:worker.message.id,data}});
 jobs.advance(100);assert.equal(actual,data);
 jobs.request(world,'other',surface,new Set(),10,()=>true,()=>assert.fail('stale result installed'));
 jobs.advance(100);const stale=worker,reply={id:worker.message.id,data};jobs.clear();
 assert.equal(stale.terminated,true);stale.onmessage({data:reply});jobs.advance(100);assert.equal(jobs.running,null);
});

test('worker failure resumes the existing incremental generator',t=>{
 const OriginalWorker=globalThis.Worker;let worker;
 globalThis.Worker=class{constructor(){worker=this;}postMessage(){}terminate(){}};
 t.after(()=>{if(OriginalWorker)globalThis.Worker=OriginalWorker;else delete globalThis.Worker;});
 const jobs=new GrassRootJobs(),world={width:8,height:8};let actual;
 jobs.request(world,'field',surface,new Set(),10,()=>true,data=>actual=data);
 jobs.advance(100);worker.onerror();jobs.advance(100);assert.deepEqual(actual,grassRoots(positions));
});
