import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';
import {dispatchPoliceAudits} from '../js/city_police_financial_audit.js';
import {setup,putAtWorkCell} from './helpers/city.mjs';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
import {renderJustice,renderSafety} from '../js/city_justice_ui.js';

function fixture(){
  const people=[1,2,3,4,5,6].map(id=>({id,accountId:`citizen:${id}`,jobId:id>1&&id<4?10:null,task:'work',entity:{x:1,y:1,properties:{name:`Pessoa ${id}`}},path:[],needs:{health:90},traits:{honesty:1},skills:{investigation:90},indoorLocation:id>1&&id<4?{buildingId:10,path:[]}:null,...(id===6?{partnerId:1}:{})}));
  const station={id:10,type:'police_station',active:true,entity:{},workers:[2,3]},transaction={id:70,kind:'finance',from:'citizen:1',to:'citizen:2',amount:200,minute:120,reason:'Transferência pessoal'};
  const city={minute:300,hour:5,citizens:people,world:{},buildings:[station],history:{entries:[transaction]},society:{citizen:id=>people.find(p=>p.id===id)},building:id=>id===10?station:null,random:()=>0,payWage:()=>true,urgentNeed:()=>false,log:()=>({id:90})};
  const justice=new CityJustice(city);city.justice=justice;const source={id:1,type:'theft',status:'no-suspect',occurredAt:90,details:{},witnesses:[{citizenId:4,identifiedSuspectId:1,confidence:.95}],evidence:[],investigation:{officerId:2,stationId:10,startedAt:100,finishedAt:200,status:'inconclusive'}};justice.cases.push(source);justice.nextCaseId=2;return {city,justice,source,auditor:people[2],officer:people[1],transaction};
}
function finish(f){for(let i=0;i<90;i++){f.city.minute++;f.justice.updatePoliceAudit(f.auditor);}}

test('a financial audit finds a real payment without a hidden bribe record or eyewitness to the exchange',()=>{
  const f=fixture();dispatchPoliceAudits(f.justice);assert.equal(f.auditor.policeAudit.caseId,1);assert.equal(f.officer.policeAudit,undefined);finish(f);
  const audit=f.source.investigation.financialAudit;assert.equal(audit.status,'completed');assert.equal(audit.findings[0].eventId,70);assert.equal(audit.progress,90);assert.equal(audit.caseIds.length,2);
  for(const c of f.justice.cases.slice(1)){assert.equal(c.status,'reported');assert.equal(c.offenderId,null);assert.equal(c.evidence[0].eventId,70);assert.equal(c.evidence[0].auditedBy,3);assert.equal(c.witnesses.length,0);}
  f.city.minute+=60;dispatchPoliceAudits(f.justice);assert.equal(f.justice.cases.length,3);assert.equal(f.source.status,'no-suspect');
});

test('a financial audit discovers a suspect’s payment to the judge assigned to that trial',()=>{
  const f=fixture();f.source.trial={status:'hearing-scheduled',judgeId:5,scheduledAt:110,hearingAt:260};f.transaction.to='citizen:5';f.transaction.minute=180;dispatchPoliceAudits(f.justice);finish(f);
  const audit=f.source.investigation.financialAudit;assert.equal(audit.status,'completed');assert.equal(audit.findings[0].kind,'judge-bribery');assert.equal(audit.findings[0].eventId,70);
  const complaints=f.justice.cases.filter(c=>c.type==='judgeBribery');assert.equal(complaints.length,2);assert.deepEqual(new Set(complaints.map(c=>c.details.role)),new Set(['payer','recipient']));assert.ok(complaints.every(c=>c.details.source==='financial-audit'&&c.evidence.some(e=>e.eventId===70)));
});

test('a documented partner’s payment to the assigned judge is audited for the defendant’s case',()=>{
  const f=fixture();f.city.history.entries=[];f.source.status='charged';f.source.chargedCitizenId=1;f.source.trial={status:'hearing-scheduled',judgeId:5,scheduledAt:110,hearingAt:260};f.city.history.entries.push({id:71,kind:'finance',from:'citizen:6',to:'citizen:5',amount:200,minute:180,reason:'Transferência pessoal'});
  dispatchPoliceAudits(f.justice);finish(f);const audit=f.source.investigation.financialAudit;assert.equal(audit.status,'completed');assert.equal(audit.findings[0].kind,'judge-bribery');assert.equal(audit.findings[0].from,'citizen:6');
  const complaints=f.justice.cases.filter(c=>c.type==='judgeBribery');assert.equal(complaints.length,2);assert.ok(complaints.every(c=>c.details.beneficiaryId===1));
});

