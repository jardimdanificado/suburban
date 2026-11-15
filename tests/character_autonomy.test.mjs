import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {canControl,characterMinute,controlledCitizen,updateCharacterGame} from '../js/character_game.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
import {reserveService,queueService} from '../js/city_service_queue.js';

function fixture(){
 const city=setup({starter:true,population:24}),c=city.citizens.find(c=>canControl(city,c)&&!c.jobId&&!c.businessIds.length);
 assert(c);assert(city.gameAction('start',{citizenId:c.id}));return {city,c};
}

test('automatic routine consumes real carried supplies while full control leaves decisions to the player',()=>{
 const {city,c}=fixture();assert.equal(city.characterGame.autonomous,false);assert(city.gameAction('autonomy',{enabled:true}));assert(!c.playerControlled);
 c.needs.food=20;c.needs.water=20;const food=c.provisions,water=c.pocket.water;city.update(.25);
 assert(c.needs.food>20);assert(c.needs.water>20);assert.equal(c.provisions,food-1);assert.equal(c.pocket.water,water-1);
 assert(city.gameAction('autonomy',{enabled:false}),city.lastError);assert(c.playerControlled);assert.equal(city.characterGame.autonomous,false);
 c.needs.food=20;c.needs.water=20;const remainingFood=c.provisions,remainingWater=c.pocket.water;city.update(.25);
 assert(c.needs.food<20);assert(c.needs.water<20);assert.equal(c.provisions,remainingFood);assert.equal(c.pocket.water,remainingWater);assert.equal(c.path.length,0);
});

test('automatic mode blocks WASD without cancelling the NPC route and accepts a finite order',()=>{
 const {city,c}=fixture();assert(city.gameAction('autonomy',{enabled:true}));for(const key of Object.keys(c.needs))c.needs[key]=100;
 c.path=[{x:c.entity.x+.2,y:c.entity.y}];c.task='leisure';const path=c.path;
 assert(!city.gameAction('input',{x:1,y:0}));assert.equal(c.path,path);assert(city.gameAction('input',{x:0,y:0}));assert.equal(c.path,path);
 const target={x:c.entity.x+.2,y:c.entity.y};assert(city.gameAction('walk',target));assert(c.playerControlled);assert.equal(city.characterGame.intent.kind,'walk');
 for(let i=0;i<20&&city.characterGame.intent;i++)city.update(.1);
 assert.equal(city.characterGame.intent,null);assert.equal(city.characterGame.autonomous,true);assert(!c.playerControlled);
 assert(city.gameAction('drink'));assert(!c.playerControlled);assert.equal(characterMinute(city,c),false,'Routine must return to the normal citizen AI');
});

test('manual takeover waits for a real service reservation to finish and preserves its ticket',()=>{
 const {city,c}=fixture(),hall=city.buildings.find(b=>b.type==='townhall');assert(city.gameAction('autonomy',{enabled:true}));Object.assign(c.entity,hall.door);c.task='water';c.targetId=hall.id;
 const ticket=reserveService(city,c,hall,'water','water');assert(city.gameAction('autonomy',{enabled:false}));
 assert(city.characterGame.autonomous);assert(city.characterGame.manualPending);assert(hall.serviceQueue.includes(ticket));assert.equal(c.task,'water');assert(!c.playerControlled);
 updateCharacterGame(city);assert(city.characterGame.manualPending);
 assert(queueService(city,c,hall,'water','water',true));updateCharacterGame(city);
 assert(!city.characterGame.manualPending);assert(!city.characterGame.autonomous);assert(c.playerControlled);assert.equal(c.task,null);assert(!hall.serviceQueue.includes(ticket));
});

test('pending takeover can be cancelled without stopping a service',()=>{
 const {city,c}=fixture(),hall=city.buildings.find(b=>b.type==='townhall');assert(city.gameAction('autonomy',{enabled:true}));c.task='water';c.targetId=hall.id;const ticket=reserveService(city,c,hall,'water','water');
 assert(city.gameAction('autonomy',{enabled:false}));assert(city.gameAction('autonomy',{enabled:true}));assert(!city.characterGame.manualPending);assert(city.characterGame.autonomous);assert(hall.serviceQueue.includes(ticket));assert.equal(c.task,'water');
});

test('autonomy survives state snapshots and selected citizens cannot be shipped out of the played world',()=>{
 const {city,c}=fixture();assert(city.gameAction('autonomy',{enabled:true}));const graph=new CityStateGraph(),restored=new CityStateGraph().apply(graph.encode({city})).city;bindCityState(restored);
 assert(restored.characterGame.autonomous);assert(!controlledCitizen(restored).playerControlled);assert.equal(restored.worldBoatCrewEligible(controlledCitizen(restored)),false);
 assert(restored.gameAction('autonomy',{enabled:false}));assert(controlledCitizen(restored).playerControlled);assert(city.characterGame.autonomous,'Mirror changes must not mutate the original');
});

test('a directed building visit releases interior exploration back to the automatic routine',()=>{
 const {city,c}=fixture(),hall=city.buildings.find(b=>b.type==='townhall');assert(city.gameAction('autonomy',{enabled:true}));for(const key of Object.keys(c.needs))c.needs[key]=100;
 Object.assign(c.entity,hall.door);assert(city.gameAction('enter',{buildingId:hall.id}));for(let i=0;i<100&&city.characterGame.intent;i++)city.update(.1);
 assert.equal(city.characterGame.intent,null);assert(city.characterGame.autonomous);assert(!c.playerControlled);assert.notEqual(c.task,'player-explore');assert.equal(characterMinute(city,c),false);
});
