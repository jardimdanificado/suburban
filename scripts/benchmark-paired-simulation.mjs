// Interleave two source trees minute by minute, reversing their order each time.
// This reduces timing drift between versions but holds two cities in memory.
// Uses one-minute updates without fast-forward LOD; compare isolated snapshots.
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
if(!process.argv[2]||!process.argv[3])throw Error('Usage: node scripts/benchmark-paired-simulation.mjs BEFORE_ROOT AFTER_ROOT');
const population=Number(process.env.SUBURBAN_BENCH_POPULATION)||512,seed=Number(process.env.SUBURBAN_BENCH_SEED??1794658272),preset=Number(process.env.SUBURBAN_BENCH_PRESET??0),mapSize=Number(process.env.SUBURBAN_BENCH_SIZE)||128,dt=.25,cityMinutes=Number(process.env.SUBURBAN_BENCH_CITY_MINUTES)||1200;
async function boot(root){
  const load=name=>import(pathToFileURL(resolve(root,'js',name)).href);
  const {CitySimulation}=await load('city_simulation.js'),{World}=await load('world.js'),{CityStateGraph,bindCityState}=await load('city_state.js');
  let nextId=1;const entities=[],world=new World(preset,seed,mapSize);
  const initial=new CitySimulation({world,population,seed,createEntity:data=>{const entity={id:nextId++,destroyed:false,...data};entities.push(entity);return entity;}});
  initial.initialize();
  const graph=new CityStateGraph(),state=graph.apply(structuredClone(new CityStateGraph().encode({city:initial,entities,nextId}))),city=state.city;
  bindCityState(city);city.staggerInitialTaskDecisions();
  city.createEntity=data=>{const entity={id:state.nextId++,destroyed:false,...data};state.entities.push(entity);return entity;};

  city.profileDiagnostics=true;city.fastForward=false;city.fastForward2=false;
  const context={root,city,times:[],phaseTotals:{},phasePeaks:{}};
  const stepMinute=city.stepMinute.bind(city);city.stepMinute=()=>{stepMinute();capture(context,city.lastStepProfile,'step.');};
  return context;
}
function capture(context,profile,prefix=''){
 if(!profile||typeof profile!=='object')return;
 for(const [key,value]of Object.entries(profile)){
  if(key==='step')continue;
  if(value&&typeof value==='object'){capture(context,value,prefix+key+'.');continue;}
  if(!key.endsWith('Ms')||!Number.isFinite(value))continue;
  const name=prefix+key;context.phaseTotals[name]=(context.phaseTotals[name]||0)+value;
  if(!context.phasePeaks[name]||value>context.phasePeaks[name].ms)context.phasePeaks[name]={ms:value,minute:context.city.minute};
 }
}
function checksum(city){
  const observed={minute:city.minute,seed:city.seed,people:city.citizens.map(c=>[c.id,c.task,c.needs,c.entity.x,c.entity.y,c.balance,c.indoorLocation,c.career,c.sleep]),rooms:[...city.units.values()].map(u=>[u.id,u.activityReservedIds]),accounts:[...city.accounts].map(([id,a])=>[id,a.balance]),history:city.history.nextId,events:city.events,relations:[...city.society.relations]};
  return createHash('sha256').update(JSON.stringify(observed)).digest('hex');
}
const contexts=[await boot(resolve(process.argv[2])),await boot(resolve(process.argv[3]))];
for(let i=0;i<cityMinutes;i++)for(const index of i%2?[1,0]:[0,1]){const context=contexts[index],at=performance.now();context.city.update(dt);context.times.push(performance.now()-at);}
console.log(JSON.stringify(contexts.map(c=>{c.times.sort((a,b)=>a-b);return {mode:'paired-alternating',seed,preset,mapSize,population,cityMinutes,root:c.root,updates:c.times.length,endMinute:c.city.minute,ms:c.times.reduce((n,v)=>n+v,0),p95:c.times[Math.floor(c.times.length*.95)],max:c.times.at(-1),checksum:checksum(c.city),phaseTotals:c.phaseTotals,phasePeaks:c.phasePeaks};})));
