import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';
import {governmentPerformance} from '../js/city_government_performance.js';
function fixture(){
 const people=[1,2,3].map(id=>({id,entity:{x:0,y:0,properties:{name:`Pessoa ${id}`}},needs:{health:90},path:[{x:99,y:99}],targetId:99,task:'leisure'}));
 const station={id:10,type:'police_station',active:true,workers:[3],door:{x:5,y:5},entity:{}};people[2].jobId=10;
 const city={minute:10*1440,day:10,citizens:people,buildings:[station],building:id=>id===10?station:null,society:{isAdult:()=>false,citizen:id=>people.find(c=>c.id===id)},findPath:()=>[{x:5,y:5}],log:()=>({id:1})};
 const justice=new CityJustice(city);city.justice=justice;const make=id=>({id,type:'assault',status:'unreported',occurredAt:0,victimId:id,witnesses:[{citizenId:id}],details:{}});return {city,justice,people,make,station};
}
test('reporting replaces the old route and destination, and cannot overwrite another report',()=>{
 const {justice,people,make}=fixture();justice.cases.push(make(1),make(2));assert.equal(justice.report(1,1),true);assert.deepEqual(people[0].path,[{x:5,y:5}]);assert.equal(people[0].targetId,10);assert.equal(justice.report(2,1),false);assert.equal(people[0].justiceReportCaseId,1);assert.equal(justice.cases[1].status,'unreported');
});
test('dispatch assigns independent reporters and reconciles all interrupted trips',()=>{
 const {justice,people,make}=fixture();const one=make(1),two=make(2),stale={...make(3),status:'reporting',reporterId:999,reportingStationId:10,witnesses:[]};justice.cases.push(one,two,stale);justice.dispatchReports();assert.equal(one.status,'reporting');assert.equal(two.status,'reporting');assert.equal(stale.status,'unreported');assert.equal(stale.reporterId,null);assert.equal(people[1].justiceReportCaseId,2);
});
test('unreachable stations do not send residents into a reporting trip',()=>{
 const {city,justice,people,make}=fixture();justice.cases.push(make(1));city.findPath=()=>null;assert.equal(justice.report(1,1),false);assert.equal(justice.cases[0].status,'unreported');assert.equal(people[0].targetId,99);
});
test('trips to a removed station are reconciled even when there are no staffed stations',()=>{
 const {justice,people,make,station}=fixture();justice.cases.push(make(1));justice.report(1,1);station.active=false;justice.dispatchReports();assert.equal(justice.cases[0].status,'unreported');assert.equal(people[0].justiceReportCaseId,null);assert.equal(people[0].task,null);
});
test('unreported events and reporting trips do not count as overdue judicial proceedings',()=>{
 const {city,justice,make}=fixture();justice.cases.push(make(1),{...make(2),status:'reporting'});assert.equal(governmentPerformance(city).unresolvedCases,0);assert.equal(governmentPerformance(city).justiceHealth,100);justice.cases.push({...make(3),status:'reported',reportedAt:0});assert.equal(governmentPerformance(city).unresolvedCases,1);assert.equal(governmentPerformance(city).justiceHealth,0);
});

test('automatic reports preserve hygiene recovery, sleep, voting and an occupied shared crossing',()=>{
 for(const state of [{task:'hygiene'},{task:'energy',sleep:{active:true}},{task:'vote'},{task:'work',sharedBoatRide:{state:'aboard'}}]){
  const {justice,people,make}=fixture(),record=make(1);Object.assign(people[0],state);justice.cases.push(record);
  justice.dispatchReports();assert.equal(record.status,'unreported');assert.equal(people[0].task,state.task);assert.equal(people[0].targetId,99);
 }
});
