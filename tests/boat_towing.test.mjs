import test from 'node:test';
import assert from 'node:assert/strict';
import {planBoatTrip,advanceLocalBoatTrip,boatRouteTime,boatTowClear,releaseLocalBoatTrip} from '../js/city_boat_towing.js';
import {CitySimulation} from '../js/city_simulation.js';
import {CityVehicles} from '../js/city_vehicles.js';
import {TILE_FLOOR,TILE_WATER,TILE_SAND,TILE_ROAD_SAND_STONE} from '../js/world_gen.js';
function fixture({bike=true,boatOnLand=true,kind='canoe'}={}){
 const width=32,height=24,map=new Uint8Array(width*height).fill(TILE_FLOOR),world={width,height,map,revision:1,getTile(x,y){return x<0||y<0||x>=width||y>=height?5:map[y*width+x];}};
 const person={id:1,accountId:'person:1',businessIds:[],entity:{x:5.5,y:12.5,properties:{name:'Pessoa'}},task:'walk',targetId:null,path:[]};person.entity.properties.citizen=person;
 const boat={id:2,good:kind,boatClass:kind,x:boatOnLand?6.5:12.5,y:12.5,active:true,condition:100,ownerAccountId:person.accountId,pickLength:2.6,pickWidth:.65,distance:0,entity:{x:0,y:0}};
 const cycle={id:3,good:kind==='launch'?'bicicleta_carga':'bicicleta',x:5.5,y:12.5,active:true,condition:100,ownerAccountId:person.accountId,entity:{x:5.5,y:12.5}};
 const city=Object.assign(Object.create(CitySimulation.prototype),{world,occupied:new Set(),obstacleRevision:0,structureRevision:0,citizens:[person],buildings:[],minute:0,pathCache:new Map(),building:()=>null,worldPort:{accountId:'port'},society:{citizen:id=>id===1?person:null,isAdult:()=>true},logistics:{shipments:[]},currency:{price:v=>v},payerFor:c=>c.accountId,transfer:()=>true});
 city.vehicles=new CityVehicles(city);city.vehicles.units=new Map([[boat.id,boat],...(bike?[[cycle.id,cycle]]:[])]);city.vehicles.boatCount=1;city.vehicles.activeCount=bike?1:0;
 for(let y=3;y<21;y++)for(let x=12;x<18;x++)map[y*width+x]=TILE_WATER;
 return {city,person,boat,cycle,goal:{x:23.5,y:12.5}};
}
function finish(city,person,max=2000){let modes=new Set(),positions=[];for(let i=0;i<max&&(person.path.length||person.localBoatTrip);i++){modes.add(person.path[0]?.transportMode);advanceLocalBoatTrip(city,person,.05);const boat=city.vehicles.units.get(2);positions.push({x:boat.x,y:boat.y});}assert.equal(person.path.length,0);assert.equal(person.localBoatTrip,null);return {modes,positions};}

test('an owned canoe is retrieved, towed, launched across an inland lake and brought to the destination',()=>{
 const {city,person,boat,cycle,goal}=fixture();
 person.path=planBoatTrip(city,person.entity,goal);assert(person.path);assert(person.path.some(p=>p.transportMode==='tow'));assert(person.path.some(p=>p.transportMode==='sail'));
 const before={x:boat.x,y:boat.y};assert.equal(boat.driverId,undefined,'planning must not reserve assets or move them');
 const {modes,positions}=finish(city,person);assert(modes.has('tow'));assert(modes.has('sail'));assert(Math.hypot(boat.x-goal.x,boat.y-goal.y)<.01);assert(Math.hypot(cycle.x-goal.x,cycle.y-goal.y)<.01);assert.equal(boat.localTripCitizenId,null);assert.equal(cycle.driverId,null);
 let previous=before;for(const p of positions){assert(Math.hypot(p.x-previous.x,p.y-previous.y)<=.05*4*1.15+.001,'hull motion must be physical');previous=p;}
});

test('a water shortcut competes with an existing route around the lake',()=>{
 const {city,person}=fixture({boatOnLand:false,bike:false});person.entity.x=10.5;const goal={x:19.5,y:12.5};
 const land=city.findPath(person.entity,goal,{allowBoats:false}),chosen=city.findPath(person.entity,goal);
 assert(land?.length);assert(chosen?.some(p=>p.boatClass));assert(boatRouteTime(city,person.entity,chosen)<boatRouteTime(city,person.entity,land));
});

