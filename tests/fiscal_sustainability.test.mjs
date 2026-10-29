import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney} from './helpers/city.mjs';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
function reduceTreasury(city,cash){if(!city.accounts.has('test-reserves'))city.accounts.set('test-reserves',{balance:0,name:'Test reserves'});assert(city.transfer('treasury','test-reserves',city.treasury-cash,'Test protected balances'));}
function drainMunicipalSurplus(city){for(const b of city.buildings)if(b.accountId!=='treasury'&&b.balance)city.transfer(b.accountId,'test-reserves',b.balance,'Test no operating surplus');}

test('the social reserve is usable by benefits, even when no cash remains above it',()=>{
  const city=setup({starter:true,population:48});reduceTreasury(city,5000);drainMunicipalSurplus(city);city.bank.policy.creditEnabled=false;city.welfare.policy.dailyBudget=5000;
  const needy=city.citizens.find(c=>!city.politics.officeHolder(c));needy.needs.food=15;const money=totalMoney(city);city.welfare.hourly();assert(needy.benefitsReceived>0);assert(city.welfare.spentToday>0);assert(city.treasury<5000);assert.equal(totalMoney(city),money);
});

test('optional investments cannot spend the food reserve, while physical public meal purchases can',()=>{
  const city=setup({starter:true,population:48});reduceTreasury(city,city.fiscal.reserve());const before=city.treasury;assert(!city.transfer('treasury','supplier',100,'Refinanciamento bancário de cadeias iniciais'));assert.equal(city.treasury,before);
  assert(city.transfer('treasury','supplier',100,'Reserva de compra e frete',{purpose:'public-meals'}));assert.equal(city.treasury,before-100);assert(city.fiscal.lastDeferred);
});

test('uncommitted works cash can protect subsistence and is restored after recovery without creating currency',()=>{
  const city=setup({starter:true,population:48});city.politics.fundInitialWorksBudget();reduceTreasury(city,1000);drainMunicipalSurplus(city);const budget=city.accounts.get('works-budget').balance,money=totalMoney(city);city.fiscal.hourly();const advance=city.fiscal.worksAdvance;assert(advance>0);assert.equal(city.accounts.get('works-budget').balance,budget-advance);assert(city.treasury>=city.fiscal.reserve());assert.equal(totalMoney(city),money);
  city.transfer('test-reserves','treasury',city.fiscal.reserve()*2,'Test recovered receipts');city.minute+=60;city.fiscal.hourly();assert.equal(city.fiscal.worksAdvance,0);assert.equal(city.accounts.get('works-budget').balance,budget);assert.equal(totalMoney(city),money);
});

test('municipal liquidity recovery does not touch private savings or contracted escrow',()=>{
  const city=setup({starter:true,funded:true,population:48}),bank=city.economy.businesses.find(b=>b.type==='bank'),c=city.citizens.find(c=>c.fixtureInvestor);assert(city.bank.deposit(bank,c.accountId,10000));city.accounts.set('construction-fee:protected',{balance:0});assert(city.transfer('treasury','construction-fee:protected',50000,'Test contracted escrow'));reduceTreasury(city,1000);const savings=city.bank.savings(c.accountId),escrow=city.accounts.get('construction-fee:protected').balance;city.fiscal.hourly();assert.equal(city.bank.savings(c.accountId),savings);assert.equal(city.accounts.get('construction-fee:protected').balance,escrow);
});

test('vulnerable residents keep free public meals while wealthy residents contribute to actual food cost',()=>{
  const city=setup({starter:true,funded:true,population:48}),hall=city.buildings.find(b=>b.type==='popular_refectory'),poor=city.citizens.find(c=>!c.fixtureInvestor),rich=city.citizens.find(c=>c.fixtureInvestor);city.transfer(poor.accountId,'treasury',poor.balance,'Test poverty');assert.equal(city.economy.mealOffer(hall,poor).price,0);const quote=city.economy.mealOffer(hall,rich),cash=rich.balance,provider=hall.balance;assert(quote.price>0);assert(city.economy.consumeMeal(rich,hall));assert.equal(rich.balance,cash-quote.price);assert.equal(hall.balance,provider+quote.price);
});

test('enterprise taxes follow positive operating result and unpaid taxes carry forward',()=>{
  const city=setup({starter:true,funded:true,population:48}),b=city.economy.businesses.find(b=>b.type==='builder'),owner=city.citizens.find(c=>c.fixtureInvestor);b.ownerId=owner.id;b.municipal=false;b.totalRevenue=10000;b.totalExpenses=12000;b.politicalTaxRevenue=0;b.politicalTaxExpenses=0;city.politics.policy.businessTax=.1;city.politics.daily();assert.equal(b.businessTaxDue||0,0);assert.equal(b.businessTaxPaid||0,0);
  b.totalRevenue+=20000;city.politics.daily();assert.equal(b.businessTaxPaid,2000);
  city.accounts.set('test-reserves',{name:'Test reserves',balance:0});city.transfer(b.accountId,'test-reserves',b.balance,'Test firm without cash');b.totalRevenue+=10000;city.politics.daily();assert.equal(b.businessTaxDue,1000);
});

test('loan collection preserves food money and municipal grant routines do not subsidize private firms',()=>{
  const city=setup({funded:true}),bank=city.economy.businesses.find(b=>b.type==='bank'),person=city.citizens.find(c=>!c.fixtureInvestor),privateFirm=city.economy.businesses.find(b=>b.ownerId);assert(privateFirm);const privateCash=privateFirm.balance;city.fiscal.fundServices();assert.equal(privateFirm.balance,privateCash);
  const floor=city.welfare.subsistenceFloor(person);if(person.balance>floor)city.transfer(person.accountId,'treasury',person.balance-floor,'Test household reserve');const before=person.balance;city.bank.loans.push({id:999,bankId:bank.id,clientId:person.accountId,remaining:5000,interest:0,rate:.002,dailyPayment:1000,dueDay:city.day,status:'active',paid:0,missed:0});city.bank.daily();assert.equal(person.balance,before);
});

test('fiscal categories survive worker snapshots and distinguish operational result from capital transfers',()=>{
  const city=setup({starter:true,population:48});city.fiscal.days=[];city.transfer('treasury','supplier',1000,'Reserva do serviço de construção');city.transfer('treasury',city.citizens[0].accountId,500,'Benefício municipal de subsistência');const r=city.fiscal.report();assert.equal(r.payments.investment,1000);assert.equal(r.payments.benefits,500);assert.equal(r.operatingExpenses,500);const mirror=new CityStateGraph().apply(new CityStateGraph().encode({city})).city;bindCityState(mirror);assert.equal(mirror.fiscal.report().operatingExpenses,500);assert.equal(mirror.fiscal.city,mirror);
});

test('persistent operating deficits prompt a real council proposal rather than silently changing tax policy',()=>{
  const city=setup({starter:true,population:48}),p=city.politics,rate=p.policy.businessTax;city.fiscal.days=[1,2,3].map(day=>({day,income:0,expenses:1000,receipts:{},payments:{benefits:1000}}));city.minute=3*1440;reduceTreasury(city,1000);city.fiscal.requestRevenueReview();const bill=p.council.bills.find(b=>b.id===city.fiscal.revenueReviewBillId);assert(bill);assert.equal(bill.type,'businessTax');assert(bill.payload.value>rate);assert.equal(p.policy.businessTax,rate);assert.equal(bill.status,'awaiting-session');
});
