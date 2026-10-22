import { inventoryFree, initializeInventory } from './city_inventory.js';
import { inspectBuildingSite, tileAt } from './city_terrain.js';

export const SKILLS = { agriculture: 'Agricultura', baking: 'Panificação', commerce: 'Comércio', management: 'Gestão', governance: 'Administração pública', medicine: 'Saúde', maintenance: 'Manutenção', social: 'Comunicação', care: 'Cuidados', construction: 'Construção', mining: 'Mineração', logistics: 'Logística' };
export const CROPS = {
  maca: { label: 'Maçã', grow: 180, price: 100 }, goiaba: { label: 'Goiaba', grow: 160, price: 100 },
  trigo: { label: 'Trigo', grow: 120, price: 90 }, milho: { label: 'Milho', grow: 100, price: 95 },
  mandioca: { label: 'Mandioca', grow: 200, price: 105 }, cebola: { label: 'Cebola', grow: 140, price: 95 },
  feijao: { label: 'Feijão', grow: 150, price: 100 }, coentro: { label: 'Coentro', grow: 80, price: 90 },
};
export const GOODS = { ...CROPS, pao: { label: 'Pão', price: 110 }, pedra: { label: 'Pedra', price: 70 }, sementes: { label: 'Sementes', price: 5 } };
export const PRIVATE_TYPES = new Set(['farm', 'bakery', 'greengrocer', 'market', 'builder', 'quarry', 'carrier']);
export const PUBLIC_TYPES = new Set(['townhall', 'clinic', 'utility', 'leisure']);
const retailTypes = new Set(['bakery', 'greengrocer', 'market']);
const edible = Object.keys(CROPS).filter(g => g !== 'trigo');
export const JOB_SKILL = { farm: 'agriculture', bakery: 'baking', market: 'commerce', greengrocer: 'commerce', townhall: 'governance', clinic: 'medicine', utility: 'maintenance', leisure: 'social', builder: 'construction', quarry: 'mining', carrier: 'logistics' };
export const ECONOMY_RULES = { richCount: 3, richCapital: 400000, workingCapital: 20000, mealUnits: 3, farmBatch: 12, farmLabor: 120 };

