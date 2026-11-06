// Isolates crowd grouping/exit-search overhead. Pathfinding is a stub; this
// does not measure a full city or claim a corresponding overall speedup.
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const current=fileURLToPath(new URL('../',import.meta.url)),baseline=process.argv[2]?resolve(process.argv[2]):current;
const load=async root=>(await import(pathToFileURL(resolve(root,'js/city_interiors.js')).href)).disperseCrowds;
const before=await load(baseline),after=await load(current);
function setup(blocked){
 const citizens=Array.from({length:1024},(_,i)=>({id:i+1,entity:{x:10.5+Math.floor(i/4)%32,y:10.5+Math.floor(i/128),destroyed:false},path:[],task:null}));
 return {world:{width:256,height:256},citizens,minute:480,urgentNeed:()=>false,walkable:()=>!blocked,findPath:(_from,to)=>[to]};
}
function run(fn,city,iterations){
 const started=process.threadCpuUsage?.()||process.cpuUsage();
 for(let j=0;j<iterations;j++){for(const c of city.citizens){c.path.length=0;c.task=null;}city.minute=480+j;fn(city);}
 const elapsed=process.threadCpuUsage?process.threadCpuUsage(started):process.cpuUsage(started);
 return(elapsed.user+elapsed.system)/1000;
}
for(const blocked of [false,true]){
 const a=setup(blocked),b=setup(blocked);run(before,a,20);run(after,b,20);const trials=[];
 for(let i=0;i<4;i++){
  const beforeMs=run(before,a,blocked?30:500),afterMs=run(after,b,blocked?30:500);
  if(JSON.stringify(a.citizens)!==JSON.stringify(b.citizens))throw Error('Crowd routes or state changed');
  trials.push({beforeMs,afterMs,reduction:1-afterMs/beforeMs});
 }
 console.log(JSON.stringify({baseline,current,population:1024,blocked,identicalState:true,trials}));
}
