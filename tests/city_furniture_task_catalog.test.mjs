import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {furnitureInteraction,roomFurniture,TASK_DESTINATION_KINDS,TASK_FURNITURE_PROFILES} from '../js/city_furniture_catalog.js';
import {interiorRoute,interiorUsePoint} from '../js/city_interior_layout.js';
import {BUILDING_ACTIVITY_PROFILE_TYPES,buildingActivityProfile} from '../js/city_building_activity_profiles.js';
import {BUILDING_TYPES} from '../js/city_simulation.js?v=beach-chair-2';
import {activityRoomReady,advanceCitizenInterior} from '../js/city_interiors.js';

const root=resolve(import.meta.dirname,'..');
function sourceTasks(){
 const tasks=new Set();for(const file of readdirSync(resolve(root,'js')).filter(name=>name.endsWith('.js'))){const source=readFileSync(resolve(root,'js',file),'utf8');for(const match of source.matchAll(/task\s*[:=]\s*['"]([a-z][a-z-]+)['"]/g))tasks.add(match[1]);}
 const interiors=readFileSync(resolve(root,'js/city_interiors.js'),'utf8'),set=interiors.match(/INDOOR_TASKS=new Set\(\[([^\]]+)/)?.[1]||'';for(const match of set.matchAll(/['"]([a-z][a-z_-]+)['"]/g))tasks.add(match[1]);return tasks;
}
function layoutBuilding(){
 const units=[];for(let y=0;y<4;y++)for(let x=0;x<4;x++)units.push({id:`fixture:${x}:${y}:0`,x,y,z:0,roomType:'workspace'});
 return {id:'fixture',type:'residential',entity:{x:10,y:10},width:4,depth:4,floors:1,rotation:0,layoutRevision:1,door:{x:12.5,y:9.5},units,circulation:[]};
}

test('every task identifier has an explicit furniture or spatial fallback profile',()=>{
 const missing=[...sourceTasks()].filter(task=>!TASK_FURNITURE_PROFILES[task]);assert.deepEqual(missing,[]);
 for(const [task,profile]of Object.entries(TASK_FURNITURE_PROFILES)){assert.ok(Array.isArray(profile.item),task);assert.ok(profile.pose,task);assert.ok(Array.isArray(profile.room),task);assert.ok(TASK_DESTINATION_KINDS[task],`${task} destination`);}
 for(const task of ['walk','combat-flee','police-arrest-escort','custody-escort','lake-water'])assert.deepEqual(TASK_FURNITURE_PROFILES[task].item,[]);
});

test('every furniture-backed task resolves to an actual item in a registered building room',()=>{
 for(const [task,profile] of Object.entries(TASK_FURNITURE_PROFILES)){
  if(!profile.item.length)continue;
  let found=false;
  for(const roomType of profile.room){
   if(roomType==='balcony'||roomType==='roof_terrace'){
    const b={type:'residential',entity:{x:0,y:0},layoutRevision:0},unit={id:`residential:${roomType}`,x:0,y:0,z:0,roomType};
    if(furnitureInteraction(b,unit,roomType,0,task)){found=true;break;}
   }
   for(const type of BUILDING_ACTIVITY_PROFILE_TYPES){
    if(!buildingActivityProfile(type).roomTypes.includes(roomType))continue;
    const b={type,entity:{x:0,y:0},width:5,depth:5,floors:1,layoutRevision:0,units:[{id:`${type}:${roomType}`,x:2,y:2,z:0,roomType}]};
    if(furnitureInteraction(b,b.units[0],roomType,0,task)){found=true;break;}
   }
   if(found)break;
  }
  assert.equal(found,true,`${task} has no physical item in a registered room`);
 }
});

test('core room layouts place deterministic furniture with non-overlapping footprints inside their room cell',()=>{
 const b={type:'residential',entity:{x:0,y:0},layoutRevision:0};for(const roomType of ['bedroom','bathroom','dining','office','treatment','cell','service','plenary','workspace']){
  const u={id:`room:${roomType}`,x:0,y:0,z:0,roomType},first=roomFurniture(b,u),second=roomFurniture(b,u);assert.deepEqual(first,second,roomType);
  for(const item of first){const halfW=item.footprint.width/2,halfD=item.footprint.depth/2;assert.ok(item.x-halfW>=u.x&&item.x+halfW<=u.x+1,`${roomType}/${item.type} leaves the cell`);assert.ok(item.y-halfD>=u.y&&item.y+halfD<=u.y+1,`${roomType}/${item.type} leaves the cell`);}
  for(let i=0;i<first.length;i++)for(let j=i+1;j<first.length;j++){const a=first[i],z=first[j];assert.ok(Math.abs(a.x-z.x)>=a.footprint.width/2+z.footprint.width/2||Math.abs(a.y-z.y)>=a.footprint.depth/2+z.footprint.depth/2,`${roomType}: ${a.type} overlaps ${z.type}`);}
 }
});

test('every residential typology has sleeping, child-care and visit furniture',()=>{
 for(const type of ['residential','super_popular_housing','popular_housing','popular_luxury_housing','luxury_housing']){
  const building={type,entity:{x:0,y:0},layoutRevision:0},unit={id:`${type}:bedroom`,x:0,y:0,z:0,roomType:'bedroom'},items=roomFurniture(building,unit);
  for(const task of ['energy','care','caregiving','provisions'])assert.ok(furnitureInteraction(building,unit,'bedroom',0,task),`${type}/${task}`);
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const a=items[i],b=items[j];assert.ok(Math.abs(a.x-b.x)>=a.footprint.width/2+b.footprint.width/2-1e-8||Math.abs(a.y-b.y)>=a.footprint.depth/2+b.footprint.depth/2-1e-8,`${type}: ${a.type} overlaps ${b.type}`);}
 }
});

test('the declared rooms for every registered building type fit their furniture inside each unit',()=>{
 assert.deepEqual(BUILDING_ACTIVITY_PROFILE_TYPES,[...Object.keys(BUILDING_TYPES)].sort());
 for(const type of BUILDING_ACTIVITY_PROFILE_TYPES){const b={type,entity:{x:0,y:0},width:5,depth:5,floors:2,layoutRevision:0};for(const roomType of buildingActivityProfile(type).roomTypes){const u={id:`${type}:${roomType}`,x:2,y:2,z:1,roomType},items=roomFurniture(b,u);for(const item of items){const {width,depth}=item.footprint;assert.ok(item.x-width/2>=u.x-1e-8&&item.x+width/2<=u.x+1+1e-8,`${type}/${roomType}/${item.type} exceeds room width`);assert.ok(item.y-depth/2>=u.y-1e-8&&item.y+depth/2<=u.y+1+1e-8,`${type}/${roomType}/${item.type} exceeds room depth`);}for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const a=items[i],z=items[j];assert.ok(Math.abs(a.x-z.x)>=a.footprint.width/2+z.footprint.width/2-1e-8||Math.abs(a.y-z.y)>=a.footprint.depth/2+z.footprint.depth/2-1e-8,`${type}/${roomType}: ${a.type} overlaps ${z.type}`);}}}
});

test('sleep, hygiene, meal, work and service tasks receive distinct physical interaction points',()=>{
 const b=layoutBuilding(),room=(x,y,roomType)=>Object.assign(b.units.find(u=>u.x===x&&u.y===y),{roomType});
 const cases=[['energy',b,room(0,0,'bedroom'),'bedroom','bed'],['toilet',b,room(3,0,'bathroom'),'bathroom','toilet'],['hygiene',b,room(0,3,'bathroom'),'bathroom','shower'],['workmeal',b,room(3,3,'dining'),'dining','chair'],['work',b,room(0,1,'workspace'),'workspace',null],['health',b,room(3,1,'treatment'),'treatment','exam_bed'],['vote',{...b,type:'townhall'},room(1,0,'service'),'service','ballot_booth']];
 for(const [task,building,u,kind,type]of cases){const interaction=furnitureInteraction(building,u,kind,0,task);assert.ok(interaction,task);if(type)assert.equal(interaction.item.type,type,task);assert.ok(interaction.item.id.startsWith(`furniture:${u.id}:`),task);assert.deepEqual(interiorUsePoint(building,u,kind,0,task),interaction.point);assert.ok(interiorRoute(building,building.door,interaction.point),`${task} has no route to its furniture`);}
});

test('each indoor task family routes to its task-appropriate furniture',()=>{
 const cases=[
  ['energy','residential','bedroom'],['toilet','residential','bathroom'],['hygiene','residential','bathroom'],['water','bank','workspace'],['food','residential','dining'],['workmeal','residential','dining'],['provisions','residential','dining'],['supplies','market','service'],['care','residential','bedroom'],['caregiving','residential','bedroom'],['health','clinic','treatment'],['work','steel_mill','workspace'],['manage','bank','office'],['work-wait','bank','waiting'],['construction','builder','workspace'],['job-interview','bank','office'],['interview','bank','office'],['research','newsroom','workspace'],['council-session','council_chamber','plenary'],['vote','townhall','service'],['clean','residential','bathroom'],['informal-service','cleaner','workspace'],['shopping','laundromat','laundry'],['leisure','park','waiting'],['social','library','waiting'],['visit','residential','bedroom'],['sit','residential','waiting'],['justice-report','courthouse','service'],['police-patrol','police_station','office'],['police-response','police_station','office'],['police-investigation','police_station','office'],['police-oversight','council_oversight_office','office'],['police-restitution','police_station','service'],['custody','jail','cell'],['custody-water','jail','workspace'],['funeral','crematorium','treatment'],['paint-purchase','builder','service'],['paint-delivery','builder','workspace'],['campaign','townhall','service'],['urban-graffiti','paintworks','workspace'],['transport','carrier','workspace'],
 ];
 for(const [task,type,roomType]of cases){const b={...layoutBuilding(),type,width:5,depth:5,units:Array.from({length:25},(_,i)=>({id:`${type}:${i}`,x:i%5,y:Math.floor(i/5),z:0,roomType:'workspace'}))},u=b.units.find(u=>u.x===2&&u.y===2);u.roomType=roomType;const interaction=furnitureInteraction(b,u,roomType,0,task);assert.ok(interaction,task);assert.ok(interaction.item.id.startsWith(`furniture:${u.id}:`),task);assert.ok(interiorRoute(b,b.door,interaction.point),`${task} has no navigable approach`);}
 const justice={...layoutBuilding(),type:'police_station',width:5,depth:5,units:[{id:'police-office',x:2,y:2,z:0,roomType:'office'},{id:'police-service',x:3,y:2,z:0,roomType:'service'}]};for(const [task,u,expected]of [['police-patrol',justice.units[0],'equipment_locker'],['police-investigation',justice.units[0],'evidence_board'],['police-restitution',justice.units[1],'evidence_counter']])assert.equal(furnitureInteraction(justice,u,u.roomType,0,task).item.type,expected,task);const response=furnitureInteraction(justice,justice.units[0],'office',0,'police-response');assert.equal(response.taskStation.type,'dispatch_desk');assert.equal(response.item.type,'chair');
});

test('job interviews use a real meeting seat in industrial workplaces and service rooms',()=>{
 for(const [type,roomType] of [['recycler','workspace'],['composting','workspace'],['waste_collector','workspace'],['recycler','service']]){
  const b={...layoutBuilding(),type,width:5,depth:5,units:Array.from({length:25},(_,i)=>({id:`${type}:${roomType}:${i}`,x:i%5,y:Math.floor(i/5),z:0,roomType:'workspace'}))};
  const unit=b.units.find(u=>u.x===2&&u.y===2);unit.roomType=roomType;b.door={x:2.5,y:-.5};
  const interaction=furnitureInteraction(b,unit,roomType,0,'job-interview');
  assert.ok(interaction,`${type}/${roomType} has an interview station`);
  assert.equal(interaction.item.type,'meeting_chair',`${type}/${roomType} uses a meeting seat`);
  assert.ok(interiorRoute(b,b.door,interaction.point),`${type}/${roomType} interview seat is reachable`);
 }
});

test('approach paths stay clear of furniture footprints and approach slots remain outside them',()=>{
 const scenarios=[
  ['residential','bedroom','energy'],['residential','bathroom','toilet'],['residential','bathroom','hygiene'],['residential','dining','workmeal'],
  ['residential','workspace','work'],['bank','office','manage'],['market','service','supplies'],['laundromat','laundry','shopping'],
  ['clinic','treatment','health'],['council_chamber','plenary','council-session'],['police_station','office','police-investigation'],['jail','cell','custody'],
 ];
 const intersects=(p,item)=>Math.abs(p.x-item.x)<item.footprint.width/2+.015&&Math.abs(p.y-item.y)<item.footprint.depth/2+.015;
 for(const [type,roomType,task] of scenarios){
  const building={...layoutBuilding(),type,width:5,depth:5,units:Array.from({length:25},(_,i)=>({id:`${type}:${i}`,x:i%5,y:Math.floor(i/5),z:0,roomType:'workspace'}))};
  const unit=building.units.find(u=>u.x===2&&u.y===2);unit.roomType=roomType;building.door={x:2.5,y:-.5};
  const interaction=furnitureInteraction(building,unit,roomType,0,task);assert.ok(interaction,`${type}/${task} has an interaction`);
  assert.ok(!roomFurniture(building,unit).some(item=>intersects(interaction.point,item)),`${type}/${task} access point overlaps furniture`);
  const route=interiorRoute(building,building.door,interaction.point);assert.ok(route,`${type}/${task} has a route`);
  const dense=[];for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],distance=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z),steps=Math.max(1,Math.ceil(distance/.08));for(let n=0;n<=steps;n++){const t=n/steps;dense.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});}}
  for(const p of dense){if(Math.hypot(p.x-interaction.point.x,p.y-interaction.point.y)<.03)continue;for(const room of building.units)for(const item of roomFurniture(building,room))if(item.z===p.z)assert.ok(!intersects(p,item),`${type}/${task} route intersects ${item.id} at (${p.x.toFixed(2)},${p.y.toFixed(2)})`);}
 }
});

test('two meal visitors reserve different chairs and arrive at them before use',()=>{
 const b=layoutBuilding(),room={...b.units[0],id:'dining-room',roomType:'dining',activityReservedIds:[]};b.units=[room];b.door={x:2.5,y:-.5};
 const citizens=[1,2].map(id=>({id,entity:{x:b.door.x,y:b.door.y,destroyed:false},task:'workmeal',path:[],workMeal:true,needs:{},action:''}));
 const city={minute:60,structureRevision:0,buildings:[b],citizens,units:new Map([[room.id,room]]),accounts:new Map(),building:id=>id===b.id?b:null,society:{citizen:id=>citizens.find(c=>c.id===id)}};
 for(const c of citizens)assert.equal(activityRoomReady(city,c,b,room,'dining'),false);
 assert.notEqual(citizens[0].indoorLocation.furnitureSlot,citizens[1].indoorLocation.furnitureSlot);
 assert.notDeepEqual(citizens[0].indoorLocation.path.at(-1),citizens[1].indoorLocation.path.at(-1));
 for(const c of citizens){advanceCitizenInterior(city,c,100);assert.equal(activityRoomReady(city,c,b,room,'dining'),true);assert.equal(c.indoorLocation.phase,'using');assert.equal(c.indoorLocation.roomType,'dining');assert.equal(c.indoorLocation.furnitureId!=null,true);}
});

test('a police oversight review reaches its evidence board inside the oversight office',()=>{
 const b={...layoutBuilding(),type:'council_oversight_office',units:[{id:'review-room',x:2,y:2,z:0,roomType:'office',activityReservedIds:[]}]};b.door={x:2.5,y:-.5};
 const c={id:44,entity:{x:b.door.x,y:b.door.y,destroyed:false},task:'police-oversight',targetId:b.id,policeOversight:{caseId:1},path:[],needs:{},action:''};
 const city={minute:90,structureRevision:0,citizens:[c],units:new Map([[b.units[0].id,b.units[0]]]),accounts:new Map(),building:id=>id===b.id?b:null,society:{citizen:id=>id===c.id?c:null}};
 assert.equal(activityRoomReady(city,c,b,b.units[0],'office'),false);for(let i=0;i<100&&c.indoorLocation?.path?.length;i++)advanceCitizenInterior(city,c,100);
 assert.equal(activityRoomReady(city,c,b,b.units[0],'office'),true);assert.equal(c.indoorLocation.furnitureId,furnitureInteraction(b,b.units[0],'office',0,'police-oversight').item.id);assert.equal(furnitureInteraction(b,b.units[0],'office',0,'police-oversight').item.type,'evidence_board');
});
