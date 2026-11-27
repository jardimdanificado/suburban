import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney} from './helpers/city.mjs';
import {externalTradeHourly} from '../js/city_external_trade.js';
import {setEconomicPolicy} from '../js/city_economic_policies.js';
import {initializeEquity} from '../js/city_equity.js';
import {CURRENCY_RULES} from '../js/city_currency.js';

function addBusiness(city,type,owner=null){
 for(const site of city.economy.locateBuilding(type)){
  const b=city.addBuilding(type,site.x,site.y,{...site,free:true,instant:true});
  if(b){
   if(!b.active)city.economy.activateMunicipalBusiness(b,0);
   if(owner){b.municipal=false;b.ownerId=owner.id;}
   return b;
  }
 }
 throw Error(`No site for ${type}`);
}

test('finished goods export above minimum reserve without re-exporting imports',()=>{
 const city=setup({starter:true,funded:true,population:64});
 const owner=city.citizens.find(c=>!c.entity.destroyed&&city.society.isAdult(c));
 const furnitureMaker=addBusiness(city,'furniture',owner);
 const tailor=addBusiness(city,'tailor',owner);
 furnitureMaker.inventory.moveis=8;
 tailor.inventory.roupas=8;
 tailor.importedUnitPrice={roupas:100};
 const beforeCash=furnitureMaker.balance,beforeSupply=totalMoney(city);
 const sales=externalTradeHourly(city);
 assert(sales>=1);
 assert.equal(furnitureMaker.inventory.moveis,4);
 assert(furnitureMaker.balance>beforeCash);
 assert.equal(tailor.inventory.roupas,8);
 assert.equal(totalMoney(city),city.currency.netIssued());
 assert(totalMoney(city)>beforeSupply);
});

test('PLR distributes share of profits to active workers in private and equity firms',()=>{
 const city=setup({starter:true,funded:true,population:64});
 setEconomicPolicy(city,'profitSharingRate',.25);
 setEconomicPolicy(city,'dividendPayout',.4);
 const workers=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)&&!c.businessIds.length).slice(0,2);
 const b1=addBusiness(city,'bakery',workers[0]);
 b1.workers=[workers[1].id];
 b1.totalRevenue=200000;
 b1.totalExpenses=0;
 b1.dividends=0;
 city.transfer('treasury',b1.accountId,200000,'Capital teste PLR');
 const w1Before=workers[1].balance;

 const b2=addBusiness(city,'furniture',workers[0]);
 initializeEquity(city,b2);
 b2.workers=[workers[1].id];
 b2.totalRevenue=200000;
 b2.totalExpenses=0;
 b2.dividends=0;
 city.transfer('treasury',b2.accountId,200000,'Capital teste PLR ações');

 city.economy.daily();
 assert(workers[1].balance>w1Before);
 assert(workers[1].fiscalIncome?.income>0);
 assert.equal(totalMoney(city),city.currency.netIssued());
});

test('popular refectory buys local retail food before ordering external imports',()=>{
 const city=setup({starter:true,funded:true,population:64});
 const store=city.buildings.find(b=>b.type==='popular_refectory'&&b.active&&!b.entity.destroyed)||city.buildings.find(b=>b.type==='townhall'&&b.active&&!b.entity.destroyed);
 assert(store);
 for(const b of city.economy.businesses){
  for(const good of Object.keys(b.inventory||{}))b.inventory[good]=0;
 }
 for(const good of Object.keys(store.inventory||{}))store.inventory[good]=0;
 const market=city.economy.businesses.find(b=>b.type==='market'&&b.active&&!b.entity.destroyed)||addBusiness(city,'market',city.citizens[0]);
 market.inventoryCapacity=Math.max(market.inventoryCapacity||0,2000);
 market.inventory.arroz=1200;
 if(market.importedUnitPrice)delete market.importedUnitPrice.arroz;
 const importsBefore=city.economy.externalTrade?.imports||0;
 city.economy.refillPopularRefectory();
 assert(market.inventory.arroz<1200);
 assert(city.logistics.shipments.some(s=>s.seller===market&&s.buyer===store&&s.good==='arroz'));
 assert.equal(city.economy.externalTrade?.imports||0,importsBefore);
});

test('initial money supply scales with population and gives citizens starting cash',()=>{
 const small=setup({starter:true,population:64});
 const large=setup({starter:true,population:120});
 assert(large.currency.issued>small.currency.issued);
 assert(small.citizens.every(c=>c.balance>=CURRENCY_RULES.citizenGrant));
 assert(CURRENCY_RULES.citizenGrant>0);
 small.currency.daily();
 large.currency.daily();
 assert.equal(Math.round(large.currency.priceIndex*100)/100,1);
 assert.equal(totalMoney(small),small.currency.netIssued());
 assert.equal(totalMoney(large),large.currency.netIssued());
});
