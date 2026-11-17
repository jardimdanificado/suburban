import test from 'node:test';
import assert from 'node:assert/strict';
import {artworkReception} from '../js/city_art_narratives.js';
import {CityJustice} from '../js/city_justice.js';
import {CityRelationships} from '../js/city_relationships.js';
import {setup} from './helpers/city.mjs';

function fixture(accept=true){
 const target={id:3,entity:{x:0,y:0,properties:{name:'Alvo'}},social:{memories:[],beliefs:[]}};
 const reader={id:2,entity:{x:0,y:0,properties:{name:'Leitor'}},traits:{empathy:.5,openness:.5},political:{memories:[],criticalSense:.5},social:{memories:[],beliefs:[]}};
 let id=0;const city={minute:100,hour:12,world:{},buildings:[],citizens:[reader],society:{citizen:id=>id===3?target:reader,isAdult:()=>true},building:()=>null,random:()=>accept?0:.99,log:()=>({id:++id}),createEntity:data=>({...data,id:++id}),currency:{price:n=>n},politics:{remember:(c,m)=>c.political.memories.push(m)}};
 city.relationships=new CityRelationships(city);const justice=new CityJustice(city);city.justice=justice;
 justice.considerArtProtest=()=>false;justice.commissionCounterArtwork=()=>false;justice.canObserve=()=>true;justice.artObserverAt=()=>true;
 const art=justice.createArtwork({kind:'graffiti',message:'Alvo: corrupto e safado',subjectId:3,x:0,y:0});
 return {city,justice,reader,art};
}

test('common inflected accusations and insults have a negative effect on their named subject',()=>{
 for(const word of ['ladrão','ladrões','ladra','corrupto','corrupta','corruptos','criminosa','mentiroso','safado','safada','canalha','sem-vergonha']){
  const reception=artworkReception({traits:{empathy:.5}},{subjectId:3},{message:`Alvo: ${word}`});
  assert(reception.tone.accusation||reception.tone.insult,word);assert(reception.effect<0,word);
 }
});

test('approving an attack records agreement and a negative political opinion of the target',()=>{
 const {justice,reader,art}=fixture();justice.reactToArt();
 assert.equal(art.opinions[reader.id].positive,true);assert.equal(art.opinions[reader.id].agreesWithMessage,true);
 assert.equal(art.positiveOpinions,1);assert(art.opinions[reader.id].targetEffect<0);
 const memory=reader.political.memories[0];assert.equal(memory.candidateId,3);assert(memory.effect<0);assert.equal(memory.believes,true);
});

test('rejecting an attack does not count as approval and can cause sympathy for its target',()=>{
 const {justice,reader,art}=fixture(false);justice.reactToArt();assert.equal(art.opinions[reader.id].positive,false);
 assert.equal(art.positiveOpinions,0);assert.equal(reader.political.memories[0].believes,false);assert(reader.political.memories[0].effect>0);
});

test('rereading a message does not stack political influence, but a new layer has its own opinion',()=>{
 const {city,justice,reader,art}=fixture();justice.reactToArt();const first=reader.political.memories[0].effect;
 city.minute+=240;justice.reactToArt();assert.equal(reader.political.memories.length,1);assert.equal(reader.political.memories[0].effect,first);
 art.layers.push({id:1,message:'Alvo: herói',creatorId:1});city.minute+=240;justice.reactToArt();
 assert.equal(reader.political.memories.length,2);assert(reader.political.memories[1].effect>0);assert.equal(art.opinions[reader.id].layerId,1);
 assert.equal(art.positiveOpinions,1);assert.equal(art.viewCount,1);
});

test('political art opinions contribute to overall popularity instead of remaining unused memories',()=>{
 const city=setup({starter:true,population:16}),target=city.citizens.find(c=>c.political?.partyId),reader=city.citizens.find(c=>c.id!==target.id);
 city.politics.standing.refresh(true);const before=target.political.popularityReport.raw;
 city.politics.remember(reader,{kind:'observer-opinion',candidateId:target.id,artId:123,layerId:0,believes:true,effect:-2,description:'Concordou com um pixo crítico'});
 city.politics.standing.refresh(true);assert(target.political.popularityReport.raw<before);
});
