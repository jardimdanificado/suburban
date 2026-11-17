// Isolate daily property-listing decisions; this does not measure whole-city FPS.
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.argv[2]?resolve(process.argv[2]):fileURLToPath(new URL('../',import.meta.url));
const {CityEconomy}=await import(pathToFileURL(resolve(root,'js/city_economy.js')).href);
const population=Number(process.env.SUBURBAN_BENCH_POPULATION)||1024;
const roomCount=Number(process.env.SUBURBAN_BENCH_ROOMS)||32768,rounds=Number(process.env.SUBURBAN_BENCH_ROUNDS)||8;
const citizens=Array.from({length:population},(_,id)=>({id,accountId:`person:${id}`,homeUnitId:`home:${id}`,balance:id%3?5000:1000,rentalPreference:id%2?.8:.4,entity:{destroyed:false}}));
const units=new Map(Array.from({length:roomCount},(_,id)=>[id,{id,ownerId:`person:${id%population}`,buildingId:1,tenantId:id%8===0?'tenant':null,forSale:false,forRent:false}]));
const city={citizens,units,buildings:[],traffic:new Map(),bank:{daily(){}},society:{isAdult:()=>true},building:()=>({type:'residential'})};
const economy=Object.assign(Object.create(CityEconomy.prototype),{city,municipalPolicy(){},investInHousing(){},assignHomes(){},updateDemand(){}});
const values=units.values.bind(units);let registryPasses=0;
units.values=function(){registryPasses++;return values();};
economy.daily();registryPasses=0;
const samples=[],started=performance.now();
for(let i=0;i<rounds;i++){const at=performance.now();economy.daily();samples.push(performance.now()-at);}
const ms=performance.now()-started,checksum=createHash('sha256').update(JSON.stringify([...values()].map(u=>[u.id,u.forSale,u.forRent]))).digest('hex');
console.log(JSON.stringify({root,population,roomCount,rounds,registryPasses,ms,samples,checksum}));
