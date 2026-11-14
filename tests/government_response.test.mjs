import test from 'node:test';
import assert from 'node:assert/strict';
import {responsePriorities,reviewGovernmentResponse} from '../js/city_government_response.js';
import {CityGovernmentAgenda} from '../js/city_government_agenda.js';
import {setup} from './helpers/city.mjs';
import {CityStateGraph,bindCityState} from '../js/city_state.js';

const report=rows=>({score:25,finance:{lightingHealth:10,roadHealth:50,funeralHealth:100,justiceHealth:100},rows});
test('diagnosis aggregates actual losses and excludes positive effects and accounting caps',()=>{
  const priorities=responsePriorities(report([
    {label:'Emprego e renda do trabalho',points:-10},
    {label:'Condições atuais: ocupação',points:-2},
    {label:'Condições atuais: alimentação',points:-3},
    {label:'Limite do efeito das mudanças',points:-20},
    {label:'Corrupção comprovada',points:-30},
    {label:'Condições atuais: felicidade',points:3},
  ]));
  assert.deepEqual(priorities.map(row=>[row.metric,row.loss]),[['employed',12],['fed',3]]);
});
test('review measures improvement, rotates stalled priorities and retains bounded history',()=>{
  let employment=20;
  const city={minute:0,politics:{mandates:{metrics:()=>({employed:employment,fed:10})}},log:()=>{}};
  const term={id:1,mayorId:1,mayorName:'Prefeito'};
  const losses=report([{label:'Emprego e renda do trabalho',points:-10},{label:'Condições atuais: alimentação',points:-3}]);
  reviewGovernmentResponse(city,term,losses);assert.equal(term.response.current.metric,'employed');
  city.minute=360;employment=25;reviewGovernmentResponse(city,term,losses);
  assert.equal(term.response.history.at(-1).change,5);assert.equal(term.response.current.metric,'employed');
  employment=20;city.minute=1440;reviewGovernmentResponse(city,term,losses);
  assert.equal(term.response.current.metric,'fed');assert.equal(term.response.priorities.find(row=>row.metric==='employed').loss,10);
  for(let i=0;i<25;i++){city.minute+=360;reviewGovernmentResponse(city,term,losses);}
  assert.equal(term.response.history.length,16);
  reviewGovernmentResponse(city,term,report([]));assert.equal(term.response.current,null);
});
test('agenda executes response alongside the original promise, throttles and survives snapshots',()=>{
  const city=setup({starter:true,population:24}),p=city.politics,term=p.mandates.current;
  assert(term);
  const promise=term.promises[0],original=promise.metric,agenda=new CityGovernmentAgenda(city),calls=[];
  agenda.execute=(term,pr)=>calls.push({term,pr});
  agenda.hourly(true);
  assert.equal(calls[0].pr,promise);assert.equal(promise.metric,original);
  assert(term.response.priorities.length>0);
  if(term.response.current.metric!==original){assert.equal(calls.length,2);assert.equal(calls[1].term.promises[0],term.response.current);}
  const count=calls.length;agenda.hourly();assert.equal(calls.length,count);
  const graph=new CityStateGraph(),snapshot=graph.encode({city}),restored=new CityStateGraph().apply(snapshot).city;bindCityState(restored);
  assert.equal(restored.politics.mandates.current.response.current.metric,term.response.current.metric);
});
test('response uses real funding, projects and legislative execution without creating a campaign promise',()=>{
  const city=setup({starter:true,population:24}),p=city.politics,term=p.mandates.current;
  const promises=term.promises.slice(),pr={metric:'housed',title:'Resposta à desaprovação: Moradia'};
  p.agenda.execute({...term,promises:[pr],responseAction:true},pr);
  assert.deepEqual(term.promises,promises);
  assert(pr.execution.actions.some(row=>row.billId)||pr.execution.blocked);
  const bill=p.council.bills.find(row=>row.promiseMetric==='housed');
  if(bill)assert.match(bill.title,/Resposta à desaprovação/);
});
