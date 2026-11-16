import {CitySimulationBridge} from '../js/city_sim_bridge.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney} from './helpers/city.mjs';
import {pendingMayorDecisions,mayorDecisionBlocked} from '../js/city_mayor_decisions.js';
import {updateMayorCampaign} from '../js/city_mayor_campaign.js';
import {renderMayorDecision} from '../js/city_mayor_decision_ui.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
const start=()=>{const city=setup({starter:true,population:24});assert(city.mayorAction('start'));return city;};
const confirm=city=>assert(city.mayorAction('confirmReview',{kind:'government'}),city.lastError);
function page(){const buttons=[];return {buttons,p:new Proxy({button(label,click){buttons.push({label,click});},buttons(rows){buttons.push(...rows);}}, {get:(o,k)=>o[k]||(()=>{})})};}

test('assuming office pauses simulation until program and cabinet are confirmed; selected promises persist',()=>{
  const city=start(),cash=totalMoney(city),minute=city.minute,review=city.mayorCampaign.governmentReview;
  assert(review);assert.equal(pendingMayorDecisions(city)[0].kind,'government');
  city.update(60);city.stepMinute();assert.equal(city.minute,minute);
  const selected=review.choices.slice(0,3).map(p=>p.metric);assert.equal(selected.length,3);
  assert(city.mayorAction('reviewPromises',{kind:'government',metrics:selected}));
  assert(!city.mayorAction('reviewPromises',{kind:'government',metrics:['invented']}));
  confirm(city);assert(!mayorDecisionBlocked(city));
  assert.deepEqual(city.politics.mandates.current.promises.map(p=>p.metric),selected);
  assert.equal(totalMoney(city),cash);city.update(.25);assert.equal(city.minute,minute+1);
  const copy=new CityStateGraph().apply(new CityStateGraph().encode({city})).city;bindCityState(copy);
  assert.deepEqual(copy.politics.mandates.current.promises.map(p=>p.metric),selected);
  updateMayorCampaign(copy);assert.equal(copy.mayorCampaign.governmentReview,null);
});

test('empty programs cannot confirm; appointments remain subject to existing office rules',()=>{
  const city=start(),review=city.mayorCampaign.governmentReview;
  assert(city.mayorAction('reviewPromises',{kind:'government',metrics:[]}));assert(!city.mayorAction('confirmReview',{kind:'government'}));
  assert(city.mayorAction('reviewPromises',{kind:'government',metric:review.choices[0].metric}));
  assert(!city.mayorAction('appoint',{officeId:'health',citizenId:city.economy.mayorId}));
  const gov=city.politics,candidate=city.citizens.find(c=>gov.eligible(c)&&c.id!==city.economy.mayorId&&c.id!==gov.viceMayorId&&!gov.council.members.some(m=>m.citizenId===c.id));
  assert(candidate);assert(city.mayorAction('appoint',{officeId:'health',citizenId:candidate.id}),city.lastError);
  confirm(city);gov.ensureSecretaries();assert.equal(gov.secretaries.find(row=>row.officeId==='health').citizenId,candidate.id);
});

test('counting a same-party election pauses for a new government even when the mayor is reelected',()=>{
  const city=start();confirm(city);const gov=city.politics,mayor=city.society.citizen(city.economy.mayorId),old=gov.mandates.current.id;
  const n={citizenId:mayor.id,name:mayor.entity.properties.name,partyId:city.mayorCampaign.partyId,platform:'social',promises:gov.mandates.current.promises.map(p=>({...p})),endorsementPartyIds:[city.mayorCampaign.partyId],viceId:gov.viceMayorId};
  gov.policy.reelectionLimit=10;gov.termNumber=1;
  const e={id:991,round:1,startedAt:city.minute-1440,voteAt:city.minute,status:'counting',readyToFinish:true,candidates:[n],councilCandidates:[],ballots:[{citizenId:mayor.id,candidateId:mayor.id}],mayorCounts:{[mayor.id]:1},councilCounts:{},councilPartyCounts:{},secretaryCounts:{},secretaryModes:{},polls:[],events:[],mayorElectionSystem:'direct'};
  gov.active=e;gov.vote();assert.equal(e.status,'completed');assert.notEqual(gov.mandates.current.id,old);
  const minute=city.minute;city.update(30);assert.equal(city.minute,minute);
  assert.equal(city.mayorCampaign.governmentReview.initial,false);assert.equal(pendingMayorDecisions(city)[0].kind,'government');
});

