import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {decreePowerIncrease,impeachmentReady} from '../js/city_executive_powers.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';

function fixture(){
 const city=setup({starter:true,population:64}),p=city.politics;p.ensureSecretaries();
 p.council.preference=()=>({yes:true,ideologicalScore:1,reason:'Apoio'});
 return {city,p,council:p.council,mayor:city.society.citizen(city.economy.mayorId)};
}
function scandal(city,targetId,id=901){
 const proof={id,accusedId:targetId,participantIds:[targetId],proven:true,severity:95,awareIds:city.citizens.filter(c=>city.society.isAdult(c)).map(c=>c.id)};
 city.politics.scandals.push(proof);return proof;
}

test('mayor gets one decree every three days, with normal validation and a secretary veto window',()=>{
 const {city,p,council,mayor}=fixture();
 assert.equal(p.policy.mayorDecreeDays,3);assert.equal(p.policy.impeachmentCooldownElections,2);
 assert(!p.issueDecree('tax',{value:.3}));assert.equal(p.lastDecreeAt,undefined);
 city.minute=p.decreeReadyAt();assert(!p.issueDecree('tax',{value:-1}));assert.equal(p.lastDecreeAt,undefined);
 const before=city.taxRate,decree=p.issueDecree('tax',{value:.3},mayor.id);
 assert(decree);assert.equal(decree.status,'awaiting-secretary-review');assert.equal(decree.votes.length,0);
 council.execute(decree);assert.equal(city.taxRate,before);
 assert(!p.issueDecree('businessTax',{value:.3}));
 city.minute=decree.reviewAt;council.execute(decree);
 assert.equal(decree.status,'executed');assert.equal(city.taxRate,.3);
 city.minute=p.decreeReadyAt();assert(p.issueDecree('businessTax',{value:.3}));
 assert(!p.issueDecree('welfare',{value:100},city.citizens.find(c=>c.id!==mayor.id).id));
});

test('decrees cannot grant more authority or immunity, and rejected attempts do not consume the right',()=>{
 const {city,p}=fixture();city.minute=p.decreeReadyAt();
 for(const [type,payload]of [
  ['mayorDecreeDays',{value:1}],['impeachmentCooldownElections',{value:5}],['reelectionLimit',{value:9}],['termDays',{value:30}],
  ['mayorElectionSystem',{mode:'indirect'}],['councilRate',{value:1}],['councilBudget',{value:0}],['parliamentaryImmunity',{value:true}],
  ['secretaryElection',{office:'finance',mode:'appointed'}]
 ]){
  if(type==='secretaryElection')p.policy.secretaryElectionModes.finance='direct';
  assert(decreePowerIncrease(p,type,payload),type);assert(!p.issueDecree(type,payload),type);
  assert.equal(p.lastDecreeAt,undefined);
 }
 assert(p.issueDecree('mayorDecreeDays',{value:4}));
});

test('only the relevant secretary may veto; a veto preserves the decree interval and can be overridden by the council',()=>{
 const {city,p,council}=fixture();city.minute=p.decreeReadyAt();
 const decree=p.issueDecree('tax',{value:.3}),finance=p.secretaries.find(s=>s.officeId==='finance'),health=p.secretaries.find(s=>s.officeId==='health');
 assert(!p.secretaryVeto(decree.id,health.citizenId));
 const oldRate=city.taxRate;assert(p.secretaryVeto(decree.id,finance.citizenId));
 assert.equal(decree.status,'vetoed');assert.equal(city.taxRate,oldRate);assert(!p.issueDecree('businessTax',{value:.3}));
 const people=council.people();council.chamber={open:()=>true,present:()=>people,hall:()=>({id:1}),plan(){}};
 council.vote(decree,true);
 assert.equal(decree.threshold,Math.ceil(decree.eligibleWeight*2/3));
 assert.equal(decree.status,'executed');assert.equal(city.taxRate,.3);
 assert.equal(p.vetoes.at(-1).status,'overridden');
 assert(!p.secretaryVeto(decree.id,finance.citizenId));
});

