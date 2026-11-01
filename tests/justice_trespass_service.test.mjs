import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {syncCitizenInterior,advanceCitizenInterior} from '../js/city_interiors.js';
import {renderJustice} from '../js/city_justice_ui.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';

function privateWorkplace(city){
 let building;for(const site of city.economy.locateBuilding('market')){building=city.addBuilding('market',site.x,site.y,{...site,floors:1,free:true});if(building)break;}assert.ok(building);
 const owner=city.citizens.find(c=>c.fixtureInvestor);assert.ok(owner);for(const unit of building.units)unit.price=1000;assert.ok(city.economy.purchasePremises(building,owner));const facility=[...city.sanitation.facilities.values()].find(f=>f.buildingId===building.id&&f.access==='employees');assert.ok(facility);return {building,facility,owner};
}

test('a desperate resident can enter a private workplace bathroom and the actual unauthorized use creates one offense',()=>{
 const city=setup({starter:true,funded:true,population:32}),{building,facility,owner}=privateWorkplace(city);
 const actor=city.citizens.find(c=>city.society.isAdult(c)&&c.id!==building.ownerId&&c.jobId!==building.id&&!c.entity.destroyed);assert.ok(actor);
 city.sanitation.facilities=new Map([[facility.id,facility]]);actor.entity.x=building.door.x;actor.entity.y=building.door.y;actor.path=[];actor.task=null;actor.needs.toilet=15;actor.toiletWaitingSince=city.minute-120;city.minute++;
 assert.equal(city.sanitation.choose(actor),true);assert.equal(actor.task,'toilet');assert.equal(actor.trespassToiletFacilityId,facility.id);assert.equal(city.justice.cases.length,0);
 const room=city.units.get(facility.unitId);syncCitizenInterior(city,actor);for(let i=0;i<100&&actor.indoorLocation?.unitId!==room.id;i++){city.minute++;advanceCitizenInterior(city,actor,100);syncCitizenInterior(city,actor);}assert.equal(actor.indoorLocation?.unitId,room.id);
 const balance=city.accounts.get(owner.accountId).balance;city.sanitation.use(actor);assert.equal(city.justice.cases.length,1);const record=city.justice.cases[0];assert.equal(record.type,'trespass');assert.equal(record.offenderId,actor.id);assert.equal(record.details.purpose,'unauthorized-bathroom-use');assert.equal(record.details.buildingId,building.id);assert.equal(city.accounts.get(owner.accountId).balance,balance);
 for(let i=0;i<10;i++)city.sanitation.use(actor);assert.equal(city.justice.cases.length,1);
});

test('ordinary authorized toilet access remains free of trespass cases',()=>{
 const city=setup({starter:true,funded:true,population:32}),{building,facility,owner}=privateWorkplace(city);city.sanitation.facilities=new Map([[facility.id,facility]]);owner.jobId=building.id;owner.needs.toilet=20;owner.toiletTargetId=facility.id;owner.task='toilet';const room=city.units.get(facility.unitId);owner.indoorLocation={buildingId:building.id,unitId:room.id,targetUnitId:room.id,targetRoomType:'bathroom',roomType:'bathroom',floor:room.z,position:{x:building.entity.x+room.x+.5,y:building.entity.y+room.y+.5,z:room.z*1.8},path:[],phase:'using'};
 city.sanitation.use(owner);assert.equal(city.justice.cases.length,0);
});

test('a desperate resident may trespass to use a private workplace sink, and the offense requires completed use',()=>{
 const city=setup({starter:true,funded:true,population:32}),{building,facility,owner}=privateWorkplace(city);
 const actor=city.citizens.find(c=>city.society.isAdult(c)&&c.id!==building.ownerId&&c.jobId!==building.id&&!c.entity.destroyed);assert.ok(actor);
 let station;for(const site of city.economy.locateBuilding('police_station')){station=city.addBuilding('police_station',site.x,site.y,{...site,free:true});if(station)break;}assert.ok(station);const officer=city.citizens.find(c=>c.id!==actor.id&&c.id!==owner.id&&!c.entity.destroyed);assert.ok(officer);station.workers=[officer.id];officer.jobId=station.id;officer.task='work';officer.path=[];
 city.sanitation.facilities=new Map([[facility.id,facility]]);actor.entity.x=building.door.x;actor.entity.y=building.door.y;actor.path=[];actor.task=null;actor.needs.hygiene=15;actor.hygieneWaitingSince=city.minute-120;city.minute++;
 city.chooseTask(actor);assert.equal(actor.task,'hygiene');assert.equal(actor.trespassHygieneFacilityId,facility.id);assert.equal(city.justice.cases.length,0);
 const room=city.units.get(facility.unitId);owner.indoorLocation={buildingId:building.id,unitId:room.id,floor:room.z,roomType:'bathroom',position:{x:building.entity.x+room.x+.5,y:building.entity.y+room.y+.5,z:room.z*1.8},path:[]};city.random=()=>0;
 for(let i=0;i<80&&actor.needs.hygiene<95;i++){city.minute++;advanceCitizenInterior(city,actor,100);syncCitizenInterior(city,actor);city.performTask(actor);}
 assert(actor.needs.hygiene>=95,'the person must finish using the sink before a report is created');assert.equal(city.justice.cases.length,1);assert.equal(city.justice.cases[0].details.purpose,'unauthorized-hygiene-use');assert.equal(city.justice.cases[0].details.buildingId,building.id);
 assert(city.justice.cases[0].witnesses.some(w=>w.citizenId===owner.id),'the physically present property owner must be able to witness the trespass');city.justice.dispatchReports();assert.equal(city.justice.cases[0].reporterId,owner.id);assert.equal(owner.task,'justice-report');
 const rendered=[],panel=new Proxy({}, {get:(_target,key)=> (...args)=>rendered.push([key,...args])}),ui={city,view:()=> 'cases',justiceCaseId:city.justice.cases[0].id,matches:()=>true};renderJustice(ui,panel);
 assert(rendered.some(row=>row[0]==='kv'&&row[1]==='Uso não autorizado'&&row[2]==='Uso de pia para higiene'));assert(rendered.some(row=>row[0]==='kv'&&row[1]==='Imóvel afetado'&&row[2]===building.entity.properties.name));
});

test('a trespass attempt at the private sink preserves its route and deadline in worker snapshots',()=>{
 const city=setup({starter:true,funded:true,population:32}),{building,facility}=privateWorkplace(city),actor=city.citizens.find(c=>city.society.isAdult(c)&&c.id!==building.ownerId&&!c.entity.destroyed);assert.ok(actor);
 actor.task='hygiene';actor.targetId=building.id;actor.hygieneTargetId=facility.id;actor.trespassHygieneFacilityId=facility.id;actor.hygieneWaitingSince=city.minute-90;actor.path=[{x:building.door.x,y:building.door.y}];
 const sender=new CityStateGraph(),receiver=new CityStateGraph(),snapshot=receiver.apply(sender.encode({city}));bindCityState(snapshot.city);let copy=snapshot.city.society.citizen(actor.id);
 assert.equal(copy.trespassHygieneFacilityId,facility.id);assert.equal(copy.hygieneWaitingSince,actor.hygieneWaitingSince);assert.deepEqual(copy.path,actor.path);
 actor.trespassHygieneFacilityId=null;actor.hygieneWaitingSince=null;actor.path=[];const delta=receiver.apply(sender.encode({city}));bindCityState(delta.city);copy=delta.city.society.citizen(actor.id);assert.equal(copy.trespassHygieneFacilityId,null);assert.equal(copy.hygieneWaitingSince,null);assert.deepEqual(copy.path,[]);
});
