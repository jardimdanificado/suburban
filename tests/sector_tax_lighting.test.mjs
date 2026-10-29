import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney,finishShipment} from './helpers/city.mjs';
import {taxCategory,taxRate} from '../js/city_sales_tax.js';

test('sector taxes are included in the price, paid to the treasury and conserve money',()=>{
 const city=setup({starter:true,funded:true,population:64}),shop=city.economy.businesses.find(b=>b.type==='builder'),buyer=city.citizens.find(c=>!city.politics.officeHolder(c)&&c.balance>1000),before=[buyer.balance,shop.balance,city.treasury],total=totalMoney(city),amount=1080;
 assert.equal(taxRate(city,'food'),.08);assert.equal(city.politics.policy.businessTax,.08);assert(city.transfer(buyer.accountId,shop.accountId,amount,'Serviço: Alimentação',{good:'feijao'}));assert.equal(buyer.balance,before[0]-amount);assert.equal(shop.balance,before[1]+1000);assert.equal(city.treasury,before[2]+80);assert.equal(totalMoney(city),total);assert.equal(shop.salesTaxPaid,80);assert.equal(taxCategory('bicicleta'),'mobility');
});

test('council changes one sector tax and the next sale uses the new rate',()=>{
 const city=setup({starter:true,funded:true,population:64}),p=city.politics,b=city.economy.businesses.find(b=>b.type==='builder'),buyer=city.citizens.find(c=>!p.officeHolder(c)&&c.balance>1000),bill=p.council.propose(p.council.people()[0],'salesTax',{category:'food',value:.2});assert(bill);bill.attempts=0;p.council.execute(bill);assert.equal(taxRate(city,'food'),.2);assert.equal(taxRate(city,'mobility'),.12);const before=city.treasury;assert(city.transfer(buyer.accountId,b.accountId,1200,'Serviço: Alimentação',{good:'pao'}));assert.equal(city.treasury-before,200);
 const metrics=p.mandates.metrics();assert.equal(metrics.salesTax_food,20);assert.equal(metrics.salesTax_mobility,12);
});

test('lamp specialist creates demand, employs workers and is preferred for lamp refills',()=>{
 const city=setup({starter:true,funded:true,population:64});let firm;for(const site of city.economy.locateBuilding('lamp_service')){firm=city.addBuilding('lamp_service',site.x,site.y,{...site,floors:1,free:true});if(firm)break;}assert(firm);city.economy.activateMunicipalBusiness(firm,100000);assert.equal(firm.jobs,2);const worker=city.citizens.find(c=>!city.politics.officeHolder(c)&&!c.businessIds.length);city.economy.leaveJob(worker);worker.jobId=firm.id;firm.workers.push(worker.id);const hall=city.buildings.find(b=>b.type==='townhall');hall.inventory.oleo=5;const post={id:900,built:true,status:'built',fuel:0,door:{...hall.door}};city.lighting.posts.push(post);const depot=city.lighting.refillDepot(post,'treasury');const shipment=city.logistics.order(hall,depot,'oleo',1,0,{payerAccountId:'treasury',purpose:'lamp-refill',requireCarrier:true});assert(shipment);assert.equal(shipment.carrierId,firm.id);assert(city.economy.serviceInvestment.demand('lamp_service').count>0);const paid=firm.balance;finishShipment(city,shipment);assert.equal(post.fuel,12);assert(firm.balance>paid);
});
