import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';

function fixture(){
 const c={id:1,entity:{x:0,y:0},needs:{health:80,hygiene:10},mood:0},body={id:1,citizenId:2,diedAt:0,status:'waiting',entity:{x:0,y:0},injuries:[]},city={minute:7*1440,citizens:[c],buildings:[],society:{citizen:id=>id===1?c:null},log:()=>({id:1}),random:()=>.5};const justice=new CityJustice(city);justice.bodies.push(body);return {justice,city,c,body};
}

test('decomposition degrades preservation but never removes an uncollected corpse',()=>{
 const {justice,body}=fixture();justice.decayBody(body);assert.equal(body.decomposition,100);assert.ok(body.evidenceIntegrity>=.2);assert.equal(body.status,'waiting');assert.equal(body.entity.destroyed,undefined);assert.equal(justice.bodies.length,1);
});

test('exposure is rate limited and aggregate effects from many bodies are bounded',()=>{
 const {justice,city,c,body}=fixture();for(let i=2;i<50;i++)justice.bodies.push({...body,id:i,entity:{x:0,y:0}});justice.updateCorpseExposure();assert.equal(c.corpseExposure,100);assert.equal(c.needs.hygiene,9.4);assert.equal(c.needs.health,79.97);justice.updateCorpseExposure();assert.equal(c.needs.hygiene,9.4);
 city.minute+=30;c.entity.x=20;justice.updateCorpseExposure();assert.equal(c.corpseExposure,0);assert.equal(c.needs.hygiene,9.4);
});

test('interior bodies affect the same room and floor rather than street passersby',()=>{
 const {justice,c,body}=fixture();body.currentInterior={buildingId:10,unitId:20,floor:2,position:{x:0,y:0,z:3.6}};justice.updateCorpseExposure();assert.equal(c.needs.hygiene,10);
 justice.city.minute+=30;c.indoorLocation={buildingId:10,unitId:20,floor:1,position:{x:0,y:0,z:1.8}};justice.updateCorpseExposure();assert.equal(c.needs.hygiene,10);
 justice.city.minute+=30;c.indoorLocation.floor=2;c.indoorLocation.position.z=3.6;justice.updateCorpseExposure();assert.ok(c.needs.hygiene<10);
});

test('contained storage and cremated remains do not expose exterior residents',()=>{
 const {justice,c,body,city}=fixture();body.locationBuildingId=10;justice.updateCorpseExposure();assert.equal(c.needs.hygiene,10);body.locationBuildingId=null;body.status='cremated';city.minute+=30;justice.updateCorpseExposure();assert.equal(c.needs.hygiene,10);
});

test('fresh remains do not immediately impose sanitation penalties',()=>{
 const {justice,c,body,city}=fixture();body.diedAt=city.minute;justice.updateCorpseExposure();assert.equal(c.needs.hygiene,10);assert.equal(c.needs.health,80);assert.equal(body.decomposition,0);
});


test('legacy interior corpse metadata is restored before computing outdoor exposure',()=>{
 const {justice,c,body}=fixture();body.originInterior={buildingId:10,unitId:20,floor:1,position:{x:2,y:2,z:1.8}};justice.updateCorpseExposure();assert.equal(c.needs.hygiene,10);assert.equal(body.currentInterior.buildingId,10);assert.equal(body.entity.x,2);assert.equal(body.currentInterior.position.z,1.8);
});
