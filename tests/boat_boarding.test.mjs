import test from 'node:test';
import assert from 'node:assert/strict';
import {CityVehicles} from '../js/city_vehicles.js';

test('boarding does not summon an existing boat from another part of the map',()=>{
  const person={id:1,boatClass:'launch',entity:{x:10,y:10,destroyed:false}};
  const boat={id:2,boatClass:'launch',active:true,x:80,y:80,entity:{x:80,y:80}};
  const vehicles=Object.create(CityVehicles.prototype);
  vehicles.units=new Map([[boat.id,boat]]);
  vehicles.city={citizens:[person],worldPort:{accountId:'port'},society:{citizen:()=>person}};
  vehicles.createBoatVehicle=()=>null;
  vehicles.syncBoatTravelers();
  assert.equal(person.boatVehicleId,undefined);
  assert.deepEqual(boat.entity,{x:80,y:80});
  assert.equal(boat.transportCitizenId,undefined);
});

test('a rider standing on land after a delivery releases the boat',()=>{
  const person={id:3,boatClass:'launch',boatVehicleId:2,path:[],entity:{x:10,y:10,destroyed:false}};
  const boat={id:2,boatClass:'launch',active:true,transportCitizenId:3,driverId:3,x:80,y:80,entity:{x:80,y:80}};
  const vehicles=Object.create(CityVehicles.prototype);
  vehicles.units=new Map([[boat.id,boat]]);
  vehicles.city={citizens:[person],worldPort:{accountId:'port'},society:{citizen:()=>person},walkable:()=>true};
  vehicles.syncBoatTravelers();
  assert.equal(person.boatVehicleId,null);
  assert.equal(person.boatClass,null);
  assert.equal(boat.transportCitizenId,null);
  assert.equal(boat.driverId,null);
  assert.equal(boat.status,'Atracado após a viagem');
});
