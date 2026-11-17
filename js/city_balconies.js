import {buildingFloorDesign} from './city_facade_patterns.js';
import {buildingPoint,modelSize,CITY_FLOOR_HEIGHT} from './city_building_geometry.js';
import {HOUSE_STYLES} from './city_culture.js?v=colonial-colored-trim-1';
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
 const styleVariant=hash(b.id,17)%4,balconyDepth=homes.has(b.type)?(variant%2?.68:.85):.62;
 const add=(candidate,w,d,planters,styleVariant)=>{
  const alongLength=['front','back'].includes(candidate.side)?width:depth,edgeClearance=Math.min(candidate.along,alongLength-candidate.along),maxCenteredWidth=Math.max(.6,edgeClearance*2-.08),balconyWidth=Math.min(Math.max(.6,w),Math.max(.6,alongLength-.14),maxCenteredWidth);
  const pos=balconyPosition(b,candidate,d),doorBit=SIDE_BITS[candidate.side][(b.rotation||0)%4];
  spaces.push({id:`balcony:${candidate.unit.id}`,kind:'balcony',floor:candidate.unit.z,unitId:candidate.unit.id,side:candidate.side,doorBit,along:candidate.along,doorAlong:candidate.along,width:balconyWidth,depth:d,planters,styleVariant,balconyStyle:['iron','stone','wood','lattice'][styleVariant],position:{x:pos.x,y:pos.y,z:candidate.unit.z*CITY_FLOOR_HEIGHT+.14},capacity:1});
 };
 // Choose facade columns once, then repeat them in a cycle of floor types.
 // A column needs an accessible room on every floor; never move a balcony
 // sideways to compensate for a bathroom or another ineligible room.
 const floors=Array.from({length:Math.max(0,b.floors-1)},(_,i)=>sideCandidates(b,i+1));
 const columnKey=c=>`${c.side}:${c.along}`;
 const columns=floors.map(rows=>new Map(rows.map(c=>[columnKey(c),c])));
 const candidates=(floors[0]||[]).filter(c=>columns.every(rows=>rows.has(columnKey(c))));
 // Keep balconies on one principal facade, away from corners and each other.
 // Repeated bays provide structure even when intermediate floors omit balconies.
 const side=['front','back','left','right'].find(side=>candidates.some(c=>c.side===side));
 const length=['front','back'].includes(side)?width:depth;
 const onSide=candidates.filter(c=>c.side===side),inner=onSide.filter(c=>c.along>1&&c.along<length-1);
 const available=inner.length?inner:onSide;
 const targets=length>=5?[length/3,length*2/3]:[length/2],pattern=[];
 for(const target of targets){
  const candidate=[...available].sort((a,b)=>Math.abs(a.along-target)-Math.abs(b.along-target)||a.along-b.along).find(c=>pattern.every(p=>Math.abs(p.along-c.along)>=2));
  if(candidate)pattern.push(candidate);
 }
 for(let floor=1;floor<b.floors;floor++){
  const design=buildingFloorDesign(b,floor);
  if(!design.balconies)continue;
  const rows=columns[floor-1],floorPattern=design.index===2?pattern.slice(0,1):pattern;
  for(const column of floorPattern.length?floorPattern:pattern.slice(0,1)){
   const candidate=rows.get(columnKey(column)),alongLength=['front','back'].includes(candidate.side)?width:depth;
   add(candidate,Math.min(design.index===2?.68:homes.has(b.type)?.82:Math.max(.9,width-.4),alongLength-.14),balconyDepth,design.index===3,styleVariant);
  }
 }
 if((homes.has(b.type)&&(HOUSE_STYLES[b.architecture]||HOUSE_STYLES.modern).roofKind==='flat')||b.type==='office_tower'){
  const unit=b.units.find(u=>u.z===b.floors-1&&['bedroom','workspace','office'].includes(u.roomType));if(unit){const pos=buildingPoint(b,width*.5,depth*.5);spaces.push({id:`roof:${b.id}`,kind:'roof_terrace',floor:b.floors-1,unitId:unit.id,position:{x:b.entity.x+pos.x,y:b.entity.y+pos.y,z:b.floors*CITY_FLOOR_HEIGHT+.23},capacity:4});}
 }
 cache.set(b,{key,spaces});return spaces;
}
