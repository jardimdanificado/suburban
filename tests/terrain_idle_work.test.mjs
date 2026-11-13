import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleTerrainIdleWork,stopTerrainIdleWork} from '../js/terrain_idle_work.js';
function idleHarness(t){
 const callbacks=new Map();let next=0;
 const oldRequest=globalThis.requestIdleCallback,oldCancel=globalThis.cancelIdleCallback;
 globalThis.requestIdleCallback=(callback,options)=>{assert.equal(options.timeout,200);callbacks.set(++next,callback);return next;};
 globalThis.cancelIdleCallback=id=>callbacks.delete(id);
 t.after(()=>{if(oldRequest)globalThis.requestIdleCallback=oldRequest;else delete globalThis.requestIdleCallback;if(oldCancel)globalThis.cancelIdleCallback=oldCancel;else delete globalThis.cancelIdleCallback;});
 return {callbacks,run(deadline){const [id,callback]=callbacks.entries().next().value;callbacks.delete(id);callback(deadline);}};
}
test('idle work shares at most eight spare milliseconds and stops when preparation finishes',t=>{
 const h=idleHarness(t),budgets=[],rootBudgets=[],world={},visible=new Set(['0,0']);
 const renderer={zoom:.4,visibleTerrainChunkKeys:visible,_terrainBuildJobs:new Map([['0,0',{}]]),advanceTerrainBuilds(w,v,grid,budget){assert.equal(w,world);assert.equal(v,visible);budgets.push(budget);this._terrainBuildJobs.clear();},grassRootJobs:{queue:[],advance(budget){rootBudgets.push(budget);}}};
 scheduleTerrainIdleWork(renderer,world);scheduleTerrainIdleWork(renderer,world);assert.equal(h.callbacks.size,1);
 h.run({didTimeout:false,timeRemaining:()=>50});assert.deepEqual(budgets,[8]);assert(rootBudgets[0]>0&&rootBudgets[0]<=8);assert.equal(h.callbacks.size,0);
});
test('busy frames receive only a tiny timeout slice and clearing cancels pending work',t=>{
 const h=idleHarness(t),budgets=[],renderer={visibleTerrainChunkKeys:new Set(),_terrainBuildJobs:new Map([['0,0',{}]]),advanceTerrainBuilds(w,v,g,budget){budgets.push(budget);}};
 scheduleTerrainIdleWork(renderer,{});h.run({didTimeout:true,timeRemaining:()=>0});assert.deepEqual(budgets,[2]);assert.equal(h.callbacks.size,1);
 stopTerrainIdleWork(renderer);assert.equal(h.callbacks.size,0);
 renderer.terrainOptimizationsEnabled=false;scheduleTerrainIdleWork(renderer,{});assert.equal(h.callbacks.size,0);
});