test('unavailable, foreign or oversized rigs cannot be towed; a short land trip avoids boat detours',()=>{
 for(const change of [({cycle})=>cycle.driverId=9,({boat})=>boat.ownerAccountId='other',({boat})=>boat.worldFleetReserved=true,({boat})=>boat.boatClass='cargo',({cycle})=>cycle.good='skate']){
  const f=fixture();change(f);assert.equal(planBoatTrip(f.city,f.person.entity,f.goal),null);
 }
 const {city,person}=fixture();const path=city.findPath(person.entity,{x:6.5,y:13.5});assert(path);assert(!path.some(p=>p.boatPlan||p.boatClass));
});

test('reservations prevent double use and interruption releases both real vehicles in place',()=>{
 const {city,person,boat,cycle,goal}=fixture();person.path=planBoatTrip(city,person.entity,goal);advanceLocalBoatTrip(city,person,.1);
 const other={...person,id:7,localBoatTrip:null,entity:{x:5.5,y:12.5,properties:{}}};other.entity.properties.citizen=other;
 assert.equal(planBoatTrip(city,other.entity,goal),null);
 const position={x:boat.x,y:boat.y};person.task='food';advanceLocalBoatTrip(city,person,.1);
 assert.equal(person.localBoatTrip,null);assert.equal(boat.driverId,null);assert.equal(cycle.driverId,null);assert.deepEqual({x:boat.x,y:boat.y},position);
});

test('a stale plan cannot summon a boat that moved after planning',()=>{
 const {city,person,boat,goal}=fixture();person.path=planBoatTrip(city,person.entity,goal);boat.x+=8;advanceLocalBoatTrip(city,person,.1);assert.equal(person.localBoatTrip,undefined);assert.equal(person.path.length,0);assert.equal(boat.driverId,undefined);
});

test('hull clearance rejects a narrow corridor and new obstacles stop an active tow',()=>{
 const {city,person,boat,goal}=fixture();city.occupied.add('8,12');assert.equal(boatTowClear(city,boat,8.5,12.5,1,0),false);city.occupied.clear();
 person.path=planBoatTrip(city,person.entity,goal);for(let i=0;i<30&&!person.localBoatTrip?.pickedUp;i++)advanceLocalBoatTrip(city,person,.1);
 const next=person.path[0];city.occupied.add(`${Math.floor(next.x)},${Math.floor(next.y)}`);advanceLocalBoatTrip(city,person,.1);assert.equal(person.localBoatTrip,null);assert.equal(boat.driverId,null);
});

test('company employees use company rigs; cargo must fit the actual vessel',()=>{
 const {city,person,boat,cycle,goal}=fixture({kind:'launch'});boat.ownerAccountId=cycle.ownerAccountId='company:4';person.jobId=4;city.building=id=>id===4?{accountId:'company:4'}:null;
 person.deliveryLoad=8;assert(planBoatTrip(city,person.entity,goal));person.deliveryLoad=9;assert.equal(planBoatTrip(city,person.entity,goal),null);
 cycle.good='bicicleta';person.deliveryLoad=1;assert.equal(planBoatTrip(city,person.entity,goal),null,'a launch needs a cargo bike');
});

test('cancelling mid-lake first reaches a physical shore and then releases the rig',()=>{
 const {city,person,boat,goal}=fixture();person.path=planBoatTrip(city,person.entity,goal);
 for(let i=0;i<500&&!(boat.x>14&&boat.x<17);i++)advanceLocalBoatTrip(city,person,.05);
 assert.equal(city.world.getTile(Math.floor(boat.x),Math.floor(boat.y)),TILE_WATER);const previous={x:boat.x,y:boat.y};
 person.task='food';person.path=[];advanceLocalBoatTrip(city,person,.05);assert(person.localBoatTrip?.cancelAtShore);assert.deepEqual({x:boat.x,y:boat.y},previous);
 finish(city,person);assert(city.walkable(Math.floor(person.entity.x),Math.floor(person.entity.y)));assert.equal(boat.driverId,null);
});

