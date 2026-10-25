// Deterministic CPU workloads. Optional second argument points at a comparison checkout.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const mode=process.argv[2]||'simulation';
const root=process.argv[3]?resolve(process.argv[3]):fileURLToPath(new URL('../',import.meta.url));
const population=Math.max(1,Number(process.env.SUBURBAN_BENCH_POPULATION)||256);
const moduleAt=name=>import(pathToFileURL(resolve(root,'js',name)).href);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

if(mode==='city-render'){
  // CPU synchronization only: existing farm meshes, no GPU driver or shader work.
  const {syncCityBuildings}=await moduleAt('city_renderer_3d.js');
  const renderer={scene:{add(){},remove(){}},cityLampLights:Array.from({length:8},()=>({intensity:0})),cityMeshes:new Map()};
  const rendererSource=readFileSync(resolve(root,'js/city_renderer_3d.js'),'utf8'),oldSignature=rendererSource.includes('b.units.filter');
  const entities=Array.from({length:500},(_,id)=>{const units=Array.from({length:100},(_,n)=>({id:`${id}:${n}`,roomType:n===0?'bathroom':n===1?'dining':'workspace',x:n%10,y:Math.floor(n/10),z:0}));const b={type:'farm',crop:'milho',constructionKind:'open-air',width:10,depth:10,units,layoutRevision:1,rotation:0};
    const signature=rendererSource.includes('retail-v2:')?`retail-v2:farm:10:10:milho:1:100:0`:oldSignature?`${b.crop}:${units.filter(u=>['bathroom','dining'].includes(u.roomType)).map(u=>u.id+u.roomType).join(',')}`:`${b.crop}:1:100`;
    renderer.cityMeshes.set(id,{visible:true,position:{set(){}},userData:{signature,terrainRevision:0,highlight:{visible:false},patches:{material:{emissive:{setHex(){}}}}}});
    return {id,x:id%20*12,y:Math.floor(id/20)*12,properties:{cityBuilding:b}};
  });
  const world={revision:0,map:[],cityLampPosts:[],cityLampSites:[]};
  for(let i=0;i<20;i++)syncCityBuildings(renderer,{},entities,world);
  const start=performance.now();for(let i=0;i<300;i++)syncCityBuildings(renderer,{},entities,world);
  console.log(JSON.stringify({mode,root,buildings:500,spaces:50000,frames:300,ms:performance.now()-start,checksum:hash([...renderer.cityMeshes].map(([id,g])=>[id,g.visible,g.userData.highlight.visible]))}));
}else if(mode==='scene'){
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
}else if(mode==='simulation'||mode==='snapshots'||mode==='bridge'||mode==='throughput'){
  const {CitySimulation}=await moduleAt('city_simulation.js'),{WorldClock}=await moduleAt('world.js');
  const tiles=new Uint8Array(128*128),entities=[];let id=0;
  const world={width:128,height:128,revision:0,spawnCenter:{x:64,y:64},clock:new WorldClock(),getTile(x,y){return tiles[y*128+x];},setTile(x,y,t){tiles[y*128+x]=t;this.revision++;}};
  const city=new CitySimulation({world,population,seed:1337,createEntity:data=>{const entity={id:++id,destroyed:false,...data};entities.push(entity);return entity;}});city.initialize();
  if(mode==='throughput'){
    const {CityStateGraph}=await moduleAt('city_state.js'),graph=new CityStateGraph(),state={city,entities,nextId:id+1};graph.encode(state);
    const stateInterval=Math.max(100,Number(process.env.SUBURBAN_BENCH_STATE_INTERVAL)||400);
    let snapshots=0,encodeMs=0,lastSnapshot=performance.now(),started=lastSnapshot;const snapshotCosts=[];
    for(let i=0;i<240;i++){
      city.update(.25);
      if(performance.now()-lastSnapshot>=stateInterval){const at=performance.now(),packet=graph.encode(state,{packNeeds:true,packPositions:true}),encodedAt=performance.now();structuredClone(packet);const cost=performance.now()-at;encodeMs+=cost;snapshots++;const kinds={};for(const node of packet.nodes)kinds[node.kind]=(kinds[node.kind]||0)+1;snapshotCosts.push({minute:city.minute,ms:cost,encodeMs:encodedAt-at,cloneMs:cost-(encodedAt-at),nodes:packet.nodes.length,objects:graph.objects.size,kinds});lastSnapshot=performance.now();}
    }
    const ms=performance.now()-started;
    console.log(JSON.stringify({mode,root,population:city.citizens.length,cityMinutes:240,ms,stateInterval,snapshots,encodeMs,snapshotCosts,speed:60/(ms/1000),targetMs:1875}));
  }else if(mode==='snapshots'||mode==='bridge'){
    const {CityStateGraph,bindCityState}=await moduleAt('city_state.js'),graph=new CityStateGraph(),mirror=new CityStateGraph(),state={city,entities,nextId:id+1};let reflected=mirror.apply(structuredClone(graph.encode(state)));bindCityState(reflected.city);
    let bridge;
    if(mode==='bridge'){const {CitySimulationBridge}=await moduleAt('city_sim_bridge.js');bridge=new CitySimulationBridge({city:reflected.city,entities:reflected.entities,nextId:state.nextId,time:{paused:false},changed(){},notice(){}});bridge.active=true;bridge.graph=mirror;bridge.worker={postMessage(){}};}
    const samples=[];
    for(let i=0;i<30;i++){for(let n=0;n<6;n++)city.update(1/6);const start=performance.now(),packet=graph.encode(state,{packNeeds:true,packPositions:true});const encodeMs=performance.now()-start,positions=new Float64Array(city.citizens.length*3);for(let j=0;j<city.citizens.length;j++){const c=city.citizens[j],at=j*3;positions[at]=c.id;positions[at+1]=c.entity.x;positions[at+2]=c.entity.y;}const copy=structuredClone(packet),applyAt=performance.now();if(bridge){bridge.receive({type:'state',packet:copy,positions,tick:i,elapsed:i,workMs:encodeMs});bridge.interpolate(performance.now()+40);}else{reflected=mirror.apply(copy);for(let j=0;j<reflected.city.citizens.length;j++){const c=reflected.city.citizens[j],at=j*3;if(positions[at]===c.id){c.entity.x=positions[at+1];c.entity.y=positions[at+2];}}bindCityState(reflected.city);}samples.push({ms:encodeMs,applyMs:performance.now()-applyAt,nodes:packet.nodes.length,bytes:Buffer.byteLength(JSON.stringify(packet))});}
    if(bridge)bridge.interpolate(performance.now()+1000);
    const mean=key=>samples.reduce((n,s)=>n+s[key],0)/samples.length;
    console.log(JSON.stringify({mode,root,samples:samples.length,encodeMs:mean('ms'),changedNodes:mean('nodes'),bytes:mean('bytes'),applyMs:mean('applyMs'),checksum:hash(observed(city)),mirrorChecksum:hash(observed(reflected.city))}));
  }else{
    const dt=Math.max(1/60,Math.min(.25,Number(process.env.SUBURBAN_BENCH_DT)||1/6)),updates=Math.round(60/dt);
    const times=[],start=performance.now();for(let i=0;i<updates;i++){const at=performance.now();city.update(dt);times.push(performance.now()-at);}const ms=performance.now()-start;times.sort((a,b)=>a-b);
    const state={minute:city.minute,citizens:city.citizens.map(c=>({id:c.id,needs:c.needs,activity:c.activity,task:c.task,happiness:c.happiness,x:c.entity.x,y:c.entity.y,balance:c.balance,home:c.homeUnitId,job:c.jobId})),accounts:[...city.accounts].map(([k,a])=>[k,a.balance]),history:city.history.nextId,events:city.events,relations:[...city.society.relations]};
    console.log(JSON.stringify({mode,root,population:city.citizens.length,dt,updates:times.length,ms,p50:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],max:times.at(-1),checksum:hash(state)}));
  }
}else throw Error('Use simulation, snapshots, bridge, throughput, scene or city-render.');

function observed(city){return {minute:city.minute,seed:city.seed,citizens:city.citizens.map(c=>({id:c.id,needs:c.needs,task:c.task,action:c.action,balance:c.balance,x:c.entity.x,y:c.entity.y,home:c.homeUnitId,job:c.jobId})),accounts:[...city.accounts].map(([id,a])=>[id,a.balance]),buildings:city.buildings.map(b=>({id:b.id,type:b.type,stock:b.inventory,workers:b.workers})),events:city.events.map(e=>e.id),relations:[...city.society.relations]};}
