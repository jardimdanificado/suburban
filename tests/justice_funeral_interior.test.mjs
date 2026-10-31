import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';
import {CityVehicles} from '../js/city_vehicles.js';
import {advanceCitizenInterior,syncCitizenInterior} from '../js/city_interiors.js';
import {CITY_FLOOR_HEIGHT} from '../js/city_building_geometry.js';

function fixture(){
 const source={id:20,type:'residential',active:true,entity:{x:10,y:10},width:3,depth:3,floors:3,units:[],circulation:[],door:{x:11.5,y:13.5},layoutRevision:1};
 const iml={id:10,type:'iml',active:true,entity:{},accountId:'building:10',workers:[1],door:{x:20,y:0},balance:10000,wage:0},c={id:1,jobId:10,accountId:'citizen:1',entity:{x:0,y:0,properties:{name:'Funcionário'}},needs:{health:90},path:[]};
 const interior={buildingId:20,unitId:null,floor:2,position:{x:10.5,y:10.5,z:CITY_FLOOR_HEIGHT*2}},body={id:1,name:'Pessoa',citizenId:9,status:'waiting',entity:{x:10.5,y:10.5},originInterior:{...interior,position:{...interior.position}},currentInterior:interior};
 let urgent=false;const city={minute:100,buildings:[iml,source],units:new Map(),politics:{mayorId:null},economy:{mayorId:null},currency:{price:value=>value},society:{citizen:id=>id===1?c:null},building:id=>id===10?iml:id===20?source:null,findPath:(a,b)=>[{x:b.x,y:b.y}],urgentNeed:()=>urgent,payWage:()=>true,log:()=>({id:1}),createEntity:data=>({...data,destroyed:false})};city.vehicles=new CityVehicles(city);city.vehicles.destinationParking=()=>null;const bike={id:1,active:true,good:'bicicleta_carga',ownerAccountId:iml.accountId,condition:100,x:0,y:0};city.vehicles.units.set(1,bike);const justice=new CityJustice(city);justice.bodies.push(body);
 const arriveOutside=point=>{c.entity.x=bike.x=point.x;c.entity.y=bike.y=point.y;c.path=[];c.mobilityTrip=null;c.ridingVehicleId=null;bike.driverId=null;};
 const enter=()=>{justice.beginTransport(body,iml);justice.updateFuneralWorker(c);arriveOutside(source.door);justice.updateFuneralWorker(c);};
 const tick=()=>{city.minute++;advanceCitizenInterior(city,c,.5);justice.updateFuneralWorker(c);justice.updateBody(body);};
 return {justice,city,source,iml,c,body,bike,enter,tick,arriveOutside,setUrgent:v=>{urgent=v;}};
}

test('upper-floor pickup follows actual internal routes before bicycle delivery',()=>{
 const {justice,city,source,iml,c,body,enter,tick,arriveOutside}=fixture();enter();assert.equal(body.transportPhase,'interior-collect');assert.equal(body.pickedUp,false);assert.equal(c.indoorLocation.position.z,0);assert.equal(body.currentInterior.position.z,CITY_FLOOR_HEIGHT*2);syncCitizenInterior(city,c);assert.equal(c.indoorLocation.exiting,undefined);
 let carriedAboveGround=false;for(let i=0;i<200&&body.transportPhase!=='delivery';i++){tick();if(body.pickedUp&&body.currentInterior?.position.z>0)carriedAboveGround=true;}
 assert.ok(carriedAboveGround);assert.equal(body.transportPhase,'delivery');assert.equal(c.indoorLocation,null);assert.equal(body.currentInterior,null);assert.equal(body.entity.x,source.door.x);assert.equal(body.entity.y,source.door.y);assert.equal(body.status,'transporting');
 justice.updateFuneralWorker(c);arriveOutside(iml.door);justice.updateFuneralWorker(c);assert.equal(body.status,'autopsy');assert.equal(body.originInterior.floor,2);
});

test('interrupted internal extraction preserves the body at the current stair position',()=>{
 const {justice,c,body,enter,tick,setUrgent}=fixture();enter();for(let i=0;i<100&&!body.pickedUp;i++)tick();assert.equal(body.pickedUp,true);tick();const current={...c.indoorLocation.position};setUrgent(true);justice.updateFuneralWorker(c);
 assert.equal(body.status,'waiting');assert.equal(body.currentInterior.position.x,current.x);assert.equal(body.currentInterior.position.z,current.z);assert.equal(body.entity.x,current.x);assert.equal(c.funeralInterior,false);assert.equal(body.originInterior.floor,2);
});

test('death registration keeps the actual internal position and an independent scene snapshot',()=>{
 const {justice,c,body}=fixture();c.indoorLocation={...body.originInterior,position:{...body.originInterior.position}};const corpse=justice.registerDeath(c,{name:'Pessoa',age:80,minute:100,cause:'velhice',position:{...c.indoorLocation.position}});
 assert.equal(corpse.entity.x,10.5);assert.equal(corpse.entity.y,10.5);assert.equal(corpse.currentInterior.position.z,CITY_FLOOR_HEIGHT*2);c.indoorLocation.position.z=0;assert.equal(corpse.currentInterior.position.z,CITY_FLOOR_HEIGHT*2);
});
