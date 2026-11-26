import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney} from './helpers/city.mjs';
import {tourismHourly} from '../js/city_external_trade.js';
import {setEconomicPolicy} from '../js/city_economic_policies.js';
import {ensureExternalAccount} from '../js/city_currency.js';

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

test('tourismHourly brings external revenue, collects tourism tax and consumes real stock',()=>{
 const city=setup({starter:true,funded:true,population:64});
 setEconomicPolicy(city,'tourismTaxRate',.1);
 const owner=city.citizens.find(c=>!c.entity.destroyed&&city.society.isAdult(c));
 const pottery=addBusiness(city,'pottery',owner);
 pottery.inventory.ceramica=6;
 const rental=addBusiness(city,'bicycle_rental',owner);
 city.minute=Math.floor(city.minute/1440)*1440+14*60;
 const potteryBefore=pottery.balance,rentalBefore=rental.balance,treasuryBefore=city.treasury,supplyBefore=totalMoney(city);
 const served=tourismHourly(city);
 assert(served>=2);
 assert(pottery.inventory.ceramica<6);
 assert(pottery.balance>potteryBefore);
 assert(rental.balance>rentalBefore);
 assert(city.treasury>treasuryBefore);
 assert.equal(totalMoney(city),city.currency.netIssued());
 assert(totalMoney(city)>supplyBefore);

 city.minute=Math.floor(city.minute/1440)*1440+22*60;
 assert.equal(tourismHourly(city),0);
});

test('social surplus dividend distributes excess treasury above reserve to low-asset adults once per day',()=>{
 const city=setup({starter:true,funded:true,population:64});
 setEconomicPolicy(city,'socialDividendShare',.2);
 const reserve=city.fiscal.reserve(),targetTreasury=Math.ceil(reserve*2.2);
 ensureExternalAccount(city,'supplier','Economia externa');
 if(city.treasury<targetTreasury)city.transfer('supplier','treasury',targetTreasury-city.treasury,'Superávit externo teste');
 const poorest=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)).sort((a,b)=>a.balance-b.balance)[0];
 city.transfer(poorest.accountId,'treasury',poorest.balance,'Zerar caixa teste dividendo');
 const paid=city.welfare.distributeSurplusDividend();
 assert(paid>0);
 assert(poorest.balance>0);
 assert(city.treasury>=Math.ceil(reserve*1.25));
 assert.equal(city.welfare.distributeSurplusDividend(),0);
 assert.equal(totalMoney(city),city.currency.netIssued());
});
