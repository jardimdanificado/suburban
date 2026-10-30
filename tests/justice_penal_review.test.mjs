import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';

function fixture(){
  const c={id:1,accountId:'citizen:1',entity:{x:0,y:0,properties:{name:'Pessoa'}},needs:{health:90},path:[]};const creditor={id:2,accountId:'citizen:2',entity:{properties:{name:'Credor'}}};
  const accounts=new Map([['treasury',{balance:1000}],[c.accountId,{balance:1000}],[creditor.accountId,{balance:1000}]]),city={minute:600,hour:10,world:{},citizens:[c,creditor],buildings:[],accounts,society:{citizen:id=>id===1?c:id===2?creditor:null},random:()=>1,log:()=>({id:1}),transfer(from,to,q){if(!accounts.has(from)||!accounts.has(to)||q<=0||accounts.get(from).balance<q)return false;accounts.get(from).balance-=q;accounts.get(to).balance+=q;return true;}};
  const justice=new CityJustice(city),record=justice.crimeRecord('graffiti',1,null);record.chargedCitizenId=1;record.status='convicted';record.sentence={fine:100,finePaid:0,imprisonmentMinutes:120};record.rule.politicalDisqualification=true;record.rule.cleanRecordDisqualifying=true;
  const rule=changes=>({...justice.policies.penalCode.graffiti,...changes}),money=()=>[...accounts.values()].reduce((n,a)=>n+a.balance,0);return {justice,city,c,record,rule,money};
}

test('decriminalization releases custody and preserves case history and original rule',()=>{
  const {justice,city,c,record,rule}=fixture();c.custody={caseId:record.id,jailId:10,status:'detained',startedAt:500,releaseAt:2000};record.trial={status:'appeal-pending',appeal:{status:'pending'}};
  justice.setCrimeRule('graffiti',rule({criminal:false}),42);assert.equal(record.status,'decriminalized');assert.equal(c.custody,null);assert.equal(record.sentence.imprisonmentMinutes,0);assert.equal(record.originalRule.criminal,true);assert.equal(record.legalHistory[0].billId,42);assert.equal(record.convictionAnnulledAt,city.minute);assert.equal(record.trial.appeal.status,'closed-by-decriminalization');assert.equal(justice.conviction(1),null);
});

test('harsher laws apply to new facts without raising an old sentence',()=>{
  const {justice,record,rule}=fixture();const before={...record.rule};justice.setCrimeRule('graffiti',rule({severity:90,fine:900}),20);assert.equal(record.rule.severity,before.severity);assert.equal(record.rule.fine,before.fine);assert.equal(record.sentence.imprisonmentMinutes,120);
  const next=justice.crimeRecord('graffiti',1,null);assert.equal(next.rule.severity,90);assert.equal(next.rule.fine,900);
});

test('recriminalization cannot revive proceedings for a previously decriminalized fact',()=>{
  const {justice,record,rule}=fixture();justice.setCrimeRule('graffiti',rule({criminal:false}),10);justice.setCrimeRule('graffiti',rule({criminal:true,severity:90}),11);assert.equal(record.status,'decriminalized');assert.equal(record.rule.criminal,false);assert.equal(justice.crimeRecord('graffiti',1,null).rule.criminal,true);
});

test('fine-only law releases pretrial detention while retaining the accusation',()=>{
  const {justice,c,record,rule}=fixture();record.status='arrested';record.sentence=null;c.custody={caseId:record.id,status:'detained',startedAt:500,releaseAt:2000};justice.setCrimeRule('graffiti',rule({fineOnly:true}),12);assert.equal(c.custody,null);assert.equal(record.status,'charged');assert.equal(record.rule.fineOnly,true);
});

test('fine collection and refunds conserve currency and never charge or refund twice',()=>{
  const {justice,city,c,record,rule,money}=fixture(),before=money();justice.collectFine(c,record);assert.equal(record.sentence.finePaid,100);assert.equal(justice.collectFine(c,record),false);justice.setCrimeRule('graffiti',rule({fine:30}),4);assert.equal(record.sentence.fineRefunded,70);assert.equal(city.accounts.get(c.accountId).balance,970);assert.equal(justice.refundExcessFine(record),false);assert.equal(money(),before);
});

test('insufficient treasury leaves an explicit refund debt rather than creating money',()=>{
  const {justice,city,c,record,rule,money}=fixture();justice.collectFine(c,record);city.accounts.get('treasury').balance=20;const before=money();justice.setCrimeRule('graffiti',rule({criminal:false}),5);assert.equal(record.sentence.fineRefunded,20);assert.equal(record.sentence.fineRefundDue,80);assert.equal(money(),before);
  city.transfer('citizen:2','treasury',80);justice.refundExcessFine(record);assert.equal(record.sentence.fineRefundDue,0);assert.equal(record.sentence.fineRefunded,100);assert.equal(money(),before);
});

test('decriminalization preserves judicially established cleaning reparation separately from punishment',()=>{
  const {justice,city,record,rule}=fixture();record.reparation={creditorAccountId:'citizen:2',cost:50,paid:0};justice.setCrimeRule('graffiti',rule({criminal:false}),5);assert.equal(record.reparation.civilEnforceable,true);assert.equal(justice.collectReparation(record),true);assert.equal(city.accounts.get('citizen:2').balance,1050);assert.equal(justice.collectReparation(record),false);
});


test('a reduced sentence credits time already served and releases immediately when satisfied',()=>{
  const {justice,c,record,rule}=fixture();c.custody={caseId:record.id,status:'detained',startedAt:500,releaseAt:2000,sentenced:true};justice.setCrimeRule('graffiti',rule({severity:5}),8);assert.equal(record.sentence.imprisonmentMinutes,60);assert.equal(c.custody,null);assert.equal(record.sentence.completedAt,600);assert.equal(record.status,'convicted');
});

test('political disqualification can be removed independently without restoring a lost mandate',()=>{
  const {justice,record,rule}=fixture();justice.policies.cleanRecord=true;record.cassatedAt=400;assert.equal(justice.conviction(1),record);
  justice.setCrimeRule('graffiti',rule({politicalDisqualification:false,cleanRecordDisqualifying:false,cassation:false}),9);assert.equal(record.status,'convicted');assert.equal(justice.conviction(1),null);assert.equal(record.cassatedAt,400);
});


test('fine-only revision converts an unexecuted arrest request into prosecution without prison',()=>{
 const {justice,record,rule}=fixture();record.status='arrest-requested';record.sentence=null;record.investigation={suspectId:1};justice.setCrimeRule('graffiti',rule({fineOnly:true}),44);assert.equal(record.status,'charged');assert.equal(record.chargedCitizenId,1);assert.equal(record.arrestWaitingReason,null);
});
