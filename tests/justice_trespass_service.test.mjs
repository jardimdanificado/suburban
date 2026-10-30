import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {syncCitizenInterior,advanceCitizenInterior} from '../js/city_interiors.js';

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
