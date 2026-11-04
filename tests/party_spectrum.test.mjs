import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {describePoliticalOrientation,ideologicalProfile} from '../js/city_ideology.js';
import {partyNameAgenda} from '../js/city_party_names.js';

test('new cities start with seven parties across the political spectrum and a three-ticket mayoral limit',()=>{
 const city=setup({starter:true,population:64}),government=city.politics,founders=government.parties.filter(p=>p.initialParty).sort((a,b)=>a.id-b.id),positions=founders.map(p=>describePoliticalOrientation(p).position);assert.equal(founders.length,7);assert.equal(government.parties.filter(p=>p.active).length,7);assert.deepEqual(founders.slice(0,4).map(p=>p.ideology.economy),[-.4,.45,.05,.35]);assert(positions.includes('Centro-esquerda'));assert(positions.includes('Centro'));assert(positions.includes('Centro-direita'));assert(positions.includes('Ultraesquerda'));assert(positions.includes('Ultradireita'));assert.equal(government.policy.mayorCandidateLimit,3);assert(founders.every(p=>p.initialParty));government.nextElectionAt=city.minute+100;government.beginElection();assert.equal(government.active.candidates.length,3);
});

test('party-name wording can inform doctrine without pushing a moderate party into an extreme label',()=>{
 const leftName='Partido Socialista dos Trabalhadores',rightName='Movimento Liberal Nacional';const left={name:leftName,nameAgenda:partyNameAgenda(leftName),ideology:{economy:-.35,liberty:.2,green:.4}},right={name:rightName,nameAgenda:partyNameAgenda(rightName),ideology:{economy:.35,liberty:.2,green:.4}};assert.equal(describePoliticalOrientation(left).position,'Centro-esquerda');assert.equal(describePoliticalOrientation(right).position,'Centro-direita');assert(ideologicalProfile(left).redistribution>ideologicalProfile(right).redistribution);
});

test('legacy saves rebalance only the four untouched extremist founding vectors and record the migration',()=>{
 const city=setup({starter:true,population:48}),government=city.politics,old=[[-1,.2,.35],[-1,1,.1],[.95,.9,.1],[-1,-1,.2]];government.partySpectrumVersion=0;for(const party of government.parties.filter(p=>p.initialParty&&p.id<=4))party.ideology=Object.freeze(Object.fromEntries(['economy','liberty','green'].map((key,i)=>[key,old[party.id-1][i]])));government.organize();assert.equal(government.partySpectrumVersion,1);const founders=government.parties.filter(p=>p.initialParty).sort((a,b)=>a.id-b.id);assert.deepEqual(founders.slice(0,4).map(p=>p.ideology.economy),[-.4,.45,.05,.35]);assert(founders.slice(0,4).every(p=>p.history.some(entry=>/Espectro inicial reequilibrado/.test(entry.description))));assert.equal(founders.length,7);assert(city.history.entries.filter(event=>event.message.includes('Partido fundador reequilibrado')).length>=4);
});
