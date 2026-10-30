import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';
import {INDUSTRIES} from '../js/city_industries.js';
import {setup,putAtWorkCell} from './helpers/city.mjs';

test('artisan crafts a physical wooden baton from its real wood and fiber stock',()=>{
 const city=setup({starter:true,population:32});let shop;
 for(const site of city.economy.locateBuilding('artisan')){shop=city.addBuilding('artisan',site.x,site.y,{...site,free:true});if(shop)break;}
 assert.ok(shop);const worker=city.citizens.find(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c));assert.ok(worker);
 city.economy.leaveJob(worker,'Turno de teste');worker.jobId=shop.id;shop.workers=[worker.id];putAtWorkCell(city,worker,shop);
 shop.inventory.madeira=6;shop.inventory.fibras=4;shop.inventory.carrinho=1;shop.inventory.cesta=1;shop.inventory.porrete=0;shop.productionLabor=24;
 assert.equal(city.economy.industrialWork(shop,worker,INDUSTRIES.artisan),true);
 assert.equal(shop.inventory.porrete,1);assert.equal(shop.inventory.madeira,3);assert.equal(shop.inventory.fibras,2);assert.equal(shop.inventory.carrinho,1);assert.equal(shop.inventory.cesta,1);assert.equal(city.economy.produced.porrete,1);
});

test('a resident can buy and equip a durable baton using an actual artisan sale',()=>{
 const city=setup({starter:true,population:32}),citizen=city.citizens.find(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c)&&(c.traits?.riskTolerance??.5)>.62);assert.ok(citizen);
 const shop={id:9901,type:'artisan',active:true,entity:{destroyed:false,properties:{name:'Artesão'}},accountId:'shop:9901',door:{x:citizen.entity.x,y:citizen.entity.y},inventory:{porrete:1,carrinho:0,cesta:0}};city.accounts.set(shop.accountId,{accountId:shop.accountId,balance:0,name:'Artesão'});city.transfer('treasury',citizen.accountId,2000,'Teste de compra de equipamento');citizen.needs.safety=30;citizen.equipment={};citizen.inventory={};
 const before=citizen.balance;assert.equal(city.economy.consumerOffer(citizen,shop).good,'porrete');assert.equal(city.economy.buyConsumerGood(citizen,shop),true);
 assert.equal(citizen.balance,before-city.economy.goods.porrete.price);assert.equal(shop.inventory.porrete,0);assert.equal(citizen.inventory.porrete,1);assert.equal(citizen.equipment.weapon.good,'porrete');assert.equal(citizen.equipment.weapon.durability,5);
});

test('a baton strengthens a real assault, wears down, and does not make a healthy hit lethal',()=>{
 const actor={id:1,accountId:'citizen:1',entity:{x:0,y:0,properties:{name:'Atacante'}},skills:{combat:0},equipment:{weapon:{good:'porrete',name:'Porrete de madeira',damage:2.4,range:1.8,durability:1}},inventory:{porrete:1}},target={id:2,accountId:'citizen:2',entity:{x:1,y:0,properties:{name:'Vítima'}},skills:{combat:0},needs:{health:100}};
 const record={id:1},city={minute:100,hour:12,citizens:[actor,target],society:{getRelation:()=>null,citizen:id=>id===1?actor:target},random:()=>.99,economy:{practice(){ }},log(){},justice:null};const justice=new CityJustice(city);city.justice=justice;justice.crimeRecord=(type,offenderId,victimId,details)=>{record.type=type;record.offenderId=offenderId;record.victimId=victimId;record.details=details;return record;};
 assert.equal(justice.combatEncounter(actor,target,{forced:true}),true);assert.equal(record.type,'assault');assert.equal(record.details.weapon,'Porrete de madeira');assert.ok(record.details.damage>3.3);assert.ok(target.needs.health>0);assert.equal(actor.equipment.weapon,null);assert.equal(actor.inventory.porrete,0);assert.equal(target.combatInjuries.length,1);
});

test('a severe head strike can briefly incapacitate a resident and the timer restores consciousness',()=>{
 const actor={id:1,accountId:'citizen:1',entity:{x:0,y:0,properties:{name:'Atacante'}},skills:{combat:0},equipment:{weapon:{good:'porrete',name:'Porrete de madeira',damage:5,range:1.8,durability:5}},inventory:{porrete:1}},target={id:2,accountId:'citizen:2',entity:{x:1,y:0,properties:{name:'Vítima'}},skills:{combat:0},needs:{health:100},task:'work',path:[{x:5,y:5}],targetId:12};
 let rolls=[.99,.99,.99,0,.99,.99,.99],minute=100;const city={get minute(){return minute;},hour:12,citizens:[actor,target],buildings:[],world:{cityLampPosts:[]},society:{getRelation:()=>null,citizen:id=>id===1?actor:target},random:()=>rolls.shift()??.99,economy:{practice(){}},log:()=>({id:1}),justice:null};const justice=new CityJustice(city);city.justice=justice;
 assert.equal(justice.combatEncounter(actor,target,{forced:true}),true);assert.ok(target.unconsciousUntil>city.minute);assert.equal(target.action,'Inconsciente após ferimento na cabeça');assert.deepEqual(target.path,[]);assert.equal(target.task,null);
 minute=target.unconsciousUntil;justice.updateInjuries(target);assert.equal(target.unconsciousUntil,null);assert.equal(target.action,null);
});

test('stealing the equipped baton removes it from the victim and recovery returns the item',()=>{
 const actor={id:1,accountId:'citizen:1',entity:{x:0,y:0,properties:{name:'Pessoa 1'}},inventory:{},needs:{health:90},traits:{},skills:{}},victim={id:2,accountId:'citizen:2',entity:{x:1,y:0,properties:{name:'Pessoa 2'}},inventory:{porrete:1},equipment:{weapon:{good:'porrete',name:'Porrete de madeira',durability:4}},needs:{health:90},traits:{},skills:{}},innocent={id:3,accountId:'citizen:3',entity:{x:1,y:1,properties:{name:'Pessoa 3'}},inventory:{},needs:{health:90},traits:{},skills:{}};
 const accounts=new Map([[actor.accountId,{balance:1000}],[victim.accountId,{balance:1000}],[innocent.accountId,{balance:1000}]]),city={minute:100,hour:12,citizens:[actor,victim,innocent],accounts,buildings:[],world:{cityLampPosts:[]},society:{citizen:id=>[actor,victim,innocent].find(c=>c.id===id),isAdult:()=>true},economy:{goods:{porrete:{}}},random:()=>.99,log:()=>({id:1}),transfer(from,to,amount){const source=accounts.get(from),destination=accounts.get(to);if(!source||!destination||source.balance<amount)return false;source.balance-=amount;destination.balance+=amount;return true;}};const justice=new CityJustice(city);
 const record=justice.attemptTheft(actor,victim,{kind:'item',good:'porrete'});assert.ok(record);assert.equal(victim.equipment.weapon,null);assert.equal(victim.inventory.porrete,0);assert.equal(actor.inventory.porrete,1);
 assert.equal(justice.recoverStolenAsset(record,innocent),false);assert.equal(justice.recoverStolenAsset(record,actor),true);assert.equal(actor.inventory.porrete,0);assert.equal(victim.inventory.porrete,1);
});
