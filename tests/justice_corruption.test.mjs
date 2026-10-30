import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';

function fixture(){
  const people=[{id:1,entity:{x:0,y:0,properties:{name:'Político'}},needs:{health:90}},{id:2,jobId:10,entity:{properties:{name:'Policial'}},traits:{honesty:1},skills:{investigation:60}}];
  const source={id:8,accusedId:1,participantIds:[1,4],occurredAt:10,discoveredAt:50,evidence:.9,evidenceEventId:99,amount:1000,convictedIds:[1]},station={id:10,type:'police_station',active:true,entity:{},workers:[2]},city={minute:100,hour:12,world:{},citizens:people,buildings:[station],society:{citizen:id=>people.find(c=>c.id===id)},politics:{corruption:[source],council:{members:[]}},random:()=>0,log:()=>({id:1}),accountName:id=>id};
  return {justice:new CityJustice(city),city,source};
}

test('undiscovered corruption remains hidden and repeated referrals reuse one police case',()=>{
  const {justice,source}=fixture();source.discoveredAt=null;assert.equal(justice.referCorruption(source),null);assert.equal(justice.cases.length,0);source.discoveredAt=50;
  const record=justice.referCorruption(source);assert.equal(justice.referCorruption(source),record);assert.equal(justice.cases.length,1);assert.equal(record.details.corruptionCaseId,8);assert.equal(source.justiceCaseId,record.id);assert.equal(record.witnesses.length,0);assert.deepEqual(source.legacyLegislativeConvictedIds,[1]);assert.deepEqual(source.convictedIds,[]);
});

test('police analyze a traceable document before identifying a corruption suspect',()=>{
  const {justice,city,source}=fixture(),record=justice.referCorruption(source);justice.updateInvestigations();assert.equal(record.status,'investigating');city.minute+=180;justice.updateInvestigations();
  assert.equal(record.status,'arrest-requested');assert.equal(record.investigation.suspectId,1);assert.equal(record.investigation.evidence[0].kind,'document-analysis');assert.equal(record.investigation.evidence[0].sourceEventId,99);assert.equal(source.proven,true);assert.deepEqual(source.convictedIds,[]);
});

test('absence of police or documentary provenance does not identify the hidden author',()=>{
  const {justice,city,source}=fixture();source.evidenceEventId=null;const record=justice.referCorruption(source);city.buildings=[];justice.updateInvestigations();assert.equal(record.status,'reported');city.buildings=[{id:10,type:'police_station',active:true,entity:{},workers:[2]}];justice.updateInvestigations();city.minute+=180;justice.updateInvestigations();assert.equal(record.status,'no-suspect');assert.equal(record.investigation.suspectId,null);
});

test('criminal conviction mirrors the court outcome and acquittal removes it',()=>{
  const {justice,source}=fixture(),record=justice.referCorruption(source);record.chargedCitizenId=1;record.status='convicted';justice.syncCorruptionOutcome(record);justice.syncCorruptionOutcome(record);assert.deepEqual(source.convictedIds,[1]);assert.equal(source.judicialStatus,'convicted');record.status='acquitted';justice.syncCorruptionOutcome(record);assert.deepEqual(source.convictedIds,[]);assert.equal(source.judicialStatus,'acquitted');
});

test('decriminalization clears the current corruption conviction without erasing the financial case',()=>{
  const {justice,source}=fixture(),record=justice.referCorruption(source);record.chargedCitizenId=1;record.status='convicted';justice.syncCorruptionOutcome(record);justice.setCrimeRule('corruption',{...justice.policies.penalCode.corruption,criminal:false},25);assert.deepEqual(source.convictedIds,[]);assert.equal(source.judicialStatus,'decriminalized');assert.equal(source.id,8);assert.equal(source.amount,1000);assert.equal(record.legalHistory[0].billId,25);
});


test('document analysis uses police skill to corroborate a weak initial complaint',()=>{
  const {justice,city,source}=fixture();source.evidence=.25;const record=justice.referCorruption(source);justice.updateInvestigations();city.minute+=180;justice.updateInvestigations();assert.ok(record.investigation.evidence[0].confidence>=.8);assert.equal(record.evidence[0].confidence,.25);assert.equal(source.proven,true);
});
