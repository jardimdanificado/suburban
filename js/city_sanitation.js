import { inventoryFree } from './city_inventory.js';
export const SANITATION_RULES = { dirtPerUse: 6, freeCleaningInterval: 7 * 1440, paidCleaningInterval: 180, privateCleaningInterval: 1440, cleaningPrice: 180, usePrice: 150, wastePerUse: 1, wasteToStone: 2 };
const clamp = n => Math.max(0, Math.min(100, n));
export class CitySanitation {
  constructor(city) { this.city = city; this.facilities = new Map(); this.jobs = []; this.nextJobId = 1; this.cleaned = 0; this.collected = 0; }
  addFacility(b, { unitId = null, homeId = null, access = 'employees' } = {}) {
    const id = `toilet:${unitId || b.id}`;
    if (this.facilities.has(id)) return this.facilities.get(id);
    const f = { id, buildingId: b.id, unitId, homeId, access, price: access === 'paid' ? this.city.currency.price(SANITATION_RULES.usePrice) : 0, cleanliness: 100, uses: 0, occupantId: null, busyUntil: 0, createdAt: this.city.minute, lastCleanedAt: this.city.minute, cleaningJobId: null };
    this.facilities.set(id, f); return f;
  }
  setupBuilding(b) {
    b.litter ??= 0;
    if (b.type === 'residential') {
      for (const u of b.units.filter(u => u.roomType === 'bathroom')) this.addFacility(b, { unitId: u.id, homeId: u.homeId, access: 'home' });
    } else {
      const access = ['townhall', 'public_toilet'].includes(b.type) ? 'public' : b.type === 'paid_toilet' ? 'paid' : 'employees';
      const u = b.units.find(u => u.roomType === 'bathroom') || b.units.at(-1);
      if (u) u.roomType = 'bathroom';
      this.addFacility(b, { unitId: u?.id || null, access });
    }
  }
  allowed(c, f) {
    const b = this.city.building(f.buildingId); if (!b) return false;
    if (f.access === 'public' || f.access === 'paid') return f.price <= (this.city.accounts.get(this.city.payerFor(c))?.balance || 0);
    if (f.access === 'employees') return b.active && (c.jobId === b.id || c.id === b.ownerId);
    const home = this.city.housing.homes.get(f.homeId); if (!home) return false;
    const residents = this.city.housing.residents(home);
    if (residents.some(p => p.id === c.id)) return true;
    if (!residents.length && this.city.units.get(f.unitId)?.ownerId === c.accountId) return true;
    return residents.some(p => { const r = this.city.society.getRelation(c, p); return r && r.affection >= 65 && r.trust >= 50 && ['close', 'partner'].includes(r.status); });
  }
  choose(c) {
    const options = [...this.facilities.values()].filter(f => this.allowed(c, f) && (!f.occupantId || f.occupantId === c.id || this.city.minute >= f.busyUntil));
    options.sort((a, b) => this.score(c, a) - this.score(c, b));
    for (const f of options) {
      const b = this.city.building(f.buildingId), path = this.city.findPath(c.entity, b.door); if (path === null) continue;
      c.toiletTargetId = f.id; c.task = 'toilet'; c.targetId = b.id; c.path = path; return true;
    }
    return false;
  }
  score(c, f) {
    const b = this.city.building(f.buildingId);
    return Math.hypot(c.entity.x - b.door.x, c.entity.y - b.door.y) + (100 - f.cleanliness) * .12 + f.price / 50 - (f.homeId === c.homeId ? 8 : 0) - (c.jobId === b.id ? 4 : 0);
  }
  addWaste(b, amount = 1) {
    const stored = Math.min(amount, inventoryFree(b)); b.inventory.lixo += stored; b.litter += amount - stored;
    this.city.economy.produced.lixo += amount;
    this.city.economy.recordGoods('waste', 'lixo', amount, null, b.id);
  }
  use(c) {
    const f = this.facilities.get(c.toiletTargetId), b = f && this.city.building(f.buildingId);
    if (!f || !b || !this.allowed(c, f) || (f.occupantId && f.occupantId !== c.id && this.city.minute < f.busyUntil)) { c.task = null; c.toiletTargetId = null; return false; }
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
    if (f.homeId) {
      const home = this.city.housing.homes.get(f.homeId), resident = home && this.city.housing.residents(home).find(c => this.city.society.isAdult(c));
      return resident?.accountId || this.city.units.get(f.unitId)?.ownerId;
    }
    return b.accountId;
  }
  requestCleaning(facilityId, payerId = null, providerId = null) {
    const f = this.facilities.get(facilityId); if (!f || f.cleaningJobId || f.cleanliness >= 99) return null;
    const interval = f.access === 'public' ? SANITATION_RULES.freeCleaningInterval : f.access === 'paid' ? SANITATION_RULES.paidCleaningInterval : SANITATION_RULES.privateCleaningInterval;
    if (this.city.minute - f.lastCleanedAt < interval) return null;
    const payer = this.payer(f); if (!payer || (payerId && payerId !== payer)) return null;
    const b = this.city.building(f.buildingId);
    const company = this.city.economy.businesses.filter(b => b.type === 'cleaner' && (!providerId || b.id === providerId)).sort((a, d) => a.id - d.id).find(p => this.city.economy.connected(p, b));
    if (providerId && !company) return null;
    // The weekly municipal crew is a fallback only for free public toilets.
    if (!company && f.access !== 'public') return null;
    const fee = company ? this.city.currency.price(SANITATION_RULES.cleaningPrice) : 0;
    if ((this.city.accounts.get(payer)?.balance || 0) < fee) return null;
    const id = this.nextJobId++, accountId = `cleaning:${id}`;
    this.city.accounts.set(accountId, { name: `Limpeza ${id}`, balance: 0 });
    if (!this.city.transfer(payer, accountId, fee, 'Reserva de limpeza')) { this.city.accounts.delete(accountId); return null; }
    const job = { id, facilityId, providerId: company?.id || null, payerId: payer, accountId, fee, status: 'waiting', workerId: null, labor: 0, createdAt: this.city.minute };
    this.jobs.push(job); f.cleaningJobId = id; return job;
  }
  worker(job) {
    const b = this.city.building(job.providerId), hall = this.city.buildings.find(b => b.type === 'townhall');
    const ids = b ? [...b.workers, b.ownerId] : hall?.workers || [];
    return ids.map(id => this.city.society.citizen(id)).find(c => c && !c.deliveryId && !c.cleaningJobId && !c.workMeal && !c.conversation && !this.city.urgentNeed(c));
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
      if (!c || c.workMeal || c.conversation || c.path.length) continue;
      if (Math.hypot(c.entity.x - site.door.x, c.entity.y - site.door.y) > 2) { const path = this.city.findPath(c.entity, site.door); if (path) c.path = path; else this.releaseCitizen(c); continue; }
      const employer = this.city.building(job.providerId);
      if (employer && c.id !== employer.ownerId) {
        if (employer.balance < employer.wage) { this.releaseCitizen(c); continue; }
        this.city.payWage(c, employer);
      }
      job.labor += 1 + (c.skills.cleaning || 0) / 50; c.action = 'Limpando banheiro'; this.city.economy.practice(c, 'cleaning');
      if (job.labor >= 20) {
        f.cleanliness = 100; f.lastCleanedAt = this.city.minute; f.cleaningJobId = null; this.cleaned++;
        this.city.transfer(job.accountId, employer?.accountId || 'treasury', job.fee, 'Serviço de limpeza');
        if (this.city.accounts.get(job.payerId)?.entity?.properties.cityBuilding) this.city.accounts.get(job.payerId).totalExpenses += job.fee;
        job.status = 'completed'; job.completedAt = this.city.minute; c.cleaningJobId = null; c.task = null; c.path = [];
        this.city.log(`Banheiro em ${site.entity.properties.name} foi limpo por ${employer?.entity.properties.name || 'equipe municipal'}.`, 'sanitation', [c.id], { kind: 'cleaning-completed', facilityId: f.id, jobId: job.id });
      }
    }
    for (const f of this.facilities.values()) if (f.occupantId && (!this.city.society.citizen(f.occupantId) || this.city.minute >= f.busyUntil)) f.occupantId = null;
  }
  hourly() {
    for (const f of this.facilities.values()) if (f.cleanliness < (f.access === 'paid' ? 85 : 60)) this.requestCleaning(f.id);
    const collectors = this.city.economy.businesses.filter(b => b.type === 'waste_collector');
    for (const b of this.city.buildings.filter(b => !b.entity.destroyed)) {
      // Spilled waste remains visible and conserved; free space lets it return to the bin.
      if (b.litter > 0) { const n = Math.min(b.litter, inventoryFree(b)); b.inventory.lixo += n; b.litter -= n; }
      if (b.inventory.lixo < 12 || ['waste_collector', 'recycler'].includes(b.type)) continue;
      const collector = collectors.find(c => inventoryFree(c) >= 3); if (!collector) continue;
      const quantity = Math.min(24, b.inventory.lixo, inventoryFree(collector)), fee = this.city.currency.price(200 + quantity * 50);
      const f = [...this.facilities.values()].find(f => f.buildingId === b.id), payer = b.type === 'residential' ? b.units[0]?.ownerId : f ? this.payer(f) : b.accountId;
      if (!payer) continue;
      const order = this.city.logistics.order(b, collector, 'lixo', quantity, 0, { payerAccountId: payer, purpose: 'waste-collection', serviceFee: fee, serviceAccountId: collector.accountId });
      if (order) this.collected += quantity;
    }
    for (const recycler of this.city.economy.businesses.filter(b => b.type === 'recycler')) for (const seller of collectors) {
      const n = Math.min(24, seller.inventory.lixo, inventoryFree(recycler), Math.max(0, 24 - recycler.inventory.lixo - (recycler.incoming.lixo || 0)));
      if (n > 0) this.city.logistics.order(seller, recycler, 'lixo', n, this.city.economy.goods.lixo.price);
    }
  }
  recycle(b, c) {
    if (b.inventory.lixo < SANITATION_RULES.wasteToStone) return false;
    b.recyclingLabor = (b.recyclingLabor || 0) + 1 + (c.skills.recycling || 0) / 60;
    if (b.recyclingLabor >= 8) {
      b.recyclingLabor -= 8; b.inventory.lixo -= SANITATION_RULES.wasteToStone; b.inventory.pedra++;
      this.city.economy.consumed.lixo += SANITATION_RULES.wasteToStone; this.city.economy.produced.pedra++;
      this.city.economy.recordGoods('recycling-input', 'lixo', SANITATION_RULES.wasteToStone, b.id, null); this.city.economy.recordGoods('recycling-output', 'pedra', 1, null, b.id);
    }
    return true;
  }
  reconcile() { for (const [id, f] of this.facilities) if (!this.city.building(f.buildingId) || (f.unitId && !this.city.units.has(f.unitId))) this.facilities.delete(id); }
}
