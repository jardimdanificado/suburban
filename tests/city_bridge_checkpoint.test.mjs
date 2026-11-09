import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {CitySimulationBridge} from '../js/city_sim_bridge.js';

test('a bridge resolves a save checkpoint only from the worker snapshot carrying its request id',async()=>{
  const originalWorker=globalThis.Worker,workers=[];
  class FakeWorker{constructor(){this.messages=[];workers.push(this);}postMessage(message){this.messages.push(message);}terminate(){}}
  globalThis.Worker=FakeWorker;
  let bridge;
  try{
    const city=setup({starter:true,population:12}),entities=[],time={paused:true,speed:1,tick:0,elapsed:0,observeProgress(){}};
    bridge=new CitySimulationBridge({cityId:'checkpoint-city',city,entities,nextId:10000,time,changed(){},notice(){}});
    assert.ok(city.citizens.every(person=>person.globalId===`checkpoint-city:${person.id}`));
    const worker=workers[0],pending=bridge.checkpoint(),request=worker.messages.at(-1);let resolved=false;
    pending.then(()=>{resolved=true;});
    const packet=()=>bridge.graph.encode(bridge.state),state=checkpointIds=>({type:'state',cityId:'checkpoint-city',packet:packet(),checkpointIds,positions:new Float64Array(0),inside:new Float64Array(0),vehicles:new Float64Array(0),tick:0,elapsed:0,workerMetrics:{},workMs:0});
    bridge.receive(state([]));await Promise.resolve();assert.equal(resolved,false);
    bridge.receive(state([request.id]));assert.equal(await pending,bridge.state);assert.equal(resolved,true);
  }finally{
    if(bridge){bridge.active=false;for(const restore of bridge.restores)restore();}
    if(originalWorker===undefined)delete globalThis.Worker;else globalThis.Worker=originalWorker;
  }
});

test('a background bridge applies lightweight clock pulses and city summaries',()=>{
  const bridge=Object.create(CitySimulationBridge.prototype),events=[];
  Object.assign(bridge,{active:true,cityId:'background',city:{minute:0,syncClock(){this.synced=true;}},time:{observeProgress(value){this.observed=value;}},onProgress:minute=>events.push(minute),onSummary:summary=>events.push(summary),metrics:{}});
  bridge.receive({type:'heartbeat',cityId:'background',minute:12,tick:720,elapsed:12});
  bridge.receive({type:'summary',cityId:'background',summary:{minute:12,population:24,averageHappiness:71}});
  assert.equal(bridge.city.minute,12);assert.equal(bridge.city.synced,true);assert.equal(bridge.time.tick,720);assert.equal(bridge.time.observed,12);
  assert.deepEqual(events,[12,{minute:12,population:24,averageHappiness:71}]);
});
