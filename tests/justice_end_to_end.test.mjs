import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';
import {qualification} from '../js/city_employment.js';

function fixture(randomValue=0){
  const people=Array.from({length:20},(_,index)=>({id:index+1,age:30,accountId:`citizen:${index+1}`,task:'work',entity:{x:index<4?0:index,y:0,destroyed:false,properties:{name:`Pessoa ${index+1}`}},path:[],needs:{health:100,food:100,water:100,energy:100,toilet:100},traits:{honesty:.8},skills:{law:20}}));
  const station={id:20,type:'police_station',active:true,entity:{destroyed:false,properties:{name:'Delegacia'}},door:{x:0,y:0},workers:[people[1].id]};people[1].jobId=station.id;
  const jail={id:30,type:'jail',active:true,entity:{destroyed:false,properties:{name:'Cadeia'}},door:{x:30,y:0},width:4,depth:4,floors:1,workers:[people[2].id]};people[2].jobId=jail.id;
  const court={id:40,type:'courthouse',active:true,entity:{destroyed:false,properties:{name:'Tribunal'}},door:{x:40,y:0},workers:[people[3].id,people[4].id]};people[3].jobId=people[4].jobId=court.id;
  const buildings=[station,jail,court],city={minute:100,buildings,citizens:people,accounts:new Map(),treasury:0,politics:{council:{members:[]},officeHolder:()=>false,cassateCriminalMandate:()=>false},society:{citizen:id=>people.find(c=>c.id===id),isAdult:c=>c.age>=18},building:id=>buildings.find(b=>b.id===id),findPath:(from,to)=>[{x:to.x,y:to.y}],urgentNeed:()=>false,payWage:()=>true,random:()=>randomValue,log:()=>({id:1}),sanitation:{releaseCitizen(){}}};
  const justice=new CityJustice(city);city.justice=justice;
  const suspect=people[0],record={id:1,type:'murder',offenderId:suspect.id,victimId:11,chargedCitizenId:suspect.id,status:'arrest-requested',severity:100,rule:{fineOnly:false,fine:0,cassation:false,cassationTrigger:'arrest'},investigation:{suspectId:suspect.id,stationId:station.id,status:'finished',finishedAt:90},evidence:[],witnesses:[]};justice.cases.push(record);
  return {city,justice,record,suspect,officer:people[1],jail};
}

test('murder case moves from arrest dispatch through physical custody to a five-person popular-jury verdict',()=>{
  const f=fixture(0),{justice,record,suspect,officer,city}=f;
  assert.equal(justice.arrest(record.id,suspect.id),true);
  assert.equal(suspect.custody.status,'awaiting-escort');
  assert.equal(justice.updatePoliceArrestEscort(officer),true);
  assert.equal(suspect.custody.status,'in-transit');
  assert.equal(record.status,'arrested');
  record.status='charged';city.minute++;
  justice.updateCourtCases();
  assert.equal(record.trial.status,'hearing-scheduled');
  assert.equal(record.trial.jury.memberIds.length,5);
  assert.ok(record.trial.jury.memberIds.every(id=>![suspect.id,officer.id].includes(id)));
  city.minute=record.trial.hearingAt;justice.updateCourtCases();
  assert.equal(record.status,'convicted');
  assert.equal(record.trial.jury.status,'decided');
  assert.equal(record.trial.jury.guiltyVotes,5);
  assert.equal(record.trial.jury.verdict,'convicted');
});

test('an interrupted physical arrest escort pauses both people and resumes after urgent needs and salary blocks',()=>{
  const f=fixture(),{justice,record,suspect,officer,city,jail}=f;assert.equal(justice.arrest(record.id,suspect.id),true);assert.equal(justice.updatePoliceArrestEscort(officer),true);assert.equal(record.status,'arrested');assert.equal(suspect.custody.status,'in-transit');assert.ok(officer.path.length);assert.ok(suspect.path.length);
  let urgent=true;city.urgentNeed=()=>urgent;const original={x:suspect.entity.x,y:suspect.entity.y};justice.updatePoliceArrestEscort(officer);assert.equal(officer.path.length,0);assert.equal(suspect.path.length,0);assert.deepEqual({x:suspect.entity.x,y:suspect.entity.y},original);assert.match(record.arrestEscort.waitingReason,/necessidade urgente/);
  urgent=false;city.payWage=()=>false;city.minute++;justice.updatePoliceArrestEscort(officer);assert.equal(officer.path.length,0);assert.equal(suspect.path.length,0);assert.match(record.arrestEscort.waitingReason,/verba salarial/);
  city.payWage=()=>true;city.minute++;justice.updatePoliceArrestEscort(officer);assert.ok(officer.path.length);assert.deepEqual({x:suspect.entity.x,y:suspect.entity.y},original);assert.equal(suspect.custody.status,'in-transit');
  jail.active=false;city.minute++;justice.updatePoliceArrestEscort(officer);assert.equal(officer.policeArrestEscort,null);assert.deepEqual({x:suspect.entity.x,y:suspect.entity.y},original);assert.equal(suspect.custody.status,'in-transit');assert.match(record.arrestWaitingReason,/indisponível/);
});

