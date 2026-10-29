import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {CityStateGraph} from '../js/city_state.js?v=sync-perf-1';

test('compact ledger faithfully synchronizes appends, trimming, replacement and optional fields',()=>{
 const city=setup({starter:true,population:24}),root={city},source=new CityStateGraph(),mirror=new CityStateGraph();
 const sync=()=>mirror.apply(structuredClone(source.encode(root))).city;
 city.ledger.length=0;let view=sync();assert.deepEqual(view.ledger,[]);
 const a=Object.freeze({minute:1,from:'@a',to:'b',amount:12,reason:'salário',eventId:null});
 const b=Object.freeze({minute:2,from:'b',to:'c',amount:5,reason:'teste'});
 city.ledger.push(a,b);view=sync();assert.deepEqual(view.ledger,city.ledger);assert(Object.isFrozen(view.ledger[0]));
 city.ledger.shift();city.ledger.push(Object.freeze({minute:3,from:'x',to:'y',amount:8,reason:'outro',eventId:3}));view=sync();assert.deepEqual(view.ledger,city.ledger);
 city.ledger.splice(0,city.ledger.length,Object.freeze({minute:4,from:'m',to:'n',amount:9,reason:'substituído'}));view=sync();assert.deepEqual(view.ledger,city.ledger);
 city.ledger.length=0;view=sync();assert.deepEqual(view.ledger,[]);
});
test('compact immutable social memories keep their exact fields and string contents',()=>{
 const city=setup({starter:true,population:24}),c=city.citizens[0];
 c.testMemory=Object.freeze({salience:1,factId:2,eventId:3,kind:'@memória',actorId:1,targetId:2,otherId:2,minute:3,description:'@relato',firsthand:true,truth:true,impact:4});
 const graph=new CityStateGraph(),mirror=new CityStateGraph(),copy=mirror.apply(structuredClone(graph.encode({city})));
 assert.deepEqual(copy.city.citizens[0].testMemory,c.testMemory);assert(Object.isFrozen(copy.city.citizens[0].testMemory));
});
