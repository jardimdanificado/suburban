import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {CityPoliticalStanding} from '../js/city_political_standing.js';
import {POLITICAL_POSITIONS} from '../js/city_ideology.js';

test('legacy party reputation follows renamed positions without losing scores or records',()=>{
 const city=setup({starter:true,population:32}),standing=new CityPoliticalStanding(city),party=city.politics.parties[0];
 const old=['Ultraesquerda','Extrema esquerda','Esquerda','Centro-esquerda','Centro','Centro-direita','Direita','Extrema direita','Ultradireita'];
 party.reputationByPoliticalPosition=Object.fromEntries(old.map((position,i)=>[position,40+i]));
 party.reputationPositionOffsets=Object.fromEntries(old.map((position,i)=>[position,30+i]));
 party.archivedPoliticalPositionPoints={'Extrema esquerda':3,'Ultraesquerda':7};
 party.publicRecords=[{politicalPositions:[{position:'Extrema direita',points:2}]}];
 standing.ensurePartyReputation(party);
 assert.deepEqual(POLITICAL_POSITIONS.map(position=>party.reputationByPoliticalPosition[position]),old.map((_,i)=>40+i));
 assert.deepEqual(POLITICAL_POSITIONS.map(position=>party.reputationPositionOffsets[position]),old.map((_,i)=>30+i));
 assert.equal(party.archivedPoliticalPositionPoints['Esquerda radical'],3);
 assert.equal(party.archivedPoliticalPositionPoints['Extrema esquerda'],7);
 assert.equal(party.publicRecords[0].politicalPositions[0].position,'Direita radical');
 standing.partyReputations();
 assert(Number.isFinite(party.publicReputation));
 const scores={...party.reputationByPoliticalPosition};
 standing.partyReputations();
 assert.deepEqual(party.reputationByPoliticalPosition,scores);
});

test('incomplete and already contaminated reputation is repaired on refresh',()=>{
 const city=setup({starter:true,population:32}),standing=new CityPoliticalStanding(city),party=city.politics.parties[0];
 party.publicReputation=NaN;
 party.reputationByPoliticalPosition={Centro:62,'Esquerda radical':NaN};
 party.reputationPositionOffsets={Centro:60,'Esquerda radical':NaN,'Direita radical':null};
 standing.partyReputations();
 for(const position of POLITICAL_POSITIONS){assert(Number.isFinite(party.reputationByPoliticalPosition[position]));assert(Number.isFinite(party.reputationPositionOffsets[position]));}
 assert(Number.isFinite(party.publicReputation));
 assert.equal(party.reputationPositionOffsets.Centro,60);
});
