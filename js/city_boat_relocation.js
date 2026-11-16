import {crossingCandidates,crossingRequests} from './city_boat_crossings.js?v=shared-crossings-1';
import {boatAccessAccounts,BOAT_TOW_RULES,planBoatTrip,boatRouteTime,advanceLocalBoatTrip} from './city_boat_towing.js?v=shared-crossings-1';
import {fishingWaters} from './city_fishing.js';
import {tileHeight,tileAt} from './city_terrain.js?v=entrance-retaining-clearance-1';

const directions=[[1,0],[-1,0],[0,1],[0,-1]];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const idle=v=>v.active&&!v.scrapped&&!v.worldFleetReserved&&!v.worldMigrationPending&&!(v.passengerIds?.length)&&!v.driverId&&!v.transportCitizenId&&!v.localTripCitizenId&&!v.fishingCitizenId&&!v.mechanicId&&!v.paintJobId&&!v.serviceBodyId&&!v.policeRecoveryOfficerId;

// Reuse real commute requests and the towing planner. A hypothetical hull only
// quotes the benefit at the destination; it never enters the vehicle registry.
export function dispatchBoatRelocations(city){
 const hour=city.hour??Math.floor(city.minute%1440/60);
 if(city.minute%10!==0||hour<7||hour>=20)return false;
 const fleet=[...(city.vehicles?.units.values()||[])];
 let boats=fleet.filter(v=>BOAT_TOW_RULES[v.boatClass]&&idle(v)&&(v.condition??100)>15&&city.minute-(v.lastRelocationAt??-Infinity)>=180);
 if(!boats.length||!fleet.some(v=>!v.boatClass&&BOAT_TOW_RULES.canoe.bikes.includes(v.good)&&idle(v)&&v.condition>15))return false;
 const operators=crossingCandidates(city).filter(c=>!c.mechanicJob&&!c.workMeal);
 boats=boats.filter(boat=>operators.some(c=>boatAccessAccounts(city,c).has(boat.ownerAccountId)&&fleet.some(v=>!v.boatClass&&idle(v)&&v.condition>15&&BOAT_TOW_RULES[boat.boatClass].bikes.includes(v.good)&&boatAccessAccounts(city,c).has(v.possessorAccountId||v.ownerAccountId))));
 if(!boats.length)return false;
 const waters=fishingWaters(city.world),width=city.world.width;
 const bodyAt=p=>waters.bodyAt[Math.floor(p.y)*width+Math.floor(p.x)]??-1;
 const requests=crossingRequests(city).filter(r=>['work','manage','walk'].includes(r.task)).slice(0,16);
 const shores=[];
 for(const body of waters.bodies){
  if(fleet.some(v=>v.boatClass&&v.active&&!v.scrapped&&(v.condition??100)>15&&!v.worldFleetReserved&&bodyAt(v)===body.id)||city.citizens.some(c=>c.localBoatTrip?.relocation?.bodyId===body.id))continue;
  for(const cell of body.cells){if(waters.distance[cell]!==1)continue;
   const water={x:cell%width+.5,y:Math.floor(cell/width)+.5};
   for(const [dx,dy] of directions){const land={x:water.x+dx,y:water.y+dy};
    if(city.walkable(Math.floor(land.x),Math.floor(land.y))&&tileHeight(tileAt(city.world,Math.floor(land.x),Math.floor(land.y)))<=1.25)shores.push({land,water,bodyId:body.id});
   }
  }
 }
 for(const {citizen,goal} of requests){
  const ground=city.findPath(citizen.entity,goal,{allowBoats:false}),current=city.findPath(citizen.entity,goal);
  if(current?.[0]?.boatPlan)continue;
  const nearest=shores.slice().sort((a,b)=>distance(a.land,citizen.entity)-distance(b.land,citizen.entity));
  for(const shore of nearest.slice(0,12))for(const boat of boats.slice(0,4)){
   if(bodyAt(boat)===shore.bodyId)continue;
   const hypothetical={...boat,id:`relocation:${boat.id}:${shore.water.x},${shore.water.y}`,x:shore.water.x,y:shore.water.y};
   const useful=planBoatTrip(city,citizen.entity,goal,{boat:hypothetical,groundPath:ground,maxSeconds:boatRouteTime(city,citizen.entity,ground)});
   if(!useful)continue;
   for(const operator of operators){
    if(city.society?.isAdult&&!city.society.isAdult(operator))continue;
    const accounts=boatAccessAccounts(city,operator);
    if(!accounts.has(boat.ownerAccountId)||operator!==citizen&&!([null,'walk','leisure'].includes(operator.task??null)||['work','manage'].includes(operator.task)&&city.building?.(operator.targetId??operator.jobId)?.accountId===boat.ownerAccountId))continue;
    const path=planBoatTrip(city,operator.entity,shore.land,{boat,relocate:true});
    if(!path)continue;
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
