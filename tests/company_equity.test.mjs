import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney} from './helpers/city.mjs';
import {equityShares,equityValue,offerShares,buyShares,distributeShareDividends,inheritShares,tradeSharesHourly} from '../js/city_equity.js';
import {wealthReport} from '../js/city_wealth.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';

test('partial municipal sale transfers real money and ownership while preserving public control',()=>{
 const city=setup({starter:true,funded:true,population:64}),b=city.economy.businesses.find(b=>b.municipal&&b.type==='builder'),buyer=city.citizens.find(c=>!city.politics.officeHolder(c)&&c.balance>1000);assert(b&&buyer);const total=totalMoney(city),valuation=equityValue(city,b),treasury=city.treasury;const offer=offerShares(city,b,'treasury',2500);assert(offer,city.lastError);const sale=buyShares(city,b,offer.id,buyer.accountId,1000);assert(sale,city.lastError);assert.equal(sale.price,Math.ceil(valuation*.1));assert.equal(city.treasury,treasury+sale.price);assert.equal(totalMoney(city),total);assert.equal(b.equityShares.reduce((n,s)=>n+s.points,0),10000);assert.equal(b.municipal,true);assert.equal(b.ownerId,null);assert.equal(b.units[0].ownerId,b.accountId);assert.equal(offer.remaining,1500);
 const report=wealthReport(city);assert.equal(report.control.get(b.accountId).find(x=>x.id===buyer.accountId).share,.1);
});

test('shares cannot be oversold and distributions go to each owner proportionally',()=>{
 const city=setup({starter:true,funded:true,population:64}),b=city.economy.businesses.find(b=>b.municipal&&b.type==='builder'),buyer=city.citizens.find(c=>!city.politics.officeHolder(c)&&c.balance>1000),offer=offerShares(city,b,'treasury',2500);assert(buyShares(city,b,offer.id,buyer.accountId,2500));assert.equal(offerShares(city,b,'treasury',8000),null);assert.equal(buyShares(city,b,offer.id,buyer.accountId,1),null);
 city.transfer('treasury',b.accountId,city.currency.price(1000000),'Test capital');b.totalRevenue+=city.currency.price(1000000);const beforeTreasury=city.treasury,beforeBuyer=buyer.balance,paid=distributeShareDividends(city,b);assert(paid>0);assert(Math.abs((city.treasury-beforeTreasury)/paid-.75)<.01);assert(Math.abs((buyer.balance-beforeBuyer)/paid-.25)<.01);
});

test('private investors buy open shares over time and shares survive worker snapshots',()=>{
 const city=setup({starter:true,funded:true,population:64}),b=city.economy.businesses.find(b=>b.municipal&&b.type==='builder'),offer=offerShares(city,b,'treasury',1000),before=offer.remaining;tradeSharesHourly(city);assert(offer.remaining<before);const graph=new CityStateGraph(),mirror=new CityStateGraph().apply(graph.encode({city})).city;bindCityState(mirror);assert.deepEqual(equityShares(mirror,mirror.building(b.id)),b.equityShares);assert.equal(mirror.building(b.id).shareOffers[0].remaining,offer.remaining);
});

test('a shareholder death transfers shares and preserves the operating business',()=>{
 const city=setup({starter:true,funded:true,population:64}),b=city.economy.businesses.find(b=>b.municipal&&b.type==='builder'),[buyer,heir]=city.citizens.filter(c=>!city.politics.officeHolder(c)&&c.balance>1000),offer=offerShares(city,b,'treasury',1000);assert(buyShares(city,b,offer.id,buyer.accountId,1000));inheritShares(city,buyer,heir);assert(!b.equityShares.some(s=>s.accountId===buyer.accountId));assert.equal(b.equityShares.find(s=>s.accountId===heir.accountId).points,1000);assert(b.active);
});

test('council partial privatization creates an offer, not imaginary revenue',()=>{
 const city=setup({starter:true,funded:true,population:64}),p=city.politics,b=city.economy.businesses.find(b=>b.municipal&&b.type==='builder'),bill={id:900,payload:{buildingId:b.id,percent:25},attempts:1},before=city.treasury;assert.equal(p.council.transferFirm(bill,false),null);assert.equal(city.treasury,before);assert.equal(b.shareOffers[0].remaining,2500);assert.equal(bill.shareOfferId,b.shareOffers[0].id);
});

test('majority acquisition changes management and nationalization buys all shareholders',()=>{
 const city=setup({starter:true,funded:true,population:64}),b=city.economy.businesses.find(b=>b.municipal&&b.type==='builder'),buyer=city.citizens.find(c=>!city.politics.officeHolder(c)&&c.balance>1000);city.transfer('treasury',buyer.accountId,city.currency.price(10000000),'Capital de teste');const offer=offerShares(city,b,'treasury',6000);assert(offer);assert(buyShares(city,b,offer.id,buyer.accountId,6000));assert.equal(b.ownerId,buyer.id);assert.equal(b.municipal,false);assert(buyer.businessIds.includes(b.id));const total=totalMoney(city),before=buyer.balance;city.welfare.policy.reserve=0;const result=city.politics.council.transferFirm({id:901,payload:{buildingId:b.id},attempts:1},true);assert.equal(result,null);assert.equal(b.ownerId,null);assert.equal(b.municipal,true);assert.equal(b.equityShares[0].points,10000);assert(buyer.balance>before);assert.equal(totalMoney(city),total);assert(!buyer.businessIds.includes(b.id));
});
