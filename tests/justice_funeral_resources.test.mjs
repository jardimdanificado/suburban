import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';
import {CityVehicles} from '../js/city_vehicles.js';
import {CityEconomy} from '../js/city_economy.js';

function fixture(type='iml'){
 const worker={id:1,jobId:10,task:'work',entity:{properties:{name:'Servidor'}},path:[],indoorLocation:{buildingId:10,path:[]},skills:{forensics:50}},b={id:10,type,active:true,entity:{},workers:[1],width:3,depth:3,floors:1,inventory:{sabao:2,carvao:6}},city={minute:100,hour:10,buildings:[b],society:{citizen:id=>id===1?worker:null},building:id=>id===10?b:null,random:()=>.5,log:()=>({id:1}),economy:{consumed:{},recordGoods:()=>{},practice:()=>{}}};
 const justice=new CityJustice(city),body={id:1,citizenId:99,name:'Pessoa',diedAt:1,cause:'velhice',injuries:[],status:type==='iml'?'autopsy':'cremating',imlBuildingId:10,crematoriumId:10,locationBuildingId:10,entity:{x:0,y:0}};justice.bodies.push(body);return {justice,city,body,b,worker};
}

test('autopsy consumes one soap and requires ninety distinct staffed minutes',()=>{
 const {justice,city,body,b}=fixture();justice.updateBody(body);justice.updateBody(body);assert.equal(body.autopsyProgress,1);assert.equal(b.inventory.sabao,1);
 for(let i=1;i<90;i++){city.minute++;justice.updateBody(body);}assert.equal(body.status,'cremation-wait');assert.equal(city.economy.consumed.sabao,1);assert.equal(b.inventory.sabao,1);
});

test('cremation cannot finish for free or progress while its operator is absent',()=>{
 const {justice,city,body,b,worker}=fixture('crematorium');b.inventory.carvao=0;justice.updateBody(body);assert.equal(body.cremationProgress,undefined);assert.match(body.action,/insumos/);
 b.inventory.carvao=3;city.minute++;worker.indoorLocation=null;justice.updateBody(body);assert.equal(body.cremationProgress,undefined);assert.equal(b.inventory.carvao,3);
 worker.indoorLocation={buildingId:10,path:[]};for(let i=0;i<120;i++){city.minute++;justice.updateBody(body);}assert.equal(body.status,'cremated');assert.equal(body.entity.destroyed,true);assert.equal(b.inventory.carvao,0);assert.equal(city.economy.consumed.carvao,3);
});

test('one employee cannot advance two simultaneous procedures in the same minute',()=>{
 const {justice,city,body}=fixture();const other={...body,id:2,entity:{x:1,y:0}};justice.bodies.push(other);justice.updateBody(body);justice.updateBody(other);assert.equal(body.autopsyProgress,1);assert.equal(other.autopsyProgress,undefined);city.minute++;justice.updateBody(other);assert.equal(other.autopsyProgress,1);
});

test('storage reservations count inbound and waiting bodies without double counting',()=>{
 const {justice,b,body}=fixture();assert.equal(justice.funeralCapacity(b),3);assert.equal(justice.funeralOccupancy(b),1);justice.bodies.push({id:2,status:'transporting',destinationId:10},{id:3,status:'cremation-wait',locationBuildingId:10,imlBuildingId:10});assert.equal(justice.funeralOccupancy(b),3);
 const incoming={id:4,status:'waiting',entity:{x:1,y:0}};assert.equal(justice.beginTransport(incoming,b),false);assert.match(incoming.action,/vaga/);body.locationBuildingId=null;body.status='cremation-transporting';body.destinationId=11;assert.equal(justice.funeralOccupancy(b),2);
});

test('funeral services accept only their real procedure supplies',()=>{
 assert.equal(CityEconomy.prototype.accepts.call({}, {type:'iml'},'sabao'),true);assert.equal(CityEconomy.prototype.accepts.call({}, {type:'crematorium'},'carvao'),true);assert.equal(CityEconomy.prototype.accepts.call({}, {type:'crematorium'},'sabao'),false);
});


test('public funeral operators participate in purchase of real cargo bicycles',()=>{
 const iml={id:10,type:'iml',active:true,entity:{},accountId:'building:10',workers:[1,2,3]},shop={id:20,type:'cycle_shop',active:true,entity:{},accountId:'building:20'},city={minute:100,day:1,buildings:[iml,shop],citizens:[],economy:{businesses:[]},building:id=>id==='building:20'?shop:null};
 const vehicles=new CityVehicles(city),bike={id:1,good:'bicicleta_carga',active:false,holderAccountId:shop.accountId};vehicles.units.set(1,bike);vehicles.parkingReport=()=>({missing:0});vehicles.financeVehicle=(company,unit)=>company===iml&&unit===bike;let bought=false;vehicles.buyVehicle=(account,id)=>{assert.equal(account,iml.accountId);assert.equal(id,1);bike.active=true;bike.ownerAccountId=account;bought=true;return true;};vehicles.hourly();assert.ok(bought);
});
