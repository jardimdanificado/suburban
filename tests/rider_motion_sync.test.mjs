import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulationBridge} from '../js/city_sim_bridge.js';
import {TILE_FLOOR} from '../js/world_gen.js';

test('vehicle packets and subsequent render updates keep riders at the vehicle position',()=>{
 const c={id:4,ridingVehicleId:9,entity:{x:1,y:1}},passenger={id:5,ridingVehicleId:9,entity:{x:1,y:1}},v={id:9,driverId:4,passengerIds:[5],entity:{x:1,y:1}};
 const bridge=Object.assign(Object.create(CitySimulationBridge.prototype),{city:{world:{width:20,height:20,getTile:()=>TILE_FLOOR},vehicles:{units:new Map([[9,v]])},society:{citizen:id=>id===4?c:id===5?passenger:null}},time:{paused:false},vehicleMotion:new Map(),motion:new Map(),interiorMotion:new Map()});
 for(const [x,y]of [[2.5,3.5],[4.5,5.5]]){bridge.applyVehiclePositions(new Float64Array([9,x,y,0,1]));assert.deepEqual(c.entity,{x,y});assert.deepEqual(v.entity,c.entity);assert.equal(passenger.entity.x,x+Math.cos(1)*.34);assert.equal(passenger.entity.y,y-Math.sin(1)*.34);bridge.interpolate(performance.now()+50);assert.deepEqual(v.entity,c.entity);}
 const motion={id:4,entity:c.entity,citizen:c,to:{x:7.5,y:7.5},points:[]};bridge.motion.set(4,motion);bridge.interpolate(performance.now()+100);assert.deepEqual(c.entity,v.entity);
 c.ridingVehicleId=null;const left={...c.entity};bridge.applyVehiclePositions(new Float64Array([9,10.5,10.5,0,2]));assert.deepEqual(c.entity,left);
});
