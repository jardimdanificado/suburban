import {taxCategory,taxRate} from './city_sales_tax.js';
import {CityPaint} from './city_paint.js?v=interiors-completion-2';
import {CityFiscal} from './city_fiscal.js';
import {CityInterventions} from './city_interventions.js?v=interiors-completion-2';
import {CityVehicles} from './city_vehicles.js?v=interiors-completion-2';
import {CityCampaignMaterials} from './city_campaign_materials.js';
import {CityCouncilChamber} from './city_council_chamber.js';
import {CityResearch} from './city_research.js';
import {CityGovernmentAgenda} from './city_government_agenda.js';
import {CityVoting} from './city_voting.js?v=needs-recovery-1';
import {CityPoliticalStanding} from './city_political_standing.js';
import {CityPartyOrganization} from './city_party_organization.js';
import { CityPublications } from './city_publications.js';
import { CityOfficialJournal } from './city_official_journal.js';
import { CityRelationships } from './city_relationships.js';
import { CityGovernment } from './city_government.js?v=needs-recovery-1';
import { CityCouncil } from './city_council.js';
import { CityCampaigns } from './city_campaigns.js?v=party-caps-skin-1';
import { CityMandates } from './city_mandates.js';
import { CityNature } from './city_nature.js';
import { CityPolitics } from './city_politics.js?v=needs-recovery-1';
import { CityReputation } from './city_reputation.js';
import { CitySimulation } from './city_simulation.js?v=refectory-survival-1';
import { CityHistory } from './city_history.js';
import { CityWelfare } from './city_welfare.js';
import { CityBank } from './city_bank.js';
import { CityLighting } from './city_lighting.js';
import { CityCurrency } from './city_currency.js';
import { CityHousing } from './city_housing.js';
import { CitySanitation } from './city_sanitation.js?v=refectory-survival-1';
import { CityLife } from './city_life.js?v=needs-performance-1';
import { CityWorkMeals } from './city_work_meals.js?v=refectory-survival-1';
import { CityDevelopment } from './city_development.js?v=interiors-completion-2';
import { CityLogistics } from './city_logistics.js?v=informal-gigs-1';
import { CityGigs } from './city_gigs.js?v=informal-services-1';
import { CityEconomy, GOODS } from './city_economy.js?v=refectory-survival-1';
import { CitySociety } from './city_society.js?v=sync-perf-1';
import { CityServiceInvestment } from './city_service_investment.js?v=public-cleaning-1';
import { World, WorldClock } from './world.js?v=map-default-256-1';

const prototypes = new Map([CityPaint,CityFiscal,CityInterventions,CityVehicles,CityOfficialJournal,CityCampaignMaterials,CityCouncilChamber,CityResearch,CityGovernmentAgenda,CityVoting,CityPoliticalStanding,CityPartyOrganization,CityPublications,CityGovernment, CityCouncil, CityCampaigns, CityMandates, CityRelationships, CityNature, CityPolitics, CityReputation, CitySimulation, CityHistory, CityWelfare, CityBank, CityLighting,
  CityCurrency, CityHousing, CitySanitation, CityLife, CityWorkMeals, CityDevelopment,
  CityLogistics, CityGigs, CityEconomy, CitySociety, CityServiceInvestment, World, WorldClock]
  .map(type => [type.name, type.prototype]));
// Rebuilt locally. These caches must never enlarge worker messages or overwrite callbacks.
const localFields = new Set(['activity','_uiRevision','pathCache', 'pathCacheRevision','_pathBlockedGrid','_pathBlockedRevision', 'routeCache', 'routeRevision','familyIndexDirty',
  'childrenByGuardian', 'buildingsById', 'residentsByHome', 'residentsMinute', 'residentsPopulation', '_statsCache', '_statsMinute', '_conditions', '_conditionsMinute', 'cache', 'cacheVersion', 'siteBuckets', '_vehicleSearchMinute', '_lastVehicleScanMinute', '_movingCitizens', '_nextTaskAt', '_retryUrgent', '_appearanceCache', '_lastNeedsAt', '_idleHomeId', '_renderInside']);
