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
  justice.updateInvestigations();assert.equal(inquiry.investigation,null);assert.match(inquiry.investigationWaitingReason,/sob apuração/);
  city.buildings.push(other);justice.updateInvestigations();assert.equal(inquiry.investigation.officerId,5);assert.equal(inquiry.investigation.stationId,11);
  city.minute+=180;justice.updateInvestigations();assert.equal(inquiry.investigation.suspectId,2);assert.equal(inquiry.status,'arrest-requested');assert.equal(inquiry.evidence.at(-1).sourceEventId,inquiry.evidence[0].eventId);
});

test('hidden fraud without a discovered contradiction does not open a case and decriminalization is respected',()=>{
  const {justice,source,defender}=fixture();source.investigation.fraud=true;source.witnesses[0].identifiedSuspectId=1;assert.equal(justice.reviewDefenseEvidence(source,defender),false);assert.equal(justice.cases.length,1);
  const other=fixture();other.justice.policies.penalCode.investigationFraud.criminal=false;other.justice.reviewDefenseEvidence(other.source,other.defender);assert.equal(other.justice.cases.length,1);assert.equal(other.source.investigation.reviewReferralStatus,'not-criminal');
});
