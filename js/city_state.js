import {CityVoting} from './city_voting.js';
import {CityPoliticalStanding} from './city_political_standing.js';
import {CityPartyOrganization} from './city_party_organization.js';
import { CityPublications } from './city_publications.js';
import { CityRelationships } from './city_relationships.js';
import { CityGovernment } from './city_government.js';
import { CityCouncil } from './city_council.js';
import { CityCampaigns } from './city_campaigns.js';
import { CityMandates } from './city_mandates.js';
import { CityNature } from './city_nature.js';
import { CityPolitics } from './city_politics.js';
import { CityReputation } from './city_reputation.js';
import { CitySimulation } from './city_simulation.js';
import { CityHistory } from './city_history.js';
import { CityWelfare } from './city_welfare.js';
import { CityBank } from './city_bank.js';
import { CityLighting } from './city_lighting.js';
import { CityCurrency } from './city_currency.js';
import { CityHousing } from './city_housing.js';
import { CitySanitation } from './city_sanitation.js';
import { CityLife } from './city_life.js';
import { CityWorkMeals } from './city_work_meals.js';
import { CityDevelopment } from './city_development.js';
import { CityLogistics } from './city_logistics.js';
import { CityEconomy, GOODS } from './city_economy.js';
import { CitySociety } from './city_society.js';
import { CityServiceInvestment } from './city_service_investment.js';
import { World, WorldClock } from './world.js';

const prototypes = new Map([CityVoting,CityPoliticalStanding,CityPartyOrganization,CityPublications,CityGovernment, CityCouncil, CityCampaigns, CityMandates, CityRelationships, CityNature, CityPolitics, CityReputation, CitySimulation, CityHistory, CityWelfare, CityBank, CityLighting,
  CityCurrency, CityHousing, CitySanitation, CityLife, CityWorkMeals, CityDevelopment,
  CityLogistics, CityEconomy, CitySociety, CityServiceInvestment, World, WorldClock]
  .map(type => [type.name, type.prototype]));
// Rebuilt locally. These caches must never enlarge worker messages or overwrite callbacks.
const localFields = new Set(['activity','_uiRevision','pathCache', 'pathCacheRevision', 'routeCache', 'routeRevision',
  'childrenByGuardian', 'buildingsById', '_statsCache', '_statsMinute', '_conditions', '_conditionsMinute', 'cache', 'cacheVersion']);
