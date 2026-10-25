import {CityAirTraffic} from './city_air_traffic.js';
import {inventoryFree,initializeInventory} from './city_inventory.js';
import {surfaceElevation} from './city_terrain.js';

export const VEHICLE_SPECS=Object.freeze({
  carro:{label:'Carro voador',speed:9,seats:4,cargo:36,range:90,tank:6},
  caminhao:{label:'Caminhão voador',speed:6.5,seats:2,cargo:180,range:55,tank:10},
  onibus:{label:'Ônibus aéreo',speed:7,seats:32,cargo:12,range:50,tank:12},
  carruagem:{label:'Carruagem voadora',speed:5,seats:6,cargo:64,range:70,tank:4},
});
export const VEHICLE_RECIPES=Object.freeze({
  carro:{motor:1,chassi:1,carroceria:1,rodas:4,transmissao:1,janelas:2,bancos:2},
  caminhao:{motor:2,chassi:2,carroceria:2,rodas:6,transmissao:2,janelas:2,bancos:2},
  onibus:{motor:2,chassi:3,carroceria:3,rodas:6,transmissao:2,janelas:8,bancos:10},
  carruagem:{tabuas:4,ferro:2,rodas:4,tecido:2,cavalos:1},
});
const parts=new Set(Object.values(VEHICLE_RECIPES).flatMap(r=>Object.keys(r)));
const key=(x,y)=>`${Math.floor(x)},${Math.floor(y)}`;
const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};

