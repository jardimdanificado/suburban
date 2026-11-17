import test from 'node:test';
import assert from 'node:assert/strict';
import {CityHousing} from '../js/city_housing.js';
import {modelSize} from '../js/city_building_geometry.js';
import {buildingFloorDesign,buildingFacadeWindowMask} from '../js/city_facade_patterns.js';
import {buildingLeisureSpaces} from '../js/city_balconies.js';

function building(type,rotation=0){
 const city={buildingTypes:{[type]:{rent:120,price:120000}},currency:{price:value=>value},units:new Map(),minute:0};
 const housing=new CityHousing(city),b={id:23,type,width:4,depth:3,floors:10,rotation,architecture:'modern',entity:{x:10,y:10},units:[],constructionKind:'building'};
 for(let floor=0;floor<b.floors;floor++)housing.addFloor(b,floor,'treasury');
 return b;
}
const balconyPattern=spaces=>spaces.map(({side,along,width,depth,balconyStyle,planters})=>({side,along,width,depth,balconyStyle,planters}));

for(const type of ['residential','super_popular_housing','popular_housing','popular_luxury_housing','luxury_housing','office_tower']){
 test(`${type} repeats a cycle of floor designs across rotations`,()=>{
  for(let rotation=0;rotation<4;rotation++){
   const b=building(type,rotation),balconies=buildingLeisureSpaces(b).filter(s=>s.kind==='balcony');
   assert(balconies.length>0);
   const {period}=buildingFloorDesign(b,1);
   assert.equal(balconies.filter(s=>s.floor===2).length,0);
   for(let floor=1;floor+period<b.floors;floor++){
    assert.deepEqual(balconyPattern(balconies.filter(s=>s.floor===floor+period)),balconyPattern(balconies.filter(s=>s.floor===floor)));
   }
   for(let floor=1;floor<b.floors;floor++)assert(new Set(balconies.filter(s=>s.floor===floor).map(s=>s.balconyStyle)).size<=1);
   for(const space of balconies){
    assert.equal(b.units.find(u=>u.id===space.unitId).z,space.floor);
    const size=modelSize(b),length=['front','back'].includes(space.side)?size.width:size.depth;
    assert(space.along-space.width/2>=0);
    assert(space.along+space.width/2<=length);
   }
  }
 });
 test(`${type} keeps window models and room layout consistent above ground floor`,()=>{
  const b=building(type),first=b.units.filter(u=>u.z===1);
  assert.equal(new Set(b.units.map(u=>u.windowStyle)).size,1);
  for(const room of first)for(let floor=2;floor<b.floors;floor++){
   const upper=b.units.find(u=>u.x===room.x&&u.y===room.y&&u.z===floor);
   assert.equal(upper.roomType,room.roomType);
   assert.equal(upper.hasWindow,room.hasWindow);
  }
 });
}

test('balcony columns never shift to bypass a room without balcony access',()=>{
 const b=building('popular_housing'),before=buildingLeisureSpaces(b).find(s=>s.kind==='balcony'&&s.floor===1);
 const room=b.units.find(u=>u.id===before.unitId),upper=b.units.find(u=>u.x===room.x&&u.y===room.y&&u.z===3);
 upper.roomType='bathroom';b.layoutRevision++;
 const balconies=buildingLeisureSpaces(b).filter(s=>s.kind==='balcony');
 assert(!balconies.some(s=>s.side===before.side&&s.along===before.along));
 for(const space of balconies)assert(['bedroom','workspace','office'].includes(b.units.find(u=>u.id===space.unitId).roomType));
});

test('buildings use two, three or four floor types without depending on height',()=>{
 const periods=new Set();
 for(let id=1;id<=30;id++){
  const b={id,floors:9},first=buildingFloorDesign(b,1),styles=new Set();
  periods.add(first.period);
  for(let floor=1;floor<=first.period;floor++){
   const design=buildingFloorDesign(b,floor);styles.add(design.windowStyle);
   assert.deepEqual(buildingFloorDesign(b,floor+first.period),design);
   assert.deepEqual(buildingFloorDesign({...b,floors:20},floor),design);
  }
  assert.equal(styles.size,1);
 }
 assert.deepEqual([...periods].sort(),[2,3,4]);
});

test('window rhythm leaves most facade bays solid and repeats by floor type',()=>{
 for(let rotation=0;rotation<4;rotation++){
  const b=building('super_popular_housing',rotation),{period}=buildingFloorDesign(b,1);
  for(let floor=1;floor<=period;floor++){
   let windows=0;
   for(const u of b.units.filter(u=>u.z===floor)){
    const mask=(u.y===0?1:0)|(u.y===b.depth-1?2:0)|(u.x===0?4:0)|(u.x===b.width-1?8:0);
    const opening=buildingFacadeWindowMask(b,u,mask);
    if(opening)windows++;
    assert.equal(opening&~mask,0);
    assert.equal(buildingFacadeWindowMask(b,{...u,z:floor+period},mask),opening);
    assert.equal(buildingFacadeWindowMask(b,{...u,hasWindow:false},mask),0);
   }
   const count=b.units.filter(u=>u.z===floor).length;
   assert(windows>0);assert(windows<=count/2);
  }
 }
});

test('small facades keep a window bay and never open a blocked side',()=>{
 for(let length=1;length<=2;length++)for(let floor=0;floor<5;floor++){
  const b={id:1,width:length,depth:1};
  let windows=0;
  for(let x=0;x<length;x++){
   const u={x,y:0,z:floor,hasWindow:true};
   windows+=!!buildingFacadeWindowMask(b,u,2);
   assert.equal(buildingFacadeWindowMask(b,u,0),0);
  }
  assert.equal(windows,1);
 }
});

test('balconies share one material and occupy spaced bays on one facade',()=>{
 for(let rotation=0;rotation<4;rotation++){
  const b=building('popular_housing',rotation),spaces=buildingLeisureSpaces(b).filter(s=>s.kind==='balcony');
  assert.equal(new Set(spaces.map(s=>s.side)).size,1);
  assert.equal(new Set(spaces.map(s=>s.balconyStyle)).size,1);
  for(let floor=1;floor<b.floors;floor++){
   const bays=spaces.filter(s=>s.floor===floor);
   assert(bays.length<=2);
   for(let i=0;i<bays.length;i++)for(let j=i+1;j<bays.length;j++)assert(Math.abs(bays[i].along-bays[j].along)>=2);
  }
 }
});

test('window bays stay vertically aligned across different floor types',()=>{
 const b=building('super_popular_housing');
 for(const u of b.units.filter(u=>u.z===1)){
  const mask=(u.y===0?1:0)|(u.y===b.depth-1?2:0)|(u.x===0?4:0)|(u.x===b.width-1?8:0);
  const opening=buildingFacadeWindowMask(b,u,mask);
  for(let floor=2;floor<b.floors;floor++)assert.equal(buildingFacadeWindowMask(b,{...u,z:floor},mask),opening);
 }
});
