import {recordMarketTransaction} from './city_wealth.js';
import {CityPaint} from './city_paint.js';
import {CIVIC_SERVICES,civicSpec,civicStatus,civicVisit} from './city_public_services.js';
import {recordWork} from './city_employment.js';
import {CityFiscal} from './city_fiscal.js';
import {CityVehicles} from './city_vehicles.js';
import {clothingMood,moveGarments} from './city_clothing.js';
import {MIN_PLOT_CELLS} from './city_building_geometry.js';
import { CityPublications } from './city_publications.js';
import { CityOfficialJournal } from './city_official_journal.js';
import { architectureFor, initializeCharacter, HOUSE_STYLES } from './city_culture.js';
import { CityRelationships } from './city_relationships.js';
import { CityNature } from './city_nature.js';
import { CityGovernment as CityPolitics } from './city_government.js';
import { CityReputation } from './city_reputation.js';
import { CityHistory } from './city_history.js';
import { syncCitizenInterior,advanceCitizenInterior,outdoorCellReady } from './city_interiors.js';
import { CityWelfare } from './city_welfare.js';
import { INDUSTRIES } from './city_industries.js';
import { CityBank } from './city_bank.js';
import { quarryDeposits } from './city_terrain.js';
import { CityLighting } from './city_lighting.js';
import { CityCurrency, CURRENCY_RULES } from './city_currency.js';
import { CityHousing, HOUSING_RULES } from './city_housing.js';
import { CitySanitation } from './city_sanitation.js';
import { CityLife } from './city_life.js';
import { CityWorkMeals } from './city_work_meals.js';
import { CityDevelopment, DEVELOPMENT_RULES } from './city_development.js';
import { CityLogistics } from './city_logistics.js';
import { inventoryFree } from './city_inventory.js';
import { CityEconomy, PRIVATE_TYPES, PUBLIC_TYPES, JOB_SKILL, ECONOMY_RULES } from './city_economy.js';
import { CitySociety, EVENT_CATEGORIES } from './city_society.js';
import { chooseBuildingSite, terrainWalkable, canStep, inspectBuildingSite, findTerrainPath, layDirtPath, generateSettlement, hasSettlementAccess, tileAt, roadTravelCost, DIRT_ROAD_TILES, ROAD_RULES, wearRoad } from './city_terrain.js';

export const INITIAL_POPULATION = 512;
export const BUILDING_TYPES = {
  ...CIVIC_SERVICES,
  bike_rack:{label:'Bicicletário',color:0x638e9b,rent:0,price:18000,jobs:0},
  ...INDUSTRIES,
  mill: { label: 'Moinho de óleo', color: 0xc3a668, rent: 90, price: 70000, jobs: 2 },
  mint: { label: 'Casa da moeda', color: 0xd5c16b, rent: 0, price: 120000, jobs: 1 },
  cleaner: { label: 'Empresa de faxina', color: 0x81c7cc, rent: 80, price: 50000, jobs: 2 },
  waste_collector: { label: 'Coletora de lixo', color: 0x89a65e, rent: 80, price: 50000, jobs: 2 },
  recycler: { label: 'Recicladora', color: 0x769da8, rent: 80, price: 60000, jobs: 2 },
  public_toilet: { label: 'Banheiro público gratuito', color: 0xb2cbd0, rent: 0, price: 20000, jobs: 0 },
  paid_toilet: { label: 'Banheiro público pago', color: 0x87c4c8, rent: 80, price: 50000, jobs: 1 },
  builder: { label: 'Construtora', color: 0xd8a957, rent: 80, price: 50000, jobs: 3 },
  quarry: { label: 'Pedreira', color: 0x929caa, rent: 70, price: 50000, jobs: 2 },
  carrier: { label: 'Transportadora', color: 0x75b4cc, rent: 75, price: 50000, jobs: 2 },
  residential: { label: 'Residencial', color: 0xb5c4b0, rent: HOUSING_RULES.roomRent, price: HOUSING_RULES.roomPrice, jobs: 0 },
  popular_housing: { label: 'Moradia popular', color: 0xc7a779, rent: HOUSING_RULES.roomRent, price: HOUSING_RULES.roomPrice, jobs: 0 },
  luxury_housing: { label: 'Moradia de luxo', color: 0xd6c99c, rent: HOUSING_RULES.roomRent * 2, price: HOUSING_RULES.roomPrice * 3, jobs: 0 },
  popular_refectory: { label: 'Refeitório popular', color: 0xd89d62, rent: 0, price: 90000, jobs: 4 },
  market: { label: 'Mercado', color: 0xe2ab65, rent: 90, price: 60000, jobs: 6 },
  farm: { label: 'Fazenda', color: 0x98ad61, rent: 0, price: 50000, jobs: 1 },
  bakery: { label: 'Padaria', color: 0xdbb581, rent: 80, price: 60000, jobs: 2 },
  greengrocer: { label: 'Hortifruti', color: 0x9bc17d, rent: 75, price: 60000, jobs: 2 },
  townhall: { label: 'Prefeitura', color: 0xc3d1db, rent: 80, price: 40000, jobs: 5 },
  council_chamber:{label:'Câmara municipal',color:0xc3aa78,rent:0,price:120000,jobs:0},
  clinic: { label: 'Clínica', color: 0xc2ded3, rent: 85, price: 34000, jobs: 4 },
  leisure: { label: 'Centro de lazer', color: 0xd4b6cd, rent: 60, price: 26000, jobs: 3 },
  utility: { label: 'Água e saneamento', color: 0x83b9ce, rent: 70, price: 30000, jobs: 3 },
};
export const NEED_LABELS = { food: 'Alimentação', water: 'Água', energy: 'Descanso', hygiene: 'Higiene', toilet: 'Banheiro', social: 'Convívio', leisure: 'Lazer', health: 'Saúde', shelter: 'Moradia', safety: 'Segurança' };
const NO_CHILDREN=Object.freeze([]);
const URGENT_NEEDS=[['water',18,0],['food',18,0],['health',20,5],['energy',12,0],['toilet',10,0],['hygiene',10,0]];
const SERVICE_PRICES={food:180,water:35,health:240,leisure:25,social:0,energy:0,hygiene:0,toilet:0};
const SERVICE_RATES={food:5,water:8,hygiene:4,social:1.5,leisure:1,health:2};
const SERVICE_ACTIONS={food:'Comendo no mercado',water:'Bebendo água',energy:'Dormindo',hygiene:'Cuidando da higiene',toilet:'Usando o banheiro',social:'Procurando companhia para conversar',leisure:'Descansando no centro de lazer',health:'Recebendo atendimento'};
const ESSENTIAL_TASKS=new Set(['water','food','provisions','workmeal','health','toilet']);
const INTERRUPTIBLE_TASKS=new Set(['work','manage','leisure','social','clean']);
const CITY_FEED_LIMIT=128,CITY_FEED_TRIM=64;
const clamp = n => Math.max(0, Math.min(100, n));
const key = (x, y) => `${x},${y}`;


