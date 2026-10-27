import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {legislativeOpinion,recordLegislativeOpinion} from '../js/city_party_public_record.js';

test('business owners may run by default and council can change the rule without removing sitting officials',()=>{
  const city=setup({starter:true,population:64}),p=city.politics,c=p.council.people()[0],party=p.party(c.political.partyId);
  c.businessIds.push(999999);assert(p.canRun(c,'council'));assert(p.eligible(c));
  const bill=p.submitBill('entrepreneurCandidates',{value:false},c.id);assert(bill);bill.status='approved';p.council.execute(bill);
  assert.equal(p.policy.entrepreneurCandidates,false);assert(!p.canRun(c,'council'));assert(p.eligible(c));assert(p.council.members.some(m=>m.citizenId===c.id));
  const reverse=p.submitBill('entrepreneurCandidates',{value:true},c.id);assert(reverse);reverse.status='approved';p.council.execute(reverse);assert(p.canRun(c,'council'));assert(party.active);
});

test('voters react to votes according to personal ideology and party records retain those reactions',()=>{
  const city=setup({starter:true,population:64}),p=city.politics,[left,right]=city.citizens.filter(c=>city.society.isAdult(c));
  left.political.ideology={economy:-1,liberty:0,green:.4};right.political.ideology={economy:1,liberty:0,green:.4};
  const policy={type:'entrepreneurCandidates',payload:{value:true}};assert(legislativeOpinion(city,left,policy)<0);assert(legislativeOpinion(city,right,policy)>0);
  const cut={type:'tax',payload:{value:city.taxRate-.02}};assert(legislativeOpinion(city,left,cut)>0);assert(legislativeOpinion(city,right,cut)>legislativeOpinion(city,left,cut));
  const sale={type:'privatize',payload:{}};assert(legislativeOpinion(city,left,sale)<0);assert(legislativeOpinion(city,right,sale)>0);
  const vote=p.council.people()[0],party=p.party(vote.political.partyId),bill={...policy,id:987,title:'Candidatura empresarial',votes:[{citizenId:vote.id,partyId:party.id,yes:true}]};recordLegislativeOpinion(p.standing,bill);
  const row=party.publicRecords.at(-1);assert(row.reactions[left.id]<0);assert(row.reactions[right.id]>0);assert(row.segments.some(g=>g.label==='Esquerda'));assert(row.segments.some(g=>g.label==='Direita'));
});