test('an audit reopens once when a new witness payment is later added to the financial ledger',()=>{
  const f=fixture();f.city.history.entries=[];dispatchPoliceAudits(f.justice);finish(f);const audit=f.source.investigation.financialAudit;assert.equal(audit.status,'inconclusive');
  f.city.minute++;const transfer={...f.transaction,id:71,from:'citizen:1',to:'citizen:4',minute:f.city.minute,amount:200};f.city.history.entries.push(transfer);dispatchPoliceAudits(f.justice);
  assert.equal(audit.status,'active');assert.equal(audit.reanalysisCount,1);assert.equal(audit.reopenedAt,f.city.minute);assert.equal(f.auditor.policeAudit.caseId,f.source.id);
});

test('the independent audit links a triangulated witness payment without duplicating its transfer',()=>{
  const f=fixture();f.city.history.entries=[];f.city.history.entries.push(
    {id:71,kind:'finance',from:'citizen:1',to:'citizen:5',amount:200,minute:110,reason:'Transferência pessoal'},
    {id:72,kind:'finance',from:'citizen:5',to:'citizen:4',amount:200,minute:120,reason:'Transferência pessoal'});
  dispatchPoliceAudits(f.justice);finish(f);const audit=f.source.investigation.financialAudit;
  assert.equal(audit.status,'completed');assert.equal(audit.findings[0].kind,'triangulated-witness-bribery');assert.equal(audit.findings[0].eventId,72);assert.equal(audit.findings[0].intermediaryTransferEventId,71);
  const complaints=f.justice.cases.filter(c=>c.type==='witnessBribery');assert.equal(complaints.length,2);assert.ok(complaints.every(c=>c.evidence[0].relatedEventIds.join(',')==='71,72'));
});

test('new transactions outside the relevant hearing window do not trigger reanalysis',()=>{
  const f=fixture();f.city.history.entries=[];f.source.trial={status:'hearing-scheduled',judgeId:5,scheduledAt:100,hearingAt:220};dispatchPoliceAudits(f.justice);finish(f);const audit=f.source.investigation.financialAudit;assert.equal(audit.status,'inconclusive');
  f.city.minute++;f.city.history.entries.push({id:71,kind:'finance',from:'citizen:1',to:'citizen:5',amount:200,minute:221,reason:'Transferência posterior'});f.city.history.entries.push({id:72,kind:'finance',from:'citizen:5',to:'citizen:5',amount:200,minute:222,reason:'Movimentação posterior'});dispatchPoliceAudits(f.justice);
  assert.equal(audit.status,'inconclusive');assert.equal(audit.reanalysisCount||0,0);assert.equal(f.justice.cases.length,1);
});

test('a hidden agreement, a payment outside the handling period and unrelated transactions are not evidence',()=>{
  const f=fixture();f.source.investigation.bribe={status:'paid',payerId:1,amount:200};f.transaction.minute=89;f.city.history.entries.push({...f.transaction,id:71,minute:120,from:'citizen:8'});dispatchPoliceAudits(f.justice);finish(f);assert.equal(f.source.investigation.financialAudit.status,'inconclusive');assert.equal(f.justice.cases.length,1);
});

test('auditing consumes distinct paid minutes and pauses when the worker leaves the station',()=>{
  const f=fixture();dispatchPoliceAudits(f.justice);f.city.payWage=()=>false;f.justice.updatePoliceAudit(f.auditor);const audit=f.source.investigation.financialAudit;assert.equal(audit.progress,0);assert.match(audit.waitingReason,/salarial/);
  f.city.minute++;f.city.payWage=()=>true;dispatchPoliceAudits(f.justice);f.justice.updatePoliceAudit(f.auditor);f.justice.updatePoliceAudit(f.auditor);assert.equal(audit.progress,1);
  f.auditor.indoorLocation=null;f.city.minute++;f.justice.updatePoliceAudit(f.auditor);assert.equal(audit.status,'waiting');assert.equal(audit.progress,1);assert.equal(f.auditor.policeAudit,null);
});

