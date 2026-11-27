import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney} from './helpers/city.mjs';
import {tourismHourly,externalTradeHourly} from '../js/city_external_trade.js';
import {setEconomicPolicy} from '../js/city_economic_policies.js';
import {ensureExternalAccount} from '../js/city_currency.js';
import {buildingActivityProfile} from '../js/city_building_activity_profiles.js';
import {barMusicPlan,BAR_MUSIC_MAX_SPEED} from '../js/spatial_audio.js';

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

test('new tourism, entertainment and value-added business types register profiles, nightlife and exports',()=>{
 const city=setup({starter:true,funded:true,population:64});
 const newTypes=['juice_bar','petiscaria','brewery','shoemaker','jeweler','hotel','bar','casino','show_house','gym','repair_shop'];
 for(const type of newTypes){
  assert(city.buildingTypes[type],`Missing buildingType ${type}`);
  assert(buildingActivityProfile(type),`Missing activityProfile ${type}`);
 }
 const owner=city.citizens.find(c=>!c.entity.destroyed&&city.society.isAdult(c));
 const hotel=addBusiness(city,'hotel',owner);
 const casino=addBusiness(city,'casino',owner);
 const bar=addBusiness(city,'bar',owner);
 bar.inventory.cerveja=6;
 const shoemaker=addBusiness(city,'shoemaker',owner);
 shoemaker.inventory.calcados=8;
 city.minute=Math.floor(city.minute/1440)*1440+22*60;
 const hotelBefore=hotel.balance,casinoBefore=casino.balance,barBefore=bar.balance;
 const servedNight=tourismHourly(city);
 assert(servedNight>=3);
 assert(hotel.balance>hotelBefore);
 assert(casino.balance>casinoBefore);
 assert(bar.balance>barBefore);
 assert(bar.inventory.cerveja<6);
 const sales=externalTradeHourly(city);
 assert(sales>=1);
 assert.equal(shoemaker.inventory.calcados,4);
 assert.equal(totalMoney(city),city.currency.netIssued());
});

test('bars stock and serve legalized substances while blocking prohibited ones',()=>{
 const city=setup({starter:true,funded:true,population:64});
 const owner=city.citizens.find(c=>!c.entity.destroyed&&city.society.isAdult(c));
 const patron=city.citizens.find(c=>!c.entity.destroyed&&city.society.isAdult(c)&&c.id!==owner.id);
 const bar=addBusiness(city,'bar',owner);
 bar.inventory.cannabis=5;
 city.substances.setLaw('cannabis','prohibited',0);
 assert.equal(city.economy.accepts(bar,'cannabis'),false);
 assert.equal(city.substances.barMenuGoods().includes('cannabis'),false);

 city.substances.setLaw('cannabis','free',0);
 assert.equal(city.economy.accepts(bar,'cannabis'),true);
 assert.equal(city.substances.barMenuGoods().includes('cannabis'),true);
 city.minute=Math.floor(city.minute/1440)*1440+19*60;
 patron.barVisit={buildingId:bar.id,startedAt:city.minute,until:city.minute+60,lastDrinkAt:-Infinity,position:{...bar.door}};
 const state=city.substances.initialize(patron);
 state.uses.cannabis.potential=true;
 state.uses.cannabis.liking=.8;
 city.transfer('treasury',patron.accountId,10000,'Saldo teste bar');
 const barBefore=bar.balance;
 assert.equal(city.substances.serveAtBar(patron,bar),true);
 assert.equal(bar.inventory.cannabis,4);
 assert(bar.balance>barBefore);
 assert.equal(patron.lastSubstanceUse?.id,'cannabis');
 assert.equal(totalMoney(city),city.currency.netIssued());
});

test('barMusicPlan plays near open bars at normal speed and fades out on fast forward',()=>{
 const city=setup({starter:true,funded:true,population:64});
 const owner=city.citizens.find(c=>!c.entity.destroyed&&city.society.isAdult(c));
 const bar=addBusiness(city,'bar',owner);
 const listener={x:bar.door.x+2,z:bar.door.y+2};
 city.minute=Math.floor(city.minute/1440)*1440+20*60;
 const normal=barMusicPlan({city,listener,speed:1,altitude:0});
 assert.equal(normal.length,1);
 assert.equal(normal[0].buildingId,bar.id);
 const fast=barMusicPlan({city,listener,speed:6,altitude:0});
 assert.equal(fast.length,1);
 assert(fast[0].gain<normal[0].gain);
 assert.equal(barMusicPlan({city,listener,speed:BAR_MUSIC_MAX_SPEED+1,altitude:0}).length,0);
 city.minute=Math.floor(city.minute/1440)*1440+10*60;
 assert.equal(barMusicPlan({city,listener,speed:1,altitude:0}).length,0);
});
