import {moveGarments} from './city_clothing.js';
import { carryCapacity } from './city_markets.js';
import { inventoryFree, initializeInventory } from './city_inventory.js';

/** Cargo is reserved in escrow and follows a citizen over actual walkable paths. */
// Urgent food and housing start ahead, while waiting freight gains priority over time.
export function shipmentPriority(s,minute,hour){
 const base=s.purpose==='public-meals'?-5:s.purpose==='work-meals'?-4:['super_popular_housing','popular_housing','popular_luxury_housing'].includes(s.buyer?.type)?-4:s.purpose==='sanitation'?-3:s.purpose==='lamp-refill'?(s.buyer.lampPost?.fuel<=0&&(hour<6||hour>=18)?-3:-2):s.purpose==='critical-infrastructure'||s.purpose==='lighting-input'?-2:s.purpose==='lamp-construction'?-1:(s.purpose?.endsWith('lighting')&&minute-s.createdAt<12*60?1:0);
 return base-Math.min(12,Math.floor(Math.max(0,minute-(s.createdAt??minute))/360));
}

export class CityLogistics {
  constructor(city) { this.city = city; this.shipments = []; this.nextId = 1; this.delivered = 0; }
  capacity(c){if(!c)return 0;return this.city.vehicles?this.city.vehicles.cargoCapacity(c):carryCapacity(c);}
  transportLimit(seller,buyer){
    const city=this.city,ids=new Set([seller?.ownerId,buyer?.ownerId]);
    for(const b of city.economy.businesses.filter(b=>b.type==='carrier'))for(const id of [...b.workers,b.ownerId])ids.add(id);
    if(buyer?.accountId==='treasury'||buyer?.municipal)for(const c of city.citizens)if(!c.jobId&&!c.businessIds.length)ids.add(c.id);
    return Math.max(24,...[...ids].map(id=>city.society.citizen(id)).filter(Boolean).map(c=>this.capacity(c)));
  }
  demandMetrics() {
    const city=this.city, shipments=this.shipments.filter(s=>!['delivered','cancelled'].includes(s.status) && city.building(s.carrierId)?.type!=='waste_collector');
    const carriers=city.economy.businesses.filter(b=>b.type==='carrier');
    const drivers=carriers.reduce((n,b)=>n+(b.balance>=b.wage?b.workers.filter(id=>city.society.citizen(id)).length:0)+(city.economy.workingOwner(b)?1:0),0);
    const waiting=shipments.filter(s=>s.status!=='waiting-space' && (!s.driverId || !s.carrierId));
    const oldest=waiting.reduce((n,s)=>Math.max(n,city.minute-s.createdAt),0);
    const lampRequests=city.lighting.posts.filter(p=>p.fuel<=3 && !shipments.some(s=>s.buyer.lampPost===p)).length;
    const work=shipments.reduce((n,s)=>{if(s.status==='waiting-space')return n;const driver=city.society.citizen(s.driverId);const remaining=driver?.deliveryLeg==='delivery'?driver.path.length+4:s.routeLength+(s.pickedUp?0:s.routeLength*.5)+4;return n+Math.max(4,remaining);},0)+lampRequests*30;
    // Only part of a shift is available after pickup, food, rest and personal needs.
    const capacity=drivers*240;
    const shortage=Math.max(0,work-capacity*.5);
    const score=work?Math.min(300,(drivers?0:120)+shortage*.3+waiting.length*12+Math.min(120,oldest/15)+lampRequests*10):0;
    return {waitingSpace:shipments.filter(s=>s.status==='waiting-space').length,pending:shipments.length,waiting:waiting.length,ownHauls:shipments.filter(s=>!s.carrierId).length,oldest,lampRequests,work:Math.ceil(work),capacity,drivers,score};
  }
  splitLoad(s,limit=24){
    if(s.driverId||s.quantity<=limit)return;
    while(s.quantity>limit){const quantity=limit,unitCost=s.cost/s.quantity,cost=Math.round(unitCost*quantity),fee=Math.floor(s.fee*quantity/s.quantity),serviceFee=Math.floor((s.serviceFee||0)*quantity/s.quantity),id=this.nextId++,accountId=`shipment:${id}`;
      const part={...s,id,accountId,name:`Frete ${id}`,balance:0,quantity,cost,fee,serviceFee,driverId:null,status:'waiting',position:{...s.position},incoming:{},inventory:{...s.inventory},componentLots:{},inventoryCapacity:limit};part.inventory[s.good]=quantity;
      this.city.accounts.set(accountId,part);if(!this.city.transfer(s.accountId,accountId,cost+fee+serviceFee,'Divisão de carga: equipamento indisponível')){this.city.accounts.delete(accountId);break;}
      if(s.good==='tinta')part.paintLots=[];this.city.paint.move(s,part,s.good,quantity);s.quantity-=quantity;s.cost-=cost;s.fee-=fee;s.serviceFee-=serviceFee;s.inventory[s.good]=s.quantity;if(s.good==='roupas'){part.garments=[];moveGarments(s,part,quantity);}this.city.publications.moveStock(s,part,s.good,quantity);this.city.vehicles.moveStock(s,part,s.good,quantity);this.shipments.push(part);
    }
  }
  rebalanceWaiting() {
    const city=this.city;
    const carriers=city.economy.businesses.filter(b=>['carrier','lamp_service'].includes(b.type) && (city.economy.workingOwner(b) || b.workers.length && b.balance>=b.wage));
    if(!carriers.length)return;
    const jobs=this.shipments.filter(s=>!['delivered','cancelled','waiting-space'].includes(s.status));
    const load=new Map(carriers.map(b=>[b.id,jobs.filter(s=>s.driverId && s.carrierId===b.id).reduce((n,s)=>n+Math.max(8,s.routeLength),0)]));
    const dispatchPriority=s=>s.purpose==='public-meals'?-5:s.purpose==='work-meals'?-4:s.purpose==='sanitation'?-3:Number(['critical-infrastructure','lighting-input','lamp-refill'].includes(s.purpose))?-2:0;
    for(const s of jobs.filter(s=>!s.driverId && this.city.building(s.carrierId)?.type!=='waste_collector').sort((a,b)=>dispatchPriority(a)-dispatchPriority(b)||a.createdAt-b.createdAt).slice(0,64)) {
      const options=carriers.filter(b=>(s.purpose==='lamp-refill'||b.type==='carrier')&&[...b.workers,b.ownerId].some(id=>this.capacity(city.society.citizen(id))>=s.quantity)&&city.economy.connected(b,{id:`cargo:${s.id}`,door:s.position}));
      options.sort((a,b)=>(s.purpose==='lamp-refill'?Number(b.type==='lamp_service')-Number(a.type==='lamp_service'):0)||(load.get(a.id)||0)/Math.max(1,a.workers.length+(a.ownerId?1:0))-(load.get(b.id)||0)/Math.max(1,b.workers.length+(b.ownerId?1:0))||a.id-b.id);
      const carrier=options[0];if(!carrier)continue;
      if(!s.fee){const fee=city.currency.price(Math.max(120,s.routeLength*12+s.quantity*4));const price=Math.ceil(fee*(s.payerAccountId==='treasury'?1.5:1));if(!city.transfer(s.payerAccountId,s.accountId,price,'Reserva de transporte por nova prestadora'))continue;s.fee=price;}
      s.carrierId=carrier.id;load.set(carrier.id,(load.get(carrier.id)||0)+Math.max(8,s.routeLength));
    }
  }
  leastLoaded(carriers) {
    if (carriers.length < 2) return carriers[0];
    const loads = new Map();
    for (const shipment of this.shipments) if (!['delivered', 'cancelled'].includes(shipment.status)) loads.set(shipment.carrierId, (loads.get(shipment.carrierId) || 0) + 1);
    let best, load = Infinity;
    for (const carrier of carriers) { const count = (loads.get(carrier.id) || 0) + this.city.reputation.providerPenalty(carrier); if (count < load) { best = carrier; load = count; } }
    return best;
  }
  pendingTo(holder, good) { return holder.incoming?.[good] || 0; }
  publicOrder(s){return s.payerAccountId==='treasury'||s.buyer.accountId==='treasury'||s.buyer.municipal;}
  order(seller, buyer, good, quantity, unitPrice, { payerAccountId = buyer?.accountId, purpose = 'trade', serviceFee = 0, serviceAccountId = null, requireCarrier = false } = {}) {
    const city = this.city;
    if (!seller || !buyer || seller === buyer || (!seller.active && seller.type !== 'residential' && !(good==='lixo' && purpose==='waste-collection')) || (!buyer.active && buyer.type !== 'residential') || seller.entity?.destroyed || buyer.entity?.destroyed || !(good in seller.inventory) || !(good in buyer.inventory) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > this.transportLimit(seller,buyer) || seller.inventory[good] < quantity || inventoryFree(buyer) < quantity || !Number.isSafeInteger(unitPrice) || unitPrice < 0) return false;
    const route = city.findPath(seller.door, buyer.door); if (route === null) return false;
    const carriers = city.economy.businesses.filter(b => (b.type === 'carrier'||purpose==='lamp-refill'&&b.type==='lamp_service') && (city.economy.workingOwner(b) || b.workers.length && b.balance >= b.wage) && city.economy.connected(b, seller));
    const eligibleCarriers=carriers.filter(b=>[...b.workers,b.ownerId].some(id=>this.capacity(city.society.citizen(id))>=quantity));
    let carrier = this.leastLoaded(purpose==='lamp-refill'&&eligibleCarriers.some(b=>b.type==='lamp_service')?eligibleCarriers.filter(b=>b.type==='lamp_service'):eligibleCarriers);
    // Collection firms send their own crews, independently of general freight capacity.
    const wasteOperator=purpose==='waste-collection'?buyer:purpose==='waste-processing' && seller.type==='waste_collector'?seller:null;
    if(wasteOperator?.active && (city.economy.workingOwner(wasteOperator) || wasteOperator.workers.length && wasteOperator.balance>=wasteOperator.wage))carrier=wasteOperator;
    if(requireCarrier && !carrier)return false;
    let fee = carrier ? city.currency.price(Math.max(120, (route.length + Math.abs(carrier.door.x - seller.door.x) + Math.abs(carrier.door.y - seller.door.y)) * 12 + quantity * 4)) : 0;
    fee = Math.ceil(fee*(payerAccountId==='treasury'?1.5:1)) + (requireCarrier?city.currency.price(payerAccountId==='treasury'?180:120):0);
    if (!Number.isSafeInteger(serviceFee) || serviceFee < 0 || (serviceFee && !city.accounts.has(serviceAccountId))) return false;
    const cost = quantity * unitPrice;
    const funds = city.accounts.get(payerAccountId)?.balance || 0;
    if (!requireCarrier && funds < cost + fee + serviceFee && funds >= cost + serviceFee) { carrier = null; fee = 0; }
    if (funds < cost + fee + serviceFee) return false;
    const id = this.nextId++, accountId = `shipment:${id}`;
    const s = { id, accountId, payerAccountId, purpose, requireCarrier, serviceFee, serviceAccountId, name: `Frete ${id}`, balance: 0, seller, buyer, good, quantity, cost, fee, carrierId: carrier?.id || null, driverId: null, status: 'waiting', pickedUp: false, createdAt: city.minute, routeLength: route.length };
    initializeInventory(s, city.economy.goods, Math.max(24,quantity)); s.inventory[good] = quantity;
    city.accounts.set(accountId, s);
    if (!city.transfer(payerAccountId, accountId, cost + fee + serviceFee, 'Reserva de compra e frete',{shipmentId:id,purpose,good,essential:purpose==='public-meals'})) { city.accounts.delete(accountId); return false; }
    if(good==='roupas')moveGarments(seller,s,quantity);
    city.publications.moveStock(seller,s,good,quantity);city.vehicles.moveStock(seller,s,good,quantity);city.paint.move(seller,s,good,quantity);
    seller.inventory[good] -= quantity; buyer.incoming[good] = (buyer.incoming[good] || 0) + quantity;
    // Until pickup the reserved cargo stays at the supplier's entrance.
    s.position = { ...seller.door }; this.shipments.push(s);
    city.economy.recordGoods('dispatch', good, quantity, seller.id, buyer.id, {shipmentId:id});
    city.log(`Frete ${id}: ${quantity} ${city.economy.goods[good].label}, de ${seller.entity?.properties.name || seller.name} para ${buyer.entity?.properties.name || buyer.name}.`, 'transport', [], { kind: 'shipment-ordered', shipmentId: id, projectId:typeof buyer.id==='string' && buyer.id.startsWith('project:')?buyer.id:undefined, buildingIds:[seller.entity?.id,buyer.entity?.id,carrier?.id].filter(id=>id!=null), accounts:[seller.accountId,buyer.accountId,payerAccountId].filter(Boolean), good, quantity, amount:cost, fee });
    return s;
  }
  releaseDriver(s) {
    const c = this.city.society.citizen(s.driverId);
    if (c) { if(c.mobilityTrip)this.city.vehicles.releaseTrip(c);c.deliveryId = null; c.task = null; c.path = []; }
    s.driverId = null;
  }
  cancel(s) {
    if (['delivered', 'cancelled'].includes(s.status)) return;
    this.releaseDriver(s);
    s.buyer.incoming[s.good] = Math.max(0, (s.buyer.incoming[s.good] || 0) - s.quantity);
    const hall = this.city.buildings.find(b => b.type === 'townhall' && !b.entity.destroyed);
    const destination = !s.seller.entity?.destroyed && inventoryFree(s.seller) >= s.quantity ? s.seller : hall;
    if (destination && inventoryFree(destination) >= s.quantity) {destination.inventory[s.good] += s.quantity;if(s.good==='roupas')moveGarments(s,destination,s.quantity);this.city.publications.moveStock(s,destination,s.good,s.quantity);this.city.vehicles.moveStock(s,destination,s.good,s.quantity);this.city.paint.move(s,destination,s.good,s.quantity);}
    else {this.city.economy.lost[s.good] += s.quantity;this.city.publications.loseStock(s,s.good,s.quantity);this.city.vehicles.loseStock(s,s.good,s.quantity);}
    s.inventory[s.good] = 0;
    const buyerAccount = this.city.accounts.get(s.payerAccountId || s.buyer.accountId);
    const refund = buyerAccount && !buyerAccount.entity?.destroyed ? (s.payerAccountId || s.buyer.accountId) : this.city.economy.citizen(buyerAccount?.ownerId)?.accountId || 'treasury';
    this.city.transfer(s.accountId, refund, s.balance, 'Estorno de frete cancelado');
    s.status = 'cancelled'; s.completedAt = this.city.minute;
    this.city.log(`Frete ${s.id} cancelado; reserva financeira devolvida.`, 'transport', [], { kind: 'shipment-cancelled', shipmentId: s.id, buildingIds:[s.seller.entity?.id,s.buyer.entity?.id].filter(id=>id!=null), accounts:[s.seller.accountId,s.buyer.accountId,s.payerAccountId].filter(Boolean) });
  }
  candidates(s) {
    const economy = this.city.economy;
    let carrier = this.city.building(s.carrierId);
    // A closed, unstaffed or insolvent carrier must not trap the cargo and escrow forever.
    const ownerCanHaul = !!economy.workingOwner(carrier)&&this.capacity(economy.workingOwner(carrier))>=s.quantity;
    if (carrier && (!carrier.active || (!ownerCanHaul && (!carrier.workers.some(id => economy.citizen(id)&&this.capacity(economy.citizen(id))>=s.quantity) || carrier.balance < carrier.wage)))) {
      s.carrierId = null; carrier = null;
    }
    const ids = carrier?.active ? [...carrier.workers, carrier.ownerId] : [];
    if (!carrier?.active) {
      s.carrierId = null;
      // A cargo bike can be temporarily occupied. Reconsider carriers later instead
      // of permanently turning a large order into an impossible owner-only haul.
      const next=s.requireCarrier||s.fee>0?this.leastLoaded(economy.businesses.filter(b=>(b.type==='carrier'||s.purpose==='lamp-refill'&&b.type==='lamp_service') && b.active && b.balance>=b.wage && [...b.workers,b.ownerId].some(id=>this.capacity(economy.citizen(id))>=s.quantity))):null;
      if(next){s.carrierId=next.id;carrier=next;ids.push(...next.workers,next.ownerId);}
      if(s.requireCarrier)return [...new Set(ids)].map(id=>economy.citizen(id)).filter(c=>c && this.capacity(c)>=s.quantity && !c.deliveryId && !c.mobilityTrip && !c.ridingVehicleId && !c.cleaningJobId && !c.workMeal && !c.conversation && !this.city.urgentNeed(c) && c.needs.energy>25);
      if(!carrier){
        // Owners and temporary public workers can bootstrap an unserved route.
        if(this.publicOrder(s))ids.push(...this.city.citizens.filter(c=>!c.entity.destroyed&&this.city.society.isAdult(c)&&!c.jobId&&!c.businessIds.length&&!this.city.politics.officeHolder(c)&&!['caregiving','food','water','energy','health','toilet'].includes(c.task)).sort((a,b)=>Math.hypot(a.entity.x-s.position.x,a.entity.y-s.position.y)-Math.hypot(b.entity.x-s.position.x,b.entity.y-s.position.y)).slice(0,16).map(c=>c.id));
        ids.push(s.buyer.ownerId, s.seller.ownerId);
        const founder = this.city.development?.ownerCitizen(s.buyer.accountId); if (founder) ids.push(founder.id);
      }
    }
    return [...new Set(ids)].map(id => economy.citizen(id)).filter(c => c && c.role!=='councilor' && this.capacity(c)>=s.quantity && !c.deliveryId && !c.mobilityTrip && !c.ridingVehicleId && !c.entity.destroyed && this.city.society.isAdult(c) && !c.conversation && !c.workMeal && !c.cleaningJobId && !this.city.urgentNeed(c) && c.needs.energy > 25 && (!carrier || c.id === carrier.ownerId || carrier.balance >= carrier.wage));
  }
  updateMinute() {
    const city = this.city;
    const maxCarry=Math.max(24,...city.citizens.filter(c=>!c.entity.destroyed).map(c=>this.capacity(c)));for(const s of this.shipments.filter(s=>!s.driverId&&!['delivered','cancelled'].includes(s.status)&&s.quantity>maxCarry))this.splitLoad(s);
    const pending = this.shipments.filter(s => !['delivered', 'cancelled'].includes(s.status));
    // Give fresh food/works priority, but promote old orders so fuel cannot wait forever.
    const priority = s => shipmentPriority(s,city.minute,city.hour);
    pending.sort((a, b) => priority(a) - priority(b) || (a.lastDispatchAttempt || 0) - (b.lastDispatchAttempt || 0) || a.createdAt - b.createdAt || a.id - b.id);
    let dispatchBudget = 32;
    for (const s of pending) {
      if (s.seller.entity?.destroyed || s.buyer.entity?.destroyed || s.buyer.cancelled || (!s.seller.active && s.seller.type !== 'residential' && !(s.good==='lixo' && s.purpose==='waste-collection')) || (!s.buyer.active && s.buyer.type !== 'residential')) { this.cancel(s); continue; }
      let c = city.society.citizen(s.driverId);
      if (c?.workMeal) continue;
      if (c && (city.urgentNeed(c) || city.hour < 7 || city.hour >= 20)) { if (s.pickedUp) s.position = { x: c.entity.x, y: c.entity.y }; this.releaseDriver(s); c = null; s.status = 'waiting'; }
      if (!c) {
        s.driverId = null;
        if (city.hour < 7 || city.hour >= 20 || s.lastDispatchAttempt!=null&&city.minute-s.lastDispatchAttempt<5 || dispatchBudget <= 0) continue;
        s.lastDispatchAttempt = city.minute;
        for (const candidate of this.candidates(s)) {
          if (dispatchBudget-- <= 0) break;
          const path = city.findPath(candidate.entity, s.position); if (path === null) continue;
          c = candidate;s.temporaryDriverId=!s.carrierId&&this.publicOrder(s)&&!c.jobId&&!c.businessIds.length&&!city.politics.officeHolder(c)?c.id:null; c.deliveryLeg = 'pickup'; c.task = 'transport'; c.servicePaid = null; c.deliveryId = s.id; c.path = path; s.driverId = c.id; s.status = 'in-transit'; break;
        }
        if (!c) {if(s.quantity>24&&city.minute-s.createdAt>=60)this.splitLoad(s,24);continue;}
      }
      const carrierEmployer = city.building(s.carrierId);
      if(s.temporaryDriverId===c.id){const hall=city.buildings.find(b=>b.type==='townhall'&&!b.entity.destroyed),wage=Math.ceil(city.currency.price(city.politics.policy.minimumWage)*1.5);if(!hall||!city.payWage(c,hall,wage)){if(s.pickedUp)s.position={x:c.entity.x,y:c.entity.y};this.releaseDriver(s);s.status='waiting';continue;}}
      if (carrierEmployer && c.jobId === carrierEmployer.id && carrierEmployer.balance < carrierEmployer.wage) {
        if (s.pickedUp) s.position = { x: c.entity.x, y: c.entity.y };
        this.releaseDriver(s); s.status = 'waiting'; continue;
      }
      if (carrierEmployer && c.jobId === carrierEmployer.id) {
        city.payWage(c,carrierEmployer,carrierEmployer.wage);
        city.economy.practice(c, 'logistics');
      }
      c.task = 'transport';
      if(c.mobilityTrip||c.ridingVehicleId)continue;
      if (!c.path.length) {
        const goal = c.deliveryLeg === 'delivery' ? s.buyer.door : s.position;
        if (Math.hypot(c.entity.x - goal.x, c.entity.y - goal.y) > .9) {
          const path = city.findPath(c.entity, goal);
          if (path === null) { if (s.pickedUp) s.position = { x: c.entity.x, y: c.entity.y }; this.releaseDriver(s); s.status = 'waiting'; continue; }
          c.path = path;
        }
      }
      if (c.path.length) { c.action = `Transportando ${city.economy.goods[s.good].label} / frete ${s.id}`; continue; }
      if (c.deliveryLeg !== 'delivery') {
        s.pickedUp = true;
        const path = city.findPath(c.entity, s.buyer.door);
        if (path === null) { s.pickedUp = false; this.releaseDriver(s); continue; }
        c.path = path; c.deliveryLeg = 'delivery';
      } else {
        if(s.buyer.lampPost && (s.refillLabor=(s.refillLabor||0)+1)<4) {c.action='Abastecendo lamparina';continue;}
        s.buyer.incoming[s.good] -= s.quantity;
        if (inventoryFree(s.buyer) < s.quantity) { s.buyer.incoming[s.good] += s.quantity; s.status = 'waiting-space'; continue; }
        if(s.good==='roupas')moveGarments(s,s.buyer,s.quantity);
        city.publications.moveStock(s,s.buyer,s.good,s.quantity);city.vehicles.moveStock(s,s.buyer,s.good,s.quantity);city.paint.move(s,s.buyer,s.good,s.quantity);
        s.buyer.inventory[s.good] += s.quantity; s.inventory[s.good] = 0;
        if(s.buyer.lampPost) {s.buyer.inventory.oleo--;s.buyer.lampPost.fuel+=12;s.buyer.lampPost.lit=(city.hour<6||city.hour>=18);s.buyer.lampPost.supplyStatus='Abastecido';city.economy.consumed.oleo++;city.economy.recordGoods('lamp-refill','oleo',1,s.seller.id,s.buyer.lampPost.id);}
        city.transfer(s.accountId, s.seller.accountId, s.cost, `Atacado: ${city.economy.goods[s.good].label}`,{good:s.good,quantity:s.quantity,shipmentId:s.id});
        const carrier = city.building(s.carrierId);
        city.transfer(s.accountId, carrier?.active ? carrier.accountId : (s.payerAccountId || s.buyer.accountId), s.fee, carrier?.active ? 'Frete entregue' : 'Estorno de frete sem transportadora',{shipmentId:s.id});
        if (s.serviceFee) city.transfer(s.accountId, s.serviceAccountId, s.serviceFee, 'Serviço de coleta');
        const buyerAccount = city.accounts.get(s.payerAccountId || s.buyer.accountId);
        if (buyerAccount?.entity?.properties.cityBuilding) { buyerAccount.totalExpenses += s.cost + (carrier?.active ? s.fee : 0) + (s.serviceFee || 0); if (s.purpose === 'work-meals') buyerAccount.mealPurchaseCost += s.cost + (carrier?.active ? s.fee : 0); }
        if(s.purpose==='waste-collection')city.sanitation.collected+=s.quantity;
        city.economy.recordGoods('delivery', s.good, s.quantity, s.seller.id, s.buyer.id, {shipmentId:s.id});
        city.history.record('sale', `${s.quantity} ${city.economy.goods[s.good].label}: ${city.accountName(s.seller.accountId)} → ${city.accountName(s.payerAccountId)}.`,[s.seller.accountId,s.payerAccountId,s.buyer.accountId],{amount:s.cost,good:s.good,quantity:s.quantity,shipmentId:s.id});
        city.history.record('service',s.buyer.lampPost?'Abastecimento de lamparina concluído.':'Frete entregue.',[carrier?.accountId,s.payerAccountId,c.accountId,s.buyer.accountId],{amount:s.fee+s.serviceFee,shipmentId:s.id,provider:carrier?.entity.properties.name||'Transporte próprio',quantity:s.quantity});
        city.reputation.completed(carrier, c, 'entrega concluída', {shipmentId:s.id});
        city.economy.practice(c, 'logistics', 10); this.releaseDriver(s);
        s.status = 'delivered'; s.completedAt = city.minute; this.delivered++;
        city.log(`Frete ${s.id} entregue: ${s.quantity} ${city.economy.goods[s.good].label}.`, 'transport', [c.id], { kind: 'shipment-delivered', shipmentId: s.id, buildingIds:[s.seller.entity?.id,s.buyer.entity?.id,carrier?.id].filter(id=>id!=null), accounts:[s.seller.accountId,s.buyer.accountId,s.payerAccountId].filter(Boolean), good:s.good, quantity:s.quantity });
      }
    }
    // Retain every active load, plus the latest 100 completed records.
    const completed = this.shipments.filter(s => ['delivered', 'cancelled'].includes(s.status));
    for (const s of completed.slice(0, -100)) { this.city.accounts.delete(s.accountId); this.shipments.splice(this.shipments.indexOf(s), 1); }
  }
}
