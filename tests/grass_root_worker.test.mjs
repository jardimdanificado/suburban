import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {grassRoots} from '../js/volumetric_grass.js';
import {grassDetailInstances} from '../js/grass_details.js';
import {grassRootTints} from '../js/grass_root_tint.js';

test('real worker preserves roots, prepared colors and meadow details through transfer',async()=>{
 const moduleUrl=new URL('../js/grass_root_worker.js',import.meta.url).href;
 const source=`import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:(...args)=>parentPort.postMessage(...args)};await import(${JSON.stringify(moduleUrl)});parentPort.on('message',data=>self.onmessage({data}));`;
 const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(source)));
 try{
  const positions=new Float32Array([0,0,0,0,.1,1,1,.2,1,0,0,0,1,.2,1,1,.1,0]);
  const tint={colors:new Float64Array(4*4*3).fill(.6),width:4,minTx:0,minTy:0,base:[.82,.82,.82]};
  const expected=grassRoots(positions,undefined,new Set(),{bladesPerAxis:24});
  const reply=new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});
  worker.postMessage({id:12,positions,excluded:[],axis:24,details:true,tint});
  const {id,data}=await reply;assert.equal(id,12);
  assert.deepEqual(data.roots,expected.roots);assert.deepEqual(data.shapes,expected.shapes);assert.deepEqual(data.shades,expected.shades);
  assert.deepEqual(data.tints,grassRootTints(expected.roots,tint));
  assert.deepEqual(data.details,grassDetailInstances(expected.roots,expected.shades));
 }finally{await worker.terminate();}
});
