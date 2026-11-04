import {interiorRoute} from './city_interior_layout.js?v=interiors-completion-7';
import {buildingInteriorEntrance,CITY_FLOOR_HEIGHT} from './city_building_geometry.js?v=visual-flow-4';
const queueKind=kind=>['workmeal','supplies'].includes(kind)?'food':kind;
// Service queues are shared by everyone waiting at the same entrance. Tickets
// retain arrival order; outdoor places are reserved across all service types.
const slotCaches=new WeakMap();
function pruneQueue(city,entrance){
 const queue=entrance.serviceQueue;let write=0;
 for(let read=0;read<queue.length;read++){const q=queue[read],person=city.society.citizen(q.citizenId),valid=person&&!person.entity.destroyed&&queueKind(person.task)===queueKind(q.kind)&&person.targetId===q.buildingId&&(q.kind!=='toilet'||person.toiletTargetId===q.resource);if(valid)queue[write++]=q;else if(person?.serviceQueue?.buildingId===q.buildingId){person.serviceQueue=null;person.facingTarget=null;}}
 queue.length=write;
}
function removeTicket(entrance,ticket){const queue=entrance.serviceQueue,index=queue.indexOf(ticket);if(index>=0)queue.splice(index,1);}
function slots(city,b){
 const key=`${city.world.revision||0}:${city.obstacleRevision||0}:${b.door.x}:${b.door.y}`,cached=slotCaches.get(b);if(cached?.key===key)return cached.points;
 const x=Math.floor(b.door.x),y=Math.floor(b.door.y),points=[];
 for(let r=1;r<=18;r++)for(let dx=-r;dx<=r;dx++){const dy=r-Math.abs(dx);for(const sign of dy?[-1,1]:[1]){const px=x+dx,py=y+dy*sign;if(!city.walkable(px,py))continue;points.push({x:px+.5,y:py+.5});}}
 const dx=b.door.x-(b.entity.x+b.width/2),dy=b.door.y-(b.entity.y+b.depth/2),axisX=Math.abs(dx)>Math.abs(dy),sign=Math.sign(axisX?dx:dy)||1;
 const rank=p=>{const px=Math.floor(p.x)-x,py=Math.floor(p.y)-y,forward=(axisX?px:py)*sign,side=Math.abs(axisX?py:px);return (forward<1?10000:0)+side*100+Math.abs(forward);};points.sort((a,z)=>rank(a)-rank(z));
 slotCaches.set(b,{key,points});return points;
}
export function reserveService(city,c,b,kind,resource){
 const entrance=b.officeTenantOf?city.building(b.officeTenantOf)||b:b;entrance.serviceQueue??=[];
 let ticket=entrance.serviceQueue.find(q=>q.citizenId===c.id&&q.buildingId===b.id&&q.kind===kind&&q.resource===resource);
 if(!ticket){ticket={citizenId:c.id,buildingId:b.id,kind,resource,joinedAt:city.minute,sequence:entrance.nextServiceTicket=(entrance.nextServiceTicket||0)+1,slot:null};entrance.serviceQueue.push(ticket);c.serviceQueue={buildingId:b.id,kind,resource,sequence:ticket.sequence};}
 return ticket;
}
export function queueService(city,c,b,kind,resource,ready,room=null,roomKind=null){
 const entrance=b.officeTenantOf?city.building(b.officeTenantOf)||b:b;entrance.serviceQueue??=[];
 pruneQueue(city,entrance);
 const ticket=reserveService(city,c,b,kind,resource);
 const older=entrance.serviceQueue.some(q=>q.buildingId===b.id&&queueKind(q.kind)===queueKind(kind)&&q.resource===resource&&!q.admittedUnitId&&q.sequence<ticket.sequence);
 let inside=c.indoorLocation?.buildingId===b.id&&!c.indoorLocation.exiting;
 // Available rooms, rather than a global one-person-per-minute gate, set
 // throughput. A multi-floor public building can serve several people at once.
 if((!older||ticket.admittedUnitId===room?.id&&!!room)&&ready){
  // Reserve the real room before walking from the queue to the interior entry tile.
  // Admitted people no longer block the next ticket when other rooms are free.
  const wasAdmitted=!!room&&ticket.admittedUnitId===room.id;
  if(room){ticket.admittedUnitId=room.id;c.serviceQueue={buildingId:b.id,kind,resource,sequence:ticket.sequence,unitId:room.id,roomKind};room.activityReservedIds??=[];if(!room.activityReservedIds.includes(c.id))room.activityReservedIds.push(c.id);}
  city.furniture?.release(c);
  const approach=entrance.door||b.door;
  if(!inside&&Math.hypot(c.entity.x-approach.x,c.entity.y-approach.y)>.75){if(!wasAdmitted||!c.path.length){const route=city.findPath(c.entity,approach);if(route!==null)c.path=route;}c.action='Indo ao atendimento';return false;}
  removeTicket(entrance,ticket);c.serviceQueue=null;c.facingTarget=null;return true;
 }
 // A queue can outlast its service capacity; a critically urgent person must
 // eventually leave it instead of waiting forever at zero need.
 if(kind==='toilet'&&c.needs.toilet<10&&city.minute-ticket.joinedAt>=90){removeTicket(entrance,ticket);c.serviceQueue=null;c.facingTarget=null;city.sanitation.emergencyRelief(c);return false;}
 // The outdoor route ends at the door. From there, use the interior graph
 // to reach a waiting place without trying to path through exterior walls.
 if(c.path.length)return false;
 if(!inside&&b.constructionKind!=='open-air'){
  const entry=buildingInteriorEntrance(entrance),approach=entrance.door||b.door;
  if(entry&&Math.hypot(c.entity.x-approach.x,c.entity.y-approach.y)>.75){const route=city.findPath(c.entity,approach);if(route!==null)c.path=route;c.action='Indo para a espera dentro do prédio';return false;}
  if(entry){c.indoorLocation={buildingId:b.id,targetUnitId:null,unitId:null,targetRoomType:'waiting',roomType:'circulation',floor:0,position:{x:c.entity.x,y:c.entity.y,z:0},path:[],phase:'waiting',task:kind,layoutRevision:b.layoutRevision||0,enteredAt:city.minute};inside=true;}
 }
 c.lastProgressAt=city.minute;c.action=kind==='toilet'?'Aguardando na fila do banheiro':['food','workmeal','supplies'].includes(kind)?'Aguardando na fila de alimentação':'Aguardando na fila de atendimento';c.facingTarget={x:b.door.x,y:b.door.y};
 // Recompute ordinal positions after every departure: followers advance to
 // the head of the line instead of retaining a stale, empty slot.
 const occupied=new Set();
 if(inside){
  const location=c.indoorLocation,shell=city.building(b.officeTenantOf)||b,floor=b.officeFloor??0,halls=(shell.circulation||[]).filter(u=>!b.officeTenantOf||u.z===floor),rooms=b.units.filter(u=>!['bathroom','dining'].includes(u.roomType)),cells=halls.length?halls:rooms;
  const reserved=city.units.get(location.targetUnitId||location.unitId);
  const release=()=>{if(reserved?.activityReservedIds)reserved.activityReservedIds=reserved.activityReservedIds.filter(id=>id!==c.id);location.unitId=null;location.targetUnitId=null;c.workCell=null;};
  // Share circulation across service types and floors. Crowded queues use
  // denser waiting spots instead of leaving their overflow at the doorway.
  if(!cells.length)return false;
  const waiting=entrance.serviceQueue.filter(q=>q.buildingId===b.id).sort((a,z)=>a.sequence-z.sequence),index=waiting.indexOf(ticket),perCell=Math.max(4,Math.ceil(waiting.length/cells.length)),side=Math.ceil(Math.sqrt(perCell)),within=index%perCell;
  const cell=cells[Math.floor(index/perCell)],slot=`${cell.x},${cell.y},${cell.z}:${within}/${side}`,target={x:shell.entity.x+cell.x+.2+.6*((within%side)+.5)/side,y:shell.entity.y+cell.y+.2+.6*(Math.floor(within/side)+.5)/side,z:cell.z*CITY_FLOOR_HEIGHT};
  if(location.queueSlot!==slot){const path=interiorRoute(shell,location.position,target);if(path!==null){release();location.path=path;location.targetRoomType='waiting';location.roomType='circulation';location.phase='waiting';location.queueSlot=slot;ticket.slot=`indoor:${slot}`;}}
  return false;
 }
 for(const other of city.citizens)if(other.id!==c.id&&!other.entity.destroyed&&!other.indoorLocation){occupied.add(`${Math.floor(other.entity.x)},${Math.floor(other.entity.y)}`);const goal=other.path?.at(-1);if(goal)occupied.add(`${Math.floor(goal.x)},${Math.floor(goal.y)}`);}
 if(city.furniture?.queueSeat(c,b)){ticket.slot=`bench:${c.seatId}`;return false;}
 const reserved=new Set(entrance.serviceQueue.filter(q=>q!==ticket&&Number.isInteger(q.slot)).map(q=>q.slot));
 const positions=slots(city,entrance);let target=null;
 for(let i=0;i<positions.length;i++){const p=positions[i];if(reserved.has(i)||occupied.has(`${Math.floor(p.x)},${Math.floor(p.y)}`))continue;const path=city.findPath(c.entity,p);if(path!==null){target={p,path,index:i};break;}}
 ticket.slot=target?.index??null;
 if(target&&Math.hypot(c.entity.x-target.p.x,c.entity.y-target.p.y)>.5)c.path=target.path;
 return false;
}
