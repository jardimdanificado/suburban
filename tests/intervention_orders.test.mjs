import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney} from './helpers/city.mjs';
import {INTERVENTIONS} from '../js/city_interventions.js';
import {contextActions,compactInterventions} from '../js/city_context_actions.js';
import {OptionsPanel} from '../js/options.js';

test('interventions exclude direct edits to bodies, talents, relationships and identity',()=>{
 const city=setup({starter:true,population:24}),c=city.citizens[0],before=JSON.stringify([c.needs,c.skills,c.entity.properties.name]);
 for(const kind of ['divineBlessing','divineNeed','divineInspiration','divineBond','divineRepair','divineHarvest']){assert.equal(INTERVENTIONS[kind],undefined);assert.equal(city.politics.intervene(kind,c.id),null);}
 assert.equal(JSON.stringify([c.needs,c.skills,c.entity.properties.name]),before);
});

test('repair orders are funded externally and only actual work repairs the building; cancellation refunds escrow',()=>{
 const city=setup({starter:true,population:24}),b=city.buildings.find(b=>b.units.length&&b.constructionKind!=='open-air');b.condition=40;const cash=city.treasury;
 const result=city.politics.intervene('serviceOrder',b.id,{service:'repair'});assert(result,city.lastError);const job=city.gigs.get(result.gigId);assert.equal(job.status,'open');assert.equal(b.condition,40);assert.equal(city.treasury,cash);assert.equal(totalMoney(city),city.currency.netIssued());
 assert(city.politics.intervene('cancelService',job.id));assert.equal(job.status,'cancelled');assert.equal(city.accounts.get(job.accountId).balance,0);assert.equal(b.condition,40);assert.equal(totalMoney(city),city.currency.netIssued());
});

test('art removal requires a worker at the site and preserves the artwork history',()=>{
 const city=setup({starter:true,population:24}),hall=city.buildings.find(b=>b.type==='townhall'),c=city.citizens.find(c=>!city.politics.officeHolder(c)),point=hall.door;
 const piece=city.justice.createArtwork({kind:'painting',message:'Memória da cidade',creatorId:c.id,x:point.x,y:point.y});assert(piece);
 const result=city.politics.intervene('removeArtwork',piece.id);assert(result,city.lastError);const job=city.gigs.get(result.gigId);assert(!piece.entity.destroyed);assert.equal(city.politics.intervene('removeArtwork',piece.id),null);
 c.entity.x=job.point.x;c.entity.y=job.point.y;c.path=[];c.indoorLocation=null;c.deliveryId=null;c.cleaningJobId=null;c.conversation=null;for(const key of Object.keys(c.needs))c.needs[key]=95;
 job.workerId=c.id;job.status='working';c.informalJobId=job.id;job.progress=job.required-1;city.gigs.updateMinute();
 assert.equal(job.status,'completed');assert(piece.entity.destroyed);assert.equal(piece.removalJobId,job.id);assert.equal(piece.message,'Memória da cidade');assert.equal(piece.creatorId,c.id);assert(city.justice.art.includes(piece));assert.equal(totalMoney(city),city.currency.netIssued());
});

test('intervention visibility persists and hides all contextual controls; menus start collapsed',()=>{
 let saved='{}';const storage={getItem:()=>saved,setItem:(_,s)=>{saved=s;}},renderer=new Proxy({}, {get:()=>()=>{}}),options=new OptionsPanel({renderer,time:{},step(){},storage});
 options.apply('showInterventions',false);const restored=new OptionsPanel({renderer,time:{},step(){},storage});assert.equal(restored.values.showInterventions,false);
 const ui={host:{controls:{interventionsVisible:()=>false}}};contextActions(ui,{},{});compactInterventions(ui,{},'test',[{label:'Ação'}]);
 let draws=0;ui.host.controls.interventionsVisible=()=>true;compactInterventions(ui,{disclosure(_label,open){assert.equal(open,false);draws++;},button(){throw Error('expanded by default');}},'test',[{label:'Ação'}]);assert.equal(draws,1);
});
