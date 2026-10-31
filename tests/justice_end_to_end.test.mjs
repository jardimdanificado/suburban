import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';

function fixture(randomValue=0){
  const people=Array.from({length:11},(_,index)=>({id:index+1,age:30,accountId:`citizen:${index+1}`,task:'work',entity:{x:index<4?0:index,y:0,destroyed:false,properties:{name:`Pessoa ${index+1}`}},path:[],needs:{health:100,food:100,water:100,energy:100,toilet:100},traits:{honesty:.8},skills:{law:20}}));
  const station={id:20,type:'police_station',active:true,entity:{destroyed:false,properties:{name:'Delegacia'}},door:{x:0,y:0},workers:[people[1].id]};people[1].jobId=station.id;
  const jail={id:30,type:'jail',active:true,entity:{destroyed:false,properties:{name:'Cadeia'}},door:{x:30,y:0},width:4,depth:4,floors:1,workers:[people[2].id]};people[2].jobId=jail.id;
  const court={id:40,type:'courthouse',active:true,entity:{destroyed:false,properties:{name:'Tribunal'}},door:{x:40,y:0},workers:[people[3].id,people[4].id]};people[3].jobId=people[4].jobId=court.id;
  const buildings=[station,jail,court],city={minute:100,buildings,citizens:people,accounts:new Map(),treasury:0,politics:{council:{members:[]},officeHolder:()=>false,cassateCriminalMandate:()=>false},society:{citizen:id=>people.find(c=>c.id===id),isAdult:c=>c.age>=18},building:id=>buildings.find(b=>b.id===id),findPath:(from,to)=>[{x:to.x,y:to.y}],urgentNeed:()=>false,payWage:()=>true,random:()=>randomValue,log:()=>({id:1}),sanitation:{releaseCitizen(){}}};
  const justice=new CityJustice(city);city.justice=justice;
  const suspect=people[0],record={id:1,type:'murder',offenderId:suspect.id,victimId:11,chargedCitizenId:suspect.id,status:'arrest-requested',severity:100,rule:{fineOnly:false,fine:0,cassation:false,cassationTrigger:'arrest'},investigation:{suspectId:suspect.id,stationId:station.id,status:'finished',finishedAt:90},evidence:[],witnesses:[]};justice.cases.push(record);
  return {city,justice,record,suspect,officer:people[1],jail};
}

test('murder case moves from arrest dispatch through physical custody to a five-person popular-jury verdict',()=>{
  const f=fixture(0),{justice,record,suspect,officer,city}=f;
  assert.equal(justice.arrest(record.id,suspect.id),true);
  assert.equal(suspect.custody.status,'awaiting-escort');
  assert.equal(justice.updatePoliceArrestEscort(officer),true);
  assert.equal(suspect.custody.status,'in-transit');
  assert.equal(record.status,'arrested');
  record.status='charged';city.minute++;
  justice.updateCourtCases();
  assert.equal(record.trial.status,'hearing-scheduled');
  assert.equal(record.trial.jury.memberIds.length,5);
  assert.ok(record.trial.jury.memberIds.every(id=>![suspect.id,officer.id].includes(id)));
  city.minute=record.trial.hearingAt;justice.updateCourtCases();
  assert.equal(record.status,'convicted');
  assert.equal(record.trial.jury.status,'decided');
  assert.equal(record.trial.jury.guiltyVotes,5);
  assert.equal(record.trial.jury.verdict,'convicted');
});

test('popular jury acquits when its majority votes not guilty',()=>{
  const f=fixture(.99),{justice,record,city}=f;record.status='charged';justice.updateCourtCases();assert.equal(record.trial.jury.memberIds.length,5);city.minute=record.trial.hearingAt;justice.updateCourtCases();assert.equal(record.status,'acquitted');assert.equal(record.trial.jury.notGuiltyVotes,5);assert.equal(record.trial.jury.verdict,'acquitted');
});

test('legacy justice records without a saved penal rule restore safely',()=>{
  const f=fixture();delete f.record.rule;assert.doesNotThrow(()=>f.justice.ensureState());assert.equal(f.record.rule.cassationTrigger,'arrest');
});

test('independent oversight assigns its auditor as soon as the reviewer becomes available',()=>{
  const f=fixture(),{city,justice}=f,reviewer=city.citizens[5],office={id:60,type:'council_oversight_office',active:true,entity:{destroyed:false},workers:[reviewer.id]};office.workers=[reviewer.id];reviewer.jobId=office.id;reviewer.indoorLocation=null;city.buildings.push(office);
  const source={id:2,type:'theft',status:'no-suspect',investigation:{officerId:city.citizens[1].id,suspectId:city.citizens[0].id},witnesses:[],evidence:[]},complaint={id:3,type:'investigationFraud',status:'reported',details:{reviewedCaseId:2,investigatorUnderReviewId:city.citizens[1].id},evidence:[]};justice.cases.push(source,complaint);
  justice.dispatchExternalPoliceReviews();assert.equal(complaint.externalReview.status,'waiting');
  reviewer.indoorLocation={buildingId:office.id,path:[]};city.minute++;justice.dispatchExternalPoliceReviews();assert.equal(complaint.externalReview.status,'active');assert.equal(complaint.externalReview.reviewerId,reviewer.id);
});
