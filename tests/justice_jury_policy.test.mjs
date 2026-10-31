import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';

test('the chamber can set the jury size within the population-based legal range',()=>{
  const city=setup({starter:true,population:48}),bounds=city.justice.popularJuryBounds();
  assert.deepEqual(bounds,{minimum:5,maximum:7,population:48});
  const bill=city.politics.submitBill('popularJurySize',{value:6});
  assert.equal(bill.type,'popularJurySize');
  bill.status='approved';city.politics.council.execute(bill);
  assert.equal(bill.status,'executed');assert.equal(city.justice.policies.popularJurySize,6);
  const jury=city.justice.selectPopularJury({chargedCitizenId:city.citizens[0].id});
  assert.equal(jury.memberIds.length,6);assert.equal(jury.required,6);
  assert.equal(city.politics.submitBill('popularJurySize',{value:4}),null);
  assert.equal(city.politics.submitBill('popularJurySize',{value:8}),null);
});

test('a city below 100 people still requires at least five jurors',()=>{
  const city=setup({starter:true,population:48});
  city.citizens.splice(10);
  assert.deepEqual(city.justice.popularJuryBounds(),{minimum:5,maximum:5,population:10});
});
