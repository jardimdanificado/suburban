import test from 'node:test';
import assert from 'node:assert/strict';
import {CityHistory,HISTORY_LIMIT} from '../js/city_history.js';
import {CityStateGraph} from '../js/city_state.js';
import {governmentTopic} from '../js/city_favorites.js';
function fixture(){const city={minute:0,world:{map:new Uint8Array(1),revision:0},buildings:[],building:()=>null,accountName:id=>id};city.history=new CityHistory(city);return city;}
function record(city,id=1){city.minute++;return city.history.record('social','Ação '+city.minute,[`citizen:${id}`]);}
test('favorite retention survives global pruning and enforces per-person limit',()=>{const city=fixture(),h=city.history;h.configureFavorites([1],1000);for(let i=0;i<HISTORY_LIMIT+600;i++)record(city,i%2?1:2);h.prune();assert.equal(h.favoriteArchive.get(1).length,1000);assert.equal(h.rows('citizen:1').length,1000);assert.equal(h.favoriteArchive.has(2),false);assert.equal(h.query({citizenId:1,limit:2000}).length,1000);});
test('unlimited favorites remain inspectable after ordinary events expire',()=>{const city=fixture(),h=city.history;h.configureFavorites([1],0);const first=record(city);for(let i=0;i<HISTORY_LIMIT+600;i++)record(city);h.prune();assert(!h.byId.has(first.id));assert.equal(h.get(first.id),first);assert.equal(h.query({accountId:'citizen:1',limit:Infinity}).length,HISTORY_LIMIT+601);h.configureFavorites([1],1000);assert.equal(h.favoriteArchive.get(1).length,1000);h.configureFavorites([]);assert.equal(h.favoriteArchive.size,0);});
test('favorite configuration and archive synchronize while paused and then incrementally',()=>{const city=fixture(),h=city.history,sender=new CityStateGraph(),receiver=new CityStateGraph();record(city);let copy=receiver.apply(sender.encode({city})).city;h.configureFavorites([1],0);copy=receiver.apply(sender.encode({city})).city;assert.deepEqual(copy.history.favoriteIds,[1]);const before=h.snapshotSince().cursor;record(city);const delta=h.snapshotSince(before);assert.equal(delta.payload.favorites.reset,false);assert.equal(delta.payload.favorites.archive[0][1].length,1);copy=receiver.apply(sender.encode({city})).city;assert.equal(copy.history.favoriteArchive.get(1).length,2);h.pruneBefore(h.nextId);copy=receiver.apply(sender.encode({city})).city;assert.equal(copy.history.get(1)?.message,'Ação 1');});
test('corner government stream excludes routine treasury payments',()=>{assert.equal(governmentTopic({kind:'finance',accounts:['treasury'],message:'Pagamento'}),null);assert.equal(governmentTopic({kind:'policy',message:'Lei aprovada'}),'policy');assert.equal(governmentTopic({kind:'construction',projectId:1,accounts:['treasury'],message:'Obra concluída'}),'construction');assert.equal(governmentTopic({kind:'construction',projectId:1,accounts:['treasury'],message:'Entrega de material'}),null);});

test('favorite action transitions are recorded once per change',()=>{const city=fixture(),c={id:1,accountId:'citizen:1',action:'Descansando',entity:{destroyed:false,properties:{name:'Ana'}}};city.society={citizen:id=>id===1?c:null};city.history.configureFavorites([1]);city.history.captureFavoriteActivities();assert.equal(city.history.total,0);c.action='Indo trabalhar';city.history.captureFavoriteActivities();city.history.captureFavoriteActivities();assert.equal(city.history.total,1);assert.equal(city.history.favoriteArchive.get(1)[0].activity,'Indo trabalhar');city.history.configureFavorites([]);c.action='Dormindo';city.history.captureFavoriteActivities();assert.equal(city.history.total,1);});

