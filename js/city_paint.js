import {activityRoomReady,outdoorCellReady} from './city_interiors.js?v=deep-perf-3';
import {normalizeColor,colorName,factoryColors,favoriteColors,colorAffinity} from './city_colors.js';
const paintable=new Set(['bicicleta','bicicleta_carga','patinete']);
const live=b=>b?.active&&!b.entity.destroyed;
export class CityPaint {
 constructor(city){this.city=city;this.jobs=[];this.nextId=1;this.lastHour=null;}
 stock(holder){
  holder.paintLots??=[];const count=holder.inventory?.tinta||0;let known=holder.paintLots.reduce((n,l)=>n+l.quantity,0);
  while(known>count&&holder.paintLots.length){const l=holder.paintLots.at(-1),n=Math.min(l.quantity,known-count);l.quantity-=n;known-=n;if(!l.quantity)holder.paintLots.pop();}
  if(known<count)holder.paintLots.push({color:holder.type==='paintworks'?factoryColors(holder)[0]:'#90999e',quantity:count-known,producerId:holder.type==='paintworks'?holder.id:null,producerName:holder.type==='paintworks'?holder.entity.properties.name:'Estoque sem procedência registrada',premium:false});
  return holder.paintLots;
 }
 available(holder,color){return this.stock(holder).filter(l=>!color||l.color===normalizeColor(color)).reduce((n,l)=>n+l.quantity,0);}
 take(holder,quantity,color=null,physical=true){
  if(!Number.isInteger(quantity)||quantity<1||this.available(holder,color)<quantity)return null;
  const result=[],lots=holder.paintLots;let left=quantity;
  for(let i=0;i<lots.length&&left;){const l=lots[i];if(color&&l.color!==normalizeColor(color)){i++;continue;}const n=Math.min(left,l.quantity);result.push({...l,quantity:n});l.quantity-=n;left-=n;if(!l.quantity)lots.splice(i,1);else i++;}
  if(physical)holder.inventory.tinta-=quantity;return result;
 }
 move(from,to,good,n){if(good!=='tinta')return;const lots=this.take(from,n,null,false);to.paintLots??=[];if(lots)to.paintLots.push(...lots);}
 discard(holder,good,n,color=null){if(good==='tinta')this.take(holder,n,color,false);}
 produced(b,n){
  // Called after physical output is added; annotate the new units only.
  b.paintLots??=[];const order=b.paintColorOrders?.shift(),palette=factoryColors(b),color=order?.color||palette[(b.paintBatchSerial||0)%palette.length];b.paintBatchSerial=(b.paintBatchSerial||0)+1;
  b.paintLots.push({color,quantity:n,producerId:b.id,producerName:b.entity.properties.name,premium:!!order,manufacturedAt:this.city.minute});
 }
 setPalette(id,colors){const b=this.city.building(id);if(b?.type!=='paintworks'||!Array.isArray(colors)||!colors.length||colors.length>8||colors.some(c=>!normalizeColor(c)))return false;b.paintPalette=[...new Set(colors.map(normalizeColor))];return true;}
 quote(holder,color,n=1){const lots=this.stock(holder).filter(l=>l.color===normalizeColor(color));return Math.ceil(this.city.economy.goods.tinta.price*n*(lots.some(l=>l.premium)?1.75:1));}
 bag(c){return c.paintBag??={accountId:c.accountId,inventory:{tinta:0},paintLots:[],inventoryCapacity:16};}
 requestPurchase(citizenId,factoryId,color,custom=false,quantity=1){
  const city=this.city,c=city.society.citizen(citizenId),b=city.building(factoryId),hex=normalizeColor(color);
  if(!c||c.entity.destroyed||!city.society.isAdult(c)||!live(b)||b.type!=='paintworks'||!hex||!Number.isInteger(quantity)||quantity<1||quantity>16||this.bag(c).inventory.tinta+quantity>16)return city.fail('Comprador, fábrica, cor ou capacidade de tinta indisponível.');
  const price=Math.ceil(city.economy.goods.tinta.price*quantity*(custom?1.75:1));if(c.balance<price)return city.fail('Saldo insuficiente para comprar tinta.');
  if(custom&&this.available(b,hex)<quantity){b.paintColorOrders??=[];if(!b.paintColorOrders.some(o=>o.citizenId===c.id&&o.color===hex))b.paintColorOrders.push({color:hex,citizenId:c.id,quantity});}
  else if(this.available(b,hex)<quantity)return city.fail('A fábrica não tem essa cor. Encomende uma cor específica.');
  c.paintPurchase={factoryId,color:hex,quantity,custom};return true;
 }
 buy(c,b,color,n,custom=false){
  const city=this.city;if(!live(b)||this.available(b,color)<n||this.bag(c).inventory.tinta+n>16)return false;
  const price=Math.max(this.quote(b,color,n),Math.ceil(city.economy.goods.tinta.price*n*(custom?1.75:1)));
  if(!city.transfer(c.accountId,b.accountId,price,'Compra de tinta por cor',{buildingId:b.id,color,quantity:n}))return false;
  const lots=this.take(b,n,color);this.bag(c).inventory.tinta+=n;c.paintBag.paintLots.push(...lots);city.economy.recordGoods('paint-purchase','tinta',n,b.id,c.id);b.totalRevenue+=price;c.paintPurchase=null;return true;
 }
 requestVehicle(id,garageId,color,useOwn=false){
  const city=this.city,v=city.vehicles.units.get(id),garage=city.building(garageId),hex=normalizeColor(color),account=city.accounts.get(v?.ownerAccountId),c=account?.entity?.properties.citizen?account:city.society.citizen(account?.ownerId);
  if(!v?.active||v.scrapped||!paintable.has(v.good)||v.paintJobId||!live(garage)||garage.type!=='cycle_workshop'||!hex||!c)return city.fail('Veículo, proprietário ou oficina indisponível.');
  if(useOwn&&this.available(this.bag(c),hex)<1)return city.fail('O proprietário precisa ter uma lata dessa cor.');
  const job={id:this.nextId++,kind:'vehicle',vehicleId:v.id,providerId:garage.id,clientId:c.id,payer:v.ownerAccountId,color:hex,quantity:1,useOwn,status:'delivery',createdAt:city.minute,labor:0,requiredLabor:18};
  v.paintJobId=job.id;this.jobs.push(job);return true;
 }
 requestBuilding(id,payer,color,useOwn=false){
  const city=this.city,b=city.building(id),hex=normalizeColor(color),provider=city.buildings.find(p=>live(p)&&p.type==='builder'),units=b?.units.filter(u=>u.ownerId===payer&&(b.constructionKind!=='open-air'||['bathroom','dining'].includes(u.roomType))),client=city.accounts.get(payer);
  if(!b||b.entity.destroyed||!hex||!provider||!units?.length||!client)return city.fail('É necessário possuir cômodos nesse prédio e ter uma construtora disponível.');
  if(this.jobs.some(j=>j.buildingId===id&&j.payer===payer&&!['completed','cancelled'].includes(j.status)))return false;
  const quantity=Math.max(1,Math.ceil(units.length/4));if(useOwn&&(!client.entity?.properties.citizen||this.available(this.bag(client),hex)<quantity))return city.fail('Tinta própria insuficiente para a área.');
  this.jobs.push({id:this.nextId++,kind:'building',buildingId:id,unitIds:units.map(u=>u.id),providerId:provider.id,payer,clientId:client.entity?.properties.citizen?client.id:null,color:hex,quantity,useOwn,status:'ready',createdAt:city.minute,labor:0,requiredLabor:units.length*3});return true;
 }
 route(c){
  const city=this.city;if(city.politics.officeHolder(c)&&city.hour>=8&&city.hour<17)return false;if(c.paintPurchase){const p=c.paintPurchase,b=city.building(p.factoryId);if(!live(b)){c.paintPurchase=null;return false;}if(p.custom&&this.available(b,p.color)<p.quantity){b.paintColorOrders??=[];if(!b.paintColorOrders.some(o=>o.color===p.color))b.paintColorOrders.push({color:p.color,citizenId:c.id});}if(this.available(b,p.color)>=p.quantity){const path=city.findPath(c.entity,b.door);if(path!==null){c.path=path;c.task='paint-purchase';c.targetId=b.id;c.indoorLocation=null;return true;}}}
  const job=this.jobs.find(j=>j.clientId===c.id&&j.kind==='vehicle'&&j.status==='delivery');if(!job)return false;
  const garage=city.building(job.providerId),v=city.vehicles.units.get(job.vehicleId);if(!live(garage)||!v||v.scrapped){this.cancel(job);return false;}
  if(job.useOwn&&this.available(this.bag(c),job.color)<job.quantity)return false;
  if(v.driverId||v.mechanicId||c.mobilityTrip||c.ridingVehicleId)return false;
  if(Math.hypot(v.x-garage.door.x,v.y-garage.door.y)<=3){const path=city.findPath(c.entity,garage.door);if(path===null)return false;c.path=path;}
  else {const path=city.findPath(c.entity,v);if(path===null)return false;v.driverId=c.id;v.reservedParking=city.vehicles.reserveParking(v,garage.door,2)||city.vehicles.roadsideParking(v,garage.door,2);c.mobilityTrip={kind:'cycle',vehicleId:v.id,goal:garage.door,stage:'boarding'};c.path=path;}
  c.task='paint-delivery';c.targetId=garage.id;c.indoorLocation=null;return true;
 }
 arrive(c){
  if(c.task==='paint-purchase'){const p=c.paintPurchase,b=this.city.building(p?.factoryId);if(p&&b&&Math.hypot(c.entity.x-b.door.x,c.entity.y-b.door.y)<=1.5)this.buy(c,b,p.color,p.quantity,p.custom);c.task=null;return;}
  const job=this.jobs.find(j=>j.clientId===c.id&&j.status==='delivery'),b=job&&this.city.building(job.providerId),v=job&&this.city.vehicles.units.get(job.vehicleId);
  if(b&&v&&Math.hypot(c.entity.x-b.door.x,c.entity.y-b.door.y)<=1.5&&Math.hypot(v.x-b.door.x,v.y-b.door.y)<=3){if(job.useOwn){const materials=this.take(this.bag(c),job.quantity,job.color);if(!materials){c.task=null;return;}job.materials=materials;}job.status='ready';job.deliveredAt=this.city.minute;v.status='Na oficina: aguardando pintura';}
  c.task=null;
 }
 work(b,c){
  const city=this.city;let job=this.jobs.find(j=>j.providerId===b.id&&j.workerId===c.id&&j.status==='painting')||this.jobs.find(j=>j.providerId===b.id&&j.status==='ready');if(!job)return false;
  const target=job.kind==='vehicle'?city.vehicles.units.get(job.vehicleId):city.building(job.buildingId),point=job.kind==='vehicle'?target:target?.door;
  if(!target||target.scrapped||target.entity.destroyed){this.cancel(job);return false;}
  if(job.kind==='vehicle'&&(target.driverId||target.mechanicId&&target.mechanicId!==c.id))return false;
  if(job.status==='ready'){
   const client=city.society.citizen(job.clientId),source=job.useOwn&&client?this.bag(client):b;if(!job.materials?.length&&this.available(source,job.color)<job.quantity)return false;
   if(job.price==null){
   const price=Math.ceil(((job.useOwn?0:this.quote(b,job.color,job.quantity))+city.currency.price(job.requiredLabor*city.politics.policy.minimumWage))*(job.payer==='treasury'?1.5:1));
   if(!city.transfer(job.payer,b.accountId,price,'Serviço: pintura',{vehicleId:job.vehicleId,buildingId:job.buildingId,paintJobId:job.id,color:job.color}))return false;
   if(!job.materials?.length)job.materials=this.take(source,job.quantity,job.color);job.price=price;}job.workerId=c.id;c.paintWorkId=job.id;job.status='painting';if(job.kind==='vehicle')target.mechanicId=c.id;
  }
  c.task='work';c.targetId=b.id;
  if(job.kind==='building'){const index=Math.min(job.unitIds.length-1,Math.floor(job.labor/3)),unit=city.units.get(job.unitIds[index]);if(!unit){this.cancel(job);return false;}if(!activityRoomReady(city,c,target,unit,'workspace'))return true;}
  else if(!outdoorCellReady(city,c,{id:b.id,entity:{x:0,y:0}},{id:`vehicle:${target.id}`,x:point.x-.5,y:point.y-.5,z:0}))return true;
  job.labor+=Math.min(1+(c.skills.maintenance||c.skills.construction||0)/100,job.kind==='building'?(Math.floor(job.labor/3)+1)*3-job.labor:Infinity);c.action=`Pintando de ${colorName(job.color)}`;if(job.labor<job.requiredLabor)return true;
  city.economy.consumed.tinta+=job.quantity;city.economy.recordGoods('painting','tinta',job.quantity,b.id,target.id);
  if(job.kind==='vehicle'){target.color=job.color;target.mechanicId=null;target.paintJobId=null;target.status='Pintura concluída';(target.paintHistory??=[]).push({minute:city.minute,color:job.color,workshopId:b.id,workerId:c.id,price:job.price,materials:job.materials});}
  else {target.wallColors??={};for(const id of job.unitIds)target.wallColors[id]=job.color;if(job.unitIds.length===target.units.length)target.wallColor=job.color;target.paintRevision=(target.paintRevision||0)+1;}
  c.paintWorkId=null;job.status='completed';job.completedAt=city.minute;job.materials=[];city.history.record('production',`Pintura ${colorName(job.color)} concluída por ${b.entity.properties.name}.`,[job.payer],{kind:'paint-completed',vehicleId:job.vehicleId,buildingId:job.buildingId,paintJobId:job.id,color:job.color,amount:job.price});return true;
 }
 cancel(job){const worker=this.city.society.citizen(job.workerId);if(worker?.paintWorkId===job.id)worker.paintWorkId=null;for(const l of job.materials||[])this.city.economy.lost.tinta+=l.quantity;job.materials=[];job.status='cancelled';const v=this.city.vehicles.units.get(job.vehicleId);if(v){v.paintJobId=null;v.mechanicId=null;}}
 hourly(){
  const city=this.city,hour=Math.floor(city.minute/60);if(this.lastHour===hour)return;this.lastHour=hour;
  for(const job of this.jobs.filter(j=>!['completed','cancelled'].includes(j.status))){const b=city.building(job.providerId);const client=city.society.citizen(job.clientId);if(job.clientId&&(!client||client.entity.destroyed)){this.cancel(job);continue;}const worker=city.society.citizen(job.workerId);if(job.workerId&&(!worker||worker.entity.destroyed||worker.jobId!==b?.id&&worker.id!==b?.ownerId)){if(worker?.paintWorkId===job.id)worker.paintWorkId=null;job.workerId=null;job.status='ready';const v=city.vehicles.units.get(job.vehicleId);if(v)v.mechanicId=null;}if(!live(b)){this.cancel(job);continue;}if(job.useOwn||job.status==='painting'||this.available(b,job.color)+(b.incoming.tinta||0)>=job.quantity)continue;
   const suppliers=city.economy.businesses.filter(p=>live(p)&&p.type==='paintworks'),seller=suppliers.find(s=>this.available(s,job.color)>=job.quantity);
   if(seller){seller.paintLots.sort((a,b)=>Number(b.color===job.color)-Number(a.color===job.color));city.logistics.order(seller,b,'tinta',job.quantity,this.quote(seller,job.color));}
   else if(suppliers[0]){const factory=suppliers[0];factory.paintColorOrders??=[];if(!factory.paintColorOrders.some(o=>o.color===job.color))factory.paintColorOrders.push({color:job.color,paintJobId:job.id});}
  }
  if(city.politics.active?.status==='campaign'){const factory=city.economy.businesses.find(b=>live(b)&&b.type==='paintworks');if(factory)for(const party of city.politics.parties.filter(p=>p.active)){factory.paintColorOrders??=[];if(this.available(factory,party.flag.background)<4&&!factory.paintColorOrders.some(o=>o.color===party.flag.background))factory.paintColorOrders.push({color:party.flag.background,partyId:party.id});}}
  // Discretionary repainting is infrequent, affordable and driven by personal taste.
  const c=city.citizens.find(c=>c.id%168===hour%168&&!c.entity.destroyed&&c.balance>city.currency.price(30000)&&city.minute-(c.lastPaintDecisionAt??-Infinity)>1440*7);
  if(c){c.lastPaintDecisionAt=city.minute;const v=[...city.vehicles.units.values()].find(v=>v.active&&v.ownerAccountId===c.accountId&&paintable.has(v.good)&&!v.paintJobId&&colorAffinity(c,v.color)<-.25),b=city.buildings.find(b=>live(b)&&b.type==='cycle_workshop');if(v&&b)this.requestVehicle(v.id,b.id,favoriteColors(c)[0].hex);}
  while(this.jobs.length>160){const i=this.jobs.findIndex(j=>['completed','cancelled'].includes(j.status));if(i<0)break;this.jobs.splice(i,1);}
 }
 goodsStock(good){return good==='tinta'?this.city.citizens.reduce((n,c)=>n+(c.paintBag?.inventory.tinta||0),0)+this.jobs.reduce((n,j)=>n+(j.materials||[]).reduce((n,l)=>n+l.quantity,0),0):0;}
}
