import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney,ensureBusiness} from './helpers/city.mjs';
import {productionPlan,investProductionPlan} from '../js/city_production_planner.js';
import {reviewMarket,reviewWages} from '../js/city_employment.js';
import {advanceCitizenInterior} from '../js/city_interiors.js';

function pendingFactory(city,type,id,{funded=true}={}){
 const project={id,type,service:'building',status:'materials',productionChain:true,accountId:'treasury',inventory:{pedra:0},incoming:{},stone:18,requiredLabor:180,labor:0,startedAt:city.minute};
 if(funded)project.materialAccountId=`funded:${id}`;
 city.development.projects.push(project);return project;
}

test('a full factory pipeline still opens an immediately usable farm for unmet demand',()=>{
 const city=setup({starter:true,population:24}),money=totalMoney(city),seeds=city.economy.initialStock.sementes;
 pendingFactory(city,'charcoal','queue:1');pendingFactory(city,'paper_mill','queue:2');
 city.economy.demands=[{type:'farm',crop:'cana',score:120,reason:'Cana para as bebidas locais'}];
 assert(investProductionPlan(city.economy));
 assert(city.economy.businesses.some(b=>b.type==='farm'&&b.active));
 assert.equal(totalMoney(city)+(city.economy.initialStock.sementes-seeds)*city.economy.goods.sementes.price,money);
});

test('full pipelines recover an unfunded factory before checking the limit on new buildings',()=>{
 const city=setup({starter:true,population:24}),project=pendingFactory(city,'charcoal','queue:1',{funded:false});pendingFactory(city,'paper_mill','queue:2');
 city.economy.demands=[{type:'charcoal',score:120,reason:'Combustível necessário'}];
 assert(investProductionPlan(city.economy));assert(project.materialAccountId);assert(city.accounts.get(project.materialAccountId).balance>0);
});

test('hemp manufacturing identifies the dual crop farm as a missing upstream stage',()=>{
 const city=setup({starter:true,population:24});city.economy.demands=[{type:'hemp_weaver',score:120,reason:'Fibra necessária'}];
 const plan=productionPlan(city.economy);assert(plan.some(r=>r.type==='farm'&&r.crop==='flor_cannabis'));assert(plan.find(r=>r.type==='hemp_weaver').blockedInputs.includes('canhamo'));
});

test('a hemp ban switches fiber demand to ordinary fiber crops even with an existing hemp mill',()=>{
 const city=setup({starter:true,population:24});ensureBusiness(city,'hemp_weaver',{worker:false});city.substances.setLaw('canhamo','prohibited',null);city.economy.demands=[{type:'artisan',score:120,reason:'Equipamento de carga'}];
 const plan=productionPlan(city.economy);assert(plan.some(r=>r.type==='fiber_farm'));assert(!plan.some(r=>r.type==='hemp_weaver'));
});

test('a legal hemp crop can operate while cannabis remains prohibited',()=>{
 const city=setup({population:24}),farm=city.economy.businesses.find(b=>b.type==='farm'),owner=city.society.citizen(farm.ownerId);owner.traits={...owner.traits,honesty:1};farm.crop='flor_cannabis';
 city.substances.setLaw('cannabis','prohibited',0);city.substances.setLaw('canhamo','regulated',null);
 assert.equal(city.substances.canFarm(farm),false);city.minute+=360;city.substances.hourly();
 assert.equal(city.substances.canFarm(farm),true);assert.equal(farm.substanceIllegalCultivation,false);
 assert.equal(city.substances.canTrade('canhamo',farm,{}),true);assert.equal(city.substances.canTrade('flor_cannabis',farm,{}),false);
});

test('remote farm vacancies reach applicants without skipping the physical interview',()=>{
 const city=setup({population:24}),farm=city.economy.businesses.find(b=>b.type==='farm'),person=city.citizens.find(c=>!city.politics.officeHolder(c)&&!c.businessIds.length);if(person.jobId)city.economy.leaveJob(person);
 farm.jobs=8;farm.balance=100000;person.entity.x=farm.door.x+30;person.entity.y=farm.door.y;person.career={jobs:[],applications:[],worked:{},motivation:50,knownVacancies:[]};
 const position={x:person.entity.x,y:person.entity.y};reviewMarket(city,[farm]);
 assert(person.career.knownVacancies.some(v=>v.buildingId===farm.id&&v.source==='Quadro municipal de empregos'));assert.equal(person.career.pendingInterview?.buildingId,farm.id);assert.equal(person.jobId,null);assert.equal(person.entity.x,position.x);assert.equal(person.entity.y,position.y);
});

