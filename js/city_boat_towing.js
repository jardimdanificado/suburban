import {planSharedCrossing,joinSharedCrossing,beginSharedCrossing,advanceSharedPassenger,prepareSharedDeparture,syncSharedCrossing,finishSharedCrossing} from './city_boat_crossings.js?v=shared-crossings-1';
import {BOAT_CLASSES} from './boat_types.js?v=local-sea-travel-2';
import {TILE_WATER} from './world_gen.js?v=terrain-generation-reset-2-map-default-128';
import {findTerrainPath,canStep,tileHeight,tileAt,roadTravelCost,ROAD_TILES,surfaceElevation} from './city_terrain.js?v=entrance-retaining-clearance-1';

export const BOAT_TOW_RULES=Object.freeze({canoe:{bikes:['bicicleta','bicicleta_carga'],speed:2.8},launch:{bikes:['bicicleta_carga'],speed:1.8}});
const directions=[[1,0],[0,1],[-1,0],[0,-1]];
const water=(city,x,y)=>city.world.getTile(Math.floor(x),Math.floor(y))===TILE_WATER;
const free=v=>v.active&&!v.scrapped&&!v.worldFleetReserved&&!v.worldMigrationPending&&!v.driverId&&!v.transportCitizenId&&!v.mechanicId&&!v.paintJobId&&!v.serviceBodyId&&!v.policeRecoveryOfficerId&&!v.localTripCitizenId&&!v.fishingCitizenId;
export function boatAccessAccounts(city,person){return new Set([person.accountId,city.building?.(person.jobId)?.accountId,...(person.businessIds||[]).map(id=>city.building?.(id)?.accountId)].filter(Boolean));}
const speed=(city,mode,boat,bike,point)=>mode==='sail'||mode==='pickup'?4*BOAT_CLASSES[boat.boatClass].speed:mode==='tow'?BOAT_TOW_RULES[boat.boatClass].speed/roadTravelCost(tileAt(city.world,Math.floor(point.x),Math.floor(point.y))):mode==='cycle'?(ROAD_TILES.has(tileAt(city.world,Math.floor(point.x),Math.floor(point.y)))?(bike.good==='bicicleta'?8:6.5):4)/roadTravelCost(tileAt(city.world,Math.floor(point.x),Math.floor(point.y))):4/roadTravelCost(tileAt(city.world,Math.floor(point.x),Math.floor(point.y)));
export function boatRouteTime(city,start,path){
 if(path===null)return Infinity;
 const plan=path[0]?.boatPlan;if(plan)return plan.seconds;
 let total=0,previous=start;
 for(const point of path){total+=Math.hypot(point.x-previous.x,point.y-previous.y)*roadTravelCost(tileAt(city.world,Math.floor(point.x),Math.floor(point.y)))/4;previous=point;}
 return total;
}
function landRoute(city,start,goal,mode){
 const path=findTerrainPath(city.world,start,goal,city.occupied,{preferRoads:false});
 if(path===null)return null;
 const points=path.map(p=>({...p,transportMode:mode}));
 if(!points.length||Math.hypot(points.at(-1).x-goal.x,points.at(-1).y-goal.y)>.001)points.push({x:goal.x,y:goal.y,transportMode:mode});
 return points;
}
function prefixTime(city,start,path,boat,bike){let seconds=0,previous=start;for(const point of path){seconds+=Math.hypot(point.x-previous.x,point.y-previous.y)/speed(city,point.transportMode,boat,bike,point);previous=point;}return seconds;}
// A hull needs its full width and length, including the stern, clear of buildings and cliffs.
export function boatTowClear(city,boat,x,y,dx,dy){
 const length=boat.pickLength||2.8,width=boat.pickWidth||.75,centerHeight=tileHeight(tileAt(city.world,Math.floor(x),Math.floor(y)));
 for(let along=-length/2;along<=length/2+.001;along+=length/4)for(const across of [-width/2,0,width/2]){
  const px=x+dx*along+dy*across,py=y+dy*along-dx*across,tx=Math.floor(px),ty=Math.floor(py);
  if(tx<0||ty<0||tx>=city.world.width||ty>=city.world.height)return false;
  if(!water(city,px,py)&&(!city.walkable(tx,ty)||Math.abs(tileHeight(tileAt(city.world,tx,ty))-centerHeight)>1.25))return false;
 }
 return true;
}
// Shore access is optional. Inland sellers and workshops keep boats in a clear outdoor yard.
export function boatLandParking(city,building,boat){
 const origin=building.door,candidates=[];
 for(let radius=1;radius<=6;radius++)for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
  if(Math.max(Math.abs(dx),Math.abs(dy))!==radius)continue;
  const x=Math.floor(origin.x)+dx+.5,y=Math.floor(origin.y)+dy+.5;
  if(!city.walkable(Math.floor(x),Math.floor(y))||water(city,x,y)||!boatTowClear(city,boat,x,y,1,0))continue;
  if([...city.vehicles.units.values()].some(v=>v!==boat&&v.boatClass&&!v.scrapped&&Number.isFinite(v.x)&&Math.hypot(v.x-x,v.y-y)<((v.pickLength||2.6)+(boat.pickLength||2.6))/2+.25))continue;
  candidates.push({x,y});
 }
 return candidates.sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y))[0]||null;
}
function push(heap,cost,key){let i=heap.length;heap.push([cost,key]);while(i){const parent=(i-1)>>1;if(heap[parent][0]<=cost)break;heap[i]=heap[parent];i=parent;}heap[i]=[cost,key];}
function pop(heap){const root=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1][0]<heap[child][0])child++;if(heap[child][0]>=last[0])break;heap[i]=heap[child];i=child;}heap[i]=last;}return root;}
// Owned rigs may launch, land and relaunch without a port. Other boats stay afloat after disembarkation.
function crossingRoute(city,boat,bike,goal,{relocate=false,limitSeconds=Infinity}={}){
 const {width,height}=city.world,size=width*height,sx=Math.floor(boat.x),sy=Math.floor(boat.y),gx=Math.floor(goal.x),gy=Math.floor(goal.y);
 if([sx,gx].some(x=>x<0||x>=width)||[sy,gy].some(y=>y<0||y>=height))return null;
 const towing=!!bike,start=sy*width+sx,goalCell=gy*width+gx,startedWater=water(city,boat.x,boat.y);
 if(!towing&&!startedWater)return null;
 const costs=new Float64Array(size*2).fill(Infinity),parents=new Int32Array(size*2).fill(-1),heap=[];
 // Tow state records whether water was used. Ferry state records whether the passenger has landed.
 const root=start+(towing&&startedWater?size:0);costs[root]=0;push(heap,0,root);let target=-1,visited=0;
 while(heap.length&&visited++<60000){
  const [cost,key]=pop(heap);if(cost!==costs[key]||cost>limitSeconds)continue;
  const cell=key%size,flag=key>=size,x=cell%width,y=Math.floor(cell/width),fromWater=water(city,x,y);
  if(cell===goalCell&&(relocate||!towing||flag)){target=key;break;}
  for(const [dx,dy]of directions){
   const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;
   const toWater=water(city,nx,ny);if(!toWater&&!city.walkable(nx,ny)||!towing&&flag&&toWater)continue;
   if(fromWater!==toWater){const landX=fromWater?nx:x,landY=fromWater?ny:y;if(tileHeight(tileAt(city.world,landX,landY))>1.25)continue;}
   else if(!toWater&&!canStep(city.world,x,y,nx,ny))continue;
   if(towing&&!toWater&&(!boatTowClear(city,boat,nx+.5,ny+.5,dx,dy)||!boatTowClear(city,boat,x+.5+dx*.5,y+.5+dy*.5,dx,dy)))continue;
   const nextFlag=towing?flag||toWater:flag||!toWater,next=ny*width+nx+(nextFlag?size:0),mode=toWater?'sail':towing?'tow':'walkAfter';
   const candidate=cost+1/speed(city,mode,boat,bike,{x:nx+.5,y:ny+.5})+(fromWater!==toWater?1.5:0);
   if(candidate>=costs[next])continue;costs[next]=candidate;parents[next]=key;push(heap,candidate,next);
  }
 }
 if(target<0)return null;
 const path=[];let waterSteps=0;
 for(let key=target;key!==root;key=parents[key]){const cell=key%size,x=cell%width+.5,y=Math.floor(cell/width)+.5,isWater=water(city,x,y);if(isWater)waterSteps++;path.push({x,y,transportMode:isWater?'sail':towing?'tow':'walkAfter',...(isWater?{boatClass:boat.boatClass}:{})});}
 if(waterSteps>BOAT_CLASSES[boat.boatClass].maxWaterTiles)return null;
 path.reverse();return {path,seconds:costs[target]};
}
function approaches(city,boat){
 if(!water(city,boat.x,boat.y))return [{x:boat.x,y:boat.y}];
 const x=Math.floor(boat.x),y=Math.floor(boat.y),result=[];
 for(const [dx,dy]of directions){const nx=x+dx,ny=y+dy;if(city.walkable(nx,ny)&&tileHeight(tileAt(city.world,nx,ny))<=1.25)result.push({x:nx+.5,y:ny+.5});}
 return result;
}
function computeBoatTrip(city,start,goal,{boat:fixedBoat=null,relocate=false,serviceAccountId=null,maxSeconds=Infinity,groundPath=null}={}){
 const person=start.properties?.citizen;if(!city.walkable(Math.floor(goal.x),Math.floor(goal.y))||!person||person.dead||person.localBoatTrip||person.sharedBoatRide||person.mobilityTrip||person.ridingVehicleId||person.boatClass||person.worldBoatCrew||person.custody||person.entity.destroyed)return null;
 const accounts=boatAccessAccounts(city,person);if(serviceAccountId)accounts.add(serviceAccountId);
 const load=Math.max(1,person.deliveryLoad||city.logistics?.shipments?.find(s=>s.id===person.deliveryId)?.quantity||1);
 const units=[...(city.vehicles?.units?.values()||[])],bikes=units.filter(v=>!v.boatClass&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&free(v)&&v.condition>15&&!v.passengerIds?.length&&accounts.has(v.possessorAccountId||v.ownerAccountId)&&['bicicleta','bicicleta_carga'].includes(v.good));
 const boats=(fixedBoat?[fixedBoat]:units.filter(v=>v.boatClass)).filter(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&free(v)&&BOAT_CLASSES[v.boatClass]?.capacity>=load&&(v.condition??100)>0).sort((a,b)=>Math.hypot(a.x-start.x,a.y-start.y)-Math.hypot(b.x-start.x,b.y-start.y)).slice(0,8);
 let best=null,bestSeconds=maxSeconds;
 for(const boat of boats){
  const owned=accounts.has(boat.ownerAccountId),towBikes=owned||serviceAccountId?bikes.filter(b=>BOAT_TOW_RULES[boat.boatClass]?.bikes.includes(b.good)):[];
  for(const bike of [null,...towBikes]){
   if(relocate&&!bike||bike&&BOAT_CLASSES[boat.boatClass].capacity<Math.max(2,load))continue;
   // The approach alone can disqualify a rig before running a graph search.
   if(Math.hypot(start.x-boat.x,start.y-boat.y)/8+Math.hypot(goal.x-boat.x,goal.y-boat.y)/(4*BOAT_CLASSES[boat.boatClass].speed)+2>=bestSeconds)continue;
   let prefix=null,prefixSeconds=Infinity;
   for(const approach of approaches(city,boat)){
    const toBike=bike?landRoute(city,start,bike,'walk'):[],from=bike||start,toBoat=landRoute(city,from,approach,bike?'cycle':'walk');if(!toBike||!toBoat)continue;
    const trial=[...toBike,...toBoat,{x:boat.x,y:boat.y,transportMode:'pickup',...(water(city,boat.x,boat.y)?{boatClass:boat.boatClass}:{})}],seconds=prefixTime(city,start,trial,boat,bike)+2;
    if(seconds<prefixSeconds){prefix=trial;prefixSeconds=seconds;}
   }
   if(!prefix||prefixSeconds>=bestSeconds)continue;
   const crossing=crossingRoute(city,boat,bike,goal,{relocate,limitSeconds:bestSeconds-prefixSeconds});if(!crossing?.path.length)continue;
   let seconds=prefixSeconds+crossing.seconds;
   const path=[...prefix,...crossing.path];
   if(Math.hypot(path.at(-1).x-goal.x,path.at(-1).y-goal.y)>.001){const endpoint={x:goal.x,y:goal.y,transportMode:bike?'tow':'walkAfter'};seconds+=prefixTime(city,path.at(-1),[endpoint],boat,bike);path.push(endpoint);}
   if(seconds>=bestSeconds)continue;
   path[0]={...path[0],boatPlan:{boatId:boat.id,bikeId:bike?.id??null,boatX:boat.x,boatY:boat.y,bikeX:bike?.x,bikeY:bike?.y,goal:{x:goal.x,y:goal.y},seconds,serviceAccountId,relocate}};
   best=path;bestSeconds=seconds;
  }
 }
 // An available bicycle can already make the land detour faster than a boat.
 if(best&&groundPath?.some(point=>ROAD_TILES.has(tileAt(city.world,Math.floor(point.x),Math.floor(point.y))))){
  for(const bike of bikes){const approach=landRoute(city,start,bike,'walk'),ride=landRoute(city,bike,goal,'cycle');if(!approach||!ride)continue;
   if(prefixTime(city,start,approach,null,bike)+prefixTime(city,bike,ride,null,bike)<=bestSeconds)return null;
  }
 }
 return best;
}

