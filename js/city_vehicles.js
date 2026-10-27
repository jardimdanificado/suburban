import {inventoryFree} from './city_inventory.js';
import {surfaceElevation,tileAt,ROAD_TILES,roadTravelCost,canStep,wearRoad,ROAD_RULES} from './city_terrain.js';

export const VEHICLE_SPECS=Object.freeze({
  bicicleta:{label:'Bicicleta',speed:8,seats:1,cargo:36},
  bicicleta_carga:{label:'Bicicleta de carga',speed:6.5,seats:1,cargo:96},
  patins:{label:'Patins',speed:6,seats:1,cargo:24},
  skate:{label:'Skate',speed:6.5,seats:1,cargo:24},
});
export const VEHICLE_RECIPES=Object.freeze({
  bicicleta:{quadro:1,rodas:2,corrente:1,selim:1,rolamentos:2},
  bicicleta_carga:{quadro:2,rodas:3,corrente:1,selim:1,plataforma:1,rolamentos:3},
  patins:{botas:1,rodas:8,rolamentos:4},
  skate:{plataforma:1,rodas:4,rolamentos:2},
});
const parts=new Set(Object.values(VEHICLE_RECIPES).flatMap(r=>Object.keys(r)));
const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};

/** Human-powered mobility, component provenance, real trips and repairs. */
export class CityVehicles {
  constructor(city){this.city=city;this.units=new Map();this.models=new Map();this.batches=[];this.lines=[];this.nextId=1;this.nextModelId=1;this.nextBatchId=1;this.lastHour=null;this.activeCount=0;this.stats={distance:0,passengers:0,fares:0,repairs:0};}
  productionStatus(){
    const city=this.city,types=['iron_mine','coal_mine','steel_mill','aluminum_smelter','sawmill','glassworks','weaving','bearing_factory','frame_factory','deck_factory','tire_factory','chain_factory','safety_equipment','saddle_factory','cycle_assembler','skate_workshop','cycle_shop'];
    return types.filter(type=>city.buildingTypes[type]).map(type=>{const firms=city.economy.businesses.filter(b=>b.type===type&&b.active&&!b.entity.destroyed),projects=city.development.projects.filter(p=>p.type===type&&!p.cancelled&&p.status!=='completed'),spec=city.buildingTypes[type];return{type,label:spec.label,active:firms.length,planned:projects.length,workers:firms.reduce((n,b)=>n+b.workers.length,0),missing:firms.flatMap(b=>{const plan=this.recipeFor(b),inputs=plan?.inputs||spec.inputs||{};return Object.entries(inputs).filter(([good,q])=>(b.inventory[good]||0)<q*(plan?.size||1)).map(([good])=>city.economy.goods[good]?.label||good);}).filter((s,i,a)=>a.indexOf(s)===i),buildingId:firms[0]?.id};});
  }
  recipeFor(b){
    if(b.type==='skate_workshop')return {inputs:VEHICLE_RECIPES.skate,good:'skate',size:1};
    if(b.type!=='cycle_assembler')return null;
    let good=b.vehicleKind;
    if(!good){const units=[...this.units.values()].filter(v=>!v.scrapped),targets={bicicleta:Math.max(2,this.city.citizens.length/30),bicicleta_carga:Math.max(1,this.city.economy.businesses.filter(b=>b.type==='carrier').length*1.5),patins:Math.max(1,this.city.citizens.length/60)};
      good=Object.keys(targets).sort((a,b)=>units.filter(v=>v.good===a).length/targets[a]-units.filter(v=>v.good===b).length/targets[b])[0];}
    // A new factory should be able to complete its first vehicle from one
    // component set; requiring the default three-unit lot hid production for
    // a long time while every upstream supplier was still ramping up.
    return {inputs:VEHICLE_RECIPES[good],good,size:b.vehicleBatchSize||1};
  }
  configureAssembly(id,kind,size){
    const b=this.city.building(id);if(b?.type==='cycle_assembler'&&kind==='auto'&&!b.vehicleAssembly){b.vehicleKind=null;b.vehicleBatchSize=null;this.city.economy.updateDemand();return true;}if(!b||b.type!=='cycle_assembler'||!['bicicleta','bicicleta_carga','patins'].includes(kind)||!Number.isInteger(size)||size<1||size>12||b.vehicleAssembly)return this.city.fail('Escolha um lote de 1 a 12 veículos; conclua o lote atual antes de mudar.');
    if(Object.values(VEHICLE_RECIPES[kind]).reduce((n,q)=>n+q,0)*size>b.inventoryCapacity)return this.city.fail('Amplie o armazém ou escolha um lote menor para receber todas as peças.');
    b.vehicleKind=kind;b.vehicleBatchSize=size;b.productionLabor=0;this.city.economy.updateDemand();return true;
  }
  discardComponents(b,good,quantity){let remaining=quantity;const lots=b.componentLots?.[good];if(!lots)return;while(remaining>0&&lots.length){const lot=lots[0],take=Math.min(remaining,lot.quantity);lot.quantity-=take;remaining-=take;if(!lot.quantity)lots.shift();}}
  coherentLots(b,good){const groups=new Map();for(const lot of b.componentLots?.[good]||[]){const id=JSON.stringify([lot.producerId,lot.design]),old=groups.get(id);if(old)old.quantity+=lot.quantity;else groups.set(id,{producerId:lot.producerId,design:lot.design,quantity:lot.quantity});}if(!groups.size&&b.inventory[good]>0)groups.set('legacy',{producerId:'origem não identificada',design:1,quantity:b.inventory[good]});return [...groups.values()].sort((a,b)=>b.quantity-a.quantity);}
  revisePart(id){const b=this.city.building(id);if(!b||!Object.keys(this.city.buildingTypes[b.type]?.outputs||{}).some(g=>parts.has(g)))return false;b.partDesign=(b.partDesign||1)+1;return true;}
  produced(b,outputs){for(const [good,quantity]of Object.entries(outputs)){if(parts.has(good)){b.componentLots??={};(b.componentLots[good]??=[]).push({producerId:b.id,design:b.partDesign||1,quantity});}if(VEHICLE_SPECS[good])this.registerUnits(b,good,quantity);}}
  loseStock(holder,good,quantity){if(VEHICLE_SPECS[good])for(const v of [...this.units.values()].filter(v=>!v.active&&!v.scrapped&&v.good===good&&v.holderAccountId===holder.accountId).slice(0,quantity)){v.scrapped=true;v.holderAccountId=null;if(v.entity)v.entity.destroyed=true;}if(parts.has(good))this.discardComponents(holder,good,quantity);}
  moveStock(from,to,good,quantity){
    if(parts.has(good)){
      from.componentLots??={};to.componentLots??={};const source=from.componentLots[good]??=[],target=to.componentLots[good]??=[];let remaining=quantity;
      while(remaining>0&&source.length){const lot=source[0],take=Math.min(remaining,lot.quantity);target.push({...lot,quantity:take});lot.quantity-=take;remaining-=take;if(!lot.quantity)source.shift();}
      if(remaining)target.push({producerId:from.entity?.id??from.id,design:from.partDesign||1,quantity:remaining});
    }
    if(VEHICLE_SPECS[good])for(const v of [...this.units.values()].filter(v=>!v.active&&!v.scrapped&&v.good===good&&v.holderAccountId===from.accountId).slice(0,quantity)){v.holderAccountId=to.accountId;v.ownerAccountId=to.accountId;this.placeDisplay(v,to);}
  }
  takeComponents(b,recipe,quantity){
    const bill=[];b.componentLots??={};
    for(const [good,count]of Object.entries(recipe)){
      let remaining=count*quantity;const lots=b.componentLots[good]??=[],supplier=this.coherentLots(b,good).find(l=>l.quantity>=remaining);
      for(let i=0;i<lots.length&&remaining>0;){const lot=lots[i];if(supplier&&(lot.producerId!==supplier.producerId||lot.design!==supplier.design)){i++;continue;}const take=Math.min(remaining,lot.quantity);bill.push({good,producerId:lot.producerId,design:lot.design,quantity:take});lot.quantity-=take;remaining-=take;if(!lot.quantity)lots.splice(i,1);else i++;}
      if(remaining)bill.push({good,producerId:'origem não identificada',design:1,quantity:remaining});
      b.inventory[good]-=count*quantity;this.city.economy.consumed[good]+=count*quantity;this.city.economy.recordGoods('vehicle-assembly-input',good,count*quantity,b.id,null);
    }const grouped=new Map();for(const p of bill){const id=JSON.stringify([p.good,p.producerId,p.design]),old=grouped.get(id);if(old)old.quantity+=p.quantity;else grouped.set(id,{...p});}return [...grouped.values()];
  }
  assemblyWork(b,c){
    const city=this.city,plan=this.recipeFor(b);if(!plan)return false;
    if(!b.vehicleAssembly){
      const consistent=Math.min(...Object.entries(plan.inputs).map(([g,n])=>Math.floor((this.coherentLots(b,g)[0]?.quantity||0)/n)));
      if(b.vehicleBatchSize&&consistent<plan.size)return false;
      plan.size=Math.min(plan.size,consistent);if(plan.size<1)return false;
      if(inventoryFree(b)<plan.size||!Object.entries(plan.inputs).every(([g,n])=>b.inventory[g]>=n*plan.size)||b.inventory[plan.good]>=12)return false;
      const components=this.takeComponents(b,plan.inputs,plan.size),signature=JSON.stringify([b.id,plan.good,Object.entries(plan.inputs),components.map(p=>[p.good,p.producerId,p.design,p.quantity/plan.size]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))]);
      let model=this.models.get(signature);
      if(!model){const id=this.nextModelId++;model={id,signature,kind:plan.good,manufacturerId:b.id,brand:b.entity.properties.name,name:`${VEHICLE_SPECS[plan.good].label} ${id}-${String(hash(signature)%1000).padStart(3,'0')}`,components:components.map(p=>({...p,quantity:p.quantity/plan.size})),createdAt:city.minute};this.models.set(signature,model);}
      const batch={id:this.nextBatchId++,modelId:model.id,manufacturerId:b.id,good:plan.good,quantity:plan.size,components,startedAt:city.minute,labor:0,requiredLabor:80*plan.size,status:'assembly'};
      b.vehicleAssembly=batch;this.batches.push(batch);city.log(`${model.brand}: iniciado lote ${batch.id}, ${plan.size} unidades de ${model.name}.`,'production',[],{kind:'vehicle-batch-started',buildingId:b.id,batchId:batch.id,modelId:model.id});
    }
    const batch=b.vehicleAssembly;batch.labor+=1+(c.skills.maintenance||0)/80;c.action=`Montando lote ${batch.id}: ${batch.good}`;
    if(batch.labor<batch.requiredLabor)return true;
    if(inventoryFree(b)<batch.quantity)return false;
    b.inventory[batch.good]+=batch.quantity;city.economy.produced[batch.good]+=batch.quantity;city.economy.recordGoods('vehicle-production',batch.good,batch.quantity,null,b.id);
    this.registerUnits(b,batch.good,batch.quantity,batch.modelId,batch.id);batch.status='completed';batch.completedAt=city.minute;b.vehicleAssembly=null;return true;
  }
  registerUnits(b,good,quantity,modelId=null,batchId=null){
    if(!VEHICLE_SPECS[good])return;
    if(modelId==null){const signature=`${b.id}:${good}:${b.partDesign||1}`,existing=this.models.get(signature);let model=existing;if(!model){model={id:this.nextModelId++,signature,kind:good,manufacturerId:b.id,brand:b.entity.properties.name,name:`${VEHICLE_SPECS[good].label} ${b.partDesign||1}`,components:Object.entries(VEHICLE_RECIPES[good]).map(([good,quantity])=>({good,quantity,producerId:b.id,design:1})),createdAt:this.city.minute};this.models.set(signature,model);}modelId=model.id;}
    for(let i=0;i<quantity;i++){const id=this.nextId++,v={id,good,modelId,batchId,manufacturerId:b.id,holderAccountId:b.accountId,ownerAccountId:b.accountId,active:false,scrapped:false,condition:100,distance:0,passengerIds:[],driverId:null,journey:null};this.units.set(id,v);this.placeDisplay(v,b);}
  }
  placeDisplay(v,building){
    if(!building?.door)return;
    // Finished vehicles are visible while waiting for sale, so a working
    // factory or cycle_shop has an unmistakable in-world result.
    if(v.entity)v.entity.destroyed=true;
    const siblings=[...this.units.values()].filter(other=>other!==v&&!other.active&&!other.scrapped&&other.holderAccountId===building.accountId).length;
    const x=building.door.x+(siblings%3-1)*1.1,y=building.door.y+Math.floor(siblings/3)*1.1;
    v.entity=this.city.createEntity({x,y,properties:{name:`${this.model(v)?.brand} · ${this.model(v)?.name}`,cityVehicle:v,render:{color:0x52879a}}});
  }
  spec(v){return VEHICLE_SPECS[v.good];}
  financeVehicle(company,v){
    const city=this.city,price=this.vehiclePrice(v),amount=Math.max(0,price-company.balance);
    if(!amount)return true;
    // The vehicle itself is collateral. Requiring an extra operating reserve
    // on top of a 10% down payment made every new carrier ineligible.
    if(!city.bank.policy.creditEnabled||amount>Math.floor(price*.98)||city.bank.loans.some(l=>l.clientId===company.accountId&&l.purpose==='vehicle'&&!['paid','written-off'].includes(l.status)))return false;
    for(const bank of city.bank.available()){
      const reserve=Math.max(city.currency.price(city.bank.policy.cashReserve),bank.workers.length*bank.wage*480);
      if(bank.balance<reserve+amount)continue;
      const id=city.bank.nextId++;if(!city.transfer(bank.accountId,company.accountId,amount,'Crédito com veículo em garantia',{loanId:id,vehicleId:v.id,buildingId:company.id}))continue;
      const loan={id,bankId:bank.id,clientId:company.accountId,purpose:'vehicle',vehicleId:v.id,principal:amount,remaining:amount,interest:0,rate:Math.min(.0008,city.bank.policy.loanRate),installments:240,dailyPayment:Math.ceil(amount/240),dueDay:city.day+3,missed:0,status:'active',startedAt:city.minute,paid:0};city.bank.loans.push(loan);return true;
    }return false;
  }
  model(v){return [...this.models.values()].find(m=>m.id===v.modelId);}
  groundAccess(v){return {x:v.x,y:v.y};}
  activate(v,account,building){
    v.active=true;this.activeCount++;v.ownerAccountId=account;v.holderAccountId=null;v.x=building.door.x;v.y=building.door.y;v.altitude=surfaceElevation(this.city.world,v.x,v.y);v.status='Estacionado';
    if(v.entity)v.entity.destroyed=true;
    v.entity=this.city.createEntity({x:v.x,y:v.y,properties:{name:`${this.model(v)?.brand} · ${this.model(v)?.name}`,cityVehicle:v,render:{color:0x52879a}}});return true;
  }
  vehiclePrice(v){return Math.ceil(this.city.economy.goods[v.good].price*1.18);}
  buyVehicle(account,id){
    const city=this.city,v=this.units.get(id),dealer=v&&city.buildings.find(b=>b.accountId===v.holderAccountId&&b.type==='cycle_shop'&&b.active&&!b.entity.destroyed);
    if(!v||v.active||v.scrapped||!dealer||dealer.inventory[v.good]<1||!city.accounts.has(account))return false;
    const price=this.vehiclePrice(v);if(!city.transfer(account,dealer.accountId,price,'Compra de mobilidade individual',{vehicleId:id,modelId:v.modelId,buildingId:dealer.id}))return false;
    v.ownershipHistory??=[];v.ownershipHistory.push({minute:city.minute,from:dealer.accountId,to:account,price});dealer.totalRevenue+=price;dealer.inventory[v.good]--;this.activate(v,account,dealer);return true;
  }
  cargoCapacity(c){
    const base=c.equipment?.carrinho?72:c.equipment?.cesta?36:24;if(!this.activeCount)return base;
    const owners=new Set([c.accountId,this.city.building(c.jobId)?.accountId,...(c.businessIds||[]).map(id=>this.city.building(id)?.accountId)]);
    return Math.max(base,...[...this.units.values()].filter(v=>v.active&&!v.scrapped&&v.condition>15&&!v.mechanicId&&owners.has(v.ownerAccountId)&&(!v.driverId||v.driverId===c.id)).map(v=>VEHICLE_SPECS[v.good].cargo));
  }
  hourly(){
    const city=this.city,hour=Math.floor(city.minute/60);if(this.lastHour===hour)return;this.lastHour=hour;
    const units=[...this.units.values()],unsold=units.filter(v=>!v.active&&!v.scrapped&&city.buildings.some(b=>b.type==='cycle_shop'&&b.active&&b.accountId===v.holderAccountId)),owners=new Set(units.filter(v=>v.active&&!v.scrapped).map(v=>v.ownerAccountId));
    for(const company of city.economy.businesses.filter(b=>['carrier','bicycle_rental'].includes(b.type)&&!owners.has(b.accountId))){
      const v=unsold.find(v=>!v.active&&v.good===(company.type==='carrier'?'bicicleta_carga':'bicicleta'));
      if(v&&this.financeVehicle(company,v)&&this.buyVehicle(company.accountId,v.id))owners.add(company.accountId);
    }
    for(const c of city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)&&!owners.has(c.accountId)).slice().sort((a,b)=>b.balance-a.balance).slice(0,6)){
      const offered=unsold.filter(v=>!v.active&&this.vehiclePrice(v)+city.currency.price(15000)<c.balance).sort((a,b)=>Number(b.good===['bicicleta','patins','skate'][c.id%3])-Number(a.good===['bicicleta','patins','skate'][c.id%3])||this.vehiclePrice(a)-this.vehiclePrice(b));
      if(offered[0]&&this.buyVehicle(c.accountId,offered[0].id))owners.add(c.accountId);
    }
  }
  tryTrip(c){
    if(!this.activeCount||c.mobilityTrip||c.ridingVehicleId||c.path.length<3||!this.city.society.isAdult(c)||c.conversation||c.workMeal||this.city.minute-(c.lastVehicleSearchAt??-Infinity)<20)return;
    c.lastVehicleSearchAt=this.city.minute;const city=this.city,goal=c.path.at(-1);
    if(!c.path.some(p=>ROAD_TILES.has(tileAt(city.world,Math.floor(p.x),Math.floor(p.y)))))return;
    const owners=new Set([c.accountId,city.building(c.jobId)?.accountId,...c.businessIds.map(id=>city.building(id)?.accountId)]),load=c.deliveryId?city.logistics.shipments.find(s=>s.id===c.deliveryId):null;
    const candidates=[...this.units.values()].filter(v=>v.active&&!v.scrapped&&!v.driverId&&!v.mechanicId&&v.condition>15&&(owners.has(v.ownerAccountId)||city.buildings.some(b=>b.type==='bicycle_rental'&&b.active&&b.workers.length&&b.accountId===v.ownerAccountId&&Math.hypot(v.x-c.entity.x,v.y-c.entity.y)<4))&&(!load||VEHICLE_SPECS[v.good].cargo>=load.quantity));
    candidates.sort((a,b)=>Math.hypot(a.x-c.entity.x,a.y-c.entity.y)-Math.hypot(b.x-c.entity.x,b.y-c.entity.y));
    for(const v of candidates){
      const path=city.findPath(c.entity,v);if(path===null||path.length>Math.max(4,c.path.length/2))continue;
      const rental=!owners.has(v.ownerAccountId);if(rental&&!city.transfer(c.accountId,v.ownerAccountId,city.currency.price(50),'Serviço: aluguel de bicicleta',{vehicleId:v.id}))continue;
      if(rental)this.stats.fares+=city.currency.price(50);
      v.driverId=c.id;c.mobilityTrip={kind:'cycle',vehicleId:v.id,goal,stage:'boarding'};c.path=path;c.indoorLocation=null;v.status='Usuário a caminho';return true;
    }
  }
  releaseTrip(c){
    const v=this.units.get(c.ridingVehicleId||c.mobilityTrip?.vehicleId);
    if(v){v.driverId=null;v.journey=null;v.status='Estacionado';v.passengerIds=[];}
    c.ridingVehicleId=null;c.mobilityTrip=null;
  }
  minute(){
    this.hourly();
    for(const c of this.city.citizens){
      if(c.mobilityTrip&&(c.entity.destroyed||!this.units.has(c.mobilityTrip.vehicleId))){this.releaseTrip(c);continue;}
      if(c.mechanicJob){const b=this.city.building(c.mechanicJob.garageId);if(!b?.active||b.entity.destroyed||c.jobId!==b.id&&c.id!==b.ownerId){const v=this.units.get(c.mechanicJob.vehicleId);if(v)v.mechanicId=null;for(const [g,n]of Object.entries(c.mechanicJob.parts))this.city.economy.lost[g]+=n;c.mechanicJob=null;}}
    }
  }
  update(dt){
    if(!this.activeCount)return;const city=this.city;
    for(const v of this.units.values()){
      if(!v.active||v.scrapped||!v.driverId)continue;
      const c=city.society.citizen(v.driverId);if(!c||c.entity.destroyed){v.driverId=null;continue;}
      if(c.mobilityTrip?.stage==='boarding'){
        if(c.path.length)continue;
        if(Math.hypot(c.entity.x-v.x,c.entity.y-v.y)>2){this.releaseTrip(c);continue;}
        const path=city.findPath(v,c.mobilityTrip.goal);if(path===null){this.releaseTrip(c);c.task=null;continue;}
        c.entity.x=v.x;c.entity.y=v.y;c.path=path;c.ridingVehicleId=v.id;c.mobilityTrip.stage='riding';v.journey={};this.stats.passengers++;
      }
      if(c.ridingVehicleId!==v.id)continue;
      let elapsed=Math.max(0,dt);
      while(elapsed>0&&c.path.length){
        const p=c.path[0],tx=Math.floor(p.x),ty=Math.floor(p.y),sx=Math.floor(c.entity.x),sy=Math.floor(c.entity.y);
        if(!city.walkable(tx,ty)||!canStep(city.world,sx,sy,tx,ty)){c.path=[];c.task=null;break;}
        const tile=tileAt(city.world,tx,ty),road=ROAD_TILES.has(tile),speed=(road?VEHICLE_SPECS[v.good].speed:4)/roadTravelCost(tile),dx=p.x-c.entity.x,dy=p.y-c.entity.y,len=Math.hypot(dx,dy),travel=Math.min(len,elapsed*speed);
        if(len>0){c.entity.x+=dx/len*travel;c.entity.y+=dy/len*travel;v.angle=Math.atan2(dx,dy);}
        elapsed-=travel/speed;v.distance+=travel;this.stats.distance+=travel;v.condition=Math.max(0,v.condition-travel*(road?.012:.004));
        wearRoad(city.world,tx,ty,travel*ROAD_RULES.wearPerCell);
        if(len<=travel+.0001){c.entity.x=p.x;c.entity.y=p.y;c.path.shift();city.recordTraffic(p);}
        v.x=c.entity.x;v.y=c.entity.y;v.altitude=surfaceElevation(city.world,v.x,v.y);v.entity.x=v.x;v.entity.y=v.y;
        v.status=road?`Usando ${VEHICLE_SPECS[v.good].label.toLowerCase()}`:'Levando equipamento fora da rua';c.action=v.status;
        if(v.condition<=15){this.releaseTrip(c);break;}
      }
      if(!c.path.length)this.releaseTrip(c);
    }
  }
  removeCitizen(c,heir){
    this.releaseTrip(c);
    for(const v of this.units.values())if(v.ownerAccountId===c.accountId){v.ownershipHistory??=[];v.ownershipHistory.push({minute:this.city.minute,from:c.accountId,to:heir?.accountId||'treasury',price:0,reason:'Herança'});v.ownerAccountId=heir?.accountId||'treasury';}
    for(const [g,n]of Object.entries(c.mechanicJob?.parts||{}))this.city.economy.lost[g]+=n;c.mechanicJob=null;
  }
  garageWork(b,c){
    const city=this.city;
    if(!c.mechanicJob){
      const v=[...this.units.values()].filter(v=>v.active&&!v.scrapped&&v.condition<75&&!v.mechanicId&&!v.driverId).sort((a,b)=>a.condition-b.condition)[0];
      if(!v||b.inventory.pecas<1)return false;
      const path=city.findPath(c.entity,v);if(path===null)return false;
      const price=Math.ceil((city.economy.goods.pecas.price+city.currency.price(city.politics.policy.minimumWage*48))*1.35*(v.ownerAccountId==='treasury'?1.5:1));
      if(!city.transfer(v.ownerAccountId,b.accountId,price,'Serviço: reparo de bicicleta ou patins',{vehicleId:v.id,buildingId:b.id}))return false;
      b.inventory.pecas--;c.mechanicJob={vehicleId:v.id,garageId:b.id,parts:{pecas:1},labor:0};v.mechanicId=c.id;c.path=path;c.indoorLocation=null;return true;
    }
    const job=c.mechanicJob,v=this.units.get(job.vehicleId);if(!v||v.scrapped){for(const [g,n]of Object.entries(job.parts))city.economy.lost[g]+=n;c.mechanicJob=null;return false;}
    if(Math.hypot(c.entity.x-v.x,c.entity.y-v.y)>2){c.path=city.findPath(c.entity,v)||[];return true;}
    job.labor+=1+(c.skills.maintenance||0)/80;if(job.labor<24)return true;
    for(const [g,n]of Object.entries(job.parts)){city.economy.consumed[g]+=n;city.economy.recordGoods('cycle-repair',g,n,b.id,v.id);}v.condition=100;v.mechanicId=null;c.mechanicJob=null;this.stats.repairs++;return true;
  }
  goodsStock(good){return [...this.units.values()].reduce((n,v)=>n+(v.active&&!v.scrapped&&v.good===good?1:0),0)+this.city.citizens.reduce((n,c)=>n+(c.mechanicJob?.parts[good]||0),0);}
}
