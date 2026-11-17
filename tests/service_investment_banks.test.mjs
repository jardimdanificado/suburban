import test from 'node:test';
import assert from 'node:assert/strict';
import {CityServiceInvestment} from '../js/city_service_investment.js';
import {CityBank} from '../js/city_bank.js';

for(const established of [false,true])test(`service lending rechecks banks and reuses service classification (established=${established})`,()=>{
 const bankA={id:1,type:'bank',active:true,balance:100,wage:1,workers:[10],entity:{destroyed:false}};
 const bankB={id:2,type:'bank',active:false,balance:100,wage:1,workers:[11],entity:{destroyed:false}};
 const founders=Array.from({length:3},(_,i)=>({id:i+1,accountId:`person:${i+1}`,balance:0,businessIds:[],skills:{construction:0},entity:{destroyed:false}}));
 let businessReads=0;
 const city={minute:0,buildings:[bankA,bankB],citizens:founders,treasury:0,
  economy:{get businesses(){businessReads++;return city.buildings.filter(b=>b.active&&!b.entity.destroyed);}},
  development:{projects:[],ensurePlots(){},buyPlot(){assert.fail('unfunded founders must not buy plots');}},
  society:{isAdult:()=>true},politics:{officeHolder:()=>false},welfare:{policy:{reserve:0}}};
 if(established)city.buildings.push({id:3,type:'builder',active:true,entity:{destroyed:false}});
 city.bank=new CityBank(city);
 const attempts=[];
 city.bank.lendForBusiness=(bank,founder,amount,proposal)=>{
  assert.equal(proposal.initialChain,!established);
  attempts.push([bank.id,founder.id]);
  if(bank===bankA){bankA.balance=0;bankB.active=true;}
  return false;
 };
 const investment=new CityServiceInvestment(city);
 investment.demand=()=>({score:100});investment.pending=()=>[];
 investment.lots=()=>[{id:1,price:1}];investment.plan=()=>({total:100});
 assert.equal(investment.invest({types:['builder']}),false);
 assert.deepEqual(attempts,[[1,1],[2,2],[2,3]],'later founders must see the updated bank eligibility');
 assert.equal(businessReads,1,'one service demand needs one initial-chain classification');
 assert.equal(investment.decisions.get('builder').state,'Aguardando crédito empresarial ou orçamento municipal');
});
