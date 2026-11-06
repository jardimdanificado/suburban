import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney,finishActivityRoute} from './helpers/city.mjs';
import {ECONOMIC_POLICIES,economicPolicy,setEconomicPolicy,collectEconomicTaxes} from '../js/city_economic_policies.js';
import {municipalSurplusExportsHourly} from '../js/city_external_trade.js';
import {offerShares,buyShares,privatizationQuota} from '../js/city_equity.js';
import {apply,routeToInterview,advanceRecruitment} from '../js/city_employment.js';
import {governmentPerformance} from '../js/city_government_performance.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';

function residential(city){for(const site of city.economy.locateBuilding('residential')){const b=city.addBuilding('residential',site.x,site.y,{...site,floors:2,free:true});if(b)return b;}throw Error('No residential site');}
function disableOtherTaxes(city){for(const key of ['wealthRate','propertyRate','landRate','vehicleRate','incomeRate','dividendRate','rentIncomeRate','inheritanceRate','nationalTransferPerResident'])setEconomicPolicy(city,key,0);}

test('founding has two privately capitalized banks alongside a public bank, with recorded money supply',()=>{
 const city=setup({starter:true,population:64}),banks=city.economy.businesses.filter(b=>b.type==='bank');assert.equal(banks.filter(b=>b.foundingPrivateBank&&!b.municipal&&b.ownerId).length,2);assert(banks.some(b=>b.municipal));assert.equal(totalMoney(city),city.currency.netIssued());const supply=totalMoney(city);city.bank.initializePrivateBanks();assert.equal(totalMoney(city),supply);assert.equal(city.economy.businesses.filter(b=>b.type==='bank').length,banks.length);
});

test('economic laws validate bounds and only change after council execution',()=>{
 const city=setup({starter:true,population:64}),p=city.politics;assert(Object.keys(ECONOMIC_POLICIES).length>=30);for(const key of ['wealthRate','propertyRate','vehicleRate','incomeRate','consumptionMultiplier'])assert(economicPolicy(city,key)>0);
 const previous=economicPolicy(city,'propertyRate'),bill=p.submitBill('economicPolicy',{key:'propertyRate',value:.02});assert(bill);assert.equal(economicPolicy(city,'propertyRate'),previous);p.council.execute(bill);assert.equal(economicPolicy(city,'propertyRate'),.02);assert.equal(p.submitBill('economicPolicy',{key:'propertyRate',value:100}),null);assert.equal(setEconomicPolicy(city,'directHiring',7),false);
});

test('IPTU accrues annually, retains fractional cents and cannot be charged twice on one day',()=>{
 const city=setup({starter:true,funded:true,population:64}),c=city.citizens.find(c=>!city.politics.officeHolder(c)&&!c.businessIds.length),b=residential(city);disableOtherTaxes(city);setEconomicPolicy(city,'propertyRate',.012);setEconomicPolicy(city,'vacantPropertyMultiplier',1);setEconomicPolicy(city,'homeExemption',0);
 for(const u of b.units){u.ownerId=c.accountId;u.price=360001;u.occupantId=null;}const base=b.units.reduce((n,u)=>n+u.price,0);collectEconomicTaxes(city);const debt=city.fiscal.taxDebts[`${c.accountId}:property`];assert.equal(debt.assessed,Math.floor(base*.012/360));const first=debt.assessed;collectEconomicTaxes(city);assert.equal(debt.assessed,first);city.minute+=1440;collectEconomicTaxes(city);assert.equal(debt.assessed,Math.floor(base*.012/360*2));assert.equal(totalMoney(city),city.currency.netIssued());
});

test('asset taxes preserve subsistence and record arrears instead of minting payment money',()=>{
 const city=setup({starter:true,funded:true,population:64}),c=city.citizens.find(c=>!city.politics.officeHolder(c)&&!c.businessIds.length),b=residential(city);disableOtherTaxes(city);setEconomicPolicy(city,'propertyRate',.06);for(const u of b.units){u.ownerId=c.accountId;u.price=1000000;}city.transfer(c.accountId,'treasury',c.balance,'Test household with no cash');const supply=totalMoney(city);collectEconomicTaxes(city);assert.equal(c.balance,0);assert(city.fiscal.taxDebts[`${c.accountId}:property`].due>0);assert.equal(totalMoney(city),supply);
});

test('national revenue sharing is an explicit external transfer, not hidden money creation',()=>{
 const city=setup({starter:true,population:64});disableOtherTaxes(city);setEconomicPolicy(city,'nationalTransferPerResident',1000);setEconomicPolicy(city,'publicWorksShare',0);const before=totalMoney(city),cash=city.treasury;collectEconomicTaxes(city);assert.equal(totalMoney(city)-before,64000);assert.equal(city.treasury-cash,64000);assert.equal(totalMoney(city),city.currency.netIssued());
});

