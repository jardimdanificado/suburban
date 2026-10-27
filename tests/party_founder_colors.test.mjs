import test from 'node:test';
import assert from 'node:assert/strict';
import {makePartyFlag,founderColoredFlag,flagContrast} from '../js/city_party_flags.js';
import {COLOR_PALETTE} from '../js/city_colors.js';
import {setup} from './helpers/city.mjs';
const tastes=(id,values)=>({id,colorPreferences:Object.fromEntries(COLOR_PALETTE.map(c=>[c.hex,values[c.name]??-1]))});
test('founders choose a mutually liked party color instead of the old indexed palette',()=>{
 const a=tastes(1,{vermelho:1,verde:.7}),b=tastes(2,{azul:1,verde:.7}),flag=makePartyFlag({random:()=>.4},0,[a,b]);assert.equal(flag.background,COLOR_PALETTE.find(c=>c.name==='verde').hex);assert(flagContrast(flag.foreground,flag.background)>=4.5);assert.deepEqual(flag.colorFounderIds,[1,2]);assert.equal(flag.colorSource,'founders');
 assert.deepEqual(founderColoredFlag(flag,[b,a,a]).background,flag.background);
});
test('initial parties record their founding nucleus and approved new parties use actual proposal founders',()=>{
 const city=setup({starter:true,population:64}),p=city.politics;for(const party of p.parties.filter(p=>p.active)){assert(party.founderIds.length);assert.equal(party.flag.colorSource,'founders');const expected=founderColoredFlag(party.flag,party.founderIds.map(id=>city.society.citizen(id)));assert.equal(party.flag.background,expected.background);for(const id of party.memberIds)assert.equal(city.society.citizen(id).entity.properties.render.color,parseInt(party.flag.background.slice(1),16));}
 const founders=city.citizens.slice(0,2);for(const c of founders)c.colorPreferences=tastes(c.id,{roxo:1,branco:.6}).colorPreferences;
 const proposal={id:999,status:'approved',founderIds:founders.map(c=>c.id),ideology:p.parties[0].ideology,name:'União Roxa',short:'UR',nameVersion:3};p.organization.proposals.push(proposal);const party=p.createParty({proposalId:proposal.id});assert(party);assert.equal(party.flag.background,COLOR_PALETTE.find(c=>c.name==='roxo').hex);assert.deepEqual(party.flag.colorFounderIds,proposal.founderIds);
});
