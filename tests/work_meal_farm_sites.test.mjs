import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {CityStateGraph,bindCityState} from '../js/city_state.js';

function fixture(snapshot=false){
 let city=setup({starter:true,funded:true,population:24});
 const project=city.politics.startPublicWork('farm','alface',{observer:true,vertical:true,floors:3});
 assert.ok(project,city.lastError);assert.equal(project.entity,undefined);
 const builder=city.building(project.builderId),worker=city.society.citizen(builder.workers[0]);assert.ok(worker);
 project.inventory.pao=9;worker.task='construction';worker.workProjectId=project.id;worker.targetId=builder.id;
 worker.path=[];worker.indoorLocation=null;worker.conversation=null;worker.mobilityTrip=null;worker.ridingVehicleId=null;
 for(const need of Object.keys(worker.needs))worker.needs[need]=95;
 worker.needs.food=30;worker.entity.x=project.door.x;worker.entity.y=project.door.y;
 if(snapshot){city=new CityStateGraph().apply(new CityStateGraph().encode({city})).city;bindCityState(city);}
 return {city,project:city.development.projects.find(p=>p.id===project.id),worker:city.society.citizen(worker.id)};
}

for(const snapshot of [false,true])test(`farm construction meals use the site entrance without a building entity (snapshot=${snapshot})`,()=>{
 const {city,project,worker}=fixture(snapshot);
 worker.entity.x=project.door.x+10;
 assert.equal(city.workMeals.tryStart(worker),false);assert.equal(project.inventory.pao,9);
 worker.entity.x=project.door.x;
 assert.equal(city.workMeals.tryStart(worker),true);
 assert.equal(worker.workMeal.siteId,project.id);assert.equal(project.inventory.pao,6);
 assert.equal(worker.workMeal.resumeState.task,'construction');
});
