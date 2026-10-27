import test from 'node:test';
import assert from 'node:assert/strict';
import {makePartyFlag,flagContrast} from '../js/city_party_flags.js';
import {COLOR_PALETTE} from '../js/city_colors.js';
import {setup} from './helpers/city.mjs';
const tastes=(id,values)=>({id,colorPreferences:Object.fromEntries(COLOR_PALETTE.map(c=>[c.hex,values[c.name]??-1]))});
test('party flags get random colors with readable contrast',()=>{
 const values=[.12,.81,.24,.73,.36,.65,.48,.57,.19,.92],city={random:()=>values.shift()??.4};
 const first=makePartyFlag(city,0),second=makePartyFlag(city,1);
 assert.notEqual(first.background,second.background);
 assert(!COLOR_PALETTE.some(c=>c.hex===first.background));
 assert(flagContrast(first.foreground,first.background)>=4.5);
 assert(flagContrast(second.foreground,second.background)>=4.5);
 assert.equal(first.colorSource,'random');
});
test('party colors stay random when founding members are assigned',()=>{
 const city=setup({starter:true,population:64}),p=city.politics;for(const party of p.parties.filter(p=>p.active)){assert(party.founderIds.length);assert.equal(party.flag.colorSource,'random');assert(flagContrast(party.flag.foreground,party.flag.background)>=4.5);for(const id of party.memberIds)assert.equal(city.society.citizen(id).entity.properties.render.color,parseInt(party.flag.background.slice(1),16));}
 const founders=city.citizens.slice(0,2);for(const c of founders)c.colorPreferences=tastes(c.id,{roxo:1,branco:.6}).colorPreferences;
 const proposal={id:999,status:'approved',founderIds:founders.map(c=>c.id),ideology:p.parties[0].ideology,name:'União Roxa',short:'UR',nameVersion:3};p.organization.proposals.push(proposal);const party=p.createParty({proposalId:proposal.id});assert(party);assert.equal(party.flag.colorSource,'random');assert(flagContrast(party.flag.foreground,party.flag.background)>=4.5);
});