// Only these enumerable fields are installed as accessors by the simulation.
// Inspecting every property descriptor in the full state graph is expensive at
// large populations; normal fields can be read directly.
const accessorFields = new Set(['wage','seedStock','price','balance','totalRevenue','totalExpenses']);
export const CITY_NEED_FIELDS=['food','water','energy','hygiene','toilet','social','leisure','health','shelter','safety'];
const needFields=CITY_NEED_FIELDS;
const socialMemoryFields=['salience','factId','eventId','kind','actorId','targetId','otherId','minute','description','firsthand','truth','impact'];
const socialFactFields=['id','kind','actorId','targetId','aboutId','creatorId','truth','minute','eventId','description','parentEventId'];
const hasShape=(object,keys)=>{const own=Object.keys(object);if(own.length!==keys.length)return false;for(let i=0;i<own.length;i++)if(own[i]!==keys[i])return false;return true;};
const same = (a,b) => {if(!a||a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(!Object.is(a[i],b[i]))return false;return true;};

/** Incremental object graph transport. References (including cycles) retain their identity.
 * Only changed nodes cross the worker boundary; journals are not recopied every frame. */
export class CityStateGraph {
  constructor() { this.ids = new WeakMap(); this.objects = new Map(); this.previous = new Map(); this.nextId = 1; this.historyCursors = new Map(); this.mapChildren = []; this.relationNodes = new Map(); this.ledgerCursors=new Map(); }
  ref(value) {
    if (value === null || typeof value !== 'object') return value;
    const id = this.ids.get(value);
    if (!id) throw new Error('Objeto ainda não sincronizado.');
    return { ref: id };
  }
  value(value) { return value && typeof value === 'object' && 'ref' in value ? this.objects.get(value.ref) : value; }
  encode(root,{packNeeds=false,packPositions=false}={}) {
    const nodes=[],removed=[],histories=[];
    let packedNeeds=null,needsSet=null,citizenSet=null,entitySet=null;
    if(packPositions){entitySet=new WeakSet();for(const citizen of root.city.citizens)entitySet.add(citizen.entity);}
    if(packNeeds){
      const people=root.city.citizens,stride=needFields.length+2;packedNeeds=new Float64Array(people.length*stride);needsSet=new WeakSet();citizenSet=new WeakSet();
      for(let i=0;i<people.length;i++){const citizen=people[i],needs=citizen.needs;citizenSet.add(citizen);needsSet.add(needs);for(let j=0;j<needFields.length;j++)packedNeeds[i*stride+j]=needs[needFields[j]];packedNeeds[i*stride+needFields.length]=citizen.happiness;packedNeeds[i*stride+needFields.length+1]=citizen.mood;}
    }
    // Most visits use integer wire IDs, avoiding repeated weak-map lookups on
    // every reference. Cap the dense table so long sessions cannot grow it
    // without bound; IDs beyond that cap use weak marks instead.
    let marks=this.visitIds??=new Uint32Array(1024),visited=this.visitMarks??=new WeakMap();
    let generation=(this.visitGeneration||0)+1;
    if(generation>0xffffffff){marks.fill(0);visited=this.visitMarks=new WeakMap();generation=1;}
    this.visitGeneration=generation;
    const denseLimit=1048576;
    const mark=(id,object)=>{if(id<marks.length)marks[id]=generation;else visited.set(object,generation);};
    const wasVisited=(id,object)=>id<marks.length?marks[id]===generation:visited.get(object)===generation;
    const map = root.city.world.map, mapRevision = root.city.world.revision;
    const visit = object => {
      if (object === null || typeof object !== 'object') return object;
      let id = this.ids.get(object);
      if (!id) { id = this.nextId++; this.ids.set(object, id); }
      if(id>=marks.length&&id<denseLimit){let size=marks.length;while(size<=id)size*=2;const grown=new Uint32Array(Math.min(size,denseLimit));grown.set(marks);marks=this.visitIds=grown;}
      if(wasVisited(id,object))return id;
      mark(id,object);
      const previous = this.previous.get(id);
      // Existing nodes already occupy this ID in objects. Reinsert only new or
      // reappearing nodes, avoiding a Map write for every edge on every snapshot.
      if(!previous)this.objects.set(id, object);
      let kind, data, fields=false;
      if (previous?.kind === 'FrozenObject' || previous?.kind === 'FrozenArray' || previous?.kind === 'SocialMemory' || previous?.kind === 'SocialFact') return id;
      // Empty collections have no children to visit and cannot have changed
      // while both their previous and current lengths remain zero.
      if(previous?.data.length===0 && ((previous.kind==='Array'&&object.length===0)||(previous.kind==='Map'&&object.size===0)||(previous.kind==='Set'&&object.size===0)))return id;
      // The initial graph establishes the needs objects. Subsequent worker
      // snapshots carry their numeric values in one compact typed array.
      if(needsSet?.has(object)&&previous)return id;
      if(object._socialPair && previous){const pair=this.relationNodes.get(id);if(pair?.revision===object.revision){for(const child of pair.children){const value=this.objects.get(child);if(value)mark(child,value);}return id;}}
      if (object === map && this.mapRevision === mapRevision && this.previous.has(id)) {
        for(const child of this.mapChildren){const value=this.objects.get(child);if(value)mark(child,value);}
        return id;
      }
      if (object instanceof CityHistory) {
        kind = 'CityHistory'; data = ['city', reference(object.city)];
        const cursor = this.historyCursors.get(id);
        if (!cursor || cursor.lastId !== object.nextId - 1 || cursor.pendingRevision !== object.pendingFinanceRevision) {
          const snapshot = object.snapshotSince(cursor);
          histories.push({id,...snapshot.payload}); this.historyCursors.set(id,snapshot.cursor);
        }
      }
      // A previously encoded mutable node can stay on the normal path even if
      // it is frozen later. Avoid probing every object in the graph on each send.
      else if ((!previous || object.appliedAt!=null && object.status!=='análise') && (Array.isArray(object) || Object.getPrototypeOf(object)===Object.prototype) && Object.isFrozen(object) && Object.values(object).every(value=>value===null || typeof value!=='object' && typeof value!=='function')) {
        if(!Array.isArray(object)&&object.salience!=null&&hasShape(object,socialMemoryFields)){kind='SocialMemory';data=socialMemoryFields.map(key=>object[key]);}
        else if(!Array.isArray(object)&&object.parentEventId!=null&&hasShape(object,socialFactFields)){kind='SocialFact';data=socialFactFields.map(key=>object[key]);}
        else{kind=Array.isArray(object)?'FrozenArray':'FrozenObject';data=Array.isArray(object)?object.map(reference):Object.entries(object).flatMap(([key,value])=>[key,reference(value)]);}
      }
      else if (object === root.city.events) { kind = 'CityFeed'; data = object.map(entry => entry.id); }
      else if(object===root.city.ledger && object.every(entry=>Object.keys(entry).every(key=>['minute','from','to','amount','reason','eventId'].includes(key)))){
        const old=this.ledgerCursors.get(id);let drop=0,start=0,reset=!old;
        if(old?.length){const end=object.lastIndexOf(old[old.length-1]);drop=old.length-end-1;if(end<0||drop<0)reset=true;else{start=end+1;for(let i=drop;i<old.length;i++)if(old[i]!==object[i-drop]){reset=true;break;}}}
        if(reset){drop=0;start=0;}
        if(reset||drop||start!==object.length){const rows=[];for(let i=start;i<object.length;i++){const e=object[i];rows.push(e.minute,e.from,e.to,e.amount,e.reason,e.eventId);}nodes.push({id,kind:'CityLedger',data:{reset,drop,rows}});}
        this.ledgerCursors.set(id,object.slice());this.previous.set(id,{kind:'CityLedger',data:[]});return id;
      }
      else if (ArrayBuffer.isView(object)) { kind = object.constructor.name; data = object instanceof Uint8Array ? object.slice() : Array.from(object); }
      else if (object instanceof Map) { kind = 'Map'; data = []; object.forEach((v,k) => data.push(reference(k),reference(v))); }
      else if (object instanceof Set) { kind = 'Set'; data = []; object.forEach(value => data.push(reference(value))); }
      else if (Array.isArray(object)) { kind = 'Array'; data = object.map(reference); }
      else {
        kind = object.constructor?.name || 'Object';fields=true;
        const oldFields=previous?.kind===kind?previous.data:null;
        let index=0,delta=null,full=oldFields?null:[];
        for (const key of Object.keys(object)) {
          if (localFields.has(key)) continue;
          if(accessorFields.has(key)&&Object.getOwnPropertyDescriptor(object,key)?.get)continue;
          const value=object[key];
          if(typeof value === 'function')continue;
          const encoded=oldFields?.[index]===key&&(((key==='happiness'||key==='mood')&&citizenSet?.has(object))||((key==='x'||key==='y')&&entitySet?.has(object)))?oldFields[index+1]:reference(value);
          if(full)full.push(key,encoded);
          else if(oldFields[index]===key){if(!Object.is(oldFields[index+1],encoded))(delta??=[]).push(index,encoded);}
          else{
            full=oldFields.slice(0,index);
            if(delta)for(let i=0;i<delta.length;i+=2)full[delta[i]+1]=delta[i+1];
            full.push(key,encoded);
          }
          index+=2;
        }
        if(!full && index!==oldFields.length){full=oldFields.slice(0,index);if(delta)for(let i=0;i<delta.length;i+=2)full[delta[i]+1]=delta[i+1];}
        if(full){nodes.push({id,kind,data:full});this.previous.set(id,{kind,data:full});}
        else if(delta){
          if(delta.length+4<oldFields.length){nodes.push({id,kind,data:delta,patch:true});for(let i=0;i<delta.length;i+=2)oldFields[delta[i]+1]=delta[i+1];}
          else{data=oldFields.slice();for(let i=0;i<delta.length;i+=2)data[delta[i]+1]=delta[i+1];nodes.push({id,kind,data});this.previous.set(id,{kind,data});}
        }
      }
      if(fields){if(object._socialPair)this.relationNodes.set(id,{revision:object.revision,children:[object.views,object.views[object.a],object.views[object.b],object.names,object.contexts].map(child=>this.ids.get(child)).filter(child=>child!=null)});return id;}
      if(object._socialPair)this.relationNodes.set(id,{revision:object.revision,children:[object.views,object.views[object.a],object.views[object.b],object.names,object.contexts].map(child=>this.ids.get(child)).filter(child=>child!=null)});
      const old = this.previous.get(id);
      if (!old || old.kind !== kind || !same(old.data, data)) {
        // Stable object shapes usually change only a few fields (needs, cash, position).
        // Preserve the complete baseline locally, but send just changed field offsets and values.
        let delta=null;
        if(fields && old?.kind===kind && old.data.length===data.length && data.length>=12){
          delta=[];
          for(let i=0;i<data.length;i+=2){if(old.data[i]!==data[i]){delta=null;break;}if(!Object.is(old.data[i+1],data[i+1]))delta.push(i,data[i+1]);}
          if(delta && delta.length+4>=data.length)delta=null;
        }
        nodes.push(delta?{id,kind,data:delta,patch:true}:{id,kind,data});this.previous.set(id,{kind,data});
      }
      return id;
    };
    // Reference tokens are stable strings internally, avoiding one object allocation per edge.
    const reference = value => value !== null && typeof value === 'object' ? `@${visit(value)}` :
      typeof value === 'string' && value.startsWith('@') ? `@s${value}` : value;
    const rootId = visit(root);
    this.mapRevision = mapRevision;
    this.mapChildren = Array.isArray(map) ? map.map(row => this.ids.get(row)) : [];
    for(const [id,object] of this.objects)if(!wasVisited(id,object)) { removed.push(id); this.objects.delete(id); this.previous.delete(id); this.relationNodes.delete(id); this.ledgerCursors.delete(id); }
    return { rootId, nodes, removed, histories, nextId: this.nextId, ...(packedNeeds?{packedNeeds}:{}) };
  }
  apply(packet) {
    for (const { id, kind, data } of packet.nodes) if (!this.objects.has(id)) {
      const object = kind === 'Array' || kind === 'FrozenArray' || kind === 'CityFeed' || kind === 'CityLedger' ? [] : kind === 'CityHistory' ? new CityHistory(null) : kind === 'Map' ? new Map() : kind === 'Set' ? new Set() :
        kind === 'Uint8Array' ? new Uint8Array(data.length) : Object.create(prototypes.get(kind) || Object.prototype);
      this.objects.set(id, object); this.ids.set(object, id);
    }
    const resolve = value => typeof value === 'string' && value.startsWith('@') ?
      value.startsWith('@s') ? value.slice(2) : this.objects.get(Number(value.slice(1))) : value;
    for (const { id, kind, data, patch } of packet.nodes) {
      const object = this.objects.get(id);
      if (kind === 'CityFeed') { /* Resolved after journal deltas below. */ }
      else if(kind==='SocialMemory'||kind==='SocialFact'){const fields=kind==='SocialMemory'?socialMemoryFields:socialFactFields;for(let i=0;i<fields.length;i++)object[fields[i]]=data[i];}
      else if(kind==='CityLedger'){if(data.reset)object.length=0;else if(data.drop)object.splice(0,data.drop);const rows=data.rows;for(let i=0;i<rows.length;i+=6){const entry={minute:rows[i],from:rows[i+1],to:rows[i+2],amount:rows[i+3],reason:rows[i+4]};if(rows[i+5]!==undefined)entry.eventId=rows[i+5];object.push(Object.freeze(entry));}}
      else if (kind === 'CityHistory') { for (let i=0;i<data.length;i+=2) object[data[i]]=resolve(data[i+1]); }
      else if (kind === 'Map') { object.clear(); for (let i = 0; i < data.length; i += 2) object.set(resolve(data[i]), resolve(data[i + 1])); }
      else if (kind === 'Set') { object.clear(); for (const value of data) object.add(resolve(value)); }
      else if (kind === 'Array' || kind === 'FrozenArray') { object.length = data.length; for (let i = 0; i < data.length; i++) object[i] = resolve(data[i]); }
      else if (kind === 'Uint8Array') object.set(data);
      else {
        const baseline=this.previous.get(id)?.data;
        if(patch&&!baseline)throw new Error(`Atualização parcial sem estado inicial: ${id}`);
        let sameShape=!patch&&!!baseline&&baseline.length===data.length;
        if(sameShape)for(let i=0;i<data.length;i+=2)if(baseline[i]!==data[i]){sameShape=false;break;}
        const keys=patch||sameShape?null:new Set();
        for(let i=0;i<data.length;i+=2){const key=patch?baseline[data[i]]:data[i];keys?.add(key);object[key]=resolve(data[i+1]);}
        if(keys)for (const key of Object.keys(object)) if (!keys.has(key) && !localFields.has(key)) {
          const descriptor=Object.getOwnPropertyDescriptor(object,key);
          if (!descriptor.get && typeof descriptor.value !== 'function') delete object[key];
        }
      }
    }
    for (const payload of packet.histories || []) {
      const history = this.objects.get(payload.id);
      history.applySnapshot(payload);
      const cursor=!payload.reset && this.historyCursors.get(payload.id) || {versions:new Map()};
      cursor.lastId=history.nextId-1;cursor.pendingRevision=history.pendingFinanceRevision;
      for(const [account,total] of payload.totals)cursor.versions.set(account,total);
      this.historyCursors.set(payload.id,cursor);
    }
    const root = this.objects.get(packet.rootId);
    for (const {id,kind,data,patch} of packet.nodes) {
      if (kind === 'CityFeed') {
        const feed = this.objects.get(id), previous = new Map(feed.map(e=>[e.id,e]));
        feed.length=0;
        for (const eventId of data) {const entry=root.city.history.get(eventId)||previous.get(eventId);if(entry)feed.push(entry);}
      }
      if(kind==='FrozenObject'||kind==='FrozenArray'||kind==='SocialMemory'||kind==='SocialFact')Object.freeze(this.objects.get(id));
      if(patch){
        const complete=this.previous.get(id)?.data;
        if(!complete)throw new Error(`Atualização parcial sem estado inicial: ${id}`);
        for(let i=0;i<data.length;i+=2)complete[data[i]+1]=data[i+1];
      }else this.previous.set(id,{kind,data});
    }
    for (const id of packet.removed) {this.objects.delete(id);this.previous.delete(id);this.historyCursors.delete(id);this.relationNodes.delete(id);}
    if(packet.packedNeeds){const people=root.city.citizens,data=packet.packedNeeds,stride=needFields.length+2;for(let i=0;i<people.length;i++){const citizen=people[i],needs=citizen.needs;if(!needs)continue;for(let j=0;j<needFields.length;j++)needs[needFields[j]]=data[i*stride+j];citizen.happiness=data[i*stride+needFields.length];citizen.mood=data[i*stride+needFields.length+1];}}
    this.nextId = Math.max(this.nextId, packet.nextId);
    this.mapRevision = root.city.world.revision;
    this.mapChildren = Array.isArray(root.city.world.map) ? root.city.world.map.map(row=>this.ids.get(row)) : [];
    return root;
  }
}

/** Restore computed fields, never serialized as stale monetary values. */
export function bindCityState(city) {
  city.paint??=new CityPaint(city);
  city.fiscal??=new CityFiscal(city);
  city.housing.invalidateResidents();
  city.buildingsById ??= new Map(); city.buildingsById.clear();
  city.childrenByGuardian ??= new Map();
  city.economy.routeCache ??= new Map();
  for (const b of city.buildings) {
    city.buildingsById.set(b.id, b);
    if (!Object.getOwnPropertyDescriptor(b, 'wage')?.get) {
      Object.defineProperty(b, 'wage', { configurable: true, get: () => city.currency.price(Math.max(b.baseWage,city.politics?.policy?.minimumWage||0)), set: value => { b.baseWage = value / city.currency.priceIndex; } });
      Object.defineProperty(b, 'seedStock', { configurable: true, get: () => b.inventory.sementes, set: value => { b.inventory.sementes = value; } });
      if (b.type === 'townhall') for (const field of ['balance', 'totalRevenue', 'totalExpenses']) Object.defineProperty(b, field, {
        configurable: true, enumerable: true, get: () => city.accounts.get('treasury')[field] || 0,
        set: value => { city.accounts.get('treasury')[field] = value; },
      });
    }
  }
  for (const [id, good] of Object.entries(city.economy.goods)) if (!Object.getOwnPropertyDescriptor(good, 'price')?.get) Object.defineProperty(good, 'price', {
    enumerable: true, configurable: true, get: () => city.currency.price(GOODS[id].price*(city.economy.market?.[id]?.multiplier||1)*(1+taxRate(city,taxCategory(id)))),
  });
  city.indexFamilies();
}
