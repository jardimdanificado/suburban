import {productionPlan,investProductionPlan} from './city_production_planner.js';
import {manufactureClothes,clothingOffer,buyClothes,updateClothes,initializeClothes} from './city_clothing.js';
import {newspaperOffer,printNewspaper} from './city_newspapers.js';
import {oilSupply,investOilChain} from './city_oil_supply.js';
import { updateMarket, planSupplyChains, bootstrapEnterprise, carryCapacity, kitchenWork, preparedOffer } from './city_markets.js';
import { CityServiceInvestment, ESSENTIAL_SERVICES } from './city_service_investment.js';
import { INDUSTRIES, INDUSTRIAL_GOODS, INDUSTRIAL_FOODS, MEAL_COMPONENTS, KITCHEN_RECIPES } from './city_industries.js';
import { quarryDeposits } from './city_terrain.js';
import { inventoryFree, initializeInventory } from './city_inventory.js';
import { inspectBuildingSite, tileAt, settlementConnected } from './city_terrain.js';

export const SKILLS = { agriculture: 'Agricultura', baking: 'Panificação', commerce: 'Comércio', management: 'Gestão', governance: 'Administração pública', medicine: 'Saúde', maintenance: 'Manutenção', social: 'Comunicação', care: 'Cuidados', construction: 'Construção', mining: 'Mineração', logistics: 'Logística', cleaning: 'Faxina', recycling: 'Reciclagem', minting: 'Cunhagem' };
export const CROPS = {
  arroz:{label:'Arroz',grow:150,price:95},alface:{label:'Alface',grow:75,price:80},tomate:{label:'Tomate',grow:100,price:110},
  girassol: { label: 'Girassol', grow: 180, price: 140 },
  maca: { label: 'Maçã', grow: 180, price: 100 }, goiaba: { label: 'Goiaba', grow: 160, price: 100 },
  trigo: { label: 'Trigo', grow: 120, price: 90 }, milho: { label: 'Milho', grow: 100, price: 95 },
  mandioca: { label: 'Mandioca', grow: 200, price: 105 }, cebola: { label: 'Cebola', grow: 140, price: 95 },
  feijao: { label: 'Feijão', grow: 150, price: 100 }, coentro: { label: 'Coentro', grow: 80, price: 90 },
};
export const GOODS = { ...INDUSTRIAL_GOODS, ...CROPS, oleo: { label: 'Óleo de girassol', price: 450 }, pao: { label: 'Pão', price: 180 }, pedra: { label: 'Pedra', price: 10000 }, sementes: { label: 'Sementes', price: 10 }, lixo: { label: 'Lixo', price: 20 } };
export const PRIVATE_TYPES = new Set([...Object.keys(INDUSTRIES), 'farm', 'bakery', 'greengrocer', 'market', 'builder', 'quarry', 'carrier', 'cleaner', 'waste_collector', 'recycler', 'paid_toilet', 'mill']);
export const PUBLIC_TYPES = new Set(['townhall','council_chamber', 'clinic', 'utility', 'leisure', 'public_toilet', 'mint', 'popular_housing', 'luxury_housing', 'popular_refectory']);
const retailTypes = new Set(['bakery', 'greengrocer', 'market']);
const edible = [...Object.keys(CROPS).filter(g => !['trigo', 'girassol'].includes(g)), ...INDUSTRIAL_FOODS];
export const JOB_SKILL = { ...Object.fromEntries(Object.entries(INDUSTRIES).map(([id,s])=>[id,s.skill])), mill: 'maintenance', farm: 'agriculture', bakery: 'baking', market: 'commerce', greengrocer: 'commerce', popular_refectory: 'care', townhall: 'governance', clinic: 'medicine', utility: 'maintenance', leisure: 'social', builder: 'construction', quarry: 'mining', carrier: 'logistics', cleaner: 'cleaning', waste_collector: 'logistics', recycler: 'recycling', paid_toilet: 'cleaning', public_toilet: 'maintenance', mint: 'minting' };
// Keep a multi-week public food reserve so farms can be founded, staffed,
// planted and harvested before the town hall's opening stock runs out.
export const ECONOMY_RULES = { workingCapital: 20000, mealUnits: 3, initialMealsPerCitizen: 96, farmBatch: 12, farmLabor: 120 };
export const MEAL_RECIPES = {
  pao: { label: 'Pão simples', inputs: { pao: 3 }, quality: 1 },
  refogado: { label: 'Refeição de feijão e cebola', inputs: { feijao: 2, cebola: 1 }, quality: 2 },
  prato_completo: { label: 'Prato completo', inputs: { feijao: 1, milho: 1, mandioca: 1 }, quality: 3 },
  refeicao_especial: { label: 'Refeição especial', inputs: { pao: 1, feijao: 1, maca: 1, coentro: 1 }, quality: 4 },
};
const mealRecipeCache=new WeakMap();
function mealOptions(recipes){
  let options=mealRecipeCache.get(recipes);if(options)return options;
  const definitions={...Object.fromEntries([...edible,'pao'].map(g=>[`single_${g}`,{inputs:{[g]:MEAL_COMPONENTS[g]?1:ECONOMY_RULES.mealUnits},quality:1}])),...recipes,refeicao_laticinios:{inputs:{pao:1,queijo:1,leite:1},quality:3},macarronada:{inputs:{massa:2,cebola:1,oleo:1},quality:4},salada_conserva:{inputs:{conserva:1,ovos:1,coentro:1},quality:3}};
  options=Object.entries(definitions).map(([good,details])=>({good,...details,entries:Object.entries(details.inputs)}));mealRecipeCache.set(recipes,options);return options;
}

