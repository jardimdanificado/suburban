import {CITY_FLOOR_HEIGHT} from './city_building_geometry.js';
// Outdoor coordinates remain the navigation anchor at the entrance. Interior
// position, circulation and floor changes are separate physical coordinates.
const INDOOR_TASKS=new Set(['work','manage','shopping','food','water','health','energy','hygiene','toilet','care','caregiving','provisions','workmeal','council-session','construction','vote','clean','leisure','social']);
const OUTDOOR_WORK=new Set(['farm','quarry','forestry']);
const citizenKeys=[];
const citizen=(city,id)=>city.accounts.get(Number.isInteger(id)&&id>=0&&id<65536?(citizenKeys[id]??=`citizen:${id}`):`citizen:${id}`)||city.society.citizen(id);
const indoorCitizenCaches=new WeakMap();
function indoorCitizenCache(city){let cache=indoorCitizenCaches.get(city);if(!cache||cache.revision!==city.structureRevision||cache.accounts!==city.accounts){cache={revision:city.structureRevision,accounts:city.accounts,people:[]};indoorCitizenCaches.set(city,cache);}return cache.people;}
const point=(b,u)=>({x:b.entity.x+u.x+.5,y:b.entity.y+u.y+.5,z:u.z*CITY_FLOOR_HEIGHT});
function release(city,c){const id=c.indoorLocation?.targetUnitId||c.indoorLocation?.unitId,u=city.units.get(id);if(u?.activityReservedIds)u.activityReservedIds=u.activityReservedIds.filter(id=>id!==c.id);if(c.workCell?.unitId===id)c.workCell=null;}
export function activityCellAvailable(city,u,c,kind){
 if(!u.activityReservedIds?.length){u.activityReservedIds??=[];return true;}
 const visitor=kind==='service'||kind==='treatment',workers=kind==='workspace'||kind==='office',ids=u.activityReservedIds,people=indoorCitizenCache(city);let reserved=null,occupants=0,alreadyReserved=false;
 for(let i=0;i<ids.length;i++){const id=ids[i],cacheable=Number.isInteger(id)&&id>=0&&id<65536;let other=cacheable?people[id]:undefined;if(!other){other=citizen(city,id);if(other&&cacheable)people[id]=other;}const location=other?.indoorLocation;if(!other||other.entity.destroyed||location?.exiting||(location?.targetUnitId!==u.id&&location?.unitId!==u.id)){reserved??=ids.slice(0,i);continue;}if(reserved)reserved.push(id);if(id===c.id)alreadyReserved=true;const type=location?.targetRoomType;if(visitor?type!=='workspace'&&type!=='office':workers?type!=='service'&&type!=='treatment':true)occupants++;}
 if(reserved)u.activityReservedIds=reserved;
 const capacity=visitor?4:kind==='bathroom'||kind==='office'?1:kind==='dining'||kind==='plenary'?4:kind==='bedroom'?4:1;
 return alreadyReserved||occupants<capacity;
}
function route(from,to){const path=[],p={...from};for(const axis of ['x','y','z'])while(Math.abs(p[axis]-to[axis])>.001){p[axis]+=Math.sign(to[axis]-p[axis])*Math.min(1,Math.abs(to[axis]-p[axis]));path.push({...p});}return path;}
function interiorRoute(b,from,to){
 if(Math.abs(from.z-to.z)<.001)return route(from,to);
 const stair={x:b.entity.x+Math.floor(b.width/2)+.5,y:b.entity.y+Math.floor(b.depth/2)+.5,z:from.z},landing={...stair,z:to.z};
 return [...route(from,stair),...route(stair,landing),...route(landing,to)];
}

function exit(city,c){
 const s=c.indoorLocation;if(!s)return true;
 const b=city.building(s.buildingId);if(!b||b.entity.destroyed){release(city,c);c.indoorLocation=null;return true;}
 if(b.constructionKind==='open-air'){release(city,c);c.indoorLocation=null;return true;}
 if(!s.exiting){release(city,c);s.exiting=true;s.roomType='circulation';c.action='Saindo do prédio';s.unitId=null;s.targetUnitId=null;s.path=interiorRoute(b,s.position||{x:b.door.x,y:b.door.y,z:0},{x:b.door.x,y:b.door.y,z:0});}
 if(!s.path.length){c.indoorLocation=null;return true;}return false;
}
function normalizeInterior(city,c){
 const old=c.indoorLocation;if(old&&!old.path){const building=city.building(old.buildingId),unit=city.units.get(old.unitId);old.path=[];old.targetUnitId=old.unitId;old.targetRoomType=old.roomType;old.position=building&&unit?point(building,unit):{x:c.entity.x,y:c.entity.y,z:0};}
}

