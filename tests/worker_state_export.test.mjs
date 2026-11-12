import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {World} from '../js/world.js';
import {CitySimulation} from '../js/city_simulation.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';

const totalBalances=city=>[...city.accounts.values()].reduce((sum,account)=>sum+account.balance,0);

test('a background worker exports a complete state packet for saving',{timeout:20000},async t=>{
  let nextId=1;
  const entities=[],world=new World(1,1337,128),city=new CitySimulation({world,population:32,startFoundingWorks:true,createEntity:data=>{const entity={id:nextId++,destroyed:false,...data};entities.push(entity);return entity;}});
  city.initialize();
  const mirror=new CityStateGraph(),init=mirror.encode({city,entities,nextId});
  const worker=new Worker(new URL('./helpers/ff_worker.mjs',import.meta.url));t.after(()=>worker.terminate());
  let mirrorState=null;
  const exported=await new Promise((resolve,reject)=>{
    let phase='init';
    worker.on('error',reject);
    worker.on('message',message=>{
      try{
        if(message.type==='failure')throw Error(message.message);
        if(message.type==='ready'){worker.postMessage({type:'init',cityId:'export-city',packet:init});return;}
        if(message.type==='export-state'){resolve(message.packet);return;}
        if(message.type!=='state')return;
        mirrorState=mirror.apply(message.packet);worker.postMessage({type:'ack',cityId:'export-city'});
        if(phase==='init'){
          phase='pausing';
          worker.postMessage({type:'control',cityId:'export-city',paused:true,speed:1,observed:false});
          worker.postMessage({type:'checkpoint',cityId:'export-city',id:9});
        }else if(phase==='pausing'&&message.checkpointIds?.includes(9)){
          phase='exporting';
          worker.postMessage({type:'export-state',cityId:'export-city',id:5});
        }
      }catch(error){reject(error);}
    });
  });

  const restored=new CityStateGraph().apply(exported);bindCityState(restored.city);
  const saved=restored.city;
  assert.ok(exported.nodes.length>0,'the export must carry a complete graph, not an empty delta');
  assert.equal(saved.minute,mirrorState.city.minute);
  assert.equal(saved.day,mirrorState.city.day);
  assert.equal(saved.hour,mirrorState.city.hour);
  assert.equal(saved.citizens.length,mirrorState.city.citizens.length);
  assert.equal(saved.buildings.length,mirrorState.city.buildings.length);
  assert.equal(saved.units.size,mirrorState.city.units.size);
  assert.equal(saved.economy.businesses.length,mirrorState.city.economy.businesses.length);
  assert.equal(saved.treasury,mirrorState.city.treasury);
  assert.equal(totalBalances(saved),totalBalances(mirrorState.city));
  assert.equal(saved.ledger.length,mirrorState.city.ledger.length);
  assert.equal(saved.citizens.reduce((sum,person)=>sum+(person.needs.food||0),0),mirrorState.city.citizens.reduce((sum,person)=>sum+(person.needs.food||0),0));
});
