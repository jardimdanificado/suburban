import test from 'node:test';
import assert from 'node:assert/strict';
import {carryCapacity} from '../js/city_markets.js';
import {injuryMovementFactor,injuryLoadFactor,injuryWorkFactor} from '../js/city_injury_effects.js';
import {workEfficiency} from '../js/city_employment.js';
import {CityVehicles} from '../js/city_vehicles.js';
import {CityJustice} from '../js/city_justice.js';
import {CityLogistics} from '../js/city_logistics.js';

const person=()=>({id:1,accountId:'citizen:1',entity:{x:5,y:6,properties:{name:'Pessoa'}},equipment:{},skills:{maintenance:60},career:{motivation:50},jobId:10,needs:{health:80},path:[]});

test('back injuries reduce walking and vehicle carrying limits with bounded penalties',()=>{
  const c=person(),vehicles=new CityVehicles({building:()=>null});assert.equal(carryCapacity(c),24);c.combatInjuries=[{region:'costas',severity:8}];assert.equal(carryCapacity(c),12);assert.equal(vehicles.cargoCapacity(c),12);
  c.equipment.carrinho=true;assert.equal(carryCapacity(c),37);vehicles.activeCount=1;vehicles.units.set(1,{active:true,condition:100,ownerAccountId:c.accountId,good:'bicicleta_carga'});assert.equal(vehicles.cargoCapacity(c),49);
  c.combatInjuries.push({region:'costas',severity:8});assert.equal(injuryLoadFactor(c),.2);assert.ok(carryCapacity(c)>0);
});

test('arms and head reduce effective work, while recovery restores it without changing skills',()=>{
  const c=person(),b={id:10},normal=workEfficiency(c,b),skills={...c.skills};c.combatInjuries=[{region:'braço',severity:6},{region:'cabeça',severity:5}];assert.ok(workEfficiency(c,b)<normal);assert.ok(injuryWorkFactor(c)>=.2);assert.deepEqual(c.skills,skills);c.combatInjuries=null;assert.equal(workEfficiency(c,b),normal);
});

test('leg injuries affect movement independently of hand and cognitive effects',()=>{
  const c=person();c.combatInjuries=[{region:'perna',severity:7}];assert.ok(injuryMovementFactor(c)<1);assert.equal(injuryWorkFactor(c),1);c.combatInjuries=Array.from({length:8},()=>({region:'perna',severity:8}));assert.equal(injuryMovementFactor(c),.35);
});

test('medical treatment requires an actual health visit and cannot be applied twice in one minute',()=>{
  const c=person(),city={minute:100,log:()=>{}},justice=new CityJustice(city),clinic={id:10,type:'clinic',active:true,entity:{}},wound={region:'braço',severity:3,recoversAt:200};c.combatInjuries=[wound];justice.treatInjuries(c,clinic);assert.equal(wound.recoversAt,200);
  c.civicVisit={buildingId:10,need:'health'};justice.treatInjuries(c,clinic);justice.treatInjuries(c,clinic);assert.equal(wound.recoversAt,198);assert.equal(wound.treatmentBuildingId,10);city.minute=101;justice.treatInjuries(c,clinic);assert.equal(wound.recoversAt,196);
  city.minute=196;justice.updateInjuries(c);assert.equal(c.combatInjuries,null);assert.equal(c.skills.maintenance,60);
});

test('an injured driver drops an oversized shipment at their actual location for reassignment',()=>{
  const c=person();c.deliveryId=1;c.combatInjuries=[{region:'costas',severity:8}];
  const shipment={id:1,driverId:1,quantity:20,pickedUp:true,good:'madeira',status:'delivery',position:{x:0,y:0},seller:{active:true,entity:{}},buyer:{active:true,entity:{}},createdAt:0,lastDispatchAttempt:99};
  const city={minute:100,hour:12,citizens:[c],society:{citizen:id=>id===1?c:null},urgentNeed:()=>false,furniture:{release:()=>{}}},logistics=new CityLogistics(city);logistics.shipments.push(shipment);logistics.updateMinute();
  assert.equal(shipment.driverId,null);assert.equal(c.deliveryId,null);assert.equal(shipment.status,'waiting');assert.deepEqual(shipment.position,{x:5,y:6});assert.equal(shipment.quantity,20);assert.equal(shipment.pickedUp,true);
});
