import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';

function fixture(){
  const people=[1,2,3].map(id=>({id,accountId:`citizen:${id}`,entity:{x:2,y:2,properties:{name:`Pessoa ${id}`}},inventory:{madeira:3},pocket:{food:[],water:0},needs:{health:90,food:60},traits:{honesty:.1,riskTolerance:.8,ambition:.8}}));
  const accounts=new Map(people.map(c=>[c.accountId,{balance:1000}]));const city={minute:2000,hour:22,world:{},citizens:people,accounts,buildings:[],society:{citizen:id=>people.find(c=>c.id===id),isAdult:()=>true},economy:{goods:{madeira:{}}},currency:{price:n=>n},random:()=>.99,log:()=>({id:1}),transfer(from,to,amount){if(!accounts.has(from)||!accounts.has(to)||amount<=0||accounts.get(from).balance<amount)return false;accounts.get(from).balance-=amount;accounts.get(to).balance+=amount;return true;}};
  return {justice:new CityJustice(city),city,actor:people[0],victim:people[1],innocent:people[2],money:()=>[...accounts.values()].reduce((n,a)=>n+a.balance,0)};
}

test('money theft is recorded and police recovery does not transfer it without physical delivery',()=>{
  const {justice,city,actor,victim,money}=fixture(),before=money(),record=justice.attemptTheft(actor,victim,{amount:150});assert.equal(city.accounts.get(actor.accountId).balance,1150);assert.equal(city.accounts.get(victim.accountId).balance,850);assert.equal(money(),before);
  assert.equal(justice.recoverStolenAsset(record,actor),false);assert.equal(justice.recoverStolenAsset(record,actor),false);assert.equal(record.stolenAsset.recoveryStatus,'awaiting-physical-return');assert.equal(money(),before);assert.equal(city.accounts.get(actor.accountId).balance,1150);
});

test('object theft transfers stock and recovery waits for police delivery instead of teleporting the item',()=>{
  const {justice,actor,victim}=fixture(),record=justice.attemptTheft(actor,victim,{kind:'item',good:'madeira',quantity:2});assert.equal(actor.inventory.madeira,5);assert.equal(victim.inventory.madeira,1);
  victim.entity.x=10;assert.equal(justice.recoverStolenAsset(record,actor),false);assert.equal(victim.inventory.madeira,1);victim.entity.x=2;assert.equal(justice.recoverStolenAsset(record,actor),false);assert.equal(record.stolenAsset.recoveryStatus,'awaiting-physical-return');assert.equal(actor.inventory.madeira,5);assert.equal(victim.inventory.madeira,1);
});

test('meal theft preserves the actual meal, ingredients and packing time',()=>{
  const {justice,actor,victim}=fixture(),meal={good:'marmita',inputs:{marmita:1},ingredients:{arroz:2},packedAt:123};victim.pocket.food.push(meal);const record=justice.attemptTheft(actor,victim,{kind:'meal'});
  assert.equal(victim.pocket.food.length,0);assert.equal(actor.pocket.food[0],meal);assert.equal(justice.recoverStolenAsset(record,actor),false);assert.equal(record.stolenAsset.recoveryStatus,'awaiting-physical-return');assert.equal(actor.pocket.food[0],meal);assert.equal(meal.packedAt,123);assert.deepEqual(meal.ingredients,{arroz:2});
});

test('consumed food cannot be recreated and innocent suspects have no stolen property seized',()=>{
  const {justice,actor,victim,innocent}=fixture();victim.pocket.food.push({inputs:{pao:1}});const record=justice.attemptTheft(actor,victim,{kind:'meal'});assert.equal(justice.recoverStolenAsset(record,innocent),false);actor.pocket.food.pop();assert.equal(justice.recoverStolenAsset(record,actor),false);assert.equal(victim.pocket.food.length,0);
});

test('different rooms, distant targets and insufficient stock prevent theft',()=>{
  const {justice,actor,victim,money}=fixture(),before=money();victim.entity.x=20;assert.equal(justice.attemptTheft(actor,victim),false);victim.entity.x=2;actor.indoorLocation={buildingId:5,unitId:1};victim.indoorLocation={buildingId:5,unitId:2};assert.equal(justice.attemptTheft(actor,victim),false);actor.indoorLocation=null;victim.indoorLocation=null;assert.equal(justice.attemptTheft(actor,victim,{kind:'item',good:'madeira',quantity:4}),false);assert.equal(money(),before);
});

test('dark opportunity can trigger an autonomous theft while honesty prevents it',()=>{
  const {justice,city,actor,victim}=fixture();city.random=()=>.05;assert.ok(justice.considerTheft(actor,victim));assert.equal(justice.considerTheft(actor,victim),false);actor.lastTheftAttemptAt=0;city.hour=12;assert.equal(justice.considerTheft(actor,victim),false);actor.lastTheftAttemptAt=0;city.hour=22;actor.traits.honesty=.9;assert.equal(justice.considerTheft(actor,victim),false);
});
