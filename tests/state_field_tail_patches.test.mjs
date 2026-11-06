import test from 'node:test';
import assert from 'node:assert/strict';
import {CityStateGraph} from '../js/city_state.js';
import {CitySimulationBridge} from '../js/city_sim_bridge.js';
import {setup} from './helpers/city.mjs';

function pair(){
 const subject=Object.fromEntries(Array.from({length:16},(_,i)=>[`field${i}`,i]));
 const root={city:{world:{map:new Uint8Array(4),revision:0},citizens:[],events:[],ledger:[]},subject};
 const source=new CityStateGraph(),mirror=new CityStateGraph();
 const view=mirror.apply(structuredClone(source.encode(root)));
 const sync=(options={fieldTailPatches:true})=>{const packet=structuredClone(source.encode(root,options));mirror.apply(packet);return packet.nodes.find(n=>n.id===source.ids.get(subject));};
 return{subject,root,view,source,mirror,sync};
}
test('schema patches preserve changed prefix values, appended fields and exact field order',()=>{
 const p=pair();p.subject.field0='@literal';p.subject.appended={name:'new child'};
 const node=p.sync();assert.equal(node.tailPatch,true);assert.equal(p.view.subject.field0,'@literal');
 assert.deepEqual(p.view.subject,p.subject);assert.deepEqual(Object.keys(p.view.subject),Object.keys(p.subject));
 p.subject.field2=55;p.sync();assert.deepEqual(p.view.subject,p.subject);
});
test('shrinking and reordering a suffix preserves values and removes obsolete properties',()=>{
 const p=pair();delete p.subject.field12;delete p.subject.field13;p.subject.field12=123;
 assert.equal(p.sync().tailPatch,true);assert.deepEqual(Object.keys(p.view.subject),Object.keys(p.subject));assert.deepEqual(p.view.subject,p.subject);
 delete p.subject.field12;delete p.subject.field15;assert.equal(p.sync().tailPatch,true);assert.deepEqual(p.view.subject,p.subject);
});
test('cycles, shared references and local callbacks survive schema changes and re-encoding',()=>{
 const p=pair();p.subject.self=p.subject;p.subject.alias=p.root.city;p.sync();
 assert.equal(p.view.subject.self,p.view.subject);assert.equal(p.view.subject.alias,p.view.city);
 const callback=()=>true;p.view.subject.localCallback=callback;
 p.subject.field1={owner:p.subject};p.subject.newValue='@x';assert.equal(p.sync().tailPatch,true);
 assert.equal(p.view.subject.localCallback,callback);assert.equal(p.view.subject.field1.owner,p.view.subject);
 delete p.view.subject.localCallback;
 p.view.subject.fromMirror={reference:p.view.subject};
 p.source.apply(structuredClone(p.mirror.encode(p.view,{fieldTailPatches:true})));
 assert.equal(p.root.subject.fromMirror.reference,p.root.subject);
 assert.deepEqual(p.view,p.root);
});
test('legacy mode sends complete schema changes and can alternate with compact packets',()=>{
 const p=pair();p.subject.first='legacy';assert.ok(!p.sync({}).tailPatch);
 p.subject.second='compact';assert.equal(p.sync().tailPatch,true);
 delete p.subject.second;p.subject.field0=33;assert.ok(!p.sync({fieldTailPatches:false}).tailPatch);
 assert.deepEqual(p.view.subject,p.subject);
});
test('new schema nodes use complete records and compact updates require a known baseline',()=>{
 const p=pair();p.root.extra={a:1,b:2};const packet=structuredClone(p.source.encode(p.root,{fieldTailPatches:true}));
 assert.ok(!packet.nodes.find(n=>n.id===p.source.ids.get(p.root.extra)).tailPatch);p.mirror.apply(packet);
 p.subject.appended=1;const delta=structuredClone(p.source.encode(p.root,{fieldTailPatches:true}));
 assert.throws(()=>new CityStateGraph().apply(delta),/estado inicial/);
});
test('worker initialization advertises only the graph feature supported by the active reader',()=>{
 const oldWorker=globalThis.Worker,messages=[];let bridge;
 globalThis.Worker=class{postMessage(message){messages.push(message);}terminate(){}};
 try{
  const city=setup({starter:true,population:2});
  bridge=new CitySimulationBridge({city,entities:city.citizens.map(c=>c.entity),nextId:9999,time:{paused:false},changed(){},notice(){}});
  assert.equal(messages[0].type,'init');assert.equal(messages[0].stateFeatures.fieldTailPatches,true);assert.equal(bridge.graph.supportsFieldTailPatches,true);
 }finally{for(const restore of bridge?.restores||[])restore();if(oldWorker===undefined)delete globalThis.Worker;else globalThis.Worker=oldWorker;}
});
