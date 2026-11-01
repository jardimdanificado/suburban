import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney} from './helpers/city.mjs';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
import {alterBribedTestimony} from '../js/city_witness_bribery.js';

function people(city){
  const [payer,worker,witness]=city.citizens;for(const person of [payer,worker,witness]){person.entity.x=12;person.entity.y=12;person.path=[];person.indoorLocation=null;person.needs.health=90;person.custody=null;}
  for(const person of [payer,worker,witness])if(city.accounts.get(person.accountId).balance<5000)city.transfer('treasury',person.accountId,5000-city.accounts.get(person.accountId).balance,'Fixture de capacidade para suborno');
  return {payer,worker,witness};
}
function addPublicBuilding(city,type){
  for(const site of city.economy.locateBuilding(type)){const building=city.addBuilding(type,site.x,site.y,{...site,free:true});if(building){building.active=true;return building;}}
  throw new Error(`Sem terreno para ${type}`);
}

test('witness bribery transfers existing money, reports the participants and preserves the transaction in snapshots',()=>{
  const city=setup({starter:true,population:32}),{payer,witness}=people(city),source=city.justice.crimeRecord('theft',payer.id,null);source.status='reported';source.witnesses=[{citizenId:witness.id,identifiedSuspectId:payer.id,confidence:.9}];city.random=()=>0;
  const before=totalMoney(city),payerBefore=city.accounts.get(payer.accountId).balance,witnessBefore=city.accounts.get(witness.accountId).balance,paid=city.justice.offerWitnessBribe(source.id,payer.id,witness.id,250);assert.equal(paid.status,'paid');assert.equal(totalMoney(city),before);assert.equal(city.justice.cases.filter(record=>record.type==='witnessBribery').length,2);assert.equal(city.accounts.get(payer.accountId).balance,payerBefore-250);assert.equal(city.accounts.get(witness.accountId).balance,witnessBefore+250);assert.equal(source.witnessBribes[0].paymentEventId>0,true);
  const graph=new CityStateGraph(),copy=new CityStateGraph().apply(graph.encode({city})).city;bindCityState(copy);const restored=copy.justice.cases.find(record=>record.id===source.id);assert.equal(restored.witnessBribes[0].status,'paid');assert.equal(restored.witnessBribes[0].paymentEventId,source.witnessBribes[0].paymentEventId);
});

test('a bribed witness can alter an interview, and a refused bribe produces no payment',()=>{
  const city=setup({starter:true,population:32}),{payer,witness}=people(city),source=city.justice.crimeRecord('theft',payer.id,null);source.status='investigating';source.witnesses=[{citizenId:witness.id,identifiedSuspectId:payer.id,confidence:.9}];city.random=()=>0;
  const before=totalMoney(city),bribe=city.justice.offerWitnessBribe(source.id,payer.id,witness.id,250);assert.equal(bribe.status,'paid');const interview=alterBribedTestimony(city.justice,source,witness,{kind:'police-interview',witnessId:witness.id,identifiedSuspectId:payer.id,confidence:.9});assert.equal(interview.identifiedSuspectId,null);assert.equal(interview.bribeEffect,'omission');assert.equal(totalMoney(city),before);
  const refusedCity=setup({starter:true,population:32}),refused=people(refusedCity),record=refusedCity.justice.crimeRecord('theft',refused.payer.id,null);record.status='reported';record.witnesses=[{citizenId:refused.witness.id,identifiedSuspectId:refused.payer.id,confidence:.9}];refusedCity.random=()=>1;const money=totalMoney(refusedCity),attempt=refusedCity.justice.offerWitnessBribe(record.id,refused.payer.id,refused.witness.id,250);assert.equal(attempt.status,'refused');assert.equal(totalMoney(refusedCity),money);
});

test('judge bribery requires the assigned judge and records payment without creating money',()=>{
  const city=setup({starter:true,population:32}),{payer,worker:judge}=people(city),source=city.justice.crimeRecord('theft',payer.id,null);source.status='charged';source.chargedCitizenId=payer.id;source.trial={status:'hearing-scheduled',judgeId:judge.id,hearingAt:city.minute+300};city.random=()=>0;
  const before=totalMoney(city),bribe=city.justice.offerJudgeBribe(source.id,payer.id,300);assert.equal(bribe.status,'paid');assert.equal(source.trial.judgeBribe.judgeId,judge.id);assert.equal(totalMoney(city),before);assert.equal(bribe.caseIds.length,2);
  source.trial.judgeId=null;assert.equal(city.justice.offerJudgeBribe(source.id,payer.id,300),false);
});

