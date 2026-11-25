import {interiorRoute} from './city_interior_layout.js?v=route-cache-512-index-1';
import {invalidateActivitySearch} from './city_activity_search.js';
import {buildingInteriorEntrance,CITY_FLOOR_HEIGHT} from './city_building_geometry.js?v=banner-placement-2';
const foodQueueKinds=new Set(['workmeal','supplies']);
const queueKind=kind=>foodQueueKinds.has(kind)?'food':kind;
const taskQueueKind=task=>task==='workmeal'||task==='supplies'?'food':task;
const queueAuditInterval=60;
// Virtual ticket (ficha) queue system: citizens take a numbered ticket and
// remain free to work or do nearby activities proportional to their wait time,
// rather than standing in a physical line at the door.
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
function ticketIsValid(person,ticket){return !!person&&!person.entity.destroyed&&!person.dead&&ticket.status!=='cancelled';}
function ticketStillNeedsService(person,ticket){
 if(!person||person.entity.destroyed||person.dead)return false;
 const n=person.needs||{};
 switch(ticket.kind){
  case 'toilet': return (n.toilet??100)<85;
  case 'hygiene': return (n.hygiene??100)<85;
  case 'food':
  case 'workmeal': return (n.food??100)<85;
  case 'water': return (n.water??100)<85;
  case 'supplies': return (n.water??100)<85||(n.food??100)<85||(person.provisions||0)<2||(person.pocket?.water||0)<2;
  case 'health': return (n.health??100)<90||(person.combatInjuries?.length||0)>0;
  default: return true;
 }
}
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
function removeTicket(entrance,ticket){
 const queue=entrance.serviceQueue,index=queue.indexOf(ticket);
 if(index>=0){queue.splice(index,1);queueChanged(entrance);}
 if(ticket.person?.serviceTicket?.sequence===ticket.sequence&&ticket.person?.serviceTicket?.buildingId===ticket.buildingId)ticket.person.serviceTicket=null;
 untrackTicket(ticket);
}
export function ticketRoamBudget(city,c){
 const st=c?.serviceTicket;if(!st)return null;
 const entrance=city.building(st.entranceId)||city.building(st.buildingId);
 const b=city.building(st.buildingId);
 if(!entrance||!b||entrance.entity?.destroyed||b.entity?.destroyed){c.serviceTicket=null;return null;}
 const queue=entrance.serviceQueue||[];
 const ticket=queue.find(q=>q.citizenId===c.id&&q.buildingId===st.buildingId&&q.sequence===st.sequence);
 if(!ticket||ticket.status==='cancelled'){c.serviceTicket=null;return null;}
 const qk=queueKind(ticket.kind);
 let ahead=0;
 for(const q of queue){
  if(q===ticket||q.status==='cancelled')continue;
  if(q.buildingId===ticket.buildingId&&(q.queueKind||queueKind(q.kind))===qk&&q.sequence<ticket.sequence)ahead++;
 }
 const estWaitMinutes=ahead*4;
 const maxRadius=ahead===0?2.5:Math.max(3,Math.min(30,(estWaitMinutes-2)*2.4));
 const door=entrance.door||b.door;
 const distToDoor=door?Math.hypot(c.entity.x-door.x,c.entity.y-door.y):0;
 return {entrance,building:b,ticket,ahead,estWaitMinutes,maxRadius,distToDoor,door};
}
export function tickServiceTickets(city){
 for(const entrance of city.buildings||[]){
  const queue=entrance.serviceQueue;if(!queue?.length)continue;
  pruneQueue(city,entrance);
  const state=queueStates.get(entrance);
  const byKind=state?.groups;if(!byKind)continue;
  for(const [buildingId,kindMap]of byKind){
   const b=city.building(buildingId);if(!b||b.entity?.destroyed)continue;
   for(const [qk,resMap]of kindMap){
    for(const [,group]of resMap){
     while(group.size){
      const oldest=group.values().next().value;
      const person=oldest.person||city.society.citizen(oldest.citizenId);
      if(!ticketIsValid(person,oldest)){removeTicket(entrance,oldest);continue;}
      // Lazy cancellation check ONLY when the ticket is actually called!
      if(!ticketStillNeedsService(person,oldest)){
       oldest.status='cancelled';
       removeTicket(entrance,oldest);
       continue;
      }
      if(oldest.status!=='called'){
       oldest.status='called';
       if(person.serviceTicket)person.serviceTicket.status='called';
       if(person.task!==oldest.kind||person.targetId!==oldest.buildingId){
        person.task=oldest.kind;person.targetId=oldest.buildingId;
        if(oldest.kind==='toilet')person.toiletTargetId=oldest.resource;
        const door=entrance.door||b.door;
        if(door&&!person.indoorLocation&&Math.hypot(person.entity.x-door.x,person.entity.y-door.y)>1.2){
         const route=city.findPath(person.entity,door);
         if(route!==null)person.path=route;
        }
        person.action='Ficha chamada! Indo ao atendimento';
       }
      }
      break;
     }
    }
   }
  }
 }
}
export function reserveService(city,c,b,kind,resource){
 const entrance=b.officeTenantOf?city.building(b.officeTenantOf)||b:b;entrance.serviceQueue??=[];
 const state=queueStates.get(entrance);let ticket;for(const candidate of ticketsByPerson.get(c)||[]){const info=ticketInfo.get(candidate);if(info?.entrance===entrance&&candidate.buildingId===b.id&&candidate.kind===kind&&candidate.resource===resource){ticket=candidate;break;}}
 if(!ticket&&!state?.initialized)ticket=entrance.serviceQueue.find(q=>q.citizenId===c.id&&q.buildingId===b.id&&q.kind===kind&&q.resource===resource);
 if(!ticket){ticket={citizenId:c.id,buildingId:b.id,kind,resource,joinedAt:city.minute,sequence:entrance.nextServiceTicket=(entrance.nextServiceTicket||0)+1,slot:`ficha:${entrance.nextServiceTicket}`,status:'waiting'};Object.defineProperties(ticket,{person:{value:c},queueKind:{value:queueKind(kind)}});entrance.serviceQueue.push(ticket);if(state?.queue===entrance.serviceQueue){state.initialized=true;trackTicket(city,entrance,ticket);queueChanged(entrance);}c.serviceQueue={buildingId:b.id,kind,resource,sequence:ticket.sequence};c.serviceTicket={buildingId:b.id,entranceId:entrance.id,kind,resource,sequence:ticket.sequence,joinedAt:city.minute,status:'waiting'};}
 return ticket;
}
export function queueService(city,c,b,kind,resource,ready,room=null,roomKind=null){
 const entrance=b.officeTenantOf?city.building(b.officeTenantOf)||b:b;entrance.serviceQueue??=[];
 pruneQueue(city,entrance);
 const ticket=reserveService(city,c,b,kind,resource);
 const activeGroup=serviceGroup(queueStates.get(entrance),b.id,kind,resource);
 // Lazy cancellation check ONLY when a ticket is called at the front of the queue!
 let oldest=activeGroup?.values().next().value;
 while(oldest&&oldest!==ticket){
  const op=oldest.person||city.society.citizen(oldest.citizenId);
  if(!ticketIsValid(op,oldest)||!ticketStillNeedsService(op,oldest)){
   oldest.status='cancelled';
   removeTicket(entrance,oldest);
   oldest=activeGroup?.values().next().value;
  }else break;
 }
 const older=!!oldest&&oldest.sequence<ticket.sequence;
 let inside=c.indoorLocation?.buildingId===b.id&&!c.indoorLocation.exiting;
 // Available rooms, rather than a global one-person-per-minute gate, set
 // throughput. A multi-floor public building can serve several people at once.
 if((!older||ticket.admittedUnitId===room?.id&&!!room)&&ready){
  if(!ticketStillNeedsService(c,ticket)){
   ticket.status='cancelled';
   removeTicket(entrance,ticket);c.serviceQueue=null;c.facingTarget=null;
   return false;
  }
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
 if(c.path.length)return false;
 if(inside){
  const location=c.indoorLocation,shell=city.building(b.officeTenantOf)||b,cells=waitingCells(b,shell);
  if(!cells.length)return false;
  const waiting=waitingTickets(entrance,b.id),index=waiting.indexes.get(ticket)??0,perCell=Math.max(4,Math.ceil(waiting.tickets.length/cells.length)),side=Math.ceil(Math.sqrt(perCell)),within=index%perCell;
  const cell=cells[Math.floor(index/perCell)],slot=`${cell.x},${cell.y},${cell.z}:${within}/${side}`;
  if(location.queueSlot!==slot){
   const target={x:shell.entity.x+cell.x+.2+.6*((within%side)+.5)/side,y:shell.entity.y+cell.y+.2+.6*(Math.floor(within/side)+.5)/side,z:cell.z*CITY_FLOOR_HEIGHT},path=interiorRoute(shell,location.position,target);
   if(path!==null){const reserved=city.units.get(location.targetUnitId||location.unitId);if(reserved?.activityReservedIds?.includes(c.id)){reserved.activityReservedIds=reserved.activityReservedIds.filter(id=>id!==c.id);invalidateActivitySearch(city,reserved.buildingId);}location.unitId=null;location.targetUnitId=null;c.workCell=null;location.path=path;location.targetRoomType='waiting';location.roomType='circulation';location.phase='waiting';location.queueSlot=slot;ticket.slot=`indoor:${slot}`;}
  }
  return false;
 }
 // Virtual ficha: count how many active tickets are ahead of this citizen.
 const budget=ticketRoamBudget(city,c),ahead=budget?.ahead??0;
 if(ahead>=1&&kind!=='work'&&kind!=='manage'){
  // Far enough in line: free the citizen to work or do proportional nearby activities!
  c.task=null;c.targetId=null;c.toiletTargetId=null;c.serviceQueue=null;c.facingTarget=null;
  c.action=`Com ficha na mão (${ahead} na frente)`;
  return false;
 }
 // Next in line (ahead === 0): wait nearby (bench if available) without forming a physical line.
 c.lastProgressAt=city.minute;
 c.action=kind==='toilet'?'Aguardando chamada da ficha (banheiro)':['food','workmeal','supplies'].includes(kind)?'Aguardando chamada da ficha (alimentação)':'Aguardando chamada da ficha';
 if(city.furniture?.queueSeat(c,b)){ticket.slot=`bench:${c.seatId}`;return false;}
 return false;
}
