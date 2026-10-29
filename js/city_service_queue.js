import {interiorRoute} from './city_interior_layout.js';
import {CITY_FLOOR_HEIGHT} from './city_building_geometry.js';
const queueKind=kind=>['workmeal','supplies'].includes(kind)?'food':kind;
// Service queues are shared by everyone waiting at the same entrance. Tickets
// retain arrival order; outdoor places are reserved across all service types.
const slotCaches=new WeakMap();
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
export function queueService(city,c,b,kind,resource,ready){
 const entrance=b.officeTenantOf?city.building(b.officeTenantOf)||b:b;entrance.serviceQueue??=[];
 entrance.serviceQueue=entrance.serviceQueue.filter(q=>{const p=city.society.citizen(q.citizenId),valid=p&&!p.entity.destroyed&&p.task===q.kind&&p.targetId===q.buildingId&&(q.kind!=='toilet'||p.toiletTargetId===q.resource);if(!valid&&p?.serviceQueue?.buildingId===q.buildingId){p.serviceQueue=null;p.facingTarget=null;}return valid;});
 const ticket=reserveService(city,c,b,kind,resource);
 const older=entrance.serviceQueue.some(q=>q.buildingId===b.id&&queueKind(q.kind)===queueKind(kind)&&q.resource===resource&&q.sequence<ticket.sequence);
 const inside=c.indoorLocation?.buildingId===b.id&&!c.indoorLocation.exiting;
 if(!older&&ready){
  if(!inside&&Math.hypot(c.entity.x-b.door.x,c.entity.y-b.door.y)>.9){const route=city.findPath(c.entity,b.door);if(route!==null)c.path=route;c.action='Indo ao atendimento';return false;}
  entrance.serviceQueue=entrance.serviceQueue.filter(q=>q!==ticket);c.serviceQueue=null;c.facingTarget=null;return true;
 }
 // A queue can outlast its service capacity; a critically urgent person must
 // eventually leave it instead of waiting forever at zero need.
 if(kind==='toilet'&&!inside&&c.needs.toilet<10&&city.minute-ticket.joinedAt>=90){entrance.serviceQueue=entrance.serviceQueue.filter(q=>q!==ticket);c.serviceQueue=null;c.facingTarget=null;city.sanitation.emergencyRelief(c);return false;}
 c.lastProgressAt=city.minute;c.action=kind==='toilet'?'Aguardando na fila do banheiro':'Aguardando na fila de alimentação';c.facingTarget={x:b.door.x,y:b.door.y};
 // Recompute ordinal positions after every departure: followers advance to
 // the head of the line instead of retaining a stale, empty slot.
 const queue=entrance.serviceQueue.filter(q=>q.buildingId===b.id&&queueKind(q.kind)===queueKind(kind)&&q.resource===resource).sort((a,z)=>a.sequence-z.sequence),ordinal=queue.indexOf(ticket),queuedIds=new Set(queue.map(q=>q.citizenId)),occupied=new Set();
 if(inside){
  const location=c.indoorLocation,shell=city.building(b.officeTenantOf)||b,floor=b.officeFloor??location.floor??0,halls=(shell.circulation||[]).filter(u=>u.z===floor),rooms=b.units.filter(u=>!['bathroom','dining'].includes(u.roomType)),cells=halls.length?halls:rooms;
  const reserved=city.units.get(location.targetUnitId||location.unitId);
  const release=()=>{if(reserved?.activityReservedIds)reserved.activityReservedIds=reserved.activityReservedIds.filter(id=>id!==c.id);location.unitId=null;location.targetUnitId=null;c.workCell=null;};
  // Keep indoor lines in circulation space. If the lobby is full, join the
  // outdoor queue rather than waiting on occupied dining seats.
  if(!cells.length||ordinal>=cells.length*4){const path=interiorRoute(b,location.position,{x:b.door.x,y:b.door.y,z:0});if(path!==null){release();location.path=path;location.exiting=true;location.phase='leaving';location.roomType='circulation';}return false;}
  const cell=cells[Math.floor(ordinal/4)],slot=`${cell.x},${cell.y},${cell.z}:${ordinal%4}`,offsets=[[-.25,-.25],[.25,-.25],[-.25,.25],[.25,.25]],offset=offsets[ordinal%4],target={x:b.entity.x+cell.x+.5+offset[0],y:b.entity.y+cell.y+.5+offset[1],z:cell.z*CITY_FLOOR_HEIGHT};
  if(location.queueSlot!==slot){const path=interiorRoute(b,location.position,target);if(path!==null){release();location.path=path;location.targetRoomType='waiting';location.roomType='circulation';location.phase='waiting';location.queueSlot=slot;}}
  return false;
 }
 for(const other of city.citizens)if(!queuedIds.has(other.id)&&!other.entity.destroyed&&!other.indoorLocation){occupied.add(`${Math.floor(other.entity.x)},${Math.floor(other.entity.y)}`);const goal=other.path?.at(-1);if(goal)occupied.add(`${Math.floor(goal.x)},${Math.floor(goal.y)}`);}
 const positions=slots(city,entrance),available=[];for(let i=0;i<positions.length&&available.length<=ordinal;i++){const p=positions[i];if(occupied.has(`${Math.floor(p.x)},${Math.floor(p.y)}`))continue;const path=city.findPath(c.entity,p);if(path!==null)available.push({p,path,index:i});}
 const target=available[ordinal];ticket.slot=target?.index??null;
 if(target&&Math.hypot(c.entity.x-target.p.x,c.entity.y-target.p.y)>.5)c.path=target.path;
 return false;
}
