import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {World} from '../js/world.js';
import {CitySimulation} from '../js/city_simulation.js';
import {CityStateGraph} from '../js/city_state.js';
import {CitySimulationBridge} from '../js/city_sim_bridge.js';

test('motion acknowledgement follows application and respects city routing',()=>{
  const bridge=Object.create(CitySimulationBridge.prototype),events=[];
  Object.assign(bridge,{active:true,cityId:'slow-ui',receiveMotion(data){events.push(data.tick);},worker:{postMessage(data){events.push(data);}}});
  bridge.receive({type:'motion',cityId:'other',motionAck:true,tick:1});
  assert.deepEqual(events,[]);
  bridge.receive({type:'motion',cityId:'slow-ui',motionAck:true,tick:2});
  assert.deepEqual(events,[2,{type:'motion-ack',cityId:'slow-ui'}]);
  events.length=0;
  bridge.receive({type:'motion',cityId:'slow-ui',tick:3});
  assert.deepEqual(events,[3],'legacy workers do not need acknowledgement');
});

test('real worker bounds motion backlog and resumes with current state after a slow consumer',{timeout:20000},async t=>{
  let nextId=1;
  const entities=[],world=new World(1,1337,128);
  const city=new CitySimulation({world,population:24,startFoundingWorks:false,createEntity:data=>{const entity={id:nextId++,destroyed:false,...data};entities.push(entity);return entity;}});
  city.initialize();
  const packet=new CityStateGraph().encode({city,entities,nextId});
  const worker=new Worker(new URL('./helpers/ff_worker.mjs',import.meta.url));
  t.after(()=>worker.terminate());
  await new Promise((resolve,reject)=>{
    let first=null,released=false,timer;
    t.after(()=>clearTimeout(timer));
    worker.on('error',reject);
    worker.on('message',message=>{
      try{
        if(message.type==='failure')throw Error(message.message);
        if(message.type==='ready'){
          worker.postMessage({type:'init',cityId:'slow-ui',packet,profileDiagnostics:true,stateFeatures:{motionAck:true}});
          return;
        }
        if(message.type==='state'){
          assert.ok(message.workerMetrics.phasePeaks);
          // Withhold the graph acknowledgement too, isolating the compact
          // stream from periodic snapshots during the stalled consumer test.
          worker.postMessage({type:'control',cityId:'slow-ui',paused:false,speed:1,observed:true});
          return;
        }
        if(message.type!=='motion')return;
        assert.equal(message.motionAck,true);
        assert.equal(message.workerMetrics.phasePeaks,undefined);
        assert.equal(message.workerMetrics.maxUpdateProfile,undefined);
        if(!first){
          first=message;
          timer=setTimeout(()=>{
            released=true;
            worker.postMessage({type:'motion-ack',cityId:'slow-ui'});
          },650);
          return;
        }
        assert.equal(released,true,'no second packet may queue before the first is consumed');
        assert.ok(message.tick>first.tick,'simulation continues while delivery is blocked');
        assert.ok(message.elapsed>first.elapsed);
        resolve();
      }catch(error){clearTimeout(timer);reject(error);}
    });
  });
});
