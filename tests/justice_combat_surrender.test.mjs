import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';
import {setup as setupCityFixture} from './helpers/city.mjs';

function setup(){
 const actor={id:1,entity:{x:0,y:0,destroyed:false,properties:{name:'Agressor'}},skills:{combat:70},equipment:{weapon:{good:'porrete',name:'Porrete',damage:4,range:1.8,durability:4}},inventory:{porrete:1},needs:{health:100}},target={id:2,entity:{x:1,y:0,destroyed:false,properties:{name:'Alvo'}},skills:{combat:10},traits:{riskTolerance:.1},equipment:{},needs:{health:35},task:'work',path:[{x:4,y:4}],targetId:9};
 const events=[];let minute=100;const city={get minute(){return minute;},citizens:[actor,target],society:{getRelation:()=>null,citizen:id=>id===1?actor:target},random:()=>0,economy:{practice(){}},log:(message,channel,ids,details)=>{events.push(details);return {id:events.length};}};const justice=new CityJustice(city),records=[];justice.crimeRecord=(type,offenderId,victimId,details)=>{const record={id:records.length+1,type,offenderId,victimId,details};records.push(record);return record;};return {actor,target,city,justice,events,records,setMinute(value){minute=value;}};
}

test('a badly injured resident can surrender to an armed aggressor before being struck',()=>{
 const {actor,target,city,justice,events,records}=setup(),health=target.needs.health;target.conversation={a:target.id,b:actor.id};actor.conversation=target.conversation;
 assert.equal(justice.combatEncounter(actor,target),true);assert.equal(target.needs.health,health);assert.equal(target.combatInjuries,undefined);assert.equal(target.surrenderedUntil,city.minute+15);assert.equal(target.action,'Rendeu-se durante uma agressão');assert.deepEqual(target.path,[]);assert.equal(target.task,null);assert.equal(target.conversation,null);assert.equal(actor.conversation,null);assert.equal(records[0].details.outcome,'target-surrendered');assert.equal(records[0].details.attempted,true);assert.equal(events.at(-1).kind,'combat-surrender');
});

test('a surrendered person cannot be struck again until the timed surrender ends',()=>{
 const {actor,target,city,justice,records,setMinute}=setup();assert.equal(justice.combatEncounter(actor,target,{forced:true}),true);const count=records.length;assert.equal(justice.combatEncounter(actor,target,{forced:true}),false);assert.equal(records.length,count);assert.equal(target.combatInjuries,undefined);setMinute(115);justice.updateInjuries(target);assert.equal(target.surrenderedUntil,null);assert.equal(target.action,null);
});

test('surrender requires a visible threat and does not trigger for a healthy target facing an unarmed person',()=>{
 const {actor,target,justice}=setup();actor.equipment.weapon=null;actor.needs={health:100};target.needs.health=100;target.traits.riskTolerance=0;assert.equal(justice.combatSurrenderChance(actor,target,null),0);
});

test('an injured resident can flee to an accessible public building without taking a hit',()=>{
 const {actor,target,city,justice,records}=setup(),safe={id:10,type:'police_station',active:true,entity:{destroyed:false,properties:{name:'Delegacia'}},door:{x:5,y:4}};actor.equipment.weapon=null;actor.skills.combat=80;target.needs.health=60;city.buildings=[safe];city.building=id=>id===safe.id?safe:null;city.findPath=()=>[{x:2,y:0},{x:3,y:1}];
 assert.equal(justice.combatEncounter(actor,target,{forced:true}),true);assert.equal(target.needs.health,60);assert.equal(target.combatInjuries,undefined);assert.equal(target.task,'combat-flee');assert.deepEqual(target.path,[{x:2,y:0},{x:3,y:1}]);assert.equal(target.combatFlee.safeBuildingId,safe.id);assert.equal(records[0].details.outcome,'target-fled');assert.equal(records[0].details.fleeDestinationId,safe.id);
});

test('a person cannot flee by teleport when every public destination lacks a route',()=>{
 const {actor,target,city,justice,records}=setup();actor.equipment.weapon=null;target.needs.health=60;city.buildings=[{id:10,type:'police_station',active:true,entity:{destroyed:false,properties:{name:'Delegacia'}},door:{x:80,y:80}}];city.building=()=>city.buildings[0];city.findPath=()=>null;
 assert.equal(justice.combatEncounter(actor,target,{forced:true}),true);assert.equal(target.combatFlee,undefined);assert.equal(records[0].details.outcome,undefined);assert.equal(target.combatInjuries.length,1);
});

test('violent robbery records an attempt but transfers no money when the victim escapes',()=>{
 const {actor,target,city,justice}=setup();actor.accountId='citizen:1';target.accountId='citizen:2';city.society.isAdult=()=>true;city.accounts=new Map([[actor.accountId,{balance:0}],[target.accountId,{balance:500}]]);let transfers=0;city.transfer=()=>{transfers++;return true;};justice.combatEncounter=()=>{justice.cases.push({id:1,type:'assault',details:{outcome:'target-fled'}});return true;};justice.crimeRecord=(type,offenderId,victimId,details)=>{const record={id:2,type,offenderId,victimId,details};justice.cases.push(record);return record;};
 const record=justice.attemptRobbery(actor,target,{amount:200});assert.equal(record.type,'robbery');assert.equal(record.details.attempted,true);assert.equal(record.details.outcome,'target-fled');assert.equal(record.details.amount,0);assert.equal(transfers,0);
});

test('CitySimulation carries the fleeing resident along a real route to safety',()=>{
 const city=setupCityFixture({starter:true,population:24});let station=city.buildings.find(b=>b.type==='police_station');if(!station)for(const site of city.economy.locateBuilding('police_station')){station=city.addBuilding('police_station',site.x,site.y,{...site,free:true});if(station)break;}assert.ok(station);
 const [actor,target]=city.citizens;actor.entity.x=target.entity.x+.5;actor.entity.y=target.entity.y;actor.equipment??={};actor.equipment.weapon=null;actor.skills.combat=90;target.needs.health=60;target.traits={...target.traits,riskTolerance:.05};target.equipment={};target.skills.combat=0;target.indoorLocation=null;
 const start={x:target.entity.x,y:target.entity.y};city.random=()=>0;assert.equal(city.justice.combatEncounter(actor,target,{forced:true}),true);assert.equal(target.combatFlee.status,'running');const destination=city.building(target.combatFlee.safeBuildingId);assert.ok(destination);assert.ok(target.path.length);assert.notDeepEqual(start,{x:destination.door.x,y:destination.door.y});
 for(let minute=0;minute<180&&target.combatFlee?.status==='running';minute++)city.update(.25);
 assert.equal(target.combatFlee.status,'arrived');assert.equal(target.combatFlee.safeBuildingId,destination.id);assert.deepEqual({x:target.entity.x,y:target.entity.y},{x:destination.door.x,y:destination.door.y});
});
