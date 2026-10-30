import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';

function fixture(){
  const defendant={id:1,accountId:'citizen:1',entity:{x:0,y:0,properties:{name:'Réu'}},path:[],needs:{food:50,water:50}};
  const guard={id:2,jobId:10,entity:{properties:{name:'Servidor'}}};
  const jail={id:10,type:'jail',active:true,entity:{properties:{name:'Cadeia'}},door:{x:4,y:0},workers:[2]};
  const people=new Map([[1,defendant],[2,guard]]),events=[];
  const city={minute:100,buildings:[jail],society:{citizen:id=>people.get(id)},politics:{council:{members:[]}},building:id=>id===10?jail:null,findPath:()=>[{x:4,y:0}],log:(message,...details)=>events.push({message,details})};
  const justice=new CityJustice(city);city.justice=justice;
  const record={id:1,status:'convicted',chargedCitizenId:1,investigation:{suspectId:1},rule:{fineOnly:false},sentence:{imprisonmentMinutes:120}};justice.cases.push(record);
  return {justice,city,defendant,record,jail,events,people};
}

test('sentenced prisoner receives rations and is released when sentence expires',()=>{
  const {justice,city,defendant,record}=fixture();let rations=0;justice.servePrisoner=()=>rations++;
  defendant.custody={caseId:1,jailId:10,status:'detained',startedAt:80,releaseAt:1000};
  justice.enforceSentence(record);assert.equal(defendant.custody.releaseAt,200);
  justice.updateDetainee(defendant);assert.equal(rations,1);
  city.minute=200;justice.updateDetainee(defendant);
  assert.equal(defendant.custody,null);assert.equal(record.sentence.completedAt,200);assert.equal(record.status,'convicted');assert.equal(record.custodyMinutes,120);
  justice.enforceSentence(record);assert.equal(defendant.custody,null);
});

test('sentence after pretrial release credits custody already served and starts on arrival',()=>{
  const {justice,city,defendant,record}=fixture();record.custodyMinutes=40;justice.servePrisoner=()=>{};
  justice.enforceSentence(record);assert.equal(defendant.custody.remainingMinutes,80);assert.equal(defendant.custody.releaseAt,null);
  city.minute=150;defendant.path=[];defendant.entity.x=4;justice.updateDetainee(defendant);
  assert.equal(defendant.custody.releaseAt,230);assert.equal(record.sentence.startedAt,150);
});

test('conviction during transit keeps a finite sentence deadline after arrival',()=>{
  const {justice,city,defendant,record}=fixture();justice.servePrisoner=()=>{};
  defendant.custody={caseId:1,jailId:10,status:'in-transit',releaseAt:1000};
  justice.enforceSentence(record);city.minute=130;defendant.entity.x=4;justice.updateDetainee(defendant);
  assert.equal(defendant.custody.releaseAt,250);assert.ok(Number.isFinite(defendant.custody.releaseAt));
});

test('interrupted custody route replans instead of teleporting the prisoner',()=>{
  const {justice,defendant}=fixture();justice.enforceSentence(justice.cases[0]);defendant.path=[];
  justice.updateDetainee(defendant);assert.equal(defendant.entity.x,0);assert.equal(defendant.custody.status,'in-transit');assert.equal(defendant.path.length,1);
});

test('legislative release preserves conviction and suspends further execution',()=>{
  const {justice,defendant,record}=fixture();defendant.custody={caseId:1,jailId:10,status:'detained',startedAt:80};
  assert.equal(justice.releaseByCouncil(1,25),true);assert.equal(record.status,'convicted');assert.equal(record.releaseBillId,25);
  justice.enforceSentence(record);assert.equal(defendant.custody,null);assert.equal(record.sentence.executionStatus,'released-by-council');
});


test('court uses law skills on the same scale as witness confidence',()=>{
  const {justice,city,record,people}=fixture();record.status='charged';record.severity=40;record.evidence=[{kind:'witness-identification',confidence:.9}];
  for(const id of [3,4])people.set(id,{id,jobId:11,entity:{properties:{name:`Jurista ${id}`}},skills:{law:25},traits:{honesty:.8}});
  city.buildings.push({id:11,type:'courthouse',active:true,entity:{properties:{name:'Tribunal'}},workers:[3,4]});city.random=()=>.5;
  record.trial={status:'hearing-scheduled',courtId:11,judgeId:3,defenderId:4,hearingAt:100};
  justice.updateCourtCases();assert.equal(record.status,'convicted');assert.ok(record.trial.convictionChance>.5);assert.ok(record.trial.convictionChance<.9);
  assert.equal(justice.appeal(1,1),true);city.minute+=180;city.random=()=>.9;justice.updateCourtCases();
  assert.equal(record.trial.appeal.status,'upheld');assert.equal(record.trial.status,'convicted');
});

test('death in custody preserves an existing conviction',()=>{
  const {justice,record,defendant}=fixture();defendant.custody={caseId:1};justice.onDetaineeDeath(defendant);
  assert.equal(record.status,'convicted');assert.equal(record.sentence.executionStatus,'ended-by-death');assert.equal(defendant.custody,null);
});


test('immunity blocks sentence custody until the chamber authorizes arrest',()=>{
  const {justice,city,record,defendant}=fixture();justice.policies.parliamentaryImmunity=true;city.politics.council.members=[{citizenId:1}];
  assert.equal(justice.enforceSentence(record),false);assert.equal(defendant.custody,undefined);assert.equal(record.sentence.executionStatus,'awaiting-immunity-authorization');
  assert.equal(justice.authorizeArrest(1,42),true);assert.equal(defendant.custody.status,'in-transit');assert.equal(record.authorizationBillId,42);
});
