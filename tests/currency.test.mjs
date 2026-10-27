import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, totalMoney, putAtWorkCell } from './helpers/city.mjs';
import { CURRENCY_RULES } from '../js/city_currency.js';
import { GOODS } from '../js/city_economy.js';
import { DEVELOPMENT_RULES } from '../js/city_development.js';

function printer(city) {
  city.currency.policy.mode='capped';
  const b=city.buildings.find(b=>b.type==='mint'),c=city.society.citizen(b.workers[0]);
  c.entity.x=b.door.x;c.entity.y=b.door.y;c.path=[];c.task='work';c.targetId=b.id;
  for(const key of Object.keys(c.needs))c.needs[key]=95;putAtWorkCell(city,c,b);
  return {b,c};
}

test('new citizens start equal and no household can buy the initial firms or a complete home',()=>{
  const city=setup({starter:true});
  assert.deepEqual([...new Set(city.citizens.map(c=>c.balance))],[CURRENCY_RULES.citizenGrant]);
  assert(city.citizens.every(c=>!('wealthTier' in c)&&!c.businessIds.length));
  assert.equal(totalMoney(city),CURRENCY_RULES.initialSupply);
  assert.equal(city.currency.issued,CURRENCY_RULES.initialSupply);
  for(const type of ['builder','quarry']){
    const b=city.buildings.find(b=>b.type===type);assert(b.municipal&&b.active&&b.workers.length);
    assert(city.economy.premisesPrice(b)>CURRENCY_RULES.citizenGrant);
    for(const c of city.citizens)assert.equal(city.economy.purchasePremises(b,c),null);
  }
  assert(city.buildingTypes.residential.price*2>CURRENCY_RULES.citizenGrant);
});

test('printing requires an employee at the mint during working hours and credits only the treasury',()=>{
  const city=setup({starter:true}),{b,c}=printer(city),supply=totalMoney(city),cash=c.balance,treasury=city.treasury;
  city.performTask(c);
  assert.equal(totalMoney(city)-supply,CURRENCY_RULES.mintPerWorkMinute);
  assert.equal(city.currency.issuedToday,CURRENCY_RULES.mintPerWorkMinute);
  assert(c.balance>cash);assert(city.treasury>=treasury+CURRENCY_RULES.mintPerWorkMinute);
  const issued=city.currency.issued;
  c.entity.x=0;assert.equal(city.currency.work(b,c),false);
  c.entity.x=b.door.x;c.jobId=null;assert.equal(city.currency.work(b,c),false);
  c.jobId=b.id;city.minute=22*60;assert.equal(city.currency.work(b,c),false);
  city.minute=8*60;b.entity.destroyed=true;assert.equal(city.currency.work(b,c),false);
  assert.equal(city.currency.issued,issued);
});

test('the mint respects its daily limit and transfers never create money or inflation',()=>{
  const city=setup({starter:true}),{b,c}=printer(city);
  for(let i=0;i<1000;i++)city.currency.work(b,c);
  assert.equal(city.currency.issuedToday,CURRENCY_RULES.mintDailyLimit);
  assert.equal(totalMoney(city),CURRENCY_RULES.initialSupply+CURRENCY_RULES.mintDailyLimit);
  assert.equal(city.currency.work(b,c),false);
  const supply=totalMoney(city),index=city.currency.priceIndex;
  city.transfer(c.accountId,'treasury',100,'Test tax');city.transfer('treasury',c.accountId,100,'Test refund');
  assert.equal(totalMoney(city),supply);assert.equal(city.currency.priceIndex,index);
  city.minute+=1440;assert(city.currency.work(b,c));assert.equal(city.currency.issuedToday,CURRENCY_RULES.mintPerWorkMinute);
});

test('issuance raises actual goods, services, property and wage quotes without indexing cash or reserved contracts',()=>{
  const city=setup({starter:true}),other=setup({starter:true}),{b,c}=printer(city);
  const quarry=city.buildings.find(b=>b.type==='quarry'),builder=city.buildings.find(b=>b.type==='builder');
  quarry.inventory.pedra=2;city.economy.produced.pedra+=2;
  const order=city.logistics.order(quarry,builder,'pedra',2,city.economy.goods.pedra.price);assert(order);
  builder.wage=1001;
  const escrow=order.balance,cost=order.cost,stone=city.economy.goods.pedra.price,unit=city.units.values().next().value,price=unit.price;
  for(let day=0;day<12;day++){
    for(let i=0;i<400;i++)city.currency.work(b,c);
    city.minute+=1440;city.currency.daily();
  }
  const cash=c.balance,index=city.currency.priceIndex;
  assert(index>1);assert(city.currency.dailyInflation>0);assert(unit.price>price);
  assert(city.economy.goods.pedra.price>stone);assert(builder.wage>1001);assert.equal(city.economy.goods.pedra.price,city.currency.price(GOODS.pedra.price));
  assert.equal(city.development.serviceOffers(builder.id)[0].feePerCell,city.currency.price(DEVELOPMENT_RULES.constructionFeePerCell));
  assert.equal(city.economy.mealOffer(city.buildings[0]).price,0);
  assert.equal(order.balance,escrow);assert.equal(order.cost,cost);
  city.currency.daily();assert.equal(city.currency.priceIndex,index);assert.equal(c.balance,cash);
  assert.equal(other.economy.goods.pedra.price,GOODS.pedra.price);assert.equal(other.currency.priceIndex,1);
  assert.equal(totalMoney(city),city.currency.netIssued());
});

test('without a mint, autonomous budgets and investment preserve the initial money supply',()=>{
  const city=setup({starter:true});city.buildings.find(b=>b.type==='mint').entity.destroyed=true;
  for(let i=0;i<2*1440*4;i++)city.update(1/16);
  assert.equal(city.currency.issued,CURRENCY_RULES.initialSupply);assert.equal(totalMoney(city),CURRENCY_RULES.initialSupply);
  assert.equal(city.currency.priceIndex,1);assert.equal(city.currency.dailyInflation,0);
});

test('buying a municipal firm includes its cash and stock, preventing a subsidized takeover',()=>{
  const city=setup({starter:true}),b=city.buildings.find(b=>b.type==='quarry'),c=city.citizens.find(c=>!city.politics.officeHolder(c));
  const property=b.units.reduce((n,u)=>n+u.price,0)+city.development.plots.find(p=>p.id===b.plotId).price;
  b.inventory.pedra=3;const price=city.economy.premisesPrice(b);
  assert.equal(price,property+b.balance+3*city.economy.goods.pedra.price);
  city.transfer('treasury',c.accountId,price+20000-c.balance,'Test acquisition capital');
  const cash=c.balance,supply=totalMoney(city);assert.equal(city.economy.purchasePremises(b,c),null);
  for(const u of b.units)u.forSale=true;
  assert(city.economy.purchasePremises(b,c,null,{billId:1}));
  assert.equal(c.balance,cash-price-20000);assert.equal(b.ownerId,c.id);assert.equal(b.municipal,false);assert.equal(totalMoney(city),supply);
});
