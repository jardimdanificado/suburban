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
