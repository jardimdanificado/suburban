import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {businessFloors} from '../js/city_business_heights.js';

test('business heights vary by plot while extraction and agriculture remain on the ground',()=>{
 assert.deepEqual(new Set(Array.from({length:100},(_,i)=>businessFloors('bakery',i))),new Set([1,2,3]));
 for(const type of ['farm','quarry','iron_mine','herb_farm','dairy_farm'])for(let i=0;i<20;i++)assert.equal(businessFloors(type,i),1);
});
test('initial whole-building businesses have working floors, storage and extra jobs',()=>{
 const city=setup({starter:true,population:128});
 const tower=city.buildings.find(b=>b.type==='office_tower');assert(tower.floors>1);
 assert(tower.units.some(u=>u.z===tower.floors-1&&u.roomType==='workspace'));
 assert.equal(tower.jobs,0);assert(tower.inventoryCapacity>=tower.width*tower.depth*tower.floors*16);
 const quarry=city.buildings.find(b=>b.type==='quarry');assert.equal(quarry.floors,1);
});
test('service construction budgets scale with the planned number of floors',()=>{
 const city=setup({starter:true,population:64,funded:true}), investment=city.economy.serviceInvestment;
 const lot=investment.lots('cleaner').find(p=>businessFloors('cleaner',p.id)>1);assert(lot);
 const plan=investment.plan('cleaner',lot);assert.equal(plan.stone,18*plan.floors);assert.equal(plan.fee,city.currency.price(9*12000*plan.floors));
});
