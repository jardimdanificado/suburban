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
