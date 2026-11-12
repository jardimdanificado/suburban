import { GOODS } from './city_economy.js?v=regional-supply-5';
import { INDUSTRIES } from './city_industries.js';

const ROUTE_TRAVEL_MINUTES = 60;
const ROUTE_CAPACITY = 100;
const ROUTE_FREIGHT_PER_UNIT = 10;

/**
 * Cliente do servidor do mundo: WebSocket com reconexão, correlação de pedidos
 * (reqId) e publicação periódica do resumo da cidade.
 */
export class WorldNetClient {
  constructor({ url, cityId, name, coordinator, notice = () => {} } = {}) {
    this.url = url;
    this.cityId = cityId;
    this.name = name;
    this.coordinator = coordinator;
    this.notice = notice;
    this.handlers = new Map();
    this.status = 'offline';
    this.socket = null;
    this.reconnectDelay = 1000;
    this.reconnectDisabled = false;
    this.lastSummarySent = 0;
    this.lastSummary = null;
  }

  on(method, handler) { this.handlers.set(method, handler); return this; }

  connect() {
    if (this.socket) return;
    this.reconnectDisabled = false;
    this.status = 'connecting';
    let socket;
    try { socket = new WebSocket(this.url); }
    catch (error) { this.status = 'offline'; this.notice(`Endereço do servidor inválido: ${error.message}`); return; }
    this.socket = socket;
    socket.onopen = () => {
      this.status = 'online';
      this.reconnectDelay = 1000;
      this.coordinator.setConnected(true, this.url);
      this.sendHello();
    };
    socket.onmessage = event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      this.receive(message);
    };
    socket.onclose = () => {
      this.socket = null;
      this.status = 'offline';
      this.coordinator.setConnected(false, null);
      if (!this.reconnectDisabled) this.scheduleReconnect();
    };
    socket.onerror = () => {};
  }

  disconnect() {
    this.reconnectDisabled = true;
    clearTimeout(this._reconnect);
    this.socket?.close();
    this.socket = null;
    this.status = 'offline';
    this.coordinator.setConnected(false, null);
  }

  scheduleReconnect() {
    clearTimeout(this._reconnect);
    this._reconnect = setTimeout(() => {
      this.reconnectDelay = Math.min(15000, this.reconnectDelay * 2);
      this.connect();
    }, this.reconnectDelay);
  }

  sendHello() {
    const own = this.coordinator.own, city = own?.city;
    this.send({
      type: 'hello', cityId: this.cityId, name: this.coordinator.ownName(),
      minute: Number.isFinite(city?.minute) ? Math.floor(city.minute) : 0,
      summary: own?.summary || null,
      port: own?.port || null,
      goods: this.goodsSummary(),
    });
  }

  send(message) { if (this.socket?.readyState === 1) this.socket.send(JSON.stringify(message)); }

  receive(message) {
    switch (message.type) {
      case 'welcome': this.coordinator.adoptWelcome(message); break;
      case 'city-online': this.coordinator.cityOnline(message.city); break;
      case 'city-offline': this.coordinator.cityOffline(message.cityId); break;
      case 'city-summary': this.coordinator.citySummary(message); break;
      case 'transfer': this.coordinator.transferUpdate(message.transfer); this.reconcileCancelled(message.transfer); break;
      case 'contract': this.coordinator.contractUpdate(message.contract); break;
      case 'contract:removed': this.coordinator.contracts.delete(message.id); break;
      case 'policy': this.coordinator.policyUpdate(message.policy); break;
      case 'policy:removed': this.coordinator.policies.delete(message.id); break;
      case 'request': void this.answer(message); break;
      case 'trade:failed': this.notice(message.message); break;
      case 'error': this.onServerError(message); break;
      default: break;
    }
  }

  /** A rejected hello (identifier already connected) must not turn into a reconnect loop. */
  onServerError(message) {
    this.notice(message.message);
    if (/já está conectad/i.test(message.message || '')) {
      this.reconnectDisabled = true;
      this.status = 'rejected';
    }
  }

  async answer(request) {
    const handler = this.handlers.get(request.method);
    let ok = false, value = null, message = null;
    if (handler) {
      try {
        const result = await handler(request.args || []);
        if (result && result.__response) { ok = result.ok !== false; value = result.value; message = result.message; }
        else { ok = true; value = result; }
      } catch (error) { message = error.message; }
    } else message = `Esta cidade não soube responder a ${request.method}.`;
    this.send({ type: 'response', reqId: request.reqId, ok, value, message });
  }

  publishSummary(summary) {
    if (!summary || Math.abs((summary.minute || 0) - (this.lastSummarySent || 0)) < 1) return;
    this.lastSummarySent = summary.minute || 0;
    this.lastSummary = summary;
    this.send({ type: 'summary', minute: summary.minute, summary, port: this.coordinator.portInfo(), goods: this.goodsSummary() });
  }

  goodsSummary() {
    const city = this.coordinator.own?.city;
    if (!city?.economy?.goods) return {};
    return Object.fromEntries(Object.entries(city.economy.goods).map(([good, row]) => [good, { label: row.label, price: row.price }]));
  }

  orderTrade(order) { this.send({ type: 'trade:order', order }); }

  /** Cancelments decided while this world was offline leave orphan reservations; clean them idempotently. */
  reconcileCancelled(transfer) {
    if (!transfer || transfer.status !== 'cancelled' || !transfer.id || this._reconciled?.has(transfer.id)) return;
    this._reconciled ??= new Set();
    this._reconciled.add(transfer.id);
    const own = this.coordinator.cityId, isOrigin = transfer.originCityId === own, isDestination = transfer.destinationCityId === own;
    if (!isOrigin && !isDestination) return;
    const call = async (method, args) => {
      const handler = this.handlers.get(method);
      if (!handler) return;
      try { await handler(args); } catch {}
    };
    if (transfer.kind === 'citizen') {
      if (isOrigin) void call(transfer.payload.package?.version === 2 ? 'cancelWorldHouseholdMigration' : 'cancelWorldCitizenMigration', [transfer.id]);
      return;
    }
    if (isOrigin && transfer.payload.exportReserved) void call('returnWorldExport', [transfer.id]);
    if (isDestination && (transfer.payload.importReserved || transfer.payload.paymentReserved)) void call('cancelWorldImport', [transfer.id]);
    if (isDestination && transfer.payload.paymentReserved) void call('refundWorldPayment', [transfer.id]);
  }
  cancelTransfer(id) { this.send({ type: 'transfer:cancel', transferId: id }); }
  createContract(spec) { this.send({ type: 'contract:create', contract: spec }); }
  cancelContract(id) { this.send({ type: 'contract:cancel', id }); }
  createMigrationPolicy(spec) { this.send({ type: 'policy:create', policy: spec }); }
  cancelMigrationPolicy(id) { this.send({ type: 'policy:cancel', id }); }
  orderMigration(order) { this.send({ type: 'migration:order', order }); }
}