const boatPlanCaches=new WeakMap();
export function planBoatTrip(city,start,goal,options={}){
 const person=start.properties?.citizen;
 if(!city.walkable(Math.floor(goal.x),Math.floor(goal.y))||!person||person.dead||person.localBoatTrip||person.sharedBoatRide||person.mobilityTrip||person.ridingVehicleId||person.boatClass||person.worldBoatCrew||person.custody||person.entity.destroyed)return null;
 const shared=planSharedCrossing(city,start,goal,options.maxSeconds);if(shared)return shared;
 const vehicles=[...(city.vehicles?.units?.values()||[])];if(!vehicles.some(v=>v.boatClass&&free(v)))return null;
 const revision=`${city.minute}:${city.world.revision||0}:${city.structureRevision||0}:${city.obstacleRevision||0}:${city.occupied.size}`;
 let cache=boatPlanCaches.get(city);if(!cache||cache.revision!==revision){cache={revision,paths:new Map()};boatPlanCaches.set(city,cache);}
 const fleet=vehicles.filter(v=>v.boatClass||BOAT_TOW_RULES.canoe.bikes.includes(v.good)).map(v=>`${v.id},${v.good},${v.boatClass},${v.x},${v.y},${v.ownerAccountId},${v.possessorAccountId},${free(v)},${Math.floor(v.condition??100)},${v.passengerIds?.length||0}`).join(';');
 const load=person.deliveryLoad||city.logistics?.shipments?.find(s=>s.id===person.deliveryId)?.quantity||1;
 const key=`${person.id}:${[...boatAccessAccounts(city,person)].join(',')}:${load}:${start.x},${start.y}:${goal.x},${goal.y}:${options.boat?.id}:${options.relocate}:${options.serviceAccountId}:${options.maxSeconds}:${!!options.groundPath}:${fleet}`;
 if(cache.paths.has(key))return cache.paths.get(key)?.slice()||null;
 const path=computeBoatTrip(city,start,goal,options);if(cache.paths.size>=256)cache.paths.delete(cache.paths.keys().next().value);cache.paths.set(key,path);return path?.slice()||null;
}

