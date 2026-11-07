import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice,isOpenJusticeCase} from '../js/city_justice.js';
import {governmentPerformance} from '../js/city_government_performance.js';
function fixture(){
  const defendant={id:1,accountId:'citizen:1',entity:{properties:{name:'Pessoa'}}},accounts=new Map([['citizen:1',{balance:50}],['treasury',{balance:0}],['victim',{balance:0}]]);
  const city={minute:10*1440,day:10,citizens:[],buildings:[],society:{citizen:id=>id===1?defendant:null},accounts,log:()=>({id:1}),transfer(from,to,amount){if(!accounts.has(to)||accounts.get(from).balance<amount)return false;accounts.get(from).balance-=amount;accounts.get(to).balance+=amount;return true;}};
  city.justice=new CityJustice(city);return {city,justice:city.justice,accounts};
}
test('completed investigations are archived after three days, without hiding new evidence',()=>{
  const {city,justice}=fixture(),record={id:1,status:'no-suspect',evidence:[],investigation:{finishedAt:city.minute-3*1440,evidenceCountAtConclusion:0}};
  const fresh={...record,id:2,evidence:[{kind:'new-proof'}]};justice.cases.push(record,fresh);justice.updateCourtCases();assert.equal(record.status,'dismissed');assert.equal(record.closedAt,city.minute);assert.equal(fresh.status,'no-suspect');assert.equal(isOpenJusticeCase(record),false);
});
test('settlement remains open until payment and reparation are fulfilled, conserving money',()=>{
  const {city,justice,accounts}=fixture(),record={id:1,type:'graffiti',status:'charged',chargedCitizenId:1,severity:10,rule:{fine:100},reparation:{cost:20,paid:0,creditorAccountId:'victim'},trial:{status:'hearing-scheduled'}};justice.cases.push(record);
  assert.equal(justice.agreeSettlement(1),true);assert.equal(record.status,'settlement-pending');assert.equal(isOpenJusticeCase(record),true);assert.equal(record.settlement.paid,50);assert.equal(record.sentence,undefined);
  accounts.get('citizen:1').balance+=70;justice.updateCourtCases();assert.equal(record.status,'settled');assert.equal(record.trial.status,'settled');assert.equal(record.reparation.paid,20);assert.equal(accounts.get('treasury').balance,100);assert.equal(accounts.get('victim').balance,20);assert.equal(justice.agreeSettlement(1),false);justice.updateCourtCases();assert.equal(accounts.get('treasury').balance,100);assert.equal(record.closedAt,city.minute);
});
test('serious crimes cannot be settled and closed outcomes do not count against government',()=>{
  const {city,justice}=fixture();assert.equal(justice.canSettle({type:'murder',severity:100,status:'charged'}),false);
  justice.cases=['convicted','acquitted','dismissed','settled','decriminalized'].map((status,id)=>({id,status,reportedAt:0}));assert.equal(governmentPerformance(city).unresolvedCases,0);justice.cases[0].trial={status:'appeal-pending'};assert.equal(governmentPerformance(city).unresolvedCases,1);
});
test('new evidence reopens an archived investigation and removes its closure metadata',()=>{
  const {city,justice}=fixture();const station={id:8,type:'police_station',active:true,workers:[1],entity:{}};city.buildings.push(station);justice.staffed=()=>1;
  const record={id:9,status:'dismissed',closedAt:10,closureReason:'Sem elementos',evidence:[{kind:'new-proof'}],investigation:{finishedAt:0,evidenceCountAtConclusion:0},details:{}};justice.cases.push(record);
  justice.startPoliceInvestigation=()=>{};justice.updateInvestigations();assert.equal(record.status,'reported');assert.equal(record.closedAt,null);assert.equal(record.closureReason,null);assert.equal(record.pastInvestigations.length,1);assert.equal(isOpenJusticeCase(record),true);
});
