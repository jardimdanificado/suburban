import { EventEmitter } from 'node:events';
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { acceptWebSockets } from './websocket.mjs';

export const TRANSFER_ACTIVE = ['reserving', 'scheduled', 'in-transit'];
const REQUEST_TIMEOUT_MS = 15000;
const ROUTE_TRAVEL_MINUTES = 180;
const ROUTE_CAPACITY = 100;
const ROUTE_FREIGHT_PER_UNIT = 1;
const REGIONAL_TRADE_COOLDOWN_MS = 45000;
const ROUTE_MIN_LOAD_WAIT_MINUTES = 240;

const safeInt = value => Number.isSafeInteger(value) ? value : null;

/** Online coordinator: registry of client cities, escrow transfers and a persisted ledger. */
export class WorldServer extends EventEmitter {
  constructor({ dataDir = null, now = () => Date.now(), log = () => {}, regionalTradeCooldownMs = REGIONAL_TRADE_COOLDOWN_MS } = {}) {
    super();
    this.now = now;
    this.log = log;
    this.cities = new Map();
    this.transfers = new Map();
    this.contracts = new Map();
    this.policies = new Map();
    this.history = [];
    this.nextTransferNumber = 1;
    this.nextContractNumber = 1;
    this.nextPolicyNumber = 1;
    this.pendingRequests = new Map();
    this.regionalTradeLastAttempt = new Map();
    this.regionalTradeCooldownMs = regionalTradeCooldownMs;
    this.freightWaiting = new Map();
    this.autonomousMigrationDays = new Map();
    this._saveTimer = null;
    this.dataDir = dataDir;
    this.ledgerPath = dataDir ? join(dataDir, 'ledger.json') : null;
    if (dataDir) mkdirSync(dataDir, { recursive: true });
    this._loadLedger();
  }

  // ── Persistence ──────────────────────────────────────────────────────────
  _loadLedger() {
    if (!this.ledgerPath) return;
    let data;
    try { data = JSON.parse(readFileSync(this.ledgerPath, 'utf8')); }
    catch { return; }
    if (data?.version !== 1) return;
    this.nextTransferNumber = safeInt(data.nextTransferNumber) || 1;
    this.nextContractNumber = safeInt(data.nextContractNumber) || 1;
    this.nextPolicyNumber = safeInt(data.nextPolicyNumber) || 1;
    for (const transfer of data.transfers || []) if (transfer?.id && TRANSFER_ACTIVE.includes(transfer.status)) this.transfers.set(transfer.id, transfer);
    for (const contract of data.contracts || []) if (contract?.id && contract.active) this.contracts.set(contract.id, contract);
    for (const policy of data.policies || []) if (policy?.id && policy.active) this.policies.set(policy.id, policy);
    this.history = Array.isArray(data.history) ? data.history.slice(-500) : [];
  }

  saveLedger() { if (!this.ledgerPath || this._saveTimer) return; this._saveTimer = setTimeout(() => { this._saveTimer = null; this.flushLedger(); }, 120); this._saveTimer.unref?.(); }

  flushLedger() {
    if (!this.ledgerPath) return;
    if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
    try {
      const payload = this._ledgerPayload();
      const tmp = `${this.ledgerPath}.tmp`;
      writeFileSync(tmp, JSON.stringify(payload));
      renameSync(tmp, this.ledgerPath);
    } catch (error) { this.log(`Falha ao persistir o ledger: ${error.message}`); }
  }

  _ledgerPayload() {
    return {
      version: 1,
      savedAt: new Date(this.now()).toISOString(),
      nextTransferNumber: this.nextTransferNumber,
      nextContractNumber: this.nextContractNumber,
      nextPolicyNumber: this.nextPolicyNumber,
      transfers: [...this.transfers.values()],
      contracts: [...this.contracts.values()],
      policies: [...this.policies.values()],
      history: this.history.slice(-500),
    };
  }

  // ── Registry ─────────────────────────────────────────────────────────────
  routes() {
    const routes = new Map();
    const known = [...this.cities.values()];
    for (const origin of known) for (const destination of known) {
      if (origin.cityId === destination.cityId || !origin.online || !destination.online) continue;
      const id = `route:${origin.cityId}>${destination.cityId}`;
      routes.set(id, { id, originCityId: origin.cityId, destinationCityId: destination.cityId, travelMinutes: ROUTE_TRAVEL_MINUTES, capacity: ROUTE_CAPACITY, freightPerUnit: ROUTE_FREIGHT_PER_UNIT });
    }
    return routes;
  }

  routeFor(originCityId, destinationCityId) {
    return this.routes().get(`route:${originCityId}>${destinationCityId}`) || null;
  }

  cityDirectory(city) {
    return {
      cityId: city.cityId, name: city.name, online: city.online,
      minute: city.minute, summary: city.summary, port: city.port, goods: city.goods,
    };
  }

  broadcast(message, exceptSession = null) {
    for (const city of this.cities.values()) if (city.session && city.session !== exceptSession) city.session.sendJson(message);
  }

  sendTo(cityId, message) {
    const city = this.cities.get(cityId);
    return !!city?.session?.sendJson(message);
  }

