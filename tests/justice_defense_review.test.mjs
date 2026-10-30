import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';

function fixture(){
  const people=[{id:1,accountId:'citizen:1',entity:{properties:{name:'Réu'}},needs:{health:90}},{id:2,jobId:10,skills:{law:50},traits:{honesty:1},entity:{properties:{name:'Juiz'}}},{id:3,jobId:10,skills:{law:80},traits:{honesty:1},entity:{properties:{name:'Defensora'}}},{id:4,needs:{health:90},entity:{properties:{name:'Testemunha'}}}];
  const court={id:10,type:'courthouse',active:true,workers:[2,3],entity:{}},accounts=new Map([['citizen:1',{balance:500}],['treasury',{balance:500}]]),city={minute:100,hour:10,buildings:[court],accounts,society:{citizen:id=>people.find(c=>c.id===id)},politics:{council:{members:[]}},random:()=>.1,log:()=>({id:1}),transfer(from,to,q){if(!accounts.has(from)||!accounts.has(to)||q<=0||accounts.get(from).balance<q)return false;accounts.get(from).balance-=q;accounts.get(to).balance+=q;return true;}};
  const justice=new CityJustice(city),record={id:1,type:'assault',status:'charged',chargedCitizenId:1,offenderId:99,severity:20,details:{},rule:{fine:0,fineOnly:false},witnesses:[{citizenId:4,identifiedSuspectId:99,confidence:.95}],evidence:[{kind:'witness-identification',witnessId:4,identifiedSuspectId:1,confidence:.95}],investigation:{suspectId:1,fraud:true},trial:{status:'hearing-scheduled',courtId:10,judgeId:2,defenderId:3,hearingAt:100}};justice.cases.push(record);return {justice,city,record,defender:people[2],defendant:people[0]};
}

test('contradictions are discoverable through witness accounts rather than the hidden fraud flag',()=>{
  const {justice,city,record,defender}=fixture();record.investigation.fraud=false;assert.equal(justice.reviewDefenseEvidence(record,defender),true);assert.equal(record.evidence[1].kind,'defense-contradiction');assert.equal(record.evidence[1].originalSuspectId,99);assert.equal(record.investigation.irregularityDetectedAt,city.minute);assert.equal(justice.reviewDefenseEvidence(record,defender),false);
});

test('hidden fraud with consistent available records does not magically reduce conviction probability',()=>{
  const first=fixture(),second=fixture();for(const f of [first,second])f.record.witnesses[0].identifiedSuspectId=1;first.record.investigation.fraud=false;second.record.investigation.fraud=true;
  first.justice.updateCourtCases();second.justice.updateCourtCases();assert.equal(first.record.trial.convictionChance,second.record.trial.convictionChance);assert.equal(first.record.trial.reason,second.record.trial.reason);assert.equal(second.record.investigation.irregularityDetectedAt,undefined);
});

test('undetected manipulation can convict an innocent person and be discovered on appeal',()=>{
  const {justice,city,record}=fixture();let rolls=[.99,.1];city.random=()=>rolls.shift()??.1;justice.updateCourtCases();assert.equal(record.status,'convicted');assert.equal(record.chargedCitizenId,1);assert.equal(record.offenderId,99);assert.equal(record.investigation.irregularityDetectedAt,undefined);
  assert.equal(justice.appeal(1,1),true);city.minute+=180;city.random=()=>0;justice.updateCourtCases();assert.equal(record.status,'acquitted');assert.equal(record.trial.appeal.status,'overturned');assert.equal(record.evidence.at(-1).phase,'appeal');assert.equal(record.sentence.executionStatus,'annulled');
});

test('annulment refunds only money actually paid and can be processed without creating currency',()=>{
  const {justice,city,record}=fixture();record.status='convicted';record.sentence={fine:100,finePaid:100,imprisonmentMinutes:0,completedAt:90,appealUntil:1000};record.trial.status='convicted';const before=[...city.accounts.values()].reduce((n,a)=>n+a.balance,0);
  justice.appeal(1,1);city.minute+=180;city.random=()=>0;justice.updateCourtCases();assert.equal(record.sentence.fineRefunded,100);assert.equal(city.accounts.get('citizen:1').balance,600);assert.equal([...city.accounts.values()].reduce((n,a)=>n+a.balance,0),before);assert.equal(justice.refundExcessFine(record),false);
});

test('dead witnesses cannot be interviewed to discover a contradictory identification',()=>{
  const {justice,city,record,defender}=fixture();city.society.citizen(4).entity.destroyed=true;assert.equal(justice.reviewDefenseEvidence(record,defender),false);assert.equal(record.investigation.irregularityDetectedAt,undefined);
});
