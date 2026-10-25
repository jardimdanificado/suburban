/** Deposits have full reserves; business credit uses bank capital and recorded development refinancing. */
export class CityBank {
  constructor(city) {
    this.city = city; this.deposits = new Map(); this.loans = []; this.nextId = 1;
    this.policy = { creditEnabled: true, loanRate: .002, savingsRate: .0005, cashReserve: 10000 };
  }
  available() { return this.city.economy.businesses.filter(b => b.type === 'bank' && (b.workers.length||this.city.economy.citizen(b.ownerId)) && b.balance >= b.wage); }
  developmentBanks(){
    const city=this.city,banks=city.economy.businesses.filter(b=>b.type==='bank');
    if(this.lastDevelopmentPreparation!==city.minute){
      this.lastDevelopmentPreparation=city.minute;
      for(const bank of banks){
        const reserve=Math.max(city.currency.price(20000),bank.workers.length*bank.wage*480),missing=Math.max(0,reserve-bank.balance);
        if(missing&&bank.municipal&&city.treasury>=city.welfare.conditions().reserve+missing)city.transfer('treasury',bank.accountId,missing,'Capital operacional do banco municipal para atender crédito produtivo',{buildingId:bank.id});
        else if(missing&&bank.ownerId){const owner=city.society.citizen(bank.ownerId);if(owner&&owner.balance>=missing+city.currency.price(15000))city.transfer(owner.accountId,bank.accountId,missing,'Aporte do proprietário para atendimento bancário',{buildingId:bank.id});}
      }
      if(banks.some(b=>!b.workers.length&&!city.economy.citizen(b.ownerId)&&b.balance>=b.wage))city.economy.hire();
    }
    return this.available();
  }
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
    const socialFactor=1+city.relationships.personalOpinion(city.relationships.businessPerson(bank),client)/100;
    if (amount > income*12*city.reputation.creditFactor(client)*socialFactor || amount > Math.max(0,bank.balance-reserve)*.6 || !city.transfer(bank.accountId,clientId,amount,'Empréstimo bancário',{loanId:this.nextId})) return false;
    const loan = { id: this.nextId++, bankId: bank.id, clientId, principal: amount, remaining: amount, interest: 0, rate: this.policy.loanRate * (1.5 - city.reputation.score(client, 'credit') / 100), dailyPayment: Math.ceil(amount/30), dueDay: city.day+1, missed: 0, status: 'active', startedAt: city.minute, paid: 0 };
    this.loans.push(loan);
    city.history.record('credit', `Crédito aprovado por ${bank.entity.properties.name}.`, [clientId,bank.accountId], { amount, rate:loan.rate, loanId:loan.id });
    return loan;
  }
  businessRefusal(reason,proposal){this.lastBusinessRefusal={minute:this.city.minute,type:proposal?.type,crop:proposal?.crop??null,reason};return false;}
  initialChainCredit(proposal){
    if(!proposal?.initialChain||!this.city.buildingTypes[proposal.type])return false;
    const target=proposal.type==='research_institute'?this.city.politics.getResearch().demand().required:1;
    return this.city.economy.businesses.filter(b=>b.type===proposal.type&&(proposal.type!=='farm'||b.crop===proposal.crop)&&(proposal.type!=='quarry'||this.city.economy.quarryStatus(b).remaining>0)).length<target;
  }
  completionFundingNeed(proposal){
    if(!proposal?.completionDraw||!proposal.projectId)return 0;
    const p=this.city.development.projects.find(p=>p.id===proposal.projectId&&!p.cancelled&&p.status!=='completed');
    if(!p||p.type!==proposal.type||!(p.productionChain||this.loans.some(l=>l.projectId===p.id&&l.initialChain)||this.initialChainCredit(proposal)))return 0;
    return Math.max(0,this.city.development.materialBudget(p).target-(this.city.accounts.get(p.materialAccountId)?.balance||0));
  }
  refinanceDevelopment(bank,amount,proposal){
    if(amount<=0)return 0;
    const city=this.city,reserve=city.welfare.conditions().reserve;
    if(city.treasury<reserve+amount)return this.businessRefusal('Tesouro sem caixa para refinanciar o banco após preservar a reserva social.',proposal);
    if(!city.transfer('treasury',bank.accountId,amount,'Refinanciamento bancário de cadeias iniciais',{buildingId:bank.id,businessType:proposal.type,crop:proposal.crop}))return false;
    this.developmentLines??=[];let line=this.developmentLines.find(l=>l.bankId===bank.id);
    if(!line){line={bankId:bank.id,principal:0,remaining:0,repaid:0,startedAt:city.minute};this.developmentLines.push(line);}
    line.principal+=amount;line.remaining+=amount;return amount;
  }
  repayDevelopment(bank,amount,loan){
    const line=this.developmentLines?.find(l=>l.bankId===bank.id);if(!line||!loan?.publicRefinanceRemaining)return;
    const payment=Math.min(amount,line.remaining,loan.publicRefinanceRemaining,bank.balance);if(payment<=0)return;
    if(this.city.transfer(bank.accountId,'treasury',payment,'Amortização do refinanciamento produtivo',{loanId:loan.id,buildingId:bank.id})){line.remaining-=payment;line.repaid+=payment;loan.publicRefinanceRemaining-=payment;}
  }
  lendForBusiness(bank, founder, amount, proposal) {
    const city=this.city,reject=reason=>this.businessRefusal(reason,proposal);
    if(!this.policy.creditEnabled)return reject('Crédito desativado na política bancária.');
    if(!this.available().includes(bank))return reject('Banco sem atendimento ou sem caixa operacional.');
    if(!founder||founder.entity?.destroyed||!city.society.isAdult(founder)||founder.creditAllowed===false)return reject('Empreendedor indisponível ou sem autorização para crédito.');
    if(!Number.isSafeInteger(amount)||amount<=0||!Number.isSafeInteger(proposal?.budget)||amount>proposal.budget)return reject('Orçamento empresarial inválido.');
    if(!city.buildingTypes[proposal.type])return reject('Tipo de empreendimento não disponível para crédito empresarial.');
    const completionNeed=this.completionFundingNeed(proposal),completion=completionNeed>0&&amount<=completionNeed;
    const initial=this.initialChainCredit(proposal)||completion;
    if(!initial&&proposal.score<60)return reject('Demanda insuficiente para crédito empresarial comum.');
    const existing=this.loans.find(l=>l.clientId===founder.accountId&&l.purpose==='business'&&!['paid','written-off'].includes(l.status));
    const topUp=initial&&existing&&proposal.projectId===existing.projectId&&(completion||!existing.startupTopUpUsed)&&city.development.projects.some(p=>p.id===proposal.projectId&&!p.cancelled&&p.status!=='completed'&&(completion||!p.materialAccountId));
    if(topUp&&existing.bankId!==bank.id)return reject('Complemento precisa ser contratado no banco do empréstimo original.');
    if(existing&&!topUp)return reject('Empreendedor já possui financiamento empresarial em andamento.');
    const reserve=Math.max(city.currency.price(20000),bank.workers.length*bank.wage*480),cash=Math.max(0,bank.balance-reserve);
    let refinance=0;
    if(initial&&amount>cash){refinance=this.refinanceDevelopment(bank,amount-cash,proposal);if(refinance===false)return false;}
    if(!initial&&amount>cash*.75*Math.min(1,city.reputation.creditFactor(founder)*(1+city.relationships.personalOpinion(city.relationships.businessPerson(bank),founder)/100)))return reject('Caixa ou limite de risco insuficiente no crédito comum.');
    if(!city.transfer(bank.accountId,founder.accountId,amount,'Crédito empresarial para atender demanda',{loanId:topUp?existing.id:this.nextId,businessType:proposal.type,initialChain:initial}))return reject('Transferência de crédito indisponível.');
    if(topUp){existing.principal+=amount;existing.remaining+=amount;existing.initialChain=true;existing.startupTopUpUsed=true;existing.completionDraws=(existing.completionDraws||0)+(completion?1:0);existing.graceDays=14;existing.operatingStartedAt=null;existing.installments=240;existing.dailyPayment=Math.ceil(existing.remaining/240);existing.publicRefinance=(existing.publicRefinance||0)+refinance;existing.publicRefinanceRemaining=(existing.publicRefinanceRemaining||0)+refinance;existing.rate=Math.min(existing.rate,.00025);existing.status='active';existing.missed=0;existing.dueDay=city.day+1;this.lastBusinessRefusal=null;city.history.record('credit',completion?'Complemento auditado pelo custo atual dos materiais da obra.':'Complemento único do financiamento para concluir a cadeia inicial.',[founder.accountId,bank.accountId],{loanId:existing.id,projectId:proposal.projectId,amount,publicRefinance:refinance});return existing;}
    const installments=initial?240:180;
    const loan={id:this.nextId++,bankId:bank.id,clientId:founder.accountId,purpose:'business',businessType:proposal.type,crop:proposal.crop??null,initialChain:initial,graceDays:initial?14:0,operatingStartedAt:null,publicRefinance:refinance,publicRefinanceRemaining:refinance,principal:amount,remaining:amount,interest:0,rate:Math.min(this.policy.loanRate,initial?.00025:.0005),installments,dailyPayment:Math.ceil(amount/installments),dueDay:city.day+1,missed:0,status:'active',startedAt:city.minute,paid:0};
    this.loans.push(loan);this.lastBusinessRefusal=null;
    city.history.record('credit',`Crédito aprovado para ${city.buildingTypes[proposal.type].label}: ${initial?'cadeia inicial, orçamento integral e carência após a abertura':'financiamento empresarial'}.`,[founder.accountId,bank.accountId],{amount,loanId:loan.id,rate:loan.rate,initialChain:initial,graceDays:loan.graceDays,installments,publicRefinance:refinance});return loan;
  }
  cancelBusinessLoan(loan) {
    const bank=this.city.accounts.get(`business:${loan.bankId}`);
    if(!bank || !this.city.transfer(loan.clientId,bank.accountId,loan.remaining,'Estorno de abertura de empresa'))return false;
    this.repayDevelopment(bank,loan.remaining,loan);loan.remaining=0;loan.interest=0;loan.status='paid';loan.cancelled=true;return true;
  }
  householdFinance() {
    const city = this.city, banks = this.available();
    for (const c of city.citizens.filter(c => !c.entity.destroyed && city.society.isAdult(c))) {
      const preferredBanks=banks.length>1?banks.slice().sort((a,b)=>city.relationships.businessPenalty(c,a)-city.relationships.businessPenalty(c,b)):banks;
      for (const deposit of this.deposits.values()) if (deposit.clientId === c.accountId && deposit.balance > 0 && c.balance < this.policy.cashReserve) this.withdraw({id:deposit.bankId},c.accountId,Math.min(deposit.balance,this.policy.cashReserve-c.balance));
      if (!banks.length) continue;
      if (c.balance < city.welfare.policy.cashTarget && (c.jobId || c.businessIds.length) && c.creditAllowed !== false) {
        for (const bank of preferredBanks) if (this.lend(bank,c.accountId,city.welfare.policy.cashTarget-c.balance)) break;
      }
      const amount = Math.floor(Math.max(0,c.balance-this.policy.cashReserve)*(c.savingsRate ?? .2));
      if (amount > 0) this.deposit(preferredBanks[0],c.accountId,amount);
    }
  }
  daily() {
    const city = this.city;
    for (const loan of this.loans.filter(l => l.status !== 'paid' && l.status !== 'written-off' && l.dueDay <= city.day)) {
      if(loan.purpose==='business' && loan.projectId){const project=city.development.projects.find(p=>p.id===loan.projectId);if(project && !project.cancelled && project.status!=='completed'){loan.dueDay=city.day+1;continue;}}
      if(loan.initialChain&&loan.operatingStartedAt==null){const project=city.development.projects.find(p=>p.id===loan.projectId);if(project?.status==='completed'){loan.operatingStartedAt=project.completedAt??city.minute;loan.dueDay=city.day+(loan.graceDays||14);continue;}}
      const bank = city.building(loan.bankId), client = city.accounts.get(loan.clientId);
      if (!bank || !client) continue;
      const interest = Math.ceil(loan.remaining*loan.rate); loan.interest += interest;
      // Preserve a basic subsistence reserve; arrears do not create currency.
      const due = Math.min(loan.dailyPayment+loan.interest,loan.remaining+loan.interest);
      const payment = Math.min(Math.max(0,client.balance-city.currency.price(1500)),due);
      if (payment && city.transfer(loan.clientId,bank.accountId,payment,'Parcela de empréstimo',{loanId:loan.id})) {
        const paidInterest = Math.min(payment,loan.interest);
        loan.interest -= paidInterest; loan.remaining -= payment-paidInterest; loan.paid += payment; bank.totalRevenue += paidInterest;this.repayDevelopment(bank,payment-paidInterest,loan);
      }
      if (payment >= due) city.reputation.observe(loan.clientId,'credit',1,'parcela paga no prazo',{loanId:loan.id,amount:payment});
      else city.reputation.observe(loan.clientId,'credit',-.75,'parcela incompleta ou em atraso',{loanId:loan.id,due,amount:payment});
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
      if (bank && amount && this.city.transfer(c.accountId,bank.accountId,amount,'Liquidação de dívida do espólio',{loanId:loan.id})) {
        const interest = Math.min(amount,loan.interest); loan.interest -= interest; loan.remaining -= amount-interest; bank.totalRevenue += interest;this.repayDevelopment(bank,amount-interest,loan);
      }
      loan.status = loan.remaining+loan.interest ? 'written-off' : 'paid';
      if (bank && loan.status === 'written-off') bank.totalExpenses += loan.remaining+loan.interest;
      this.city.history.record('credit','Encerramento do contrato por saída ou falecimento.',[c.accountId,bank?.accountId],{loanId:loan.id,unpaid:loan.remaining+loan.interest});
    }
  }
}
