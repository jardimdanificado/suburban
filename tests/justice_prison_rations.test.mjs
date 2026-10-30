import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';
import {setup,putAtWorkCell} from './helpers/city.mjs';

function fixture({pao=0}={}){
 const prisoner={id:1,accountId:'citizen:1',entity:{properties:{name:'Pessoa presa'}},needs:{food:20,water:90},pocket:{food:[],water:6},custody:{caseId:7,nextRationAt:0}};
 const jail={id:10,type:'jail',active:true,accountId:'building:10',door:{x:0,y:0},entity:{destroyed:false,properties:{name:'Cadeia'}},inventory:{pao},incoming:{},inventoryCapacity:100};
 const bakery={id:20,type:'bakery',active:true,accountId:'building:20',door:{x:2,y:0},entity:{destroyed:false,properties:{name:'Padaria'}},inventory:{pao:12}};
 const city={minute:100,buildings:[jail,bakery],economy:{goods:{pao:{price:180}},mealOffer:b=>b.type==='jail'&&b.inventory.pao>=3?{good:'pao',inputs:{pao:3},quality:1}:null},logistics:{transportLimit:()=>24,order:(seller,buyer,good,quantity,price,opts)=>{seller.inventory[good]-=quantity;buyer.incoming[good]=(buyer.incoming[good]||0)+quantity;return{id:1,purpose:opts.purpose};}},transfer:()=>{throw Error('Custody must not buy food directly from a distant seller');},history:{record(){}}};
 prisoner.custody.jailId=jail.id;
 return {justice:new CityJustice(city),city,prisoner,jail,bakery};
}

test('prisoner receives a ration only from food physically stocked at the jail',()=>{
 const {justice,prisoner,jail,bakery}=fixture({pao:3});
 justice.servePrisoner(prisoner,jail);
 assert.equal(jail.inventory.pao,0);assert.equal(bakery.inventory.pao,12);
 assert.equal(prisoner.pocket.food.length,1);assert.equal(prisoner.pocket.food[0].sourceId,jail.id);
 assert.equal(prisoner.custody.foodStatus,'ration-issued');
});

test('jail orders real bread freight and does not teleport a ration from the bakery',()=>{
 const {justice,prisoner,jail,bakery}=fixture();
 justice.servePrisoner(prisoner,jail);
 assert.equal(prisoner.pocket.food.length,0);assert.equal(bakery.inventory.pao,0);
 assert.equal(jail.incoming.pao,12);assert.equal(prisoner.custody.foodStatus,'ration-in-transit');
 assert.equal(prisoner.custody.foodShipmentId,1);
});

test('water shortage dispatches a real jail employee toward a local source',()=>{
 const city=setup({starter:true,population:32});let jail;
 for(const site of city.economy.locateBuilding('jail')){jail=city.addBuilding('jail',site.x,site.y,{...site,width:3,depth:3,floors:1,free:true});if(jail)break;}
 assert.ok(jail);const prisoner=city.citizens.find(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c)),worker=city.citizens.find(c=>c!==prisoner&&city.society.isAdult(c)&&!city.politics.officeHolder(c));assert.ok(worker);
 city.economy.leaveJob(worker,'Designação de abastecimento');worker.jobId=jail.id;jail.workers=[worker.id];putAtWorkCell(city,worker,jail);
 const shore={bodyId:0,point:{x:jail.door.x+2,y:jail.door.y},path:[{x:jail.door.x+2,y:jail.door.y}]};let drawn=0;city.water.nearestShore=()=>shore;city.water.contamination=()=>12;city.water.draw=(_body,quantity)=>drawn+=quantity;
 prisoner.custody={caseId:17,jailId:jail.id,nextRationAt:0};prisoner.needs.water=10;prisoner.needs.food=90;prisoner.pocket={food:[],water:0};
 city.justice.cases.push({id:17,status:'arrested',chargedCitizenId:prisoner.id,rule:{fineOnly:false},investigation:{suspectId:prisoner.id}});
 city.justice.servePrisoner(prisoner,jail);
 assert.equal(prisoner.pocket.water,0);assert.equal(prisoner.custody.waterStatus,'water-in-transit');assert.equal(worker.custodyWaterDelivery.jailId,jail.id);assert.equal(worker.custodyWaterDelivery.phase,'to-source');assert.equal(worker.indoorLocation.exiting,true);
 for(let i=0;i<60&&!(jail.waterStock>=6);i++)city.update(.25);
 assert.equal(jail.waterStock,6,JSON.stringify({worker:{task:worker.task,jobId:worker.jobId,trip:worker.custodyWaterDelivery,path:worker.path,position:{x:worker.entity.x,y:worker.entity.y},inside:worker.indoorLocation},status:prisoner.custody.waterStatus,drawn}));assert.equal(jail.waterContamination,12);assert.equal(drawn,6);assert.equal(worker.custodyWaterDelivery,null);assert.equal(worker.indoorLocation?.buildingId,jail.id);
 city.minute+=30;city.justice.servePrisoner(prisoner,jail);assert.equal(prisoner.pocket.water,6);assert.equal(prisoner.pocket.waterContamination,12);assert.equal(jail.waterStock,0);assert.equal(prisoner.custody.waterStatus,'supplied-from-jail-stock');
});