test('municipal exports consume real stock, remit revenue and protect contracted materials',()=>{
 const city=setup({starter:true,population:64}),quarry=city.economy.businesses.find(b=>b.type==='quarry');city.development.projects=[];quarry.inventory.pedra=1000;const stock=city.goodsStock('pedra'),cash=city.treasury,supply=totalMoney(city);assert(municipalSurplusExportsHourly(city)>0);assert(city.goodsStock('pedra')<stock);assert(city.treasury>cash);assert(totalMoney(city)>supply);assert.equal(totalMoney(city),city.currency.netIssued());const remaining=quarry.inventory.pedra;city.development.projects.push({id:'protected',status:'materials',stone:city.goodsStock('pedra')+100,inventory:{},incoming:{}});municipalSurplusExportsHourly(city);assert.equal(quarry.inventory.pedra,remaining);
});

test('seven percent daily share quota retains public control and operational funding eligibility',()=>{
 const city=setup({starter:true,funded:true,population:64}),quarry=city.economy.businesses.find(b=>b.type==='quarry'),buyer=city.citizens.find(c=>!city.politics.officeHolder(c)&&c.balance>100000);assert.equal(privatizationQuota(city).allowed,700);const offer=offerShares(city,quarry,'treasury',1000),trade=buyShares(city,quarry,offer.id,buyer.accountId,1000);assert.equal(trade.points,700);assert.equal(quarry.municipal,true);assert.equal(city.fiscal.municipal(quarry),true);assert.equal(privatizationQuota(city).remaining,0);
});

test('an employer hires an attending applicant even while the labor secretary is absent',()=>{
 const city=setup({starter:true,population:64}),b=city.buildings.find(b=>b.type==='builder'),c=city.citizens.find(c=>!city.politics.officeHolder(c)&&!c.businessIds.length);city.economy.leaveJob(c);b.workers=[];b.jobs=1;b.hiringPolicy={minSkill:0,minExperienceMinutes:0,minRating:0,allowTraining:true};city.minute=9*60;const secretary=city.society.citizen(city.politics.secretaries.find(r=>r.officeId==='labor')?.citizenId);if(secretary)secretary.task=null;c.career={jobs:[],applications:[],worked:{},motivation:50};c.path=[];c.indoorLocation=null;c.entity.x=b.door.x;c.entity.y=b.door.y;const a=apply(city,c,b);assert.equal(a.recruitmentChannel,'employer');assert.equal(a.appliedAt,city.minute);city.minute=a.interviewAt-20;assert(routeToInterview(city,c));finishActivityRoute(city,c);city.minute=Math.max(city.minute,a.interviewAt);advanceRecruitment(city);city.minute+=10;advanceRecruitment(city);city.minute+=60;advanceRecruitment(city);assert.equal(a.status,'aprovado');assert.equal(c.jobId,b.id);
});

test('municipal rental collects both the first payment and recurring daily rent',()=>{
 const city=setup({starter:true,funded:true,population:64}),b=residential(city),c=city.citizens.find(c=>!city.politics.officeHolder(c)&&c.balance>100000);city.housing.reconcile();city.housing.market();const home=[...city.housing.homes.values()].find(h=>h.buildingId===b.id);assert(home);const rent=city.housing.rent(home,c),before=city.treasury;assert(rent>0);assert(city.housing.rentHome(c,home));assert.equal(city.treasury-before,rent);const first=city.treasury;city.housing.collectRent();assert.equal(city.treasury-first,rent);
});

test('bank liquidity protects operating costs before productive lending',()=>{
 const city=setup({starter:true,population:64}),bank=city.economy.businesses.find(b=>b.foundingPrivateBank);bank.fiscalDailyExpenses=10000;assert(city.bank.liquidityReserve(bank)>=210000);const owner=city.society.citizen(bank.ownerId);assert.equal(city.bank.refinanceDevelopment(bank,1000,{type:'farm'}),false);assert(owner);
});

test('bankrupt public services and high unemployment outweigh successful campaign promises',()=>{
 const city=setup({starter:true,population:64});city.minute=14*1440;city.accounts.set('test-crisis',{name:'Unavailable funds',balance:0});city.transfer('treasury','test-crisis',city.treasury,'Test crisis');for(const b of city.buildings)if(b.accountId!=='treasury'&&b.balance)city.transfer(b.accountId,'test-crisis',b.balance,'Test crisis');for(const c of city.citizens)if(!city.politics.officeHolder(c)&&!c.businessIds.length)city.economy.leaveJob(c);const term=city.politics.mandates.current;if(term)for(const promise of term.promises){promise.fulfilled=true;promise.assessment={partial:12,initiative:6,completion:16,early:14,excess:20};}city.politics.updateApproval();const performance=governmentPerformance(city);assert.equal(performance.cashHealth,0);assert.equal(performance.serviceHealth,0);assert(city.politics.approval<40);assert(city.politics.approvalReport.rows.some(r=>r.label.includes('Limite por resultados')));
});

