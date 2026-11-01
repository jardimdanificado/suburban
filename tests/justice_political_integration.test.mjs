import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';

test('a conviction with the voted cassation rule removes the mayor and seats the vice mayor',()=>{
  const city=setup({starter:true,population:48}),government=city.politics,justice=city.justice,mayor=city.society.citizen(city.economy.mayorId),vice=city.society.citizen(government.viceMayorId);assert.ok(mayor&&vice);const record={id:900,type:'corruption',status:'convicted',chargedCitizenId:mayor.id,rule:{cassation:true,cassationTrigger:'conviction'},verdictAt:city.minute};justice.cases.push(record);
  assert.equal(justice.applyMandateCassation(record,'arrest'),false);assert.equal(city.economy.mayorId,mayor.id);assert.equal(justice.applyMandateCassation(record,'conviction'),true);assert.equal(record.cassationTriggerApplied,'conviction');assert.equal(record.cassatedAt,city.minute);assert.equal(city.economy.mayorId,vice.id);assert.equal(vice.role,'mayor');assert.equal(government.viceMayorId,null);assert.notEqual(city.economy.mayorId,mayor.id);
});

test('a chamber president is replaced only by a remaining member of the same party',()=>{
  const city=setup({starter:true,population:48}),council=city.politics.council,[leader,successor,otherParty]=city.citizens.slice(4,7);leader.political.partyId=4;successor.political.partyId=4;otherParty.political.partyId=5;council.members=[leader,successor,otherParty].map((citizen,index)=>({citizenId:citizen.id,partyId:citizen.political.partyId,since:city.minute+index}));council.leaderId=leader.id;council.leaderPartyId=4;council.leaderElectionTerm=city.politics.termNumber;
  council.remove(leader.id,'Cassação criminal');assert.equal(council.leaderId,successor.id);assert.equal(council.leaderPartyId,4);
  council.remove(successor.id,'Cassação criminal');assert.equal(council.leaderId,null);assert.equal(council.leaderPartyId,4);assert.equal(council.members.some(member=>member.citizenId===otherParty.id),true);
});

test('ficha limpa starts disabled and only blocks a convicted candidate for marked offenses when approved',()=>{
  const city=setup({starter:true,population:48}),government=city.politics,justice=city.justice;government.organize();const candidate=city.citizens.find(c=>city.society.isAdult(c)&&!government.officeHolder(c));assert(candidate);assert.equal(justice.policies.cleanRecord,false);assert.equal(justice.policies.parliamentaryImmunity,false);const party=government.parties.find(p=>p.active);candidate.political.partyId=party.id;if(!party.memberIds.includes(candidate.id))party.memberIds.push(candidate.id);
  const record=justice.crimeRecord('graffiti',candidate.id,null);record.chargedCitizenId=candidate.id;record.status='convicted';record.rule={...record.rule,politicalDisqualification:false,cleanRecordDisqualifying:true};justice.policies.penalCode.graffiti.cleanRecordDisqualifying=true;assert.equal(government.canRun(candidate),true);
  justice.policies.cleanRecord=true;assert.equal(government.canRun(candidate),false);justice.policies.cleanRecord=false;record.rule.politicalDisqualification=true;assert.equal(government.canRun(candidate),false);
});

test('mayoral candidate limit is clamped to at least two and at most half the party limit',()=>{
  const city=setup({starter:true,population:128}),government=city.politics;government.policy.partyLimit=8;government.policy.mayorCandidateLimit=1;government.beginElection();assert.equal(government.active.mayorCandidateLimitAtOpening,2);assert.equal(government.active.candidates.length,2);assert(government.active.nominationReport.some(row=>row.status==='Sem vaga no limite de candidaturas'));
  government.active=null;government.policy.mayorCandidateLimit=99;government.beginElection();assert.equal(government.active.mayorCandidateLimitAtOpening,4);assert.equal(government.active.candidates.length,4);
});