test('popular jury acquits when its majority votes not guilty',()=>{
  const f=fixture(.99),{justice,record,city}=f;record.status='charged';justice.updateCourtCases();assert.equal(record.trial.jury.memberIds.length,5);city.minute=record.trial.hearingAt;justice.updateCourtCases();assert.equal(record.status,'acquitted');assert.equal(record.trial.jury.notGuiltyVotes,5);assert.equal(record.trial.jury.verdict,'acquitted');
});

test('legacy justice records without a saved penal rule restore safely',()=>{
  const f=fixture();delete f.record.rule;assert.doesNotThrow(()=>f.justice.ensureState());assert.equal(f.record.rule.cassationTrigger,'arrest');
});

test('independent oversight assigns its auditor as soon as the reviewer becomes available',()=>{
  const f=fixture(),{city,justice}=f,reviewer=city.citizens[5],office={id:60,type:'council_oversight_office',active:true,entity:{destroyed:false},workers:[reviewer.id]};office.workers=[reviewer.id];reviewer.jobId=office.id;reviewer.indoorLocation=null;city.buildings.push(office);
  const source={id:2,type:'theft',status:'no-suspect',investigation:{officerId:city.citizens[1].id,suspectId:city.citizens[0].id},witnesses:[],evidence:[]},complaint={id:3,type:'investigationFraud',status:'reported',details:{reviewedCaseId:2,investigatorUnderReviewId:city.citizens[1].id},evidence:[]};justice.cases.push(source,complaint);
  justice.dispatchExternalPoliceReviews();assert.equal(complaint.externalReview.status,'waiting');
  reviewer.indoorLocation={buildingId:office.id,path:[]};city.minute++;justice.dispatchExternalPoliceReviews();assert.equal(complaint.externalReview.status,'active');assert.equal(complaint.externalReview.reviewerId,reviewer.id);
});

test('the paid oversight commission verifies source records and reports discrepancies without deciding guilt',()=>{
  const f=fixture(),{city,justice}=f,reviewer=city.citizens[5],officer=city.citizens[1],source={id:2,type:'theft',status:'no-suspect',victimId:12,investigation:{officerId:officer.id,suspectId:city.citizens[0].id,interviewEvidence:[{kind:'police-interview',witnessId:8,identifiedSuspectId:9,sourceEventId:501}],reportedInterviews:[],suspectId:city.citizens[0].id},witnesses:[{citizenId:8,identifiedSuspectId:9,interviewStatus:'interviewed'}],evidence:[]},complaint={id:3,type:'investigationFraud',status:'reported',details:{reviewedCaseId:2,investigatorUnderReviewId:officer.id},evidence:[{kind:'investigation-record',sourceCaseId:2,officialSuspectId:city.citizens[0].id,originalInterviewEvidence:source.investigation.interviewEvidence,officialReportedInterviewIndexes:[],contradictions:[{contradictionKind:'investigator-concealment',sourceInterviewIndex:0,witnessId:8,originalSuspectId:9,recordedSuspectId:city.citizens[0].id}]}]};
  const office={id:60,type:'council_oversight_office',active:true,entity:{destroyed:false,properties:{name:'Comissão'}},workers:[reviewer.id],accountId:'oversight'};reviewer.jobId=office.id;reviewer.task='work';reviewer.skills.law=80;reviewer.indoorLocation={buildingId:office.id,path:[]};city.buildings.push(office);justice.cases.push(source,complaint);
  let paid=0;city.payWage=()=>{paid++;return true;};justice.dispatchExternalPoliceReviews();assert.equal(complaint.externalReview.status,'active');
  for(let minute=0;minute<90;minute++){city.minute++;justice.updatePoliceOversight(reviewer);}
  assert.equal(paid,90);assert.equal(complaint.externalReview.status,'completed');assert.equal(complaint.externalReview.progress,90);assert.equal(complaint.externalReview.verifiedDiscrepancies,1);assert.equal(complaint.externalReview.report.verifiedDiscrepancies[0].independentSourceInterview.sourceEventId,501);assert.equal(complaint.evidence.at(-1).kind,'external-review');assert.equal(source.status,'no-suspect');assert.equal(complaint.offenderId??null,null);assert.equal(complaint.chargedCitizenId??null,null);assert.equal(reviewer.policeOversight,null);
});

