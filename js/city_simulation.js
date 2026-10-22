import { CityDevelopment, DEVELOPMENT_RULES } from './city_development.js';
import { CityLogistics } from './city_logistics.js';
import { inventoryFree } from './city_inventory.js';
import { CityEconomy, PRIVATE_TYPES, PUBLIC_TYPES, JOB_SKILL, ECONOMY_RULES } from './city_economy.js';
import { CitySociety, EVENT_CATEGORIES } from './city_society.js';
import { terrainWalkable, canStep, inspectBuildingSite, findTerrainPath, pavePath, generateSettlement, hasSettlementAccess } from './city_terrain.js';

export const BUILDING_TYPES = {
  builder: { label: 'Construtora', color: 0xd8a957, rent: 80, price: 1800, jobs: 3 },
  quarry: { label: 'Pedreira', color: 0x929caa, rent: 70, price: 1200, jobs: 2 },
  carrier: { label: 'Transportadora', color: 0x75b4cc, rent: 75, price: 3500, jobs: 2 },
  residential: { label: 'Residencial', color: 0xb5c4b0, rent: 65, price: 18000, jobs: 0 },
  market: { label: 'Mercado', color: 0xe2ab65, rent: 90, price: 4000, jobs: 6 },
  farm: { label: 'Fazenda', color: 0x98ad61, rent: 0, price: 2000, jobs: 1 },
  bakery: { label: 'Padaria', color: 0xdbb581, rent: 80, price: 4000, jobs: 2 },
  greengrocer: { label: 'Hortifruti', color: 0x9bc17d, rent: 75, price: 4000, jobs: 2 },
  townhall: { label: 'Prefeitura', color: 0xc3d1db, rent: 80, price: 40000, jobs: 5 },
  clinic: { label: 'Clínica', color: 0xc2ded3, rent: 85, price: 34000, jobs: 4 },
  leisure: { label: 'Centro de lazer', color: 0xd4b6cd, rent: 60, price: 26000, jobs: 3 },
  utility: { label: 'Água e saneamento', color: 0x83b9ce, rent: 70, price: 30000, jobs: 3 },
};
export const NEED_LABELS = { food: 'Alimentação', water: 'Água', energy: 'Descanso', hygiene: 'Higiene', toilet: 'Banheiro', social: 'Convívio', leisure: 'Lazer', health: 'Saúde', shelter: 'Moradia', safety: 'Segurança' };
const clamp = n => Math.max(0, Math.min(100, n));
const key = (x, y) => `${x},${y}`;
const names = ['Ana', 'Bruno', 'Clara', 'Davi', 'Elisa', 'Felipe', 'Gabriela', 'Hugo', 'Iara', 'João', 'Lia', 'Miguel', 'Nina', 'Otávio', 'Paula', 'Ravi', 'Sara', 'Tomás', 'Vera', 'Yuri', 'Alice', 'Caio', 'Diana', 'Enzo'];

