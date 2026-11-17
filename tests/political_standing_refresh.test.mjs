import test from 'node:test';
import assert from 'node:assert/strict';
import {CityPoliticalStanding} from '../js/city_political_standing.js';

test('standing preserves overlapping electorates while bounding opinion calculations',()=>{
  let calls=0;
  const citizens=[0,1,2].map((n)=>({id:n+1,entity:{destroyed:false},skills:{social:50,governance:50},jobId:n===1?null:10,role:n===1?'mayor':'worker',businessIds:n===1?[1]:[],homeUnitId:n?20:null,balance:n?20000:1000,needs:{food:80},traits:{openness:n===1?.2:.9},political:{partyId:1,tenure:{},ideology:{economy:[0,1,-.5][n],liberty:[0,.5,1][n],green:[.8,.2,.8][n]},memories:[]}}));
  citizens[0].political.memories=[{candidateId:2,partyId:1,effect:10,kind:'campaign-rally'},{candidateId:3,partyId:1,effect:-6,kind:'policy-reaction'}];
  citizens[1].political.memories=[{candidateId:1,partyId:2,effect:20,kind:'campaign-rally'}];
  const city={citizens,minute:542,day:0,society:{isAdult:()=>true,related:()=>false},reputation:{score:()=>50},economy:{mayorId:2},relationships:{view:(a,b)=>a===b?null:{trust:60,affection:30,resentment:2}},politics:{initializeCitizen(){},officeHolder:()=>false,parties:[],approval:50,mandates:{recordScore:()=>0},distance(a,b){calls++;return Math.abs(a.economy-b.economy)+Math.abs(a.liberty-b.liberty)*.35+Math.abs(a.green-b.green)*.3;}}};
  const standing=new CityPoliticalStanding(city);standing.partyReputations=()=>{};standing.cases=()=>[];standing.refresh();
  assert.equal(calls,9,'evaluate each candidate/observer pair once');
  assert.deepEqual(citizens.map(c=>c.political.popularity),[63.36666666666667,60.74285714285714,55.89047619047619]);
  assert.deepEqual(citizens[1].political.popularityByElectorate,{
    todos:{score:54.838095238095235,size:3},
    trabalhadores:{score:49.25714285714285,size:2},
    empreendedores:{score:66,size:1},
    'sem-moradia':{score:52.91428571428571,size:1},
    'baixa-renda':{score:52.91428571428571,size:1},
    servidores:{score:66,size:1},
    ambientalistas:{score:49.25714285714285,size:2},
    reformistas:{score:49.25714285714285,size:2},
  });
  standing.refresh();assert.equal(calls,9,'unchanged period skips refresh');
  citizens[0].homeUnitId=20;
  citizens[0].political.memories.push({candidateId:2,effect:10});
  standing.refresh(true);
  assert.equal(calls,18);
  assert.equal(citizens[1].political.popularityByElectorate['sem-moradia'],undefined);
  assert.ok(citizens[1].political.popularityByElectorate.todos.score>54.838095238095235,'forced refresh observes new memories');
});
