import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
import {CityJustice} from '../js/city_justice.js';
import {ensureJusticeSkills,JUSTICE_SKILLS} from '../js/city_justice_skills.js';

function restore(city){const sender=new CityStateGraph(),receiver=new CityStateGraph(),snapshot=receiver.apply(sender.encode({city}));bindCityState(snapshot.city);return {sender,receiver,restored:snapshot.city};}

test('justice graph preserves entity cycles, shared meal provenance and incremental legal history',()=>{
  const city=setup({starter:true,population:32}),justice=city.justice,actor=city.citizens[5],victim=city.citizens[6],deceased=city.citizens[7];
  actor.inventory??={};actor.inventory.porrete=1;actor.equipment??={};actor.equipment.weapon={good:'porrete',name:'Porrete de madeira',damage:2.4,range:1.8,durability:5};
  const art=justice.createArtwork({kind:'statue',message:'Memória',creatorId:actor.id,subjectId:victim.id,x:actor.entity.x,y:actor.entity.y});
  const meal={good:'pao',inputs:{pao:1},packedAt:city.minute};actor.pocket.food.push(meal);const record=justice.crimeRecord('theft',actor.id,victim.id,{},{observe:false});record.stolenAsset={kind:'meal',meal,holderId:actor.id,ownerId:victim.id,recovered:0};record.trial={status:'hearing-scheduled',defenderId:actor.id};
  city.life.die(deceased,'velhice');const body=justice.bodies.at(-1),vehicle=[...city.vehicles.units.values()].find(v=>v.active);if(vehicle)vehicle.possessorAccountId=actor.accountId;
  const {sender,receiver,restored}=restore(city),copy=restored.justice,copyActor=restored.society.citizen(actor.id);assert.equal(Object.getPrototypeOf(copy),CityJustice.prototype);assert.equal(copy.city,restored);assert.equal(copy.art[0].entity.properties.cityUrbanArt,copy.art[0]);assert.equal(copy.cases[0].stolenAsset.meal,copyActor.pocket.food.at(-1));assert.equal(copy.bodies[0].citizenId,deceased.id);assert.equal(copy.bodies[0].entity.destroyed,false);assert.equal(copyActor.equipment.weapon.good,'porrete');assert.equal(copyActor.equipment.weapon.durability,5);assert.equal(copyActor.inventory.porrete,1);if(vehicle)assert.equal(restored.vehicles.units.get(vehicle.id).possessorAccountId,actor.accountId);
  const stableBody=copy.bodies[0],stableCase=copy.cases[0],stableArt=copy.art[0];body.status='autopsy';body.entity.x+=1;body.autopsyEndsAt=city.minute+90;actor.equipment.weapon.durability=4;record.evidence.push({kind:'document-analysis',confidence:.8,identifiedSuspectId:actor.id});justice.setCrimeRule('theft',{...justice.policies.penalCode.theft,fineOnly:true},9);art.damaged=30;justice.artRevision++;
  const next=receiver.apply(sender.encode({city}));bindCityState(next.city);assert.equal(next.city,restored);assert.equal(copy.bodies[0],stableBody);assert.equal(copy.cases[0],stableCase);assert.equal(copy.art[0],stableArt);assert.equal(stableBody.status,'autopsy');assert.equal(stableBody.entity.x,body.entity.x);assert.equal(copyActor.equipment.weapon.durability,4);assert.equal(stableCase.evidence[0].identifiedSuspectId,actor.id);assert.equal(stableCase.legalHistory[0].billId,9);assert.equal(stableArt.damaged,30);
});

test('old states acquire justice and missing skills without changing money or random seed',()=>{
  const city=setup({starter:true,population:24});delete city.justice;const c=city.citizens[0];for(const skill of JUSTICE_SKILLS)delete c.skills[skill];c.skills.law=0;const seed=city.seed,total=[...city.accounts.values()].reduce((n,a)=>n+a.balance,0),{restored}=restore(city);
  assert.ok(restored.justice instanceof CityJustice);assert.equal(restored.justice.city,restored);assert.equal(restored.justice.policies.cleanRecord,false);assert.equal(restored.justice.policies.parliamentaryImmunity,false);assert.equal(restored.citizens[0].skills.law,0);for(const skill of JUSTICE_SKILLS)assert.ok(Number.isFinite(restored.citizens[0].skills[skill]));assert.equal(restored.seed,seed);assert.equal([...restored.accounts.values()].reduce((n,a)=>n+a.balance,0),total);
});

test('partial justice state preserves enacted flags and rebuilds stable counters',()=>{
  const city=setup({starter:true,population:24});city.justice={cases:[{id:10}],art:[{id:7,layers:[{id:2}],removedLayers:[{id:9}]}],bodies:[{id:5}],policies:{cleanRecord:true,parliamentaryImmunity:false,penalCode:{graffiti:{criminal:false,severity:0,fine:0,cassation:false}}}};
  bindCityState(city);assert.equal(city.justice.nextCaseId,11);assert.equal(city.justice.nextBodyId,6);assert.equal(city.justice.nextArtId,8);assert.equal(city.justice.art[0].nextLayerId,10);assert.equal(city.justice.policies.cleanRecord,true);assert.equal(city.justice.policies.penalCode.graffiti.criminal,false);assert.equal(city.justice.policies.penalCode.graffiti.cassation,false);assert.equal(city.justice.policies.penalCode.graffiti.severity,0);assert.ok(city.justice.policies.penalCode.murder);
});

test('patrol assignment and cached street beat survive worker state snapshots',()=>{
  const city=setup({starter:true,population:24}),officer=city.citizens[3];let station=city.buildings.find(b=>b.type==='police_station');
  if(!station)for(const site of city.economy.locateBuilding('police_station')){station=city.addBuilding('police_station',site.x,site.y,{...site,free:true});if(station)break;}
  assert.ok(station);officer.policePatrol={stationId:station.id,phase:'patrol',startedAt:600,waypointIndex:3,waitUntil:608,lastPaidMinute:607};station.patrolOfficerId=officer.id;station.policePatrolPoints={revision:city.structureRevision,points:[{x:station.door.x+5,y:station.door.y+.5}]};
  const {restored}=restore(city),copy=restored.society.citizen(officer.id),copyStation=restored.building(station.id);
  assert.equal(copy.policePatrol.stationId,station.id);assert.equal(copy.policePatrol.phase,'patrol');assert.equal(copy.policePatrol.waypointIndex,3);assert.equal(copyStation.patrolOfficerId,officer.id);assert.deepEqual(copyStation.policePatrolPoints.points,station.policePatrolPoints.points);
});

test('skill migration is deterministic, preserves existing values and keeps newborn skills at zero',()=>{
  const a={id:7,skills:{combat:12}},b={id:7,skills:{combat:12}},baby={id:8};ensureJusticeSkills(a,2,123);ensureJusticeSkills(b,2,123);assert.deepEqual(a.skills,b.skills);assert.equal(a.skills.combat,12);ensureJusticeSkills(baby,0,123,{newborn:true});assert.ok(JUSTICE_SKILLS.every(skill=>baby.skills[skill]===0));
});
