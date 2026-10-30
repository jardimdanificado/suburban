import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';
import {setup,putAtWorkCell} from './helpers/city.mjs';

function fixture(){
 const officer={id:3,accountId:'citizen:3',jobId:10,task:'work',entity:{x:.5,y:.5,properties:{name:'Agente'}},needs:{health:90},path:[],inventory:{}};
 const suspect={id:1,accountId:'citizen:1',entity:{x:5.5,y:.5,properties:{name:'Suspeito'}},inventory:{madeira:2},path:[]};
 const owner={id:2,accountId:'citizen:2',entity:{x:9.5,y:.5,properties:{name:'Vítima'}},inventory:{madeira:0},path:[]};
 const station={id:10,type:'police_station',active:true,entity:{x:0,y:0,destroyed:false,properties:{name:'Delegacia'}},door:{x:.5,y:.5},workers:[3],jobs:1};
 const accounts=new Map([[officer.accountId,{balance:1000}],[suspect.accountId,{balance:1000}],[owner.accountId,{balance:1000}],[station.accountId,{balance:1000}]]);
 const city={minute:1000,day:0,hour:16,citizens:[officer,suspect,owner],buildings:[station],accounts,units:new Map(),society:{citizen:id=>[officer,suspect,owner].find(c=>c.id===id),isAdult:()=>true},building:id=>id===station.id?station:null,urgentNeed:()=>false,payWage:()=>true,findPath:(_from,to)=>[{x:to.x,y:to.y}],log:()=>({id:1}),transfer(from,to,amount){const a=accounts.get(from),b=accounts.get(to);if(!a||!b||!Number.isFinite(amount)||amount<=0||a.balance<amount)return false;a.balance-=amount;b.balance+=amount;return true;}};
 city.society.citizen=id=>city.citizens.find(c=>c.id===id);
 const justice=new CityJustice(city);city.justice=justice;
 const record={id:7,type:'theft',status:'convicted',chargedCitizenId:suspect.id,offenderId:suspect.id,ownerId:owner.id,rule:{fine:0,fineOnly:false},stolenAsset:{kind:'item',good:'madeira',quantity:2,recovered:0,holderId:suspect.id,ownerId:owner.id,recoveryStatus:'awaiting-physical-return'}};
 justice.cases.push(record);officer.indoorLocation={buildingId:station.id,unitId:1,position:{x:.5,y:.5},path:[]};return {city,justice,station,officer,suspect,owner,record};
}
function followPath(c){assert.ok(c.path.length,'movement must follow an assigned physical route');for(const point of c.path){c.entity.x=point.x;c.entity.y=point.y;}c.path=[];}

test('police physically collect stolen goods, deliver them to the victim and return to their station',()=>{
 const {city,justice,station,officer,suspect,owner,record}=fixture();justice.updateRestitutionMissions();const mission=officer.policeRestitution;assert.ok(mission);assert.equal(mission.phase,'to-suspect');assert.equal(suspect.inventory.madeira,2);assert.equal(owner.inventory.madeira,0);
 officer.indoorLocation=null;justice.updatePoliceRestitution(officer);followPath(officer);justice.updatePoliceRestitution(officer);assert.equal(mission.phase,'to-owner');assert.equal(suspect.inventory.madeira,0);assert.equal(officer.inventory.madeira,2);assert.equal(owner.inventory.madeira,0);assert.equal(record.stolenAsset.recoveryStatus,'in-transit');
 justice.updatePoliceRestitution(officer);followPath(officer);justice.updatePoliceRestitution(officer);assert.equal(mission.phase,'return');assert.equal(officer.inventory.madeira,0);assert.equal(owner.inventory.madeira,2);assert.equal(record.stolenAsset.recoveryStatus,'returned');assert.equal(record.stolenAsset.holderId,owner.id);
 justice.updatePoliceRestitution(officer);followPath(officer);justice.updatePoliceRestitution(officer);assert.equal(officer.policeRestitution,null);assert.equal(officer.task,'work');assert.equal(officer.entity.x,station.door.x);
});

test('a missing stolen item is not recreated or transferred by the courier',()=>{
 const {justice,officer,suspect,owner,record}=fixture();suspect.inventory.madeira=0;justice.updateRestitutionMissions();officer.indoorLocation=null;justice.updatePoliceRestitution(officer);followPath(officer);justice.updatePoliceRestitution(officer);assert.equal(record.stolenAsset.recoveryStatus,'unavailable');assert.equal(officer.inventory.madeira,undefined);assert.equal(owner.inventory.madeira,0);assert.match(officer.policeRestitution.waitingReason,/não está mais/);
});

test('restitution waits visibly when no police employee is available',()=>{
 const {city,justice,station,officer,suspect,owner,record}=fixture();station.workers=[];justice.updateRestitutionMissions();assert.equal(officer.policeRestitution,undefined);assert.equal(suspect.inventory.madeira,2);assert.equal(owner.inventory.madeira,0);assert.equal(record.stolenAsset.holderId,suspect.id);assert.match(record.stolenAsset.recoveryWaitingReason,/policial disponível/);
});

