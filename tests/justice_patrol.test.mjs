import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';
import {setup,putAtWorkCell} from './helpers/city.mjs';

function fixture({minute=540,officerPosition={x:8,y:8},indoor=false}={}){
 const station={id:10,type:'police_station',active:true,constructionKind:'open-air',entity:{destroyed:false,properties:{name:'Delegacia'}},door:{x:5,y:5},workers:[1],jobs:2,balance:10000,patrolOfficerId:null};
 const officer={id:1,accountId:'citizen:1',jobId:10,task:'work',entity:{x:officerPosition.x,y:officerPosition.y,properties:{name:'Oficial'}},needs:{health:90,energy:90,food:90,water:90,toilet:90},skills:{investigation:80},traits:{skepticism:.5},path:[],indoorLocation:indoor?{buildingId:10,unitId:1,position:{...officerPosition},path:[]}:null};
 const actor={id:2,accountId:'citizen:2',entity:{x:8,y:8,properties:{name:'Morador'}},needs:{health:90,food:60},traits:{honesty:.1,riskTolerance:.9,ambition:.8},inventory:{},lastTheftAttemptAt:null};
 const victim={id:3,accountId:'citizen:3',entity:{x:9,y:8,properties:{name:'Vítima'}},needs:{health:90},inventory:{},pocket:{food:[]}};
 const accounts=new Map([[actor.accountId,{balance:1000}],[victim.accountId,{balance:1000}],[officer.accountId,{balance:1000}]]),city={minute,hour:Math.floor(minute%1440/60),day:0,structureRevision:1,world:{width:64,height:64,cityLampPosts:[]},buildings:[station],citizens:[officer,actor,victim],accounts,society:{citizen:id=>[officer,actor,victim].find(c=>c.id===id),isAdult:()=>true,getRelation:()=>({views:{2:{resentment:60}}})},walkable:()=>true,findPath:(from,to)=>[{x:to.x,y:to.y}],building:id=>id===10?station:null,urgentNeed:()=>false,payWage:()=>true,currency:{price:n=>n},economy:{practice(){}},random:()=>.99,log:()=>({id:1}),transfer(from,to,amount){const a=accounts.get(from),b=accounts.get(to);if(!a||!b||a.balance<amount)return false;a.balance-=amount;b.balance+=amount;return true;}};
 const justice=new CityJustice(city);city.justice=justice;return {city,justice,station,officer,actor,victim};
}

test('staffed police stations assign an available working officer during the paid day shift only',()=>{
 const {city,justice,station,officer}=fixture({indoor:true});justice.updatePolicePatrols();assert.equal(station.patrolOfficerId,officer.id);assert.equal(officer.policePatrol.phase,'exit');assert.equal(officer.task,'police-patrol');
 officer.policePatrol=null;station.patrolOfficerId=null;city.hour=21;justice.updatePolicePatrols();assert.equal(officer.policePatrol,null);assert.equal(station.patrolOfficerId,null);
});

test('officers walk to reachable patrol points and return to their station without teleporting',()=>{
 const {justice,station,officer,city}=fixture({officerPosition:{x:8,y:8}}),origin={x:officer.entity.x,y:officer.entity.y};officer.policePatrol={stationId:station.id,phase:'patrol',startedAt:city.minute,waypointIndex:0,waitUntil:0,lastPaidMinute:null};
 justice.updatePolicePatrol(officer);assert.deepEqual({x:officer.entity.x,y:officer.entity.y},origin);assert.equal(officer.path.length,1);assert.equal(officer.action,'Patrulhando a pé');assert.equal(justice.patrolNearby({x:9,y:8}),true);
 const first=justice.policePatrolPoints(station)[0];officer.entity.x=first.x;officer.entity.y=first.y;officer.path=[];justice.updatePolicePatrol(officer);assert.equal(officer.policePatrol.waitUntil,city.minute+4);assert.equal(officer.path.length,0);
 officer.policePatrol.phase='return';justice.updatePolicePatrol(officer);assert.equal(officer.entity.x,first.x);assert.deepEqual(officer.path,[{x:station.door.x,y:station.door.y}]);assert.equal(officer.action,'Retornando à delegacia');
});

test('a nearby patrol deters theft, and a patrolling officer can identify a visible daytime suspect',()=>{
 const {city,justice,officer,actor,victim}=fixture({officerPosition:{x:8,y:8}}),patrol={stationId:10,phase:'patrol'};officer.policePatrol=patrol;officer.path=[{x:8.5,y:8.5}];actor.lastTheftAttemptAt=null;city.hour=22;city.random=()=>.05;justice.attemptTheft=()=>({id:1});assert.equal(justice.considerTheft(actor,victim),false);
 city.hour=12;city.random=()=>.5;const record=justice.crimeRecord('theft',actor.id,victim.id,{position:{x:8,y:8}});const witness=record.witnesses.find(w=>w.citizenId===officer.id);assert.ok(witness);assert.equal(witness.identifiedSuspectId,actor.id);assert.equal(witness.role,'police-officer');
});

test('a staffed officer exits the real station and patrol movement advances through the city simulation',()=>{
 const city=setup({starter:true,population:32});let station;
 for(const site of city.economy.locateBuilding('police_station')){station=city.addBuilding('police_station',site.x,site.y,{...site,free:true});if(station)break;}assert.ok(station);
 const officer=city.citizens.find(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c)&&Math.min(c.needs.food,c.needs.water,c.needs.energy,c.needs.health,c.needs.toilet)>65);assert.ok(officer);
 city.economy.leaveJob(officer,'Designação policial de teste');officer.jobId=station.id;station.workers=[officer.id];city.transfer('treasury',station.accountId,100000,'Caixa de patrulha');Object.assign(officer.needs,{food:95,water:95,energy:95,health:95,toilet:95,hygiene:95});putAtWorkCell(city,officer,station);
 const position={x:officer.entity.x,y:officer.entity.y};city.minute=480;city.justice.lastMinute=479;for(let i=0;i<24;i++)city.update(.25);
 assert.ok(officer.policePatrol);assert.equal(officer.indoorLocation,null);assert.ok(Math.hypot(officer.entity.x-position.x,officer.entity.y-position.y)>2);assert.ok(officer.task==='police-patrol'||officer.task==='work');
});