test('a documented ally can bribe the judge on the defendant’s behalf',()=>{
  const city=setup({starter:true,population:32}),{payer,worker:judge,witness:defendant}=people(city),source=city.justice.crimeRecord('theft',defendant.id,null);source.status='charged';source.chargedCitizenId=defendant.id;source.trial={status:'hearing-scheduled',judgeId:judge.id,hearingAt:city.minute+300};payer.political.partyId=defendant.political.partyId=7;city.random=()=>0;
  const stranger=city.citizens[4];city.transfer('treasury',stranger.accountId,5000,'Fixture de capacidade para suborno');const bribe=city.justice.offerJudgeBribe(source.id,payer.id,200);assert.equal(bribe.status,'paid');assert.equal(bribe.payerId,payer.id);assert.equal(bribe.beneficiaryId,defendant.id);assert.equal(bribe.caseIds.length,2);assert.equal(city.justice.offerJudgeBribe(source.id,stranger.id,200),false);
});

test('a convicted bribed judge loses eligibility and the tainted verdict is reopened once',()=>{
  const city=setup({starter:true,population:32}),{payer,worker:judge}=people(city),source=city.justice.crimeRecord('theft',payer.id,null);source.status='convicted';source.chargedCitizenId=payer.id;source.trial={status:'convicted',judgeId:judge.id,convictionChance:.9};source.sentence={fine:0,imprisonmentMinutes:0};source.evidence=[{kind:'police-interview',witnessId:city.citizens[2].id}];source.trial.judgeBribe={status:'paid',judgeId:judge.id,payerId:payer.id};
  const conviction={id:900,type:'judgeBribery',status:'convicted',chargedCitizenId:judge.id,details:{role:'recipient',judgeId:judge.id,sourceCaseId:source.id}};city.justice.cases.push(conviction);
  assert.equal(city.justice.applyJudgeDisqualification(conviction),true);assert.equal(judge.judicialDisqualifiedAt,city.minute);assert.equal(city.justice.reopenBribedJudgment(conviction),true);assert.equal(source.status,'charged');assert.equal(source.trial,null);assert.equal(source.pastTrials.length,1);assert.equal(source.details.recusedJudgeIds.includes(judge.id),true);assert.equal(city.justice.reopenBribedJudgment(conviction),false);
});

test('convicting a bribed witness removes only that witness evidence and reopens the verdict',()=>{
  const city=setup({starter:true,population:32}),{payer,witness}=people(city),source=city.justice.crimeRecord('theft',payer.id,null);source.status='convicted';source.chargedCitizenId=payer.id;source.trial={status:'convicted',convictionChance:.9};source.sentence={fine:0,imprisonmentMinutes:0};source.evidence=[{kind:'witness-identification',witnessId:witness.id},{kind:'document-analysis',witnessId:null}];
  const conviction={id:901,type:'witnessBribery',status:'convicted',chargedCitizenId:witness.id,details:{role:'recipient',witnessId:witness.id,sourceCaseId:source.id,paymentEventId:77}};city.justice.cases.push(conviction);
  assert.equal(city.justice.reopenBribedWitnessJudgment(conviction),true);assert.equal(source.status,'charged');assert.deepEqual(source.evidence,[{kind:'document-analysis',witnessId:null}]);assert.equal(source.pastEvidence[0].witnessId,witness.id);assert.equal(source.details.excludedWitnessIds.includes(witness.id),true);assert.equal(city.justice.reopenBribedWitnessJudgment(conviction),false);
});

test('forensic bribery is limited to a named suspect and the examiner physically inside the IML',()=>{
  const city=setup({starter:true,population:32}),{payer,worker:examiner}=people(city),iml=addPublicBuilding(city,'iml'),unit=iml.units.find(item=>item.roomType==='workspace')||iml.units[0];examiner.jobId=iml.id;iml.workers=[examiner.id];examiner.indoorLocation={buildingId:iml.id,unitId:unit.id,floor:unit.z,roomType:unit.roomType,position:{x:12,y:12,z:0},path:[]};payer.indoorLocation={...examiner.indoorLocation,position:{x:12.5,y:12,z:0}};
  const source=city.justice.crimeRecord('murder',null,payer.id);source.status='investigating';source.investigation={suspectId:payer.id};const body={id:88,citizenId:3,name:'Pessoa falecida',status:'autopsy',imlBuildingId:iml.id,forensicExaminerId:examiner.id,criminalCaseId:source.id,diedAt:city.minute,entity:{x:12,y:12,destroyed:false}};city.justice.bodies.push(body);city.random=()=>0;
  const before=totalMoney(city),bribe=city.justice.offerForensicBribe(body.id,payer.id,400);assert.equal(bribe.status,'paid');assert.equal(totalMoney(city),before);assert.equal(bribe.caseIds.length,2);
  const uninvolved=city.citizens.find(person=>person.id!==payer.id&&person.id!==examiner.id);source.investigation.suspectId=uninvolved.id;assert.equal(city.justice.offerForensicBribe(body.id,uninvolved.id,400),false);
});