export function advanceCitizenInterior(city,c,minutes=1){
 const s=c.indoorLocation;if(!s?.path?.length)return;
 let distance=Math.max(0,minutes);
 while(distance>0&&s.path.length){const target=s.path[0],p=s.position,dx=target.x-p.x,dy=target.y-p.y,dz=target.z-p.z,len=Math.hypot(dx,dy,dz),d=Math.min(distance,len);if(len>0){p.x+=dx/len*d;p.y+=dy/len*d;p.z+=dz/len*d;}distance-=d;if(len<=d+.00001)s.path.shift();}
 s.floor=Math.max(0,Math.floor(s.position.z/CITY_FLOOR_HEIGHT+.001));
 if(!s.path.length){if(s.exiting)c.indoorLocation=null;else{s.unitId=s.targetUnitId;s.roomType=s.targetRoomType;s.arrivedAt=city.minute;}}
}
export function activityRoomReady(city,c,b,room,kind=room?.roomType||'workspace'){
 normalizeInterior(city,c);
 if(!b||!room||c.entity.destroyed||c.mobilityTrip||c.ridingVehicleId)return false;
 const previous=c.indoorLocation;
 if(previous?.buildingId===b.id&&previous.targetUnitId===room.id&&!previous.exiting&&previous.layoutRevision===(b.layoutRevision||0))return !previous.path.length;
 if(previous?.buildingId!==b.id&&previous&&!exit(city,c))return false;
 if(!activityCellAvailable(city,room,c,kind)){if(['toilet','hygiene'].includes(c.task)){c.task=null;c.toiletTargetId=null;c.hygieneTargetId=null;}c.action=`Aguardando célula de ${kind==='bathroom'?'banheiro':kind==='dining'?'refeitório':'trabalho'} livre`;return false;}
 if(b.constructionKind==='open-air'&&b.type!=='quarry'){
  const target=point(b,room);
  if(!outdoorCellReady(city,c,b,room)){return false;}
  release(city,c);c.indoorLocation={buildingId:b.id,targetUnitId:room.id,unitId:room.id,targetRoomType:kind,roomType:kind,floor:room.z,position:target,path:[],task:c.workMeal?'workmeal':c.task,layoutRevision:b.layoutRevision||0,enteredAt:city.minute,arrivedAt:city.minute,toiletTargetId:c.toiletTargetId};
 }else{
  if(c.path.length)return false;
  if(!previous&&Math.hypot(c.entity.x-b.door.x,c.entity.y-b.door.y)>1.5){const path=city.findPath(c.entity,b.door);if(path!==null)c.path=path;return false;}
  const from=previous?.buildingId===b.id?previous.position:{x:b.door.x,y:b.door.y,z:0};release(city,c);
  const target=point(b,room),path=interiorRoute(b,from,target);
  c.indoorLocation={buildingId:b.id,targetUnitId:room.id,unitId:path.length?null:room.id,targetRoomType:kind,roomType:path.length?'circulation':kind,floor:Math.floor(from.z/CITY_FLOOR_HEIGHT),position:{...from},path,task:c.workMeal?'workmeal':c.task,layoutRevision:b.layoutRevision||0,enteredAt:previous?.buildingId===b.id?previous.enteredAt:city.minute,toiletTargetId:c.toiletTargetId};
 }
 c.workCell={buildingId:b.id,unitId:room.id,x:room.x,y:room.y,z:room.z,target:point(b,room)};
 if(!room.activityReservedIds.includes(c.id))room.activityReservedIds.push(c.id);
 if(c.indoorLocation.path.length)c.action=`Indo à célula de ${kind}`;
 return !c.indoorLocation.path.length;
}
export function outdoorCellReady(city,c,b,u,adjacent=false){
 if(c.indoorLocation&&!exit(city,c))return false;
 const target={x:b.entity.x+u.x+.5,y:b.entity.y+u.y+.5};
 let dest=target;
 if(adjacent&&!city.walkable(Math.floor(dest.x),Math.floor(dest.y))){const points=[[1,0],[-1,0],[0,1],[0,-1]].map(([x,y])=>({x:target.x+x,y:target.y+y})).filter(p=>city.walkable(Math.floor(p.x),Math.floor(p.y))).sort((a,b)=>Math.hypot(a.x-c.entity.x,a.y-c.entity.y)-Math.hypot(b.x-c.entity.x,b.y-c.entity.y));dest=points.find(p=>city.findPath(c.entity,p)!==null);if(!dest)return false;}
 c.workCell={buildingId:b.id,unitId:u.id??null,x:u.x,y:u.y,z:u.z||0,target:{...dest}};
 if(Math.hypot(c.entity.x-dest.x,c.entity.y-dest.y)<=.15&&!c.path.length)return true;
 if(!c.path.length){const path=city.findPath(c.entity,dest);if(path!==null){c.path=path;if(!path.length||Math.hypot(path.at(-1).x-dest.x,path.at(-1).y-dest.y)>.001)c.path.push({...dest});}}
 c.action='Deslocando-se até a célula de atividade';return false;
}
export function syncCitizenInterior(city,c){
 // An outdoor citizen with no indoor activity has nothing to release or route.
 // Avoid resolving buildings and construction projects on every movement tick.
 if(!c.indoorLocation&&(c.entity.destroyed||c.mobilityTrip||c.ridingVehicleId||c.path.length||c.deliveryId||!INDOOR_TASKS.has(c.workMeal?'workmeal':c.task)))return true;
 normalizeInterior(city,c);
 const task=c.workMeal?'workmeal':c.task,fieldWork=['work','manage'].includes(task)&&(c.mechanicJob||c.forestryJob||c.paintWorkId),targetId=c.workMeal?.siteId??c.targetId,project=task==='construction'?city.development.projects.find(p=>p.id===c.workProjectId):null,b=city.building(project?.service==='expansion'?project.buildingId:targetId),previous=c.indoorLocation;
 if(c.paintWorkId&&previous&&!c.path.length){const job=city.paint.jobs.find(j=>j.id===c.paintWorkId);if(job?.kind==='building'&&job.buildingId===previous.buildingId&&job.status==='painting'&&!previous.exiting)return !previous.path.length;}
 if(c.entity.destroyed){release(city,c);c.indoorLocation=null;return true;}
 if(c.mobilityTrip||c.ridingVehicleId){return exit(city,c);}
 if(task==='construction'&&project?.service!=='expansion')return exit(city,c);
 if(c.path.length||c.deliveryId||!INDOOR_TASKS.has(task)||fieldWork||!b||(['work','manage'].includes(task)&&OUTDOOR_WORK.has(b.type))||(b.constructionKind==='open-air'&&!['toilet','hygiene','food','workmeal','clean'].includes(task)))return exit(city,c);
 if(previous?.exiting)return false;
 let kind=task==='shopping'&&b.type==='laundromat'?'laundry':['toilet','hygiene','clean'].includes(task)?'bathroom':['food','workmeal','provisions'].includes(task)?'dining':task==='council-session'?(city.politics.council.getChamber().open()?'plenary':'office'):['energy','care','caregiving'].includes(task)?'bedroom':task==='health'?'treatment':!['work','manage'].includes(task)?'service':['work','manage'].includes(task)&&c.role==='councilor'?'office':'workspace';
 if(previous&&!previous.exiting&&previous.buildingId===b.id&&previous.task===task&&previous.targetRoomType===kind&&previous.toiletTargetId===c.toiletTargetId&&previous.layoutRevision===(b.layoutRevision||0)&&city.units.has(previous.targetUnitId))return !previous.path.length;
 if(task==='provisions'&&!b.units.some(u=>u.roomType==='dining'))kind='bedroom';
 let room;
 if(kind==='office'&&c.councilSession){const member=city.politics.council.members.find(m=>m.citizenId===c.id),office=city.units.get(member?.officeUnitId);if(office?.buildingId===b.id)room=office;}
 if(task==='hygiene')room=city.units.get(city.sanitation.facilities.get(c.hygieneTargetId)?.unitId);
 if(task==='toilet')room=city.units.get(city.sanitation.facilities.get(c.toiletTargetId)?.unitId);
 if(task==='clean'){const job=city.sanitation.jobs?.find(j=>j.id===c.cleaningJobId);room=city.units.get(city.sanitation.facilities.get(job?.facilityId)?.unitId);}
 if(!room&&['energy','care','provisions','hygiene'].includes(task)){const home=city.housing.home(c);if(home?.buildingId===b.id)room=city.housing.units(home).find(u=>u.roomType===kind);if(!room&&kind==='bedroom')room=city.units.get(c.homeUnitId);}
 if(!room&&previous?.buildingId===b.id&&previous.targetRoomType===kind){const assigned=city.units.get(previous.targetUnitId);if(assigned&&activityCellAvailable(city,assigned,c,kind))room=assigned;}
 if(!room){const choices=b.units.filter(u=>u.roomType===kind);if(!choices.length&&['service','treatment'].includes(kind))choices.push(...b.units.filter(u=>u.roomType==='workspace'||u.roomType==='office'));if(!choices.length&&kind==='bedroom'&&!c.homeUnitId)choices.push(...b.units.filter(u=>u.roomType==='workspace'));if(!choices.length&&kind==='workspace')choices.push(...b.units.filter(u=>u.roomType==='office'));room=choices.find(u=>activityCellAvailable(city,u,c,kind));}
 if(!room){c.action=`Aguardando célula de ${kind} disponível`;return false;}
 return activityRoomReady(city,c,b,room,kind);
}

