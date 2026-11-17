// Optional first argument selects a comparison source tree.
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.argv[2]?resolve(process.argv[2]):fileURLToPath(new URL('../',import.meta.url));
const {CityRelationships}=await import(pathToFileURL(resolve(root,'js/city_relationships.js')).href);
const buildings=[{door:{x:0,y:0}},{door:{x:7,y:0}}];
const city={units:new Map([[1,{buildingId:0}],[2,{buildingId:1}]]),building:id=>buildings[id],society:{related:()=>false}};
const relationships=new CityRelationships(city),a={id:1,parentIds:[],homeUnitId:1,homeId:1,jobId:10},b={id:2,parentIds:[],homeUnitId:2};
const relation={contexts:Object.freeze([])},iterations=200000,checkpoints=[];
let changes=0;
const started=performance.now();
for(let i=0;i<iterations;i++){
 if(i%1024===0){const mask=(i/1024)&15;a.parentIds=mask&1?[2]:[];b.jobId=mask&2?10:null;b.homeId=mask&4?1:2;buildings[1].door.x=mask&8?8:9;}
 const previous=relation.contexts;
 relationships.context(relation,a,b);
 if(previous!==relation.contexts)changes++;
 if(i%1024===0)checkpoints.push(relation.contexts);
}
const ms=performance.now()-started;
const checksum=createHash('sha256').update(JSON.stringify({checkpoints,changes,final:relation.contexts})).digest('hex');
console.log(JSON.stringify({iterations,changes,ms,checksum}));
