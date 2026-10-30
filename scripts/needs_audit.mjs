// Run actual terrain and citizens through several days, including the loss of
// starting provisions. Usage: node scripts/needs_audit.mjs [population] [days] [size] [seed] [terrain]
import {World} from '../js/world.js';
import {CitySimulation} from '../js/city_simulation.js';
import {resolveWorldSettings,WORLD_PRESETS} from '../js/world_settings.js';
const population=Number(process.argv[2]||512),days=Number(process.argv[3]||20),size=Number(process.argv[4]||256),seed=Number(process.argv[5]||1337);
if(!Number.isInteger(population)||population<1||!Number.isInteger(days)||days<1||![128,256,512,1024].includes(size)||!Number.isSafeInteger(seed)||seed<1||seed>2147483647)throw Error('Invalid needs audit settings');
const terrain=process.argv[6]||resolveWorldSettings(new URLSearchParams({seed:String(seed)})).preset;
if(!Object.hasOwn(WORLD_PRESETS,terrain))throw Error('Invalid terrain preset');
let id=0;
const world=new World(WORLD_PRESETS[terrain].id,seed,size),city=new CitySimulation({world,population,seed,createEntity:data=>({id:++id,destroyed:false,...data})});city.initialize();
const started=performance.now(),until=days*1440;
function inspect(final=false){
 const living=city.citizens.filter(c=>!c.entity.destroyed),hungry=living.filter(c=>c.needs.food<20),tasks={};for(const c of living)tasks[c.task]=(tasks[c.task]||0)+1;
 const row={final,seed,terrain,size,minute:city.minute,day:city.day,elapsedMs:Math.round(performance.now()-started),population,living:living.length,deathCount:city.life.deathCount,deathCauses:Object.fromEntries([...new Set(city.life.deaths.map(e=>e.cause))].map(cause=>[cause,city.life.deaths.filter(e=>e.cause===cause).length])),queues:city.buildings.filter(b=>b.serviceQueue?.length).map(b=>({id:b.id,type:b.type,waiting:b.serviceQueue.filter(q=>!q.admittedUnitId).length,admitted:b.serviceQueue.filter(q=>q.admittedUnitId).length,oldestMinutes:city.minute-Math.min(...b.serviceQueue.map(q=>q.joinedAt))})),deaths:city.life.deaths.slice(-5),critical:living.filter(c=>c.needs.health<20||c.needs.water<10).slice(0,8).map(c=>({id:c.id,needs:c.needs,task:c.task,action:c.action,path:c.path.length,target:c.targetId,skybridgeTransit:c.skybridgeTransit,delivery:c.deliveryId,cleaning:c.cleaningJobId,indoor:c.indoorLocation&&{buildingId:c.indoorLocation.buildingId,room:c.indoorLocation.roomType,path:c.indoorLocation.path?.length}})),hungry:hungry.length,meanFood:living.reduce((n,c)=>n+c.needs.food,0)/Math.max(1,living.length),breadConsumed:city.economy.consumed.pao,baskets:city.supplies.basketsDistributed,mealsDistributed:city.supplies.mealsDistributed,cleanliness:city.sanitation.cleanliness(),tasks,refectories:city.buildings.filter(b=>b.type==='popular_refectory').map(b=>({id:b.id,active:b.active,bread:b.inventory.pao,queued:b.serviceQueue?.length||0})),hungryExamples:hungry.slice(0,5).map(c=>({id:c.id,needs:c.needs,task:c.task,action:c.action,path:c.path.length,target:c.targetId,pocketMeals:c.pocket?.food?.length||0,provisions:c.provisions,indoor:c.indoorLocation&&{buildingId:c.indoorLocation.buildingId,room:c.indoorLocation.roomType,path:c.indoorLocation.path?.length}}))};
 console.log(JSON.stringify(row));return row;
}
inspect();while(city.minute<until){city.update(.25);if(city.minute%720===0)inspect();}
const result=inspect(true);if(city.life.deaths.some(event=>event.cause!=='velhice')||result.living<population*.95||result.hungry>population*.1)process.exitCode=1;
