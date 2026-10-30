import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';
import {CityRelationships} from '../js/city_relationships.js';

function fixture(){
  const people=[1,2,3].map(id=>({id,entity:{x:.1*id,y:0,properties:{name:`Pessoa ${id}`}},needs:{health:90,energy:90},traits:{empathy:.5,riskTolerance:.8},socialProfile:{temper:.9},social:{memories:[],beliefs:[]}}));let id=0;
  const city={minute:100,hour:12,world:{},buildings:[],citizens:people,society:{citizen:id=>people.find(c=>c.id===id),isAdult:()=>true},building:()=>null,random:()=>0,log:()=>({id:++id}),createEntity:data=>({...data,id:++id})};city.relationships=new CityRelationships(city);const justice=new CityJustice(city);city.justice=justice;
  const art=justice.createArtwork({kind:'statue',message:'Homenagem',creatorId:1,subjectId:3,x:0,y:0});return {justice,city,art,person:people[1]};
}

test('damage creates a vandalism occurrence and destruction preserves history',()=>{
  const {justice,art,person}=fixture();assert.equal(justice.damageArtwork(art.id,35,person.id),true);assert.equal(art.damaged,35);assert.equal(justice.cases[0].type,'vandalism');assert.equal(art.damageHistory[0].caseId,justice.cases[0].id);
  justice.damageArtwork(art.id,100,person.id);assert.equal(art.entity.destroyed,true);assert.equal(art.damaged,100);assert.equal(art.damageHistory.length,2);assert.equal(art.destroyedBy,person.id);assert.equal(art.debris.artId,art.id);assert.equal(justice.damageArtwork(art.id,10,person.id),false);assert.equal(justice.cases.length,2);
});

test('hidden crimes cannot trigger monument vandalism',()=>{
  const {justice,art,person}=fixture();justice.cases.push({id:90,type:'murder',offenderId:3,status:'unreported'});assert.equal(justice.considerArtProtest(person,art),false);assert.equal(art.damaged,0);
  person.social.memories.push({actorId:3,kind:'murder',truth:true,firsthand:true});assert.equal(justice.considerArtProtest(person,art),true);assert.ok(art.damaged>0);assert.equal(justice.considerArtProtest(person,art),false);
});

test('believed accusations can provoke a protest while corrected beliefs cannot',()=>{
  const {justice,art,person}=fixture();person.social.beliefs.push({aboutId:3,kind:'murder',believes:true,corrected:true});assert.equal(justice.considerArtProtest(person,art),false);person.social.beliefs[0].corrected=false;assert.equal(justice.considerArtProtest(person,art),true);
});

test('distance, walls and invalid damage prevent remote or corrupt vandalism actions',()=>{
  const {justice,art,person,city}=fixture();person.entity.x=10;assert.equal(justice.damageArtwork(art.id,20,person.id),false);person.entity.x=1;city.buildings.push({entity:{x:.4,y:-1},width:.2,depth:2});assert.equal(justice.damageArtwork(art.id,20,person.id),false);assert.equal(justice.damageArtwork(art.id,NaN),false);assert.equal(art.damaged,0);
});

test('only actual identified witnesses gain crime memories usable for gossip',()=>{
  const {justice,city,person}=fixture();const record=justice.crimeRecord('murder',3,null);assert.ok(record.witnesses.some(w=>w.citizenId===person.id));assert.ok(person.social.memories.some(m=>m.kind==='murder'&&m.actorId===3));
  const memory=person.social.memories.find(m=>m.kind==='murder');assert.equal(city.relationships.facts.get(memory.factId).caseId,record.id);
});


test('art reading shares the social fact namespace and never overwrites crime evidence memories',()=>{
  const {justice,city,person,art}=fixture();const record=justice.crimeRecord('murder',3,null),crimeMemory=person.social.memories.find(m=>m.kind==='murder'),crimeFact=city.relationships.facts.get(crimeMemory.factId);city.random=()=>.99;
  justice.reactToArt();assert.equal(city.relationships.facts.get(crimeMemory.factId),crimeFact);assert.ok(art.socialFactId>crimeMemory.factId);assert.equal(crimeFact.caseId,record.id);const nextId=city.relationships.nextFactId;
  city.minute+=240;justice.reactToArt();assert.equal(city.relationships.nextFactId,nextId);assert.equal(city.relationships.facts.get(art.socialFactId).kind,'public-art');
});
