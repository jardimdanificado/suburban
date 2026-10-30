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

test('a single-officer police station assigns day patrols but reserves night duty for a second employee',()=>{
 const {city,justice,station,officer}=fixture({indoor:true});justice.updatePolicePatrols();assert.equal(station.patrolOfficerId,officer.id);assert.equal(officer.policePatrol.phase,'exit');assert.equal(officer.task,'police-patrol');
 officer.policePatrol=null;station.patrolOfficerId=null;city.hour=21;justice.updatePolicePatrols();assert.equal(officer.policePatrol,null);assert.equal(station.patrolOfficerId,null);
});

test('an authoritarian mayor order is refused or physically executed and linked to a vandalism case',()=>{
 const {city,justice,station,officer,actor,victim}=fixture({minute:720,officerPosition:{x:8,y:8}}),mayor={id:4,entity:{x:12,y:8,properties:{name:'Prefeito'}},traits:{honesty:.1,empathy:.1},political:{partyId:1,loyalty:.8,ideology:{liberty:-1}}};
 city.citizens.push(mayor);city.society.citizen=id=>city.citizens.find(c=>c.id===id);city.economy.mayorId=mayor.id;city.politics={party:()=>({ideology:{liberty:-.5}})};city.payWage=()=>true;officer.traits={honesty:.1};officer.political={partyId:1,loyalty:.9};officer.policePatrol={stationId:station.id,phase:'patrol',waypointIndex:0,lastPaidMinute:null};
 const piece={id:1,kind:'banner',message:'Mensagem da oposição',creatorId:victim.id,subjectId:null,buildingId:null,partyId:2,entity:{x:10,y:8,destroyed:false,properties:{}},scene:{buildingId:null,unitId:null,floor:null,height:0},layers:[],damaged:0};justice.art.push(piece);
 let draws=[0,.99];city.random=()=>draws.shift()??.99;const refused=justice.considerMunicipalPoliceOrder(station,officer);assert.equal(refused.status,'refused');assert.equal(piece.damaged,0);
 station.lastPoliticalOrderAt=city.minute-1441;city.random=()=>0;const accepted=justice.considerMunicipalPoliceOrder(station,officer);assert.equal(accepted.status,'accepted');assert.ok(officer.policeOrder);justice.updatePolicePoliticalOrder(officer);assert.deepEqual(officer.path,[{x:piece.entity.x,y:piece.entity.y}]);officer.entity.x=piece.entity.x;officer.entity.y=piece.entity.y;officer.path=[];justice.updatePolicePoliticalOrder(officer);
 assert.equal(accepted.status,'executed');assert.ok(piece.damaged>0);const record=justice.cases.find(c=>c.type==='vandalism');assert.ok(record);assert.equal(record.offenderId,officer.id);assert.equal(record.details.orderedByMayorId,mayor.id);assert.equal(record.evidence.at(-1).kind,'municipal-order');
});