/** Vehicles, component provenance, actual trips, fuel deliveries and services. */
export class CityVehicles {
  constructor(city){this.city=city;this.air=new CityAirTraffic(city);this.units=new Map();this.models=new Map();this.batches=[];this.lines=[];this.nextId=1;this.nextModelId=1;this.nextBatchId=1;this.lastHour=null;this.activeCount=0;this.stats={distance:0,passengers:0,fares:0,fuel:0,repairs:0};}
  productionStatus(){
    const city=this.city,types=['iron_mine','coal_mine','steel_mill','aluminum_smelter','sawmill','glassworks','weaving','engine_factory','chassis_factory','bodyworks','tire_factory','transmission_factory','automotive_glass','upholstery','automaker','carriage_builder','dealership','fuel_station'];
    return types.filter(type=>city.buildingTypes[type]).map(type=>{const firms=city.economy.businesses.filter(b=>b.type===type&&b.active&&!b.entity.destroyed),projects=city.development.projects.filter(p=>p.type===type&&!p.cancelled&&p.status!=='completed'),spec=city.buildingTypes[type];return{type,label:spec.label,active:firms.length,planned:projects.length,workers:firms.reduce((n,b)=>n+b.workers.length,0),missing:firms.flatMap(b=>{const plan=this.recipeFor(b),inputs=plan?.inputs||spec.inputs||{};return Object.entries(inputs).filter(([good,q])=>(b.inventory[good]||0)<q*(plan?.size||1)).map(([good])=>city.economy.goods[good]?.label||good);}).filter((s,i,a)=>a.indexOf(s)===i),buildingId:firms[0]?.id};});
  }
  recipeFor(b){
    if(b.type==='carriage_builder')return {inputs:VEHICLE_RECIPES.carruagem,good:'carruagem',size:1};
    if(b.type!=='automaker')return null;
    let good=b.vehicleKind;
    if(!good){const units=[...this.units.values()].filter(v=>!v.scrapped),targets={carro:Math.max(2,this.city.citizens.length/60),caminhao:Math.max(1,this.city.economy.businesses.filter(b=>b.type==='carrier').length*1.5),onibus:Math.max(1,this.city.citizens.length/180)};
      good=Object.keys(targets).sort((a,b)=>units.filter(v=>v.good===a).length/targets[a]-units.filter(v=>v.good===b).length/targets[b])[0];}
    // A new factory should be able to complete its first vehicle from one
    // component set; requiring the default three-unit lot hid production for
    // a long time while every upstream supplier was still ramping up.
    return {inputs:VEHICLE_RECIPES[good],good,size:b.vehicleBatchSize||1};
  }
  configureAssembly(id,kind,size){
    const b=this.city.building(id);if(b?.type==='automaker'&&kind==='auto'&&!b.vehicleAssembly){b.vehicleKind=null;b.vehicleBatchSize=null;this.city.economy.updateDemand();return true;}if(!b||b.type!=='automaker'||!['carro','caminhao','onibus'].includes(kind)||!Number.isInteger(size)||size<1||size>12||b.vehicleAssembly)return this.city.fail('Escolha um lote de 1 a 12 veículos; conclua o lote atual antes de mudar.');
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
    for(let i=0;i<quantity;i++){const id=this.nextId++,v={id,good,modelId,batchId,manufacturerId:b.id,holderAccountId:b.accountId,ownerAccountId:b.accountId,active:false,scrapped:false,condition:100,fuel:0,distance:0,passengerIds:[],driverId:null,journey:null};this.units.set(id,v);this.placeDisplay(v,b);}
  }
  placeDisplay(v,building){
    if(!building?.door)return;
    // Finished vehicles are visible while waiting for sale, so a working
    // factory or dealership has an unmistakable in-world result.
    if(v.entity)v.entity.destroyed=true;
    const siblings=[...this.units.values()].filter(other=>other!==v&&!other.active&&!other.scrapped&&other.holderAccountId===building.accountId).length;
    const x=building.door.x+(siblings%3-1)*1.1,y=building.door.y+Math.floor(siblings/3)*1.1;
    v.entity=this.city.createEntity({x,y,properties:{name:`${this.model(v)?.brand} · ${this.model(v)?.name}`,cityVehicle:v,render:{color:0x52879a}}});
  }
  spec(v){return VEHICLE_SPECS[v.good];}
  landingAnchor(point,maxDistance=10){
    if(!point)return null;
    const city=this.city,cx=Math.floor(point.x),cy=Math.floor(point.y);
    for(let r=0;r<=maxDistance;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
      if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
      const x=cx+dx,y=cy+dy;if(city.walkable(x,y))return {x:x+.5,y:y+.5};
    }return null;
  }
  parkingAt(lane,vehicleId,claim=false){
    const city=this.city,world=city.world,slots=world.parkingTiles??=new Map();
    for(let radius=2;radius<=12;radius++)for(const [dx,dy]of [[radius,0],[-radius,0],[0,radius],[0,-radius]]){
      const x=Math.floor(lane.x)+dx,y=Math.floor(lane.y)+dy,cells=[];let valid=true;
      for(let yy=y;yy<y+2;yy++)for(let xx=x;xx<x+2;xx++){
        const tile=xx>=0&&yy>=0&&xx<world.width&&yy<world.height?world.getTile(xx,yy):5,id=key(xx,yy),slot=slots.get(id);
        if(![0,3,9].includes(tile)||city.occupied.has(id)||slot?.vehicleId!=null&&slot.vehicleId!==vehicleId||city.development.plots.some(p=>(p.buildingId||p.projectId||p.ownerId!=='treasury')&&xx>=p.x&&xx<p.x+p.width&&yy>=p.y&&yy<p.y+p.depth)){valid=false;break;}cells.push(id);
      }
      if(!valid||cells.length!==4)continue;
      const parking={x:x+1,y:y+1,cells};if(claim){world.parkingRevision=(world.parkingRevision||0)+1;for(const id of cells)slots.set(id,{vehicleId});for(const p of city.development.plots)if(!p.buildingId&&!p.projectId&&p.ownerId==='treasury'&&cells.some(id=>{const [xx,yy]=id.split(',').map(Number);return xx>=p.x&&xx<p.x+p.width&&yy>=p.y&&yy<p.y+p.depth;})){p.forSale=false;p.landingReserved=true;}}
      return parking;
    }return null;
  }
  freeParking(parking,vehicleId){for(const id of parking?.cells||[])if(this.city.world.parkingTiles?.get(id)?.vehicleId===vehicleId)this.city.world.parkingTiles.set(id,{vehicleId:null});}
  groundAccess(point){return this.landingAnchor(point,4)||{x:point.x,y:point.y};}
  airPath(from,to){return this.air.path(from,to);}
  model(v){return [...this.models.values()].find(m=>m.id===v.modelId);}
  activate(v,account,building){
    const lane=this.landingAnchor(building.door,10,true);if(!lane)return false;const parking=this.parkingAt(lane,v.id,true);if(!parking)return false;
    v.active=true;this.activeCount++;v.ownerAccountId=account;v.holderAccountId=null;v.x=parking.x;v.y=parking.y;v.altitude=surfaceElevation(this.city.world,parking.x,parking.y);v.flightPhase='parked';
    if(v.entity)v.entity.destroyed=true;
    v.parking=parking;v.entity=this.city.createEntity({x:parking.x,y:parking.y,properties:{name:`${this.model(v)?.brand} · ${this.model(v)?.name}`,cityVehicle:v,render:{color:0x52879a}}});
    const fuelGood='oleo';v.fuelGood=fuelGood;
    v.fuelStore={id:`vehicle-tank:${v.id}`,name:`Tanque do veículo ${v.id}`,type:'vehicle_tank',active:true,balance:0,totalRevenue:0,totalExpenses:0,ownerId:this.city.accounts.get(account)?.entity?.properties.citizen?.id??building.ownerId,accountId:account,door:this.groundAccess(lane)};
    initializeInventory(v.fuelStore,this.city.economy.goods,VEHICLE_SPECS[v.good].tank);return true;
  }
  vehiclePrice(v){return Math.ceil(this.city.economy.goods[v.good].price*1.18);}
  buyVehicle(buyerAccountId,vehicleId){
    const city=this.city,v=this.units.get(vehicleId);if(!v||v.active||v.scrapped)return false;
    const dealer=city.buildings.find(b=>b.accountId===v.holderAccountId&&b.type==='dealership'&&b.active&&!b.entity.destroyed),lane=dealer&&this.landingAnchor(dealer.door,10,true);if(!dealer||dealer.inventory[v.good]<1||!lane||!this.parkingAt(lane,v.id))return false;
    const model=this.model(v),price=this.vehiclePrice(v);
    if(!city.transfer(buyerAccountId,dealer.accountId,price,'Compra de veículo',{vehicleId:v.id,modelId:v.modelId,buildingId:dealer.id}))return false;
    v.ownershipHistory??=[];v.ownershipHistory.push({minute:city.minute,from:dealer.accountId,to:buyerAccountId,price});
    dealer.totalRevenue+=price;const buyer=city.accounts.get(buyerAccountId);if(buyer?.entity?.properties.cityBuilding&&buyerAccountId!=='treasury')buyer.totalExpenses+=price;
    dealer.inventory[v.good]--;this.activate(v,buyerAccountId,dealer);
    city.log(`${city.accountName(buyerAccountId)} adquiriu ${model.brand} ${model.name}.`,'economy',[],{kind:'vehicle-purchased',vehicleId:v.id,modelId:v.modelId,accounts:[buyerAccountId,dealer.accountId],amount:price});return true;
  }
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
  removeCitizen(c,heir){
    if(c.mobilityTrip)this.releaseTrip(c);
    for(const v of this.units.values()){
      v.passengerIds=v.passengerIds.filter(id=>id!==c.id);if(v.driverId===c.id){v.driverId=null;if(v.altitude>surfaceElevation(this.city.world,v.x,v.y)+.15)this.air.land(v,'Piloto indisponível',true);else v.journey=null;}
      if(v.ownerAccountId===c.accountId){v.ownershipHistory??=[];v.ownershipHistory.push({minute:this.city.minute,from:c.accountId,to:heir?.accountId||'treasury',price:0,reason:'Herança'});v.ownerAccountId=heir?.accountId||'treasury';if(v.fuelStore){v.fuelStore.accountId=v.ownerAccountId;v.fuelStore.ownerId=heir?.id??null;}}
      if(v.mechanicId===c.id)v.mechanicId=null;
    }
    for(const [good,n]of Object.entries(c.mechanicJob?.parts||{}))this.city.economy.lost[good]+=n;c.mechanicJob=null;
  }
  cargoCapacity(c){
    const base=c.equipment?.carrinho?72:c.equipment?.cesta?36:24;if(!this.activeCount)return base;
    const owners=new Set([c.accountId,this.city.building(c.jobId)?.accountId,...(c.businessIds||[]).map(id=>this.city.building(id)?.accountId)]);
    return Math.max(base,...[...this.units.values()].filter(v=>v.active&&!v.scrapped&&v.condition>15&&!v.mechanicId&&v.fuel>0&&owners.has(v.ownerAccountId)&&(!v.driverId||v.driverId===c.id)&&v.good!=='onibus').map(v=>VEHICLE_SPECS[v.good].cargo));
  }
  hourly(){
    const city=this.city,hour=Math.floor(city.minute/60);if(this.lastHour===hour)return;this.lastHour=hour;
    const firms=city.economy.businesses,allUnits=[...this.units.values()],activeByOwner=new Map(),activeOwners=new Set(),dealerAccounts=new Set();
    for(const b of city.buildings)if(b.type==='dealership')dealerAccounts.add(b.accountId);
    for(const v of allUnits)if(v.active&&!v.scrapped){activeOwners.add(v.ownerAccountId);activeByOwner.set(v.ownerAccountId,(activeByOwner.get(v.ownerAccountId)||0)+1);}
    const unsoldVehicles=allUnits.filter(v=>!v.active&&!v.scrapped);
    for(const b of firms.filter(b=>['carrier','bus_operator'].includes(b.type))){
      const kind=b.type==='bus_operator'?'onibus':'caminhao';
      if((activeByOwner.get(b.accountId)||0)<Math.max(1,Math.ceil(b.workers.length/3))){const v=unsoldVehicles.find(v=>v.good===kind&&dealerAccounts.has(v.holderAccountId));if(v&&this.financeVehicle(b,v)&&this.buyVehicle(b.accountId,v.id)){activeOwners.add(b.accountId);activeByOwner.set(b.accountId,(activeByOwner.get(b.accountId)||0)+1);}}
    }
    const buyers=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)&&c.balance>city.economy.goods.carro.price+city.currency.price(60000)&&!activeOwners.has(c.accountId));
    for(const c of buyers.slice(0,3)){const candidates=unsoldVehicles.filter(v=>['carro','carruagem'].includes(v.good));candidates.sort((a,b)=>Math.abs((hash(`${c.id}:${a.manufacturerId}`)%100)-70)-Math.abs((hash(`${c.id}:${b.manufacturerId}`)%100)-70));for(const v of candidates)if(this.buyVehicle(c.accountId,v.id)){activeOwners.add(c.accountId);break;}}
    for(const v of allUnits)if(v.active&&!v.scrapped){
      if(!v.journey){v.fuelStore.door=v.parking||this.groundAccess(v);if(v.fuelStore.inventory[v.fuelGood]+(v.fuelStore.incoming[v.fuelGood]||0)<2&&v.fuel<VEHICLE_SPECS[v.good].range){
        const suppliers=firms.filter(b=>b.type==='fuel_station'&&b.inventory.oleo>0).sort((a,b)=>Math.hypot(a.door.x-v.x,a.door.y-v.y)-Math.hypot(b.door.x-v.x,b.door.y-v.y));
        for(const shop of suppliers){if(city.logistics.order(shop,v.fuelStore,v.fuelGood,Math.min(2,shop.inventory[v.fuelGood],inventoryFree(v.fuelStore)),Math.ceil(city.economy.goods[v.fuelGood].price*1.35),{purpose:'vehicle-fuel'}))break;}
      }}
      if(v.good==='onibus'&&!v.lineId){const b=firms.find(b=>b.type==='bus_operator'&&b.accountId===v.ownerAccountId);if(b)this.createLine(b,v);}
    }
  }
  createLine(company,v){
    const stops=[];
    for(const [id]of [...this.city.traffic].sort((a,b)=>b[1]-a[1]).slice(0,96)){const [x,y]=id.split(',').map(Number),lane=this.landingAnchor({x:x+.5,y:y+.5},5);if(!lane||stops.some(s=>Math.hypot(s.x-lane.x,s.y-lane.y)<8))continue;if(stops.length&&!this.airPath(stops.at(-1).landing,lane))continue;let parking=this.parkingAt(lane,v.id);if(!parking||stops.some(s=>Math.hypot(s.x-parking.x,s.y-parking.y)<8))continue;parking=this.parkingAt(lane,v.id,true);stops.push({x:parking.x,y:parking.y,landing:parking,parking});if(stops.length===6)break;}
    if(stops.length<2){for(const stop of stops)this.freeParking(stop.parking,v.id);return;}
    const line={id:this.lines.length+1,companyId:company.id,vehicleId:v.id,stops,current:0,passengers:0,revenue:0,fare:this.city.currency.price(250),status:'waiting-driver'};this.lines.push(line);v.lineId=line.id;
  }
  releaseTrip(c){
    const trip=c.mobilityTrip;if(!trip)return;
    const v=this.units.get(trip.vehicleId);
    if(v&&c.ridingVehicleId&&v.altitude>surfaceElevation(this.city.world,v.x,v.y)+.15){trip.cancelAfterLanding=true;this.air.land(v,'Desembarque solicitado');return false;}
    if(v){v.passengerIds=v.passengerIds.filter(id=>id!==c.id);if(v.driverId===c.id){v.driverId=null;v.journey=null;}}
    if(v&&!v.lineId&&trip.parking&&trip.parking!==v.parking)this.freeParking(trip.parking,v.id);
    if(c.ridingVehicleId&&v&&!c.entity.destroyed){const exit=v.parking||this.groundAccess(v);c.entity.x=exit.x;c.entity.y=exit.y;}
    c.ridingVehicleId=null;c.mobilityTrip=null;
    const goal=trip.goal;c.path=goal?this.city.findPath(c.entity,goal)||[]:[];
    if(!c.path.length&&goal&&Math.hypot(c.entity.x-goal.x,c.entity.y-goal.y)>2)c.task=null;
  }
  tryTrip(c){
    if(!this.activeCount)return;
    const shipment=c.deliveryId?this.city.logistics.shipments.find(s=>s.id===c.deliveryId):null,needsVehicle=shipment?.pickedUp&&shipment.quantity>(c.equipment?.carrinho?72:c.equipment?.cesta?36:24);
    if(c.mobilityTrip||c.ridingVehicleId||(!needsVehicle&&c.path.length<14)||!c.path.length||!this.units.size||this.city.minute-(c.lastVehicleSearchAt??-Infinity)<20||!this.city.society.isAdult(c)||c.conversation||c.workMeal||c.task==='vote'||c.task==='campaign')return;
    c.lastVehicleSearchAt=this.city.minute;
    const goal=c.path.at(-1),end=this.landingAnchor(goal);if(!end)return;
    const owners=new Set([c.accountId,this.city.building(c.jobId)?.accountId,...c.businessIds.map(id=>this.city.building(id)?.accountId)]);
    const choices=[...this.units.values()].filter(v=>v.active&&!v.scrapped&&!v.driverId&&!v.journey&&v.good!=='onibus'&&v.condition>15&&!v.mechanicId&&v.fuel>0&&owners.has(v.ownerAccountId));
    choices.sort((a,b)=>Math.hypot(a.x-c.entity.x,a.y-c.entity.y)-Math.hypot(b.x-c.entity.x,b.y-c.entity.y));
    for(const v of choices){
      if(c.deliveryId&&VEHICLE_SPECS[v.good].cargo<(this.city.logistics.shipments.find(s=>s.id===c.deliveryId)?.quantity||0))continue;
      const route=this.airPath(v,end);if(!route||this.air.fuelNeeded(v,end)>v.fuel)continue;
      const entry=v.parking||this.groundAccess(v),path=this.city.findPath(c.entity,entry);if(path===null||!needsVehicle&&path.length+route.length/2>=c.path.length)continue;
      let parking=this.parkingAt(end,v.id);if(!parking||this.city.findPath(parking,goal)===null)continue;parking=this.parkingAt(end,v.id,true);
      v.driverId=c.id;c.mobilityTrip={kind:'drive',vehicleId:v.id,goal,route,parking,stage:'boarding',entry};c.path=path;c.indoorLocation=null;c.action='Indo buscar seu veículo';return;
    }
    if(c.deliveryId)return;
    for(const line of this.lines){const v=this.units.get(line.vehicleId);if(!v?.driverId||v.condition<=15)continue;
      const origins=line.stops.map((s,i)=>({s,i,d:Math.hypot(s.x-c.entity.x,s.y-c.entity.y)})).sort((a,b)=>a.d-b.d),destinations=line.stops.map((s,i)=>({s,i,d:Math.hypot(s.x-goal.x,s.y-goal.y)})).sort((a,b)=>a.d-b.d),origin=origins[0],destination=destinations[0];
      if(origin.d>6||destination.d>8||origin.i===destination.i||c.balance<line.fare)continue;
      const path=this.city.findPath(c.entity,origin.s);if(path===null)continue;c.mobilityTrip={kind:'bus',vehicleId:v.id,lineId:line.id,origin:origin.i,destination:destination.i,goal,stage:'waiting',until:this.city.minute+120};c.path=path;c.action=`Indo ao ponto da linha ${line.id}`;return;
    }
  }
  minute(){
    const city=this.city;this.hourly();
    for(const batch of this.batches)if(batch.status==='assembly'&&!city.building(batch.manufacturerId)){batch.status='cancelled';batch.cancelledAt=city.minute;}
    for(const c of city.citizens)if(c.mechanicJob){const job=c.mechanicJob,garage=city.building(job.garageId);if(!garage||!garage.active||c.jobId!==garage.id&&garage.ownerId!==c.id){const v=this.units.get(job.vehicleId);if(v)v.mechanicId=null;for(const [g,n]of Object.entries(job.parts))city.economy.lost[g]+=n;c.mechanicJob=null;if(garage)city.reputation.observe(garage.accountId,'reliability',-3,'reparo interrompido',{vehicleId:job.vehicleId});}}
    for(const v of this.units.values())if(v.active&&!v.scrapped){
      const driver=city.society.citizen(v.driverId);if(v.driverId&&!driver){v.driverId=null;this.air.land(v,'Piloto indisponível',true);}
      const owner=city.accounts.get(v.ownerAccountId);if(owner?.entity?.properties.citizen&&owner.entity.destroyed){v.ownerAccountId=city.life.heir(owner)?.accountId||'treasury';v.fuelStore.accountId=v.ownerAccountId;}
      const spec=VEHICLE_SPECS[v.good];if(v.fuel<spec.range&&v.fuelStore.inventory[v.fuelGood]>0){v.fuelStore.inventory[v.fuelGood]--;v.fuel+=spec.range;city.economy.consumed[v.fuelGood]++;city.economy.recordGoods('vehicle-fuel',v.fuelGood,1,null,v.id);this.stats.fuel++;}
      if(v.lineId){const line=this.lines.find(l=>l.id===v.lineId),company=city.building(line.companyId);if(!company)continue;
        if(!v.driverId&&!v.journey&&v.flightPhase==='parked'&&!v.mechanicId&&company.balance>=company.wage*30&&city.hour>=6&&city.hour<22&&v.fuel>10){const driver=[...company.workers,company.ownerId].map(id=>city.society.citizen(id)).find(c=>c&&!c.mobilityTrip&&!c.deliveryId&&!c.cleaningJobId&&!c.workMeal&&!c.conversation&&!c.campaign&&!city.politics.officeHolder(c)&&!city.urgentNeed(c));if(driver){const path=city.findPath(driver.entity,v.parking||this.groundAccess(v));const initialRoute=this.airPath(v,line.stops[line.current].landing);if(path!==null&&initialRoute!==null&&this.air.fuelNeeded(v,line.stops[line.current].landing)<=v.fuel){driver.mobilityTrip={kind:'bus-driver',vehicleId:v.id,stage:'boarding',route:initialRoute,goal:company.door,parking:line.stops[line.current].parking};driver.path=path;driver.task='drive-bus';v.driverId=driver.id;line.status='boarding-driver';}}}
        const driver=city.society.citizen(v.driverId);
        if(driver&&(city.politics.officeHolder(driver)||driver.jobId!==company.id&&company.ownerId!==driver.id||city.hour<6||city.hour>=22||company.balance<company.wage)){this.releaseTrip(driver);driver.task=null;driver.path=[];line.status=company.balance<company.wage?'unpaid-driver':'waiting-driver';continue;}
        if(driver?.ridingVehicleId===v.id&&(!city.urgentNeed(driver)&&city.hour>=6&&city.hour<22)&&!v.journey){const stop=line.stops[line.current];
          for(const id of [...v.passengerIds]){const c=city.society.citizen(id);if(c?.mobilityTrip?.destination===line.current){c.entity.x=stop.x;c.entity.y=stop.y;this.releaseTrip(c);line.passengers++;this.stats.passengers++;}}
          for(const c of city.citizens)if(c.mobilityTrip?.kind==='bus'&&c.mobilityTrip.lineId===line.id&&c.mobilityTrip.stage==='waiting'&&c.mobilityTrip.origin===line.current&&!c.path.length&&v.passengerIds.length<spec.seats&&Math.hypot(c.entity.x-stop.x,c.entity.y-stop.y)<=2&&city.transfer(c.accountId,company.accountId,line.fare,'Passagem de ônibus',{vehicleId:v.id,lineId:line.id})){c.ridingVehicleId=v.id;c.mobilityTrip.stage='riding';v.passengerIds.push(c.id);line.revenue+=line.fare;company.totalRevenue+=line.fare;this.stats.fares+=line.fare;}
          if(v.mechanicId)line.status='maintenance';
          if(!v.mechanicId&&city.minute>=(v.departAt??0)){const next=(line.current+1)%line.stops.length,route=this.airPath(v,line.stops[next].landing);if(route&&this.air.fuelNeeded(v,line.stops[next].landing)<=v.fuel){v.journey={route,destination:line.stops[next],parking:line.stops[next].parking,lineNext:next};line.status='operating';}else line.status='fuel-or-route';}
        }
        if(driver?.ridingVehicleId===v.id&&!city.payWage(driver,company,company.wage)){this.releaseTrip(driver);line.status='unpaid-driver';}
      }
    }
    for(const c of city.citizens)if(c.mobilityTrip&&((c.mobilityTrip.until!=null&&city.minute>c.mobilityTrip.until)||city.urgentNeed(c))){const v=this.units.get(c.mobilityTrip.vehicleId);this.releaseTrip(c);c.task=null;c.path=[];}
  }
  update(dt){
    if(!this.activeCount)return;
    for(const c of this.city.citizens)if(c.mobilityTrip?.stage==='boarding'&&!c.path.length){
      const v=this.units.get(c.mobilityTrip.vehicleId);if(!v||v.driverId!==c.id){this.releaseTrip(c);continue;}
      c.ridingVehicleId=v.id;c.mobilityTrip.stage='riding';
      v.journey={route:c.mobilityTrip.route.slice(),destination:c.mobilityTrip.parking||c.mobilityTrip.route.at(-1)||v,parking:c.mobilityTrip.parking};
      if(Math.hypot(v.x-v.journey.destination.x,v.y-v.journey.destination.y)<.01)v.journey.phase='landing';
    }
    for(const v of this.units.values())if(v.journey&&v.parking){if(!v.lineId)this.freeParking(v.parking,v.id);v.parking=null;}
    this.air.update(Math.min(.1,Math.max(.001,dt)));
  }
  finishFlight(v){
    const journey=v.journey;if(!journey)return;
    v.journey=null;v.flightPhase='parked';v.status=journey.emergency?'Pouso de emergência concluído':'Estacionado';v.flightFault=false;v.parking=journey.parking||null;
    if(v.parking){v.x=v.entity.x=v.parking.x;v.y=v.entity.y=v.parking.y;}
    v.altitude=surfaceElevation(this.city.world,v.x,v.y);
    const interrupted=[v.driverId,...v.passengerIds].some(id=>this.city.society.citizen(id)?.mobilityTrip?.cancelAfterLanding);
    if(v.lineId&&!journey.landingRequested&&!interrupted){const line=this.lines.find(l=>l.id===v.lineId);if(journey.lineNext!=null)line.current=journey.lineNext;v.departAt=this.city.minute+3;return;}
    for(const id of [v.driverId,...v.passengerIds]){const c=this.city.society.citizen(id);if(c){c.entity.x=v.x;c.entity.y=v.y;this.releaseTrip(c);}}
    v.driverId=null;
  }
  garageWork(b,c){
    const city=this.city;
    if(!c.mechanicJob){const v=[...this.units.values()].filter(v=>v.active&&!v.scrapped&&v.condition<75&&!v.mechanicId&&!v.journey&&v.flightPhase==='parked'&&(!v.driverId||v.good==='onibus')).sort((a,b)=>a.condition-b.condition)[0];if(!v||b.inventory.pecas<1||b.inventory.oleo<1)return false;const pos=this.groundAccess(v),path=city.findPath(c.entity,pos);if(path===null)return false;const price=Math.ceil((city.economy.goods.pecas.price+city.economy.goods.oleo.price+city.currency.price(city.politics.policy.minimumWage*48))*1.35*(v.ownerAccountId==='treasury'?1.5:1));if(!city.transfer(v.ownerAccountId,b.accountId,price,'Serviço: reparo de veículo',{vehicleId:v.id,buildingId:b.id}))return false;
      const payer=city.accounts.get(v.ownerAccountId);if(payer?.entity?.properties.cityBuilding&&v.ownerAccountId!=='treasury')payer.totalExpenses+=price;
      b.inventory.pecas--;b.inventory.oleo--;c.mechanicJob={vehicleId:v.id,garageId:b.id,parts:{pecas:1,oleo:1},labor:0};v.mechanicId=c.id;c.path=path;c.indoorLocation=null;return true;}
    const job=c.mechanicJob,v=this.units.get(job.vehicleId);if(!v||v.scrapped){for(const [g,n]of Object.entries(job.parts))city.economy.lost[g]+=n;c.mechanicJob=null;return false;}
    const pos=this.groundAccess(v);if(Math.hypot(c.entity.x-pos.x,c.entity.y-pos.y)>2){const path=city.findPath(c.entity,pos);if(path)c.path=path;return true;}
    c.action='Consertando veículo com peças transportadas';job.labor+=1+(c.skills.maintenance||0)/80;if(job.labor<24)return true;
    for(const [g,n]of Object.entries(job.parts)){city.economy.consumed[g]+=n;city.economy.recordGoods('vehicle-repair',g,n,b.id,v.id);}v.condition=100;v.mechanicId=null;c.mechanicJob=null;this.stats.repairs++;city.log(`Veículo ${v.id} reparado por ${b.entity.properties.name}.`,'service',[c.id],{kind:'vehicle-repaired',vehicleId:v.id,buildingId:b.id});return true;
  }
  goodsStock(good){return [...this.units.values()].reduce((n,v)=>n+(v.active&&!v.scrapped&&v.good===good?1:0)+(v.fuelStore?.inventory[good]||0),0)+this.city.citizens.reduce((n,c)=>n+(c.mechanicJob?.parts[good]||0),0);}
}