  handleHello(session, message) {
    const cityId = typeof message.cityId === 'string' && message.cityId.trim() ? message.cityId.trim() : null;
    if (!cityId) { session.sendJson({ type: 'error', message: 'A cidade precisa de um identificador estável.' }); return; }
    const existing = this.cities.get(cityId);
    // Two different worlds must never share an identifier. A takeover is only
    // valid when the previous session is already dead (crashed browser).
    if (existing?.session && existing.session !== session && existing.session.open) {
      session.sendJson({ type: 'error', message: `O identificador ${cityId} já está conectado neste servidor. Feche a outra aba/janela do mundo ou gere um novo identificador.` });
      session.close(4002, 'identificador em uso');
      return;
    }
    const record = existing || { cityId, joinedAt: this.now() };
    if (existing?.session && existing.session !== session) { try { existing.session.close(4001, 'A cidade reconectou em outra conexão.'); } catch {} }
    record.session = session;
    record.online = true;
    record.name = typeof message.name === 'string' && message.name.trim() ? message.name.trim() : cityId;
    record.minute = Number.isFinite(message.minute) && message.minute >= 0 ? Math.floor(message.minute) : 0;
    record.summary = message.summary && typeof message.summary === 'object' ? message.summary : null;
    record.port = message.port && typeof message.port === 'object' ? message.port : null;
    record.goods = message.goods && typeof message.goods === 'object' ? message.goods : {};
    record.lastSeenAt = this.now();
    this.cities.set(cityId, record);
    session.cityId = cityId;
    const directory = [...this.cities.values()].filter(entry => entry.online && entry.cityId !== cityId).map(entry => this.cityDirectory(entry));
    session.sendJson({
      type: 'welcome',
      self: this.cityDirectory(record),
      cities: directory,
      routes: [...this.routes().values()],
      transfers: [...this.transfers.values()].filter(transfer => [transfer.originCityId, transfer.destinationCityId].includes(cityId)),
      contracts: [...this.contracts.values()].filter(contract => [contract.buyerCityId, contract.sellerCityId].includes(cityId)),
      policies: [...this.policies.values()].filter(policy => [policy.originCityId, policy.destinationCityId].includes(cityId)),
    });
    this.broadcast({ type: 'city-online', city: this.cityDirectory(record) }, session);
    this.log(`Cidade online: ${record.name} (${cityId})`);
    this.emit('city-online', record);
    // A city coming back may hold stale reservations from a lost escrow; let it clean up.
    for (const transfer of this.transfers.values()) {
      if (![transfer.originCityId, transfer.destinationCityId].includes(cityId)) continue;
      if (transfer.status === 'delivered' || transfer.status === 'cancelled') continue;
      session.sendJson({ type: 'transfer', transfer });
    }
    // Cancelments decided while this city was offline also need local cleanup.
    for (const record of this.history) {
      if (record.kind || record.status !== 'cancelled') continue;
      if (![record.originCityId, record.destinationCityId].includes(cityId)) continue;
      session.sendJson({ type: 'transfer', transfer: record });
    }
    this.saveLedger();
  }

  handleSummary(session, message) {
    const city = this.cities.get(session.cityId);
    if (!city) return;
    if (Number.isFinite(message.minute)) city.minute = Math.floor(message.minute);
    if (message.summary && typeof message.summary === 'object') city.summary = message.summary;
    if (message.port && typeof message.port === 'object') city.port = message.port;
    if (message.goods && typeof message.goods === 'object') city.goods = message.goods;
    city.lastSeenAt = this.now();
    this.broadcast({ type: 'city-summary', ...this.cityDirectory(city) }, session);
  }

  handleDisconnect(session) {
    const city = this.cities.get(session.cityId);
    if (!city || city.session !== session) return;
    city.session = null;
    city.online = false;
    this.broadcast({ type: 'city-offline', cityId: city.cityId, city: this.cityDirectory(city) });
    this.log(`Cidade offline: ${city.name} (${city.cityId})`);
    this.emit('city-offline', city);
    // Escrows interrupted by the disconnect roll back immediately; scheduled
    // voyages and deliveries wait for the city to come back.
    for (const transfer of [...this.transfers.values()]) {
      if (![transfer.originCityId, transfer.destinationCityId].includes(city.cityId)) continue;
      if (transfer.status === 'reserving') void this._failTransfer(transfer, 'A cidade desconectou durante a reserva.');
    }
  }

