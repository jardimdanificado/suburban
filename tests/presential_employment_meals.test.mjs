import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,finishActivityRoute} from './helpers/city.mjs';
import {career,discoverVacancies,reviewMarket,apply,routeToInterview,advanceRecruitment} from '../js/city_employment.js';
import {syncCitizenInterior,advanceCitizenInterior} from '../js/city_interiors.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';

function fixture(){
 const city=setup({starter:true,population:48}),b=city.buildings.find(b=>b.type==='builder');
 const people=city.citizens.filter(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c)&&!c.businessIds.length).slice(0,8);
 city.economy.recruitmentQueue=[];
 for(const c of people){city.economy.leaveJob(c);c.career={jobs:[],applications:[],worked:{},motivation:50};c.needs=Object.fromEntries(Object.keys(c.needs).map(k=>[k,95]));c.indoorLocation=null;c.workCell=null;c.conversation=null;}
 b.hiringPolicy={minSkill:0,minExperienceMinutes:0,minRating:0,allowTraining:true};b.jobs=1;b.workers=[];
 return {city,b,people,c:people[0]};
}
function attend(city,c,b,a){
 city.minute=a.interviewAt-20;c.entity.x=b.door.x;c.entity.y=b.door.y;assert(routeToInterview(city,c));finishActivityRoute(city,c);
 assert.equal(c.indoorLocation.buildingId,b.id);
}

test('initial offices initialize the real cycle supply chain without a missing constant',()=>{
 const {city}=fixture();assert(city.buildings.some(b=>b.initialCycleChain));assert(city.buildings.some(b=>b.officeTenantOf&&b.active));
});
test('vacancies are discovered locally; waiting candidates keep a normal routine',()=>{
 const {city,b,c}=fixture();c.entity.x=1.5;c.entity.y=1.5;discoverVacancies(city,c,true);
 assert(!(career(c).knownVacancies||[]).some(v=>v.buildingId===b.id));reviewMarket(city,[b]);assert.equal(career(c).applications.length,0);
 c.entity.x=b.door.x;c.entity.y=b.door.y;discoverVacancies(city,c,true);assert(career(c).knownVacancies.some(v=>v.buildingId===b.id));career(c).nextSearchAt=0;reviewMarket(city,[b]);
 const a=career(c).pendingInterview;assert(a);assert(a.interviewAt>=city.minute+60);assert.equal(c.jobId,null);
 city.chooseTask(c);assert.equal(c.task,'walk');assert(c.path.length>0);assert.equal(a.status,'análise');
});
test('an absent candidate is dismissed on time and an attending candidate receives the result onsite',()=>{
 const {city,b,people}=fixture(),[present,absent]=people;
 absent.skills[city.economy.jobSkill(b)]=100;present.skills[city.economy.jobSkill(b)]=0;
 for(const c of [present,absent]){c.entity.x=b.door.x;c.entity.y=b.door.y;apply(city,c,b);}
 const a=career(present).pendingInterview,missing=career(absent).pendingInterview;assert.equal(a.interviewAt,missing.interviewAt);
 attend(city,present,b,a);city.minute=a.interviewAt;advanceRecruitment(city);
 assert.equal(missing.status,'reprovado');assert.match(missing.reason,/Não compareceu/);assert.equal(a.status,'análise');assert.equal(present.jobId,null);
 city.minute=a.decideAt;advanceRecruitment(city);assert.equal(a.status,'aprovado');assert.equal(present.jobId,b.id);assert.equal(a.resultBuildingId,b.id);assert.equal(a.resultReceivedAt,city.minute);assert.equal(present.indoorLocation.buildingId,b.id);
});
test('leaving before the result forfeits the selection instead of receiving remote approval',()=>{
 const {city,b,c}=fixture();c.entity.x=b.door.x;c.entity.y=b.door.y;const a=apply(city,c,b);attend(city,c,b,a);city.minute=a.interviewAt;advanceRecruitment(city);
 c.task='food';c.targetId=null;c.indoorLocation=null;city.minute++;advanceRecruitment(city);assert.equal(a.status,'reprovado');assert.match(a.reason,/Saiu da seleção/);assert.equal(c.jobId,null);
});
test('appointments and known vacancy memories survive worker snapshots',()=>{
 const {city,b,c}=fixture();c.entity.x=b.door.x;c.entity.y=b.door.y;discoverVacancies(city,c,true);const a=apply(city,c,b);
 const writer=new CityStateGraph(),reader=new CityStateGraph(),root=reader.apply(writer.encode({city}));bindCityState(root.city);
 const copy=root.city.society.citizen(c.id);assert.equal(copy.career.pendingInterview.interviewAt,a.interviewAt);assert(copy.career.knownVacancies.some(v=>v.buildingId===b.id));assert(root.city.economy.recruitmentQueue.some(q=>q.application===copy.career.pendingInterview));
});
test('a company without a full refectory never strands employees in a dining task',()=>{
 const {city,b,c}=fixture();c.jobId=b.id;b.workers=[c.id];b.inventory.pao=9;c.needs.food=30;c.task='work';c.targetId=b.id;c.entity.x=b.door.x;c.entity.y=b.door.y;
 assert.equal(city.workMeals.hasFullDiningFloor(b),false);assert.equal(city.workMeals.tryStart(c),false);assert.equal(c.task,'work');assert.equal(b.inventory.pao,9);
 c.task='workmeal';syncCitizenInterior(city,c);assert.equal(c.task,null);
});
test('workplace meals queue by arrival, advance when seats free, and consume food only at a seat',()=>{
 const {city,b,people}=fixture(),[first,second,...occupants]=people;
 for(const u of b.units)u.roomType='workspace';assert(city.setWorkplaceDiningFloor(b.id,b.officeFloor,true));assert(city.workMeals.hasFullDiningFloor(b));b.inventory.pao=30;b.workers=[first.id,second.id];
 for(const c of [first,second]){c.jobId=b.id;c.needs.food=30;c.task='work';c.targetId=b.id;c.entity.x=b.door.x;c.entity.y=b.door.y;}
 const room=b.units[0],blockers=city.citizens.filter(c=>c!==first&&c!==second).slice(0,b.units.length*4);assert.equal(blockers.length,b.units.length*4);
 for(const [i,u] of b.units.entries()){const group=blockers.slice(i*4,i*4+4);u.activityReservedIds=group.map(c=>c.id);for(const c of group)c.indoorLocation={buildingId:b.id,targetUnitId:u.id,unitId:u.id,targetRoomType:'dining',roomType:'dining',path:[],exiting:false};}
 for(const c of [first,second]){assert(city.workMeals.tryStart(c));assert(!c.workMeal);}
 assert.equal(b.inventory.pao,30);const entrance=city.building(b.officeTenantOf)||b;const tickets=entrance.serviceQueue.filter(q=>q.kind==='workmeal');assert.deepEqual(tickets.map(q=>q.citizenId),[first.id,second.id]);assert.notEqual(tickets[0].slot,tickets[1].slot);
 blockers[0].indoorLocation=null;second.path=[];second.entity.x=b.door.x;second.entity.y=b.door.y;city.workMeals.tryStart(second);assert(!second.workMeal);
 first.path=[];first.entity.x=b.door.x;first.entity.y=b.door.y;city.workMeals.tryStart(first);advanceCitizenInterior(city,first,1000);first.path=[];city.workMeals.tryStart(first);
 assert(first.workMeal);assert.equal(b.inventory.pao,27);assert(!second.workMeal);assert(entrance.serviceQueue.some(q=>q.citizenId===second.id));
});
