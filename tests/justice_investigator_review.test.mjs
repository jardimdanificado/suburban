import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';

function fixture(){
  const people=[1,2,3,4,5].map(id=>({id,jobId:id===2?10:id===5?11:null,entity:{x:0,y:0,properties:{name:`Pessoa ${id}`}},traits:{honesty:1},skills:{law:90,investigation:80},needs:{health:90},path:[]}));
  const stations=[{id:10,type:'police_station',active:true,entity:{},workers:[2]},{id:11,type:'police_station',active:true,entity:{},workers:[5]}];let eventId=20;
  const city={minute:100,hour:12,world:{},citizens:people,buildings:stations,society:{citizen:id=>people.find(c=>c.id===id)},politics:{council:{members:[]}},random:()=>0,log:()=>({id:++eventId}),accountName:id=>id};
  const justice=new CityJustice(city),source={id:1,type:'assault',status:'charged',chargedCitizenId:1,details:{},witnesses:[{citizenId:4,identifiedSuspectId:9,confidence:.9}],evidence:[{kind:'witness-identification',witnessId:4,identifiedSuspectId:1,confidence:.9}],investigation:{officerId:2,suspectId:1,fraud:false},trial:{status:'hearing-scheduled'}};
  justice.cases.push(source);justice.nextCaseId=2;return {city,justice,source,defender:people[2]};
}

test('documented contradictions create one linked complaint without declaring the investigator guilty',()=>{
  const {city,justice,source,defender}=fixture();assert.equal(justice.reviewDefenseEvidence(source,defender),true);const inquiry=justice.cases[1];
  assert.equal(inquiry.type,'investigationFraud');assert.equal(inquiry.status,'reported');assert.equal(inquiry.offenderId,null);assert.equal(inquiry.investigation,null);assert.equal(inquiry.details.investigatorUnderReviewId,2);assert.equal(inquiry.victimId,1);assert.equal(source.investigation.reviewCaseId,inquiry.id);
  assert.equal(inquiry.evidence[0].contradictions[0].originalSuspectId,9);assert.notEqual(inquiry.evidence[0].originalWitnesses,source.witnesses);
  justice.referInvestigationIrregularity(source,defender);assert.equal(justice.cases.length,2);assert.equal(inquiry.reportedAt,city.minute);
});

test('an implicated investigator cannot review their own case and another station can take it',()=>{
  const {city,justice,source,defender}=fixture();justice.reviewDefenseEvidence(source,defender);const inquiry=justice.cases[1],other=city.buildings.pop();
  justice.updateInvestigations();assert.equal(inquiry.investigation,null);assert.match(inquiry.investigationWaitingReason,/investigador independente/);
  city.buildings.push(other);justice.updateInvestigations();assert.equal(inquiry.investigation.officerId,5);assert.equal(inquiry.investigation.stationId,11);
  city.minute+=180;justice.updateInvestigations();assert.equal(inquiry.investigation.suspectId,2);assert.equal(inquiry.status,'arrest-requested');assert.equal(inquiry.evidence.at(-1).sourceEventId,inquiry.evidence[0].eventId);
});

test('hidden fraud without a discovered contradiction does not open a case and decriminalization is respected',()=>{
  const {justice,source,defender}=fixture();source.investigation.fraud=true;source.witnesses[0].identifiedSuspectId=1;assert.equal(justice.reviewDefenseEvidence(source,defender),false);assert.equal(justice.cases.length,1);
  const other=fixture();other.justice.policies.penalCode.investigationFraud.criminal=false;other.justice.reviewDefenseEvidence(other.source,other.defender);assert.equal(other.justice.cases.length,1);assert.equal(other.source.investigation.reviewReferralStatus,'not-criminal');
});

test('a defense can expose an invented police interview when the witness declined to speak',()=>{
  const {justice,source,defender}=fixture();source.investigation.fieldwork=true;source.investigation.interviewEvidence=[];source.investigation.interviewReportEventId=77;source.witnesses[0].interviewStatus='declined';source.evidence=[{kind:'police-interview',witnessId:4,identifiedSuspectId:1,reportedSuspectId:9,sourceInterviewEventId:null,confidence:.9}];
  assert.equal(justice.reviewDefenseEvidence(source,defender),true);const contradiction=source.evidence.find(item=>item.contradictionKind==='investigator-fabrication');assert.ok(contradiction);assert.equal(contradiction.originalSuspectId,9);assert.equal(contradiction.recordedSuspectId,1);const complaint=justice.cases.find(item=>item.type==='investigationFraud');assert.ok(complaint);assert.equal(complaint.status,'reported');assert.equal(complaint.offenderId,null);
});

test('a dishonest field investigator can fabricate an interview and name an innocent suspect',()=>{
  const {city,justice,source}=fixture(),officer=city.society.citizen(2);city.economy={mayorId:5,practice(){}};city.building=id=>city.buildings.find(building=>building.id===id)||null;city.accountName=id=>id;officer.traits={honesty:0,riskTolerance:.5};source.status='investigating';source.offenderId=99;source.position={x:0,y:0};source.rule={fineOnly:false};source.witnesses=[{citizenId:3,identifiedSuspectId:99,confidence:.9,interviewStatus:'interviewed',scene:{buildingId:null,unitId:null,floor:null,height:0}},{citizenId:4,identifiedSuspectId:99,confidence:.8,interviewStatus:'declined',scene:{buildingId:null,unitId:null,floor:null,height:0}}];source.investigation={officerId:officer.id,stationId:10,fieldwork:true,completedAt:city.minute,concludesAt:city.minute,interviewEvidence:[{kind:'police-interview',witnessId:3,identifiedSuspectId:99,confidence:.9,sourceEventId:40}],lastBribeConsideredAt:city.minute,lastWitnessBribeConsideredAt:city.minute};city.random=(()=>{const rolls=[.9,.9,0,0];return()=>rolls.shift()??0;})();
  justice.updateInvestigations();const fabrication=source.evidence.find(item=>item.kind==='police-interview'&&item.witnessId===4);assert.equal(source.status,'arrest-requested');assert.notEqual(source.investigation.suspectId,99);assert.equal(source.investigation.fraud,true);assert.ok(fabrication);assert.equal(fabrication.sourceInterviewEventId,null);assert.equal(fabrication.interviewerId,officer.id);assert.equal(fabrication.identifiedSuspectId,source.investigation.suspectId);
  source.chargedCitizenId=source.investigation.suspectId;source.status='charged';source.trial={};assert.equal(justice.reviewDefenseEvidence(source,city.society.citizen(3)),true);assert.ok(source.evidence.some(item=>item.kind==='defense-contradiction'&&item.contradictionKind==='investigator-fabrication'));
});
