import {injuredCarryCapacity,injuryMovementFactor,injuryWorkFactor} from './city_injury_effects.js';
import {COLOR_PALETTE,colorAffinity,dislikesColor} from './city_colors.js';
import {INITIAL_CYCLE_STAGES} from './city_cycle_startup.js';
import {inventoryFree} from './city_inventory.js';
import {surfaceElevation,tileAt,ROAD_TILES,roadTravelCost,canStep,wearRoad,ROAD_RULES} from './city_terrain.js?v=deep-perf-3';

export const VEHICLE_SPECS=Object.freeze({
  bicicleta:{label:'Bicicleta',speed:8,seats:2,cargo:36},
  bicicleta_carga:{label:'Bicicleta de carga',speed:6.5,seats:2,cargo:96},
  patinete:{label:'Patinete',speed:7,seats:1,cargo:24},
  patins:{label:'Patins',speed:6,seats:1,cargo:24},
  skate:{label:'Skate',speed:6.5,seats:1,cargo:24},
});
export const MAX_CARGO_CAPACITY=Math.max(72,...Object.values(VEHICLE_SPECS).map(spec=>spec.cargo));
const PERSONAL_MOBILITY=new Set(Object.keys(VEHICLE_SPECS));
export const VEHICLE_RECIPES=Object.freeze({
  bicicleta:{quadro:1,rodas:2,corrente:1,selim:1,rolamentos:2},
  bicicleta_carga:{quadro:2,rodas:3,corrente:1,selim:1,plataforma:1,rolamentos:3},
  patinete:{quadro:1,plataforma:1,rodas:2,rolamentos:2},
  patins:{botas:1,rodas:8,rolamentos:4},
  skate:{plataforma:1,rodas:4,rolamentos:2},
});
const parts=new Set([...Object.values(VEHICLE_RECIPES).flatMap(r=>Object.keys(r)),'pecas']);
const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};