export class CitySimulation {
  constructor({ world, createEntity, seed = world.seed ?? 1337, population = INITIAL_POPULATION }) {
    this.initialPopulation = population;
    this.traffic = new Map();
    this.world = world;
    this.createEntity = createEntity;
    this.seed = seed >>> 0;
    this.initialSeed = this.seed;
    this.buildings = [];
    this.citizens = [];
    this.buildingsById = new Map();
    this.childrenByGuardian = new Map();
    this.familyIndexDirty = true;
    this.structureRevision = 0;
    this.obstacleRevision = 0;
    this.units = new Map();
    this.accounts = new Map([['treasury', { name: 'Prefeitura', balance: 0, totalRevenue: 0, totalExpenses: 0 }], ['supplier', { name: 'Economia externa', balance: 0 }]]);
    this.occupied = new Set();
    this.events = [];
    this.history = new CityHistory(this);
    this.nextEventId = 1;
    this.minute = 8 * 60;
    this.currency = new CityCurrency(this);
    this.society = new CitySociety(this);
    this.housing = new CityHousing(this);
    this.sanitation = new CitySanitation(this);
    this.life = new CityLife(this);
    this.economy = new CityEconomy(this);
    this.buildingTypes = BUILDING_TYPES;
    this.development = new CityDevelopment(this);
    this.logistics = new CityLogistics(this);
    this.workMeals = new CityWorkMeals(this);
    this.lighting = new CityLighting(this);
    this.bank = new CityBank(this);
    this.welfare = new CityWelfare(this);
    this.fiscal = new CityFiscal(this);
    this.reputation = new CityReputation(this);
    this.relationships = new CityRelationships(this);
    this.nature = new CityNature(this);
    this.politics = new CityPolitics(this);
    this.publications = new CityPublications(this);
    this.officialJournal = new CityOfficialJournal(this);
    this.vehicles = new CityVehicles(this);
    this.paint = new CityPaint(this);
    this.hourlyPayroll = new Map();
    this.ledger = [];
    this.accumulator = 0;
    this.taxRate = 0.1;
    this.wageSubsidies = {paidToday:0,totalPaid:0,unpaidToday:0};
    this.lastError = '';
  }
  recordTraffic(point) {
    const id = `${Math.floor(point.x)},${Math.floor(point.y)}`;
    this.traffic.set(id, Math.min(10000, (this.traffic.get(id) || 0) + 1));
  }
  trafficScore(path = []) { return path.reduce((n,p)=>n+(this.traffic.get(`${Math.floor(p.x)},${Math.floor(p.y)}`)||0),0); }
  random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  get treasury() { return this.accounts.get('treasury').balance; }
  get day() { return Math.floor(this.minute / 1440) + 1; }
  get hour() { return Math.floor(this.minute % 1440 / 60); }
  log(message, category = 'city', citizenIds = [], data = {}) {
    const event = this.history.record(category, message, data.accounts || [], { ...data, category: EVENT_CATEGORIES[category] ? category : 'city', citizenIds: [...new Set(citizenIds.filter(id => id != null))] });
    this.nextEventId = this.history.nextId;
    this.appendCityEvent(event);
    return event;
  }
  appendCityEvent(event) {
    this.events.push(event);
    if(this.events.length>CITY_FEED_LIMIT+CITY_FEED_TRIM)this.events.splice(0,CITY_FEED_TRIM);
  }
  getEvents(options = {}) { return this.history.query(options); }
  accountName(id) { const account = this.accounts.get(id); return account?.entity?.properties.name || account?.name || id; }
  payerFor(c) { if (this.society.isAdult(c)) return c.accountId; return [...new Set([c.guardianId, ...c.parentIds])].map(id => this.society.citizen(id)).filter(Boolean).sort((a, b) => b.balance - a.balance)[0]?.accountId || c.accountId; }
  flushPayroll() {
    this.history.flushFinance();
    for (const [accountId, amount] of this.hourlyPayroll) {
      const c = this.accounts.get(accountId);
      this.log(`${this.accountName(accountId)} recebeu ${(amount / 100).toFixed(2)} em salários e complementos na última hora.`, 'work', c ? [c.id] : [], { kind: 'wages', amount });
    }
    this.hourlyPayroll.clear();
  }
  transfer(from, to, amount, reason, details = {}) {
    const a = this.accounts.get(from), b = this.accounts.get(to);
    if (!a || !b || !Number.isSafeInteger(amount) || amount < 0 || a.balance < amount) return false;
    if (from === to || amount === 0) return true;
    if(from==='treasury'&&this.fiscal&&!this.fiscal.allows(amount,reason,details))return false;
    a.balance -= amount; b.balance += amount;
    this.fiscal?.record(from,to,amount,reason,details);
    if(to==='treasury') b.totalRevenue=(b.totalRevenue||0)+amount;
    else if (b.entity?.properties.cityBuilding && /^(Serviço:|Atacado:|Água para cuidados infantis|Frete entregue|Serviço de construção|Serviço de limpeza|Serviço de coleta)/.test(reason)) b.totalRevenue += amount;
    if(from==='treasury') a.totalExpenses=(a.totalExpenses||0)+amount;
    else if (a.entity?.properties.cityBuilding && /^(Salário$|Imposto sobre salário$|Imposto empresarial$|Vale-alimentação$|Atacado:|Frete entregue|Serviço de construção|Serviço de limpeza|Serviço de coleta)/.test(reason)) a.totalExpenses += amount;
    const shipment = a.seller && a.buyer ? a : b.seller && b.buyer ? b : null;
    const entry = this.history.transaction(from, to, amount, reason, { ...(shipment ? {shipmentId: shipment.id} : {}), ...details });
    this.ledger.push({ minute: this.minute, from, to, amount, reason, eventId: entry.id });
    recordMarketTransaction(this,from,to,amount,reason,details,entry.id);
    if (this.ledger.length > 1000) this.ledger.shift();
    if (reason === 'Salário' || reason === 'Subsídio salarial municipal') this.hourlyPayroll.set(to, (this.hourlyPayroll.get(to) || 0) + amount);
    else if (reason !== 'Imposto sobre salário') {
      this.appendCityEvent(entry);
    }
    return true;
  }
  initialize() {
    this.currency.initialize();
    generateSettlement(this);
    const arrivalTiles = [];
    for (let radius = 0; radius <= 5; radius++) for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const x = Math.floor(this.spawn.x) + dx, y = Math.floor(this.spawn.y) + dy;
      if (this.walkable(x, y) && this.findPath(this.spawn, { x, y }) !== null) arrivalTiles.push({ x: x + .5, y: y + .5 });
    }
    for (let i = 0; i < this.initialPopulation; i++) { const p = arrivalTiles[i % arrivalTiles.length]; this.addCitizen(p.x, p.y, i); }
    this.economy.initialize();
    this.vehicles.equipInitialWorkers();
    this.nature.initialize();
    this.log(`Cidade fundada sobre o relevo natural. Semente ${this.world.seed ?? this.initialSeed}: ${this.citizens.length} moradores e serviços conectados.`, 'city', [], { kind: 'foundation', seed: this.world.seed ?? this.initialSeed });
    this.syncClock();
  }
  addBuilding(type, x, y, { width, depth, floors, free = false, plotId = null, ownerAccountId = 'treasury', kind = ['farm','quarry','park','bike_rack'].includes(type) ? 'open-air' : 'building', materialSource = null, rotation = null } = {}) {
    const spec = BUILDING_TYPES[type];
    if (type === 'quarry' && this.world.map && !quarryDeposits(this.world, x, y, width || 4, depth || 4).length) return this.fail('A pedreira precisa de um depósito rochoso junto à área de extração.');
    if (!spec) return this.fail('Tipo de prédio inválido.');
    if (!['open-air', 'building'].includes(kind) || (kind === 'open-air' && !['farm', 'quarry', 'park', 'bike_rack', 'leisure', 'market', 'greengrocer'].includes(type))) return this.fail('Tipo de ocupação incompatível com esta construção.');
    width ??= type === 'farm' ? 10 : 3 + Math.floor(this.random() * 3);
    depth ??= type === 'farm' ? 10 : 3 + Math.floor(this.random() * 2);
    floors ??= 2 + Math.floor(this.random() * 4);
    if (![x, y, width, depth, floors].every(Number.isInteger) || width < 1 || depth < 1 || width*depth<MIN_PLOT_CELLS || floors < 1 || width > (kind === 'open-air' ? 20 : 8) || depth > (kind === 'open-air' ? 20 : 8) || floors > 12) return this.fail('Área mínima de 4 células (2×2, 4×1 ou 1×4). Limites: 20×20 ao ar livre, 8×8 em edifícios e 12 andares.');
    if (kind === 'open-air') floors = 1;
    const {access,...terrain}=chooseBuildingSite(this,x,y,width,depth,{plotId,type,rotation});
    if (terrain.error) return this.fail(terrain.error);
    const hub = this.buildings.find(b => !b.entity.destroyed)?.door;
    if (!hub && !hasSettlementAccess(this.world, terrain.door, x, y, width, depth)) return this.fail('A entrada está isolada ou não há espaço acessível para o restante da cidade.');

    if (access === null) return this.fail('Este lote está isolado. Escolha um local conectado à cidade por terra firme.');
    if (kind !== 'open-air' && this.citizens.some(c => !c.entity.destroyed && c.entity.x >= x && c.entity.x < x + width && c.entity.y >= y && c.entity.y < y + depth)) return this.fail('Há cidadãos neste terreno. Aguarde a passagem deles.');
    const count = width * depth * floors, stone = kind === 'open-air' ? (['park','bike_rack'].includes(type)?Math.ceil(count/4):0) : count * DEVELOPMENT_RULES.stonePerCell, capital = type !== 'townhall' && PUBLIC_TYPES.has(type) && ownerAccountId === 'treasury' ? this.currency.price(50000) : 0;
    const plot = this.development.plots.find(p => p.id === plotId);
    if (!free && (!plot || plot.ownerId !== ownerAccountId || plot.buildingId || plot.x !== x || plot.y !== y || width > plot.width || depth > plot.depth)) return this.fail('É necessário comprar um terreno compatível antes de construir.');
    if (!free && stone && (!materialSource || materialSource.inventory.pedra < stone)) return this.fail(`Obra precisa de ${stone} pedras entregues no terreno.`);
    if (!free && this.treasury < capital) return this.fail('Caixa municipal insuficiente para obra e capital de operação.');
    const entity = this.createEntity({ x, y, properties: { name: this.life.buildingName(spec.label), species: 'city-building', render: { color: spec.color, style: type === 'popular_housing' ? 'popular' : type === 'luxury_housing' ? 'luxury' : type === 'popular_refectory' ? 'refectory' : type } } });
    const b = { id: entity.id, entity, type, constructionKind: kind, rotation:terrain.rotation, width, depth, floors, color: spec.color, condition: 100, units: [], balance: 0, jobs: Math.min(spec.jobs ? Math.max(spec.jobs, Math.floor(count / 6)) : 0, 32), wage: 4 + Math.floor(this.random() * 3), stock: 0, workers: [], terrain, door: terrain.door };
    b.architecture = architectureFor(type, entity.id);
    if (['residential','popular_housing','luxury_housing'].includes(type)) b.architectureColor = HOUSE_STYLES[b.architecture].wall;
    this.reputation.setup(b);
    this.economy.setupBuilding(b);
    entity.properties.cityBuilding = b;
    b.accountId = type === 'townhall' ? 'treasury' : `business:${b.id}`;
    if(type==='townhall') {
      // The municipal seat uses the existing treasury account, including funds issued before its construction.
      // Registering it again would count the same currency twice in the money supply.
      for(const field of ['balance','totalRevenue','totalExpenses']) Object.defineProperty(b,field,{
        get:()=>this.accounts.get('treasury')[field]||0,
        set:value=>{this.accounts.get('treasury')[field]=value;},
        configurable:true,enumerable:true,
      });
    } else this.accounts.set(b.accountId, b);
    if (!free && stone) { materialSource.inventory.pedra -= stone; this.economy.consumed.pedra += stone; this.economy.recordGoods('construction', 'pedra', stone, materialSource.id, b.id); }
    this.transfer('treasury', b.accountId, capital, 'Capital inicial');
    for (let z = 0; z < floors; z++) this.housing.addFloor(b, z, ownerAccountId);
    if (kind !== 'open-air') {for (let yy = y; yy < y + depth; yy++) for (let xx = x; xx < x + width; xx++) this.occupied.add(key(xx, yy));this.obstacleRevision=(this.obstacleRevision||0)+1;}
    this.buildings.push(b);
    this.buildingsById.set(b.id, b);
    this.structureRevision++;
    this.sanitation.setupBuilding(b);
    this.sanitation.setupBusinessRooms(b);
    if (plot) { plot.buildingId = b.id;plot.door={...b.door}; b.plotId = plot.id; } else this.development.attachBuilding(b, ownerAccountId);
    b.accessPath = [terrain.door, ...access];
    layDirtPath(this.world,b.accessPath);
    this.history.ownership(b, null, ownerAccountId, {action:'construction'});
    this.lastError = '';
    this.log(`${entity.properties.name}: ${b.units.length} espaços de 1×1×1.`, 'city', [], { kind: 'construction', buildingId: b.id });
    return b;
  }
  fail(message) { this.lastError = message; return null; }
  addCitizen(x, y, index = this.citizens.length, options = {}) {
    const identity = this.life.identity(index, options);
    const entity = this.createEntity({ x, y, properties: { name: identity.name, species: 'citizen', brain: {}, render: { skin: 'Human_Knight_M.png', color: 0xe8e8e8 } } });
    const c = { id: entity.id, entity, balance: 0, homeUnitId: null, jobId: null, needs: Object.fromEntries(Object.keys(NEED_LABELS).map(n => [n, 60 + this.random() * 35])), action: 'Chegando à cidade', targetId: null, path: [], task: null, happiness: 80, salaryToday: 0, taxRemainder: 0, homeId: null, mood: 0, lastProgressAt: this.minute };
    c.givenNames = identity.givenNames; c.surnames = Object.freeze(identity.surnames);
    initializeCharacter(this, c); this.reputation.setup(c);
    this.society.initializeCitizen(c, options);
    this.economy.initializeCitizen(c, index, options);
    c.entity.properties.render.size = this.society.age(c) < 6 ? .55 : this.society.isAdult(c) ? 1 : .8;
    c.accountId = `citizen:${c.id}`;
    c.indoorLocation = null;
    entity.properties.citizen = c;
    this.accounts.set(c.accountId, c);
    if (options.grant !== false) this.transfer('treasury', c.accountId, CURRENCY_RULES.citizenGrant, 'Capital inicial do cidadão');
    this.citizens.push(c);
    this.familyIndexDirty = true;
    this.relationships.register(c);
    this.structureRevision++;
    if (options.grant !== false) this.log(`${entity.properties.name} chegou à cidade.`, 'city', [c.id], { kind: 'arrival' });
    return c;
  }
  building(id) { const b = this.buildingsById.get(id); return b && !b.entity.destroyed ? b : undefined; }
  childrenOf(id) { return this.childrenByGuardian.get(id) || NO_CHILDREN; }
  indexFamilies() {
    if (!this.familyIndexDirty) return;
    this.childrenByGuardian.clear();
    for (const c of this.citizens) if (c.guardianId != null && !c.entity.destroyed) {
      let children = this.childrenByGuardian.get(c.guardianId);
      if (!children) this.childrenByGuardian.set(c.guardianId, children = []);
      children.push(c);
    }
    this.familyIndexDirty = false;
  }
  setCitizenFinance(id, settings) {
    const c = this.society.citizen(id); if (!c) return false;
    if (Number.isFinite(settings.savingsRate)) c.savingsRate = Math.max(0, Math.min(.5, settings.savingsRate));
    if (typeof settings.creditAllowed === 'boolean') c.creditAllowed = settings.creditAllowed;
    return true;
  }
  setPolicies(policies, message) {
    for (const scope of ['currency', 'bank', 'welfare']) if (policies[scope]) Object.assign(this[scope].policy, policies[scope]);
    if (Number.isFinite(policies.taxRate)) this.taxRate = Math.max(-.5, Math.min(.5, policies.taxRate));
    this.history.record('policy', message, ['treasury']);
  }
  rentUnit(citizenId, unitId) {
    const c = this.society.citizen(citizenId), u = this.units.get(unitId);
    if (!c || !u || !this.building(u.buildingId) || !['residential', 'popular_housing', 'luxury_housing'].includes(this.building(u.buildingId).type) || (u.ownerId !== c.accountId && (!u.forRent || u.ownerId === 'treasury')) || (u.tenantId && u.tenantId !== c.accountId)) return this.fail('Espaço indisponível para moradia.');
    const payer = this.payerFor(c);
    if (u.ownerId !== c.accountId && u.ownerId !== payer && this.accounts.get(payer).balance < u.rent) return this.fail('Saldo insuficiente para o primeiro aluguel.');
    if (c.homeUnitId === u.id) return u;
    if (u.ownerId !== c.accountId && !this.transfer(payer, u.ownerId, u.rent, 'Primeiro aluguel')) return null;
    this.releaseHome(c);
    u.tenantId = c.accountId; u.rentPayerId = payer === c.accountId ? null : payer; u.arrears = 0; u.missedDays = 0;
    c.homeUnitId = u.id; c.homeId = null;this.housing.invalidateResidents();
    c.path = []; c.task = null;
    this.log(`${c.entity.properties.name} ${u.ownerId === c.accountId ? 'ocupou seu próprio' : 'alugou o'} espaço ${u.id}.`, 'housing', [c.id], { kind: u.ownerId === c.accountId ? 'owner-occupancy' : 'lease', unitId: u.id });
    return u;
  }
  releaseHome(c) { this.housing.release(c); }
  buyUnit(buyerId, unitId) {
    const c = this.society.citizen(buyerId), u = this.units.get(unitId);
    if (!c || !u || !this.building(u.buildingId) || this.housing.isSocial(this.housing.homes.get(u.homeId)) || !u.forSale || u.ownerId === c.accountId) return this.fail('Espaço indisponível para compra.');
    if (!this.transfer(c.accountId, u.ownerId, u.price, 'Compra de espaço',{buildingId:u.buildingId,unitId:u.id})) return this.fail('Saldo insuficiente para a compra.');
    this.history.ownership(this.building(u.buildingId), u.ownerId, c.accountId, {unitId:u.id,amount:u.price});
    u.ownerId = c.accountId; u.forSale = false; u.forRent = !u.tenantId && ['residential', 'popular_housing', 'luxury_housing'].includes(this.building(u.buildingId).type); u.arrears = 0; u.missedDays = 0;
    this.log(`${c.entity.properties.name} comprou o espaço ${u.id}.`, 'housing', [c.id], { kind: 'purchase', unitId: u.id });
    return u;
  }
  listUnit(unitId, { rent, price, forSale, forRent }) {
    const u = this.units.get(unitId);
    if (!u || !Number.isSafeInteger(rent) || rent < 0 || !Number.isSafeInteger(price) || price < 1) return this.fail('Informe preços válidos.');
    if(this.housing.isSocial(this.housing.homes.get(u.homeId)))return this.fail('Moradia popular municipal é destinada à ocupação social gratuita.');
    u.rent = rent; u.price = price; u.forSale = u.ownerId === 'treasury' ? true : !!forSale; u.forRent = u.ownerId === 'treasury' ? false : !!forRent;
    return u;
  }
  assignHousingAndJobs() { this.economy.assignHomes(); this.economy.hire(); }
  walkable(x, y) { return !this.occupied.has(key(x, y)) && terrainWalkable(this.world, x, y); }
  findPath(start, goal, {copy=true}={}) {
    const revision = `${this.world.revision || 0}:${this.obstacleRevision||0}:${this.occupied.size}`;
    if (this.pathCacheRevision !== revision) { this.pathCache = new Map(); this.pathCacheRevision = revision; }
    const key = `${Math.floor(start.x)},${Math.floor(start.y)}:${Math.floor(goal.x)},${Math.floor(goal.y)}`;
    if (!this.pathCache.has(key)) {
      if (this.pathCache.size >= Math.max(2048,Math.min(16384,this.citizens.length*16))) this.pathCache.delete(this.pathCache.keys().next().value);
      this.pathCache.set(key, findTerrainPath(this.world, start, goal, this.occupied));
    }
    const path = this.pathCache.get(key);
    // Keep insertion-order eviction: touching every cache hit costs two Map
    // mutations across the hot path, while FIFO gives the same route answers.
    // Consumers shift their own array but never mutate waypoint coordinates.
    return path === null ? null : copy?path.slice():path;
  }
  urgentNeed(c) {
    // Exhaustion and a dirty bathroom must not postpone treatment until health
    // reaches zero: rural citizens still need time to travel to a clinic.
    if(c.needs.health<20)return 'health';
    let need,score=Infinity;
    for(const [key,threshold,penalty] of URGENT_NEEDS){const value=c.needs[key];if(value<threshold && (need===undefined || value-penalty<score)){need=key;score=value-penalty;}}
    return need;
  }

  chooseTask(c) {
    const n = c.needs;
    const home = this.building(this.units.get(c.homeUnitId)?.buildingId);
    const job = this.building(c.jobId);
    const companies=c.role==='councilor'||!c.businessIds.length?NO_CHILDREN:c.businessIds.map(id=>this.building(id)).filter(b=>b?.active).sort((a,b)=>Number(b.type==='farm')-Number(a.type==='farm'));
    const company=companies[Math.floor(this.minute/120)%Math.max(1,c.businessIds.length)]||companies[0]||null;
    const child = this.childrenOf(c.id).find(child => this.society.age(child) < 6 && Math.min(child.needs.food, child.needs.water, child.needs.hygiene, child.needs.social) < 45);
    let task = 'leisure', type = 'leisure';
    const urgent = this.urgentNeed(c);
    if (urgent) { task = urgent; type = ({ water: 'utility', food: 'market', health: 'clinic', energy: 'home', hygiene: home ? 'home' : 'utility', toilet: 'toilet' })[urgent]; }
    else if (child && this.society.isAdult(c) && Math.min(n.food, n.water, n.energy, n.hygiene) >= 25 && n.health >= 40 && n.toilet >= 15) { task = 'caregiving'; type = 'child'; c.careChildId = child.id; }
    else if (n.food < 18) { task = 'food'; type = 'market'; }
    else if (n.health < 45) { task = 'health'; type = 'clinic'; }
    else if (n.water < 45) { task = 'water'; type = 'utility'; }
    else if (n.food < 45) { task = 'food'; type = 'market'; }
    else if (n.toilet < 30) { task = 'toilet'; type = 'toilet'; }
    else if (n.energy < 25 || this.hour >= 22 || this.hour < 6) { task = 'energy'; type = 'home'; }
    else if (n.hygiene < 35) { task = 'hygiene'; type = home ? 'home' : 'utility'; }
    else if (this.society.age(c) < 6) { task = 'care'; type = 'home'; }
    else if (child && this.society.isAdult(c)) { task = 'caregiving'; type = 'child'; c.careChildId = child.id; }
    else if (c.role!=='councilor' && c.startupProjectId && this.hour >= 8 && this.hour < 17 && this.development.projects.some(p=>p.id===c.startupProjectId && !p.builderId && !p.cancelled && p.status!=='completed' && p.inventory.pedra>=p.stone)) { task='work';type='startup'; }
    else if (company && this.hour >= 8 && this.hour < 17) { task = 'manage'; type = 'company'; }
    else if (job && c.role!=='councilor' && this.hour >= 8 && this.hour < 17) { task = 'work'; type = 'job'; }
    else if (n.social < 60) { task = 'social'; type = 'leisure'; }
    else if (n.energy < 65) { task = 'energy'; type = 'home'; }
    if (this.society.age(c) < 6 && !urgent) { task = 'care'; type = 'home'; }
    if(!urgent&&Math.min(n.food,n.water,n.energy,n.toilet,n.health)>=45&&this.hour>=6&&this.hour<22&&this.paint.route(c))return;
    if (task === 'social' && this.relationships.seekContact(c)) return;
    if(task==='hygiene'&&this.sanitation.choose(c,'hygiene'))return;
    if (task === 'toilet') { if (!this.sanitation.choose(c)) { c.task = null; c.action = 'Aguardando banheiro acessível'; } return; }
    if (task === 'food' && this.workMeals.routeToMeal(c)) return;
    if (task === 'food' && c.provisions > 0) {
      if(!home || n.food<25){c.task='provisions';c.path=[];c.targetId=null;return;}
      task = 'provisions'; type = 'home';
    }
    if(!urgent && this.society.isAdult(c) && !['work','manage','care','caregiving','food','provisions','toilet'].includes(task) && this.hour>=6 && this.hour<22 && this.minute-(c.lastShoppingAt||0)>180 && this.minute-(c.lastShoppingSearchAt??-Infinity)>=30) {
      c.lastShoppingSearchAt=this.minute;
      const shops=this.economy.businesses.filter(b=>this.economy.consumerOffer(c,b)).map((b,index)=>({b,index,score:Math.hypot(b.door.x-c.entity.x,b.door.y-c.entity.y)+this.relationships.businessPenalty(c,b)-((c.knownAdvertisements?.[b.id]||0)>this.minute?2:0)})).sort((a,b)=>a.score-b.score||a.index-b.index);
      for(const {b:shop} of shops) {const path=this.findPath(c.entity,shop.door);if(path!==null){c.path=path;c.targetId=shop.id;c.task='shopping';return;}}
    }
    const childHome = child ? this.building(this.units.get(child.homeUnitId)?.buildingId) : null;
    const siteProject = this.development.projectFor(c, type === 'job' ? job : type === 'company' ? company : null);
    if (!urgent && siteProject && ['work', 'manage', 'leisure'].includes(task) && this.hour >= 8 && this.hour < 17) {
      const path = this.findPath(c.entity, siteProject.door);
      if (path !== null) { this.development.reserveConstruction(siteProject); c.path = path; c.task = 'construction'; c.workProjectId = siteProject.id; c.targetId = siteProject.builderId; return; }
    }
    const hall = this.buildings.find(b => b.type === 'townhall' && !b.entity.destroyed);
    const candidates = type === 'company' ? [company] : task === 'food' ? this.buildings.slice() : type === 'child' ? (childHome ? [childHome] : home ? [home] : []) : type === 'home' ? (home ? [home] : []) : type === 'job' ? [job] : this.buildings.filter(b => !b.entity.destroyed && (b.type === type||['clinic','leisure'].includes(type)&&civicSpec(b)?.need===(type==='clinic'?'health':'leisure')));
    if (hall && ((type === 'home' && !home) || ['utility', 'clinic', 'leisure'].includes(type))) { const serviceCost = this.currency.price({ utility: 35, clinic: 240, leisure: 25 }[type] || 0); const cash = this.accounts.get(this.payerFor(c))?.balance || 0; if (!candidates.includes(hall)) candidates.push(hall); if(cash<serviceCost&&!candidates.some(b=>civicSpec(b)&&!b.ownerId&&civicStatus(this,b,c)?.ready))candidates.splice(0,candidates.length,hall); }
    const foodScores=task==='food'?new Map(candidates.map(b=>[b,this.economy.mealScore(c,b)])):null;
    candidates.sort((a, b) => foodScores ? foodScores.get(a)-foodScores.get(b) : Math.hypot(a.door.x-c.entity.x,a.door.y-c.entity.y)-Math.hypot(b.door.x-c.entity.x,b.door.y-c.entity.y));
    for (const b of candidates) {
      if (foodScores && !Number.isFinite(foodScores.get(b))) continue;
      if(['health','leisure','social'].includes(task)&&civicSpec(b)&&!civicStatus(this,b,c)?.ready)continue;
      const path = this.findPath(c.entity, b.door);
      if (path !== null) {
        c.path = path; c.targetId = b.id; c.task = task; if (task === 'food') this.workMeals.issueVoucher(c, b); return;
      }
    }
    c.task = null; c.targetId = null; c.action = task === 'food' ? 'Alimentos indisponíveis nas lojas locais' : home ? 'Sem acesso ao serviço' : 'Sem moradia';
    if (task === 'food' && (!c.foodShortageAt || this.minute - c.foodShortageAt >= 60)) { c.foodShortageAt = this.minute; this.economy.failedMeals++; this.log(`${c.entity.properties.name} não encontrou alimentos à venda.`, 'production', [c.id], { kind: 'food-shortage' }); }
    if (task === 'energy') n.energy = clamp(n.energy + 0.1);
  }
  performTask(c) {
    if(!syncCitizenInterior(this,c))return;
    if(c.task==='council-session'){this.politics.council.getChamber().arrive(c);return;}
    if(['paint-purchase','paint-delivery'].includes(c.task)){this.paint.arrive(c);return;}
    if(c.task==='research'){this.politics.getResearch().fieldWork(c);return;}
    if(c.task==='interview'){this.politics.getResearch().respondentWait(c);return;}
    if(c.task==='vote'){this.politics.voting.arrive(c);return;}
    if(c.task==='campaign'){this.politics.campaigns.arrive(c);return;}
    if(c.task==='visit'){this.relationships.arrive(c);return;}
    if (c.task === 'toilet') { this.sanitation.use(c); return; }
    if (c.task === 'workmeal') { if (!this.workMeals.tryStart(c)) {c.task = null;c.mealResume=null;} return; }
    if (c.task === 'construction') {
      const project = this.development.projects.find(p => p.id === c.workProjectId);
      const builder = this.building(project?.builderId);
      if (!project || project.status === 'completed' || project.cancelled || this.hour < 8 || this.hour >= 17) { c.task = null; return; }
      if (builder && builder.ownerId !== c.id && (c.jobId !== builder.id || builder.balance < builder.wage)) { c.task = null; return; }
      if (this.development.work(project, c)) {
        if (builder && builder.ownerId !== c.id) this.payWage(c,builder,builder.wage);
        c.action = ['road', 'road-repair'].includes(project.service) ? 'Construindo ou reparando estrada' : project.service === 'lamp' ? 'Instalando poste' : project.service === 'expansion' ? 'Ampliando edifício' : `Construindo no terreno ${project.plotId}`;
      } else { c.action = 'Aguardando materiais da obra'; c.task = null; }
      if (this.urgentNeed(c)) c.task = null;
      return;
    }
    if (c.task === 'provisions') {
      const n=c.needs;
      if (c.provisions <= 0) { c.task = null; return; }
      if (c.servicePaid !== 'provisions') { c.provisions--; c.servicePaid = 'provisions'; this.log(`${c.entity.properties.name} consumiu uma refeição trazida na chegada.`, 'production', [c.id], { kind: 'initial-provision-consumed' }); }
      n.food = clamp(n.food + 30); c.action = 'Comendo suas provisões';
      if (n.food >= 95) { c.task = null; c.servicePaid = null; }
      return;
    }
    const b = this.building(c.targetId), n = c.needs;
    if (!b) { c.task = null; return; }
    const task = c.task;
    if(task==='shopping'){this.economy.buyConsumerGood(c,b);c.lastShoppingAt=this.minute;c.action='Comprando produtos para a vida cotidiana';c.task=null;return;}
    if (task === 'work' || task === 'manage') {
      if(c.role==='councilor'){c.task=null;return;}
      if (this.hour < 8 || this.hour >= 17 || !b.active) { c.task = null; return; }
      const isOwner = task === 'manage' && b.ownerId === c.id;
      const wage = b.wage + this.currency.price(Math.floor((c.skills[JOB_SKILL[b.type]] || 0) / 30));
      if (!isOwner && b.balance < wage) { this.payWage(c,b,wage); c.action = 'Empregador sem caixa'; c.task = null; return; }
      if(b.constructionKind==='open-air'&&!['farm','quarry','forestry'].includes(b.type)){const cells=b.units.filter(u=>!['bathroom','dining'].includes(u.roomType)),cell=cells[c.id%Math.max(1,cells.length)];if(cell&&!outdoorCellReady(this,c,b,cell))return;}
      const productive = this.economy.productionWork(b, c);
      if (productive || !PRIVATE_TYPES.has(b.type)) {
        if (!isOwner) this.payWage(c,b,wage);
        this.economy.practice(c, JOB_SKILL[b.type]);
      }
      if (isOwner) this.economy.practice(c, 'management');
      if(b.type==='forestry'&&productive){if(Math.min(n.food,n.water,n.energy,n.toilet,n.hygiene,n.health)<22){c.task=null;c.path=[];}return;}
      c.action = b.type==='cycle_workshop'&&c.mechanicJob?'Reparando veículo no local com peças transportadas':c.id === this.economy.mayorId ? 'Administrando a prefeitura' : isOwner ? `Gerindo ${b.entity.properties.name}` : productive ? `Trabalhando: ${JOB_SKILL[b.type]}` : b.type === 'farm' ? 'Aguardando crescimento da plantação' : 'Aguardando matéria-prima';
      if (Math.min(n.food, n.water, n.energy, n.toilet, n.hygiene, n.health) < 22) c.task = null;
      return;
    }
    if (task === 'care' || task === 'caregiving') {
      const child = task === 'care' ? c : this.society.citizen(c.careChildId);
      const guardian = child ? this.society.guardian(child) : null;
      if (!child || !guardian || !child.homeUnitId) { c.action = 'Aguardando responsável e moradia'; c.task = null; return; }
      if (task === 'care') { c.action = `Em casa, aos cuidados de ${guardian.entity.properties.name}`; c.needs.energy = clamp(c.needs.energy + .5); return; }
      if (Math.hypot(child.entity.x - c.entity.x, child.entity.y - c.entity.y) > 2 || child.path.length) { c.action = `Esperando ${child.entity.properties.name} em casa`; return; }
      if (c.servicePaid !== `care:${child.id}`) {
        const market = this.buildings.filter(b=>Number.isFinite(this.economy.mealScore(child,b))).sort((a,b)=>this.economy.mealScore(child,a)-this.economy.mealScore(child,b))[0];
        const water = this.buildings.find(b => b.type === 'townhall' && !b.entity.destroyed) || this.buildings.find(b => b.type === 'utility' && !b.entity.destroyed);
        const mealPrice = market ? this.economy.mealOffer(market,child).price : 0;
        const usesProvisions = c.provisions > 0;
        const carePayer = this.payerFor(child), waterPrice = water?.type==='townhall'?0:this.currency.price(35);
        if (!water || (!market && !usesProvisions) || (this.accounts.get(carePayer)?.balance || 0) < (usesProvisions ? waterPrice : mealPrice + waterPrice)) { c.action = 'Sem alimentos ou recursos para os cuidados'; c.task = null; return; }
        if (usesProvisions) c.provisions--;
        else if (!this.economy.consumeMeal(child, market)) { c.task = null; return; }
        this.transfer(carePayer, water.accountId, waterPrice, 'Água para cuidados infantis');
        c.servicePaid = `care:${child.id}`;
        const event=this.log(`${c.entity.properties.name} está cuidando de ${child.entity.properties.name}.`, 'family', [c.id, child.id], { kind: 'childcare' });
        this.relationships.careEvent(c,child,event.id);
      }
      for (const need of ['food', 'water', 'hygiene', 'toilet', 'social', 'leisure']) child.needs[need] = clamp(child.needs[need] + 4);
      this.economy.practice(c, 'care');
      child.needs.energy = clamp(child.needs.energy + .4); child.needs.health = clamp(child.needs.health + .5); c.needs.social = clamp(c.needs.social + 1);
      c.action = `Cuidando de ${child.entity.properties.name}`;
      if (Math.min(child.needs.food, child.needs.water, child.needs.hygiene, child.needs.social) >= 90) { c.task = null; c.servicePaid = null; }
      return;
    }
    if(['health','leisure','social'].includes(task)&&civicVisit(this,c,b))return;
    const price = this.currency.price(SERVICE_PRICES[task]);
    if (c.servicePaid !== `${b.id}:${task}`) {
      if (task === 'food' ? !this.economy.consumeMeal(c, b) : !this.transfer(this.payerFor(c), b.accountId, b.type === 'townhall' ? 0 : price, `Serviço: ${NEED_LABELS[task] || task}`)) { c.action = 'Sem dinheiro para o serviço'; c.task = null; return; }
      c.servicePaid = `${b.id}:${task}`;
    }
    const rate=task==='energy'?(c.homeUnitId?.9:.45):SERVICE_RATES[task];
    if (rate===undefined) { this.life.resetTask(c, 'serviço indisponível'); return; }
    n[task] = clamp(n[task] + rate);
    if(b.type==='townhall'&&task==='health'&&n.health>=65){n.health=65;c.task=null;c.servicePaid=null;return;}
    c.action = SERVICE_ACTIONS[task];
    if (task === 'social') { n.social = clamp(n.social - rate); c.socialWaitStarted ??= this.minute; if (this.minute - c.socialWaitStarted >= 30) { c.task = null; c.socialWaitStarted = null; n.leisure = clamp(n.leisure + 3); } }
    if (task === 'food' && n.food >= 95) c.foodVoucher = null;
    if (n[task] >= 95 || (task === 'energy' && this.hour >= 7 && this.hour < 22 && n.energy > 65)) { c.task = null; c.servicePaid = null; }
    if (task === 'energy' && Math.min(n.food, n.water, n.toilet) < 20) c.task = null;
  }
  payWage(c, b, wage = b.wage + this.currency.price(Math.floor((c.skills[JOB_SKILL[b.type]] || 0) / 30))) {
    if(c.id===this.economy.mayorId)return true; // Mayor receives only the voted daily salary.
    if (!Number.isSafeInteger(wage) || wage < 0) return false;
    if (b.balance < wage) {
      recordWork(this,c,b,wage,false);
      if(c.unpaidWageDay!==this.day){c.unpaidWageDay=this.day;this.reputation.observe(b.accountId,'commerce',-1,'falta de caixa para o salário',{citizenIds:[c.id]});this.relationships.workEvent(b,c,false);}
      return false;
    }
    const rate=Math.max(-.5,Math.min(.5,Number(this.taxRate)||0));
    // Separate fractional cents preserve accuracy when the policy changes direction.
    const remainderKey=rate<0?'subsidyRemainder':'taxRemainder';
    const exact=wage*Math.abs(rate)+(c[remainderKey]||0);
    const amount=Math.floor(exact+1e-9),tax=rate>=0?amount:0;
    if(!this.transfer(b.accountId,c.accountId,wage-tax,'Salário'))return false;
    c[remainderKey]=Math.max(0,exact-amount);
    if(tax){this.transfer(b.accountId,'treasury',tax,'Imposto sobre salário');c.taxPaidToday=(c.taxPaidToday||0)+tax;}
    recordWork(this,c,b,wage,true);
    c.salaryToday+=wage-tax;c.lastPaidAt=this.minute;
    if(c.reputationWorkDay!==this.day){c.reputationWorkDay=this.day;this.reputation.observe(c.accountId,'reliability',.5,'trabalho remunerado realizado',{buildingId:b.id});this.relationships.workEvent(b,c,true);}
    if(rate<0 && amount>0) {
      const freeCash=c.balance<this.welfare.subsistenceFloor(c)?this.treasury:Math.max(0,this.treasury-this.welfare.conditions().reserve),subsidy=Math.min(amount,freeCash);
      if(subsidy>0 && this.transfer('treasury',c.accountId,subsidy,'Subsídio salarial municipal')) {
        c.wageSubsidyToday=(c.wageSubsidyToday||0)+subsidy;
        c.wageSubsidyTotal=(c.wageSubsidyTotal||0)+subsidy;
        this.wageSubsidies.paidToday+=subsidy;this.wageSubsidies.totalPaid+=subsidy;
      }
      const unpaid=amount-subsidy;
      c.wageSubsidyUnpaidToday=(c.wageSubsidyUnpaidToday||0)+unpaid;
      this.wageSubsidies.unpaidToday+=unpaid;
    }
    return true;
  }
  collectRent() { this.housing.collectRent(); }
  dailyEconomy() {
    this.currency.daily();
    this.wageSubsidies.paidToday=0;this.wageSubsidies.unpaidToday=0;
    this.collectRent();
    for (const c of this.citizens) {
      if (c.entity.destroyed) continue;
      c.salaryYesterday = c.salaryToday; c.salaryToday = 0; c.wageSubsidyToday=0;c.wageSubsidyUnpaidToday=0;c.taxPaidToday=0; c.mealAllowanceToday = 0;
      const home = this.housing.home(c);
      if (home && this.society.isAdult(c) && this.housing.units(home).every(u => u.forSale)) this.housing.buyHome(c, home);
    }
    this.fiscal?.daily();this.fiscal?.fundServices();
    this.economy.daily();
    this.assignHousingAndJobs();
    this.log(`Dia ${this.day}: aluguéis e orçamento processados.`, 'economy', [], { kind: 'daily-budget' });
  }
  reconcile() {
    if(this.buildings.some(b=>b.entity.destroyed))for (const b of [...this.buildings]) if (b.entity.destroyed) {
      for (const u of b.units) { this.units.delete(u.id); }
      for (let y = b.entity.y; y < b.entity.y + b.depth; y++) for (let x = b.entity.x; x < b.entity.x + b.width; x++) this.occupied.delete(key(x, y));
      this.obstacleRevision=(this.obstacleRevision||0)+1;
      for (const c of this.citizens) {
        if (c.jobId === b.id) {this.history.employment(c,b,'desligamento','Edifício demolido');c.jobId=null;}
        if (!this.units.has(c.homeUnitId)) c.homeUnitId = null;
        if (c.targetId === b.id) { c.task = null; c.path = []; }
      }
      for (const shipment of this.logistics.shipments) if (shipment.seller === b || shipment.buyer === b) this.logistics.cancel(shipment);
      const hall = this.buildings.find(h => h.type === 'townhall' && !h.entity.destroyed);
      for (const [good, stock] of Object.entries(b.inventory)) {
        const qty = stock + (good === 'lixo' ? b.litter || 0 : 0),stored = Math.min(qty, hall ? inventoryFree(hall) : 0);
        if (hall) {hall.inventory[good] += stored;this.publications.moveStock(b,hall,good,stored);this.vehicles.moveStock(b,hall,good,stored);this.paint.move(b,hall,good,stored);if(good==='roupas')moveGarments(b,hall,stored);}
        this.economy.lost[good] += qty - stored;this.publications.loseStock(b,good,qty-stored);this.vehicles.loseStock(b,good,qty-stored);b.inventory[good] = 0;
      }
      b.litter = 0;
      for(const v of this.vehicles.units.values())if(v.active&&v.ownerAccountId===b.accountId){v.ownerAccountId=this.economy.citizen(b.ownerId)?.accountId||'treasury';if(v.fuelStore)v.fuelStore.accountId=v.ownerAccountId;}
      this.publications.inherit(b.accountId,'treasury');
      this.transfer(b.accountId, this.economy.citizen(b.ownerId)?.accountId || 'treasury', b.balance, 'Encerramento de prédio');
      const owner = this.economy.citizen(b.ownerId); if (owner) owner.businessIds = owner.businessIds.filter(id => id !== b.id);
      this.log(`${b.entity.properties.name} foi demolido.`, 'city', [], { kind: 'demolition', buildingId: b.id });
      this.buildings.splice(this.buildings.indexOf(b), 1);
      this.buildingsById.delete(b.id);
      this.structureRevision++;
    }
    if(this.citizens.some(c=>c.entity.destroyed))for (const c of [...this.citizens]) if (c.entity.destroyed) {
      const heir = c.dead ? this.life.heir(c) : null;
      this.vehicles.removeCitizen(c,heir);
      if (heir) for (const b of this.economy.businesses.filter(b => b.ownerId === c.id)) { this.history.ownership(b,c.accountId,heir.accountId,{action:'inheritance'}); b.ownerId = heir.id; if (!heir.businessIds.includes(b.id)) heir.businessIds.push(b.id); }
      this.economy.removeCitizen(c);
      this.society.removeCitizen(c);
      if (!c.dead) this.log(`${c.entity.properties.name} saiu da cidade.`, 'city', [c.id], { kind: 'departure' });
      this.releaseHome(c);
      for (const u of this.units.values()) if (u.ownerId === c.accountId) { const resident = this.accounts.get(u.tenantId); if (!heir && resident?.homeUnitId === u.id) this.releaseHome(resident); this.history.ownership(this.building(u.buildingId),c.accountId,heir?.accountId||'treasury',{unitId:u.id,action:'inheritance'}); u.ownerId = heir?.accountId || 'treasury'; u.forSale = true; u.forRent = !!heir; }
      this.economy.leaveJob(c, c.dead ? 'Falecimento' : 'Saída da cidade');
      this.bank.closeClient(c, heir);
      this.publications.inherit(c.accountId,heir?.accountId||'treasury');
      if(c.forestryJob?.load){this.economy.lost.madeira+=c.forestryJob.load;this.log('Madeira perdida com a interrupção do transporte florestal.','nature',[c.id],{quantity:c.forestryJob.load,buildingId:c.forestryJob.buildingId});}
      if(c.forestrySeeds)this.economy.lost.sementes+=c.forestrySeeds;
      for(const [good,n]of Object.entries(c.campaignInventory||{}))this.economy.lost[good]+=n;
      this.economy.lost.tinta+=c.paintBag?.inventory.tinta||0;
      this.economy.lost.roupas+=(c.wardrobe||[]).filter(g=>g.manufacturedAt!=null&&!g.discarded).length;
      this.transfer(c.accountId, heir?.accountId || 'treasury', c.balance, c.dead ? 'Herança' : 'Saída de cidadão');
      this.sanitation.releaseCitizen(c);
      this.citizens.splice(this.citizens.indexOf(c), 1);
      this.structureRevision++;
    }
    for (const child of this.citizens) if (!this.society.isAdult(child) && child.guardianId != null) {
      const parent = this.society.guardian(child);
      if (parent && (child.homeId !== parent.homeId || child.homeUnitId !== parent.homeUnitId)) this.society.houseChild(child);
    }
  }
  stepMinute() {
    this.minute++;
    this.indexFamilies();
    this.reconcile();
    const reconcileRevision = `${this.structureRevision}:${this.world.revision}:${this.development.projects.length}`;
    if (this.reconciledRevision !== reconcileRevision || this.minute % 5 === 0) {
      this.development.reconcile(); this.lighting.reconcile();
      this.housing.reconcile(); this.sanitation.reconcile();
      this.reconciledRevision = reconcileRevision;
    }
    this.sanitation.updateMinute();
    for (const c of this.citizens)if(c.workMeal||(c.jobId||c.businessIds.length)&&c.needs.food<45)this.workMeals.tryStart(c);
    this.logistics.updateMinute();
    this.politics.voting.updateMinute();
    this.politics.getResearch().updateMinute();
    this.politics.council.getChamber().minute();
    this.politics.campaigns.getMaterials().minute();
    this.vehicles.minute();
    if (this.minute % 1440 === 0) { this.society.daily(); this.dailyEconomy(); }
    if (this.minute % 60 === 0) this.flushPayroll();
    const hasTownhall = this.buildings.some(b => b.type === 'townhall' && !b.entity.destroyed);
    for (const c of this.citizens) {
      const n = c.needs;
      // Idle adults cannot choose another activity until their short retry
      // window expires. Accumulate their passive need changes in one pass;
      // active workers, travelers, conversations and children still run each
      // minute. The window is at most five city minutes.
      if(!c.entity.destroyed&&c.initialAge>=18&&!c.task&&!c.path.length&&!c.deliveryId&&!c.cleaningJobId&&!c.conversation&&!c.workMeal&&!c.mobilityTrip&&!c.ridingVehicleId&&!c.indoorLocation&&!this.childrenOf(c.id).length&&c._idleHomeId===c.homeUnitId&&this.minute<(c._nextTaskAt||0)&&this.minute%60!==0)continue;
      const elapsed=Math.max(1,this.minute-(c._lastNeedsAt??this.minute-1));c._lastNeedsAt=this.minute;c._idleHomeId=c.homeUnitId;
      const age=this.society.age(c);
      if(c._renderAge!==age){c._renderAge=age;c.entity.properties.render.size=age<6?.55:age>=18?1:.8;}
      // These fixed fields are the hottest loop; direct access avoids temporary
      // iterators and dynamic property lookups for every resident and city minute.
      n.food=clamp(n.food-.065*elapsed);n.water=clamp(n.water-.09*elapsed);n.energy=clamp(n.energy-.055*elapsed);
      n.hygiene=clamp(n.hygiene-.045*elapsed);n.toilet=clamp(n.toilet-.085*elapsed);n.social=clamp(n.social-.035*elapsed);n.leisure=clamp(n.leisure-.035*elapsed);
      n.shelter = clamp(n.shelter + (c.homeUnitId ? 0.5 : -0.2)*elapsed);
      n.safety = clamp(n.safety + (hasTownhall ? 0.08 : -0.1)*elapsed);
      n.health = clamp(n.health + (Math.min(n.food, n.water, n.energy, n.hygiene) < 10 ? -.12 : .025)*elapsed);
      c.mood = (c.mood || 0) * (elapsed===1?.998:Math.pow(.998,elapsed));
      const totalNeeds=n.food+n.water+n.energy+n.hygiene+n.toilet+n.social+n.leisure+n.health+n.shelter+n.safety;
      let comfort=0;if(c.homeUnitId&&c.homeComfort)for(const key in c.homeComfort)if(c.homeComfort[key]>this.minute)comfort++;
      c.happiness = clamp(totalNeeds / 10 + (c.jobId&&c.career?(c.career.motivation-50)*.08:0) + c.mood + clothingMood(c) + this.relationships.moodEffect(c) + Math.min(6,comfort)*2);
      if (this.life.minute(c,elapsed)) continue;
      advanceCitizenInterior(this,c,elapsed);
      if(c.mobilityTrip||c.ridingVehicleId)continue;
      if (this.workMeals.advance(c)) continue;
      const urgent = this.urgentNeed(c);
      if (urgent && c.conversation) { const other = this.society.citizen(c.conversation.a === c.id ? c.conversation.b : c.conversation.a); if (other) other.conversation = null; c.conversation = null; }
      const completingEssential = !c.path.length && (!['toilet','food','health'].includes(c.task)||!!c.indoorLocation?.unitId&&!c.indoorLocation?.path?.length) && ESSENTIAL_TASKS.has(c.task) && n[c.task === 'provisions' || c.task === 'workmeal' ? 'food' : c.task] < 75;
      if (!c.deliveryId && !c.cleaningJobId && urgent && (['workmeal','provisions'].includes(c.task)?'food':c.task) !== urgent && !completingEssential && age >= 6) { c.task = null; c.path = []; }
      let dependentNeedsCare=false;for(const child of this.childrenOf(c.id))if(this.society.age(child)<6&&Math.min(child.needs.food,child.needs.water,child.needs.hygiene,child.needs.social)<25){dependentNeedsCare=true;break;}
      if (!c.deliveryId && !urgent && dependentNeedsCare && (INTERRUPTIBLE_TASKS.has(c.task) || (c.task === 'energy' && n.energy > 65)) && !c.conversation) { c.task = null; c.path = []; }
      if (c.deliveryId || c.cleaningJobId) continue;
      if (c.conversation) continue;
      if (!c.task) {
        // An idle citizen used to repeat the same path/offer search every city
        // minute, even after finishing leisure at 95% or finding no service.
        // Retry on a changed urgent need, at shift boundaries, or after a short
        // delay. At 32× this is only a fraction of a real second.
        if(this.minute<(c._nextTaskAt||0)&&c._retryUrgent===urgent&&this.minute%60!==0)continue;
        c.servicePaid = null; this.chooseTask(c);
      }
      if (!c.path.length && c.task) this.performTask(c);
      if(!c.task){c._nextTaskAt=this.minute+5;c._retryUrgent=urgent;}
    }
    for(const c of this.citizens)if(c._lastNeedsAt===this.minute||c.task||c.path.length||c.indoorLocation)syncCitizenInterior(this,c);
    this.society.updateMinute();
    const movers=this._movingCitizens??=[];movers.length=0;
    for(const c of this.citizens)if(c.path.length||c.deliveryId||c.ridingVehicleId)movers.push(c);
    // Spread hourly work across minutes; keep the same order and one run per hour.
    if (this.minute % 60 === 0) this.hourlyPhase = 0;
    if (this.hourlyPhase != null && this.hourlyPhase < 13) this.economy.hourly(this.hourlyPhase++);
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
    const movers=this._movingCitizens||[];
    if(this.vehicles.activeCount&&this._lastVehicleScanMinute!==this.minute){
      this._lastVehicleScanMinute=this.minute;
      for(const c of movers)if(!c.ridingVehicleId)this.vehicles.tryTrip(c);
    }
    for (const c of movers) {
      if(c.ridingVehicleId||c.indoorLocation?.exiting)continue;
      // Vehicle eligibility is minute based (including its 20-minute search
      // cooldown); polling it on every animation frame repeats the same scans
      // up to 60 times before any relevant state can change.
      const load=c.deliveryId?this.logistics.shipments.find(s=>s.id===c.deliveryId):null;
      if(load?.pickedUp&&!c.mobilityTrip&&load.quantity>(c.equipment?.carrinho?72:c.equipment?.cesta?36:24)){c.action='Aguardando veículo para transportar a carga';continue;}
      if (c.conversation || c.workMeal || !c.path.length) continue;
      let distance = dt * (this.society.isAdult(c) ? 4 : 2.5);
      while (distance > 0 && c.path.length) {
        const p = c.path[0];
        if (!this.walkable(Math.floor(p.x), Math.floor(p.y)) || !canStep(this.world, Math.floor(c.entity.x), Math.floor(c.entity.y), Math.floor(p.x), Math.floor(p.y))) { c.path = []; c.task = null; break; }
        const dx = p.x - c.entity.x, dy = p.y - c.entity.y, len = Math.hypot(dx, dy);
        const tx=Math.floor(p.x),ty=Math.floor(p.y),tile=tileAt(this.world,tx,ty),cost=roadTravelCost(tile),available=distance/cost,travelled=Math.min(len,available);
        if (len <= available) { c.entity.x = p.x; c.entity.y = p.y; this.recordTraffic(p); c.path.shift(); distance = Math.max(0,distance-len*cost); }
        else { c.entity.x += dx / len * available; c.entity.y += dy / len * available; distance = 0; }
        if(travelled>0){
          wearRoad(this.world,tx,ty,travelled*ROAD_RULES.wearPerCell);
          if(DIRT_ROAD_TILES.has(tile)){c.needs.hygiene=clamp(c.needs.hygiene-travelled*ROAD_RULES.hygienePerDirtCell);c.mood=Math.max(-25,(c.mood||0)-travelled*ROAD_RULES.moodPerDirtCell);}
        }
        c.action = c.deliveryId ? 'Transportando mercadorias' : c.task==='council-session'?'Indo ao plenário da Câmara':c.task === 'research' ? 'Indo ao ponto de entrevistas' : c.task === 'vote' ? 'Indo votar na prefeitura' : c.task === 'construction' ? 'Indo para a obra' : c.forestryJob&&['work','manage'].includes(c.task)?(c.forestryJob.stage==='return'?'Levando madeira à silvicultura':c.forestryJob.stage==='cut'?'Indo cortar uma árvore':'Indo plantar uma árvore'):c.task === 'workmeal' ? 'Indo ao refeitório da empresa' : c.task === 'visit' ? `Indo visitar ${this.society.citizen(c.socialVisitId)?.entity.properties.name||'pessoa próxima'}` : `Indo: ${NEED_LABELS[c.task] || 'Trabalho'}`;
      }
      if(!c.path.length)syncCitizenInterior(this,c);
    }
    this.vehicles.update(dt);
  }
  goodsStock(good) {
    const campaignCarried=this.citizens.reduce((n,c)=>n+(c.campaignInventory?.[good]||0),0);
    const carried=good==='madeira'?this.citizens.reduce((n,c)=>n+(c.forestryJob?.load||0),0):good==='sementes'?this.citizens.reduce((n,c)=>n+(c.forestrySeeds||0),0):0;
    const worn=good==='roupas'?this.citizens.reduce((n,c)=>n+(c.wardrobe||[]).filter(g=>g.manufacturedAt!=null&&!g.discarded).length,0):0;
    const printed=['livros','panfletos','jornais'].includes(good)?[...this.publications.documents.values()].filter(d=>!d.lost&&d.good===good&&!this.publications.inventoryHolder(d.ownerAccountId)).length:0;
    return this.paint.goodsStock(good)+this.vehicles.goodsStock(good)+printed+worn+campaignCarried+carried+[...this.buildings, ...this.development.projects, ...this.logistics.shipments, ...this.lighting.propertyStores.values()].reduce((n, h) => n + (h.inventory[good] || 0) + (good === 'lixo' ? h.litter || 0 : 0), 0);
  }
  stats() {
    if (this._statsCache && this._statsMinute === this.minute && this._statsStructure === this.structureRevision) return this._statsCache;
    this._statsMinute = this.minute; this._statsStructure = this.structureRevision;
    const people = this.citizens.filter(c => !c.entity.destroyed);
    const units = [...this.units.values()];
    const employers=this.buildings.filter(b=>b.active&&!b.entity.destroyed);
    const jobs=employers.reduce((n,b)=>n+b.jobs,0),vacancies=employers.reduce((n,b)=>n+Math.max(0,b.jobs-b.workers.length),0);
    return this._statsCache = { mayorId: this.economy.mayorId, entrepreneurs: people.filter(c => c.businessIds.length).length, moneySupply: this.currency.supply(), moneyIssued: this.currency.issued, priceIndex: this.currency.priceIndex, inflation: this.currency.dailyInflation, businesses: this.economy.businesses.length, population: people.length, children: people.filter(c => !this.society.isAdult(c)).length, couples: people.filter(c => c.partnerId).length / 2, friendships: [...this.society.relations.values()].filter(r => r.active!==false && ['friend', 'close'].includes(r.status)).length, births: this.society.birthCount, deaths: this.life.deathCount, employed: people.filter(c => c.jobId).length, homeless: people.filter(c => !c.homeUnitId).length, happiness: people.length ? Math.round(people.reduce((s, c) => s + c.happiness, 0) / people.length) : 0, units: units.length, occupied: units.filter(u => u.tenantId || u.occupantId).length, jobs, vacancies, treasury: this.treasury };
  }
}