export function workCellReady(city,c,b){
 const assigned=city.units.get(c.workCell?.unitId),valid=u=>u?.buildingId===b.id&&['workspace','office','plenary'].includes(u.roomType);
 let room=valid(assigned)?assigned:b.units.find(u=>valid(u)&&activityCellAvailable(city,u,c,u.roomType));
 if(b.constructionKind!=='open-air'&&room&&c.indoorLocation?.unitId===room.id&&!c.indoorLocation.path?.length){
  c.nextWorkRotationAt??=city.minute+30+c.id%31;
  if(city.minute>=c.nextWorkRotationAt){const alternatives=b.units.filter(u=>valid(u)&&u.id!==room.id&&activityCellAvailable(city,u,c,u.roomType));if(alternatives.length)room=alternatives[(c.id+Math.floor(city.minute/60))%alternatives.length];c.nextWorkRotationAt=city.minute+45+c.id%30;}
 }
 if(!room){c.action='Aguardando célula de trabalho livre';return false;}
 if(b.constructionKind==='open-air')return outdoorCellReady(city,c,b,room);
 return activityRoomReady(city,c,b,room,room.roomType);
}

// A finished shell must not strand its construction crew on newly blocked
// outdoor tiles. Keep the real indoor position and route everyone to the door.
export function finishBuildingOccupants(city,b){
 if(b.constructionKind==='open-air')return;
 for(const c of city.citizens){if(c.entity.destroyed||c.entity.x<b.entity.x||c.entity.x>=b.entity.x+b.width||c.entity.y<b.entity.y||c.entity.y>=b.entity.y+b.depth)continue;
  const goal=c.path.at(-1),position={x:c.entity.x,y:c.entity.y,z:Math.min(b.floors-1,c.workCell?.z||0)*CITY_FLOOR_HEIGHT};
  if(c.mobilityTrip||c.ridingVehicleId)city.vehicles.releaseTrip(c);
  c.entity.x=b.door.x;c.entity.y=b.door.y;c.path=goal?city.findPath(c.entity,goal)||[]:[];
  c.indoorLocation={buildingId:b.id,unitId:null,targetUnitId:null,roomType:'circulation',position,path:interiorRoute(b,position,{x:b.door.x,y:b.door.y,z:0}),floor:Math.floor(position.z/CITY_FLOOR_HEIGHT),exiting:true,task:c.task,layoutRevision:b.layoutRevision||0};c.workCell=null;
 }
 for(const v of city.vehicles.units.values())if(v.active&&!v.scrapped&&v.x>=b.entity.x&&v.x<b.entity.x+b.width&&v.y>=b.entity.y&&v.y<b.entity.y+b.depth){city.vehicles.freeParking(v);v.x=v.entity.x=b.door.x;v.y=v.entity.y=b.door.y;city.vehicles.parkNearby(v,b.door);}
}