const same = (a,b) => {if(!a||a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(!Object.is(a[i],b[i]))return false;return true;};

/** Incremental object graph transport. References (including cycles) retain their identity.
 * Only changed nodes cross the worker boundary; journals are not recopied every frame. */
export class CityStateGraph {
  constructor() { this.ids = new WeakMap(); this.objects = new Map(); this.previous = new Map(); this.nextId = 1; this.historyCursors = new Map(); this.mapChildren = []; this.relationNodes = new Map(); }
  ref(value) {
    if (value === null || typeof value !== 'object') return value;
    const id = this.ids.get(value);
    if (!id) throw new Error('Objeto ainda não sincronizado.');
    return { ref: id };
  }
  value(value) { return value && typeof value === 'object' && 'ref' in value ? this.objects.get(value.ref) : value; }
  encode(root) {
    const nodes=[],removed=[],histories=[];
    // Weak visitation marks are reused between sends and do not retain removed
    // objects or reserve an array indexed by the ever-growing wire IDs.
    const visited=this.visitMarks??=new WeakMap(),generation=this.visitGeneration=(this.visitGeneration||0)+1;
    const map = root.city.world.map, mapRevision = root.city.world.revision;
    const visit = object => {
      if (object === null || typeof object !== 'object') return object;
      let id = this.ids.get(object);
      if (!id) { id = this.nextId++; this.ids.set(object, id); }
      if(visited.get(object)===generation)return id;
      visited.set(object,generation);
      this.objects.set(id, object);
      let kind, data, fields=false;
      const previous = this.previous.get(id);
      const pair=this.relationNodes.get(id);
      if(object._socialPair && previous && pair?.revision===object.revision){for(const child of pair.children){const value=this.objects.get(child);if(value)visited.set(value,generation);}return id;}
      if (previous?.kind === 'FrozenObject' || previous?.kind === 'FrozenArray') return id;
      if (object === map && this.mapRevision === mapRevision && this.previous.has(id)) {
        for(const child of this.mapChildren){const value=this.objects.get(child);if(value)visited.set(value,generation);}
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
      else if (Object.isFrozen(object) && (Array.isArray(object) || Object.getPrototypeOf(object)===Object.prototype) && Object.values(object).every(value=>value===null || typeof value!=='object' && typeof value!=='function')) {
        kind=Array.isArray(object)?'FrozenArray':'FrozenObject';data=Array.isArray(object)?object.map(reference):Object.entries(object).flatMap(([key,value])=>[key,reference(value)]);
      }
      else if (object === root.city.events) { kind = 'CityFeed'; data = object.map(entry => entry.id); }
      else if (ArrayBuffer.isView(object)) { kind = object.constructor.name; data = object instanceof Uint8Array ? object.slice() : Array.from(object); }
      else if (object instanceof Map) { kind = 'Map'; data = []; object.forEach((v,k) => data.push(reference(k),reference(v))); }
      else if (object instanceof Set) { kind = 'Set'; data = []; object.forEach(value => data.push(reference(value))); }
      else if (Array.isArray(object)) { kind = 'Array'; data = object.map(reference); }
      else {
        kind = object.constructor?.name || 'Object'; data = [];fields=true;
        for (const key of Object.keys(object)) {
          if (localFields.has(key)) continue;
          const descriptor = Object.getOwnPropertyDescriptor(object,key);
          if (descriptor.get || typeof descriptor.value === 'function') continue;
          data.push(key, reference(descriptor.value));
        }
      }
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
    for(const [id,object] of this.objects)if(visited.get(object)!==generation) { removed.push(id); this.objects.delete(id); this.previous.delete(id); this.relationNodes.delete(id); }
    return { rootId, nodes, removed, histories, nextId: this.nextId };
  }
  apply(packet) {
    for (const { id, kind, data } of packet.nodes) if (!this.objects.has(id)) {
      const object = kind === 'Array' || kind === 'FrozenArray' || kind === 'CityFeed' ? [] : kind === 'CityHistory' ? new CityHistory(null) : kind === 'Map' ? new Map() : kind === 'Set' ? new Set() :
        kind === 'Uint8Array' ? new Uint8Array(data.length) : Object.create(prototypes.get(kind) || Object.prototype);
      this.objects.set(id, object); this.ids.set(object, id);
    }
    const resolve = value => typeof value === 'string' && value.startsWith('@') ?
      value.startsWith('@s') ? value.slice(2) : this.objects.get(Number(value.slice(1))) : value;
    for (const { id, kind, data, patch } of packet.nodes) {
      const object = this.objects.get(id);
      if (kind === 'CityFeed') { /* Resolved after journal deltas below. */ }
      else if (kind === 'CityHistory') { for (let i=0;i<data.length;i+=2) object[data[i]]=resolve(data[i+1]); }
      else if (kind === 'Map') { object.clear(); for (let i = 0; i < data.length; i += 2) object.set(resolve(data[i]), resolve(data[i + 1])); }
      else if (kind === 'Set') { object.clear(); for (const value of data) object.add(resolve(value)); }
      else if (kind === 'Array' || kind === 'FrozenArray') { object.length = data.length; for (let i = 0; i < data.length; i++) object[i] = resolve(data[i]); }
      else if (kind === 'Uint8Array') object.set(data);
      else {
        const keys=patch?null:new Set(),baseline=patch?this.previous.get(id)?.data:null;
        if(patch&&!baseline)throw new Error(`Atualização parcial sem estado inicial: ${id}`);
        for(let i=0;i<data.length;i+=2){const key=patch?baseline[data[i]]:data[i];keys?.add(key);object[key]=resolve(data[i+1]);}
        if(!patch)for (const key of Object.keys(object)) if (!keys.has(key) && !localFields.has(key)) {
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
      if(kind==='FrozenObject'||kind==='FrozenArray')Object.freeze(this.objects.get(id));
      if(patch){
        const complete=this.previous.get(id)?.data;
        if(!complete)throw new Error(`Atualização parcial sem estado inicial: ${id}`);
        for(let i=0;i<data.length;i+=2)complete[data[i]+1]=data[i+1];
      }else this.previous.set(id,{kind,data});
    }
    for (const id of packet.removed) {this.objects.delete(id);this.previous.delete(id);this.historyCursors.delete(id);this.relationNodes.delete(id);}
    this.nextId = Math.max(this.nextId, packet.nextId);
    this.mapRevision = root.city.world.revision;
    this.mapChildren = Array.isArray(root.city.world.map) ? root.city.world.map.map(row=>this.ids.get(row)) : [];
    return root;
  }
}

/** Restore computed fields, never serialized as stale monetary values. */
export function bindCityState(city) {
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
    enumerable: true, configurable: true, get: () => city.currency.price(GOODS[id].price*(city.economy.market?.[id]?.multiplier||1)),
  });
  city.indexFamilies();
}
