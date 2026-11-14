import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {PLANT_SPECIES} from '../js/city_nature.js';
import {CROPS,GOODS} from '../js/city_economy.js';
import {SUBSTANCES,INFUSIONS} from '../js/city_substance_catalog.js';
import {farmPlantSurface} from '../js/farm_plant_geometry.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
function fixture(){const city=setup({population:12}),c=city.citizens.find(c=>c.fixtureInvestor&&!city.politics.officeHolder(c));c.path=[];c.indoorLocation=null;c.custody=null;c.sleep=null;for(const k of Object.keys(c.needs))c.needs[k]=90;return {city,c};}
function plant(city,species){for(let y=3;y<125;y++)for(let x=3;x<125;x++){const p=city.nature.spawn(x,y,species,{mature:true});if(p)return p;}throw Error('No free plant location');}
function stand(c,p){c.indoorLocation=null;c.entity.x=p.x+.5;c.entity.y=p.y+.5;}
test('every species has renewable products in the economy and a farm crop; every crop also grows wild',()=>{
 for(const [id,spec]of Object.entries(PLANT_SPECIES)){assert.ok(Object.keys(spec.products).length,id);assert.ok(CROPS[spec.crop],id);for(const good of Object.keys(spec.products))assert.ok(GOODS[good]?.price>0,good);}
 for(const [good,crop]of Object.entries(CROPS))assert.ok(PLANT_SPECIES[crop.plantSpecies||good],good);
 for(const id of ['cubensis','amanita','peyote','trombeta_anjo']){assert.equal(SUBSTANCES[id].regime,'prohibited');assert.equal(INFUSIONS[`cha_${id}`].substance,id);assert.equal(CROPS[id].nonFood,true);}
});
test('crop meshes are finite, deterministic, textured, bounded, and distinguish the primary harvest silhouettes',()=>{
 const signatures=new Set();for(const good of ['alface','arroz','trigo','cevada','milho','mandioca','tomate','feijao','cebola','coentro','girassol','cana','grao_cafe','folha_tabaco','flor_cannabis','folha_coca','cubensis','amanita','peyote','trombeta_anjo','agave','uva','lupulo']){const s=farmPlantSurface(good);assert.deepEqual(s,farmPlantSurface(good));for(const values of Object.values(s))assert.ok(values.every(Number.isFinite),good);assert.equal(s.positions.length,s.colors.length);assert.equal(s.positions.length/3,s.parts.length);assert(s.positions.length/9<2200,good);signatures.add(JSON.stringify(s.positions));}assert.equal(signatures.size,23);
});
test('wild fruit gathering conserves inventory, keeps the tree, observes capacity and regrows only once per cooldown',()=>{
 const {city,c}=fixture(),p=plant(city,'mango');stand(c,p);const before=city.economy.produced.manga||0;assert.equal(city.nature.collect(c,p,'manga',99),3);assert.equal(city.nature.collect(c,p,'manga',1),0);assert(city.nature.plants.has(p.id));assert.equal(c.inventory.manga,3);assert.equal(city.economy.produced.manga,before+3);assert(city.nature.eat(c,'manga'));assert.equal(c.inventory.manga,2);assert.equal(city.economy.consumed.manga,1);
 city.minute=p.gatheredProducts.manga.readyAt;c.inventoryCapacity=Object.values(c.inventory).reduce((n,q)=>n+q,0);assert.equal(city.nature.collect(c,p,'manga'),0);c.inventoryCapacity+=1;assert.equal(city.nature.collect(c,p,'manga',99),1);assert.equal(city.nature.stock(p,'manga'),2);c.entity.x+=5;assert.equal(city.nature.collect(c,p,'manga'),0);
});
test('gathering uses walking and work; competing collectors cannot duplicate the last product',()=>{
 const {city,c}=fixture(),p=plant(city,'alface'),other=city.citizens.find(p=>p!==c);stand(c,p);stand(other,p);other.custody=null;other.sleep=null;assert(city.nature.routeGather(c,p,'alface'));c.path=[];for(let i=0;i<6;i++)city.nature.perform(c);assert.equal(c.inventory.alface,3);assert.equal(city.nature.collect(other,p,'alface'),0);assert.equal(c.task,null);
});
test('all hallucination plants can be infused with conserved goods; toxicity remains in infusions and raw mushrooms can be eaten',()=>{
 for(const raw of ['cubensis','amanita','peyote','trombeta_anjo']){const {city,c}=fixture(),s=city.substances,home=s.home(c);assert(home);c.inventory[raw]=1;city.economy.initialStock[raw]++;c.entity.x=home.door.x;c.entity.y=home.door.y;assert(s.startInfusion(c,raw));c.path=[];for(let i=0;i<8;i++)s.performInfusion(c);assert.equal(c.inventory[raw],0);assert.equal(c.inventory[`cha_${raw}`],0);assert.equal(city.economy.produced[`cha_${raw}`],1);assert.equal(city.economy.consumed[raw],1);assert.equal(city.economy.consumed[`cha_${raw}`],1);assert.equal(c.lastSubstanceUse.id,raw);assert(c.substanceModifiers.cognition<1);if(['amanita','trombeta_anjo'].includes(raw))assert(c.needs.health<70);}
 const {city,c}=fixture();c.inventory.cubensis=1;assert(city.substances.consume(c,'cubensis'));assert.equal(c.lastSubstanceUse.good,'cubensis');
});
test('wild felling records a crime, approved licenses spend quota, and construction clearing never requires a license',()=>{
 const {city,c}=fixture(),b=city.buildings.find(b=>b.type==='farm');let p=plant(city,'oak');stand(c,p);assert(city.nature.harvest(b,p,c));assert(city.justice.cases.some(r=>r.type==='unlicensedTreeFelling'));
 const permit=city.nature.requestFellingLicense(b);assert.equal(permit.status,'pending');city.minute+=60;city.nature.reviewFellingLicenses();assert.equal(permit.status,'approved');p=plant(city,'oak');stand(c,p);const count=city.justice.cases.length;assert(city.nature.harvest(b,p,c));assert.equal(permit.remaining,7);assert.equal(city.justice.cases.length,count);
 p=plant(city,'oak');city.nature.remove(p,'removida para pavimentação municipal');assert.equal(city.justice.cases.length,count);assert.equal(permit.remaining,7);
});
test('old saves gain every crop, infusion, ledger and law without losing inventories; gathering and license clocks survive saves',()=>{
 const {city,c}=fixture(),p=plant(city,'mango');stand(c,p);city.nature.collect(c,p,'manga',1);const b=city.buildings.find(b=>b.type==='farm');city.nature.requestFellingLicense(b);delete city.goodsCatalogSchemaVersion;delete city.economy.goods.cha_cubensis;delete c.inventory.cha_cubensis;
 const restored=new CityStateGraph().apply(new CityStateGraph().encode({city})).city;bindCityState(restored);const saved=restored.society.citizen(c.id);assert.equal(saved.inventory.manga,1);assert.equal(saved.inventory.cha_cubensis,0);assert(restored.economy.goods.cha_cubensis);assert.equal(restored.nature.stock(restored.nature.plants.get(p.id),'manga'),2);assert.equal(restored.nature.fellingLicenses[0].status,'pending');assert(restored.justice.policies.penalCode.unlicensedTreeFelling.criminal);
});
test('wild prohibited plants really spawn and possession is prosecuted only after nearby police detection; legal tea obeys its plant law',()=>{
 const {city,c}=fixture(),s=city.substances,p=plant(city,'cubensis');stand(c,p);assert.equal(city.nature.collect(c,p,'cubensis'),1);assert.equal(city.justice.cases.filter(r=>r.type==='substancePossession').length,0);
 const officer=city.citizens.find(x=>x!==c);officer.policePatrol={};officer.indoorLocation=null;officer.entity.x=c.entity.x+20;officer.entity.y=c.entity.y;assert.equal(s.inspect(officer,c),null);officer.entity.x=c.entity.x+.2;const record=s.inspect(officer,c);assert(record);assert.equal(record.type,'substancePossession');assert.equal(c.inventory.cubensis,0);assert.equal(city.economy.lost.cubensis,1);
 assert(s.setLaw('cubensis','free',4));c.inventory.cha_cubensis=1;city.minute+=361;assert.equal(s.inspect(officer,c),null);assert(s.consume(c,'cha_cubensis'));assert.equal(c.lastSubstanceUse.id,'cubensis');
 const author=city.politics.council.people()[0];for(const id of ['amanita','peyote','trombeta_anjo'])assert(city.politics.council.propose(author,'substanceLaw',{substance:id,regime:'regulated',limit:2}));
});
test('selling a wild harvest transfers actual items and money without creating either',()=>{
 const {city,c}=fixture(),p=plant(city,'mango'),b=city.buildings.find(b=>b.type==='market');stand(c,p);city.nature.collect(c,p,'manga',3);const goods=b.inventory.manga||0,money=c.balance,balance=b.balance;c.entity.x=b.door.x;c.entity.y=b.door.y;assert.equal(city.nature.sell(c,b,'manga',2),2);assert.equal(c.inventory.manga,1);assert.equal(b.inventory.manga,goods+2);assert.equal(c.balance-money,balance-b.balance);assert(c.balance>money);
});