test('an inland workshop physically collects a damaged boat before consuming parts or charging for repair',()=>{
 const {city,person,boat,cycle,goal}=fixture();boat.condition=30;cycle.ownerAccountId='workshop:4';person.skills={maintenance:100};
 const workshop={id:4,accountId:'workshop:4',door:goal,entity:{properties:{name:'Oficina'}},inventory:{tabuas:2,cordas:1,ferragens_navais:1}};
 let payments=0;city.transfer=()=>{payments++;return true;};city.economy={goods:{tabuas:{price:1},cordas:{price:1},ferragens_navais:{price:1}},consumed:{tabuas:0,cordas:0,ferragens_navais:0},recordGoods(){}};city.politics={policy:{minimumWage:1}};
 assert(city.vehicles.boatWorkshopWork(workshop,person));assert.equal(workshop.inventory.tabuas,2);assert.equal(payments,0);assert(person.boatTowService);
 finish(city,person);assert(Math.hypot(boat.x-goal.x,boat.y-goal.y)<=4);assert.equal(boat.condition,30);
 assert(city.vehicles.boatWorkshopWork(workshop,person));assert.equal(payments,1);assert.equal(workshop.inventory.tabuas,0);
 for(let i=0;i<40&&boat.condition<100;i++)city.vehicles.boatWorkshopWork(workshop,person);
 assert.equal(boat.condition,100);assert.equal(boat.maintenanceHistory.length,1);assert.equal(city.vehicles.stats.repairs,1);
});

test('a saved trip resumes with the same reserved hull and bike, without copying either asset',()=>{
 const {city,person,boat,goal}=fixture();person.path=planBoatTrip(city,person.entity,goal);for(let i=0;i<80;i++)advanceLocalBoatTrip(city,person,.05);
 const saved=structuredClone({person,units:city.vehicles.units}),restored=saved.person;city.vehicles.units=saved.units;city.citizens=[restored];city.society.citizen=id=>id===restored.id?restored:null;
 finish(city,restored);assert.equal(city.vehicles.units.size,2);assert(Math.hypot(city.vehicles.units.get(boat.id).x-goal.x,city.vehicles.units.get(boat.id).y-goal.y)<.01);
});

test('the normal simulation update drives the tow once and does not invoke ground recovery on water',async()=>{
 const {CityLife}=await import('../js/city_life.js');
 const {city,person,boat,goal}=fixture();person.path=planBoatTrip(city,person.entity,goal);city.life=new CityLife(city);city._movingCitizens=[person];city.accumulator=0;city.minute=0;city.justice={mobilityFactor:()=>1};
 // Keep the minute scheduler inert here; the production update and vehicle synchronization still run.
 city.stepMinute=()=>{};
 for(let i=0;i<1000&&(person.path.length||person.localBoatTrip);i++){city.update(.05);if(person.localBoatTrip)assert.equal(city.life.recoverBlockedPosition(person),false);}
 assert.equal(person.localBoatTrip,null);assert.equal(person.path.length,0);assert(Math.hypot(boat.x-goal.x,boat.y-goal.y)<.01);assert.equal(city.vehicles.units.size,2);
});


test('a faster bicycle detour keeps priority over an available water shortcut',()=>{
 const {city,person,cycle}=fixture({boatOnLand:false});person.entity.x=10.5;cycle.x=10.5;const goal={x:19.5,y:12.5};
 for(let i=0;i<city.world.map.length;i++)if(city.world.map[i]!==TILE_WATER)city.world.map[i]=TILE_ROAD_SAND_STONE;
 const ground=city.findPath(person.entity,goal,{allowBoats:false});assert(ground?.length);
 const waterShortcut=planBoatTrip(city,person.entity,goal);assert(waterShortcut,'a water shortcut is available');
 assert.equal(planBoatTrip(city,person.entity,goal,{groundPath:ground}),null,'the accessible bicycle makes the road detour faster');
});

test('a queued trip rejects cargo that exceeds the reserved hull capacity',()=>{
 const {city,person,boat,goal}=fixture();person.path=planBoatTrip(city,person.entity,goal);assert(person.path);
 person.deliveryLoad=100;advanceLocalBoatTrip(city,person,.1);
 assert.equal(person.localBoatTrip,undefined);assert.equal(person.path.length,0);assert.equal(boat.driverId,undefined);
});
