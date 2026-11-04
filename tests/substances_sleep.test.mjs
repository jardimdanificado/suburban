import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {SLEEP_MINUTES,sleepMinute,wantsSleep,interruptSleep} from '../js/city_sleep.js';
import {SUBSTANCES,SUBSTANCE_CROPS,REFINING_LEAVES} from '../js/city_substance_catalog.js';
import {substanceStance} from '../js/city_substances.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
import {renderCitizenSubstances,renderSubstancePolicy} from '../js/city_substances_ui.js';
import {syncSubstanceSmoke} from '../js/city_substance_smoke.js';
import {INDUSTRIES} from '../js/city_industries.js';
const fixture=()=>{const city=setup({population:24}),c=city.citizens.find(c=>c.fixtureInvestor&&!city.politics.officeHolder(c));c.path=[];c.task=null;c.conversation=null;c.indoorLocation=null;for(const k in c.needs)c.needs[k]=95;return {city,c,s:city.substances};};
function stock(city,holder,good,quantity,quality=80){holder.inventory??={};holder.inventory[good]=(holder.inventory[good]||0)+quantity;city.economy.initialStock[good]+=quantity;city.substances.addLot(holder,good,quantity,quality,'test-stock');}

test('sleep lasts 480 actual minutes even at full energy, and coffee cannot settle the sleep requirement',()=>{
 const {city,c}=fixture();c.task='energy';c.needs.energy=100;
 for(let i=0;i<SLEEP_MINUTES-1;i++){city.minute++;sleepMinute(city,c);}assert.equal(c.task,'energy');assert.equal(c.sleep.minutes,479);
 city.minute++;sleepMinute(city,c);assert.equal(c.task,null);assert.equal(c.sleep.lastDuration,480);assert.equal(wantsSleep(city,c),false);
 c.needs.energy=65;city.minute+=120;assert.equal(wantsSleep(city,c),false);city.minute+=960;c.needs.energy=100;assert.equal(wantsSleep(city,c),true);
});
test('interrupted sleep resumes its remaining minutes instead of discarding or instantly paying the debt',()=>{
 const {city,c}=fixture();c.task='energy';for(let i=0;i<180;i++){city.minute++;sleepMinute(city,c);}interruptSleep(city,c);assert.equal(c.sleep.minutes,180);assert.equal(c.sleep.active,false);assert(wantsSleep(city,c));city.minute+=30;c.task='energy';for(let i=0;i<300;i++){city.minute++;sleepMinute(city,c);}assert.equal(c.sleep.completed,1);assert.equal(c.sleep.lastDuration,480);
});
test('initial laws separate coca, leaf and hemp, and regulated leaf carrying cannot fit a refining batch',()=>{
 const {s,c}=fixture();for(const id of ['cafe','alcool','tabaco'])assert.equal(s.law(id).regime,'free');assert.equal(s.law('coca').regime,'prohibited');assert.equal(s.law('folha_coca').regime,'regulated');assert(s.law('folha_coca').limit<REFINING_LEAVES);assert.equal(s.law('canhamo').limit,null);assert.equal(s.canTrade('folha_coca',null,c,{personal:true,quantity:REFINING_LEAVES}),false);assert.equal(s.canTrade('canhamo',null,c,{personal:true,quantity:100}),true);assert.equal(s.validateLaw('canhamo','regulated',4),false);
});
test('regulated crop needs a formal permit and a prohibited lab cannot produce',()=>{
 const {city,s,c}=fixture(),b=city.economy.businesses.find(b=>b.type==='farm');b.crop='folha_coca';b.ownerId=c.id;c.traits={...c.traits,honesty:1};assert.equal(s.canFarm(b),false);assert.equal(s.permits.at(-1).status,'pending');city.minute+=360;s.hourly();assert.equal(s.canFarm(b),true);assert.equal(s.permits.at(-1).status,'approved');assert.equal(s.canProduce({type:'coca_laboratory'}),false);assert(s.setLaw('coca','regulated',2));assert.equal(s.canProduce({type:'coca_laboratory'}),true);
});
test('addiction and potential-user coefficients have the requested order; tobacco is a cheaper, faster, larger crop',()=>{
 const addictive=['folha_coca','cannabis','cafe','alcool','tabaco','coca'];for(let i=1;i<addictive.length;i++)assert(SUBSTANCES[addictive[i]].addiction>SUBSTANCES[addictive[i-1]].addiction);
 const popularity=['alcool','cafe','tabaco','folha_coca','cannabis','coca'];for(let i=1;i<popularity.length;i++)assert(SUBSTANCES[popularity[i]].popularity<SUBSTANCES[popularity[i-1]].popularity);
 assert(SUBSTANCE_CROPS.folha_tabaco.grow<SUBSTANCE_CROPS.flor_cannabis.grow);assert(SUBSTANCE_CROPS.folha_tabaco.laborFactor<SUBSTANCE_CROPS.flor_cannabis.laborFactor);assert(SUBSTANCE_CROPS.folha_tabaco.yieldFactor>SUBSTANCE_CROPS.flor_cannabis.yieldFactor);
});
test('smoking damages lungs in the exact 1 : 0.5 : 5 ratio and leaves smoke at its original location',()=>{
 const {city,c,s}=fixture(),people=[c,...city.citizens.filter(p=>p!==c).slice(0,2)];for(const [i,id]of ['tabaco','cannabis','coca'].entries()){const p=people[i];p.custody=null;p.sleep=null;stock(city,p,id,1);const lungs=p.substanceState?.lungs??1;assert(s.consume(p,id));const strength=id==='cannabis'?Math.max(.5,.45+(p.lastSubstanceUse.intensity||0)/30):1;assert(Math.abs((lungs-p.substanceState.lungs)-SUBSTANCES[id].lung*strength)<1e-10);assert(p.substanceState.uses[id].dependence>0);assert.equal(p.lastSubstanceUse.id,id);}const smoke=s.smoke[0],original=smoke.x;c.entity.x+=5;assert.equal(smoke.x,original);assert.equal(s.smoke.length,2);
});
test('effects expire without mutating base skills; cannabis calms and cocaine impairs communication',()=>{
 const {city,c,s}=fixture(),skills={...c.skills};stock(city,c,'cannabis',1);assert(s.consume(c,'cannabis'));assert.equal(c.substanceModifiers.flee,true);assert(c.substanceModifiers.mobility<1);assert(c.substanceModifiers.hunger>1);assert.equal(city.justice.combatEncounter(c,city.citizens.find(p=>p!==c)),false);
 city.minute+=181;s.minute(c);assert.equal(c.substanceModifiers.flee,false);assert.equal(c.substanceModifiers.mobility,1);stock(city,c,'coca',1);assert(s.consume(c,'coca'));assert(c.substanceModifiers.speech<.3);assert(c.substanceModifiers.mobility>1);assert(c.substanceModifiers.aggression>.7);assert.deepEqual(c.skills,skills);
});
test('temporary stimulant energy is removed when its effect ends',()=>{
 const {city,c,s}=fixture();c.needs.energy=30;stock(city,c,'cafe',1);assert(s.consume(c,'cafe'));const boost=c.substanceState.effects.find(e=>e.id==='cafe').energyBoost;assert(boost>0);assert.equal(c.needs.energy,30+boost);c.needs.energy=100;city.minute+=SUBSTANCES.cafe.duration+1;s.minute(c,0);assert.equal(c.needs.energy,100-boost);assert.equal(c.substanceState.effects.length,0);
});
test('poor quality causes more health loss and less satisfaction than good quality',()=>{
 const {city,c,s}=fixture(),other=city.citizens.find(p=>p!==c);s.initialize(other);c.needs.health=other.needs.health=95;stock(city,c,'alcool',1,15);stock(city,other,'alcool',1,90);s.consume(c,'alcool');s.consume(other,'alcool');assert(c.needs.health<other.needs.health);assert(c.substanceModifiers.mood<other.substanceModifiers.mood);
});
test('lot transfers preserve weighted quality and real quantities',()=>{
 const {city,c,s}=fixture(),b=city.economy.businesses.find(b=>b.type==='farm');stock(city,b,'folha_coca',3,25);stock(city,b,'folha_coca',2,100);s.moveLots(b,c,'folha_coca',4);b.inventory.folha_coca-=4;c.inventory.folha_coca=4;assert.equal(s.quality(c,'folha_coca'),43.75);assert.equal(s.quality(b,'folha_coca'),100);assert.equal(city.goodsStock('folha_coca'),5);
});
test('domestic refining consumes abstract inputs and money and yields a single low-quality unit',()=>{
 const {city,c,s}=fixture(),home=s.home(c)||city.buildings.find(b=>b.type==='townhall');c.homeUnitId=home.units[0].id;c.entity.x=home.door.x;c.entity.y=home.door.y;c.task='substance-production';c.skills.baking=100;const stash=s.homeStock(c);stock(city,stash,'folha_coca',REFINING_LEAVES,90);c.substanceCraft={kind:'refine',inputs:{folha_coca:REFINING_LEAVES},outputs:{coca:1},labor:300,progress:299,cost:12000,qualityCap:32};const before=c.balance;assert(s.perform(c));assert.equal(c.substanceCraft,null);assert.equal(stash.inventory.folha_coca,0);assert.equal(c.inventory.coca,1);assert.equal(s.quality(c,'coca'),32);assert(c.balance<before);assert.equal(city.economy.consumed.folha_coca,REFINING_LEAVES);
});
test('police need actual proximity and duty before a seizure creates a case and evidence',()=>{
 const {city,c,s}=fixture(),officer=city.citizens.find(p=>p!==c);officer.entity.x=c.entity.x+20;officer.entity.y=c.entity.y;officer.indoorLocation=null;c.indoorLocation=null;stock(city,c,'coca',1);assert.equal(s.inspect(officer,c),null);officer.policePatrol={};officer.entity.x=c.entity.x+.3;const record=s.inspect(officer,c);assert(record);assert.equal(record.type,'substancePossession');assert.equal(record.details.seizedQuantity,1);assert.equal(c.inventory.coca,0);assert(record.evidence.some(e=>e.kind==='police-seizure'));assert.equal(city.economy.lost.coca,1);
});
test('council validates per-substance laws and preserves hemp without a carrying ceiling',()=>{
 const {city,s}=fixture(),council=city.politics.council,author=council.people()[0];assert(author);const bill=council.propose(author,'substanceLaw',{substance:'canhamo',regime:'free',limit:null});assert(bill);assert.equal(bill.type,'substanceLaw');assert.equal(council.propose(author,'substanceLaw',{substance:'canhamo',regime:'regulated',limit:4}),null);assert(substanceStance({ideology:{economy:0,liberty:0}},'coca')<-.5);assert(s.setLaw('canhamo','free',null));
});
test('new system and resident effects survive the worker state graph with methods rebound',()=>{
 const {city,c,s}=fixture();stock(city,c,'cafe',1);s.initialize(c).uses.cafe.liking=1;s.consume(c,'cafe');const writer=new CityStateGraph(),reader=new CityStateGraph(),packet=writer.encode({city}),restored=reader.apply(packet).city;bindCityState(restored);assert.equal(typeof restored.substances.consume,'function');assert.equal(restored.substances.city,restored);assert.equal(restored.substances.law('coca').regime,'prohibited');assert.equal(restored.society.citizen(c.id).lastSubstanceUse.id,'cafe');assert.equal(restored.society.citizen(c.id).substanceState.uses.cafe.count,1);
});
test('legacy saves gain the new catalog, ledgers and inventory fields during one-time migration',()=>{
 const {city}=fixture();city.substanceSchemaVersion=0;delete city.economy.goods.cafe;delete city.economy.produced.cafe;delete city.economy.consumed.cafe;delete city.economy.lost.cafe;delete city.buildings[0].inventory.canhamo;bindCityState(city);assert.equal(city.substanceSchemaVersion,4);assert.equal(city.economy.goods.cafe.label,'Café');assert.equal(city.economy.produced.cafe,0);assert.equal(city.buildings[0].inventory.canhamo,0);assert(city.buildingTypes.coca_laboratory);
});
test('industry batches consume their real inputs, produce distinct goods and obey hemp prohibition',()=>{
 const {city,c,s}=fixture(),b=city.economy.businesses.find(b=>b.type==='farm');b.type='coffee_roaster';Object.assign(b.inventory,{grao_cafe:4,carvao:1});b.productionLabor=22;c.skills.baking=100;const before=city.economy.produced.cafe;assert(city.economy.industrialWork(b,c,INDUSTRIES.coffee_roaster));assert.equal(b.inventory.grao_cafe,0);assert.equal(b.inventory.cafe,8);assert.equal(city.economy.produced.cafe,before+8);const loom={type:'hemp_weaver'};assert(s.canProduce(loom));assert(s.setLaw('canhamo','prohibited',null));assert.equal(s.canProduce(loom),false);
});
test('the full simulation retains a sleeping homeless resident through full energy until eight hours pass',()=>{
 const {city,c}=fixture();city.economy.leaveJob(c);c.businessIds=[];c.homeUnitId=null;c.homeId=null;c.task=null;c.childIds=[];c.dependents=[];city.substances.initialize(c).nocturnal=false;city.routeHomelessToSleep(c);c.entity.x=c.homelessSleepSpot.x;c.entity.y=c.homelessSleepSpot.y;c.path=[];c.needs.energy=95;
 let elapsed=0,sawFullEnergySleep=false;for(;elapsed<1000&&!c.sleep?.lastDuration;elapsed++){city.update(.25);if(c.sleep?.active&&c.needs.energy>=95&&c.sleep.minutes<480)sawFullEnergySleep=true;}assert(sawFullEnergySleep);assert.equal(c.sleep.lastDuration,480);assert.equal(c.sleep.active,false);assert(elapsed>=480);
});
test('the two cannabis outputs obey separate laws and discarded prohibited buds are accounted as losses',()=>{
 const {city,c,s}=fixture(),farm=city.economy.businesses.find(b=>b.type==='farm');farm.crop='flor_cannabis';farm.ownerId=c.id;c.traits={...c.traits,honesty:1};s.setLaw('canhamo','free',null);s.setLaw('cannabis','prohibited',0);farm.inventory.flor_cannabis=3;city.economy.produced.flor_cannabis+=3;s.harvest(farm,'flor_cannabis',3);assert.equal(farm.inventory.flor_cannabis,0);assert.equal(farm.inventory.canhamo,6);assert.equal(city.economy.lost.flor_cannabis,3);assert.equal(city.goodsStock('canhamo'),city.economy.initialStock.canhamo+city.economy.produced.canhamo-city.economy.lost.canhamo);
});
test('the policy UI submits an actual council bill and resident UI exposes dependency and current effects',()=>{
 const {city,c,s}=fixture(),buttons=[],tables=[];const p={heading(){},note(){},kv(){},record(){},table(...args){tables.push(args);},buttons(rows){buttons.push(...rows);}},ui={city};renderSubstancePolicy(ui,p);buttons.find(b=>b.label==='VOTAR NOVO LIMITE').click();assert(city.politics.council.bills.some(b=>b.type==='substanceLaw'&&b.payload.substance==='cafe'));
 stock(city,c,'cafe',1);s.consume(c,'cafe');renderCitizenSubstances(ui,p,c);assert(tables.some(([columns])=>columns.some(c=>c.label==='Dependência')));
});
test('smoke has binary ordered-dither transparency, stays at the use location and expires',()=>{
 const previous=globalThis.document;let pixels;globalThis.document={createElement(){return {width:0,height:0,getContext(){return {createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},putImageData(image){pixels=image.data;}};}};}};
 try{class Group{children=[];add(child){this.children.push(child);}}class Sprite{constructor(material){this.material=material;this.position={set:(...args)=>{this.point=args;}};this.scale={set(){}};}}const THREE={Group,Sprite,CanvasTexture:class{constructor(canvas){this.canvas=canvas;}},SpriteMaterial:class{constructor(options){Object.assign(this,options);}},NearestFilter:1};const group=new Group(),renderer={entityGroup:group,getSurfaceElevation(){return 0;}},city={minute:10,citizens:[],world:{map:[]},substances:{smoke:[{id:1,x:5,y:7,z:0,startedAt:10,until:28}]},building(){return null;}};syncSubstanceSmoke(THREE,renderer,city,100);const sprites=group.children[0].children;assert.equal(sprites.length,3);assert(sprites.every(s=>Math.abs(s.point[0]-5)<.2));const alphas=new Set(Array.from(pixels).filter((_,i)=>i%4===3));assert.deepEqual(alphas,new Set([0,255]));city.minute=29;syncSubstanceSmoke(THREE,renderer,city,120);assert(sprites.every(s=>s.visible===false));}finally{globalThis.document=previous;}
});
