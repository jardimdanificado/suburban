import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney} from './helpers/city.mjs';
import {updateMayorCampaign} from '../js/city_mayor_campaign.js';
import {renderMayorChallenges,renderMayorElection,mayorDecisions} from '../js/city_mayor_play.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
const start=()=>{const city=setup({starter:true,population:24});assert(city.mayorAction('start'));assert(city.mayorAction('confirmReview',{kind:'government'}));return city;};

test('public commitment resolves once, affects electoral memory, and survives save export',()=>{
  const city=start(),cash=totalMoney(city);
  const challenge=city.mayorAction('challenge',{kind:'works'});assert(challenge);
  assert(!city.mayorAction('challenge',{kind:'housing'}));
  city.development.projects.push({id:'challenge-proof',accountId:'treasury',status:'completed'});
  updateMayorCampaign(city);assert.equal(challenge.status,'completed');
  const person=city.citizens.find(c=>city.society.isAdult(c));
  const memories=()=>person.political.memories.filter(m=>m.kind==='mayor-commitment');
  assert.equal(memories().length,1);assert.equal(memories()[0].effect,3);
  updateMayorCampaign(city);assert.equal(memories().length,1);
  assert(!city.mayorAction('challenge',{kind:'works'}));assert.equal(totalMoney(city),cash);
  const restored=new CityStateGraph().apply(new CityStateGraph().encode({city})).city;bindCityState(restored);
  assert.equal(restored.mayorCampaign.challenges[0].status,'completed');
});

test('expired commitments fail even when a late update sees the target met',()=>{
  const city=start(),c=city.mayorAction('challenge',{kind:'works'});city.minute=c.deadline+1;
  city.development.projects.push({id:'late',accountId:'treasury',status:'completed'});
  updateMayorCampaign(city);assert.equal(c.status,'failed');
  assert(mayorDecisions(city).some(t=>t.id===`challenge:${c.id}`));
  const person=city.citizens.find(c=>city.society.isAdult(c));assert(person.political.memories.some(m=>m.kind==='mayor-commitment'&&m.effect===-4));
});

test('pausing preserves work and funds, blocks completion, and resume retains progress',()=>{
  const city=start();city.politics.fundInitialWorksBudget();const p=city.mayorAction('build',{type:'clinic'});assert(p);
  p.inventory.pedra=p.stone;p.labor=p.requiredLabor;
  const cash=totalMoney(city),treasury=city.treasury;
  assert(city.mayorAction('pauseWork',{projectId:p.id,paused:true}));assert(!city.development.complete(p));assert.notEqual(p.status,'completed');
  assert.equal(p.labor,p.requiredLabor);assert.equal(totalMoney(city),cash);assert.equal(city.treasury,treasury);
  assert(city.mayorAction('pauseWork',{projectId:p.id,paused:false}));assert(city.development.complete(p));assert.equal(p.status,'completed');
  assert(!city.mayorAction('pauseWork',{projectId:p.id,paused:true}));
});

test('manual campaign controls only the player party, validates commands and does not fund propaganda from treasury',()=>{
  const city=start(),campaigns=city.politics.campaigns,own={partyId:city.mayorCampaign.partyId};
  assert(city.mayorAction('campaignControl',{mode:'manual'}));assert(campaigns.playerDirects(own));assert(!campaigns.playerDirects({partyId:'opposition'}));
  const treasury=city.treasury,cash=totalMoney(city);
  assert(!city.mayorAction('campaignMaterial',{kind:'invalid'}));assert(!city.mayorAction('rally',{point:{x:NaN,y:0}}));
  assert.equal(city.treasury,treasury);assert.equal(totalMoney(city),cash);
  assert(city.mayorAction('campaignControl',{mode:'automatic'}));assert(!campaigns.playerDirects(own));
});

test('commitments and campaign screens expose real commands',()=>{
  const city=start(),buttons=[],p=new Proxy({button(label,click){buttons.push({label,click});},buttons(rows){buttons.push(...rows);}}, {get:(o,k)=>o[k]||(()=>{})}),ui={city,selectControl(){},host:{}};
  renderMayorChallenges(ui,p);assert(buttons.some(b=>b.label.includes('Entregar uma obra pública')));
  renderMayorElection(ui,p);
});

test('manual propaganda contracts one real mission, respects daily quota and preserves treasury',()=>{
  const city=start();city.minute=8*60;
  const party=city.politics.party(city.mayorCampaign.partyId),candidate=city.society.citizen(city.economy.mayorId);
  const n={citizenId:candidate.id,partyId:party.id,name:candidate.entity.properties.name,promises:[]};
  city.politics.active={id:990,status:'campaign',candidates:[n],voteAt:city.minute+1440,events:[],councilCandidates:[]};
  const shop=city.economy.businesses.find(b=>b.active);shop.inventory.panfletos=30;
  city.transfer('treasury',city.politics.partyAccount(party).accountId,10000,'Fixture');
  for(const c of city.citizens){c.task=null;c.path=[];c.indoorLocation=null;for(const key of Object.keys(c.needs))c.needs[key]=100;}
  city.traffic.set(`${Math.floor(shop.door.x)},${Math.floor(shop.door.y)}`,20);
  assert(city.mayorAction('campaignControl',{mode:'manual'}));
  const materials=city.politics.campaigns.getMaterials(),treasury=city.treasury,cash=totalMoney(city);
  materials.plan(city.politics.active);assert.equal(materials.missions.length,0);
  const mission=city.mayorAction('campaignMaterial',{kind:'pamphlet'});assert(mission,city.lastError);
  assert.equal(mission.good,'panfletos');assert.equal(mission.shopId,shop.id);assert.equal(mission.partyId,party.id);
  assert.equal(city.society.citizen(mission.workerId).campaign.missionId,mission.id);
  assert(!city.mayorAction('campaignMaterial',{kind:'pamphlet'}));assert.equal(materials.missions.length,1);
  assert.equal(city.treasury,treasury);assert.equal(totalMoney(city),cash);
  const buttons=[],p=new Proxy({buttons(rows){buttons.push(...rows);},button(label,click){buttons.push({label,click});}}, {get:(o,k)=>o[k]||(()=>{})});
  renderMayorElection({city,selectControl(){},host:{}},p);assert(buttons.some(b=>b.label==='CONTRATAR PROPAGANDA'));
});

test('rally uses the chosen street area and rejects unreachable areas without consuming the hourly call',()=>{
  const city=start();city.minute=8*60;
  const party=city.politics.party(city.mayorCampaign.partyId),candidate=city.society.citizen(city.economy.mayorId),campaigns=city.politics.campaigns;
  const n={citizenId:candidate.id,partyId:party.id,name:candidate.entity.properties.name,promises:[]};
  city.politics.active={id:991,status:'campaign',candidates:[n],voteAt:city.minute+1440,events:[],councilCandidates:[]};
  const c=city.citizens.find(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c));assert(c);
  c.political.partyId=party.id;c.task=null;c.path=[];c.conversation=null;c.deliveryId=null;c.cleaningJobId=null;c.workMeal=null;
  for(const key of Object.keys(c.needs))c.needs[key]=100;
  const point=campaigns.streetPoints(1,c.entity)[0];assert(point);
  assert(!city.mayorAction('rally',{point:{x:-100,y:-100}}));assert.equal(city.mayorCampaign.lastRallyHour,undefined);
  const result=city.mayorAction('rally',{point});assert(result,city.lastError);
  const event=city.politics.active.events.find(e=>e.kind==='campaign-rally');assert(event);
  assert(Math.hypot(event.x-point.x,event.y-point.y)<3);assert(!city.mayorAction('rally',{point}));
});
