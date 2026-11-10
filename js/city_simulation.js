import {WATERFRONT_BUSINESSES,waterfrontBerth} from './waterfront_businesses.js';
import {beginFastForwardMinute,deferFastForwardCitizen,routineRevision,nextRoutineReview,reducedCadence} from './city_fast_forward.js?v=ff2-speed-1';
import {CitySubstances} from './city_substances.js?v=economic-flow-7';
import {beginActivitySearch,endActivitySearch,invalidateActivitySearch} from './city_activity_search.js';
import {sleepState,wantsSleep,sleepMinute,interruptSleep} from './city_sleep.js';
import {injuredCarryCapacity} from './city_injury_effects.js';
import {CityFurniture} from './city_furniture.js?v=fast-speeds-1';
import {cultivateFarmTerrain} from './city_farm_ground.js';
import {CitySupplies,pocket,POCKET_RULES} from './city_supplies.js?v=economic-flow-7';
import {CityWater} from './city_water.js';
import {collectOfficeRents,endOfficeLease,OFFICE_ONLY_TYPES} from './city_offices.js?v=office-demand-rollout-1';
import {applySalesTax,MINIMUM_WAGE_TAX_RATE} from './city_sales_tax.js';
import {inheritShares,liquidateShareCash} from './city_equity.js?v=daily-mayor-privatization-2';
import {recordMarketTransaction} from './city_wealth.js';
import {streetMarketFor,discoverStreetMarket} from './city_markets.js?v=market-one-pass-1';
import {CityPaint} from './city_paint.js?v=interiors-completion-2';
import {CIVIC_SERVICES,civicSpec,civicStatus,civicVisit} from './city_public_services.js';
import {recordWork,discoverVacancies,searchEmployment,routeToInterview,advanceRecruitment,RECRUITMENT_RULES,occupiedPositions} from './city_employment.js?v=ff2-speed-1';
import {CityFiscal} from './city_fiscal.js';
import {CityVehicles} from './city_vehicles.js?v=harbor-boats-4';
import {clothingMood,moveGarments} from './city_clothing.js?v=party-apparel-1';
import {initializeBodyMetrics} from './city_body_metrics.js?v=body-morph-4';
import {bodyMovementSpeedFactor} from './city_body_metrics.js?v=body-morph-4';
import {ensureSkinColor} from './city_skin.js';
import {returnPartyCap} from './city_party_caps.js?v=party-apparel-1';
import {MIN_PLOT_CELLS,CITY_FLOOR_HEIGHT,buildingInteriorEntrance} from './city_building_geometry.js?v=visual-flow-4';
import { CityPublications } from './city_publications.js';
import { CityOfficialJournal } from './city_official_journal.js';
import { architectureFor, initializeCharacter, HOUSE_STYLES } from './city_culture.js?v=seeded-business-visual-v1';
import { CityRelationships } from './city_relationships.js?v=wardrobe-expansion-1';
import { CityNature } from './city_nature.js?v=ff-growth-events-1';
import {skybridgeLinks} from './city_skybridges.js?v=seeded-business-visual-v1';
import { CityGovernment as CityPolitics } from './city_government.js?v=party-number-random-1';
import { CityReputation } from './city_reputation.js';
import { CityHistory } from './city_history.js';
import { CityJustice } from './city_justice.js?v=artwork-no-flag-default-1';
import { syncCitizenInterior,advanceCitizenInterior,outdoorCellReady,disperseCrowds } from './city_interiors.js?v=ff-interiors-1';
import {interiorRoute} from './city_interior_layout.js?v=route-cache-512-index-1';
import {buildingLeisureSpaces} from './city_balconies.js?v=sertanejo-house-styles-1';
import { CityWelfare } from './city_welfare.js';
import { INDUSTRIES } from './city_industries.js';
import {collectEconomicTaxes,recordEconomicIncome,economicPolicy} from './city_economic_policies.js';
import { CityBank } from './city_bank.js?v=business-recovery-1';
import { quarryDeposits } from './city_terrain.js?v=entrance-retaining-clearance-1';
import { CityLighting } from './city_lighting.js';
import { TILE_WATER } from './world_gen.js?v=terrain-generation-reset-2-map-default-128';
import { CityCurrency, CURRENCY_RULES, ensureExternalAccount } from './city_currency.js';

import { CityHousing, HOUSING_RULES } from './city_housing.js?v=ff2-speed-2';
import { CitySanitation } from './city_sanitation.js?v=ff2-speed-2';
import { CityLife } from './city_life.js?v=position-validation-cache-1';
import { CityWorkMeals } from './city_work_meals.js?v=wardrobe-expansion-1';
import { CityDevelopment, DEVELOPMENT_RULES } from './city_development.js?v=ff2-speed-1';
import { CityLogistics } from './city_logistics.js?v=ff2-speed-1';
import { CityGigs } from './city_gigs.js?v=spaced-limited-spontaneous-art-1';
import { inventoryFree } from './city_inventory.js';
import { CityEconomy, PUBLIC_TYPES, JOB_SKILL, ECONOMY_RULES } from './city_economy.js?v=regional-supply-5';
import { CitySociety, EVENT_CATEGORIES } from './city_society.js?v=ff2-speed-1';
import { chooseBuildingSite, terrainWalkable, canStep, inspectBuildingSite, findTerrainPath, findSharedTerrainPath, layDirtPath, generateSettlement, hasSettlementAccess, settlementConnected, tileAt, roadTravelCost, ROAD_TILES, DIRT_ROAD_TILES, ROAD_RULES, wearRoad } from './city_terrain.js?v=entrance-retaining-clearance-1';
import {findBoatPath,BOAT_CLASSES} from './city_water_transport.js?v=regional-supply-4';
import {createSeaEdgeNavigation} from './sea_edge_navigation.js?v=sea-edge-routes-1';

const ff2ProductionWaits = new WeakMap();

