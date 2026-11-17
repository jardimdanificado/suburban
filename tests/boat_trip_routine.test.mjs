import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';

test('a routine supply review does not interrupt a physical boat trip',()=>{
 const city=setup({starter:true,population:24});
 const c=city.citizens.find(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c));
 c.indoorLocation=null;c.deliveryId=null;c.conversation=null;c.workMeal=null;c.cleaningJobId=null;c.informalJobId=null;
 c.task='work';c.targetId=c.jobId;c.path=[{x:c.entity.x+1,y:c.entity.y,transportMode:'sail',boatClass:'canoe'}];
 c.localBoatTrip={boatId:987,task:c.task,targetId:c.targetId,position:{x:c.entity.x,y:c.entity.y},pickedUp:true};
 for(const key of Object.keys(c.needs))c.needs[key]=95;
 c.pocket={food:[],water:0};c.provisions=0;
 let reviewed=false;const route=city.supplies.route;
 city.supplies.route=function(person,...args){if(person===c){reviewed=true;return false;}return route.call(this,person,...args);};
 city.stepMinute();
 assert.equal(reviewed,false);assert.equal(c.task,'work');assert.equal(c.path[0]?.transportMode,'sail');
});
