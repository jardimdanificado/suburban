import test from 'node:test';
import assert from 'node:assert/strict';
import {governmentPerformance,recentBusinessRevenue} from '../js/city_government_performance.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
import {setup} from './helpers/city.mjs';

function performanceCity(minute,businesses){return {minute,day:Math.floor(minute/1440)+1,treasury:1000,fiscal:{report:()=>({reserve:100,cash:1000,operatingExpenses:100,operatingBalance:0})},economy:{businesses}};}
function firm(overrides={}){return {active:true,entity:{destroyed:false},workers:[1],totalRevenue:100,revenueHistory:[],...overrides};}

test('business productivity retains a cumulative fallback until a full 30-day window exists',()=>{
  const business=firm(),city=performanceCity(0,[business]);
  assert.equal(governmentPerformance(city).productiveCompanies,1);
  city.minute=30*1440-1;assert.equal(governmentPerformance(city).revenueWindowReady,false);
  city.minute=30*1440;assert.equal(governmentPerformance(city).revenueWindowReady,true);
  assert.equal(governmentPerformance(city).productiveCompanies,0);
});

test('mature productivity counts staffed firms only when their revenue falls within the recent window',()=>{
  const active=firm({revenueHistory:[{day:2,amount:80},{day:15,amount:20}]}),unstaffed=firm({workers:[],revenueHistory:[{day:15,amount:100}]});
  const city=performanceCity(40*1440,[active,unstaffed]);city.businessRevenueTrackingStartedAt=0;
  const result=governmentPerformance(city);
  assert.equal(recentBusinessRevenue(city,active),20);assert.equal(result.productiveCompanies,1);assert.equal(result.companyProductivity,50);
});

test('business revenue tracking aggregates by day, bounds history, and survives worker snapshots',()=>{
  const city=setup({starter:true,population:24}),business=city.economy.businesses[0];
  city.minute=2*1440;const total=business.totalRevenue||0;
  assert.equal(city.recordBusinessRevenue(business,120),true);assert.equal(city.recordBusinessRevenue(business,80),true);
  assert.equal(business.totalRevenue,total+200);assert.deepEqual(business.revenueHistory.at(-1),{day:3,amount:200});
  city.minute=40*1440;city.recordBusinessRevenue(business,50);
  assert(business.revenueHistory.length<=33);assert.equal(recentBusinessRevenue(city,business),50);
  const sender=new CityStateGraph(),receiver=new CityStateGraph();
  const restored=receiver.apply(sender.encode({city})).city;bindCityState(restored);assert.deepEqual(restored.building(business.id).revenueHistory,business.revenueHistory);
});