const position=(city,v,x,y,angle)=>{v.distance=(v.distance||0)+Math.hypot(x-v.x,y-v.y);v.x=x;v.y=y;if(Number.isFinite(angle))v.angle=angle;v.altitude=surfaceElevation(city.world,x,y);if(v.entity){v.entity.x=x;v.entity.y=y;v.entity.altitude=v.altitude;}};
function safeLanding(city,boat,bike){
 const width=city.world.width,root=Math.floor(boat.y)*width+Math.floor(boat.x),queue=[root],previous=new Map([[root,-1]]);
 for(let head=0;head<queue.length&&head<60000;head++){
  const cell=queue[head],x=cell%width,y=Math.floor(cell/width);
  for(const [dx,dy]of directions){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=city.world.height)continue;const next=ny*width+nx;
   if(water(city,nx,ny)){if(!previous.has(next)){previous.set(next,cell);queue.push(next);}continue;}
   if(!city.walkable(nx,ny)||tileHeight(tileAt(city.world,nx,ny))>1.25||bike&&!boatTowClear(city,boat,nx+.5,ny+.5,dx,dy))continue;
   const route=[];for(let at=cell;at!==root;at=previous.get(at))route.push({x:at%width+.5,y:Math.floor(at/width)+.5,transportMode:'sail',boatClass:boat.boatClass});
   route.reverse();route.push({x:nx+.5,y:ny+.5,transportMode:bike?'tow':'walkAfter'});return route;
  }
 }
 return null;
}
export function releaseLocalBoatTrip(city,person,cancel=false){
 const trip=person.localBoatTrip;if(!trip)return;
 const boat=city.vehicles.units.get(trip.boatId),bike=city.vehicles.units.get(trip.bikeId);
 // A surviving passenger takes the shared hull to shore if its pilot dies.
 if(cancel&&(person.dead||person.entity.destroyed||person.custody)&&trip.sharedCrossing&&boat?.active&&!boat.scrapped&&trip.pickedUp&&water(city,boat.x,boat.y)){
  const group=trip.sharedCrossing,next=group.members.map(m=>city.society.citizen(m.citizenId)).find(c=>c&&!c.dead&&!c.entity.destroyed&&!c.custody&&c.sharedBoatRide?.state==='aboard'),landing=next&&safeLanding(city,boat,null);
  if(next&&landing){
   group.members=group.members.filter(m=>m.citizenId!==next.id);group.phase='sailing';
   next.sharedBoatRide=null;next.localBoatTrip=trip;next.path=landing;
   trip.position={x:boat.x,y:boat.y};trip.task=next.task;trip.targetId=next.targetId;trip.cancelAtShore=true;
   boat.localTripCitizenId=next.id;boat.driverId=next.id;boat.transportCitizenId=next.id;boat.passengerIds=(boat.passengerIds||[]).filter(id=>id!==next.id);
   for(const member of group.members){const c=city.society.citizen(member.citizenId);if(c?.sharedBoatRide)c.sharedBoatRide.leaderId=next.id;}
   person.localBoatTrip=null;person.boatClass=null;person.boatVehicleId=null;person.path=[];return;
  }
 }
 if(cancel&&boat?.active&&!boat.scrapped&&trip.pickedUp&&!person.entity.destroyed&&!person.dead&&!person.custody&&water(city,boat.x,boat.y)){
  const landing=safeLanding(city,boat,bike);
  if(landing){person.path=landing;trip.position={x:boat.x,y:boat.y};trip.task=person.task;trip.targetId=person.targetId;trip.cancelAtShore=true;return;}
 }
 finishSharedCrossing(city,person);
 for(const vehicle of [boat,bike])if(vehicle?.localTripCitizenId===person.id){vehicle.localTripCitizenId=null;vehicle.driverId=null;vehicle.transportCitizenId=null;vehicle.towedByVehicleId=null;vehicle.towedBoatId=null;vehicle.ferrying=false;vehicle.journey=null;vehicle.status=vehicle.boatClass?(water(city,vehicle.x,vehicle.y)?'Atracado após a viagem':'Embarcação em terra'):'Bicicleta estacionada';}
 if(person.boatTowService){const resume=person.boatTowService;if(person.task==='boat-tow-service'){person.task=resume.task;person.targetId=resume.targetId;}person.boatTowService=null;}
 person.localBoatTrip=null;person.boatClass=null;person.boatVehicleId=null;person.ridingVehicleId=null;person.ridingVehicleKind=null;person.towedBoatId=null;person.towBikeId=null;
 if(cancel||trip.cancelAtShore){person.path=[];person.task=null;}
}
function startTrip(city,person,plan){
 const boat=city.vehicles.units.get(plan.boatId),bike=plan.bikeId!=null?city.vehicles.units.get(plan.bikeId):null;
 const accounts=boatAccessAccounts(city,person);if(plan.serviceAccountId)accounts.add(plan.serviceAccountId);
 const load=Math.max(bike?2:1,person.deliveryLoad||city.logistics?.shipments?.find(s=>s.id===person.deliveryId)?.quantity||1);
 if(!boat||!free(boat)||!(BOAT_CLASSES[boat.boatClass]?.capacity>=load)||(boat.condition??100)<=0||bike&&!accounts.has(boat.ownerAccountId)&&!plan.serviceAccountId||Math.hypot(boat.x-plan.boatX,boat.y-plan.boatY)>.1||plan.bikeId!=null&&(!bike||!free(bike)||bike.condition<=15||!accounts.has(bike.possessorAccountId||bike.ownerAccountId)||!BOAT_TOW_RULES[boat.boatClass]?.bikes.includes(bike.good)||Math.hypot(bike.x-plan.bikeX,bike.y-plan.bikeY)>.1))return false;

 for(const v of [boat,bike])if(v){v.localTripCitizenId=person.id;v.driverId=person.id;delete v.waterRoute;delete v.waterRouteIndex;}
 person.localBoatTrip={...plan,position:{x:person.entity.x,y:person.entity.y},task:person.task,targetId:person.targetId,pickedUp:false};
 const shared=beginSharedCrossing(city,person,boat,plan);
 if(!shared&&!accounts.has(boat.ownerAccountId)&&boat.ownerAccountId!==city.worldPort?.accountId&&!plan.serviceAccountId){const fare=city.currency.price(BOAT_CLASSES[boat.boatClass].capacity>=8?45:20);if(!city.transfer(city.payerFor(person),boat.ownerAccountId,fare,'Travessia local de barco',{vehicleId:boat.id,citizenId:person.id})){releaseLocalBoatTrip(city,person,true);return false;}}
 return true;
}
function lookAhead(city,position,path,distance){let previous=position;for(const point of path){if(water(city,point.x,point.y))break;const length=Math.hypot(point.x-previous.x,point.y-previous.y);if(length>=distance){const ratio=distance/(length||1);return {x:previous.x+(point.x-previous.x)*ratio,y:previous.y+(point.y-previous.y)*ratio};}distance-=length;previous=point;}return previous;}
export function advanceLocalBoatTrip(city,person,dt){
 if(person.sharedBoatRide)return advanceSharedPassenger(city,person,dt);
 const shared=person.path?.[0]?.boatPlan;
 if(shared?.sharedTripCitizenId!=null){if(!joinSharedCrossing(city,person,shared)){person.path=[];person.task=null;return true;}return advanceSharedPassenger(city,person,dt);}
 if(!person.localBoatTrip){const plan=person.path?.[0]?.boatPlan;if(!plan)return false;if(!startTrip(city,person,plan)){person.path=[];person.task=null;return true;}}
 const trip=person.localBoatTrip,boat=city.vehicles.units.get(trip.boatId),bike=trip.bikeId!=null?city.vehicles.units.get(trip.bikeId):null;
 if(person.entity.destroyed||person.dead||person.custody||person.task!==trip.task||person.targetId!==trip.targetId||!boat||!boat.active||boat.scrapped||boat.localTripCitizenId!==person.id||bike&&(!bike.active||bike.scrapped||bike.condition<=15||bike.localTripCitizenId!==person.id)||!person.path?.length||!person.path[0].transportMode){releaseLocalBoatTrip(city,person,true);return true;}
 let remaining=Math.max(0,dt),guard=0;
 while(remaining>0&&person.path.length&&guard++<512){
  const point=person.path[0],mode=point.transportMode,from=trip.position,dx=point.x-from.x,dy=point.y-from.y,len=Math.hypot(dx,dy),isWater=water(city,point.x,point.y),tx=Math.floor(point.x),ty=Math.floor(point.y);
  if(isWater&&!['pickup','sail'].includes(mode)||!isWater&&!city.walkable(tx,ty)||mode==='sail'&&!isWater||mode==='tow'&&(!bike||!boatTowClear(city,boat,point.x,point.y,Math.abs(dx)>=Math.abs(dy)?Math.sign(dx)||1:0,Math.abs(dy)>Math.abs(dx)?Math.sign(dy):0))){releaseLocalBoatTrip(city,person,true);return true;}
  if(mode==='sail'&&trip.sharedCrossing?.phase==='boarding'){
   const departure=prepareSharedDeparture(city,person,remaining);remaining=departure.remaining;
   if(departure.cancel){releaseLocalBoatTrip(city,person,true);return true;}
   if(!departure.ready)break;
  }
  const waitKey=`${mode}:${point.x},${point.y}`;
  if(trip.waitKey!==waitKey){trip.waitKey=waitKey;trip.waitSeconds=mode==='pickup'?2:water(city,from.x,from.y)!==isWater?1.5:0;}
  if(trip.waitSeconds>0){const wait=Math.min(remaining,trip.waitSeconds);remaining-=wait;trip.waitSeconds-=wait;if(remaining<=0)break;}
  const velocity=speed(city,mode,boat,bike,point),travel=Math.min(len,remaining*velocity),angle=len>.00001?Math.atan2(dx,dy):boat.angle||0;
  if(travel>0)person.lastProgressAt=city.minute;
  if(len>0){from.x+=dx/len*travel;from.y+=dy/len*travel;}remaining-=travel/velocity;
  if(len<=travel+.00001){from.x=point.x;from.y=point.y;person.path.shift();if(mode==='pickup')trip.pickedUp=true;}
  person.entity.x=from.x;person.entity.y=from.y;
  person.boatClass=null;person.boatVehicleId=null;person.ridingVehicleId=null;person.ridingVehicleKind=null;person.towedBoatId=null;person.towBikeId=null;
  if((mode==='cycle'||mode==='pickup')&&bike){position(city,bike,from.x,from.y,angle);person.ridingVehicleId=bike.id;person.ridingVehicleKind=bike.good;}
  if(trip.pickedUp&&['tow','sail','pickup'].includes(mode)){
   position(city,boat,from.x,from.y,angle);
   if(mode==='sail'||isWater){person.boatClass=boat.boatClass;person.boatVehicleId=boat.id;boat.transportCitizenId=person.id;boat.towedByVehicleId=null;if(bike){position(city,bike,from.x,from.y,angle);bike.ferrying=true;person.ridingVehicleId=bike.id;person.ridingVehicleKind=bike.good;}}
   else if(bike){
    trip.hitchExtension=Math.min((boat.pickLength||2.8)/2+.65,(trip.hitchExtension||0)+travel);
    const front=lookAhead(city,from,person.path,trip.hitchExtension);position(city,bike,front.x,front.y,angle);person.entity.x=bike.x;person.entity.y=bike.y;person.ridingVehicleId=bike.id;person.ridingVehicleKind=bike.good;person.towedBoatId=boat.id;person.towBikeId=bike.id;boat.towedByVehicleId=bike.id;boat.transportCitizenId=null;bike.ferrying=false;bike.towedBoatId=boat.id;
   }
   boat.status=mode==='tow'?'Guinchado por bicicleta':'Em travessia local';
  }
  syncSharedCrossing(city,person,{landed:mode==='walkAfter'&&len<=travel+.00001});
  person.action=mode==='walk'?'Indo buscar embarcação':mode==='cycle'?'Indo engatar embarcação':mode==='tow'?'Guinchando embarcação por terra':mode==='sail'?'Atravessando de barco':'Desembarcando';
  if(!person.path.length){releaseLocalBoatTrip(city,person);break;}
 }
 return true;
}
