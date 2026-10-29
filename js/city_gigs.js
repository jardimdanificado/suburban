import {activityRoomReady} from './city_interiors.js?v=refectory-survival-1';

const ACTIVE=new Set(['open','working']);
const cleanFee=(city,building,scope,payerId=null)=>{
 const feces=[...(building.feces?.values()||[])].reduce((n,p)=>n+(p.amount||0),0),base=city.currency.price(900+Math.min(30,feces)*100+(building.litter||0)*120),factor=scope==='frontage'?1:.8;
 return Math.ceil(base*factor*(payerId==='treasury'?1.5:1));
};
export class CityGigs{
 constructor(city){this.city=city;this.jobs=[];this.nextId=1;this.completed=0;}
 get(id){return this.jobs.find(j=>j.id===id);}
 quote(buildingId,scope='interior',payerAccountId=null){const b=this.city.building(buildingId);return b?cleanFee(this.city,b,scope,payerAccountId):0;}
 createCleaningOrder(payerAccountId,buildingId,{scope='interior',fee=null}={}){
  const city=this.city,b=city.building(buildingId);
  if(!b||!['interior','frontage'].includes(scope)||!city.accounts.has(payerAccountId)||this.jobs.some(j=>j.buildingId===b.id&&j.scope===scope&&ACTIVE.has(j.status)))return false;
  const amount=fee??this.quote(b.id,scope,payerAccountId);if(!Number.isSafeInteger(amount)||amount<1||(city.accounts.get(payerAccountId)?.balance||0)<amount)return false;
  const id=this.nextId++,accountId=`gig:${id}`,account={name:`Serviço autônomo ${id}`,balance:0};city.accounts.set(accountId,account);
  if(!city.transfer(payerAccountId,accountId,amount,'Reserva de faxina informal',{gigId:id,buildingId:b.id,scope})){city.accounts.delete(accountId);return false;}
  let unit=null;if(scope==='interior')unit=b.units.find(u=>u.roomType!=='bathroom'&&u.roomType!=='circulation')||b.units[0];
  const job={id,accountId,payerAccountId,buildingId:b.id,unitId:unit?.id||null,scope,fee:amount,status:'open',workerId:null,progress:0,required:scope==='frontage'?18:24,createdAt:city.minute,completedAt:null};
  this.jobs.push(job);city.log(`Serviço de faxina ${id} anunciado para ${scope==='frontage'?'a frente':'o interior'} de ${b.entity.properties.name}.`,'work',[],{kind:'gig-posted',gigId:id,buildingId:b.id,accounts:[payerAccountId],amount});return job;
 }
 candidates(job){
  const city=this.city,b=city.building(job.buildingId);if(!b)return [];
  const point=job.scope==='frontage'?this.frontagePoint(b):b.door;
  return city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)&&!c.role?.includes('councilor')&&!c.jobId&&!c.businessIds.length&&!c.task&&!c.path.length&&!c.deliveryId&&!c.cleaningJobId&&!c.informalJobId&&!c.conversation&&!c.workMeal&&!c.mobilityTrip&&!c.ridingVehicleId&&!city.urgentNeed(c)&&c.needs.energy>25&&city.findPath(c.entity,point)!==null)
   .sort((a,z)=>Math.hypot(a.entity.x-point.x,a.entity.y-point.y)-Math.hypot(z.entity.x-point.x,z.entity.y-point.y)||a.id-z.id);
 }
 frontagePoint(b){
  const d=b.door,city=this.city,points=[[0,0],[1,0],[-1,0],[0,1],[0,-1]].map(([x,y])=>({x:Math.floor(d.x)+x+.5,y:Math.floor(d.y)+y+.5}));
  return points.find(p=>city.walkable(Math.floor(p.x),Math.floor(p.y))&&city.findPath(d,p)!==null)||{x:d.x,y:d.y};
 }
 release(job,c,{reopen=true}={}){
  if(c){if(c.informalJobId===job.id){c.task=null;c.targetId=null;c.action='';}c.informalJobId=null;c.workCell=null;c.path=[];}
  job.workerId=null;if(reopen){job.status='open';job.progress=0;}
 }
 clean(job,b){
  if(job.scope==='interior'){
   const unit=this.city.units.get(job.unitId),key=unit?`${unit.x},${unit.y},${unit.z}`:null,pile=key&&b.feces?.get(key);
   if(pile){if(pile.amount>1)pile.amount--;else b.feces.delete(key);b.fecesRevision=(b.fecesRevision||0)+1;this.city.sanitation.fecesRevision++;this.city.sanitation.cleanedFeces++;}
   if((b.litter||0)>0)b.litter=Math.max(0,b.litter-1);
   b.cleanliness=Math.min(100,(b.cleanliness??55)+35);
  }else{
   const d=b.door,near=[...this.city.sanitation.streetFeces].filter(([key])=>{const [x,y]=key.split(',').map(Number);return Math.hypot(x+.5-d.x,y+.5-d.y)<=3;}).sort((a,z)=>z[1].amount-a[1].amount);
   if(near.length){const [key,pile]=near[0];if(pile.amount>1)pile.amount--;else this.city.sanitation.streetFeces.delete(key);this.city.sanitation.fecesRevision++;this.city.sanitation.cleanedFeces++;}
   b.frontageCleanliness=Math.min(100,(b.frontageCleanliness??55)+35);
  }
 }
 updateMinute(){
  const city=this.city;
  for(const job of this.jobs){if(!ACTIVE.has(job.status))continue;const b=city.building(job.buildingId);if(!b){this.cancel(job,'imóvel removido');continue;}
   let worker=city.society.citizen(job.workerId);
   if(worker&&(worker.entity.destroyed||city.urgentNeed(worker))){this.release(job,worker);worker=null;}
   if(!worker){if(city.hour<7||city.hour>=20||city.minute%3!==job.id%3)continue;worker=this.candidates(job)[0];if(!worker)continue;
    const goal=job.scope==='frontage'?this.frontagePoint(b):b.door,path=city.findPath(worker.entity,goal);if(path===null)continue;
    job.workerId=worker.id;job.status='working';job.startedAt=city.minute;worker.informalJobId=job.id;worker.task=job.scope==='interior'?'informal-service':'informal-frontage';worker.targetId=job.scope==='interior'?b.id:null;worker.path=path;worker.servicePaid=null;
   }
   if(job.scope==='interior'){
    const room=city.units.get(job.unitId);if(!room){this.cancel(job,'cômodo removido');continue;}
    if(!activityRoomReady(city,worker,b,room,room.roomType))continue;
   }else{
    const goal=this.frontagePoint(b);if(Math.hypot(worker.entity.x-goal.x,worker.entity.y-goal.y)>.4||worker.path.length)continue;
   }
   job.progress++;worker.action=job.scope==='frontage'?'Limpando a frente do imóvel':'Fazendo faxina informal';city.economy.practice(worker,'cleaning');
   if(job.progress<job.required)continue;
   this.clean(job,b);const paid=city.transfer(job.accountId,worker.accountId,city.accounts.get(job.accountId)?.balance||0,'Pagamento por faxina informal',{gigId:job.id,buildingId:b.id,scope:job.scope});
   job.status='completed';job.completedAt=city.minute;this.completed++;worker.informalJobId=null;worker.task=null;worker.targetId=null;worker.path=[];worker.workCell=null;
   city.history.record('service',`Faxina informal concluída em ${b.entity.properties.name}.`,[job.payerAccountId,worker.accountId,b.accountId],{kind:'gig-completed',gigId:job.id,buildingId:b.id,citizenIds:[worker.id],scope:job.scope,amount:paid?job.fee:0,progress:job.progress});
   city.log(`${worker.entity.properties.name} concluiu uma faxina paga em ${b.entity.properties.name}.`,'work',[worker.id],{kind:'gig-completed',gigId:job.id,buildingId:b.id,accounts:[job.payerAccountId,worker.accountId],amount:job.fee});
  }
  if(this.jobs.length>256){const done=this.jobs.filter(j=>!ACTIVE.has(j.status));if(done.length>128)for(const job of done.slice(0,done.length-128))this.jobs.splice(this.jobs.indexOf(job),1);}
 }
 cancel(job,reason='cancelado'){
  if(!ACTIVE.has(job.status))return;const worker=this.city.society.citizen(job.workerId);this.release(job,worker,{reopen:false});
  const amount=this.city.accounts.get(job.accountId)?.balance||0;if(amount)this.city.transfer(job.accountId,job.payerAccountId,amount,'Estorno de serviço informal',{gigId:job.id,buildingId:job.buildingId});
  job.status='cancelled';job.completedAt=this.city.minute;job.cancelReason=reason;
 }
}