test('a conviction for investigative fraud removes the officer, excludes tainted evidence and reopens the case for another investigator',()=>{
  const {city,justice,record,officer,suspect}=fixture(),station=city.buildings[0],alternate=city.citizens[5],tainted={kind:'police-interview',witnessId:8,identifiedSuspectId:suspect.id,interviewerId:officer.id},independent={kind:'financial-record',eventId:71,implicatedCitizenId:suspect.id};
  alternate.jobId=station.id;alternate.task='work';alternate.indoorLocation={buildingId:station.id,path:[]};station.workers.push(alternate.id);station.policeInvestigatorId=officer.id;officer.policeInvestigation={caseId:record.id,stationId:station.id,phase:'analysis'};officer.task='police-investigation';
  record.status='convicted';record.trial={status:'convicted',judgeId:4,verdictAt:95};record.sentence={fine:0,finePaid:100,fineRefunded:0,imprisonmentMinutes:900,startedAt:80};record.evidence=[tainted,independent];record.investigation={officerId:officer.id,stationId:station.id,status:'finished',suspectId:suspect.id,finishedAt:90,evidence:[tainted]};record.chargedCitizenId=suspect.id;record.details={};suspect.custody={caseId:record.id,jailId:30,status:'detained',startedAt:80,releaseAt:980};
  city.economy={leaveJob(c){station.workers=station.workers.filter(id=>id!==c.id);c.jobId=null;c.task=null;}};
  city.accounts.set(suspect.accountId,{balance:0});city.accounts.set('treasury',{balance:200});city.transfer=(from,to,amount)=>{const payer=city.accounts.get(from),recipient=city.accounts.get(to);if(!payer||!recipient||!Number.isSafeInteger(amount)||amount<0||payer.balance<amount)return false;if(!justice.trackStolenMoneyTransfer(from,to,amount,{}))return false;payer.balance-=amount;recipient.balance+=amount;return true;};
  const conviction={id:2,type:'investigationFraud',status:'convicted',chargedCitizenId:officer.id,details:{investigatorUnderReviewId:officer.id,reviewedCaseId:record.id}};justice.cases.push(conviction);
  justice.updateCourtCases();assert.equal(officer.policeDisqualifiedAt,city.minute);assert.equal(officer.jobId,null);assert.equal(station.policeInvestigatorId,null);assert.deepEqual(station.workers,[alternate.id]);assert.equal(qualification(city,officer,station).eligible,false);
  assert.equal(record.status,'reported');assert.equal(record.chargedCitizenId,null);assert.equal(record.trial,null);assert.equal(record.investigation,null);assert.equal(record.sentence,null);assert.equal(suspect.custody,null);assert.equal(record.releasedAt,city.minute);assert.equal(city.accounts.get(suspect.accountId).balance,100);assert.equal(record.pastSentences[0].fineRefunded,100);assert.equal(record.details.excludedOfficerId,officer.id);assert.deepEqual(record.evidence,[independent]);assert.equal(record.pastInvestigations[0].evidence[0].kind,'police-interview');assert.equal(record.pastTrials[0].trial.verdictAt,95);
  justice.updateCourtCases();assert.equal(record.pastInvestigations.length,1);justice.updateInvestigations();assert.equal(record.status,'investigating');assert.equal(record.investigation.officerId,alternate.id);assert.notEqual(record.investigation.officerId,officer.id);
  city.politics.council.members.push({citizenId:suspect.id});justice.policies.parliamentaryImmunity=true;record.investigation={officerId:alternate.id,stationId:station.id,suspectId:suspect.id,status:'suspect-identified'};record.status='arrest-requested';assert.equal(justice.requestArrest(record.id),'authorization-required');assert.equal(record.immunityAuthorization,'required');assert.equal(suspect.custody,null);assert.equal(justice.authorizeArrest(record.id,42),true);assert.equal(record.immunityAuthorization,'approved');assert.equal(record.authorizationBillId,42);assert.equal(suspect.custody.status,'awaiting-escort');assert.equal(record.arrestEscort.phase,'to-suspect');assert.equal(record.arrestEscort.officerId,alternate.id);
  // The fresh case can proceed to a new hearing only after the chamber vote;
  // the archived, tainted conviction is never reused as the retrial verdict.
  record.status='charged';record.chargedCitizenId=suspect.id;justice.updateCourtCases();assert.ok(record.trial,record.trialWaitingReason);assert.equal(record.trial.status,'hearing-scheduled');assert.equal(record.pastTrials.length,1);assert.notEqual(record.trial.verdictAt,95);
  city.minute=record.trial.hearingAt;justice.updateCourtCases();assert.ok(['convicted','acquitted'].includes(record.status));assert.equal(record.trial.status,record.status);assert.notEqual(record.trial.verdictAt,95);assert.equal(record.pastTrials[0].trial.verdictAt,95);
});
