import {buildingPoint,modelSize,CITY_FLOOR_HEIGHT} from './city_building_geometry.js';
import {HOUSE_STYLES} from './city_culture.js';
const homes=new Set(['residential','super_popular_housing','popular_housing','popular_luxury_housing','luxury_housing']);
const cache=new WeakMap();
export function buildingLeisureSpaces(b){
 if(!b||['townhall','council_chamber'].includes(b.type)||b.constructionKind==='open-air'||b.officeTenantOf)return [];
 const key=`${b.layoutRevision||0}:${b.floors}:${b.rotation||0}:${b.type}:${b.architecture}`,old=cache.get(b);if(old?.key===key)return old.spaces;
 const {width,depth}=modelSize(b),seed=Math.imul(b.id+37,2654435761)>>>0,variant=seed%5,spaces=[];
 const add=(floor,x,w,d,planters)=>{
  const candidates=[];for(let col=0;col<width;col++){const center=col+.5;if(Math.abs(center-x)>w/2+.01)continue;const p=buildingPoint(b,center,depth-.5),u=b.units.find(u=>u.z===floor&&u.x===Math.floor(p.x)&&u.y===Math.floor(p.y)&&['bedroom','workspace','office'].includes(u.roomType));if(u)candidates.push({u,center});}
  candidates.sort((a,z)=>Math.abs(a.center-x)-Math.abs(z.center-x));const found=candidates[0];if(!found)return;
  const pos=buildingPoint(b,found.center,depth+d*.5),doorBit=[2,8,1,4][b.rotation||0];
  spaces.push({id:`balcony:${floor}:${found.u.id}`,kind:'balcony',floor,unitId:found.u.id,doorBit,localX:x,doorX:found.center,width:w,depth:d,planters,position:{x:b.entity.x+pos.x,y:b.entity.y+pos.y,z:floor*CITY_FLOOR_HEIGHT+.14},capacity:1});
 };
 for(let floor=1;floor<b.floors;floor++){
  if(!homes.has(b.type)){if((floor+variant)%2===0)add(floor,width/2,Math.max(.9,width-.4),.62,variant%2===0);continue;}
  // Give each eligible front-facing home its own usable balcony. Previously
  // one shared facade projection was tied to only a single apartment.
  for(let col=0;col<width;col++)add(floor,col+.5,.82,variant===2?.85:.68,(col+floor+variant)%3===0);
 }
 if((homes.has(b.type)&&(HOUSE_STYLES[b.architecture]||HOUSE_STYLES.modern).roofKind==='flat')||b.type==='office_tower'){
  const unit=b.units.find(u=>u.z===b.floors-1&&['bedroom','workspace','office'].includes(u.roomType));if(unit){const pos=buildingPoint(b,width*.5,depth*.5);spaces.push({id:`roof:${b.id}`,kind:'roof_terrace',floor:b.floors-1,unitId:unit.id,position:{x:b.entity.x+pos.x,y:b.entity.y+pos.y,z:b.floors*CITY_FLOOR_HEIGHT+.23},capacity:4});}
 }
 cache.set(b,{key,spaces});return spaces;
}
