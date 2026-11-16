import test from 'node:test';
import assert from 'node:assert/strict';
import {gerarTituloTematico} from '../js/vocabulario.js';
import {setup} from './helpers/city.mjs';

test('art titles are compact vocabulary words rather than generated sentence frames',()=>{
 let seed=71;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},titles=Array.from({length:40},()=>gerarTituloTematico('arte',{random}));
 assert(titles.every(title=>title.length>0&&!/[.!?;,]/u.test(title)));
 assert(new Set(titles).size>20);
});

test('legacy spontaneous flag slogans are replaced while authored artwork stays intact',()=>{
 const city=setup({starter:true,population:24}),creator=city.citizens[0];
 const legacy=city.justice.createArtwork({kind:'banner',message:'Nossa janela, nossa voz · CCC',creatorId:creator.id,sponsorId:creator.id,purpose:'expression',x:8,y:8});
 legacy.kind='flags'; // Saved artwork from before pennants were removed.
 const spontaneous=city.justice.createArtwork({kind:'painting',message:'A arte tropical celebra o encontro da vila.',creatorId:creator.id,sponsorId:creator.id,purpose:'expression',x:7,y:8});city.log('A moradora criou uma pintura sem patrocínio.','justice',[creator.id],{kind:'spontaneous-artwork',artId:spontaneous.id});
 const authored=city.justice.createArtwork({kind:'painting',message:'Nossa janela, nossa voz',creatorId:creator.id,purpose:'commissioned',x:9,y:8});
 city.gigs.migrateLegacyArtworkTitles();
 assert.notEqual(legacy.message,'Nossa janela, nossa voz · CCC');
 assert.notEqual(spontaneous.message,'A arte tropical celebra o encontro da vila.');
 assert(!/[.!?;,]/u.test(legacy.message));
 assert.equal(authored.message,'Nossa janela, nossa voz');
});

test('pennants cannot be created or ordered, and saved works become banners without losing their history',()=>{
 const city=setup({starter:true,population:8}),creator=city.citizens[0];
 assert.equal(city.justice.createArtwork({kind:'flags',message:'Bandeirinhas',x:8,y:8}),null);
 const building=city.buildings.find(b=>b.active&&b.constructionKind!=='open-air');
 assert.equal(city.gigs.createArtworkOrder('treasury',building.id,{kind:'flags',message:'Bandeirinhas'}),false);
 const legacy=city.justice.createArtwork({kind:'banner',message:'Mensagem preservada',creatorId:creator.id,x:8,y:8});
 legacy.kind='flags';legacy.layers.push({id:1,message:'Pixo preservado'});
 const campaign={kind:'flags',campaignDecorationId:123};city.justice.art.push(campaign);
 const revision=city.justice.artRevision;
 city.justice.migratePennantArtwork();
 assert.equal(legacy.kind,'banner');assert.equal(legacy.creatorId,creator.id);
 assert.equal(legacy.message,'Mensagem preservada');assert.equal(legacy.layers[0].message,'Pixo preservado');
 assert.equal(campaign.kind,'flags');assert.equal(city.justice.artRevision,revision+1);
 city.justice.migratePennantArtwork();assert.equal(city.justice.artRevision,revision+1);
});
