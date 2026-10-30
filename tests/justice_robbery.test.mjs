import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';

function fixture(){
  const people=[1,2].map(id=>({id,accountId:`citizen:${id}`,entity:{x:2,y:2,properties:{name:`Pessoa ${id}`}},inventory:{},needs:{health:90,food:60},traits:{honesty:id===1?.05:.9,riskTolerance:id===1?.95:.2,ambition:.8},socialProfile:{temper:id===1?.9:.2},skills:{combat:0}}));
  const accounts=new Map([[people[0].accountId,{balance:1000}],[people[1].accountId,{balance:2500}]]);
  const city={minute:2000,hour:22,world:{cityLampPosts:[]},citizens:people,accounts,buildings:[],society:{citizen:id=>people.find(c=>c.id===id),isAdult:()=>true,getRelation:()=>({views:{1:{resentment:80}}})},economy:{goods:{},practice(){}},currency:{price:n=>n},random:()=>.99,log:()=>({id:1}),transfer(from,to,amount){if(!accounts.has(from)||!accounts.has(to)||amount<=0||accounts.get(from).balance<amount)return false;accounts.get(from).balance-=amount;accounts.get(to).balance+=amount;return true;}};
  const justice=new CityJustice(city);return {city,justice,actor:people[0],victim:people[1],money:()=>[...accounts.values()].reduce((n,a)=>n+a.balance,0)};
}

test('violent robbery transfers only existing money and records the assault and robbery separately',()=>{
  const {city,justice,actor,victim,money}=fixture(),before=money();
  const record=justice.attemptRobbery(actor,victim,{amount:800});
  assert.ok(record);assert.equal(record.type,'robbery');assert.equal(record.offenderId,actor.id);assert.equal(record.victimId,victim.id);
  assert.equal(city.accounts.get(actor.accountId).balance,1800);assert.equal(city.accounts.get(victim.accountId).balance,1700);assert.equal(money(),before);
  assert.equal(record.stolenAsset.amount,800);assert.equal(record.stolenAsset.holderId,actor.id);
  const assault=justice.cases.find(c=>c.type==='assault');assert.ok(assault);assert.equal(record.details.parentEventId,assault.eventId);assert.ok(victim.combatInjuries.length);
});

test('robbery refuses distant, separated, underfunded, or minor participants before combat',()=>{
  const {city,justice,actor,victim}=fixture();
  victim.entity.x=5;assert.equal(justice.attemptRobbery(actor,victim),false);assert.equal(victim.needs.health,90);victim.entity.x=2;
  actor.indoorLocation={buildingId:8,unitId:1};victim.indoorLocation={buildingId:8,unitId:2};assert.equal(justice.attemptRobbery(actor,victim),false);assert.equal(victim.needs.health,90);actor.indoorLocation=null;victim.indoorLocation=null;
  city.accounts.get(victim.accountId).balance=0;assert.equal(justice.attemptRobbery(actor,victim),false);assert.equal(victim.needs.health,90);
  city.accounts.get(victim.accountId).balance=2500;city.society.isAdult=c=>c!==actor;assert.equal(justice.attemptRobbery(actor,victim),false);assert.equal(victim.needs.health,90);
});

test('autonomous violent robbery requires darkness, high temper and resentment and retains rare opportunity odds',()=>{
  const {city,justice,actor,victim}=fixture();city.random=()=>.99;
  assert.equal(justice.considerTheft(actor,victim),false);
  assert.equal(justice.cases.some(c=>c.type==='robbery'),false);
  actor.lastTheftAttemptAt=0;city.hour=12;assert.equal(justice.considerTheft(actor,victim),false);
  actor.lastTheftAttemptAt=0;city.hour=22;actor.socialProfile.temper=.2;assert.equal(justice.considerTheft(actor,victim),false);
  actor.lastTheftAttemptAt=0;actor.socialProfile.temper=.9;let rolls=[0,0,.99,.99,.99,.99,.99];city.random=()=>rolls.shift()??.99;
  assert.ok(justice.considerTheft(actor,victim));assert.ok(justice.cases.some(c=>c.type==='robbery'));
});
