import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../js/world.js';
import {WORLD_PRESETS,resolveWorldSettings} from '../js/world_settings.js';
import {CitySimulation} from '../js/city_simulation.js';
import {createSeaEdgeNavigation} from '../js/sea_edge_navigation.js';
import {SUBURBAN_PRESETS} from '../js/main_menu.js';

test('every landscape is selectable by URL and present in the new-city menu',()=>{
 for(const [name,preset]of Object.entries(WORLD_PRESETS)){
  const settings=resolveWorldSettings(new URLSearchParams(`seed=42&terrain=${name}`));assert.equal(settings.preset,name);assert.equal(settings.presetId,preset.id);assert(SUBURBAN_PRESETS.some(p=>p.id===name&&p.presetId===preset.id));
 }
 assert.equal(resolveWorldSettings(new URLSearchParams('terrain=unknown')).preset,'archipelago');
});

test('wet and dry profiles have clearly distinct water coverage across seeds',()=>{
 for(const seed of [42,1337,482910]){
  const water=id=>{const world=new World(id,seed,128);return world.map.reduce((sum,t)=>sum+(t===2),0)/world.map.length;};
  const dry=water(3),ordinary=water(0),mixed=water(5),wet=water(4);
  assert(dry<ordinary&&ordinary<mixed&&mixed<wet,`${seed}: ${[dry,ordinary,mixed,wet]}`);assert(wet-dry>.35);
 }
});

test('all map profiles found a real city with a reachable harbor and a route to open sea',()=>{
 for(const [name,preset]of Object.entries(WORLD_PRESETS))for(const seed of [3,4,42,1337]){
  const world=new World(preset.id,seed,128);let next=0;
  const city=new CitySimulation({world,population:24,startFoundingWorks:false,createEntity:data=>({id:++next,destroyed:false,...data})});city.initialize();
  const hall=city.buildings.find(b=>b.type==='townhall'),port=city.worldPort;
  assert(hall,`${name}/${seed}: town hall`);assert(port.berth,`${name}/${seed}: berth`);assert(port.edgeRoute?.length,`${name}/${seed}: sea route`);
  assert.notEqual(city.findPath(hall.door,port.door),null,`${name}/${seed}: land access`);assert(createSeaEdgeNavigation(world).reachable(port.berth));assert.equal(world.preset,name);assert.equal(world.presetId,preset.id);
 }
});

test('map dimensions and deterministic generation remain stable for every profile',()=>{
 for(const {id}of Object.values(WORLD_PRESETS)){
  const a=new World(id,12345,256),b=new World(id,12345,256);assert.deepEqual(a.map,b.map);assert.deepEqual(a.spawnCenter,b.spawnCenter);assert.equal(a.map.length,256*256);
 }
});

test('the original archipelago keeps its pre-profile terrain byte for byte',async()=>{
 const {createHash}=await import('node:crypto');
 // Captured from the generator before the profile expansion, not regenerated expectations.
 const originals=new Map([[42,'5150a40ef22f5ea04e19ee0986dd66fc3e2aa40df906dc3edc71526615438cb4'],[1337,'084359fe2f7f35193dc0732ad0a96b954d0bee4ee3388e0008efed9ac141d221'],[482910,'90538318850ecca3a2188f891a6092bb50e70f7034feaa7187b43d6b4ddfdd6a']]);
 for(const [seed,hash]of originals)assert.equal(createHash('sha256').update(new World(0,seed,128).map).digest('hex'),hash);
});

test('coasts follow the noise field rather than a forced water frame or central island',()=>{
 for(const {id}of Object.values(WORLD_PRESETS))for(const seed of [42,1337,482910]){
  const w=new World(id,seed,128),edge=[];
  for(let x=0;x<128;x++)edge.push(w.getTile(x,0),w.getTile(x,127));
  for(let y=1;y<127;y++)edge.push(w.getTile(0,y),w.getTile(127,y));
  assert(edge.some(t=>t!==2),`${id}/${seed}: artificial water frame`);
 }
});
