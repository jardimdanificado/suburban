import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,ensureBusiness,finishShipment} from './helpers/city.mjs';
import {companyLogo} from '../js/city_company_identity.js';
import {updateCompanyUniforms,companyUniform} from '../js/city_company_uniforms.js';
import {wornGarment,selectClothes,wearGarment} from '../js/city_clothing.js';
import {paperMillInputs} from '../js/city_paper_inputs.js';
import {INDUSTRIES} from '../js/city_industries.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
import {CityCitizenModels} from '../js/city_citizen_models.js';

test('company marks are distinct, stable and independent of simulation randomness',()=>{
 const city={initialSeed:42,random(){throw Error('Simulation random stream changed');}},a={id:1,entity:{properties:{name:'Tecidos da Vila'}}},b={id:2,entity:{properties:{name:'Tecidos da Vila'}}};
 const logo=companyLogo(city,a);
 assert(logo.emblems.length);assert.equal(companyLogo(city,a),logo);
 assert.notDeepEqual(companyLogo(city,b),logo);
 assert.deepEqual(companyLogo(city,{id:1,entity:a.entity}),logo);
});

test('uniforms replace personal garments only during service for their employer',()=>{
 const personal={piece:'vestido',color:'#abcdef',condition:100,quality:70,dirt:0},uniform={piece:'macacão',uniformCompanyId:7,condition:100,garmentId:'uniform-1'},c={id:1,jobId:7,task:'work',wardrobe:[personal,uniform],wearingIndex:0};
 assert.equal(wornGarment(c),uniform);
 for(const task of ['construction','transport','clean','research']){c.task=task;assert.equal(companyUniform(c),uniform);}
 c.task='food';assert.equal(wornGarment(c),personal);
 c.task='work';c.jobId=8;assert.equal(companyUniform(c),null);
 assert.equal(wearGarment(c,1),false);
 selectClothes(c);assert.equal(c.wearingIndex,0);
});

test('citizen rendering changes to the company print and back without changing the personal outfit',()=>{
 const personal={piece:'camisa',color:'#abcdef'},uniform={piece:'macacão',color:'#334455',uniformCompanyId:7,condition:100,artPrint:{companyLogo:{background:'#334455'}}};
 const c={jobId:7,task:'work',wardrobe:[personal,uniform],wearingIndex:0},model={appearanceCache:new WeakMap(),printedMaterial:(piece,color,print,art)=>art};
 const working=CityCitizenModels.prototype.appearanceFor.call(model,c,{id:1});
 assert.equal(working.garment,uniform);assert.equal(working.garmentMaterial,uniform.artPrint);
 c.task='energy';const resting=CityCitizenModels.prototype.appearanceFor.call(model,c,{id:1});
 assert.equal(resting.garment,personal);assert.equal(c.wearingIndex,0);
});

