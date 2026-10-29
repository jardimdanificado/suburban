import {buildingPoint,modelSize,CITY_FLOOR_HEIGHT} from './city_building_geometry.js';
import {HOUSE_STYLES} from './city_culture.js';
const homes=new Set(['residential','super_popular_housing','popular_housing','popular_luxury_housing','luxury_housing']);
const cache=new WeakMap();
const SIDE_BITS={
 // The balcony side is facade-local; wall masks use world-facing bits.
 front:[2,8,1,4],back:[1,4,2,8],left:[4,2,8,1],right:[8,1,4,2],
};
const hash=(...values)=>{let n=0x811c9dc5;for(const value of values)n=Math.imul(n^value,0x01000193);return n>>>0;};
function sideCandidates(b,floor){
 const {width,depth}=modelSize(b),byCell=new Map(b.units.filter(u=>u.z===floor&&['bedroom','workspace','office'].includes(u.roomType)).map(u=>[`${u.x},${u.y}`,u])),rows=[];
 const add=(side,along,p)=>{const unit=byCell.get(`${Math.floor(p.x)},${Math.floor(p.y)}`);if(unit)rows.push({side,along,unit});};
 for(let along=.5;along<width;along+=1){add('front',along,buildingPoint(b,along,depth-.5));add('back',along,buildingPoint(b,along,.5));}
 for(let along=.5;along<depth;along+=1){add('left',along,buildingPoint(b,.5,along));add('right',along,buildingPoint(b,width-.5,along));}
 return rows;
}
function sideNormal(side,rotation=0){
 const normals={front:[0,1],back:[0,-1],left:[-1,0],right:[1,0]},[x,y]=normals[side];
 switch(rotation||0){case 1:return [y,-x];case 2:return [-x,-y];case 3:return [-y,x];default:return [x,y];}
}
function balconyPosition(b,space,depth){
 const {width,depth:buildingDepth}=modelSize(b),along=space.along,[nx,ny]=sideNormal(space.side,b.rotation);
 let p;
 if(space.side==='front')p=buildingPoint(b,along,buildingDepth-.5);
 else if(space.side==='back')p=buildingPoint(b,along,.5);
 else if(space.side==='left')p=buildingPoint(b,.5,along);
 else p=buildingPoint(b,width-.5,along);
 return {x:b.entity.x+p.x+nx*(.5+depth*.5),y:b.entity.y+p.y+ny*(.5+depth*.5)};
}
export function buildingLeisureSpaces(b){
 if(!b||['townhall','council_chamber'].includes(b.type)||b.constructionKind==='open-air'||b.officeTenantOf)return [];
 const key=`${b.layoutRevision||0}:${b.floors}:${b.rotation||0}:${b.type}:${b.architecture}`,old=cache.get(b);if(old?.key===key)return old.spaces;
 const {width,depth}=modelSize(b),variant=hash(b.id,37)%5,spaces=[];
 const add=(candidate,w,d,planters)=>{
  const alongLength=['front','back'].includes(candidate.side)?width:depth,edgeClearance=Math.min(candidate.along,alongLength-candidate.along),maxCenteredWidth=Math.max(.6,edgeClearance*2-.08),balconyWidth=Math.min(Math.max(.6,w),Math.max(.6,alongLength-.14),maxCenteredWidth);
  const pos=balconyPosition(b,candidate,d),doorBit=SIDE_BITS[candidate.side][(b.rotation||0)%4];
  spaces.push({id:`balcony:${candidate.unit.id}`,kind:'balcony',floor:candidate.unit.z,unitId:candidate.unit.id,side:candidate.side,doorBit,along:candidate.along,doorAlong:candidate.along,width:balconyWidth,depth:d,planters,position:{x:pos.x,y:pos.y,z:candidate.unit.z*CITY_FLOOR_HEIGHT+.14},capacity:1});
 };
 for(let floor=1;floor<b.floors;floor++){
  const candidates=sideCandidates(b,floor);
  if(homes.has(b.type)){
   const byUnit=new Map();for(const candidate of candidates){let list=byUnit.get(candidate.unit.id);if(!list)byUnit.set(candidate.unit.id,list=[]);list.push(candidate);}
   for(const [unitId,options]of byUnit){const unit=options[0].unit;if(hash(b.id,floor,unit.x,unit.y)%3!==0)continue;const pick=hash(b.id,floor,unit.x,unit.y,11)%options.length,candidate=options[pick],alongLength=['front','back'].includes(candidate.side)?width:depth;
    add(candidate,Math.min(.82,alongLength-.14),hash(b.id,floor,candidate.unit.x,candidate.unit.y)%2?.68:.85,(hash(b.id,candidate.unit.x,candidate.unit.y,floor)%3)===0);
   }
  }else if((floor+variant)%2===0&&candidates.length){
   const candidate=candidates[hash(b.id,floor,variant)%candidates.length],alongLength=['front','back'].includes(candidate.side)?width:depth;
   add(candidate,Math.min(Math.max(.9,width-.4),alongLength-.14),.62,variant%2===0);
  }
 }
 if((homes.has(b.type)&&(HOUSE_STYLES[b.architecture]||HOUSE_STYLES.modern).roofKind==='flat')||b.type==='office_tower'){
  const unit=b.units.find(u=>u.z===b.floors-1&&['bedroom','workspace','office'].includes(u.roomType));if(unit){const pos=buildingPoint(b,width*.5,depth*.5);spaces.push({id:`roof:${b.id}`,kind:'roof_terrace',floor:b.floors-1,unitId:unit.id,position:{x:b.entity.x+pos.x,y:b.entity.y+pos.y,z:b.floors*CITY_FLOOR_HEIGHT+.23},capacity:4});}
 }
 cache.set(b,{key,spaces});return spaces;
}
