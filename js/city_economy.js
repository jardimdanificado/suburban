import { INDUSTRIES, INDUSTRIAL_GOODS, INDUSTRIAL_FOODS } from './city_industries.js';
import { quarryDeposits } from './city_terrain.js';
import { inventoryFree, initializeInventory } from './city_inventory.js';
import { inspectBuildingSite, tileAt } from './city_terrain.js';

export const SKILLS = { agriculture: 'Agricultura', baking: 'Panificação', commerce: 'Comércio', management: 'Gestão', governance: 'Administração pública', medicine: 'Saúde', maintenance: 'Manutenção', social: 'Comunicação', care: 'Cuidados', construction: 'Construção', mining: 'Mineração', logistics: 'Logística', cleaning: 'Faxina', recycling: 'Reciclagem', minting: 'Cunhagem' };
export const CROPS = {
  girassol: { label: 'Girassol', grow: 180, price: 140 },
  maca: { label: 'Maçã', grow: 180, price: 100 }, goiaba: { label: 'Goiaba', grow: 160, price: 100 },
  trigo: { label: 'Trigo', grow: 120, price: 90 }, milho: { label: 'Milho', grow: 100, price: 95 },
  mandioca: { label: 'Mandioca', grow: 200, price: 105 }, cebola: { label: 'Cebola', grow: 140, price: 95 },
  feijao: { label: 'Feijão', grow: 150, price: 100 }, coentro: { label: 'Coentro', grow: 80, price: 90 },
};
export const GOODS = { ...INDUSTRIAL_GOODS, ...CROPS, oleo: { label: 'Óleo de girassol', price: 450 }, pao: { label: 'Pão', price: 180 }, pedra: { label: 'Pedra', price: 10000 }, sementes: { label: 'Sementes', price: 10 }, lixo: { label: 'Lixo', price: 20 } };
export const PRIVATE_TYPES = new Set([...Object.keys(INDUSTRIES), 'farm', 'bakery', 'greengrocer', 'market', 'builder', 'quarry', 'carrier', 'cleaner', 'waste_collector', 'recycler', 'paid_toilet', 'mill']);
export const PUBLIC_TYPES = new Set(['townhall', 'clinic', 'utility', 'leisure', 'public_toilet', 'mint', 'popular_housing', 'luxury_housing', 'popular_refectory']);
const retailTypes = new Set(['bakery', 'greengrocer', 'market']);
const edible = [...Object.keys(CROPS).filter(g => !['trigo', 'girassol'].includes(g)), ...INDUSTRIAL_FOODS];
export const JOB_SKILL = { ...Object.fromEntries(Object.entries(INDUSTRIES).map(([id,s])=>[id,s.skill])), mill: 'maintenance', farm: 'agriculture', bakery: 'baking', market: 'commerce', greengrocer: 'commerce', popular_refectory: 'care', townhall: 'governance', clinic: 'medicine', utility: 'maintenance', leisure: 'social', builder: 'construction', quarry: 'mining', carrier: 'logistics', cleaner: 'cleaning', waste_collector: 'logistics', recycler: 'recycling', paid_toilet: 'cleaning', public_toilet: 'maintenance', mint: 'minting' };
export const ECONOMY_RULES = { workingCapital: 20000, mealUnits: 3, farmBatch: 12, farmLabor: 120 };
export const MEAL_RECIPES = {
  pao: { label: 'Pão simples', inputs: { pao: 3 }, quality: 1 },
  refogado: { label: 'Refeição de feijão e cebola', inputs: { feijao: 2, cebola: 1 }, quality: 2 },
  prato_completo: { label: 'Prato completo', inputs: { feijao: 1, milho: 1, mandioca: 1 }, quality: 3 },
  refeicao_especial: { label: 'Refeição especial', inputs: { pao: 1, feijao: 1, maca: 1, coentro: 1 }, quality: 4 },
};