test('an auditor who is implicated cannot review the investigation',()=>{
  const f=fixture();f.source.witnesses.push({identifiedSuspectId:3,confidence:.9});dispatchPoliceAudits(f.justice);assert.equal(f.auditor.policeAudit,undefined);assert.match(f.source.investigation.financialAudit.waitingReason,/envolvido/);
});

test('audits attach evidence to existing undisclosed bribery cases rather than duplicating them',()=>{
  const f=fixture();f.justice.cases.push({id:2,type:'policeBribery',status:'unreported',details:{sourceCaseId:1,paymentEventId:70,role:'recipient'},evidence:[]});f.justice.nextCaseId=3;dispatchPoliceAudits(f.justice);finish(f);assert.equal(f.justice.cases.length,3);assert.equal(f.justice.cases[1].status,'reported');assert.equal(f.justice.cases[1].evidence.length,1);
});

test('an audit in progress survives snapshots and retains its accumulated work',()=>{
  const city=setup({starter:true,population:32}),officer=city.citizens[0],source={id:9001,type:'theft',status:'no-suspect',details:{},witnesses:[],evidence:[],investigation:{officerId:city.citizens[1].id,financialAudit:{status:'active',officerId:officer.id,progress:27,required:90,caseIds:[]}}};city.justice.cases.push(source);officer.policeAudit={caseId:source.id};
  const sender=new CityStateGraph(),receiver=new CityStateGraph(),copy=receiver.apply(sender.encode({city})).city;bindCityState(copy);assert.equal(copy.society.citizen(officer.id).policeAudit.caseId,9001);assert.equal(copy.justice.cases.at(-1).investigation.financialAudit.progress,27);
  source.investigation.financialAudit.progress=28;bindCityState(receiver.apply(sender.encode({city})).city);assert.equal(copy.justice.cases.at(-1).investigation.financialAudit.progress,28);
  const rendered=[],panel=new Proxy({}, {get:()=> (...args)=>rendered.push(args.filter(x=>typeof x==='string').join(' '))}),ui={city:copy,view:()=> 'cases',matches:()=>true,justiceCaseId:9001};renderJustice(ui,panel);renderSafety(ui,panel);assert.ok(rendered.some(s=>s.includes('AUDITORIA FINANCEIRA DO INQUÉRITO')));assert.ok(rendered.some(s=>s.includes('28/90 minutos')));assert.ok(rendered.some(s=>s.includes('AUDITORIAS FINANCEIRAS')));
});

test('CitySimulation performs the on-site audit over paid work time and discovers an actual ledger transfer',()=>{
  const city=setup({starter:true,population:32});let station;for(const site of city.economy.locateBuilding('police_station')){station=city.addBuilding('police_station',site.x,site.y,{...site,free:true});if(station)break;}assert.ok(station);
  const [payer,target,auditor]=city.citizens.filter(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c)).slice(0,3);assert.ok(auditor);
  city.economy.leaveJob(auditor,'Designação de auditoria');auditor.jobId=station.id;station.workers=[auditor.id];Object.assign(auditor.needs,{food:100,water:100,health:100,energy:100,toilet:100,hygiene:100});putAtWorkCell(city,auditor,station);city.transfer('treasury',station.accountId,100000,'Verba da auditoria');city.transfer('treasury',payer.accountId,1000,'Recursos do cenário');
  city.minute=550;assert.ok(city.transfer(payer.accountId,target.accountId,200,'Transferência pessoal'));const transaction=city.ledger.at(-1);city.minute=600;city.random=()=>0;
  const witness=city.citizens.find(c=>!new Set([payer.id,target.id,auditor.id]).has(c.id));assert.ok(witness);const source={id:9001,type:'theft',status:'no-suspect',details:{},witnesses:[{citizenId:witness.id,identifiedSuspectId:payer.id,confidence:.95}],evidence:[],investigation:{officerId:target.id,startedAt:500,finishedAt:599,status:'inconclusive'}};city.justice.cases.push(source);city.justice.nextCaseId=9002;dispatchPoliceAudits(city.justice);assert.ok(auditor.policeAudit);
  for(let i=0;i<300&&!['completed','inconclusive'].includes(source.investigation.financialAudit.status);i++)city.update(.25);
  const audit=source.investigation.financialAudit;assert.equal(audit.status,'completed');assert.equal(audit.progress,90);assert.ok(audit.completedAt-audit.startedAt>=89);assert.equal(audit.findings[0].eventId,transaction.eventId);assert.equal(auditor.policeAudit,null);assert.equal(audit.caseIds.length,2);
});