test('campaign program selection pauses before outreach and uses the chosen real promises',()=>{
  const city=start();confirm(city);const gov=city.politics,mayor=city.society.citizen(city.economy.mayorId);
  const n={citizenId:mayor.id,partyId:city.mayorCampaign.partyId,name:mayor.entity.properties.name,promises:gov.mandates.current.promises,platform:'social'};
  gov.active={id:992,status:'campaign',candidates:[n],voteAt:city.minute+1440,events:[]};
  updateMayorCampaign(city);assert.equal(pendingMayorDecisions(city)[0].kind,'program');
  const minute=city.minute;city.update(20);assert.equal(city.minute,minute);assert(gov.campaigns.playerDirects(n));
  const metrics=city.mayorCampaign.programReview.choices.slice(0,3).map(p=>p.metric);
  assert(city.mayorAction('reviewPromises',{kind:'program',metrics}));assert(city.mayorAction('confirmReview',{kind:'program'}));
  assert.deepEqual(n.promises.map(p=>p.metric),metrics);assert(!mayorDecisionBlocked(city));
});

test('bills permit simulation progress and allow explicit sanction or veto during their deadline',()=>{
  const city=start();confirm(city);
  const bill=city.mayorAction('bill',{type:'worksTransfer',value:10000});assert(bill);bill.status='awaiting-sanction';bill.sanctionAt=city.minute+360;
  const minute=city.minute;city.update(.25);assert.equal(city.minute,minute+1);assert(!mayorDecisionBlocked(city));assert.equal(bill.status,'awaiting-sanction');
  const render=page(),ui={city,mayorDecisionKey:`bill:${bill.id}`};renderMayorDecision(ui,render.p);
  assert(render.buttons.some(b=>b.label==='SANCIONAR AGORA'));assert(render.buttons.some(b=>b.label==='VETAR PROJETO'));
  render.buttons.find(b=>b.label==='SANCIONAR AGORA').click();assert.notEqual(bill.status,'awaiting-sanction');assert.equal(bill.sanctionedAt,city.minute);
  const next=city.mayorAction('bill',{type:'worksBudget',value:100000});assert(next);next.status='awaiting-sanction';
  assert(city.mayorAction('veto',{billId:next.id}));assert.equal(next.status,'vetoed');assert(!mayorDecisionBlocked(city));
});

test('review windows render program and appointment steps from persisted pending state',()=>{
  const city=start(),review=city.mayorCampaign.governmentReview,ui={city,mayorDecisionKey:`government:${review.key}`,selectControl(){},resetScroll(){}};
  const first=page();renderMayorDecision(ui,first.p);assert(first.buttons.some(b=>b.label==='REVISAR SECRETARIAS'));
  ui.mayorReviewStage='cabinet';const second=page();renderMayorDecision(ui,second.p);assert(second.buttons.some(b=>b.label==='CONFIRMAR GOVERNO E CONTINUAR'));
  const copy=new CityStateGraph().apply(new CityStateGraph().encode({city})).city;bindCityState(copy);assert(mayorDecisionBlocked(copy));assert.equal(copy.mayorCampaign.governmentReview.key,review.key);
});

test('veto deadline expires exactly, applies tacit sanction, and removes the pending window',()=>{
  const city=start();confirm(city);
  const bill=city.mayorAction('bill',{type:'worksTransfer',value:10000});bill.status='awaiting-sanction';bill.sanctionAt=city.minute+1;
  assert(pendingMayorDecisions(city).some(d=>d.billId===bill.id));
  city.update(.25);assert.equal(city.minute,bill.sanctionAt);assert(bill.tacitSanction);assert.notEqual(bill.status,'awaiting-sanction');
  assert(!pendingMayorDecisions(city).some(d=>d.billId===bill.id));assert(!city.mayorAction('veto',{billId:bill.id}));
});

