import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney} from './helpers/city.mjs';
import {describePoliticalOrientation,ideologicalProfile} from '../js/city_ideology.js';

function fixture(cash){
  const city=setup({starter:true,population:48}),p=city.politics;
  p.beginElection();
  let institute;
  for(const site of city.economy.locateBuilding('research_institute')){
    institute=city.addBuilding('research_institute',site.x,site.y,{...site,free:true});
    if(institute)break;
  }
  assert(institute);
  city.economy.activateMunicipalBusiness(institute,0);
  const holder=city.citizens[0].accountId;
  assert(city.transfer('treasury',holder,city.treasury-cash,'Fixture reserves'));
  return {city,p,r:p.getResearch(),institute,holder};
}

test('both mandatory commissions use actual treasury even below the social reserve',()=>{
  const {city,p,r,institute}=fixture(150000),before=totalMoney(city),cash=city.treasury;
  assert(cash<city.fiscal.reserve());
  for(const key of ['mayor','council']){
    const s=r.createStudy(p.active,institute,{key,label:key,organizerId:null});
    assert.equal(s.status,'collecting');
    assert.equal(s.funded,Math.ceil(s.budget*1.5));
    const balance=city.treasury;r.fund(s);assert.equal(city.treasury,balance);
  }
  const paid=r.studies.filter(s=>s.commission).reduce((n,s)=>n+s.funded,0);
  assert.equal(city.treasury,cash-paid);
  assert.equal(totalMoney(city),before);
  assert.equal(city.transfer('treasury',institute.accountId,1000,'Serviço: pesquisa opcional'),false);
  assert.equal(city.transfer('treasury',institute.accountId,1000,'Pesquisa obrigatória falsa',{mandatoryResearch:true,studyId:-1,buildingId:institute.id}),false);
});

test('mandatory research waits for real cash and then charges only the unpaid portion',()=>{
  const {city,p,r,institute,holder}=fixture(100),before=totalMoney(city);
  const s=r.createStudy(p.active,institute,{key:'mayor',label:'Prefeitura',organizerId:null});
  assert.equal(s.status,'funding');assert.equal(s.funded,0);assert.match(s.reason,/caixa municipal.*faltam/);
  const required=Math.ceil(s.budget*1.5),partial=100;
  assert(city.transfer('treasury',institute.accountId,partial,'Pesquisa obrigatória',{mandatoryResearch:true,studyId:s.id,buildingId:institute.id}));
  s.funded=partial;
  assert(city.transfer(holder,'treasury',required-partial,'Fixture return'));
  r.fund(s);
  assert.equal(s.funded,required);assert.equal(s.status,'collecting');assert.equal(city.treasury,0);
  assert.equal(totalMoney(city),before);
});

test('orientation describes personal beliefs, independent of party affiliation',()=>{
  const c={political:{partyId:1,ideology:{economy:-.45,liberty:.5,green:.8}},traits:{frugality:.5}};
  const profile=ideologicalProfile(c),description=describePoliticalOrientation(c);
  assert.equal(description.position,'Centro-esquerda');assert.equal(description.ideology,'Social-democracia');
  assert.match(description.label,/Ambientalismo/);assert.match(description.civil,/Libertária/);
  assert.equal(ideologicalProfile(c),profile);
  assert.equal(describePoliticalOrientation({ideology:{economy:.9,liberty:-.8,green:.2}}).ideology,'Capitalismo autoritário');
  assert.equal(describePoliticalOrientation({ideology:{economy:0,liberty:0,green:.4}}).position,'Centro');
  assert.match(describePoliticalOrientation(null).label,/não definida/);
});
