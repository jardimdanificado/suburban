import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';
import {CityVehicles} from '../js/city_vehicles.js';
import {CityPaint} from '../js/city_paint.js';

function fixture(){
  const actor={id:1,accountId:'citizen:1',entity:{x:2,y:2,properties:{name:'Autor'}},needs:{health:90,energy:90},businessIds:[]},owner={id:2,accountId:'citizen:2',entity:{x:20,y:20,properties:{name:'Dono'}},needs:{health:90,energy:90},businessIds:[]};
  const people=[actor,owner],accounts=new Map(people.map(c=>[c.accountId,c]));let transfers=0;
  const city={minute:100,hour:12,world:{},citizens:people,buildings:[],accounts,society:{citizen:id=>people.find(c=>c.id===id),isAdult:()=>true},building:()=>null,random:()=>.5,log:()=>({id:1}),fail:()=>false,transfer:()=>{transfers++;return true;}};
  city.vehicles=new CityVehicles(city);const v={id:1,active:true,good:'bicicleta_carga',x:2,y:2,color:'#000000',ownerAccountId:owner.accountId,condition:100,ownershipHistory:[{reason:'Compra'}]};city.vehicles.units.set(1,v);city.vehicles.activeCount=1;
  return {justice:new CityJustice(city),city,actor,owner,v,transfers:()=>transfers};
}

test('theft preserves title and currency, and use capacity follows physical possession',()=>{
  const {justice,city,actor,owner,v,transfers}=fixture(),record=justice.stealVehicle(actor,1);assert.ok(record);assert.equal(v.ownerAccountId,owner.accountId);assert.equal(v.possessorAccountId,actor.accountId);assert.equal(transfers(),0);assert.equal(v.ownershipHistory.length,1);
  assert.equal(city.vehicles.cargoCapacity(owner),24);assert.equal(city.vehicles.cargoCapacity(actor),96);assert.equal(record.witnesses.some(w=>w.citizenId===owner.id),false);
  assert.equal(city.vehicles.transferVehicle(1,actor.accountId,500),false);assert.equal(transfers(),0);
});

test('owner reclaims recognized parked bike and restores access without another purchase',()=>{
  const {justice,city,actor,owner,v}=fixture();justice.stealVehicle(actor,1);owner.entity.x=owner.entity.y=2;
  assert.equal(justice.recognizeStolenVehicle(owner,v),'recovered');assert.equal(v.possessorAccountId,null);assert.equal(v.ownerAccountId,owner.accountId);assert.equal(city.vehicles.cargoCapacity(owner),96);assert.equal(city.vehicles.cargoCapacity(actor),24);
});

test('repainting greatly reduces recognition without changing vehicle identity',()=>{
  const {justice,city,actor,owner,v}=fixture();justice.stealVehicle(actor,1);owner.entity.x=owner.entity.y=2;v.color='#ffffff';assert.equal(justice.recognizeStolenVehicle(owner,v),false);assert.equal(v.id,1);assert.equal(v.possessorAccountId,actor.accountId);
  city.minute+=30;city.random=()=>.01;assert.equal(justice.recognizeStolenVehicle(owner,v),'recovered');
});

test('healthy angry owner stops the rider before physical confrontation',()=>{
  const {justice,city,actor,owner,v}=fixture();justice.stealVehicle(actor,1);owner.entity.x=owner.entity.y=2;owner.socialProfile={temper:.9};v.driverId=actor.id;actor.ridingVehicleId=1;let stopped=false,fought=false;
  city.vehicles.releaseTrip=c=>{assert.equal(c,actor);stopped=true;v.driverId=null;c.ridingVehicleId=null;};justice.combatEncounter=(a,b)=>{assert.ok(stopped);assert.equal(a,owner);assert.equal(b,actor);fought=true;return true;};
  assert.equal(justice.recognizeStolenVehicle(owner,v),'recognized-rider');assert.ok(fought);assert.equal(v.possessorAccountId,actor.accountId);
});

test('occupied vehicles and vehicles on another level cannot be stolen',()=>{
  const {justice,actor,v}=fixture();v.driverId=5;assert.equal(justice.stealVehicle(actor,1),false);v.driverId=null;actor.skybridgeZ=4;assert.equal(justice.stealVehicle(actor,1),false);
});


test('police recovery stops vehicle use and preserves its physical location',()=>{
  const {justice,city,actor,owner,v}=fixture();const record=justice.stealVehicle(actor,1);actor.ridingVehicleId=1;v.driverId=actor.id;let stopped=false;city.vehicles.releaseTrip=()=>{stopped=true;actor.ridingVehicleId=null;v.driverId=null;};
  justice.recoverVehiclesOnArrest(actor);assert.ok(stopped);assert.equal(v.x,2);assert.equal(v.y,2);assert.equal(v.ownerAccountId,owner.accountId);assert.equal(v.possessorAccountId,null);assert.equal(record.vehicleRecoverySource,'police');
});


test('repainting a stolen vehicle bills its possessor while keeping the legal owner',()=>{
  const {justice,city,actor,owner,v}=fixture();justice.stealVehicle(actor,1);actor.entity.properties.citizen=actor;
  const garage={id:15,type:'cycle_workshop',active:true,entity:{}};city.building=id=>id===15?garage:null;const paint=new CityPaint(city);
  assert.equal(paint.requestVehicle(1,15,'#ffffff'),true);assert.equal(paint.jobs[0].payer,actor.accountId);assert.equal(paint.jobs[0].clientId,actor.id);assert.equal(v.ownerAccountId,owner.accountId);
});