  // ── Request relay ────────────────────────────────────────────────────────
  request(cityId, method, args, { timeout = REQUEST_TIMEOUT_MS } = {}) {
    const city = this.cities.get(cityId);
    if (!city?.session) return Promise.resolve({ ok: false, message: `A cidade ${cityId} não está conectada.` });
    const reqId = `req-${this.nextTransferNumber++}-${this.now().toString(36)}`;
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        resolve({ ok: false, message: `A cidade ${cityId} não respondeu a ${method}.`, timeout: true });
      }, timeout);
      timer.unref?.();
      this.pendingRequests.set(reqId, { resolve, timer, cityId, method });
      city.session.sendJson({ type: 'request', reqId, method, args });
    });
  }

  handleResponse(session, message) {
    const pending = this.pendingRequests.get(message.reqId);
    if (!pending || pending.cityId !== session.cityId) return;
    this.pendingRequests.delete(message.reqId);
    clearTimeout(pending.timer);
    pending.resolve({ ok: message.ok === true, value: message.value, message: message.message });
  }

  // ── Escrow transfers ─────────────────────────────────────────────────────
  freightQuote(quantity) { return Math.ceil(ROUTE_FREIGHT_PER_UNIT * (ROUTE_CAPACITY * .35 + quantity * .65)); }

  // Uma viagem carrega uma ou várias cargas (payload.shipments, no formato do
  // master): cada carga tem escrow próprio e ids próprios na simulação, e o
  // barco sai recheado com produtos variados — quanto mais cheio, menor o
  // frete por item.
  async createGoodsTransfer({ id, originCityId, destinationCityId, payload, contractId = null, notifyFailure = null }) {
    const input = Array.isArray(payload?.shipments) ? payload.shipments : [{ ...payload }];
    const route = this.routeFor(originCityId, destinationCityId);
    const shipments = input.map((manifest, index) => ({ id: `${id}:s${index}`, manifest: { kind: 'goods', ...structuredClone(manifest) } }));
    const quantity = shipments.reduce((n, s) => n + s.manifest.quantity, 0);
    const transfer = {
      id, kind: 'goods', originCityId, destinationCityId, contractId,
      payload: {
        kind: 'goods', quantity, totalQuantity: quantity,
        goodsAmount: shipments.reduce((n, s) => n + s.manifest.goodsAmount, 0),
        freightAmount: shipments.reduce((n, s) => n + s.manifest.freightAmount, 0),
        shipments, crewReserved: false, crewTransferId: `${id}:crew`,
      },
      status: 'reserving',
      createdAt: { wall: this.now(), originMinute: this.cities.get(originCityId)?.minute ?? 0 },
      departureMinute: null, arrivalMinute: null, departedAt: null, deliveredAt: null, cancelledAt: null, lastError: null,
    };
    this.transfers.set(id, transfer);
    this._publishTransfer(transfer);
    const sellerOnline = !!this.cities.get(originCityId)?.online, buyerOnline = !!this.cities.get(destinationCityId)?.online;
    if (!sellerOnline || !buyerOnline) return this._failTransfer(transfer, sellerOnline ? 'A cidade compradora não está conectada.' : 'A cidade vendedora não está conectada.', notifyFailure);
    for (const shipment of shipments) {
      const ok = await this._escrowShipment(transfer, originCityId, destinationCityId, shipment, notifyFailure);
      if (!ok) return null; // _escrowShipment já desfaz a carga que falhou; _failTransfer desfaz as anteriores
    }
    transfer.status = 'scheduled';
    transfer.departureMinute = (this.cities.get(originCityId)?.minute ?? 0) + 1;
    transfer.arrivalMinute = (this.cities.get(destinationCityId)?.minute ?? 0) + (route?.travelMinutes || ROUTE_TRAVEL_MINUTES);
    this._publishTransfer(transfer);
    this.saveLedger();
    return transfer;
  }

  /** Escrow de uma carga: reserva exportação → pagamento → importação, na ordem do master. */
  async _escrowShipment(transfer, originCityId, destinationCityId, shipment, notifyFailure = null) {
    const m = shipment.manifest;
    const step = await this.request(originCityId, 'reserveWorldExport', [shipment.id, m.sellerBuildingId ?? null, m.good, m.quantity]);
    if (!step.ok) return this._failTransfer(transfer, `Reserva de exportação recusada (${m.good}): ${step.message}`, notifyFailure) && false;
    m.exportReserved = true;
    const info = await this.request(originCityId, 'worldExportReservationInfo', [shipment.id]);
    if (info.ok && info.value && typeof info.value === 'object') {
      m.sellerBuildingId = info.value.buildingId ?? m.sellerBuildingId;
      m.sellerAccountId = info.value.accountId ?? null;
    }
    const payment = await this.request(destinationCityId, 'reserveWorldPayment', [shipment.id, m.payerAccountId, m.amount]);
    if (!payment.ok) return this._failTransfer(transfer, `Reserva de pagamento recusada (${m.good}): ${payment.message}`, notifyFailure) && false;
    m.paymentReserved = true;
    const importReservation = await this.request(destinationCityId, 'reserveWorldImport', [shipment.id, m.destinationBuildingId ?? null, m.good, m.quantity]);
    if (!importReservation.ok) {
      await this.request(destinationCityId, 'refundWorldPayment', [shipment.id]);
      return this._failTransfer(transfer, `Reserva de importação recusada (${m.good}): ${importReservation.message}`, notifyFailure) && false;
    }
    m.importReserved = true;
    return true;
  }

  async _failTransfer(transfer, message, notifyFailure = null) {
    transfer.lastError = message;
    await this._rollback(transfer);
    transfer.status = 'cancelled';
    transfer.cancelledAt = this.now();
    this.transfers.delete(transfer.id);
    this.history.push({ ...structuredClone(transfer), status: 'cancelled' });
    this._publishTransfer(transfer);
    this.saveLedger();
    this.log(`Transferência ${transfer.id} cancelada: ${message}`);
    if (notifyFailure) notifyFailure(message);
    return null;
  }

  async _rollback(transfer) {
    const { originCityId: origin, destinationCityId: destination, payload, kind } = transfer;
    try {
      if (payload.crewReserved) await this.request(origin, 'returnWorldBoatCrew', [payload.crewTransferId]);
      if (kind === 'citizen') {
        await this.request(origin, payload.package?.version === 2 ? 'cancelWorldHouseholdMigration' : 'cancelWorldCitizenMigration', [transfer.id]);
      } else {
        for (const shipment of payload.shipments || []) {
          const m = shipment.manifest;
          if (m.exportReserved) await this.request(origin, 'returnWorldExport', [shipment.id]);
          if (m.importReserved || m.paymentReserved) await this.request(destination, 'cancelWorldImport', [shipment.id]);
          if (m.paymentReserved) await this.request(destination, 'refundWorldPayment', [shipment.id]);
        }
      }
    } catch (error) { this.log(`Falha ao desfazer ${transfer.id}: ${error.message}`); }
  }

  _publishTransfer(transfer) {
    const message = { type: 'transfer', transfer: structuredClone(transfer) };
    this.sendTo(transfer.originCityId, message);
    if (transfer.destinationCityId !== transfer.originCityId) this.sendTo(transfer.destinationCityId, message);
    this.emit('transfer', structuredClone(transfer));
  }

  async cancelTransfer(transferId, requesterCityId = null) {
    const transfer = this.transfers.get(transferId);
    if (!transfer || !['reserving', 'scheduled'].includes(transfer.status)) return false;
    if (requesterCityId && ![transfer.originCityId, transfer.destinationCityId].includes(requesterCityId)) return false;
    transfer.lastError = 'Cancelada por pedido.';
    await this._rollback(transfer);
    transfer.status = 'cancelled';
    transfer.cancelledAt = this.now();
    this.transfers.delete(transfer.id);
    this.history.push(structuredClone(transfer));
    this._publishTransfer(transfer);
    this.saveLedger();
    return true;
  }

  // ── Periodic processing ──────────────────────────────────────────────────
  async tick() {
    await this._departDueTransfers();
    await this._deliverDueTransfers();
    await this._processContracts();
    await this._processRegionalTrade();
    await this._processMigrationPolicies();
    await this._processAutonomousMigrations();
  }

  async _departDueTransfers() {
    for (const transfer of this.transfers.values()) {
      if (transfer.status !== 'scheduled') continue;
      const origin = this.cities.get(transfer.originCityId), destination = this.cities.get(transfer.destinationCityId);
      if (!origin?.online || !destination?.online) continue;
      if ((origin.minute ?? 0) < transfer.departureMinute) continue;
      if (!transfer.payload.crewReserved) {
        const crew = await this.request(origin.cityId, 'reserveWorldBoatCrew', [transfer.payload.crewTransferId, null, null]);
        if (!crew.ok || !crew.value) continue;
        if (!crew.value.ready) continue;
        const departedCrew = await this.request(origin.cityId, 'departWorldBoatCrew', [transfer.payload.crewTransferId]);
        if (!departedCrew.ok) continue;
        transfer.payload.crewReserved = true;
        transfer.payload.crew = crew.value; // piloto para o renderer desenhar a bordo
        this._publishTransfer(transfer);
      }
      if (transfer.kind === 'goods' && transfer.payload.shipments) {
        // Todas as cargas precisam estar no porão antes da partida.
        let loaded = true;
        for (const shipment of transfer.payload.shipments) {
          const departure = await this.request(origin.cityId, 'departWorldExport', [shipment.id]);
          if (!departure.ok) { loaded = false; break; }
        }
        if (!loaded) continue;
      } else {
        const departMethod = transfer.kind === 'citizen'
          ? (transfer.payload.package?.version === 2 ? 'departWorldHouseholdMigration' : 'departWorldCitizenMigration')
          : 'departWorldExport';
        const departure = await this.request(origin.cityId, departMethod, [transfer.id]);
        if (!departure.ok) continue;
      }
      transfer.status = 'in-transit';
      transfer.departedAt = { wall: this.now(), originMinute: origin.minute };
      this._publishTransfer(transfer);
      this.saveLedger();
    }
  }

  async _deliverDueTransfers() {
    for (const transfer of this.transfers.values()) {
      if (transfer.status !== 'in-transit') continue;
      const destination = this.cities.get(transfer.destinationCityId), origin = this.cities.get(transfer.originCityId);
      if (!destination?.online) continue;
      if ((destination.minute ?? 0) < (transfer.arrivalMinute ?? 0)) continue;
      const payload = transfer.payload;
      try {
        if (transfer.kind === 'citizen') {
          const household = payload.package?.version === 2;
          const arrival = await this.request(destination.cityId, household ? 'receiveWorldHouseholdMigration' : 'receiveWorldCitizenMigration', [transfer.id, payload.package]);
          if (!arrival.ok) continue;
          const completion = await this.request(origin.cityId, household ? 'completeWorldHouseholdMigration' : 'completeWorldCitizenMigration', [transfer.id]);
          if (!completion.ok) continue;
          if (payload.crewReserved) await this.request(origin.cityId, 'returnWorldBoatCrew', [payload.crewTransferId]);
        } else {
          let delivered = true;
          for (const shipment of transfer.payload.shipments || []) {
            const m = shipment.manifest;
            const received = await this.request(destination.cityId, 'receiveWorldImport', [shipment.id, m.good, m.quantity]);
            if (!received.ok) { delivered = false; continue; }
            const deliveredShipment = await this.request(destination.cityId, 'deliverWorldImport', [shipment.id, m.destinationBuildingId ?? null]);
            if (!deliveredShipment.ok) { delivered = false; continue; }
            const income = await this.request(origin.cityId, 'receiveWorldPayment', [shipment.id, m.payerAccountId, m.amount]);
            if (!income.ok) { delivered = false; continue; }
            const settlement = await this.request(origin.cityId, 'settleWorldPayment', [shipment.id, m.sellerAccountId, m.goodsAmount, m.freightAmount, null]);
            if (!settlement.ok) { delivered = false; continue; }
            await this.request(origin.cityId, 'completeWorldExport', [shipment.id]);
            await this.request(destination.cityId, 'finalizeWorldPayment', [shipment.id]);
            m.delivered = true;
          }
          if (!delivered) {
            transfer.payload.deliveredShipments = (transfer.payload.shipments || []).filter(s => s.manifest.delivered).length;
            this._publishTransfer(transfer); // progresso parcial visível na UI
            continue;
          }
          if (payload.crewReserved) await this.request(origin.cityId, 'returnWorldBoatCrew', [payload.crewTransferId]);
        }
      } catch (error) { transfer.lastError = error.message; continue; }
      transfer.status = 'delivered';
      transfer.deliveredAt = { wall: this.now(), destinationMinute: destination.minute };
      this.transfers.delete(transfer.id);
      this.history.push(structuredClone(transfer));
      this._publishTransfer(transfer);
      this.saveLedger();
      this.log(`Transferência ${transfer.id} entregue.`);
    }
  }

  // ── Contracts ────────────────────────────────────────────────────────────
  async createContract(requesterCityId, spec) {
    const good = typeof spec.good === 'string' ? spec.good : null;
    const quantity = safeInt(spec.quantity), unitPrice = safeInt(spec.unitPrice), intervalMinutes = safeInt(spec.intervalMinutes) || 1440;
    const sellerCityId = typeof spec.sellerCityId === 'string' ? spec.sellerCityId : null;
    if (!good || !this.cities.get(requesterCityId)?.summary || !quantity || quantity < 1 || !unitPrice || unitPrice < 1) throw new Error('Os dados do contrato não são válidos.');
    if (!sellerCityId || !this.cities.get(sellerCityId)) throw new Error('A cidade vendedora do contrato é desconhecida.');
    if (sellerCityId === requesterCityId) throw new Error('O contrato precisa ligar cidades diferentes.');
    const id = `contract-${this.nextContractNumber++}`;
    const contract = {
      id, buyerCityId: requesterCityId, sellerCityId, good, quantity, unitPrice, intervalMinutes,
      destinationBuildingId: spec.destinationBuildingId ?? null, payerAccountId: spec.payerAccountId ?? null,
      nextAttemptMinute: (this.cities.get(requesterCityId)?.minute ?? 0) + 1, active: true,
      createdAt: this.now(), lastError: null, transfersCreated: 0,
    };
    this.contracts.set(id, contract);
    this._publishContract(contract);
    this.saveLedger();
    return contract;
  }

  cancelContract(id, requesterCityId) {
    const contract = this.contracts.get(id);
    if (!contract || !contract.active) return false;
    if (contract.buyerCityId !== requesterCityId) return false;
    contract.active = false;
    contract.cancelledAt = this.now();
    this.contracts.delete(id);
    this.history.push({ kind: 'contract', ...structuredClone(contract) });
    for (const city of this.cities.values()) city.session?.sendJson({ type: 'contract:removed', id });
    this.saveLedger();
    return true;
  }

  _publishContract(contract) {
    const message = { type: 'contract', contract: structuredClone(contract) };
    this.sendTo(contract.buyerCityId, message);
    this.sendTo(contract.sellerCityId, message);
    this.emit('contract', structuredClone(contract));
  }

  async _processContracts() {
    for (const contract of [...this.contracts.values()]) {
      const buyer = this.cities.get(contract.buyerCityId), seller = this.cities.get(contract.sellerCityId);
      if (!buyer?.online || !seller?.online) continue;
      if ((buyer.minute ?? 0) < contract.nextAttemptMinute) continue;
      const busy = [...this.transfers.values()].some(transfer => transfer.contractId === contract.id && transfer.status !== 'delivered');
      if (busy) continue;
      const amount = contract.quantity * contract.unitPrice;
      const freight = this.freightQuote(contract.quantity);
      contract.nextAttemptMinute = (buyer.minute ?? 0) + contract.intervalMinutes;
      const transfer = await this.createGoodsTransfer({
        id: `${contract.id}-t${this.nextTransferNumber++}`,
        originCityId: contract.sellerCityId, destinationCityId: contract.buyerCityId,
        payload: {
          good: contract.good, quantity: contract.quantity, unitPrice: contract.unitPrice,
          goodsAmount: amount, freightAmount: freight, amount: amount + freight,
          destinationBuildingId: contract.destinationBuildingId, payerAccountId: contract.payerAccountId,
        },
        contractId: contract.id,
      });
      if (transfer) { contract.transfersCreated++; contract.lastError = null; }
      else contract.lastError = 'Não foi possível agendar a compra do contrato.';
      this._publishContract(contract);
      this.saveLedger();
    }
  }

  // ── Autonomous regional trade ────────────────────────────────────────────
  async _processRegionalTrade() {
    const now = this.now();
    for (const route of this.routes().values()) {
      const last = this.regionalTradeLastAttempt.get(route.id) || 0;
      if (now - last < this.regionalTradeCooldownMs) continue;
      this.regionalTradeLastAttempt.set(route.id, now);
      const busy = [...this.transfers.values()].some(transfer =>
        (transfer.originCityId === route.originCityId && transfer.destinationCityId === route.destinationCityId) && transfer.status !== 'delivered');
      if (busy) continue;
      const offers = await this.request(route.originCityId, 'worldOffers', []);
      if (!offers.ok || !Array.isArray(offers.value) || !offers.value.length) continue;
      const demand = await this.request(route.destinationCityId, 'worldDemand', []);
      if (!demand.ok || !Array.isArray(demand.value) || !demand.value.length) continue;
      // Consolidação (como o master): enche o porão com produtos variados até a
      // capacidade da rota — o frete por item cai quanto mais cheio o barco.
      const shipments = [];
      let total = 0;
      const usedDemand = new Set();
      for (const offer of offers.value) {
        const need = demand.value.find(entry => entry.good === offer.good && !usedDemand.has(`${offer.good}:${entry.destinationBuildingId}`));
        if (!need) continue;
        const quantity = Math.min(route.capacity - total, offer.quantity, need.quantity);
        if (quantity < 1) continue;
        const unitPrice = safeInt(offer.unitPrice);
        if (!unitPrice || unitPrice < 1) continue;
        const goodsAmount = quantity * unitPrice, freightAmount = this.freightQuote(quantity);
        usedDemand.add(`${offer.good}:${need.destinationBuildingId}`);
        shipments.push({
          good: offer.good, quantity, unitPrice, goodsAmount, freightAmount,
          amount: goodsAmount + freightAmount,
          destinationBuildingId: need.destinationBuildingId ?? null,
          payerAccountId: need.payerAccountId ?? null,
        });
        total += quantity;
        if (total === route.capacity) break;
      }
      if (!shipments.length) continue;
      // Não parte com a embarcação ociosa: espera o lote útil (25% da
      // capacidade) ou o fim da paciência (240 minutos simulados).
      const minLoad = Math.max(1, Math.ceil(route.capacity * .25));
      const originMinute = this.cities.get(route.originCityId)?.minute ?? 0;
      if (total < minLoad) {
        const wait = this.freightWaiting.get(route.id);
        if (!wait) { this.freightWaiting.set(route.id, { sinceOriginMinute: originMinute }); continue; }
        if (originMinute - wait.sinceOriginMinute < ROUTE_MIN_LOAD_WAIT_MINUTES) continue;
        this.log(`Rota ${route.id}: paciência de carregamento esgotada; navegando com ${total} unidades.`);
      }
      this.freightWaiting.delete(route.id);
      await this.createGoodsTransfer({
        id: `regional-${route.id}-t${this.nextTransferNumber++}`,
        originCityId: route.originCityId, destinationCityId: route.destinationCityId,
        payload: { shipments },
      });
      break; // One municipal voyage per route at a time.
    }
  }

  // ── Migration policies ───────────────────────────────────────────────────
  async createMigrationPolicy(requesterCityId, spec) {
    const destinationCityId = typeof spec.destinationCityId === 'string' ? spec.destinationCityId : null;
    if (!destinationCityId || !this.cities.get(destinationCityId)) throw new Error('A cidade de destino da migração é desconhecida.');
    if (destinationCityId === requesterCityId) throw new Error('A política precisa ligar cidades diferentes.');
    const id = `policy-${this.nextPolicyNumber++}`;
    const policy = {
      id, originCityId: requesterCityId, destinationCityId,
      intervalMinutes: safeInt(spec.intervalMinutes) || 1440,
      maxTransfers: safeInt(spec.maxTransfers) || 5,
      nextAttemptMinute: (this.cities.get(requesterCityId)?.minute ?? 0) + 1,
      transfersCreated: 0, active: true, createdAt: this.now(), lastError: null,
    };
    this.policies.set(id, policy);
    this._publishPolicy(policy);
    this.saveLedger();
    return policy;
  }

  cancelMigrationPolicy(id, requesterCityId) {
    const policy = this.policies.get(id);
    if (!policy || !policy.active || policy.originCityId !== requesterCityId) return false;
    policy.active = false;
    this.policies.delete(id);
    this.history.push({ kind: 'policy', ...structuredClone(policy) });
    for (const city of this.cities.values()) city.session?.sendJson({ type: 'policy:removed', id });
    this.saveLedger();
    return true;
  }

  _publishPolicy(policy) {
    const message = { type: 'policy', policy: structuredClone(policy) };
    this.sendTo(policy.originCityId, message);
    this.sendTo(policy.destinationCityId, message);
    this.emit('policy', structuredClone(policy));
  }

  async _processMigrationPolicies() {
    for (const policy of [...this.policies.values()]) {
      const origin = this.cities.get(policy.originCityId), destination = this.cities.get(policy.destinationCityId);
      if (!origin?.online || !destination?.online) continue;
      if ((origin.minute ?? 0) < policy.nextAttemptMinute) continue;
      policy.nextAttemptMinute = (origin.minute ?? 0) + policy.intervalMinutes;
      const destinationStats = {
        cityId: destination.cityId, name: destination.name,
        summary: destination.summary, port: destination.port, goods: destination.goods,
      };
      const candidates = await this.request(origin.cityId, 'worldMigrationCandidates', [destinationStats]);
      if (!candidates.ok || !candidates.value || typeof candidates.value !== 'object') { policy.lastError = candidates.message || 'Nenhum candidato informado.'; this._publishPolicy(policy); continue; }
      const choice = candidates.value;
      if (!choice.citizenId) { policy.lastError = null; continue; }
      const transfer = await this.createCitizenTransfer({
        id: `${policy.id}-m${this.nextTransferNumber++}`,
        originCityId: policy.originCityId, destinationCityId: policy.destinationCityId,
        citizenId: choice.citizenId, household: choice.household === true, reason: 'policy',
      });
      if (transfer) { policy.transfersCreated++; policy.lastError = null; if (policy.transfersCreated >= policy.maxTransfers) { policy.active = false; this.policies.delete(policy.id); } }
      else policy.lastError = 'A migração automática não pôde ser agendada.';
      this._publishPolicy(policy);
      this.saveLedger();
    }
  }

  // ── Autonomous migration (rodada diária, sem intervenção do jogador) ─────
  async _processAutonomousMigrations() {
    for (const origin of this.cities.values()) {
      if (!origin?.online) continue;
      const day = Math.floor((origin.minute ?? 0) / 1440);
      if (this.autonomousMigrationDays.get(origin.cityId) === day) continue;
      const destinations = [...this.routes().values()].filter(route => route.originCityId === origin.cityId && this.cities.get(route.destinationCityId)?.online);
      if (!destinations.length) continue;
      // Uma rodada por dia de origem, como no master: avalia todos os
      // destinos, escolhe o morador com a melhor oportunidade e embarca um.
      this.autonomousMigrationDays.set(origin.cityId, day);
      let best = null, bestDestination = null;
      for (const route of destinations) {
        const destination = this.cities.get(route.destinationCityId);
        const answer = await this.request(origin.cityId, 'worldMigrationCandidates', [{
          cityId: destination.cityId, name: destination.name, summary: destination.summary, port: destination.port, goods: destination.goods,
        }]);
        const choice = answer.ok ? answer.value : null;
        if (choice?.citizenId && Number.isFinite(choice.score) && choice.score > (best?.score ?? 0)) { best = choice; bestDestination = destination; }
      }
      if (!best) continue;
      await this.createCitizenTransfer({
        id: `autonomous-${origin.cityId}-d${day}-t${this.nextTransferNumber++}`,
        originCityId: origin.cityId, destinationCityId: bestDestination.cityId,
        citizenId: best.citizenId, household: best.household === true, reason: best.reason || 'autonomous',
      });
      this.log(`Migração autônoma: morador de ${origin.cityId} partiu para ${bestDestination.cityId} (${best.reason || 'autônoma'}).`);
    }
  }

  // ── Citizen migration ────────────────────────────────────────────────────
  async createCitizenTransfer({ id, originCityId, destinationCityId, citizenId, household = false, reason = null, notifyFailure = null }) {
    const origin = this.cities.get(originCityId), destination = this.cities.get(destinationCityId);
    if (!origin?.online || !destination?.online) { notifyFailure?.('As duas cidades precisam estar conectadas.'); return null; }
    const transfer = {
      id, kind: 'citizen', originCityId, destinationCityId, reason,
      payload: { kind: 'citizen', household }, status: 'reserving',
      createdAt: { wall: this.now(), originMinute: origin.minute ?? 0 },
      departureMinute: null, arrivalMinute: null, departedAt: null, deliveredAt: null, cancelledAt: null, lastError: null,
    };
    this.transfers.set(id, transfer);
    this._publishTransfer(transfer);
    const method = household ? 'reserveWorldHouseholdMigration' : 'reserveWorldCitizenMigration';
    const reservation = await this.request(originCityId, method, [id, citizenId]);
    const value = reservation.value;
    if (!reservation.ok || !value || typeof value !== 'object' || !value.globalId) {
      transfer.lastError = reservation.message || 'Este morador não está elegível para embarque.';
      await this._rollback(transfer);
      transfer.status = 'cancelled';
      this.transfers.delete(transfer.id);
      this.history.push(structuredClone(transfer));
      this._publishTransfer(transfer);
      notifyFailure?.(transfer.lastError);
      return null;
    }
    transfer.payload.package = value;
    transfer.status = 'scheduled';
    transfer.departureMinute = (origin.minute ?? 0) + 1;
    transfer.arrivalMinute = (destination.minute ?? 0) + (this.routeFor(originCityId, destinationCityId)?.travelMinutes || ROUTE_TRAVEL_MINUTES);
    transfer.payload.crewTransferId = `${id}:crew`;
    this._publishTransfer(transfer);
    this.saveLedger();
    return transfer;
  }

  async handleMigrationOrder(requesterCityId, order) {
    const destinationCityId = typeof order.destinationCityId === 'string' ? order.destinationCityId : null;
    const citizenId = safeInt(order.citizenId);
    if (!destinationCityId || citizenId == null) {
      this.sendTo(requesterCityId, { type: 'trade:failed', message: 'Pedido de migração inválido.' });
      return;
    }
    await this.createCitizenTransfer({
      id: `migrant-${this.nextTransferNumber++}`,
      originCityId: requesterCityId, destinationCityId, citizenId,
      household: order.household === true, reason: order.reason ?? null,
      notifyFailure: message => this.sendTo(requesterCityId, { type: 'trade:failed', message }),
    });
  }

  async handleTradeOrder(requesterCityId, order) {
    const sellerCityId = typeof order.sellerCityId === 'string' ? order.sellerCityId : null;
    const good = typeof order.good === 'string' ? order.good : null;
    const quantity = safeInt(order.quantity), unitPrice = safeInt(order.unitPrice);
    if (!sellerCityId || !good || !quantity || quantity < 1 || !unitPrice || unitPrice < 1) {
      this.sendTo(requesterCityId, { type: 'trade:failed', message: 'Pedido de compra inválido.' });
      return;
    }
    const seller = this.cities.get(sellerCityId);
    if (!seller?.online || !this.cities.get(requesterCityId)?.online) {
      this.sendTo(requesterCityId, { type: 'trade:failed', message: 'As duas cidades precisam estar conectadas.' });
      return;
    }
    const route = this.routeFor(sellerCityId, requesterCityId);
    if (!route) { this.sendTo(requesterCityId, { type: 'trade:failed', message: 'Não há rota marítima entre as cidades.' }); return; }
    if (quantity > route.capacity) { this.sendTo(requesterCityId, { type: 'trade:failed', message: `A carga excede a capacidade da rota (${route.capacity}).` }); return; }
    const goodsAmount = quantity * unitPrice, freightAmount = this.freightQuote(quantity);
    // A compra entra no porão de uma viagem já programada para a mesma rota
    // quando houver espaço: o barco sai recheado com produtos variados.
    const batch = [...this.transfers.values()]
      .filter(candidate => candidate.kind === 'goods' && candidate.status === 'scheduled'
        && candidate.originCityId === sellerCityId && candidate.destinationCityId === requesterCityId
        && (candidate.payload.totalQuantity ?? 0) + quantity <= route.capacity)
      .at(-1);
    if (batch) {
      const shipment = {
        id: `${batch.id}:s${batch.payload.shipments.length}`,
        manifest: {
          kind: 'goods', good, quantity, unitPrice, goodsAmount, freightAmount, amount: goodsAmount + freightAmount,
          destinationBuildingId: order.destinationBuildingId ?? null,
          payerAccountId: order.payerAccountId ?? null,
          sellerBuildingId: order.sellerBuildingId ?? null,
        },
      };
      const escrowed = await this._escrowShipment(batch, sellerCityId, requesterCityId, shipment,
        message => this.sendTo(requesterCityId, { type: 'trade:failed', message }));
      if (escrowed) {
        batch.payload.shipments.push(shipment);
        batch.payload.totalQuantity += quantity;
        batch.payload.quantity += quantity;
        batch.payload.goodsAmount += goodsAmount;
        batch.payload.freightAmount += freightAmount;
        this._publishTransfer(batch);
        this.saveLedger();
        this.log(`Compra manual entrou no porão da viagem ${batch.id} (${batch.payload.shipments.length} cargas).`);
        return;
      }
      return; // _escrowShipment já notificou o comprador e cancelou a viagem de destino se preciso
    }
    // Sem viagem aberta para entrar: exige embarcação livre antes de criar uma nova.
    if (!this._assertRouteAvailable(sellerCityId, requesterCityId)) return;
    const transfer = await this.createGoodsTransfer({
      id: `trade-${this.nextTransferNumber++}`,
      originCityId: sellerCityId, destinationCityId: requesterCityId,
      payload: {
        good, quantity, unitPrice, goodsAmount, freightAmount, amount: goodsAmount + freightAmount,
        destinationBuildingId: order.destinationBuildingId ?? null,
        payerAccountId: order.payerAccountId ?? null,
        sellerBuildingId: order.sellerBuildingId ?? null,
      },
      notifyFailure: message => this.sendTo(requesterCityId, { type: 'trade:failed', message }),
    });
    if (!transfer) this.sendTo(requesterCityId, { type: 'trade:failed', message: 'A compra não pôde ser agendada.' });
  }

  /** Sem viagem aberta para entrar: a compra precisa de embarcação livre na rota. */
  _assertRouteAvailable(sellerCityId, requesterCityId) {
    const busy = [...this.transfers.values()].some(transfer =>
      transfer.kind === 'goods' && transfer.originCityId === sellerCityId && transfer.destinationCityId === requesterCityId && transfer.status !== 'delivered');
    if (busy) { this.sendTo(requesterCityId, { type: 'trade:failed', message: 'A embarcação desta rota já está comprometida em outra viagem.' }); return false; }
    return true;
  }

  // ── Message dispatch ─────────────────────────────────────────────────────
  handleMessage(session, raw) {
    let message;
    try { message = JSON.parse(raw); } catch { session.sendJson({ type: 'error', message: 'Mensagem inválida.' }); return; }
    if (!message || typeof message.type !== 'string') return;
    switch (message.type) {
      case 'hello': this.handleHello(session, message); return;
      case 'summary': this.handleSummary(session, message); return;
      case 'response': this.handleResponse(session, message); return;
      case 'trade:order': if (session.cityId) void this.handleTradeOrder(session.cityId, message.order || {}); return;
      case 'migration:order': if (session.cityId) void this.handleMigrationOrder(session.cityId, message.order || {}); return;
      case 'contract:create':
        if (session.cityId) {
          try { this.createContract(session.cityId, message.contract || {}); }
          catch (error) { session.sendJson({ type: 'trade:failed', message: error.message }); }
        }
        return;
      case 'contract:cancel': if (session.cityId) this.cancelContract(message.id, session.cityId); return;
      case 'policy:create':
        if (session.cityId) {
          try { this.createMigrationPolicy(session.cityId, message.policy || {}); }
          catch (error) { session.sendJson({ type: 'trade:failed', message: error.message }); }
        }
        return;
      case 'policy:cancel': if (session.cityId) this.cancelMigrationPolicy(message.id, session.cityId); return;
      case 'transfer:cancel': if (session.cityId) void this.cancelTransfer(message.transferId, session.cityId); return;
      default: return;
    }
  }

  stop() {
    if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; this.saveLedger(); }
    for (const city of this.cities.values()) { try { city.session?.close(1001, 'Servidor encerrando.'); } catch {} }
  }
}

