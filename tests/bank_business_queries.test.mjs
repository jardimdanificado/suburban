import test from 'node:test';
import assert from 'node:assert/strict';
import {CityBank} from '../js/city_bank.js';

test('bank availability preserves order and live eligibility without materializing every business',()=>{
  const bank=(id,extra={})=>({id,type:'bank',active:true,balance:30000,wage:10,workers:[1],entity:{destroyed:false},...extra});
  const buildings=[bank(1),bank(2,{active:false}),bank(3,{entity:{destroyed:true}}),bank(4,{balance:1}),bank(5,{workers:[]}),bank(6,{workers:[],municipal:true}),bank(7,{workers:[],ownerId:20}),bank(8,{type:'market'})];
  let reads=0;
  const city={buildings,currency:{price:n=>n},economy:{get businesses(){reads++;return buildings.filter(b=>b.active&&!b.entity.destroyed);},citizen:id=>id===20?{}:null},fiscal:{municipal:b=>!!b.municipal}};
  const banking=new CityBank(city);
  assert.deepEqual(banking.available().map(b=>b.id),[1,6,7]);
  buildings[0].balance=0;buildings[1].active=true;
  assert.deepEqual(banking.available().map(b=>b.id),[2,6,7]);
  assert.deepEqual(banking.available([buildings[6],buildings[1]]).map(b=>b.id),[7,2]);
  assert.equal(reads,0,'membership queries must not allocate the complete business list');
});

for(const state of ['missing','inactive','destroyed','active'])test(`business credit observes first food shop reserve (${state}) without copying every business`,()=>{
  const bank={id:1,accountId:'bank:1',type:'bank',active:true,balance:300000,wage:1,workers:[10],entity:{destroyed:false}};
  const founder={accountId:'person:1',balance:0,entity:{destroyed:false}};
  const buildings=[bank];
  if(state!=='missing')buildings.push({type:'market',active:state!=='inactive',entity:{destroyed:state==='destroyed'}});
  let reads=0,transfers=0,records=0;
  const city={buildings,minute:1572,day:1,buildingTypes:{bakery:{}},currency:{price:n=>n},society:{isAdult:()=>true},
    economy:{get businesses(){reads++;return buildings.filter(b=>b.active&&!b.entity.destroyed);},demands:[{type:'market',score:30}]},
    reputation:{creditFactor:()=>1,score:()=>50},relationships:{businessPerson:()=>null,personalOpinion:()=>0},
    transfer(from,to,amount){assert.equal(from,bank.accountId);assert.equal(to,founder.accountId);bank.balance-=amount;founder.balance+=amount;transfers++;return true;},history:{record(){records++;}}};
  const banking=new CityBank(city);
  const loan=banking.lendForBusiness(bank,founder,60000,{type:'bakery',score:60,budget:60000});
  if(state==='active'){
    assert.equal(loan.principal,60000);assert.equal(bank.balance,240000);assert.equal(founder.balance,60000);
    assert.equal(banking.lastBusinessRefusal,null);assert.equal(transfers,1);assert.equal(records,1);
  }else{
    assert.equal(loan,false);assert.equal(bank.balance,300000);assert.equal(founder.balance,0);
    assert.equal(banking.lastBusinessRefusal.reason,'Caixa ou limite de risco insuficiente no crédito comum.');
    assert.equal(transfers,0);assert.equal(records,0);
  }
  assert.equal(reads,0,'food shop membership must not allocate the complete business list');
});
