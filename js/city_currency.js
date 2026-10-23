/** A deliberately simple monetary model: issuance dilutes a fixed initial monetary base.
 * Transfers never issue currency. Existing escrows, debts and cash keep their nominal value.
 */
export const CURRENCY_RULES = { initialSupply: 12000000, citizenGrant: 100000, mintPerWorkMinute: 200, mintDailyLimit: 80000, priceAdjustment: .35 };

export class CityCurrency {
  constructor(city) {
    this.city = city; this.issued = 0; this.issuedToday = 0; this.issuedYesterday = 0;
    this.priceIndex = 1; this.dailyInflation = 0; this.mintDay = city.day;
    this.lastPriceDay = city.day; this.history = []; this.hourlyIssued = 0;
  }
  price(base) { return Math.max(0, Math.round(base * this.priceIndex)); }
  supply() { return [...this.city.accounts.values()].reduce((n, a) => n + a.balance, 0); }
  initialize() {
    if (this.issued) return false;
    this.issue(CURRENCY_RULES.initialSupply, true);
    return true;
  }
  issue(amount, initial = false) {
    if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(this.issued + amount) || !Number.isSafeInteger(this.city.treasury + amount)) return false;
    this.city.accounts.get('treasury').balance += amount; this.issued += amount;
    if (!initial) { this.issuedToday += amount; this.hourlyIssued += amount; }
    this.city.ledger.push({ minute: this.city.minute, from: 'mint', to: 'treasury', amount, reason: initial ? 'Emissão monetária inicial' : 'Emissão da casa da moeda' });
    if (this.city.ledger.length > 1000) this.city.ledger.shift();
    return true;
  }
  work(b, c) {
    if (b.type !== 'mint' || !b.active || b.entity.destroyed || !b.workers.includes(c.id) || c.jobId !== b.id || this.city.hour < 8 || this.city.hour >= 17 || Math.hypot(c.entity.x-b.door.x,c.entity.y-b.door.y)>2) return false;
    this.rollDay();
    const amount = Math.min(CURRENCY_RULES.mintPerWorkMinute, CURRENCY_RULES.mintDailyLimit - this.issuedToday);
    return amount > 0 && this.issue(amount);
  }
  rollDay() {
    if (this.mintDay === this.city.day) return;
    this.issuedYesterday = this.issuedToday; this.issuedToday = 0; this.mintDay = this.city.day;
  }
  hourly() {
    if (!this.hourlyIssued) return;
    this.city.log(`Casa da moeda emitiu R$ ${(this.hourlyIssued / 100).toFixed(2)} para o tesouro.`, 'economy', [], { kind: 'currency-issued', amount: this.hourlyIssued, total: this.issued });
    this.hourlyIssued = 0;
  }
  daily() {
    if (this.lastPriceDay === this.city.day) return;
    this.lastPriceDay = this.city.day;
    this.rollDay();
    const previous = this.priceIndex, target = this.issued / CURRENCY_RULES.initialSupply;
    this.priceIndex += (target - previous) * CURRENCY_RULES.priceAdjustment;
    this.dailyInflation = this.priceIndex / previous - 1;
    const ratio = this.priceIndex / previous;
    if (ratio !== 1) {
      for (const u of this.city.units.values()) { u.price = Math.round(u.price * ratio); u.rent = Math.round(u.rent * ratio); }
      for (const p of this.city.development.plots) { p.price = Math.round(p.price * ratio); p.rent = Math.round(p.rent * ratio); }
      for (const f of this.city.sanitation.facilities.values()) f.price = Math.round(f.price * ratio);
    }
    this.history.push({ day: this.city.day, issued: this.issuedYesterday, supply: this.supply(), priceIndex: this.priceIndex, inflation: this.dailyInflation });
    if (this.history.length > 120) this.history.shift();
    this.city.log(`Inflação diária: ${(this.dailyInflation * 100).toFixed(2)}%; acumulada: ${((this.priceIndex - 1) * 100).toFixed(2)}%.`, 'economy', [], { kind: 'inflation', daily: this.dailyInflation, priceIndex: this.priceIndex });
  }
}
