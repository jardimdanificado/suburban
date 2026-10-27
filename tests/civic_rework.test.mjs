import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {electPartyLeader} from '../js/city_party_leadership.js';
import {syncCorruptionVotes} from '../js/city_corruption_votes.js';
import {workCellReady,advanceCitizenInterior} from '../js/city_interiors.js';

test('party leadership is chosen by individual member ballots and retained for inspection',()=>{
 const city=setup({starter:true,population:128}),p=city.politics,party=p.parties.find(p=>p.active&&p.memberIds.length>=2);assert(party);
 const result=electPartyLeader(p,party);assert(result);assert.equal(result.votes.length,party.memberIds.filter(id=>{const c=city.society.citizen(id);return c&&!c.entity.destroyed&&city.society.isAdult(c)&&c.political.partyId===party.id}).length);
 assert.equal(result.winnerId,result.ranking[0].id);assert.equal(party.leaderId,result.winnerId);assert(result.ranking[0].votes>=result.ranking.at(-1).votes);
 const count=party.leaderElections.length;p.organize();assert.equal(party.leaderElections.length,count);
});

test('only informed voters remember the votes on a proven corruption case, including later discoveries',()=>{
 const city=setup({starter:true,population:128}),p=city.politics,council=p.council.people();assert(council.length>=2);const voters=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)),[a,b]=voters.filter(c=>!council.includes(c));
 const record={id:777,proven:true,severity:80,awareIds:[a.id]},bill={id:999,type:'convict',payload:{caseId:777,targetId:city.economy.mayorId},votedAt:city.minute,title:'Caso',votes:[{citizenId:council[0].id,partyId:council[0].political.partyId,yes:true},{citizenId:council[1].id,partyId:council[1].political.partyId,yes:false}]};p.council.bills.push(bill);
 syncCorruptionVotes(p,record);assert(a.political.memories.some(m=>m.key==='corruption-vote:999'));assert(!b.political.memories.some(m=>m.key==='corruption-vote:999'));const first=bill.corruptionVoteReach;record.awareIds.push(b.id);syncCorruptionVotes(p,record);assert(bill.corruptionVoteReach>first);assert(b.political.memories.some(m=>m.key==='corruption-vote:999'));syncCorruptionVotes(p,record);assert.equal(b.political.memories.filter(m=>m.key==='corruption-vote:999').length,1);
});

test('work moves between available indoor work cells and does not produce while in transit',()=>{
 const city=setup({starter:true,population:128}),b=city.buildings.find(b=>b.type==='paintworks'),c=city.society.citizen(b.workers[0]);c.path=[];c.entity.x=b.door.x;c.entity.y=b.door.y;c.task='work';c.targetId=b.id;c.indoorLocation=null;c.workCell=null;
 workCellReady(city,c,b);advanceCitizenInterior(city,c,100);assert(workCellReady(city,c,b));const first=c.indoorLocation.unitId;c.nextWorkRotationAt=city.minute;assert.equal(workCellReady(city,c,b),false);assert.notEqual(c.indoorLocation.targetUnitId,first);assert(c.indoorLocation.path.length);
});

test('case intervention applies to the selected case even if another is more severe',()=>{
 const city=setup({starter:true,population:64}),p=city.politics,c=city.citizens[0],make=(id,severity)=>({id,accusedId:c.id,participantIds:[c.id],severity,evidence:0,awareIds:[],archived:false});const first=make(901,20),second=make(902,90);p.corruption.push(first,second);
 const result=p.intervene('expose',c.id,{caseId:first.id});assert(result);assert.equal(result.caseId,first.id);assert(first.evidence>0);assert.equal(second.evidence,0);
});

test('chamber excludes the accused from a proven corruption vote and records condemnation',()=>{
 const city=setup({starter:true,population:128}),p=city.politics,council=p.council,people=council.people();assert(people.length>=3);const accused=people[0],record={id:778,accusedId:accused.id,participantIds:[accused.id],proven:true,severity:85,awareIds:city.citizens.filter(c=>city.society.isAdult(c)).slice(0,20).map(c=>c.id)};p.corruption.push(record);p.scandals.push(record);
 const bill=council.propose(people[1],'convict',{targetId:accused.id,caseId:record.id});assert(bill);council.getChamber=()=>({open:()=>true,present:()=>people,hall:()=>({id:123})});council.preference=()=>({yes:true,reason:'Provas'});council.vote(bill);
 assert.equal(bill.status,'executed');assert(record.convictedIds.includes(accused.id));assert(!bill.votes.some(v=>v.citizenId===accused.id));assert.equal(bill.votes.length,people.length-1);
});
