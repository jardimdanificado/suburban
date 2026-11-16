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

test('founding banks keep their vocabulary-generated registered names',()=>{
 const city=setup({starter:true,population:64});
 const banks=city.economy.businesses.filter(b=>b.foundingPrivateBank);
 assert.equal(banks.length,2);
 for(const bank of banks){
  assert.ok(city.life.usedBuildingNames.has(bank.entity.properties.name));
  assert.ok(bank.entity.properties.name.startsWith('Banco '));
 }
 assert.equal(new Set(banks.map(b=>b.entity.properties.name)).size,2);
});
test('foreign brands use stable vocabulary names for each good',async()=>{
 const {fictionalForeignBrand}=await import('../js/city_external_trade.js');
 const goods=['aco','borracha','rolamentos','madeira','papel'];
 const names=goods.map(fictionalForeignBrand);
 assert.ok(names.every(name=>/^[\p{L} ]+$/u.test(name)));
 assert.ok(new Set(names).size>1);
 assert.deepEqual(goods.map(fictionalForeignBrand),names);
});
test('exhausted random sampling falls back to vocabulary with unique serials',()=>{
 const city={random:()=>0},used=new Set();
 const names=Array.from({length:3},()=>makeBuildingName(city,used,'Banco'));
 assert.equal(new Set(names).size,3);
 assert.ok(names.every(name=>!name.includes('Horizonte')&&!name.includes('Pioneiro')));
});

test('newspapers without events generate thematic editorial text',async()=>{
 const {printNewspaper,NEWS_GENRES}=await import('../js/city_newspapers.js');
 const {gerarFraseTematica}=await import('../js/gerador_frases.js');
 for(const genre of NEWS_GENRES){
  const building={id:1,accountId:'paper',entity:{properties:{name:'Jornal Teste'}},newsGenre:genre};
  const city={day:1,minute:0,events:[],history:{entries:[],record:()=>({id:1})},politics:{},random:()=>.5,
   publications:{stock:()=>({id:1,entries:[]}),capacity:()=>10,nextEntryId:1,eventIndex:new Map()}};
  printNewspaper(city,building,1,{id:1,entity:{properties:{name:'Editor'}}});
  assert.equal(building.newsArticles[0].text,gerarFraseTematica(genre==='fofocas'?'familia':genre,{random:()=>.5,complexidade:'simples'}));
  assert.equal(building.newsArticles[0].truth,null);
 }
});
