import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {World} from '../js/world.js';
import {CitySimulation} from '../js/city_simulation.js';
import {CityStateGraph} from '../js/city_state.js';

test('real worker enters ff, advances, pauses and returns to detailed stepping', {timeout:20000},async t=>{
 let nextId=1;const entities=[],world=new World(1,1337,128),city=new CitySimulation({world,population:24,startFoundingWorks:false,createEntity:data=>{const e={id:nextId++,destroyed:false,...data};entities.push(e);return e;}});city.initialize();
 const mirror=new CityStateGraph(),packet=mirror.encode({city,entities,nextId});
 const worker=new Worker(new URL('./helpers/ff_worker.mjs',import.meta.url));t.after(()=>worker.terminate());
 await new Promise((resolve,reject)=>{
  let phase='init',startingMinute;
  worker.on('error',reject);
  worker.on('message',message=>{
   try{
    if(message.type==='failure')throw Error(message.message);
    if(message.type==='ready'){worker.postMessage({type:'init',packet});return;}
    if(message.type!=='state')return;
    const state=mirror.apply(message.packet);worker.postMessage({type:'ack'});
    if(phase==='init'){startingMinute=state.city.minute;phase='ff';worker.postMessage({type:'control',speed:64,paused:false});}
    else if(phase==='ff'&&state.city.minute>startingMinute){assert.equal(state.city.fastForward,true);phase='detailed';worker.postMessage({type:'control',speed:32,paused:true});worker.postMessage({type:'step'});}
    else if(phase==='detailed'&&state.city.fastForward===false){assert(state.city.minute>=startingMinute);resolve();}
   }catch(error){reject(error);}
  });
 });
});