/**
 * Espelho do mundo online: mantém a mesma superfície que o WorldCoordinator
 * local do antigo sistema (cities/transfers/vessels/routes/ports/minute) para
 * que a UI e o renderer 3D funcionem sem conhecer a rede.
 */
export class WorldNetCoordinator {
  constructor({ cityId, cityGetter, notice = () => {} } = {}) {
    this.cityId = cityId;
    this.getOwnCity = cityGetter;
    this.notice = notice;
    this.cities = new Map();
    this.transfers = new Map();
    this.rawTransfers = new Map();
    this.vessels = new Map();
    this.routes = new Map();
    this.ports = new Map();
    this.contracts = new Map();
    this.policies = new Map();
    this.activeCityId = cityId;
    this.connected = false;
    this.serverUrl = null;
    this.client = null;
  }

  get own() { return this.cities.get(this.cityId); }
  get ownCity() { return this.getOwnCity()?.city || null; }
  get minute() { const minute = this.ownCity?.minute; return Number.isFinite(minute) ? Math.floor(minute) : 0; }
  ownName() {
    const city = this.ownCity, official = city?.municipalIdentity?.name;
    if (official && !/^Cidade\s+\d+$/i.test(official)) return official;
    return city?.politics?.ensureMunicipalIdentity?.().name || this.cityId;
  }

  attachCity(city, world, metadata) {
    city.worldPort.cityId = this.cityId;
    this.cities.set(this.cityId, {
      id: this.cityId, city, world, online: false,
      metadata: { name: this.ownName(), ...metadata },
      summary: null, port: this.portInfo(), goods: null, minute: city.minute,
    });
    this.activeCityId = this.cityId;
    this.recompute();
  }