export class CityEconomy {
  constructor(city) {
    this.city = city; this.goods = Object.fromEntries(Object.entries(GOODS).map(([id, spec]) => [id, { label: spec.label, get price() { return city.currency.price(spec.price*(city.economy?.market?.[id]?.multiplier||1)); } }])); this.crops = CROPS; this.recipes = MEAL_RECIPES;
    this.market={};this.supplyAgreements=[];this.lastBootstrapDay=null;
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
    this.serviceInvestment = new CityServiceInvestment(city);
  }
  citizen(id) { return this.city.society.citizen(id); }
  initializeCitizen(c, index, options) {
    c.skills = Object.fromEntries(Object.keys(SKILLS).map(skill => [skill, options.age === 0 ? 0 : 2 + this.city.random() * 16]));
    if (options.age !== 0) c.skills[Object.keys(SKILLS)[index % Object.keys(SKILLS).length]] += 15;
    c.foodPreferences = Object.freeze(Object.fromEntries([...edible, ...Object.keys(CROPS), 'pao', 'oleo', ...Object.keys(MEAL_RECIPES)].map(g => [g, (((Math.imul(c.id + 17, 2654435761) ^ Math.imul(g.split('').reduce((n, ch) => n * 31 + ch.charCodeAt(0), 0), 1597334677)) >>> 0) % 201 - 100) / 100])));
    initializeClothes(this.city,c);
    c.businessIds = []; c.provisions = options.grant === false ? 0 : 3;
    c.rentalPreference = .65 + this.city.random() * .3;
    c.lastPaidAt = this.city.minute; c.mealAllowanceToday = 0; c.foodVoucher = null; c.workMeal = null;
  }
  practice(c, skill, minutes = 1) {
    if (!c || !(skill in SKILLS) || minutes <= 0 || !Number.isFinite(minutes)) return;
    c.skills[skill] = Math.min(100, c.skills[skill] + minutes * .025 * (.8 + (c.traits?.diligence ?? .5) * .4) / (1 + c.skills[skill] / 25));
  }
  setupBuilding(b) {
    const startingFood = Math.max(this.city.initialPopulation, this.city.citizens.length) * ECONOMY_RULES.mealUnits * ECONOMY_RULES.initialMealsPerCitizen;
    initializeInventory(b, GOODS, b.type === 'townhall' ? Math.max(6000, startingFood + 256) : Math.max(160, b.width * b.depth * b.floors * (b.type === 'quarry' ? 40 : 16)));
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
    Object.defineProperty(b, 'wage', { get: () => this.city.currency.price(Math.max(b.baseWage,this.city.politics?.policy?.minimumWage||0)), set: value => { b.baseWage = value / this.city.currency.priceIndex; }, configurable: true });
  }
  get businesses() { return this.city.buildings.filter(b => PRIVATE_TYPES.has(b.type) && b.active && !b.entity.destroyed); }
  initialize() {
    this.appointMayor();
    const hall = this.city.buildings.find(b => b.type === 'townhall');
    hall.inventory.pao = this.city.citizens.length * ECONOMY_RULES.mealUnits * ECONOMY_RULES.initialMealsPerCitizen;
    this.initialStock.pao += hall.inventory.pao;
    // Public starter firms keep construction and extraction available without privileged founders.
    for (const [type, budget] of [['builder', 2000000], ['quarry', 500000], ['bank', 2000000]]) {
      const b = this.city.buildings.find(b => b.type === type);
      if (b) this.activateMunicipalBusiness(b, budget);
    }
    this.city.development.ensurePlots();
    this.hire();
    this.updateDemand();
  }
  appointMayor() { return this.city.politics.ensureMayor(); }
  leaveJob(c, reason = 'Troca de ocupação') {
    const employer = this.city.building(c.jobId);
    if (employer) this.city.history.employment(c,employer,'desligamento',reason);
    if (employer) employer.workers = employer.workers.filter(id => id !== c.id);
    c.jobId = null; c.task = null; c.path = [];
  }
  municipalPolicy() {
    for (const u of this.city.units.values()) if (u.ownerId === 'treasury' && !['residential', 'popular_housing', 'luxury_housing'].includes(this.city.building(u.buildingId)?.type)) {
      const occupant = this.city.accounts.get(u.tenantId);
      if (occupant?.homeUnitId === u.id) this.city.releaseHome(occupant);
      u.tenantId = null; u.forSale = !this.city.building(u.buildingId)?.municipal; u.forRent = false; u.arrears = 0; u.missedDays = 0;
    }
  }
  investInHousing(initial = false) { this.city.housing.invest(initial); }
  assignHomes() { this.city.housing.assign(); }
  hiringScore(c, b) {
    const skill = c.skills[JOB_SKILL[b.type]] || 0, owner = this.city.relationships.businessPerson(b);
    const relation = owner ? this.city.relationships.view(owner, c) : null;
    return skill * .75 + (this.city.reputation.score(c, 'reliability') - 50) * .15 + ((c.traits?.diligence ?? .5) - .5) * 8 + (relation ? relation.trust * .15 + relation.affection * .1 : 0);
  }
  quarryStatus(b){
    if(this.city.world.map){const revision=this.city.world.revision||0;if(b.depositRevision!==revision||!b.deposits){b.deposits=quarryDeposits(this.city.world,b.entity.x,b.entity.y,b.width,b.depth);b.depositRevision=revision;}}
    const rock=this.city.world.map?(b.deposits||[]).reduce((n,p)=>n+(this.city.world.quarryReserves?.get(`${p.x},${p.y}`)??250),0):(b.stoneReserve??12000);
    const remaining=Math.max(0,Math.min(b.stoneReserve??12000,rock)),staff=b.workers.length+(this.citizen(b.ownerId)?1:0);
    return {remaining,staff,daily:Math.min(remaining,staff*80),potential:Math.min(remaining,Math.max(staff,b.jobs||0)*80)};
  }
  staffEssentials() {
    const city=this.city,needs=city.welfare.conditions(),projects=city.development.projects.filter(p=>!p.cancelled&&p.status!=='completed'),stone=projects.reduce((n,p)=>n+Math.max(0,p.stone-p.inventory.pedra-(p.incoming.pedra||0)),0),freight=city.logistics.demandMetrics(),firms=this.businesses;
    for(const b of firms){
      if(b.type==='builder'){const sites=projects.filter(p=>p.builderId===b.id),labor=sites.reduce((n,p)=>n+Math.max(0,p.requiredLabor-p.labor),0);b.jobs=Math.min(48,Math.max(3,sites.length*2+Math.ceil(labor/180)));}
      if(b.type==='quarry'){const usable=firms.filter(f=>f.type==='quarry'&&this.quarryStatus(f).remaining>0).length;b.jobs=this.quarryStatus(b).remaining>0?Math.min(32,Math.max(2,Math.ceil(stone/60/Math.max(1,usable)))):0;}
      if(b.type==='carrier')b.jobs=Math.min(32,Math.max(2,Math.ceil(freight.work/120/Math.max(1,firms.filter(f=>f.type==='carrier').length))));
    }
  }
  reconcileStaff() {
    const city=this.city,assigned=new Map();
    for(const c of city.citizens)if(!c.entity.destroyed&&c.jobId){let staff=assigned.get(c.jobId);if(!staff)assigned.set(c.jobId,staff=[]);staff.push(c.id);}
    for(const b of city.buildings){
      const seen=new Set();
      b.workers=b.workers.filter(id=>{const c=this.citizen(id);if(!c||c.jobId!==b.id||seen.has(id))return false;seen.add(id);return true;});
      for(const id of assigned.get(b.id)||[])if(!seen.has(id)){b.workers.push(id);seen.add(id);}
      b.jobs=Math.max(b.type==='townhall'&&seen.has(this.mayorId)?1:0,Number.isFinite(b.jobs)?Math.max(0,Math.floor(b.jobs)):0);
      const excess=b.workers.length-b.jobs;if(excess<=0)continue;
      const candidates=b.workers.map(id=>this.citizen(id)).filter(c=>c&&c.id!==this.mayorId).sort((a,c)=>Number(!!(a.deliveryId||a.cleaningJobId))-Number(!!(c.deliveryId||c.cleaningJobId))||this.hiringScore(a,b)-this.hiringScore(c,b)||a.id-c.id);
      for(const c of candidates.slice(0,excess)){
        if(c.deliveryId){const shipment=city.logistics.shipments.find(s=>s.id===c.deliveryId);if(shipment){if(shipment.pickedUp)shipment.position={x:c.entity.x,y:c.entity.y};city.logistics.releaseDriver(shipment);shipment.status='waiting';}else c.deliveryId=null;}
        if(c.cleaningJobId)city.sanitation.releaseCitizen(c);
        this.leaveJob(c,'Adequação da equipe ao número de postos de trabalho');c.action='Procurando trabalho';
      }
    }
    city._statsCache=null;
  }
  hire() {
    this.appointMayor();
    this.staffEssentials();
    for (const c of this.city.citizens) if (c.jobId && c.id!==this.mayorId) {
      const b = this.city.building(c.jobId);
      if (!b || !b.active || (b.balance < b.wage && this.city.minute - c.lastPaidAt > 1440)) this.leaveJob(c);
      else if (!c.deliveryId && !c.cleaningJobId && !this.city.relationships.willingToWork(c,b)) this.leaveJob(c,'Conflito pessoal com o gestor');
    }
    this.reconcileStaff();
    const offers = this.city.buildings.filter(b => b.active && b.jobs > 0 && !b.entity.destroyed);
    const available = () => this.city.citizens.filter(c => this.city.society.isAdult(c) && !c.entity.destroyed && !c.jobId && !c.businessIds.length && !this.city.development.projects.some(p=>p.id===c.startupProjectId && !p.cancelled && p.status!=='completed') && c.id !== this.mayorId);
    const priority = ['mint', 'bakery', 'market', 'greengrocer', 'farm', 'mill', 'quarry', 'carrier', 'cleaner', 'waste_collector', 'recycler', 'paid_toilet', 'builder', 'mint', 'townhall'];
    const underserved = offers.filter(b => !b.workers.length).length;
    // Give each operating firm its first employee before filling additional posts elsewhere.
    for (let shortage = underserved - available().length; shortage > 0; shortage--) {
      const donor = offers.filter(b => b.workers.length > 1 && b.workers.some(id => { const c = this.citizen(id); return c && c.id!==this.mayorId && !c.deliveryId && !c.cleaningJobId; })).sort((a, b) => b.workers.length - a.workers.length)[0];
      if (!donor) break;
      const worker = donor.workers.map(id => this.citizen(id)).filter(c => c && c.id!==this.mayorId && !c.deliveryId && !c.cleaningJobId).sort((a, b) => this.hiringScore(a, donor) - this.hiringScore(b, donor))[0];
      this.leaveJob(worker);
    }
    offers.sort((a, b) => Number(a.workers.length > 0) - Number(b.workers.length > 0) || (priority.indexOf(a.type) < 0 ? 99 : priority.indexOf(a.type)) - (priority.indexOf(b.type) < 0 ? 99 : priority.indexOf(b.type)));
    const recruit = (b, count) => {
      const slots=Math.max(0,Math.min(Math.floor(count),b.jobs-b.workers.length));
      if(!Number.isFinite(slots)||slots<=0)return;
      const candidates = available().filter(c=>this.city.relationships.willingToWork(c,b)).sort((a, c) => this.hiringScore(c, b) - this.hiringScore(a, b) || a.id - c.id);
      for (const c of candidates.slice(0, slots)) {
        c.jobId = b.id; c.profession = JOB_SKILL[b.type]; b.workers.push(c.id); this.city.history.employment(c,b,'contratação');
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
    const revision=`${this.city.world.topologyRevision??this.city.world.revision??0}:${this.city.obstacleRevision||0}:${this.city.occupied.size}`;
    if(this.routeRevision!==revision){this.routeCache.clear();this.routeRevision=revision;}
    const endpoints = [`${a.id}@${Math.floor(a.door.x)},${Math.floor(a.door.y)}`, `${b.id}@${Math.floor(b.door.x)},${Math.floor(b.door.y)}`].sort();
    const key = endpoints.join(':');
    if (!this.routeCache.has(key)) {
      if (this.routeCache.size >= 8192) this.routeCache.delete(this.routeCache.keys().next().value);
      const connected=settlementConnected(this.city,a.door,b.door);
      this.routeCache.set(key,connected??(this.city.findPath(a.door,b.door,{copy:false})!==null));
    }
    return this.routeCache.get(key);
  }
  updateDemand() {
    const population = this.city.citizens.filter(c => !c.entity.destroyed).length;
    const businesses = this.businesses;
    const farms = businesses.filter(b => b.type === 'farm');
    const buyers = businesses.filter(b => retailTypes.has(b.type));
    for (const b of businesses) b.inputDemand = b.type==='kitchen'?Object.fromEntries([...new Set(KITCHEN_RECIPES.flatMap(r=>Object.keys(r.inputs)))].map(g=>[g,Math.max(0,18-(b.inventory[g]||0)-(b.incoming[g]||0))])):b.type==='mill'?{girassol:Math.max(0,36-b.inventory.girassol-(b.incoming.girassol||0))}:INDUSTRIES[b.type] ? Object.fromEntries(Object.entries(INDUSTRIES[b.type].inputs).map(([g,n])=>[g,Math.max(0,(b.type==='publisher'&&g==='papel'?Math.max(12,(b.bookPages||5)*3):n*6)-b.inventory[g]-(b.incoming[g]||0))])) : b.type === 'bakery' ? { trigo: Math.max(0, 24 - b.inventory.trigo) } : !retailTypes.has(b.type) ? {} : Object.fromEntries(edible.filter(g => this.accepts(b, g)).map(g => [g, Math.max(0, 12 - b.inventory[g])]));
    const oil=this.lightingSupplyReport=oilSupply(this),oilGap=Math.max(0,oil.oilRequired-oil.millPotential-oil.millPlanned);
    const items=[{type:'mill',crop:null,score:oilGap?Math.min(300,200+oilGap*2):0,required:oil.oilRequired,supply:oil.millDaily,stock:oil.oilStock,reason:`Postes precisam de ${oil.daily} óleos/dia; ${oil.empty} vazios. ${oil.bottleneck}`}];
    const facilities = [...this.city.sanitation.facilities.values()], waste = this.city.buildings.reduce((n, b) => n + (b.inventory.lixo || 0) + (b.litter || 0), 0);
    for (const [type, needed, reason] of [ ['paid_toilet', facilities.length >= 3, 'Demanda por banheiros limpos e acessíveis']]) items.push({ type, crop: null, score: !needed ? 0 : !businesses.some(b=>b.type===type)?95:Math.max(0,(type==='cleaner'?facilities.filter(f=>f.cleanliness<65).length:type==='paid_toilet'?facilities.length:waste/4)*18-businesses.filter(b=>b.type===type).reduce((n,b)=>n+Math.max(1,b.workers.length)*40,0)), reason });
    const transport = this.city.logistics.demandMetrics();
    items.push({ type:'carrier',crop:null,score:transport.score,required:transport.work,supply:transport.capacity,stock:0,reason:`${transport.waiting} cargas aguardando; ${transport.ownHauls} transportes próprios; ${transport.drivers} transportadores; espera máxima ${Math.round(transport.oldest)} min; ${transport.lampRequests} lamparinas pendentes` });
    const extraction=this.serviceInvestment.demand('quarry');items.push({type:'quarry',crop:null,...extraction,required:extraction.work,supply:extraction.capacity,reason:`Obras: ${extraction.work} pedras pendentes; ${extraction.remaining} em depósitos ainda disponíveis; ${extraction.staff} trabalhadores na extração.`});
    for (const type of ['cleaner','builder','waste_collector','recycler','composting']) {
      const service = this.serviceInvestment.demand(type);
      items.push({type,crop:null,score:service.score,required:service.work,supply:service.capacity,stock:0,reason:`${service.count} ${type==='cleaner'?'banheiros sujos':type==='builder'?'obras pendentes':'unidades de lixo para atender'}; ${service.staff} profissionais; ${service.work} minutos de trabalho pendente`});
    }
    for (const type of ['market', 'greengrocer', 'bakery']) {
      const count = businesses.filter(b => b.type === type).length;
      const target = Math.max(1, Math.ceil(population / (type === 'market' ? 32 : 36)));
      const shortage = Math.max(0, target - count);
      items.push({ type, crop: null, score: shortage ? ({ market: 90, greengrocer: 85, bakery: 80 })[type] + shortage * 10 : 0, reason: count ? 'População e capacidade de atendimento' : 'Este tipo de comércio ainda não existe' });
    }
    const stapleCrops=Object.keys(CROPS).filter(g=>!['trigo','girassol'].includes(g));
    const foodWeights=Object.fromEntries(stapleCrops.map(g=>[g,this.city.citizens.filter(c=>!c.entity.destroyed).reduce((n,c)=>n+.35+Math.max(0,c.foodPreferences?.[g]||0),0)]));
    const totalFoodWeight=Object.values(foodWeights).reduce((n,v)=>n+v,0)||1;
    for (const [crop, spec] of Object.entries(CROPS)) {
      const producers = farms.filter(b => b.crop === crop);
      const stock = businesses.reduce((sum, b) => sum + b.inventory[crop], 0);
      const bakeries = crop === 'trigo' ? businesses.filter(b => b.type === 'bakery').length : 0;
      const processingNeed=businesses.filter(b=>INDUSTRIES[b.type]).reduce((n,b)=>n+(b.inputDemand?.[crop]||0),0);
      const grainConsumers=businesses.filter(b=>b.type==='bakery'||INDUSTRIES[b.type]?.inputs.trigo).length;
      const downstream = crop === 'trigo' ? grainConsumers : buyers.filter(b => this.accepts(b, crop)).length;
      const dailyNeed = crop === 'trigo' ? Math.ceil(Math.max(population*(bakeries?2:.5),processingNeed)) : crop==='girassol'?Math.max(oil.sunflowerRequired,processingNeed):Math.ceil(population*6*(foodWeights[crop]||0)/totalFoodWeight)+processingNeed;
      const capacity = producers.reduce((n,b)=>n+this.farmCapacity(b,true).daily,0);
      // A shop's refill target is not population consumption: treating every
      // empty shelf as new demand made one small town open farms for every crop.
      // Count active fields and projects against the crop's per-capita need.
      const pendingCropCapacity = this.city.development.projects
        .filter(p => p.type === 'farm' && p.crop === crop && !p.cancelled && p.status !== 'completed')
        .reduce((n,p) => {
          const area=Math.max(1,(p.width||10)*(p.depth||10)-2),staff=Math.ceil(area/36)+(p.accountId==='treasury'?0:1);
          const labor=Math.ceil(area*ECONOMY_RULES.farmLabor/12);
          const cycle=Math.max(CROPS[crop].grow,labor/staff);
          return n+Math.floor(area*540/(cycle+CROPS[crop].grow));
        },0);
      const effectiveSupply = capacity + pendingCropCapacity;
      const coverage=dailyNeed>0?(effectiveSupply+stock)/dailyNeed:1;
      const score = crop==='girassol'&&dailyNeed>effectiveSupply+stock?Math.min(310,210+(dailyNeed-effectiveSupply-stock)*.5):dailyNeed === 0 ? 0 : effectiveSupply >= dailyNeed ? 0
        : crop === 'trigo' && grainConsumers > 0 && !producers.length && !pendingCropCapacity ? 120
        : coverage<.9 ? Math.min(125,100+Math.max(0,1-coverage)*20) : 0;
      items.push({ type: 'farm', crop, score, required: dailyNeed, supply: capacity, stock, reason: crop === 'trigo' && downstream ? 'Padarias precisam de trigo' : downstream ? `Lojas precisam de ${spec.label.toLowerCase()}` : 'Diversidade da alimentação local' });
    }
    for (const [type,spec] of Object.entries(INDUSTRIES)) {
      if(type==='composting')continue;
      if(type==='research_institute'){const demand=this.city.politics.getResearch().demand();items.push({type,crop:null,...demand,stock:0,reason:spec.impact});continue;}
      const firms=businesses.filter(b=>b.type===type);
      const needed=(type==='clothing_store'?population*.15:0)+Object.keys(spec.outputs).reduce((n,g)=>n+(this.city.politics.campaigns.getMaterials().demand(g)||0)+businesses.reduce((sum,b)=>sum+(b.inputDemand?.[g]||0),0)+(spec.use?(type==='publisher'?this.city.citizens.filter(c=>!c.entity.destroyed&&this.city.society.isAdult(c)&&!this.city.publications.owned(c.accountId).some(d=>d.good===g&&d.entries.length<this.city.publications.capacity(d))).length:population)*.3:INDUSTRIAL_FOODS.includes(g)?population*.7+this.city.citizens.filter(c=>!c.entity.destroyed).reduce((n,c)=>n+Math.max(0,c.foodPreferences?.[g]||0),0)*.8:0),0);
      const stock=Object.keys(spec.outputs).reduce((n,g)=>n+businesses.reduce((v,b)=>v+(b.inventory[g]||0),0),0);
      const supply=firms.reduce((n,b)=>n+Math.max(1,b.workers.length)*240/spec.labor*Object.values(spec.outputs).reduce((a,v)=>a+v,0),0);
      const inputAvailability=Object.entries(spec.inputs).length?Object.entries(spec.inputs).reduce((n,[g,q])=>n+Math.min(2,businesses.reduce((v,b)=>v+(b.inventory[g]||0),0)/Math.max(1,q*6)),0)/Object.keys(spec.inputs).length:1;
      const chainBonus=!firms.length&&(needed>0||Object.keys(spec.inputs).length&&inputAvailability>.8)?Math.min(70,needed*.3+inputAvailability*25):0;
      const score=type==='clothing_store'?(firms.length>=Math.max(1,Math.ceil(population/300))?0:55):type==='bank' ? firms.length?0:65 : Math.min(160,Math.max(0,needed-stock-supply*.5)+(firms.length?0:25)+chainBonus);
      items.push({type,crop:null,score,required:Math.ceil(needed),supply:Math.floor(supply),stock,reason:spec.impact});
    }
    for(const item of items) if(ESSENTIAL_SERVICES.has(item.type)) item.response=this.serviceInvestment.decisions.get(item.type);
    this.demands = items.sort((a, b) => b.score - a.score);
    productionPlan(this);
    return this.demands;
  }
  accepts(b, good) {
    if(b.type==='kitchen')return KITCHEN_RECIPES.some(r=>good in r.inputs);
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

  setupFarm(b) {
    const area = Math.max(1,b.width*b.depth-2);
    b.fields = Array.from({length:Math.ceil(area/12)},(_,i) => {
      const cells = Math.min(12,area-i*12);
      return {area:cells,yield:cells,requiredLabor:Math.ceil(ECONOMY_RULES.farmLabor*cells/12),labor:0,plantedAt:null};
    });
    b.jobs = Math.max(1,Math.ceil(area/36));
  }
  farmCapacity(b,planned=false) {
    const area=b.fields.reduce((n,f)=>n+(f.area||12),0);
    const staff=(planned?Math.max(b.jobs,b.workers.length):b.workers.length)+(this.citizen(b.ownerId)?1:0);
    const labor=b.fields.reduce((n,f)=>n+(f.requiredLabor||ECONOMY_RULES.farmLabor),0);
    const cycle=Math.max(CROPS[b.crop]?.grow||120,labor/Math.max(1,staff));
    const harvest=b.fields.reduce((n,f)=>n+(f.yield||12),0);
    // Labor is measured in worker-minutes. Divide it by the real crew size,
    // then include crop growth and a conservative 9-hour productive day.
    const cycleMinutes=cycle+(CROPS[b.crop]?.grow||120);
    const daily=staff?Math.floor(harvest*540/cycleMinutes):0;
    return {area,fields:b.fields.length,staff,jobs:b.jobs,harvest,daily};
  }
  activateMunicipalBusiness(b, budget = 50000, crop = null) {
    b.municipal = true; b.ownerId = null; b.active = true; b.crop = crop; b.foundedAt = this.city.minute;
    if(b.type==='farm') this.setupFarm(b); else b.fields=[];
    if (b.type === 'quarry') b.stoneReserve ??= 12000;
    for (const u of b.units) { u.forSale = false; u.forRent = false; u.occupantId = b.accountId; }
    this.city.transfer('treasury', b.accountId, Math.min(budget, this.city.treasury), 'Capital de empresa municipal');
    this.buySeeds(b);return b;
  }
  activateBusiness(b, founder, crop = null, capitalize = true) {
    if (!founder) return null;
    founder.startupProjectId=null;
    b.ownerId = founder.id; b.crop = crop; b.active = true; b.foundedAt = this.city.minute;
    if(b.type==='farm') this.setupFarm(b); else b.fields=[];
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
  purchasePremises(b, founder, crop, authorization = null) {
    if(b?.municipal && !authorization?.billId)return null;
    if (!b || (b.active && !b.municipal) || b.entity.destroyed || !founder || !this.city.society.isAdult(founder) || this.city.politics.officeHolder(founder) || !PRIVATE_TYPES.has(b.type) || !b.units.every(u => u.ownerId === 'treasury' && u.forSale)) return null;
    const price = this.premisesPrice(b);
    if (founder.balance < price + this.city.currency.price(ECONOMY_RULES.workingCapital) || !this.city.transfer(founder.accountId, 'treasury', price, 'Compra de instalações para empresa')) return null;
    for (const u of b.units) u.ownerId = founder.accountId;
    const plot = this.city.development.plots.find(p => p.id === b.plotId); if (plot) { plot.ownerId = founder.accountId; plot.forSale = false; }
    this.city.history.ownership(b,'treasury',founder.accountId,{action:'purchase',amount:price});
    b.municipal = false; this.activateBusiness(b, founder, crop); return b;
  }
  foundBusiness(founderId, type, crop = null) {
    const city = this.city, founder = this.citizen(founderId);
    if (!founder || !city.society.isAdult(founder) || !PRIVATE_TYPES.has(type) || this.city.politics.officeHolder(founder) || (type === 'farm' && !CROPS[crop])) return null;
    if (city.development.projects.some(p => p.ownerId === founder.id && p.type === type && p.crop === crop && !p.cancelled && p.status !== 'completed')) return null;
    const existing = city.buildings.find(b => b.type === type && (!b.active || b.municipal) && !b.entity.destroyed && b.units.every(u => u.ownerId === 'treasury' && u.forSale));
    if (existing) return this.purchasePremises(existing, founder, crop);
    city.development.ensurePlots();
    const fertile = p => type === 'farm' ? city.development.isFarmPlot(p) : p.width <= 8 && p.depth <= 8 && (['quarry', 'iron_mine'].includes(type) ? (!city.world.map || p.type === 'quarry') : !['quarry', 'farm'].includes(p.type));
    let boughtLot=false;
    let lot = city.development.plots.find(p => p.ownerId === founder.accountId && !p.buildingId && !p.projectId && fertile(p));
    if (!lot) {
      const available = city.development.plots.find(p => p.ownerId === 'treasury' && p.forSale && !p.buildingId && !p.projectId && fertile(p));
      if (!available || founder.balance < available.price + this.quote(type) + this.city.currency.price(15000)) return null;
      lot = city.development.buyPlot(founder.accountId, available.id);boughtLot=!!lot;
    }
    if (!lot) return null;
    const project = city.development.beginProject(founder.accountId, lot.id, type, { crop,width:type==='farm'?lot.width:Math.min(3,lot.width),depth:type==='farm'?lot.depth:Math.min(3,lot.depth),floors:1 });
    if(!project&&boughtLot&&!lot.projectId&&city.transfer('treasury',founder.accountId,lot.price,'Estorno de terreno: empresa não iniciada')){lot.ownerId='treasury';lot.forSale=true;}
    if(project&&project.status!=='completed')founder.startupProjectId=project.id;
    this.hire(); this.updateDemand(); return project;
  }
  invest() {
    this.updateDemand();
    // Construction and transport must be staffed before the first factories can receive their materials.
    this.city.bank.developmentBanks();
    const extractionStarted=this.serviceInvestment.invest({types:['quarry']});
    const firstServices=this.serviceInvestment.invest({initialOnly:true})||extractionStarted;
    // Initial chains have their own funded rollout before expanding established sectors.
    if(investProductionPlan(this)||firstServices)return true;
    if(investOilChain(this))return true;
    if(bootstrapEnterprise(this))return true;
    const essentialStarted=this.serviceInvestment.invest();
    this.updateDemand();
    const investors = this.city.citizens.filter(c => this.city.society.isAdult(c) && !this.city.politics.officeHolder(c) && c.businessIds.length < 10).sort((a, b) => b.balance * (.8 + (b.traits?.riskTolerance ?? .5) * .4) - a.balance * (.8 + (a.traits?.riskTolerance ?? .5) * .4) || a.id - b.id);
    const opportunities = this.demands.filter(d => d.score >= 30).map(d => ({ ...d, priority: d.score * (.9 + this.city.random() * .2) })).sort((a, b) => b.priority - a.priority);
    for (const opportunity of opportunities) {
      if(ESSENTIAL_SERVICES.has(opportunity.type))continue;
      const same = [...this.businesses, ...this.city.development.projects.filter(p => p.status !== 'completed' && !p.cancelled)].filter(b => b.type === opportunity.type && (opportunity.type !== 'farm' || b.crop === opportunity.crop));
      if (same.some(b => b.status) || (same.length && opportunity.score < 60)) continue;
      const starter=investors.find(c=>!c.jobId&&!c.businessIds.length&&!c.startupProjectId);
      const rawLot=this.city.development.plots.find(p=>p.ownerId==='treasury'&&p.forSale&&!p.buildingId&&!p.projectId&&(opportunity.type==='farm'?this.city.development.isFarmPlot(p):p.width<=8&&p.depth<=8&&(['quarry','iron_mine'].includes(opportunity.type)?p.type==='quarry':!['farm','quarry'].includes(p.type))));
      if(starter&&rawLot&&opportunity.score>=60){const budget=rawLot.price+this.quote(opportunity.type)+this.city.currency.price(39000);let loan=null;for(const bank of this.city.bank.available()){const need=Math.max(0,budget-starter.balance);if(need)loan=this.city.bank.lendForBusiness(bank,starter,need,{type:opportunity.type,score:opportunity.score,budget});if(loan||!need)break;}if(starter.balance>=budget){const project=this.foundBusiness(starter.id,opportunity.type,opportunity.crop);if(project){if(loan)loan.projectId=project.id;return true;}}if(loan)this.city.bank.cancelBusinessLoan(loan);}
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
    const needs=this.city.welfare.conditions();
    const stapleFarms=this.businesses.filter(b=>b.type==='farm'&&!['girassol','trigo'].includes(b.crop));
    const pendingStaples=this.city.development.projects.filter(p=>p.type==='farm'&&!['girassol','trigo'].includes(p.crop)&&!p.cancelled&&p.status!=='completed');
    const stapleCapacity=stapleFarms.reduce((n,b)=>n+this.farmCapacity(b).daily,0)+pendingStaples.reduce((n,p)=>n+Math.max(0,(p.width||10)*(p.depth||10)-2)*240/Math.max(120,CROPS[p.crop]?.grow||120),0);
    const foodFarmMissing=stapleCapacity<needs.population*1.5;
    const foodPriority=o=>foodFarmMissing&&o.type==='farm'&&!['girassol','trigo'].includes(o.crop);
    const publicOpportunities = [...opportunities].sort((a, b) => Number(foodPriority(b))-Number(foodPriority(a)) || b.priority - a.priority);
    this.city.development.ensurePlots();
    for (const opportunity of publicOpportunities) {
      if(ESSENTIAL_SERVICES.has(opportunity.type))continue;
      if(needs.crisis && !foodPriority(opportunity) && !['farm','bakery','kitchen','market','greengrocer','mill'].includes(opportunity.type))continue;
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
    return essentialStarted;
  }
  buySeeds(b) {
    if (!['farm','forestry'].includes(b.type) || !b.active || b.seedStock >= 8) return;
    const qty = Math.min(24 - b.seedStock, Math.floor(b.balance / this.goods.sementes.price), inventoryFree(b), Math.max(0, 12 - b.seedStock));
    const cost = qty * this.goods.sementes.price;
    if (qty > 0 && this.city.transfer(b.accountId, 'supplier', cost, 'Compra de sementes')) { b.seedStock += qty; this.initialStock.sementes += qty; b.totalExpenses += cost; }
  }
  recordGoods(kind, good, quantity, from, to, details = {}) {
    this.goodsLedger.push({ minute: this.city.minute, kind, good, quantity, from, to });
    if (this.goodsLedger.length > 2000) this.goodsLedger.shift();
    const city=this.city,source=city.building(from),destination=city.building(to);
    const project=typeof to==='string' && to.startsWith('project:')?city.development.projects.find(p=>p.id===to):null;
    const previous=city.history.lastGoodsEvent.get(`${from}:${good}`);
    const inputEvents=kind==='production' && destination ? destination.lastInputEventIds||[] : [];
    const entry=city.history.record('production',`${GOODS[good]?.label||good}: ${quantity} unidades / ${kind}${source?' / '+source.entity.properties.name:''}${destination?' → '+destination.entity.properties.name:''}.`,[source?.accountId,destination?.accountId,project?.accountId],
      {action:kind,good,quantity,fromBuildingId:source?.id,toBuildingId:destination?.id,buildingIds:[source?.id,destination?.id].filter(id=>id!=null),projectId:project?.id,relatedEventIds:[previous,...inputEvents].filter(id=>id!=null),...details});
    if(from!=null)city.history.lastGoodsEvent.set(`${from}:${good}`,entry.id);
    if(to!=null)city.history.lastGoodsEvent.set(`${to}:${good}`,entry.id);
    if(kind==='recipe-input' && source){source.lastInputEventIds??=[];source.lastInputEventIds.push(entry.id);if(source.lastInputEventIds.length>8)source.lastInputEventIds.shift();}
    return entry;
  }
  transferGoods(seller, buyer, good, quantity, unitPrice) {
    if (!GOODS[good]) return false;
    return this.city.logistics.order(seller, buyer, good, quantity, unitPrice,good==='girassol'&&buyer.type==='mill'?{purpose:'lighting-input'}:{});
  }

  trade() {
    const businesses = this.businesses;
    for(const farm of businesses.filter(b=>b.type==='farm' && b.inventory.adubo+(b.incoming.adubo||0)<4)) {const seller=businesses.find(b=>b.type==='composting' && b.inventory.adubo>0);if(seller)this.transferGoods(seller,farm,'adubo',Math.min(4,seller.inventory.adubo),this.goods.adubo.price);}
    const buyers=businesses.filter(b=>retailTypes.has(b.type)||b.type==='mill'||INDUSTRIES[b.type]);
    const available={},batchDemand={};
    for(const b of businesses){const outputs=b.type==='farm'?[b.crop]:b.type==='mill'?['oleo']:b.type==='bakery'?['pao']:Object.keys(INDUSTRIES[b.type]?.outputs||{});for(const good of outputs)available[good]=(available[good]||0)+(b.inventory[good]||0);}
    for(const b of buyers)for(const [good,n]of Object.entries(INDUSTRIES[b.type]?.inputs||{}))batchDemand[good]=(batchDemand[good]||0)+Math.max(0,n*6-b.inventory[good]-(b.incoming[good]||0));
    // Rotate equal bids. A scarce upstream stock serves one batch per factory
    // before any factory can reserve six batches and starve the other chains.
    const offset=(this.tradeCursor||0)%Math.max(1,buyers.length);this.tradeCursor=offset+1;
    for (const buyer of [...buyers.slice(offset),...buyers.slice(0,offset)]) {
      for (const good of Object.keys(GOODS).filter(g => this.accepts(buyer, g))) {
        if(good==='lixo' && buyer.type==='composting')continue;
        const batch=INDUSTRIES[buyer.type]?.inputs[good];
        const scarce=batch&&(available[good]||0)<(batchDemand[good]||0);
        const target = scarce?batch:buyer.type==='publisher'&&good==='papel'?Math.max(12,(buyer.bookPages||5)*3):buyer.type==='kitchen'?18:batch ? batch*6 : buyer.type === 'bakery' ? 24 : 18;
        if (buyer.inventory[good] + (buyer.incoming[good] || 0) > target / 2) continue;
        let remaining = Math.max(0, target - buyer.inventory[good] - (buyer.incoming[good] || 0));
        const sellers = businesses.filter(b => b !== buyer && (b.type === 'farm' || b.type === 'bakery' || b.type === 'mill' || b.type==='kitchen'&&MEAL_COMPONENTS[good] || INDUSTRIES[b.type]?.outputs[good]) && b.inventory[good] > 0).sort((a, b) => Math.hypot(a.door.x - buyer.door.x, a.door.y - buyer.door.y) + this.city.reputation.providerPenalty(a) + this.city.relationships.businessPenalty(this.city.relationships.businessPerson(buyer),a) - Math.hypot(b.door.x - buyer.door.x, b.door.y - buyer.door.y) - this.city.reputation.providerPenalty(b) - this.city.relationships.businessPenalty(this.city.relationships.businessPerson(buyer),b));
        sellers.sort((a,b)=>Number(this.supplyAgreements.some(r=>r.sellerId===b.id&&r.buyerId===buyer.id&&r.good===good&&r.until>this.city.minute))-Number(this.supplyAgreements.some(r=>r.sellerId===a.id&&r.buyerId===buyer.id&&r.good===good&&r.until>this.city.minute)));
        for (const seller of sellers) {
          const reserve = buyer.workers.length * buyer.wage * 90;
          const quantity = Math.min(this.city.logistics.transportLimit(seller,buyer), inventoryFree(buyer), remaining, seller.inventory[good], Math.max(0, Math.floor((buyer.balance - reserve) / this.goods[good].price)));
          if (quantity > 0 && this.transferGoods(seller, buyer, good, quantity, this.supplyAgreements.find(r=>r.sellerId===seller.id&&r.buyerId===buyer.id&&r.good===good&&r.until>this.city.minute)?.unitPrice||this.goods[good].price)) remaining -= quantity;
        }
      }
    }
  }
  inventory(b) { if (!b) return 0; return edible.reduce((sum, good) => sum + b.inventory[good], 0) + b.inventory.pao; }
  mealTaste(c, offer) {
    if (!c || !offer) return 0;
    const preferences = c.foodPreferences || {};
    const ingredients = Object.keys(offer.ingredients || Object.assign({},...Object.keys(offer.inputs||{}).map(g=>MEAL_COMPONENTS[g]?.ingredients||{[g]:1})));
    return ((preferences[offer.good] || 0) + ingredients.reduce((sum, g) => sum + (preferences[g] || 0), 0)) / (ingredients.length + 1);
  }
  mealScore(c, b) {
    const offer = this.mealOffer(b, c);
    if (!offer || offer.price > (this.city.accounts.get(this.city.payerFor(c))?.balance || 0)) return Infinity;
    const choice=Math.min(1,Math.max(0,(c.needs.food-10)/30));
    return Math.hypot(b.door.x - c.entity.x, b.door.y - c.entity.y) - ((c.knownAdvertisements?.[b.id]||0)>this.city.minute?2:0) + choice*(offer.price / Math.max(1, this.city.currency.price(100)) * (.65 + (c.traits?.frugality ?? .5) * .7) - this.mealTaste(c, offer) * 45 + this.city.reputation.providerPenalty(b) + this.city.relationships.businessPenalty(c,b));
  }
  enjoyMeal(c, offer) {
    const taste = this.mealTaste(c, offer);
    c.lastMealTaste = taste;
    c.mood = Math.max(-25, Math.min(25, (c.mood || 0) + taste * 8));
  }
  mealOffer(b, citizen = null) {
    if (!b?.active || b.entity.destroyed || (!retailTypes.has(b.type) && b.type !== 'townhall' && b.type !== 'farm' && b.type !== 'popular_refectory' && INDUSTRIES[b.type]?.category !== 'food')) return null;
    const packed=preparedOffer(this,b,citizen,true);if(packed&&(!citizen||packed.price<=(this.city.accounts.get(this.city.payerFor(citizen))?.balance||0)))return packed;if(b.type==='kitchen')return null;
    const free=b.type==='townhall'||b.type==='popular_refectory',cash=citizen?(this.city.accounts.get(this.city.payerFor(citizen))?.balance||0):Infinity;
    let details=null,bestScore=-Infinity;
    for(const option of mealOptions(this.recipes)){
      if(!option.entries.every(([g,n])=>(b.inventory[g]||0)>=n))continue;
      if(citizen&&!free&&option.entries.reduce((sum,[g,n])=>sum+this.goods[g].price*n,0)>cash)continue;
      const score=option.quality+(citizen?this.mealTaste(citizen,option)*10:0);
      if(score>bestScore){bestScore=score;details=option;}
    }
    if(!details){const fallback=this.foodOffer(b);return fallback?{...fallback,inputs:{[fallback.good]:fallback.quantity},quality:1}:null;}
    const inputValue=details.entries.reduce((n,[g,q])=>n+(this.goods[g]?.price||0)*q,0);
    const quality = details.quality + (b.mealQuality || 0) - 1;
    return { good: details.good, quantity: 1, inputs: details.inputs, quality, price: free ? 0 : Math.round(inputValue) };
  }
  foodOffer(b) {
    const goods = b.type === 'bakery' ? ['pao'] : [...edible, 'pao'];
    const good = goods.filter(g => b.inventory[g] >= (MEAL_COMPONENTS[g]?1:ECONOMY_RULES.mealUnits)).sort((a, c) => b.inventory[c] - b.inventory[a])[0];
    return good ? { good, quantity: MEAL_COMPONENTS[good]?1:ECONOMY_RULES.mealUnits, price: b.type === 'townhall' || b.type === 'popular_refectory' ? 0 : Math.round(this.goods[good].price*1.2*(MEAL_COMPONENTS[good]?1:ECONOMY_RULES.mealUnits)) } : null;
  }
  consumeMeal(c, b) {
    const offer = this.mealOffer(b, c); if (!offer) { this.failedMeals++; if (b) b.stockouts++; return false; }
    if (!this.city.transfer(this.city.payerFor(c), b.accountId, offer.price, `Serviço: Alimentação (${GOODS[Object.keys(offer.inputs)[0]]?.label || offer.good})`)) return false;
    for (const [good, amount] of Object.entries(offer.inputs)) { b.inventory[good] -= amount; this.consumed[good] += amount; this.recordGoods('consumption', good, amount, b.id, c.id); }
    this.city.history.record('sale',`Refeição: ${c.entity.properties.name} em ${b.entity.properties.name}.`,[c.accountId,b.accountId],{amount:offer.price,ingredients:{...(offer.ingredients||offer.inputs)},consumedProducts:{...offer.inputs},quality:offer.quality});
    this.enjoyMeal(c, offer);
    c.lastMealQuality = offer.quality;
    // Every meal must satisfy hunger. Quality changes how satisfying the
    // meal is, but a simple bread meal still restores a meaningful amount.
    if (c.task !== 'caregiving') c.needs.food = Math.min(100, c.needs.food + 26 + offer.quality * 4);
    b.lastSaleAt = this.city.minute;
    return true;
  }
  farmWork(b, c) {
    this.buySeeds(b);
    // Harvest needs both elapsed growth time and accumulated human labor.
    for (const field of b.fields) {
      if (field.plantedAt === null) {
        const seeds=Math.ceil((field.area||12)/3);
        if (b.seedStock < seeds || b.inventory[b.crop] >= Math.max(36,b.fields.length*18)) continue;
        b.seedStock -= seeds; field.plantedAt = this.city.minute; field.labor = 0;
        if(b.inventory.adubo>0) {b.inventory.adubo--;this.consumed.adubo++;field.labor=Math.min(field.requiredLabor||ECONOMY_RULES.farmLabor,30);}
        this.consumed.sementes += seeds; this.recordGoods('sowing', 'sementes', seeds, b.id, null);
      }
      if (field.labor < (field.requiredLabor||ECONOMY_RULES.farmLabor)) {
        field.labor = Math.min(field.requiredLabor||ECONOMY_RULES.farmLabor, field.labor + 1 + c.skills.agriculture / 60 + (c.toolUntil>this.city.minute ? .3 : 0));
        this.harvest(b, field); return true;
      }
      if (this.harvest(b, field)) return true;
    }
    return false;
  }
  harvest(b, field) {
    if (inventoryFree(b) < (field.yield||ECONOMY_RULES.farmBatch) || field.plantedAt === null || field.labor < (field.requiredLabor||ECONOMY_RULES.farmLabor) || this.city.minute - field.plantedAt < CROPS[b.crop].grow) return false;
    const quantity=field.yield||ECONOMY_RULES.farmBatch;
    b.inventory[b.crop] += quantity; this.produced[b.crop] += quantity;
    this.recordGoods('harvest', b.crop, quantity, null, b.id);
    this.city.log(`${b.entity.properties.name} colheu ${quantity} unidades de ${CROPS[b.crop].label.toLowerCase()}.`, 'production', [b.ownerId], { kind: 'harvest', buildingId: b.id, crop: b.crop, quantity });
    field.plantedAt = null; field.labor = 0; return true;
  }
  industrialWork(b,c,spec) {
    if(b.type==='clothing_store')return b.inventory.roupas>0;
    if(b.type==='newsroom'){const pages=3+(b.id+this.city.day)%3;spec={...spec,inputs:{papel:pages},outputs:{jornais:1}};if((b.newsPrintedDay===this.city.day?b.newsCopies||0:0)>=Math.max(2,Math.ceil(this.city.citizens.length*.08)))return false;}
    if(b.type==='publisher'){
      const pamphlet=b.inventory.panfletos<Math.max(2,b.inventory.livros,this.city.politics.campaigns.getMaterials().demand('panfletos')),pages=pamphlet?1:b.bookPages||5;
      spec={...spec,inputs:{papel:pages},outputs:{[pamphlet?'panfletos':'livros']:1},labor:pamphlet?6:18+pages*2};
    }
    if(b.type==='flagmaker')spec=b.inventory.bandeiras<b.inventory.faixas*1.5?{...spec,inputs:{tecido:2,madeira:1},outputs:{bandeiras:2}}:{...spec,inputs:{tecido:2},outputs:{faixas:1}};
    if(b.type==='artisan')spec=b.inventory.carrinho<b.inventory.cesta/2?{...spec,inputs:{madeira:5,fibras:1},outputs:{carrinho:1}}:{...spec,inputs:{madeira:3,fibras:2},outputs:{cesta:2}};
    if(b.type==='forestry')return this.city.nature.forestryWork(b,c);
    if(['fiber_farm','herb_farm'].includes(b.type) && this.city.minute<(b.replantingAt||0)+180) return false;
    if(b.type==='research_institute')return this.city.politics.getResearch().studies.some(s=>s.instituteId===b.id&&['funding','collecting'].includes(s.status));
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
    for(const [g,n] of Object.entries(spec.inputs)){b.inventory[g]-=n;this.consumed[g]+=n;if(g==='lixo')b.wasteProcessed=(b.wasteProcessed||0)+n;this.recordGoods('recipe-input',g,n,b.id,null);}
    for(const [g,n] of Object.entries(spec.outputs)){b.inventory[g]+=n;this.produced[g]+=n;if(b.type==='composting')b.compostProduced=(b.compostProduced||0)+n;this.recordGoods('production',g,n,null,b.id);}
    if(b.type==='tailor')manufactureClothes(this.city,b,spec.outputs.roupas);
    if(b.type==='newsroom'){printNewspaper(this.city,b,spec.inputs.papel,c);if(b.newsPrintedDay!==this.city.day){b.newsPrintedDay=this.city.day;b.newsCopies=0;}b.newsCopies++;}
    if(b.type==='publisher')for(const [good,n] of Object.entries(spec.outputs))for(let i=0;i<n;i++)this.city.publications.stock(b,good,spec.inputs.papel);
    if(b.type==='composting')this.city.history.record('production','Compostagem: lixo transformado em adubo.',[b.accountId],{good:'adubo',quantity:2,waste:4});
    if(b.type==='iron_mine'){const p=b.activeOre,key=`${p.x},${p.y}`;this.city.world.ironReserves.set(key,(this.city.world.ironReserves.get(key)??120)-3);}
    if(['clay_pit','sand_pit'].includes(b.type)) b.extractionReserve-=Object.values(spec.outputs)[0];
    if(['forestry','fiber_farm','herb_farm'].includes(b.type)) b.replantingAt=this.city.minute;
    return true;
  }
  consumerOffer(c, b) {
    if(b?.active&&!b.entity.destroyed&&['tailor','clothing_store'].includes(b.type))return clothingOffer(this.city,c,b);
    if(b?.active&&!b.entity.destroyed&&b.type==='newsroom')return newspaperOffer(this.city,c,b);
    if(b?.type==='artisan'&&b.active&&!b.entity.destroyed){const good=['carrinho','cesta'].find(g=>b.inventory[g]>0&&c.balance>=this.goods[g].price&&carryCapacity(c)<(g==='carrinho'?72:36));return good?{good,spec:INDUSTRIES.artisan,price:this.goods[good].price}:null;}
    const spec=INDUSTRIES[b?.type];
    if(!b?.active || b.entity.destroyed || !spec?.use) return null;
    if(b.type==='publisher'){const owned=this.city.publications.owned(c.accountId);const good=['livros','panfletos'].find(g=>b.inventory[g]>0&&c.balance>=this.goods[g].price&&!owned.some(d=>d.good===g&&d.entries.length<this.city.publications.capacity(d)));return good?{good,spec,price:this.goods[good].price}:null;}
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
    b.inventory[good]--;const publication=['livros','panfletos','jornais'].includes(good);if(!publication&&good!=='roupas')this.consumed[good]++;this.recordGoods(publication||good==='roupas'?'durable-purchase':'household-consumption',good,1,b.id,c.id);
    if(good==='roupas'){buyClothes(this.city,c,b,offer.garmentIndex);return true;}
    if(good==='jornais'){const doc=this.city.publications.documents.get(offer.documentId);this.city.publications.move(doc,c.accountId);c.newspaperEditions??=[];c.newspaperEditions.push(doc.editionKey);c.newspaperEditions=c.newspaperEditions.slice(-32);this.city.publications.read(doc.id,c.id);return true;}
    if(good==='cesta'||good==='carrinho'){c.equipment??={};c.equipment[good]={boughtAt:this.city.minute,buildingId:b.id};return true;}
    c.needs[spec.use.need]=Math.min(100,c.needs[spec.use.need]+spec.use.boost);
    if(spec.use.need==='shelter'){c.homeComfort??={};c.homeComfort[good]=this.city.minute+7*1440;}
    if(good==='livros'||good==='panfletos'){this.city.publications.takeStock(b,c,good);this.practice(c,'management',60);}
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
    if(b.type==='kitchen')return kitchenWork(this,b,c);
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
  hourly(phase = null) {
    // A direct call still performs a complete hour (tools and initialization).
    if (phase === null) { for (let i = 0; i < 13; i++) this.hourly(i); return; }
    switch (phase) {
      case 0: this.city.currency.hourly(); this.city.welfare.hourly(); break;
      case 1: this.city.lighting.hourly(); break;
      case 2: this.city.politics.hourly(); this.municipalPolicy(); break;
      case 3: this.assignHomes(); break;
      case 4: this.hire(); break;
      case 5: this.city.development.updateHourly(); break;
      case 6: this.city.development.balanceContracts(); this.city.nature.hourly(); break;
      case 7: this.city.logistics.rebalanceWaiting(); break;
      case 8: this.trade(); break;
      case 9: updateClothes(this.city); this.householdPurchases(); this.city.publications.hourly(); break;
      case 10: this.city.sanitation.hourly(); this.city.workMeals.purchase(); break;
      case 11: this.updateDemand(); updateMarket(this);planSupplyChains(this);break;
      case 12: if (this.city.hour % 2 === 0) { this.investInHousing(); this.invest(); } break;
    }
  }
  daily() {
    this.city.bank.daily();
    for(const [key,value] of this.city.traffic) {if(value<2)this.city.traffic.delete(key);else this.city.traffic.set(key,value*.8);}
    this.municipalPolicy();
    for (const b of this.businesses) {
      const owner = this.citizen(b.ownerId);
      if (!owner) {
        if (b.municipal && b.balance > this.city.currency.price(['builder','bank'].includes(b.type) ? 2000000 : 500000)) this.city.transfer(b.accountId, 'treasury', Math.floor((b.balance - this.city.currency.price(['builder','bank'].includes(b.type) ? 2000000 : 500000)) * .5), 'Lucro de empresa municipal');
        continue;
      }
      if (b.balance < 5000 && owner.balance > 15000) this.city.transfer(owner.accountId, b.accountId, Math.min(10000, owner.balance - 10000), 'Aporte do proprietário');
      const profit = Math.max(0, b.totalRevenue - b.totalExpenses - b.dividends);
      const dividend = Math.min(Math.floor(profit * .35), Math.max(0, b.balance - 18000));
      if(dividend>0){const shares=(b.equityPartners||[{citizenId:owner.id,amount:1}]).filter(a=>this.citizen(a.citizenId)),total=shares.reduce((n,a)=>n+a.amount,0);for(const share of shares){const amount=Math.floor(dividend*share.amount/Math.max(1,total));if(amount&&this.city.transfer(b.accountId,`citizen:${share.citizenId}`,amount,'Distribuição de lucros por quota de capital'))b.dividends+=amount;}}
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
