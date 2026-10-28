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
export function queueService(city,c,b,kind,resource,ready){
 const entrance=b.officeTenantOf?city.building(b.officeTenantOf)||b:b;entrance.serviceQueue??=[];
 entrance.serviceQueue=entrance.serviceQueue.filter(q=>{const p=city.society.citizen(q.citizenId),valid=p&&!p.entity.destroyed&&p.task===q.kind&&p.targetId===q.buildingId&&(q.kind!=='toilet'||p.toiletTargetId===q.resource);if(!valid&&p?.serviceQueue?.buildingId===q.buildingId)p.serviceQueue=null;return valid;});
 let ticket=entrance.serviceQueue.find(q=>q.citizenId===c.id&&q.buildingId===b.id&&q.kind===kind&&q.resource===resource);
 if(!ticket){ticket={citizenId:c.id,buildingId:b.id,kind,resource,joinedAt:city.minute,sequence:entrance.nextServiceTicket=(entrance.nextServiceTicket||0)+1,slot:null};entrance.serviceQueue.push(ticket);c.serviceQueue={buildingId:b.id,kind,resource,sequence:ticket.sequence};}
 const older=entrance.serviceQueue.some(q=>q.buildingId===b.id&&q.kind===kind&&q.resource===resource&&q.sequence<ticket.sequence);
 const inside=c.indoorLocation?.buildingId===b.id&&!c.indoorLocation.exiting;
 if(!older&&ready){
  if(!inside&&Math.hypot(c.entity.x-b.door.x,c.entity.y-b.door.y)>.9){const route=city.findPath(c.entity,b.door);if(route!==null)c.path=route;c.action='Indo ao atendimento';return false;}
  entrance.serviceQueue=entrance.serviceQueue.filter(q=>q!==ticket);c.serviceQueue=null;return true;
 }
 c.lastProgressAt=city.minute;c.action=kind==='toilet'?'Aguardando na fila do banheiro':'Aguardando na fila de alimentação';
 if(inside)return false;
 if(ticket.slot==null){const used=new Set(entrance.serviceQueue.filter(q=>q!==ticket&&q.slot!=null).map(q=>q.slot)),occupied=new Set();for(const other of city.citizens)if(other!==c&&!other.entity.destroyed&&!other.indoorLocation){occupied.add(`${Math.floor(other.entity.x)},${Math.floor(other.entity.y)}`);const goal=other.path?.at(-1);if(goal)occupied.add(`${Math.floor(goal.x)},${Math.floor(goal.y)}`);}const positions=slots(city,entrance);for(let i=0;i<positions.length;i++){if(used.has(i))continue;const p=positions[i];if(occupied.has(`${Math.floor(p.x)},${Math.floor(p.y)}`))continue;const path=city.findPath(c.entity,p);if(path===null)continue;ticket.slot=i;c.path=path;break;}}
 else{const p=slots(city,entrance)[ticket.slot];if(p&&Math.hypot(c.entity.x-p.x,c.entity.y-p.y)>.5){const path=city.findPath(c.entity,p);if(path!==null)c.path=path;}}
 return false;
}
