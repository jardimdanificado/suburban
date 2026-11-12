import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {CitySimulationBridge} from '../js/city_sim_bridge.js';

function emptyState(cityId,extra={}){
  return {type:'state',cityId,packet:{rootId:1,nodes:[],removed:[],histories:[],nextId:1},positions:new Float64Array(0),inside:new Float64Array(0),vehicles:new Float64Array(0),tick:0,elapsed:0,workerMetrics:{},workMs:0,...extra};
}

test('a background bridge ignores periodic graphs and applies a checkpoint on demand',async()=>{
  const originalWorker=globalThis.Worker,workers=[];
  class FakeWorker{constructor(){this.messages=[];workers.push(this);}postMessage(message){this.messages.push(message);}terminate(){}}
  globalThis.Worker=FakeWorker;
  let bridge;
  try{
    const city=setup({starter:true,population:12}),entities=[],time={paused:false,speed:1,tick:0,elapsed:0,observeProgress(){}};
    bridge=new CitySimulationBridge({cityId:'background-city',city,entities,nextId:10000,time,changed(){},notice(){}});
    bridge.observed=false;bridge.baselineReady=true;
    let applies=0;const apply=bridge.graph.apply.bind(bridge.graph);bridge.graph.apply=packet=>{applies++;return apply(packet);};
    const worker=workers[0];
    bridge.receive(emptyState('background-city',{encodedWhileObserved:false}));
    assert.equal(applies,0,'a periodic graph must not be applied to a background mirror');
    assert.equal(worker.messages.at(-1).type,'ack','the worker still receives its acknowledgement');

    const pending=bridge.checkpoint(),request=worker.messages.at(-1);
    assert.equal(request.type,'checkpoint');
    bridge.receive(emptyState('background-city',{checkpointIds:[request.id]}));
    assert.equal(await pending,bridge.state);
    assert.equal(applies,1,'the explicit checkpoint updates the frozen mirror');
  }finally{
    if(bridge){bridge.active=false;for(const restore of bridge.restores)restore();}
    if(originalWorker===undefined)delete globalThis.Worker;else globalThis.Worker=originalWorker;
  }
});
