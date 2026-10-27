import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney} from './helpers/city.mjs';
import {activityBadge} from '../js/city_activity_badges.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';

function available(city){for(const c of city.citizens){c.conversation=null;c.workMeal=null;c.deliveryId=null;c.cleaningJobId=null;c.task=null;c.path=[];c.indoorLocation=null;for(const key of Object.keys(c.needs))c.needs[key]=95;}}

test('outdoor activities have distinct markers, and campaign identity survives missing physical flags',()=>{
  const flag={background:'#224a89',foreground:'#fff5b7',skin:'Feature_Flower.png'},c={entity:{destroyed:false},task:'campaign',campaign:{partyFlag:flag,flag:null,partyNumber:27}};
  assert.equal(activityBadge(c).flag,flag);assert.equal(activityBadge(c).number,27);
  for(const [task,fields,kind]of [['research',{researchAssignment:{studyId:1}},'research'],['interview',{pollInterview:{studyId:1}},'interview'],['vote',{},'vote'],['construction',{},'construction'],['council-session',{},'council'],['work',{deliveryId:3},'delivery']])assert.equal(activityBadge({...c,task,...fields}).kind,kind);
  assert.equal(activityBadge({...c,indoorLocation:{buildingId:1}}),null);assert.equal(activityBadge({...c,ridingVehicleId:1}),null);
});

test('real street campaign and rallies work before cloth flags are available',()=>{
  const city=setup({starter:true,funded:true,population:48}),p=city.politics;available(city);p.beginElection();const n=p.active.candidates[0];assert(n);
  for(const b of city.economy.businesses)b.inventory.bandeiras=0;
  p.campaigns.recruit(n,p.active);const actor=city.citizens.find(c=>c.task==='campaign'&&c.campaign.partyId===n.partyId);assert(actor);assert(!actor.campaign.flag);assert(activityBadge(actor).flag);
  p.campaigns.rally(n,p.active);assert(city.citizens.some(c=>c.campaign?.type==='rally'&&c.campaign.partyId===n.partyId));
});

test('opinion interventions change voter assessment, can be corrected, and preserve cast ballots',()=>{
  const city=setup({starter:true,funded:true,population:64}),p=city.politics;available(city);p.beginElection();const e=p.active,n=e.candidates[0],target=city.society.citizen(n.citizenId),before=new Map(city.citizens.map(c=>[c.id,p.voterAssessment(c,target,n.platform,n).score]));
  e.ballots.push({citizenId:999,candidateId:n.citizenId});const ballots=JSON.stringify(e.ballots);
  const record=p.intervene('praise',target.id);assert(record.affected>0);assert(city.citizens.some(c=>p.voterAssessment(c,target,n.platform,n).score>before.get(c.id)));
  const reputation=city.reputation.score(target,'civic');p.intervene('rumor',target.id);const correction=p.intervene('correction',target.id);assert(correction);assert.equal(city.reputation.score(target,'civic'),reputation);
  assert(city.citizens.every(c=>!c.political.memories.some(m=>m.kind==='observer-opinion'&&m.candidateId===target.id&&m.truth===false&&!m.corrected)));
  assert.equal(JSON.stringify(e.ballots),ballots);assert.equal(p.intervene('praise',target.id),null);assert.match(city.lastError,/30 minutos/);
});

test('vehicle imports conserve money and produce a visible bicycle that can make a real trip',()=>{
  const city=setup({starter:true,funded:true,population:48}),p=city.politics;available(city);const citizen=city.citizens.find(c=>!p.officeHolder(c)&&!c.businessIds.length),money=totalMoney(city),stock=city.economy.initialStock.bicicleta;
  const result=p.intervene('importVehicle',citizen.id,{good:'bicicleta'});assert(result,city.lastError);const v=city.vehicles.units.get(result.vehicleId);assert(v.entity&&!v.entity.destroyed);assert(v.active);assert.equal(v.ownerAccountId,citizen.accountId);assert.equal(v.entity.properties.cityVehicle,v);assert.equal(city.economy.initialStock.bicicleta,stock+1);assert.equal(totalMoney(city),money);
  assert.equal(v.fuelStore,undefined);
  const ride=p.intervene('ride',v.id);assert(ride,city.lastError);assert.equal(citizen.mobilityTrip.vehicleId,v.id);
  for(let frame=0;frame<2400&&v.distance===0;frame++)city.update(1/16);
  assert(v.distance>0,'the vehicle must move along a real ground path');assert.equal(totalMoney(city),money);
});

test('intervention records retain their prototype across worker state transfer',()=>{
  const city=setup({starter:true,population:48}),c=city.citizens[0];assert(city.politics.intervene('praise',c.id));const graph=new CityStateGraph(),mirror=new CityStateGraph().apply(graph.encode({city})).city;bindCityState(mirror);
  assert.equal(typeof mirror.politics.interventions.perform,'function');assert.equal(mirror.politics.interventions.records.length,1);assert.equal(mirror.politics.interventions.city,mirror);
});

test('paid poll manipulation preserves original interviews and can be corrected by corruption review',()=>{
  const city=setup({starter:true,funded:true,population:64}),p=city.politics;available(city);p.beginElection();const e=p.active;assert(e.candidates.length>1);let institute;
  for(const site of city.economy.locateBuilding('research_institute')){institute=city.addBuilding('research_institute',site.x,site.y,{...site,free:true});if(institute)break;}
  city.economy.activateMunicipalBusiness(institute,100000);const worker=city.citizens.find(c=>!p.officeHolder(c)&&!c.businessIds.length);city.economy.leaveJob(worker,'Research fixture');worker.jobId=institute.id;institute.workers.push(worker.id);
  const raw=e.candidates.map((n,i)=>Object.freeze({candidateId:n.citizenId,name:n.name,partyId:n.partyId,intentions:i===0?20:0,rejections:0})),poll={id:1,studyId:987,instituteId:institute.id,instituteName:institute.entity.properties.name,sampleSize:20,results:raw,rawResults:raw,undecided:0,rawUndecided:0,responses:[]};e.polls.push(poll);const nominee=e.candidates.at(-1),fund=p.partyAccount(p.party(nominee.partyId));assert(city.transfer('treasury',fund.accountId,city.currency.price(1000000),'Fund test campaign'));const money=totalMoney(city);
  const result=p.intervene('rigPoll',nominee.citizenId);assert(result,city.lastError);assert(poll.manipulated);assert.equal(poll.rawResults,raw);assert.equal(poll.results.reduce((n,r)=>n+r.intentions,0)+poll.undecided,20);assert(poll.results.find(r=>r.candidateId===nominee.citizenId).intentions>0);assert.equal(totalMoney(city),money);assert.equal(e.ballots.length,0);
  const crime=p.corruption.find(c=>c.id===poll.corruptionCaseId);crime.proven=true;p.scandals.push(crime);p.getResearch().reviewCases();assert.equal(poll.results,raw);assert.equal(poll.undecided,0);assert(poll.correctedAt);
});