export class CityEconomy {
  constructor(city) {
    this.city = city; this.goods = Object.fromEntries(Object.entries(GOODS).map(([id, spec]) => [id, { label: spec.label, get price() { return city.currency.price(spec.price); } }])); this.crops = CROPS; this.recipes = MEAL_RECIPES;
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
    c.skills = Object.fromEntries(Object.keys(SKILLS).map(skill => [skill, options.age === 0 ? 0 : 2 + this.city.random() * 16]));
    if (options.age !== 0) c.skills[Object.keys(SKILLS)[index % Object.keys(SKILLS).length]] += 15;
    c.foodPreferences = Object.fromEntries([...edible, ...Object.keys(CROPS), 'pao', 'oleo', ...Object.keys(MEAL_RECIPES)].map(g => [g, (((Math.imul(c.id + 17, 2654435761) ^ Math.imul(g.split('').reduce((n, ch) => n * 31 + ch.charCodeAt(0), 0), 1597334677)) >>> 0) % 201 - 100) / 100]));
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
    b.mealQuality = b.type === 'popular_refectory' ? 2 : 1;
    b.totalRevenue = 0; b.totalExpenses = 0; b.dividends = 0;
    b.foundedAt = null; b.lastSaleAt = this.city.minute; b.stockouts = 0;
    b.jobs = ({ mill: 2, mint: 1, residential: 0, popular_housing: 0, luxury_housing: 0, popular_refectory: 4, townhall: 2, clinic: 2, utility: 2, leisure: 1, farm: 1, bakery: 2, market: 2, greengrocer: 2, builder: 3, quarry: 2, carrier: 2, cleaner: 2, waste_collector: 2, recycler: 2, paid_toilet: 1, public_toilet: 0 })[b.type] ?? INDUSTRIES[b.type]?.jobs ?? 0;
    b.baseWage = b.type === 'farm' || b.type === 'quarry' ? 8 : b.type === 'bakery' || b.type === 'builder' || b.type === 'carrier' ? 6 : 5;
    if (b.type === 'townhall') b.baseWage = 7;
    Object.defineProperty(b, 'wage', { get: () => this.city.currency.price(b.baseWage), set: value => { b.baseWage = value / this.city.currency.priceIndex; }, configurable: true });
  }
  get businesses() { return this.city.buildings.filter(b => PRIVATE_TYPES.has(b.type) && b.active && !b.entity.destroyed); }
  initialize() {
    this.appointMayor();
    const hall = this.city.buildings.find(b => b.type === 'townhall');
    hall.inventory.pao = this.city.citizens.length * ECONOMY_RULES.mealUnits * 24;
    this.initialStock.pao += hall.inventory.pao;
    // Public starter firms keep construction and extraction available without privileged founders.
    for (const [type, budget] of [['builder', 2000000], ['quarry', 500000]]) {
      const b = this.city.buildings.find(b => b.type === type);
      if (b) this.activateMunicipalBusiness(b, budget);
    }
    this.city.development.ensurePlots();
    this.hire();
    this.updateDemand();
  }
  appointMayor() {
    if (this.citizen(this.mayorId)) return;
    const candidates = this.city.citizens.filter(c => this.city.society.isAdult(c) && !c.businessIds.length);
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
    for (const u of this.city.units.values()) if (u.ownerId === 'treasury' && !['residential', 'popular_housing', 'luxury_housing'].includes(this.city.building(u.buildingId)?.type)) {
      const occupant = this.city.accounts.get(u.tenantId);
      if (occupant?.homeUnitId === u.id) this.city.releaseHome(occupant);
      u.tenantId = null; u.forSale = true; u.forRent = false; u.arrears = 0; u.missedDays = 0;
    }
  }
  investInHousing(initial = false) { this.city.housing.invest(initial); }
  assignHomes() { this.city.housing.assign(); }
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
    const offers = this.city.buildings.filter(b => b.active && b.jobs > 0 && !b.entity.destroyed);
    const available = () => this.city.citizens.filter(c => this.city.society.isAdult(c) && !c.entity.destroyed && !c.jobId && !c.businessIds.length && c.id !== this.mayorId);
    const priority = ['mint', 'bakery', 'market', 'greengrocer', 'farm', 'quarry', 'carrier', 'cleaner', 'waste_collector', 'recycler', 'paid_toilet', 'builder', 'mint', 'townhall'];
    const underserved = offers.filter(b => !b.workers.length).length;
    // Give each operating firm its first employee before filling additional posts elsewhere.
    for (let shortage = underserved - available().length; shortage > 0; shortage--) {
      const donor = offers.filter(b => b.workers.length > 1 && b.workers.some(id => { const c = this.citizen(id); return c && c.id !== this.mayorId && !c.deliveryId && !c.cleaningJobId; })).sort((a, b) => b.workers.length - a.workers.length)[0];
      if (!donor) break;
      const worker = donor.workers.map(id => this.citizen(id)).filter(c => c && c.id !== this.mayorId && !c.deliveryId && !c.cleaningJobId).sort((a, b) => this.hiringScore(a, donor) - this.hiringScore(b, donor))[0];
      this.leaveJob(worker);
    }
    offers.sort((a, b) => Number(a.workers.length > 0) - Number(b.workers.length > 0) || (priority.indexOf(a.type) < 0 ? 99 : priority.indexOf(a.type)) - (priority.indexOf(b.type) < 0 ? 99 : priority.indexOf(b.type)));
    const recruit = (b, count) => {
      const candidates = available().sort((a, c) => this.hiringScore(c, b) - this.hiringScore(a, b) || a.id - c.id);
      for (const c of candidates.slice(0, Math.min(count, b.jobs - b.workers.length))) {
        c.jobId = b.id; c.profession = JOB_SKILL[b.type]; b.workers.push(c.id);
        this.city.log(`${c.entity.properties.name} foi contratado em ${b.entity.properties.name}, considerando habilidade e vínculos com o proprietário.`, 'work', [c.id, b.ownerId].filter(Boolean), { kind: 'employment', buildingId: b.id, skill: c.skills[JOB_SKILL[b.type]], score: this.hiringScore(c, b) });
      }
    };
    // Owner-operated farms can keep producing without an employee. Move their employees
    // to vacant services before leaving the mint or food processors permanently unstaffed.
    for (const b of offers.filter(b => !b.workers.length && b.type !== 'farm')) {
      if (available().length) break;
      const donor = offers.find(f => f.type === 'farm' && this.citizen(f.ownerId) && f.workers.some(id => { const c=this.citizen(id);return c && !c.deliveryId && !c.cleaningJobId; }));
      const worker = donor?.workers.map(id=>this.citizen(id)).find(c=>c && !c.deliveryId && !c.cleaningJobId);
      if (!worker) break;
      this.leaveJob(worker); recruit(b, 1);
    }
    for (const b of offers) if (!b.workers.length) recruit(b, 1);
    for (const b of offers) recruit(b, b.jobs - b.workers.length);
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
    for (const b of businesses) b.inputDemand = b.type==='mill'?{girassol:Math.max(0,36-b.inventory.girassol-(b.incoming.girassol||0))}:INDUSTRIES[b.type] ? Object.fromEntries(Object.entries(INDUSTRIES[b.type].inputs).map(([g,n])=>[g,Math.max(0,n*6-b.inventory[g]-(b.incoming[g]||0))])) : b.type === 'bakery' ? { trigo: Math.max(0, 24 - b.inventory.trigo) } : !retailTypes.has(b.type) ? {} : Object.fromEntries(edible.filter(g => this.accepts(b, g)).map(g => [g, Math.max(0, 12 - b.inventory[g])]));
    const items = [{ type: 'mill', crop: null, score: Math.max(0,110+this.city.lighting.posts.length*8-businesses.filter(b=>b.type==='mill').length*110), reason: 'Óleo para iluminação pública' }, { type: 'farm', crop: 'girassol', score: farms.some(b => b.crop === 'girassol') ? 0 : 110, reason: 'Girassóis para os moinhos' }];
    const facilities = [...this.city.sanitation.facilities.values()], waste = this.city.buildings.reduce((n, b) => n + (b.inventory.lixo || 0) + (b.litter || 0), 0);
    for (const [type, needed, reason] of [['cleaner', facilities.some(f => f.cleanliness < 65), 'Banheiros precisam de limpeza'], ['waste_collector', waste >= 8, 'Lixo acumulado precisa de coleta'], ['recycler', waste >= 12, 'Processar lixo gera pedras'], ['paid_toilet', facilities.length >= 3, 'Demanda por banheiros limpos e acessíveis']]) items.push({ type, crop: null, score: !needed ? 0 : !businesses.some(b=>b.type===type)?95:Math.max(0,(type==='cleaner'?facilities.filter(f=>f.cleanliness<65).length:type==='paid_toilet'?facilities.length:waste/4)*18-businesses.filter(b=>b.type===type).reduce((n,b)=>n+Math.max(1,b.workers.length)*40,0)), reason });
    const pending = this.city.logistics.shipments.filter(s => !['delivered', 'cancelled'].includes(s.status)).length + this.city.lighting.posts.filter(p=>p.fuel<=3 && !this.city.logistics.shipments.some(s=>s.buyer.lampPost===p && !['delivered','cancelled'].includes(s.status))).length;
    items.push({ type: 'carrier', crop: null, score: pending ? Math.max(0,115+pending*8-businesses.filter(b=>b.type==='carrier').reduce((n,b)=>n+Math.max(1,b.workers.length)*32,0)) : 0, reason: `${pending} fretes aguardando transporte ou em trânsito` });
    items.push({ type: 'quarry', crop: null, score: !businesses.some(b=>b.type==='quarry')?140:Math.max(0,this.city.development.projects.filter(p=>!p.cancelled && p.status!=='completed').reduce((n,p)=>n+Math.max(0,p.stone-p.inventory.pedra-(p.incoming.pedra||0)),0)-businesses.filter(b=>b.type==='quarry').reduce((n,b)=>n+b.inventory.pedra+Math.max(1,b.workers.length)*120,0)), reason: 'Obras precisam de pedras' });
    items.push({ type: 'builder', crop: null, score: Math.max(0, 110+this.city.development.projects.filter(p=>!p.cancelled && p.status!=='completed').length*20-businesses.filter(b=>b.type==='builder').reduce((n,b)=>n+Math.max(1,b.workers.length)*45,0)), reason: 'A cidade precisa construir moradias e instalações' });
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
      const capacity = producers.reduce((n,b)=>n+b.fields.length*15,0);
      const missing = Math.max(0, dailyNeed - capacity);
      const inputShortage = businesses.reduce((sum, b) => sum + (b.inputDemand?.[crop] || 0), 0);
      const score = dailyNeed === 0 ? 0 : producers.length ? Math.max(0, missing * 2 + inputShortage * .7 - stock) : 35 + (downstream > 0 ? 32 : 0) + (crop === 'trigo' && downstream > 0 ? 25 : 0);
      items.push({ type: 'farm', crop, score, required: dailyNeed, supply: capacity, stock, reason: crop === 'trigo' && downstream ? 'Padarias precisam de trigo' : downstream ? `Lojas precisam de ${spec.label.toLowerCase()}` : 'Diversidade da alimentação local' });
    }
    for (const [type,spec] of Object.entries(INDUSTRIES)) {
      const firms=businesses.filter(b=>b.type===type);
      const needed=Object.keys(spec.outputs).reduce((n,g)=>n+businesses.reduce((sum,b)=>sum+(b.inputDemand?.[g]||0),0)+(spec.use?population*.3:INDUSTRIAL_FOODS.includes(g)?population*.7:0),0);
      const stock=Object.keys(spec.outputs).reduce((n,g)=>n+businesses.reduce((v,b)=>v+(b.inventory[g]||0),0),0);
      const supply=firms.reduce((n,b)=>n+Math.max(1,b.workers.length)*240/spec.labor*Object.values(spec.outputs).reduce((a,v)=>a+v,0),0);
      const score=type==='bank' ? firms.length?0:65 : Math.min(125,Math.max(0,needed-stock-supply*.5)+(firms.length?0:25));
      items.push({type,crop:null,score,required:Math.ceil(needed),supply:Math.floor(supply),stock,reason:spec.impact});
    }
    this.demands = items.sort((a, b) => b.score - a.score);
    return this.demands;
  }
  accepts(b, good) {
    if (INDUSTRIES[b.type]) return good in INDUSTRIES[b.type].inputs;
    if (b.type === 'mill') return good === 'girassol';
    if (b.type === 'bakery') return good === 'trigo';
    if (b.type === 'greengrocer') return edible.includes(good) && good !== 'feijao' && good !== 'milho';
    return b.type === 'market' && (edible.includes(good) || good === 'pao' || good==='oleo');
  }
  locateBuilding(type) {
    const city = this.city, center = city.world.spawnCenter;
    const width = type === 'farm' ? 10 : 3, depth = type === 'farm' ? 10 : 3, floors = type === 'farm' ? 1 : 2;
    const candidates = [];
    for (let radius = 8; radius <= 48; radius += 3) {
      for (let i = 0; i < 24; i++) {
        const angle = i * Math.PI / 12 + (city.initialSeed % 7) * .1;
        const x = Math.floor(center.x + Math.cos(angle) * radius), y = Math.floor(center.y + Math.sin(angle) * radius);
        if (inspectBuildingSite(city, x, y, width, depth, { type }).error) continue;
        if (['quarry','iron_mine'].includes(type) && city.world.map && !quarryDeposits(city.world, x, y, width, depth).length) continue;
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
  premisesPrice(b) {
    const property = b.units.reduce((n, u) => n + u.price, 0) + (this.city.development.plots.find(p => p.id === b.plotId)?.price || 0);
    // Buying an operating public company also pays for its cash and saleable inventories.
    return b.type === 'farm' ? Math.min(property, 1000) : property + (b.municipal ? b.balance + Object.entries(b.inventory).reduce((n, [good, qty]) => n + qty * this.goods[good].price, 0) : 0);
  }
  quote(type, building = null) {
    if (building) return this.premisesPrice(building) + this.city.currency.price(type==='bank'?200000:ECONOMY_RULES.workingCapital);
    if (type === 'farm') return this.city.currency.price(ECONOMY_RULES.workingCapital);
    const cells = 18;
    return cells * (2 * this.goods.pedra.price + this.city.currency.price(10000)) + this.city.currency.price(type==='bank'?200000:ECONOMY_RULES.workingCapital);
  }

  activateMunicipalBusiness(b, budget = 50000, crop = null) {
    b.municipal = true; b.ownerId = null; b.active = true; b.crop = crop; b.foundedAt = this.city.minute;
    b.fields = b.type === 'farm' ? Array.from({length: Math.max(2, Math.floor(b.width*b.depth/12))},()=>({labor:0,plantedAt:null})) : [];
    if (b.type === 'farm') b.jobs = Math.max(1, Math.ceil(b.fields.length/3));
    if (b.type === 'quarry') b.stoneReserve ??= 12000;
    for (const u of b.units) { u.forSale = true; u.forRent = false; u.occupantId = b.accountId; }
    this.city.transfer('treasury', b.accountId, Math.min(budget, this.city.treasury), 'Capital de empresa municipal');
    this.buySeeds(b);return b;
  }
  activateBusiness(b, founder, crop = null, capitalize = true) {
    if (!founder) return null;
    b.ownerId = founder.id; b.crop = crop; b.active = true; b.foundedAt = this.city.minute;
    b.fields = b.type === 'farm' ? Array.from({length: Math.max(2, Math.floor(b.width*b.depth/12))},()=>({labor:0,plantedAt:null})) : [];
    if (b.type === 'farm') b.jobs = Math.max(1, Math.ceil(b.fields.length/3));
    if (b.type === 'quarry') b.stoneReserve ??= 12000;
    for (const u of b.units) { u.forSale = u.forRent = false; u.occupantId = b.accountId; }
    if (!founder.businessIds.includes(b.id)) founder.businessIds.push(b.id);
    const amount = Math.min(this.city.currency.price(b.type==='bank'?200000:ECONOMY_RULES.workingCapital), founder.balance);
    if (capitalize && amount) this.city.transfer(founder.accountId, b.accountId, amount, 'Capital de empresa');
    if (!capitalize && b.balance === 0) this.city.transfer(founder.accountId, b.accountId, Math.min(this.city.currency.price(b.type==='bank'?200000:ECONOMY_RULES.workingCapital), founder.balance), 'Capital de empresa');
    if (founder.jobId) this.leaveJob(founder);
    this.city.log(`${founder.entity.properties.name} fundou ${b.entity.properties.name}${crop ? ` para cultivar ${CROPS[crop].label.toLowerCase()}` : ''}.`, 'business', [founder.id], { kind: 'business-founded', buildingId: b.id, type: b.type, crop });
    this.buySeeds(b); return b;
  }
  purchasePremises(b, founder, crop) {
    if (!b || (b.active && !b.municipal) || b.entity.destroyed || !founder || !this.city.society.isAdult(founder) || founder.id === this.mayorId || !PRIVATE_TYPES.has(b.type) || !b.units.every(u => u.ownerId === 'treasury' && u.forSale)) return null;
    const price = this.premisesPrice(b);
    if (founder.balance < price + this.city.currency.price(ECONOMY_RULES.workingCapital) || !this.city.transfer(founder.accountId, 'treasury', price, 'Compra de instalações para empresa')) return null;
    for (const u of b.units) u.ownerId = founder.accountId;
    const plot = this.city.development.plots.find(p => p.id === b.plotId); if (plot) { plot.ownerId = founder.accountId; plot.forSale = false; }
    b.municipal = false; this.activateBusiness(b, founder, crop); return b;
  }
  foundBusiness(founderId, type, crop = null) {
    const city = this.city, founder = this.citizen(founderId);
    if (!founder || !city.society.isAdult(founder) || !PRIVATE_TYPES.has(type) || founder.id === this.mayorId || (type === 'farm' && !CROPS[crop])) return null;
    if (city.development.projects.some(p => p.ownerId === founder.id && p.type === type && p.crop === crop && !p.cancelled && p.status !== 'completed')) return null;
    const existing = city.buildings.find(b => b.type === type && (!b.active || b.municipal) && !b.entity.destroyed && b.units.every(u => u.ownerId === 'treasury' && u.forSale));
    if (existing) return this.purchasePremises(existing, founder, crop);
    city.development.ensurePlots();
    const fertile = p => type === 'farm' ? city.development.isFarmPlot(p) : p.width <= 8 && p.depth <= 8 && (['quarry', 'iron_mine'].includes(type) ? (!city.world.map || p.type === 'quarry') : !['quarry', 'farm'].includes(p.type));
    let lot = city.development.plots.find(p => p.ownerId === founder.accountId && !p.buildingId && !p.projectId && fertile(p));
    if (!lot) {
      const available = city.development.plots.find(p => p.ownerId === 'treasury' && p.forSale && !p.buildingId && !p.projectId && fertile(p));
      if (!available || founder.balance < available.price + this.quote(type) + this.city.currency.price(15000)) return null;
      lot = city.development.buyPlot(founder.accountId, available.id);
    }
    if (!lot) return null;
    const project = city.development.beginProject(founder.accountId, lot.id, type, { crop });
    this.hire(); this.updateDemand(); return project;
  }
  invest() {
    this.updateDemand();
    const investors = this.city.citizens.filter(c => this.city.society.isAdult(c) && c.id !== this.mayorId && c.businessIds.length < 10).sort((a, b) => b.balance - a.balance || a.id - b.id);
    const opportunities = this.demands.filter(d => d.score >= 30).map(d => ({ ...d, priority: d.score * (.9 + this.city.random() * .2) })).sort((a, b) => b.priority - a.priority);
    for (const opportunity of opportunities) {
      const same = [...this.businesses, ...this.city.development.projects.filter(p => p.status !== 'completed' && !p.cancelled)].filter(b => b.type === opportunity.type && (opportunity.type !== 'farm' || b.crop === opportunity.crop));
      if (same.some(b => b.status) || (same.length && opportunity.score < 60)) continue;
      const threshold=this.quote(opportunity.type)+this.city.currency.price(15000);
      const banks=this.city.bank.available();
      const borrower=investors.find(c=>c.balance<threshold && c.balance>threshold*.4);
      if(borrower && banks.length) { this.city.bank.withdraw(banks[0],borrower.accountId,Math.min(threshold-borrower.balance,this.city.bank.deposits.get(`deposit:${banks[0].id}:${borrower.accountId}`)?.balance||0)); if(borrower.balance<threshold) this.city.bank.lend(banks[0],borrower.accountId,threshold-borrower.balance); }
      const candidates = investors.filter(c => c.balance >= threshold);
      for (const investor of candidates) if (this.foundBusiness(investor.id, opportunity.type, opportunity.crop)) return true;
    }
    // The municipality can establish essential services when households cannot finance premises.
    const pending = this.city.development.projects.filter(p => p.accountId === 'treasury' && !p.cancelled && p.status !== 'completed');
    const buildingSlotsFull = pending.filter(p => !p.service || p.service === 'building').length >= 2;
    const foodFarmMissing = !this.businesses.some(b => b.type === 'farm' && !['girassol', 'trigo'].includes(b.crop));
    const publicOpportunities = [...opportunities].sort((a, b) => Number(foodFarmMissing && b.type === 'farm' && !['girassol', 'trigo'].includes(b.crop)) - Number(foodFarmMissing && a.type === 'farm' && !['girassol', 'trigo'].includes(a.crop)) || b.priority - a.priority);
    this.city.development.ensurePlots();
    for (const opportunity of publicOpportunities) {
      // Open-air farming does not consume a masonry construction slot.
      if (buildingSlotsFull && opportunity.type !== 'farm') continue;
      if (pending.some(p => p.type === opportunity.type && p.crop === opportunity.crop)) continue;
      if (opportunity.score < 100 && this.businesses.some(b => b.type === opportunity.type && (b.type !== 'farm' || b.crop === opportunity.crop))) continue;
      if (this.city.treasury < this.quote(opportunity.type) + this.city.currency.price(100000)) continue;
      const lots = this.city.development.plots.filter(p => p.ownerId === 'treasury' && !p.buildingId && !p.projectId && (opportunity.type === 'farm' ? this.city.development.isFarmPlot(p) : p.width <= 8 && p.depth <= 8 && (['quarry', 'iron_mine'].includes(opportunity.type) ? p.type === 'quarry' : !['quarry', 'farm'].includes(p.type))));
      for (const lot of lots) {
        const project = this.city.development.beginProject('treasury', lot.id, opportunity.type, { crop: opportunity.crop, width: opportunity.type === 'farm' ? lot.width : Math.min(4, lot.width), depth: opportunity.type === 'farm' ? lot.depth : Math.min(4, lot.depth), floors: 1 });
        if (project) return true;
      }
    }
    return false;
  }
  buySeeds(b) {
    if (b.type !== 'farm' || !b.active || b.seedStock >= 8) return;
    const qty = Math.min(24 - b.seedStock, Math.floor(b.balance / this.goods.sementes.price), inventoryFree(b), Math.max(0, 12 - b.seedStock));
    const cost = qty * this.goods.sementes.price;
    if (qty > 0 && this.city.transfer(b.accountId, 'supplier', cost, 'Compra de sementes')) { b.seedStock += qty; this.initialStock.sementes += qty; b.totalExpenses += cost; }
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
    for(const farm of businesses.filter(b=>b.type==='farm' && b.inventory.adubo+(b.incoming.adubo||0)<4)) {const seller=businesses.find(b=>b.type==='composting' && b.inventory.adubo>0);if(seller)this.transferGoods(seller,farm,'adubo',Math.min(4,seller.inventory.adubo),this.goods.adubo.price);}
    for (const buyer of businesses.filter(b => retailTypes.has(b.type) || b.type === 'mill' || INDUSTRIES[b.type])) {
      for (const good of Object.keys(GOODS).filter(g => this.accepts(buyer, g))) {
        const target = INDUSTRIES[buyer.type]?.inputs[good] ? INDUSTRIES[buyer.type].inputs[good]*6 : buyer.type === 'bakery' ? 24 : 18;
        if (buyer.inventory[good] + (buyer.incoming[good] || 0) > target / 2) continue;
        let remaining = Math.max(0, target - buyer.inventory[good] - (buyer.incoming[good] || 0));
        const sellers = businesses.filter(b => b !== buyer && (b.type === 'farm' || b.type === 'bakery' || b.type === 'mill' || INDUSTRIES[b.type]?.outputs[good]) && b.inventory[good] > 0).sort((a, b) => Math.hypot(a.door.x - buyer.door.x, a.door.y - buyer.door.y) - Math.hypot(b.door.x - buyer.door.x, b.door.y - buyer.door.y));
        for (const seller of sellers) {
          const reserve = buyer.workers.length * buyer.wage * 90;
          const quantity = Math.min(24, inventoryFree(buyer), remaining, seller.inventory[good], Math.max(0, Math.floor((buyer.balance - reserve) / this.goods[good].price)));
          if (quantity > 0 && this.transferGoods(seller, buyer, good, quantity, this.goods[good].price)) remaining -= quantity;
        }
      }
    }
  }
  inventory(b) { if (!b) return 0; return edible.reduce((sum, good) => sum + b.inventory[good], 0) + b.inventory.pao; }
  mealTaste(c, offer) {
    if (!c || !offer) return 0;
    const preferences = c.foodPreferences || {};
    const ingredients = Object.keys(offer.inputs || {});
    return ((preferences[offer.good] || 0) + ingredients.reduce((sum, g) => sum + (preferences[g] || 0), 0)) / (ingredients.length + 1);
  }
  mealScore(c, b) {
    const offer = this.mealOffer(b, c);
    if (!offer || offer.price > (this.city.accounts.get(this.city.payerFor(c))?.balance || 0)) return Infinity;
    return Math.hypot(b.door.x - c.entity.x, b.door.y - c.entity.y) + offer.price / Math.max(1, this.city.currency.price(100)) - this.mealTaste(c, offer) * 45;
  }
  enjoyMeal(c, offer) {
    const taste = this.mealTaste(c, offer);
    c.lastMealTaste = taste;
    c.mood = Math.max(-25, Math.min(25, (c.mood || 0) + taste * 8));
  }
  mealOffer(b, citizen = null) {
    if (!b?.active || b.entity.destroyed || (!retailTypes.has(b.type) && b.type !== 'townhall' && b.type !== 'farm' && b.type !== 'popular_refectory' && INDUSTRIES[b.type]?.category !== 'food')) return null;
    const recipeSet = { ...Object.fromEntries([...edible, 'pao'].map(g => [`single_${g}`, { label: this.goods[g].label, inputs: { [g]: ECONOMY_RULES.mealUnits }, quality: 1 }])), ...this.recipes, refeicao_laticinios:{label:'Pão e queijo',inputs:{pao:1,queijo:1,leite:1},quality:3}, macarronada:{label:'Macarronada',inputs:{massa:2,cebola:1,oleo:1},quality:4}, salada_conserva:{label:'Salada com ovos',inputs:{conserva:1,ovos:1,coentro:1},quality:3} };
    const candidates = Object.entries(recipeSet).filter(([, r]) => Object.entries(r.inputs).every(([g, n]) => (b.inventory[g] || 0) >= n) && (!citizen || ['townhall', 'popular_refectory'].includes(b.type) || this.city.currency.price(Object.entries(r.inputs).reduce((sum, [g, n]) => sum + GOODS[g].price * n, 0)) <= (this.city.accounts.get(this.city.payerFor(citizen))?.balance || 0)));
    const fallback = this.foodOffer(b);
    if (!candidates.length && fallback) return { good: fallback.good, quantity: fallback.quantity, inputs: { [fallback.good]: fallback.quantity }, quality: 1, price: fallback.price };
    const [recipe, details] = candidates.sort((a, c) => (c[1].quality + (citizen ? this.mealTaste(citizen, { good: c[0], inputs: c[1].inputs }) * 10 : 0)) - (a[1].quality + (citizen ? this.mealTaste(citizen, { good: a[0], inputs: a[1].inputs }) * 10 : 0)))[0] || [];
    if (!recipe) return null;
    const inputValue = Object.entries(details.inputs).reduce((n, [g, q]) => n + (GOODS[g]?.price || 0) * q, 0);
    const quality = details.quality + (b.mealQuality || 0) - 1;
    return { good: recipe, quantity: 1, inputs: details.inputs, quality, price: b.type === 'townhall' || b.type === 'popular_refectory' ? 0 : this.city.currency.price(inputValue) };
  }
  foodOffer(b) {
    const goods = b.type === 'bakery' ? ['pao'] : [...edible, 'pao'];
    const good = goods.filter(g => b.inventory[g] >= ECONOMY_RULES.mealUnits).sort((a, c) => b.inventory[c] - b.inventory[a])[0];
    return good ? { good, quantity: ECONOMY_RULES.mealUnits, price: b.type === 'townhall' || b.type === 'popular_refectory' ? 0 : this.city.currency.price((good === 'pao' ? 160 : GOODS[good].price + 65) * ECONOMY_RULES.mealUnits) } : null;
  }
  consumeMeal(c, b) {
    const offer = this.mealOffer(b, c); if (!offer) { this.failedMeals++; if (b) b.stockouts++; return false; }
    if (!this.city.transfer(this.city.payerFor(c), b.accountId, offer.price, `Serviço: Alimentação (${GOODS[Object.keys(offer.inputs)[0]]?.label || offer.good})`)) return false;
    for (const [good, amount] of Object.entries(offer.inputs)) { b.inventory[good] -= amount; this.consumed[good] += amount; this.recordGoods('consumption', good, amount, b.id, c.id); }
    this.enjoyMeal(c, offer);
    c.lastMealQuality = offer.quality; if (c.task !== 'caregiving') c.needs.food = Math.min(100, c.needs.food + Math.max(0, offer.quality - 1)); b.lastSaleAt = this.city.minute;
    return true;
  }
  farmWork(b, c) {
    this.buySeeds(b);
    // Harvest needs both elapsed growth time and accumulated human labor.
    for (const field of b.fields) {
      if (field.plantedAt === null) {
        if (b.seedStock < 4 || b.inventory[b.crop] >= Math.max(36,b.fields.length*18)) continue;
        b.seedStock -= 4; field.plantedAt = this.city.minute; field.labor = 0;
        if(b.inventory.adubo>0) {b.inventory.adubo--;this.consumed.adubo++;field.labor=30;}
        this.consumed.sementes += 4; this.recordGoods('sowing', 'sementes', 4, b.id, null);
      }
      if (field.labor < ECONOMY_RULES.farmLabor) {
        field.labor = Math.min(ECONOMY_RULES.farmLabor, field.labor + 1 + c.skills.agriculture / 60 + (c.toolUntil>this.city.minute ? .3 : 0));
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
  industrialWork(b,c,spec) {
    if(['forestry','fiber_farm','herb_farm'].includes(b.type) && this.city.minute<(b.replantingAt||0)+180) return false;
    if(b.type==='bank') return this.city.bank.loans.some(l=>l.bankId===b.id && l.remaining>0) || [...this.city.bank.deposits.values()].some(a=>a.bankId===b.id);
    if (!Object.entries(spec.inputs).every(([g,n])=>b.inventory[g]>=n)) return false;
    const net=Object.values(spec.outputs).reduce((n,v)=>n+v,0)-Object.values(spec.inputs).reduce((n,v)=>n+v,0);
    if(inventoryFree(b)<Math.max(0,net) || Object.entries(spec.outputs).some(([g])=>b.inventory[g]>=48)) return false;
    // Mines must own actual rock deposits; other primary sites have finite extraction reserves.
    if(b.type==='iron_mine') {
      b.deposits ??= quarryDeposits(this.city.world,b.entity.x,b.entity.y,b.width,b.depth);
      if(!b.deposits.length) return false;
      const reserves=this.city.world.ironReserves ??= new Map();
      b.activeOre=b.deposits.find(p=>(reserves.get(`${p.x},${p.y}`)??120)>0);if(!b.activeOre)return false;
    }
    if(['clay_pit','sand_pit'].includes(b.type) && (b.extractionReserve??=b.width*b.depth*120)<Object.values(spec.outputs)[0])return false;
    b.productionLabor=(b.productionLabor||0)+1+(c.skills[spec.skill]||0)/80+(c.toolUntil>this.city.minute ? .3 : 0);
    if(b.productionLabor<spec.labor)return true;
    b.productionLabor-=spec.labor;
    for(const [g,n] of Object.entries(spec.inputs)){b.inventory[g]-=n;this.consumed[g]+=n;this.recordGoods('recipe-input',g,n,b.id,null);}
    for(const [g,n] of Object.entries(spec.outputs)){b.inventory[g]+=n;this.produced[g]+=n;this.recordGoods('production',g,n,null,b.id);}
    if(b.type==='iron_mine'){const p=b.activeOre,key=`${p.x},${p.y}`;this.city.world.ironReserves.set(key,(this.city.world.ironReserves.get(key)??120)-3);}
    if(['clay_pit','sand_pit'].includes(b.type)) b.extractionReserve-=Object.values(spec.outputs)[0];
    if(['forestry','fiber_farm','herb_farm'].includes(b.type)) b.replantingAt=this.city.minute;
    return true;
  }
  consumerOffer(c, b) {
    const spec=INDUSTRIES[b?.type];
    if(!b?.active || b.entity.destroyed || !spec?.use) return null;
    const domestic=spec.use.need==='shelter';
    if(domestic ? !c.homeUnitId : c.needs[spec.use.need]>=80) return null;
    const good=Object.keys(spec.outputs).find(g=>b.inventory[g]>0 && c.balance>=this.goods[g].price && (!domestic || (c.homeComfort?.[g]||0)<this.city.minute));
    return good ? {good,spec,price:this.goods[good].price} : null;
  }
  buyConsumerGood(c,b) {
    const offer=this.consumerOffer(c,b);
    if(!offer || Math.hypot(b.door.x-c.entity.x,b.door.y-c.entity.y)>2) return false;
    const {good,spec,price}=offer;
    if(!this.city.transfer(c.accountId,b.accountId,price,`Serviço: Venda de ${this.goods[good].label}`))return false;
    b.inventory[good]--;this.consumed[good]++;this.recordGoods('household-consumption',good,1,b.id,c.id);
    c.needs[spec.use.need]=Math.min(100,c.needs[spec.use.need]+spec.use.boost);
    if(spec.use.need==='shelter'){c.homeComfort??={};c.homeComfort[good]=this.city.minute+7*1440;}
    if(good==='livros')this.practice(c,'management',60);
    if(good==='ferramentas')c.toolUntil=this.city.minute+1440;
    return true;
  }
  householdPurchases() {
    for(const c of this.city.citizens.filter(c=>!c.entity.destroyed && this.city.society.isAdult(c) && c.id%24===this.city.hour)) {
      const shop=this.businesses.find(b=>this.consumerOffer(c,b) && Math.hypot(b.door.x-c.entity.x,b.door.y-c.entity.y)<2);
      if(shop)this.buyConsumerGood(c,shop);
    }
  }
  productionWork(b, c) {
    if (INDUSTRIES[b.type]) return this.industrialWork(b,c,INDUSTRIES[b.type]);
    if (b.type === 'mill') {
      if (b.inventory.girassol < 3 || inventoryFree(b) < 1) return false;
      b.millingLabor = (b.millingLabor || 0) + 1;
      if (b.millingLabor >= 8) { b.millingLabor -= 8; b.inventory.girassol -= 3; b.inventory.oleo++; this.consumed.girassol += 3; this.produced.oleo++; this.recordGoods('milling', 'oleo', 1, null, b.id); }
      return true;
    }
    if (b.type === 'mint') return this.city.currency.work(b, c);
    if (b.type === 'farm') return this.farmWork(b, c);
    if (b.type === 'builder') return this.city.development.work(this.city.development.projectFor(c, b), c);
    if (b.type === 'quarry') {
      if (this.city.world.map) { const revision = this.city.world.revision || 0; if (b.depositRevision !== revision) { b.deposits = quarryDeposits(this.city.world, b.entity.x, b.entity.y, b.width, b.depth); b.depositRevision = revision; } const deposits = b.deposits; if (!deposits.length) return false; const reserves = this.city.world.quarryReserves ??= new Map(); const deposit = deposits.find(p => (reserves.get(`${p.x},${p.y}`) ?? 250) > 0); if (!deposit) return false; b.activeDeposit = deposit; }
      if (b.stoneReserve <= 0 || inventoryFree(b) < 1) return false;
      b.miningLabor = (b.miningLabor || 0) + 1 + c.skills.mining / 60;
      if (b.miningLabor >= 3) { b.miningLabor -= 3; b.inventory.pedra++; b.stoneReserve--; if (b.activeDeposit) { const key = `${b.activeDeposit.x},${b.activeDeposit.y}`; const reserves = this.city.world.quarryReserves; reserves.set(key, (reserves.get(key) ?? 250) - 1); } this.produced.pedra++; this.recordGoods('mining', 'pedra', 1, null, b.id); }
      return true;
    }
    if (b.type === 'paid_toilet') return this.city.minute - (b.lastToiletUseAt ?? -Infinity) < 3;
    if (b.type === 'recycler') return this.city.sanitation.recycle(b, c);
    if (b.type === 'carrier' || b.type === 'cleaner' || b.type === 'waste_collector') return false;
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
    this.city.currency.hourly();
    this.city.lighting.hourly();
    this.appointMayor(); this.municipalPolicy(); this.assignHomes(); this.hire();
    this.city.development.updateHourly();
    this.trade(); this.householdPurchases(); this.city.sanitation.hourly(); this.city.workMeals.purchase(); this.updateDemand();
    if (this.city.hour % 2 === 0) { this.investInHousing(); this.invest(); }
  }
  daily() {
    this.city.bank.daily();
    for(const [key,value] of this.city.traffic) {if(value<2)this.city.traffic.delete(key);else this.city.traffic.set(key,value*.8);}
    this.municipalPolicy();
    for (const b of this.businesses) {
      const owner = this.citizen(b.ownerId);
      if (!owner) {
        if (b.municipal && b.balance > this.city.currency.price(b.type === 'builder' ? 2000000 : 500000)) this.city.transfer(b.accountId, 'treasury', Math.floor((b.balance - this.city.currency.price(b.type === 'builder' ? 2000000 : 500000)) * .5), 'Lucro de empresa municipal');
        continue;
      }
      if (b.balance < 5000 && owner.balance > 15000) this.city.transfer(owner.accountId, b.accountId, Math.min(10000, owner.balance - 10000), 'Aporte do proprietário');
      const profit = Math.max(0, b.totalRevenue - b.totalExpenses - b.dividends);
      const dividend = Math.min(Math.floor(profit * .35), Math.max(0, b.balance - 18000));
      if (dividend > 0 && this.city.transfer(b.accountId, owner.accountId, dividend, 'Distribuição de lucros')) b.dividends += dividend;
    }
    for (const owner of this.city.citizens) if (!owner.entity.destroyed && this.city.society.isAdult(owner)) {
      for (const u of this.city.units.values()) if (u.ownerId === owner.accountId && ['residential', 'popular_housing', 'luxury_housing'].includes(this.city.building(u.buildingId)?.type) && u.id !== owner.homeUnitId) {
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
