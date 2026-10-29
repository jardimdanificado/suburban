import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulationBridge,sampleCitizenMotion} from '../js/city_sim_bridge.js?v=map-default-256-1';
import {queueMotion} from '../js/city_motion.js';
import {TILE_FLOOR,TILE_WATER} from '../js/world_gen.js';

const world={width:5,height:3,getTile(x){return x===1?TILE_WATER:TILE_FLOOR;}};
test('motion packets immediately synchronize visibility when a person enters and exits',()=>{
 const citizen={needs:{},entity:{x:.5,y:.5}},sample={id:4,citizen,entity:citizen.entity,from:{x:.5,y:.5},to:{x:.5,y:.5}},bridge=Object.create(CitySimulationBridge.prototype);
 Object.assign(bridge,{city:{world},time:{paused:false},motionSamples:new Map([[4,sample]]),motion:new Map(),interpolate(){},applyVehiclePositions(){}});
 bridge.receiveMotion({positions:new Float64Array([4,.5,.5]),indoors:new Uint8Array([1])});assert.equal(citizen._renderInside,true);
 bridge.receiveMotion({positions:new Float64Array([4,.5,.5]),indoors:new Uint8Array([0])});assert.equal(citizen._renderInside,false);
});
test('compact worker motion interpolates an indoor position without changing the exterior path anchor',()=>{
 const citizen={id:4,needs:{},entity:{x:.5,y:.5},indoorLocation:{buildingId:9,floor:0,position:{x:1,y:1,z:0}}};
 const sample={id:4,citizen,entity:citizen.entity,from:{x:.5,y:.5},to:{x:.5,y:.5}},bridge=Object.create(CitySimulationBridge.prototype);
 Object.assign(bridge,{city:{world,society:{citizen:id=>id===4?citizen:null}},time:{paused:false},motionSamples:new Map([[4,sample]]),motion:new Map(),interiorMotion:new Map(),vehicleMotion:new Map(),interpolate(){},applyVehiclePositions(){}});
 bridge.receiveMotion({positions:new Float64Array([4,.5,.5]),inside:new Float64Array([4,1,1,0]),tick:1,elapsed:1});
 bridge.receiveMotion({positions:new Float64Array([4,.5,.5]),inside:new Float64Array([4,2,1.5,.9]),tick:2,elapsed:2});
 CitySimulationBridge.prototype.interpolate.call(bridge,performance.now()+700);
 assert.equal(citizen.entity.x,.5);assert.equal(citizen.entity.y,.5);assert.deepEqual(citizen._renderIndoorPosition,{x:2,y:1.5,z:.9});
 assert.equal(Object.keys(citizen).includes('_renderIndoorPosition'),false);
});
test('motion recovers at the authoritative land position after a blocked interpolation',()=>{
 const entity={x:.5,y:.5},sample={entity,from:{x:.5,y:.5},to:{x:.5,y:.5}};
 queueMotion(sample,.5,.5,1000,{reset:true});queueMotion(sample,2.5,.5,1100);
 assert.equal(sampleCitizenMotion(world,sample,1600),false);assert.equal(entity.x,.5);
 assert.equal(sampleCitizenMotion(world,sample,2200),true);assert.equal(entity.x,2.5);
});