  portInfo() {
    const city = this.ownCity, port = city?.worldPort;
    if (!port) return null;
    return { x: port.door?.x ?? port.x ?? 0, y: port.door?.y ?? port.y ?? 0, berth: port.berth || null };
  }

  setConnected(connected, url) {
    this.connected = connected;
    this.serverUrl = url;
    if (this.own) this.own.online = connected;
    if (!connected) for (const city of this.cities.values()) if (city.id !== this.cityId) city.online = false;
    this.recompute();
  }

  adoptWelcome(welcome) {
    for (const city of welcome.cities || []) this.cityOnline(city);
    for (const transfer of welcome.transfers || []) this.transferUpdate(transfer);
    for (const contract of welcome.contracts || []) this.contractUpdate(contract);
    for (const policy of welcome.policies || []) this.policyUpdate(policy);
    const self = welcome.self;
    if (self) { const own = this.own; if (own) { own.online = true; own.summary = own.summary || self.summary; } }
    this.recompute();
  }

  cityOnline(city) {
    if (city.cityId === this.cityId) { const own = this.own; if (own) own.online = true; this.recompute(); return; }
    this.cities.set(city.cityId, {
      id: city.cityId, city: null, world: null, online: true,
      metadata: { name: city.name }, summary: city.summary, port: city.port, goods: city.goods, minute: city.minute,
    });
    this.recompute();
  }

  cityOffline(cityId) {
    const city = this.cities.get(cityId);
    if (city) city.online = false;
    this.recompute();
  }

  citySummary(message) {
    let city = this.cities.get(message.cityId);
    if (!city) city = { id: message.cityId, city: null, world: null, online: true, metadata: { name: message.name }, summary: null, port: null, goods: {}, minute: 0 };
    this.cities.set(message.cityId, city);
    city.online = true;
    city.metadata.name = message.name || city.metadata.name;
    city.summary = message.summary || city.summary;
    city.port = message.port || city.port;
    city.goods = message.goods || city.goods;
    if (Number.isFinite(message.minute)) city.minute = message.minute;
    this.recompute();
  }

  recompute() {
    const online = [...this.cities.values()].filter(city => city.online);
    const routes = new Map();
    for (const a of online) for (const b of online) {
      if (a.id === b.id) continue;
      const id = `route:${a.id}>${b.id}`;
      routes.set(id, { id, originCityId: a.id, destinationCityId: b.id, travelMinutes: ROUTE_TRAVEL_MINUTES, capacity: ROUTE_CAPACITY, freightPerUnit: ROUTE_FREIGHT_PER_UNIT });
    }
    this.routes = routes;
    this.ports = new Map();
    for (const city of this.cities.values()) if (city.port) this.ports.set(`${city.id}:port`, { id: `${city.id}:port`, cityId: city.id, x: city.port.x, y: city.port.y, berth: city.port.berth, dockedVesselId: null });
    this.syncVessels();
  }

  syncVessels() {
    const activeByRoute = new Map();
    for (const transfer of this.rawTransfers.values()) {
      if (!['reserving', 'scheduled', 'in-transit'].includes(transfer.status)) continue;
      activeByRoute.set(`route:${transfer.originCityId}>${transfer.destinationCityId}`, transfer);
    }
    for (const [id, route] of this.routes) {
      const transfer = activeByRoute.get(id);
      this.vessels.set(`vessel:${id}`, {
        id: `vessel:${id}`, classId: 'cargo', capacity: route.capacity, routeId: id,
        operatorType: 'municipal', homeCityId: route.originCityId, localVehicleId: null,
        transferId: transfer?.id ?? null, lastTransferId: transfer?.id ?? null,
        currentPortId: `${route.originCityId}:port`,
        status: transfer ? (transfer.status === 'scheduled' ? 'reserved' : 'at-sea') : 'idle',
        returnMinute: null,
      });
    }
    for (const id of [...this.vessels.keys()]) if (!this.routes.has(id.slice('vessel:'.length))) this.vessels.delete(id);
  }

  transferUpdate(transfer) {
    if (!transfer?.id) return;
    this.rawTransfers.set(transfer.id, transfer);
    if (['delivered', 'cancelled'].includes(transfer.status)) this.transfers.delete(transfer.id);
    else this.transfers.set(transfer.id, structuredClone(transfer));
    this.syncVessels();
  }