export class CitySimulation {
  constructor({ world, createEntity, seed = world.seed ?? 1337 }) {
    this.world = world;
    this.createEntity = createEntity;
    this.seed = seed >>> 0;
    this.initialSeed = this.seed;
    this.buildings = [];
    this.citizens = [];
    this.units = new Map();
    this.accounts = new Map([['treasury', { name: 'Prefeitura', balance: 2000000 }], ['supplier', { name: 'Economia externa', balance: 0 }]]);
    this.occupied = new Set();
    this.events = [];
    this.nextEventId = 1;
    this.society = new CitySociety(this);
    this.economy = new CityEconomy(this);
    this.buildingTypes = BUILDING_TYPES;
    this.development = new CityDevelopment(this);
    this.logistics = new CityLogistics(this);
    this.hourlyPayroll = new Map();
    this.ledger = [];
    this.minute = 8 * 60;
    this.accumulator = 0;
    this.taxRate = 0.1;
    this.lastError = '';
  }
  random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  get treasury() { return this.accounts.get('treasury').balance; }
  get day() { return Math.floor(this.minute / 1440) + 1; }
  get hour() { return Math.floor(this.minute % 1440 / 60); }
  log(message, category = 'city', citizenIds = [], data = {}) {
    const event = { id: this.nextEventId++, minute: this.minute, category: EVENT_CATEGORIES[category] ? category : 'city', message, citizenIds: [...new Set(citizenIds)], data: { ...data } };
    this.events.unshift(event);
    if (this.events.length > 5000) this.events.length = 5000;
    return event;
  }
  getEvents({ category = 'all', citizenId = null, query = '', beforeId = Infinity, limit = 100 } = {}) {
    const search = query.trim().toLocaleLowerCase('pt-BR');
    return this.events.filter(e => e.id < beforeId && (category === 'all' || e.category === category) && (citizenId === null || e.citizenIds.includes(Number(citizenId))) && (!search || e.message.toLocaleLowerCase('pt-BR').includes(search))).slice(0, limit);
  }
  accountName(id) { const account = this.accounts.get(id); return account?.entity?.properties.name || account?.name || id; }
  payerFor(c) { return this.society.isAdult(c) ? c.accountId : this.society.guardian(c)?.accountId || c.accountId; }
  flushPayroll() {
    for (const [accountId, amount] of this.hourlyPayroll) {
      const c = this.accounts.get(accountId);
      this.log(`${this.accountName(accountId)} recebeu ${(amount / 100).toFixed(2)} em salários na última hora.`, 'work', c ? [c.id] : [], { kind: 'wages', amount });
    }
    this.hourlyPayroll.clear();
  }
  transfer(from, to, amount, reason) {
    const a = this.accounts.get(from), b = this.accounts.get(to);
    if (!a || !b || !Number.isSafeInteger(amount) || amount < 0 || a.balance < amount) return false;
    if (from === to || amount === 0) return true;
    a.balance -= amount; b.balance += amount;
    if (b.entity?.properties.cityBuilding && /^(Serviço:|Atacado:|Água para cuidados infantis|Frete entregue|Serviço de construção|Compra de espaço|Compra de terreno)/.test(reason)) b.totalRevenue += amount;
    if (a.entity?.properties.cityBuilding && /^(Salário$|Imposto sobre salário$|Atacado:|Compra de sementes$|Frete entregue|Serviço de construção)/.test(reason)) a.totalExpenses += amount;
    this.ledger.push({ minute: this.minute, from, to, amount, reason });
    if (this.ledger.length > 1000) this.ledger.shift();
    if (reason === 'Salário') this.hourlyPayroll.set(to, (this.hourlyPayroll.get(to) || 0) + amount);
    else if (reason !== 'Imposto sobre salário') {
      const ids = [a, b].filter(account => account.entity?.properties.citizen).map(c => c.id);
      const category = /aluguel/i.test(reason) ? 'housing' : 'economy';
      this.log(`${reason}: ${this.accountName(from)} → ${this.accountName(to)} (${(amount / 100).toFixed(2)}).`, category, ids, { kind: 'transfer', from, to, amount, reason });
    }
    return true;
  }
  initialize() {
    generateSettlement(this);
    const arrivalTiles = [];
    for (let radius = 0; radius <= 5; radius++) for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const x = Math.floor(this.spawn.x) + dx, y = Math.floor(this.spawn.y) + dy;
      if (this.walkable(x, y) && this.findPath(this.spawn, { x, y }) !== null) arrivalTiles.push({ x: x + .5, y: y + .5 });
    }
    for (let i = 0; i < 24; i++) { const p = arrivalTiles[i % arrivalTiles.length]; this.addCitizen(p.x, p.y, i); }
    this.economy.initialize();
    this.log(`Cidade fundada sobre o relevo natural. Semente ${this.world.seed ?? this.initialSeed}: 24 moradores e serviços conectados.`, 'city', [], { kind: 'foundation', seed: this.world.seed ?? this.initialSeed });
    this.syncClock();
  }
  addBuilding(type, x, y, { width, depth, floors, free = false, plotId = null, ownerAccountId = 'treasury', kind = type === 'farm' || type === 'quarry' ? 'open-air' : 'building', materialSource = null } = {}) {
    const spec = BUILDING_TYPES[type];
    if (!spec) return this.fail('Tipo de prédio inválido.');
    if (!['open-air', 'building'].includes(kind) || (kind === 'open-air' && !['farm', 'quarry', 'leisure', 'market', 'greengrocer'].includes(type))) return this.fail('Tipo de ocupação incompatível com esta construção.');
    width ??= 3 + Math.floor(this.random() * 3);
    depth ??= 3 + Math.floor(this.random() * 2);
    floors ??= 2 + Math.floor(this.random() * 4);
    if (![x, y, width, depth, floors].every(Number.isInteger) || width < 1 || depth < 1 || floors < 1 || width > 8 || depth > 8 || floors > 12) return this.fail('Dimensões: 1–8 de largura/profundidade e 1–12 de altura.');
    if (kind === 'open-air') floors = 1;
    const terrain = inspectBuildingSite(this, x, y, width, depth, { plotId });
    if (terrain.error) return this.fail(terrain.error);
    const hub = this.buildings.find(b => !b.entity.destroyed)?.door;
    if (!hub && !hasSettlementAccess(this.world, terrain.door, x, y, width, depth)) return this.fail('A entrada está isolada ou não há espaço acessível para o restante da cidade.');
    const access = hub ? findTerrainPath(this.world, terrain.door, hub, this.occupied, { extraBlocked: (xx, yy) => (xx >= x && xx < x + width && yy >= y && yy < y + depth) || this.development.plots.some(p => p.id !== plotId && xx >= p.x && xx < p.x + p.width && yy >= p.y && yy < p.y + p.depth) }) : [];
    if (access === null) return this.fail('Este lote está isolado. Escolha um local conectado à cidade por terra firme.');
    if (kind !== 'open-air' && this.citizens.some(c => !c.entity.destroyed && c.entity.x >= x && c.entity.x < x + width && c.entity.y >= y && c.entity.y < y + depth)) return this.fail('Há cidadãos neste terreno. Aguarde a passagem deles.');
    const count = width * depth * floors, stone = kind === 'open-air' ? 0 : count * DEVELOPMENT_RULES.stonePerCell, capital = PUBLIC_TYPES.has(type) && ownerAccountId === 'treasury' ? 50000 : 0;
    const plot = this.development.plots.find(p => p.id === plotId);
    if (!free && (!plot || plot.ownerId !== ownerAccountId || plot.buildingId || plot.x !== x || plot.y !== y || plot.width !== width || plot.depth !== depth)) return this.fail('É necessário comprar um terreno compatível antes de construir.');
    if (!free && stone && (!materialSource || materialSource.inventory.pedra < stone)) return this.fail(`Obra precisa de ${stone} pedras entregues no terreno.`);
    if (!free && this.treasury < capital) return this.fail('Caixa municipal insuficiente para obra e capital de operação.');
    const entity = this.createEntity({ x, y, properties: { name: `${spec.label} ${this.buildings.filter(b => b.type === type).length + 1}`, species: 'city-building', render: { color: spec.color } } });
    const b = { id: entity.id, entity, type, constructionKind: kind, width, depth, floors, color: spec.color, units: [], balance: 0, jobs: Math.min(spec.jobs ? Math.max(spec.jobs, Math.floor(count / 6)) : 0, 32), wage: 4 + Math.floor(this.random() * 3), stock: 0, workers: [], terrain, door: terrain.door };
    this.economy.setupBuilding(b);
    entity.properties.cityBuilding = b;
    b.accountId = `business:${b.id}`;
    this.accounts.set(b.accountId, b);
    if (!free && stone) { materialSource.inventory.pedra -= stone; this.economy.consumed.pedra += stone; this.economy.recordGoods('construction', 'pedra', stone, materialSource.id, b.id); }
    this.transfer('treasury', b.accountId, capital, 'Capital inicial');
    for (let z = 0; z < floors; z++) for (let yy = 0; yy < depth; yy++) for (let xx = 0; xx < width; xx++) {
      const u = { id: `${b.id}:${xx}:${yy}:${z}`, buildingId: b.id, x: xx, y: yy, z, ownerId: ownerAccountId, tenantId: null, occupantId: PUBLIC_TYPES.has(type) ? b.accountId : null, rent: spec.rent, price: spec.price, forSale: true, forRent: false, arrears: 0, missedDays: 0 };
      b.units.push(u); this.units.set(u.id, u);
    }
    if (kind !== 'open-air') for (let yy = y; yy < y + depth; yy++) for (let xx = x; xx < x + width; xx++) this.occupied.add(key(xx, yy));
    this.buildings.push(b);
    if (plot) { plot.buildingId = b.id; b.plotId = plot.id; } else this.development.attachBuilding(b, ownerAccountId);
    pavePath(this.world, [terrain.door, ...access]);
    this.lastError = '';
    this.log(`${entity.properties.name}: ${count} espaços de 1×1×1.`, 'city', [], { kind: 'construction', buildingId: b.id });
    return b;
  }
  fail(message) { this.lastError = message; return null; }
  addCitizen(x, y, index = this.citizens.length, options = {}) {
    const entity = this.createEntity({ x, y, properties: { name: `${names[index % names.length]} ${['Silva', 'Santos', 'Costa', 'Souza'][index % 4]}`, species: 'citizen', brain: {}, render: { skin: 'Human_Knight_M.png', color: [0xffeed19d, 0xffc2dce8, 0xffe6b9af, 0xffc5daa7][index % 4] } } });
    const c = { id: entity.id, entity, balance: 0, homeUnitId: null, jobId: null, needs: Object.fromEntries(Object.keys(NEED_LABELS).map(n => [n, 60 + this.random() * 35])), action: 'Chegando à cidade', targetId: null, path: [], task: null, happiness: 80, salaryToday: 0, taxRemainder: 0 };
    this.society.initializeCitizen(c, options);
    this.economy.initializeCitizen(c, index, options);
    c.entity.properties.render.size = this.society.age(c) < 6 ? .55 : this.society.isAdult(c) ? 1 : .8;
    if (this.citizens.some(other => other.entity.properties.name === entity.properties.name)) entity.properties.name += ` ${c.id}`;
    c.accountId = `citizen:${c.id}`;
    entity.properties.citizen = c;
    this.accounts.set(c.accountId, c);
    if (options.grant !== false) this.transfer('treasury', c.accountId, c.wealthTier === 'wealthy' ? ECONOMY_RULES.richCapital : 4000 + Math.floor(this.random() * 2000), 'Capital inicial do cidadão');
    this.citizens.push(c);
    if (options.grant !== false) this.log(`${entity.properties.name} chegou à cidade.`, 'city', [c.id], { kind: 'arrival' });
    return c;
  }
  building(id) { return this.buildings.find(b => b.id === id && !b.entity.destroyed); }
  rentUnit(citizenId, unitId) {
    const c = this.citizens.find(c => c.id === citizenId && !c.entity.destroyed), u = this.units.get(unitId);
    if (!c || !u || !this.building(u.buildingId) || this.building(u.buildingId).type !== 'residential' || (u.ownerId !== c.accountId && (!u.forRent || u.ownerId === 'treasury')) || (u.tenantId && u.tenantId !== c.accountId)) return this.fail('Espaço indisponível para moradia.');
    const payer = this.payerFor(c);
    if (u.ownerId !== c.accountId && u.ownerId !== payer && this.accounts.get(payer).balance < u.rent) return this.fail('Saldo insuficiente para o primeiro aluguel.');
    if (c.homeUnitId === u.id) return u;
    if (u.ownerId !== c.accountId && !this.transfer(payer, u.ownerId, u.rent, 'Primeiro aluguel')) return null;
    this.releaseHome(c);
    u.tenantId = c.accountId; u.rentPayerId = payer === c.accountId ? null : payer; u.arrears = 0; u.missedDays = 0;
    c.homeUnitId = u.id;
    c.path = []; c.task = null;
    this.log(`${c.entity.properties.name} ${u.ownerId === c.accountId ? 'ocupou seu próprio' : 'alugou o'} espaço ${u.id}.`, 'housing', [c.id], { kind: u.ownerId === c.accountId ? 'owner-occupancy' : 'lease', unitId: u.id });
    return u;
  }
  releaseHome(c) {
    const old = this.units.get(c.homeUnitId);
    if (old?.tenantId === c.accountId) { old.tenantId = null; old.rentPayerId = null; old.arrears = 0; old.missedDays = 0; }
    c.homeUnitId = null;
  }
  buyUnit(buyerId, unitId) {
    const c = this.citizens.find(c => c.id === buyerId && !c.entity.destroyed), u = this.units.get(unitId);
    if (!c || !u || !this.building(u.buildingId) || !u.forSale || u.ownerId === c.accountId) return this.fail('Espaço indisponível para compra.');
    if (!this.transfer(c.accountId, u.ownerId, u.price, 'Compra de espaço')) return this.fail('Saldo insuficiente para a compra.');
    u.ownerId = c.accountId; u.forSale = false; u.forRent = !u.tenantId && this.building(u.buildingId).type === 'residential'; u.arrears = 0; u.missedDays = 0;
    this.log(`${c.entity.properties.name} comprou o espaço ${u.id}.`, 'housing', [c.id], { kind: 'purchase', unitId: u.id });
    return u;
  }
  listUnit(unitId, { rent, price, forSale, forRent }) {
    const u = this.units.get(unitId);
    if (!u || !Number.isSafeInteger(rent) || rent < 0 || !Number.isSafeInteger(price) || price < 1) return this.fail('Informe preços válidos.');
    u.rent = rent; u.price = price; u.forSale = u.ownerId === 'treasury' ? true : !!forSale; u.forRent = u.ownerId === 'treasury' ? false : !!forRent;
    return u;
  }
  assignHousingAndJobs() { this.economy.assignHomes(); this.economy.hire(); }
  walkable(x, y) { return !this.occupied.has(key(x, y)) && terrainWalkable(this.world, x, y); }
  findPath(start, goal) { return findTerrainPath(this.world, start, goal, this.occupied); }
  urgentNeed(c) {
    const n = c.needs;
    return n.water < 18 ? 'water' : n.food < 18 ? 'food' : n.health < 20 ? 'health' : n.energy < 12 ? 'energy' : n.toilet < 10 ? 'toilet' : null;
  }
  chooseTask(c) {
    const n = c.needs;
    const home = this.building(this.units.get(c.homeUnitId)?.buildingId);
    const job = this.building(c.jobId);
    const company = c.businessIds.map(id => this.building(id)).filter(b => b?.active).sort((a, b) => Number(b.type === 'farm') - Number(a.type === 'farm'))[Math.floor(this.minute / 120) % Math.max(1, c.businessIds.length)] || c.businessIds.map(id => this.building(id)).find(b => b?.active);
    const child = this.citizens.find(child => child.guardianId === c.id && this.society.age(child) < 6 && Math.min(child.needs.food, child.needs.water, child.needs.hygiene, child.needs.social) < 45);
    let task = 'leisure', type = 'leisure';
    const urgent = this.urgentNeed(c);
    if (urgent) { task = urgent; type = ({ water: 'utility', food: 'market', health: 'clinic', energy: 'home', toilet: home ? 'home' : 'utility' })[urgent]; }
    else if (child && this.society.isAdult(c) && Math.min(n.food, n.water, n.energy, n.hygiene) >= 25 && n.health >= 40 && n.toilet >= 15) { task = 'caregiving'; type = 'child'; c.careChildId = child.id; }
    else if (n.food < 18) { task = 'food'; type = 'market'; }
    else if (n.health < 45) { task = 'health'; type = 'clinic'; }
    else if (n.water < 45) { task = 'water'; type = 'utility'; }
    else if (n.food < 45) { task = 'food'; type = 'market'; }
    else if (n.toilet < 30) { task = 'toilet'; type = home ? 'home' : 'utility'; }
    else if (n.energy < 25 || this.hour >= 22 || this.hour < 6) { task = 'energy'; type = 'home'; }
    else if (n.hygiene < 35) { task = 'hygiene'; type = home ? 'home' : 'utility'; }
    else if (this.society.age(c) < 6) { task = 'care'; type = 'home'; }
    else if (child && this.society.isAdult(c)) { task = 'caregiving'; type = 'child'; c.careChildId = child.id; }
    else if (company && this.hour >= 8 && this.hour < 17) { task = 'manage'; type = 'company'; }
    else if (job && this.hour >= 8 && this.hour < 17) { task = 'work'; type = 'job'; }
    else if (n.social < 60) { task = 'social'; type = 'leisure'; }
    else if (n.energy < 65) { task = 'energy'; type = 'home'; }
    if (this.society.age(c) < 6) { task = 'care'; type = 'home'; }
    if (task === 'food' && c.provisions > 0 && home) { task = 'provisions'; type = 'home'; }
    const childHome = child ? this.building(this.units.get(child.homeUnitId)?.buildingId) : null;
    const siteProject = this.development.projectFor(c, type === 'job' ? job : type === 'company' ? company : null);
    if (!urgent && siteProject && ['work', 'manage', 'leisure'].includes(task) && this.hour >= 8 && this.hour < 17) {
      const path = this.findPath(c.entity, siteProject.door);
      if (path !== null) { c.path = path; c.task = 'construction'; c.workProjectId = siteProject.id; c.targetId = siteProject.builderId; return; }
    }
    const hall = this.buildings.find(b => b.type === 'townhall' && !b.entity.destroyed);
    const candidates = type === 'company' ? [company] : task === 'food' ? this.buildings.filter(b => this.economy.mealOffer(b)) : type === 'child' ? (childHome ? [childHome] : home ? [home] : []) : type === 'home' ? (home ? [home] : []) : type === 'job' ? [job] : this.buildings.filter(b => !b.entity.destroyed && b.type === type);
    if (!candidates.length && hall && ['home', 'utility', 'clinic', 'leisure'].includes(type)) candidates.push(hall);
    candidates.sort((a, b) => Math.hypot(a.door.x - c.entity.x, a.door.y - c.entity.y) - Math.hypot(b.door.x - c.entity.x, b.door.y - c.entity.y));
    for (const b of candidates) {
      const path = this.findPath(c.entity, b.door);
      if (path !== null) {
        const spot = { x: Math.floor(b.door.x) + .2 + (c.id % 3) * .3, y: Math.floor(b.door.y) + .2 + (Math.floor(c.id / 3) % 3) * .3 };
        path.push(spot); c.path = path; c.targetId = b.id; c.task = task; return;
      }
    }
    c.task = null; c.targetId = null; c.action = task === 'food' ? 'Alimentos indisponíveis nas lojas locais' : home ? 'Sem acesso ao serviço' : 'Sem moradia';
    if (task === 'food' && (!c.foodShortageAt || this.minute - c.foodShortageAt >= 60)) { c.foodShortageAt = this.minute; this.economy.failedMeals++; this.log(`${c.entity.properties.name} não encontrou alimentos à venda.`, 'production', [c.id], { kind: 'food-shortage' }); }
    if (task === 'energy') n.energy = clamp(n.energy + 0.1);
  }
  performTask(c) {
    if (c.task === 'construction') {
      const project = this.development.projects.find(p => p.id === c.workProjectId);
      const builder = this.building(project?.builderId);
      if (!project || project.status === 'completed' || project.cancelled || this.hour < 8 || this.hour >= 17) { c.task = null; return; }
      if (builder && builder.ownerId !== c.id && (c.jobId !== builder.id || builder.balance < builder.wage)) { c.task = null; return; }
      if (this.development.work(project, c)) {
        if (builder && builder.ownerId !== c.id) { const wage = builder.wage, taxExact = wage * this.taxRate + c.taxRemainder, tax = Math.floor(taxExact + 1e-9); c.taxRemainder = taxExact - tax; this.transfer(builder.accountId, c.accountId, wage - tax, 'Salário'); this.transfer(builder.accountId, 'treasury', tax, 'Imposto sobre salário'); c.salaryToday += wage - tax; c.lastPaidAt = this.minute; }
        c.action = `Construindo no terreno ${project.plotId}`;
      } else { c.action = 'Aguardando materiais da obra'; c.task = null; }
      if (this.urgentNeed(c)) c.task = null;
      return;
    }
    const b = this.building(c.targetId), n = c.needs;
    if (!b) { c.task = null; return; }
    const task = c.task;
    if (task === 'work' || task === 'manage') {
      if (this.hour < 8 || this.hour >= 17 || !b.active) { c.task = null; return; }
      const isOwner = task === 'manage' && b.ownerId === c.id;
      const wage = b.wage + Math.floor((c.skills[JOB_SKILL[b.type]] || 0) / 30);
      if (!isOwner && b.balance < wage) { c.action = 'Empregador sem caixa'; c.task = null; return; }
      const productive = this.economy.productionWork(b, c);
      if (productive || !PRIVATE_TYPES.has(b.type)) {
        if (!isOwner) {
          const taxExact = wage * this.taxRate + c.taxRemainder;
          const tax = Math.floor(taxExact + 1e-9); c.taxRemainder = taxExact - tax;
          this.transfer(b.accountId, c.accountId, wage - tax, 'Salário');
          this.transfer(b.accountId, 'treasury', tax, 'Imposto sobre salário');
          c.salaryToday += wage - tax; c.lastPaidAt = this.minute;
        }
        this.economy.practice(c, JOB_SKILL[b.type]);
      }
      if (isOwner) this.economy.practice(c, 'management');
      c.action = c.id === this.economy.mayorId ? 'Administrando a prefeitura' : isOwner ? `Gerindo ${b.entity.properties.name}` : productive ? `Trabalhando: ${JOB_SKILL[b.type]}` : b.type === 'farm' ? 'Aguardando crescimento da plantação' : 'Aguardando matéria-prima';
      if (Math.min(n.food, n.water, n.energy, n.toilet, n.hygiene, n.health) < 22) c.task = null;
      return;
    }
    if (task === 'provisions') {
      if (c.provisions <= 0) { c.task = null; return; }
      if (c.servicePaid !== 'provisions') { c.provisions--; c.servicePaid = 'provisions'; this.log(`${c.entity.properties.name} consumiu uma refeição trazida na chegada.`, 'production', [c.id], { kind: 'initial-provision-consumed' }); }
      n.food = clamp(n.food + 5); c.action = 'Comendo suas provisões em casa';
      if (n.food >= 95) { c.task = null; c.servicePaid = null; }
      return;
    }
    if (task === 'care' || task === 'caregiving') {
      const child = task === 'care' ? c : this.society.citizen(c.careChildId);
      const guardian = child ? this.society.guardian(child) : null;
      if (!child || !guardian || !child.homeUnitId) { c.action = 'Aguardando responsável e moradia'; c.task = null; return; }
      if (task === 'care') { c.action = `Em casa, aos cuidados de ${guardian.entity.properties.name}`; c.needs.energy = clamp(c.needs.energy + .5); return; }
      if (Math.hypot(child.entity.x - c.entity.x, child.entity.y - c.entity.y) > 2 || child.path.length) { c.action = `Esperando ${child.entity.properties.name} em casa`; return; }
      if (c.servicePaid !== `care:${child.id}`) {
        const market = this.buildings.find(b => this.economy.mealOffer(b));
        const water = this.buildings.find(b => b.type === 'utility' && !b.entity.destroyed) || this.buildings.find(b => b.type === 'townhall' && !b.entity.destroyed);
        const mealPrice = market ? this.economy.mealOffer(market).price : 0;
        const usesProvisions = c.provisions > 0;
        if (!water || (!market && !usesProvisions) || c.balance < (usesProvisions ? 35 : mealPrice + 35)) { c.action = 'Sem alimentos ou recursos para os cuidados'; c.task = null; return; }
        if (usesProvisions) c.provisions--;
        else if (!this.economy.consumeMeal(child, market)) { c.task = null; return; }
        this.transfer(c.accountId, water.accountId, 35, 'Água para cuidados infantis');
        c.servicePaid = `care:${child.id}`;
        this.log(`${c.entity.properties.name} está cuidando de ${child.entity.properties.name}.`, 'family', [c.id, child.id], { kind: 'childcare' });
      }
      for (const need of ['food', 'water', 'hygiene', 'toilet', 'social', 'leisure']) child.needs[need] = clamp(child.needs[need] + 4);
      this.economy.practice(c, 'care');
      child.needs.energy = clamp(child.needs.energy + .4); child.needs.health = clamp(child.needs.health + .5); c.needs.social = clamp(c.needs.social + 1);
      c.action = `Cuidando de ${child.entity.properties.name}`;
      if (Math.min(child.needs.food, child.needs.water, child.needs.hygiene, child.needs.social) >= 90) { c.task = null; c.servicePaid = null; }
      return;
    }
    const price = { food: 180, water: 35, health: 240, leisure: 25, social: 0, energy: 0, hygiene: 0, toilet: 0 }[task];
    if (c.servicePaid !== `${b.id}:${task}`) {
      if (task === 'food' ? !this.economy.consumeMeal(c, b) : !this.transfer(this.payerFor(c), b.accountId, b.type === 'townhall' ? 0 : price, `Serviço: ${NEED_LABELS[task] || task}`)) { c.action = 'Sem dinheiro para o serviço'; c.task = null; return; }
      c.servicePaid = `${b.id}:${task}`;
    }
    const rates = { food: 5, water: 8, energy: 0.35, hygiene: 4, toilet: 8, social: 1.5, leisure: 1, health: 2 };
    n[task] = clamp(n[task] + rates[task]);
    c.action = { food: 'Comendo no mercado', water: 'Bebendo água', energy: 'Dormindo', hygiene: 'Cuidando da higiene', toilet: 'Usando o banheiro', social: 'Procurando companhia para conversar', leisure: 'Descansando no centro de lazer', health: 'Recebendo atendimento' }[task];
    if (task === 'social') n.social = clamp(n.social - rates.social);
    if (n[task] >= 95 || (task === 'energy' && this.hour >= 7 && this.hour < 22 && n.energy > 65)) { c.task = null; c.servicePaid = null; }
    if (task === 'energy' && Math.min(n.food, n.water, n.toilet) < 20) c.task = null;
  }
  collectRent() {
    for (const u of this.units.values()) {
      if (u.ownerId === 'treasury' || !u.tenantId || u.tenantId === u.ownerId || u.rentPayerId === u.ownerId) continue;
      const amount = u.rent + u.arrears;
      if (this.transfer(u.rentPayerId || u.tenantId, u.ownerId, amount, 'Aluguel diário')) { u.arrears = 0; u.missedDays = 0; }
      else {
        u.arrears += u.rent; u.missedDays++;
        if (u.missedDays >= 3 && u.tenantId.startsWith('citizen:')) {
          const c = this.citizens.find(c => c.accountId === u.tenantId);
          if (c) { this.log(`${c.entity.properties.name}: contrato encerrado por inadimplência.`, 'housing', [c.id], { kind: 'eviction', unitId: u.id }); this.releaseHome(c); }
        }
      }
    }
  }
  dailyEconomy() {
    this.collectRent();
    for (const c of this.citizens) {
      if (c.entity.destroyed) continue;
      c.salaryToday = 0;
      const u = this.units.get(c.homeUnitId);
      if (u && this.society.isAdult(c) && u.ownerId !== c.accountId) {
        const offer = u.forSale ? u : [...this.units.values()].filter(s => this.building(s.buildingId)?.type === 'residential' && s.forSale && !s.tenantId).sort((a, b) => a.price - b.price)[0];
        if (offer && c.balance >= offer.price + 3000 && this.buyUnit(c.id, offer.id) && offer.id !== c.homeUnitId) this.rentUnit(c.id, offer.id);
      }
    }
    const mayor = this.economy.citizen(this.economy.mayorId);
    if (mayor) for (const b of this.buildings.filter(b => PUBLIC_TYPES.has(b.type) && !b.entity.destroyed)) {
      const grant = Math.max(0, 20000 - b.balance);
      this.transfer('treasury', b.accountId, Math.min(grant, this.treasury), 'Orçamento autorizado pelo prefeito');
    }
    this.economy.daily();
    this.assignHousingAndJobs();
    this.log(`Dia ${this.day}: aluguéis e orçamento processados.`, 'economy', [], { kind: 'daily-budget' });
  }
  reconcile() {
    for (const b of [...this.buildings]) if (b.entity.destroyed) {
      for (const u of b.units) { this.units.delete(u.id); }
      for (let y = b.entity.y; y < b.entity.y + b.depth; y++) for (let x = b.entity.x; x < b.entity.x + b.width; x++) this.occupied.delete(key(x, y));
      for (const c of this.citizens) {
        if (c.jobId === b.id) c.jobId = null;
        if (!this.units.has(c.homeUnitId)) c.homeUnitId = null;
        if (c.targetId === b.id) { c.task = null; c.path = []; }
      }
      for (const shipment of this.logistics.shipments) if (shipment.seller === b || shipment.buyer === b) this.logistics.cancel(shipment);
      const hall = this.buildings.find(h => h.type === 'townhall' && !h.entity.destroyed);
      for (const [good, qty] of Object.entries(b.inventory)) { const stored = Math.min(qty, hall ? inventoryFree(hall) : 0); if (hall) hall.inventory[good] += stored; this.economy.lost[good] += qty - stored; b.inventory[good] = 0; }
      this.transfer(b.accountId, this.economy.citizen(b.ownerId)?.accountId || 'treasury', b.balance, 'Encerramento de prédio');
      const owner = this.economy.citizen(b.ownerId); if (owner) owner.businessIds = owner.businessIds.filter(id => id !== b.id);
      this.log(`${b.entity.properties.name} foi demolido.`, 'city', [], { kind: 'demolition', buildingId: b.id });
      this.buildings.splice(this.buildings.indexOf(b), 1);
    }
    for (const c of [...this.citizens]) if (c.entity.destroyed) {
      this.economy.removeCitizen(c);
      this.society.removeCitizen(c);
      this.log(`${c.entity.properties.name} saiu da cidade.`, 'city', [c.id], { kind: 'departure' });
      this.releaseHome(c);
      for (const u of this.units.values()) if (u.ownerId === c.accountId) { const resident = this.accounts.get(u.tenantId); if (resident?.homeUnitId === u.id) this.releaseHome(resident); u.ownerId = 'treasury'; u.forSale = true; u.forRent = false; }
      const b = this.building(c.jobId);
      if (b) b.workers = b.workers.filter(id => id !== c.id);
      this.transfer(c.accountId, 'treasury', c.balance, 'Saída de cidadão');
      this.citizens.splice(this.citizens.indexOf(c), 1);
    }
  }
  stepMinute() {
    this.minute++;
    this.reconcile();
    this.development.reconcile();
    this.logistics.updateMinute();
    if (this.minute % 1440 === 0) { this.society.daily(); this.dailyEconomy(); }
    if (this.minute % 60 === 0) { this.flushPayroll(); this.assignHousingAndJobs(); }
    for (const c of this.citizens) {
      const n = c.needs;
      c.entity.properties.render.size = this.society.age(c) < 6 ? .55 : this.society.isAdult(c) ? 1 : .8;
      for (const [need, decay] of Object.entries({ food: 0.11, water: 0.16, energy: 0.065, hygiene: 0.07, toilet: 0.16, social: 0.065, leisure: 0.055 })) n[need] = clamp(n[need] - decay);
      n.shelter = clamp(n.shelter + (c.homeUnitId ? 0.5 : -0.2));
      n.safety = clamp(n.safety + (this.buildings.some(b => b.type === 'townhall') ? 0.08 : -0.1));
      n.health = clamp(n.health + (Math.min(n.food, n.water, n.energy, n.hygiene) < 10 ? -0.22 : 0.015));
      c.happiness = Object.values(n).reduce((a, b) => a + b, 0) / Object.keys(n).length;
      const urgent = this.urgentNeed(c);
      if (urgent && c.conversation) { const other = this.society.citizen(c.conversation.a === c.id ? c.conversation.b : c.conversation.a); if (other) other.conversation = null; c.conversation = null; }
      const completingEssential = ['water', 'food', 'provisions', 'health', 'energy', 'toilet'].includes(c.task) && n[c.task === 'provisions' ? 'food' : c.task] < 75;
      if (!c.deliveryId && urgent && c.task !== urgent && !completingEssential && this.society.age(c) >= 6) { c.task = null; c.path = []; }
      const dependentNeedsCare = this.citizens.some(child => child.guardianId === c.id && this.society.age(child) < 6 && Math.min(child.needs.food, child.needs.water, child.needs.hygiene, child.needs.social) < 25);
      if (!c.deliveryId && !urgent && dependentNeedsCare && (['work', 'manage', 'leisure', 'social'].includes(c.task) || (c.task === 'energy' && n.energy > 65)) && !c.conversation) { c.task = null; c.path = []; }
      if (c.deliveryId) continue;
      if (c.conversation) continue;
      if (!c.task) { c.servicePaid = null; this.chooseTask(c); }
      if (!c.path.length && c.task) this.performTask(c);
    }
    this.society.updateMinute();
    if (this.minute % 60 === 0) this.economy.hourly();
    this.syncClock();
  }
  syncClock() {
    this.world.clock.day = this.day;
    this.world.clock.hour = this.hour;
    this.world.clock.minute = this.minute % 60;
    this.world.clock.minuteTimer = 0;
    this.world.clock.tick(0);
  }
  update(dt) {
    // One simulation second = four city minutes; all systems share this clock.
    this.accumulator += dt * 4;
    while (this.accumulator >= 1) { this.accumulator -= 1; this.stepMinute(); }
    for (const c of this.citizens) {
      if (c.conversation) continue;
      let distance = dt * (this.society.isAdult(c) ? 2.4 : 1.6);
      while (distance > 0 && c.path.length) {
        const p = c.path[0];
        if (!this.walkable(Math.floor(p.x), Math.floor(p.y)) || !canStep(this.world, Math.floor(c.entity.x), Math.floor(c.entity.y), Math.floor(p.x), Math.floor(p.y))) { c.path = []; c.task = null; break; }
        const dx = p.x - c.entity.x, dy = p.y - c.entity.y, len = Math.hypot(dx, dy);
        if (len <= distance) { c.entity.x = p.x; c.entity.y = p.y; c.path.shift(); distance -= len; }
        else { c.entity.x += dx / len * distance; c.entity.y += dy / len * distance; distance = 0; }
        c.action = c.deliveryId ? 'Transportando mercadorias' : c.task === 'construction' ? 'Indo para a obra' : `Indo: ${NEED_LABELS[c.task] || 'Trabalho'}`;
      }
    }
  }
  stats() {
    const people = this.citizens.filter(c => !c.entity.destroyed);
    const units = [...this.units.values()];
    return { mayorId: this.economy.mayorId, wealthy: people.filter(c => c.wealthTier === 'wealthy').length, businesses: this.economy.businesses.length, population: people.length, children: people.filter(c => !this.society.isAdult(c)).length, couples: people.filter(c => c.partnerId).length / 2, friendships: [...this.society.relations.values()].filter(r => ['friend', 'close'].includes(r.status)).length, births: this.society.birthCount, employed: people.filter(c => c.jobId).length, homeless: people.filter(c => !c.homeUnitId).length, happiness: people.length ? Math.round(people.reduce((s, c) => s + c.happiness, 0) / people.length) : 0, units: units.length, occupied: units.filter(u => u.tenantId || u.occupantId).length, jobs: this.buildings.reduce((s, b) => s + b.jobs, 0), treasury: this.treasury };
  }
}
