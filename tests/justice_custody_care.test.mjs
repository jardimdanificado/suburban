import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';
import {CityEconomy} from '../js/city_economy.js';
import {CitySanitation} from '../js/city_sanitation.js';

function fixture(){
 const prisoner={id:1,accountId:'citizen:1',entity:{properties:{name:'Pessoa presa'}},needs:{food:80,water:80,energy:20,shelter:20,safety:20,toilet:20,hygiene:20,health:30},custody:{caseId:1,jailId:10,status:'detained'}},guard={id:2,jobId:10,task:'work',entity:{},path:[],indoorLocation:{buildingId:10,path:[]}},jail={id:10,type:'jail',accountId:'building:10',active:true,entity:{},workers:[2],inventory:{sabao:2,remedio:2}},facility={id:'toilet:10',unitId:'bathroom',buildingId:10,cleanliness:100};
 const people=[prisoner,guard],city={minute:100,hour:23,society:{citizen:id=>people.find(c=>c.id===id)},building:id=>id===10?jail:null,economy:{consumed:{},recordGoods:()=>{}},history:{record:()=>{}},sanitation:{facilities:new Map([[facility.id,facility]]),use(c){if(c.indoorLocation?.unitId===facility.unitId){c.needs.toilet=Math.min(95,c.needs.toilet+10);if(c.needs.toilet>=95)c.task=null;}return true;}},log:()=>({id:1})};
 return {justice:new CityJustice(city),city,prisoner,guard,jail,facility,people};
}

test('custody provides rest without freezing energy or repeatedly applying a minute',()=>{
 const {justice,city,prisoner,jail}=fixture();justice.carePrisoner(prisoner,jail);assert.equal(prisoner.needs.energy,20.35);assert.equal(prisoner.needs.shelter,60);assert.equal(prisoner.needs.safety,50);justice.carePrisoner(prisoner,jail);assert.equal(prisoner.needs.energy,20.35);city.minute++;justice.carePrisoner(prisoner,jail);assert.ok(prisoner.needs.energy>20.35);
});

test('washing consumes soap only after reaching the actual bathroom',()=>{
 const {justice,city,prisoner,jail,facility}=fixture();justice.carePrisoner(prisoner,jail);assert.equal(prisoner.custody.careService,'bathroom');assert.equal(prisoner.needs.toilet,20);assert.equal(prisoner.needs.hygiene,20);assert.equal(jail.inventory.sabao,2);
 city.minute++;justice.carePrisoner(prisoner,jail);assert.equal(prisoner.needs.hygiene,20);prisoner.indoorLocation={buildingId:10,unitId:facility.unitId,path:[]};city.minute++;justice.carePrisoner(prisoner,jail);assert.equal(prisoner.needs.hygiene,45);assert.equal(jail.inventory.sabao,1);assert.equal(city.economy.consumed.sabao,1);city.minute++;justice.carePrisoner(prisoner,jail);assert.equal(jail.inventory.sabao,1);
});

test('first aid uses actual medicine and leaves serious injuries flagged for medical care',()=>{
 const {justice,prisoner,jail,city}=fixture();prisoner.combatInjuries=[{region:'perna',severity:7,recoversAt:1000}];justice.carePrisoner(prisoner,jail);assert.equal(prisoner.needs.health,38);assert.equal(jail.inventory.remedio,1);assert.equal(city.economy.consumed.remedio,1);assert.equal(prisoner.custody.medicalReferralNeeded,true);assert.equal(prisoner.combatInjuries[0].recoversAt,1000);
});

test('absent staff and empty stocks cannot create custodial care',()=>{
 const {justice,city,guard,prisoner,jail}=fixture();guard.indoorLocation=null;justice.carePrisoner(prisoner,jail);assert.equal(prisoner.custody.careStatus,'awaiting-staff');assert.equal(prisoner.needs.health,30);assert.equal(jail.inventory.remedio,2);city.minute++;guard.indoorLocation={buildingId:10,path:[]};jail.inventory.remedio=0;city.sanitation.facilities.clear();justice.carePrisoner(prisoner,jail);assert.equal(prisoner.needs.health,30);assert.equal(prisoner.needs.toilet,20);
});

test('only the assigned jail grants private bathroom access to the detainee',()=>{
 const {city,prisoner,facility}=fixture(),sanitation=new CitySanitation(city);assert.equal(sanitation.allowed(prisoner,facility),true);prisoner.custody.jailId=11;assert.equal(sanitation.allowed(prisoner,{...facility,access:'employees'}),false);
 assert.equal(CityEconomy.prototype.accepts.call({}, {type:'jail'},'sabao'),true);assert.equal(CityEconomy.prototype.accepts.call({}, {type:'jail'},'remedio'),true);assert.equal(CityEconomy.prototype.accepts.call({}, {type:'jail'},'carvao'),false);
});

test('prison water cannot be created instantly without a real local source and staff',()=>{
 const {justice,city,prisoner,jail}=fixture();jail.door={x:0,y:0};city.buildings=[jail];city.findPath=()=>[];city.currency={price:n=>n};prisoner.needs.water=10;prisoner.needs.food=80;prisoner.pocket={food:[],water:0};justice.servePrisoner(prisoner,jail);assert.equal(prisoner.pocket.water,0);assert.equal(prisoner.custody.waterStatus,'awaiting-water-source');
 const utility={id:20,type:'utility',active:true,door:{x:2,y:0},entity:{properties:{name:'Água municipal'}},accountId:'utility:20'};city.buildings.push(utility);city.minute+=30;justice.servePrisoner(prisoner,jail);assert.equal(prisoner.pocket.water,0);assert.equal(jail.waterStock||0,0);assert.equal(prisoner.custody.waterStatus,'awaiting-water-source');
});
