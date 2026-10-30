import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';
import {setup,putAtWorkCell} from './helpers/city.mjs';

function fixture({witnesses=[]}={}){
 const station={id:10,type:'police_station',active:true,entity:{destroyed:false,properties:{name:'Delegacia'}},door:{x:1,y:1},workers:[2],policeInvestigatorId:null};
 const officer={id:2,accountId:'citizen:2',jobId:10,task:'work',entity:{x:1,y:1,properties:{name:'Oficial'}},needs:{health:90,food:80,water:80,energy:80,toilet:80},skills:{investigation:80},traits:{honesty:.9},path:[]};
 const people=[{id:1,accountId:'citizen:1',entity:{x:5,y:5,properties:{name:'Vítima'}},needs:{health:90},traits:{honesty:1,riskTolerance:1}},officer,{id:3,accountId:'citizen:3',entity:{x:5,y:5,properties:{name:'Acusado'}},needs:{health:90}}];
 const city={minute:600,hour:10,buildings:[station],citizens:people,world:{cityLampPosts:[]},society:{citizen:id=>people.find(c=>c.id===id)},building:id=>id===station.id?station:null,findPath:(from,to)=>[{x:to.x,y:to.y}],urgentNeed:()=>false,payWage:()=>true,accountName:id=>id,random:()=>0,economy:{practice(){}},log:()=>({id:1})};
 const justice=new CityJustice(city),record={id:1,type:'assault',offenderId:3,victimId:1,status:'reported',reportingStationId:10,scene:{buildingId:null,unitId:null,floor:null,height:0},position:{x:5,y:5},witnesses,evidence:[],rule:{fineOnly:false},severity:60};justice.cases.push(record);return {city,justice,station,officer,record,people};
}
function moveToPathEnd(person){const target=person.path.at(-1);assert.ok(target,'expected a physical route');person.entity.x=target.x;person.entity.y=target.y;person.path=[];}

test('an outdoor case sends an employed officer to the scene and back before analysis concludes',()=>{
 const {city,justice,station,officer,record}=fixture();station.policeInvestigatorId=officer.id;justice.startPoliceInvestigation(record,station,officer);
 assert.equal(record.investigation.fieldwork,true);assert.equal(record.investigation.phase,'exit');assert.deepEqual({x:officer.entity.x,y:officer.entity.y},{x:1,y:1});
 justice.updatePoliceInvestigation(officer);assert.deepEqual({x:officer.entity.x,y:officer.entity.y},{x:1,y:1});assert.deepEqual(officer.path,[{x:5,y:5}]);assert.equal(record.investigation.phase,'scene');
 moveToPathEnd(officer);city.minute++;justice.updatePoliceInvestigation(officer);assert.equal(record.investigation.sceneVisitedAt,city.minute);assert.equal(record.investigation.phase,'witnesses');
 justice.updatePoliceInvestigation(officer);assert.deepEqual(officer.path,[{x:1,y:1}]);assert.equal(record.investigation.phase,'return');
 moveToPathEnd(officer);city.minute++;justice.updatePoliceInvestigation(officer);assert.equal(officer.policeInvestigation,null);assert.equal(record.investigation.fieldworkResult,'completed');assert.equal(record.investigation.completedAt,city.minute);
 justice.updateInvestigations();assert.equal(record.status,'no-suspect');assert.equal(record.investigation.suspectId,null);
});

test('only a cooperative witness physically reached by the investigator can provide an identifying lead',()=>{
 const witness={citizenId:1,confidence:.94,identifiedSuspectId:3,scene:{buildingId:null,unitId:null,floor:null,height:0}},fixtureData=fixture({witnesses:[witness]}),{city,justice,station,officer,record}=fixtureData;station.policeInvestigatorId=officer.id;justice.startPoliceInvestigation(record,station,officer);
 justice.updatePoliceInvestigation(officer);moveToPathEnd(officer);city.minute++;justice.updatePoliceInvestigation(officer);assert.equal(record.investigation.phase,'witnesses');
 justice.updatePoliceInvestigation(officer);assert.equal(witness.interviewStatus,'interviewed');assert.equal(record.investigation.interviewEvidence[0].witnessId,1);assert.equal(record.investigation.interviewEvidence[0].identifiedSuspectId,3);
 justice.updatePoliceInvestigation(officer);moveToPathEnd(officer);city.minute++;justice.updatePoliceInvestigation(officer);justice.updateInvestigations();assert.equal(record.status,'arrest-requested');assert.equal(record.investigation.suspectId,3);assert.equal(record.investigation.evidence[0].kind,'police-interview');assert.equal(record.investigation.evidence[0].witnessId,1);
});

test('a dead or missing investigator releases the station and closes unfinished fieldwork as interrupted',()=>{
 const {city,justice,station,officer,record}=fixture();station.policeInvestigatorId=officer.id;justice.startPoliceInvestigation(record,station,officer);officer.entity.destroyed=true;officer.policeInvestigation=null;city.minute++;
 justice.updateInvestigations();assert.equal(station.policeInvestigatorId,null);assert.equal(record.investigation.fieldworkResult,'interrupted');assert.equal(record.investigation.blockedReason,'agente morreu ou saiu do serviço');assert.equal(record.status,'no-suspect');
});

test('the live simulation moves an investigator to an outdoor scene and back before closing the case',()=>{
 const city=setup({starter:true,population:32});let station;
 for(const site of city.economy.locateBuilding('police_station')){station=city.addBuilding('police_station',site.x,site.y,{...site,free:true});if(station)break;}assert.ok(station);
 const officer=city.citizens.find(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c)&&Math.min(c.needs.food,c.needs.water,c.needs.energy,c.needs.health,c.needs.toilet)>65);assert.ok(officer);
 city.economy.leaveJob(officer,'Designação de investigação');officer.jobId=station.id;station.workers=[officer.id];city.transfer('treasury',station.accountId,100000,'Caixa de investigação');Object.assign(officer.needs,{food:95,water:95,energy:95,health:95,toilet:95,hygiene:95});putAtWorkCell(city,officer,station);
 let scene=null;for(let radius=2;radius<=8&&!scene;radius++)for(let dx=-radius;dx<=radius&&!scene;dx++)for(const dy of [radius-Math.abs(dx),-(radius-Math.abs(dx))]){const x=Math.floor(station.door.x)+dx,y=Math.floor(station.door.y)+dy,point={x:x+.5,y:y+.5};if(x>=0&&y>=0&&city.walkable(x,y)&&city.findPath(station.door,point)!==null)scene=point;}
 assert.ok(scene);const record={id:991,type:'vandalism',offenderId:null,victimId:null,status:'reported',reportingStationId:station.id,scene:{buildingId:null,unitId:null,floor:null,height:0},position:scene,witnesses:[],evidence:[],rule:{fineOnly:false},severity:30};city.justice.cases.push(record);city.minute=600;city.justice.lastMinute=599;
 let maxExcursion=0;for(let i=0;i<120&&(i===0||record.status==='investigating');i++){city.update(.25);maxExcursion=Math.max(maxExcursion,Math.hypot(officer.entity.x-station.door.x,officer.entity.y-station.door.y));}
 assert.ok(record.investigation?.fieldwork);assert.equal(record.investigation.fieldworkResult,'completed');assert.ok(record.investigation.sceneVisitedAt>=600);assert.ok(Math.hypot(officer.entity.x-station.door.x,officer.entity.y-station.door.y)<2);assert.ok(maxExcursion>1,`maximum excursion ${maxExcursion}; scene ${JSON.stringify(scene)}; door ${JSON.stringify(station.door)}`);assert.equal(record.status,'no-suspect');
});