  contractUpdate(contract) { if (contract?.id) this.contracts.set(contract.id, contract); }
  policyUpdate(policy) { if (policy?.id) this.policies.set(policy.id, policy); }

  /** Translates departure/arrival into the observed city's clock so the 3D renderer's progress math stays unchanged. */
  prepareForRender(observedCityId) {
    for (const [id, mirror] of this.transfers) {
      const transfer = this.rawTransfers.get(id);
      if (!transfer) continue;
      const minutes = this.routes.get(transfer.routeId)?.travelMinutes || ROUTE_TRAVEL_MINUTES;
      if (transfer.originCityId === observedCityId) {
        mirror.departureMinute = transfer.departureMinute ?? 0;
        mirror.arrivalMinute = mirror.departureMinute + minutes;
      } else if (transfer.destinationCityId === observedCityId) {
        mirror.arrivalMinute = transfer.arrivalMinute ?? 0;
        mirror.departureMinute = mirror.arrivalMinute - minutes;
      }
    }
  }

  resolveCitizen(globalId) {
    const city = this.ownCity;
    const person = city?.citizens?.find(entry => entry.globalId === globalId && !entry.dead && !entry.entity.destroyed);
    if (!person) return null;
    return { globalId, cityId: this.cityId, citizenId: person.id, name: person.entity?.properties?.name || person.name || 'Cidadão', age: city.society?.age?.(person) ?? null, citizen: person };
  }

  /** Surplus offers this city can export, mirroring the regional supply rules. */
  computeOffers() {
    const city = this.ownCity;
    if (!city) return [];
    const reserved = new Map();
    for (const transfer of this.rawTransfers.values()) {
      if (transfer.kind === 'goods' && ['reserving', 'scheduled', 'in-transit'].includes(transfer.status) && transfer.originCityId === this.cityId) {
        reserved.set(transfer.payload.good, (reserved.get(transfer.payload.good) || 0) + transfer.payload.quantity);
      }
    }
    const byGood = new Map(), depot = city.economy.importDepot;
    for (const seller of [...city.buildings, ...(depot ? [depot] : [])]) {
      if (!seller.active || seller.entity.destroyed) continue;
      const outputs = seller.type === 'farm' ? [seller.crop] : seller.type === 'bakery' ? ['pao'] : seller.type === 'mill' ? ['oleo'] : Object.keys(INDUSTRIES[seller.type]?.outputs || {});
      const stocked = seller.type === 'import_depot'
        ? Object.keys(seller.inventory || {}).filter(good => (seller.inventory[good] || 0) > (Object.values(seller.claims || {}).reduce((n, claim) => n + (claim?.[good] || 0), 0)))
        : ['market', 'greengrocer', 'restaurant'].includes(seller.type) ? Object.keys(seller.inventory || {}).filter(good => (seller.inventory[good] || 0) > 0 && city.economy.accepts(seller, good)) : [];
      for (const good of new Set([...outputs, ...stocked])) {
        const stock = seller.inventory?.[good] || 0;
        const claims = seller.type === 'import_depot' ? Object.values(seller.claims || {}).reduce((n, claim) => n + (claim?.[good] || 0), 0) : 0;
        const surplus = stock - Math.min(6, Math.floor(stock * .25)) - claims - (reserved.get(good) || 0);
        if (surplus < 1 || !GOODS[good]) continue;
        const unitPrice = Math.max(1, Math.ceil(GOODS[good].price * .9 - ROUTE_FREIGHT_PER_UNIT));
        const existing = byGood.get(good);
        if (existing) existing.quantity += surplus;
        else byGood.set(good, { good, quantity: surplus, unitPrice });
      }
    }
    return [...byGood.values()].map(offer => ({ ...offer, quantity: Math.min(offer.quantity, ROUTE_CAPACITY) }));
  }

