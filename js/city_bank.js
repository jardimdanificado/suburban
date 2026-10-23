/** Deposits have full reserves; loans and savings interest use existing bank equity. */
export class CityBank {
  constructor(city) {
    this.city = city; this.deposits = new Map(); this.loans = []; this.nextId = 1;
    this.policy = { creditEnabled: true, loanRate: .002, savingsRate: .0005, cashReserve: 10000 };
  }
  available() { return this.city.economy.businesses.filter(b => b.type === 'bank' && b.workers.length && b.balance >= b.wage); }
  savings(clientId) { return [...this.deposits.values()].filter(d => d.clientId === clientId).reduce((n,d) => n+d.balance,0); }
  deposit(bank, clientId, amount) {
    const city = this.city, client = city.accounts.get(clientId);
    if (!this.available().includes(bank) || !client || !Number.isSafeInteger(amount) || amount <= 0) return false;
    const key = `deposit:${bank.id}:${clientId}`;
    let account = this.deposits.get(key);
    if (!account) {
      account = { name: `Poupança de ${city.accountName(clientId)}`, balance: 0, bankId: bank.id, clientId, interestEarned: 0 };
      this.deposits.set(key,account); city.accounts.set(key,account);
    }
    return city.transfer(clientId,key,amount,'Depósito em poupança');
  }
  withdraw(bank, clientId, amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0) return false;
    return this.city.transfer(`deposit:${bank.id}:${clientId}`,clientId,amount,'Resgate de poupança');
  }
  lend(bank, clientId, amount) {
    const city = this.city, client = city.accounts.get(clientId);
    if (!this.policy.creditEnabled || !this.available().includes(bank) || !client || client.entity?.destroyed || !city.society.isAdult(client) || !Number.isSafeInteger(amount) || amount <= 0 || this.loans.some(l => l.clientId === clientId && l.status !== 'paid')) return false;
    const income = client.jobId ? (city.building(client.jobId)?.wage || 0)*240 : client.businessIds?.length ? 20000 : 0;
    const reserve = bank.workers.length*bank.wage*480;
    if (amount > income*12 || amount > Math.max(0,bank.balance-reserve)*.6 || !city.transfer(bank.accountId,clientId,amount,'Empréstimo bancário')) return false;
    const loan = { id: this.nextId++, bankId: bank.id, clientId, principal: amount, remaining: amount, interest: 0, rate: this.policy.loanRate, dailyPayment: Math.ceil(amount/30), dueDay: city.day+1, missed: 0, status: 'active', startedAt: city.minute, paid: 0 };
    this.loans.push(loan);
    city.history.record('credit', `Crédito aprovado por ${bank.entity.properties.name}.`, [clientId,bank.accountId], { amount, rate:loan.rate, loanId:loan.id });
    return loan;
  }
  lendForBusiness(bank, founder, amount, proposal) {
    const city=this.city;
    if(!this.policy.creditEnabled || !this.available().includes(bank) || !Number.isSafeInteger(amount) || amount<=0 || proposal.score<60 || amount>proposal.budget || this.loans.some(l=>l.clientId===founder.accountId && l.purpose==='business' && !['paid','written-off'].includes(l.status)))return false;
    const cash=Math.max(0,bank.balance-bank.workers.length*bank.wage*480);
    if(amount>cash*.75 || !city.transfer(bank.accountId,founder.accountId,amount,'Crédito empresarial para atender demanda'))return false;
    const loan={id:this.nextId++,bankId:bank.id,clientId:founder.accountId,purpose:'business',businessType:proposal.type,principal:amount,remaining:amount,interest:0,rate:Math.min(this.policy.loanRate,.0005),dailyPayment:Math.ceil(amount/180),dueDay:city.day+1,missed:0,status:'active',startedAt:city.minute,paid:0};
    this.loans.push(loan);
    city.history.record('credit',`Crédito empresarial aprovado para ${city.buildingTypes[proposal.type].label}, com aplicação em terreno, materiais e operação.`,[founder.accountId,bank.accountId],{amount,loanId:loan.id,rate:loan.rate});
    return loan;
  }
  cancelBusinessLoan(loan) {
    const bank=this.city.accounts.get(`business:${loan.bankId}`);
    if(!bank || !this.city.transfer(loan.clientId,bank.accountId,loan.remaining,'Estorno de abertura de empresa'))return false;
    loan.remaining=0;loan.interest=0;loan.status='paid';loan.cancelled=true;return true;
  }
  householdFinance() {
    const city = this.city, banks = this.available();
    for (const c of city.citizens.filter(c => !c.entity.destroyed && city.society.isAdult(c))) {
      for (const deposit of this.deposits.values()) if (deposit.clientId === c.accountId && deposit.balance > 0 && c.balance < this.policy.cashReserve) this.withdraw({id:deposit.bankId},c.accountId,Math.min(deposit.balance,this.policy.cashReserve-c.balance));
      if (!banks.length) continue;
      if (c.balance < city.welfare.policy.cashTarget && (c.jobId || c.businessIds.length) && c.creditAllowed !== false) {
        for (const bank of banks) if (this.lend(bank,c.accountId,city.welfare.policy.cashTarget-c.balance)) break;
      }
      const amount = Math.floor(Math.max(0,c.balance-this.policy.cashReserve)*(c.savingsRate ?? .2));
      if (amount > 0) this.deposit(banks[0],c.accountId,amount);
    }
  }
  daily() {
    const city = this.city;
    for (const loan of this.loans.filter(l => l.status !== 'paid' && l.status !== 'written-off' && l.dueDay <= city.day)) {
      if(loan.purpose==='business' && loan.projectId){const project=city.development.projects.find(p=>p.id===loan.projectId);if(project && !project.cancelled && project.status!=='completed'){loan.dueDay=city.day+1;continue;}}
      const bank = city.building(loan.bankId), client = city.accounts.get(loan.clientId);
      if (!bank || !client) continue;
      const interest = Math.ceil(loan.remaining*loan.rate); loan.interest += interest;
      // Preserve a basic subsistence reserve; arrears do not create currency.
      const due = Math.min(loan.dailyPayment+loan.interest,loan.remaining+loan.interest);
      const payment = Math.min(Math.max(0,client.balance-city.currency.price(1500)),due);
      if (payment && city.transfer(loan.clientId,bank.accountId,payment,'Parcela de empréstimo')) {
        const paidInterest = Math.min(payment,loan.interest);
        loan.interest -= paidInterest; loan.remaining -= payment-paidInterest; loan.paid += payment; bank.totalRevenue += paidInterest;
      }
      loan.missed = payment < due ? loan.missed+1 : 0;
      loan.status = loan.remaining+loan.interest === 0 ? 'paid' : loan.missed >= 3 ? 'arrears' : 'active';
      if (loan.status === 'paid') city.history.record('credit','Empréstimo quitado.',[loan.clientId,bank.accountId],{loanId:loan.id,amount:loan.paid});
      loan.dueDay = city.day+1;
    }
    for (const [key,deposit] of this.deposits) {
      const bank = city.building(deposit.bankId);
      if (!bank?.active || !deposit.balance) continue;
      const interest = Math.min(Math.floor(deposit.balance*this.policy.savingsRate),Math.max(0,bank.balance-bank.workers.length*bank.wage*480));
      if (interest > 0 && city.transfer(bank.accountId,key,interest,'Rendimento de poupança')) { deposit.interestEarned += interest; bank.totalExpenses += interest; }
    }
  }
  closeClient(c, heir) {
    for (const [key,deposit] of this.deposits) if (deposit.clientId === c.accountId && deposit.balance) this.city.transfer(key,c.accountId,deposit.balance,'Resgate de poupança do espólio');
    for (const loan of this.loans.filter(l => l.clientId === c.accountId && !['paid','written-off'].includes(l.status))) {
      const bank = this.city.building(loan.bankId);
      const due = loan.remaining+loan.interest, amount = Math.min(c.balance,due);
      if (bank && amount && this.city.transfer(c.accountId,bank.accountId,amount,'Liquidação de dívida do espólio')) {
        const interest = Math.min(amount,loan.interest); loan.interest -= interest; loan.remaining -= amount-interest; bank.totalRevenue += interest;
      }
      loan.status = loan.remaining+loan.interest ? 'written-off' : 'paid';
      if (bank && loan.status === 'written-off') bank.totalExpenses += loan.remaining+loan.interest;
      this.city.history.record('credit','Encerramento do contrato por saída ou falecimento.',[c.accountId,bank?.accountId],{loanId:loan.id,unpaid:loan.remaining+loan.interest});
    }
  }
}
