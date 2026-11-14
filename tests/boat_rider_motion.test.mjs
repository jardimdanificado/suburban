import test from 'node:test';
import assert from 'node:assert/strict';
import {packBoatRiders,applyBoatRiders} from '../js/boat_rider_motion.js';
import {CitySimulationBridge,sampleCitizenMotion} from '../js/city_sim_bridge.js';
import {TILE_WATER,TILE_SAND} from '../js/world_gen.js';
function fixture(){
 const person={id:1,entity:{x:1,y:1},boatVehicleId:null,boatClass:null},boat={id:7,boatClass:'launch',entity:{x:1,y:1},passengerIds:[]};
 const bridge=Object.create(CitySimulationBridge.prototype);bridge.city={society:{citizen:id=>id===1?person:null},vehicles:{units:new Map([[7,boat]])}};bridge.vehicleMotion=new Map();return {person,boat,bridge};
}
test('compact boarding packets make the citizen follow the boat before the next full snapshot',()=>{
 const {person,bridge}=fixture();
 applyBoatRiders(bridge.city,packBoatRiders([{id:1,boatClass:'launch',boatVehicleId:7}]));
 bridge.applyVehiclePositions(new Float64Array([7,12,8,0,0]));assert.deepEqual(person.entity,{x:12,y:8});
 bridge.applyVehiclePositions(new Float64Array([7,18,11,0,0]));assert.deepEqual(person.entity,{x:18,y:11});
});
test('disembarking clears the link so subsequent boat movement cannot carry the citizen away',()=>{
 const {person,boat,bridge}=fixture();applyBoatRiders(bridge.city,packBoatRiders([{id:1,boatClass:'launch',boatVehicleId:7}]));
 applyBoatRiders(bridge.city,packBoatRiders([{id:1}]));person.entity.x=20;person.entity.y=20;
 bridge.applyVehiclePositions(new Float64Array([7,30,30,0,0]));assert.deepEqual(person.entity,{x:20,y:20});assert.equal(boat.transportCitizenId,null);
});
test('water motion is accepted immediately when compact boarding state is present',()=>{
 const {person,bridge}=fixture();applyBoatRiders(bridge.city,packBoatRiders([{id:1,boatClass:'launch',boatVehicleId:7}]));
 const world={getTile:(x,y)=>x>=2?TILE_WATER:TILE_SAND},sample={citizen:person,entity:person.entity,to:{x:4,y:1},points:[]};
 assert.equal(sampleCitizenMotion(world,sample,0),true);assert.equal(person.entity.x,4);
});

test('compact towing packets attach the correct bike and hull and clear both after arrival',async()=>{
 const {packBoatTows,applyBoatTows}=await import('../js/boat_rider_motion.js');
 const {person,boat,bridge}=fixture(),bike={id:8,good:'bicicleta',entity:{x:1,y:1}};
 bridge.city.citizens=[person];bridge.city.vehicles.units.set(8,bike);
 applyBoatTows(bridge.city,packBoatTows([{id:1,localBoatTrip:{},towedBoatId:7,towBikeId:8,ridingVehicleId:8}]));
 assert.equal(boat.towedByVehicleId,8);assert.equal(bike.towedBoatId,7);assert.equal(person.ridingVehicleId,8);
 bridge.applyVehiclePositions(new Float64Array([7,9,6,0,0,8,11,6,0,0]));assert.deepEqual(person.entity,{x:11,y:6});
 applyBoatTows(bridge.city,packBoatTows([{id:1}]));assert.equal(boat.towedByVehicleId,null);assert.equal(person.ridingVehicleId,null);assert.equal(bike.driverId,null);
});

test('compact passenger rows preserve the pilot and carry every passenger within the hull',()=>{
 const {person,boat,bridge}=fixture(),passengers=Array.from({length:7},(_,i)=>({id:i+2,entity:{x:1,y:1}})),people=[person,...passengers];
 bridge.city.society.citizen=id=>people.find(c=>c.id===id);boat.localTripCitizenId=1;
 applyBoatRiders(bridge.city,packBoatRiders([...people].reverse().map(c=>({id:c.id,boatClass:'launch',boatVehicleId:7}))));
 assert.equal(boat.driverId,1);assert.equal(boat.passengerIds.length,7);
 bridge.applyVehiclePositions(new Float64Array([7,18,11,0,0]));
 assert.deepEqual(person.entity,{x:18,y:11});
 for(const c of passengers)assert.ok(Math.hypot(c.entity.x-18,c.entity.y-11)<1.1);
 assert.equal(new Set(people.map(c=>`${c.entity.x},${c.entity.y}`)).size,people.length);
 applyBoatRiders(bridge.city,packBoatRiders([{id:2}]));assert.equal(boat.driverId,1);assert.equal(boat.passengerIds.length,6);
});
