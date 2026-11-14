import {BOAT_CLASSES} from './boat_types.js?v=local-sea-travel-2';
import {findTerrainPath,settlementConnected} from './city_terrain.js?v=entrance-retaining-clearance-1';

export const CROSSING_RULES=Object.freeze({boardingSeconds:3,recruitRadius:10,maxCandidates:32,routeLimit:64});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const living=c=>c&&!c.entity.destroyed&&!c.dead&&!c.custody;
const ground=(city,from,to)=>findTerrainPath(city.world,from,to,city.occupied,{preferRoads:false});
const length=(from,path)=>{let total=0;for(const p of path){total+=distance(from,p);from=p;}return total;};
const accountAccess=(city,c,account)=>c.accountId===account||city.building?.(c.jobId)?.accountId===account||(c.businessIds||[]).some(id=>city.building?.(id)?.accountId===account);
export function crossingFare(city,boat,count){return Math.ceil(city.currency.price(BOAT_CLASSES[boat.boatClass].capacity>=8?45:20)/Math.max(1,count));}
function records(city){return city.vehicles.crossingRoutes??=[];}
function company(city,boat){return city.buildings?.find(b=>b.accountId===boat.ownerAccountId&&!b.entity.destroyed);}
function routeKey(boat,origin,landing){return `${boat.ownerAccountId}:${Math.floor(origin.x)},${Math.floor(origin.y)}:${Math.floor(landing.x)},${Math.floor(landing.y)}`;}
function remember(city,leader,boat,group){
 const routes=records(city),key=routeKey(boat,group.origin,group.landing);let route=routes.find(r=>r.key===key);
 if(!route){if(routes.length>=CROSSING_RULES.routeLimit)routes.shift();const business=company(city,boat),owner=city.accounts?.get(boat.ownerAccountId)?.entity?.properties?.citizen;
  routes.push(route={key,companyAccountId:boat.ownerAccountId,companyName:business?.entity.properties.name||city.accountName?.(boat.ownerAccountId)||'Travessias locais',organizerId:business?.ownerId??owner?.id??leader.id,boatId:boat.id,origin:{...group.origin},landing:{...group.landing},members:[],departures:0,revenue:0});}
 group.routeKey=key;return route;
}
function rememberMember(city,group,c,goal,task,targetId){
 const route=records(city).find(r=>r.key===group.routeKey);if(!route)return;
 let member=route.members.find(m=>m.citizenId===c.id);if(!member)route.members.push(member={citizenId:c.id});
 Object.assign(member,{goal:{...goal},task,targetId,jobId:c.jobId??null,homeUnitId:c.homeUnitId??null,lastUsedAt:city.minute,departureMinute:city.minute%1440});
 const home=city.building?.(city.units?.get(c.homeUnitId)?.buildingId);
 if(['work','manage'].includes(task)&&c.jobId){
  route.dailyDepartureMinute??=450;
  if(home){
   const key=`${route.companyAccountId}:${Math.floor(route.landing.x)},${Math.floor(route.landing.y)}:${Math.floor(route.origin.x)},${Math.floor(route.origin.y)}`;
   let reverse=records(city).find(r=>r.key===key);
   if(!reverse){if(records(city).length>=CROSSING_RULES.routeLimit)records(city).shift();records(city).push(reverse={key,companyAccountId:route.companyAccountId,companyName:route.companyName,organizerId:route.organizerId,boatId:route.boatId,origin:{...route.landing},landing:{...route.origin},members:[],departures:0,revenue:0,dailyDepartureMinute:1020});}
   const returning={...member,goal:{...home.door},task:'walk',targetId:home.id},at=reverse.members.findIndex(m=>m.citizenId===c.id);
   if(at<0)reverse.members.push(returning);else reverse.members[at]=returning;
  }
 }else if(home?.id===targetId)route.dailyDepartureMinute??=1020;
}
function available(city,c,{allowIndoor=false}={}){return living(c)&&(allowIndoor||!c.indoorLocation)&&!c.sleep?.active&&!c.localBoatTrip&&!c.sharedBoatRide&&!c.mobilityTrip&&!c.ridingVehicleId&&!c.boatClass&&!c.worldBoatCrew&&!c.worldMigrationPending&&!c.deliveryId&&!c.cleaningJobId&&!c.conversation&&!c.skybridgeTransit&&!c.fishingJob&&!c.informalJobId&&!(c.needs&&city.urgentNeed?.(c));}
function itinerary(city,c){
 const hour=city.hour??Math.floor((city.minute%1440)/60);
 const home=hour>=17&&['work','manage',null,'walk','leisure'].includes(c.task)&&city.building?.(city.units?.get(c.homeUnitId)?.buildingId);
 if(home?.active&&!home.entity.destroyed)return {goal:home.door,task:'walk',targetId:home.id};
 const planned=c.path?.[0]?.boatPlan;if(planned)return {goal:planned.goal,task:c.task,targetId:c.targetId};
 if(['work','manage'].includes(c.task)&&hour<17){const site=city.building?.(c.targetId??c.jobId);if(site?.active&&!site.entity.destroyed)return {goal:site.door,task:c.task,targetId:site.id};}
 if(c.path?.length&&['work','manage','food','water','health','hygiene','toilet','supplies','vote','energy'].includes(c.task))return {goal:c.path.at(-1),task:c.task,targetId:c.targetId};
 if(!c.task||c.task==='walk'||c.task==='leisure'){
  const job=hour>=7&&hour<17&&city.building?.(c.jobId),home=hour>=17&&city.building?.(city.units?.get(c.homeUnitId)?.buildingId),target=job||home;
  if(target?.active&&!target.entity.destroyed)return {goal:target.door,task:job?'work':'walk',targetId:target.id};
 }
 return null;
}
function membership(city,leader,c,goal,task,targetId){
 const group=leader.localBoatTrip?.sharedCrossing,boat=group&&city.vehicles.units.get(group.boatId);
 if(!group||group.phase!=='boarding'||!available(city,c)||group.members.length+1>=BOAT_CLASSES[boat.boatClass].capacity||distance(c.entity,group.origin)>CROSSING_RULES.recruitRadius)return null;
 // Do not recruit a person whose ordinary land journey is already shorter.
 const direct=ground(city,c.entity,goal),approach=ground(city,c.entity,group.origin),after=ground(city,group.landing,goal);
 if(!approach||!after)return null;
 const seconds=(length(c.entity,approach)+length(group.landing,after))/4+group.seaSeconds+CROSSING_RULES.boardingSeconds;
 if(direct&&length(c.entity,direct)/4<=seconds)return null;
 return {goal:{x:goal.x,y:goal.y},task,targetId,approach,after,seconds};
}
export function planSharedCrossing(city,start,goal,maxSeconds=Infinity){
 const c=start.properties?.citizen;if(!available(city,c))return null;
 for(const boat of city.vehicles?.units.values()||[]){
  if(boat.localTripCitizenId==null)continue;const leader=city.society.citizen(boat.localTripCitizenId),member=leader&&membership(city,leader,c,goal,c.task,c.targetId);
  if(!member||member.seconds>=maxSeconds)continue;
  const path=member.approach.map(p=>({...p}));if(!path.length)path.push({...leader.localBoatTrip.sharedCrossing.origin});
  path[0]={...path[0],boatPlan:{sharedTripCitizenId:leader.id,boatId:boat.id,goal:{...member.goal},seconds:member.seconds}};return path;
 }
 return null;
}
export function joinSharedCrossing(city,c,plan){
 const task=plan.task??c.task,targetId=plan.targetId??c.targetId;
 const leader=city.society.citizen(plan.sharedTripCitizenId),member=leader&&membership(city,leader,c,plan.goal,task,targetId);if(!member)return false;
 const group=leader.localBoatTrip.sharedCrossing;
 group.members.push({citizenId:c.id,...member});c.task=task;c.targetId=targetId;c.sharedBoatRide={leaderId:leader.id,boatId:plan.boatId,task:c.task,targetId:c.targetId,state:'approaching',goal:member.goal};
 c.path=member.approach.map(p=>({...p}));c.action='Indo ao embarque da travessia por lotação';
 rememberMember(city,group,c,member.goal,c.task,c.targetId);return true;
}
export function beginSharedCrossing(city,leader,boat,plan){
 if(plan.bikeId!=null||plan.relocate||plan.serviceAccountId||leader.deliveryId||boat.boatClass==='cargo'||boat.ownerAccountId===leader.accountId)return false;
 const path=leader.path,pickup=path.findIndex(p=>p.transportMode==='pickup'),landingIndex=path.findIndex((p,i)=>i>pickup&&p.transportMode==='walkAfter');
 if(pickup<0||landingIndex<0)return false;
 const origin=pickup?path[pickup-1]:leader.entity,landing=path[landingIndex],sea=path.slice(pickup,landingIndex);
 const group=leader.localBoatTrip.sharedCrossing={boatId:boat.id,origin:{x:origin.x,y:origin.y},landing:{x:landing.x,y:landing.y},phase:'boarding',members:[],remaining:CROSSING_RULES.boardingSeconds,seaSeconds:length(path[pickup],sea)/(4*BOAT_CLASSES[boat.boatClass].speed)};
 remember(city,leader,boat,group);rememberMember(city,group,leader,plan.goal,leader.task,leader.targetId);
 const route=records(city).find(r=>r.key===group.routeKey),regularIds=new Set(route.members.map(m=>m.citizenId));
 const candidates=(city.citizens||[]).filter(c=>c!==leader&&available(city,c)&&distance(c.entity,origin)<=CROSSING_RULES.recruitRadius).sort((a,b)=>Number(regularIds.has(b.id))-Number(regularIds.has(a.id))||distance(a.entity,origin)-distance(b.entity,origin));
 for(const c of candidates.slice(0,CROSSING_RULES.maxCandidates)){
  if(group.members.length+1>=BOAT_CLASSES[boat.boatClass].capacity)break;
  const trip=itinerary(city,c);if(!trip)continue;
  joinSharedCrossing(city,c,{sharedTripCitizenId:leader.id,boatId:boat.id,goal:trip.goal,task:trip.task,targetId:trip.targetId});
 }
 return true;
}
export function releaseSharedPassenger(city,c,{cancel=false,after=null}={}){
 if(!c.sharedBoatRide)return;
 const boat=city.vehicles.units.get(c.sharedBoatRide.boatId);if(boat?.passengerIds)boat.passengerIds=boat.passengerIds.filter(id=>id!==c.id);
 c.sharedBoatRide=null;c.boatVehicleId=null;c.boatClass=null;c.path=after?.map(p=>({...p}))||[];
 if(cancel){c.task=null;c.targetId=null;}c.lastProgressAt=city.minute;
}
export function advanceSharedPassenger(city,c,dt){
 const ride=c.sharedBoatRide;if(!ride)return false;
 const leader=city.society.citizen(ride.leaderId)||city.citizens?.find(c=>c.id===ride.leaderId),trip=leader?.localBoatTrip,group=trip?.sharedCrossing,boat=city.vehicles.units.get(ride.boatId);
 if(!living(c)||!group||!boat?.active||boat.scrapped){releaseSharedPassenger(city,c,{cancel:true});return true;}
 if(ride.state==='aboard'){c.action='Viajando na travessia por lotação';return true;}
 if(group.phase==='cancelled'&&ride.state==='approaching'){releaseSharedPassenger(city,c,{cancel:true});return true;}
 if(c.task!==ride.task||c.targetId!==ride.targetId||c.needs&&city.urgentNeed?.(c)){
  if(ride.state!=='boarding'){releaseSharedPassenger(city,c,{cancel:true});return true;}
  ride.returning=true;
 }
 if(c.path.length&&ride.state==='approaching')return false;
 if(distance(c.entity,group.origin)>.2&&ride.state==='approaching'){releaseSharedPassenger(city,c,{cancel:true});return true;}
 if(!trip.pickedUp){c.action='Aguardando o embarque da travessia';return true;}
 ride.state='boarding';const target=ride.returning?group.origin:boat,dx=target.x-c.entity.x,dy=target.y-c.entity.y,len=Math.hypot(dx,dy),travel=Math.min(len,Math.max(0,dt)*4);
 if(len){c.entity.x+=dx/len*travel;c.entity.y+=dy/len*travel;}c.lastProgressAt=city.minute;
 if(travel>=len-1e-5){if(ride.returning){releaseSharedPassenger(city,c,{cancel:true});return true;}ride.state='aboard';c.boatClass=boat.boatClass;c.boatVehicleId=boat.id;boat.passengerIds??=[];if(!boat.passengerIds.includes(c.id))boat.passengerIds.push(c.id);}
 return true;
}
export function prepareSharedDeparture(city,leader,remaining){
 const trip=leader.localBoatTrip,group=trip?.sharedCrossing;if(!group||group.phase!=='boarding')return {ready:true,remaining};
 if(trip.cancelAtShore){group.phase='cancelled';return {ready:true,remaining};}
 const waiting=group.members.map(m=>city.society.citizen(m.citizenId)).filter(c=>c?.sharedBoatRide?.leaderId===leader.id&&c.sharedBoatRide.state!=='aboard');
 if(waiting.length&&group.remaining>0){const wait=Math.min(remaining,group.remaining);group.remaining-=wait;remaining-=wait;if(remaining<=0)return {ready:false,remaining};}
 // A person already stepping aboard must finish that physical movement.
 if(waiting.some(c=>c.sharedBoatRide.state==='boarding'))return {ready:false,remaining:0};
 for(const c of waiting)releaseSharedPassenger(city,c,{cancel:true});
 const boat=city.vehicles.units.get(group.boatId),members=group.members.map(m=>city.society.citizen(m.citizenId)).filter(c=>living(c)&&c.sharedBoatRide?.leaderId===leader.id&&c.sharedBoatRide.state==='aboard');
 const people=[leader,...members];
 const exempt=c=>boat.ownerAccountId===city.worldPort?.accountId||accountAccess(city,c,boat.ownerAccountId);
 // Verify household totals before any charge. A failed group returns to
 // shore through the existing physical safe-landing route.
 const quote=crossingFare(city,boat,people.length),totals=new Map();
 for(const c of people)if(!exempt(c)){
  const payer=city.payerFor(c),total=(totals.get(payer)||0)+quote;totals.set(payer,total);
  if((city.accounts?.get(payer)?.balance??Infinity)<total){group.phase='cancelled';return {ready:false,remaining:0,cancel:true};}
 }
 const fare=crossingFare(city,boat,people.length),charged=[];let revenue=0;
 for(const c of people)if(!exempt(c)){
  if(!city.transfer(city.payerFor(c),boat.ownerAccountId,fare,'Serviço: travessia por lotação',{vehicleId:boat.id,citizenId:c.id,passengers:people.length,routeKey:group.routeKey})){for(const payer of charged)city.transfer(boat.ownerAccountId,payer,fare,'Cancelamento de travessia por lotação',{vehicleId:boat.id,routeKey:group.routeKey});group.phase='cancelled';return {ready:false,remaining:0,cancel:true};}charged.push(city.payerFor(c));revenue+=fare;
 }
 group.phase='sailing';group.departedAt=city.minute;group.passengerCount=people.length;group.fare=fare;
 const route=records(city).find(r=>r.key===group.routeKey);if(route){route.departures++;route.lastDepartureAt=city.minute;route.departureMinute=city.minute%1440;route.lastPassengerCount=people.length;route.lastFare=fare;route.revenue+=revenue;}
 boat.journey={kind:'shared-crossing',routeKey:group.routeKey,organizerId:route?.organizerId,passengers:people.length,fare};return {ready:true,remaining};
}
export function syncSharedCrossing(city,leader,{landed=false}={}){
 const trip=leader.localBoatTrip,group=trip?.sharedCrossing;if(!group)return;
 const boat=city.vehicles.units.get(group.boatId);
 for(const member of group.members){const c=city.society.citizen(member.citizenId);if(!c?.sharedBoatRide||c.sharedBoatRide.leaderId!==leader.id||c.sharedBoatRide.state!=='aboard')continue;
  c.entity.x=trip.position.x;c.entity.y=trip.position.y;c.lastProgressAt=city.minute;
  if(landed){const after=ground(city,c.entity,member.goal);releaseSharedPassenger(city,c,{cancel:trip.cancelAtShore||after===null,after});}
  else{c.boatClass=boat.boatClass;c.boatVehicleId=boat.id;}
 }
}
export function finishSharedCrossing(city,leader){
 const group=leader.localBoatTrip?.sharedCrossing;if(!group)return;
 for(const member of group.members){const c=city.society.citizen(member.citizenId);if(c?.sharedBoatRide?.leaderId===leader.id)releaseSharedPassenger(city,c,{cancel:true});}
 const boat=city.vehicles.units.get(group.boatId);if(boat)boat.passengerIds=[];
}

