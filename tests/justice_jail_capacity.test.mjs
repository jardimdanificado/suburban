import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';

function fixture(){
 const a={id:1,accountId:'citizen:1',entity:{x:0,y:0,properties:{name:'Pessoa A'}},path:[]},b={id:2,accountId:'citizen:2',entity:{x:0,y:0,properties:{name:'Pessoa B'}},path:[]},guard={id:3,jobId:10,entity:{}},jail={id:10,type:'jail',active:true,entity:{},width:2,depth:2,floors:1,door:{x:4,y:0},workers:[3]},people=[a,b,guard];
 const city={minute:100,buildings:[jail],citizens:people,society:{citizen:id=>people.find(c=>c.id===id)},building:id=>city.buildings.find(b=>b.id===id),politics:{council:{members:[]}},findPath:(from,to)=>[{x:to.x,y:to.y}],log:()=>({id:1})},justice=new CityJustice(city);
 const records=[a,b].map(c=>({id:c.id,type:'assault',status:'arrest-requested',chargedCitizenId:c.id,investigation:{suspectId:c.id},rule:{fineOnly:false},severity:60}));justice.cases.push(...records);return {justice,city,a,b,jail,guard,records};
}

test('inbound detainee reserves the last place and another arrest waits',()=>{
 const {justice,a,b,jail,records}=fixture();assert.equal(justice.jailCapacity(jail),1);assert.equal(justice.arrest(1,a.id),true);assert.equal(a.custody.status,'in-transit');assert.equal(justice.jailOccupancy(jail),1);assert.equal(justice.arrest(2,b.id),false);assert.equal(b.custody,undefined);assert.equal(records[1].arrestWaitingReason,'awaiting-jail-space');
});

test('release frees a reservation and permits the next outstanding arrest',()=>{
 const {justice,a,b,jail}=fixture();justice.arrest(1,a.id);justice.arrest(2,b.id);justice.release(a,'Soltura judicial');assert.equal(justice.jailOccupancy(jail),0);assert.equal(justice.arrest(2,b.id),true);assert.equal(b.custody.jailId,10);
});

test('a sentence also waits for a place without replacing another custody',()=>{
 const {justice,a,b,records}=fixture();justice.arrest(1,a.id);records[1].status='convicted';records[1].sentence={imprisonmentMinutes:100};assert.equal(justice.enforceSentence(records[1]),false);assert.equal(records[1].sentence.executionStatus,'awaiting-jail-space');assert.equal(b.custody,undefined);justice.release(a);assert.equal(justice.enforceSentence(records[1]),true);
});

test('another accessible staffed jail is used when the closest jail is full or unreachable',()=>{
 const {justice,city,a,b,jail}=fixture();justice.arrest(1,a.id);const second={...jail,id:11,workers:[4],door:{x:8,y:0}};city.buildings.push(second);city.citizens.push({id:4,jobId:11,entity:{}});assert.equal(justice.arrest(2,b.id),true);assert.equal(b.custody.jailId,11);
});

test('death clears occupancy while keeping the adjudicated record',()=>{
 const {justice,a,jail,records}=fixture();justice.arrest(1,a.id);records[0].status='convicted';records[0].sentence={imprisonmentMinutes:100};justice.onDetaineeDeath(a);a.entity.destroyed=true;assert.equal(justice.jailOccupancy(jail),0);assert.equal(records[0].status,'convicted');
});

test('existing custody cannot be overwritten by a second arrest',()=>{
 const {justice,a,records}=fixture();justice.arrest(1,a.id);records.push({id:9,status:'arrest-requested',investigation:{suspectId:a.id},rule:{fineOnly:false}});justice.cases.push(records.at(-1));assert.equal(justice.arrest(9,a.id),false);assert.equal(a.custody.caseId,1);
});


test('an unreachable jail does not prevent choosing a reachable alternative',()=>{
 const {justice,city,a,jail}=fixture();city.buildings.push({...jail,id:11,workers:[4],door:{x:8,y:0}});city.citizens.push({id:4,jobId:11,entity:{}});city.findPath=(from,to)=>to.x===4?null:[{...to}];assert.equal(justice.arrest(1,a.id),true);assert.equal(a.custody.jailId,11);
});


test('a deceased suspect waiting for a place cannot acquire a new custody reservation',()=>{
 const {justice,a,jail}=fixture();a.entity.destroyed=true;assert.equal(justice.arrest(1,a.id),false);assert.equal(a.custody,undefined);assert.equal(justice.jailOccupancy(jail),0);
});
