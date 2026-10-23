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

const prototypes = new Map([CitySimulation, CityHistory, CityWelfare, CityBank, CityLighting,
  CityCurrency, CityHousing, CitySanitation, CityLife, CityWorkMeals, CityDevelopment,
  CityLogistics, CityEconomy, CitySociety, CityServiceInvestment, World, WorldClock]
  .map(type => [type.name, type.prototype]));
// Rebuilt locally. These caches must never enlarge worker messages or overwrite callbacks.
const localFields = new Set(['pathCache', 'pathCacheRevision', 'routeCache', 'routeRevision',
  'childrenByGuardian', 'buildingsById', '_statsCache', '_statsMinute', 'cache', 'cacheVersion']);
const same = (a, b) => a && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

/** Incremental object graph transport. References (including cycles) retain their identity.
 * Only changed nodes cross the worker boundary; journals are not recopied every frame. */
export class CityStateGraph {
  constructor() { this.ids = new WeakMap(); this.objects = new Map(); this.previous = new Map(); this.nextId = 1; }
  ref(value) {
    if (value === null || typeof value !== 'object') return value;
    const id = this.ids.get(value);
    if (!id) throw new Error('Objeto ainda não sincronizado.');
    return { ref: id };
  }
  value(value) { return value && typeof value === 'object' && 'ref' in value ? this.objects.get(value.ref) : value; }
  encode(root) {
    const visited = new Set(), nodes = [], removed = [];
    const map = root.city.world.map, mapRevision = root.city.world.revision;
    const visit = object => {
      if (object === null || typeof object !== 'object') return object;
      let id = this.ids.get(object);
      if (!id) { id = this.nextId++; this.ids.set(object, id); }
      if (visited.has(id)) return id;
      visited.add(id);
      this.objects.set(id, object);
      let kind, data;
      if (object === map && this.mapRevision === mapRevision && this.previous.has(id)) return id;
      if (ArrayBuffer.isView(object)) { kind = object.constructor.name; data = Array.from(object); }
      else if (object instanceof Map) { kind = 'Map'; data = [...object].flatMap(([k, v]) => [reference(k), reference(v)]); }
      else if (object instanceof Set) { kind = 'Set'; data = [...object].map(reference); }
      else if (Array.isArray(object)) { kind = 'Array'; data = object.map(reference); }
      else {
        kind = object.constructor?.name || 'Object'; data = [];
        for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(object))) {
          if (!descriptor.enumerable || descriptor.get || localFields.has(key) || typeof descriptor.value === 'function') continue;
          data.push(key, reference(descriptor.value));
        }
      }
      const old = this.previous.get(id);
      if (!old || old.kind !== kind || !same(old.data, data)) {
        nodes.push({ id, kind, data }); this.previous.set(id, { kind, data });
      }
      return id;
    };
    // Reference tokens are stable strings internally, avoiding one object allocation per edge.
    const reference = value => value !== null && typeof value === 'object' ? `@${visit(value)}` :
      typeof value === 'string' && value.startsWith('@') ? `@s${value}` : value;
    const rootId = visit(root);
    this.mapRevision = mapRevision;
    for (const id of this.objects.keys()) if (!visited.has(id)) { removed.push(id); this.objects.delete(id); this.previous.delete(id); }
    return { rootId, nodes, removed, nextId: this.nextId };
  }
  apply(packet) {
    for (const { id, kind, data } of packet.nodes) if (!this.objects.has(id)) {
      const object = kind === 'Array' ? [] : kind === 'Map' ? new Map() : kind === 'Set' ? new Set() :
        kind === 'Uint8Array' ? new Uint8Array(data.length) : Object.create(prototypes.get(kind) || Object.prototype);
      this.objects.set(id, object); this.ids.set(object, id);
    }
    const resolve = value => typeof value === 'string' && value.startsWith('@') ?
      value.startsWith('@s') ? value.slice(2) : this.objects.get(Number(value.slice(1))) : value;
    for (const { id, kind, data } of packet.nodes) {
      const object = this.objects.get(id);
      if (kind === 'Map') { object.clear(); for (let i = 0; i < data.length; i += 2) object.set(resolve(data[i]), resolve(data[i + 1])); }
      else if (kind === 'Set') { object.clear(); for (const value of data) object.add(resolve(value)); }
      else if (kind === 'Array') { object.length = data.length; for (let i = 0; i < data.length; i++) object[i] = resolve(data[i]); }
      else if (kind === 'Uint8Array') object.set(data);
      else {
        const keys = new Set();
        for (let i = 0; i < data.length; i += 2) { keys.add(data[i]); object[data[i]] = resolve(data[i + 1]); }
        for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(object))) {
          if (descriptor.enumerable && !descriptor.get && typeof descriptor.value !== 'function' && !localFields.has(key) && !keys.has(key)) delete object[key];
        }
      }
    }
    for (const id of packet.removed) this.objects.delete(id);
    this.nextId = Math.max(this.nextId, packet.nextId);
    return this.objects.get(packet.rootId);
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
      Object.defineProperty(b, 'wage', { configurable: true, get: () => city.currency.price(b.baseWage), set: value => { b.baseWage = value / city.currency.priceIndex; } });
      Object.defineProperty(b, 'seedStock', { configurable: true, get: () => b.inventory.sementes, set: value => { b.inventory.sementes = value; } });
      if (b.type === 'townhall') for (const field of ['balance', 'totalRevenue', 'totalExpenses']) Object.defineProperty(b, field, {
        configurable: true, enumerable: true, get: () => city.accounts.get('treasury')[field] || 0,
        set: value => { city.accounts.get('treasury')[field] = value; },
      });
    }
  }
  for (const [id, good] of Object.entries(city.economy.goods)) if (!Object.getOwnPropertyDescriptor(good, 'price')?.get) Object.defineProperty(good, 'price', {
    enumerable: true, configurable: true, get: () => city.currency.price(GOODS[id].price),
  });
  city.indexFamilies();
}
