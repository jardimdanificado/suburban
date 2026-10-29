import {roomFurniture} from './city_furniture_catalog.js';
import {CITY_FLOOR_HEIGHT} from './city_building_geometry.js';
import {queueService} from './city_service_queue.js?v=furniture-farms-fertilizer-1';
import {interiorRoute,interiorUsePoint} from './city_interior_layout.js';
// Outdoor coordinates remain the navigation anchor at the entrance. Interior
// position, circulation and floor changes are separate physical coordinates.
const INDOOR_TASKS=new Set(['work','manage','work-wait','shopping','supplies','job-interview','food','water','health','energy','hygiene','toilet','care','caregiving','provisions','workmeal','council-session','construction','vote','clean','informal-service','leisure','social','outdoor_leisure']);
const OUTDOOR_WORK=new Set(['farm','quarry','forestry']);
const citizenKeys=[];
const citizen=(city,id)=>city.accounts.get(Number.isInteger(id)&&id>=0&&id<65536?(citizenKeys[id]??=`citizen:${id}`):`citizen:${id}`)||city.society.citizen(id);
const indoorCitizenCaches=new WeakMap();
const roomsByBuilding=new WeakMap(),noRooms=Object.freeze([]);
function roomGroups(b){let cache=roomsByBuilding.get(b);if(!cache||cache.revision!==(b.layoutRevision||0)||cache.units!==b.units||cache.length!==b.units.length){const rooms=new Map();for(const u of b.units){let group=rooms.get(u.roomType);if(!group)rooms.set(u.roomType,group=[]);group.push(u);}cache={revision:b.layoutRevision||0,units:b.units,length:b.units.length,rooms};roomsByBuilding.set(b,cache);}return cache.rooms;}
function indoorCitizenCache(city){let cache=indoorCitizenCaches.get(city);if(!cache||cache.revision!==city.structureRevision||cache.accounts!==city.accounts){cache={revision:city.structureRevision,accounts:city.accounts,people:[]};indoorCitizenCaches.set(city,cache);}return cache.people;}
const point=(b,u)=>({x:b.entity.x+u.x+.5,y:b.entity.y+u.y+.5,z:u.z*CITY_FLOOR_HEIGHT});
function release(city,c){const id=c.indoorLocation?.targetUnitId||c.indoorLocation?.unitId,u=city.units.get(id);if(u?.activityReservedIds)u.activityReservedIds=u.activityReservedIds.filter(id=>id!==c.id);if(c.workCell?.unitId===id)c.workCell=null;}
export function activityCellAvailable(city,u,c,kind){
 if(!u.activityReservedIds?.length){u.activityReservedIds??=[];return true;}
 const visitor=kind==='service'||kind==='treatment',workers=kind==='workspace'||kind==='office',ids=u.activityReservedIds,people=indoorCitizenCache(city);let reserved=null,occupants=0,alreadyReserved=false;
 for(let i=0;i<ids.length;i++){const id=ids[i],cacheable=Number.isInteger(id)&&id>=0&&id<65536;let other=cacheable?people[id]:undefined;if(!other){other=citizen(city,id);if(other&&cacheable)people[id]=other;}const location=other?.indoorLocation;if(!other||other.entity.destroyed||location?.exiting||(location?.targetUnitId!==u.id&&location?.unitId!==u.id)){reserved??=ids.slice(0,i);continue;}if(reserved)reserved.push(id);if(id===c.id)alreadyReserved=true;const type=location?.targetRoomType;if(visitor?type!=='workspace'&&type!=='office'&&type!=='dining':workers?type!=='service'&&type!=='treatment':true)occupants++;}
 if(reserved)u.activityReservedIds=reserved;
 const capacity=visitor?4:kind==='bathroom'||kind==='office'?1:kind==='dining'||kind==='plenary'?4:kind==='bedroom'?4:1;
 return alreadyReserved||occupants<capacity;
}
function leaveEntrance(city,c,occupied=null){
 if(c.task||c.path.length||c.conversation||c.deliveryId||c.mobilityTrip)return;
 const x=Math.floor(c.entity.x),y=Math.floor(c.entity.y),taken=occupied||new Set();if(!occupied)for(const other of city.citizens)if(other!==c&&!other.entity.destroyed&&!other.indoorLocation){taken.add(`${Math.floor(other.entity.x)},${Math.floor(other.entity.y)}`);const goal=other.path?.at(-1);if(goal)taken.add(`${Math.floor(goal.x)},${Math.floor(goal.y)}`);}
 for(let radius=2;radius<=9;radius++){const offsets=[];for(let dx=-radius;dx<=radius;dx++){const dy=radius-Math.abs(dx);offsets.push([dx,dy]);if(dy)offsets.push([dx,-dy]);}const first=(c.id*13+city.minute)%offsets.length;for(let i=0;i<offsets.length;i++){const [dx,dy]=offsets[(first+i)%offsets.length],px=x+dx,py=y+dy,destination={x:px+.5,y:py+.5};if(taken.has(`${px},${py}`)||!city.walkable(px,py))continue;const path=city.findPath(c.entity,destination);if(path?.length){c.path=path;c.task='walk';c.targetId=null;c.action='Saindo da entrada do prédio';taken.add(`${px},${py}`);return;}}}
}
export function disperseCrowds(city){
 const groups=new Map();for(const c of city.citizens)if(!c.entity.destroyed&&!c.indoorLocation&&!c.path.length){const key=`${Math.floor(c.entity.x)},${Math.floor(c.entity.y)}`,people=groups.get(key)||[];people.push(c);groups.set(key,people);}
 let budget=32,taken=null;for(const people of groups.values())if(people.length>2)for(const c of people){if(!budget) return;if(c.task||c.conversation||c.deliveryId||c.mobilityTrip||city.urgentNeed(c))continue;if(!taken){taken=new Set();for(const other of city.citizens)if(!other.entity.destroyed&&!other.indoorLocation){taken.add(`${Math.floor(other.entity.x)},${Math.floor(other.entity.y)}`);const goal=other.path?.at(-1);if(goal)taken.add(`${Math.floor(goal.x)},${Math.floor(goal.y)}`);}}leaveEntrance(city,c,taken);if(c.path.length)budget--;}
}