const OUTDOOR_LEISURE_SEATS=new WeakMap();
function outdoorLeisureSeats(city){
  let index=OUTDOOR_LEISURE_SEATS.get(city);if(index?.minute===city.minute)return index.seats;
  const seats=new Map();
  for(const person of city.citizens)if(person.task==='outdoor_leisure'&&person.outdoorLeisure){
    const visit=person.outdoorLeisure,key=`${visit.buildingId}:${visit.spaceId}`;let bySlot=seats.get(key);if(!bySlot)seats.set(key,bySlot=new Map());let occupants=bySlot.get(visit.slot);if(!occupants)bySlot.set(visit.slot,occupants=new Set());occupants.add(person);
  }
  OUTDOOR_LEISURE_SEATS.set(city,{minute:city.minute,seats});return seats;
}
function reserveOutdoorLeisureSeat(seats,visit,citizen){
  const key=`${visit.buildingId}:${visit.spaceId}`;let bySlot=seats.get(key);if(!bySlot)seats.set(key,bySlot=new Map());let occupants=bySlot.get(visit.slot);if(!occupants)bySlot.set(visit.slot,occupants=new Set());occupants.add(citizen);
}
const SIMULATION_LOD=Object.freeze({stableDecisionMinutes:10,unstableDecisionMinutes:8});
export const INITIAL_POPULATION = 512;
export const BUILDING_TYPES = {
  ...CIVIC_SERVICES,
  iml:{inputs:{sabao:1},label:'Instituto Médico Legal',color:0xc5d1d2,rent:0,price:115000,jobs:3},
  crematorium:{inputs:{carvao:3},label:'Crematório municipal',color:0x938a83,rent:0,price:95000,jobs:2},
  police_station:{label:'Delegacia de polícia',color:0x778c9d,rent:0,price:145000,jobs:6},
  council_oversight_office:{label:'Comissão de fiscalização da Câmara',color:0x769c8a,rent:0,price:115000,jobs:3},
  jail:{inputs:{sabao:1,remedio:1},label:'Cadeia municipal',color:0x73716d,rent:0,price:175000,jobs:5},
  courthouse:{label:'Tribunal municipal',color:0xb5a078,rent:0,price:160000,jobs:5},
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
  lamp_service: { label: 'Abastecedora de postes', color: 0xe4b34c, rent: 75, price: 50000, jobs: 2 },
  office_tower: { label: 'Empresarial', color: 0x9aaeb2, rent: 100, price: 100000, jobs: 1 },
  carrier: { label: 'Transportadora', color: 0x75b4cc, rent: 75, price: 50000, jobs: 2 },
  residential: { label: 'Residencial', color: 0xb5c4b0, rent: HOUSING_RULES.roomRent, price: HOUSING_RULES.roomPrice, jobs: 0 },
  super_popular_housing: { label: 'Moradia super popular', color: 0xb59b7e, rent: HOUSING_RULES.roomRent * .7, price: HOUSING_RULES.roomPrice * .7, jobs: 0 },
  popular_housing: { label: 'Moradia popular', color: 0xc7a779, rent: HOUSING_RULES.roomRent, price: HOUSING_RULES.roomPrice, jobs: 0 },
  popular_luxury_housing: { label: 'Moradia popular de luxo', color: 0xd0b98f, rent: HOUSING_RULES.roomRent * 1.25, price: HOUSING_RULES.roomPrice * 1.5, jobs: 0 },
  luxury_housing: { label: 'Moradia de luxo', color: 0xd6c99c, rent: HOUSING_RULES.roomRent * 2, price: HOUSING_RULES.roomPrice * 3, jobs: 0 },
  popular_refectory: { label: 'Refeitório popular', color: 0xd89d62, rent: 0, price: 90000, jobs: 4 },
  restaurant: { label: 'Restaurante', color: 0xb85f47, rent: 110, price: 105000, jobs: 6 },
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
const ESSENTIAL_TASKS=new Set(['water','food','supplies','lake-water','provisions','workmeal','health','toilet','energy']);
const INTERRUPTIBLE_TASKS=new Set(['work','manage','leisure','social','clean','walk']);
const CITY_FEED_LIMIT=128,CITY_FEED_TRIM=64;
const clamp = n => Math.max(0, Math.min(100, n));
const key = (x, y) => `${x},${y}`;


export class CitySimulation {
  constructor({ world, createEntity, seed = world.seed ?? 1337, population = INITIAL_POPULATION, startFoundingWorks = false, foundingPrivateBanks = true }) {
    this.initialPopulation = population;
    this.startFoundingWorks = startFoundingWorks;
    this.foundingPrivateBanks = foundingPrivateBanks;
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
    this.accounts = new Map([['treasury', { name: 'Prefeitura', balance: 0, totalRevenue: 0, totalExpenses: 0 }]]);ensureExternalAccount(this,'supplier','Economia externa');
    this.occupied = new Set();
    this.cardboardShelters = new Map();
    this.cardboardRevision = 0;
    this.events = [];
    this.history = new CityHistory(this);
    this.nextEventId = 1;
    this.minute = 8 * 60;
    this.currency = new CityCurrency(this);
    this.society = new CitySociety(this);
    this.housing = new CityHousing(this);
    this.sanitation = new CitySanitation(this);
    this.life = new CityLife(this);
    this.justice = new CityJustice(this);
    this.economy = new CityEconomy(this);
    this.worldPort={id:'world-port',cityId:null,name:'Porto municipal',type:'world_port',accountId:'world-port',active:true,ownerId:null,x:world.spawnCenter?.x??0,y:world.spawnCenter?.y??0,door:{x:world.spawnCenter?.x??0,y:world.spawnCenter?.y??0},entity:{id:'world-port',destroyed:false,properties:{name:'Porto municipal'}},inventory:Object.fromEntries(Object.keys(this.economy.goods).map(good=>[good,0])),inventoryCapacity:100000,incoming:{},reservations:{},receipts:{},importReservations:{},payments:{},freightReceipts:{},passengerPayments:{}};
    this.accounts.set(this.worldPort.accountId,{name:'Porto municipal',balance:0,worldPort:true});
    this.buildingTypes = BUILDING_TYPES;
    this.development = new CityDevelopment(this);
    this.logistics = new CityLogistics(this);
    this.gigs = new CityGigs(this);
    this.supplies=new CitySupplies(this);
    this.water=new CityWater(this);
    this.furniture=new CityFurniture(this);
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
    this.substances=new CitySubstances(this);this.substanceSchemaVersion=6;
    this.hourlyPayroll = new Map();
    this.ledger = [];
    this.accumulator = 0;
    this.taxRate = MINIMUM_WAGE_TAX_RATE;
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
    if (!a || !b || !Number.isSafeInteger(amount) || amount < 0 || !a.externalMoney&&a.balance < amount) return false;
    if (from === to || amount === 0) return true;
    if(from==='treasury'&&this.fiscal&&!this.fiscal.allows(amount,reason,details))return false;
    if(this.justice?.trackStolenMoneyTransfer&&!this.justice.trackStolenMoneyTransfer(from,to,amount,details))return false;
    if(!a.externalMoney)a.balance -= amount;if(!b.externalMoney)b.balance += amount;
    if(a.externalMoney!==b.externalMoney)this.currency.externalNet=(this.currency.externalNet||0)+(a.externalMoney?amount:-amount);
    this.fiscal?.record(from,to,amount,reason,details);
    recordEconomicIncome(this,from,to,amount,reason);
    if(this.fiscal)this.fiscal.serviceContinuityMinute=null;
    if(to==='treasury') b.totalRevenue=(b.totalRevenue||0)+amount;
    else if (b.entity?.properties.cityBuilding && /^(Compra pessoal de substância|Serviço:|Atacado:|Exportação:|Água para cuidados infantis|Frete entregue|Serviço de construção|Serviço de limpeza|Serviço de coleta)/.test(reason)) this.recordBusinessRevenue(b,amount);
    if(from==='treasury') a.totalExpenses=(a.totalExpenses||0)+amount;
    else if (a.entity?.properties.cityBuilding && /^(Salário$|Imposto sobre salário$|Imposto sobre vendas:|Imposto empresarial$|Vale-alimentação$|Atacado:|Frete entregue|Serviço de construção|Serviço de limpeza|Serviço de coleta)/.test(reason)) a.totalExpenses += amount;
    const payroll=reason==='Salário'||reason==='Imposto sobre salário'||reason==='Subsídio salarial municipal';
    const shipment = payroll?null:a.seller && a.buyer ? a : b.seller && b.buyer ? b : null;
    const entry = this.history.transaction(from, to, amount, reason, payroll?details:{ ...(shipment ? {shipmentId: shipment.id} : {}), ...details });
    this.ledger.push(Object.freeze({ minute: this.minute, from, to, amount, reason, eventId: entry.id }));
    if(!payroll)recordMarketTransaction(this,from,to,amount,reason,details,entry.id);
    if (this.ledger.length > 1000) this.ledger.shift();
    if(!payroll)applySalesTax(this,from,to,amount,reason,details);
    if (reason === 'Salário' || reason === 'Subsídio salarial municipal') this.hourlyPayroll.set(to, (this.hourlyPayroll.get(to) || 0) + amount);
    else if (reason !== 'Imposto sobre salário') {
      this.appendCityEvent(entry);
    }
    return true;
  }
  approachWorldBoat(boatId,citizenId){
    const boat=this.vehicles.units.get(boatId),person=this.society.citizen(citizenId);if(!boat||!person)return false;
    if(Math.hypot(person.entity.x-boat.x,person.entity.y-boat.y)<=2)return true;
    const targets=[];for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const x=Math.floor(boat.x)+dx,y=Math.floor(boat.y)+dy;if(this.walkable(x,y)&&Math.hypot(x+.5-boat.x,y+.5-boat.y)<=2)targets.push({x:x+.5,y:y+.5});}
    targets.sort((a,b)=>Math.hypot(a.x-person.entity.x,a.y-person.entity.y)-Math.hypot(b.x-person.entity.x,b.y-person.entity.y));
    for(const target of targets){const path=this.findPath(person.entity,target,{allowBoats:false});if(path){person.path=path;person.task='boat-pilot-boarding';person.action='Indo embarcar como piloto';break;}}
    return false;
  }
  setWorldBoatAssigned(vehicleId,reserved){const boat=this.vehicles.units.get(vehicleId);if(!boat?.boatClass||reserved&&boat.driverId)return false;boat.worldFleetReserved=!!reserved;return true;}
  reserveWorldExport(transferId,buildingId,good,quantity,directToPort=false){
    if(typeof transferId!=='string'||!transferId||!Number.isSafeInteger(quantity)||quantity<1||!Object.hasOwn(this.worldPort.inventory,good))return false;
    const prior=this.worldPort.reservations[transferId];
    if(prior)return prior.buildingId===buildingId&&prior.good===good&&prior.quantity===quantity&&['reserved','in-transit','delivered'].includes(prior.status);
    this.worldPort.incoming??={};const building=this.building(buildingId)||(this.economy.importDepot?.id===buildingId?this.economy.importDepot:null),used=Object.values(this.worldPort.inventory).reduce((sum,value)=>sum+value,0)+Object.values(this.worldPort.incoming).reduce((sum,value)=>sum+value,0);
    if(!building||!building.active||building.entity.destroyed||building.inventory[good]<quantity||used+quantity>this.worldPort.inventoryCapacity)return false;
    if(!directToPort&&this.logistics?.order&&this.findPath?.(building.door,this.worldPort.door)!==null){
      const shipment=this.logistics.order(building,this.worldPort,good,quantity,0,{payerAccountId:building.accountId,purpose:'world-port-export'});if(!shipment)return false;
      this.worldPort.reservations[transferId]={transferId,buildingId,good,quantity,status:'loading',localShipmentId:shipment.id,createdAt:this.minute};return true;
    }
    building.inventory[good]-=quantity;this.worldPort.inventory[good]+=quantity;this.worldPort.reservations[transferId]={transferId,buildingId,good,quantity,status:'reserved',createdAt:this.minute};
    this.economy.recordGoods('world-export-port',good,quantity,building.id,this.worldPort.id,{transferId});
    return true;
  }
  departWorldExport(transferId){
    const reservation=this.worldPort.reservations[transferId];if(!reservation)return false;
    if(['in-transit','delivered'].includes(reservation.status))return true;
    if(reservation.status==='loading'){
      const shipment=this.logistics?.shipments.find(item=>item.id===reservation.localShipmentId);if(shipment?.status!=='delivered')return false;
      reservation.status='reserved';reservation.loadedAt=this.minute;
    }
    if(reservation.status!=='reserved'||this.worldPort.inventory[reservation.good]<reservation.quantity)return false;
    this.worldPort.inventory[reservation.good]-=reservation.quantity;reservation.status='in-transit';reservation.departedAt=this.minute;return true;
  }
  completeWorldExport(transferId){const reservation=this.worldPort.reservations[transferId];if(!reservation)return false;if(reservation.status==='delivered')return true;if(reservation.status!=='in-transit')return false;reservation.status='delivered';reservation.deliveredAt=this.minute;return true;}
  returnWorldExport(transferId){
    const reservation=this.worldPort.reservations[transferId];if(!reservation)return false;
    if(reservation.status==='returned')return true;
    if(reservation.status==='loading'){
      const shipment=this.logistics?.shipments.find(item=>item.id===reservation.localShipmentId);
      if(!shipment||shipment.status==='delivered'){reservation.status='reserved';}
      else{this.logistics.cancel(shipment);reservation.status='returned';reservation.returnedAt=this.minute;return true;}
    }
    if(reservation.status!=='reserved'||this.worldPort.inventory[reservation.good]<reservation.quantity)return false;
    const building=this.building(reservation.buildingId)||(this.economy.importDepot?.id===reservation.buildingId?this.economy.importDepot:null);
    if(building&&!building.entity.destroyed){this.worldPort.inventory[reservation.good]-=reservation.quantity;building.inventory[reservation.good]+=reservation.quantity;this.economy.recordGoods('world-export-return',reservation.good,reservation.quantity,this.worldPort.id,building.id,{transferId});}
    reservation.status='returned';reservation.returnedAt=this.minute;return true;
  }
  reserveWorldImport(transferId,buildingId,good,quantity){
    if(typeof transferId!=='string'||!transferId||!Number.isSafeInteger(quantity)||quantity<1||!Object.hasOwn(this.worldPort.inventory,good))return false;
    this.worldPort.importReservations??={};const prior=this.worldPort.importReservations[transferId];
    if(prior)return prior.buildingId===buildingId&&prior.good===good&&prior.quantity===quantity&&['reserved','received','local-delivery','delivered'].includes(prior.status);
    const building=this.building(buildingId);if(!building||!building.active||building.entity.destroyed||!this.economy.accepts(building,good))return false;
    building.worldIncoming??={};building.worldIncoming[good]=(building.worldIncoming[good]||0)+quantity;
    this.worldPort.importReservations[transferId]={transferId,buildingId,good,quantity,status:'reserved',demandReleased:false,createdAt:this.minute};return true;
  }
  releaseWorldImportDemand(transferId){
    const reservation=this.worldPort.importReservations?.[transferId];if(!reservation)return true;if(reservation.demandReleased)return true;
    const building=this.building(reservation.buildingId);if(building?.worldIncoming){building.worldIncoming[reservation.good]=Math.max(0,(building.worldIncoming[reservation.good]||0)-reservation.quantity);if(!building.worldIncoming[reservation.good])delete building.worldIncoming[reservation.good];}
    reservation.demandReleased=true;return true;
  }
  cancelWorldImport(transferId){
    const reservation=this.worldPort.importReservations?.[transferId];if(!reservation)return true;if(['received','local-delivery','delivered'].includes(reservation.status))return false;if(reservation.status==='cancelled')return true;
    this.releaseWorldImportDemand(transferId);reservation.status='cancelled';reservation.cancelledAt=this.minute;return true;
  }
  receiveWorldImport(transferId,good,quantity){
    if(typeof transferId!=='string'||!transferId||!Number.isSafeInteger(quantity)||quantity<1||!Object.hasOwn(this.worldPort.inventory,good))return false;
    const reservation=this.worldPort.importReservations?.[transferId];if(reservation&&(reservation.good!==good||reservation.quantity!==quantity||reservation.status==='cancelled'))return false;
    const prior=this.worldPort.receipts[transferId];if(prior)return prior.good===good&&prior.quantity===quantity;
    const used=Object.values(this.worldPort.inventory).reduce((sum,value)=>sum+value,0);if(used+quantity>this.worldPort.inventoryCapacity)return false;
    this.worldPort.inventory[good]+=quantity;this.worldPort.receipts[transferId]={transferId,good,quantity,status:'received',receivedAt:this.minute};if(reservation)reservation.status='received';
    this.economy.recordGoods('world-import-port',good,quantity,null,this.worldPort.id,{transferId});return true;
  }
  deliverWorldImport(transferId,buildingId){
    const receipt=this.worldPort.receipts[transferId];if(!receipt)return false;if(receipt.status==='delivered')return receipt.buildingId===buildingId;
    const building=this.building(buildingId);if(!building||!building.active||building.entity.destroyed)return false;
    if(receipt.status==='local-delivery'){
      const shipment=this.logistics?.shipments.find(item=>item.id===receipt.localShipmentId);if(shipment?.status!=='delivered')return false;
      receipt.status='delivered';receipt.buildingId=buildingId;receipt.deliveredAt=this.minute;const reservation=this.worldPort.importReservations?.[transferId];if(reservation)reservation.status='delivered';return this.releaseWorldImportDemand(transferId);
    }
    if(this.logistics?.order&&this.findPath?.(this.worldPort.door,building.door)!==null){
      const shipment=this.logistics.order(this.worldPort,building,receipt.good,receipt.quantity,0,{payerAccountId:building.accountId,purpose:'world-port-import'});if(!shipment)return false;
      receipt.status='local-delivery';receipt.localShipmentId=shipment.id;receipt.buildingId=buildingId;const reservation=this.worldPort.importReservations?.[transferId];if(reservation)reservation.status='local-delivery';return false;
    }
    if(this.worldPort.inventory[receipt.good]<receipt.quantity||inventoryFree(building)<receipt.quantity)return false;
    this.worldPort.inventory[receipt.good]-=receipt.quantity;building.inventory[receipt.good]+=receipt.quantity;receipt.status='delivered';receipt.buildingId=buildingId;receipt.deliveredAt=this.minute;const reservation=this.worldPort.importReservations?.[transferId];if(reservation)reservation.status='delivered';this.releaseWorldImportDemand(transferId);
    this.economy.recordGoods('world-import-delivery',receipt.good,receipt.quantity,this.worldPort.id,building.id,{transferId});return true;
  }
  reserveWorldPayment(transferId,payerAccountId,amount){
    if(typeof transferId!=='string'||!transferId||!Number.isSafeInteger(amount)||amount<1||!this.accounts.has(payerAccountId))return false;
    const prior=this.worldPort.payments[transferId];if(prior)return prior.payerAccountId===payerAccountId&&prior.amount===amount&&['reserved','settled'].includes(prior.status);
    if(!this.transfer(payerAccountId,'supplier',amount,'Pagamento marítimo enviado',{transferId,worldTrade:true}))return false;
    this.worldPort.payments[transferId]={transferId,payerAccountId,amount,status:'reserved',reservedAt:this.minute};return true;
  }
  receiveWorldPayment(transferId,payerAccountId,amount){
    if(typeof transferId!=='string'||!transferId||!Number.isSafeInteger(amount)||amount<1)return false;
    const prior=this.worldPort.payments[transferId];if(prior)return prior.payerAccountId===payerAccountId&&prior.amount===amount&&['reserved','settled'].includes(prior.status);
    this.worldPort.payments[transferId]={transferId,payerAccountId,amount,status:'reserved',receivedAt:this.minute};return true;
  }
  settleWorldPayment(transferId,sellerAccountId,goodsAmount=null,freightAmount=0,freightReceiverAccountId=null){
    const payment=this.worldPort.payments[transferId];if(!payment)return false;
    goodsAmount??=payment.amount-freightAmount;
    if(payment.status==='settled')return payment.sellerAccountId===sellerAccountId&&payment.goodsAmount===goodsAmount&&payment.freightAmount===freightAmount;
    if(payment.status!=='reserved'||!this.accounts.has(sellerAccountId))return false;
    if(!Number.isSafeInteger(goodsAmount)||goodsAmount<0||!Number.isSafeInteger(freightAmount)||freightAmount<0||goodsAmount+freightAmount!==payment.amount)return false;
    if(!this.transfer('supplier',sellerAccountId,goodsAmount,'Pagamento marítimo recebido',{transferId,worldTrade:true}))return false;
    let freightPayee=freightReceiverAccountId&&this.accounts.has(freightReceiverAccountId)?freightReceiverAccountId:'world-fleet';
    if(freightAmount){const fleet=this.accounts.get(freightPayee)||{name:'Frota marítima',balance:0,worldFleet:true};this.accounts.set(freightPayee,fleet);if(!this.transfer('supplier',freightPayee,freightAmount,freightPayee==='world-fleet'?'Frete marítimo recebido':'Frete intermunicipal pago ao operador',{transferId,worldTrade:true,freightReceiverAccountId:freightReceiverAccountId||null}))return false;}
    payment.status='settled';payment.sellerAccountId=sellerAccountId;payment.goodsAmount=goodsAmount;payment.freightAmount=freightAmount;payment.freightReceiverAccountId=freightPayee;payment.settledAt=this.minute;return true;
  }
  receiveWorldFreightIncome(transferId,accountId,amount,vesselId){
    if(typeof transferId!=='string'||!this.accounts.has(accountId)||!Number.isSafeInteger(amount)||amount<0)return false;
    this.worldPort.freightReceipts??={};const prior=this.worldPort.freightReceipts[transferId];if(prior)return prior.accountId===accountId&&prior.amount===amount;
    if(amount&&!this.transfer('supplier',accountId,amount,'Frete intermunicipal recebido',{transferId,vesselId,worldTrade:true}))return false;
    this.worldPort.freightReceipts[transferId]={accountId,amount,vesselId,receivedAt:this.minute};return true;
  }
  payWorldPassengerFare(transferId,payerAccountId,operatorAccountId,amount,vesselId){
    if(typeof transferId!=='string'||!transferId||!this.accounts.has(payerAccountId)||!this.accounts.has(operatorAccountId)||!Number.isSafeInteger(amount)||amount<1)return false;
    const prior=this.worldPort.passengerPayments[transferId];if(prior)return prior.payerAccountId===payerAccountId&&prior.operatorAccountId===operatorAccountId&&prior.amount===amount&&prior.status==='paid';
    if(!this.transfer(payerAccountId,operatorAccountId,amount,'Passagem marítima intermunicipal',{transferId,vesselId,worldPassengerFare:true}))return false;
    this.worldPort.passengerPayments[transferId]={transferId,payerAccountId,operatorAccountId,amount,vesselId,status:'paid',paidAt:this.minute};return true;
  }
  refundWorldPassengerFare(transferId){
    const payment=this.worldPort.passengerPayments?.[transferId];if(!payment)return true;if(payment.status==='refunded')return true;if(payment.status!=='paid')return false;
    if(!this.transfer(payment.operatorAccountId,payment.payerAccountId,payment.amount,'Estorno de passagem marítima',{transferId,vesselId:payment.vesselId,worldPassengerFare:true}))return false;
    payment.status='refunded';payment.refundedAt=this.minute;return true;
  }
  refundWorldPayment(transferId){
    const payment=this.worldPort.payments[transferId];if(!payment)return false;
    if(payment.status==='refunded')return true;
    if(payment.status!=='reserved')return false;
    if(!this.transfer('supplier',payment.payerAccountId,payment.amount,'Estorno de compra marítima',{transferId,worldTrade:true}))return false;
    payment.status='refunded';payment.refundedAt=this.minute;return true;
  }
  finalizeWorldPayment(transferId){const payment=this.worldPort.payments[transferId];if(!payment)return false;if(payment.status==='settled')return true;if(payment.status!=='reserved')return false;payment.status='settled';payment.settledAt=this.minute;return true;}
  worldMigrationHousehold(citizenId){
    const head=this.society.citizen(citizenId);if(!head||head.dead||!this.society.isAdult(head))return null;
    const members=new Map([[head.id,head]]),add=person=>{if(person&&!person.dead&&!person.entity.destroyed)members.set(person.id,person);};
    let changed=true;while(changed){changed=false;for(const person of [...members.values()]){
      if(person.partnerId!=null&&!members.has(person.partnerId)){const partner=this.society.citizen(person.partnerId);if(!partner)return null;members.set(partner.id,partner);changed=true;}
      for(const child of this.citizens)if(child.guardianId===person.id&&!members.has(child.id)){add(child);changed=true;}
    }}
    const ids=new Set(members.keys());
    for(const person of members.values()){
      if(person.partnerId!=null&&!ids.has(person.partnerId)||person.dead||person.worldMigrationPending||person.businessIds?.length||person.deliveryId||person.mobilityTrip||person.ridingVehicleId||person.custody||person.indoorLocation||person.expectingId!=null||[...this.units.values()].some(unit=>unit.ownerId===person.accountId)||[...this.vehicles.units.values()].some(vehicle=>vehicle.ownerAccountId===person.accountId&&!['bicicleta','bicicleta_carga','patinete','patins','skate'].includes(vehicle.good)))return null;
      if(!this.society.isAdult(person)&&(!person.guardianId||!ids.has(person.guardianId)))return null;
    }
    return [...members.keys()];
  }
  worldCitizenMigrationPackage(transferId,citizenId,householdIds=[]){
    const citizen=this.society.citizen(citizenId);if(!citizen)return null;
    const globalId=citizen.globalId||`${this.worldPort.cityId||'city'}:${citizen.id}`;citizen.globalId=globalId;
    const globalPersonId=id=>{const person=this.society.citizen(id);if(!person)return `${this.worldPort.cityId||'city'}:${id}`;person.globalId??=`${this.worldPort.cityId||'city'}:${person.id}`;return person.globalId;};
    const previousLinks=citizen.worldLinks||{},social=structuredClone(citizen.social||{}),archive=(rows,keys)=>rows.map(row=>{const item=structuredClone(row),worldRefs={};for(const key of keys)if(Number.isSafeInteger(item[key])){worldRefs[`${key}GlobalId`]=globalPersonId(item[key]);delete item[key];}delete item.factId;delete item.eventId;return {...item,worldRefs,archivedWorld:true};});
    const socialHistory={memories:[...(previousLinks.socialHistory?.memories||[]),...archive(social.memories||[],['actorId','targetId','otherId'])],beliefs:[...(previousLinks.socialHistory?.beliefs||[]),...archive(social.beliefs||[],['aboutId','sourceId','rivalId'])]};
    social.memories=[];social.beliefs=[];social.heardFacts=[];
    social.grief=(social.grief||[]).map(loss=>{const person=loss.personId==null?null:this.society.citizen(loss.personId);return {...loss,personId:null,...(person?{globalId:globalPersonId(person.id)}:{})};});
    const relationships=new Map((previousLinks.relationships||[]).map(link=>[link.globalId,structuredClone(link)]));for(const relation of this.society.relationsFor(citizen.id)){const otherId=relation.a===citizen.id?relation.b:relation.a,link={globalId:globalPersonId(otherId),view:structuredClone(relation.views?.[citizen.id]||{}),status:relation.status};relationships.set(link.globalId,link);}
    const parentGlobalIds=[...new Set([...(previousLinks.parentGlobalIds||[]),...(citizen.parentIds||[]).map(globalPersonId)])],childGlobalIds=[...new Set([...(previousLinks.childGlobalIds||[]),...(citizen.childIds||[]).map(globalPersonId)])];
    return {version:1,transferId,globalId,citizenId,accountBalance:this.accounts.get(citizen.accountId)?.balance||0,vehicleAssets:this.vehicles.personalMobilityAssets(citizen.accountId),minute:this.minute,initialAge:citizen.initialAge,bornAt:citizen.bornAt,name:citizen.entity.properties.name,givenNames:structuredClone(citizen.givenNames||[]),surnames:structuredClone(citizen.surnames||[]),skills:structuredClone(citizen.skills||{}),traits:structuredClone(citizen.traits||{}),personality:structuredClone(citizen.personality||{}),socialProfile:structuredClone(citizen.socialProfile||{}),social,socialHistory,prejudices:structuredClone(citizen.prejudices||{}),prejudiceProfileVersion:citizen.prejudiceProfileVersion,political:structuredClone(citizen.political||{}),reputation:structuredClone(citizen.reputation||{}),profession:citizen.profession,needs:structuredClone(citizen.needs||{}),happiness:citizen.happiness,mood:citizen.mood,savingsRate:citizen.savingsRate,rentalPreference:citizen.rentalPreference,foodPreferences:structuredClone(citizen.foodPreferences||{}),inventory:structuredClone(citizen.inventory||{}),pocket:structuredClone(citizen.pocket||{}),equipment:structuredClone(citizen.equipment||{}),appearance:structuredClone(citizen.appearance||{}),render:structuredClone(citizen.entity.properties.render||{}),wardrobe:structuredClone(citizen.wardrobe||[]),career:structuredClone(citizen.career||{}),body:{...Object.fromEntries(['bodyHeightCm','bodyWeightKg','bodyFoodNeedTotal','bodyFoodNeedMinutes','bodyWeightUpdatedAt','bodyMetricsSeed'].filter(key=>citizen[key]!==undefined).map(key=>[key,citizen[key]]))},parentGlobalIds,familyLinks:{partnerGlobalId:citizen.partnerId!=null?globalPersonId(citizen.partnerId):previousLinks.partnerGlobalId||null,guardianGlobalId:citizen.guardianId!=null?globalPersonId(citizen.guardianId):previousLinks.guardianGlobalId||null,childGlobalIds,householdMemberGlobalIds:householdIds.filter(id=>id!==citizen.id).map(globalPersonId)},relationships:[...relationships.values()]};
  }
  reserveWorldCitizenMigration(transferId,citizenId,{householdIds=[]}={}){
    if(typeof transferId!=='string'||!transferId)return false;
    this.worldPort.migrations??={};const previous=this.worldPort.migrations[transferId];if(previous)return previous.status==='reserved'&&previous.package.citizenId===citizenId?structuredClone(previous.package):false;
    const citizen=this.society.citizen(citizenId),included=new Set(householdIds);if(!citizen||citizen.entity.destroyed||citizen.dead||citizen.worldMigrationPending||(!householdIds.length&&!this.society.isAdult(citizen))||(!householdIds.length&&(citizen.partnerId!=null||citizen.childIds?.length))||(citizen.partnerId!=null&&!included.has(citizen.partnerId))||(citizen.childIds||[]).some(id=>{const child=this.society.citizen(id);return child?.guardianId===citizen.id&&!included.has(id);})||citizen.businessIds?.length||citizen.deliveryId||citizen.mobilityTrip||citizen.ridingVehicleId||citizen.custody||citizen.indoorLocation||citizen.expectingId!=null||[...this.units.values()].some(unit=>unit.ownerId===citizen.accountId)||[...this.vehicles.units.values()].some(vehicle=>vehicle.ownerAccountId===citizen.accountId&&!['bicicleta','bicicleta_carga','patinete','patins','skate'].includes(vehicle.good)))return false;
    const packageData=this.worldCitizenMigrationPackage(transferId,citizenId,householdIds);if(!packageData||!this.vehicles.reserveWorldMigrationAssets(transferId,citizen.accountId))return false;const globalId=packageData.globalId;
    citizen.worldMigrationPending=transferId;this.worldPort.migrations[transferId]={transferId,status:'reserved',citizenId,globalId,package:packageData,createdAt:this.minute};return structuredClone(packageData);
  }
  reserveWorldHouseholdMigration(transferId,citizenId){
    if(typeof transferId!=='string'||!transferId)return false;
    this.worldPort.migrations??={};const prior=this.worldPort.migrations[transferId];if(prior)return prior.status==='reserved'&&prior.package.version===2?structuredClone(prior.package):false;
    const citizenIds=this.worldMigrationHousehold(citizenId);if(!citizenIds||citizenIds.length<2)return false;
    const packages=[];for(const memberId of citizenIds){const memberTransferId=`${transferId}:member:${memberId}`,packageData=this.reserveWorldCitizenMigration(memberTransferId,memberId,{householdIds:citizenIds});if(!packageData){for(const packageEntry of packages)this.cancelWorldCitizenMigration(packageEntry.transferId);return false;}packages.push(packageData);}
    const packageData={version:2,transferId,globalId:`household:${this.worldPort.cityId||'city'}:${citizenId}:${this.minute}`,citizenIds:citizenIds.slice(),members:packages};
    this.worldPort.migrations[transferId]={transferId,status:'reserved',citizenId,globalId:packageData.globalId,package:packageData,memberTransferIds:packages.map(item=>item.transferId),createdAt:this.minute};return structuredClone(packageData);
  }
  cancelWorldHouseholdMigration(transferId){
    const migration=this.worldPort.migrations?.[transferId];if(!migration)return false;if(migration.status==='cancelled')return true;if(migration.status!=='reserved'||migration.package?.version!==2)return false;
    for(const memberTransferId of migration.memberTransferIds||[])if(!this.cancelWorldCitizenMigration(memberTransferId))return false;
    migration.status='cancelled';migration.cancelledAt=this.minute;return true;
  }
  departWorldHouseholdMigration(transferId){
    const migration=this.worldPort.migrations?.[transferId];if(!migration)return false;if(['in-transit','delivered'].includes(migration.status))return true;if(migration.status!=='reserved'||migration.package?.version!==2)return false;
    for(const member of migration.package.members){const memberMigration=this.worldPort.migrations[member.transferId];if(!memberMigration||!['reserved','in-transit','delivered'].includes(memberMigration.status))return false;if(memberMigration.status==='reserved'){const citizen=this.society.citizen(member.citizenId);if(!citizen||citizen.worldMigrationPending!==member.transferId)return false;}}
    for(const member of migration.package.members){const memberMigration=this.worldPort.migrations[member.transferId];if(memberMigration.status!=='reserved')continue;const citizen=this.society.citizen(member.citizenId);if(citizen.homeUnitId!=null)this.housing.release(citizen);if(!this.departWorldCitizenMigration(member.transferId))return false;}
    migration.status='in-transit';migration.departedAt=this.minute;this.log(`${migration.package.members.length} familiares partiram para outra cidade por via marítima.`,'city',migration.package.citizenIds,{kind:'household-migration-departed',transferId});return true;
  }
  receiveWorldHouseholdMigration(transferId,packageData){
    if(!packageData||packageData.version!==2||packageData.transferId!==transferId||!Array.isArray(packageData.members)||packageData.members.length<2)return false;
    this.worldPort.migrantArrivals??={};const prior=this.worldPort.migrantArrivals[transferId];if(prior?.status==='delivered')return packageData.members.every(member=>this.citizens.some(citizen=>citizen.globalId===member.globalId));
    for(const member of packageData.members)if(!this.receiveWorldCitizenMigration(member.transferId,member))return false;
    const localByGlobalId=new Map(this.citizens.filter(citizen=>citizen.globalId).map(citizen=>[citizen.globalId,citizen]));
    for(const member of packageData.members){
      const citizen=localByGlobalId.get(member.globalId);if(!citizen)return false;const family=member.familyLinks||{};
      citizen.parentIds=(member.parentGlobalIds||[]).map(id=>localByGlobalId.get(id)?.id).filter(id=>id!=null);
      citizen.guardianId=localByGlobalId.get(family.guardianGlobalId)?.id??null;
      citizen.partnerId=localByGlobalId.get(family.partnerGlobalId)?.id??null;
      citizen.childIds=(family.childGlobalIds||[]).map(id=>localByGlobalId.get(id)?.id).filter(id=>id!=null);
      citizen.worldLinks={...(citizen.worldLinks||{}),...structuredClone(family),parentGlobalIds:structuredClone(member.parentGlobalIds||[]),relationships:structuredClone(member.relationships||[])};
      for(const link of member.relationships||[]){const other=localByGlobalId.get(link.globalId);if(!other||other===citizen)continue;const relation=this.society.getRelation(citizen,other,true);if(link.view)Object.assign(relation.views[citizen.id],structuredClone(link.view));this.relationships.sync(relation);}
    }
    this.familyIndexDirty=true;this.worldPort.migrantArrivals[transferId]={transferId,globalIds:packageData.members.map(member=>member.globalId),citizenIds:packageData.members.map(member=>localByGlobalId.get(member.globalId).id),status:'delivered',arrivedAt:this.minute};return true;
  }
  completeWorldHouseholdMigration(transferId){const migration=this.worldPort.migrations?.[transferId];if(!migration)return false;if(migration.status==='delivered')return true;if(migration.status!=='in-transit'||migration.package?.version!==2)return false;for(const memberTransferId of migration.memberTransferIds||[])if(!this.completeWorldCitizenMigration(memberTransferId))return false;migration.status='delivered';migration.deliveredAt=this.minute;return true;}
  cancelWorldCitizenMigration(transferId){const migration=this.worldPort.migrations?.[transferId];if(!migration)return false;if(migration.status==='cancelled')return true;if(migration.status!=='reserved')return false;const citizen=this.society.citizen(migration.citizenId);if(citizen?.worldMigrationPending===transferId)delete citizen.worldMigrationPending;this.vehicles.cancelWorldMigrationAssets(transferId);migration.status='cancelled';migration.cancelledAt=this.minute;return true;}
  departWorldCitizenMigration(transferId){
    const migration=this.worldPort.migrations?.[transferId];if(!migration)return false;if(migration.status==='in-transit'||migration.status==='delivered')return true;if(migration.status!=='reserved')return false;
    const citizen=this.society.citizen(migration.citizenId);if(!citizen||citizen.globalId&&citizen.globalId!==migration.globalId)return false;
    if(citizen.jobId!=null)this.economy.leaveJob(citizen,'Migração marítima');if(citizen.homeUnitId!=null)this.housing.release(citizen);migration.package.vehicleAssets=this.vehicles.departWorldMigrationAssets(transferId,citizen.accountId);
    this.society.removeCitizen(citizen);for(const parentId of citizen.parentIds||[]){const parent=this.society.citizen(parentId);if(parent?.childIds)parent.childIds=parent.childIds.filter(id=>id!==citizen.id);}
    citizen.entity.destroyed=true;this.citizens.splice(this.citizens.indexOf(citizen),1);this.accounts.delete(citizen.accountId);this.economy.citizensById?.delete(citizen.id);this.familyIndexDirty=true;this.buildingsById??=new Map();
    migration.status='in-transit';migration.departedAt=this.minute;this.structureRevision++;this.log(`${migration.package.name} partiu para outra cidade por via marítima.`,'city',[citizen.id],{kind:'citizen-migration-departed',transferId,globalId:migration.globalId});return true;
  }
  receiveWorldCitizenMigration(transferId,packageData){
    if(!packageData||packageData.version!==1||packageData.transferId!==transferId||typeof packageData.globalId!=='string'||!packageData.globalId)return false;
    this.worldPort.migrantArrivals??={};const prior=this.worldPort.migrantArrivals[transferId];if(prior)return prior.globalId===packageData.globalId&&prior.status==='delivered';
    if(this.citizens.some(citizen=>citizen.globalId===packageData.globalId))return false;
    const position=this.world.spawnCenter||{x:0,y:0},citizen=this.addCitizen(position.x,position.y,this.citizens.length,{age:packageData.initialAge,grant:false});
    citizen.globalId=packageData.globalId;citizen.initialAge=packageData.initialAge;citizen.bornAt=packageData.bornAt;citizen.parentIds=[];citizen.guardianId=null;citizen.childIds=[];citizen.entity.properties.name=packageData.name;citizen.givenNames=structuredClone(packageData.givenNames);citizen.surnames=Object.freeze(structuredClone(packageData.surnames));
    Object.assign(citizen,{skills:structuredClone(packageData.skills),traits:structuredClone(packageData.traits),personality:structuredClone(packageData.personality),socialProfile:Object.freeze(structuredClone(packageData.socialProfile)),social:structuredClone(packageData.social||citizen.social),prejudices:structuredClone(packageData.prejudices||citizen.prejudices),prejudiceProfileVersion:packageData.prejudiceProfileVersion??citizen.prejudiceProfileVersion,political:structuredClone(packageData.political||citizen.political),reputation:structuredClone(packageData.reputation||citizen.reputation),profession:packageData.profession??citizen.profession,needs:structuredClone(packageData.needs),happiness:packageData.happiness,mood:packageData.mood,savingsRate:packageData.savingsRate??citizen.savingsRate,rentalPreference:packageData.rentalPreference??citizen.rentalPreference,foodPreferences:structuredClone(packageData.foodPreferences||citizen.foodPreferences||{}),inventory:structuredClone(packageData.inventory),pocket:structuredClone(packageData.pocket),equipment:structuredClone(packageData.equipment),appearance:structuredClone(packageData.appearance),wardrobe:structuredClone(packageData.wardrobe||[]),career:structuredClone(packageData.career||{}),action:'Chegando de outra cidade',task:null,targetId:null,path:[],homeUnitId:null,jobId:null});
    citizen.entity.properties.render=structuredClone(packageData.render||citizen.entity.properties.render);citizen.entity.properties.citizen=citizen;const account=this.accounts.get(citizen.accountId);if(!account)return false;account.balance=packageData.accountBalance;if(!this.vehicles.receiveWorldMigrationAssets(citizen.accountId,packageData.vehicleAssets||[],transferId))return false;
    citizen.worldLinks={parentGlobalIds:structuredClone(packageData.parentGlobalIds||[]),relationships:structuredClone(packageData.relationships||[]),socialHistory:structuredClone(packageData.socialHistory||{memories:[],beliefs:[]}),...(packageData.familyLinks?structuredClone(packageData.familyLinks):{})};Object.assign(citizen,structuredClone(packageData.body||{}));this.relationships.register(citizen);this.worldPort.migrantArrivals[transferId]={transferId,globalId:packageData.globalId,citizenId:citizen.id,status:'delivered',arrivedAt:this.minute};this.log(`${citizen.entity.properties.name} chegou de outra cidade por via marítima.`,'city',[citizen.id],{kind:'citizen-migration-arrived',transferId,globalId:packageData.globalId});return true;
  }
  completeWorldCitizenMigration(transferId){const migration=this.worldPort.migrations?.[transferId];if(!migration)return false;if(migration.status==='delivered')return true;if(migration.status!=='in-transit')return false;migration.status='delivered';migration.deliveredAt=this.minute;return true;}
  recordBusinessRevenue(building,amount){
    if(!building||!Number.isSafeInteger(amount)||amount<=0)return false;
    building.totalRevenue=(building.totalRevenue||0)+amount;
    const day=this.day??Math.floor(this.minute/1440),history=building.revenueHistory??=[];
    const last=history[history.length-1];if(last?.day===day)last.amount+=amount;else history.push({day,amount});
    const cutoff=day-31;while(history.length&&history[0].day<cutoff)history.shift();
    return true;
  }
  initialize() {
    // Foreign buyers and suppliers operate outside the finite local monetary base.
    this.currency.initialize();
    generateSettlement(this);
    const hallDoor=this.buildings.find(building=>building.type==='townhall')?.door;
    if(hallDoor){
      const shoreCandidates=[],seaNavigation=createSeaEdgeNavigation(this.world);
      for(let y=0;y<this.world.height;y++)for(let x=0;x<this.world.width;x++){
        if(!this.walkable(x,y))continue;
        const distance=(x-hallDoor.x)**2+(y-hallDoor.y)**2;
        for(const water of [{x:x+1,y},{x:x-1,y},{x,y:y+1},{x,y:y-1}])if(this.world.getTile(water.x,water.y)===TILE_WATER&&seaNavigation?.reachable(water))shoreCandidates.push({door:{x,y},berth:water,distance});
      }
      if(!shoreCandidates.length)for(let y=0;y<this.world.height;y++)for(let x=0;x<this.world.width;x++){if(!this.walkable(x,y))continue;const water=[{x:x+1,y},{x:x-1,y},{x,y:y+1},{x,y:y-1}].find(point=>this.world.getTile(point.x,point.y)===TILE_WATER);if(water)shoreCandidates.push({door:{x,y},berth:water,distance:(x-hallDoor.x)**2+(y-hallDoor.y)**2});}
      shoreCandidates.sort((a,b)=>a.distance-b.distance);
      const {width,height}=this.world,total=width*height,shoreDistance=new Int32Array(total);shoreDistance.fill(-1);const shoreQueue=new Int32Array(total);let shoreHead=0,shoreTail=0;
      const seedShoreSearch=(x,y,distance)=>{if(x<0||y<0||x>=width||y>=height||shoreDistance[y*width+x]>=0||!this.walkable(x,y))return;if(distance>0&&!canStep(this.world,hallX,hallY,x,y))return;shoreDistance[y*width+x]=distance;shoreQueue[shoreTail++]=y*width+x;};
      const hallX=Math.floor(hallDoor.x),hallY=Math.floor(hallDoor.y);seedShoreSearch(hallX,hallY,0);
      if(shoreTail===0)for(const[dx,dy]of [[1,0],[0,1],[-1,0],[0,-1]])seedShoreSearch(hallX+dx,hallY+dy,1);
      while(shoreHead<shoreTail){const index=shoreQueue[shoreHead++],x=index%width,y=Math.floor(index/width),nextDistance=shoreDistance[index]+1;for(const[dx,dy]of [[1,0],[0,1],[-1,0],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;const next=ny*width+nx;if(shoreDistance[next]>=0||!this.walkable(nx,ny)||!canStep(this.world,x,y,nx,ny))continue;shoreDistance[next]=nextDistance;shoreQueue[shoreTail++]=next;}}
      const reachable=candidate=>shoreDistance[candidate.door.y*width+candidate.door.x]>=0;
      const nearestHarbor=shoreCandidates.find(reachable)||shoreCandidates.find(candidate=>this.findPath(hallDoor,candidate.door)!==null);
      // Keep the waterfront beyond the dense town-hall block so its quay and
      // moored fleet are not buried under the default city buildings.
      const clearHarbor=shoreCandidates.find(candidate=>reachable(candidate)&&shoreDistance[candidate.door.y*width+candidate.door.x]>=20);
      const harbor=clearHarbor||nearestHarbor;
      const portAnchor=harbor?.door||hallDoor,berth=harbor?.berth||null;
      this.worldPort.x=portAnchor.x;this.worldPort.y=portAnchor.y;this.worldPort.door={...portAnchor};
      this.worldPort.berth=berth?{...berth}:null;
      this.worldPort.edgeRoute=berth?seaNavigation?.pathFrom(berth)||null:null;
      this.worldPort.edgeRouteRevision=this.world.revision||0;
    }
    this.vehicles.initializeHarborFleet(this.worldPort);
    const arrivalTiles = [],{width,height}=this.world,limit=Math.min(width*height,Math.max(256,this.initialPopulation*2));
    // Place initial residents across reachable land instead of cycling through
    // a tiny 11×11 patch around the town hall. On crowded or coastal seeds the
    // old search found only a few cells, stacking many citizens at one point.
    let start=null;
    for(let radius=0;radius<=32&&!start;radius++)for(let dy=-radius;dy<=radius&&!start;dy++)for(let dx=-radius;dx<=radius&&!start;dx++){
      if(radius&&Math.abs(dx)!==radius&&Math.abs(dy)!==radius)continue;
      const x=Math.floor(this.spawn.x)+dx,y=Math.floor(this.spawn.y)+dy;
      if(this.walkable(x,y)&&this.findPath(this.spawn,{x,y})!==null)start={x,y};
    }
    if(!start)for(let index=0;index<width*height;index++){const x=index%width,y=Math.floor(index/width);if(this.walkable(x,y)&&this.findPath(this.spawn,{x,y})!==null){start={x,y};break;}}
    if(start){
      const seen=new Uint8Array(width*height),queue=[start.y*width+start.x];seen[queue[0]]=1;
      for(let head=0;head<queue.length&&arrivalTiles.length<limit;head++){
        const index=queue[head],x=index%width,y=Math.floor(index/width);arrivalTiles.push({x:x+.5,y:y+.5});
        for(const [dx,dy]of [[1,0],[0,1],[-1,0],[0,-1]]){
          const nx=x+dx,ny=y+dy,next=ny*width+nx;
          if(nx<0||ny<0||nx>=width||ny>=height||seen[next]||!this.walkable(nx,ny)||!canStep(this.world,x,y,nx,ny))continue;
          seen[next]=1;queue.push(next);
        }
      }
    }
    if(!arrivalTiles.length)throw new Error('Não há células de terra acessíveis para distribuir a população neste mapa.');
    for (let i = 0; i < this.initialPopulation; i++) { const p = arrivalTiles[i % arrivalTiles.length]; this.addCitizen(p.x, p.y, i); }
    this.economy.initialize();
    this.vehicles.equipInitialWorkers();
    this.nature.initialize();
    this.furniture.reconcile();
    this.log(`Cidade fundada sobre o relevo natural. Semente ${this.world.seed ?? this.initialSeed}: ${this.citizens.length} moradores e serviços conectados.`, 'city', [], { kind: 'foundation', seed: this.world.seed ?? this.initialSeed });
    this.syncClock();
    this.staggerInitialTaskDecisions();
  }
  staggerInitialTaskDecisions(){
    // Spread first-day route searches over half an hour of simulation. Eight
    // minute buckets still released over a hundred citizens per worker tick
    // in 1k-population cities, producing a visible startup hitch.
    for(const c of this.citizens)if(c._initialTaskStaggerUntil==null&&!c.task&&!c.path?.length)c._initialTaskStaggerUntil=this.minute+c.id%32;
  }
  clearCardboardSheltersForArea(x,y,width,depth) {
    let removed=0;
    for(const [shelterKey,shelter] of this.cardboardShelters||[]) {
      if(shelter.x<x||shelter.x>=x+width||shelter.y<y||shelter.y>=y+depth)continue;
      this.cardboardShelters.delete(shelterKey);removed++;
      const owner=this.society.citizen(shelter.citizenId);
      if(owner){owner.inventory??={};owner.inventory.papelao=(owner.inventory.papelao||0)+1;owner.cardboardShelterKey=null;owner.homelessSleepSpot=null;if(owner.task==='energy'){owner.task=null;owner.path=[];owner.action='O abrigo foi removido para uma obra; o papelão voltou ao inventário.';}}
    }
    if(removed)this.cardboardRevision=(this.cardboardRevision||0)+1;
    return removed;
  }
  addBuilding(type, x, y, { width, depth, floors, free = false, plotId = null, ownerAccountId = 'treasury', kind = ['farm','quarry','iron_mine','bauxite_mine','park','bike_rack'].includes(type) ? 'open-air' : 'building', materialSource = null, rotation = null } = {}) {
    if(OFFICE_ONLY_TYPES.has(type)&&!free)return this.fail('Esta atividade precisa ocupar um andar em um empresarial.');
    const spec = BUILDING_TYPES[type];
    if (['quarry','iron_mine','bauxite_mine'].includes(type) && this.world.map && !quarryDeposits(this.world, x, y, width || 4, depth || 4).length) return this.fail('A mina precisa ter uma tile de rocha preta adjacente.');
    if (!spec) return this.fail('Tipo de prédio inválido.');
    if (!['open-air', 'building'].includes(kind) || (kind === 'open-air' && !['farm', 'quarry','iron_mine','bauxite_mine', 'park', 'bike_rack', 'leisure', 'greengrocer'].includes(type))) return this.fail('Tipo de ocupação incompatível com esta construção.');
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
    // A staged construction deliberately brings its crew onto the plot. The
    // completed shell evacuates them in finishBuildingOccupants; rejecting it
    // merely because a worker is still standing on a work cell strands homes.
    if (kind !== 'open-air' && !materialSource && this.citizens.some(c => !c.entity.destroyed && c.entity.x >= x && c.entity.x < x + width && c.entity.y >= y && c.entity.y < y + depth)) return this.fail('Há cidadãos neste terreno. Aguarde a passagem deles.');
    const count = width * depth * floors, stone = kind === 'open-air' ? (['park','bike_rack'].includes(type)?Math.ceil(count/4):0) : count * DEVELOPMENT_RULES.stonePerCell, capital = type !== 'townhall' && PUBLIC_TYPES.has(type) && ownerAccountId === 'treasury' ? this.currency.price(50000) : 0;
    const plot = this.development.plots.find(p => p.id === plotId);
    if (!free && (!plot || plot.ownerId !== ownerAccountId || plot.buildingId || plot.x !== x || plot.y !== y || width > plot.width || depth > plot.depth)) return this.fail('É necessário comprar um terreno compatível antes de construir.');
    if (!free && stone && (!materialSource || materialSource.inventory.pedra < stone)) return this.fail(`Obra precisa de ${stone} pedras entregues no terreno.`);
    if (!free && this.treasury < capital) return this.fail('Caixa municipal insuficiente para obra e capital de operação.');
    this.clearCardboardSheltersForArea(x,y,width,depth);
    const entity = this.createEntity({ x, y, properties: { name: this.life.buildingName(spec.label), species: 'city-building', render: { color: spec.color, style: type === 'super_popular_housing' ? 'popular' : type === 'popular_luxury_housing' ? 'luxury' : type === 'popular_housing' ? 'popular' : type === 'luxury_housing' ? 'luxury' : type === 'popular_refectory' ? 'refectory' : type } } });
    const b = { id: entity.id, entity, type, constructionKind: kind, rotation:terrain.rotation, width, depth, floors, color: spec.color, condition: 100, units: [], balance: 0, jobs: Math.min(spec.jobs ? Math.max(spec.jobs, Math.floor(count / 6)) : 0, 32), wage: 4 + Math.floor(this.random() * 3), stock: 0, workers: [], terrain, door: terrain.door };
    b.architecture = architectureFor(type, entity.id, this.initialSeed);
    if (['residential','super_popular_housing','popular_housing','popular_luxury_housing','luxury_housing'].includes(type)) {
      b.architectureColor = HOUSE_STYLES[b.architecture].wall;
    }
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
    if (kind !== 'open-air') {
      const entry=buildingInteriorEntrance(b),entryX=entry&&Math.floor(entry.x),entryY=entry&&Math.floor(entry.y);
      for (let yy = y; yy < y + depth; yy++) for (let xx = x; xx < x + width; xx++) if(xx!==entryX||yy!==entryY)this.occupied.add(key(xx, yy));
      this.obstacleRevision=(this.obstacleRevision||0)+1;
    }
    if(WATERFRONT_BUSINESSES.has(type))b.waterfront=waterfrontBerth(this.world,x,y,width,depth);
    this.buildings.push(b);
    this.buildingsById.set(b.id, b);
    this.structureRevision++;
    this.sanitation.setupBuilding(b);
    this.sanitation.setupBusinessRooms(b);
    if(type==='farm')cultivateFarmTerrain(this,b);
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
    const mobilityPriority=.75+((((Math.imul(index+1,2654435761)^this.initialSeed)>>>0)/4294967295)*.5);
    const c = { id: entity.id, entity, balance: 0, homeUnitId: null, jobId: null, inventory:{papelao:1}, needs: Object.fromEntries(Object.keys(NEED_LABELS).map(n => [n, 60 + this.random() * 35])), action: 'Chegando à cidade', targetId: null, path: [], task: null, happiness: 80, salaryToday: 0, taxRemainder: 0, homeId: null, mood: 0, mobilityPriority, mobilityNeed: 8, mobilityTimeLostToday: 0, bodyMetricsSeed:this.initialSeed, lastProgressAt: this.minute,_initialTaskStaggerUntil:this.minute+entity.id%32 };
    initializeBodyMetrics(c,this.initialSeed);
    c.parentIds=options.parentIds||[];ensureSkinColor(this,c);
    c.givenNames = identity.givenNames; c.surnames = Object.freeze(identity.surnames);
    initializeCharacter(this, c); this.reputation.setup(c);
    this.society.initializeCitizen(c, options);
    this.economy.initializeCitizen(c, index, options);
    c.entity.properties.render.size = this.society.age(c) < 6 ? .55 : this.society.isAdult(c) ? 1 : .8;
    c.accountId = `citizen:${c.id}`;
    c.indoorLocation = null;
    pocket(c).water=options.grant===false?0:6;pocket(c).waterSource='Reserva de chegada';
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
  setWorkplaceDiningFloor(buildingId,floor,enabled=true){
    const b=this.building(buildingId);if(!b||!Number.isInteger(floor)||floor<0||floor>=b.floors)return this.fail('Andar inválido para instalar o refeitório.');
    const rooms=b.units.filter(u=>u.z===floor&&u.roomType!=='circulation');
    if(!this.workMeals.completeFloor(b,floor))return this.fail('O refeitório precisa ocupar todas as células de um andar completo.');
    if(enabled){
      if(!rooms.every(u=>u.roomType==='workspace'))return this.fail('Escolha um andar livre de banheiros e outros espaços especializados.');
      for(const u of rooms)u.roomType='dining';
    }else{
      if(!rooms.every(u=>u.roomType==='dining'))return this.fail('Esse andar não é um refeitório completo.');
      for(const u of rooms)u.roomType='workspace';
    }
    b.layoutRevision=(b.layoutRevision||0)+1;this.structureRevision++;this.reconciledRevision=null;
    this.log(`${b.entity.properties.name} ${enabled?'passou a oferecer um andar completo de refeitório':'encerrou o refeitório no local'}.`,'economy',[b.ownerId].filter(Boolean),{kind:'workplace-dining-policy',buildingId:b.id,floor,enabled});
    return true;
  }
  setPolicies(policies, message) {
    for (const scope of ['currency', 'bank', 'welfare']) if (policies[scope]) Object.assign(this[scope].policy, policies[scope]);
    if (Number.isFinite(policies.taxRate)) this.taxRate = Math.max(MINIMUM_WAGE_TAX_RATE, Math.min(.5, policies.taxRate));
    this.history.record('policy', message, ['treasury']);
  }
  rentUnit(citizenId, unitId) {
    const c = this.society.citizen(citizenId), u = this.units.get(unitId);
    if (!c || !u || !this.building(u.buildingId) || !['residential', 'super_popular_housing', 'popular_housing', 'popular_luxury_housing', 'luxury_housing'].includes(this.building(u.buildingId).type) || (u.ownerId !== c.accountId && !u.forRent) || (u.tenantId && u.tenantId !== c.accountId)) return this.fail('Espaço indisponível para moradia.');
    const payer = this.payerFor(c);
    if (u.ownerId !== c.accountId && u.ownerId !== payer && this.accounts.get(payer).balance < u.rent) return this.fail('Saldo insuficiente para o primeiro aluguel.');
    if (c.homeUnitId === u.id) return u;
    if (u.ownerId !== c.accountId && !this.transfer(payer, u.ownerId, u.rent, 'Primeiro aluguel')) return null;
    this.releaseHome(c);
    u.tenantId = c.accountId; u.rentPayerId = payer === c.accountId ? null : payer; u.arrears = 0; u.missedDays = 0;
    c.homeUnitId = u.id; c.homeId = u.homeId || null;this.housing.invalidateResidents();
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
    u.ownerId = c.accountId; u.forSale = false; u.forRent = !u.tenantId && ['residential', 'super_popular_housing', 'popular_housing', 'popular_luxury_housing', 'luxury_housing'].includes(this.building(u.buildingId).type); u.arrears = 0; u.missedDays = 0;
    this.log(`${c.entity.properties.name} comprou o espaço ${u.id}.`, 'housing', [c.id], { kind: 'purchase', unitId: u.id });
    return u;
  }
  listUnit(unitId, { rent, price, forSale, forRent }) {
    const u = this.units.get(unitId);
    if (!u || !Number.isSafeInteger(rent) || rent < 0 || !Number.isSafeInteger(price) || price < 1) return this.fail('Informe preços válidos.');
    if(this.housing.isSocial(this.housing.homes.get(u.homeId)))return this.fail('Moradia popular municipal é destinada à ocupação social gratuita.');
    u.rent = rent; u.price = price; u.forSale = !!forSale; u.forRent = !!forRent && (u.ownerId !== 'treasury' || economicPolicy(this,'municipalRentals'));
    return u;
  }
  assignHousingAndJobs() { this.economy.assignHomes(); this.economy.hire(); }
  walkable(x, y) { return !this.occupied.has(key(x, y)) && terrainWalkable(this.world, x, y); }
  groundPath(start,goal){
    const profile=this._pathSearchProfile;if(profile)profile.groundCalls=(profile.groundCalls||0)+1;
    const width=this.world.width,height=this.world.height,blockedRevision=`${width}:${height}:${this.obstacleRevision||0}:${this.occupied.size}`;
    if(this._pathBlockedRevision!==blockedRevision){const grid=new Uint8Array(width*height);for(const cell of this.occupied){const comma=cell.indexOf(','),x=Number(cell.slice(0,comma)),y=Number(cell.slice(comma+1));if(x>=0&&y>=0&&x<width&&y<height)grid[y*width+x]=1;}this._pathBlockedGrid=grid;this._pathBlockedRevision=blockedRevision;}
    const key=`ground:${Math.floor(start.x)},${Math.floor(start.y)}:${Math.floor(goal.x)},${Math.floor(goal.y)}`;
    if(this.pathCache.has(key)){if(profile)profile.groundCacheHits=(profile.groundCacheHits||0)+1;return this.pathCache.get(key);}
    if(this.buildings?.length&&settlementConnected(this,start,goal)===false){if(this.pathCache.size>=Math.max(2048,Math.min(16384,this.citizens.length*16)))this.pathCache.delete(this.pathCache.keys().next().value);this.pathCache.set(key,null);return null;}
    const shared=findSharedTerrainPath(this,start,goal,this._pathBlockedGrid);
    if(profile){const counter=shared===undefined?'aStarCalls':'sharedCalls';profile[counter]=(profile[counter]||0)+1;}
    const route=shared===undefined?findTerrainPath(this.world,start,goal,this.occupied,{blockedGrid:this._pathBlockedGrid}):shared,mapped=route??null;
    if(this.pathCache.size>=Math.max(2048,Math.min(16384,this.citizens.length*16)))this.pathCache.delete(this.pathCache.keys().next().value);
    this.pathCache.set(key,mapped);return mapped;
  }
  skybridgeLinksForRevision(revision=`${this.world.revision || 0}:${this.structureRevision||0}:${this.obstacleRevision||0}:${this.occupied.size}`) {
    if(this._skybridgeCache?.revision!==revision)this._skybridgeCache={revision,links:skybridgeLinks(this.buildings,this.world)};
    return this._skybridgeCache.links;
  }
  findPath(start, goal, options={}) {
    const profile=this._pathSearchProfile;
    if(!profile)return this._findPath(start,goal,options);
    const revision = `${this.world.revision || 0}:${this.structureRevision||0}:${this.obstacleRevision||0}:${this.occupied.size}`;
    const key = `${Math.floor(start.x)},${Math.floor(start.y)}:${Math.floor(goal.x)},${Math.floor(goal.y)}`;
    const measure=this.pathCacheRevision!==revision||!this.pathCache?.has(key);
    const started=measure?performance.now():0;
    const result=this._findPath(start,goal,options);
    if(measure){
      const ms=performance.now()-started;profile.searches++;profile.totalMs+=ms;
      if(ms>profile.maxMs){profile.maxMs=ms;profile.start={x:start.x,y:start.y};profile.goal={x:goal.x,y:goal.y};}
    }
    return result;
  }
  _findPath(start, goal, {copy=true,allowSkybridges=true,allowBoats=true}={}) {
    // Plan the outdoor leg from the exit; the resident walks there first.
    const location=start.properties?.citizen?.indoorLocation;
    if(location){const site=this.building(location.buildingId),shell=this.building(site?.officeTenantOf)||site;if(shell)start=shell.door;}
    const revision = `${this.world.revision || 0}:${this.structureRevision||0}:${this.obstacleRevision||0}:${this.occupied.size}`;
    if (this.pathCacheRevision !== revision) { this.pathCache = new Map(); this.pathCacheRevision = revision; }
    const key = `${Math.floor(start.x)},${Math.floor(start.y)}:${Math.floor(goal.x)},${Math.floor(goal.y)}`;
    const links=allowSkybridges&&this.buildings.length>1?this.skybridgeLinksForRevision(revision):NO_CHILDREN;
    if(links.length){if(!this.skybridgePathCache||this.skybridgePathCacheRevision!==revision){this.skybridgePathCache=new Map();this.skybridgePathCacheRevision=revision;}if(this.skybridgePathCache.has(key)){const route=this.skybridgePathCache.get(key);if(route!==null)return copy?route.slice():route;if(!allowBoats)return null;}}
    // Water-separated destinations used to pay for a full A* search before
    // we learned they could not connect. The component map is cached by map
    // topology and obstacles, so reject impossible land routes first.
    if(!this.pathCache.has(key)&&settlementConnected(this,start,goal)===false){
      const canReachBridge=links.some(link=>
        settlementConnected(this,start,link.startAccess)!==false&&settlementConnected(this,link.endAccess,goal)!==false||
        settlementConnected(this,start,link.endAccess)!==false&&settlementConnected(this,link.startAccess,goal)!==false);
      if(!canReachBridge&&!allowBoats){
        if(links.length)this.skybridgePathCache.set(key,null);
        else{if(this.pathCache.size>=Math.max(2048,Math.min(16384,this.citizens.length*16)))this.pathCache.delete(this.pathCache.keys().next().value);this.pathCache.set(key,null);}
        return null;
      }
    }
    if (!this.pathCache.has(key)) {
      const route=settlementConnected(this,start,goal)===false?null:this.groundPath(start,goal);
      if(this.pathCache.size>=Math.max(2048,Math.min(16384,this.citizens.length*16)))this.pathCache.delete(this.pathCache.keys().next().value);
      this.pathCache.set(key,route);
    }
    let path = this.pathCache.get(key);
    if(path===null&&allowBoats)path=findBoatPath(this,start,goal);
    if(links.length){
      let bestScore=path===null?Infinity:path.length||0;
      for(const link of links){
        for(const reverse of [false,true]){
          const from=reverse?link.end:link.start,to=reverse?link.start:link.end,fromBuilding=this.building(reverse?link.bId:link.aId),toBuilding=this.building(reverse?link.aId:link.bId),fromUnit=fromBuilding?.units.find(u=>u.id===(reverse?link.buId:link.auId)),toUnit=toBuilding?.units.find(u=>u.id===(reverse?link.auId:link.buId));
          if(!fromBuilding||!toBuilding||!fromUnit||!toUnit)continue;
          const lower=Math.hypot(start.x-fromBuilding.door.x,start.y-fromBuilding.door.y)+Math.hypot(goal.x-toBuilding.door.x,goal.y-toBuilding.door.y)+Math.hypot(to.x-from.x,to.y-from.y)*.76+fromBuilding.floors+toBuilding.floors;
          if(lower>=bestScore)continue;
          if(this._pathSearchProfile)this._pathSearchProfile.bridgeChecks=(this._pathSearchProfile.bridgeChecks||0)+1;
          const first=this.groundPath(start,fromBuilding.door);if(!first)continue;
          const last=this.groundPath(toBuilding.door,goal);if(!last)continue;
          const fromPoint={x:fromBuilding.entity.x+fromUnit.x+.5,y:fromBuilding.entity.y+fromUnit.y+.5,z:fromUnit.z*CITY_FLOOR_HEIGHT},toPoint={x:toBuilding.entity.x+toUnit.x+.5,y:toBuilding.entity.y+toUnit.y+.5,z:toUnit.z*CITY_FLOOR_HEIGHT},fromDoor={x:fromBuilding.door.x,y:fromBuilding.door.y,z:0},toDoor={x:toBuilding.door.x,y:toBuilding.door.y,z:0},up=interiorRoute(fromBuilding,fromDoor,fromPoint),down=interiorRoute(toBuilding,toPoint,toDoor);
          if(!up||!down)continue;
          const waypoints=first.slice();
          const append=p=>{const previous=waypoints.at(-1);if(!previous||Math.hypot(previous.x-p.x,previous.y-p.y,(previous.z||0)-(p.z||0))>.001)waypoints.push(p);};
          append(fromDoor);waypoints.push({...fromDoor,skybridgeEntry:{buildingId:fromBuilding.id,unitId:fromUnit.id,linkId:link.id,endpoint:reverse?'end':'start'}});
          append({...from,z:link.height,skybridgeId:link.id});
          append({x:to.x,y:to.y,z:link.height,skybridgeId:link.id});
          waypoints.push({x:to.x,y:to.y,z:link.height,skybridgeExit:{buildingId:toBuilding.id,unitId:toUnit.id,linkId:link.id,endpoint:reverse?'start':'end'}});
          for(const point of last)append(point);
          const score=first.length+last.length+up.length+down.length+Math.hypot(to.x-from.x,to.y-from.y,link.height)*.76+3;
          if(score<bestScore){bestScore=score;path=waypoints;}
        }
      }
    }
    if(links.length&&!path?.some(point=>point.boatClass)){if(this.skybridgePathCache.size>=Math.max(2048,Math.min(16384,this.citizens.length*16)))this.skybridgePathCache.delete(this.skybridgePathCache.keys().next().value);this.skybridgePathCache.set(key,path);}
    // Keep insertion-order eviction: touching every cache hit costs two Map
    // mutations across the hot path, while FIFO gives the same route answers.
    // Consumers shift their own array but never mutate waypoint coordinates.
    return path === null ? null : copy?path.slice():path;
  }
  beginSkybridgeTransit(c,leg){
    const building=this.building(leg.buildingId),unit=building?.units.find(u=>u.id===leg.unitId),links=this.skybridgeLinksForRevision(),link=links.find(item=>item.id===leg.linkId);
    if(!building||!unit||!link||c.indoorLocation)return false;
    const door={x:building.door.x,y:building.door.y,z:0},room={x:building.entity.x+unit.x+.5,y:building.entity.y+unit.y+.5,z:unit.z*CITY_FLOOR_HEIGHT},boarding=leg.phase==='entry',path=interiorRoute(building,boarding?door:room,boarding?room:door);
    if(!path)return false;
    c.skybridgeTransit={...leg,phase:boarding?'boarding':'alighting'};
    c.indoorLocation={buildingId:building.id,unitId:null,targetUnitId:unit.id,roomType:'circulation',targetRoomType:'circulation',floor:0,position:boarding?door:room,path,phase:'walking',task:c.task,layoutRevision:building.layoutRevision||0,enteredAt:this.minute};
    c.action=boarding?'Entrando no prédio para acessar a passarela':'Atravessando o prédio para sair da passarela';return true;
  }
  finishSkybridgeTransit(c){
    const transit=c.skybridgeTransit;if(!transit||c.indoorLocation?.path?.length)return;
    const building=this.building(transit.buildingId),link=this.skybridgeLinksForRevision().find(item=>item.id===transit.linkId);
    if(!building||!link){c.indoorLocation=null;c.skybridgeTransit=null;c.skybridgeZ=0;c.skybridgeId=null;c.path=[];return;}
    // A social interaction, job cancellation or an old save can lose the
    // remaining waypoints. Finish the physical crossing before choosing again.
    if(c.conversation){const other=this.society.citizen(c.conversation.a===c.id?c.conversation.b:c.conversation.a);if(other)other.conversation=null;c.conversation=null;}
    if(c.mobilityTrip||c.ridingVehicleId){this.vehicles.releaseTrip(c);c.path=[];}
    if(transit.phase==='crossing'){
      c.skybridgeZ=link.height;c.skybridgeId=link.id;
      if(!c.path.some(point=>point.skybridgeExit?.linkId===link.id)){
        const endpoint=Math.hypot(c.entity.x-link.start.x,c.entity.y-link.start.y)<=Math.hypot(c.entity.x-link.end.x,c.entity.y-link.end.y)?'start':'end';
        const point=endpoint==='start'?link.start:link.end;
        c.path=[{...point,z:link.height,skybridgeId:link.id},{...point,z:link.height,skybridgeExit:{buildingId:endpoint==='start'?link.aId:link.bId,unitId:endpoint==='start'?link.auId:link.buId,linkId:link.id,endpoint,interrupted:true}}];
        c.lastProgressAt=this.minute;c.action='Concluindo a saída da passarela';
      }
      return;
    }
    if(transit.phase==='boarding'){
      const point=transit.endpoint==='end'?link.end:link.start;c.entity.x=point.x;c.entity.y=point.y;c.skybridgeZ=link.height;c.skybridgeId=link.id;c.indoorLocation=null;transit.phase='crossing';c.action='Saindo do prédio para a passarela';return;
    }
    if(transit.phase==='alighting'){
      c.entity.x=building.door.x;c.entity.y=building.door.y;c.skybridgeZ=0;c.skybridgeId=null;c.indoorLocation=null;c.skybridgeTransit=null;c.action='Saindo do prédio';
      if(transit.interrupted){c.task=null;c.targetId=null;c._nextTaskAt=0;}
    }
  }
  urgentNeed(c) {
    // Exhaustion and a dirty bathroom must not postpone treatment until health
    // reaches zero: rural citizens still need time to travel to a clinic. But
    // an early health warning must not lock someone out of food or water when
    // either is already critically low; restore the immediate survival need
    // first, then resume medical care on the next decision pass.
    const profile=this._citizenLoopProfile,started=profile?performance.now():0,basics=Math.min(c.needs.food,c.needs.water);let need;
    if(c.needs.health<20&&basics>12)need='health';
    else{let score=Infinity;for(const [key,threshold,penalty] of URGENT_NEEDS){const value=c.needs[key];if(value<threshold&&(need===undefined||value-penalty<score)){need=key;score=value-penalty;}}}
    if(profile)profile.urgentNeedMs=(profile.urgentNeedMs||0)+performance.now()-started;
    return need;
  }
  routeHomelessToSleep(c) {
    this.cardboardShelters??=new Map();this.cardboardRevision??=0;
    c.inventory??={};if(!Number.isFinite(c.inventory.papelao))c.inventory.papelao=1;
    c.task='energy';c.targetId=null;c.homelessSleepSpot??=null;
    const existing=c.cardboardShelterKey&&this.cardboardShelters.get(c.cardboardShelterKey);
    if(existing&&existing.citizenId===c.id)c.homelessSleepSpot={x:existing.x,y:existing.y};
    let spot=c.homelessSleepSpot;
    const abandonSpot=()=>{const shelter=this.cardboardShelters.get(c.cardboardShelterKey);if(shelter?.citizenId===c.id){this.cardboardShelters.delete(c.cardboardShelterKey);this.cardboardRevision++;}c.cardboardShelterKey=null;c.homelessSleepSpot=null;c.inventory.papelao=Math.max(1,c.inventory.papelao);c.path=[];spot=null;};
    const hasTreeAt=(x,y)=>{const id=this.nature?.tiles?.get(`${x},${y}`);return !!this.nature?.plants.get(id)?.entity.properties.tree;};
    if(spot&&(!this.walkable(Math.floor(spot.x),Math.floor(spot.y))||ROAD_TILES.has(tileAt(this.world,Math.floor(spot.x),Math.floor(spot.y)))||hasTreeAt(Math.floor(spot.x),Math.floor(spot.y))))abandonSpot();
    if(spot){
      const shelter=this.cardboardShelters.get(c.cardboardShelterKey);
      if(!shelter||shelter.citizenId!==c.id){const x=Math.floor(spot.x),y=Math.floor(spot.y),shelterKey=`${x},${y}`;this.cardboardShelters.set(shelterKey,{citizenId:c.id,x:x+.5,y:y+.5,placedAt:this.minute});c.cardboardShelterKey=shelterKey;c.homelessSleepSpot={x:x+.5,y:y+.5};c.inventory.papelao=Math.max(0,c.inventory.papelao-1);this.cardboardRevision++;}
      if(Math.hypot(c.entity.x-spot.x,c.entity.y-spot.y)<=.25&&!c.path.length){c.action='Dormindo na rua';return true;}
      if(!c.path.length){const path=this.findPath(c.entity,spot);if(path===null)abandonSpot();else{c.path=path;if(!path.length||Math.hypot(path.at(-1).x-spot.x,path.at(-1).y-spot.y)>.05)c.path.push({...spot});}}
      if(spot){c.action='Procurando um lugar tranquilo para dormir';return false;}
    }
    const width=this.world.width,height=this.world.height,structure=this.structureRevision||0;
    let safety=this._sleepRouteSafety;
    const plotCount=this.development?.plots.length||0;
    if(!safety||safety.structure!==structure||safety.plotCount!==plotCount||safety.width!==width||safety.height!==height){
      const clear=new Uint8Array(width*height),blocked=new Uint8Array(width*height);
      for(const b of this.buildings){if(b.entity.destroyed)continue;for(let y=b.entity.y;y<b.entity.y+b.depth;y++)for(let x=b.entity.x;x<b.entity.x+b.width;x++)if(x>=0&&y>=0&&x<width&&y<height)blocked[y*width+x]=1;}
      for(const p of this.development?.plots||[])for(let y=p.y;y<p.y+p.depth;y++)for(let x=p.x;x<p.x+p.width;x++)if(x>=0&&y>=0&&x<width&&y<height)blocked[y*width+x]=1;
      for(const b of this.buildings){if(b.entity.destroyed)continue;const cx=Math.floor(b.door.x),cy=Math.floor(b.door.y);
        for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){const x=cx+dx,y=cy+dy;if(x>=0&&y>=0&&x<width&&y<height){const ddx=x+.5-b.door.x,ddy=y+.5-b.door.y;if(ddx*ddx+ddy*ddy<16)clear[y*width+x]=1;}}}
      safety=this._sleepRouteSafety={structure,plotCount,width,height,clear,blocked};
    }
    let routing=this._sleepRouteOccupancy;
    if(!routing||routing.minute!==this.minute){
      const occupied=new Set();
      for(const person of this.citizens){if(person===c||person.entity.destroyed)continue;
        if(person.homelessSleepSpot)occupied.add(`${Math.floor(person.homelessSleepSpot.x)},${Math.floor(person.homelessSleepSpot.y)}`);
        if(!person.indoorLocation&&!person.path.length)occupied.add(`${Math.floor(person.entity.x)},${Math.floor(person.entity.y)}`);
        const destination=person.path?.at(-1);if(destination)occupied.add(`${Math.floor(destination.x)},${Math.floor(destination.y)}`);
      }
      routing=this._sleepRouteOccupancy={minute:this.minute,occupied};
    }
    const blocked=routing.occupied,startX=Math.floor(c.entity.x),startY=Math.floor(c.entity.y),ownKey=`${startX},${startY}`;
    // Visit nearby rings in distance order. Sorting each small ring avoids
    // allocating and sorting hundreds of candidates for every homeless person.
    for(let radius=3;radius<=12;radius++){
      const candidates=[];
      for(let dx=-radius;dx<=radius;dx++){const dy=radius-Math.abs(dx);for(const sy of (dy?[1,-1]:[1])){
        const x=startX+dx,y=startY+dy*sy,key=`${x},${y}`;if((key!==ownKey&&blocked.has(key))||x<0||y<0||x>=width||y>=height||safety.clear[y*width+x]||safety.blocked[y*width+x]||this.cardboardShelters.has(key)||hasTreeAt(x,y)||ROAD_TILES.has(tileAt(this.world,x,y))||!this.walkable(x,y))continue;
        const px=x+.5,py=y+.5;candidates.push({x:px,y:py,key,score:Math.hypot(px-c.entity.x,py-c.entity.y)+(Math.imul(c.id+17,1103515245)>>>0)%997/10000});
      }}
      candidates.sort((a,b)=>a.score-b.score);
      for(const candidate of candidates){const path=this.findPath(c.entity,candidate);if(path===null)continue;
        c.homelessSleepSpot={x:candidate.x,y:candidate.y};c.cardboardShelterKey=candidate.key;this.cardboardShelters.set(candidate.key,{citizenId:c.id,x:candidate.x,y:candidate.y,placedAt:this.minute});c.inventory.papelao=Math.max(0,c.inventory.papelao-1);this.cardboardRevision++;c.path=path;
        if(!path.length||Math.hypot(path.at(-1).x-candidate.x,path.at(-1).y-candidate.y)>.05)c.path.push({x:candidate.x,y:candidate.y});
        blocked.add(candidate.key);c.action='Procurando um lugar tranquilo para dormir';return false;
      }
    }
    // The safe fallback is to rest where the person is, never to send them to
    // the town hall and turn its entrance into a makeshift dormitory.
    if(!safety.blocked[startY*width+startX]&&!safety.clear[startY*width+startX]&&!this.cardboardShelters.has(ownKey)&&!hasTreeAt(startX,startY)&&!ROAD_TILES.has(tileAt(this.world,startX,startY))&&this.walkable(startX,startY)){c.homelessSleepSpot={x:startX+.5,y:startY+.5};c.cardboardShelterKey=ownKey;this.cardboardShelters.set(ownKey,{citizenId:c.id,x:startX+.5,y:startY+.5,placedAt:this.minute});c.inventory.papelao=Math.max(0,c.inventory.papelao-1);this.cardboardRevision++;}
    blocked.add(ownKey);c.path=[];c.action='Dormindo na rua';return true;
  }

  chooseTask(c, urgent=this.urgentNeed(c)) {
    const n = c.needs,profile=this._citizenLoopProfile,measure=profile&&((name,work)=>{const started=performance.now(),result=work();profile[`${name}Ms`]=(profile[`${name}Ms`]||0)+performance.now()-started;return result;});
    const home = this.building(this.units.get(c.homeUnitId)?.buildingId);
    const job = this.building(c.jobId);
    const companies=c.role==='councilor'||!c.businessIds.length?NO_CHILDREN:c.businessIds.map(id=>this.building(id)).filter(b=>b?.active).sort((a,b)=>Number(b.type==='farm')-Number(a.type==='farm'));
    const company=companies[Math.floor(this.minute/120)%Math.max(1,c.businessIds.length)]||companies[0]||null;
    const child = this.childrenOf(c.id).find(child => this.society.age(child) < 6 && Math.min(child.needs.food, child.needs.water, child.needs.hygiene, child.needs.social) < 45);
    let task = 'leisure', type = 'leisure';
    if(!urgent||['food','water'].includes(urgent)){const routed=measure?measure('taskSuppliesRoute',()=>this.supplies.route(c)):this.supplies.route(c);if(routed)return;}
    const streetStall=measure?measure('taskMarketCheck',()=>streetMarketFor(this.economy,c)):streetMarketFor(this.economy,c);
    if(!urgent&&!wantsSleep(this,c)&&streetStall&&this.society.isAdult(c)&&Math.min(n.food,n.water,n.energy,n.health,n.toilet)>25&&!c.conversation&&!c.deliveryId&&!c.workMeal){
      const path=this.findPath(c.entity,streetStall.position);
      if(path!==null){c.path=path;if(!path.length||Math.hypot(path.at(-1).x-streetStall.position.x,path.at(-1).y-streetStall.position.y)>.05)c.path.push({...streetStall.position});c.targetId=null;c.task='market-vending';c.action='Indo anunciar produtos na feira';return;}
    }
    // A homeless person who is already exhausted should not have to cross the
    // city and compete for a public indoor room before recovering at all.
    if(urgent==='energy'&&!home){this.routeHomelessToSleep(c);return;}
    if (urgent) { task = urgent; type = ({ water: 'utility', food: 'market', health: 'clinic', energy: 'home', hygiene: home ? 'home' : 'utility', toilet: 'toilet' })[urgent]; }
    else if (child && this.society.isAdult(c) && Math.min(n.food, n.water, n.energy, n.hygiene) >= 25 && n.health >= 40 && n.toilet >= 15) { task = 'caregiving'; type = 'child'; c.careChildId = child.id; }
    else if (n.food < 18) { task = 'food'; type = 'market'; }
    else if (n.health < 45) { task = 'health'; type = 'clinic'; }
    else if (n.water < 45) { task = 'water'; type = 'utility'; }
    else if (n.food < 72 && !this.welfare.mealAssistanceEligible(c)) { task = 'food'; type = 'market'; }
    else if (n.food < 45) { task = 'food'; type = 'market'; }
    else if (n.toilet < 45) { task = 'toilet'; type = 'toilet'; }
    else if (this.substances?.consider(c))return;
    else if (wantsSleep(this,c)) { task = 'energy'; type = 'home'; }
    else if (n.hygiene < 35) { task = 'hygiene'; type = home ? 'home' : 'utility'; }
    else if(c.secretaryOffice==='labor'&&this.hour>=8&&this.hour<17){task='work';type='job';}
    else if (this.society.age(c) < 6) { task = 'care'; type = 'home'; }
    else if (child && this.society.isAdult(c)) { task = 'caregiving'; type = 'child'; c.careChildId = child.id; }
    else if (c.role!=='councilor' && c.startupProjectId && this.hour >= 8 && this.hour < 17 && this.development.projects.some(p=>p.id===c.startupProjectId && !p.builderId && !p.cancelled && p.status!=='completed' && p.inventory.pedra>=p.stone)) { task='work';type='startup'; }
    else if (company && this.hour >= 8 && this.hour < 17) { task = 'manage'; type = 'company'; }
    else if (job && c.role!=='councilor' && this.hour >= 8 && this.hour < 17) { task = 'work'; type = 'job'; }
    else if (this.substances?.routeBar(c))return;
    else if (n.social < 60) { task = 'social'; type = 'leisure'; }
    if(task==='energy'&&!home){this.routeHomelessToSleep(c);return;}
    if (this.society.age(c) < 6 && !urgent) { task = 'care'; type = 'home'; }
    const joblessDuringShift=this.society.isAdult(c)&&!c.jobId&&!c.businessIds.length&&this.hour>=8&&this.hour<17;
    if(!urgent&&!joblessDuringShift&&(task==='leisure'||task==='social'&&n.social>=35)&&n.leisure<95&&this.hour>=6&&this.hour<22){
      const employer=job||company,workplace=employer?.officeTenantOf?this.building(employer.officeTenantOf):employer,dwelling=this.housing.home(c),sites=[...(home?[{site:home,access:'home'}]:[]),...(workplace&&workplace!==home?[{site:workplace,access:'work'}]:[])];
      const seatIndex=outdoorLeisureSeats(this);
      for(const {site,access} of sites){const spaces=buildingLeisureSpaces(site).filter(s=>s.kind==='roof_terrace'||(access==='home'?dwelling?.unitIds.includes(s.unitId):!employer?.officeTenantOf||s.floor===employer.officeFloor));
       for(const space of spaces){const bySlot=seatIndex.get(`${site.id}:${space.id}`);let slot=null;for(let i=0;i<space.capacity;i++){let occupied=false;for(const other of bySlot?.get(i)||[])if(other!==c&&other.task==='outdoor_leisure'&&other.outdoorLeisure?.buildingId===site.id&&other.outdoorLeisure?.spaceId===space.id&&other.outdoorLeisure?.slot===i){occupied=true;break;}if(!occupied){slot=i;break;}}if(slot==null)continue;const path=this.findPath(c.entity,site.door);if(path===null)continue;
        const offsets=space.kind==='roof_terrace'?[[0,0],[.35,0],[-.35,0],[0,.35]]:[[0,0]],offset=offsets[slot]||offsets[0];c.outdoorLeisure={buildingId:site.id,jobId:access==='work'?employer.id:null,access,unitId:space.unitId,spaceId:space.id,kind:space.kind,slot,position:{...space.position,x:space.position.x+offset[0],y:space.position.y+offset[1]},until:null};c.task='outdoor_leisure';reserveOutdoorLeisureSeat(seatIndex,c.outdoorLeisure,c);c.targetId=site.id;c.path=path;c.action=space.kind==='balcony'?'Indo descansar na varanda':'Indo descansar na cobertura';return;
       }
      }
    }
    if(task==='leisure'&&!urgent&&joblessDuringShift&&(measure?measure('taskEmploymentSearch',()=>searchEmployment(this,c)):searchEmployment(this,c)))return;
    if(!urgent&&Math.min(n.food,n.water,n.energy,n.toilet,n.health)>=45&&this.hour>=6&&this.hour<22&&(measure?measure('taskPaintingRoute',()=>this.paint.route(c)):this.paint.route(c)))return;
    if(task==='social'&&(measure?measure('taskSocialSearch',()=>this.relationships.seekContact(c)):this.relationships.seekContact(c)))return;
    if(task==='leisure'&&!urgent&&(measure?measure('taskFurnitureRoute',()=>this.furniture.routeLeisure(c)):this.furniture.routeLeisure(c)))return;
    if(task==='hygiene'&&(measure?measure('taskHygieneSearch',()=>this.sanitation.choose(c,'hygiene')):this.sanitation.choose(c,'hygiene')))return;
    if (task === 'toilet') {
      // Optional toilet visits used to route nearly everyone who crossed the
      // same need threshold during one hourly decision pass. Phase those
      // searches over the existing short retry window; urgent needs bypass it.
      if(!urgent){c._toiletRouteAfter??=this.minute+c.id%SIMULATION_LOD.unstableDecisionMinutes;if(this.minute<c._toiletRouteAfter)return;}
      if (measure?measure('taskToiletSearch',()=>this.sanitation.choose(c)):this.sanitation.choose(c)) { c.toiletWaitingSince=null; return; }
      c.toiletWaitingSince??=this.minute;
      // A full or inaccessible bathroom must not trap a person indefinitely.
      // Emergency relief has real hygiene and mood costs; it is not a service.
      if(n.toilet<10 && this.minute-c.toiletWaitingSince>=30){
        this.sanitation.emergencyRelief(c);
      }else { c.task = null; c.action = 'Aguardando banheiro acessível'; }
      return;
    }
    c.toiletWaitingSince=null;
    if (task === 'food' && (measure?measure('taskMealSearch',()=>this.workMeals.routeToMeal(c)):this.workMeals.routeToMeal(c))) return;
    if (task === 'food' && c.provisions > 0) {
      if(!home || n.food<25){c.task='provisions';c.path=[];c.targetId=null;return;}
      task = 'provisions'; type = 'home';
    }
    if(!urgent && this.society.isAdult(c) && !['work','manage','care','caregiving','food','provisions','toilet'].includes(task) && this.hour>=6 && this.hour<22 && this.minute-(c.lastShoppingAt||0)>180 && this.minute-(c.lastShoppingSearchAt??-Infinity)>=30) {
      c.lastShoppingSearchAt=this.minute;
      const shops=this.economy.businesses.filter(b=>this.economy.consumerOffer(c,b)).map((b,index)=>({b,target:b.door,index,score:Math.hypot(b.door.x-c.entity.x,b.door.y-c.entity.y)+this.relationships.businessPenalty(c,b)-((c.knownAdvertisements?.[b.id]||0)>this.minute?2:0)}));
      for(const row of this.economy.streetMarketVendors())if(this.economy.streetMarketConsumerOffer(c,row.vendor)){const {business,vendor}=row;shops.push({b:business,target:vendor.position,vendor,index:shops.length,score:Math.hypot(vendor.position.x-c.entity.x,vendor.position.y-c.entity.y)+this.relationships.businessPenalty(c,business)-((c.knownAdvertisements?.[business.id]||0)>this.minute?2:0)});}
      shops.sort((a,b)=>a.score-b.score||a.index-b.index);
      for(const option of shops) {const path=this.findPath(c.entity,option.target);if(path!==null){c.path=path;c.targetId=option.b.id;if(option.vendor){c.streetMarketTarget={marketId:option.vendor.marketId,businessId:option.b.id};c.task='street-market-shopping';}else{c.streetMarketTarget=null;c.task='shopping';}return;}}
    }
    // Citizens with no pressing need or appointment should not flood the town
    // hall for leisure they have already satisfied. Take a short walk instead.
    if(task==='leisure' && !urgent && n.leisure>=75 && this.hour>=6 && this.hour<22 && this.society.isAdult(c)) {
      const origin=c.entity, offsets=[[3,0],[0,3],[-3,0],[0,-3],[3,3],[-3,3],[-3,-3],[3,-3]];
      const first=(c.id+Math.floor(this.minute/30))%offsets.length;
      for(let i=0;i<offsets.length;i++){
        const [dx,dy]=offsets[(first+i)%offsets.length],destination={x:Math.floor(origin.x)+dx+.5,y:Math.floor(origin.y)+dy+.5};
        if(!this.walkable(Math.floor(destination.x),Math.floor(destination.y)))continue;
        const path=this.findPath(origin,destination);if(path?.length){c.task='walk';c.targetId=null;c.path=path;c.action='Passeando pela cidade';return;}
      }
    }
    const childHome = child ? this.building(this.units.get(child.homeUnitId)?.buildingId) : null;
    const siteProject = this.development.projectFor(c, type === 'job' ? job : type === 'company' ? company : null);
    if (!urgent && siteProject && ['work', 'manage', 'leisure'].includes(task) && this.hour >= 8 && this.hour < 17) {
      const path = this.findPath(c.entity, siteProject.door);
      if (path !== null) { this.development.reserveConstruction(siteProject); c.path = path; c.task = 'construction'; c.workProjectId = siteProject.id; c.targetId = siteProject.builderId; return; }
    }
    const hall = this.buildings.find(b => b.type === 'townhall' && !b.entity.destroyed);
    // Familiar services remain the default while viable; compare the wider
    // market again after six hours, or immediately when the usual place fails.
    const habit=c.routineServices?.[task],usual=habit&&this.building(habit.buildingId);
    if(!urgent&&habit&&this.minute<habit.reviewAt&&usual&&!usual.entity.destroyed&&usual.active&&['food','water','health','leisure','social'].includes(task)){
      const available=task==='food'?Number.isFinite(this.economy.mealScore(c,usual)):!civicSpec(usual)||civicStatus(this,usual,c)?.ready;
      if(available){const path=this.findPath(c.entity,usual.door);if(path!==null){c.path=path;c.targetId=usual.id;c.task=task;if(task==='food')this.workMeals.issueVoucher(c,usual);return;}}
      delete c.routineServices[task];
    }
    if(task==='food'&&this.hour>=8&&this.hour<17){
      const vendorRows=this.economy.streetMarketVendors().map(row=>({row,score:this.economy.streetMarketMealScore(c,row)})).filter(row=>Number.isFinite(row.score)).sort((a,b)=>a.score-b.score);
      const shopScore=Math.min(Infinity,...this.buildings.filter(b=>b.type!=='townhall').map(b=>this.economy.mealScore(c,b)));
      if(vendorRows.length&&vendorRows[0].score<shopScore){const {site,vendor}=vendorRows[0].row,path=this.findPath(c.entity,vendor.position);if(path!==null){c.path=path;c.targetId=vendor.businessId;c.streetMarketTarget={marketId:site.id,businessId:vendor.businessId};c.task='street-market-food';return;}}
    }
    const candidates = (type === 'company' ? [company] : task === 'food' ? this.buildings.filter(b=>b.type!=='townhall') : type === 'child' ? (childHome ? [childHome] : home ? [home] : []) : type === 'home' ? (home ? [home] : []) : type === 'job' ? [job] : this.buildings.filter(b => !b.entity.destroyed && (b.type === type||['clinic','leisure'].includes(type)&&civicSpec(b)?.need===(type==='clinic'?'health':'leisure')))).filter(b=>b?.door&&Number.isFinite(b.door.x)&&Number.isFinite(b.door.y));
    if (hall && ((type === 'home' && !home) || ['utility', 'clinic', 'leisure'].includes(type))) { const serviceCost = this.currency.price({ utility: 35, clinic: 240, leisure: 25 }[type] || 0); const cash = this.accounts.get(this.payerFor(c))?.balance || 0; if (!candidates.includes(hall)) candidates.push(hall); if(cash<serviceCost&&!candidates.some(b=>civicSpec(b)&&!b.ownerId&&civicStatus(this,b,c)?.ready))candidates.splice(0,candidates.length,hall); }
    const foodScores=task==='food'?(measure?measure('taskMealScoring',()=>new Map(candidates.map(b=>[b,this.economy.mealScore(c,b)]))):new Map(candidates.map(b=>[b,this.economy.mealScore(c,b)]))):null;
    candidates.sort((a, b) => foodScores ? foodScores.get(a)-foodScores.get(b) : Math.hypot(a.door.x-c.entity.x,a.door.y-c.entity.y)-Math.hypot(b.door.x-c.entity.x,b.door.y-c.entity.y));
    for (const b of candidates) {
      if (foodScores && !Number.isFinite(foodScores.get(b))) continue;
      if(['health','leisure','social'].includes(task)&&civicSpec(b)&&!civicStatus(this,b,c)?.ready)continue;
      const path = this.findPath(c.entity, b.door);
      if (path !== null) {
        c.path = path; c.targetId = b.id; c.task = task; if(['food','water','health','leisure','social'].includes(task)){c.routineServices??={};c.routineServices[task]={buildingId:b.id,reviewAt:this.minute+(this.fastForward?(this.fastForward2?960+c.id%481:480+c.id%241):360+c.id%60)};} if (task === 'food') this.workMeals.issueVoucher(c, b); return;
      }
    }
    c.task = task==='energy'&&!home?'energy':null; c.targetId = null; c.action = task==='energy'&&!home?'Dormindo na rua':task === 'food' ? 'Alimentos indisponíveis nas lojas locais' : home ? 'Sem acesso ao serviço' : 'Sem moradia';
    if (task === 'food' && (!c.foodShortageAt || this.minute - c.foodShortageAt >= 60)) { c.foodShortageAt = this.minute; this.economy.failedMeals++; this.log(`${c.entity.properties.name} não encontrou alimentos à venda.`, 'production', [c.id], { kind: 'food-shortage' }); }
    if (task === 'energy'&&home) n.energy = clamp(n.energy + 0.1);
  }
  performTask(c) {
    if(c.task==='work-wait'){if(!c.seatId&&!syncCitizenInterior(this,c))return;this.furniture.advanceWait(c);return;}
    if(c.task==='market-vending'){const stall=streetMarketFor(this.economy,c);if(!stall){c.marketStall=null;c.task=null;c.targetId=null;c.path=[];c.action='Encerrando o mercado de rua';return;}if(this.urgentNeed(c)){c.task=null;c.targetId=null;c.path=[];return;}c.action=`Vendendo ${this.building(stall.businessId)?.entity.properties.name||'produtos'} na feira`;this.economy.practice(c,'commerce',1);return;}
    if(c.task==='sit'){if(c.path.length)return;c.needs.leisure=clamp(c.needs.leisure+.7);c.action='Descansando sentado no banco';if(this.minute>=c.sitUntil||this.urgentNeed(c)){this.furniture.release(c);c.task=null;}return;}
    if(c.task==='beach_leisure'){
      const setup=c.beachLeisure;if(!setup){c.task=null;return;}
      if(c.path.length){c.action='Indo montar as coisas na praia';return;}
      c.needs.leisure=clamp(c.needs.leisure+.9);c.mood=Math.min(25,(c.mood||0)+.02);c.action='Descansando na praia';
      if(c.needs.leisure>=95||this.minute>=setup.until||this.urgentNeed(c)){c.task=null;c.beachLeisure=null;c.seated=false;c.furnitureUse=null;c.path=[];c.action='Recolhendo as coisas da praia';}return;
    }
    if(c.task==='lake-water'){this.supplies.collectLake(c);return;}
    if(!syncCitizenInterior(this,c))return;
    if(this.substances?.perform(c))return;
    if(c.task==='job-interview'){c.action='Na entrevista da Secretaria do Trabalho';return;}
    if(c.task==='justice-report'){this.justice.arriveToReport(c);return;}
    if(c.task==='supplies'){this.supplies.arrive(c);return;}
    if(c.task==='council-session'){this.politics.council.getChamber().arrive(c);return;}
    if(['paint-purchase','paint-delivery'].includes(c.task)){this.paint.arrive(c);return;}
    if(c.task==='research'){this.politics.getResearch().fieldWork(c);return;}
    if(c.task==='interview'){this.politics.getResearch().respondentWait(c);return;}
    if(c.task==='campaign-media'){c.action='Participando presencialmente de debate ou entrevista no jornal';return;}
    if(c.task==='vote'){this.politics.voting.arrive(c);return;}
    if(c.task==='campaign'){this.politics.campaigns.arrive(c);return;}
    if(c.task==='visit'){this.relationships.arrive(c);return;}
    if (c.task === 'toilet') { this.sanitation.use(c); c._toiletRouteAfter=null; return; }
    if (c.task === 'workmeal') { if (!this.workMeals.tryStart(c)) {c.task = null;c.mealResume=null;} return; }
    if(c.task==='outdoor_leisure'){
      const visit=c.outdoorLeisure,location=c.indoorLocation;visit.until??=this.minute+45;
      c.needs.leisure=clamp(c.needs.leisure+1.2);c.mood=Math.min(25,(c.mood||0)+.02);
      c.action=visit.kind==='balcony'?'Descansando na varanda':'Descansando na cobertura';
      if(visit.kind==='roof_terrace'&&location?.roomType==='roof_terrace'&&!location.path.length&&this.minute>=(visit.nextStroll??this.minute+2)){
        const b=this.building(visit.buildingId);if(b){const margin=.5,spanX=Math.max(0,b.width-2*margin),spanY=Math.max(0,b.depth-2*margin),turn=visit.strollCount||0,slot=visit.slot||0;visit.strollCount=turn+1;
          const points=[[.2,.2],[.8,.2],[.8,.8],[.2,.8]],q=points[(turn+slot)%points.length];location.path=[{x:b.entity.x+margin+spanX*q[0],y:b.entity.y+margin+spanY*q[1],z:location.position.z}];visit.nextStroll=this.minute+4;c.action='Passeando na cobertura';}
      }else if(visit.kind==='roof_terrace'&&visit.nextStroll==null)visit.nextStroll=this.minute+2;
      if(c.needs.leisure>=95||this.minute>=visit.until){c.task=null;c.outdoorLeisure=null;}return;
    }
    if (c.task === 'construction') {
      const project = this.development.projects.find(p => p.id === c.workProjectId);
      const builder = this.building(project?.builderId);
      if (!project || project.status === 'completed' || project.cancelled || this.hour < 8 || this.hour >= 17) { c.task = null; return; }
      if (builder && builder.ownerId !== c.id && (c.jobId !== builder.id || builder.balance < builder.wage)) { c.task = null; return; }
      if (this.development.work(project, c)) {
        if (builder && builder.ownerId !== c.id) this.payWage(c,builder,builder.wage);
        c.action = ['road', 'road-repair'].includes(project.service) ? 'Construindo ou reparando estrada' : project.service === 'lamp' ? 'Instalando poste' : project.service === 'expansion' ? 'Ampliando edifício' : `Construindo no terreno ${project.plotId}`;
      } else { c.action = 'Aguardando materiais da obra';if(builder)this.furniture.waitForInputs(c,builder,'Aguardando materiais da obra');else c.task=null; }
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
    if(c.task==='energy'&&c.targetId==null&&!c.homeUnitId){
      if(c.path.length)return;
      if(!c.homelessSleepSpot){this.routeHomelessToSleep(c);if(c.path.length)return;}
      if(c.homelessSleepSpot&&Math.hypot(c.entity.x-c.homelessSleepSpot.x,c.entity.y-c.homelessSleepSpot.y)>.3){this.routeHomelessToSleep(c);return;}
      sleepMinute(this,c,{street:true});
      return;
    }
    if(c.task==='street-market-food'||c.task==='street-market-shopping'){
      const marketId=c.streetMarketTarget?.marketId,businessId=c.streetMarketTarget?.businessId,site=(this.economy.streetMarkets||[]).find(item=>item.id===marketId),vendor=site?.vendors?.find(item=>item.businessId===businessId),business=this.building(businessId);
      if(site&&vendor&&business){if(c.task==='street-market-food')this.economy.consumeStreetMarketMeal(c,{site,vendor});else this.economy.buyConsumerGood(c,business,vendor);c.lastShoppingAt=this.minute;c.action='Comprando na feira de rua';}
      c.streetMarketTarget=null;c.task=null;c.targetId=null;return;
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
      if(b.constructionKind==='open-air'&&!['farm','quarry','iron_mine','bauxite_mine','forestry'].includes(b.type)){const cells=b.units.filter(u=>!['bathroom','dining'].includes(u.roomType)),cell=cells[c.id%Math.max(1,cells.length)];if(cell&&!outdoorCellReady(this,c,b,cell))return;}
      const recipe=INDUSTRIES[b.type],dynamicRecipe=['artisan','composting','flagmaker','newsroom','publisher','tobacco_workshop','toolmaker'].includes(b.type)?null:recipe;
      const recipeGoods=dynamicRecipe?[...Object.keys(dynamicRecipe.inputs||{}),...Object.keys(dynamicRecipe.outputs||{})]:[];
      const productionSignature=dynamicRecipe?`${b.id}:${b.active}:${b.inventoryCapacity}:${inventoryFree(b)}:${recipeGoods.sort().map(g=>`${g}:${b.inventory[g]||0}:${b.incoming[g]||0}`).join('|')}`:null;
      const productionBlocked=!!dynamicRecipe&&(
        Object.entries(dynamicRecipe.inputs||{}).some(([good,amount])=>(b.inventory[good]||0)<amount)||
        inventoryFree(b)<Math.max(0,Object.values(dynamicRecipe.outputs||{}).reduce((sum,n)=>sum+n,0)-Object.values(dynamicRecipe.inputs||{}).reduce((sum,n)=>sum+n,0))||
        Object.keys(dynamicRecipe.outputs||{}).some(g=>(b.inventory[g]||0)>=48)
      );
      const wait=ff2ProductionWaits.get(c),canSkip=this.fastForward2&&productionBlocked&&wait?.buildingId===b.id&&wait.signature===productionSignature&&this.minute<wait.until;
      const productive=canSkip?false:this.economy.productionWork(b,c);
      if(!canSkip&&this.fastForward2&&!productive&&productionBlocked)ff2ProductionWaits.set(c,{buildingId:b.id,signature:productionSignature,until:this.minute+8});else if(!canSkip)ff2ProductionWaits.delete(c);
      const present=!!(c.indoorLocation?.buildingId===b.id&&c.indoorLocation.unitId&&!c.indoorLocation.path?.length)||
        !!(c.workCell?.buildingId===b.id&&c.workCell.target&&!c.path.length&&Math.hypot(c.entity.x-c.workCell.target.x,c.entity.y-c.workCell.target.y)<.2);
      // Waiting for ingredients or a customer is still paid time at the assigned workplace.
      if(productive||present){if(!isOwner)this.payWage(c,b,wage);if(productive||present&&c.id===this.economy.mayorId&&b.type==='townhall')this.economy.practice(c,JOB_SKILL[b.type]);}
      if (isOwner) this.economy.practice(c, 'management');
      // Moving to another workspace is not a material shortage. Preserve the
      // route instead of replacing it with a trip to the waiting area.
      if(!productive&&(c.path.length||c.indoorLocation?.path?.length||c.indoorLocation?.exiting))return;
      if(!productive&&b.type!=='farm'&&b.type!=='forestry'&&Math.min(n.food,n.water,n.energy,n.toilet,n.hygiene,n.health)>30){this.furniture.waitForInputs(c,b,'Aguardando matéria-prima ou serviço');return;}
      if(b.type==='forestry'&&productive){if(Math.min(n.food,n.water,n.energy,n.toilet,n.hygiene,n.health)<22){c.task=null;c.path=[];}return;}
      c.action = b.type==='boat_workshop'&&c.mechanicJob?'Reparando embarcação atracada na oficina':b.type==='cycle_workshop'&&c.mechanicJob?'Reparando veículo no local com peças transportadas':c.id === this.economy.mayorId ? 'Administrando a prefeitura' : isOwner ? `Trabalhando na própria empresa sem salário · ${b.entity.properties.name}` : productive ? `Trabalhando: ${JOB_SKILL[b.type]}` : b.type === 'farm' ? 'Aguardando crescimento da plantação' : 'Aguardando matéria-prima';
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
      if (task === 'food' ? !this.economy.consumeMeal(c, b) : !this.transfer(this.payerFor(c), b.accountId, b.type === 'townhall' ? 0 : price, `Serviço: ${NEED_LABELS[task] || task}`)) { c.action = 'Sem dinheiro para o serviço'; if(c.routineServices)delete c.routineServices[task]; c.task = null; return; }
      c.servicePaid = `${b.id}:${task}`;
    }
    if(task==='energy'){sleepMinute(this,c,{street:!c.homeUnitId});return;}
    const rate=SERVICE_RATES[task];
    if (rate===undefined) { this.life.resetTask(c, 'serviço indisponível'); return; }
    n[task] = clamp(n[task] + rate);
    if(task==='hygiene'&&n.hygiene>=95){const facility=this.sanitation.facilities.get(c.hygieneTargetId);if(facility&&c.trespassHygieneFacilityId===facility.id){const building=this.building(facility.buildingId);if(building)this.justice.recordTrespassUse(c,building,facility,'unauthorized-hygiene-use');}c.trespassHygieneFacilityId=null;c.hygieneWaitingSince=null;}
    if(b.type==='townhall'&&task==='health'&&n.health>=65){n.health=65;c.task=null;c.servicePaid=null;return;}
    c.action = SERVICE_ACTIONS[task];
    if (task === 'social') { n.social = clamp(n.social - rate); c.socialWaitStarted ??= this.minute; if (this.minute - c.socialWaitStarted >= 30) { c.task = null; c.socialWaitStarted = null; n.leisure = clamp(n.leisure + 3); } }
    if (task === 'food' && n.food >= 95) c.foodVoucher = null;
    if (n[task] >= 95 || (task === 'energy' && this.hour >= 7 && this.hour < 22 && n.energy > 65)) { c.task = null; c.servicePaid = null; }
  }
  payWage(c, b, wage = b.wage + this.currency.price(Math.floor((c.skills[JOB_SKILL[b.type]] || 0) / 30))) {
    if(c.id===this.economy.mayorId)return true; // Mayor receives only the voted daily salary.
    if (!Number.isSafeInteger(wage) || wage < 0) return false;
    if(b.balance<wage)this.fiscal?.coverMunicipalPayroll(b,wage);
    if (b.balance < wage) {
      recordWork(this,c,b,wage,false);
      if(c.unpaidWageDay!==this.day){c.unpaidWageDay=this.day;this.reputation.observe(b.accountId,'commerce',-1,'falta de caixa para o salário',{citizenIds:[c.id]});this.relationships.workEvent(b,c,false);}
      if(this.fiscal?.municipal(b)&&b.fiscalArrearsDay!==this.day){b.fiscalArrearsDay=this.day;this.log(`Falta de caixa: ${b.entity.properties.name} atrasou salários e reduziu o atendimento de ${b.type.replaceAll('_',' ')}.`, 'government',[c.id],{kind:'fiscal-service-disruption',buildingId:b.id,accounts:[b.accountId,'treasury'],amount:wage});}
      return false;
    }
    const rate=Math.max(MINIMUM_WAGE_TAX_RATE,Math.min(.5,Number(this.taxRate)||0));
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
    collectOfficeRents(this);
    collectEconomicTaxes(this);
    for (const c of this.citizens) {
      if (c.entity.destroyed) continue;
      const walkingTime=c.mobilityTimeLostToday||0;c.mobilityNeed=Math.min(100,(c.mobilityNeed||0)*.72+Math.min(52,walkingTime*1.2)*(c.mobilityPriority||1));c.mobilityTimeLostToday=0;
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
      if(b.officeTenantOf){const tower=this.building(b.officeTenantOf),lease=tower?.officeLeases?.find(l=>l.buildingId===b.id&&l.status==='active');if(lease)endOfficeLease(this,tower,lease,'Empresa encerrada');for(const u of b.units)this.units.delete(u.id);this.buildings.splice(this.buildings.indexOf(b),1);this.buildingsById.delete(b.id);this.structureRevision++;continue;}
      if(b.type==='office_tower')for(const lease of b.officeLeases||[])endOfficeLease(this,b,lease,'Empresarial demolido');
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
      if(!liquidateShareCash(this,b))this.transfer(b.accountId, this.economy.citizen(b.ownerId)?.accountId || 'treasury', b.balance, 'Encerramento de prédio');
      const lot=this.development.plots.find(p=>p.id===b.plotId);if(lot?.ownerId===b.accountId){lot.ownerId=this.economy.citizen(b.ownerId)?.accountId||'treasury';lot.buildingId=null;lot.forSale=true;}
      const owner = this.economy.citizen(b.ownerId); if (owner) owner.businessIds = owner.businessIds.filter(id => id !== b.id);
      this.log(`${b.entity.properties.name} foi demolido.`, 'city', [], { kind: 'demolition', buildingId: b.id });
      this.buildings.splice(this.buildings.indexOf(b), 1);
      this.buildingsById.delete(b.id);
      this.structureRevision++;
    }
    if(this.citizens.some(c=>c.entity.destroyed))for (const c of [...this.citizens]) if (c.entity.destroyed) {
      const party=this.politics.party(c.political?.partyId);if(party&&c.political?.partyCapId)returnPartyCap(this.politics,party,c);
      const heir = c.dead ? this.life.heir(c) : null;
      this.vehicles.removeCitizen(c,heir);
      inheritShares(this,c,heir);
      if (heir) for (const b of this.economy.businesses.filter(b => b.ownerId === c.id&&!b.equityShares?.length)) { this.history.ownership(b,c.accountId,heir.accountId,{action:'inheritance'}); b.ownerId = heir.id; if (!heir.businessIds.includes(b.id)) heir.businessIds.push(b.id); }
      this.economy.removeCitizen(c);
      this.society.removeCitizen(c);
      if (!c.dead) this.log(`${c.entity.properties.name} saiu da cidade.`, 'city', [c.id], { kind: 'departure' });
      this.releaseHome(c);
      for (const u of this.units.values()) if (u.ownerId === c.accountId) { const resident = this.accounts.get(u.tenantId); if (!heir && resident?.homeUnitId === u.id) this.releaseHome(resident); this.history.ownership(this.building(u.buildingId),c.accountId,heir?.accountId||'treasury',{unitId:u.id,action:'inheritance'}); u.ownerId = heir?.accountId || 'treasury'; u.forSale = true; u.forRent = !!heir; }
      this.economy.leaveJob(c, c.dead ? 'Falecimento' : 'Saída da cidade');
      this.bank.closeClient(c, heir);
      // Remaining personal/home inventories must leave an explicit estate.
      // Removing the citizen used to silently remove these goods from stock.
      for(const source of [c,c.substanceHomeStock].filter(Boolean))for(const [good,quantity]of Object.entries(source.inventory||{})){
        if(!(quantity>0)||!this.economy.goods[good])continue;
        const target=heir?(source===c?heir:this.substances.homeStock(heir)):this.buildings.find(b=>b.type==='townhall'&&!b.entity.destroyed);
        if(target){
          target.inventory??={};const moved=heir?quantity:Math.min(quantity,inventoryFree(target));
          if(moved>0){
            this.substances.moveLots(source,target,good,moved);this.paint.move(source,target,good,moved);this.vehicles.moveStock(source,target,good,moved);this.publications.moveStock(source,target,good,moved);if(good==='roupas')moveGarments(source,target,moved);
            target.inventory[good]=(target.inventory[good]||0)+moved;source.inventory[good]-=moved;
            this.economy.recordGoods('estate-stock',good,moved,c.id,heir?.id||target.id);
          }
        }
        const lost=source.inventory[good]||0;if(lost){this.economy.lost[good]+=lost;this.substances.takeLots(source,good,lost);this.vehicles.loseStock(source,good,lost);this.publications.loseStock(source,good,lost);source.inventory[good]=0;}
      }
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
    const profileStart=performance.now();let profileMark=profileStart;
    this._pathSearchProfile=this.profileDiagnostics?{minute:this.minute,searches:0,totalMs:0,maxMs:0,start:null,goal:null}:null;
    this.minute++;
    beginFastForwardMinute(this);
    if(this.fastForward)this.nature.updateGrowthMinute?.();
    this.indexFamilies();
    this.reconcile();
    const reconcileRevision = `${this.structureRevision}:${this.world.revision}:${this.development.projects.length}`;
    const reducedReconciliationDue=reducedCadence(this,this,'structure-reconciliation',15,30,reconcileRevision),reconciliationDue=this.fastForward?reducedReconciliationDue:this.minute%5===0;
    if (this.reconciledRevision !== reconcileRevision || reconciliationDue) {
      this.development.reconcile(); this.lighting.reconcile();
      this.housing.reconcile(); this.sanitation.reconcile();
      this.reconciledRevision = reconcileRevision;
    }
    const reconcileMs=performance.now()-profileMark;profileMark=performance.now();
    this.sanitation.updateMinute();
    for (const c of this.citizens)if(c.workMeal||(c.jobId||c.businessIds.length)&&c.needs.food<45)this.workMeals.tryStart(c);
    this.logistics.updateMinute();
    const servicesMs=performance.now()-profileMark;profileMark=performance.now();
    const civicDetail=this.profileDiagnostics?{}:null,measureCivic=(name,work)=>{if(!civicDetail){work();return;}const started=performance.now();work();civicDetail[`${name}Ms`]=performance.now()-started;};
    measureCivic('voting',()=>this.politics.voting.updateMinute());
    measureCivic('justice',()=>{this.justice.updateMinute();if(civicDetail)civicDetail.justiceParts=this.justice.lastMinuteProfile;});
    measureCivic('research',()=>this.politics.getResearch().updateMinute());
    measureCivic('council',()=>this.politics.council.getChamber().minute());
    measureCivic('campaignMaterials',()=>this.politics.campaigns.getMaterials().minute());
    measureCivic('vehicles',()=>this.vehicles.minute());
    const civicMs=performance.now()-profileMark;profileMark=performance.now();
    if (this.minute % 1440 === 0) { this.society.daily(); this.dailyEconomy(); }
    if (this.minute % 60 === 0) this.flushPayroll();
    const hasTownhall = this.buildings.some(b => b.type === 'townhall' && !b.entity.destroyed);
    for(const [key,shelter] of this.cardboardShelters){const owner=this.society.citizen(shelter.citizenId);if(!owner||owner.entity.destroyed||owner.homeUnitId){this.cardboardShelters.delete(key);this.cardboardRevision++;if(owner){owner.cardboardShelterKey=null;owner.homelessSleepSpot=null;if(!owner.entity.destroyed){owner.inventory??={};owner.inventory.papelao=1;}}}}
    const setupMs=performance.now()-profileMark;profileMark=performance.now();
    const citizenDetail=this.profileDiagnostics?{}:null,measureCitizen=(name,work)=>{if(!citizenDetail){work();return;}const started=performance.now();work();citizenDetail[`${name}Ms`]=(citizenDetail[`${name}Ms`]||0)+performance.now()-started;};
    this._citizenLoopProfile=citizenDetail;
    let citizenMs;
    const activitySearchPass=beginActivitySearch(this);
    try{
    for (const c of this.citizens) {
      if(deferFastForwardCitizen(this,c))continue;
      if(activitySearchPass.hasFull&&(c.custody||c.custodyEscort||c.custodyWaterDelivery||c.funeralBodyId||c.graffitiMission||c.policePatrol||c.policeResponse||c.policeInvestigation||c.policeOversight||c.policeAudit||c.policeRestitution||c.policeArrestEscort))invalidateActivitySearch(this);
      if(citizenDetail)measureCitizen('blockedPositionRecovery',()=>this.life.recoverBlockedPosition(c));else this.life.recoverBlockedPosition(c);
      const n = c.needs;
      // Idle adults cannot choose another activity until their short retry
      // window expires. Accumulate their passive need changes in one pass;
      // active workers, travelers, conversations and children still run each
      // minute. Reviews wake at hourly boundaries and on changed conditions.
      if(!c.entity.destroyed&&!c.substanceState?.effects?.length&&c.initialAge>=18&&!c.task&&!c.path.length&&!c.deliveryId&&!c.cleaningJobId&&!c.conversation&&!c.workMeal&&!c.mobilityTrip&&!c.ridingVehicleId&&!c.indoorLocation&&!this.childrenOf(c.id).length&&c._idleHomeId===c.homeUnitId&&this.minute<(c._nextTaskAt||0)&&this.minute%60!==0&&c._routineRevision===routineRevision(this,c)&&!this.urgentNeed(c)&&Math.min(n.food,n.water,n.energy,n.hygiene,n.toilet,n.health)>35)continue;
      const elapsed=Math.max(1,this.minute-(c._lastNeedsAt??this.minute-1));c._lastNeedsAt=this.minute;c._idleHomeId=c.homeUnitId;
      const age=this.society.age(c);
      if(c._renderAge!==age){c._renderAge=age;c.entity.properties.render.size=age<6?.55:age>=18?1:.8;}
      // These fixed fields are the hottest loop; direct access avoids temporary
      // iterators and dynamic property lookups for every resident and city minute.
      const sleeping=c.task==='energy'&&c.sleep?.active&&!c.path.length;const restMetabolism=sleeping?.4:1;
      n.food=clamp(n.food-.065*elapsed*restMetabolism);n.water=clamp(n.water-.09*elapsed*restMetabolism);n.energy=clamp(n.energy-.055*elapsed);
      this.substances?.minute(c,elapsed);if(c.sleep?.active&&c.task!=='energy')interruptSleep(this,c);
      n.hygiene=clamp(n.hygiene-.045*elapsed);n.toilet=clamp(n.toilet-(.085+(c.substanceModifiers?.toiletDrain||0))*elapsed*restMetabolism);n.energy=clamp(n.energy-(c.substanceModifiers?.energyDrain||0)*elapsed);n.social=clamp(n.social-.035*elapsed);n.leisure=clamp(n.leisure-.035*elapsed);
      n.shelter = clamp(n.shelter + (c.homeUnitId ? 0.5 : -0.2)*elapsed);
      n.safety = clamp(n.safety + (hasTownhall ? 0.08 : -0.1)*elapsed);
      n.health = clamp(n.health + (Math.min(n.food, n.water, n.energy, n.hygiene) < 10 ? -.12 : .025)*elapsed);
      c.mood = (c.mood || 0) * (elapsed===1?.998:Math.pow(.998,elapsed));
      const totalNeeds=n.food+n.water+n.energy+n.hygiene+n.toilet+n.social+n.leisure+n.health+n.shelter+n.safety;
      let comfort=0;if(c.homeUnitId&&c.homeComfort)for(const key in c.homeComfort)if(c.homeComfort[key]>this.minute)comfort++;
      c.happiness = clamp(totalNeeds / 10 + (c.jobId&&c.career?(c.career.motivation-50)*.08:0) + c.mood + (c.substanceModifiers?.mood||0) + clothingMood(c) + this.relationships.moodEffect(c) + Math.min(6,comfort)*2);
      if(!sleeping)this.supplies.useCarried(c);
      // Custody rations must be issued before the mortality check. Otherwise a
      // prisoner who reaches zero food on this minute can die before the jail
      // gets its chance to provide a ration. This also covers escort queues
      // and transport, where updateDetainee intentionally does not run the
      // in-cell care cycle yet.
      if(c.custody){const jail=this.building(c.custody.jailId);if(jail?.active&&!jail.entity.destroyed){this.justice.servePrisoner(c,jail);this.supplies.useCarried(c);}}
      let died=false;if(citizenDetail)measureCitizen('lifeMinute',()=>{died=this.life.minute(c,elapsed);});else died=this.life.minute(c,elapsed);if(died){invalidateActivitySearch(this);continue;}
      this.justice.updateInjuries(c);
      if(c.custodyWaterDelivery){if(c.indoorLocation&&!syncCitizenInterior(this,c))continue;this.justice.updateCustodyWaterDelivery(c);continue;}
      if(c.funeralBodyId){if(c.skybridgeTransit)this.finishSkybridgeTransit(c);if(c.skybridgeTransit){this.justice.updateFuneralWorker(c);continue;}if(c.indoorLocation&&!c.funeralInterior&&!syncCitizenInterior(this,c))continue;this.justice.updateFuneralWorker(c);continue;}
      if(c.custodyEscort){if(c.indoorLocation&&!syncCitizenInterior(this,c))continue;this.justice.updateCustodyEscort(c);continue;}
      if(c.custody&&c.custody.status!=='awaiting-escort'){if(c.indoorLocation&&!syncCitizenInterior(this,c))continue;this.justice.updateDetainee(c);continue;}
      if((c.unconsciousUntil||0)>this.minute){c.task=null;c.path=[];c.targetId=null;c.action='Inconsciente após ferimento na cabeça';if(c.indoorLocation?.path)c.indoorLocation.path=[];continue;}
      if((c.surrenderedUntil||0)>this.minute){c.task=null;c.path=[];c.targetId=null;c.action='Rendido após agressão';if(c.indoorLocation?.path)c.indoorLocation.path=[];continue;}
      if(c.combatFlee?.status==='running'){
        if(c.indoorLocation){if(c.indoorLocation&&!syncCitizenInterior(this,c)){c.action='Saindo do prédio para fugir da agressão';continue;}}
        let safe=this.building(c.combatFlee.safeBuildingId);if(!safe||safe.entity.destroyed){const route=this.justice.combatFleeRoute(c);if(!route){c.combatFlee.waitingReason='sem rota para local seguro';c.action='Aguardando rota para fugir da agressão';continue;}safe=route.building;c.combatFlee.safeBuildingId=safe.id;c.path=route.path;c.targetId=safe.id;}
        if(!c.path.length&&Math.hypot(c.entity.x-safe.door.x,c.entity.y-safe.door.y)<=1.2){c.combatFlee.status='arrived';c.combatFlee.arrivedAt=this.minute;c.combatFlee.endsAt=this.minute+30;c.combatFlee.waitingReason=null;c.task=null;c.targetId=null;c.action=`Chegou a ${safe.entity.properties.name} após fugir da agressão`;this.log(`${c.entity.properties.name} alcançou ${safe.entity.properties.name} após fugir da agressão.`,'justice',[c.id,safe.id],{kind:'combat-flee-arrived',safeBuildingId:safe.id});continue;}
        if(!c.path.length){const path=this.findPath(c.entity,safe.door);if(path===null){c.combatFlee.waitingReason='sem rota para local seguro';c.action='Aguardando rota para fugir da agressão';continue;}c.path=path;if(!path.length&&Math.hypot(c.entity.x-safe.door.x,c.entity.y-safe.door.y)>.1)c.path=[{x:safe.door.x,y:safe.door.y}];}
        c.task='combat-flee';c.targetId=safe.id;c.action=`Fugindo da agressão para ${safe.entity.properties.name}`;continue;
      }
      if(c.graffitiMission){this.justice.updateGraffitiMission(c);continue;}
      if(c.policeOversight){const urgent=this.urgentNeed(c);this.justice.updatePoliceOversight(c);if(c.policeOversight||!urgent)continue;}
      if(c.policeAudit){const urgent=this.urgentNeed(c);this.justice.updatePoliceAudit(c);if(c.policeAudit||!urgent)continue;}
      if(c.policeArrestEscort){if(c.indoorLocation&&!syncCitizenInterior(this,c))continue;const urgent=this.urgentNeed(c);this.justice.updatePoliceArrestEscort(c);if(!urgent)continue;}
      if(c.policeRestitution&&this.urgentNeed(c)){this.justice.pauseVehicleRestitution(c,'necessidade urgente do agente');c.task=null;c.targetId=null;c.path=[];if(c.indoorLocation?.path?.length)c.indoorLocation.path=[];c.action='Pausa a restituição para atender uma necessidade urgente';}
      else if(c.policeRestitution){if(c.indoorLocation&&!syncCitizenInterior(this,c))continue;this.justice.updatePoliceRestitution(c);continue;}
      if(c.policeResponse){if(c.indoorLocation&&!syncCitizenInterior(this,c))continue;this.justice.updatePoliceResponse(c);continue;}
      if(c.policeInvestigation){if(c.indoorLocation&&!syncCitizenInterior(this,c))continue;this.justice.updatePoliceInvestigation(c);continue;}
      if(c.policePatrol){if(c.indoorLocation&&!syncCitizenInterior(this,c))continue;this.justice.updatePolicePatrol(c);continue;}
      if(c.skybridgeTransit){this.finishSkybridgeTransit(c);if(c.skybridgeTransit)continue;}
      if(age>=18&&!c.indoorLocation&&!c.businessIds.length&&!this.politics.officeHolder(c)&&this.minute>=(c.career?.nextDiscoveryAt??c.id%RECRUITMENT_RULES.discoveryInterval)){if(citizenDetail)measureCitizen('vacancyDiscovery',()=>discoverVacancies(this,c));else discoverVacancies(this,c);}
      if(c.mobilityTrip||c.ridingVehicleId)continue;
      let mealAdvanced=false;if(c.workMeal){if(citizenDetail)measureCitizen('workMealAdvance',()=>{mealAdvanced=this.workMeals.advance(c);});else mealAdvanced=this.workMeals.advance(c);}if(mealAdvanced)continue;
      if(c.task!=='energy'&&wantsSleep(this,c)&&!c.deliveryId&&!c.cleaningJobId&&!c.conversation&&!['food','water','health','toilet','hygiene','care','caregiving','provisions','workmeal','supplies'].includes(c.task)){c.task=null;c.path=[];}
      if(c.task==='energy'&&c.sleep?.active&&!c.path.length&&Math.min(n.food,n.water,n.health,n.toilet)>5){this.performTask(c);continue;}
      const urgent = this.urgentNeed(c);
      if (urgent && c.conversation) { const other = this.society.citizen(c.conversation.a === c.id ? c.conversation.b : c.conversation.a); if (other) other.conversation = null; c.conversation = null; }
      const taskNeed=c.task==='supplies'?this.supplies.need(c):c.task==='lake-water'?'water':['provisions','workmeal'].includes(c.task)?'food':c.task;
      const completingEssential = !c.path.length && (!['toilet','food','health'].includes(c.task)||!!c.indoorLocation?.unitId&&!c.indoorLocation?.path?.length) && ESSENTIAL_TASKS.has(c.task) && n[taskNeed] < (c.task==='energy'?18:75) && !(urgent==='health'&&n.health<10);
      if (!c.deliveryId && !c.cleaningJobId && !c.informalJobId && urgent && taskNeed !== urgent && !completingEssential && age >= 6) { c.task = null; c.path = []; }
      if(!c.deliveryId&&!urgent&&!c.conversation&&(INTERRUPTIBLE_TASKS.has(c.task)||(c.task==='energy'&&n.energy>65))){
        for(const child of this.childrenOf(c.id))if(this.society.age(child)<6&&Math.min(child.needs.food,child.needs.water,child.needs.hygiene,child.needs.social)<25){c.task=null;c.path=[];break;}
      }
      if (c.deliveryId || c.cleaningJobId || c.informalJobId) continue;
      if (c.conversation) continue;
      if(!urgent&&c.career?.pendingInterview?.status==='análise')routeToInterview(this,c);
      const carried=c.pocket;
      const carriedLow=(carried?.food?.length||0)+(c.provisions||0)<=POCKET_RULES.foodLow||(carried?.water||0)<=POCKET_RULES.waterLow;
      if(!urgent&&carriedLow&&['work','manage','walk','leisure','social'].includes(c.task)&&Math.min(n.energy,n.health,n.toilet)>30)this.supplies.route(c);
      if (!c.task) {
        if(c._initialTaskStaggerUntil!=null){if(this.minute<c._initialTaskStaggerUntil&&!urgent)continue;c._initialTaskStaggerUntil=null;}
        // An idle citizen used to repeat the same path/offer search every city
        // minute, even after finishing leisure at 95% or finding no service.
        // Retry on a changed urgent need, at shift boundaries, or after a short
        // delay. At 32× this is only a fraction of a real second.
        if(this.minute<(c._nextTaskAt||0)&&c._retryUrgent===urgent&&c._routineRevision===routineRevision(this,c))continue;
        c.servicePaid = null;if(citizenDetail)measureCitizen('taskChoice',()=>this.chooseTask(c,urgent));else this.chooseTask(c,urgent);
      }
      if (!c.path.length && c.task){if(citizenDetail)measureCitizen('taskExecution',()=>this.performTask(c));else this.performTask(c);}
      if(!c.task){
        const stable=c.homeUnitId&&n.food>35&&n.water>35&&n.energy>35&&n.health>35&&n.toilet>35;
        c._nextTaskAt=nextRoutineReview(this,c,stable,urgent);c._retryUrgent=urgent;c._routineRevision=routineRevision(this,c);
      }
    }
    this._citizenLoopProfile=null;citizenMs=performance.now()-profileMark;profileMark=performance.now();
    for(const c of this.citizens)if(!c.skybridgeTransit&&(c._lastNeedsAt===this.minute||c.task||c.path.length||c.indoorLocation))syncCitizenInterior(this,c);
    }finally{endActivitySearch(this);this._citizenLoopProfile=null;}
    for(const c of this.citizens)if(c.seatId||c.seated||c.furnitureUse||c.indoorLocation||c.workWait||c.task==='beach_leisure'||c.beachLeisure)this.furniture.syncCitizen(c);
    if(this.minute%60===0){this.furniture.reconcile();this.substances?.hourly();}
    const interiorMs=performance.now()-profileMark;profileMark=performance.now();
    const societyParts=this.profileDiagnostics?{}:null;let societyPartStart=this.profileDiagnostics?performance.now():0;
    advanceRecruitment(this);
    if(societyParts){societyParts.recruitmentMs=performance.now()-societyPartStart;societyPartStart=performance.now();}
    this.gigs.updateMinute();
    if(societyParts){societyParts.gigsMs=performance.now()-societyPartStart;societyPartStart=performance.now();}
    if(!this.fastForward||this.minute%4===0)disperseCrowds(this);
    if(societyParts){societyParts.crowdDispersionMs=performance.now()-societyPartStart;societyPartStart=performance.now();}
    this.society.updateMinute();
    if(societyParts)societyParts.socialUpdateMs=performance.now()-societyPartStart;
    const societyMs=performance.now()-profileMark;profileMark=performance.now();
    const movers=this._movingCitizens??=[];movers.length=0;
    for(const c of this.citizens)if(c.path.length||c.indoorLocation?.path?.length||c.deliveryId||c.ridingVehicleId)movers.push(c);
    const moverSetupMs=performance.now()-profileMark;profileMark=performance.now();
    // Spread hourly work across minutes; keep the same order and one run per hour.
    if (this.minute % 60 === 0) this.hourlyPhase = 0;
    let economyHourly=null;
    if (this.hourlyPhase != null && this.hourlyPhase < 13) {
      const phase=this.hourlyPhase++;
      if(this.profileDiagnostics){const started=performance.now(),parts=this.economy.hourly(phase);economyHourly={phase,ms:performance.now()-started,...(parts||{})};}
      else this.economy.hourly(phase);
    }
    this.history.captureFavoriteActivities();
    this.lastStepProfile={minute:this.minute,totalMs:performance.now()-profileStart,reconcileMs,servicesMs,civicMs,setupMs,citizenMs,interiorMs,societyMs,moverSetupMs,...(civicDetail?{civicDetail}:{}),...(citizenDetail?{citizenDetail}:{}),...(this.profileDiagnostics?{societyDetail:this.society.lastUpdateProfile,societyParts,...(this.gigs.lastSpontaneousArtworkProfile?{spontaneousArtwork:this.gigs.lastSpontaneousArtworkProfile}:{})}:{}),...(economyHourly?{economyHourly}:{}),...(this._pathSearchProfile?{pathSearches:this._pathSearchProfile.searches,pathSearchTotalMs:this._pathSearchProfile.totalMs,pathSearchWork:Object.fromEntries(['groundCalls','groundCacheHits','aStarCalls','sharedCalls','destinationFields','sourceFields','fieldResets','bridgeChecks'].map(key=>[key,this._pathSearchProfile[key]||0])),pathSearchMaxMs:this._pathSearchProfile.maxMs,pathSearchPeak:this._pathSearchProfile.maxMs?{start:this._pathSearchProfile.start,goal:this._pathSearchProfile.goal}:null}:{})};
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
    const profileStart=performance.now();let profileMark=profileStart;
    // One simulation second = four city minutes; all systems share this clock.
    this.accumulator += dt * 4;
    while (this.accumulator >= 1) { this.accumulator -= 1; this.stepMinute(); }
    const minuteStepsMs=performance.now()-profileMark;profileMark=performance.now();
    const movers=this._movingCitizens||[];
    if(this.vehicles.activeCount&&this._lastVehicleScanMinute!==this.minute){
      this._lastVehicleScanMinute=this.minute;
      for(const c of movers)if(!c.ridingVehicleId&&!c.indoorLocation)this.vehicles.tryTrip(c);
    }
    const mobilityMs=performance.now()-profileMark;profileMark=performance.now();
    // Many active drivers used to scan the entire shipment list independently
    // on every movement update. Build a temporary index only when it pays off.
    let driverCount=0;for(const c of movers)if(c.deliveryId&&++driverCount>4)break;
    let shipmentIndex=null;
    if(driverCount>4){
      const wanted=new Set();for(const c of movers)if(c.deliveryId)wanted.add(c.deliveryId);
      shipmentIndex=new Map();
      for(const s of this.logistics.shipments)if(wanted.delete(s.id)){shipmentIndex.set(s.id,s);if(!wanted.size)break;}
    }
    const movementSetupMs=performance.now()-profileMark;profileMark=performance.now();
    for (const c of movers) {
      if(c.ridingVehicleId)continue;
      if(c.indoorLocation){advanceCitizenInterior(this,c,dt*(this.society.isAdult(c)?4:2.5));continue;}
      // Vehicle eligibility is minute based (including its 20-minute search
      // cooldown); polling it on every animation frame repeats the same scans
      // up to 60 times before any relevant state can change.
      const load=c.deliveryId?(shipmentIndex?shipmentIndex.get(c.deliveryId):this.logistics.shipments.find(s=>s.id===c.deliveryId)):null;
      if(load?.pickedUp&&!c.mobilityTrip&&(c.deliveryLoad||load.quantity)>this.vehicles.cargoCapacity(c)){c.action='Aguardando veículo para transportar a carga';continue;}
      if(!c.path.length&&c.skybridgeZ&&!c.skybridgeId){c.skybridgeZ=0;c.skybridgeId=null;}
      if (c.conversation || c.workMeal || !c.path.length) continue;
      let distance = dt * (this.society.isAdult(c) ? 4 : 2.5) * this.justice.mobilityFactor(c) * bodyMovementSpeedFactor(c);
      while (distance > 0 && c.path.length) {
        const p = c.path[0];
        if(p.skybridgeEntry||p.skybridgeExit){
          c.path.shift();const leg=p.skybridgeEntry?{...p.skybridgeEntry,phase:'entry'}:{...p.skybridgeExit,phase:'exit'};
          if(!this.beginSkybridgeTransit(c,leg)){c.path=[];c.task=null;c.skybridgeZ=0;c.skybridgeId=null;c.skybridgeTransit=null;}
          break;
        }
        const pBridge=p.skybridgeId||(c.skybridgeZ>0?c.skybridgeId:null),elevated=!!pBridge,boatWaypoint=!!p.boatClass,tx=Math.floor(p.x),ty=Math.floor(p.y);
        if(pBridge&&!this.skybridgeLinksForRevision().some(link=>link.id===pBridge)){c.path=[];c.task=null;c.skybridgeZ=0;c.skybridgeId=null;break;}
        if(boatWaypoint&&this.world.getTile(tx,ty)!==TILE_WATER){c.path=[];c.task=null;c.boatClass=null;break;}
        if(!elevated&&!boatWaypoint&&(!this.walkable(tx,ty)||!canStep(this.world,Math.floor(c.entity.x),Math.floor(c.entity.y),tx,ty))){c.path=[];c.task=null;c.skybridgeZ=0;c.skybridgeId=null;break;}
        const dx=p.x-c.entity.x,dy=p.y-c.entity.y,dz=(p.z||0)-(c.skybridgeZ||0),len=Math.hypot(dx,dy,dz);
        const tile=tileAt(this.world,tx,ty),boatSpec=boatWaypoint?BOAT_CLASSES[p.boatClass]:null,cost=elevated?1.05:boatWaypoint?1/Math.max(.1,boatSpec?.speed||1):roadTravelCost(tile),available=distance/cost,travelled=Math.min(len,available);
        if(len<=available){c.entity.x=p.x;c.entity.y=p.y;c.skybridgeZ=p.z||0;c.skybridgeId=pBridge||null;c.boatClass=boatWaypoint?p.boatClass:this.world.getTile(Math.floor(c.entity.x),Math.floor(c.entity.y))===TILE_WATER?c.boatClass:null;if(!elevated&&!boatWaypoint){this.recordTraffic(p);discoverStreetMarket(this.economy,c,p);}c.path.shift();distance=Math.max(0,distance-len*cost);}
        else{const ratio=available/len;c.entity.x+=dx*ratio;c.entity.y+=dy*ratio;c.skybridgeZ=(c.skybridgeZ||0)+dz*ratio;c.skybridgeId=elevated?pBridge:null;c.boatClass=boatWaypoint?p.boatClass:this.world.getTile(Math.floor(c.entity.x),Math.floor(c.entity.y))===TILE_WATER?c.boatClass:null;distance=0;}
        if(travelled>0){
          c.mobilityTimeLostToday=(c.mobilityTimeLostToday||0)+travelled*cost;
          c.mobilityNeed=Math.min(100,(c.mobilityNeed||0)+travelled*cost*.22*(c.mobilityPriority||1));
          if(!elevated&&!boatWaypoint){wearRoad(this.world,tx,ty,travelled*ROAD_RULES.wearPerCell);
          if(DIRT_ROAD_TILES.has(tile)){c.needs.hygiene=clamp(c.needs.hygiene-travelled*ROAD_RULES.hygienePerDirtCell);c.mood=Math.max(-25,(c.mood||0)-travelled*ROAD_RULES.moodPerDirtCell);}}
        }
        c.action = c.boatClass?`Navegando de ${BOAT_CLASSES[c.boatClass]?.label?.toLowerCase()||'barco'}`:c.skybridgeZ>0?'Atravessando a passarela elevada':c.deliveryId ? 'Transportando mercadorias' : c.task==='combat-flee' ? 'Fugindo da agressão' : c.task==='walk'?'Passeando pela cidade':c.task==='supplies'?'Indo repor comida e água':c.task==='lake-water'?'Buscando água do lago':c.task==='job-interview'?'Indo à Secretaria do Trabalho':c.task==='council-session'?'Indo ao plenário da Câmara':c.task === 'research' ? 'Indo ao ponto de entrevistas' : c.task === 'vote' ? 'Indo votar na prefeitura' : c.task === 'construction' ? 'Indo para a obra' : c.forestryJob&&['work','manage'].includes(c.task)?(c.forestryJob.stage==='return'?'Levando madeira à silvicultura':c.forestryJob.stage==='cut'?'Indo cortar uma árvore':'Indo plantar uma árvore'):c.task === 'workmeal' ? 'Indo ao refeitório da empresa' : c.task === 'visit' ? `Indo visitar ${this.society.citizen(c.socialVisitId)?.entity.properties.name||'pessoa próxima'}` : `Indo: ${NEED_LABELS[c.task] || 'Trabalho'}`;
      }
      if(!c.path.length)syncCitizenInterior(this,c);
    }
    const movementMs=performance.now()-profileMark;profileMark=performance.now();
    this.vehicles.update(dt);
    this.lastUpdateProfile={minute:this.minute,totalMs:performance.now()-profileStart,minuteStepsMs,mobilityMs,movementSetupMs,movementMs,vehicleMs:performance.now()-profileMark,step:this.lastStepProfile};
  }
  goodsStock(good) {
    const campaignCarried=this.citizens.reduce((n,c)=>n+(c.campaignInventory?.[good]||0),0);
    const pocketGoods=this.supplies.carriedGoods(good);
    const carried=good==='madeira'?this.citizens.reduce((n,c)=>n+(c.forestryJob?.load||0),0):good==='sementes'?this.citizens.reduce((n,c)=>n+(c.forestrySeeds||0),0):0;
    const worn=good==='roupas'?this.citizens.reduce((n,c)=>n+(c.wardrobe||[]).filter(g=>g.manufacturedAt!=null&&!g.discarded).length,0):0;
    let printed=0;if(['livros','panfletos','jornais'].includes(good)){const matched=new Map();for(const doc of this.publications.documents.values()){if(doc.lost||doc.good!==good)continue;const holder=this.publications.inventoryHolder(doc.ownerAccountId),count=matched.get(doc.ownerAccountId)||0,represented=holder?.inventory?.[good]||0;if(count>=represented)printed++;matched.set(doc.ownerAccountId,count+1);}}
    return this.citizens.reduce((n,c)=>n+(c.inventory?.[good]||0)+(c.substanceHomeStock?.inventory?.[good]||0),0)+this.furniture.storedGoods(good)+pocketGoods+this.paint.goodsStock(good)+this.vehicles.goodsStock(good)+printed+worn+campaignCarried+carried+[...this.buildings, ...this.development.projects, ...this.logistics.shipments, ...this.lighting.propertyStores.values(),this.worldPort,...(this.economy.importDepot?[this.economy.importDepot]:[]),...this.politics.parties.map(p=>this.accounts.get(p.accountId)).filter(a=>a?.inventory)].reduce((n, h) => n + (h.inventory[good] || 0) + (good === 'lixo' ? h.litter || 0 : 0), 0);
  }
  stats() {
    if (this._statsCache && this._statsMinute === this.minute && this._statsStructure === this.structureRevision) return this._statsCache;
    this._statsMinute = this.minute; this._statsStructure = this.structureRevision;
    const people = this.citizens.filter(c => !c.entity.destroyed);
    const units = [...this.units.values()];
    const employers=this.buildings.filter(b=>b.active&&!b.entity.destroyed);
    const jobs=employers.reduce((n,b)=>n+b.jobs,0),vacancies=employers.reduce((n,b)=>n+Math.max(0,b.jobs-occupiedPositions(this,b)),0);
    return this._statsCache = { mayorId: this.economy.mayorId, entrepreneurs: people.filter(c => c.businessIds.length).length, moneySupply: this.currency.supply(), moneyIssued: this.currency.issued, priceIndex: this.currency.priceIndex, inflation: this.currency.dailyInflation, businesses: this.economy.businesses.length, population: people.length, children: people.filter(c => !this.society.isAdult(c)).length, couples: people.filter(c => c.partnerId).length / 2, friendships: [...this.society.relations.values()].filter(r => r.active!==false && ['friend', 'close'].includes(r.status)).length, births: this.society.birthCount, deaths: this.life.deathCount, employed: people.filter(c => this.society.isAdult(c)&&!c.custody&&(c.jobId||c.businessIds.length||this.politics.officeHolder(c))).length, laborForce:people.filter(c=>this.society.isAdult(c)&&!c.custody).length, unemployed:people.filter(c=>this.society.isAdult(c)&&!c.custody&&!c.jobId&&!c.businessIds.length&&!this.politics.officeHolder(c)).length, homeless: people.filter(c => !c.homeUnitId).length, happiness: people.length ? Math.round(people.reduce((s, c) => s + c.happiness, 0) / people.length) : 0, units: units.length, occupied: units.filter(u => u.tenantId || u.occupantId).length, jobs, vacancies, treasury: this.treasury };
  }
}
