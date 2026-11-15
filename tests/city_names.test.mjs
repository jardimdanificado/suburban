import test from 'node:test';
import assert from 'node:assert/strict';
import {CITY_NAME_NOUNS,makeCityName,makeBuildingName} from '../js/city_names.js';
import {setup} from './helpers/city.mjs';

test('city names sample every place noun equally instead of fixing Vila',()=>{
 const prefixes=new Set();
 for(let i=0;i<CITY_NAME_NOUNS.length;i++){
  let calls=0;const city={random:()=>calls++===0?(i+.5)/CITY_NAME_NOUNS.length:.6};
  const name=makeCityName(city,new Set());assert.ok(name.startsWith(`${CITY_NAME_NOUNS[i]} `));assert.ok(name.length<=48);prefixes.add(name.split(' ')[0]);
 }
 assert.equal(prefixes.size,CITY_NAME_NOUNS.length);assert.ok(prefixes.size>=30);
});
test('city names remain unique with a constant random source; building labels stay unchanged',()=>{
 const city={random:()=>.5},used=new Set();const first=makeCityName(city,used),second=makeCityName(city,used);
 assert.notEqual(first,second);assert.equal(used.size,2);assert.ok(makeBuildingName(city,new Set(),'Padaria').startsWith('Padaria '));
});
test('existing municipal names survive identity normalization',()=>{
 const city=setup({starter:true,population:8});
 city.municipalIdentity.name='Vila Antiga';city.life.cityName=()=>{throw Error('Must preserve existing name');};
 assert.equal(city.politics.ensureMunicipalIdentity().name,'Vila Antiga');
});
