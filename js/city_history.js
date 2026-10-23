/** Structured event journal, inspired by Brutopolis/event_log.js.
 * Stable IDs, subject/type indices and bounded retention; no entity references in exports. */
export const HISTORY_LIMIT = 16000;
const categories = { employment: 'work', ownership: 'housing', sale: 'economy', service: 'economy', finance: 'finance', credit: 'credit', reputation: 'reputation' };
const unique = values => [...new Set(values.filter(value => value !== null && value !== undefined && value !== ''))];
export class CityHistory {
  constructor(city) {
    this.city = city; this.journals = new Map(); this.nextId = 1;
    this.entries = []; this.byId = new Map(); this.byKind = new Map(); this.byCategory = new Map();
    this.byCitizen = new Map(); this.byBuilding = new Map(); this.byReference = new Map();
    this.total = 0; this.dropped = 0; this.lastGoodsEvent = new Map();
    this.pendingFinance = new Map(); this.pendingFinanceRevision = 0;
  }
  index(map, key, entry) {
    let rows = map.get(key); if (!rows) map.set(key, rows = []); rows.push(entry);
  }
  references(details) {
    return ['shipmentId','projectId','jobId','loanId','electionId','plantId','socialFactId','partyId','billId','termId','corruptionCaseId'].filter(key => details[key] != null).map(key => `${key}:${details[key]}`);
  }
  record(kind, message, accounts = [], details = {}) {
    accounts = unique([...accounts, ...(details.accounts || [])]);
    const citizens = [...(details.citizenIds || [])], buildings = [...(details.buildingIds || [])];
    if (details.buildingId != null) buildings.push(details.buildingId);
    for (const id of accounts) {
      if (String(id).startsWith('citizen:')) citizens.push(Number(String(id).slice(8)));
      if (String(id).startsWith('business:')) buildings.push(Number(String(id).slice(9)));
      if (id === 'treasury') { const hall = this.city.buildings.find(b => b.type === 'townhall' && !b.entity.destroyed); if (hall) buildings.push(hall.id); }
    }
    for (const id of unique(citizens)) accounts.push(`citizen:${id}`);
    for (const id of unique(buildings)) { const b = this.city.building(id); if (b) accounts.push(b.accountId); }
    accounts = unique(accounts);
    const relatedEventIds = unique([...(details.relatedEventIds || []), details.parentEventId]);
    const refs = this.references(details);
    // Link the workflow to its immediately preceding event; explicit causes can also be supplied.
    for (const ref of refs) { const last = this.byReference.get(ref)?.at(-1); if (last && !relatedEventIds.includes(last.id)) relatedEventIds.push(last.id); }
    const entry = { ...details, id: this.nextId++, minute: this.city.minute, kind,
      category: details.category || categories[kind] || kind, message, accounts,
      citizenIds: unique(citizens), buildingIds: unique(buildings), relatedEventIds,
      subjects: accounts.map(id => ({ accountId: id, name: this.city.accountName(id) })),
      data: { ...details, action: details.action || details.kind || kind } };
    this.appendEntry(entry);
    if (this.entries.length > HISTORY_LIMIT + 512) this.prune();
    return entry;
  }
  appendEntry(entry) {
    this.total++; this.entries.push(entry); this.byId.set(entry.id, entry);
    this.index(this.byKind, entry.kind, entry); this.index(this.byCategory, entry.category, entry);
    for (const id of entry.citizenIds) this.index(this.byCitizen, id, entry);
    for (const id of entry.buildingIds) this.index(this.byBuilding, id, entry);
    for (const ref of this.references(entry)) this.index(this.byReference, ref, entry);
    for (const id of entry.accounts) {
      let journal = this.journals.get(id);
      if (!journal) { journal = { byKind: {}, total: 0, totals: {} }; this.journals.set(id, journal); }
      journal.total++; journal.totals[entry.kind] = (journal.totals[entry.kind] || 0) + 1;
      const rows = journal.byKind[entry.kind] ??= []; rows.push(entry);
      if (rows.length > 2000) rows.shift();
    }
  }
  prune() { this.pruneBefore(this.entries[this.entries.length - HISTORY_LIMIT]?.id || this.nextId); }
  pruneBefore(floor) {
    let count = 0; while (count < this.entries.length && this.entries[count].id < floor) count++;
    if (!count) return;
    const removed = this.entries.splice(0, count);
    this.dropped += removed.length;
    for (const e of removed) this.byId.delete(e.id);
    for (const [key,id] of this.lastGoodsEvent) if (id < floor) this.lastGoodsEvent.delete(key);
    for (const map of [this.byKind, this.byCategory, this.byCitizen, this.byBuilding, this.byReference]) {
      for (const [key, rows] of map) {
        let n = 0; while (n < rows.length && rows[n].id < floor) n++;
        if (n) rows.splice(0, n); if (!rows.length) map.delete(key);
      }
    }
    for (const journal of this.journals.values()) for (const rows of Object.values(journal.byKind)) {
      let n = 0; while (n < rows.length && rows[n].id < floor) n++; if (n) rows.splice(0, n);
    }
  }
  // Journals use a dedicated append-only wire format. Their indices are rebuilt locally,
  // so a movement snapshot never walks every immutable event and every index again.
  snapshotSince(cursor = null) {
    const after = cursor?.lastId ?? 0;
    const count = Math.max(0, this.nextId - 1 - after);
    const entries = count ? this.entries.slice(Math.max(0, this.entries.length - count)) : [];
    const totals = [];
    const versions = cursor?.versions || new Map();
    for (const [account,journal] of this.journals) if (versions.get(account) !== journal.total) {
      totals.push([account,journal.total,{...journal.totals}]); versions.set(account,journal.total);
    }
    return { payload: { reset: !cursor, entries, totals, nextId: this.nextId, total: this.total,
      dropped: this.dropped, floor: this.entries[0]?.id ?? this.nextId,
      goods: count || !cursor ? [...this.lastGoodsEvent] : null,
      pendingFinance: !cursor || cursor.pendingRevision !== this.pendingFinanceRevision ? [...this.pendingFinance].map(([key,value])=>[key,{...value}]) : null,
      pendingRevision: this.pendingFinanceRevision },
      cursor: {lastId:this.nextId-1,versions,pendingRevision:this.pendingFinanceRevision} };
  }
  applySnapshot(payload) {
    if (payload.reset) {
      this.entries.length = 0;
      for (const map of [this.journals,this.byId,this.byKind,this.byCategory,this.byCitizen,this.byBuilding,this.byReference,this.lastGoodsEvent]) map.clear();
      this.total=0; this.dropped=0;
    }
    for (const entry of payload.entries) if (!this.byId.has(entry.id)) this.appendEntry(entry);
    this.pruneBefore(payload.floor);
    for (const [account,total,totals] of payload.totals) {
      let journal=this.journals.get(account);
      if (!journal) {journal={byKind:{},total:0,totals:{}};this.journals.set(account,journal);}
      journal.total=total;journal.totals=totals;
    }
    if (payload.goods) this.lastGoodsEvent=new Map(payload.goods);
    if (payload.pendingFinance) this.pendingFinance=new Map(payload.pendingFinance);
    this.pendingFinanceRevision=payload.pendingRevision??0;
    this.nextId=payload.nextId;this.total=payload.total;this.dropped=payload.dropped;
  }
  get(id) { return this.byId.get(Number(id)); }
  query({ category = 'all', kind = 'all', citizenId = null, buildingId = null, accountId = null, reference = null, query = '', beforeId = Infinity, limit = 100 } = {}) {
    const sources = [this.entries];
    if (category !== 'all') sources.push(this.byCategory.get(category) || []);
    if (kind !== 'all') sources.push(this.byKind.get(kind) || []);
    if (citizenId != null) sources.push(this.byCitizen.get(Number(citizenId)) || []);
    if (buildingId != null) sources.push(this.byBuilding.get(Number(buildingId)) || []);
    if (accountId != null) sources.push(this.rows(accountId));
    if (reference) sources.push(this.byReference.get(reference) || []);
    const source = sources.reduce((a,b) => a.length <= b.length ? a : b);
    const search = query.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR'), result = [];
    for (let i = source.length - 1; i >= 0 && result.length < limit; i--) {
      const e = source[i];
      if (e.id >= beforeId || category !== 'all' && e.category !== category || kind !== 'all' && e.kind !== kind || citizenId != null && !e.citizenIds.includes(Number(citizenId)) || buildingId != null && !e.buildingIds.includes(Number(buildingId)) || accountId != null && !e.accounts.includes(accountId) || reference && !this.references(e).includes(reference)) continue;
      if (search && !e.message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').includes(search)) continue;
      result.push(e);
    }
    return result;
  }
  rows(account, kind = 'all') {
    const journal = this.journals.get(account); if (!journal) return [];
    if (kind !== 'all') return journal.byKind[kind] || [];
    if (journal.cacheVersion !== journal.total || journal.cacheDropped !== this.dropped) {
      journal.cache = Object.values(journal.byKind).flat().sort((a,b) => a.id-b.id);
      journal.cacheVersion = journal.total; journal.cacheDropped = this.dropped;
    }
    return journal.cache;
  }
  employment(c, b, action, reason = '') {
    return this.record('employment', `${this.city.accountName(c.accountId)}: ${action} em ${b.entity.properties.name}${reason ? ` (${reason})` : ''}.`, [c.accountId,b.accountId], { action, buildingId: b.id, wage: b.wage, reason });
  }
  ownership(b, from, to, details = {}) {
    if (!b) return;
    return this.record('ownership', `${b.entity.properties.name}: ${from ? this.city.accountName(from) : 'Fundação'} → ${this.city.accountName(to)}${details.unitId ? ` / espaço ${details.unitId}` : ' / instalações'}.`, [b.accountId,from,to], { from,to,buildingId:b.id,...details });
  }
  flushFinance() {
    for (const row of this.pendingFinance.values()) {
      this.record('finance', `${row.reason}: ${this.city.accountName(row.from)} → ${this.city.accountName(row.to)} / consolidação horária de ${row.transactions} pagamentos.`, [row.from,row.to], row);
    }
    if(this.pendingFinance.size){this.pendingFinance.clear();this.pendingFinanceRevision++;}
  }
  transaction(from, to, amount, reason, details = {}) {
    if (['Salário','Imposto sobre salário','Subsídio salarial municipal'].includes(reason)) {
      const hour=Math.floor(this.city.minute/60),key=`${hour}|${from}|${to}|${reason}`;
      let row=this.pendingFinance.get(key);
      if(!row){row={from,to,reason,amount:0,transactions:0,startedAt:this.city.minute,endedAt:this.city.minute};this.pendingFinance.set(key,row);}
      row.amount+=amount;row.transactions++;row.endedAt=this.city.minute;this.pendingFinanceRevision++;
      return {id:null};
    }
    const sales = /^(Compra de espaço|Compra de instalações|Serviço: Venda)/.test(reason);
    const service = /^(Serviço|Frete entregue|Água para cuidados)/.test(reason) && !sales && !reason.startsWith('Serviço: Alimentação');
    return this.record(sales ? 'sale' : service ? 'service' : 'finance', `${reason}: ${this.city.accountName(from)} → ${this.city.accountName(to)}.`, [from,to], { from,to,amount,reason,...details });
  }
}