test('night patrol uses a second public employee and remains active through 04:59',()=>{
 const {city,justice,station,officer}=fixture({indoor:true}),nightOfficer={id:4,accountId:'citizen:4',jobId:station.id,task:'work',entity:{x:5,y:5,properties:{name:'Oficial noturno'}},needs:{health:90,energy:90,food:90,water:90,toilet:90},skills:{investigation:60},path:[],indoorLocation:{buildingId:station.id,unitId:2,position:{x:5,y:5},path:[]}};
 city.citizens.push(nightOfficer);city.society.citizen=id=>city.citizens.find(c=>c.id===id);city.accounts.set(nightOfficer.accountId,{balance:1000});station.workers.push(nightOfficer.id);station.jobs=3;
 justice.updatePolicePatrols();assert.equal(officer.policePatrol.shift,'day');officer.policePatrol=null;officer.task='work';station.patrolOfficerId=null;
 city.hour=20;city.minute=1200;justice.updatePolicePatrols();assert.equal(station.patrolOfficerId,nightOfficer.id,JSON.stringify({staffed:justice.staffed(station),assignment:station.policeShiftAssignments,workers:station.workers.map(id=>city.society.citizen(id)?.task),shift:justice.policeShift()}));assert.equal(nightOfficer.policePatrol.shift,'night');
 city.hour=4;city.minute=1680;justice.updatePolicePatrols();assert.equal(nightOfficer.policePatrol.phase,'exit');assert.equal(justice.policeShift(),'night');
 city.hour=5;city.minute=1740;justice.updatePolicePatrols();assert.equal(nightOfficer.policePatrol.phase,'return');assert.equal(justice.policeShift(),null);
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

test('a patrolling officer physically answers a witnessed crime and files the incident at the scene',()=>{
 const {city,justice,station,officer,actor,victim}=fixture({minute:720,officerPosition:{x:8,y:8}});city.hour=12;officer.policePatrol={stationId:station.id,phase:'patrol',waypointIndex:2,lastPaidMinute:null};officer.path=[{x:10,y:10}];city.random=()=>0;
 const record=justice.crimeRecord('assault',actor.id,victim.id,{position:{x:8.2,y:8}});assert.ok(officer.policeResponse);assert.equal(officer.policeResponse.caseId,record.id);assert.equal(officer.policePatrol.phase,'respond');assert.equal(officer.path.length,0);
 justice.updatePoliceResponse(officer);assert.equal(record.status,'reported');assert.equal(record.reportSource,'police-response');assert.equal(record.response.status,'completed');assert.equal(record.response.arrivedAt,city.minute);assert.equal(record.evidence.at(-1).kind,'police-scene-response');assert.equal(record.evidence.at(-1).identifiedSuspectId,undefined);assert.equal(officer.policeResponse,null);assert.equal(officer.policePatrol.phase,'patrol');
});

test('police response requires a route to the scene and does not teleport the patrol officer',()=>{
 const {city,justice,station,officer,actor,victim}=fixture({minute:720,officerPosition:{x:8,y:8}});city.hour=12;officer.policePatrol={stationId:station.id,phase:'patrol',waypointIndex:2,lastPaidMinute:null};city.findPath=(from,to)=>[{x:to.x,y:to.y}];city.random=()=>0;
 const record=justice.crimeRecord('assault',actor.id,victim.id,{position:{x:9.5,y:8}}),origin={x:officer.entity.x,y:officer.entity.y};assert.ok(officer.policeResponse);justice.updatePoliceResponse(officer);assert.deepEqual({x:officer.entity.x,y:officer.entity.y},origin);assert.deepEqual(officer.path,[{x:9.5,y:8}]);officer.entity.x=9.5;officer.entity.y=8;officer.path=[];city.minute++;justice.updatePoliceResponse(officer);assert.equal(record.response.status,'completed');assert.deepEqual({x:officer.entity.x,y:officer.entity.y},{x:9.5,y:8});assert.equal(record.reportSource,'police-response');
});

test('a second witnessed call waits in the station queue and dispatches when the patrol is free',()=>{
 const {city,justice,station,officer,actor,victim}=fixture({minute:720,officerPosition:{x:8,y:8}});city.hour=12;station.patrolOfficerId=officer.id;officer.policePatrol={stationId:station.id,phase:'patrol',waypointIndex:2,lastPaidMinute:null};city.random=()=>0;
 const first=justice.crimeRecord('assault',actor.id,victim.id,{position:{x:8.2,y:8}}),second=justice.crimeRecord('vandalism',actor.id,victim.id,{position:{x:8.3,y:8}});assert.equal(first.response.status,'dispatched');assert.equal(second.response.status,'awaiting-officer');
 justice.updatePoliceResponse(officer);city.minute++;justice.updatePolicePatrols();assert.equal(second.response.status,'dispatched');assert.equal(second.response.officerId,officer.id);assert.equal(officer.policeResponse.caseId,second.id);assert.equal(officer.policePatrol.phase,'respond');
});

test('a queued police response can start a patrol even when a single officer also has an open case',()=>{
 const {city,justice,station,officer}=fixture({minute:720,indoor:true});city.hour=12;justice.cases.push({id:77,type:'assault',status:'reported',reportingStationId:station.id,scene:{buildingId:null},position:{x:12,y:8},severity:80,occurredAt:700,witnesses:[],response:{status:'awaiting-officer',stationId:station.id,phase:'queue'}});
 justice.updatePolicePatrols();assert.equal(station.patrolOfficerId,officer.id);assert.equal(officer.policePatrol.phase,'exit');justice.updatePolicePatrols();assert.equal(officer.policeResponse.caseId,77);assert.equal(officer.policePatrol.phase,'respond');
});

test('a staffed officer exits the real station and patrol movement advances through the city simulation',()=>{
 const city=setup({starter:true,population:32});let station;
 for(const site of city.economy.locateBuilding('police_station')){station=city.addBuilding('police_station',site.x,site.y,{...site,free:true});if(station)break;}assert.ok(station);
 const officer=city.citizens.find(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c)&&Math.min(c.needs.food,c.needs.water,c.needs.energy,c.needs.health,c.needs.toilet)>65);assert.ok(officer);
 city.economy.leaveJob(officer,'Designação policial de teste');officer.jobId=station.id;station.workers=[officer.id];city.transfer('treasury',station.accountId,100000,'Caixa de patrulha');Object.assign(officer.needs,{food:95,water:95,energy:95,health:95,toilet:95,hygiene:95});putAtWorkCell(city,officer,station);
 const position={x:officer.entity.x,y:officer.entity.y};city.minute=480;city.justice.lastMinute=479;for(let i=0;i<24;i++)city.update(.25);
 assert.ok(officer.policePatrol);assert.equal(officer.indoorLocation,null);assert.ok(Math.hypot(officer.entity.x-position.x,officer.entity.y-position.y)>2);assert.ok(officer.task==='police-patrol'||officer.task==='work');
});

test('the live simulation moves a responding officer to a witnessed street scene and completes the call',()=>{
 const city=setup({starter:true,population:36});let station;
 for(const site of city.economy.locateBuilding('police_station')){station=city.addBuilding('police_station',site.x,site.y,{...site,free:true});if(station)break;}assert.ok(station);
 const officer=city.citizens.find(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c)&&Math.min(c.needs.food,c.needs.water,c.needs.energy,c.needs.health,c.needs.toilet)>65);assert.ok(officer);
 city.economy.leaveJob(officer,'Designação policial de resposta');officer.jobId=station.id;station.workers=[officer.id];city.transfer('treasury',station.accountId,100000,'Caixa para resposta policial');Object.assign(officer.needs,{food:95,water:95,energy:95,health:95,toilet:95,hygiene:95});putAtWorkCell(city,officer,station);
 city.minute=600;city.justice.lastMinute=599;for(let i=0;i<30&&!officer.policePatrol;i++)city.update(.25);assert.ok(officer.policePatrol);const origin={x:officer.entity.x,y:officer.entity.y};let scene;
 for(let radius=2;radius<=8&&!scene;radius++)for(let dx=-radius;dx<=radius&&!scene;dx++)for(const dy of [radius-Math.abs(dx),-(radius-Math.abs(dx))]){const x=Math.floor(origin.x)+dx,y=Math.floor(origin.y)+dy,point={x:x+.5,y:y+.5};if(x>=0&&y>=0&&city.walkable(x,y)&&city.findPath(origin,point)!==null&&Math.hypot(point.x-origin.x,point.y-origin.y)>1.3)scene=point;}
 assert.ok(scene);const civilians=city.citizens.filter(c=>c.id!==officer.id&&c.entity!==officer.entity);assert.ok(civilians.length>=2);const [offender,victim]=civilians;for(const c of [offender,victim]){c.indoorLocation=null;c.skybridgeZ=0;c.path=[];}offender.entity.x=scene.x;offender.entity.y=scene.y;victim.entity.x=scene.x+.15;victim.entity.y=scene.y;city.random=()=>0;
 officer.policePatrol.phase='patrol';station.patrolOfficerId=officer.id;const record=city.justice.crimeRecord('assault',offender.id,victim.id,{position:scene});record.witnesses.push({citizenId:officer.id,role:'police-officer',confidence:.9,identifiedSuspectId:offender.id,scene:{buildingId:null,unitId:null,floor:null,height:0}});assert.equal(city.justice.dispatchPoliceResponse(record),true);assert.ok(officer.policeResponse,'the officer should dispatch from the observed crime');let maxDistance=0;
 for(let i=0;i<120&&record.response.status==='dispatched';i++){city.update(.25);maxDistance=Math.max(maxDistance,Math.hypot(officer.entity.x-origin.x,officer.entity.y-origin.y));}
 assert.equal(record.response.status,'completed');assert.equal(record.response.sceneNotes.length,1);assert.ok(maxDistance>1);assert.ok(record.response.arrivedAt>=600);assert.ok(officer.policePatrol);
});
