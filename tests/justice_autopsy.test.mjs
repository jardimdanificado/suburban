import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';

function fixture(){
  const examiner={id:2,jobId:10,skills:{forensics:65},task:'work',path:[],indoorLocation:{buildingId:10,path:[]},entity:{properties:{name:'Perita'}}},officer={id:3,jobId:11,traits:{honesty:1},entity:{properties:{name:'Policial'}}};
  const victim={id:1,entity:{destroyed:true},needs:{health:0}},people=new Map([[1,victim],[2,examiner],[3,officer]]);
  const iml={id:10,type:'iml',active:true,workers:[2],inventory:{sabao:1},balance:10000,wage:0,entity:{}},station={id:11,type:'police_station',active:true,workers:[3],entity:{}};
  const events=[],city={minute:1000,hour:16,world:{},citizens:[victim,examiner,officer],buildings:[iml,station],society:{citizen:id=>people.get(id)},building:id=>[iml,station].find(b=>b.id===id),politics:{mayorId:null},currency:{price:value=>value},random:()=>.75,log:(message,...details)=>events.push({message,details}),accountName:id=>id,economy:{mayorId:null,consumed:{},recordGoods:()=>{},practice:()=>{}}};
  const justice=new CityJustice(city),body={id:1,citizenId:1,name:'Pessoa',cause:'velhice',diedAt:800,position:{x:2,y:3},injuries:[],status:'autopsy',autopsyEndsAt:900,imlBuildingId:10};justice.bodies.push(body);
  return {justice,city,body,examiner,iml,events};
}

test('natural autopsy estimates time without opening a criminal investigation',()=>{
  const {justice,body,examiner}=fixture();const report=justice.completeAutopsy(body,examiner);
  assert.equal(report.suspicious,false);assert.equal(justice.cases.length,0);assert.equal(body.status,'cremation-wait');assert.equal(report.cause,'velhice');
  assert.ok(report.deathWindow.from<=body.diedAt&&report.deathWindow.to>=body.diedAt);assert.notEqual(report.estimatedDeathMinute,body.diedAt);
});

test('violent autopsy opens an unknown-author case and police cannot infer the perpetrator',()=>{
  const {justice,city,body,examiner}=fixture();body.circumstances={kind:'violence'};body.injuries=[{region:'cabeça',severity:7}];
  justice.completeAutopsy(body,examiner);const record=justice.cases[0];
  assert.equal(record.status,'reported');assert.equal(record.offenderId,null);assert.equal(record.reportSource,'iml');assert.equal(record.occurredAt,800);assert.equal(record.witnesses.length,0);assert.equal(record.evidence[0].kind,'autopsy');assert.equal(record.evidence[0].identifiedSuspectId,undefined);
  justice.updateInvestigations();assert.equal(record.status,'investigating');city.minute+=180;justice.updateInvestigations();assert.equal(record.status,'no-suspect');assert.equal(record.investigation.suspectId,null);
});

test('autopsy attaches to an existing homicide without duplicating the occurrence or evidence',()=>{
  const {justice,body,examiner}=fixture();body.circumstances={kind:'violence',caseId:5};justice.cases.push({id:5,type:'murder',victimId:1,offenderId:99,status:'unreported',occurredAt:800,evidence:[]});
  justice.completeAutopsy(body,examiner);justice.completeAutopsy(body,examiner);
  assert.equal(justice.cases.length,1);assert.equal(justice.cases[0].evidence.length,1);assert.equal(body.criminalCaseId,5);assert.equal(body.autopsy.offenderId,undefined);assert.equal(body.autopsy.suspectId,undefined);
});

test('autopsy waits for a living employed examiner before releasing the remains',()=>{
  const {justice,body,examiner}=fixture();examiner.entity.destroyed=true;justice.updateBody(body);assert.equal(body.status,'autopsy');assert.equal(body.autopsy,undefined);
  examiner.entity.destroyed=false;for(let i=0;i<90;i++){justice.city.minute++;justice.updateBody(body);}assert.equal(body.status,'cremation-wait');assert.equal(body.autopsy.examinerId,2);
});
