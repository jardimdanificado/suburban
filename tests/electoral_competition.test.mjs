import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {campaignMemory,captureGovernmentExperience} from '../js/city_electoral_behavior.js';
function established(){
  const city=setup({starter:true,population:128}),p=city.politics;p.termNumber=3;p.policy.reelectionLimit=5;p.beginElection();const incumbent=city.society.citizen(city.economy.mayorId),party=p.party(incumbent.political.partyId);p.approval=85;incumbent.skills.governance=95;incumbent.political.popularity=95;party.publicReputation=90;p.mandates.recordScore=(candidateId,partyId)=>candidateId===incumbent.id?35:partyId===party.id?28:0;return{city,p,incumbent,party};
}
function support(city){const counts=new Map();for(const c of city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c))){const choice=city.politics.intentions(c)[0];if(choice)counts.set(choice.partyId,(counts.get(choice.partyId)||0)+1);}return counts;}

test('a popular established administration can win without turning a diverse electorate into unanimity',()=>{
  const {city,p,party}=established();assert.equal(p.active.candidates.length,4);const counts=support(city);assert(counts.size>=3);assert((counts.get(party.id)||0)>city.citizens.length*.4);assert((counts.get(party.id)||0)<city.citizens.length*.9);
});

test('personal deterioration can defeat the governing party despite its accumulated prestige',()=>{
  const {city,p,party}=established(),before=support(city).get(party.id)||0;p.approval=20;for(const c of city.citizens){c.needs.food=15;c.needs.health=40;c.homeUnitId=null;c.happiness=25;}
  const counts=support(city),after=counts.get(party.id)||0,winner=[...counts].sort((a,b)=>b[1]-a[1])[0];assert(after<before);assert.notEqual(winner[0],party.id);assert.equal(p.active.ballots.length,0);
});

test('voter preferences remain deterministic across inspection and polling',()=>{
  const {city,p}=established(),voter=city.citizens[50],before=p.intentions(voter),state=city.seed;for(let i=0;i<10;i++)assert.deepEqual(p.intentions(voter),before);assert.equal(city.seed,state);
});

test('a strong government can still receive a large majority when its ideas fit the electorate',()=>{
  const {city,p,party}=established();for(const c of city.citizens){c.political.ideology={...party.ideology};c.homeUnitId='test-home';c.needs.food=95;c.happiness=90;captureGovernmentExperience(city,c,p.mandates.current.id);}assert((support(city).get(party.id)||0)>city.citizens.length*.8);
});

test('campaign support restarts for each first round but remains continuous through the runoff',()=>{
  const {city,p}=established(),e=p.active,n=e.candidates[0],voter=city.citizens.find(c=>c.id!==n.citizenId);voter.political.support[n.partyId]={score:40,contacts:12,lastContact:city.minute-500,electionId:e.id-1,cycleId:e.id-1};p.campaignContact(voter,n,e,'New campaign');const opinion=voter.political.support[n.partyId];assert.equal(opinion.contacts,1);assert(opinion.score<30);const first=opinion.score;
  city.minute+=180;p.campaignContact(voter,n,{...e,id:e.id+1,firstRoundId:e.id,round:2},'Runoff');assert.equal(opinion.contacts,2);assert(opinion.score>first*.25);
});

test('repeated campaign messages saturate and rejected allegations do not damage a candidacy',()=>{
  const {city,p}=established(),voter=city.citizens[50],n=p.active.candidates[0],c=city.society.citizen(n.citizenId),party=p.party(n.partyId);voter.political.memories=Array.from({length:48},()=>({kind:'campaign-rally',candidateId:c.id,partyId:party.id,electionId:p.active.id,effect:8,minute:city.minute}));assert(campaignMemory(voter,c,party,p.active,city.minute)<=12);
  voter.political.memories=[{kind:'defamation',candidateId:c.id,partyId:party.id,electionId:p.active.id,effect:-30,believes:false,minute:city.minute}];assert.equal(campaignMemory(voter,c,party,p.active,city.minute),0);assert.equal(campaignMemory(voter,c,party,null,city.minute),0);
});

test('a party without eligible members can invite a willing independent without exceeding affiliation limits',()=>{
  const city=setup({starter:true,population:128}),p=city.politics,party=p.parties.find(party=>party.id!==p.partyOfId(city.economy.mayorId).id);p.policy.entrepreneurCandidates=false;for(const id of party.memberIds)city.society.citizen(id).businessIds=[999999];for(const c of city.citizens)if(!c.political.partyId)c.political.engagement=.1;
  const willing=city.citizens.find(c=>!c.political.partyId&&p.eligible(c));assert(willing);Object.assign(willing.political,{ideology:{...party.ideology},engagement:.95,membershipCooldownUntil:0});assert(!p.standing.nomination(party).candidate);const recruit=p.standing.recruitConventionNominee(party);assert.equal(recruit.id,willing.id);assert(p.canRun(willing,'mayor',true));assert(city.citizens.filter(c=>c.political.partyId).length<=Math.floor(city.citizens.length*.4));
});

test('coalitions retain two viable heads and their vice parties remain allied in the runoff',()=>{
  const city=setup({starter:true,population:64}),p=city.politics;p.standing.refresh=()=>{};
  for(const [index,party]of p.parties.entries()){while(party.memberIds.length<4){const c=city.citizens.find(c=>!c.political.partyId&&p.eligible(c));if(!c||!p.join(c,party,'Convention fixture'))break;}party.ideology={economy:0,liberty:.2,green:.5};party.publicReputation=index%2===0?65:40;for(const id of party.memberIds){const c=city.society.citizen(id);c.political.popularity=index%2===0?65:40;c.skills.governance=20;}}
  city.random=()=>0;p.beginElection();const e=p.active;assert(e.candidates.length>=2);assert(e.coalitions.length>0);const headIds=new Set(e.candidates.map(c=>c.citizenId));assert(e.coalitions.every(c=>headIds.has(c.mayorId)));
  const finalists=e.candidates.slice(0,2);p.beginRunoff(e,finalists);for(const n of p.active.candidates)if(n.vicePartyId!==n.partyId)assert(n.endorsementPartyIds.includes(n.vicePartyId));
});

test('physical ballot casting records each individual choice and preserves opposition votes',()=>{
  const {city,p,party}=established(),e=p.active;city.minute=e.voteAt;p.voting.open(e);const hall=p.voting.hall(e);assert(hall);
  for(const c of city.citizens){for(const key of Object.keys(c.needs))c.needs[key]=95;c.entity.x=hall.door.x;c.entity.y=hall.door.y;c.path=[];c.task='vote';c.voting={electionId:e.id};const row=e.roll.get(c.id);row.status='casting';row.arrivedAt=city.minute;p.voting.cast(e,row);}
  assert.equal(e.ballots.length,city.citizens.length);assert.equal(new Set(e.ballots.map(b=>b.citizenId)).size,e.ballots.length);assert(new Set(e.ballots.map(b=>b.partyId)).size>1);assert(e.ballots.some(b=>b.partyId===party.id));assert.equal(Object.values(e.mayorCounts).reduce((n,v)=>n+v,0),e.ballots.length);
});

test('poll rejection uses the new neutral score rather than rejecting every moderately positive option',()=>{
  const {city,p}=established(),voter=city.citizens.find(c=>{const top=p.intentions(c)[0];return top&&top.score>0&&top.score<40;});assert(voter);const top=p.intentions(voter)[0],response=p.getResearch().interview(voter,p.active,city.citizens[0],{x:40,y:40,label:'Praça'});assert(response);assert(!response.rejectedIds.includes(top.candidateId));
});