function exit(city,c){
 const s=c.indoorLocation;if(!s)return true;
 const b=city.building(s.buildingId);if(!b||b.entity.destroyed){release(city,c);c.indoorLocation=null;return true;}
 if(b.constructionKind==='open-air'){release(city,c);c.indoorLocation=null;return true;}
 if(!s.exiting){release(city,c);s.exiting=true;s.phase='leaving';s.roomType='circulation';c.action='Saindo do prédio';s.unitId=null;s.targetUnitId=null;s.path=interiorRoute(b,s.position||{x:b.door.x,y:b.door.y,z:0},{x:b.door.x,y:b.door.y,z:0});}
 if(!s.path.length){c.indoorLocation=null;leaveEntrance(city,c);return true;}return false;
}
function normalizeInterior(city,c){
 const old=c.indoorLocation;if(old&&!old.path){const building=city.building(old.buildingId),unit=city.units.get(old.unitId);old.path=[];old.targetUnitId=old.unitId;old.targetRoomType=old.roomType;old.position=building&&unit?point(building,unit):{x:c.entity.x,y:c.entity.y,z:0};}
 if(old&&!old.phase)old.phase=old.exiting?'leaving':old.path?.length?'walking':'using';
}

export function advanceCitizenInterior(city,c,minutes=1){
 const s=c.indoorLocation;if(!s?.path?.length)return;
 s.phase=s.exiting?'leaving':'walking';
 let distance=Math.max(0,minutes);
 while(distance>0&&s.path.length){const target=s.path[0],p=s.position,dx=target.x-p.x,dy=target.y-p.y,dz=target.z-p.z,len=Math.hypot(dx,dy,dz),d=Math.min(distance,len);if(len>0){p.x+=dx/len*d;p.y+=dy/len*d;p.z+=dz/len*d;}distance-=d;if(len<=d+.00001)s.path.shift();}
 s.floor=Math.max(0,Math.floor(s.position.z/CITY_FLOOR_HEIGHT+.001));
 if(!s.path.length){if(s.exiting){c.indoorLocation=null;leaveEntrance(city,c);}else{s.unitId=s.targetUnitId;s.roomType=s.targetRoomType;s.arrivedAt=city.minute;s.phase='using';}}
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
  release(city,c);c.indoorLocation={buildingId:b.id,targetUnitId:room.id,unitId:room.id,targetRoomType:kind,roomType:kind,floor:room.z,position:target,path:[],phase:'using',task:c.workMeal?'workmeal':c.task,layoutRevision:b.layoutRevision||0,enteredAt:city.minute,arrivedAt:city.minute,toiletTargetId:c.toiletTargetId};
 }else{
  if(c.path.length)return false;
  if(!previous&&Math.hypot(c.entity.x-b.door.x,c.entity.y-b.door.y)>1.5){const path=city.findPath(c.entity,b.door);if(path!==null)c.path=path;return false;}
  const from=previous?.buildingId===b.id?previous.position:{x:b.door.x,y:b.door.y,z:0};release(city,c);
  const slot=(room.activityReservedIds||[]).filter(id=>id!==c.id).length,target=interiorUsePoint(b,room,kind,slot,c.task),path=interiorRoute(b,from,target);
  if(path===null){c.action=`Sem rota interna acessível até ${kind}`;return false;}
  c.indoorLocation={buildingId:b.id,targetUnitId:room.id,unitId:path.length?null:room.id,targetRoomType:kind,roomType:path.length?'circulation':kind,floor:Math.floor(from.z/CITY_FLOOR_HEIGHT),position:{...from},path,phase:path.length?'walking':'using',task:c.workMeal?'workmeal':c.task,layoutRevision:b.layoutRevision||0,enteredAt:previous?.buildingId===b.id?previous.enteredAt:city.minute,toiletTargetId:c.toiletTargetId};
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
 const task=c.workMeal?'workmeal':c.task,fieldWork=['work','manage'].includes(task)&&(c.mechanicJob||c.forestryJob||c.paintWorkId),targetId=c.workMeal?.siteId??c.targetId,project=task==='construction'?city.development.projects.find(p=>p.id===c.workProjectId):null,b=city.building(project?.service==='expansion'?project.buildingId:targetId),previous=c.indoorLocation,gig=task==='informal-service'?city.gigs?.get(c.informalJobId):null;
 if(task==='work-wait'&&c.seatId)return exit(city,c);
 if(task==='informal-service'&&!gig)return exit(city,c);
 if(task==='workmeal'&&!city.workMeals.hasFullDiningFloor(b)){c.task=null;c.targetId=null;c.mealTargetId=null;c.mealResume=null;c.path=[];return exit(city,c);}
 if(c.paintWorkId&&previous&&!c.path.length){const job=city.paint.jobs.find(j=>j.id===c.paintWorkId);if(job?.kind==='building'&&job.buildingId===previous.buildingId&&job.status==='painting'&&!previous.exiting)return !previous.path.length;}
 if(c.entity.destroyed){release(city,c);c.indoorLocation=null;return true;}
 if(task==='outdoor_leisure'&&!c.path.length){
  const visit=c.outdoorLeisure,site=city.building(visit?.buildingId),room=city.units.get(visit?.unitId),work=visit?.access==='work'&&(c.jobId===visit.jobId||c.businessIds.includes(visit.jobId))&&!!city.building(visit.jobId);if(!site||!room||!work&&city.housing.home(c)?.buildingId!==site.id){c.task=null;c.outdoorLeisure=null;return exit(city,c);}
  if(previous?.buildingId===site.id&&previous.targetRoomType===visit.kind)return !previous.path.length;
  if(visit.kind==='roof_terrace'){
   if(previous?.buildingId!==site.id&&previous&&!exit(city,c))return false;
   if(!previous&&Math.hypot(c.entity.x-site.door.x,c.entity.y-site.door.y)>1.5)return false;
   release(city,c);const from=previous?.buildingId===site.id?previous.position:{x:site.door.x,y:site.door.y,z:0},path=interiorRoute(site,from,visit.position);
   if(path===null){c.action='Sem rota interna acessível até a cobertura';return false;}
   c.indoorLocation={buildingId:site.id,targetUnitId:null,unitId:null,targetRoomType:visit.kind,roomType:path.length?'circulation':visit.kind,floor:visit.floor??site.floors-1,position:{...from},path,phase:path.length?'walking':'using',task,layoutRevision:site.layoutRevision||0,enteredAt:city.minute};return !path.length;
  }
  if(!activityRoomReady(city,c,site,room,'workspace'))return false;
  const location=c.indoorLocation;location.targetRoomType=visit.kind;location.roomType='circulation';location.path=interiorRoute(site,location.position,visit.position);location.unitId=null;
  if(location.path===null){c.action='Sem rota interna acessível até o local de lazer';return false;}location.phase=location.path.length?'walking':'using';
  if(!location.path.length){location.unitId=location.targetUnitId;location.roomType=visit.kind;}return !location.path.length;
 }
 if(c.mobilityTrip||c.ridingVehicleId){return exit(city,c);}
 if(task==='construction'&&project?.service!=='expansion')return exit(city,c);
 if(c.path.length||c.deliveryId||!INDOOR_TASKS.has(task)||fieldWork||!b||(['work','manage'].includes(task)&&OUTDOOR_WORK.has(b.type))||(b.constructionKind==='open-air'&&!['toilet','hygiene','food','workmeal','clean','job-interview','supplies'].includes(task)))return exit(city,c);
 if(previous?.exiting)return false;
 if(task==='food'&&c.servicePaid!==`${b.id}:food`&&!city.economy.mealOffer(b,c)){
  c.task=null;c.targetId=null;c.path=[];c.serviceQueue=null;c.facingTarget=null;c.action='Alimento indisponível neste local; procurando outra opção';return exit(city,c);
 }
 const cleaningJob=task==='clean'?city.sanitation.jobs?.find(j=>j.id===c.cleaningJobId):null;
 let kind=task==='informal-service'?(city.units.get(gig.unitId)?.roomType||'workspace'):task==='shopping'&&b.type==='laundromat'?'laundry':task==='clean'&&cleaningJob?.kind==='feces'&&cleaningJob.scope==='building'?(city.units.get(cleaningJob.unitId)?.roomType||'workspace'):['toilet','hygiene','clean'].includes(task)?'bathroom':['food','workmeal','provisions'].includes(task)?'dining':task==='council-session'?(city.politics.council.getChamber().open()?'plenary':'office'):['energy','care','caregiving'].includes(task)?'bedroom':task==='health'?'treatment':!['work','manage','work-wait'].includes(task)?'service':['work','manage'].includes(task)&&c.role==='councilor'?'office':'workspace';
 // Shops serve food purchases at their real sales counter; only a refectory
 // or a building with dining rooms requires a dining seat. Otherwise a market
 // can hold hungry customers forever waiting for a room it will never have.
 if(task==='food'&&b.type!=='popular_refectory'&&!(roomGroups(b).get('dining')||noRooms).length)kind='service';
 if(previous&&!previous.exiting&&previous.buildingId===b.id&&previous.task===task&&previous.targetRoomType===kind&&previous.toiletTargetId===c.toiletTargetId&&previous.layoutRevision===(b.layoutRevision||0)&&city.units.has(previous.targetUnitId))return !previous.path.length;
 if(task==='provisions')return exit(city,c);
 let room;
 if(task==='informal-service')room=city.units.get(gig.unitId);
 if(kind==='office'&&c.councilSession){const member=city.politics.council.members.find(m=>m.citizenId===c.id),office=city.units.get(member?.officeUnitId);if(office?.buildingId===b.id)room=office;}
 if(task==='water')room=b.units.find(u=>roomFurniture(b,u).some(f=>f.type==='water_cooler')&&activityCellAvailable(city,u,c,'service'));
 if(task==='hygiene')room=city.units.get(city.sanitation.facilities.get(c.hygieneTargetId)?.unitId);
 if(task==='toilet')room=city.units.get(city.sanitation.facilities.get(c.toiletTargetId)?.unitId);
 if(task==='clean'){const job=city.sanitation.jobs?.find(j=>j.id===c.cleaningJobId);room=city.units.get(job?.unitId||city.sanitation.facilities.get(job?.facilityId)?.unitId);}
 if(!room&&['energy','care','provisions','hygiene'].includes(task)){const home=city.housing.home(c);if(home?.buildingId===b.id)room=city.housing.units(home).find(u=>u.roomType===kind);if(!room&&kind==='bedroom')room=city.units.get(c.homeUnitId);}
 if(!room&&previous?.buildingId===b.id&&previous.targetRoomType===kind){const assigned=city.units.get(previous.targetUnitId);if(assigned&&activityCellAvailable(city,assigned,c,kind))room=assigned;}
 if(!room){const groups=roomGroups(b),choices=groups.get(kind)||noRooms;room=choices.find(u=>activityCellAvailable(city,u,c,kind));
  if(!choices.length){if(kind==='service'||kind==='treatment'){for(const u of b.units)if((u.roomType==='workspace'||u.roomType==='office'||b.type==='popular_refectory'&&u.roomType==='dining')&&activityCellAvailable(city,u,c,kind)){room=u;break;}}
   else if(kind==='bedroom'&&!c.homeUnitId)room=(groups.get('workspace')||noRooms).find(u=>activityCellAvailable(city,u,c,kind));
   else if(kind==='workspace')room=(groups.get(b.type==='popular_refectory'?'dining':'office')||noRooms).find(u=>activityCellAvailable(city,u,c,kind));}}

 if(b.constructionKind!=='open-air'&&(task==='toilet'||task==='food'||task==='workmeal'||task==='supplies')&&!(previous?.buildingId===b.id&&previous.targetUnitId===room?.id&&previous.targetRoomType===kind)){
  const facility=task==='toilet'?city.sanitation.facilities.get(c.toiletTargetId):null,ready=!!room&&activityCellAvailable(city,room,c,kind)&&(!facility||!facility.occupantId||facility.occupantId===c.id||city.minute>=facility.busyUntil);
  if(!queueService(city,c,b,task,task==='toilet'?c.toiletTargetId:'dining',ready))return false;
 }
 if(!room){
  // A full public shelter must not leave a homeless person waiting forever
  // while exhaustion keeps rising. They can still sleep outdoors, at a cost.
  if(task==='energy'&&!c.homeUnitId){c.sleepWaitingSince??=city.minute;if(city.minute-c.sleepWaitingSince>=30){c.sleepWaitingSince=null;c.targetId=null;c.path=[];c.action='Sem vaga para dormir; buscando descanso na rua';return exit(city,c);}}
  if(b.constructionKind!=='open-air'&&!previous&&Math.hypot(c.entity.x-b.door.x,c.entity.y-b.door.y)<=1.5){const from={x:b.door.x,y:b.door.y,z:0},lobby={x:b.entity.x+Math.floor(b.width/2)+.5,y:b.entity.y+Math.floor(b.depth/2)+.5,z:0},path=interiorRoute(b,from,lobby);if(path!==null)c.indoorLocation={buildingId:b.id,targetUnitId:null,unitId:null,targetRoomType:'waiting',roomType:'circulation',floor:0,position:from,path,phase:path.length?'walking':'waiting',task,layoutRevision:b.layoutRevision||0,enteredAt:city.minute};}
  c.action=task==='job-interview'?'Aguardando a seleção no local combinado':`Aguardando célula de ${kind} disponível`;return false;
 }
 if(task==='energy')c.sleepWaitingSince=null;
 return activityRoomReady(city,c,b,room,kind);
}

