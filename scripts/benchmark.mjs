// Deterministic CPU workloads. Optional second argument points at a comparison checkout.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const mode=process.argv[2]||'simulation';
const root=process.argv[3]?resolve(process.argv[3]):fileURLToPath(new URL('../',import.meta.url));
const population=Math.max(1,Number(process.env.SUBURBAN_BENCH_POPULATION)||256);
const mapSize=Math.max(128,Math.min(1024,Number(process.env.SUBURBAN_BENCH_MAP_SIZE)||128));
const warmupMinutes=Math.max(0,Math.floor(Number(process.env.SUBURBAN_BENCH_WARMUP_MINUTES)||0));
const moduleAt=name=>import(pathToFileURL(resolve(root,'js',name)).href);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

if(mode==='builder-selection'){
  const {CityDevelopment}=await moduleAt('city_development.js');
  const businesses=Array.from({length:12},(_,i)=>({id:i+1,type:'builder',accountId:`business:${i+1}`,door:{x:i,y:0}}));
  const city={minute:480,economy:{businesses,mayorId:7,connected:()=>true},reputation:{providerPenalty:b=>b.id%4}},development=new CityDevelopment(city);
  development.projects=Array.from({length:1000},(_,i)=>({builderId:i%12+1,cancelled:i%7===0,status:i%5===0?'completed':'materials'}));
  const choices=[],started=performance.now();for(let i=0;i<1000;i++)choices.push(development.selectBuilder('treasury',{x:20,y:20}).id);
  console.log(JSON.stringify({mode,root,ms:performance.now()-started,selections:choices.length,checksum:hash(choices)}));
}else if(mode==='building-sites'){
  const terrain=await moduleAt('city_terrain.js');let reads=0,seed=123,randomCalls=0;
  const city={world:{width:128,height:128,revision:0,getTile(x,y){reads++;return x>=0&&y>=0&&x<128&&y<128?0:5;}},occupied:new Set(),obstacleRevision:0,buildings:[{entity:{destroyed:false},door:{x:10.5,y:10.5}}],development:{plots:[],overlaps(){return false;}},random(){randomCalls++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}};
  const started=performance.now(),finish=terrain.beginBuildingSiteSearch?.(city)||(()=>{}),sites=[];
  try{for(let i=0;i<500;i++)sites.push(terrain.chooseBuildingSite(city,35+(i%10)*6,40,4,4,{plotId:i%10,type:['market','bakery','cleaner','clinic'][i%4]}));}finally{finish();}
  console.log(JSON.stringify({mode,root,ms:performance.now()-started,reads,randomCalls,seed,checksum:hash(sites)}));
}else if(mode==='city-render'){
  // CPU synchronization only: existing farm meshes, no GPU driver or shader work.
  const {syncCityBuildings}=await moduleAt('city_renderer_3d.js');
  const {setActiveEntities}=await moduleAt('engine.js');
  // Static detail batching now creates shared InstancedMeshes even in this
  // CPU-only workload. Supply the small Three.js surface it exercises.
  class BenchmarkInstancedMesh{constructor(geometry,material,count){this.geometry=geometry;this.material=material;this.count=0;this.instanceMatrix={count,needsUpdate:false};this.userData={};}setMatrixAt(){}}
  const THREE={BoxGeometry:class{},MeshLambertMaterial:class{},InstancedMesh:BenchmarkInstancedMesh,Matrix4:class{constructor(){this.elements=new Array(16).fill(0);}makeScale(){return this;}setPosition(){return this;}}};
  const renderer={scene:{add(){},remove(){}},cityLampLights:Array.from({length:8},()=>({intensity:0})),cityMeshes:new Map(),renderedMinTx:30,renderedMaxTx:90,renderedMinTy:10,renderedMaxTy:55,cardboardVisualSignature:'0',cardboardVisuals:{children:[]}};
  const rendererSource=readFileSync(resolve(root,'js/city_renderer_3d.js'),'utf8'),oldSignature=rendererSource.includes('b.units.filter');
  const buildings=[],entities=Array.from({length:500},(_,id)=>{const units=Array.from({length:100},(_,n)=>({id:`${id}:${n}`,roomType:n===0?'bathroom':n===1?'dining':'workspace',x:n%10,y:Math.floor(n/10),z:0}));const b={id,type:'farm',crop:'milho',constructionKind:'open-air',width:10,depth:10,units,layoutRevision:1,rotation:0};
    const signature=rendererSource.includes('retail-v8-fruit-stalls:')?`retail-v8-fruit-stalls:farm:10:10:milho:1:100:0:0:`:rendererSource.includes('retail-v2:')?`retail-v2:farm:10:10:milho:1:100:0:0`:oldSignature?`${b.crop}:${units.filter(u=>['bathroom','dining'].includes(u.roomType)).map(u=>u.id+u.roomType).join(',')}`:`${b.crop}:1:100`;
    const detail=(kind,count)=>({id:`${kind}:${id}`,count,getMatrixAt(){}});
    renderer.cityMeshes.set(id,{visible:true,position:{x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}},userData:{signature,terrainRevision:0,cityBuilding:b,slab:{},supports:detail('supports',8),stairs:detail('stairs',6),interiorFloors:detail('interiorFloors',4),highlight:{visible:false},patches:{material:{emissive:{setHex(){}}}}}});
    const entity={id,x:id%20*12,y:Math.floor(id/20)*12,destroyed:false,properties:{cityBuilding:b}};b.entity=entity;buildings.push(b);return entity;
  });
  const citizens=Array.from({length:population},(_,id)=>({id:id+5000,entity:{x:id%128,y:id%64,destroyed:false},task:'idle'}));
  for(let id=0;id<3000;id++)entities.push({id:10000+id,x:id%256,y:Math.floor(id/256),destroyed:false,properties:{}});
  setActiveEntities(entities);renderer.cityDevelopment={plots:[],projects:[],city:{minute:0,cardboardShelters:new Map(),buildings,citizens}};
  const world={revision:0,map:[],cityLampPosts:[],cityLampSites:[]};
  // Keep static bridge geometry out of this CPU synchronization workload. The
  // benchmark renderer intentionally has no Three.js constructors or GPU.
  renderer.skybridgeRevision=`${entities.length}:${world.topologyRevision??world.revision??0}:${world.bridgeRevision??0}:colonial-3`;renderer.roadBridgeRevision=world.bridgeRevision||0;renderer.roadBridgeStyleVersion=3;
  // Warm a small viewport first, then grow it past the initial instance-buffer
  // capacity to exercise replacement without invalidating the Three.js test.
  Object.assign(renderer,{renderedMinTx:30,renderedMaxTx:42,renderedMinTy:10,renderedMaxTy:22});
  for(let i=0;i<5;i++)syncCityBuildings(renderer,THREE,entities,world);
  const initialSupportCapacity=renderer.supportsBatch?.instanceMatrix.count||0;
  Object.assign(renderer,{renderedMinTx:30,renderedMaxTx:90,renderedMinTy:10,renderedMaxTy:55});
  for(let i=0;i<20;i++)syncCityBuildings(renderer,THREE,entities,world);
  if(!(renderer.supportsBatch.instanceMatrix.count>initialSupportCapacity&&renderer.supportsBatch.count>initialSupportCapacity))throw Error('The city-render benchmark did not grow the support instance batch.');
  const start=performance.now();for(let i=0;i<300;i++)syncCityBuildings(renderer,THREE,entities,world);
  console.log(JSON.stringify({mode,root,buildings:500,citizens:citizens.length,entities:entities.length,spaces:50000,frames:300,ms:performance.now()-start,batchInstances:{supports:renderer.supportsBatch?.count||0,stairs:renderer.stairsBatch?.count||0,interiorFloors:renderer.interiorFloorsBatch?.count||0,slabs:renderer.buildingSlabBatch?.count||0,supportCapacity:renderer.supportsBatch?.instanceMatrix.count||0},checksum:hash([...renderer.cityMeshes].map(([id,g])=>[id,g.visible,g.userData.highlight.visible]))}));
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
  const visible=[];let viewportCount=0;for(let i=0;i<100;i++)getEntitiesInViewport(40,80,24,64,0,visible);
  const viewportStarted=performance.now();for(let i=0;i<10000;i++)viewportCount+=getEntitiesInViewport(40,80,24,64,0,visible).length;const viewportMs=performance.now()-viewportStarted;
  console.log(JSON.stringify({mode,root,entities:entities.length,staticMs,movingMs,viewportMs,viewportQueries:10000,viewportCount,viewportChecksum:hash(visible.map(e=>e.id)),checksum:hash(views)}));
}else if(mode==='freight'){
  // Movement updates with a large shipment history and active drivers. No time
  // advances, so this isolates lookup cost without changing delivery behavior.
  const {CitySimulation}=await moduleAt('city_simulation.js');
  const city=Object.create(CitySimulation.prototype),shipments=Array.from({length:4000},(_,i)=>({id:i+1,pickedUp:false,quantity:1}));
  const movers=Array.from({length:500},(_,i)=>({id:i+1,deliveryId:3501+i,entity:{x:0,y:0},path:[{x:1,y:0}],equipment:{},action:'Transportando'}));
  Object.assign(city,{accumulator:0,minute:480,_movingCitizens:movers,logistics:{shipments},vehicles:{activeCount:0,update(){}},society:{isAdult(){return true;}}});
  for(let i=0;i<10;i++)city.update(0);
  const started=performance.now();for(let i=0;i<100;i++)city.update(0);
  console.log(JSON.stringify({mode,root,drivers:movers.length,shipments:shipments.length,updates:100,ms:performance.now()-started,checksum:hash(movers.map(c=>[c.deliveryId,c.action,c.entity.x,c.entity.y,c.path]))}));
}else if(mode==='initialize'){
  const {CitySimulation}=await moduleAt('city_simulation.js'),{World}=await moduleAt('world.js');
  const entities=[];let id=0,started=performance.now();
  const world=new World(1,1337,mapSize),city=new CitySimulation({world,population,seed:1337,createEntity:data=>{const entity={id:++id,destroyed:false,...data};entities.push(entity);return entity;}});
  city.initialize();const ms=performance.now()-started;
  const signature={seed:city.seed,citizens:city.citizens.map(c=>[c.id,c.entity.properties.name,c.initialAge,c.bodyHeightCm,c.bodyWeightKg]),parties:city.politics.parties.map(p=>[p.id,p.name,p.slogan,p.ideology]),identity:city.municipalIdentity,entities:entities.length};
  console.log(JSON.stringify({mode,root,population:city.citizens.length,mapSize,ms,entities:entities.length,parties:city.politics.parties.length,checksum:hash(signature)}));
}else if(mode==='simulation'||mode==='snapshots'||mode==='bridge'||mode==='throughput'){
  const {CitySimulation}=await moduleAt('city_simulation.js'),{World}=await moduleAt('world.js');
  const entities=[];let id=0;
  // Real terrain and prototype exercise the same navigation and worker mirror as the game.
  const world=new World(1,1337,mapSize);
  const city=new CitySimulation({world,population,seed:1337,createEntity:data=>{const entity={id:++id,destroyed:false,...data};entities.push(entity);return entity;}});city.initialize();
  if(mode==='throughput'){
    const {CityStateGraph}=await moduleAt('city_state.js'),graph=new CityStateGraph(),state={city,entities,nextId:id+1};graph.encode(state);
    const defaultStateInterval=population>=1024?2200:population>=512?1500:400;
    const stateInterval=Math.max(100,Number(process.env.SUBURBAN_BENCH_STATE_INTERVAL)||defaultStateInterval);
    let snapshots=0,encodeMs=0,lastSnapshot=performance.now(),started=lastSnapshot,lastSnapshotCost=0;const snapshotCosts=[];
    for(let i=0;i<240;i++){
      city.update(.25);
      if(performance.now()-lastSnapshot>=Math.max(stateInterval,Math.min(3000,lastSnapshotCost*6))){const at=performance.now(),packet=graph.encode(state,{packNeeds:true,packPositions:true,omitCitizenPaths:true}),encodedAt=performance.now();lastSnapshotCost=encodedAt-at;structuredClone(packet);const cost=performance.now()-at;encodeMs+=cost;snapshots++;const kinds={};for(const node of packet.nodes)kinds[node.kind]=(kinds[node.kind]||0)+1;snapshotCosts.push({minute:city.minute,ms:cost,encodeMs:encodedAt-at,cloneMs:cost-(encodedAt-at),nodes:packet.nodes.length,objects:graph.objects.size,kinds});lastSnapshot=performance.now();}
    }
    const ms=performance.now()-started;
    console.log(JSON.stringify({mode,root,population:city.citizens.length,cityMinutes:240,ms,stateInterval,snapshots,encodeMs,snapshotCosts,speed:60/(ms/1000),targetMs:1875}));
  }else if(mode==='snapshots'||mode==='bridge'){
    for(let i=0;i<warmupMinutes;i++)city.update(.25);
    const {CityStateGraph,bindCityState}=await moduleAt('city_state.js'),graph=new CityStateGraph(),mirror=new CityStateGraph(),state={city,entities,nextId:id+1};let reflected=mirror.apply(structuredClone(graph.encode(state)));bindCityState(reflected.city);
    let bridge;
    if(mode==='bridge'){const {CitySimulationBridge}=await moduleAt('city_sim_bridge.js');bridge=new CitySimulationBridge({city:reflected.city,entities:reflected.entities,nextId:state.nextId,time:{paused:false},changed(){},notice(){}});bridge.active=true;bridge.graph=mirror;bridge.worker={postMessage(){}};}
    const samples=[];
    for(let i=0;i<30;i++){for(let n=0;n<6;n++)city.update(1/6);const start=performance.now(),packet=graph.encode(state,{packNeeds:true,packPositions:true,omitCitizenPaths:process.env.SUBURBAN_BENCH_COMPACT_PATHS==='1',fieldTailPatches:process.env.SUBURBAN_BENCH_TAIL_PATCHES==='1'});const encodeMs=performance.now()-start,positionStride=bridge?4:3,positions=new Float64Array(city.citizens.length*positionStride);for(let j=0;j<city.citizens.length;j++){const c=city.citizens[j],at=j*positionStride;positions[at]=c.id;positions[at+1]=c.entity.x;positions[at+2]=c.entity.y;if(bridge)positions[at+3]=c.path.length?1:0;}const copy=structuredClone(packet),applyAt=performance.now();if(bridge){bridge.receive({type:'state',packet:copy,positions,tick:i,elapsed:i,workMs:encodeMs});bridge.interpolate(performance.now()+40);}else{reflected=mirror.apply(copy);for(let j=0;j<reflected.city.citizens.length;j++){const c=reflected.city.citizens[j],at=j*3;if(positions[at]===c.id){c.entity.x=positions[at+1];c.entity.y=positions[at+2];}}bindCityState(reflected.city);}samples.push({ms:encodeMs,applyMs:performance.now()-applyAt,nodes:packet.nodes.length,bytes:Buffer.byteLength(JSON.stringify(packet)),tailPatches:packet.nodes.filter(node=>node.tailPatch).length});}
    if(bridge)bridge.interpolate(performance.now()+1000);
    const mean=key=>samples.reduce((n,s)=>n+s[key],0)/samples.length;
    console.log(JSON.stringify({mode,root,warmupMinutes,samples:samples.length,tailPatches:mean('tailPatches'),encodeMs:mean('ms'),changedNodes:mean('nodes'),bytes:mean('bytes'),applyMs:mean('applyMs'),checksum:hash(observed(city,!!bridge)),mirrorChecksum:hash(observed(reflected.city)),authoritativeChecksum:hash(observed(city)),visualChecksum:hash(visualState(city)),mirrorVisualChecksum:hash(visualState(reflected.city))}));
  }else{
    const dt=Math.max(1/60,Math.min(.25,Number(process.env.SUBURBAN_BENCH_DT)||1/6)),minutes=Math.max(1,Number(process.env.SUBURBAN_BENCH_MINUTES)||60),updates=Math.round(minutes/dt);
    const times=[],start=performance.now();for(let i=0;i<updates;i++){const at=performance.now();city.update(dt);times.push(performance.now()-at);}const ms=performance.now()-start;times.sort((a,b)=>a-b);
    const state={minute:city.minute,citizens:city.citizens.map(c=>({id:c.id,needs:c.needs,activity:c.activity,task:c.task,path:c.path,happiness:c.happiness,x:c.entity.x,y:c.entity.y,balance:c.balance,home:c.homeUnitId,job:c.jobId,interior:c.indoorLocation,career:c.career})),rooms:[...city.units.values()].map(u=>[u.id,u.activityReservedIds]),buildings:city.buildings.map(b=>({id:b.id,inventory:b.inventory,workers:b.workers})),shipments:city.logistics.shipments.map(s=>({id:s.id,status:s.status,driverId:s.driverId,quantity:s.quantity,position:s.position})),terrain:Array.from(city.world.map),accounts:[...city.accounts].map(([k,a])=>[k,a.balance]),history:city.history.nextId,events:city.events,relations:[...city.society.relations]};
    console.log(JSON.stringify({mode,root,population:city.citizens.length,dt,minutes,updates:times.length,ms,p50:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],max:times.at(-1),checksum:hash(state)}));
  }
}else throw Error('Use initialize, simulation, snapshots, bridge, throughput, freight, scene, building-sites, builder-selection or city-render.');

