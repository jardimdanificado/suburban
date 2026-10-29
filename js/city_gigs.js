import {activityRoomReady} from './city_interiors.js?v=survival-capacity-1';

const ACTIVE=new Set(['open','working']);
const INTERRUPTIBLE=new Set(['leisure','walk','social','sit','outdoor_leisure']);
const cleanFee=(city,building,scope,payerId=null)=>{
 const feces=[...(building.feces?.values()||[])].reduce((n,p)=>n+(p.amount||0),0),base=city.currency.price(900+Math.min(30,feces)*100+(building.litter||0)*120),factor=scope==='frontage'?1:.8;
 return Math.ceil(base*factor*(payerId==='treasury'?1.5:1));
};
export class CityGigs{
 constructor(city){this.city=city;this.jobs=[];this.nextId=1;this.completed=0;}
 get(id){return this.jobs.find(j=>j.id===id);}
 quote(buildingId,scope='interior',payerAccountId=null){const b=this.city.building(buildingId);if(!b)return 0;const city=this.city;if(scope==='repair')return Math.ceil(city.currency.price(1400+Math.max(0,75-(b.condition||100))*45)*(payerAccountId==='treasury'?1.5:1));if(scope==='garden')return Math.ceil(city.currency.price(1800)*(payerAccountId==='treasury'?1.5:1));return cleanFee(city,b,scope,payerAccountId);}
 gardenPoint(b){const city=this.city,x=Math.floor(b.entity.x),y=Math.floor(b.entity.y),points=[];for(let px=x-1;px<=x+b.width;px++){points.push([px,y-1],[px,y+b.depth]);}for(let py=y;py<y+b.depth;py++)points.push([x-1,py],[x+b.width,py]);for(const [gx,gy]of points)if(city.walkable(gx,gy)&&city.nature.available(gx,gy,'berry',b.id))return {x:gx+.5,y:gy+.5,tileX:gx,tileY:gy};return null;}
 createRepairOrder(payerAccountId,buildingId,{fee=null}={}){const city=this.city,b=city.building(buildingId);if(!b||b.constructionKind==='open-air'||!b.units.length||!city.accounts.has(payerAccountId)||!(b.repairNeeded||b.condition<85)||this.jobs.some(j=>j.kind==='repair'&&j.buildingId===b.id&&ACTIVE.has(j.status)))return false;const amount=fee??this.quote(b.id,'repair',payerAccountId),unit=b.units.find(u=>['workspace','office','service'].includes(u.roomType))||b.units[0];return this.reserveOrder(payerAccountId,b,{kind:'repair',scope:'interior',fee:amount,unitId:unit.id,required:24});}
 createGardenOrder(payerAccountId,buildingId,{fee=null}={}){const city=this.city,b=city.building(buildingId),point=b&&this.gardenPoint(b);if(!b||!point||!city.accounts.has(payerAccountId)||this.jobs.some(j=>j.kind==='gardening'&&j.buildingId===b.id&&ACTIVE.has(j.status)))return false;const amount=fee??this.quote(b.id,'garden',payerAccountId);return this.reserveOrder(payerAccountId,b,{kind:'gardening',scope:'outdoor',fee:amount,point,required:18});}
 reserveOrder(payerAccountId,b,{kind,scope,fee,unitId=null,point=null,required=20}){const city=this.city;if(!Number.isSafeInteger(fee)||fee<1||(city.accounts.get(payerAccountId)?.balance||0)<fee)return false;const id=this.nextId++,accountId=`gig:${id}`,account={name:`Serviço autônomo ${id}`,balance:0};city.accounts.set(accountId,account);if(!city.transfer(payerAccountId,accountId,fee,`Reserva de bico de ${kind}`,{gigId:id,buildingId:b.id})){city.accounts.delete(accountId);return false;}const job={id,accountId,payerAccountId,buildingId:b.id,unitId,point,kind,scope,fee,status:'open',workerId:null,progress:0,required,createdAt:city.minute,completedAt:null};this.jobs.push(job);const label=kind==='repair'?'pequeno reparo':'jardinagem';city.history.record('service',`Bico de ${label} anunciado para ${b.entity.properties.name}.`,[payerAccountId,b.accountId],{kind:'gig-posted',gigId:id,buildingId:b.id,service:kind,amount:fee,createdAt:city.minute});city.log(`Bico de ${label} #${id} anunciado.`,'work',[],{kind:'gig-posted',gigId:id,buildingId:b.id,service:kind,accounts:[payerAccountId],amount:fee});return job;}
 createCleaningOrder(payerAccountId,buildingId,{scope='interior',fee=null}={}){
  const city=this.city,b=city.building(buildingId);
  if(!b||!['interior','frontage'].includes(scope)||!city.accounts.has(payerAccountId)||this.jobs.some(j=>j.buildingId===b.id&&j.scope===scope&&ACTIVE.has(j.status)))return false;
  const amount=fee??this.quote(b.id,scope,payerAccountId);if(!Number.isSafeInteger(amount)||amount<1||(city.accounts.get(payerAccountId)?.balance||0)<amount)return false;
  const id=this.nextId++,accountId=`gig:${id}`,account={name:`Serviço autônomo ${id}`,balance:0};city.accounts.set(accountId,account);
  if(!city.transfer(payerAccountId,accountId,amount,'Reserva de faxina informal',{gigId:id,buildingId:b.id,scope})){city.accounts.delete(accountId);return false;}
  let unit=null;if(scope==='interior')unit=b.units.find(u=>u.roomType!=='bathroom'&&u.roomType!=='circulation')||b.units[0];
  const job={id,accountId,payerAccountId,buildingId:b.id,unitId:unit?.id||null,scope,fee:amount,status:'open',workerId:null,progress:0,required:scope==='frontage'?18:24,createdAt:city.minute,completedAt:null};
  this.jobs.push(job);city.history.record('service',`Bico de faxina anunciado para ${scope==='frontage'?'a frente':'o interior'} de ${b.entity.properties.name}.`,[payerAccountId,b.accountId],{kind:'gig-posted',gigId:id,buildingId:b.id,scope,amount,createdAt:job.createdAt});city.log(`Serviço de faxina ${id} anunciado para ${scope==='frontage'?'a frente':'o interior'} de ${b.entity.properties.name}.`,'work',[],{kind:'gig-posted',gigId:id,buildingId:b.id,accounts:[payerAccountId],amount});return job;
 }
 candidates(job){
  const city=this.city,b=city.building(job.buildingId);if(!b)return [];
  const point=job.kind==='gardening'?job.point:job.scope==='frontage'?this.frontagePoint(b):b.door;
  const eligible=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)&&!c.role?.includes('councilor')&&!c.jobId&&!(c.businessIds?.length)&&(!c.task||INTERRUPTIBLE.has(c.task))&&!c.deliveryId&&!c.cleaningJobId&&!c.informalJobId&&!c.conversation&&!c.workMeal&&!c.mobilityTrip&&!c.ridingVehicleId&&!city.urgentNeed(c)&&c.needs.energy>25)
   .sort((a,z)=>Math.hypot(a.entity.x-point.x,a.entity.y-point.y)-Math.hypot(z.entity.x-point.x,z.entity.y-point.y)||a.id-z.id);
  job.availableCandidatePool=eligible.length;if(!eligible.length)return [];
  // A posted gig previously ran A* once for every resident just to find one
  // worker. Probe a small rotating batch; unreachable candidates do not starve
  // everyone farther down the list because the next dispatch advances the cursor.
  const count=Math.min(24,eligible.length),start=(job.candidateCursor||0)%eligible.length,reachable=[];
  for(let i=0;i<count;i++){const candidate=eligible[(start+i)%eligible.length];if(city.findPath(candidate.entity,point)!==null){reachable.push(candidate);break;}}
  job.candidateCursor=(start+count)%eligible.length;return reachable;
 }
 frontagePoint(b){
  const d=b.door,city=this.city,points=[[0,0],[1,0],[-1,0],[0,1],[0,-1]].map(([x,y])=>({x:Math.floor(d.x)+x+.5,y:Math.floor(d.y)+y+.5}));
  return points.find(p=>city.walkable(Math.floor(p.x),Math.floor(p.y))&&city.findPath(d,p)!==null)||{x:d.x,y:d.y};
 }
 release(job,c,{reopen=true}={}){
  if(c){if(c.informalJobId===job.id){c.task=null;c.targetId=null;c.action='';}this.city.furniture?.release(c);c.informalJobId=null;c.workCell=null;c.path=[];}
  job.workerId=null;if(reopen){job.status='open';job.progress=0;}
 }
 clean(job,b){
  if(job.scope==='interior'){
   const unit=this.city.units.get(job.unitId),key=unit?`${unit.x},${unit.y},${unit.z}`:null,pile=key&&b.feces?.get(key);
   if(pile){if(pile.amount>1)pile.amount--;else b.feces.delete(key);b.fecesRevision=(b.fecesRevision||0)+1;this.city.sanitation.fecesRevision++;this.city.sanitation.cleanedFeces++;}
   if((b.litter||0)>0)b.litter=Math.max(0,b.litter-1);
   if(pile){b.inventory.fezes=(b.inventory.fezes||0)+1;this.city.economy.produced.fezes++;}
   b.cleanliness=Math.min(100,(b.cleanliness??55)+35);
  }else{
   const d=b.door,near=[...this.city.sanitation.streetFeces].filter(([key])=>{const [x,y]=key.split(',').map(Number);return Math.hypot(x+.5-d.x,y+.5-d.y)<=3;}).sort((a,z)=>z[1].amount-a[1].amount);
   if(near.length){const [key,pile]=near[0];if(pile.amount>1)pile.amount--;else this.city.sanitation.streetFeces.delete(key);this.city.sanitation.fecesRevision++;this.city.sanitation.cleanedFeces++;}
   if(near.length){b.inventory.fezes=(b.inventory.fezes||0)+1;this.city.economy.produced.fezes++;}
   b.frontageCleanliness=Math.min(100,(b.frontageCleanliness??55)+35);
  }
 }
 postNeededWork(){
  const city=this.city;if(!city.citizens.some(c=>!c.entity.destroyed&&city.society.isAdult(c)&&!c.jobId&&!c.businessIds.length&&!city.politics.officeHolder(c)))return;
  let posted=0;
  for(const b of city.buildings){
   if(posted>=4)break;if(b.entity.destroyed||!b.active||b.constructionKind==='open-air')continue;
   const dirtyInterior=(b.feces?.size||0)>0||(b.litter||0)>0||Number.isFinite(b.cleanliness)&&b.cleanliness<50;
   const x=Math.floor(b.door.x),y=Math.floor(b.door.y);let dirtyFrontage=false;
   for(let dy=-3;dy<=3&&!dirtyFrontage;dy++)for(let dx=-3;dx<=3;dx++){const pile=city.sanitation.streetFeces.get(`${x+dx},${y+dy}`);if(pile?.amount&&!pile.jobId&&Math.hypot(dx,dy)<=3){dirtyFrontage=true;break;}}
   const tenant=b.units?.find(u=>u.tenantId&&city.accounts.has(u.tenantId))?.tenantId,owner=b.ownerId!=null?city.society.citizen(b.ownerId)?.accountId:b.municipal?'treasury':b.accountId;
   if(dirtyInterior&&this.createCleaningOrder(tenant||owner,b.id,{scope:'interior'})){posted++;continue;}
   if(dirtyFrontage&&this.createCleaningOrder(owner,b.id,{scope:'frontage'})){posted++;continue;}
   if((b.repairNeeded||b.condition<70)&&this.createRepairOrder(owner,b.id))posted++;
  }
 }
 updateMinute(){
  const city=this.city;
  if(city.minute%60===0&&city.hour>=7&&city.hour<20)this.postNeededWork();
  for(const job of this.jobs){if(!ACTIVE.has(job.status))continue;const b=city.building(job.buildingId);if(!b){this.cancel(job,'imóvel removido');continue;}
   let worker=city.society.citizen(job.workerId);
   if(worker&&(worker.entity.destroyed||city.urgentNeed(worker))){this.release(job,worker);worker=null;}
   if(!worker){if(city.hour<7||city.hour>=20||city.minute%3!==job.id%3)continue;const candidates=this.candidates(job);job.availableCandidates=job.availableCandidatePool??candidates.length;worker=candidates[0];if(!worker)continue;
    const goal=job.kind==='gardening'?job.point:job.scope==='frontage'?this.frontagePoint(b):b.door,path=city.findPath(worker.entity,goal);if(path===null)continue;
    job.workerId=worker.id;job.status='working';job.startedAt=city.minute;worker.informalJobId=job.id;city.furniture?.release(worker);worker.task=job.kind==='gardening'?'informal-gardening':job.scope==='interior'?'informal-service':'informal-frontage';worker.targetId=job.scope==='interior'?b.id:null;worker.path=path;worker.servicePaid=null;const label=job.kind==='repair'?'um reparo':job.kind==='gardening'?'um serviço de jardinagem':'uma faxina';city.history.record('service',`${worker.entity.properties.name} aceitou ${label} em ${b.entity.properties.name}.`,[job.payerAccountId,worker.accountId,b.accountId],{kind:'gig-accepted',gigId:job.id,buildingId:b.id,citizenIds:[worker.id],scope:job.scope,service:job.kind,amount:job.fee,minute:city.minute});city.log(`${worker.entity.properties.name} aceitou o bico #${job.id}.`,'work',[worker.id],{kind:'gig-accepted',gigId:job.id,buildingId:b.id,service:job.kind,amount:job.fee});
   }
   if(job.kind==='gardening'){
    if(Math.hypot(worker.entity.x-job.point.x,worker.entity.y-job.point.y)>.4||worker.path.length)continue;
   }else if(job.scope==='interior'){
    const room=city.units.get(job.unitId);if(!room){this.cancel(job,'cômodo removido');continue;}
    if(!activityRoomReady(city,worker,b,room,room.roomType))continue;
   }else{
    const goal=this.frontagePoint(b);if(Math.hypot(worker.entity.x-goal.x,worker.entity.y-goal.y)>.4||worker.path.length)continue;
   }
   job.progress++;worker.action=job.kind==='repair'?'Fazendo pequeno reparo':job.kind==='gardening'?'Plantando no jardim':job.scope==='frontage'?'Limpando a frente do imóvel':'Fazendo faxina informal';city.economy.practice(worker,job.kind==='repair'?'construction':job.kind==='gardening'?'agriculture':'cleaning');
   if(job.progress<job.required)continue;
   if(job.kind==='cleaning'||!job.kind)this.clean(job,b);else if(job.kind==='repair'){b.condition=Math.min(100,(b.condition||0)+35);b.repairNeeded=b.condition<70;}else if(job.kind==='gardening'){const planted=city.nature.spawn(job.point.tileX,job.point.tileY,'berry',{buildingId:b.id});if(!planted){this.cancel(job,'canteiro ocupado antes do plantio');continue;}}
   const paid=city.transfer(job.accountId,worker.accountId,city.accounts.get(job.accountId)?.balance||0,`Pagamento por bico de ${job.kind||'faxina'}`,{gigId:job.id,buildingId:b.id,scope:job.scope});
   job.status='completed';job.completedAt=city.minute;job.completedBy=worker.id;this.completed++;worker.informalJobId=null;worker.task=null;worker.targetId=null;worker.path=[];worker.workCell=null;
   const label=job.kind==='repair'?'pequeno reparo':job.kind==='gardening'?'jardinagem':'faxina';city.history.record('service',`${label} informal concluída em ${b.entity.properties.name}.`,[job.payerAccountId,worker.accountId,b.accountId],{kind:'gig-completed',gigId:job.id,buildingId:b.id,citizenIds:[worker.id],scope:job.scope,service:job.kind||'cleaning',amount:paid?job.fee:0,progress:job.progress});
   city.log(`${worker.entity.properties.name} concluiu um bico de ${label} em ${b.entity.properties.name}.`,'work',[worker.id],{kind:'gig-completed',gigId:job.id,buildingId:b.id,accounts:[job.payerAccountId,worker.accountId],amount:job.fee,service:job.kind||'cleaning'});
  }
  if(this.jobs.length>256){const done=this.jobs.filter(j=>!ACTIVE.has(j.status));if(done.length>128)for(const job of done.slice(0,done.length-128))this.jobs.splice(this.jobs.indexOf(job),1);}
 }
  cancel(job,reason='cancelado'){
  if(!ACTIVE.has(job.status))return;const worker=this.city.society.citizen(job.workerId);this.release(job,worker,{reopen:false});
  const amount=this.city.accounts.get(job.accountId)?.balance||0;if(amount)this.city.transfer(job.accountId,job.payerAccountId,amount,'Estorno de serviço informal',{gigId:job.id,buildingId:job.buildingId});
  job.status='cancelled';job.completedAt=this.city.minute;job.cancelReason=reason;const label=job.kind==='repair'?'reparo':job.kind==='gardening'?'jardinagem':'faxina';this.city.history.record('service',`Bico de ${label} #${job.id} cancelado: ${reason}.`,[job.payerAccountId,job.accountId],{kind:'gig-cancelled',gigId:job.id,buildingId:job.buildingId,scope:job.scope,service:job.kind||'cleaning',minute:this.city.minute});this.city.log(`Bico de ${label} #${job.id} cancelado: ${reason}.`,'work',worker?[worker.id]:[],{kind:'gig-cancelled',gigId:job.id,buildingId:job.buildingId});
 }
}