export function workCellReady(city,c,b){
 const assigned=city.units.get(c.workCell?.unitId),valid=u=>u?.buildingId===b.id&&(['workspace','office','plenary'].includes(u.roomType)||b.type==='popular_refectory'&&u.roomType==='dining'),kind=u=>u.roomType==='dining'?'workspace':u.roomType;
 let room=valid(assigned)?assigned:b.units.find(u=>valid(u)&&activityCellAvailable(city,u,c,kind(u)));
 if(b.constructionKind!=='open-air'&&room&&c.indoorLocation?.unitId===room.id&&!c.indoorLocation.path?.length){
  if(c.nextWorkBuildingId!==b.id){c.nextWorkBuildingId=b.id;c.nextWorkRotationAt=city.minute+30+c.id%31;}
  else c.nextWorkRotationAt??=city.minute+30+c.id%31;
  if(city.minute>=c.nextWorkRotationAt){const alternatives=b.units.filter(u=>valid(u)&&u.id!==room.id&&activityCellAvailable(city,u,c,kind(u)));if(alternatives.length)room=alternatives[(c.id+Math.floor(city.minute/60))%alternatives.length];c.nextWorkRotationAt=city.minute+45+c.id%30;}
 }
 if(!room){c.action='Aguardando célula de trabalho livre';return false;}
 if(b.constructionKind==='open-air')return outdoorCellReady(city,c,b,room);
 return activityRoomReady(city,c,b,room,kind(room));
}

