import { makeIdentity, makeBuildingName } from './city_names.js';
export const LIFE_RULES = { starvationMinutes: 720, dehydrationMinutes: 360, terminalHealthMinutes: 120, stalledMinutes: 120 };
export class CityLife {
  constructor(city) { this.city = city; this.deaths = []; this.deathCount = 0; this.usedNames = new Set(); this.usedBuildingNames = new Set(); this.stallRecoveries = 0; }
  identity(index, options = {}) { return makeIdentity(this.city, this.usedNames, index, options); }
  name(index, options = {}) { return this.identity(index, options).name; }
  buildingName(label) { return makeBuildingName(this.city, this.usedBuildingNames, label); }
  heir(c) { return [c.partnerId, ...c.childIds, ...c.parentIds].map(id => this.city.society.citizen(id)).find(p => p && p.id !== c.id && this.city.society.isAdult(p)); }
  die(c, cause) {
    if (c.entity.destroyed || c.dead) return false;
    c.dead = true; c.diedAt = this.city.minute; c.deathCause = cause;
    const event = { citizenId: c.id, name: c.entity.properties.name, minute: this.city.minute, age: this.city.society.age(c), cause };
    this.deathCount++; this.deaths.push(event); if (this.deaths.length > 1000) this.deaths.shift();
    for (const s of this.city.logistics.shipments) if (s.driverId === c.id) { if (s.pickedUp) s.position = { x: c.entity.x, y: c.entity.y }; this.city.logistics.releaseDriver(s); s.status = 'waiting'; }
    this.city.sanitation?.releaseCitizen(c);
    c.path = []; c.task = null; c.workMeal = null; c.entity.destroyed = true;
    this.city.log(`${event.name} morreu: ${cause}, aos ${event.age} anos.`, 'death', [c.id, c.partnerId, ...c.childIds].filter(Boolean), { kind: 'death', ...event });
    this.city.relationships.onLoss(c,cause);
    return true;
  }
  minute(c) {
    const n = c.needs;
    c.deprivation ??= { food: 0, water: 0, health: 0 };
    for (const k of ['food', 'water', 'health']) c.deprivation[k] = n[k] <= 0 ? c.deprivation[k] + 1 : 0;
    if (c.deprivation.water >= LIFE_RULES.dehydrationMinutes) return this.die(c, 'desidratação');
    if (c.deprivation.food >= LIFE_RULES.starvationMinutes) return this.die(c, 'inanição');
    if (c.deprivation.health >= LIFE_RULES.terminalHealthMinutes) return this.die(c, 'falência da saúde');
    if (this.city.society.age(c) >= 90 + c.initialAge % 15) return this.die(c, 'velhice');
    if(this.city.minute%5===0){
      // Invalid service names must never turn a need into NaN and freeze the scheduler.
      for (const k in n) if (!Number.isFinite(n[k])) { n[k] = 20; this.resetTask(c, 'valor de necessidade inválido'); }
      const watched = c.activity;
      const need = ['provisions', 'workmeal'].includes(c.task) ? 'food' : c.task;
      const progress = !watched || Math.hypot(c.entity.x - watched.x, c.entity.y - watched.y) > .05 || (n[need] !== undefined && n[need] > (watched.needs[need] ?? 0) + .05) || c.conversation || c.workMeal || ['work', 'manage', 'construction', 'clean'].includes(c.task);
      if (progress) c.lastProgressAt = this.city.minute;
      if (c.task && !c.deliveryId && !c.cleaningJobId && this.city.minute - (c.lastProgressAt ?? this.city.minute) >= LIFE_RULES.stalledMinutes) this.resetTask(c, 'atividade sem progresso');
      const activity=c.activity??=( {x:0,y:0,needs:{}} );activity.x=c.entity.x;activity.y=c.entity.y;for(const key in n)activity.needs[key]=n[key];
    }
    return false;
  }
  resetTask(c, reason) {
    c.task = null; c.path = []; c.servicePaid = null; c.lastProgressAt = this.city.minute; this.stallRecoveries++;
    if (!c.lastRecoveryLog || this.city.minute - c.lastRecoveryLog > 1440) { c.lastRecoveryLog = this.city.minute; this.city.log(`${c.entity.properties.name} reorganizou a rotina: ${reason}.`, 'city', [c.id], { kind: 'routine-recovery', reason }); }
  }
}
