import {writeFileSync} from 'node:fs';
import {serialize} from 'node:v8';
import {CityStateGraph} from '../js/city_state.js';
// Paired synthetic cities. This is a diagnostic, not the user's saved city.
import {World} from '../js/world.js';
import {CitySimulation} from '../js/city_simulation.js';
import {settlementConnected} from '../js/city_terrain.js';
const population=Number(process.env.POPULATION)||128,minutes=Number(process.env.MINUTES)||1440,seed=Number(process.env.SEED)||1337;
for(const terrain of (process.env.TERRAIN?[process.env.TERRAIN]:['archipelago','land-control'])){
 let id=0;const world=new World(0,seed,128);
 if(terrain==='land-control'){for(let i=0;i<world.map.length;i++)if(world.map[i]===2)world.map[i]=0;world.revision++;}
 const city=new CitySimulation({world,population,seed,startFoundingWorks:process.env.FOUNDING_WORKS!=='0',createEntity:data=>({id:++id,destroyed:false,...data})});city.initialize();
 const start=city.minute,at=performance.now();
 function snapshot(){
  const alive=city.citizens.filter(c=>!c.entity.destroyed),hall=city.townhall(),counts={};
  for(const c of alive){const reason=city.urgentNeed(c);if(reason)counts[reason]=(counts[reason]||0)+1;}
  const connections=hall?alive.map(c=>settlementConnected(city,c.indoorLocation?city.building(c.indoorLocation.buildingId)?.door||c.entity:c.entity,hall.door)):[];
  const disconnected=connections.filter(value=>value===false);
  return {terrain,seed,population,minutes:city.minute-start,alive:alive.length,deathCount:city.life.deathCount,firstDeaths:city.life.deaths?.slice(0,5).map(d=>({minute:d.minute,cause:d.cause,task:d.task,action:d.action,needs:d.needs,position:d.position,deprivation:d.deprivation,healthDepletionSource:d.healthDepletionSource,lowNeeds:d.lowNeedsAtDeath})),urgent:counts,day:city.day,hour:city.hour,disconnectedFromHall:disconnected.length,unclassifiedHallConnections:connections.filter(value=>value==null).length,inactiveUnfinishedSleep:alive.filter(c=>c.sleep?.minutes>0&&!c.sleep.active).length,foodDays:city.welfare.conditions().foodDays,elapsedMs:Math.round(performance.now()-at)};
 }
 console.log(JSON.stringify(snapshot()));
 for(let step=0;step<minutes;step++){
  const before=city.life.deathCount;city.update(.25);
  if(!before&&city.life.deathCount){
   const death=city.life.deaths[0],c=city.citizens.find(c=>c.id===death.citizenId);
   console.log(JSON.stringify({firstDeath:death,victim:{id:c.id,balance:c.balance,homeUnitId:c.homeUnitId,jobId:c.jobId,indoorLocation:c.indoorLocation,path:c.path,sleep:c.sleep},facilities:[...city.sanitation.facilities.values()].map(f=>({id:f.id,buildingId:f.buildingId,access:f.access,cleanliness:f.cleanliness,allowed:city.sanitation.allowed(c,f),occupantId:f.occupantId}))}));
   if(process.env.STATE_FILE)writeFileSync(process.env.STATE_FILE,serialize(new CityStateGraph().encode({city})));
   if(process.env.STOP_ON_DEATH==='1')break;
  }
  if(process.env.WATCH_CITIZEN&&(step+1)%60===0){const c=city.citizens.find(c=>c.id===Number(process.env.WATCH_CITIZEN));if(c)console.log(JSON.stringify({watch:c.id,minute:city.minute,task:c.task,action:c.action,needs:c.needs,position:{x:c.entity.x,y:c.entity.y},inside:c.indoorLocation&&{buildingId:c.indoorLocation.buildingId,position:c.indoorLocation.position,travelRemaining:c.indoorLocation.travelRemaining},targetId:c.targetId,pathLength:c.path.length,waitingSince:c.hygieneWaitingSince,sleep:c.sleep}));}
  if((step+1)%360===0)console.log(JSON.stringify(snapshot()));
 }
}