test('secretary veto also applies to normal voted bills and autonomous secretaries review their own area',()=>{
 const {city,p,council}=fixture(),author=council.people()[0];
 const bill=council.propose(author,'tax',{value:.3});bill.status='awaiting-sanction';bill.sanctionAt=city.minute;
 const finance=p.secretaries.find(s=>s.officeId==='finance');
 council.preference=(person)=>({yes:person.id!==finance.citizenId,reason:'Discordância na Fazenda'});
 council.execute(bill);assert.equal(bill.status,'vetoed');assert.equal(bill.vetoedBy,finance.citizenId);
});

test('impeachment targets a specific secretary, blocks reappointment and waits for the voted number of elections',()=>{
 const {city,p,council}=fixture(),author=council.people()[0],target=p.secretaries.find(s=>s.officeId==='finance'),other=p.secretaries.find(s=>s.officeId==='health');
 scandal(city,target.citizenId);const bill=p.submitBill('impeach',{targetId:target.citizenId,caseId:901},author.id);assert(bill);
 assert(!impeachmentReady(p));scandal(city,other.citizenId,902);
 assert(!p.submitBill('impeach',{targetId:other.citizenId,caseId:902},author.id));
 assert(p.impeach(target.citizenId,901,bill.id));bill.status='executed';
 assert(!p.secretaries.some(s=>s.citizenId===target.citizenId));assert(p.secretaries.some(s=>s.citizenId===other.citizenId));
 p.ensureSecretaries();assert(!p.secretaries.some(s=>s.citizenId===target.citizenId));
 p.termNumber++;assert(!p.impeachmentReady());p.termNumber++;assert(p.impeachmentReady());
 assert(p.submitBill('impeach',{targetId:other.citizenId,caseId:902},author.id));
});

test('rejected impeachment consumes the interval, rules are votable and state survives save transfer',()=>{
 const {city,p,council,mayor}=fixture(),author=council.people()[0];
 scandal(city,mayor.id);const bill=p.submitBill('impeach',{targetId:mayor.id,caseId:901},author.id);assert(bill);bill.status='rejected';
 assert(!p.impeachmentReady());
 const rules=council.propose(author,'impeachmentCooldownElections',{value:3});assert(rules);rules.status='approved';council.execute(rules);assert.equal(p.policy.impeachmentCooldownElections,3);
 const interval=council.propose(author,'mayorDecreeDays',{value:5});assert(interval);interval.status='approved';council.execute(interval);assert.equal(p.policy.mayorDecreeDays,5);
 const mirror=new CityStateGraph().apply(new CityStateGraph().encode({city})).city;bindCityState(mirror);
 assert.equal(mirror.politics.policy.mayorDecreeDays,5);assert.equal(mirror.politics.policy.impeachmentCooldownElections,3);
 assert.equal(mirror.politics.impeachmentReady(),false);mirror.politics.termNumber+=3;assert(mirror.politics.impeachmentReady());
});

test('an elected mayor is impeached only through a two-thirds vote and succession preserves the decree clock',()=>{
 const {city,p,council,mayor}=fixture(),vice=p.viceMayorId;assert(vice);
 p.lastDecreeAt=city.minute;scandal(city,mayor.id);
 const bill=p.submitBill('impeach',{targetId:mayor.id,caseId:901},council.people()[0].id);assert(bill);
 assert(!p.impeach(mayor.id,901,bill.id+1));
 const people=council.people();council.chamber={open:()=>true,present:()=>people,hall:()=>({id:1}),plan(){},release(){}};
 council.vote(bill);assert.equal(bill.threshold,Math.ceil(bill.eligibleWeight*2/3));
 assert.equal(city.economy.mayorId,vice);assert.equal(p.lastDecreeAt,city.minute);assert(!p.impeachmentReady());
});

test('the autonomous government uses its decree entitlement but leaves player decisions to the player',()=>{
 for(const player of [false,true]){
  const {city,p,mayor}=fixture();mayor.playerControlled=player;city.minute=p.decreeReadyAt();
  const term=p.mandates.current,execution={actions:[]};assert(term?.promises?.length);
  const result=p.agenda.proposal(term,execution,'tax',{value:.3},'Ajustar o imposto salarial');assert(result);
  assert.equal(result.decree===true,!player);
  assert.equal(result.status,player?'awaiting-session':'awaiting-secretary-review');
 }
});
