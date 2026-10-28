import {activityRoomReady,activityCellAvailable} from './city_interiors.js?v=service-queues-1';
import { inventoryFree } from './city_inventory.js';
import { HOUSING_TYPES } from './city_housing.js';
export const SANITATION_RULES = { dirtPerUse: 6, freeCleaningInterval: 7 * 1440, paidCleaningInterval: 180, privateCleaningInterval: 1440, cleaningPrice: 400, usePrice: 300, wastePerUse: 1, wasteToStone: 2 };
const clamp = n => Math.max(0, Math.min(100, n));
export class CitySanitation {
  constructor(city) { this.city = city; this.facilities = new Map(); this.jobs = []; this.nextJobId = 1; this.cleaned = 0; this.collected = 0; }
  addFacility(b, { unitId = null, homeId = null, homeIds = null, access = 'employees' } = {}) {
    const id = `toilet:${unitId || b.id}`;
    if (this.facilities.has(id)) {const existing=this.facilities.get(id);if(homeIds)existing.homeIds=homeIds;return existing;}
    const f = { id, buildingId: b.id, unitId, homeId, homeIds:homeIds||null, access, price: access === 'paid' ? this.city.currency.price(SANITATION_RULES.usePrice) : 0, cleanliness: 100, uses: 0, occupantId: null, busyUntil: 0, createdAt: this.city.minute, lastCleanedAt: this.city.minute, cleaningJobId: null };
    this.facilities.set(id, f); return f;
  }
  setupBuilding(b) {
    b.litter ??= 0;
    if (HOUSING_TYPES.includes(b.type)) {
      for (const u of b.units.filter(u => u.roomType === 'bathroom')) {const homes=[...this.city.housing.homes.values()].filter(h=>h.buildingId===b.id&&h.bathroomUnitId===u.id).map(h=>h.id);this.addFacility(b, { unitId: u.id, homeId: u.homeId, homeIds:homes, access: 'home' });}
      this.setupBusinessRooms(b);
    } else {
      const access = ['townhall', 'public_toilet', 'popular_refectory'].includes(b.type) ? 'public' : b.type === 'paid_toilet' ? 'paid' : 'employees';
      const u = b.units.find(u => u.roomType === 'bathroom') || b.units.at(-1);
      if(u&&u.roomType!=='bathroom'){u.roomType='bathroom';b.layoutRevision=(b.layoutRevision||0)+1;}
      this.addFacility(b, { unitId: u?.id || null, access });
    }
  }
  setupBusinessRooms(b) {
    if (HOUSING_TYPES.includes(b.type)) return;
    // Reuse existing rooms so repeated setup/expansion cannot duplicate facilities.
    let bathroom = b.units.find(u => u.roomType === 'bathroom');
    bathroom ||= b.units.find(u => u.roomType === 'workspace');
    if (bathroom) {
      if(bathroom.roomType!=='bathroom'){bathroom.roomType='bathroom';b.layoutRevision=(b.layoutRevision||0)+1;}
      this.addFacility(b, { unitId: bathroom.id, access: ['townhall', 'public_toilet', 'popular_refectory'].includes(b.type) ? 'public' : b.type === 'paid_toilet' ? 'paid' : 'employees' });
    }
    // The town hall is the first public food and hygiene service for the
    // whole population. Give it enough real rooms instead of queuing hundreds
    // of people at a single four-person table or single toilet.
    const population=Math.max(this.city.initialPopulation||0,this.city.citizens.length),publicHall=b.type==='townhall';
    const targets={dining:publicHall?Math.min(16,Math.max(1,Math.ceil(population/64))):1,bathroom:publicHall?Math.min(16,Math.max(1,Math.ceil(population/32))):1};
    for(const [kind,target]of Object.entries(targets)){
      let count=b.units.filter(u=>u.roomType===kind).length;
      while(count<target){
        const workspaces=b.units.filter(u=>u.roomType==='workspace');if(workspaces.length<=Math.max(3,b.jobs||0))break;
        const room=workspaces[0];room.roomType=kind;b.layoutRevision=(b.layoutRevision||0)+1;count++;
        if(kind==='bathroom')this.addFacility(b,{unitId:room.id,access:'public'});
      }
    }
  }
  allowed(c, f) {
    const b = this.city.building(f.buildingId); if (!b) return false;
    if (f.access === 'public' || f.access === 'paid') return f.price <= (this.city.accounts.get(this.city.payerFor(c))?.balance || 0);
    if (f.access === 'employees') return b.active && (c.jobId === b.id || c.id === b.ownerId);
    const homes=[...new Set([...(f.homeIds||[]),f.homeId].filter(Boolean))].map(id=>this.city.housing.homes.get(id)).filter(Boolean);if(!homes.length)return false;
    const residents=homes.flatMap(home=>this.city.housing.residents(home));
    if (residents.some(p => p.id === c.id)) return true;
    if (!residents.length && this.city.units.get(f.unitId)?.ownerId === c.accountId) return true;
    return residents.some(p => { const r = this.city.relationships.view(p,c); return r && r.affection >= 65 && r.trust >= 50 && r.resentment<30; });
  }
  choose(c,task='toilet') {
    const options = [...this.facilities.values()].filter(f => this.allowed(c, f) && this.city.units.get(f.unitId)?.roomType==='bathroom');
    options.sort((a, b) => this.score(c, a) - this.score(c, b));
    for (const f of options) {
      const b = this.city.building(f.buildingId), path = this.city.findPath(c.entity, b.door); if (path === null) continue;
      if(task==='toilet')c.toiletTargetId=f.id;else c.hygieneTargetId=f.id;c.task=task; c.targetId = b.id; c.path = path; return true;
    }
    return false;
  }
  score(c, f) {
    const b = this.city.building(f.buildingId);
    const entrance=b.officeTenantOf?this.city.building(b.officeTenantOf)||b:b;
    const queued=(entrance.serviceQueue||[]).filter(q=>q.buildingId===b.id&&q.kind==='toilet'&&q.resource===f.id).length,busy=f.occupantId&&f.occupantId!==c.id&&this.city.minute<f.busyUntil;
    return Math.hypot(c.entity.x - b.door.x, c.entity.y - b.door.y) + (100 - f.cleanliness) * .12 + f.price / 50 + queued*5+(busy?4:0) - ((f.homeId === c.homeId || f.homeIds?.includes(c.homeId)) ? 8 : 0) - (c.jobId === b.id ? 4 : 0);
  }
  addWaste(b, amount = 1) {
    const stored = Math.min(amount, inventoryFree(b)); b.inventory.lixo += stored; b.litter += amount - stored;
    this.city.economy.produced.lixo += amount;
    this.city.economy.recordGoods('waste', 'lixo', amount, null, b.id);
  }
  use(c) {
    const f = this.facilities.get(c.toiletTargetId), b = f && this.city.building(f.buildingId);
    if (!f || !b || !this.allowed(c, f) || (f.occupantId && f.occupantId !== c.id && this.city.minute < f.busyUntil)) { c.task = null; c.toiletTargetId = null; return false; }
    const room=this.city.units.get(f.unitId);if(!room||!activityRoomReady(this.city,c,b,room,'bathroom'))return false;
    if (c.servicePaid !== f.id) {
      if (!this.city.transfer(this.city.payerFor(c), b.accountId, f.price, 'Serviço: Banheiro')) { c.task = null; return false; }
      b.lastToiletUseAt = this.city.minute; f.occupantId = c.id; f.busyUntil = this.city.minute + 20; f.uses++;
      const quality = f.cleanliness;
      c.mood = Math.max(-25, Math.min(25, (c.mood || 0) + (quality >= 95 ? 6 : quality < 25 ? -9 : quality < 60 ? -4 : 0)));
      if (quality < 25) { c.needs.hygiene = clamp(c.needs.hygiene - 5); c.needs.health = clamp(c.needs.health - 1); }
      f.cleanliness = clamp(f.cleanliness - SANITATION_RULES.dirtPerUse);
      this.addWaste(b, SANITATION_RULES.wastePerUse); c.servicePaid = f.id;
      this.city.log(`${c.entity.properties.name} usou banheiro ${f.access === 'public' ? 'público gratuito' : f.access === 'paid' ? 'pago' : 'privado'}, limpeza ${Math.round(quality)}%.`, 'sanitation', [c.id], { kind: 'toilet-use', facilityId: f.id, quality, waste: SANITATION_RULES.wastePerUse });
    }
    c.needs.toilet = clamp(c.needs.toilet + 10); c.action = `Usando banheiro / limpeza ${Math.round(f.cleanliness)}%`;
    if (c.needs.toilet >= 95) { f.occupantId = null; c.task = null; c.servicePaid = null; c.toiletTargetId = null; }
    return true;
  }
  payer(f) {
    const b = this.city.building(f.buildingId); if (!b) return null;
    if (f.access === 'public') return 'treasury';
    const unit=this.city.units.get(f.unitId);if(unit?.ownerId==='treasury')return 'treasury';
    if (f.homeId) {
      const home = this.city.housing.homes.get(f.homeId), resident = home && this.city.housing.residents(home).find(c => this.city.society.isAdult(c));
      return resident?.accountId || this.city.units.get(f.unitId)?.ownerId;
    }
    if(f.homeIds?.length){for(const id of f.homeIds){const home=this.city.housing.homes.get(id),resident=home&&this.city.housing.residents(home).find(c=>this.city.society.isAdult(c));if(resident)return resident.accountId;}}
    return b.accountId;
  }
  selectCompany(site) {
    const companies=this.city.economy.businesses.filter(b=>b.type==='cleaner' && (this.city.economy.workingOwner(b) || b.workers.length && b.balance>=b.wage) && this.city.economy.connected(b,site));
    const load=b=>this.jobs.filter(j=>j.providerId===b.id && !['completed','cancelled'].includes(j.status)).length/Math.max(1,b.workers.length+(b.ownerId?1:0));
    return companies.sort((a,b)=>load(a)-load(b)||a.id-b.id)[0]||null;
  }
  rebalanceWaiting() {
    for(const job of this.jobs.filter(j=>!j.workerId && !['completed','cancelled'].includes(j.status))) {
      const f=this.facilities.get(job.facilityId),site=f && this.city.building(f.buildingId);if(!site)continue;
      const company=this.selectCompany(site);if(!company)continue;
      if(!job.fee){const fee=Math.ceil(this.city.currency.price(SANITATION_RULES.cleaningPrice)*(job.payerId==='treasury'?1.5:1));if(!this.city.transfer(job.payerId,job.accountId,fee,'Reserva de limpeza por nova prestadora'))continue;job.fee=fee;}
      job.providerId=company.id;
    }
  }
  requestCleaning(facilityId, payerId = null, providerId = null) {
    const f = this.facilities.get(facilityId); if (!f || f.cleaningJobId || f.cleanliness >= 99) return null;
    const interval = f.access === 'public' ? SANITATION_RULES.freeCleaningInterval : f.access === 'paid' ? SANITATION_RULES.paidCleaningInterval : SANITATION_RULES.privateCleaningInterval;
    if (f.cleanliness >= 35 && this.city.minute - f.lastCleanedAt < interval) return null;
    const payer = this.payer(f); if (!payer || (payerId && payerId !== payer)) return null;
    const b = this.city.building(f.buildingId);
    const company = providerId ? this.city.economy.businesses.find(p=>p.id===providerId && p.type==='cleaner' && this.city.economy.connected(p,b)) : this.selectCompany(b);
    if (providerId && !company) return null;
    // The weekly municipal crew is a fallback only for free public toilets.
    if (!company && f.access !== 'public') return null;
    const fee = company ? Math.ceil(this.city.currency.price(SANITATION_RULES.cleaningPrice)*(payer==='treasury'?1.5:1)) : 0;
    if ((this.city.accounts.get(payer)?.balance || 0) < fee) return null;
    const id = this.nextJobId++, accountId = `cleaning:${id}`;
    this.city.accounts.set(accountId, { name: `Limpeza ${id}`, balance: 0 });
    if (!this.city.transfer(payer, accountId, fee, 'Reserva de limpeza', {jobId:id})) { this.city.accounts.delete(accountId); return null; }
    const job = { id, facilityId, providerId: company?.id || null, payerId: payer, accountId, fee, status: 'waiting', workerId: null, labor: 0, createdAt: this.city.minute };
    this.jobs.push(job); f.cleaningJobId = id; return job;
  }
  worker(job) {
    const b = this.city.building(job.providerId), hall = this.city.buildings.find(b => b.type === 'townhall');
    const ids = b ? [...b.workers, b.ownerId] : hall?.workers || [];
    return ids.map(id => this.city.society.citizen(id)).find(c => c && c.role!=='councilor' && !c.deliveryId && !c.cleaningJobId && !c.workMeal && !c.conversation && !this.city.urgentNeed(c));
  }
  releaseCitizen(c) {
    for (const f of this.facilities.values()) if (f.occupantId === c.id) f.occupantId = null;
    const job = this.jobs.find(j => j.workerId === c.id && j.status !== 'completed' && j.status !== 'cancelled');
    if (job) { job.workerId = null; job.status = 'waiting'; }
    c.cleaningJobId = null;
  }
  updateMinute() {
    for (const job of this.jobs) {
      if (['completed', 'cancelled'].includes(job.status)) continue;
      const f = this.facilities.get(job.facilityId), site = f && this.city.building(f.buildingId);
      if (!f || !site) {
        const c = this.city.society.citizen(job.workerId); if (c) { c.cleaningJobId = null; c.task = null; c.path = []; }
        this.city.transfer(job.accountId, this.city.accounts.get(job.payerId)?.entity?.destroyed ? 'treasury' : job.payerId, this.city.accounts.get(job.accountId).balance, 'Estorno de limpeza'); job.status = 'cancelled'; continue;
      }
      let c = this.city.society.citizen(job.workerId);
      if (c && this.city.urgentNeed(c)) { this.releaseCitizen(c); c.task = null; c.path = []; c = null; }
      if (!c && this.city.minute % 5 === 0 && this.city.hour >= 7 && this.city.hour < 19) {
        c = this.worker(job); const path = c && this.city.findPath(c.entity, site.door);
        if (!c || path === null) continue;
        c.cleaningJobId = job.id; c.task = 'clean'; c.servicePaid = null; c.targetId = site.id; c.path = path; job.workerId = c.id; job.status = 'working';
      }
      if (!c || c.workMeal || c.task==='workmeal' || c.conversation || c.path.length) continue;
      if(c.task!=='clean'){c.task='clean';c.targetId=site.id;}
      if (Math.hypot(c.entity.x - site.door.x, c.entity.y - site.door.y) > 2) { const path = this.city.findPath(c.entity, site.door); if (path) c.path = path; else this.releaseCitizen(c); continue; }
      const room=this.city.units.get(this.facilities.get(job.facilityId)?.unitId);if(room&&!activityRoomReady(this.city,c,site,room,'bathroom'))continue;
      const employer = this.city.building(job.providerId);
      if (employer && c.id !== employer.ownerId) {
        if (employer.balance < employer.wage) { this.releaseCitizen(c); continue; }
        this.city.payWage(c, employer);
      }
      job.labor += 1 + (c.skills.cleaning || 0) / 50; c.action = 'Limpando banheiro'; this.city.economy.practice(c, 'cleaning');
      if (job.labor >= 20) {
        f.cleanliness = 100; f.lastCleanedAt = this.city.minute; f.cleaningJobId = null; this.cleaned++;
        this.city.transfer(job.accountId, employer?.accountId || 'treasury', job.fee, 'Serviço de limpeza', {jobId:job.id});
        if (this.city.accounts.get(job.payerId)?.entity?.properties.cityBuilding) this.city.accounts.get(job.payerId).totalExpenses += job.fee;
        this.city.history.record('service',`Limpeza de banheiro em ${site.entity.properties.name}.`,[job.payerId,employer?.accountId,site.accountId,c.accountId],{amount:job.fee,jobId:job.id});
        this.city.reputation.completed(employer,c,'faxina concluída',{jobId:job.id});
        job.status = 'completed'; job.completedAt = this.city.minute; c.cleaningJobId = null; c.task = null; c.path = [];
        this.city.log(`Banheiro em ${site.entity.properties.name} foi limpo por ${employer?.entity.properties.name || 'equipe municipal'}.`, 'sanitation', [c.id], { kind: 'cleaning-completed', facilityId: f.id, jobId: job.id });
      }
    }
    for (const f of this.facilities.values()) if (f.occupantId && (!this.city.society.citizen(f.occupantId) || this.city.minute >= f.busyUntil)) f.occupantId = null;
  }
  wasteMetrics() {
    const city=this.city,buildings=city.buildings.filter(b=>!b.entity.destroyed);
    const loads=city.logistics.shipments.filter(s=>s.good==='lixo' && !['delivered','cancelled'].includes(s.status));
    const processors=buildings.filter(b=>['recycler','composting'].includes(b.type));
    return {
      awaiting:buildings.filter(b=>!['waste_collector','recycler','composting'].includes(b.type)).reduce((n,b)=>n+(b.inventory.lixo||0)+(b.litter||0),0),
      atCollectors:buildings.filter(b=>b.type==='waste_collector').reduce((n,b)=>n+(b.inventory.lixo||0)+(b.litter||0),0),
      atProcessors:processors.reduce((n,b)=>n+(b.inventory.lixo||0)+(b.litter||0),0),
      collecting:loads.filter(s=>s.purpose==='waste-collection').reduce((n,s)=>n+s.quantity,0),
      transferring:loads.filter(s=>s.purpose!=='waste-collection').reduce((n,s)=>n+s.quantity,0),
      total:city.goodsStock('lixo'),processed:city.economy.consumed.lixo,
    };
  }
  hourly() {
    this.rebalanceWaiting();
    for (const f of this.facilities.values()) if (f.cleanliness < (f.access === 'paid' ? 85 : 60)) this.requestCleaning(f.id);
    const city=this.city,hall=city.buildings.find(b=>b.type==='townhall'&&!b.entity.destroyed);if(hall)this.setupBusinessRooms(hall);
    const collectors=city.economy.businesses.filter(b=>b.type==='waste_collector');
    const processors=city.economy.businesses.filter(b=>['recycler','composting'].includes(b.type));
    const activeLoads=()=>city.logistics.shipments.filter(s=>!['delivered','cancelled'].includes(s.status));
    for (const b of city.buildings.filter(b=>!b.entity.destroyed)) {
      // Keep spilled and stored waste conserved while deliveries clear bin space.
      if (b.litter>0) {const n=Math.min(b.litter,inventoryFree(b));b.inventory.lixo+=n;b.litter-=n;}
      if(b.inventory.lixo<2 || ['waste_collector','recycler','composting'].includes(b.type))continue;
      if(activeLoads().some(s=>s.seller===b && s.purpose==='waste-collection'))continue;
      const options=collectors.filter(c=>inventoryFree(c)>=2 && city.economy.connected(c,b)).sort((a,d)=>inventoryFree(d)-inventoryFree(a)||a.id-d.id);
      const f=[...this.facilities.values()].find(f=>f.buildingId===b.id);
      let payer=['residential','super_popular_housing','popular_housing','popular_luxury_housing','luxury_housing'].includes(b.type)?b.units[0]?.ownerId:f?this.payer(f):b.accountId;
      if(!b.active)payer=b.units[0]?.ownerId||payer;
      if(!payer)continue;
      for(const collector of options) {
        const quantity=Math.min(24,b.inventory.lixo,inventoryFree(collector));
        const fee=Math.ceil(city.currency.price(200+quantity*50)*(payer==='treasury'?1.5:1));
        const order=city.logistics.order(b,collector,'lixo',quantity,0,{payerAccountId:payer,purpose:'waste-collection',serviceFee:fee,serviceAccountId:collector.accountId});
        if(order)break;
      }
    }
    // Alternate destinations so recycling and composting both receive physical inputs.
    const offset=(this.processorCursor||0)%Math.max(1,processors.length);
    const ordered=[...processors.slice(offset),...processors.slice(0,offset)];this.processorCursor=offset+1;
    for(const processor of ordered) {
      let need=Math.max(0,12-processor.inventory.lixo-(processor.incoming.lixo||0));
      for(const seller of collectors) {
        const quantity=Math.min(24,seller.inventory.lixo,inventoryFree(processor),need);
        if(quantity>0 && city.logistics.order(seller,processor,'lixo',quantity,city.economy.goods.lixo.price,{purpose:'waste-processing'}))need-=quantity;
      }
    }
  }

