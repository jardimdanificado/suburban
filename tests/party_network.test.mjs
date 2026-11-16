import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney} from './helpers/city.mjs';
import {partyMediaAction} from '../js/city_party_media.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
const start=()=>{const c=setup({starter:true,population:24});assert(c.mayorAction('start'));assert(c.mayorAction('confirmReview',{kind:'government'}));return c;};
test('planned diversion spends only on execution and produces a persistent corruption case',()=>{
 const city=start(),actor=city.economy.mayorId,cash=totalMoney(city),before=city.treasury,amount=city.currency.price(100);
 const plan=city.mayorAction('partySchemePlan',{kind:'embezzlement',citizenId:actor,amount});assert(plan);assert.equal(city.treasury,before);
 const record=city.mayorAction('partySchemeExecute',{schemeId:plan.id});assert(record,city.lastError);assert.equal(city.treasury,before-amount);assert.equal(totalMoney(city),cash);assert.equal(plan.status,'executed');assert(city.politics.corruption.includes(record));
 assert(!city.mayorAction('partySchemeExecute',{schemeId:plan.id}));
 const copy=new CityStateGraph().apply(new CityStateGraph().encode({city})).city;bindCityState(copy);assert.equal(copy.mayorCampaign.schemes[0].status,'executed');assert(copy.politics.corruption.some(r=>r.id===record.id));
});
test('opposition cannot divert the treasury; private management requires a member owner',()=>{
 const city=start(),p=city.politics,mayor=city.society.citizen(city.economy.mayorId),own=city.mayorCampaign.partyId,other=p.parties.find(r=>r.active&&r.id!==own);
 const plan=city.mayorAction('partySchemePlan',{kind:'embezzlement',citizenId:mayor.id,amount:100});assert(plan);mayor.political.partyId=other.id;
 const before=city.treasury;assert(!city.mayorAction('partySchemeExecute',{schemeId:plan.id}));assert.equal(city.treasury,before);assert.equal(plan.status,'planned');
 const b=city.buildings.find(b=>b.active);b.municipal=false;b.ownerId=mayor.id;assert(!city.mayorAction('partyBusiness',{buildingId:b.id,command:'employment',baseWage:20}));
});
test('media participation supports invitations, per-turn replies, refusal and expiry',()=>{
 const city=start(),p=city.politics,person=city.citizens.find(c=>c.political?.partyId===city.mayorCampaign.partyId&&p.eligible(c)),host=city.buildings.find(b=>b.active);assert(person);host.type='newsroom';
 assert(partyMediaAction(city,{command:'request',citizenId:person.id,buildingId:host.id,kind:'interview',topic:'jobs'}));
 const e=city.mayorCampaign.mediaSession,m=e.mediaEvents[0],target={electionId:e.id,mediaId:m.id};
 p.campaigns.routeMediaCandidates=()=>true;p.campaigns.media(e);assert.equal(m.turns.length,0);
 assert(partyMediaAction(city,{...target,command:'reply',reply:'proposal',tone:'cordial'}));p.campaigns.media(e);assert.equal(m.turns.length,1);assert(m.turns[0].score>=0);assert.equal(m.playerReply,undefined);
 p.campaigns.media(e);assert.equal(m.turns.length,1);
 assert(!partyMediaAction(city,{...target,command:'reply',reply:'invented',tone:'cordial'}));
 assert(partyMediaAction(city,{...target,command:'decline'}));assert.equal(m.status,'cancelled');
 city.minute+=1440;assert(partyMediaAction(city,{command:'request',citizenId:person.id,buildingId:host.id,topic:'jobs'}));
 const second=city.mayorCampaign.mediaSession;city.minute=second.voteAt;p.campaigns.media(second);assert.equal(second.mediaEvents[0].status,'cancelled');
});