test('a stolen meal travels with the officer and returns with its original provenance',()=>{
 const {justice,officer,suspect,owner,record}=fixture(),meal={good:'marmita',ingredients:{arroz:2},packedAt:123,stolenCaseId:7};suspect.pocket={food:[meal],water:0};owner.pocket={food:[],water:0};record.stolenAsset={kind:'meal',meal,quantity:1,recovered:0,holderId:suspect.id,ownerId:owner.id,recoveryStatus:'awaiting-physical-return'};
 justice.updateRestitutionMissions();officer.indoorLocation=null;justice.updatePoliceRestitution(officer);followPath(officer);justice.updatePoliceRestitution(officer);assert.equal(suspect.pocket.food.length,0);assert.equal(officer.pocket.food[0],meal);
 justice.updatePoliceRestitution(officer);followPath(officer);justice.updatePoliceRestitution(officer);assert.equal(owner.pocket.food[0],meal);assert.equal(meal.stolenCaseId,undefined);assert.deepEqual(meal.ingredients,{arroz:2});assert.equal(meal.packedAt,123);assert.equal(record.stolenAsset.recoveryStatus,'returned');
});

test('CitySimulation physically moves a restitution officer from the station to both people and back',()=>{
 const city=setup({starter:true,population:32});let station;
 for(const site of city.economy.locateBuilding('police_station')){station=city.addBuilding('police_station',site.x,site.y,{...site,free:true});if(station)break;}assert.ok(station);
 const [suspect,owner]=city.citizens.filter(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c)).slice(0,2),officer=city.citizens.find(c=>c!==suspect&&c!==owner&&city.society.isAdult(c)&&!city.politics.officeHolder(c)&&Math.min(c.needs.food,c.needs.water,c.needs.energy,c.needs.health,c.needs.toilet)>65);assert.ok(suspect&&owner&&officer);
 for(const c of [suspect,owner]){if(c.jobId)city.economy.leaveJob(c,'Teste de restituição');c.indoorLocation=null;c.path=[];c.task=null;c.needs.food=100;c.needs.water=100;c.needs.energy=100;c.needs.health=100;c.needs.toilet=100;}
 const point=(radius)=>{for(let r=radius;r<radius+5;r++)for(let dx=-r;dx<=r;dx++)for(const dy of [r-Math.abs(dx),-(r-Math.abs(dx))]){const x=Math.floor(station.door.x)+dx,y=Math.floor(station.door.y)+dy,p={x:x+.5,y:y+.5};if(x>=0&&y>=0&&x<city.world.width&&y<city.world.height&&city.walkable(x,y)&&city.findPath(station.door,p)!==null)return p;}return null;},a=point(3),b=point(7);assert.ok(a&&b);
 Object.assign(suspect.entity,a);Object.assign(owner.entity,b);suspect.inventory??={};suspect.inventory.madeira=2;owner.inventory??={};owner.inventory.madeira=0;
 city.economy.leaveJob(officer,'Designação policial de restituição');officer.jobId=station.id;station.workers=[officer.id];city.transfer('treasury',station.accountId,100000,'Orçamento da missão policial');Object.assign(officer.needs,{food:100,water:100,energy:100,health:100,toilet:100,hygiene:100});putAtWorkCell(city,officer,station);
 const record={id:900,type:'theft',status:'convicted',chargedCitizenId:suspect.id,offenderId:suspect.id,rule:{fine:0,fineOnly:false},severity:40,stolenAsset:{kind:'item',good:'madeira',quantity:2,recovered:0,holderId:suspect.id,ownerId:owner.id,recoveryStatus:'awaiting-physical-return'}};city.justice.cases.push(record);city.minute=600;city.justice.lastMinute=599;city.justice.updateRestitutionMissions();assert.ok(officer.policeRestitution);
 const origin={x:officer.entity.x,y:officer.entity.y};let moved=false,sawPropertyInTransit=false;
 for(let i=0;i<800&&officer.policeRestitution;i++){city.update(.25);moved ||= Math.hypot(officer.entity.x-origin.x,officer.entity.y-origin.y)>1;if(record.stolenAsset.recoveryStatus==='in-transit'){sawPropertyInTransit=true;assert.equal(suspect.inventory.madeira,0);assert.equal(owner.inventory.madeira,0);assert.equal(officer.inventory.madeira,2);}}
 assert.equal(record.stolenAsset.recoveryStatus,'returned');assert.ok(moved);assert.ok(sawPropertyInTransit);assert.equal(suspect.inventory.madeira,0);assert.equal(owner.inventory.madeira,2);assert.equal(officer.inventory.madeira||0,0);assert.equal(officer.policeRestitution,null);assert.equal(officer.task,'work');
});
