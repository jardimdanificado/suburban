import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceCitizenInterior,timeInteriorJourney} from '../js/city_interiors.js';
import {bodyMovementSpeedFactor} from '../js/city_body_metrics.js?v=body-morph-4';
import {injuryMovementFactor} from '../js/city_injury_effects.js';
import {CityVoting} from '../js/city_voting.js';
import {setup} from './helpers/city.mjs';

test('ordinary interior access moves along every segment without jumping through the corner',()=>{
 const c={entity:{x:0,y:0},indoorLocation:{position:{x:0,y:0,z:0},path:[{x:3,y:0,z:0},{x:3,y:4,z:0}],targetUnitId:'desk'}};
 timeInteriorJourney(c.indoorLocation);assert.equal(c.indoorLocation.path.length,2);
 const minute=1/(bodyMovementSpeedFactor(c)*injuryMovementFactor(c));
 for(let i=1;i<=7;i++){
  advanceCitizenInterior({minute:i},c,minute);
  assert.ok(Math.abs(c.entity.x-Math.min(i,3))<1e-5);assert.ok(Math.abs(c.entity.y-Math.max(0,i-3))<1e-5);
  if(i<7)assert.equal(c.indoorLocation.unitId,undefined);
 }
 assert.equal(c.indoorLocation.unitId,'desk');
});
function electionFixture(){
 const c={id:1,entity:{x:.5,y:.5},task:null,path:[],needs:{food:90,water:90,energy:80,toilet:90,hygiene:90,health:90},sleep:{active:false,minutes:395}};
 const hall={id:2,door:{x:100.5,y:.5},entity:{destroyed:false}},city={minute:480,world:{getTile:()=>0},society:{citizen:()=>c},building:()=>hall,urgentNeed:()=>null,findPath:()=>[{...hall.door}]};
 const e={id:1,pollingBuildingId:2,voteAt:480},row={citizenId:1,plannedAt:600};return {c,city,e,row,voting:new CityVoting(city)};
}
test('awake voters with unfinished sleep can leave, while active sleep and hygiene recovery remain protected',()=>{
 const f=electionFixture();f.row.plannedAt=480;f.voting.route(f.e,f.row);assert.equal(f.c.task,'vote');
 for(const task of ['energy','hygiene']){const g=electionFixture();g.c.task=task;if(task==='energy')g.c.sleep.active=true;else g.c.needs.hygiene=20;
  assert.equal(g.voting.route(g.e,g.row),false);assert.equal(g.c.task,task);
 }
});
test('voting departs ahead of planned arrival using the actual route, with a bounded planning pass',()=>{
 const f=electionFixture();f.row.plannedAt=720;assert.equal(f.voting.route(f.e,f.row),true);assert.ok(f.row.departureAt<f.row.plannedAt-50);assert.equal(f.c.task,null);
 f.city.minute=f.row.departureAt;assert.equal(f.voting.route(f.e,f.row),true);assert.equal(f.c.task,'vote');
});
test('urgent health and hygiene interrupt active sleep before terminal health, preserving remaining sleep',()=>{
 for(const need of ['health','hygiene']){
  const city=setup({starter:true,population:8}),c=city.citizens.find(c=>city.society.isAdult(c));
  for(const key in c.needs)c.needs[key]=90;c.needs[need]=need==='health'?19:5;c.needs.energy=10;
  c.task='energy';c.path=[];c.indoorLocation=null;c.deliveryId=null;c.cleaningJobId=null;c.workMeal=null;c.sleep={active:true,minutes:200,lastMinute:city.minute,lastWakeAt:0,completed:0};
  const selected=[];city.chooseTask=(person,urgent)=>{if(person===c){selected.push(urgent);person.task=urgent;person.path=[];}};city.performTask=()=>{};
  city.stepMinute();assert.ok(selected.includes(need));assert.equal(c.sleep.active,false);assert.ok(c.sleep.minutes>=200&&c.sleep.minutes<480);
 }
});

test('long detours advance voting departure more than a short direct route',()=>{
 const direct=electionFixture(),detour=electionFixture();direct.row.plannedAt=detour.row.plannedAt=1000;
 detour.city.findPath=()=>[{x:.5,y:100.5},{x:100.5,y:100.5},{x:100.5,y:.5}];
 direct.voting.route(direct.e,direct.row);detour.voting.route(detour.e,detour.row);
 assert.ok(detour.row.departureAt<direct.row.departureAt-100);
});

test('a legacy timed interior save rebuilds a real route without jumping to the destination',async()=>{
 const {interiorUsePoint}=await import('../js/city_interior_layout.js');
 const b={id:'b',entity:{x:10,y:20},width:1,depth:4,floors:3,rotation:0,layoutRevision:1,circulation:[],units:[]};
 for(let z=0;z<3;z++)for(let y=0;y<4;y++)b.units.push({id:`${z}:${y}`,x:0,y,z,roomType:'circulation'});
 const target=interiorUsePoint(b,b.units.at(-1),'bathroom'),position={x:10.5,y:20.5,z:0};
 const c={id:4,entity:{x:position.x,y:position.y},indoorLocation:{buildingId:'b',position:{...position},path:[target],travelRemaining:.01,targetUnitId:'desk'}};
 advanceCitizenInterior({minute:1,building:id=>id==='b'?b:undefined},c,.01);
 assert.equal(c.indoorLocation.travelRemaining,undefined);assert.ok(c.indoorLocation.path.length>1);
 assert.ok(Math.hypot(c.entity.x-position.x,c.entity.y-position.y,c.indoorLocation.position.z)<.02);assert.equal(c.indoorLocation.unitId,undefined);
});

test('unfinished sleep does not cancel an awake, rested voter on the next simulation minute',()=>{
 const city=setup({starter:true,population:8}),c=city.citizens.find(c=>city.society.isAdult(c));
 for(const key in c.needs)c.needs[key]=90;
 c.task='vote';c.path=[{x:100.5,y:100.5}];c.indoorLocation=null;c.deliveryId=null;c.cleaningJobId=null;c.workMeal=null;c.conversation=null;
 c.sleep={active:false,minutes:395,lastMinute:city.minute-1,lastWakeAt:0,completed:0};
 city.stepMinute();assert.equal(c.task,'vote');assert.equal(c.sleep.active,false);assert.equal(c.sleep.minutes,395);
});

test('early voting estimates keep the existing two-route-per-minute budget',()=>{
 const f=electionFixture();let searches=0;f.city.findPath=()=>{searches++;return [{x:100.5,y:.5}];};
 Object.assign(f.e,{status:'voting',closesAt:1080,queue:[],stations:[],routingCursor:0,electorate:Array.from({length:8},()=>({citizenId:1,status:'pending',plannedAt:1000,nextAttemptAt:480}))});f.e.roll=new Map();f.city.politics={active:f.e};
 f.voting.updateMinute();assert.equal(searches,2);assert.equal(f.e.electorate.filter(row=>row.departureAt!=null).length,2);
});

test('voting waits for an existing vehicle journey instead of replacing its destination',()=>{
 for(const journey of [{localBoatTrip:{}},{sharedBoatRide:{state:'aboard'}},{mobilityTrip:{stage:'riding'},ridingVehicleId:9}]){
  const f=electionFixture();Object.assign(f.c,journey);f.c.task='work';f.voting.route(f.e,f.row);
  assert.equal(f.c.task,'work');assert.equal(f.c.voting,undefined);
 }
});
