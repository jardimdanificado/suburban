// Runs the same transferred city state used by the simulation worker.
// Optional first argument selects a comparison checkout. SPEED selects the
// worker cadence; STEP can override it for controlled scheduling experiments.
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.argv[2]?resolve(process.argv[2]):fileURLToPath(new URL('../',import.meta.url));
const population=Number(process.env.SUBURBAN_BENCH_POPULATION)||512,speed=Number(process.env.SUBURBAN_BENCH_SPEED)||32;
const dt=Number(process.env.SUBURBAN_BENCH_STEP)||Math.min(.25,Math.max(1/60,speed/128)),cityMinutes=Number(process.env.SUBURBAN_BENCH_CITY_MINUTES)||240;
const warmupMinutes=Math.max(0,Math.floor(Number(process.env.SUBURBAN_BENCH_WARMUP_MINUTES)||0)),diagnostics=process.env.SUBURBAN_BENCH_PROFILE==='1';
const load=name=>import(pathToFileURL(resolve(root,'js',name)).href);
const {CitySimulation}=await load('city_simulation.js'),{World}=await load('world.js'),{CityStateGraph,bindCityState}=await load('city_state.js'),{FF_LOD_SPEED}=await load('simulation_time.js');
let nextId=1;const entities=[],world=new World(1,1337,256);
const initial=new CitySimulation({world,population,seed:1337,createEntity:data=>{const entity={id:nextId++,destroyed:false,...data};entities.push(entity);return entity;}});
initial.initialize();
const graph=new CityStateGraph(),state=graph.apply(structuredClone(new CityStateGraph().encode({city:initial,entities,nextId}))),city=state.city;
bindCityState(city);city.staggerInitialTaskDecisions();
city.createEntity=data=>{const entity={id:state.nextId++,destroyed:false,...data};state.entities.push(entity);return entity;};
// Warm-up is outside the measured region; retain its state and random stream.
for(let i=0;i<warmupMinutes;i++)city.update(.25);
city.profileDiagnostics=diagnostics;city.fastForward=(speed>=FF_LOD_SPEED||process.env.SUBURBAN_BENCH_FF==='1')&&process.env.SUBURBAN_BENCH_FF!=='0';city.fastForward2=speed>=128;
const startMinute=city.minute,dailyEnabled=process.env.SUBURBAN_BENCH_DAILY==='1',daily=Array.from({length:Math.ceil(cityMinutes/1440)},(_,day)=>({day:day+1,minutes:0,updates:0,ms:0,samples:[],population:null,buildings:null,relations:null,phaseTotals:{}}));
const phaseTotals={},phasePeaks={};
function captureProfile(profile,prefix=''){
  if(!profile||typeof profile!=='object')return;
  for(const [key,value] of Object.entries(profile)){
    if(key==='step')continue; // Per-minute step phases are captured below.
    if(value&&typeof value==='object'){captureProfile(value,prefix+key+'.');continue;}
    if(!key.endsWith('Ms')||!Number.isFinite(value))continue;
    const name=prefix+key;phaseTotals[name]=(phaseTotals[name]||0)+value;
    if(dailyEnabled){const index=Math.min(daily.length-1,Math.max(0,Math.floor(Math.max(0,city.minute-startMinute-1)/1440)));if(index>=0){const day=daily[index];day.phaseTotals[name]=(day.phaseTotals[name]||0)+value;}}
    if(!phasePeaks[name]||value>phasePeaks[name].ms)phasePeaks[name]={ms:value,minute:city.minute};
  }
}
if(diagnostics){const stepMinute=city.stepMinute.bind(city);city.stepMinute=()=>{stepMinute();captureProfile(city.lastStepProfile,'step.');};}
const times=[],cpuStarted=process.cpuUsage(),threadCpuStarted=process.threadCpuUsage?.(),started=performance.now();
for(let i=0;i<Math.round(cityMinutes/(dt*4));i++){
  const before=city.minute,at=performance.now();city.update(dt);const updateMs=performance.now()-at;times.push(updateMs);
  if(diagnostics)captureProfile(city.lastUpdateProfile);
  if(dailyEnabled){const progressed=city.minute-startMinute,index=Math.min(daily.length-1,Math.max(0,Math.ceil(progressed/1440)-1)),day=daily[index];day.minutes+=city.minute-before;day.updates++;day.ms+=updateMs;day.samples.push(updateMs);if(progressed>0&&progressed%1440===0){day.population=city.citizens.reduce((n,c)=>n+(!c.entity.destroyed?1:0),0);day.buildings=city.buildings.reduce((n,b)=>n+(!b.entity.destroyed?1:0),0);day.relations=city.society.relations.size;}}
}
const ms=performance.now()-started,cpu=process.cpuUsage(cpuStarted),threadCpu=threadCpuStarted?process.threadCpuUsage(threadCpuStarted):null,cpuMs=(cpu.user+cpu.system)/1000,threadCpuMs=threadCpu?(threadCpu.user+threadCpu.system)/1000:null;times.sort((a,b)=>a-b);
const observed={minute:city.minute,seed:city.seed,people:city.citizens.map(c=>[c.id,c.task,c.needs,c.entity.x,c.entity.y,c.balance,c.indoorLocation,c.career,c.sleep]),rooms:[...city.units.values()].map(u=>[u.id,u.activityReservedIds]),accounts:[...city.accounts].map(([id,a])=>[id,a.balance]),history:city.history.nextId,events:city.events,relations:[...city.society.relations]};
const checksum=createHash('sha256').update(JSON.stringify(observed)).digest('hex');
const dailySummary=dailyEnabled?daily.map(day=>{day.samples.sort((a,b)=>a-b);return{day:day.day,minutes:day.minutes,updates:day.updates,ms:day.ms,p50:day.samples[Math.floor(day.samples.length*.5)],p95:day.samples[Math.floor(day.samples.length*.95)],population:day.population,buildings:day.buildings,relations:day.relations,...(diagnostics?{phaseTotals:day.phaseTotals}:{})};}):null;
console.log(JSON.stringify({root,population,speed,dt,cityMinutes,warmupMinutes,startMinute,endMinute:city.minute,...(diagnostics?{phaseTotals,phasePeaks}:{}),...(dailyEnabled?{daily:dailySummary}:{}),updates:times.length,ms,cpuMs,threadCpuMs,effectiveSpeed:cityMinutes/4/(ms/1000),p50:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],max:times.at(-1),checksum}));
