import {artworkNarrative} from './city_art_narratives.js';
import {activityRoomReady} from './city_interiors.js?v=service-capacity-3';
import {interiorRoute,interiorUsePoint} from './city_interior_layout.js';
import {CITY_FLOOR_HEIGHT} from './city_building_geometry.js';
import {buildingLeisureSpaces} from './city_balconies.js?v=balcony-door-alignment-2';

const ACTIVE=new Set(['open','working']);
const INTERRUPTIBLE=new Set(['leisure','walk','social','sit','outdoor_leisure']);
const cleanFee=(city,building,scope,payerId=null)=>{
 const feces=[...(building.feces?.values()||[])].reduce((n,p)=>n+(p.amount||0),0),base=city.currency.price(900+Math.min(30,feces)*100+(building.litter||0)*120),factor=scope==='frontage'?1:.8;
 return Math.ceil(base*factor*(payerId==='treasury'?1.5:1));
};
export class CityGigs{
 constructor(city){this.city=city;this.jobs=[];this.nextId=1;this.completed=0;this.lastSpontaneousArtworkDay=null;this.lastSpontaneousArtworkAt=-Infinity;}
 get(id){return this.jobs.find(j=>j.id===id);}
 quote(buildingId,scope='interior',payerAccountId=null){const b=this.city.building(buildingId);if(!b)return 0;const city=this.city;if(scope==='repair')return Math.ceil(city.currency.price(1400+Math.max(0,75-(b.condition||100))*45)*(payerAccountId==='treasury'?1.5:1));if(scope==='garden')return Math.ceil(city.currency.price(1800)*(payerAccountId==='treasury'?1.5:1));return cleanFee(city,b,scope,payerAccountId);}
 artworkMaterial(kind){return ['statue','monument'].includes(kind)?{good:'pedra',quantity:2}:{good:'tinta',quantity:1};}
 artworkSupplier(kind){const city=this.city,{good,quantity}=this.artworkMaterial(kind);return city.buildings.filter(b=>b.active&&!b.entity.destroyed&&(good==='tinta'?b.type==='paintworks'&&city.paint.available(b)>=quantity:(b.inventory?.[good]||0)>=quantity)).sort((a,z)=>a.id-z.id)[0]||null;}
 artworkQuote(buildingId,kind,payerAccountId){const city=this.city,b=city.building(buildingId),supplier=this.artworkSupplier(kind);if(!b)return 0;const required=['statue','monument'].includes(kind)?42:24,material=this.artworkMaterial(kind),supply=material.good==='tinta'?(supplier?city.paint.quote(supplier,city.paint.stock(supplier)[0]?.color,material.quantity):city.economy.goods.tinta.price*material.quantity):city.economy.goods[material.good].price*material.quantity,labor=required*(city.politics.policy.minimumWage||1),base=city.currency.price(900+supply+labor);return Math.ceil(base*(payerAccountId==='treasury'?1.5:1));}
 createArtworkOrder(payerAccountId,buildingId,{kind='banner',message='',subjectId=null,sponsorId=null,truth=null,purpose='expression',commercial=false,partyId=null,color=null,fee=null,narrative=null,preferredArtistId=null,supportUnitId=null,supportKind='interior-wall',supportLinkId=null,supportEndpoint=null}={}){
  const city=this.city,b=city.building(buildingId),allowed=['banner','painting','graffiti','flags','statue','monument'];if(!b||b.entity.destroyed||b.constructionKind==='open-air'||!allowed.includes(kind)||!String(message).trim()||!city.accounts.has(payerAccountId))return false;
  const owner=b.ownerId!=null?city.society.citizen(b.ownerId)?.accountId:b.municipal?'treasury':b.accountId,unitSponsor=b.units?.some(u=>u.ownerId===payerAccountId||u.tenantId===payerAccountId);if(payerAccountId!==owner&&payerAccountId!==b.accountId&&!unitSponsor&&!b.municipal)return false;
  const account=artworkNarrative(city,narrative),resolvedSponsorId=sponsorId??city.citizens.find(c=>c.accountId===payerAccountId)?.id??(b.municipal?city.economy.mayorId:city.society.citizen(b.ownerId)?.id??null);if(narrative&&!account)return false;if(purpose==='defamation'&&(!Number.isInteger(subjectId)||!city.society.citizen(subjectId)||resolvedSponsorId==null||!(!account&&truth===false||account?.mode==='distorted'||account?.mode==='invented')))return false;
  const link=supportKind==='skybridge'?(city.skybridgeLinksForRevision?.()||[]).find(item=>item.id===supportLinkId):null,endpoint=supportKind==='skybridge'?(supportEndpoint==='end'||supportEndpoint==='start'?supportEndpoint:b.id===link?.bId?'end':'start'):null,endpointBuildingId=endpoint==='end'?link?.bId:link?.aId,roomId=supportKind==='skybridge'?(endpoint==='end'?link?.buId:link?.auId):supportUnitId==null?null:Number(supportUnitId),room=roomId==null?null:b.units.find(u=>u.id===roomId),roof=supportKind==='roof-terrace'&&room?buildingLeisureSpaces(b).find(s=>s.kind==='roof_terrace'&&s.unitId===room.id):null;
  if(supportKind==='skybridge'&&(!link||![link.aId,link.bId].includes(b.id)||endpointBuildingId!==b.id||!room)||supportUnitId!=null&&supportKind!=='skybridge'&&!room||supportKind==='roof-terrace'&&!roof)return false;
  const bridgePoint=link?{x:(link.start.x+link.end.x)/2,y:(link.start.y+link.end.y)/2,z:link.height}:null,point=supportKind==='skybridge'?bridgePoint:roof?roof.position:room?interiorUsePoint(b,room,room.roomType,0,'informal-service'):this.frontagePoint(b),routePoint=room?{x:b.entity.x+room.x+.5,y:b.entity.y+room.y+.5,z:room.z*CITY_FLOOR_HEIGHT}:null;if(!point||room&&interiorRoute(b,{x:b.door.x,y:b.door.y,z:0},routePoint)===null)return false;
  const material=this.artworkMaterial(kind),required=['statue','monument'].includes(kind)?42:24,amount=fee??this.artworkQuote(b.id,kind,payerAccountId);if(!amount)return false;
  const job=this.reserveOrder(payerAccountId,b,{kind:'art-installation',scope:room?'interior-art':'outdoor',unitId:room?.id||null,fee:amount,point,required});if(!job)return false;
  const side=room&&!roof?room.y===0?'north':room.x===b.width-1?'east':room.y===b.depth-1?'south':'west':null;
  job.artwork={narrative:account,kind,message:String(message).trim().slice(0,180),subjectId,truth,purpose,sponsorId:resolvedSponsorId,sponsorAccountId:payerAccountId,commercial:!!commercial,partyId,color};job.artworkSupport=supportKind==='skybridge'?{kind:'skybridge',buildingId:b.id,unitId:room.id,floor:room.z,linkId:link.id,endpoint,position:bridgePoint}:roof?{kind:'roof-terrace',buildingId:b.id,unitId:room.id,floor:Math.floor(roof.position.z/CITY_FLOOR_HEIGHT),position:{...roof.position}}:room?{kind:'interior-wall',buildingId:b.id,unitId:room.id,floor:room.z,side,rotation:({north:0,east:-Math.PI/2,south:Math.PI,west:Math.PI/2})[side]}:null;job.artworkMaterial=material;job.preferredArtistId=Number.isInteger(preferredArtistId)?preferredArtistId:null;job.waitingReason=this.artworkSupplier(kind)?null:`Aguardando ${material.good==='tinta'?'tinta':'pedra'} em estoque`;
  return job;
 }
 postSpontaneousArtwork(){
  const city=this.city,day=Math.floor(city.minute/1440)+1;if(city.minute%1440!==600||this.lastSpontaneousArtworkDay===day||city.minute-this.lastSpontaneousArtworkAt<7*1440)return null;this.lastSpontaneousArtworkDay=day;
  const hash=n=>Math.imul(n|0,2654435761)>>>0,artists=city.citizens.filter(c=>!c.entity.destroyed&&!c.dead&&city.society.isAdult(c)&&(c.skills?.artistic||0)>=28&&!c.jobId&&!(c.businessIds||[]).length&&!c.custody&&!c.informalJobId&&!c.conversation&&!c.mobilityTrip&&!c.ridingVehicleId&&(!c.task||INTERRUPTIBLE.has(c.task))&&!city.urgentNeed(c)&&(c.needs?.energy??0)>50&&(c.needs?.health??0)>50&&city.minute-(c.lastSpontaneousArtworkAt??-Infinity)>=30*1440)
   .map(c=>({citizen:c,roll:hash(c.id*31+day*7919)%100})).filter(row=>row.roll<4).sort((a,b)=>(b.citizen.skills.artistic-a.citizen.skills.artistic)||a.roll-b.roll||a.citizen.id-b.citizen.id);
  for(const {citizen,roll} of artists){
   const account=city.accounts.get(citizen.accountId);if(!account)continue;
   const sites=city.buildings.filter(b=>!b.entity.destroyed&&b.constructionKind!=='open-air'&&b.units?.some(u=>u.ownerId===citizen.accountId||u.tenantId===citizen.accountId)&&!this.jobs.some(j=>j.kind==='art-installation'&&j.buildingId===b.id&&ACTIVE.has(j.status))).sort((a,b)=>a.id-b.id);
   for(const site of sites){
    const kind=roll%4===0?'painting':'banner',fee=this.artworkQuote(site.id,kind,citizen.accountId);if(!fee||account.balance<fee)continue;
    const partyId=roll%3===0&&city.politics?.party?.(citizen.political?.partyId)?.active?citizen.political.partyId:null;
    const messages=partyId?['Um futuro melhor começa no bairro','Nossa cidade merece cuidado','Vozes do bairro, decisões para todos']:['O bairro também faz parte da cidade','Cuidar daqui é construir futuro','A cidade também é de quem vive nela'];
    const job=this.createArtworkOrder(citizen.accountId,site.id,{kind,message:messages[roll%messages.length],truth:null,partyId,preferredArtistId:citizen.id});
    if(!job)continue;citizen.lastSpontaneousArtworkAt=city.minute;this.lastSpontaneousArtworkAt=city.minute;
    city.log(`${citizen.entity.properties.name} financiou espontaneamente uma obra urbana em ${site.entity.properties.name}.`,'justice',[citizen.id,site.id],{kind:'spontaneous-art-sponsored',gigId:job.id,buildingId:site.id,partyId});return job;
   }
  }
  return null;
 }
 consumeArtworkMaterial(job){
  const city=this.city,{good,quantity}=job.artworkMaterial||this.artworkMaterial(job.artwork?.kind),supplier=this.artworkSupplier(job.artwork?.kind);if(!supplier)return false;
  const price=good==='tinta'?city.paint.quote(supplier,job.artwork.color||city.paint.stock(supplier)[0]?.color,quantity):city.economy.goods[good].price*quantity,account=city.accounts.get(job.accountId);if(!Number.isSafeInteger(price)||!account||account.balance<price)return false;
  if(!city.transfer(job.accountId,supplier.accountId,price,'Compra de material para arte urbana',{gigId:job.id,buildingId:job.buildingId,good,quantity}))return false;
  if(good==='tinta'){
    const lots=city.paint.take(supplier,quantity,job.artwork.color||null);if(!lots){city.transfer(supplier.accountId,job.accountId,price,'Estorno de material para arte urbana',{gigId:job.id,buildingId:job.buildingId,good,quantity});return false;}job.artwork.materialLots=lots;job.artwork.color=lots[0]?.color||job.artwork.color;
  }else{if((supplier.inventory?.[good]||0)<quantity){city.transfer(supplier.accountId,job.accountId,price,'Estorno de material para arte urbana',{gigId:job.id,buildingId:job.buildingId,good,quantity});return false;}supplier.inventory[good]-=quantity;}
  city.economy.consumed[good]=(city.economy.consumed[good]||0)+quantity;city.economy.recordGoods('art-installation-input',good,quantity,supplier.id,job.buildingId);job.artwork.materialSourceId=supplier.id;job.artwork.materialCost=price;return true;
 }
 gardenPoint(b){const city=this.city,x=Math.floor(b.entity.x),y=Math.floor(b.entity.y),points=[];for(let px=x-1;px<=x+b.width;px++){points.push([px,y-1],[px,y+b.depth]);}for(let py=y;py<y+b.depth;py++)points.push([x-1,py],[x+b.width,py]);for(const [gx,gy]of points)if(city.walkable(gx,gy)&&city.nature.available(gx,gy,'berry',b.id))return {x:gx+.5,y:gy+.5,tileX:gx,tileY:gy};return null;}
 createRepairOrder(payerAccountId,buildingId,{fee=null}={}){const city=this.city,b=city.building(buildingId);if(!b||b.constructionKind==='open-air'||!b.units.length||!city.accounts.has(payerAccountId)||!(b.repairNeeded||b.condition<85)||this.jobs.some(j=>j.kind==='repair'&&j.buildingId===b.id&&ACTIVE.has(j.status)))return false;const amount=fee??this.quote(b.id,'repair',payerAccountId),unit=b.units.find(u=>['workspace','office','service'].includes(u.roomType))||b.units[0];return this.reserveOrder(payerAccountId,b,{kind:'repair',scope:'interior',fee:amount,unitId:unit.id,required:24});}
 createGardenOrder(payerAccountId,buildingId,{fee=null}={}){const city=this.city,b=city.building(buildingId),point=b&&this.gardenPoint(b);if(!b||!point||!city.accounts.has(payerAccountId)||this.jobs.some(j=>j.kind==='gardening'&&j.buildingId===b.id&&ACTIVE.has(j.status)))return false;const amount=fee??this.quote(b.id,'garden',payerAccountId);return this.reserveOrder(payerAccountId,b,{kind:'gardening',scope:'outdoor',fee:amount,point,required:18});}
 reserveOrder(payerAccountId,b,{kind,scope,fee,unitId=null,point=null,required=20}){const city=this.city;if(!Number.isSafeInteger(fee)||fee<1||(city.accounts.get(payerAccountId)?.balance||0)<fee)return false;const id=this.nextId++,accountId=`gig:${id}`,account={name:`Serviço autônomo ${id}`,balance:0};city.accounts.set(accountId,account);if(!city.transfer(payerAccountId,accountId,fee,`Reserva de bico de ${kind}`,{gigId:id,buildingId:b.id})){city.accounts.delete(accountId);return false;}const job={id,accountId,payerAccountId,buildingId:b.id,unitId,point,kind,scope,fee,status:'open',workerId:null,progress:0,required,createdAt:city.minute,completedAt:null};this.jobs.push(job);const label=kind==='art-cleaning'?'limpeza de pichação':kind==='art-installation'?'instalação de arte urbana':kind==='repair'?'pequeno reparo':'jardinagem';city.history.record('service',`Bico de ${label} anunciado para ${b.entity.properties.name}.`,[payerAccountId,b.accountId],{kind:'gig-posted',gigId:id,buildingId:b.id,service:kind,amount:fee,createdAt:city.minute});city.log(`Bico de ${label} #${id} anunciado.`,'work',[],{kind:'gig-posted',gigId:id,buildingId:b.id,service:kind,accounts:[payerAccountId],amount:fee});return job;}
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
  if(job.kind==='art-installation'&&!this.artworkSupplier(job.artwork?.kind)){job.waitingReason=`Aguardando ${job.artworkMaterial?.good==='pedra'?'pedra':'tinta'} em estoque`;return [];}
  if(job.kind==='art-installation')job.waitingReason=null;
  const point=job.artworkSupport?b.door:['gardening','art-cleaning','art-installation'].includes(job.kind)?job.point:job.scope==='frontage'?this.frontagePoint(b):b.door;
  const eligible=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)&&(!job.preferredArtistId||c.id===job.preferredArtistId)&&(!job.artworkSupport||!c.indoorLocation||c.indoorLocation.buildingId===b.id)&&!c.role?.includes('councilor')&&!c.jobId&&!(c.businessIds?.length)&&(!c.task||INTERRUPTIBLE.has(c.task))&&!c.deliveryId&&!c.cleaningJobId&&!c.informalJobId&&!c.conversation&&!c.workMeal&&!c.mobilityTrip&&!c.ridingVehicleId&&!city.urgentNeed(c)&&c.needs.energy>25&&(job.kind!=='art-installation'||(c.skills?.artistic||0)>0))
   .sort((a,z)=>job.kind==='art-installation'?((z.skills?.artistic||0)-(a.skills?.artistic||0)||Math.hypot(a.entity.x-point.x,a.entity.y-point.y)-Math.hypot(z.entity.x-point.x,z.entity.y-point.y)||a.id-z.id):Math.hypot(a.entity.x-point.x,a.entity.y-point.y)-Math.hypot(z.entity.x-point.x,z.entity.y-point.y)||a.id-z.id);
  job.availableCandidatePool=eligible.length;if(!eligible.length)return [];
  // A posted gig previously ran A* once for every resident just to find one
  // worker. Probe a small rotating batch; unreachable candidates do not starve
  // everyone farther down the list because the next dispatch advances the cursor.
  const count=Math.min(24,eligible.length),start=(job.candidateCursor||0)%eligible.length,reachable=[];
  const support=job.artworkSupport,bridge=support?.kind==='skybridge'?(city.skybridgeLinksForRevision?.()||[]).find(item=>item.id===support.linkId):null,interiorTarget=support?.kind==='skybridge'?bridge&&{x:b.entity.x+b.units.find(u=>u.id===support.unitId).x+.5,y:b.entity.y+b.units.find(u=>u.id===support.unitId).y+.5,z:support.floor*CITY_FLOOR_HEIGHT}:support?{x:job.point.x,y:job.point.y,z:job.point.z||0}:null;
  for(let i=0;i<count;i++){const candidate=eligible[(start+i)%eligible.length],inside=candidate.indoorLocation?.buildingId===b.id;if((inside||city.findPath(candidate.entity,point)!==null)&&(!support||interiorTarget&&interiorRoute(b,{x:b.door.x,y:b.door.y,z:0},interiorTarget)!==null)){reachable.push(candidate);break;}}
  job.candidateCursor=(start+count)%eligible.length;return reachable;
 }
 frontagePoint(b){
  const d=b.door,city=this.city,points=[[0,0],[1,0],[-1,0],[0,1],[0,-1]].map(([x,y])=>({x:Math.floor(d.x)+x+.5,y:Math.floor(d.y)+y+.5}));
  return points.find(p=>city.walkable(Math.floor(p.x),Math.floor(p.y))&&city.findPath(d,p)!==null)||{x:d.x,y:d.y};
 }
 release(job,c,{reopen=true}={}){
  if(c){if(c.informalJobId===job.id){c.task=null;c.targetId=null;c.action='';}this.city.furniture?.release(c);c.informalJobId=null;c.workCell=null;c.path=[];if(job.artworkSupport?.kind==='skybridge'&&(c.skybridgeZ>0||c.skybridgeTransit?.phase==='crossing'))this.city.justice.routeWorkerOffSkybridge(c);}
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
  for(const piece of city.justice?.art||[]){if(posted>=4)break;if(piece.entity.destroyed||!piece.layers.length||city.minute-(piece.lastDefacedAt??city.minute)<60)continue;if(city.justice.requestArtworkCleaning(piece.id))posted++;}
 }
 updateMinute(){
  const city=this.city;
  this.postSpontaneousArtwork();
  if(city.minute%60===0&&city.hour>=7&&city.hour<20)this.postNeededWork();
  for(const job of this.jobs){if(!ACTIVE.has(job.status))continue;const b=city.building(job.buildingId);if(!b){this.cancel(job,'imóvel removido');continue;}if(job.artworkSupport?.kind==='skybridge'&&(!(city.skybridgeLinksForRevision?.()||[]).some(link=>link.id===job.artworkSupport.linkId)||!b.units.some(unit=>unit.id===job.artworkSupport.unitId))){this.cancel(job,'passarela ou acesso ao prédio removido');continue;}
   let worker=city.society.citizen(job.workerId);
   if(worker&&(worker.entity.destroyed||city.urgentNeed(worker)&&!(job.artworkSupport?.kind==='skybridge'&&job.artworkSupport.phase==='returning'))){this.release(job,worker);worker=null;}
   if(!worker){if(city.hour<7||city.hour>=20||city.minute%3!==job.id%3)continue;const candidates=this.candidates(job);job.availableCandidates=job.availableCandidatePool??candidates.length;worker=candidates[0];if(!worker)continue;
    const goal=job.artworkSupport?b.door:['gardening','art-cleaning','art-installation'].includes(job.kind)?job.point:job.scope==='frontage'?this.frontagePoint(b):b.door,path=job.artworkSupport&&worker.indoorLocation?.buildingId===b.id?[]:city.findPath(worker.entity,goal);if(path===null)continue;
    job.workerId=worker.id;job.status='working';job.startedAt=city.minute;worker.informalJobId=job.id;city.furniture?.release(worker);worker.task=job.kind==='gardening'?'informal-gardening':job.artworkSupport?'informal-service':job.kind==='art-installation'?'informal-art-installation':job.scope==='interior'?'informal-service':'informal-frontage';worker.targetId=job.artworkSupport||job.scope==='interior'?b.id:null;worker.path=path;worker.servicePaid=null;const label=job.kind==='repair'?'um reparo':job.kind==='gardening'?'um serviço de jardinagem':job.kind==='art-installation'?'uma instalação artística':job.kind==='art-cleaning'?'uma limpeza de arte':'uma faxina';city.history.record('service',`${worker.entity.properties.name} aceitou ${label} em ${b.entity.properties.name}.`,[job.payerAccountId,worker.accountId,b.accountId],{kind:'gig-accepted',gigId:job.id,buildingId:b.id,citizenIds:[worker.id],scope:job.scope,service:job.kind,amount:job.fee,minute:city.minute});city.log(`${worker.entity.properties.name} aceitou o bico #${job.id}.`,'work',[worker.id],{kind:'gig-accepted',gigId:job.id,buildingId:b.id,service:job.kind,amount:job.fee});
   }
   if(job.artworkSupport?.kind==='skybridge'){
    const support=job.artworkSupport,link=(city.skybridgeLinksForRevision?.()||[]).find(item=>item.id===support.linkId);if(!link){this.cancel(job,'passarela removida antes de concluir o trabalho');continue;}
    if(support.phase==='returning'){if(worker.skybridgeTransit||worker.indoorLocation||worker.skybridgeZ>0||worker.path.length||Math.hypot(worker.entity.x-b.door.x,worker.entity.y-b.door.y)>.8)continue;job.progress=job.required;}
    else{
     if(worker.skybridgeTransit?.phase==='crossing'&&worker.skybridgeId===link.id&&worker.skybridgeZ>0&&!worker.indoorLocation){worker.skybridgeTransit=null;worker.path=[{x:job.point.x,y:job.point.y,z:link.height,skybridgeId:link.id}];worker.action='Atravessando a passarela até a obra';continue;}
     if(worker.skybridgeTransit||worker.indoorLocation||worker.skybridgeZ<=0||worker.skybridgeId!==link.id||worker.path.length||Math.hypot(worker.entity.x-job.point.x,worker.entity.y-job.point.y,(worker.skybridgeZ||0)-link.height)>.2)continue;
    }
   }else if(job.artworkSupport){const location=worker.indoorLocation;if(!location||location.buildingId!==b.id||location.path?.length)continue;if(job.artworkSupport.kind==='roof-terrace'?location.targetRoomType!=='roof_terrace':location.unitId!==job.unitId)continue;if(!job.artworkSupport.cleaning&&Math.hypot(location.position.x-job.point.x,location.position.y-job.point.y,(location.position.z||0)-job.point.z)>.2)continue;
   }else if(['gardening','art-cleaning','art-installation'].includes(job.kind)){
    if(Math.hypot(worker.entity.x-job.point.x,worker.entity.y-job.point.y)>.4||worker.path.length)continue;
   }else if(job.scope==='interior'){
    const room=city.units.get(job.unitId);if(!room){this.cancel(job,'cômodo removido');continue;}
    if(!activityRoomReady(city,worker,b,room,room.roomType))continue;
   }else{
    const goal=this.frontagePoint(b);if(Math.hypot(worker.entity.x-goal.x,worker.entity.y-goal.y)>.4||worker.path.length)continue;
   }
   if(job.artworkSupport?.phase!=='returning')job.progress+=job.kind==='art-installation'?Math.max(.5,1+(worker.skills?.artistic||0)/80):1;worker.action=job.artworkSupport?.phase==='returning'?'Voltando pela passarela após o serviço':job.kind==='repair'?'Fazendo pequeno reparo':job.kind==='gardening'?'Plantando no jardim':job.kind==='art-installation'?'Criando arte urbana':job.kind==='art-cleaning'?'Limpando obra urbana':job.scope==='frontage'?'Limpando a frente do imóvel':'Fazendo faxina informal';city.economy.practice(worker,job.kind==='repair'?'construction':job.kind==='gardening'?'agriculture':job.kind==='art-installation'?'artistic':'cleaning');
   if(job.progress<job.required)continue;
   if(job.kind==='art-installation'&&!job.artworkId){
    if(!this.consumeArtworkMaterial(job)){this.release(job,worker);job.waitingReason=`Aguardando material ou verba para ${job.artworkMaterial.good}`;continue;}
    const piece=city.justice.createArtwork({narrative:job.artwork.narrative,kind:job.artwork.kind,message:job.artwork.message,creatorId:worker.id,subjectId:job.artwork.subjectId,sponsorId:job.artwork.sponsorId,sponsorAccountId:job.payerAccountId,purpose:job.artwork.purpose,buildingId:b.id,x:job.point.x,y:job.point.y,support:job.artworkSupport,truth:job.artwork.truth,commercial:job.artwork.commercial,partyId:job.artwork.partyId,color:job.artwork.color?parseInt(String(job.artwork.color).replace('#',''),16):0xc9b979});
    if(!piece){this.cancel(job,'não foi possível instalar a obra encomendada');continue;}job.artworkId=piece.id;city.justice.registerArtworkDefamation(piece);
   }
   if(job.artworkSupport?.kind==='skybridge'&&job.artworkSupport.phase!=='returning'){
    const support=job.artworkSupport,link=(city.skybridgeLinksForRevision?.()||[]).find(item=>item.id===support.linkId),point=support.endpoint==='end'?link?.end:link?.start;if(!link||!point){this.cancel(job,'conexão da passarela removida antes do retorno');continue;}
    support.phase='returning';worker.path=[{x:point.x,y:point.y,z:link.height,skybridgeId:link.id},{x:point.x,y:point.y,z:link.height,skybridgeExit:{buildingId:support.buildingId,unitId:support.unitId,linkId:link.id,endpoint:support.endpoint}}];worker.targetId=support.buildingId;worker.action='Voltando pela passarela à saída do prédio';continue;
   }
   if(job.kind==='art-cleaning'&&!city.justice.canCompleteArtworkCleaning(job)){this.cancel(job,'a camada ou a obra mudou antes da limpeza');continue;}
   if(job.kind==='cleaning'||!job.kind)this.clean(job,b);else if(job.kind==='repair'){b.condition=Math.min(100,(b.condition||0)+35);b.repairNeeded=b.condition<70;}else if(job.kind==='gardening'){const planted=city.nature.spawn(job.point.tileX,job.point.tileY,'berry',{buildingId:b.id});if(!planted){this.cancel(job,'canteiro ocupado antes do plantio');continue;}}
   const paid=city.transfer(job.accountId,worker.accountId,city.accounts.get(job.accountId)?.balance||0,`Pagamento por bico de ${job.kind||'faxina'}`,{gigId:job.id,buildingId:b.id,scope:job.scope});
   if(job.kind==='art-cleaning'&&!paid){this.cancel(job,'pagamento da limpeza não concluído');continue;}
   job.status='completed';job.completedAt=city.minute;job.completedBy=worker.id;if(job.kind==='art-cleaning')city.justice.finishArtworkCleaning(job);this.completed++;worker.informalJobId=null;worker.task=null;worker.targetId=null;worker.path=[];worker.workCell=null;
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
