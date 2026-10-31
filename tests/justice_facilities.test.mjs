import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';

test('justice facilities retry hourly when a case appears after the day’s first planning check',()=>{
  const city=setup({starter:true,population:48}),justice=city.justice;
  justice.planFacilities();
  assert.equal(city.development.projects.some(p=>p.type==='police_station'),false);
  justice.cases.push({id:900,type:'theft',status:'reported',rule:{fineOnly:false},evidence:[]});
  city.minute=9*60;
  justice.planFacilities();
  assert.ok(city.development.projects.some(p=>p.type==='police_station'&&!p.cancelled));
});

test('justice planning retries a blocked facility after funding recovers later the same day',()=>{
  const city=setup({starter:true,population:48}),justice=city.justice;
  city.accounts.set('test-reserves',{balance:0,name:'Test reserves'});
  city.transfer('treasury','test-reserves',city.treasury-city.fiscal.reserve(),'Teste sem excedente municipal');
  justice.cases.push({id:901,type:'assault',status:'reported',rule:{fineOnly:false},evidence:[]});
  city.minute=8*60;justice.planFacilities();
  assert.equal(city.development.projects.some(p=>p.type==='police_station'),false);
  city.transfer('test-reserves','treasury',city.accounts.get('test-reserves').balance,'Teste de recuperação de caixa');city.minute=9*60;justice.planFacilities();
  assert.ok(city.development.projects.some(p=>p.type==='police_station'&&!p.cancelled));
});
