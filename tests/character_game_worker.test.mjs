import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {World} from '../js/world.js';
import {CitySimulation} from '../js/city_simulation.js';
import {canControl,controlledCitizen} from '../js/character_game.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
test('worker accepts possession, movement input and exports a resumable character',{timeout:20000},async t=>{
 let nextId=1;const entities=[],world=new World(1,1337,128);
 const city=new CitySimulation({world,population:24,startFoundingWorks:false,createEntity:data=>{const entity={id:nextId++,destroyed:false,...data};entities.push(entity);return entity;}});city.initialize();
 const person=city.citizens.find(c=>canControl(city,c));
 person.inventory.madeira=2;
 const graph=new CityStateGraph(),packet=graph.encode({city,entities,nextId}),worker=new Worker(new URL('./helpers/ff_worker.mjs',import.meta.url));t.after(()=>worker.terminate());
 let compactControl=false;
 const saved=await new Promise((resolve,reject)=>{let initialized=false;worker.on('error',reject);worker.on('message',m=>{try{
  if(m.type==='player-control'){compactControl=true;assert.equal(m.citizenId,person.id);}
  if(m.type==='failure')throw Error(m.message);
  if(m.type==='ready')worker.postMessage({type:'init',cityId:'character',packet});
  if(m.type==='state'){worker.postMessage({type:'ack',cityId:'character'});if(!initialized){initialized=true;worker.postMessage({type:'control',cityId:'character',paused:true,speed:1,observed:true});worker.postMessage({type:'command',cityId:'character',id:1,path:'gameAction',args:['start',{citizenId:person.id}]});}}
  if(m.type==='result'){
   if(m.id===3){assert(!m.ok,'Worker must reject WASD while automatic');worker.postMessage({type:'export-state',cityId:'character',id:4});}
   else {assert(m.ok,m.message);if(m.id===1)worker.postMessage({type:'command',cityId:'character',id:2,path:'gameAction',args:['autonomy',{enabled:true}]});
   else if(m.id===2)worker.postMessage({type:'command',cityId:'character',id:3,path:'gameAction',args:['input',{x:1,y:0}]});
   else if(m.id===5)worker.postMessage({type:'command',cityId:'character',id:6,path:'gameAction',args:['input',{x:1,y:0}]});
   else if(m.id===6)worker.postMessage({type:'command',cityId:'character',id:8,path:'gameAction',args:['drop-good',{good:'madeira',quantity:1}]});
   else if(m.id===8)worker.postMessage({type:'export-state',cityId:'character',id:7});}
  }
  if(m.type==='export-state'){
   if(m.id===4){const automatic=new CityStateGraph().apply(m.packet).city;bindCityState(automatic);assert(automatic.characterGame.autonomous);assert(!controlledCitizen(automatic).playerControlled);worker.postMessage({type:'command',cityId:'character',id:5,path:'gameAction',args:['autonomy',{enabled:false}]});}
   else resolve(m.packet);
  }
 }catch(e){reject(e);}});});
 assert(compactControl,'Movement must use compact control messages');
 const restored=new CityStateGraph().apply(saved).city;bindCityState(restored);assert.equal(controlledCitizen(restored).inventory.madeira,1);assert.equal(restored.playerGroundItems[0].properties.item.quantity,1);assert.equal(restored.playerGroundItems[0].properties.playerItem.good,'madeira');assert.equal(restored.characterGame.mode,'play');assert.equal(restored.characterGame.input.x,1);assert(controlledCitizen(restored).playerControlled);const x=controlledCitizen(restored).entity.x;restored.update(.1);assert(controlledCitizen(restored).entity.x>x);assert(restored.gameAction('simulation'));assert(!controlledCitizen(restored).playerControlled);
});
