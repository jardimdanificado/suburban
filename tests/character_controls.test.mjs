import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {canControl,movementVector} from '../js/character_game.js';
import {nearbyTargets,interactionOptions} from '../js/character_interactions.js';
import {TILE_WATER} from '../js/world_gen.js';
import {sampleCitizenMotion,CitySimulationBridge} from '../js/city_sim_bridge.js';
function fixture(){const city=setup({starter:true,population:24}),c=city.citizens.find(c=>canControl(city,c));assert(city.gameAction('start',{citizenId:c.id}));return {city,c};}
test('movement maps screen directions through the camera without diagonal acceleration',()=>{
 const right=movementVector(1,0),up=movementVector(0,-1);assert(right.x>0&&right.y<0);assert(up.x<0&&up.y<0);
 assert(Math.abs(Math.hypot(...Object.values(movementVector(1,1)))-1)<1e-10);assert.deepEqual(movementVector(0,0),{x:0,y:0});
});
test('direct movement immediately reverses without invoking the NPC path finder',()=>{
 const {city,c}=fixture(),find=city.findPath;city.findPath=()=>{throw Error('Manual movement must not pathfind');};
 assert(city.gameAction('input',{x:1,y:0}));city.update(.05);const x=c.entity.x;assert(city.gameAction('input',{x:-1,y:0}));city.update(.05);assert(c.entity.x<x);city.findPath=find;
});
test('manual movement cannot cross a blocked terrain tile',()=>{
 const {city,c}=fixture(),x=Math.floor(c.entity.x),y=Math.floor(c.entity.y);city.world.setTile(x+1,y,TILE_WATER);assert(city.gameAction('input',{x:1,y:0}));for(let i=0;i<10;i++)city.update(.1);assert(c.entity.x<x+1);assert.equal(c.entity.y,y+.5);
});
test('interaction lists only physically reachable targets and rejects a remote action',()=>{
 const {city,c}=fixture(),hall=city.buildings.find(b=>b.type==='townhall');c.entity.x=hall.door.x+10;c.entity.y=hall.door.y;
 assert(!nearbyTargets(city,c).some(t=>t.kind==='building'&&t.id===hall.id));assert(!city.gameAction('interact',{kind:'building',targetId:hall.id,choice:'water'}));
 Object.assign(c.entity,hall.door);const target=nearbyTargets(city,c).find(t=>t.kind==='building'&&t.id===hall.id);assert(target);assert(interactionOptions(city,target).some(o=>o.id==='water'));assert(city.gameAction('interact',{kind:'building',targetId:hall.id,choice:'water'}));
});
test('entering a public building keeps exploration inside and lets the player leave explicitly',()=>{
 const {city,c}=fixture(),hall=city.buildings.find(b=>b.type==='townhall');Object.assign(c.entity,hall.door);assert(city.gameAction('enter',{buildingId:hall.id}));
 for(let i=0;i<80&&city.characterGame.intent;i++)city.update(.1);assert.equal(c.indoorLocation?.buildingId,hall.id);assert.equal(c.task,'player-explore');const position={x:c.entity.x,y:c.entity.y};for(let i=0;i<8;i++)city.update(.1);assert.equal(c.entity.x,position.x);assert.equal(c.entity.y,position.y);
 let moved=false;for(const [x,y] of [[1,0],[-1,0],[0,1],[0,-1]]){const before={...c.indoorLocation.position};assert(city.gameAction('input',{x,y}));for(let i=0;i<4;i++)city.update(.05);const after=c.indoorLocation.position;moved ||= Math.hypot(after.x-before.x,after.y-before.y)>.01;assert.equal(c.indoorLocation.buildingId,hall.id);}assert(moved,'Manual controls move through the actual interior');assert(city.gameAction('input',{x:0,y:0}));
 assert(city.gameAction('exit'));for(let i=0;i<100&&c.indoorLocation;i++)city.update(.1);assert(!c.indoorLocation);assert(!c.path.length,'No autonomous entrance dispersal should move the player');
});
test('shore water consumes body volume and preserves the choice to drink contaminated water',()=>{
 const {city,c}=fixture(),x=Math.floor(c.entity.x),y=Math.floor(c.entity.y);city.world.setTile(x+1,y,TILE_WATER);city.water.reconcile();c.pocket.water=0;
 const target=nearbyTargets(city,c).find(t=>t.kind==='water');assert(target);const volume=city.water.bodies[target.id].volume;assert(city.gameAction('interact',{kind:'water',targetId:target.id,choice:'fill'}));assert.equal(c.pocket.water,6);assert.equal(city.water.bodies[target.id].volume,volume-6);assert(c.pocket.waterContamination>0);const health=c.needs.health;assert(city.gameAction('drink'));assert(c.needs.health<health);
});
test('controlled motion has no observer delay and releases consumed render samples',()=>{
 const c={playerControlled:true},sample={citizen:c,entity:{x:0,y:0},to:{x:1,y:2},points:[{x:0,y:0,at:0},{x:1,y:2,at:100}]};assert(sampleCitizenMotion({},sample,100));assert.deepEqual(sample.entity,{x:1,y:2});assert.equal(sample.points.length,0);
});
test('compact control messages update the player without decoding a world snapshot',()=>{
 const {city,c}=fixture(),bridge=Object.create(CitySimulationBridge.prototype);Object.assign(bridge,{active:true,cityId:'test',city});bridge.receive({type:'player-control',cityId:'test',citizenId:c.id,input:{x:1,y:0,run:true},intent:{kind:'manual'},task:'player-walk',action:'Caminhando'});assert.equal(city.characterGame.input.run,true);assert.equal(city.characterGame.intent.kind,'manual');assert.equal(c.task,'player-walk');
});
