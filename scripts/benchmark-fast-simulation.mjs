// Runs the same transferred city state used by the simulation worker.
// Optional first argument selects a comparison checkout. SPEED selects the
// worker cadence; STEP can override it for controlled scheduling experiments.
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.argv[2]?resolve(process.argv[2]):fileURLToPath(new URL('../',import.meta.url));
const population=Number(process.env.SUBURBAN_BENCH_POPULATION)||512,speed=Number(process.env.SUBURBAN_BENCH_SPEED)||32;
const dt=Number(process.env.SUBURBAN_BENCH_STEP)||Math.min(.25,Math.max(1/60,speed/128)),cityMinutes=Number(process.env.SUBURBAN_BENCH_CITY_MINUTES)||240;
const load=name=>import(pathToFileURL(resolve(root,'js',name)).href);
const {CitySimulation}=await load('city_simulation.js'),{World}=await load('world.js'),{CityStateGraph,bindCityState}=await load('city_state.js');
let nextId=1;const entities=[],world=new World(1,1337,256);
const initial=new CitySimulation({world,population,seed:1337,createEntity:data=>{const entity={id:nextId++,destroyed:false,...data};entities.push(entity);return entity;}});
initial.initialize();
const graph=new CityStateGraph(),state=graph.apply(structuredClone(new CityStateGraph().encode({city:initial,entities,nextId}))),city=state.city;
bindCityState(city);city.staggerInitialTaskDecisions();
city.createEntity=data=>{const entity={id:state.nextId++,destroyed:false,...data};state.entities.push(entity);return entity;};
const times=[],cpuStarted=process.cpuUsage(),threadCpuStarted=process.threadCpuUsage?.(),started=performance.now();
for(let i=0;i<Math.round(cityMinutes/(dt*4));i++){const at=performance.now();city.update(dt);times.push(performance.now()-at);}
const ms=performance.now()-started,cpu=process.cpuUsage(cpuStarted),threadCpu=threadCpuStarted?process.threadCpuUsage(threadCpuStarted):null,cpuMs=(cpu.user+cpu.system)/1000,threadCpuMs=threadCpu?(threadCpu.user+threadCpu.system)/1000:null;times.sort((a,b)=>a-b);
const observed={minute:city.minute,seed:city.seed,people:city.citizens.map(c=>[c.id,c.task,c.needs,c.entity.x,c.entity.y,c.balance,c.indoorLocation,c.career,c.sleep]),rooms:[...city.units.values()].map(u=>[u.id,u.activityReservedIds]),accounts:[...city.accounts].map(([id,a])=>[id,a.balance]),history:city.history.nextId,events:city.events,relations:[...city.society.relations]};
const checksum=createHash('sha256').update(JSON.stringify(observed)).digest('hex');
console.log(JSON.stringify({root,population,speed,dt,cityMinutes,updates:times.length,ms,cpuMs,threadCpuMs,effectiveSpeed:cityMinutes/4/(ms/1000),p50:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],max:times.at(-1),checksum}));
