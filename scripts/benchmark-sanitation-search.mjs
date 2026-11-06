// Synthetic facility-search workload; full-city timing is measured separately.
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.argv[2]?resolve(process.argv[2]):fileURLToPath(new URL('../',import.meta.url));
const load=name=>import(pathToFileURL(resolve(root,'js',name)).href);
const {CitySanitation}=await load('city_sanitation.js'),{CityHousing}=await load('city_housing.js'),{CitySociety}=await load('city_society.js'),{CityRelationships}=await load('city_relationships.js');
const population=1024,rounds=Number(process.env.SUBURBAN_BENCH_ROUNDS)||8,buildings=new Map();let viewCalls=0;
const city={minute:1200,citizens:[],accounts:new Map(),units:new Map(),building:id=>buildings.get(id),payerFor:c=>c.accountId,findPath:()=>[]};
city.housing=new CityHousing(city);city.society=new CitySociety(city);city.relationships=new CityRelationships(city);city.sanitation=new CitySanitation(city);
const view=city.relationships.view.bind(city.relationships);city.relationships.view=(...args)=>{viewCalls++;return view(...args);};
for(let i=0;i<population;i++){
 const c={id:i+1,accountId:`citizen:${i+1}`,homeId:i%5===0?null:`home:${i>>3}`,entity:{x:i%32,y:i>>5,destroyed:false},needs:{hygiene:40,toilet:50},path:[]};city.citizens.push(c);city.accounts.set(c.accountId,c);
}
for(let i=0;i<128;i++){
 const b={id:i+1,type:'residential',active:true,door:{x:i%16*3,y:(i>>4)*3}},homeId=`home:${i}`;buildings.set(b.id,b);city.housing.homes.set(homeId,{id:homeId});
 for(let j=0;j<2;j++){const id=`bath:${i}:${j}`;city.units.set(id,{id,roomType:'bathroom',ownerId:`citizen:${i*8+1}`});city.sanitation.addFacility(b,{unitId:id,homeIds:[homeId],access:'home'});}
}
for(const c of city.citizens)for(const delta of [7,37]){
 const other=city.citizens[(c.id-1+delta)%population],a=Math.min(c.id,other.id),b=Math.max(c.id,other.id),key=`${a}:${b}`;
 if(city.society.relations.has(key))continue;
 city.society.relations.set(key,{id:key,a,b,views:{[a]:{affection:a%4?80:40,trust:70,resentment:5},[b]:{affection:b%4?80:40,trust:70,resentment:5}}});
 for(const id of [a,b]){let list=city.society.contactIndex.get(id);if(!list)city.society.contactIndex.set(id,list=new Set());list.add(key);}
}
const choose=()=>{for(const c of city.citizens)city.sanitation.choose(c,'hygiene');};choose();viewCalls=0;
const checksum=createHash('sha256'),samples=[],cpuStart=process.threadCpuUsage?.(),at=performance.now();
for(let i=0;i<rounds;i++){const start=performance.now();choose();samples.push(performance.now()-start);checksum.update(JSON.stringify(city.citizens.map(c=>[c.id,c.task,c.targetId,c.hygieneTargetId,c.hygieneWaitingSince,c.path])));}
const cpu=cpuStart?process.threadCpuUsage(cpuStart):null;
console.log(JSON.stringify({root,population,facilities:city.sanitation.facilities.size,rounds,ms:performance.now()-at,threadCpuMs:cpu?(cpu.user+cpu.system)/1000:null,viewCalls,samples,checksum:checksum.digest('hex')}));
