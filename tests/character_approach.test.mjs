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