export class CityEconomy {
  constructor(city) {
    this.city = city; this.goods = GOODS; this.crops = CROPS;
    this.mayorId = null;
    this.demands = [];
    this.goodsLedger = [];
    this.produced = Object.fromEntries(Object.keys(GOODS).map(g => [g, 0]));
    this.consumed = Object.fromEntries(Object.keys(GOODS).map(g => [g, 0]));
    this.consumed.trigo = 0;
    this.initialStock = Object.fromEntries(Object.keys(GOODS).map(g => [g, 0]));
    this.lost = Object.fromEntries(Object.keys(GOODS).map(g => [g, 0]));
    this.failedMeals = 0;
    this.routeCache = new Map();
  }
  citizen(id) { return this.city.society.citizen(id); }
  initializeCitizen(c, index, options) {
    c.wealthTier = options.wealthTier || (options.grant === false ? 'worker' : index < ECONOMY_RULES.richCount ? 'wealthy' : 'worker');
    c.skills = Object.fromEntries(Object.keys(SKILLS).map(skill => [skill, options.age === 0 ? 0 : 2 + this.city.random() * 16]));
    if (options.age !== 0) c.skills[Object.keys(SKILLS)[index % Object.keys(SKILLS).length]] += 15;
    c.businessIds = []; c.provisions = options.grant === false ? 0 : 3;
    c.rentalPreference = .65 + this.city.random() * .3;
    c.lastPaidAt = this.city.minute; c.mealAllowanceToday = 0; c.foodVoucher = null; c.workMeal = null;
  }
  practice(c, skill, minutes = 1) {
    if (!c || !(skill in SKILLS) || minutes <= 0 || !Number.isFinite(minutes)) return;
    c.skills[skill] = Math.min(100, c.skills[skill] + minutes * .025 / (1 + c.skills[skill] / 25));
  }
  setupBuilding(b) {
    initializeInventory(b, GOODS, b.type === 'townhall' ? 6000 : Math.max(160, b.width * b.depth * b.floors * (b.type === 'quarry' ? 40 : 16)));
    Object.defineProperty(b, 'seedStock', { get() { return this.inventory.sementes; }, set(value) { this.inventory.sementes = value; }, configurable: true });
    b.ownerId = null; b.active = PUBLIC_TYPES.has(b.type);
    b.crop = null; b.fields = []; b.seedStock = 0; b.bakingLabor = 0;
    b.mealsServed = 0; b.mealPurchaseCost = 0; b.foodVoucherCost = 0; b.vouchersIssued = 0;
    b.totalRevenue = 0; b.totalExpenses = 0; b.dividends = 0;
    b.foundedAt = null; b.lastSaleAt = this.city.minute; b.stockouts = 0;
    b.jobs = ({ residential: 0, townhall: 2, clinic: 2, utility: 2, leisure: 1, farm: 1, bakery: 2, market: 2, greengrocer: 2, builder: 3, quarry: 2, carrier: 2 })[b.type] ?? 0;
    b.wage = b.type === 'farm' || b.type === 'quarry' ? 8 : b.type === 'bakery' || b.type === 'builder' || b.type === 'carrier' ? 6 : 5;
    if (b.type === 'townhall') b.wage = 7;
  }
  get businesses() { return this.city.buildings.filter(b => PRIVATE_TYPES.has(b.type) && b.active && !b.entity.destroyed); }
  initialize() {
    this.appointMayor();
    const hall = this.city.buildings.find(b => b.type === 'townhall');
    hall.inventory.pao = this.city.citizens.length * ECONOMY_RULES.mealUnits * 24;
    this.initialStock.pao += hall.inventory.pao;
    for (const [index, type] of ['builder', 'quarry'].entries()) {
      const founder = this.city.citizens.filter(c => c.wealthTier === 'wealthy')[index];
      const b = this.city.buildings.find(b => b.type === type);
      if (b && founder) this.purchasePremises(b, founder, null);
    }
    this.city.development.ensurePlots();
    this.hire();
    this.updateDemand();
  }
  appointMayor() {
    if (this.citizen(this.mayorId)) return;
    const candidates = this.city.citizens.filter(c => this.city.society.isAdult(c) && c.wealthTier !== 'wealthy');
    candidates.sort((a, b) => b.skills.governance - a.skills.governance || a.id - b.id);
    const mayor = candidates[0]; if (!mayor) return;
    this.leaveJob(mayor); this.mayorId = mayor.id; mayor.role = 'mayor';
    const hall = this.city.buildings.find(b => b.type === 'townhall' && !b.entity.destroyed);
    if (hall) { mayor.jobId = hall.id; hall.workers.push(mayor.id); }
    this.city.log(`${mayor.entity.properties.name} assumiu a prefeitura e administra o patrimônio e o orçamento públicos.`, 'government', [mayor.id], { kind: 'mayor-appointed' });
  }
  leaveJob(c) {
    const employer = this.city.building(c.jobId);
    if (employer) employer.workers = employer.workers.filter(id => id !== c.id);
    c.jobId = null; c.task = null; c.path = [];
  }
  municipalPolicy() {
    for (const u of this.city.units.values()) if (u.ownerId === 'treasury') {
      const occupant = this.city.accounts.get(u.tenantId);
      if (occupant?.homeUnitId === u.id) this.city.releaseHome(occupant);
      u.tenantId = null; u.forSale = true; u.forRent = false; u.arrears = 0; u.missedDays = 0;
    }
  }
  investInHousing(initial = false) {
    const city = this.city;
    const investors = city.citizens.filter(c => city.society.isAdult(c) && c.wealthTier === 'wealthy');
    const homeless = city.citizens.filter(c => !c.homeUnitId && c.wealthTier !== 'wealthy').length;
    let available = [...city.units.values()].filter(u => city.building(u.buildingId)?.type === 'residential' && u.ownerId !== 'treasury' && !u.tenantId && u.forRent).length;
    for (const c of investors) {
      if (!c.homeUnitId) {
        const u = [...city.units.values()].find(u => city.building(u.buildingId)?.type === 'residential' && u.forSale && !u.tenantId && u.ownerId !== c.accountId);
        if (u && city.buyUnit(c.id, u.id)) city.rentUnit(c.id, u.id);
      }
    }
    const needed = Math.max(0, homeless + 3 - available);
    for (let i = 0; i < needed; i++) {
      const c = investors.filter(c => c.balance > (initial ? 140000 : 65000)).sort((a, b) => b.balance - a.balance || a.id - b.id)[0];
      const u = [...city.units.values()].filter(u => city.building(u.buildingId)?.type === 'residential' && !u.tenantId && u.forSale && u.ownerId !== c?.accountId).sort((a, b) => a.price - b.price || a.id.localeCompare(b.id))[0];
      if (!c || !u || !city.buyUnit(c.id, u.id)) break;
      u.forRent = true; u.forSale = false; available++;
      this.city.log(`${c.entity.properties.name} colocou o apartamento ${u.id} para alugar.`, 'housing', [c.id], { kind: 'private-rental', unitId: u.id });
    }
  }
  assignHomes() {
    for (const c of this.city.citizens) {
      if (c.entity.destroyed || c.homeUnitId) continue;
      if (!this.city.society.isAdult(c)) { this.city.society.houseChild(c); continue; }
      const owned = [...this.city.units.values()].find(u => this.city.building(u.buildingId)?.type === 'residential' && u.ownerId === c.accountId && !u.tenantId);
      if (owned) { this.city.rentUnit(c.id, owned.id); continue; }
      const affordable = [...this.city.units.values()].filter(u => this.city.building(u.buildingId)?.type === 'residential' && u.ownerId !== 'treasury' && u.forRent && !u.tenantId && u.rent <= c.balance).sort((a, b) => a.rent - b.rent || a.id.localeCompare(b.id));
      if (affordable[0]) this.city.rentUnit(c.id, affordable[0].id);
      else {
        const purchase = [...this.city.units.values()].filter(u => this.city.building(u.buildingId)?.type === 'residential' && u.forSale && !u.tenantId && c.balance >= u.price + 3000).sort((a, b) => a.price - b.price)[0];
        if (purchase && this.city.buyUnit(c.id, purchase.id)) this.city.rentUnit(c.id, purchase.id);
      }
    }
  }
  hiringScore(c, b) {
    const skill = c.skills[JOB_SKILL[b.type]] || 0, owner = this.citizen(b.ownerId);
    const relation = owner ? this.city.society.getRelation(owner, c) : null;
    return skill * .75 + (relation ? relation.trust * .15 + relation.affection * .1 : 0);
  }
  hire() {
    this.appointMayor();
    for (const c of this.city.citizens) if (c.jobId && c.id !== this.mayorId) {
      const b = this.city.building(c.jobId);
      if (!b || !b.active || (b.balance < b.wage && this.city.minute - c.lastPaidAt > 1440)) this.leaveJob(c);
    }
    const offers = this.city.buildings.filter(b => b.active && b.jobs > b.workers.length && !b.entity.destroyed);
    // Give the supply chain access to labor before filling secondary public vacancies.
    offers.sort((a, b) => Number(PRIVATE_TYPES.has(b.type)) - Number(PRIVATE_TYPES.has(a.type)) || Number(b.type === 'farm') - Number(a.type === 'farm'));
    for (const b of offers) {
      const candidates = this.city.citizens.filter(c => this.city.society.isAdult(c) && !c.entity.destroyed && !c.jobId && c.wealthTier !== 'wealthy' && c.id !== this.mayorId);
      candidates.sort((a, c) => this.hiringScore(c, b) - this.hiringScore(a, b) || a.id - c.id);
      for (const c of candidates.slice(0, b.jobs - b.workers.length)) {
        c.jobId = b.id; c.profession = JOB_SKILL[b.type]; b.workers.push(c.id);
        this.city.log(`${c.entity.properties.name} foi contratado em ${b.entity.properties.name}, considerando habilidade e vínculos com o proprietário.`, 'work', [c.id, b.ownerId].filter(Boolean), { kind: 'employment', buildingId: b.id, skill: c.skills[JOB_SKILL[b.type]], score: this.hiringScore(c, b) });
      }
    }
  }
  connected(a, b) {
    const key = [a.id, b.id].sort((x, y) => x - y).join(':') + `:${this.city.world.revision ?? 0}:${this.city.buildings.length}`;
    if (!this.routeCache.has(key)) {
      if (this.routeCache.size > 1000) this.routeCache.clear();
      this.routeCache.set(key, this.city.findPath(a.door, b.door) !== null);
    }
    return this.routeCache.get(key);
  }
  updateDemand() {
    const population = this.city.citizens.filter(c => !c.entity.destroyed).length;
    const businesses = this.businesses;
    const farms = businesses.filter(b => b.type === 'farm');
    const buyers = businesses.filter(b => retailTypes.has(b.type));
    for (const b of businesses) b.inputDemand = b.type === 'bakery' ? { trigo: Math.max(0, 24 - b.inventory.trigo) } : !retailTypes.has(b.type) ? {} : Object.fromEntries(edible.filter(g => this.accepts(b, g)).map(g => [g, Math.max(0, 12 - b.inventory[g])]));
    const items = [];
    const pending = this.city.logistics.shipments.filter(s => !['delivered', 'cancelled'].includes(s.status)).length;
    items.push({ type: 'carrier', crop: null, score: businesses.some(b => b.type === 'carrier') ? 0 : pending > 0 ? 115 : 25, reason: `${pending} fretes aguardando transporte ou em trânsito` });
    items.push({ type: 'quarry', crop: null, score: businesses.some(b => b.type === 'quarry') ? 0 : 140, reason: 'Obras precisam de pedras' });
    items.push({ type: 'builder', crop: null, score: businesses.some(b => b.type === 'builder') ? 0 : 130, reason: 'A cidade precisa construir moradias e instalações' });
    for (const type of ['market', 'greengrocer', 'bakery']) {
      const count = businesses.filter(b => b.type === type).length;
      const target = Math.max(1, Math.ceil(population / (type === 'market' ? 32 : 36)));
      const shortage = Math.max(0, target - count);
      items.push({ type, crop: null, score: shortage ? ({ market: 90, greengrocer: 85, bakery: 80 })[type] + shortage * 10 : 0, reason: count ? 'População e capacidade de atendimento' : 'Este tipo de comércio ainda não existe' });
    }
    for (const [crop, spec] of Object.entries(CROPS)) {
      const producers = farms.filter(b => b.crop === crop);
      const stock = businesses.reduce((sum, b) => sum + b.inventory[crop], 0);
      const downstream = crop === 'trigo' ? businesses.filter(b => b.type === 'bakery').length * population * 2 : buyers.filter(b => this.accepts(b, crop)).length;
      const dailyNeed = crop === 'trigo' ? (downstream > 0 ? Math.ceil(population * 2) : 0) : Math.ceil(population * 6 / edible.length);
      const capacity = producers.length * 30;
      const missing = Math.max(0, dailyNeed - capacity);
      const inputShortage = buyers.reduce((sum, b) => sum + (b.inputDemand?.[crop] || 0), 0);
      const score = dailyNeed === 0 ? 0 : producers.length ? Math.max(0, missing * 2 + inputShortage * .7 - stock) : 35 + (downstream > 0 ? 32 : 0) + (crop === 'trigo' && downstream > 0 ? 25 : 0);
      items.push({ type: 'farm', crop, score, required: dailyNeed, supply: capacity, stock, reason: crop === 'trigo' && downstream ? 'Padarias precisam de trigo' : downstream ? `Lojas precisam de ${spec.label.toLowerCase()}` : 'Diversidade da alimentação local' });
    }
    this.demands = items.sort((a, b) => b.score - a.score);
    return this.demands;
  }
  accepts(b, good) {
    if (b.type === 'bakery') return good === 'trigo';
    if (b.type === 'greengrocer') return edible.includes(good) && good !== 'feijao' && good !== 'milho';
    return b.type === 'market' && (edible.includes(good) || good === 'pao');
  }
  locateBuilding(type) {
    const city = this.city, center = city.world.spawnCenter;
    const width = type === 'farm' ? 4 : 3, depth = type === 'farm' ? 4 : 3, floors = type === 'farm' ? 1 : 2;
    const candidates = [];
    for (let radius = 8; radius <= 48; radius += 3) {
      for (let i = 0; i < 24; i++) {
        const angle = i * Math.PI / 12 + (city.initialSeed % 7) * .1;
        const x = Math.floor(center.x + Math.cos(angle) * radius), y = Math.floor(center.y + Math.sin(angle) * radius);
        if (inspectBuildingSite(city, x, y, width, depth).error) continue;
        if (city.citizens.some(c => c.entity.x >= x && c.entity.x < x + width && c.entity.y >= y && c.entity.y < y + depth)) continue;
        if (type === 'farm') {
          let fertile = 0;
          for (let yy = y; yy < y + depth; yy++) for (let xx = x; xx < x + width; xx++) if ([0, 9].includes(tileAt(city.world, xx, yy))) fertile++;
          if (fertile < width * depth * .75) continue;
        }
        candidates.push({ x, y, width, depth, floors });
      }
      if (candidates.length >= 120) break;
    }
    return candidates;
  }
  quote(type, building = null) {
    const cells = building ? building.units.length : type === 'farm' ? 16 : 18;
    return cells * ({ farm: 180, market: 1000, bakery: 1000, greengrocer: 1000, quarry: 500, builder: 1000, carrier: 1000 })[type] + ECONOMY_RULES.workingCapital;
  }
  activateBusiness(b, founder, crop = null, capitalize = true) {
    if (!founder) return null;
    b.ownerId = founder.id; b.crop = crop; b.active = true; b.foundedAt = this.city.minute;
    b.fields = b.type === 'farm' ? [{ labor: 0, plantedAt: null }, { labor: 0, plantedAt: null }] : [];
    if (b.type === 'quarry') b.stoneReserve ??= 12000;
    for (const u of b.units) { u.forSale = u.forRent = false; u.occupantId = b.accountId; }
    if (!founder.businessIds.includes(b.id)) founder.businessIds.push(b.id);
    const amount = Math.min(ECONOMY_RULES.workingCapital, founder.balance);
    if (capitalize && amount) this.city.transfer(founder.accountId, b.accountId, amount, 'Capital de empresa');
    if (!capitalize && b.balance === 0) this.city.transfer(founder.accountId, b.accountId, Math.min(ECONOMY_RULES.workingCapital, founder.balance), 'Capital de empresa');
    if (founder.jobId) this.leaveJob(founder);
    this.city.log(`${founder.entity.properties.name} fundou ${b.entity.properties.name}${crop ? ` para cultivar ${CROPS[crop].label.toLowerCase()}` : ''}.`, 'business', [founder.id], { kind: 'business-founded', buildingId: b.id, type: b.type, crop });
    this.buySeeds(b); return b;
  }
  purchasePremises(b, founder, crop) {
    if (!b || b.active || b.entity.destroyed || !founder || !this.city.society.isAdult(founder) || founder.id === this.mayorId || !PRIVATE_TYPES.has(b.type) || !b.units.every(u => u.ownerId === 'treasury' && u.forSale)) return null;
    const price = b.units.reduce((sum, u) => sum + u.price, 0);
    if (founder.balance < price + ECONOMY_RULES.workingCapital || !this.city.transfer(founder.accountId, 'treasury', price, 'Compra de instalações para empresa')) return null;
    for (const u of b.units) u.ownerId = founder.accountId;
    const plot = this.city.development.plots.find(p => p.id === b.plotId); if (plot) { plot.ownerId = founder.accountId; plot.forSale = false; }
    this.activateBusiness(b, founder, crop); return b;
  }
  foundBusiness(founderId, type, crop = null) {
    const city = this.city, founder = this.citizen(founderId);
    if (!founder || !city.society.isAdult(founder) || !PRIVATE_TYPES.has(type) || founder.id === this.mayorId || (type === 'farm' && !CROPS[crop])) return null;
    if (city.development.projects.some(p => p.ownerId === founder.id && p.type === type && p.crop === crop && !p.cancelled && p.status !== 'completed')) return null;
    const existing = city.buildings.find(b => b.type === type && !b.active && !b.entity.destroyed && b.units.every(u => u.ownerId === 'treasury' && u.forSale));
    if (existing) return this.purchasePremises(existing, founder, crop);
    city.development.ensurePlots();
    const fertile = p => type !== 'farm' || Array.from({ length: p.width * p.depth }, (_, i) => tileAt(city.world, p.x + i % p.width, p.y + Math.floor(i / p.width))).filter(t => [0, 9].includes(t)).length >= p.width * p.depth * .75;
    let lot = city.development.plots.find(p => p.ownerId === founder.accountId && !p.buildingId && !p.projectId && fertile(p));
    if (!lot) {
      const available = city.development.plots.find(p => p.ownerId === 'treasury' && p.forSale && !p.buildingId && !p.projectId && fertile(p));
      if (!available || founder.balance < available.price + this.quote(type) + 15000) return null;
      lot = city.development.buyPlot(founder.accountId, available.id);
    }
    if (!lot) return null;
    const project = city.development.beginProject(founder.accountId, lot.id, type, { crop });
    this.hire(); this.updateDemand(); return project;
  }
  invest() {
    this.updateDemand();
    const investors = this.city.citizens.filter(c => this.city.society.isAdult(c) && c.wealthTier === 'wealthy' && c.id !== this.mayorId && c.businessIds.length < 6).sort((a, b) => b.balance - a.balance || a.id - b.id);
    const unemployment = this.city.citizens.filter(c => this.city.society.isAdult(c) && c.wealthTier !== 'wealthy' && !c.jobId).length;
    const opportunities = this.demands.filter(d => d.score >= 30).map(d => ({ ...d, priority: d.score * (.9 + this.city.random() * .2) })).sort((a, b) => b.priority - a.priority);
    for (const opportunity of opportunities) {
      const same = [...this.businesses, ...this.city.development.projects.filter(p => p.status !== 'completed' && !p.cancelled)].filter(b => b.type === opportunity.type && (opportunity.type !== 'farm' || b.crop === opportunity.crop));
      if (same.length && (unemployment === 0 || same.some(b => b.status))) continue;
      const candidates = investors.filter(c => c.balance >= this.quote(opportunity.type) + 3000);
      for (const investor of candidates) if (this.foundBusiness(investor.id, opportunity.type, opportunity.crop)) return true;
    }
    return false;
  }
  buySeeds(b) {
    if (b.type !== 'farm' || !b.active || b.seedStock >= 8) return;
    const qty = Math.min(24 - b.seedStock, Math.floor(b.balance / 5), inventoryFree(b));
    if (qty > 0 && this.city.transfer(b.accountId, 'supplier', qty * 5, 'Compra de sementes')) { b.seedStock += qty; this.initialStock.sementes += qty; }
  }
  recordGoods(kind, good, quantity, from, to) {
    this.goodsLedger.push({ minute: this.city.minute, kind, good, quantity, from, to });
    if (this.goodsLedger.length > 2000) this.goodsLedger.shift();
  }
  transferGoods(seller, buyer, good, quantity, unitPrice) {
    if (!GOODS[good]) return false;
    return this.city.logistics.order(seller, buyer, good, quantity, unitPrice);
  }

