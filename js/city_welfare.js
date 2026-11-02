/** Means-tested transfers use existing treasury funds and a daily envelope. */
export class CityWelfare {
  constructor(city) {
    this.city = city; this.policy = { enabled: true, dailyBudget: Math.max(100000,(city.initialPopulation||0)*600), householdFloor: 2500, cashTarget: 6000, reserve: 500000 };
    this.day = city.day; this.spentToday = 0; this.totalPaid = 0; this.paid = new Map();
  }
  conditions() {
    const city=this.city;
    if(this._conditionsMinute===city.minute)return this._conditions;
    const people=city.citizens.filter(c=>!c.entity.destroyed),adults=people.filter(c=>city.society.isAdult(c)),foods=city.workMeals.foodGoods();
    const stock=city.buildings.filter(b=>b.active&&!b.entity.destroyed).reduce((n,b)=>n+foods.reduce((s,g)=>s+(b.inventory[g]||0),0),0)+people.reduce((n,c)=>n+c.provisions*3+(c.pocket?.food||[]).reduce((sum,m)=>sum+Object.values(m.inputs).reduce((a,q)=>a+q,0),0),0);
    const hungry=people.filter(c=>c.needs.food<30).length,homeless=adults.filter(c=>!c.homeUnitId).length;
    this._conditionsMinute=city.minute;
    return this._conditions={population:people.length,hungry,homeless,foodDays:stock/Math.max(1,people.length*6),cleanliness:city.sanitation.cleanliness().score,reserve:city.fiscal?.reserve()??city.currency.price(Math.max(this.policy.reserve,people.length*3000)),crisis:hungry>=Math.max(3,people.length*.1)||homeless>=Math.max(5,adults.length*.2)};
  }
  restockPublicMeals() {
    this.city.economy.refillPopularRefectory();
  }
  subsistenceFloor(c){
    const city=this.city,dependents=city.childrenOf(c.id).filter(child=>!child.entity.destroyed&&!city.society.isAdult(child)).length,factor=1+dependents*.5;
    return Math.ceil(Math.max(city.currency.price(this.policy.householdFloor)*factor,(city.fiscal?.foodCost()||city.currency.price(800))*3*factor));
  }
  mealAssistanceEligible(c){
    const city=this.city,payer=city.accounts.get(city.payerFor(c)),cash=payer?.balance||0,floor=this.subsistenceFloor(c),assets=cash+city.bank.savings(payer?.accountId||city.payerFor(c));
    return assets<=floor*2||cash<=floor;
  }
  mealContribution(holder,citizen,offer){
    if(!offer||!citizen||!['popular_refectory','townhall'].includes(holder.type))return offer;
    const city=this.city,payer=city.accounts.get(city.payerFor(citizen)),cash=payer?.balance||0,floor=this.subsistenceFloor(citizen);
    if(this.mealAssistanceEligible(citizen))return offer;
    const cost=Object.entries(offer.inputs||{}).reduce((n,[good,q])=>n+(city.economy.goods[good]?.price||0)*q,0),price=Math.ceil(cost*1.5);return {...offer,price:Math.min(price,Math.max(0,cash-floor))};
  }
  hourly() {
    const city = this.city;
    if (this.day !== city.day) { this.day = city.day; this.spentToday = 0; this.paid.clear(); }
    // Credit goes to people with income; assistance reaches households without sufficient means.
    city.fiscal?.hourly();
    city.bank.householdFinance();
    this.restockPublicMeals();
    city.water.hourly();
    if (!this.policy.enabled) return;
    const adults = city.citizens.filter(c => !c.entity.destroyed && city.society.isAdult(c)).sort((a,b) => Number(b.needs.food<30)-Number(a.needs.food<30)||a.balance-b.balance || a.id-b.id);
    for (const [index,c] of adults.entries()) {
      const target = this.subsistenceFloor(c);
      const savings = city.bank.savings(c.accountId);
      const already = this.paid.get(c.id) || 0;
      const envelope=Math.max(0,this.policy.dailyBudget-this.spentToday),share=Math.ceil(envelope/Math.max(1,adults.length-index));
      const amount = Math.min(Math.max(0,target-c.balance-savings), Math.max(0,target-already), share, Math.max(0,city.treasury));
      if (amount <= 0 || !city.transfer('treasury',c.accountId,amount,'Benefício municipal de subsistência',{essential:true})) continue;
      this.spentToday += amount; this.totalPaid += amount; this.paid.set(c.id,already+amount);
      c.benefitsReceived = (c.benefitsReceived || 0) + amount;
    }
  }
}
