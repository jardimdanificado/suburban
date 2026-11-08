import {employmentEvent} from './city_employment.js?v=fast-speeds-1';
/** Structured event journal, inspired by Brutopolis/event_log.js.
 * Stable IDs, subject/type indices and bounded retention; no entity references in exports. */
export const HISTORY_LIMIT = 16000;
export const FINANCE_HISTORY_LIMIT = 100000;
const categories = { employment: 'work', ownership: 'housing', sale: 'economy', service: 'economy', finance: 'finance', credit: 'credit', reputation: 'reputation' };
const unique = values => [...new Set(values.filter(value => value !== null && value !== undefined && value !== ''))];
const partyIdsFor=details=>unique([...(details.partyIds||[]),...['partyId','partyAId','partyBId','fromPartyId','toPartyId','parentPartyId','destinationPartyId','mergedPartyId','candidatePartyId','targetPartyId'].map(key=>details[key])]);
const lowerBound=(rows,id)=>{let lo=0,hi=rows.length;while(lo<hi){const mid=(lo+hi)>>>1;if(rows[mid].id<id)lo=mid+1;else hi=mid;}return lo;};
export class CityHistory {
  constructor(city) {
    this.favoriteActions = new Map(); this.favoriteIds = []; this.favoriteTargets = []; this.favoriteLimit = 20000; this.favoriteArchive = new Map(); this.favoriteRevision = 0;
    this.city = city; this.journals = new Map(); this.nextId = 1;
    this.entries = []; this.byId = new Map(); this.byKind = new Map(); this.byCategory = new Map();
    this.byCitizen = new Map(); this.byBuilding = new Map(); this.byReference = new Map();
    this.financeArchive=[];this.financeArchiveById=new Map();this.financeDropped=0;this.financeDroppedThroughId=0;this.financeDroppedThroughMinute=null;this.financeDroppedLegacyUnknown=false;
    this.total = 0; this.dropped = 0; this.lastGoodsEvent = new Map();
    this.pendingFinance = new Map(); this.pendingFinanceRevision = 0;
  }
  configureFavorites(ids = [], limit = 20000, targets = []) {
    this.favoriteIds = [...new Set(ids.filter(Number.isInteger))];
    this.favoriteTargets=[...new Set(targets.filter(id=>typeof id==='string'&&/^(business|party):\d+$/.test(id)))];
    const tracked=[...this.favoriteIds,...this.favoriteTargets];
    this.favoriteLimit = limit === 0 ? 0 : Math.max(1000, Math.min(1000000, Number(limit) || 20000));
    for (const id of this.favoriteArchive.keys()) if (!tracked.includes(id)) this.favoriteArchive.delete(id);
    for (const id of tracked) {
      const rows = new Map((this.favoriteArchive.get(id) || []).map(e => [e.id,e]));
      const source=typeof id==='number'?this.byCitizen.get(id):id.startsWith('business:')?this.byBuilding.get(Number(id.slice(9))):this.byReference.get(`partyId:${id.slice(6)}`);
      for (const e of source || []) rows.set(e.id,e);
      const sorted = [...rows.values()].sort((a,b)=>a.id-b.id);
      this.favoriteArchive.set(id, this.favoriteLimit ? sorted.slice(-this.favoriteLimit) : sorted);
    }
    for(const id of this.favoriteActions.keys())if(!this.favoriteIds.includes(id))this.favoriteActions.delete(id);
    for(const id of this.favoriteIds)if(!this.favoriteActions.has(id))this.favoriteActions.set(id,this.city.society?.citizen(id)?.action||'');
    this.favoriteRevision++;
    return true;
  }
  captureFavoriteActivities(){
    for(const id of this.favoriteIds){const c=this.city.society?.citizen(id);if(!c||c.entity.destroyed)continue;const action=String(c.action||'');if(action&&this.favoriteActions.get(id)!==action){this.favoriteActions.set(id,action);this.record('activity',`${c.entity.properties.name}: ${action}.`,[c.accountId],{citizenIds:[id],action:'favorite-activity',activity:action});}}
  }
  captureFavorite(entry) {
    for (const id of new Set([...(entry.citizenIds||[]),...(entry.buildingIds||[]).map(id=>`business:${id}`),...this.references(entry).filter(ref=>ref.startsWith('partyId:')).map(ref=>`party:${ref.slice(8)}`)])) if (this.favoriteArchive.has(id)) {
      const rows = this.favoriteArchive.get(id) || []; this.favoriteArchive.set(id, rows);
      if (rows.at(-1)?.id === entry.id) continue;
      rows.push(entry); if (this.favoriteLimit && rows.length > this.favoriteLimit) rows.splice(0, rows.length-this.favoriteLimit);
      this.favoriteRevision++;
    }
  }
  index(map, key, entry) {
    let rows = map.get(key); if (!rows) map.set(key, rows = []); rows.push(entry);
  }
  references(details) {
    return unique([...['airAccidentId','vehicleId','modelId','batchId','lineId','missionId','studyId','partyProposalId','publicationId','shipmentId','projectId','jobId','gigId','loanId','electionId','plantId','socialFactId','partyId','billId','termId','corruptionCaseId','interventionId','artId','caseId'].filter(key => details[key] != null).map(key => `${key}:${details[key]}`),...partyIdsFor(details).map(id=>`partyId:${id}`)]);
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
    details={...details,partyIds:unique([...partyIdsFor(details),...accounts.map(id=>this.city.accounts?.get(id)?.partyId),...accounts.filter(id=>/^party:\d+$/.test(String(id))).map(id=>Number(id.slice(6)))])};
    accounts=unique([...accounts,...details.partyIds.map(id=>`party:${id}`)]);
    const relatedEventIds = unique([...(details.relatedEventIds || []), details.parentEventId]);
    const refs = this.references(details);
    if(details.interventionId==null){const cause=[this.byId.get(details.parentEventId),...refs.filter(ref=>/^(projectId|gigId|jobId|studyId|billId|corruptionCaseId|artId):/.test(ref)).map(ref=>this.byReference.get(ref)?.at(-1))].find(e=>e?.interventionId!=null);if(cause)details={...details,interventionId:cause.interventionId};}
    // Link the workflow to its immediately preceding event; explicit causes can also be supplied.
    for (const ref of refs) { const last = this.byReference.get(ref)?.at(-1); if (last && !relatedEventIds.includes(last.id)) relatedEventIds.push(last.id); }
    const entry = { ...details, id: this.nextId++, minute: this.city.minute, kind,
      category: details.category || categories[kind] || kind, message, accounts,
      citizenIds: unique(citizens), buildingIds: unique(buildings), relatedEventIds,
      subjects: accounts.map(id => ({ accountId: id, name: this.city.accountName(id) })),
      data: { ...details, action: details.action || details.kind || kind } };
    this.appendEntry(entry);
    this.city.officialJournal?.capture(entry);
    if (this.entries.length > HISTORY_LIMIT + 512) this.prune();
    return entry;
  }
  appendEntry(entry) {
    this.captureFavorite(entry);
    this.total++; this.entries.push(entry); this.byId.set(entry.id, entry);
    if(entry.kind==='finance'&&!this.financeArchiveById.has(entry.id)){this.financeArchive.push(entry);this.financeArchiveById.set(entry.id,entry);if(this.financeArchive.length>FINANCE_HISTORY_LIMIT){const removed=this.financeArchive.shift();this.financeArchiveById.delete(removed.id);this.financeDropped++;this.financeDroppedThroughId=Math.max(this.financeDroppedThroughId,removed.id);this.financeDroppedThroughMinute=removed.minute;}}
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
    const financeAfter=cursor?.financeLastId??0;let low=0,high=this.financeArchive.length;while(low<high){const mid=(low+high)>>>1;if(this.financeArchive[mid].id<=financeAfter)low=mid+1;else high=mid;}const financeEntries=!cursor?this.financeArchive.slice():this.financeArchive.slice(low);
    const totals = [];
    const versions = cursor?.versions || new Map();
    for (const [account,journal] of this.journals) if (versions.get(account) !== journal.total) {
      totals.push([account,journal.total,{...journal.totals}]); versions.set(account,journal.total);
    }
    const favoriteConfig=JSON.stringify([this.favoriteIds,this.favoriteLimit,this.favoriteTargets]),resetFavorites=!cursor||cursor.favoriteConfig!==favoriteConfig;
    return { payload: { favorites: !cursor || cursor.favoriteRevision !== this.favoriteRevision ? {reset:resetFavorites,ids:this.favoriteIds,targets:this.favoriteTargets,limit:this.favoriteLimit,archive:[...this.favoriteArchive].map(([id,rows])=>[id,resetFavorites?rows:rows.slice(lowerBound(rows,after+1)),rows[0]?.id??this.nextId])} : null, reset: !cursor, entries, financeEntries,financeLastId:this.financeArchive.at(-1)?.id??0,financeFloor:this.financeArchive[0]?.id??this.nextId,financeDropped:this.financeDropped,financeDroppedThroughId:this.financeDroppedThroughId,financeDroppedThroughMinute:this.financeDroppedThroughMinute,financeDroppedLegacyUnknown:this.financeDroppedLegacyUnknown,totals, nextId: this.nextId, total: this.total,
      dropped: this.dropped, floor: this.entries[0]?.id ?? this.nextId,
      goods: count || !cursor ? [...this.lastGoodsEvent] : null,
      pendingFinance: !cursor || cursor.pendingRevision !== this.pendingFinanceRevision ? [...this.pendingFinance].map(([key,value])=>[key,{...value}]) : null,
      pendingRevision: this.pendingFinanceRevision },
      cursor: {favoriteConfig,favoriteRevision:this.favoriteRevision,lastId:this.nextId-1,financeLastId:this.financeArchive.at(-1)?.id??0,versions,pendingRevision:this.pendingFinanceRevision} };
  }
  applySnapshot(payload) {
    if (payload.reset) {
      this.entries.length = 0;
      this.financeArchive.length=0;this.financeArchiveById.clear();
      this.financeDropped=0;this.financeDroppedThroughId=0;this.financeDroppedThroughMinute=null;this.financeDroppedLegacyUnknown=false;
      for (const map of [this.journals,this.byId,this.byKind,this.byCategory,this.byCitizen,this.byBuilding,this.byReference,this.lastGoodsEvent]) map.clear();
      this.total=0; this.dropped=0;
    }
    for (const entry of payload.entries) if (!this.byId.has(entry.id)) this.appendEntry(entry);
    this.pruneBefore(payload.floor);
    if(payload.favorites){const f=payload.favorites;this.favoriteIds=f.ids;this.favoriteTargets=f.targets||[];this.favoriteLimit=f.limit;if(f.reset)this.favoriteArchive.clear();for(const id of this.favoriteArchive.keys())if(![...f.ids,...this.favoriteTargets].includes(id))this.favoriteArchive.delete(id);for(const [id,entries,floor]of f.archive){let rows=this.favoriteArchive.get(id)||[];const cut=lowerBound(rows,floor);if(cut)rows.splice(0,cut);const missing=entries.filter(e=>rows[lowerBound(rows,e.id)]?.id!==e.id);if(missing.length)rows=rows.concat(missing).sort((a,b)=>a.id-b.id);this.favoriteArchive.set(id,rows);}this.favoriteRevision++;}
    for(const entry of payload.financeEntries||[])if(!this.financeArchiveById.has(entry.id)){this.financeArchive.push(entry);this.financeArchiveById.set(entry.id,entry);}
    if(payload.reset)this.financeArchive.sort((a,b)=>a.id-b.id);if(payload.financeFloor!=null){let cut=0;while(cut<this.financeArchive.length&&this.financeArchive[cut].id<payload.financeFloor){this.financeArchiveById.delete(this.financeArchive[cut].id);cut++;}if(cut)this.financeArchive.splice(0,cut);}
    if(payload.financeDropped!=null)this.financeDropped=payload.financeDropped;else if(payload.reset&&payload.dropped>0){this.financeDroppedThroughId=Math.max(this.financeDroppedThroughId,(payload.floor||1)-1);this.financeDroppedLegacyUnknown=true;}
    if(payload.financeDroppedThroughId!=null)this.financeDroppedThroughId=payload.financeDroppedThroughId;
    if(payload.financeDroppedThroughMinute!=null)this.financeDroppedThroughMinute=payload.financeDroppedThroughMinute;
    if(payload.financeDroppedLegacyUnknown!=null)this.financeDroppedLegacyUnknown=payload.financeDroppedLegacyUnknown;
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
  get(id) {id=Number(id);const retained=this.byId.get(id)||this.financeArchiveById.get(id);if(retained)return retained;for(const rows of this.favoriteArchive.values()){const found=rows.find(e=>e.id===id);if(found)return found;}return undefined;}
  query({ category = 'all', kind = 'all', citizenId = null, buildingId = null, accountId = null, reference = null, query = '', beforeId = Infinity, limit = 100 } = {}) {
    const archiveKeys=[citizenId!=null?Number(citizenId):null,accountId&&/^citizen:/.test(accountId)?Number(accountId.slice(8)):accountId,buildingId!=null?`business:${buildingId}`:null,reference?.startsWith('partyId:')?`party:${reference.slice(8)}`:null];
    const archive=archiveKeys.filter(key=>key!=null).map(key=>this.favoriteArchive.get(key)).find(rows=>rows!==undefined);
    const sources = [this.entries];
    if (category !== 'all') sources.push(this.byCategory.get(category) || []);
    if (kind !== 'all') sources.push(this.byKind.get(kind) || []);
    if (citizenId != null) sources.push(this.byCitizen.get(Number(citizenId)) || []);
    if (buildingId != null) sources.push(this.byBuilding.get(Number(buildingId)) || []);
    if (accountId != null) sources.push(this.rows(accountId));
    if (reference) sources.push(this.byReference.get(reference) || []);
    const source = archive || sources.reduce((a,b) => a.length <= b.length ? a : b);
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
    const favorite = this.favoriteArchive.get(/^citizen:/.test(account)?Number(account.slice(8)):account);
    if(favorite)return kind==='all'?favorite:favorite.filter(e=>e.kind===kind);
    const journal = this.journals.get(account); if (!journal) return [];
    if (kind !== 'all') return journal.byKind[kind] || [];
    if (journal.cacheVersion !== journal.total || journal.cacheDropped !== this.dropped) {
      journal.cache = Object.values(journal.byKind).flat().sort((a,b) => a.id-b.id);
      journal.cacheVersion = journal.total; journal.cacheDropped = this.dropped;
    }
    return journal.cache;
  }
  employment(c, b, action, reason = '') {
    employmentEvent(this.city,c,b,action,reason);
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
