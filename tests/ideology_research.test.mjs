import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {ideologicalProfile,policyAffinity} from '../js/city_ideology.js';

function institute(city){
  for(const site of city.economy.locateBuilding('research_institute')){
    const b=city.addBuilding('research_institute',site.x,site.y,{...site,free:true});if(!b)continue;
    city.economy.activateMunicipalBusiness(b,city.currency.price(500000));
    const team=city.citizens.filter(c=>!city.politics.officeHolder(c)&&!c.businessIds.length).slice(0,3);
    for(const c of team){city.economy.leaveJob(c,'Pesquisa');c.jobId=b.id;b.workers.push(c.id);}
    return b;
  }
  throw Error('No institute site');
}

test('economic side, ownership and civil liberties produce distinct legislative positions',()=>{
  const city=setup({starter:true,population:48}),left=ideologicalProfile({name:'Partido Socialista Trabalhista',ideology:{economy:-.8,liberty:.7,green:.7}}),right=ideologicalProfile({name:'Movimento Liberal',ideology:{economy:.8,liberty:.7,green:.3}}),statist=ideologicalProfile({name:'Partido Estadista',ideology:{economy:.2,liberty:-.7,green:.3}}),libertarian=ideologicalProfile({name:'Movimento Libertário',ideology:{economy:.2,liberty:.7,green:.3}});
  assert(left.redistribution>right.redistribution);assert(left.liberty>0&&right.liberty>0);
  assert(policyAffinity(left,city,'minimumWage',{value:city.politics.policy.minimumWage+1})>0);
  assert(policyAffinity(right,city,'minimumWage',{value:city.politics.policy.minimumWage+1})<0);
  assert(statist.ownership>libertarian.ownership);
  assert(policyAffinity(statist,city,'nationalize',{})>policyAffinity(libertarian,city,'nationalize',{}));
  assert(policyAffinity(left,city,'welfare',{value:city.welfare.policy.dailyBudget-1000})<0);
});

test('mandatory polls preempt annual contracts and publish unique field interviews before election day',()=>{
  const city=setup({starter:true,funded:true,population:256}),p=city.politics,r=p.getResearch(),b=institute(city);p.policy.pollMinRate=10;p.policy.pollMaxRate=15;
  for(const c of city.citizens){c.task=null;c.path=[];c.deliveryId=null;c.cleaningJobId=null;c.workMeal=null;c.conversation=null;for(const k of Object.keys(c.needs))c.needs[k]=95;}
  const annual=r.commissionService('treasury','public-priorities',null,b.id);assert(annual,city.lastError);
  p.beginElection();const e=p.active;assert(e.candidates.length);r.request(e);
  const site=r.studies.find(s=>s.electionId===e.id).sites[0];
  for(const c of city.citizens){c.entity.x=site.x;c.entity.y=site.y;}
  const end=city.minute+720;
  while(city.minute<end&&e.polls.length<2){
    city.minute++;r.updateMinute();
    for(const c of city.citizens){if(c.path.length){const point=c.path.shift();c.entity.x=point.x;c.entity.y=point.y;}else if(c.task==='research')r.fieldWork(c);}
  }
  assert.equal(e.polls.length,2,JSON.stringify(r.studies.map(s=>({id:s.id,status:s.status,n:s.responses.length,reason:s.reason,sessions:s.sessions.length}))));
  for(const poll of e.polls){assert(poll.minute<e.voteAt);assert(poll.sampleSize>=poll.minimum&&poll.sampleSize<=poll.maximum);assert.equal(new Set(poll.responses.map(r=>r.citizenId)).size,poll.sampleSize);assert(poll.responses.every(r=>r.agentId&&r.interviewedAt));}
  assert.equal(annual.status,'collecting');
});

test('researchers can return after a completed shift on the same day',()=>{
  const city=setup({starter:true,population:48}),p=city.politics,r=p.getResearch(),b=institute(city);p.beginElection();r.request(p.active);
  const study=r.studies.find(s=>s.electionId===p.active.id),agent=r.staff(b)[0];
  for(const c of r.staff(b)){c.task=null;c.path=[];c.deliveryId=null;c.cleaningJobId=null;c.workMeal=null;c.conversation=null;for(const k of Object.keys(c.needs))c.needs[k]=95;}
  city.minute=600;r.dispatch(study);const session=study.sessions.find(s=>s.agentId===agent.id);assert(session);
  r.releaseAgent(study,session,'Pausa');city.minute+=20;r.dispatch(study);
  assert.equal(study.sessions.filter(s=>s.agentId===agent.id).length,2);
});

test('normal city movement and needs publish both commissioned polls during the campaign',()=>{
  const city=setup(),p=city.politics;institute(city);p.nextElectionAt=city.minute+3*1440;p.beginElection();const election=p.active;
  for(let frame=0;frame<1440*4&&election.polls.length<2;frame++)city.update(1/16);
  assert.equal(election.polls.length,2);assert(election.polls.every(poll=>poll.minute<election.voteAt));
  assert.equal(election.status,'campaign');
});

test('council combines doctrine with individual conviction and reacts to policy direction',()=>{
  const city=setup({starter:true,population:48}),p=city.politics,c=p.council.people()[0],party=p.party(c.political.partyId);
  party.name='Partido Socialista Trabalhista';party.nameAgenda=null;party.ideology={economy:-1,liberty:.5,green:.4};c.political.loyalty=1;
  const increase={id:999,partyId:party.id,authorId:c.id,type:'welfare',payload:{value:city.welfare.policy.dailyBudget+10000}},decrease={...increase,payload:{value:Math.max(0,city.welfare.policy.dailyBudget-10000)}};
  assert(p.council.preference(c,increase).yes);assert(!p.council.preference(c,decrease).yes);
  c.political.ideology={economy:1,liberty:.7,green:.1};c.political.loyalty=0;c.balance=city.currency.price(20000);c.homeUnitId='owned-home';c.needs.food=95;
  assert(!p.council.preference(c,increase).yes);
});

test('public last resort complements private funding that cannot pay the field team',()=>{
  const city=setup({starter:true,population:48}),p=city.politics,r=p.getResearch(),b=institute(city);p.beginElection();const e=p.active;
  // No resident or firm has spare investment above the protected reserve.
  for(const c of city.citizens)if(c.balance>0)city.transfer(c.accountId,'treasury',c.balance,'Reservar capital');
  const s=r.createStudy(e,b);s.budget=s.funded+city.currency.price(1000);const original=s.funded;s.requestedAt=city.minute-61;
  r.fund(s);assert(s.funded>=s.budget);assert(s.funded>original);assert(s.funders.some(f=>f.kind==='contrato público de último recurso'));
});
