import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney} from './helpers/city.mjs';
import {buildWealthReport,wealthReport,wealthDistribution,marketKind,MARKET_HISTORY_LIMIT} from '../js/city_wealth.js';
import {renderMarket} from '../js/city_wealth_ui.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
const fixture=()=>setup({starter:true,funded:true,population:64});
const near=(a,b)=>assert(Math.abs(a-b)<.001,`${a} != ${b}`);
test('cash, assets and company equity reconcile without double counting or mutating the city',()=>{
 const c=fixture(),before=totalMoney(c),r=buildWealthReport(c);
 assert.equal(r.totals.money,before);near(r.totals.gross,before+r.totals.realAssets);
 near([...r.direct.values()].reduce((n,a)=>n+a.net,0),r.totals.gross);
 near([...r.owners.values()].reduce((n,a)=>n+a.net,0),r.totals.gross);
 near(r.locations.reduce((n,l)=>n+l.value,0),r.totals.gross);
 assert.equal(r.people.length,64);assert(r.companies.length>10);assert.equal(totalMoney(c),before);
 const b=c.buildings.find(b=>b.type==='builder'),[a,z]=c.citizens;
 b.municipal=false;b.ownerId=a.id;b.equityPartners=[{citizenId:a.id,amount:1},{citizenId:z.id,amount:3}];
 const after=buildWealthReport(c),value=after.direct.get(b.accountId).net;
 near(after.owners.get(a.accountId).companies.find(x=>x.buildingId===b.id).value,value*.25);
 near(after.owners.get(z.accountId).companies.find(x=>x.buildingId===b.id).value,value*.75);
 near([...after.owners.values()].reduce((n,a)=>n+a.net,0),after.totals.gross);
});
test('savings and contract reserves belong to the client; loan claims cancel debts',()=>{
 const c=fixture(),person=c.citizens[0],bank=c.buildings.find(b=>b.type==='bank'),before=totalMoney(c),base=buildWealthReport(c).direct.get(person.accountId).cash;
 assert(c.bank.deposit(bank,person.accountId,1000));
 const project={id:'wealth-test',feeAccountId:'escrow:wealth',accountId:person.accountId,inventory:{},door:{x:1,y:1}};
 c.development.projects.push(project);c.accounts.set(project.feeAccountId,{balance:0,name:'Contract reserve'});
 assert(c.transfer(person.accountId,project.feeAccountId,1000,'Reserva do serviço de construção'));
 c.bank.loans.push({id:999,clientId:person.accountId,bankId:bank.id,remaining:5000,interest:100,status:'active'});
 assert(c.transfer('treasury','works-budget',321,'Fixture works reserve'));
 const r=buildWealthReport(c),a=r.direct.get(person.accountId);
 assert.equal(r.direct.get('treasury').reserved,321);
 assert.equal(a.savings,1000);assert.equal(a.reserved,1000);assert.equal(a.cash,base-2000);assert.equal(a.debt,5100);assert.equal(r.direct.get(bank.accountId).receivables,5100);
 assert.equal(r.totals.money,before);near([...r.direct.values()].reduce((n,a)=>n+a.net,0),r.totals.gross);
});
test('incoming reservations do not create stock; cargo stays owned by seller until settlement',()=>{
 const c=fixture(),seller=c.buildings.find(b=>b.type==='farm'),buyer=c.buildings.find(b=>b.type==='mill'),good='trigo';
 seller.inventory[good]=10;buyer.inventory[good]=0;buyer.incoming[good]=0;
 const base=buildWealthReport(c),total=base.goods.find(g=>g.good===good).quantity;
 seller.inventory[good]-=3;buyer.incoming[good]=3;
 c.logistics.shipments.push({id:999,accountId:'shipment:test',payerAccountId:buyer.accountId,seller,buyer,inventory:{[good]:3},status:'waiting',position:seller.door,good,quantity:3});
 const r=buildWealthReport(c);assert.equal(r.goods.find(g=>g.good===good).quantity,total);assert.equal(r.totals.realAssets,base.totals.realAssets);
 assert.equal(r.assets.find(a=>a.shipmentId===999).ownerId,seller.accountId);
});
test('active cycles are valued separately, displayed stock models are not counted twice',()=>{
 const c=fixture(),base=buildWealthReport(c),v=[...c.vehicles.units.values()].find(v=>v.active);assert(v);
 const before=base.assets.find(a=>a.vehicleId===v.id&&a.kind==='vehicles').value;v.condition/=2;
 const r=buildWealthReport(c);near(base.totals.realAssets-r.totals.realAssets,before/2);
 assert.equal(r.assets.filter(a=>a.kind==='vehicles').length,[...c.vehicles.units.values()].filter(v=>v.active&&!v.scrapped).length);
});
test('commercial journal records only successful trades with true buyers and survives payroll churn',()=>{
 const c=fixture(),a=c.citizens[0],b=c.buildings.find(b=>b.type==='mill');c.marketHistory=[];
 assert.equal(marketKind('Compra negociada de terreno para obra pública'),'property');assert.equal(marketKind('Reserva de compra e frete'),null);assert.equal(marketKind('Compra de voto'),null);
 assert(c.transfer(a.accountId,b.accountId,100,'Serviço: Venda de trigo',{good:'trigo',quantity:2}));
 assert.equal(c.marketHistory.length,1);assert.equal(c.marketHistory[0].good,'trigo');assert.equal(c.marketHistory[0].quantity,2);
 assert.equal(c.transfer(a.accountId,b.accountId,Number.MAX_SAFE_INTEGER,'Compra impossível'),false);
 c.transfer(a.accountId,b.accountId,0,'Compra gratuita');c.transfer(a.accountId,a.accountId,100,'Compra interna');
 for(let i=0;i<1100;i++)c.transfer(b.accountId,a.accountId,1,'Salário');
 assert.equal(c.marketHistory.length,1);assert(!c.ledger.some(l=>l.reason==='Serviço: Venda de trigo'));
 const escrow={id:999,payerAccountId:a.accountId,seller:b,buyer:a,balance:500,good:'trigo',quantity:2};c.accounts.set('shipment:wealth',escrow);
 c.transfer('shipment:wealth',b.accountId,200,'Atacado: Trigo');const sale=c.marketHistory.at(-1);
 assert.equal(sale.buyer,a.accountId);assert.equal(sale.seller,b.accountId);assert.equal(sale.shipmentId,999);assert.equal(sale.quantity,2);
 c.transfer('shipment:wealth',b.accountId,100,'Frete entregue');assert.equal(c.marketHistory.at(-1).good,null);assert.equal(c.marketHistory.at(-1).quantity,null);
 for(let i=0;i<700;i++)c.transfer(a.accountId,b.accountId,1,'Serviço: Banheiro');assert(c.marketHistory.length<=MARKET_HISTORY_LIMIT);
});
test('construction and sanitation settlements identify the real contracting party',()=>{
 const c=fixture(),a=c.citizens[0],b=c.buildings.find(b=>b.type==='builder');c.accounts.set('escrow:test',{balance:1000});c.development.projects.push({feeAccountId:'escrow:test',accountId:a.accountId});
 c.transfer('escrow:test',b.accountId,100,'Serviço de construção');assert.equal(c.marketHistory.at(-1).buyer,a.accountId);
 c.accounts.set('clean:test',{balance:1000});c.sanitation.jobs.push({accountId:'clean:test',payerId:a.accountId});c.transfer('clean:test',b.accountId,100,'Serviço de limpeza');assert.equal(c.marketHistory.at(-1).buyer,a.accountId);
});
test('journal and wealth remain accessible after worker graph synchronization',()=>{
 const c=fixture(),a=c.citizens[0],b=c.buildings.find(b=>b.type==='mill');c.transfer(a.accountId,b.accountId,100,'Serviço: Venda',{good:'trigo',quantity:1});
 const source=new CityStateGraph(),target=new CityStateGraph(),copy=target.apply(source.encode({city:c})).city;bindCityState(copy);const r=buildWealthReport(copy);assert.equal(r.sales[0].buyer,a.accountId);assert.equal(r.sales[0].good,'trigo');assert.equal(r.totals.money,totalMoney(c));
 c.transfer(a.accountId,b.accountId,120,'Serviço: Venda',{good:'feijao',quantity:2});const updated=target.apply(source.encode({city:c})).city;bindCityState(updated);assert.equal(buildWealthReport(updated).sales[0].good,'feijao');
});
test('inequality handles empty cities, zero and negative wealth; report caching is bounded',()=>{
 assert.equal(wealthDistribution([]).gini,0);assert.equal(wealthDistribution([-100,0,100,100]).gini,.5);assert.equal(wealthDistribution([10,10]).gini,0);
 const c=fixture(),a=wealthReport(c,0);assert.equal(wealthReport(c,100),a);assert.notEqual(wealthReport(c,751),a);
});
test('all market tabs and details render and expose working navigation without simulation mutations',()=>{
 const c=fixture(),a=c.citizens[0],b=c.buildings.find(b=>b.type==='mill');c.transfer(a.accountId,b.accountId,100,'Serviço: Venda',{good:'trigo',quantity:1});const before=totalMoney(c),report=buildWealthReport(c),actions=[],text=[];
 const ui={city:c,query:'',current:'overview',view(){return this.current;},matches:()=>true,remember(){},resetScroll(){},camera(){},openCitizen(){},openBuilding(){},openEvent(){},openPanel(){},section(p,k,t,fn){fn(p);}};
 const p={heading:s=>text.push(s),note:s=>text.push(s),kv(){},metrics(){},meters(){},button:(label,click)=>actions.push({label,click}),buttons:items=>actions.push(...items),record:(title,subtitle,click)=>actions.push({label:title,click})};
 for(const view of ['overview','people','companies','locations','goods','sales']){ui.current=view;renderMarket(ui,p);}
 for(const selection of [{wealthAccountId:a.accountId},{wealthAccountId:b.accountId},{wealthLocationId:report.locations[0].id},{wealthGoodId:'trigo'},{marketSaleId:report.sales[0].id}]){Object.assign(ui,{wealthAccountId:null,wealthLocationId:null,wealthGoodId:null,marketSaleId:null},selection);renderMarket(ui,p);}
 for(const action of actions)action.click?.();assert.equal(totalMoney(c),before);assert(text.includes('MERCADO E RIQUEZAS'));
});
