import {Worker} from 'node:worker_threads';
import {serialize} from 'node:v8';
import {World} from '../js/world.js';
import {CitySimulation} from '../js/city_simulation.js';
import {CityStateGraph} from '../js/city_state.js';

const count=Math.max(2,Math.min(8,Number(process.argv[2])||2));
const population=Math.max(8,Number(process.env.SUBURBAN_MULTI_POPULATION)||64);
const mapSize=Math.max(128,Math.min(512,Number(process.env.SUBURBAN_MULTI_MAP_SIZE)||128));
const durationMs=Math.max(1000,Number(process.env.SUBURBAN_MULTI_DURATION_MS)||5000);
const speed=Math.max(.25,Number(process.env.SUBURBAN_MULTI_SPEED)||1);
const workers=[],stats=Array.from({length:count},()=>({snapshots:0,bytes:0,encodeMs:0,updateMs:0,maxUpdateMs:0,minute:0,cityCounts:null}));
const memorySamples=[];let memoryRequestId=0,benchmarkStart=0;const memoryReplies=new Map();
let completed=0,failed=null;
function stop(){for(const worker of workers)worker.terminate();}
function requestMemorySample(){
  if(!workers.length)return;
  const beforeGc=process.memoryUsage();globalThis.gc?.();
  const id=++memoryRequestId;const replies=[];
  const timer=setTimeout(()=>{memoryReplies.delete(id);},5000);
  memoryReplies.set(id,{replies,timer});
  for(const worker of workers)worker.postMessage({type:'benchmark-memory',id});
  setTimeout(()=>{
    const pending=memoryReplies.get(id);if(!pending)return;
    clearTimeout(pending.timer);memoryReplies.delete(id);
    memorySamples.push({elapsedMs:Math.round(performance.now()-benchmarkStart),parent:{beforeGc,afterGc:process.memoryUsage(),gcAvailable:typeof globalThis.gc==='function'},workers:pending.replies});
  },2500).unref?.();
}
try{
  await Promise.all(Array.from({length:count},(_,index)=>new Promise((resolve,reject)=>{
    let nextId=1;const entities=[],world=new World(1,1337+index,mapSize),city=new CitySimulation({world,population,startFoundingWorks:false,createEntity:data=>{const entity={id:nextId++,destroyed:false,...data};entities.push(entity);return entity;}});city.initialize();
    const graph=new CityStateGraph(),packet=graph.encode({city,entities,nextId}),worker=new Worker(new URL('../tests/helpers/ff_worker.mjs',import.meta.url));workers.push(worker);
    worker.on('error',reject);worker.on('message',message=>{
      if(message.type==='benchmark-memory'){
        const pending=memoryReplies.get(message.id);if(pending)pending.replies[index]={beforeGc:message.beforeGc,memory:message.memory,gcAvailable:message.gcAvailable,diagnostics:message.diagnostics};
        return;
      }
      if(message.type==='ready'){worker.postMessage({type:'init',cityId:`bench-${index+1}`,packet});return;}
      if(message.type==='failure'){reject(new Error(message.message));return;}
      if(message.type!=='state')return;
      try{const state=graph.apply(message.packet);worker.postMessage({type:'ack',cityId:`bench-${index+1}`});
        const sample=stats[index];sample.snapshots++;sample.bytes+=serialize(message.packet).byteLength;sample.encodeMs+=message.workMs||0;sample.updateMs+=message.workerMetrics?.lastUpdateMs||0;sample.maxUpdateMs=Math.max(sample.maxUpdateMs,message.workerMetrics?.maxUpdateMs||0);sample.minute=state.city.minute;
        const city=state.city,people=city.citizens||[];sample.cityCounts={citizens:people.length,relationships:city.society?.relations?.size||0,socialFacts:city.relationships?.facts?.size||0,socialMemories:people.reduce((sum,person)=>sum+(person.social?.memories?.length||0)+(person.social?.beliefs?.length||0),0),historyEntries:city.history?.entries?.length||0,historyTotal:city.history?.total||0,ledgerEntries:city.ledger?.length||0,cityEvents:city.events?.length||0};
        if(!completed++){worker.postMessage({type:'control',cityId:`bench-${index+1}`,paused:false,speed});resolve();}
        else if(sample.snapshots===1){worker.postMessage({type:'control',cityId:`bench-${index+1}`,paused:false,speed});resolve();}
      }catch(error){reject(error);}
    });
  })));
  const startCpu=process.cpuUsage(),startRss=process.memoryUsage().rss,start=performance.now();
  benchmarkStart=start;const memoryTimer=setInterval(requestMemorySample,60000);requestMemorySample();
  await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,durationMs);timer.unref?.();for(const worker of workers)worker.once('error',reject);});
  clearInterval(memoryTimer);requestMemorySample();await new Promise(resolve=>setTimeout(resolve,2600));
  const elapsedMs=performance.now()-start,cpu=process.cpuUsage(startCpu),rssAfter=process.memoryUsage().rss;
  console.log(JSON.stringify({mode:'multi-city',cities:count,populationPerCity:population,mapSize,speed,durationMs:Math.round(elapsedMs),cpuMs:(cpu.user+cpu.system)/1000,cpuPercent:Number(((cpu.user+cpu.system)/1000/elapsedMs*100).toFixed(1)),rssBeforeBytes:startRss,rssAfterBytes:rssAfter,rssDeltaBytes:rssAfter-startRss,memorySamples,citiesStats:stats.map((s,index)=>({city:index+1,snapshots:s.snapshots,snapshotBytes:s.bytes,meanSnapshotBytes:s.snapshots?Math.round(s.bytes/s.snapshots):0,meanEncodeMs:s.snapshots?Number((s.encodeMs/s.snapshots).toFixed(2)):0,meanWorkerUpdateMs:s.snapshots?Number((s.updateMs/s.snapshots).toFixed(2)):0,maxWorkerUpdateMs:Number(s.maxUpdateMs.toFixed(2)),minute:s.minute,cityCounts:s.cityCounts}))}));
}catch(error){failed=error;}
finally{stop();}
if(failed)throw failed;
