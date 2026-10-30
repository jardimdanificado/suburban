import test from 'node:test';
import assert from 'node:assert/strict';
import {artworkNarrative,narrativeReception} from '../js/city_art_narratives.js';
import {setup} from './helpers/city.mjs';
import {CityStateGraph,bindCityState} from '../js/city_state.js';

test('a historical narrative preserves its source without rewriting the event',()=>{
  const event={id:4,message:'Abertura da praça',minute:123,citizenIds:[1,2],kind:'city'},city={history:{get:id=>id===4?event:null}};
  const narrative=artworkNarrative(city,{mode:'distorted',sourceEventId:4,description:'Outra pessoa inaugurou a praça',participantIds:[3,3]});
  assert.deepEqual(narrative.participantIds,[3]);assert.equal(narrative.source.message,event.message);narrative.source.citizenIds.push(8);assert.deepEqual(event.citizenIds,[1,2]);
  city.history.get=()=>null;assert.deepEqual(artworkNarrative(city,narrative).source,narrative.source);
  assert.equal(artworkNarrative(city,{mode:'faithful',sourceEventId:99}),null);
});

test('invented events never acquire a historical identity and hidden accuracy does not determine belief',()=>{
  const narrative=artworkNarrative({}, {mode:'invented',sourceEventId:20,title:'O resgate que nunca aconteceu',participantIds:[7]});
  assert.equal(narrative.sourceEventId,null);assert.equal(narrative.source,null);
  const observer={traits:{openness:.5},political:{criticalSense:.8},social:{memories:[],beliefs:[]}};
  assert.deepEqual(narrativeReception(observer,{...narrative,mode:'faithful'}),narrativeReception(observer,{...narrative,mode:'distorted'}));
});

test('a reader can contest participants using a personal memory without consulting the real event',()=>{
  const observer={social:{memories:[{kind:'assault',eventId:8,actorId:2,targetId:3}],beliefs:[]}};
  const remembered=narrativeReception(observer,{sourceEventId:8,participantIds:[2,3]}),changed=narrativeReception(observer,{sourceEventId:8,participantIds:[4,3]});
  assert.equal(remembered.contradiction,false);assert.equal(changed.contradiction,true);assert.ok(changed.acceptance<remembered.acceptance);
});

test('art narratives and archived source summaries survive snapshots and deltas',()=>{
  const city=setup({starter:true,population:32}),event=city.log('Uma inauguração pública','city',[city.citizens[0].id]);
  const art=city.justice.createArtwork({kind:'painting',message:'Memória da inauguração',x:4,y:4,narrative:{mode:'faithful',sourceEventId:event.id}});
  const sender=new CityStateGraph(),receiver=new CityStateGraph(),restored=receiver.apply(sender.encode({city}));bindCityState(restored.city);
  const copy=restored.city.justice.art.find(a=>a.id===art.id);assert.deepEqual(copy.narrative,art.narrative);
  art.narrative.description='Uma nova interpretação';bindCityState(receiver.apply(sender.encode({city})).city);assert.equal(copy.narrative.description,'Uma nova interpretação');assert.equal(copy.narrative.source.message,'Uma inauguração pública');
});

test('readers and gossip retain the artistic source without creating criminal evidence',()=>{
  const city=setup({starter:true,population:32}),[subject,speaker,listener]=city.citizens;
  const art=city.justice.createArtwork({kind:'painting',message:'Um resgate inventado',creatorId:speaker.id,subjectId:subject.id,x:4,y:4,narrative:{mode:'invented',title:'O resgate',participantIds:[subject.id]}});
  for(const c of [speaker,listener]){c.entity.x=4;c.entity.y=4;c.indoorLocation=null;c.social.memories=[];c.social.beliefs=[];c.social.heardFacts=[];}
  speaker.traits={...speaker.traits,honesty:1};city.random=()=>0;city.justice.canObserve=()=>true;const cases=city.justice.cases.length;
  city.justice.reactToArt();const memory=speaker.social.memories.find(m=>m.artId===art.id);assert.equal(memory.narrative.title,'O resgate');assert.equal(memory.firsthand,false);assert.equal(art.truth,false);
  assert.equal(city.relationships.gossip(speaker,listener,null),true);const belief=listener.social.beliefs.find(b=>b.artId===art.id);assert.equal(belief.narrative.title,'O resgate');assert.equal(belief.sourceId,speaker.id);assert.equal(city.justice.cases.length,cases);
});
