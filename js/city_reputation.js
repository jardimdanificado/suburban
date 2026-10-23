export const REPUTATION_LABELS = { reliability: 'Confiabilidade profissional', commerce: 'Reputação comercial', credit: 'Histórico de crédito', civic: 'Reputação pública' };
const bound = n => Math.max(0, Math.min(100, n));
/** Reputation changes only after observed actions. It never changes money or guarantees credit. */
export class CityReputation {
  constructor(city) { this.city = city; this.observations = 0; }
  setup(subject) { subject.reputation ??= { reliability: 50, commerce: 50, credit: 50, civic: 50 }; return subject.reputation; }
  score(subject, kind = 'commerce') { return (subject?.accountId==='treasury'?this.city.accounts.get('treasury')?.reputation:subject?.reputation)?.[kind] ?? 50; }
  observe(accountId, kind, delta, reason, details = {}) {
    const subject = this.city.accounts.get(accountId);
    if (!subject || !['reliability','commerce','credit','civic'].includes(kind)) return;
    const reputation = this.setup(subject), previous = reputation[kind];
    reputation[kind] = bound(previous + delta);
    if (previous === reputation[kind]) return;
    this.observations++;
    // Store changes as structured observations, with causes accessible from the dossier.
    this.city.history.record('reputation', `${this.city.accountName(accountId)}: ${reason}.`, [accountId],
      { dimension: kind, previous, value: reputation[kind], delta: reputation[kind] - previous, ...details });
  }
  providerPenalty(b) { return (50 - this.score(b, 'commerce')) * .12; }
  creditFactor(c) { return .6 + this.score(c, 'credit') / 100; }
  completed(provider, worker, reason, details = {}) {
    if (provider) {
      this.observe(provider.accountId, 'commerce', 1, reason, details);
      const owner = this.city.society.citizen(provider.ownerId);
      if (owner) this.observe(owner.accountId, 'commerce', .5, reason, details);
    }
    if (worker) this.observe(worker.accountId, 'reliability', .5, reason, details);
  }
}