test('uniforms require manufactured stock, payment and delivery without duplicate orders',()=>{
 const city=setup(),tailor=ensureBusiness(city,'tailor'),firm=city.economy.businesses.find(b=>b.type==='bakery');
 const worker=city.citizens.find(c=>c.jobId==null&&!c.businessIds?.length&&!city.politics.officeHolder(c));assert(worker);
 worker.jobId=firm.id;firm.workers.push(worker.id);
 worker.entity.x=firm.door.x;worker.entity.y=firm.door.y;worker.task='work';
 updateCompanyUniforms(city);
 const ordered=tailor.companyUniformOrders.filter(o=>o.companyId===firm.id).reduce((n,o)=>n+o.remaining,0);assert(ordered>0);
 updateCompanyUniforms(city);assert.equal(tailor.companyUniformOrders.filter(o=>o.companyId===firm.id).reduce((n,o)=>n+o.remaining,0),ordered);
 assert.equal(companyUniform(worker),null);
 // Isolate this employer's production from other companies queued in the city.
 tailor.companyUniformOrders=tailor.companyUniformOrders.filter(o=>o.companyId===firm.id);
 const batches=Math.ceil(ordered/2);tailor.inventory.tecido+=batches*3;city.economy.initialStock.tecido+=batches*3;
 for(let i=0;i<batches;i++){tailor.productionLabor=100;assert(city.economy.industrialWork(tailor,worker,INDUSTRIES.tailor));}
 assert.equal(tailor.inventory.tecido,0);assert.equal(city.economy.consumed.tecido,batches*3);
 const garment=tailor.garments.find(g=>g.uniformCompanyId===firm.id);assert(garment);assert.equal(garment.artPrint.companyLogo,firm.logo);
 city.transfer('treasury',firm.accountId,city.currency.price(100000),'Fixture uniform budget');
 const old=firm.balance;
 const stock=city.goodsStock('roupas');
 updateCompanyUniforms(city);
 const shipment=city.logistics.shipments.find(s=>s.purpose==='company-uniforms'&&s.buyer===firm);assert(shipment);
 assert(firm.balance<old);assert.equal(companyUniform(worker),null);
 finishShipment(city,shipment);updateCompanyUniforms(city);
 assert(companyUniform(worker));assert.equal(companyUniform(worker).brandId,tailor.id);
 assert.equal(city.goodsStock('roupas'),stock);
 const graph=new CityStateGraph(),reader=new CityStateGraph(),restored=reader.apply(graph.encode({city})).city;bindCityState(restored);
 assert.deepEqual(restored.building(firm.id).logo,firm.logo);
 assert.equal(companyUniform(restored.society.citizen(worker.id)).garmentId,companyUniform(worker).garmentId);
});

test('business advertisements preserve their company mark through worker snapshots',()=>{
 const city=setup(),author=city.citizens.find(c=>c.businessIds.length),firm=city.building(author.businessIds[0]);
 const doc=city.publications.stock(firm,'panfletos',1);city.publications.move(doc,author.accountId);
 assert(city.publications.write(doc.id,author.id,{type:'advertisement',buildingId:firm.id,text:'Conheça nossa empresa.'}));
 assert.equal(doc.entries[0].companyLogo,companyLogo(city,firm));
 const reader=new CityStateGraph(),restored=reader.apply(new CityStateGraph().encode({city})).city;bindCityState(restored);
 assert.deepEqual(restored.publications.documents.get(doc.id).entries[0].companyLogo,firm.logo);
});

test('hemp makes cloth for clothes and replaces wood in paper production, respecting prohibition',()=>{
 const city=setup(),worker=city.citizens.find(c=>c.fixtureInvestor),b=city.economy.businesses.find(b=>b.type==='farm');
 b.type='hemp_weaver';b.inventory.canhamo=12;city.economy.initialStock.canhamo+=12;b.productionLabor=100;
 assert(city.economy.industrialWork(b,worker,INDUSTRIES.hemp_weaver));assert.equal(b.inventory.tecido,1);
 b.type='paper_mill';b.productionLabor=100;b.inventory.madeira=0;
 assert.deepEqual(paperMillInputs(city,b),{canhamo:4});assert(city.economy.accepts(b,'canhamo'));
 const consumed=city.economy.consumed.canhamo;
 assert(city.economy.industrialWork(b,worker,INDUSTRIES.paper_mill));assert.equal(b.inventory.papel,12);assert.equal(city.economy.consumed.canhamo,consumed+4);
 city.economy.updateDemand(true);assert('canhamo' in b.inputDemand);
 assert(city.substances.setLaw('canhamo','prohibited',null));assert.equal(city.economy.accepts(b,'canhamo'),false);
 assert.equal(city.economy.industrialWork(b,worker,INDUSTRIES.paper_mill),false);
 b.inventory.madeira=3;b.productionLabor=100;assert(city.economy.industrialWork(b,worker,INDUSTRIES.paper_mill));assert.equal(b.inventory.madeira,0);assert.equal(b.inventory.papel,24);
});
