// Deterministic CPU workloads. Optional second argument points at a comparison checkout.
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const mode=process.argv[2]||'simulation';
const root=process.argv[3]?resolve(process.argv[3]):fileURLToPath(new URL('../',import.meta.url));
const moduleAt=name=>import(pathToFileURL(resolve(root,'js',name)).href);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

if(mode==='scene'){
  const {setActiveEntities,getEntitiesInViewport,getEntityById}=await moduleAt('engine.js');
  const entities=Array.from({length:10000},(_,id)=>({id,x:id%256,y:Math.floor(id/256),properties:{}}));
  for(let i=0;i<100;i++)setActiveEntities(entities);
  const start=performance.now();for(let i=0;i<1000;i++)setActiveEntities(entities);
  const staticMs=performance.now()-start;
  const movedAt=performance.now();for(let i=0;i<200;i++){for(let j=0;j<256;j++)entities[j].x+=.25;setActiveEntities(entities);}
  const movingMs=performance.now()-movedAt;
  const views=[];for(let x=0;x<256;x+=16)views.push(getEntitiesInViewport(x,x+20,0,64).map(e=>e.id).sort((a,b)=>a-b));
  // Include resizing, replacement and removal in the observed scene signature.
  entities[300]={id:300,x:300,y:300,properties:{cityBuilding:{width:40,depth:30}}};entities[301].destroyed=true;entities.splice(302,1);setActiveEntities(entities);
  views.push(getEntitiesInViewport(320,340,320,340).map(e=>e.id),[getEntityById(301),getEntityById(302)]);
  console.log(JSON.stringify({mode,root,entities:entities.length,staticMs,movingMs,checksum:hash(views)}));
}else if(mode==='simulation'||mode==='snapshots'){
  const {CitySimulation}=await moduleAt('city_simulation.js'),{WorldClock}=await moduleAt('world.js');
  const tiles=new Uint8Array(128*128),entities=[];let id=0;
  const world={width:128,height:128,revision:0,spawnCenter:{x:64,y:64},clock:new WorldClock(),getTile(x,y){return tiles[y*128+x];},setTile(x,y,t){tiles[y*128+x]=t;this.revision++;}};
  const city=new CitySimulation({world,population:256,seed:1337,createEntity:data=>{const entity={id:++id,destroyed:false,...data};entities.push(entity);return entity;}});city.initialize();
  if(mode==='snapshots'){
    const {CityStateGraph}=await moduleAt('city_state.js'),graph=new CityStateGraph(),state={city,entities,nextId:id+1};graph.encode(state);
    const samples=[];
    for(let i=0;i<30;i++){for(let n=0;n<6;n++)city.update(1/6);const start=performance.now(),packet=graph.encode(state);samples.push({ms:performance.now()-start,nodes:packet.nodes.length,bytes:Buffer.byteLength(JSON.stringify(packet))});}
    const mean=key=>samples.reduce((n,s)=>n+s[key],0)/samples.length;
    console.log(JSON.stringify({mode,root,samples:samples.length,encodeMs:mean('ms'),changedNodes:mean('nodes'),bytes:mean('bytes')}));
  }else{
    const times=[],start=performance.now();for(let i=0;i<360;i++){const at=performance.now();city.update(1/6);times.push(performance.now()-at);}const ms=performance.now()-start;times.sort((a,b)=>a-b);
    const state={minute:city.minute,citizens:city.citizens.map(c=>({id:c.id,needs:c.needs,activity:c.activity,task:c.task,happiness:c.happiness,x:c.entity.x,y:c.entity.y,balance:c.balance,home:c.homeUnitId,job:c.jobId})),accounts:[...city.accounts].map(([k,a])=>[k,a.balance]),history:city.history.nextId,events:city.events,relations:[...city.society.relations]};
    console.log(JSON.stringify({mode,root,population:city.citizens.length,updates:times.length,ms,p50:times[180],p95:times[342],max:times.at(-1),checksum:hash(state)}));
  }
}else throw Error('Use simulation, scene or snapshots.');