// A finished shell must not strand its construction crew on newly blocked
// outdoor tiles. Keep the real indoor position and route everyone to the door.
export function finishBuildingOccupants(city,b){
 if(b.constructionKind==='open-air')return;
 for(const c of city.citizens){if(c.entity.destroyed||c.entity.x<b.entity.x||c.entity.x>=b.entity.x+b.width||c.entity.y<b.entity.y||c.entity.y>=b.entity.y+b.depth)continue;
  const goal=c.path.at(-1),position={x:c.entity.x,y:c.entity.y,z:Math.min(b.floors-1,c.workCell?.z||0)*CITY_FLOOR_HEIGHT};
  if(c.mobilityTrip||c.ridingVehicleId)city.vehicles.releaseTrip(c);
  c.entity.x=b.door.x;c.entity.y=b.door.y;c.path=goal?city.findPath(c.entity,goal)||[]:[];
  c.indoorLocation={buildingId:b.id,unitId:null,targetUnitId:null,roomType:'circulation',position,path:interiorRoute(b,position,{x:b.door.x,y:b.door.y,z:0})||[],floor:Math.floor(position.z/CITY_FLOOR_HEIGHT),exiting:true,phase:'leaving',task:c.task,layoutRevision:b.layoutRevision||0};c.workCell=null;
 }
 for(const v of city.vehicles.units.values())if(v.active&&!v.scrapped&&v.x>=b.entity.x&&v.x<b.entity.x+b.width&&v.y>=b.entity.y&&v.y<b.entity.y+b.depth){city.vehicles.freeParking(v);v.x=v.entity.x=b.door.x;v.y=v.entity.y=b.door.y;city.vehicles.parkNearby(v,b.door);}
}
