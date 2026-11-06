import {interiorRoute} from './city_interior_layout.js?v=route-cache-512-index-1';
import {invalidateActivitySearch} from './city_activity_search.js';
import {buildingInteriorEntrance,CITY_FLOOR_HEIGHT} from './city_building_geometry.js?v=visual-flow-4';
const foodQueueKinds=new Set(['workmeal','supplies']);
const queueKind=kind=>foodQueueKinds.has(kind)?'food':kind;
const taskQueueKind=task=>task==='workmeal'||task==='supplies'?'food':task;
const queueAuditInterval=60;
// Service queues are shared by everyone waiting at the same entrance. Tickets
// retain arrival order; outdoor places are reserved across all service types.
const slotCaches=new WeakMap();
const indoorWaitingCells=new WeakMap();
function waitingCells(b,shell){
 let cache=indoorWaitingCells.get(b);
 if(!cache||cache.shell!==shell||cache.layout!==(b.layoutRevision||0)||cache.shellLayout!==(shell.layoutRevision||0)||cache.units!==b.units||cache.halls!==shell.circulation||cache.floor!==b.officeFloor){
  const floor=b.officeFloor??0,halls=(shell.circulation||[]).filter(u=>!b.officeTenantOf||u.z===floor);
  cache={shell,layout:b.layoutRevision||0,shellLayout:shell.layoutRevision||0,units:b.units,halls:shell.circulation,floor:b.officeFloor,cells:halls.length?halls:b.units.filter(u=>!['bathroom','dining'].includes(u.roomType))};indoorWaitingCells.set(b,cache);
 }
 return cache.cells;
}
// Track only tickets invalidated by a citizen field change; a periodic audit
// handles restored queues and unusual out-of-band mutations.
const queueStates=new WeakMap(),ticketInfo=new WeakMap(),ticketsByPerson=new WeakMap(),watchedProperties=new WeakMap();
function ticketIsValid(person,ticket){return !!person&&!person.entity.destroyed&&taskQueueKind(person.task)===(ticket.queueKind||queueKind(ticket.kind))&&person.targetId===ticket.buildingId&&(ticket.kind!=='toilet'||person.toiletTargetId===ticket.resource);}
function stopWatching(object){const watched=watchedProperties.get(object);if(!watched)return;for(const [key,entry]of watched){const descriptor=entry.descriptor;if('value'in descriptor)Object.defineProperty(object,key,{...descriptor,value:entry.read()});else Object.defineProperty(object,key,descriptor);}watchedProperties.delete(object);}
function serviceGroup(state,buildingId,kind,resource,create=false){let byKind=state.groups.get(buildingId);if(!byKind&&create)state.groups.set(buildingId,byKind=new Map());let byResource=byKind?.get(queueKind(kind));if(!byResource&&create)byKind.set(queueKind(kind),byResource=new Map());let group=byResource?.get(resource);if(!group&&create)byResource.set(resource,group=new Set());return group;}
function queueChanged(entrance){const state=queueStates.get(entrance);if(state)state.revision++;}
function waitingTickets(entrance,buildingId){const state=queueStates.get(entrance);let cached=state.waitingByBuilding.get(buildingId);if(!cached||cached.revision!==state.revision){const tickets=entrance.serviceQueue.filter(ticket=>ticket.buildingId===buildingId).sort((a,b)=>a.sequence-b.sequence),indexes=new Map();for(let i=0;i<tickets.length;i++)indexes.set(tickets[i],i);cached={revision:state.revision,tickets,indexes};state.waitingByBuilding.set(buildingId,cached);}return cached;}
function detachGroup(state,ticket,info){const group=info.group;if(!group)return;group.delete(ticket);info.group=null;if(group.size)return;const byKind=state.groups.get(info.buildingId),byResource=byKind?.get(info.kind);byResource?.delete(info.resource);if(!byResource?.size)byKind?.delete(info.kind);if(!byKind?.size)state.groups.delete(info.buildingId);}
function untrackTicket(ticket){const info=ticketInfo.get(ticket);if(!info)return;ticketInfo.delete(ticket);const state=queueStates.get(info.entrance);state?.dirty.delete(ticket);state?.tickets.delete(ticket);if(state)detachGroup(state,ticket,info);const tickets=ticketsByPerson.get(info.person);tickets?.delete(ticket);if(tickets&&!tickets.size){ticketsByPerson.delete(info.person);stopWatching(info.person);if(info.person.entity)stopWatching(info.person.entity);}}
function flagPersonTickets(person){for(const ticket of ticketsByPerson.get(person)||[]){if(ticketIsValid(person,ticket))continue;const info=ticketInfo.get(ticket),state=info&&queueStates.get(info.entrance);state?.dirty.add(ticket);if(state)invalidateActivitySearch(state.city,info.buildingId);}}
function watchProperty(object,key,person){let watched=watchedProperties.get(object);if(!watched)watchedProperties.set(object,watched=new Map());if(watched.has(key))return;const descriptor=Object.getOwnPropertyDescriptor(object,key);if(!descriptor||!descriptor.configurable||descriptor.get&&!descriptor.set)return;let value=descriptor.value;const getter=descriptor.get,setter=descriptor.set,read=()=>getter?getter.call(object):value;Object.defineProperty(object,key,{configurable:true,enumerable:descriptor.enumerable,get(){return getter?getter.call(this):value;},set(next){const before=getter?getter.call(this):value;if(setter)setter.call(this,next);else value=next;const after=getter?getter.call(this):value;if(!Object.is(before,after))flagPersonTickets(person);}});watched.set(key,{descriptor,read});}
function trackTicket(city,entrance,ticket){let person=ticket.person;if(!person)person=city.society.citizen(ticket.citizenId);if(!person)return null;if(!ticket.person)Object.defineProperty(ticket,'person',{value:person});if(!ticket.queueKind)Object.defineProperty(ticket,'queueKind',{value:queueKind(ticket.kind)});let tickets=ticketsByPerson.get(person);if(!tickets)ticketsByPerson.set(person,tickets=new Set());tickets.add(ticket);const state=queueStates.get(entrance);state?.tickets.add(ticket);let info=ticketInfo.get(ticket);if(info?.entrance===entrance)return person;info={entrance,person,buildingId:ticket.buildingId,kind:queueKind(ticket.kind),resource:ticket.resource,group:null};ticketInfo.set(ticket,info);if(state&&!ticket.admittedUnitId){info.group=serviceGroup(state,info.buildingId,info.kind,info.resource,true);info.group.add(ticket);}for(const key of ['task','targetId','toiletTargetId'])watchProperty(person,key,person);if(person.entity)watchProperty(person.entity,'destroyed',person);return person;}
function queueState(city,entrance){const queue=entrance.serviceQueue||[];let state=queueStates.get(entrance);if(state?.queue===queue)return state;if(state)for(const ticket of state.tickets)untrackTicket(ticket);state={city,queue,tickets:new Set(),dirty:new Set(),groups:new Map(),waitingByBuilding:new Map(),revision:0,initialized:false,lastAudit:city.minute};queueStates.set(entrance,state);return state;}
function pruneQueue(city,entrance){
 const queue=entrance.serviceQueue,state=queueState(city,entrance),audit=!state.initialized||city.minute-state.lastAudit>=queueAuditInterval;if(!audit&&!state.dirty.size)return;
 let write=0;
 for(let read=0;read<queue.length;read++){const q=queue[read],person=trackTicket(city,entrance,q),mustCheck=audit||state.dirty.has(q);if(!mustCheck){if(write!==read)queue[write]=q;write++;continue;}state.dirty.delete(q);if(ticketIsValid(person,q)){if(write!==read)queue[write]=q;write++;}else{if(person?.serviceQueue?.buildingId===q.buildingId){person.serviceQueue=null;person.facingTarget=null;}untrackTicket(q);}}
 const changed=write!==queue.length;queue.length=write;if(changed)state.revision++;state.initialized=true;if(audit)state.lastAudit=city.minute;state.dirty.clear();
}
function removeTicket(entrance,ticket){const queue=entrance.serviceQueue,index=queue.indexOf(ticket);if(index>=0){queue.splice(index,1);queueChanged(entrance);}untrackTicket(ticket);}
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
 const state=queueStates.get(entrance);let ticket;for(const candidate of ticketsByPerson.get(c)||[]){const info=ticketInfo.get(candidate);if(info?.entrance===entrance&&candidate.buildingId===b.id&&candidate.kind===kind&&candidate.resource===resource){ticket=candidate;break;}}
 if(!ticket&&!state?.initialized)ticket=entrance.serviceQueue.find(q=>q.citizenId===c.id&&q.buildingId===b.id&&q.kind===kind&&q.resource===resource);
 if(!ticket){ticket={citizenId:c.id,buildingId:b.id,kind,resource,joinedAt:city.minute,sequence:entrance.nextServiceTicket=(entrance.nextServiceTicket||0)+1,slot:null};Object.defineProperties(ticket,{person:{value:c},queueKind:{value:queueKind(kind)}});entrance.serviceQueue.push(ticket);if(state?.queue===entrance.serviceQueue){state.initialized=true;trackTicket(city,entrance,ticket);queueChanged(entrance);}c.serviceQueue={buildingId:b.id,kind,resource,sequence:ticket.sequence};}
 return ticket;
}
export function queueService(city,c,b,kind,resource,ready,room=null,roomKind=null){
 const entrance=b.officeTenantOf?city.building(b.officeTenantOf)||b:b;entrance.serviceQueue??=[];
 pruneQueue(city,entrance);
 const ticket=reserveService(city,c,b,kind,resource);
 const activeGroup=serviceGroup(queueStates.get(entrance),b.id,kind,resource),oldest=activeGroup?.values().next().value;
 const older=!!oldest&&oldest.sequence<ticket.sequence;
 let inside=c.indoorLocation?.buildingId===b.id&&!c.indoorLocation.exiting;
 // Available rooms, rather than a global one-person-per-minute gate, set
 // throughput. A multi-floor public building can serve several people at once.
 if((!older||ticket.admittedUnitId===room?.id&&!!room)&&ready){
  // Reserve the real room before walking from the queue to the interior entry tile.
  // Admitted people no longer block the next ticket when other rooms are free.
  const wasAdmitted=!!room&&ticket.admittedUnitId===room.id;
  if(room){ticket.admittedUnitId=room.id;const info=ticketInfo.get(ticket),state=queueStates.get(entrance);if(info&&state)detachGroup(state,ticket,info);c.serviceQueue={buildingId:b.id,kind,resource,sequence:ticket.sequence,unitId:room.id,roomKind};room.activityReservedIds??=[];if(!room.activityReservedIds.includes(c.id)){room.activityReservedIds.push(c.id);invalidateActivitySearch(city,b.id);}}
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
 c.lastProgressAt=city.minute;c.action=kind==='toilet'?'Aguardando na fila do banheiro':['food','workmeal','supplies'].includes(kind)?'Aguardando na fila de alimentação':'Aguardando na fila de atendimento';
 if(!c.facingTarget||c.facingTarget.x!==b.door.x||c.facingTarget.y!==b.door.y||Object.keys(c.facingTarget).length!==2)c.facingTarget={x:b.door.x,y:b.door.y};
 // Recompute ordinal positions after every departure: followers advance to
 // the head of the line instead of retaining a stale, empty slot.
 if(inside){
  const location=c.indoorLocation,shell=city.building(b.officeTenantOf)||b,cells=waitingCells(b,shell);
  // Share circulation across service types and floors. Crowded queues use
  // denser waiting spots instead of leaving their overflow at the doorway.
  if(!cells.length)return false;
  const waiting=waitingTickets(entrance,b.id),index=waiting.indexes.get(ticket)??0,perCell=Math.max(4,Math.ceil(waiting.tickets.length/cells.length)),side=Math.ceil(Math.sqrt(perCell)),within=index%perCell;
  const cell=cells[Math.floor(index/perCell)],slot=`${cell.x},${cell.y},${cell.z}:${within}/${side}`;
  if(location.queueSlot!==slot){
   const target={x:shell.entity.x+cell.x+.2+.6*((within%side)+.5)/side,y:shell.entity.y+cell.y+.2+.6*(Math.floor(within/side)+.5)/side,z:cell.z*CITY_FLOOR_HEIGHT},path=interiorRoute(shell,location.position,target);
   if(path!==null){const reserved=city.units.get(location.targetUnitId||location.unitId);if(reserved?.activityReservedIds?.includes(c.id)){reserved.activityReservedIds=reserved.activityReservedIds.filter(id=>id!==c.id);invalidateActivitySearch(city,reserved.buildingId);}location.unitId=null;location.targetUnitId=null;c.workCell=null;location.path=path;location.targetRoomType='waiting';location.roomType='circulation';location.phase='waiting';location.queueSlot=slot;ticket.slot=`indoor:${slot}`;}
  }
  return false;
 }
 const occupied=new Set();
 for(const other of city.citizens)if(other.id!==c.id&&!other.entity.destroyed&&!other.indoorLocation){occupied.add(`${Math.floor(other.entity.x)},${Math.floor(other.entity.y)}`);const goal=other.path?.at(-1);if(goal)occupied.add(`${Math.floor(goal.x)},${Math.floor(goal.y)}`);}
 if(city.furniture?.queueSeat(c,b)){ticket.slot=`bench:${c.seatId}`;return false;}
 const reserved=new Set(entrance.serviceQueue.filter(q=>q!==ticket&&Number.isInteger(q.slot)).map(q=>q.slot));
 const positions=slots(city,entrance);let target=null;
 for(let i=0;i<positions.length;i++){const p=positions[i];if(reserved.has(i)||occupied.has(`${Math.floor(p.x)},${Math.floor(p.y)}`))continue;const path=city.findPath(c.entity,p);if(path!==null){target={p,path,index:i};break;}}
 ticket.slot=target?.index??null;
 if(target&&Math.hypot(c.entity.x-target.p.x,c.entity.y-target.p.y)>.5)c.path=target.path;
 return false;
}
