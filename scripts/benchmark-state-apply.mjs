// Compares compact snapshot application; no simulation or rendering is timed.
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const checkout=fileURLToPath(new URL('../',import.meta.url)),baseline=resolve(process.argv[2]||checkout);
const load=(directory,name)=>import(pathToFileURL(resolve(directory,'js',name)).href);
const {CityStateGraph}=await load(checkout,'city_state.js'),{CityStateGraph:BeforeGraph}=await load(baseline,'city_state.js');
const {CitySimulation}=await load(checkout,'city_simulation.js'),{World}=await load(checkout,'world.js');
const entities=[];let nextId=1;const city=new CitySimulation({world:new World(1,1337,256),population:1024,seed:1337,createEntity:data=>{const e={id:nextId++,destroyed:false,...data};entities.push(e);return e;}});city.initialize();
const source=new CityStateGraph(),root={city,entities,nextId},initial=structuredClone(source.encode(root)),before=new BeforeGraph(),after=new CityStateGraph();before.apply(structuredClone(initial));after.apply(structuredClone(initial));
for(const c of city.citizens){c.mood+=1;c.needs.food-=1;}
const packet=structuredClone(source.encode(root,{packNeeds:true,packPositions:true,omitCitizenPaths:true}));
for(let i=0;i<5;i++){before.apply(packet);after.apply(packet);}
const times=[];for(let round=0;round<4;round++){
 const row={};for(const [name,graph]of [['before',before],['after',after]]){const started=process.threadCpuUsage();for(let i=0;i<200;i++)graph.apply(packet);const cpu=process.threadCpuUsage(started);row[name]=(cpu.user+cpu.system)/1000/200;}
 times.push(row);
}
const a=before.objects.get(initial.rootId),b=after.objects.get(initial.rootId);if(JSON.stringify(a.city.citizens.map(c=>[c.id,c.path,c.needs,c.mood]))!==JSON.stringify(b.city.citizens.map(c=>[c.id,c.path,c.needs,c.mood])))throw Error('State differs');
console.log(JSON.stringify({root:checkout,baseline,people:1024,packetNodes:packet.nodes.length,msPerApply:times,identicalState:true}));
