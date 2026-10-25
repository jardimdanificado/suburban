// Autonomous integration audit. Advances movement and needs together, without teleporting workers.
import { CitySimulation } from '../js/city_simulation.js';
import { World } from '../js/world.js';
import { GOODS } from '../js/city_economy.js';
import { INDUSTRIES } from '../js/city_industries.js';
import { CityStateGraph,bindCityState } from '../js/city_state.js';
import { readFileSync,writeFileSync } from 'node:fs';
import { serialize,deserialize } from 'node:v8';
const options=Object.fromEntries(process.argv.slice(2).map(arg=>arg.replace(/^--/,'').split('=')));
const population=Number(options.population||512),days=Number(options.days||3),seed=Number(options.seed||1337),preset=Number(options.preset||1);
if(!Number.isInteger(population)||population<1||!Number.isFinite(days)||days<=0||!Number.isInteger(seed)||![0,1,2].includes(preset))throw Error('Invalid audit settings');
let id=0,city;
const started=performance.now();
if(options.resume){const state=new CityStateGraph().apply(deserialize(readFileSync(options.resume)));city=state.city;id=state.nextId-1;bindCityState(city);city.createEntity=data=>({id:++id,destroyed:false,...data});}
else{const world=new World(preset,seed);city=new CitySimulation({world,population,seed,createEntity:data=>({id:++id,destroyed:false,...data})});city.initialize();}
let interrupted=false;process.on('SIGINT',()=>{interrupted=true;});process.on('SIGTERM',()=>{interrupted=true;});
const violations=new Map(),timings=new Map(),samples=[];let firstPublicLight=null,peakPublicLights=0;
const traced=new Set((options.trace||'').split(',').filter(Boolean).map(Number));
function violation(type,detail){const row=violations.get(type)||{type,count:0,examples:[]};row.count++;if(row.examples.length<5)row.examples.push(detail);violations.set(type,row);}
for(const [name,system] of Object.entries({city,economy:city.economy,logistics:city.logistics,development:city.development,housing:city.housing,sanitation:city.sanitation,politics:city.politics,society:city.society,relationships:city.relationships,bank:city.bank,lighting:city.lighting,nature:city.nature,publications:city.publications,research:city.politics.getResearch()})){
  for(const method of ['reconcile','hourly','daily','updateMinute','findPath','chooseTask','invest','hire','updateDemand','investProductionPlan']){
    if(typeof system[method]!=='function')continue;
    const original=system[method],key=`${name}.${method}`,row={key,calls:0,ms:0,maxMs:0};timings.set(key,row);
    system[method]=function(...args){const at=performance.now();try{return original.apply(this,args);}finally{const ms=performance.now()-at;row.calls++;row.ms+=ms;row.maxMs=Math.max(row.maxMs,ms);}};
  }
}
function inspect(){
  for(const [account,a] of city.accounts)if(!Number.isSafeInteger(a.balance)||a.balance<0)violation('account',`${account}: ${a.balance}`);
  const supply=city.currency.supply(),issued=city.currency.netIssued();if(supply!==issued)violation('money-conservation',{supply,issued});
  for(const b of city.buildings){
    if(b.entity.destroyed)continue;
    if(new Set(b.workers).size!==b.workers.length)violation('duplicate-workers',b.id);
    for(const worker of b.workers)if(city.society.citizen(worker)?.jobId!==b.id)violation('employment',`${b.id}: ${worker}`);
    for(const [good,n] of Object.entries(b.inventory))if(!Number.isFinite(n)||n<0)violation('inventory',`${b.id}: ${good}=${n}`);
  }
  for(const c of city.citizens){
    if(c.jobId&&!city.building(c.jobId)?.workers.includes(c.id))violation('citizen-employment',c.id);
    if(!Number.isFinite(c.entity.x)||!Number.isFinite(c.entity.y))violation('citizen-position',c.id);
    for(const [need,n] of Object.entries(c.needs))if(!Number.isFinite(n)||n<0||n>100)violation('need',`${c.id}: ${need}=${n}`);
  }
  for(const good of Object.keys(GOODS)){
    const expected=city.economy.initialStock[good]+city.economy.produced[good]-city.economy.consumed[good]-city.economy.lost[good],actual=city.goodsStock(good);
    if(Math.abs(expected-actual)>.001)violation('goods-conservation',{good,expected,actual});
  }
  for(const [key,d]of city.bank.deposits)if(city.accounts.get(key)!==d)violation('deposit-reserve',key);
  for(const s of city.politics.getResearch().studies){
    if(new Set(s.responses.map(r=>r.citizenId)).size!==s.responses.length)violation('duplicate-interview',s.id);
    if(s.responses.length>s.maximum||s.status==='published'&&s.responses.length<s.minimum)violation('poll-size',s.id);
  }
  for(const e of [...city.politics.elections,city.politics.active].filter(Boolean))if(new Set(e.ballots.map(b=>b.citizenId)).size!==e.ballots.length)violation('duplicate-ballot',e.id);
}
function services(){
  const projects=city.development.projects,politics=city.politics,research=politics.getResearch(),lamps=city.lighting.posts;
  const publicLit=lamps.filter(p=>p.public&&p.lit).length;
  peakPublicLights=Math.max(peakPublicLights,publicLit);if(publicLit)firstPublicLight??=city.minute;
  return {
    lighting:{planned:city.lighting.sites.size,built:lamps.filter(p=>p.built).length,publicBuilt:lamps.filter(p=>p.public&&p.built).length,publicLit,peakPublicLights,firstPublicLight,refills:city.logistics.shipments.filter(s=>s.purpose==='lamp-refill'&&s.status==='delivered').length},
    roads:{completed:projects.filter(p=>['road','road-repair'].includes(p.service)&&p.status==='completed').length,pending:projects.filter(p=>['road','road-repair'].includes(p.service)&&!p.cancelled&&p.status!=='completed').length},
    sanitation:{cleaned:city.sanitation.cleaned,wasteProcessed:city.economy.consumed.lixo},
    banking:{loans:city.bank.loans.length,active:city.bank.loans.filter(l=>!['paid','written-off'].includes(l.status)).length,deposits:[...city.bank.deposits.values()].reduce((sum,d)=>sum+(d.balance||0),0)},
    politics:{elections:politics.elections.map(e=>({id:e.id,round:e.round,status:e.status,votes:e.ballots.length,uniqueVoters:new Set(e.ballots.map(b=>b.citizenId)).size})),approval:politics.approval,parties:politics.parties.filter(p=>p.active).length,council:politics.council.members.length,bills:politics.council.bills?.length,activeElection:politics.active?.status,votes:politics.active?.ballots.length||0,studies:research.studies.map(s=>({id:s.id,status:s.status,minimum:s.minimum,target:s.target,responses:s.responses.length,unique:new Set(s.responses.map(r=>r.citizenId)).size})),polls:[...politics.elections,politics.active].filter(Boolean).reduce((sum,e)=>sum+e.polls.length,0),corruptionCases:politics.corruption.length,scandals:politics.scandals.length},
    publications:{documents:city.publications.documents.size,newspapers:city.economy.produced.jornais,books:city.economy.produced.livros,pamphlets:city.economy.produced.panfletos},
    birthCount:city.society.birthCount??city.stats().births
  };
}
function save(){if(options.state)writeFileSync(options.state,serialize(new CityStateGraph().encode({city,nextId:id+1})));}
function report(){
  inspect();const stats=city.stats(),firms=city.economy.businesses,projects=city.development.projects;
  const row={violations:[...violations.values()],services:services(),day:city.day,minute:city.minute,population:stats.population,employed:stats.employed,homeless:stats.homeless,deaths:city.life.deathCount,hungry:city.citizens.filter(c=>c.needs.food<20).length,happiness:stats.happiness,treasury:city.treasury,buildings:city.buildings.length,businesses:firms.length,sectors:Object.keys(INDUSTRIES).filter(type=>firms.some(b=>b.type===type)),crops:firms.filter(b=>b.type==='farm').map(b=>b.crop),produced:Object.fromEntries(Object.entries(city.economy.produced).filter(([,n])=>n>0)),projects:{active:projects.filter(p=>!p.cancelled&&p.status!=='completed').length,completed:projects.filter(p=>p.status==='completed').length},deliveries:city.logistics.delivered,elections:city.politics.elections.length,relationships:city.society.relations.size,events:city.history.nextId,heapMB:Math.round(process.memoryUsage().heapUsed/1048576),elapsedMs:Math.round(performance.now()-started)};
  samples.push(row);console.log(JSON.stringify({type:'checkpoint',...row}));
}
report();const end=city.minute+Math.ceil(days*1440),minuteTimes=[];
while(city.minute<end&&!interrupted){const at=performance.now();city.update(.25);minuteTimes.push(performance.now()-at);if(traced.size&&city.minute%10===0)for(const c of city.citizens)if(traced.has(c.id))console.log(JSON.stringify({type:'trace',minute:city.minute,id:c.id,task:c.task,path:c.path.length,next:c.path[0],x:c.entity.x,y:c.entity.y,needs:c.needs,target:c.targetId,conversation:!!c.conversation,meal:!!c.workMeal,delivery:c.deliveryId,action:c.action}));if(city.minute%60===0){services();inspect();await new Promise(resolve=>setImmediate(resolve));}if(city.minute%360===0)report();if(city.minute%1440===0)save();}
report();minuteTimes.sort((a,b)=>a-b);
save();
const percentile=p=>minuteTimes[Math.min(minuteTimes.length-1,Math.floor(minuteTimes.length*p))];
console.log(JSON.stringify({type:'summary',completed:city.minute>=end,settings:{population:city.initialPopulation,days,seed:city.initialSeed,preset:city.world.presetId},elapsedMs:Math.round(performance.now()-started),minuteMs:{p50:percentile(.5),p95:percentile(.95),p99:percentile(.99),max:minuteTimes.at(-1)},violations:[...violations.values()],profile:[...timings.values()].sort((a,b)=>b.ms-a.ms),final:samples.at(-1),deaths:city.life.deaths,plots:{urban:city.development.plots.filter(p=>!p.buildingId&&!p.projectId&&p.ownerId==='treasury'&&!['farm','quarry'].includes(p.type)).length,rural:city.development.plots.filter(p=>!p.buildingId&&!p.projectId&&p.ownerId==='treasury'&&p.type==='farm').length},chains:city.economy.productionPlan,firms:city.economy.businesses.map(b=>({id:b.id,type:b.type,crop:b.crop,balance:b.balance,workers:b.workers.length,owner:b.ownerId,stock:Object.fromEntries(Object.entries(b.inventory).filter(([,n])=>n>0))})),pending:city.development.projects.filter(p=>!p.cancelled&&p.status!=='completed').map(p=>({id:p.id,type:p.type,service:p.service,status:p.status,stone:p.stone,inventory:p.inventory.pedra,incoming:p.incoming.pedra,labor:p.labor,required:p.requiredLabor,reason:p.error||p.materialStatus}))}));
if(violations.size)process.exitCode=1;
