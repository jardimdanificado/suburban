/** Full reserve deposits and loans funded exclusively by existing bank equity. */
export class CityBank {
  constructor(city) { this.city=city; this.deposits=new Map(); this.loans=[]; this.nextId=1; }
  available() { return this.city.economy.businesses.filter(b=>b.type==='bank' && b.workers.length); }
  deposit(bank, clientId, amount) {
    const city=this.city, client=city.accounts.get(clientId);
    if (!this.available().includes(bank) || !client || !Number.isSafeInteger(amount) || amount<=0) return false;
    const key=`deposit:${bank.id}:${clientId}`;
    let account=this.deposits.get(key);
    if (!account) { account={name:`Depósito de ${city.accountName(clientId)}`,balance:0,bankId:bank.id,clientId}; this.deposits.set(key,account);city.accounts.set(key,account); }
    return city.transfer(clientId,key,amount,'Depósito bancário');
  }
  withdraw(bank,clientId,amount) {
    if (!Number.isSafeInteger(amount) || amount<=0) return false;
    return this.city.transfer(`deposit:${bank.id}:${clientId}`,clientId,amount,'Saque bancário');
  }
  lend(bank, clientId, amount) {
    const city=this.city,client=city.accounts.get(clientId);
    if (!this.available().includes(bank) || !client || !city.society.isAdult(client) || !Number.isSafeInteger(amount) || amount<=0 || this.loans.some(l=>l.clientId===clientId && l.remaining>0)) return false;
    const income=client.jobId ? (city.building(client.jobId)?.wage||0)*240 : client.businessIds?.length ? 20000 : 0;
    const reserve=bank.workers.length*bank.wage*480;
    if (amount>income*12 || amount>Math.max(0,bank.balance-reserve)*.6 || !city.transfer(bank.accountId,clientId,amount,'Empréstimo bancário')) return false;
    const loan={id:this.nextId++,bankId:bank.id,clientId,principal:amount,remaining:amount,interest:0,dailyPayment:Math.ceil(amount/30),dueDay:city.day+1,missed:0};
    this.loans.push(loan);city.log(`Banco concedeu crédito de ${(amount/100).toFixed(2)} a ${city.accountName(clientId)}.`, 'economy', [client.id],{kind:'bank-loan',loanId:loan.id});return loan;
  }
  daily() {
    for(const loan of this.loans.filter(l=>l.remaining>0 && l.dueDay<=this.city.day)) {
      const bank=this.city.building(loan.bankId),client=this.city.accounts.get(loan.clientId); if(!bank || !client) continue;
      // Interest is a debt, never new currency; no compounding arrears.
      const interest=Math.ceil(loan.remaining*.002);loan.interest+=interest;
      const payment=Math.min(client.balance,loan.dailyPayment+loan.interest,loan.remaining+loan.interest);
      if(payment && this.city.transfer(loan.clientId,bank.accountId,payment,'Parcela de empréstimo')) { const paidInterest=Math.min(payment,loan.interest);loan.interest-=paidInterest;loan.remaining-=payment-paidInterest;bank.totalRevenue+=paidInterest; }
      loan.missed=payment<loan.dailyPayment?loan.missed+1:0;loan.dueDay=this.city.day+1;
    }
    this.loans=this.loans.filter(l=>l.remaining>0 || l.interest>0);
    for(const [key,deposit] of this.deposits) { const client=this.city.accounts.get(deposit.clientId);if(client && client.balance<20000 && deposit.balance>0) this.withdraw({id:deposit.bankId},deposit.clientId,Math.min(deposit.balance,20000-client.balance)); }
    for(const bank of this.available()) {
      const client=this.city.citizens.filter(c=>this.city.society.isAdult(c) && !c.entity.destroyed && c.balance>80000 && !this.deposits.get(`deposit:${bank.id}:${c.accountId}`)?.balance).sort((a,b)=>b.balance-a.balance)[0];
      if(client) this.deposit(bank,client.accountId,Math.floor(client.balance*.1));
    }
  }
}
