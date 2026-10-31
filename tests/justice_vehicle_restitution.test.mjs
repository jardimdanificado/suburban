import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';
import {CityVehicles} from '../js/city_vehicles.js';
import {setup,putAtWorkCell} from './helpers/city.mjs';
import {CityStateGraph,bindCityState} from '../js/city_state.js';

function fixture(){
  const officer={id:3,accountId:'citizen:3',jobId:10,task:'work',entity:{x:1,y:1,properties:{name:'Agente'}},path:[],businessIds:[],indoorLocation:{buildingId:10,path:[]}},owner={id:2,accountId:'citizen:2',entity:{x:12,y:1,properties:{name:'Dono'}},path:[],businessIds:[]};
  const station={id:10,type:'police_station',active:true,entity:{properties:{name:'Delegacia'}},door:{x:1,y:1},workers:[3]},record={id:7,type:'bicycleTheft',status:'convicted',victimId:2,details:{vehicleId:5}};
  const city={minute:100,hour:12,world:{width:32,height:32,getTile:()=>10},citizens:[owner,officer],buildings:[station],society:{citizen:id=>city.citizens.find(c=>c.id===id)},building:id=>id===10?station:null,findPath:(_from,to)=>[{x:to.x,y:to.y}],urgentNeed:()=>false,payWage:()=>true,log:()=>({id:1}),fail:()=>false};
  city.justice=new CityJustice(city);city.justice.cases.push(record);city.vehicles=new CityVehicles(city);
  const vehicle={id:5,active:true,good:'bicicleta',condition:90,x:5,y:1,entity:{x:5,y:1},ownerAccountId:owner.accountId,possessorAccountId:'citizen:1',theft:{caseId:7},ownershipHistory:[]};city.vehicles.units.set(5,vehicle);city.vehicles.activeCount=1;
  return {city,justice:city.justice,officer,owner,station,record,vehicle};
}
function walk(city,c){assert.ok(c.path.length);for(const point of c.path){c.entity.x=point.x;c.entity.y=point.y;city.vehicles.update(.1);}c.path=[];city.minute++;}
function collect(f){f.justice.updateRestitutionMissions();f.officer.indoorLocation=null;f.justice.updatePoliceRestitution(f.officer);walk(f.city,f.officer);f.justice.updatePoliceRestitution(f.officer);}

test('police reach the vehicle, move it physically, deliver without changing title and return',()=>{
  const f=fixture(),{city,justice,officer,owner,record,vehicle}=f;collect(f);assert.equal(vehicle.policeRecoveryOfficerId,3);assert.equal(vehicle.x,5);assert.equal(vehicle.ownerAccountId,owner.accountId);
  justice.updatePoliceRestitution(officer);assert.equal(vehicle.x,5);walk(city,officer);assert.equal(vehicle.x,12);justice.updatePoliceRestitution(officer);
  assert.equal(record.vehicleRecovery.status,'returned');assert.equal(vehicle.policeRecoveryOfficerId,null);assert.equal(vehicle.ownerAccountId,owner.accountId);assert.equal(vehicle.ownershipHistory.length,0);
  justice.updatePoliceRestitution(officer);walk(city,officer);justice.updatePoliceRestitution(officer);assert.equal(officer.policeRestitution,null);assert.equal(vehicle.x,12);assert.equal(officer.entity.x,1);
});

test('interrupted transport leaves the bike where it reached and releases exclusive possession',()=>{
  const f=fixture();collect(f);f.officer.entity.x=7;f.city.vehicles.update(.1);assert.equal(f.vehicle.x,7);
  f.justice.pauseVehicleRestitution(f.officer,'necessidade urgente');f.officer.task='supplies';f.officer.entity.x=10;f.city.vehicles.update(.1);
  assert.equal(f.vehicle.x,7);assert.equal(f.vehicle.policeRecoveryOfficerId,null);assert.equal(f.officer.policeRestitution.phase,'to-vehicle');assert.equal(f.record.vehicleRecovery.status,'in-progress');
});

test('occupied bikes and missing officers wait without moving or manufacturing a vehicle',()=>{
  const f=fixture();f.vehicle.driverId=9;f.justice.updateRestitutionMissions();assert.match(f.record.vehicleRecovery.waitingReason,/em uso|aguardando parada/);assert.equal(f.officer.policeRestitution,undefined);
  f.vehicle.driverId=null;f.station.workers=[];f.justice.updateRestitutionMissions();assert.match(f.record.vehicleRecovery.waitingReason,/policial/);assert.equal(f.vehicle.x,5);assert.equal(f.city.vehicles.units.size,1);
});

test('death of the assigned officer frees the bike and leaves a visible pending return',()=>{
  const f=fixture();collect(f);f.officer.entity.x=7;f.city.vehicles.update(.1);f.officer.entity.destroyed=true;
  f.justice.updateRestitutionMissions();assert.equal(f.vehicle.policeRecoveryOfficerId,null);assert.equal(f.vehicle.x,7);assert.equal(f.officer.policeRestitution,null);assert.equal(f.record.vehicleRecovery.status,'awaiting-officer');assert.match(f.record.vehicleRecovery.waitingReason,/policial/);
});

