import {crossingCandidates,crossingRequests} from './city_boat_crossings.js?v=shared-crossings-1';
import {boatAccessAccounts,BOAT_TOW_RULES,planBoatTrip,boatRouteTime,advanceLocalBoatTrip} from './city_boat_towing.js?v=shared-crossings-1';
import {fishingWaters} from './city_fishing.js';
import {tileHeight,tileAt} from './city_terrain.js?v=entrance-retaining-clearance-1';

const directions=[[1,0],[-1,0],[0,1],[0,-1]];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const idle=v=>v.active&&!v.scrapped&&!v.worldFleetReserved&&!v.worldMigrationPending&&!(v.passengerIds?.length)&&!v.driverId&&!v.transportCitizenId&&!v.localTripCitizenId&&!v.fishingCitizenId&&!v.mechanicId&&!v.paintJobId&&!v.serviceBodyId&&!v.policeRecoveryOfficerId;
const relocationJobs=new WeakMap();

// Reuse real commute requests and the towing planner. A hypothetical hull only
// quotes the benefit at the destination; it never enters the vehicle registry.
export function dispatchBoatRelocations(city,{maxSearches=Infinity}={}){
 const hour=city.hour??Math.floor(city.minute%1440/60);
 if(hour<7||hour>=20){relocationJobs.delete(city);return false;}
 const revision=`${city.world.width}:${city.world.height}:${city.world.revision||0}:${city.structureRevision||0}:${city.obstacleRevision||0}:${city.occupied.size}`;
 let job=relocationJobs.get(city);
 if(job&&(job.revision!==revision||job.world!==city.world||job.map!==city.world.map||job.occupied!==city.occupied)){relocationJobs.delete(city);job=null;}
 if(!job){
  if(city.minute%10!==0)return false;
  job={revision,world:city.world,map:city.world.map,occupied:city.occupied,steps:relocationSteps(city)};
  relocationJobs.set(city,job);
  const first=job.steps.next();
  if(first.done){relocationJobs.delete(city);return first.value;}
 }
 // Auxiliary fleet planning must not monopolize a simulation minute. Resume
 // at search boundaries; the caller controls how many quotes it can afford.
 for(let i=0;i<maxSearches;i++){
  const step=job.steps.next();
  if(step.done){relocationJobs.delete(city);return step.value;}
 }
 return false;
}
function* relocationSteps(city){
 const fleet=[...(city.vehicles?.units.values()||[])];
 const forSale=v=>!v.active&&v.holderAccountId&&(v.holderAccountId===city.worldPort?.accountId||(city.buildings||[]).some(b=>b.accountId===v.holderAccountId&&['boat_shop','shipyard'].includes(b.type)&&b.active&&!b.entity.destroyed));
 let boats=fleet.filter(v=>BOAT_TOW_RULES[v.boatClass]&&(idle(v)||forSale(v)&&idle({...v,active:true}))&&(v.condition??100)>15&&city.minute-(v.lastRelocationAt??-Infinity)>=180);
 if(!boats.length||!fleet.some(v=>!v.boatClass&&BOAT_TOW_RULES.canoe.bikes.includes(v.good)&&idle(v)&&v.condition>15))return false;
 const operators=crossingCandidates(city).filter(c=>!c.mechanicJob&&!c.workMeal);
 boats=boats.filter(boat=>operators.some(c=>(boatAccessAccounts(city,c).has(boat.ownerAccountId)||forSale(boat)&&city.vehicles.vehiclePrice&&[...boatAccessAccounts(city,c)].some(account=>(city.accounts?.get(account)?.balance??0)>=city.vehicles.vehiclePrice(boat)))&&fleet.some(v=>!v.boatClass&&idle(v)&&v.condition>15&&BOAT_TOW_RULES[boat.boatClass].bikes.includes(v.good)&&boatAccessAccounts(city,c).has(v.possessorAccountId||v.ownerAccountId))));
 if(!boats.length)return false;
 const waters=fishingWaters(city.world),width=city.world.width;
 const bodyAt=p=>waters.bodyAt[Math.floor(p.y)*width+Math.floor(p.x)]??-1;
 const demand=crossingRequests(city).filter(r=>['work','manage','walk'].includes(r.task));
 const offset=demand.length?Math.floor(city.minute/10)*16%demand.length:0;
 const requests=[...demand.slice(offset),...demand.slice(0,offset)].slice(0,16);
 const shores=[];
 for(const body of waters.bodies){
  if(city.citizens.some(c=>c.localBoatTrip?.relocation?.bodyId===body.id))continue;
  for(const cell of body.cells){if(waters.distance[cell]!==1)continue;
   const water={x:cell%width+.5,y:Math.floor(cell/width)+.5};
   for(const [dx,dy] of directions){const land={x:water.x+dx,y:water.y+dy};
    if(city.walkable(Math.floor(land.x),Math.floor(land.y))&&tileHeight(tileAt(city.world,Math.floor(land.x),Math.floor(land.y)))<=1.25)shores.push({land,water,bodyId:body.id});
   }
  }
 }
 for(const {citizen,goal} of requests){
  const door=citizen.indoorLocation&&city.building(citizen.indoorLocation.buildingId)?.door;
  const start=door?{...door,properties:{citizen}}:citizen.entity;
  yield;
  const ground=city.findPath(start,goal,{allowBoats:false});
  yield;
  const current=city.findPath(start,goal);
  if(current?.[0]?.boatPlan)continue;
  const nearest=shores.slice().sort((a,b)=>distance(a.land,start)-distance(b.land,start));
  for(const shore of nearest.slice(0,12))for(const boat of boats.slice(0,4)){
   if(bodyAt(boat)===shore.bodyId)continue;
   const hypothetical={...boat,active:true,id:`relocation:${boat.id}:${shore.water.x},${shore.water.y}`,x:shore.water.x,y:shore.water.y};
   yield;
   const useful=planBoatTrip(city,start,goal,{boat:hypothetical,groundPath:ground,maxSeconds:boatRouteTime(city,start,ground)});
   if(!useful)continue;
   for(const operator of operators){
    if(city.society?.isAdult&&!city.society.isAdult(operator))continue;
    const initialAccounts=boatAccessAccounts(city,operator),initialBuyer=forSale(boat)&&[...initialAccounts].find(account=>(city.accounts?.get(account)?.balance??0)>=city.vehicles.vehiclePrice(boat));
    if(!initialAccounts.has(boat.ownerAccountId)&&!initialBuyer||operator!==citizen&&!([null,'walk','leisure'].includes(operator.task??null)||['work','manage'].includes(operator.task)&&city.building?.(operator.targetId??operator.jobId)?.accountId===(initialBuyer||boat.ownerAccountId)))continue;
    yield;
    // People and assets can change while a quote waits for the next minute.
    // Recheck demand and availability before reserving or buying anything.
    if(!crossingCandidates(city).includes(operator)||city.vehicles.units.get(boat.id)!==boat||(boat.condition??100)<=15||!(idle(boat)||forSale(boat)&&idle({...boat,active:true}))||city.minute-(boat.lastRelocationAt??-Infinity)<180)continue;
    if(city.citizens.some(c=>c.localBoatTrip?.relocation?.bodyId===shore.bodyId))continue;
    if(!crossingRequests(city).some(r=>r.citizen===citizen&&['work','manage','walk'].includes(r.task)&&distance(r.goal,goal)<.001))continue;
    const accounts=boatAccessAccounts(city,operator);
    const buyer=forSale(boat)&&[...accounts].find(account=>(city.accounts?.get(account)?.balance??0)>=city.vehicles.vehiclePrice(boat));
    if(!accounts.has(boat.ownerAccountId)&&!buyer||operator!==citizen&&!([null,'walk','leisure'].includes(operator.task??null)||['work','manage'].includes(operator.task)&&city.building?.(operator.targetId??operator.jobId)?.accountId===(buyer||boat.ownerAccountId)))continue;
    const path=planBoatTrip(city,operator.entity,shore.land,{boat:buyer?{...boat,active:true,ownerAccountId:buyer}:boat,relocate:true});
    if(!path)continue;
    if(buyer&&!city.vehicles.buyVehicle(buyer,boat.id))continue;
    // Launch the hull, then bring the operator and bicycle back to the bank.
    path.push({...shore.water,transportMode:'sail',boatClass:boat.boatClass},{...shore.land,transportMode:'walkAfter'});
    path[0]={...path[0],boatPlan:{...path[0].boatPlan,relocation:{bodyId:shore.bodyId,task:operator.task,targetId:operator.targetId,goal:operator.path?.at(-1)&&{x:operator.path.at(-1).x,y:operator.path.at(-1).y}}}};
    operator.task='boat-relocation';operator.targetId=null;operator.path=path;
    advanceLocalBoatTrip(city,operator,0);
    if(!operator.localBoatTrip)continue;
    boat.lastRelocationAt=city.minute;boat.journey={kind:'boat-relocation',bodyId:shore.bodyId};
    operator.action='Guinchando embarcação para atender travessias em outro lago';
    return true;
   }
  }
 }
 return false;
}
