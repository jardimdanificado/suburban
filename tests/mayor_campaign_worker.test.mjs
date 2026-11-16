import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {World} from '../js/world.js';
import {CitySimulation} from '../js/city_simulation.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';

test('mayor commands execute in worker and persist in full save export',{timeout:20000},async t=>{
  let nextId=1;
  const entities=[],world=new World(1,1337,128);
  const city=new CitySimulation({world,population:24,startFoundingWorks:false,createEntity:data=>{const entity={id:nextId++,destroyed:false,...data};entities.push(entity);return entity;}});
  city.initialize();
  const mayorId=city.economy.mayorId;
  const graph=new CityStateGraph(),packet=graph.encode({city,entities,nextId}),worker=new Worker(new URL('./helpers/ff_worker.mjs',import.meta.url));
  t.after(()=>worker.terminate());
  const saved=await new Promise((resolve,reject)=>{
    let started=false,exporting=false;
    worker.on('error',reject);
    worker.on('message',message=>{
      try{
        if(message.type==='failure')throw Error(message.message);
        if(message.type==='ready'){worker.postMessage({type:'init',cityId:'mayor',packet});return;}
        if(message.type==='result'){assert.equal(message.ok,true,message.message);return;}
        if(message.type==='export-state'){resolve(message.packet);return;}
        if(message.type!=='state')return;
        const mirror=graph.apply(message.packet).city;
        worker.postMessage({type:'ack',cityId:'mayor'});
        if(!started){
          started=true;
          worker.postMessage({type:'control',cityId:'mayor',paused:true,speed:1,observed:true});
          worker.postMessage({type:'command',cityId:'mayor',id:1,path:'mayorAction',args:['start',{}]});
        }else if(mirror.mayorCampaign&&!exporting){
          exporting=true;
          worker.postMessage({type:'command',cityId:'mayor',id:2,path:'mayorAction',args:['challenge',{kind:'works'}]});
          worker.postMessage({type:'command',cityId:'mayor',id:3,path:'mayorAction',args:['campaignControl',{mode:'manual'}]});
          worker.postMessage({type:'step',cityId:'mayor'});
          worker.postMessage({type:'export-state',cityId:'mayor',id:5});
        }
      }catch(error){reject(error);}
    });
  });
  const restored=new CityStateGraph().apply(saved).city;bindCityState(restored);
  assert.equal(restored.mayorCampaign.mayorId,mayorId);
  assert.equal(restored.mayorCampaign.status,'active');
  assert(restored.mayorCampaign.governmentReview);
  assert.equal(restored.minute,city.minute,'even a worker step cannot skip the pending government review');
  assert.equal(restored.mayorCampaign.campaignControl,'manual');
  assert.equal(restored.mayorCampaign.challenges[0].kind,'works');
  assert.equal(restored.mayorCampaign.challenges[0].status,'active');
  assert.equal(restored.currency.supply(),restored.currency.netIssued());
  assert(restored.mayorAction('observe'));
});