test('lack of wages pauses transportation and a later payment can resume it',()=>{
  const f=fixture();collect(f);f.city.minute++;f.city.payWage=()=>false;f.justice.updatePoliceRestitution(f.officer);assert.equal(f.vehicle.policeRecoveryOfficerId,null);assert.match(f.record.vehicleRecovery.waitingReason,/salarial/);
  f.city.minute++;f.city.payWage=()=>true;f.justice.updatePoliceRestitution(f.officer);assert.equal(f.vehicle.policeRecoveryOfficerId,3);assert.equal(f.officer.policeRestitution.phase,'to-owner');
});

test('worker snapshots retain the shared vehicle mission and interruption releases its reservation',()=>{
  const city=setup({starter:true,population:32}),officer=city.citizens[0],vehicle=[...city.vehicles.units.values()].find(v=>v.active);assert.ok(vehicle);
  const mission={kind:'vehicle',caseId:9001,vehicleId:vehicle.id,officerId:officer.id,phase:'to-owner',status:'in-progress'};officer.policeRestitution=mission;vehicle.policeRecoveryOfficerId=officer.id;vehicle.policeRecoveryOffset={x:.2,y:0};
  city.justice.cases.push({id:9001,type:'bicycleTheft',status:'convicted',details:{vehicleId:vehicle.id},vehicleRecovery:{status:'in-progress',mission}});
  const sender=new CityStateGraph(),receiver=new CityStateGraph(),restored=receiver.apply(sender.encode({city}));bindCityState(restored.city);const copy=restored.city;
  assert.equal(copy.society.citizen(officer.id).policeRestitution,copy.justice.cases.at(-1).vehicleRecovery.mission);assert.equal(copy.vehicles.units.get(vehicle.id).policeRecoveryOfficerId,officer.id);
  city.justice.pauseVehicleRestitution(officer,'pausa');bindCityState(receiver.apply(sender.encode({city})).city);assert.equal(copy.vehicles.units.get(vehicle.id).policeRecoveryOfficerId,null);assert.equal(copy.justice.cases.at(-1).vehicleRecovery.mission.phase,'to-vehicle');
});

test('CitySimulation moves the recovered bike with an officer through the full return mission',()=>{
  const city=setup({starter:true,population:32});let station;for(const site of city.economy.locateBuilding('police_station')){station=city.addBuilding('police_station',site.x,site.y,{...site,free:true});if(station)break;}assert.ok(station);
  const [owner,officer]=city.citizens.filter(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c)&&Math.min(c.needs.food,c.needs.water,c.needs.energy,c.needs.health,c.needs.toilet)>65).slice(0,2);assert.ok(owner&&officer);
  const points=[];for(let r=3;r<12&&points.length<2;r++)for(let dx=-r;dx<=r&&points.length<2;dx++){const p={x:Math.floor(station.door.x)+dx+.5,y:Math.floor(station.door.y)+r+.5};if(city.walkable(Math.floor(p.x),Math.floor(p.y))&&city.findPath(station.door,p)!==null)points.push(p);}assert.equal(points.length,2);
  city.economy.leaveJob(owner,'Teste');owner.indoorLocation=null;owner.path=[];owner.task=null;Object.assign(owner.entity,points[1]);
  city.economy.leaveJob(officer,'Designação');officer.jobId=station.id;station.workers=[officer.id];city.transfer('treasury',station.accountId,100000,'Verba policial');Object.assign(officer.needs,{food:100,water:100,energy:100,health:100,toilet:100,hygiene:100});putAtWorkCell(city,officer,station);
  const vehicle={id:9001,active:true,good:'bicicleta',condition:90,...points[0],entity:city.createEntity({...points[0],properties:{}}),ownerAccountId:owner.accountId,theft:{caseId:9001}};city.vehicles.units.set(vehicle.id,vehicle);city.vehicles.activeCount++;
  const record={id:9001,type:'bicycleTheft',status:'convicted',victimId:owner.id,details:{vehicleId:vehicle.id},rule:{fine:0},severity:45};city.justice.cases.push(record);city.minute=600;city.justice.updateRestitutionMissions();assert.ok(officer.policeRestitution);
  const origin=vehicle.x;let moved=false;for(let i=0;i<900&&officer.policeRestitution;i++){city.update(.25);moved ||= Math.abs(vehicle.x-origin)>.2;}
  assert.ok(moved);assert.equal(record.vehicleRecovery.status,'returned');assert.equal(officer.policeRestitution,null);assert.equal(vehicle.ownerAccountId,owner.accountId);assert.equal(vehicle.policeRecoveryOfficerId,null);
});