  recycle(b, c) {
    if (b.inventory.lixo < SANITATION_RULES.wasteToStone) return false;
    b.recyclingLabor = (b.recyclingLabor || 0) + 1 + (c.skills.recycling || 0) / 60;
    if (b.recyclingLabor >= 8) {
      b.recyclingLabor -= 8; b.inventory.lixo -= SANITATION_RULES.wasteToStone; b.inventory.pedra++; b.recycledStone=(b.recycledStone||0)+1; b.wasteProcessed=(b.wasteProcessed||0)+SANITATION_RULES.wasteToStone;
      this.city.history.record('production','Reciclagem: lixo transformado em pedra.',[b.accountId],{good:'pedra',quantity:1,waste:SANITATION_RULES.wasteToStone});
      this.city.economy.consumed.lixo += SANITATION_RULES.wasteToStone; this.city.economy.produced.pedra++;
      this.city.economy.recordGoods('recycling-input', 'lixo', SANITATION_RULES.wasteToStone, b.id, null); this.city.economy.recordGoods('recycling-output', 'pedra', 1, null, b.id);
    }
    return true;
  }
  reconcile() { for (const [id, f] of this.facilities) if (!this.city.building(f.buildingId) || (f.unitId && !this.city.units.has(f.unitId))) this.facilities.delete(id); }
}