export function startWorldServer({ port = 8787, dataDir = null, log = console.log } = {}) {
  const httpServer = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: 'ok', server: 'suburban-world', time: new Date().toISOString() }));
  });
  const world = new WorldServer({ dataDir, log });
  acceptWebSockets(httpServer, {
    onConnection: session => {
      session.on('message', raw => { try { world.handleMessage(session, raw); } catch (error) { log(`Erro ao tratar mensagem: ${error.message}`); } });
      session.on('close', () => world.handleDisconnect(session));
    },
  });
  const timer = setInterval(() => { void world.tick().catch(error => log(`Erro no ciclo do mundo: ${error.message}`)); }, 2000);
  timer.unref?.();
  return new Promise(resolve => {
    httpServer.listen(port, () => { log(`Servidor do mundo ouvindo na porta ${port}.`); resolve({ httpServer, world, stop: () => { clearInterval(timer); world.stop(); httpServer.close(); } }); });
  });
}

// Execução direta: `node server/world_server.mjs --port 8787 [--data server/data]`
import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const port = Number(args.find((arg, index) => args[index - 1] === '--port')) || 8787;
  const dataFlag = args.indexOf('--data');
  const dataDir = dataFlag >= 0 ? args[dataFlag + 1] : null;
  startWorldServer({ port, dataDir }).then(({ stop }) => {
    process.on('SIGINT', () => { stop(); process.exit(0); });
    process.on('SIGTERM', () => { stop(); process.exit(0); });
  });
}