test('new taxes, laws and banking accounts survive a worker snapshot',()=>{
 const city=setup({starter:true,population:64});setEconomicPolicy(city,'vehicleRate',.04);collectEconomicTaxes(city);const copy=new CityStateGraph().apply(new CityStateGraph().encode({city})).city;bindCityState(copy);assert.equal(economicPolicy(copy,'vehicleRate'),.04);assert.equal(copy.fiscal.lastEconomicTaxDay,city.day);assert.equal(copy.economy.businesses.filter(b=>b.foundingPrivateBank).length,2);assert.equal(totalMoney(copy),copy.currency.netIssued());
});

test('unsold public share listings cannot bypass the seven percent daily execution ceiling',()=>{
 const city=setup({starter:true,funded:true,population:64}),quarry=city.economy.businesses.find(b=>b.type==='quarry'),buyer=city.citizens.find(c=>!city.politics.officeHolder(c)&&c.balance>100000),offer=offerShares(city,quarry,'treasury',700,{dailyPrivatization:true});assert(offer);city.minute+=1440;const second=offerShares(city,quarry,'treasury',700,{dailyPrivatization:true});assert(second);assert.equal(buyShares(city,quarry,offer.id,buyer.accountId,700).points,700);assert.equal(buyShares(city,quarry,second.id,buyer.accountId,700),null);
});

test('economic collapse reduces individual support for the governing candidate, not just a headline indicator',()=>{
 const city=setup({starter:true,population:64}),p=city.politics,mayor=city.society.citizen(city.economy.mayorId),voter=city.citizens.find(c=>!p.officeHolder(c)&&c.id!==mayor.id);city.minute=14*1440;p.updateApproval();const healthy=p.voterAssessment(voter,mayor,{}).score;city.accounts.set('test-frozen',{name:'Unavailable reserves',balance:0});city.transfer('treasury','test-frozen',city.treasury,'Test recession');for(const b of city.buildings)if(b.balance&&b.accountId!=='treasury')city.transfer(b.accountId,'test-frozen',b.balance,'Test recession');for(const c of city.citizens)if(!p.officeHolder(c)&&!c.businessIds.length)city.economy.leaveJob(c);p.updateApproval();const crisis=p.voterAssessment(voter,mayor,{});assert(crisis.score<healthy-15);assert(crisis.reasons.some(r=>r.reason==='economia, emprego e solvência do governo'&&r.value<0));
});

test('different economic laws can proceed together while duplicate proposals for the same policy wait',()=>{
 const city=setup({starter:true,population:64}),p=city.politics;assert(p.submitBill('economicPolicy',{key:'propertyRate',value:.02}));assert(p.submitBill('economicPolicy',{key:'vehicleRate',value:.04}));assert.equal(p.submitBill('economicPolicy',{key:'propertyRate',value:.03}),null);
});

test('sector legislation changes the base rate while food relief applies to the effective rate',async()=>{
 const {baseTaxRate,taxRate}=await import('../js/city_sales_tax.js'),city=setup({starter:true,population:64});assert.equal(baseTaxRate(city,'food'),.16);assert.equal(taxRate(city,'food'),.12);const bill=city.politics.submitBill('salesTax',{category:'food',value:.2});assert.equal(bill.previousValue,.16);city.politics.council.execute(bill);assert.equal(baseTaxRate(city,'food'),.2);assert(Math.abs(taxRate(city,'food')-.15)<1e-9);
});

test('persistent darkness and unpaved streets cap approval even when the treasury is healthy',()=>{
 const city=setup({starter:true,population:64}),p=city.politics;city.minute=14*1440;city.traffic.set('64,64',20);city.lighting.posts=[];city.infrastructureFailureSince=city.minute-3*1440;for(const c of city.citizens){c.happiness=95;for(const key of Object.keys(c.needs))c.needs[key]=95;}p.updateApproval();assert(p.approval<=60);city.justice.bodies.push({diedAt:city.minute-4*1440,crematedAt:null},{diedAt:city.minute-4*1440,crematedAt:null});p.updateApproval();assert(p.approval<=45);const report=p.approvalReport;assert(Math.abs(report.startingScore+report.rows.reduce((sum,row)=>sum+row.points,0)+report.adjustment-report.score)<1e-9);
});
