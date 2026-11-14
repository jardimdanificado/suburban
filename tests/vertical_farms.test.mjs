import test from 'node:test';
import assert from 'node:assert/strict';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
import {setup} from './helpers/city.mjs';
import {canFarmVertically,farmCells,plannedFarmArea} from '../js/city_farm_layout.js';
import {activityRoomReady,advanceCitizenInterior} from '../js/city_interiors.js';

function fixture(){
 const city=setup({starter:true,funded:true,population:16});
 const owner=city.citizens.find(c=>c.fixtureInvestor),lot=city.development.plots.find(p=>p.ownerId==='treasury'&&!p.buildingId&&!p.projectId&&!['farm','quarry'].includes(p.type)&&p.width>=3&&p.depth>=3);
 assert.ok(lot);assert.ok(city.development.buyPlot(owner.accountId,lot.id));
 return {city,owner,lot};
}
function build({city,owner,lot},floors=3){
 const project=city.development.beginProject(owner.accountId,lot.id,'farm',{kind:'building',crop:'alface',width:3,depth:3,floors});
 assert.ok(project,city.lastError);assert.equal(project.stone,3*3*floors*2);assert.equal(city.development.complete(project),null);
 project.inventory.pedra=project.stone;project.labor=project.requiredLabor;
 const farm=city.development.complete(project);assert.ok(farm,city.lastError);return farm;
}
test('vertical crops exclude trees and palms, including their cuttings',()=>{
 for(const crop of ['alface','trigo','milho','cubensis','amanita','peyote','trombeta_anjo'])assert.equal(canFarmVertically(crop),true,crop);
 for(const crop of ['maca','coco','manga','inexistente'])assert.equal(canFarmVertically(crop),false,crop);
});
test('vertical farms build real floors without repainting terrain and cultivate only usable rooms',()=>{
 const f=fixture(),before=f.city.world.getTile(f.lot.x,f.lot.y),farm=build(f);
 assert.equal(farm.floors,3);assert.equal(farm.constructionKind,'building');assert.equal(f.city.world.getTile(f.lot.x,f.lot.y),before);
 assert.equal(farm.fields.reduce((n,x)=>n+x.area,0),plannedFarmArea(3,3,3,'building'));
 for(const field of farm.fields){const units=field.unitIds.map(id=>f.city.units.get(id));assert.ok(units.length);assert.equal(new Set(units.map(u=>u.z)).size,1);assert.ok(units.every(u=>u.x!==1&&u.roomType==='workspace'));}
 assert.equal(new Set(farmCells(farm).map(u=>u.z)).size,3);
});
test('invalid tree crops cannot construct or buy a vertical farm',()=>{
 const f=fixture(),balance=f.owner.balance;
 assert.equal(f.city.development.beginProject(f.owner.accountId,f.lot.id,'farm',{kind:'building',crop:'maca',width:3,depth:3,floors:3}),null);assert.equal(f.owner.balance,balance);assert.equal(f.lot.projectId,null);
 const farm=build(f),buyer=f.city.citizens.find(c=>c.fixtureInvestor&&c.id!==f.owner.id);farm.active=false;farm.municipal=false;for(const u of farm.units){u.ownerId='treasury';u.forSale=true;}
 const cash=buyer.balance;assert.equal(f.city.economy.purchasePremises(farm,buyer,'maca'),null);assert.equal(buyer.balance,cash);assert.ok(farm.units.every(u=>u.ownerId==='treasury'));
});
test('upper beds require a continuous journey through the staircase',()=>{
 const f=fixture(),farm=build(f),c=f.owner,unit=farmCells(farm).find(u=>u.z===2);
 c.task='work';c.jobId=farm.id;c.targetId=farm.id;c.path=[];c.indoorLocation=null;c.entity.x=farm.door.x;c.entity.y=farm.door.y;
 assert.equal(activityRoomReady(f.city,c,farm,unit,'workspace'),false);
 let reached=false,usedStairs=false;
 for(let i=0;i<300&&!reached;i++){
  if(c.path.length){const p=c.path.at(-1);c.entity.x=p.x;c.entity.y=p.y;c.path=[];}
  advanceCitizenInterior(f.city,c,.25);const z=c.indoorLocation?.position?.z||0;if(z>0&&z<3.6)usedStairs=true;
  reached=activityRoomReady(f.city,c,farm,unit,'workspace');
 }
 assert.equal(reached,true);assert.equal(usedStairs,true);assert.equal(c.indoorLocation.floor,2);
});
test('expansion preserves existing plant growth and adds productive floors',()=>{
 const f=fixture(),farm=build(f,2),field=farm.fields[0],area=farmCells(farm).length;field.plantedAt=12;field.labor=7;
 const project=f.city.development.beginExpansion(f.owner.accountId,farm.id,{floors:2});assert.ok(project);assert.equal(f.city.development.complete(project),null);
 project.inventory.pedra=project.stone;project.labor=project.requiredLabor;assert.ok(f.city.development.complete(project));
 assert.equal(farm.floors,4);assert.equal(farm.fields[0],field);assert.equal(field.plantedAt,12);assert.equal(field.labor,7);assert.equal(farmCells(farm).length,area+12);
 assert.ok(farm.fields.some(x=>x.unitIds.some(id=>f.city.units.get(id).z===3)));
});
test('public construction exposes floors, pays masonry and refuses tree crops without charging',()=>{
 const city=setup({starter:true,funded:true,population:24}),cash=city.treasury;
 assert.equal(city.politics.startPublicWork('farm','maca',{observer:true,vertical:true,floors:3}),null);assert.equal(city.treasury,cash);
 const project=city.politics.startPublicWork('farm','alface',{observer:true,vertical:true,floors:3});assert.ok(project,city.lastError);assert.equal(project.kind,'building');assert.equal(project.floors,3);assert.equal(project.stone,project.width*project.depth*3*2);assert.notEqual(project.status,'completed');
});
test('upper-floor planting cannot consume seeds or add labor before arrival',()=>{
 const f=fixture(),farm=build(f),c=f.owner;
 for(const field of farm.fields){if(f.city.units.get(field.unitIds[0]).z<2){field.plantedAt=0;field.labor=field.requiredLabor;field.cellLabor=field.unitIds.map(()=>field.requiredLabor/field.area);field.harvestedCells=field.unitIds.map(()=>true);}}
 farm.seedStock=100;c.task='work';c.jobId=farm.id;c.targetId=farm.id;c.path=[];c.workCell=null;c.indoorLocation=null;c.entity.x=farm.door.x;c.entity.y=farm.door.y;
 const field=farm.fields.at(-1),seed=farm.seedStock;f.city.economy.farmWork(farm,c);assert.equal(field.plantedAt,null);assert.equal(field.labor,0);assert.equal(farm.seedStock,seed);
 for(let i=0;i<400&&field.plantedAt===null;i++){if(c.path.length){const p=c.path.at(-1);c.entity.x=p.x;c.entity.y=p.y;c.path=[];}advanceCitizenInterior(f.city,c,.25);f.city.economy.farmWork(farm,c);}
 assert.notEqual(field.plantedAt,null);assert.equal(c.indoorLocation.floor,2);assert.ok(farm.seedStock<seed);assert.ok(field.labor>0);
});

test('vertical beds, crop progress and ownership survive state serialization',()=>{
 const f=fixture(),farm=build(f);farm.fields[0].plantedAt=123;farm.fields[0].labor=8;
 const restored=new CityStateGraph().apply(new CityStateGraph().encode({city:f.city})).city;bindCityState(restored);
 const saved=restored.building(farm.id);assert.equal(saved.constructionKind,'building');assert.equal(saved.floors,3);assert.equal(saved.crop,'alface');assert.equal(saved.fields[0].plantedAt,123);assert.equal(saved.fields[0].labor,8);assert.equal(saved.ownerId,f.owner.id);
 for(const field of saved.fields)assert.ok(field.unitIds.every(id=>restored.units.get(id)?.buildingId===farm.id));
});
