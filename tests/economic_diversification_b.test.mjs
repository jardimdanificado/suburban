import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney} from './helpers/city.mjs';
import {setEconomicPolicy} from '../js/city_economic_policies.js';
import {updateMarket} from '../js/city_markets.js';

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

test('productive microcredit serves informal/unemployed citizens and conserves money supply',()=>{
 const city=setup({starter:true,funded:true,population:64});
 setEconomicPolicy(city,'microcreditCap',12000);
 const bank=city.bank.available()[0];
 assert(bank);
 const citizen=city.citizens.find(c=>!c.entity.destroyed&&city.society.isAdult(c)&&!c.jobId&&!c.businessIds.length);
 assert(citizen);
 assert.equal(city.bank.lend(bank,citizen.accountId,5000),false);
 const before=citizen.balance,supply=totalMoney(city);
 const loan=city.bank.lendMicrocredit(bank,citizen.accountId,15000);
 assert(loan);
 assert.equal(loan.purpose,'microcredit');
 assert.equal(loan.principal,12000);
 assert.equal(citizen.balance,before+12000);
 assert.equal(totalMoney(city),supply);
});

test('street markets include farms and local workshops without requiring retail storefront',()=>{
 const city=setup({starter:true,funded:true,population:64});
 const adults=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c));
 const farm=addBusiness(city,'farm',adults[0]);
 farm.crop='milho';
 farm.inventory.milho=10;
 const tailor=addBusiness(city,'tailor',adults[1]);
 tailor.inventory.roupas=6;
 city.minute=Math.floor(city.minute/1440)*1440+8*60;
 city.economy.streetMarketsDay=null;
 updateMarket(city.economy);
 const vendors=(city.economy.streetMarkets||[]).flatMap(s=>s.vendors);
 const farmVendor=vendors.find(v=>v.businessId===farm.id);
 const tailorVendor=vendors.find(v=>v.businessId===tailor.id);
 assert(farmVendor);
 assert(farmVendor.stock.milho>0);
 assert(tailorVendor);
 assert(tailorVendor.stock.roupas>0);
});

test('expanded P2P gigs post household-care and equipment-repair orders and pay workers',()=>{
 const city=setup({starter:true,funded:true,population:64});
 const home=city.buildings.find(b=>!b.entity.destroyed&&b.active&&b.units?.length&&['residential','popular_housing','super_popular_housing'].includes(b.type));
 assert(home);
 const adults=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c));
 const payer=adults[0],payer2=adults[1];
 const worker=adults.find(c=>c.id!==payer.id&&c.id!==payer2.id&&!c.jobId&&!c.businessIds.length);
 assert(payer&&payer2&&worker);
 payer.homeUnitId=home.units[0].id;
 home.units[0].occupantId=payer.accountId;
 payer2.homeUnitId=home.units[0].id;
 city.transfer('treasury',payer.accountId,50000,'Saldo teste bico P2P');
 city.transfer('treasury',payer2.accountId,50000,'Saldo teste bico P2P 2');
 payer.needs.hygiene=40;
 payer2.equipment={...(payer2.equipment||{}),cesta:{condition:40}};
 city.gigs.postNeededWork();
 const careJob=city.gigs.jobs.find(j=>j.kind==='household-care'&&j.payerAccountId===payer.accountId);
 const repairJob=city.gigs.jobs.find(j=>j.kind==='equipment-repair'&&j.payerAccountId===payer2.accountId);
 assert(careJob);
 assert(repairJob);
 const workerBefore=worker.balance;
 const goal=city.gigs.frontagePoint(home);
 assert(goal);
 repairJob.workerId=worker.id;
 repairJob.status='working';
 repairJob.progress=repairJob.required;
 worker.indoorLocation=null;
 worker.needs.food=100;worker.needs.energy=100;worker.needs.health=100;worker.needs.hygiene=100;
 worker.entity.x=goal.x;
 worker.entity.y=goal.y;
 worker.path=[];
 city.minute=Math.floor(city.minute/1440)*1440+6*60+1;
 city.gigs.updateMinute();
 assert.equal(repairJob.status,'completed');
 assert(worker.balance>workerBefore);
 assert.equal(payer2.equipment.cesta.condition,80);
});