test('institution placement requires an eligible real vacancy and leaves a corruption trail',()=>{
 const city=start(),p=city.politics,partyId=city.mayorCampaign.partyId;
 const c=city.citizens.find(c=>city.society.isAdult(c)&&!p.officeHolder(c));assert(c);p.initializeCitizen(c);c.political.partyId=partyId;
 const organ=city.buildings.find(b=>b.active&&b.id!==city.townhall().id);organ.type='courthouse';organ.jobs=organ.workers.length+1;
 city.transfer('treasury',organ.accountId,city.currency.price(100000),'Test funding',{essential:true});
 c.judicialDisqualifiedAt=city.minute;assert(!city.mayorAction('partyPlacement',{command:'patronage',citizenId:c.id,buildingId:organ.id}));
 delete c.judicialDisqualifiedAt;
 const record=city.mayorAction('partyPlacement',{command:'patronage',citizenId:c.id,buildingId:organ.id});assert(record,city.lastError);
 assert.equal(c.jobId,organ.id);assert(organ.workers.includes(c.id));assert.equal(record.type,'favoritism');assert.equal(c.partyPlacementCaseId,record.id);
});

test('company commands use owner funds and reject foreign property',()=>{
 const city=start(),p=city.politics,person=city.society.citizen(city.economy.mayorId),b=city.buildings.find(b=>b.active&&b.id!==city.townhall().id);
 b.municipal=false;b.ownerId=person.id;const amount=city.currency.price(100);city.transfer('treasury',person.accountId,amount,'Test funding',{essential:true});
 const before=b.balance,treasury=city.treasury,cash=totalMoney(city);
 assert(city.mayorAction('partyBusiness',{command:'fund-business',buildingId:b.id,amount}));assert.equal(b.balance,before+amount);assert.equal(city.treasury,treasury);assert.equal(totalMoney(city),cash);
 assert(city.mayorAction('partyBusiness',{command:'employment',buildingId:b.id,baseWage:10,minSkill:0,allowTraining:true,manualHiring:true}));assert(b.playerHiring);
 assert(!city.mayorAction('partyBusiness',{command:'invented',buildingId:b.id}));
});

test('joining an existing scheme records the participant and a real transfer in that case',()=>{
 const city=start(),p=city.politics,mayor=city.society.citizen(city.economy.mayorId),person=city.citizens.find(c=>c.id!==mayor.id&&city.society.isAdult(c));
 p.initializeCitizen(person);person.political.partyId=city.mayorCampaign.partyId;const amount=city.currency.price(50);city.transfer('treasury',person.accountId,amount,'Test funding',{essential:true});
 const record=p.crime(mayor,'embezzlement','treasury',mayor.accountId,amount);assert(record);
 const plan=city.mayorAction('partySchemePlan',{kind:'join',citizenId:person.id,caseId:record.id,amount});assert(plan);
 const cash=totalMoney(city),before=city.accounts.get(person.accountId).balance;
 assert(city.mayorAction('partySchemeExecute',{schemeId:plan.id}),city.lastError);
 assert(record.participantIds.includes(person.id));assert.equal(record.steps.length,2);assert.equal(city.accounts.get(person.accountId).balance,before-amount);assert.equal(totalMoney(city),cash);
});

test('clandestine meeting queues a real route without teleporting or executing the plan',()=>{
 const city=start(),p=city.politics,person=city.society.citizen(city.economy.mayorId),target=city.citizens.find(c=>c.id!==person.id&&city.society.isAdult(c));
 const points=p.campaigns.streetPoints(3);assert(points.length>=2);person.indoorLocation=null;target.indoorLocation=null;person.mobilityTrip=null;person.ridingVehicleId=null;person.entity.x=points[0].x;person.entity.y=points[0].y;target.entity.x=points[1].x;target.entity.y=points[1].y;city.urgentNeed=()=>false;
 const plan=city.mayorAction('partySchemePlan',{kind:'witness',citizenId:person.id,caseId:999,targetId:target.id,amount:100});assert(plan);
 const position={x:person.entity.x,y:person.entity.y};assert(city.mayorAction('partySchemeMeet',{schemeId:plan.id}),city.lastError);
 assert.equal(person.task,'party-meeting');assert.deepEqual({x:person.entity.x,y:person.entity.y},position);assert.equal(plan.status,'planned');assert(person.path.length>0);
 assert(city.mayorAction('partySchemeCancel',{schemeId:plan.id}));assert.equal(person.partyMeeting,null);assert.equal(person.task,null);
});
