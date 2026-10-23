/** Per-account journals outlive the short city feed. Rows retain names at the time of the event. */
export class CityHistory {
  constructor(city) { this.city = city; this.journals = new Map(); this.nextId = 1; }
  record(kind, message, accounts = [], details = {}) {
    const entry = { id: this.nextId++, minute: this.city.minute, kind, message, ...details };
    for (const id of new Set(accounts.filter(Boolean))) {
      let journal = this.journals.get(id);
      if (!journal) { journal = { byKind: {}, total: 0, totals: {} }; this.journals.set(id, journal); }
      journal.total++; journal.totals[kind] = (journal.totals[kind] || 0) + 1;
      const rows = journal.byKind[kind] ??= [];
      rows.push(entry);
      // Keep a sizeable browsable journal plus lifetime event counts for each subject.
      if (rows.length > 2000) rows.shift();
    }
    return entry;
  }
  rows(account, kind = 'all') {
    const journal=this.journals.get(account);if(!journal)return [];
    if(kind!=='all')return journal.byKind[kind]||[];
    if(journal.cacheVersion!==journal.total){journal.cache=Object.values(journal.byKind).flat().sort((a,b)=>a.id-b.id);journal.cacheVersion=journal.total;}
    return journal.cache;
  }
  employment(c, b, action, reason = '') {
    this.record('employment', `${this.city.accountName(c.accountId)}: ${action} em ${b.entity.properties.name}${reason ? ` (${reason})` : ''}.`, [c.accountId, b.accountId], { action, buildingId: b.id, wage: b.wage, reason });
  }
  ownership(b, from, to, details = {}) {
    if(!b)return;
    this.record('ownership', `${b.entity.properties.name}: ${from?this.city.accountName(from):'Fundação'} → ${this.city.accountName(to)}${details.unitId ? ` / espaço ${details.unitId}` : ' / instalações'}.`, [b.accountId, from, to], { from, to, ...details });
  }
  transaction(from, to, amount, reason) {
    const sales = /^(Compra de espaço|Compra de instalações|Serviço: Venda)/.test(reason);
    const service = /^(Serviço|Frete entregue|Água para cuidados)/.test(reason) && !sales && !reason.startsWith('Serviço: Alimentação');
    const kind = sales ? 'sale' : service ? 'service' : 'finance';
    this.record(kind, `${reason}: ${this.city.accountName(from)} → ${this.city.accountName(to)}.`, [from, to], { from, to, amount });
  }
}
