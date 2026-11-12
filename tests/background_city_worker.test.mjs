import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {World} from '../js/world.js';
import {CitySimulation} from '../js/city_simulation.js';
import {CityStateGraph} from '../js/city_state.js';

test('real background worker stops periodic graphs and answers explicit checkpoints',{timeout:20000},async t=>{
  let nextId=1;
  const entities=[],world=new World(1,1337,128),city=new CitySimulation({world,population:24,startFoundingWorks:false,createEntity:data=>{const entity={id:nextId++,destroyed:false,...data};entities.push(entity);return entity;}});
  city.initialize();
  const mirror=new CityStateGraph(),packet=mirror.encode({city,entities,nextId});
  const worker=new Worker(new URL('./helpers/ff_worker.mjs',import.meta.url));t.after(()=>worker.terminate());
  await new Promise((resolve,reject)=>{
    let phase='init',checkpointTimer=null;
    // The first heartbeat can only come from a city whose observation is off;
    // from then on the periodic snapshot interval (400 ms at this population)
    // would have produced a graph if the freeze failed.
    const startQuietWindow=()=>{
      if(phase!=='settling')return;
      phase='quiet';
      checkpointTimer=setTimeout(()=>{phase='checkpoint';worker.postMessage({type:'checkpoint',cityId:'background',id:77});},800);
    };
    worker.on('error',reject);
    worker.on('message',message=>{
      try{
        if(message.type==='failure')throw Error(message.message);
        if(message.type==='ready'){worker.postMessage({type:'init',cityId:'background',packet});return;}
        if(message.type==='heartbeat'){startQuietWindow();return;}
        if(message.type==='summary'||message.type==='motion')return;
        if(message.type!=='state')return;
        if(phase==='init'){
          assert.equal(message.sync,true,'the initial graph establishes the mirror baseline');
          mirror.apply(message.packet);worker.postMessage({type:'ack',cityId:'background'});
          worker.postMessage({type:'control',cityId:'background',paused:false,speed:1,observed:false});
          phase='settling';
          return;
        }
        // A packet encoded before the observation switch is still authoritative
        // and must be applied, exactly as the bridge does.
        if(phase==='settling'){mirror.apply(message.packet);worker.postMessage({type:'ack',cityId:'background'});return;}
        if(phase==='quiet')throw new Error('background worker emitted a periodic state packet');
        if(phase==='checkpoint'){
          clearTimeout(checkpointTimer);
          assert.deepEqual(message.checkpointIds,[77]);
          assert.equal(message.sync,true);
          assert.equal(message.encodedWhileObserved,false);
          mirror.apply(message.packet);worker.postMessage({type:'ack',cityId:'background'});
          resolve();
        }
      }catch(error){clearTimeout(checkpointTimer);reject(error);}
    });
  });
});