  trade() {
    const businesses = this.businesses;
    for (const buyer of businesses.filter(b => retailTypes.has(b.type))) {
      for (const good of Object.keys(GOODS).filter(g => this.accepts(buyer, g))) {
        const target = buyer.type === 'bakery' ? 24 : 12;
        let remaining = Math.max(0, target - buyer.inventory[good] - (buyer.incoming[good] || 0));
        const sellers = businesses.filter(b => b !== buyer && (b.type === 'farm' || b.type === 'bakery') && b.inventory[good] > 0).sort((a, b) => Math.hypot(a.door.x - buyer.door.x, a.door.y - buyer.door.y) - Math.hypot(b.door.x - buyer.door.x, b.door.y - buyer.door.y));
        for (const seller of sellers) {
          const reserve = buyer.workers.length * buyer.wage * 90;
          const quantity = Math.min(24, inventoryFree(buyer), remaining, seller.inventory[good], Math.max(0, Math.floor((buyer.balance - reserve) / GOODS[good].price)));
          if (quantity > 0 && this.transferGoods(seller, buyer, good, quantity, GOODS[good].price)) remaining -= quantity;
        }
      }
    }
  }
  inventory(b) { if (!b) return 0; return edible.reduce((sum, good) => sum + b.inventory[good], 0) + b.inventory.pao; }
  mealOffer(b) {
    if (!b?.active || b.entity.destroyed || (!retailTypes.has(b.type) && b.type !== 'townhall')) return null;
    const goods = b.type === 'bakery' ? ['pao'] : [...edible, 'pao'];
    const good = goods.filter(g => b.inventory[g] >= ECONOMY_RULES.mealUnits).sort((a, c) => b.inventory[c] - b.inventory[a])[0];
    if (!good) return null;
    return { good, quantity: ECONOMY_RULES.mealUnits, price: b.type === 'townhall' ? 0 : (good === 'pao' ? 160 : GOODS[good].price + 65) * ECONOMY_RULES.mealUnits };
  }
  consumeMeal(c, b) {
    const offer = this.mealOffer(b); if (!offer) { this.failedMeals++; if (b) b.stockouts++; return false; }
    if (!this.city.transfer(this.city.payerFor(c), b.accountId, offer.price, `Serviço: Alimentação (${GOODS[offer.good].label})`)) return false;
    b.inventory[offer.good] -= offer.quantity; b.lastSaleAt = this.city.minute;
    this.consumed[offer.good] += offer.quantity;
    this.recordGoods('consumption', offer.good, offer.quantity, b.id, c.id);
    return true;
  }
  farmWork(b, c) {
    this.buySeeds(b);
    // Harvest needs both elapsed growth time and accumulated human labor.
    for (const field of b.fields) {
      if (field.plantedAt === null) {
        if (b.seedStock < 4 || b.inventory[b.crop] >= 36) continue;
        b.seedStock -= 4; field.plantedAt = this.city.minute; field.labor = 0;
        this.consumed.sementes += 4; this.recordGoods('sowing', 'sementes', 4, b.id, null);
      }
      if (field.labor < ECONOMY_RULES.farmLabor) {
        field.labor = Math.min(ECONOMY_RULES.farmLabor, field.labor + 1 + c.skills.agriculture / 60);
        this.harvest(b, field); return true;
      }
      if (this.harvest(b, field)) return true;
    }
    return false;
  }
  harvest(b, field) {
    if (inventoryFree(b) < ECONOMY_RULES.farmBatch || field.plantedAt === null || field.labor < ECONOMY_RULES.farmLabor || this.city.minute - field.plantedAt < CROPS[b.crop].grow) return false;
    b.inventory[b.crop] += ECONOMY_RULES.farmBatch; this.produced[b.crop] += ECONOMY_RULES.farmBatch;
    this.recordGoods('harvest', b.crop, ECONOMY_RULES.farmBatch, null, b.id);
    this.city.log(`${b.entity.properties.name} colheu ${ECONOMY_RULES.farmBatch} unidades de ${CROPS[b.crop].label.toLowerCase()}.`, 'production', [b.ownerId], { kind: 'harvest', buildingId: b.id, crop: b.crop, quantity: ECONOMY_RULES.farmBatch });
    field.plantedAt = null; field.labor = 0; return true;
  }
  productionWork(b, c) {
    if (b.type === 'farm') return this.farmWork(b, c);
    if (b.type === 'builder') return this.city.development.work(this.city.development.projectFor(c, b), c);
    if (b.type === 'quarry') {
      if (b.stoneReserve <= 0 || inventoryFree(b) < 1) return false;
      b.miningLabor = (b.miningLabor || 0) + 1 + c.skills.mining / 60;
      if (b.miningLabor >= 3) { b.miningLabor -= 3; b.inventory.pedra++; b.stoneReserve--; this.produced.pedra++; this.recordGoods('mining', 'pedra', 1, null, b.id); }
      return true;
    }
    if (b.type === 'carrier') return false;
    if (b.type === 'bakery') {
      if (b.inventory.trigo < 2 || b.inventory.pao >= 36 || inventoryFree(b) < 1) return false;
      b.bakingLabor += 1 + c.skills.baking / 60;
      if (b.bakingLabor >= 8) {
        b.bakingLabor -= 8; b.inventory.trigo -= 2; b.inventory.pao += 3;
        this.produced.pao += 3; this.consumed.trigo += 2;
        this.recordGoods('recipe-input', 'trigo', 2, b.id, null); this.recordGoods('baking', 'pao', 3, null, b.id);
      }
      return true;
    }
    return true;
  }
  hourly() {
    for (const c of this.city.citizens) if (c.wealthTier === 'worker' && c.balance >= 160000 && c.id !== this.mayorId && this.city.society.isAdult(c)) {
      c.wealthTier = 'wealthy'; this.leaveJob(c); this.city.log(`${c.entity.properties.name} acumulou capital e passou a buscar investimentos próprios.`, 'business', [c.id], { kind: 'new-investor' });
    }
    this.appointMayor(); this.municipalPolicy(); this.assignHomes(); this.hire();
    this.city.development.updateHourly();
    this.trade(); this.city.workMeals.purchase(); this.updateDemand();
    if (this.city.hour % 2 === 0) { this.investInHousing(); this.invest(); }
  }
  daily() {
    this.municipalPolicy();
    for (const b of this.businesses) {
      const owner = this.citizen(b.ownerId);
      if (!owner) continue;
      if (b.balance < 5000 && owner.balance > 15000) this.city.transfer(owner.accountId, b.accountId, Math.min(10000, owner.balance - 10000), 'Aporte do proprietário');
      const profit = Math.max(0, b.totalRevenue - b.totalExpenses - b.dividends);
      const dividend = Math.min(Math.floor(profit * .35), Math.max(0, b.balance - 18000));
      if (dividend > 0 && this.city.transfer(b.accountId, owner.accountId, dividend, 'Distribuição de lucros')) b.dividends += dividend;
    }
    for (const owner of this.city.citizens) if (!owner.entity.destroyed && this.city.society.isAdult(owner)) {
      for (const u of this.city.units.values()) if (u.ownerId === owner.accountId && this.city.building(u.buildingId)?.type === 'residential' && u.id !== owner.homeUnitId) {
        if (u.tenantId) continue;
        // Owners choose liquidity or rental income according to reserves and preference.
        u.forSale = owner.balance < 2500 || owner.rentalPreference < .75;
        u.forRent = !u.forSale;
      }
    }
    this.investInHousing(); this.assignHomes(); this.updateDemand();
  }
  removeCitizen(c) {
    if (c.id === this.mayorId) this.mayorId = null;
    for (const b of this.businesses.filter(b => b.ownerId === c.id)) {
      b.ownerId = null; b.active = false;
      for (const id of b.workers) { const worker = this.citizen(id); if (worker) this.leaveJob(worker); }
      for (const u of b.units) { u.occupantId = null; u.forSale = true; }
      this.city.transfer(b.accountId, 'treasury', b.balance, 'Encerramento de empresa sem proprietário');
    }
  }
}
