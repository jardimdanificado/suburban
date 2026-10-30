import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';

function fixture(){
  const actor={id:1,entity:{x:0,y:0},needs:{health:100}},witness={id:2,entity:{x:.2,y:0},needs:{health:100},traits:{skepticism:.5}};
  const city={minute:100,hour:12,world:{cityLampPosts:[]},buildings:[],citizens:[actor,witness],society:{citizen:id=>city.citizens.find(c=>c.id===id)},random:()=>.5,log:()=>({id:1})};
  return {justice:new CityJustice(city),city,actor,witness};
}

test('same observers and random roll produce more witnesses in daylight than darkness',()=>{
  const {justice,city}=fixture();const day=justice.crimeRecord('assault',1,null);city.hour=23;const night=justice.crimeRecord('assault',1,null);
  assert.equal(day.witnesses.length,1);assert.equal(day.witnesses[0].identifiedSuspectId,1);assert.equal(night.witnesses.length,0);assert.ok(day.visibility>night.visibility);
});

test('a lit street lamp improves observation at night without inventing observers',()=>{
  const {justice,city}=fixture();city.hour=23;city.world.cityLampPosts.push({x:0,y:0,lit:true});const lit=justice.crimeRecord('theft',1,null);assert.equal(lit.witnesses.length,1);assert.equal(lit.witnesses[0].citizenId,2);assert.equal(lit.witnesses[0].identifiedSuspectId,null);
});

test('an intervening building blocks exterior observation',()=>{
  const {justice,city,witness}=fixture();witness.entity.x=2;city.random=()=>0;city.buildings.push({entity:{x:.8,y:-1},width:.5,depth:2});assert.equal(justice.crimeRecord('assault',1,null).witnesses.length,0);
  city.buildings[0].constructionKind='open-air';assert.equal(justice.crimeRecord('assault',1,null).witnesses.length,1);
});

test('interior observation uses real room positions and excludes other rooms, floors and outdoors',()=>{
  const {justice,city,actor,witness}=fixture();actor.indoorLocation={buildingId:5,unitId:7,floor:1,position:{x:20,y:20,z:3}};witness.indoorLocation={buildingId:5,unitId:7,floor:1,position:{x:20.2,y:20,z:3}};
  const record=justice.crimeRecord('assault',1,null);assert.equal(record.position.x,20);assert.equal(record.scene.unitId,7);assert.equal(record.witnesses.length,1);
  witness.indoorLocation.unitId=8;assert.equal(justice.crimeRecord('assault',1,null).witnesses.length,0);
  witness.indoorLocation.unitId=7;witness.indoorLocation.floor=2;assert.equal(justice.crimeRecord('assault',1,null).witnesses.length,0);
  witness.indoorLocation=null;assert.equal(justice.crimeRecord('assault',1,null).witnesses.length,0);
});

test('victim status cannot bypass darkness, unconsciousness, walls or elevation',()=>{
  const {justice,city,witness}=fixture();city.hour=23;assert.equal(justice.crimeRecord('theft',1,2).witnesses.length,0);city.hour=12;witness.unconsciousUntil=200;assert.equal(justice.crimeRecord('assault',1,2).witnesses.length,0);
  witness.unconsciousUntil=0;witness.skybridgeZ=3;assert.equal(justice.crimeRecord('assault',1,2).witnesses.length,0);
});

test('head injury temporarily reduces witness attention without changing base skills',()=>{
  const {justice,city,witness}=fixture();witness.skills={investigation:50};witness.combatInjuries=[{region:'cabeça',severity:6}];witness.combatConfusedUntil=200;
  assert.equal(justice.crimeRecord('assault',1,null).witnesses.length,0);city.minute=201;assert.equal(justice.crimeRecord('assault',1,null).witnesses.length,1);assert.equal(witness.skills.investigation,50);
});


test('later discovery of missing property permits a report without inventing an eyewitness or suspect',()=>{
  const {justice,city,witness}=fixture();city.hour=23;const record=justice.crimeRecord('theft',1,2);record.stolenAsset={kind:'money',amount:100,ownerId:2};
  const officer={id:3,jobId:10,entity:{},needs:{health:90}};city.citizens.push(officer);city.buildings.push({id:10,type:'police_station',active:true,entity:{},workers:[3]});let reporterId=null;justice.report=(caseId,id)=>{reporterId=id;return true;};
  justice.dispatchReports();assert.equal(reporterId,null);city.minute+=30;justice.dispatchReports();assert.equal(reporterId,witness.id);assert.equal(record.witnesses.length,0);assert.equal(record.discovery.basis,'missing-property');assert.equal(record.investigation,null);
});
