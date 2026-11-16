import test from 'node:test';
import assert from 'node:assert/strict';
import {graffitiMessage} from '../js/city_graffiti_text.js';
import {gerarFraseTematica} from '../js/gerador_frases.js';

function seeded(seed){let state=seed>>>0;return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}

test('graffiti uses the existing vocabulary grammar with the city random source',()=>{
  const citizen={homeUnitId:1,needs:{food:90,health:90}},random=seeded(123);
  const expected=gerarFraseTematica(['cidade'],{random:seeded(123),complexidade:'simples'});
  assert.equal(graffitiMessage({random},citizen),expected);
});

test('graffiti varies across seeds and stays deterministic when a city seed is restored',()=>{
  const citizen={homeUnitId:1},messages=Array.from({length:24},(_,seed)=>graffitiMessage({random:seeded(seed)},citizen));
  assert(new Set(messages).size>12);assert(messages.every(message=>message.trim().length>0&&message.length<=180));
  assert.deepEqual(messages,Array.from({length:24},(_,seed)=>graffitiMessage({random:seeded(seed)},citizen)));
});

test('protest vocabulary reflects known needs and preserves the named target within the text limit',()=>{
  const citizen={homeUnitId:null,needs:{food:20,health:20}},targetName='Prefeitura';
  const expected=gerarFraseTematica(['cidade','moradia','alimentacao','saude','politica'],{random:seeded(9),complexidade:'simples'});
  const message=graffitiMessage({random:seeded(9)},citizen,{protest:true,targetName});
  assert.equal(message,`${expected} · ${targetName}`);assert(message.length<=180);
  const long=graffitiMessage({random:seeded(9)},citizen,{protest:true,targetName:'Alvo '.repeat(100)});
  assert(long.length<=180);assert(long.endsWith('Alvo '.repeat(100).trim().slice(0,60)));
});

function politicalFixture(memory=null){
 const target={id:9,political:{partyId:2},entity:{properties:{name:'Prefeito Fulano'}}};
 const c={homeUnitId:1,political:{partyId:1,memories:memory?[memory]:[]}};
 const city={random:()=>.1,politics:{parties:[{id:1,active:true,short:'PVA',number:23},{id:2,active:true,short:'PCC',number:45}],corruption:[{id:7,accusedId:9,proven:true}]},society:{citizen:id=>id===9?target:null}};
 return {city,c};
}

test('political graffiti includes the author party and its actual number',()=>{
 const {city,c}=politicalFixture();const message=graffitiMessage(city,c);
 assert.match(message,/PVA · 23$/);assert(message.length<=180);
 assert.doesNotMatch(message,/Fulano|ladrão|corrupto/,'undisclosed corruption must not leak into graffiti');
});

test('known proven corruption produces named accusations with the target party number',()=>{
 const {city,c}=politicalFixture({kind:'proven-scandal',candidateId:9,partyId:2,caseId:7});
 const message=graffitiMessage(city,c);assert.match(message,/Prefeito Fulano: ladrão · PCC 45$/);
 assert(message.length<=180);
});

test('heard corruption rumors stay accusations rather than magically becoming known proof',()=>{
 const {city,c}=politicalFixture({kind:'corruption-rumor',candidateId:9,partyId:2,caseId:7});
 assert.match(graffitiMessage(city,c),/Fulano: ladrão\?/);
});

test('negative political memories can produce directed insults without alleging theft',()=>{
 const {city,c}=politicalFixture({kind:'policy-reaction',candidateId:9,effect:-10});
 const message=graffitiMessage(city,c);assert.match(message,/Fulano: safado/);assert.doesNotMatch(message,/ladrão|corrupto/);
});
