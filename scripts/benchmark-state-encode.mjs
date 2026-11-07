// Compare encoders on independently restored copies of the same live city.
// Alternate order within one process to reduce frequency/thermal interference.
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const checkout=fileURLToPath(new URL('../',import.meta.url)),baseline=resolve(process.argv[2]||checkout);
const load=(directory,name)=>import(pathToFileURL(resolve(directory,'js',name)).href);
const {CityStateGraph,bindCityState}=await load(checkout,'city_state.js'),{CityStateGraph:BeforeGraph,bindCityState:bindBefore}=await load(baseline,'city_state.js');
const {CitySimulation}=await load(checkout,'city_simulation.js'),{World}=await load(checkout,'world.js');
const population=Number(process.env.SUBURBAN_BENCH_POPULATION)||1024,warmupMinutes=Number(process.env.SUBURBAN_BENCH_WARMUP_MINUTES)||660,rounds=Number(process.env.SUBURBAN_BENCH_ROUNDS)||30;
const entities=[];let nextId=1;
const city=new CitySimulation({world:new World(1,1337,256),population,seed:1337,createEntity:data=>{const e={id:nextId++,destroyed:false,...data};entities.push(e);return e;}});city.initialize();
for(let i=0;i<warmupMinutes;i++)city.update(.25);
const initial=new CityStateGraph().encode({city,entities,nextId}),variants=[];
for(const [name,Type,bind] of [['before',BeforeGraph,bindBefore],['after',CityStateGraph,bindCityState]]){
 const graph=new Type(),state=graph.apply(structuredClone(initial));bind(state.city);
 state.city.createEntity=data=>{const e={id:state.nextId++,destroyed:false,...data};state.entities.push(e);return e;};
 graph.encode(state,{packNeeds:true,packPositions:true,omitCitizenPaths:true,fieldTailPatches:true});
 variants.push({name,graph,state,samples:[]});
}
for(let round=0;round<rounds;round++){
 const order=round%2?[...variants].reverse():variants;
 for(const v of order){
  const updateCpu=process.threadCpuUsage?.(),updateAt=performance.now();
  for(let i=0;i<6;i++)v.state.city.update(1/6);
  const updateMs=performance.now()-updateAt,updateUsed=updateCpu?process.threadCpuUsage(updateCpu):null;
  const cpu=process.threadCpuUsage?.(),at=performance.now(),packet=v.graph.encode(v.state,{packNeeds:true,packPositions:true,omitCitizenPaths:true,fieldTailPatches:true});
  const ms=performance.now()-at,used=cpu?process.threadCpuUsage(cpu):null;
  v.samples.push({ms,updateMs,updateThreadCpuMs:updateUsed?(updateUsed.user+updateUsed.system)/1000:null,threadCpuMs:used?(used.user+used.system)/1000:null,nodes:packet.nodes.length});
 }
}
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const observed=c=>({minute:c.minute,seed:c.seed,people:c.citizens.map(p=>[p.id,p.task,p.needs,p.entity.x,p.entity.y,p.indoorLocation,p.balance,p.career,p.bodyHeightCm,p.bodyWeightKg,p.render,p.wardrobe,p.wearing]),accounts:[...c.accounts].map(([id,a])=>[id,a.balance]),history:c.history.nextId,events:c.events,relations:[...c.society.relations]});
const results=variants.map(v=>{const ms=v.samples.map(s=>s.ms).sort((a,b)=>a-b);return{name:v.name,meanUpdateMs:v.samples.reduce((s,r)=>s+r.updateMs,0)/rounds,meanUpdateThreadCpuMs:v.samples.reduce((s,r)=>s+r.updateThreadCpuMs,0)/rounds,meanMs:v.samples.reduce((s,r)=>s+r.ms,0)/rounds,meanThreadCpuMs:v.samples.reduce((s,r)=>s+r.threadCpuMs,0)/rounds,p95:ms[Math.floor(ms.length*.95)],max:ms.at(-1),checksum:hash(observed(v.state.city)),samples:v.samples};});
if(results[0].checksum!==results[1].checksum)throw Error('Encoder comparison cities diverged');
console.log(JSON.stringify({checkout,baseline,population,warmupMinutes,rounds,results}));