import {CityFavorites,historyEventType} from '../js/city_favorites.js';
function preferences(city,saved='{}'){
 const storage={value:saved,getItem(){return this.value;},setItem(_key,value){this.value=value;}};
 return {favorites:new CityFavorites({city,storage}),storage};
}
test('companies and parties retain indexed logs past pruning and synchronize incrementally',()=>{
 const city=fixture(),h=city.history;h.configureFavorites([1],0,['business:7','party:3','invalid:9']);
 const first=h.record('sale','Venda da empresa',['business:7','citizen:1'],{partyId:3});
 for(let i=0;i<HISTORY_LIMIT+600;i++)record(city,2);h.prune();assert(!h.byId.has(first.id));
 assert.equal(h.query({buildingId:7})[0].id,first.id);assert.equal(h.query({reference:'partyId:3'})[0].id,first.id);assert.equal(h.query({accountId:'party:3'})[0].id,first.id);assert.equal(h.favoriteArchive.has('invalid:9'),false);
 const copy=new CityHistory(city);let snapshot=h.snapshotSince();copy.applySnapshot(snapshot.payload);assert.deepEqual(copy.favoriteTargets,['business:7','party:3']);assert.equal(copy.query({buildingId:7})[0].id,first.id);
 const next=h.record('government','Troca de filiação',[],{fromPartyId:3,toPartyId:4});snapshot=h.snapshotSince(snapshot.cursor);assert.equal(snapshot.payload.favorites.reset,false);copy.applySnapshot(snapshot.payload);assert(copy.query({reference:'partyId:3'}).some(e=>e.id===next.id));
 h.configureFavorites([1],1000,['party:3']);copy.applySnapshot(h.snapshotSince(snapshot.cursor).payload);assert(!copy.favoriteArchive.has('business:7'));assert.equal(copy.favoriteArchive.get('party:3').length,2);
});
test('nonhuman tracking survives worker graph transfer without recording human activities',()=>{
 const city=fixture(),h=city.history,sender=new CityStateGraph(),receiver=new CityStateGraph();h.configureFavorites([],0,['business:9','party:2']);h.record('finance','Repasse',['business:9','party:2']);
 let copy=receiver.apply(sender.encode({city})).city;assert.equal(copy.history.favoriteArchive.get('business:9').length,1);assert.deepEqual(copy.history.favoriteIds,[]);assert.equal(h.favoriteActions.size,0);
 h.record('government','Decisão do partido',[],{partyId:2});copy=receiver.apply(sender.encode({city})).city;assert.equal(copy.history.favoriteArchive.get('party:2').length,2);assert.equal(copy.history.query({reference:'partyId:2'}).length,2);
});
test('political reactions cannot flood useful government and favorite events, and can be reenabled',()=>{
 const city=fixture(),{favorites:f}=preferences(city);f.togglePerson(1);const useful=city.history.record('government','Votação concluída',['citizen:1'],{kind:'bill-voted',billId:2});
 for(let i=0;i<200;i++)city.history.record('government','Reação da população',['citizen:1'],{kind:'party-legislative-reputation',partyId:3,billId:2,points:1});
 const personal=city.history.record('reputation','Reação ao voto',['citizen:1'],{billId:2});assert.equal(historyEventType(personal),'politics.person-reaction');
 assert.deepEqual(f.events().map(e=>e.id),[useful.id]);f.setType('politics.party-reaction',true);assert(f.events().length>1);assert(!f.events().some(e=>e.id===personal.id));f.setType('politics.person-reaction',true);assert(f.events().some(e=>e.id===personal.id));
 f.setType('politics.votes',false);assert(!f.events().some(e=>e.id===useful.id));
});
test('intervention orders, funding and execution have independent filters, without tagging unrelated party events',()=>{
 const city=fixture(),{favorites:f}=preferences(city),h=city.history;
 const order=h.record('government','Ordem',[],{kind:'observer-intervention',action:'serviceOrder',interventionId:8,gigId:5,partyId:3});
 const funding=h.record('finance','Financiamento',[],{kind:'observer-intervention',interventionId:8});
 const completed=h.record('service','Serviço concluído',[],{kind:'gig-completed',gigId:5});assert.equal(completed.interventionId,8);
 const unrelated=h.record('government','Partido elege dirigente',[],{kind:'party-leader-elected',partyId:3});assert.equal(unrelated.interventionId,undefined);
 assert.equal(historyEventType(order),'interventions.orders');assert.equal(historyEventType(funding),'interventions.finance');assert.equal(historyEventType(completed),'interventions.effects');
 assert(f.events().some(e=>e.id===completed.id));f.setType('interventions.effects',false);assert(!f.events().some(e=>e.id===completed.id));assert(f.events().some(e=>e.id===order.id));
 f.filters.interventionId=8;assert(f.events().every(e=>e.interventionId===8));f.setType('interventions.orders',false);f.setType('interventions.finance',false);assert.equal(f.events().length,0);
});
test('company and party preferences have no marker properties, persist and reset with the world',()=>{
 const city=fixture(),{favorites:f,storage}=preferences(city);f.toggleBusiness(7);f.toggleParty(3);assert.deepEqual(f.businesses[7],{feed:true});assert.deepEqual(f.parties[3],{feed:true});assert.deepEqual(f.people,{});assert.equal(f.has(7),false);
 f.filters.partyId=3;f.setType('politics.party-reaction',true);const restored=new CityFavorites({city,storage});assert(restored.hasBusiness(7));assert(restored.hasParty(3));assert.equal(restored.filters.partyId,3);assert(restored.types.includes('politics.party-reaction'));
 city.world.seed='other';restored.refresh();assert.deepEqual(restored.businesses,{});assert.deepEqual(restored.parties,{});assert.equal(restored.filters.partyId,null);assert.equal(city.history.favoriteArchive.size,0);
});
test('favorite sources deduplicate events and all scope filters combine without changing the archive',()=>{
 const city=fixture(),{favorites:f}=preferences(city);f.government=false;f.togglePerson(1);f.toggleBusiness(7);f.toggleParty(3);
 const event=city.history.record('government','Votação',['citizen:1','business:7'],{partyId:3,billId:5,kind:'bill-voted'});assert.deepEqual(f.events().map(e=>e.id),[event.id]);
 f.filters={politicianId:1,partyId:3,billId:5,interventionId:null,days:1};assert.equal(f.events().length,1);f.filters.billId=6;assert.equal(f.events().length,0);assert.equal(city.history.favoriteArchive.get('business:7').length,1);f.filters.billId=5;city.minute=1441;assert.equal(f.events().length,0);
});