export function dispatchRegularCrossings(city){
 if(!records(city).length||city.minute%10!==0)return;
 const hour=city.hour??Math.floor((city.minute%1440)/60);if(hour<7||hour>=22)return;
 // A retained group is an invitation, not an obligation overriding needs,
 // sleep, changed employment or the accessibility of today's actual route.
 let budget=4;
 for(const route of records(city)){
  if(!budget)break;
  const clock=city.minute%1440;if(route.dailyDepartureMinute==null||clock<route.dailyDepartureMinute-15||clock>route.dailyDepartureMinute+60)continue;
  const boat=city.vehicles.units.get(route.boatId);
  if(!boat?.active||boat.scrapped||boat.localTripCitizenId!=null||boat.driverId||boat.worldFleetReserved||distance(boat,route.origin)>2)continue;
  for(const member of route.members){
   const c=city.society.citizen(member.citizenId);if(!available(city,c,{allowIndoor:true})||member.jobId!==c.jobId||member.homeUnitId!==c.homeUnitId||!['work','manage',null,'walk','leisure','energy'].includes(c.task)||distance(c.indoorLocation?city.building(c.indoorLocation.buildingId)?.door||c.entity:c.entity,route.origin)>CROSSING_RULES.recruitRadius)continue;
   const task=itinerary(city,c);if(!task)continue;
   // Only commute to an actually disconnected island; do not divert workers
   // onto an optional sightseeing trip when a direct walk is available.
   const door=c.indoorLocation&&city.building(c.indoorLocation.buildingId)?.door,from=door?{...door,properties:{citizen:c}}:c.entity;
   if(settlementConnected(city,from,task.goal)!==false)continue;
   const path=city.findPath(from,task.goal);budget--;if(!path?.[0]?.boatPlan)continue;
   c.task=task.task;c.targetId=task.targetId;c.path=path;c.action='Indo ao embarque do grupo diário';break;
  }
 }
}
