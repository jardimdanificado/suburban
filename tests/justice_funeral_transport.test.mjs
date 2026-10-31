import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';
import {CityVehicles} from '../js/city_vehicles.js';

function fixture(){
 const c={id:1,accountId:'citizen:1',jobId:10,entity:{x:0,y:0,properties:{name:'Funcionário'}},path:[],needs:{health:90}},iml={id:10,type:'iml',active:true,accountId:'building:10',workers:[1],door:{x:20,y:0},balance:10000,wage:0,entity:{}},body={id:1,name:'Pessoa',citizenId:9,status:'waiting',entity:{x:10,y:0},position:{x:10,y:0}};
 let urgent=false,wages=0;const city={minute:100,buildings:[iml],politics:{mayorId:null},economy:{mayorId:null},currency:{price:value=>value},society:{citizen:id=>id===1?c:null},building:id=>id===10?iml:null,findPath:(start,goal)=>[{x:goal.x,y:goal.y}],urgentNeed:()=>urgent,payWage:()=>{wages++;return true;},log:()=>({id:1})};city.vehicles=new CityVehicles(city);city.vehicles.destinationParking=()=>null;const bike={id:1,good:'bicicleta_carga',active:true,condition:100,ownerAccountId:iml.accountId,x:0,y:0};city.vehicles.units.set(1,bike);const justice=new CityJustice(city);justice.bodies.push(body);
 const arrive=goal=>{c.entity.x=goal.x;c.entity.y=goal.y;bike.x=goal.x;bike.y=goal.y;bike.driverId=null;c.path=[];c.mobilityTrip=null;c.ridingVehicleId=null;};
 return {justice,city,c,iml,body,bike,arrive,setUrgent:value=>{urgent=value;},wages:()=>wages};
}

test('corpse stays at the death location until a reserved worker physically collects it',()=>{
 const {justice,c,iml,body,bike,arrive,wages}=fixture();assert.equal(justice.beginTransport(body,iml),true);assert.equal(c.funeralBodyId,1);assert.equal(bike.serviceBodyId,1);justice.updateFuneralWorker(c);justice.updateBody(body);assert.equal(body.entity.x,10);assert.equal(body.pickedUp,false);
 arrive(body.entity);justice.updateFuneralWorker(c);assert.equal(body.pickedUp,true);assert.equal(body.transportPhase,'delivery');justice.updateFuneralWorker(c);arrive({x:15,y:0});justice.updateBody(body);assert.equal(body.entity.x,15);assert.equal(body.status,'transporting');
 c.path=[{x:20,y:0}];justice.updateFuneralWorker(c);assert.equal(body.status,'transporting');arrive(iml.door);justice.updateFuneralWorker(c);assert.equal(body.status,'autopsy');assert.equal(body.entity.x,20);assert.equal(body.autopsyEndsAt,190);assert.equal(c.funeralBodyId,null);assert.equal(bike.serviceBodyId,null);assert.ok(wages()>0);
});

test('one employee and one bike cannot reserve two bodies simultaneously',()=>{
 const {justice,iml,body}=fixture();justice.beginTransport(body,iml);const other={id:2,status:'waiting',entity:{x:3,y:0}};justice.bodies.push(other);assert.equal(justice.beginTransport(other,iml),false);assert.equal(other.carrierId,undefined);
});

test('lack of cargo bicycle leaves a visible waiting body without inventing transport',()=>{
 const {justice,city,iml,body,c}=fixture();city.vehicles.units.clear();assert.equal(justice.beginTransport(body,iml),false);assert.equal(body.status,'waiting');assert.match(body.action,/bicicleta/);assert.equal(c.funeralBodyId,undefined);
});

test('urgent needs interrupt delivery and leave the body where the employee stopped',()=>{
 const {justice,c,iml,body,bike,arrive,setUrgent}=fixture();justice.beginTransport(body,iml);justice.updateFuneralWorker(c);arrive(body.entity);justice.updateFuneralWorker(c);c.entity.x=14;setUrgent(true);justice.updateFuneralWorker(c);assert.equal(body.entity.x,14);assert.equal(body.status,'waiting');assert.equal(c.funeralBodyId,null);assert.equal(bike.serviceBodyId,null);
});

test('interior and elevated deaths cannot be silently replaced by an external-door pickup',()=>{
 const {justice,iml,body}=fixture();body.originInterior={buildingId:20,floor:3,position:{x:10,y:0,z:9}};assert.equal(justice.beginTransport(body,iml),false);assert.equal(body.entity.x,10);assert.match(body.action,/interior/);body.originInterior=null;body.skybridgeZ=4;assert.equal(justice.beginTransport(body,iml),false);
});


test('the crematorium leg uses the same physical pickup and delivery reservation',()=>{
 const {justice,c,iml:crematorium,body,bike,arrive}=fixture();crematorium.type='crematorium';body.status='cremation-wait';body.autopsy={completedAt:50,cause:'velhice'};
 assert.equal(justice.beginTransport(body,crematorium,'crematorium'),true);justice.updateFuneralWorker(c);arrive(body.entity);justice.updateFuneralWorker(c);assert.equal(body.pickedUp,true);justice.updateFuneralWorker(c);arrive(crematorium.door);justice.updateFuneralWorker(c);assert.equal(body.status,'cremating');assert.equal(body.cremationEndsAt,220);assert.equal(body.autopsy.cause,'velhice');assert.equal(bike.serviceBodyId,null);
});

test('the IML and crematorium share their public cargo-bike fleet',()=>{
 const {justice,city,iml:crematorium,body,bike}=fixture(),iml={id:9,type:'iml',active:true,accountId:'building:9',workers:[],entity:{}};city.buildings.push(iml);crematorium.type='crematorium';body.status='cremation-wait';bike.ownerAccountId=iml.accountId;
 assert.equal(justice.beginTransport(body,crematorium,'crematorium'),true);assert.equal(body.vehicleId,bike.id);assert.equal(bike.serviceBodyId,body.id);
});
