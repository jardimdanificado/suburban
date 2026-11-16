import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {canControl} from '../js/character_game.js';
function fixture(){
 const city=setup({starter:true,population:24}),c=city.citizens.find(c=>canControl(city,c)),other=city.citizens.find(p=>p!==c);
 assert(city.gameAction('start',{citizenId:c.id}));c.indoorLocation=null;other.indoorLocation=null;other.playerControlled=true;other.task=null;other.path=[];
 Object.assign(c.entity,{x:5.5,y:5.5});Object.assign(other.entity,{x:12.5,y:5.5});return {city,c,other};
}
test('a distant context action walks through real terrain before starting a conversation',()=>{
 const {city,c,other}=fixture();assert(city.gameAction('approach-interact',{kind:'person',targetId:other.id,choice:'talk'}));assert.equal(city.characterGame.intent.kind,'approach');assert(c.path.length);assert.equal(c.entity.x,5.5);
 for(let i=0;i<200&&city.characterGame.intent?.kind==='approach';i++)city.update(.1);
 assert.equal(city.characterGame.intent?.kind,'talk');assert(Math.hypot(c.entity.x-other.entity.x,c.entity.y-other.entity.y)<=1.8);
});
test('approach follows a moving target and attack executes only after reaching it',()=>{
 const {city,c,other}=fixture();assert(city.gameAction('approach-interact',{kind:'person',targetId:other.id,choice:'attack'}));assert.equal(city.characterGame.nextAttackAt,undefined);other.entity.x+=3;
 for(let i=0;i<250&&city.characterGame.intent?.kind==='approach';i++)city.update(.1);
 assert(city.characterGame.nextAttackAt>0);assert(Math.hypot(c.entity.x-other.entity.x,c.entity.y-other.entity.y)<=1.6);
});
test('stopping, manual movement or losing the target cancels pending context actions',()=>{
 for(const action of ['stop','input','destroy']){
  const {city,other}=fixture();assert(city.gameAction('approach-interact',{kind:'person',targetId:other.id,choice:'talk'}));
  if(action==='destroy')other.entity.destroyed=true;else assert(city.gameAction(action,action==='input'?{x:1,y:0}:{}));
  for(let i=0;i<20&&city.characterGame.intent?.kind==='approach';i++)city.update(.1);assert.notEqual(city.characterGame.intent?.kind,'approach',action);assert.notEqual(city.characterGame.intent?.kind,'talk');
 }
});

test('context purchases revalidate stock after walking and preserve the requested quantity through a snapshot',async()=>{
 const {city,c}=fixture(),b=city.buildings.find(b=>b.type==='townhall');b.inventory.madeira=5;c.inventory.madeira=0;c.balance=20000;Object.assign(c.entity,{x:b.door.x+6,y:b.door.y});
 assert(city.gameAction('approach-interact',{kind:'building',targetId:b.id,choice:'buy:madeira',values:{context:true,quantity:3}}),city.lastError);assert.equal(city.characterGame.intent.kind,'approach');assert.equal(b.inventory.madeira,5);
 const {CityStateGraph,bindCityState}=await import('../js/city_state.js'),mirror=new CityStateGraph().apply(new CityStateGraph().encode({city})).city;mirror.world=city.world;bindCityState(mirror);assert.equal(mirror.characterGame.intent.interactionValues.quantity,3);const person=mirror.society.citizen(c.id),shop=mirror.building(b.id),cash=person.balance;shop.inventory.madeira=0;person.path=[];Object.assign(person.entity,shop.door);
 const {characterMinute}=await import('../js/character_game.js');characterMinute(mirror,person);assert.equal(person.balance,cash);assert.equal(person.inventory.madeira,0);assert.equal(mirror.characterGame.intent,null);
 assert(!city.gameAction('approach-interact',{kind:'building',targetId:b.id,choice:'buy:madeira',values:{context:true,quantity:-3}}));
});

test('gifts and dropped items use contextual approach rather than remote inventory transfers',async()=>{
 const {city,c,other}=fixture();c.inventory.madeira=2;const cash=c.balance;
 assert(city.gameAction('approach-interact',{kind:'person',targetId:other.id,choice:'gift:madeira',values:{context:true,quantity:1}}),city.lastError);assert.equal(c.inventory.madeira,2);
 const {characterMinute}=await import('../js/character_game.js');c.path=[];Object.assign(c.entity,{x:other.entity.x,y:other.entity.y});characterMinute(city,c);assert.equal(c.inventory.madeira,1);assert.equal(other.inventory.madeira,1);assert.equal(c.balance,cash);
 assert(city.gameAction('drop-good',{good:'madeira',quantity:1}));const item=city.playerGroundItems[0];c.entity.x+=5;
 assert(city.gameAction('approach-interact',{kind:'object',targetId:item.id,choice:'pickup',values:{context:true,quantity:1}}));assert.equal(c.inventory.madeira,0);c.path=[];Object.assign(c.entity,{x:item.x,y:item.y});characterMinute(city,c);assert.equal(c.inventory.madeira,1);assert(item.destroyed);
});