function observed(city,renderRiders=false){
  // The UI deliberately places passengers behind the vehicle center. Compare
  // its actual positions with that display contract; retain a separate hash
  // of the simulation's authoritative coordinates as well.
  const riderPositions=new Map();
  if(renderRiders)for(const v of city.vehicles?.units?.values()||[]){
    if(!v.entity)continue;const passengers=v.passengerIds||[],angle=v.angle||0;
    for(let i=-1;i<passengers.length;i++){
      const id=i<0?v.driverId:passengers[i],c=id!=null?city.society.citizen(id):null;
      if(!c||c.ridingVehicleId!==v.id)continue;
      const behind=i<0?0:(i+1)*.38;
      riderPositions.set(id,{x:v.entity.x-Math.sin(angle)*behind,y:v.entity.y-Math.cos(angle)*behind});
    }
  }
  return {minute:city.minute,seed:city.seed,citizens:city.citizens.map(c=>({id:c.id,needs:c.needs,task:c.task,action:c.action,balance:c.balance,x:riderPositions.get(c.id)?.x??c.entity.x,y:riderPositions.get(c.id)?.y??c.entity.y,home:c.homeUnitId,job:c.jobId,career:c.career,interior:c.indoorLocation})),rooms:[...city.units.values()].map(u=>[u.id,u.activityReservedIds]),accounts:[...city.accounts].map(([id,a])=>[id,a.balance]),buildings:city.buildings.map(b=>({id:b.id,type:b.type,stock:b.inventory,workers:b.workers})),ledger:city.ledger,events:city.events.map(e=>e.id),relations:[...city.society.relations]};}

function visualState(city){
  return city.citizens.map(c=>({id:c.id,height:c.bodyHeightCm,weight:c.bodyWeightKg,dead:c.dead,destroyed:c.entity.destroyed,render:c.entity.properties.render,
    wearing:[c.wearingIndex,c.lowerWearIndex,c.headwearIndex,c.footwearIndex,c.handwearIndex],basket:!!c.equipment?.cesta,
    wardrobe:(c.wardrobe||[]).map(g=>({piece:g.piece,color:g.color,printId:g.printId,artworkId:g.artworkId,artPrint:g.artPrint,dirt:g.dirt,garmentId:g.garmentId,partyNumber:g.partyNumber,partyFlag:g.partyFlag})),
    partyCap:c.political?.partyCapId,capGarment:c.campaign?.capGarmentId,flag:c.campaign?.partyFlag||c.campaign?.flag,presence:c.campaignPresence}));
}