/** Human-powered mobility, component provenance, real trips and repairs. */
export class CityVehicles {
  constructor(city){this.city=city;this.units=new Map();this.models=new Map();this.batches=[];this.lines=[];this.nextId=1;this.nextModelId=1;this.nextBatchId=1;this.lastHour=null;this.activeCount=0;this.stats={distance:0,passengers:0,fares:0,repairs:0};}
  groundPath(start,goal){return this.city.findPath(start,goal,{allowSkybridges:false});}
  equipInitialWorkers(){
    if(this.initialWorkersEquipped)return;
    this.initialWorkersEquipped=true;const city=this.city,seen=new Set();
    for(const b of city.buildings.filter(b=>b.active&&['builder','carrier','townhall'].includes(b.type))){
      const good=b.type==='townhall'?'bicicleta':'bicicleta_carga',signature=`initial-equipment:${good}`;
      let model=this.models.get(signature);
      for(const id of b.workers){
        const c=city.society.citizen(id);if(!c||c.entity.destroyed||c.jobId!==b.id||seen.has(id))continue;seen.add(id);
        if(!model){model={id:this.nextModelId++,signature,kind:good,manufacturerId:null,brand:'Equipamento inicial',name:VEHICLE_SPECS[good].label,components:[],initial:true,createdAt:city.minute};this.models.set(signature,model);}
        const vehicleId=this.nextId;this.registerUnits(b,good,1,model.id);const v=this.units.get(vehicleId);
        this.activate(v,c.accountId,b);v.initial=true;v.manufacturerId=null;v.initialEmployerId=b.id;this.freeParking(v);
        v.x=v.entity.x=c.entity.x;v.y=v.entity.y=c.entity.y;v.altitude=surfaceElevation(city.world,v.x,v.y);
        this.parkNearby(v,c.entity);
        v.ownershipHistory=[{minute:city.minute,from:'initial-equipment',fromName:'Patrimônio inicial',to:c.accountId,toName:c.entity.properties.name,price:0,reason:`Equipamento inicial de trabalho: ${b.entity.properties.name}`}];
        city.economy.initialStock[good]++;
        city.history.record('ownership',`${c.entity.properties.name} começou com ${VEHICLE_SPECS[good].label.toLowerCase()} para trabalhar em ${b.entity.properties.name}.`,[c.accountId,b.accountId],{vehicleId:v.id,buildingId:b.id,good,initial:true});
      }
    }
  }
  parkingSites(){
    return this.city.buildings.filter(b=>b.type==='bike_rack'&&b.active&&!b.entity.destroyed).map(b=>{
      b.bikeSlots??=Array.from({length:b.width*b.depth*2},(_,index)=>({index,x:b.entity.x+Math.floor(index/2)%b.width+(index%2?.75:.25),y:b.entity.y+Math.floor(index/(b.width*2))+.5,vehicleId:null,reservedBy:null}));return b;
    });
  }
  parkingReport(){
    const sites=this.parkingSites(),vehicles=[...this.units.values()].filter(v=>v.active&&!v.scrapped&&PERSONAL_MOBILITY.has(v.good)),required=Math.max(2,Math.ceil(vehicles.length/12));
    return {sites,required,missing:Math.max(0,required-sites.length),capacity:sites.reduce((n,b)=>n+b.bikeSlots.length,0),occupied:sites.reduce((n,b)=>n+b.bikeSlots.filter(s=>s.vehicleId!=null).length,0),reserved:sites.reduce((n,b)=>n+b.bikeSlots.filter(s=>s.reservedBy!=null).length,0),outside:vehicles.filter(v=>!v.driverId&&(!v.parking||v.parking.kind==='roadside')).length};
  }
  reserveParking(v,goal,maxDistance=12){
    if(!PERSONAL_MOBILITY.has(v.good))return null;
    const choices=this.parkingSites().filter(b=>Math.hypot(b.door.x-goal.x,b.door.y-goal.y)<=maxDistance).sort((a,b)=>Math.hypot(a.door.x-goal.x,a.door.y-goal.y)-Math.hypot(b.door.x-goal.x,b.door.y-goal.y));
    for(const b of choices)for(const slot of b.bikeSlots){if(slot.vehicleId!=null||slot.reservedBy!=null)continue;if(!this.city.walkable(Math.floor(slot.x),Math.floor(slot.y))||this.groundPath(slot,goal)===null)continue;slot.reservedBy=v.id;return {rackId:b.id,index:slot.index,x:slot.x,y:slot.y};}return null;
  }
  roadsideParking(v,goal,maxDistance=8){
    if(!PERSONAL_MOBILITY.has(v.good))return null;
    const city=this.city,candidates=[],occupied=new Set();
    for(const other of this.units.values())if(other.id!==v.id&&!other.scrapped)for(const p of [other.parking,other.reservedParking])if(p)occupied.add(`${Math.floor(p.x)},${Math.floor(p.y)}`);
    for(let dy=-maxDistance;dy<=maxDistance;dy++)for(let dx=-maxDistance;dx<=maxDistance;dx++){
      const x=Math.floor(goal.x)+dx,y=Math.floor(goal.y)+dy;
      if(!city.walkable(x,y)||ROAD_TILES.has(tileAt(city.world,x,y)))continue;
      const neighbor=[[1,0],[-1,0],[0,1],[0,-1]].find(([sx,sy])=>ROAD_TILES.has(tileAt(city.world,x+sx,y+sy))&&canStep(city.world,x,y,x+sx,y+sy));
      if(!neighbor||occupied.has(`${x},${y}`))continue;
      if(city.buildings.some(b=>!b.entity.destroyed&&x>=b.entity.x&&x<b.entity.x+b.width&&y>=b.entity.y&&y<b.entity.y+b.depth))continue;
      const spot={kind:'roadside',x:x+.5,y:y+.5,angle:neighbor[0]?0:Math.PI/2};
      candidates.push(spot);
    }
    candidates.sort((a,b)=>Math.hypot(a.x-goal.x,a.y-goal.y)-Math.hypot(b.x-goal.x,b.y-goal.y));
    return candidates.find(spot=>this.groundPath(spot,goal)!==null)||null;
  }
  destinationParking(v,goal){return this.reserveParking(v,goal)||this.roadsideParking(v,goal);}
  freeParking(v,reservation=false){
    const point=reservation?v.reservedParking:v.parking,b=point&&this.city.building(point.rackId),slot=b?.bikeSlots?.[point.index];
    if(slot){if(reservation&&slot.reservedBy===v.id)slot.reservedBy=null;if(!reservation&&slot.vehicleId===v.id)slot.vehicleId=null;}
    if(reservation)v.reservedParking=null;else v.parking=null;
  }
  parkNearby(v,goal){
    const spot=this.destinationParking(v,goal);if(!spot)return false;v.reservedParking=spot;return this.occupyParking(v,spot);
  }
  occupyParking(v,spot){
    if(spot.kind==='roadside'){
      this.freeParking(v);v.parking={...spot};v.reservedParking=null;
      v.x=v.entity.x=spot.x;v.y=v.entity.y=spot.y;v.angle=spot.angle;v.altitude=surfaceElevation(this.city.world,v.x,v.y);v.status='Estacionado ao lado da rua';return true;
    }
    const b=this.city.building(spot.rackId),slot=b?.bikeSlots?.[spot.index];if(!slot||slot.reservedBy!==v.id||slot.vehicleId!=null)return false;
    this.freeParking(v);slot.vehicleId=v.id;slot.reservedBy=null;v.parking=spot;v.reservedParking=null;v.x=v.entity.x=spot.x;v.y=v.entity.y=spot.y;v.angle=0;v.altitude=surfaceElevation(this.city.world,v.x,v.y);v.status='Estacionado no bicicletário';return true;
  }
  productionStatus(){
    const city=this.city,types=[...INITIAL_CYCLE_STAGES,'safety_equipment','bicycle_rental'];
    return types.filter(type=>city.buildingTypes[type]).map(type=>{const firms=city.economy.businesses.filter(b=>b.type===type&&b.active&&!b.entity.destroyed),projects=city.development.projects.filter(p=>p.type===type&&!p.cancelled&&p.status!=='completed'),spec=city.buildingTypes[type];return{type,label:spec.label,active:firms.length,planned:projects.length,workers:firms.reduce((n,b)=>n+b.workers.length,0),missing:firms.flatMap(b=>{const plan=this.recipeFor(b),inputs=plan?.inputs||spec.inputs||{};return Object.entries(inputs).filter(([good,q])=>(b.inventory[good]||0)<q*(plan?.size||1)).map(([good])=>city.economy.goods[good]?.label||good);}).filter((s,i,a)=>a.indexOf(s)===i),buildingId:firms[0]?.id};});
  }
  recipeFor(b){
    if(b.type==='skate_workshop')return {inputs:VEHICLE_RECIPES.skate,good:'skate',size:1};
    if(b.type!=='cycle_assembler')return null;
    let good=b.vehicleKind;
    if(!good){const units=[...this.units.values()].filter(v=>!v.scrapped),companies=this.city.economy.businesses.filter(b=>b.active&&!b.entity.destroyed),cargoBikeTarget=companies.reduce((n,b)=>n+Math.max(1,Math.ceil(b.workers.length/4)),0),targets={bicicleta:Math.max(2,this.city.citizens.length/30),bicicleta_carga:Math.max(1,cargoBikeTarget),patinete:Math.max(1,this.city.citizens.length/80),patins:Math.max(1,this.city.citizens.length/60)};
      good=Object.keys(targets).sort((a,b)=>units.filter(v=>v.good===a).length/targets[a]-units.filter(v=>v.good===b).length/targets[b])[0];}
    // A new factory should be able to complete its first vehicle from one
    // component set; requiring the default three-unit lot hid production for
    // a long time while every upstream supplier was still ramping up.
    return {inputs:VEHICLE_RECIPES[good],good,size:b.vehicleBatchSize||1};
  }
  configureAssembly(id,kind,size){
    const b=this.city.building(id);if(b?.type==='cycle_assembler'&&kind==='auto'&&!b.vehicleAssembly){b.vehicleKind=null;b.vehicleBatchSize=null;this.city.economy.updateDemand();return true;}if(!b||b.type!=='cycle_assembler'||!['bicicleta','bicicleta_carga','patinete','patins'].includes(kind)||!Number.isInteger(size)||size<1||size>12||b.vehicleAssembly)return this.city.fail('Escolha um lote de 1 a 12 veículos; conclua o lote atual antes de mudar.');
    if(Object.values(VEHICLE_RECIPES[kind]).reduce((n,q)=>n+q,0)*size>b.inventoryCapacity)return this.city.fail('Amplie o armazém ou escolha um lote menor para receber todas as peças.');
    b.vehicleKind=kind;b.vehicleBatchSize=size;b.productionLabor=0;this.city.economy.updateDemand();return true;
  }
  discardComponents(b,good,quantity){let remaining=quantity;const lots=b.componentLots?.[good];if(!lots)return;while(remaining>0&&lots.length){const lot=lots[0],take=Math.min(remaining,lot.quantity);lot.quantity-=take;remaining-=take;if(!lot.quantity)lots.shift();}}
  coherentLots(b,good){const groups=new Map();for(const lot of b.componentLots?.[good]||[]){const id=JSON.stringify([lot.producerId,lot.design]),old=groups.get(id);if(old)old.quantity+=lot.quantity;else groups.set(id,{producerId:lot.producerId,producerName:lot.producerName,design:lot.design,quantity:lot.quantity});}if(!groups.size&&b.inventory[good]>0)groups.set('legacy',{producerId:'origem não identificada',design:1,quantity:b.inventory[good]});return [...groups.values()].sort((a,b)=>b.quantity-a.quantity);}
  revisePart(id){const b=this.city.building(id);if(!b||!Object.keys(this.city.buildingTypes[b.type]?.outputs||{}).some(g=>parts.has(g)))return false;b.partDesign=(b.partDesign||1)+1;return true;}
  produced(b,outputs){for(const [good,quantity]of Object.entries(outputs)){if(parts.has(good)){b.componentLots??={};(b.componentLots[good]??=[]).push({producerId:b.id,producerName:b.entity.properties.name,design:b.partDesign||1,quantity});}if(VEHICLE_SPECS[good])this.registerUnits(b,good,quantity);}}
  loseStock(holder,good,quantity){if(VEHICLE_SPECS[good])for(const v of [...this.units.values()].filter(v=>!v.active&&!v.scrapped&&v.good===good&&v.holderAccountId===holder.accountId).slice(0,quantity)){v.scrapped=true;v.holderAccountId=null;if(v.entity)v.entity.destroyed=true;}if(parts.has(good))this.discardComponents(holder,good,quantity);}
  moveStock(from,to,good,quantity){
    if(parts.has(good)){
      from.componentLots??={};to.componentLots??={};const source=from.componentLots[good]??=[],target=to.componentLots[good]??=[];let remaining=quantity;
      while(remaining>0&&source.length){const lot=source[0],take=Math.min(remaining,lot.quantity);target.push({...lot,quantity:take});lot.quantity-=take;remaining-=take;if(!lot.quantity)source.shift();}
      if(remaining)target.push({producerId:from.entity?.id??from.id,design:from.partDesign||1,quantity:remaining});
    }
    if(VEHICLE_SPECS[good])for(const v of [...this.units.values()].filter(v=>!v.active&&!v.scrapped&&v.good===good&&v.holderAccountId===from.accountId).slice(0,quantity)){v.holderAccountId=to.accountId;if(to.seller&&to.buyer){if(v.entity)v.entity.destroyed=true;v.status='Em transporte';}else{this.recordOwner(v,to.accountId,from.cost?from.cost/from.quantity:0,'Transferência na cadeia de comercialização');this.placeDisplay(v,to);}}
  }
  takeComponents(b,recipe,quantity){
    const bill=[];b.componentLots??={};
    for(const [good,count]of Object.entries(recipe)){
      let remaining=count*quantity;const lots=b.componentLots[good]??=[],supplier=this.coherentLots(b,good).find(l=>l.quantity>=remaining);
      for(let i=0;i<lots.length&&remaining>0;){const lot=lots[i];if(supplier&&(lot.producerId!==supplier.producerId||lot.design!==supplier.design)){i++;continue;}const take=Math.min(remaining,lot.quantity);bill.push({good,producerId:lot.producerId,producerName:lot.producerName||this.city.building(lot.producerId)?.entity.properties.name,design:lot.design,quantity:take});lot.quantity-=take;remaining-=take;if(!lot.quantity)lots.splice(i,1);else i++;}
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
    const batch=b.vehicleAssembly;batch.labor+=(1+(c.skills.maintenance||0)/80)*injuryWorkFactor(c);c.action=`Montando lote ${batch.id}: ${batch.good}`;
    if(batch.labor<batch.requiredLabor)return true;
    if(inventoryFree(b)<batch.quantity)return false;
    b.inventory[batch.good]+=batch.quantity;city.economy.produced[batch.good]+=batch.quantity;city.economy.recordGoods('vehicle-production',batch.good,batch.quantity,null,b.id);
    this.registerUnits(b,batch.good,batch.quantity,batch.modelId,batch.id);batch.status='completed';batch.completedAt=city.minute;b.vehicleAssembly=null;return true;
  }
  registerUnits(b,good,quantity,modelId=null,batchId=null){
    if(!VEHICLE_SPECS[good])return;
    if(modelId==null){const signature=`${b.id}:${good}:${b.partDesign||1}`,existing=this.models.get(signature);let model=existing;if(!model){model={id:this.nextModelId++,signature,kind:good,manufacturerId:b.id,brand:b.entity.properties.name,name:`${VEHICLE_SPECS[good].label} ${b.partDesign||1}`,components:Object.entries(VEHICLE_RECIPES[good]).map(([good,quantity])=>({good,quantity,producerId:b.id,design:1})),createdAt:this.city.minute};this.models.set(signature,model);}modelId=model.id;}
    for(let i=0;i<quantity;i++){const id=this.nextId++,v={id,good,modelId,batchId,manufacturerId:b.id,holderAccountId:b.accountId,ownerAccountId:b.accountId,active:false,scrapped:false,condition:100,color:COLOR_PALETTE[(b.id+i*7)%COLOR_PALETTE.length].hex,distance:0,passengerIds:[],driverId:null,journey:null};v.createdAt=this.city.minute;v.ownershipHistory=[{minute:this.city.minute,from:null,to:b.accountId,toName:b.entity.properties.name,price:0,reason:'Fabricação'}];this.units.set(id,v);this.placeDisplay(v,b);}
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
    v.entity=this.city.createEntity({x:v.x,y:v.y,properties:{name:`${this.model(v)?.brand} · ${this.model(v)?.name}`,cityVehicle:v,render:{color:0x52879a}}});this.parkNearby(v,building.door);return true;
  }
  recordOwner(v,to,price=0,reason='Transferência de propriedade'){
    const from=v.ownerAccountId;if(from===to)return;
    v.ownershipHistory??=[];v.ownershipHistory.push({minute:this.city.minute,from,to,fromName:this.city.accountName(from),toName:this.city.accountName(to),price,reason});v.ownerAccountId=to;
  }
  transferVehicle(id,to,price=0){
    const v=this.units.get(id),city=this.city;if(!v?.active||v.scrapped||v.serviceBodyId||v.possessorAccountId&&v.possessorAccountId!==v.ownerAccountId||v.driverId||v.mechanicId||!city.accounts.has(to)||!Number.isSafeInteger(price)||price<0)return city.fail('Equipamento, comprador ou valor indisponível.');
    if(to===v.ownerAccountId)return false;if(price&&!city.transfer(to,v.ownerAccountId,price,'Compra de bicicleta ou patinete usado',{vehicleId:id}))return false;
    this.recordOwner(v,to,price,price?'Venda de equipamento usado':'Transferência de equipamento');city.history.record('ownership',`Novo proprietário de ${VEHICLE_SPECS[v.good].label} #${id}: ${city.accountName(to)}.`,[to],{vehicleId:id,amount:price});return true;
  }
  vehiclePrice(v){return Math.ceil(this.city.economy.goods[v.good].price*1.18);}
  buyVehicle(account,id){
    const city=this.city,v=this.units.get(id),dealer=v&&city.buildings.find(b=>b.accountId===v.holderAccountId&&b.type==='cycle_shop'&&b.active&&!b.entity.destroyed);
    if(!v||v.active||v.scrapped||!dealer||dealer.inventory[v.good]<1||!city.accounts.has(account))return false;
    const price=this.vehiclePrice(v);if(!city.transfer(account,dealer.accountId,price,'Compra de mobilidade individual',{vehicleId:id,modelId:v.modelId,buildingId:dealer.id}))return false;
    this.recordOwner(v,account,price,'Compra na loja');dealer.totalRevenue+=price;dealer.inventory[v.good]--;this.activate(v,account,dealer);return true;
  }
  mountFlag(id,partyId){
    const city=this.city,v=this.units.get(id),party=city.politics.party(partyId),owner=v&&city.accounts.get(v.ownerAccountId);
    if(!v?.active||v.scrapped||v.mountedFlag||!['bicicleta','bicicleta_carga','patinete'].includes(v.good)||!party?.active||!owner)return false;
    const own=owner.entity?.properties.citizen?owner.campaignInventory:owner.inventory;
    if((own?.bandeiras||0)>0)own.bandeiras--;
    else {const seller=city.economy.businesses.find(b=>b.active&&!b.entity.destroyed&&b.inventory.bandeiras>0);if(!seller||!city.transfer(v.ownerAccountId,seller.accountId,city.economy.goods.bandeiras.price,'Compra de bandeira para veículo',{vehicleId:id,partyId}))return city.fail('É necessário possuir uma bandeira ou encontrar uma à venda.');seller.inventory.bandeiras--;city.economy.recordGoods('vehicle-flag','bandeiras',1,seller.id,v.id);}
    v.mountedFlag={partyId:party.id,partyName:party.name,flag:party.flag,mountedAt:city.minute};return true;
  }
  removeFlag(id){const v=this.units.get(id);if(!v?.mountedFlag)return false;const owner=this.city.accounts.get(v.ownerAccountId);if(owner?.entity?.properties.citizen){owner.campaignInventory??={};owner.campaignInventory.bandeiras=(owner.campaignInventory.bandeiras||0)+1;}else if(owner?.inventory)owner.inventory.bandeiras=(owner.inventory.bandeiras||0)+1;else this.city.economy.lost.bandeiras++;v.mountedFlag=null;return true;}
  accessAccount(v){return v.possessorAccountId||v.ownerAccountId;}
  cargoCapacity(c){
    const base=c.equipment?.carrinho?72:c.equipment?.cesta?36:24;if(!this.activeCount)return injuredCarryCapacity(c,base);
    const owners=new Set([c.accountId,this.city.building(c.jobId)?.accountId]);
    for(const id of c.businessIds||[])owners.add(this.city.building(id)?.accountId);
    let capacity=base;
    for(const v of this.units.values())if(v.active&&!v.scrapped&&v.condition>15&&!v.mechanicId&&owners.has(this.accessAccount(v))&&(!v.driverId||v.driverId===c.id)){capacity=Math.max(capacity,VEHICLE_SPECS[v.good].cargo);if(capacity>=MAX_CARGO_CAPACITY)break;}
    return injuredCarryCapacity(c,capacity);
  }
  hourly(){
    const city=this.city,hour=Math.floor(city.minute/60);if(this.lastHour===hour)return;this.lastHour=hour;
    const parking=this.parkingReport();if(parking.missing>0&&this.lastParkingPlanDay!==city.day&&!city.development.projects.some(p=>p.type==='bike_rack'&&!p.cancelled&&p.status!=='completed')){this.lastParkingPlanDay=city.day;if(city.welfare.conditions().foodDays>=1){city.politics.fundInitialWorksBudget();city.politics.startPublicWork('bike_rack');}}
    const units=[...this.units.values()],unsold=units.filter(v=>!v.active&&!v.scrapped&&city.buildings.some(b=>b.type==='cycle_shop'&&b.active&&b.accountId===v.holderAccountId)),ownedBy=account=>units.filter(v=>v.active&&!v.scrapped&&v.ownerAccountId===account),owners=new Set(units.filter(v=>v.active&&!v.scrapped).map(v=>v.ownerAccountId));
    for(const company of [...city.economy.businesses,...city.buildings.filter(b=>['iml','crematorium'].includes(b.type)&&b.active&&!b.entity.destroyed)].filter(b=>b.active&&!b.entity.destroyed).sort((a,b)=>b.workers.length-a.workers.length||a.id-b.id)){
      const target=Math.max(1,Math.ceil(Math.max(1,company.workers.length)/4));let fleet=ownedBy(company.accountId).filter(v=>v.good==='bicicleta_carga').length;
      while(fleet<target){const v=unsold.find(v=>!v.active&&v.good==='bicicleta_carga');if(!v)break;const dealer=city.building(v.holderAccountId);let acquired=false;
        if(dealer?.accountId===company.accountId&&dealer.type==='cycle_shop'&&dealer.inventory[v.good]>0){dealer.inventory[v.good]--;this.activate(v,company.accountId,dealer);city.history.record('ownership',`${dealer.entity.properties.name} destinou uma bicicleta de carga à equipe.`,[company.accountId],{vehicleId:v.id,good:v.good,companyFleet:true});acquired=true;}
        else acquired=this.financeVehicle(company,v)&&this.buyVehicle(company.accountId,v.id);
        if(!acquired)break;fleet++;owners.add(company.accountId);
      }
      if(company.type==='bicycle_rental'){
        const targetRental=Math.max(1,Math.ceil(city.citizens.length/400));let rentals=ownedBy(company.accountId).filter(v=>v.good==='bicicleta').length;
        while(rentals<targetRental){const v=unsold.find(v=>!v.active&&v.good==='bicicleta');if(!v||!this.financeVehicle(company,v)||!this.buyVehicle(company.accountId,v.id))break;rentals++;}
      }
    }
    const buyers=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)&&!owners.has(c.accountId)&&c.mobilityNeed>=12).sort((a,b)=>(b.mobilityNeed*(b.mobilityPriority||1)-a.mobilityNeed*(a.mobilityPriority||1))||b.balance-a.balance||a.id-b.id).slice(0,6);
    for(const c of buyers){
      const offered=unsold.filter(v=>!v.active&&v.good!=='bicicleta_carga'&&!dislikesColor(c,v.color)&&this.vehiclePrice(v)+city.currency.price(2500)<c.balance).sort((a,b)=>Number(b.good===['bicicleta','patins','skate','patinete'][c.id%4])-Number(a.good===['bicicleta','patins','skate','patinete'][c.id%4])||this.vehiclePrice(a)*(1-.3*colorAffinity(c,a.color))-this.vehiclePrice(b)*(1-.3*colorAffinity(c,b.color)));
      if(offered[0]&&this.buyVehicle(c.accountId,offered[0].id)){owners.add(c.accountId);c.mobilityNeed*=.22;}
    }
  }
  startServiceTrip(c,v,goal){
    if(!v?.active||v.scrapped||v.serviceBodyId&&v.serviceBodyId!==c.funeralBodyId||v.driverId||v.mechanicId||v.paintJobId||v.condition<=15||c.indoorLocation||c.mobilityTrip||c.ridingVehicleId)return false;
    const path=this.groundPath(c.entity,v);if(path===null||this.groundPath(v,goal)===null)return false;
    v.reservedParking=this.destinationParking(v,goal);v.driverId=c.id;c.mobilityTrip={kind:'cycle',vehicleId:v.id,goal:{...goal},stage:'boarding'};c.path=path;v.status='Funcionário a caminho para serviço';return true;
  }
  tryTrip(c){
    if(c.mobilityWalkGoal){const last=c.path.at(-1);if(last&&Math.floor(last.x)===Math.floor(c.mobilityWalkGoal.x)&&Math.floor(last.y)===Math.floor(c.mobilityWalkGoal.y))return;c.mobilityWalkGoal=null;}
    if(c.funeralBodyId)return;
    if(!this.activeCount||c.skybridgeTransit||c.skybridgeZ||c.mobilityTrip||c.ridingVehicleId||c.path.length<3||!this.city.society.isAdult(c)||c.conversation||c.workMeal||this.city.minute-(c.lastVehicleSearchAt??-Infinity)<20)return;
    c.lastVehicleSearchAt=this.city.minute;const city=this.city,goal=c.path.at(-1);
    if(!c.path.some(p=>ROAD_TILES.has(tileAt(city.world,Math.floor(p.x),Math.floor(p.y)))))return;
    const owners=new Set([c.accountId,city.building(c.jobId)?.accountId,...c.businessIds.map(id=>city.building(id)?.accountId)]),load=c.deliveryId?city.logistics.shipments.find(s=>s.id===c.deliveryId):null;
    const candidates=[...this.units.values()].filter(v=>v.active&&!v.scrapped&&!v.driverId&&!v.mechanicId&&!v.paintJobId&&!v.serviceBodyId&&v.condition>15&&(owners.has(this.accessAccount(v))||!v.possessorAccountId&&city.buildings.some(b=>b.type==='bicycle_rental'&&b.active&&b.workers.length&&b.accountId===v.ownerAccountId&&Math.hypot(v.x-c.entity.x,v.y-c.entity.y)<4))&&(!load||VEHICLE_SPECS[v.good].cargo>=load.quantity));
    candidates.sort((a,b)=>Math.hypot(a.x-c.entity.x,a.y-c.entity.y)-Math.hypot(b.x-c.entity.x,b.y-c.entity.y));
    for(const v of candidates){
      const path=this.groundPath(c.entity,v);if(path===null||path.length>Math.max(4,c.path.length/2))continue;
      const parking=this.destinationParking(v,goal);
      const rental=!owners.has(this.accessAccount(v));if(rental&&!city.transfer(c.accountId,v.ownerAccountId,city.currency.price(50),'Serviço: aluguel de bicicleta',{vehicleId:v.id})){v.reservedParking=parking;this.freeParking(v,true);continue;}
      if(rental)this.stats.fares+=city.currency.price(50);
      v.reservedParking=parking;v.driverId=c.id;c.mobilityTrip={kind:'cycle',vehicleId:v.id,goal,stage:'boarding'};c.path=path;c.indoorLocation=null;v.status='Usuário a caminho';return true;
    }
  }
  tryCarpool(v,driver){
    v.passengerIds??=[];
    if(!['bicicleta','bicicleta_carga'].includes(v.good)||v.passengerIds.length>=VEHICLE_SPECS[v.good].seats-1||driver.mobilityTrip?.stage!=='riding')return false;
    const goal=driver.mobilityTrip.goal;if(!goal)return false;const city=this.city;
    for(const passenger of city.citizens){
      if(passenger===driver||passenger.entity.destroyed||passenger.indoorLocation||passenger.skybridgeTransit||passenger.skybridgeZ||passenger.mobilityTrip||passenger.ridingVehicleId||passenger.conversation||passenger.workMeal||passenger.deliveryId||passenger.path.length===0||city.minute-(passenger.lastCarpoolAt??-Infinity)<240||['council-session','research','interview','vote','campaign','construction','clean','transport','caregiving'].includes(passenger.task))continue;
      const passengerGoal=passenger.path.at(-1);if(!passengerGoal||Math.hypot(passengerGoal.x-goal.x,passengerGoal.y-goal.y)>3)continue;
      if(Math.hypot(passenger.entity.x-v.x,passenger.entity.y-v.y)>2)continue;
      const relation=city.relationships.view(driver,passenger),reverse=city.relationships.view(passenger,driver);
      if(relation&&(relation.affection<0||relation.resentment>=30)||reverse&&(reverse.affection<0||reverse.resentment>=30))continue;
      const trip={kind:'cycle',vehicleId:v.id,goal:{...passengerGoal},stage:'passenger'};
      passenger.carpoolResume={task:passenger.task,targetId:passenger.targetId,mobilityWalkGoal:passenger.mobilityWalkGoal?{...passenger.mobilityWalkGoal}:null};
      passenger.mobilityTrip=trip;passenger.ridingVehicleId=v.id;passenger.ridingVehicleKind=v.good;passenger.ridingAsPassenger=true;passenger.path=[];v.passengerIds.push(passenger.id);
      passenger.lastCarpoolAt=city.minute;
      city.relationships.view(driver,passenger,true);
      city.relationships.shift(driver,passenger,{affection:30,trust:18,respect:2});city.relationships.shift(passenger,driver,{affection:30,trust:18,respect:2});city.relationships.updateBond(driver,passenger,city.society.getRelation(driver,passenger));
      city.relationships.fact('ride-share',driver,passenger,`${driver.entity.properties.name} ofereceu carona de bicicleta a ${passenger.entity.properties.name}.`,{witnessIds:[]});
      passenger.mood=Math.min(25,(passenger.mood||0)+2);driver.mood=Math.min(25,(driver.mood||0)+1);
      return true;
    }
    return false;
  }
  detachPassenger(c,v,continueOnFoot=true){
    // The vehicle route is walkable; a visual seat offset can fall inside walls.
    if(v){v.passengerIds=(v.passengerIds||[]).filter(id=>id!==c.id);c.entity.x=v.x;c.entity.y=v.y;}
    const goal=c.mobilityTrip?.goal,resume=c.carpoolResume||{};
    c.ridingVehicleId=null;c.ridingVehicleKind=null;c.ridingAsPassenger=false;c.mobilityTrip=null;c.carpoolResume=null;
    c.task=resume.task??c.task;c.targetId=resume.targetId??c.targetId;
    if(continueOnFoot&&goal){c.path=this.groundPath(c.entity,goal)||[];c.mobilityWalkGoal=c.path.length?{...goal}:null;}
  }
  releaseTrip(c,arrived=false){
    if(c.ridingAsPassenger){this.detachPassenger(c,this.units.get(c.ridingVehicleId),true);return;}
    const trip=c.mobilityTrip,v=this.units.get(c.ridingVehicleId||trip?.vehicleId);
    if(v){
      for(const id of [...(v.passengerIds||[])]){const passenger=this.city.society.citizen(id);if(passenger)this.detachPassenger(passenger,v,true);}
      const parked=arrived&&v.reservedParking&&Math.hypot(v.x-v.reservedParking.x,v.y-v.reservedParking.y)<1&&this.occupyParking(v,v.reservedParking);
      this.freeParking(v,true);v.driverId=null;v.journey=null;v.passengerIds=[];
      if(!parked)v.status=v.parking?.kind==='roadside'?'Estacionado ao lado da rua':v.parking?'Estacionado no bicicletário':'Estacionado fora do bicicletário';
      if(arrived){v.parkingHistory??=[];v.parkingHistory.push({minute:this.city.minute,rackId:v.parking?.rackId??null,rackName:v.parking?.kind==='roadside'?'Ao lado da rua':v.parking?this.city.building(v.parking.rackId)?.entity.properties.name:null,x:v.x,y:v.y,citizenId:c.id});if(v.parkingHistory.length>40)v.parkingHistory.shift();}
    }
    c.ridingVehicleId=null;c.ridingVehicleKind=null;c.mobilityTrip=null;
    if(arrived&&trip?.goal){c.path=this.groundPath(c.entity,trip.goal)||[];c.mobilityWalkGoal=c.path.length?{...trip.goal}:null;}
  }
  minute(){
    this.hourly();
    for(const v of this.units.values()){if(v.parking&&v.parking.kind!=='roadside'&&!this.city.building(v.parking.rackId)){v.parking=null;v.status='Bicicletário removido';}if(v.reservedParking&&!v.driverId)this.freeParking(v,true);}
    for(const c of this.city.citizens){
      if(c.mobilityWalkGoal&&!c.path.length)c.mobilityWalkGoal=null;
      if(c.mobilityTrip&&(c.entity.destroyed||!this.units.has(c.mobilityTrip.vehicleId))){this.releaseTrip(c);continue;}
      if(c.mechanicJob){const b=this.city.building(c.mechanicJob.garageId);if(!b?.active||b.entity.destroyed||c.jobId!==b.id&&c.id!==b.ownerId){const v=this.units.get(c.mechanicJob.vehicleId);if(v)v.mechanicId=null;for(const [g,n]of Object.entries(c.mechanicJob.parts))this.city.economy.lost[g]+=n;c.mechanicJob=null;}}
    }
  }
  update(dt){
    if(!this.activeCount)return;const city=this.city;
    for(const v of this.units.values()){
      if(!v.active||v.scrapped||!v.driverId)continue;
      v.passengerIds??=[];
      const c=city.society.citizen(v.driverId);if(!c||c.entity.destroyed){for(const id of [...(v.passengerIds||[])]){const passenger=city.society.citizen(id);if(passenger)this.detachPassenger(passenger,v,false);}v.driverId=null;continue;}
      if(c.mobilityTrip?.stage==='boarding'){
        if(c.path.length)continue;
        if(Math.hypot(c.entity.x-v.x,c.entity.y-v.y)>2){this.releaseTrip(c);continue;}
        if(!v.reservedParking)v.reservedParking=this.destinationParking(v,c.mobilityTrip.goal);
        const path=this.groundPath(v,v.reservedParking||c.mobilityTrip.goal);if(path===null){this.releaseTrip(c);c.task=null;continue;}
        this.freeParking(v);c.entity.x=v.x;c.entity.y=v.y;c.path=path;c.ridingVehicleId=v.id;c.ridingVehicleKind=v.good;c.mobilityTrip.stage='riding';v.journey={};this.stats.passengers++;
      }
      if(c.ridingVehicleId!==v.id)continue;
      let elapsed=Math.max(0,dt),blocked=false;
      while(elapsed>0&&c.path.length){
        const p=c.path[0],tx=Math.floor(p.x),ty=Math.floor(p.y),sx=Math.floor(c.entity.x),sy=Math.floor(c.entity.y);
        if(!city.walkable(tx,ty)||!canStep(city.world,sx,sy,tx,ty)){c.path=[];c.task=null;blocked=true;break;}
        const tile=tileAt(city.world,tx,ty),road=ROAD_TILES.has(tile),speed=(road?VEHICLE_SPECS[v.good].speed:4)*injuryMovementFactor(c)*injuryWorkFactor(c)/roadTravelCost(tile),dx=p.x-c.entity.x,dy=p.y-c.entity.y,len=Math.hypot(dx,dy),travel=Math.min(len,elapsed*speed);
        if(len>0){c.entity.x+=dx/len*travel;c.entity.y+=dy/len*travel;v.angle=Math.atan2(dx,dy);}
        elapsed-=travel/speed;v.distance+=travel;this.stats.distance+=travel;v.condition=Math.max(0,v.condition-travel*(road?.012:.004));
        wearRoad(city.world,tx,ty,travel*ROAD_RULES.wearPerCell);
        if(len<=travel+.0001){c.entity.x=p.x;c.entity.y=p.y;c.path.shift();city.recordTraffic(p);}
        v.x=c.entity.x;v.y=c.entity.y;v.altitude=surfaceElevation(city.world,v.x,v.y);v.entity.x=v.x;v.entity.y=v.y;
        v.carpoolScanDistance=(v.carpoolScanDistance||0)+travel;
        if(v.carpoolScanDistance>=.75){v.carpoolScanDistance%=.75;this.tryCarpool(v,c);}
         for(let i=v.passengerIds.length-1;i>=0;i--){const passenger=city.society.citizen(v.passengerIds[i]);if(!passenger||passenger.entity.destroyed){v.passengerIds.splice(i,1);continue;}passenger.entity.x=v.x;passenger.entity.y=v.y;const goal=passenger.mobilityTrip?.goal;if(goal&&Math.hypot(goal.x-v.x,goal.y-v.y)<=.8)this.detachPassenger(passenger,v,true);}
        v.status=road?`Usando ${VEHICLE_SPECS[v.good].label.toLowerCase()}`:'Levando equipamento fora da rua';c.action=v.status;
        if(v.condition<=15){this.releaseTrip(c);break;}
      }
      if(!c.path.length)this.releaseTrip(c,!blocked);
    }
  }
  removeCitizen(c,heir){
    this.releaseTrip(c);
    for(const v of this.units.values())if(v.ownerAccountId===c.accountId)this.recordOwner(v,heir?.accountId||'treasury',0,'Herança');
    for(const [g,n]of Object.entries(c.mechanicJob?.parts||{}))this.city.economy.lost[g]+=n;c.mechanicJob=null;
  }
  garageWork(b,c){
    const city=this.city;
    if(!c.mechanicJob){
      const v=[...this.units.values()].filter(v=>v.active&&!v.scrapped&&(!v.possessorAccountId||v.possessorAccountId===v.ownerAccountId)&&v.condition<75&&!v.serviceBodyId&&!v.paintJobId&&!v.mechanicId&&!v.driverId).sort((a,b)=>a.condition-b.condition)[0];
      if(!v||b.inventory.pecas<1)return false;
      const path=this.groundPath(c.entity,v);if(path===null)return false;
      const price=Math.ceil((city.economy.goods.pecas.price+city.currency.price(city.politics.policy.minimumWage*48))*1.35*(v.ownerAccountId==='treasury'?1.5:1));
      if(!city.transfer(v.ownerAccountId,b.accountId,price,'Serviço: reparo de bicicleta ou patins',{vehicleId:v.id,buildingId:b.id}))return false;
      const origin=b.componentLots?.pecas?.[0];this.discardComponents(b,'pecas',1);b.inventory.pecas--;c.mechanicJob={vehicleId:v.id,garageId:b.id,parts:{pecas:1},components:[{good:'pecas',quantity:1,producerId:origin?.producerId??'origem não identificada',producerName:origin?.producerName,design:origin?.design??1}],price,startedAt:city.minute,labor:0};v.mechanicId=c.id;c.path=path;c.indoorLocation=null;return true;
    }
    const job=c.mechanicJob,v=this.units.get(job.vehicleId);if(!v||v.scrapped){for(const [g,n]of Object.entries(job.parts))city.economy.lost[g]+=n;c.mechanicJob=null;return false;}
    if(Math.hypot(c.entity.x-v.x,c.entity.y-v.y)>.25){c.path=this.groundPath(c.entity,v)||[];if(!c.path.length)c.path=[{x:v.x,y:v.y}];return true;}
    job.labor+=(1+(c.skills.maintenance||0)/80)*injuryWorkFactor(c);if(job.labor<24)return true;
    for(const [g,n]of Object.entries(job.parts)){city.economy.consumed[g]+=n;city.economy.recordGoods('cycle-repair',g,n,b.id,v.id);}v.condition=100;v.mechanicId=null;(v.maintenanceHistory??=[]).push({minute:city.minute,workshopId:b.id,workshopName:b.entity.properties.name,workerId:c.id,price:job.price,components:job.components||[]});c.mechanicJob=null;this.stats.repairs++;return true;
  }
  goodsStock(good){return (good==='bandeiras'?[...this.units.values()].filter(v=>!v.scrapped&&v.mountedFlag).length:0)+[...this.units.values()].reduce((n,v)=>n+(v.active&&!v.scrapped&&v.good===good?1:0),0)+this.city.citizens.reduce((n,c)=>n+(c.mechanicJob?.parts[good]||0),0);}
}