  /** Real needs this city wants to import, with affordability limits. */
  computeDemand() {
    const city = this.ownCity;
    if (!city) return [];
    const demand = [];
    for (const buyer of city.buildings) {
      if (!buyer.active || buyer.entity.destroyed) continue;
      const recipe = city.vehicles?.recipeFor?.(buyer)?.inputs || INDUSTRIES[buyer.type]?.inputs || {};
      const wanted = new Map(Object.entries(recipe).map(([good, quantity]) => [good, quantity * 6]));
      if (['market', 'greengrocer', 'restaurant'].includes(buyer.type)) {
        for (const good of city.economy.retailAssortment?.(buyer) || []) wanted.set(good, 12);
      }
      for (const [good, target] of wanted) {
        if (!GOODS[good]) continue;
        const need = Math.max(0, target - (buyer.inventory?.[good] || 0) - (buyer.incoming?.[good] || 0) - (buyer.worldIncoming?.[good] || 0) - (buyer.importIncoming?.[good] || 0));
        if (need < 1) continue;
        const account = city.accounts.get(buyer.accountId), landed = Math.max(1, (GOODS[good].price || 1) + ROUTE_FREIGHT_PER_UNIT);
        const reserve = Math.max(city.currency.price(500), buyer.workers.length * (buyer.wage || 0) * 12);
        const affordable = Number.isFinite(account?.balance) ? Math.floor(Math.max(0, (account.balance - reserve)) / landed) : ROUTE_CAPACITY;
        const quantity = Math.min(need, affordable, ROUTE_CAPACITY);
        if (quantity < 1) continue;
        demand.push({ good, quantity, destinationBuildingId: buyer.id, payerAccountId: buyer.accountId });
      }
    }
    return demand;
  }

  /** Residents considering emigration to `destination`, scored like the local autonomous rule. */
  migrationCandidates(destination) {
    const city = this.ownCity;
    if (!city) return {};
    const summary = destination?.summary || {}, population = Math.max(1, summary.population || 1);
    const vacant = Math.max(0, (summary.units || 0) - (summary.occupied || 0));
    const jobRate = (summary.openJobs || 0) / population, homeRate = vacant / population;
    const fromStats = city.stats(), fromVacant = Math.max(0, fromStats.units - fromStats.occupied);
    const fromJobRate = fromStats.vacancies / Math.max(1, fromStats.population), fromHomeRate = fromVacant / Math.max(1, fromStats.population);
    const seen = new Set();
    let best = null, bestScore = 28;
    for (const citizen of city.citizens) {
      if (seen.has(citizen.id) || !city.society.isAdult(citizen) || citizen.dead || citizen.entity.destroyed || citizen.worldMigrationPending) continue;
      const memberIds = city.worldMigrationHousehold(citizen.id);
      if (!memberIds?.length) continue;
      for (const id of memberIds) seen.add(id);
      const family = memberIds.map(id => city.society.citizen(id)).filter(Boolean), adults = family.filter(person => city.society.isAdult(person));
      const jobSeekers = adults.filter(person => !person.jobId && !person.businessIds?.length).length, workingAdults = adults.length - jobSeekers;
      const unemployed = jobSeekers > 0, homeless = family.some(person => !person.homeUnitId);
      const happiness = family.reduce((sum, person) => sum + (person.happiness || 0), 0) / Math.max(1, family.length);
      const minimumNeed = Math.min(...family.flatMap(person => Object.values(person.needs || {})));
      if (!unemployed && !homeless && happiness >= 48 && minimumNeed >= 35) continue;
      if (vacant < Math.max(1, Math.ceil(family.length / 2)) || (summary.openJobs || 0) < Math.max(jobSeekers, workingAdults)) continue;
      const pressure = (unemployed ? 18 : 0) + (homeless ? 18 : 0) + Math.max(0, 48 - happiness) * .7 + Math.max(0, 35 - minimumNeed) * .35;
      const wellbeing = ((summary.averageHappiness || 0) - fromStats.happiness) * .65;
      const jobAdvantage = (jobRate - fromJobRate) * 100, homeAdvantage = (homeRate - fromHomeRate) * 100;
      const temperament = .8 + (citizen.traits?.ambition ?? .5) * .25 + (citizen.traits?.riskTolerance ?? .5) * .2;
      const score = (pressure + wellbeing + Math.max(-8, jobAdvantage * 24) + Math.max(-8, homeAdvantage * 28)) * temperament;
      if (score > bestScore) { bestScore = score; best = { citizenId: citizen.id, household: memberIds.length > 1, reason: unemployed ? 'work' : homeless ? 'housing' : 'wellbeing' }; }
    }
    return best || {};
  }
}
