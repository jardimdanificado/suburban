import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulationBridge} from '../js/city_sim_bridge.js';
import {TILE_FLOOR} from '../js/world_gen.js';

test('vehicle packets and subsequent render updates keep riders at the vehicle position',()=>{
 const c={id:4,ridingVehicleId:9,entity:{x:1,y:1}},passenger={id:5,ridingVehicleId:9,entity:{x:1,y:1}},v={id:9,driverId:4,passengerIds:[5],entity:{x:1,y:1}};
 const bridge=Object.assign(Object.create(CitySimulationBridge.prototype),{city:{world:{width:20,height:20,getTile:()=>TILE_FLOOR},vehicles:{units:new Map([[9,v]])},society:{citizen:id=>id===4?c:id===5?passenger:null}},time:{paused:false},vehicleMotion:new Map(),motion:new Map(),interiorMotion:new Map()});
 bridge.applyVehiclePositions(new Float64Array([9,2.5,3.5,0,1]),1000);
 bridge.applyVehiclePositions(new Float64Array([9,4.5,5.5,0,1]),1100);
 bridge.interpolate(1230);
 assert.ok(v.entity.x>2.5&&v.entity.x<4.5);
 assert.equal(v.x,4.5);assert.equal(v.y,5.5);
 assert.deepEqual(v.entity,c.entity);
 assert.equal(passenger.entity.x,v.entity.x-Math.sin(v.angle)*.38);
 assert.equal(passenger.entity.y,v.entity.y-Math.cos(v.angle)*.38);
 const previous=v.entity.x;bridge.interpolate(1246);assert.ok(v.entity.x>previous);

 const motion={id:4,entity:c.entity,citizen:c,to:{x:7.5,y:7.5},points:[]};bridge.motion.set(4,motion);bridge.interpolate(1262);assert.deepEqual(c.entity,v.entity);
 c.ridingVehicleId=null;const left={...c.entity};bridge.applyVehiclePositions(new Float64Array([9,10.5,10.5,0,2]));assert.deepEqual(c.entity,left);
});

test('slow bike samples interpolate position and shortest heading arc between packets',()=>{
 const v={id:9,entity:{x:1,y:1}},bridge=Object.assign(Object.create(CitySimulationBridge.prototype),{city:{vehicles:{units:new Map([[9,v]])},society:{citizen:()=>null}},time:{paused:false},vehicleMotion:new Map(),motion:new Map(),interiorMotion:new Map()});
 bridge.applyVehiclePositions(new Float64Array([9,1,1,0,Math.PI-.1]),1000);
 bridge.applyVehiclePositions(new Float64Array([9,1.025,1,0,-Math.PI+.1]),1100);
 bridge.interpolate(1230);const first=v.entity.x;
 assert.ok(first>1&&first<1.025);assert.ok(Math.abs(Math.abs(v.angle)-Math.PI)<.02);
 bridge.interpolate(1246);assert.ok(v.entity.x>first&&v.entity.x<1.025);
 bridge.time.paused=true;const paused={...v.entity};bridge.interpolate(1290);assert.deepEqual(v.entity,paused);
 bridge.time.paused=false;bridge.motionOptions={smoothMovement:false};
 bridge.applyVehiclePositions(new Float64Array([9,2,1,0,0]),1300);assert.equal(v.entity.x,2);
 bridge.motionOptions.smoothMovement=true;
 bridge.applyVehiclePositions(new Float64Array([9,15,1,0,0]),1400);assert.equal(v.entity.x,15);
});