test('council-specific pause can be enabled and disabled while a bill is pending',()=>{
 const city=start();confirm(city);
 const bill=city.mayorAction('bill',{type:'worksTransfer',value:10000});bill.status='awaiting-sanction';bill.sanctionAt=city.minute+10;
 city.mayorPauseForCouncilBills=true;const minute=city.minute;city.update(10);assert.equal(city.minute,minute);assert(mayorDecisionBlocked(city));
 city.mayorPauseForCouncilBills=false;city.update(.25);assert.equal(city.minute,minute+1);assert.equal(bill.status,'awaiting-sanction');
});

test('changing the council pause option sends worker controls even when speed and pause are unchanged',()=>{
 const messages=[],bridge={active:true,cityId:'test',city:{},time:{paused:false,speed:1},motionOptions:{pauseForCouncilBills:false},observed:true,worker:{postMessage:m=>messages.push(m)}};
 CitySimulationBridge.prototype.control.call(bridge);assert.equal(messages.at(-1).pauseForCouncilBills,false);
 bridge.motionOptions.pauseForCouncilBills=true;CitySimulationBridge.prototype.control.call(bridge);assert.equal(messages.length,2);assert.equal(messages.at(-1).pauseForCouncilBills,true);
 bridge.motionOptions.pauseForCouncilBills=false;CitySimulationBridge.prototype.control.call(bridge);assert.equal(messages.length,3);assert.equal(messages.at(-1).pauseForCouncilBills,false);
});

test('party can choose an eligible ticket and update the election and council slate',()=>{
  const city=start();confirm(city);const gov=city.politics,party=gov.party(city.mayorCampaign.partyId);
  gov.termNumber=1;gov.policy.reelectionLimit=10;
  const people=city.citizens.filter(c=>gov.eligible(c)).slice(0,4);
  for(const c of people){gov.initializeCitizen(c);c.political.partyId=party.id;c.playerPoliticalAmbition=true;if(!party.memberIds.includes(c.id))party.memberIds.push(c.id);}
  const eligible=people.filter(c=>gov.canRun(c,'mayor',true));assert(eligible.length>=3);
  const [old,candidate,vice]=eligible,n={citizenId:old.id,name:old.entity.properties.name,partyId:party.id,partyNumber:party.number,viceId:null,vicePartyId:party.id,promises:gov.mandates.current.promises,platform:'social'};
  gov.active={id:993,round:1,status:'campaign',candidates:[n],councilCandidates:[candidate,vice].map(c=>({citizenId:c.id,partyId:party.id,name:c.entity.properties.name})),coalitions:[],nominationReport:[{partyId:party.id,candidateId:old.id}],voteAt:city.minute+1440,events:[]};
  updateMayorCampaign(city);assert(city.mayorAction('reviewCandidate',{citizenId:candidate.id}),city.lastError);assert(city.mayorAction('reviewVice',{citizenId:vice.id}),city.lastError);
  assert(!city.mayorAction('reviewVice',{citizenId:candidate.id}));assert(city.mayorAction('confirmReview',{kind:'program'}),city.lastError);
  assert.equal(n.citizenId,candidate.id);assert.equal(n.viceId,vice.id);assert.equal(gov.active.nominationReport[0].candidateId,candidate.id);
  assert(!gov.active.councilCandidates.some(row=>row.citizenId===candidate.id||row.citizenId===vice.id));
  updateMayorCampaign(city);assert.equal(city.mayorCampaign.programReview,null);
});

test('project link opens the council bill detail',()=>{
  const city=start();confirm(city);const bill=city.mayorAction('bill',{type:'worksTransfer',value:10000});bill.status='awaiting-sanction';bill.sanctionAt=city.minute+10;
  let destination;const ui={city,mayorDecisionKey:`bill:${bill.id}`,openPanel:options=>{destination=options;}};
  const links=[],p=new Proxy({windowLink:(label,click)=>links.push({label,click})},{get:(o,k)=>o[k]||(()=>{})});
  renderMayorDecision(ui,p);links.find(link=>link.label==='LER PROJETO COMPLETO').click();
  assert.equal(destination.tab,'government');assert.equal(destination.views.government,'elections');assert.equal(destination.politicsTab,'council');assert.equal(destination.billId,bill.id);
});
