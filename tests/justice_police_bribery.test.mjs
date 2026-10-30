import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';
import {setup} from './helpers/city.mjs';
import {CityStateGraph,bindCityState} from '../js/city_state.js';

function fixture(){
  const people=[1,2,3].map(id=>({id,accountId:`citizen:${id}`,jobId:id===2?10:null,entity:{x:0,y:0,properties:{name:`Pessoa ${id}`}},traits:{honesty:id===2?0:1},skills:{investigation:70},needs:{health:90},path:[],social:{memories:[],beliefs:[]}}));
  const station={id:10,type:'police_station',active:true,entity:{},workers:[2]},accounts=new Map(people.map(p=>[p.accountId,{balance:1000}]));let event=10;
  const city={minute:100,hour:12,world:{},citizens:people,buildings:[station],accounts,society:{citizen:id=>people.find(p=>p.id===id)},building:()=>station,politics:{council:{members:[]}},random:()=>0,log:()=>({id:++event}),accountName:id=>id,transfer(from,to,n){if(accounts.get(from).balance<n)return false;accounts.get(from).balance-=n;accounts.get(to).balance+=n;return true;}};
  const justice=new CityJustice(city);justice.rememberObservedCrime=()=>{};justice.dispatchPoliceResponse=()=>{};const source={id:1,type:'theft',status:'investigating',rule:{fineOnly:false},details:{},witnesses:[{citizenId:3,identifiedSuspectId:1,confidence:.95}],evidence:[],investigation:{officerId:2,stationId:10,status:'active',concludesAt:110}};justice.cases.push(source);justice.nextCaseId=2;
  return {city,justice,source,payer:people[0],officer:people[1],witness:people[2]};
}

test('an accepted bribe transfers existing funds and creates distinct cases for both participants',()=>{
  const {city,justice,source}=fixture();const before=[...city.accounts.values()].reduce((n,a)=>n+a.balance,0),bribe=justice.offerPoliceBribe(1,1,200);
  assert.equal(bribe.status,'paid');assert.equal(city.accounts.get('citizen:1').balance,800);assert.equal(city.accounts.get('citizen:2').balance,1200);assert.equal([...city.accounts.values()].reduce((n,a)=>n+a.balance,0),before);assert.equal(bribe.caseIds.length,2);
  for(const c of justice.cases.slice(1)){assert.equal(c.status,'unreported');assert.equal(c.details.sourceCaseId,source.id);assert.deepEqual(c.witnesses.map(w=>w.citizenId),[3]);}
  assert.equal(justice.offerPoliceBribe(1,1,200),false);
});

test('distance, different rooms and insufficient money prevent a remote or unfunded bribe',()=>{
  const {city,justice,payer}=fixture();payer.entity.x=4;assert.equal(justice.offerPoliceBribe(1,1,100),false);payer.entity.x=0;payer.indoorLocation={buildingId:10,unitId:1,floor:0,position:{x:0,y:0}};assert.equal(justice.offerPoliceBribe(1,1,100),false);payer.indoorLocation=null;city.accounts.get(payer.accountId).balance=0;assert.equal(justice.offerPoliceBribe(1,1,100),false);assert.equal(justice.cases.length,1);
});

test('an honest officer reports the attempted bribe without receiving payment',()=>{
  const {city,justice,officer}=fixture();officer.traits.honesty=1;const b=justice.offerPoliceBribe(1,1,200);assert.equal(b.status,'refused');assert.equal(b.amount,0);assert.equal(city.accounts.get(officer.accountId).balance,1000);const c=justice.cases[1];assert.equal(c.status,'reported');assert.equal(c.details.attempted,true);assert.equal(c.witnesses[0].identifiedSuspectId,1);assert.equal(justice.cases.length,2);
});

test('a paid investigator suppresses the payer lead while retaining its original source',()=>{
  const {city,justice,source}=fixture();justice.offerPoliceBribe(1,1,200);city.minute=110;justice.updateInvestigations();assert.equal(source.status,'no-suspect');assert.equal(source.investigation.suspectId,null);assert.equal(source.witnesses[0].identifiedSuspectId,1);assert.equal(source.investigation.suppressedLeads.witnesses[0].identifiedSuspectId,1);
});

test('a conviction for receiving the bribe reopens the stalled case without assigning guilt in it',()=>{
  const {city,justice,source}=fixture();justice.offerPoliceBribe(1,1,200);city.minute=110;justice.updateInvestigations();const recipient=justice.cases.find(c=>c.details.role==='recipient');recipient.status='convicted';recipient.chargedCitizenId=1;justice.updateCourtCases();assert.equal(source.status,'no-suspect');recipient.chargedCitizenId=recipient.details.officerId;justice.updateCourtCases();assert.equal(source.status,'reported');assert.equal(source.investigation,null);assert.equal(source.pastInvestigations[0].bribe.status,'exposed');assert.equal(source.details.investigatorUnderReviewId,2);assert.equal(source.reopenedByCaseId,recipient.id);
});

test('paid bribe and original evidence survive worker snapshots without a second transfer',()=>{
  const city=setup({starter:true,population:32}),[payer,officer]=city.citizens;const source={id:9001,type:'theft',status:'investigating',details:{},witnesses:[{citizenId:city.citizens[2].id,identifiedSuspectId:payer.id,confidence:.9}],evidence:[],investigation:{officerId:officer.id,status:'active'}};city.justice.cases.push(source);city.justice.nextCaseId=9002;
  let station;for(const site of city.economy.locateBuilding('police_station')){station=city.addBuilding('police_station',site.x,site.y,{...site,free:true});if(station)break;}assert.ok(station);city.economy.leaveJob(officer,'Designação do cenário');officer.jobId=station.id;station.workers=[officer.id];source.investigation.stationId=station.id;
  city.transfer('treasury',payer.accountId,1000,'Verba do cenário');payer.indoorLocation=null;officer.indoorLocation=null;Object.assign(payer.entity,{x:4,y:4});Object.assign(officer.entity,{x:4,y:4});officer.traits={...officer.traits,honesty:0};city.random=()=>0;const before=city.accounts.get(payer.accountId).balance;assert.ok(city.justice.offerPoliceBribe(source.id,payer.id,100));
  const sender=new CityStateGraph(),receiver=new CityStateGraph(),copy=receiver.apply(sender.encode({city})).city;bindCityState(copy);assert.equal(copy.justice.cases.find(c=>c.id===9001).investigation.bribe.amount,100);assert.equal(copy.accounts.get(payer.accountId).balance,before-100);assert.equal(copy.justice.offerPoliceBribe(9001,payer.id,100),false);
});
