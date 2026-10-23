/** Means-tested transfers use existing treasury funds and a daily envelope. */
export class CityWelfare {
  constructor(city) {
    this.city = city; this.policy = { enabled: true, dailyBudget: 100000, householdFloor: 2500, cashTarget: 6000, reserve: 500000 };
    this.day = city.day; this.spentToday = 0; this.totalPaid = 0; this.paid = new Map();
  }
  hourly() {
    const city = this.city;
    if (this.day !== city.day) { this.day = city.day; this.spentToday = 0; this.paid.clear(); }
    // Credit goes to people with income; assistance reaches households without sufficient means.
    city.bank.householdFinance();
    if (!this.policy.enabled) return;
    const adults = city.citizens.filter(c => !c.entity.destroyed && city.society.isAdult(c)).sort((a,b) => a.balance-b.balance || a.id-b.id);
    for (const c of adults) {
      const dependents = city.citizens.filter(child => child.guardianId === c.id && !city.society.isAdult(child)).length;
      const target = city.currency.price(this.policy.householdFloor * (1 + dependents * .5));
      const savings = city.bank.savings(c.accountId);
      const already = this.paid.get(c.id) || 0;
      const amount = Math.min(Math.max(0,target-c.balance-savings), Math.max(0,target-already), Math.max(0,this.policy.dailyBudget-this.spentToday), Math.max(0,city.treasury-this.policy.reserve));
      if (amount <= 0 || !city.transfer('treasury',c.accountId,amount,'Benefício municipal de subsistência')) continue;
      this.spentToday += amount; this.totalPaid += amount; this.paid.set(c.id,already+amount);
      c.benefitsReceived = (c.benefitsReceived || 0) + amount;
    }
  }
}