test('farm hiring follows crop output demand instead of filling every physical field position',()=>{
 const city=setup({population:24}),farm=city.economy.businesses.find(b=>b.type==='farm');farm.ownerId=null;farm.crop='folha_tabaco';city.economy.setupFarm(farm);const maximum=farm.jobs;
 city.economy.demands=[{type:'farm',crop:'folha_tabaco',required:40}];city.economy.staffEssentials();
 assert(farm.jobs<maximum);assert.equal(farm.jobs,1);assert(city.economy.farmCapacity(farm,false,farm.jobs).daily>=40);
});

test('a funded unstaffed processor can compete with established farm wages within a shift',()=>{
 const city=setup({population:24}),processor=city.economy.businesses.find(b=>b.type==='bakery'),farms=city.economy.businesses.filter(b=>b.type==='farm');processor.workers=[];processor.ownerId=null;processor.baseWage=5;processor.balance=100000;processor.vacancySince=city.minute-360;
 for(const farm of farms)farm.baseWage=8;
 const money=totalMoney(city);reviewWages(city,processor);assert(processor.baseWage>5);assert(processor.baseWage<=processor.wageCompetitionCeiling);assert.equal(totalMoney(city),money);
 const reference=processor.wageReference;city.minute+=10*1440;reviewWages(city,processor);assert.equal(processor.wageReference,reference);assert(processor.wageCompetitionCeiling<=Math.max(reference*2,(city.politics.policy.minimumWage||0)*1.5));
});

test('a contractor that loses most of its crew reacts while keeping its original wage ceiling',()=>{
 const city=setup({starter:true,population:48}),builder=city.economy.businesses.find(b=>b.type==='builder');builder.jobs=12;builder.vacancySince=city.minute-360;
 for(const firm of city.economy.businesses)if(firm!==builder)firm.baseWage=8;
 const reference=builder.wageReference??builder.baseWage;reviewWages(city,builder);assert(builder.baseWage>=8);assert.equal(builder.wageReference,reference);assert(builder.baseWage<=builder.wageCompetitionCeiling);
});

test('harvested crops prioritize their missing processing suppliers ahead of unrelated new industries',()=>{
 const city=setup({population:24}),farm=city.economy.businesses.find(b=>b.type==='farm');farm.crop='folha_tabaco';farm.inventory.folha_tabaco=24;
 city.economy.demands=[{type:'tobacco_workshop',score:100,reason:'Colheita de tabaco aguardando beneficiamento'},{type:'clay_pit',score:190,reason:'Outra cadeia'}];
 assert(investProductionPlan(city.economy));assert(city.development.projects.some(p=>p.productionChain&&p.type==='forestry'));assert(!city.development.projects.some(p=>p.productionChain&&p.type==='clay_pit'));
});

test('workers finish walking to their work cell before deciding that a stocked mill has no inputs',()=>{
 const city=setup({population:24}),mill=ensureBusiness(city,'mill'),worker=city.society.citizen(mill.workers[0]);city.minute=600;
 Object.assign(mill.inventory,{girassol:12,oleo:0});city.economy.initialStock.girassol+=12;worker.needs=Object.fromEntries(Object.keys(worker.needs).map(k=>[k,95]));worker.indoorLocation=null;worker.path=[];worker.task='work';worker.targetId=mill.id;worker.entity.x=mill.door.x;worker.entity.y=mill.door.y;worker.workCell={buildingId:mill.id,unitId:mill.units.filter(u=>u.roomType==='workspace').at(-1).id};
 city.performTask(worker);assert.equal(worker.task,'work');assert(worker.indoorLocation?.path.length>0);
 advanceCitizenInterior(city,worker,100);worker.nextWorkBuildingId=mill.id;worker.nextWorkRotationAt=city.minute;
 city.performTask(worker);assert.equal(worker.task,'work');assert.equal(worker.workWait,undefined);
 for(let minute=0;minute<60;minute++){advanceCitizenInterior(city,worker,1);city.minute++;city.performTask(worker);}
 assert(city.economy.produced.oleo>0);assert(mill.inventory.girassol<12);
});

test('healthy employees do not leave their shift just to top up pocket supplies',()=>{
 const city=setup({starter:true,population:48}),employer=city.economy.businesses.find(b=>b.type==='builder'),worker=city.society.citizen(employer.workers[0]);city.minute=600;worker.pocket={food:[],water:0};worker.needs=Object.fromEntries(Object.keys(worker.needs).map(k=>[k,95]));worker.task=null;worker.path=[];worker.indoorLocation=null;
 assert.equal(city.supplies.route(worker),false);assert.equal(worker.task,null);
 worker.needs.water=20;assert.equal(city.supplies.route(worker),true);assert.equal(worker.task,'supplies');
});
