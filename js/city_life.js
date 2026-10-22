export const LIFE_RULES = { starvationMinutes: 720, dehydrationMinutes: 360, terminalHealthMinutes: 120, stalledMinutes: 120 };
const firstNames = ['Ana', 'Bruno', 'Clara', 'Davi', 'Elisa', 'Felipe', 'Gabriela', 'Hugo', 'Iara', 'João', 'Lia', 'Miguel', 'Nina', 'Otávio', 'Paula', 'Ravi', 'Sara', 'Tomás', 'Vera', 'Yuri', 'Alice', 'Caio', 'Diana', 'Enzo', 'Helena', 'Luís', 'Marina', 'Pedro', 'Rosa', 'Vicente', 'Beatriz', 'André'];
const surnames = ['Silva', 'Santos', 'Costa', 'Souza', 'Oliveira', 'Lima', 'Almeida', 'Pereira', 'Rocha', 'Nascimento', 'Ribeiro', 'Carvalho'];
export class CityLife {
  constructor(city) { this.city = city; this.deaths = []; this.deathCount = 0; this.usedNames = new Set(); this.stallRecoveries = 0; }
  name(index, options = {}) {
    const parent = this.city.accounts.get(`citizen:${options.parentIds?.[0]}`);
    const surname = parent?.entity.properties.name.split(' ').at(-1) || surnames[index % surnames.length];
    for (let attempt = 0; ; attempt++) {
      const given = firstNames[(index + attempt) % firstNames.length];
      let code = attempt + Math.floor(index / firstNames.length), middle = '';
      if (code || this.usedNames.has(`${given} ${surname}`)) { do { middle += ` ${firstNames[(code + 7) % firstNames.length]}`; code = Math.floor(code / firstNames.length) - 1; } while (code >= 0); }
      const candidate = `${given}${middle} ${surname}`;
      if (!this.usedNames.has(candidate)) { this.usedNames.add(candidate); return candidate; }
    }
  }
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
    // Invalid service names must never turn a need into NaN and freeze the entire scheduler.
    for (const k of Object.keys(n)) if (!Number.isFinite(n[k])) { n[k] = 20; this.resetTask(c, 'valor de necessidade inválido'); }
    const watched = c.activity;
    const need = ['provisions', 'workmeal'].includes(c.task) ? 'food' : c.task;
    const progress = !watched || Math.hypot(c.entity.x - watched.x, c.entity.y - watched.y) > .05 || (n[need] !== undefined && n[need] > (watched.needs[need] ?? 0) + .05) || c.conversation || c.workMeal || ['work', 'manage', 'construction', 'clean'].includes(c.task);
    if (progress) c.lastProgressAt = this.city.minute;
    if (c.task && !c.deliveryId && !c.cleaningJobId && this.city.minute - (c.lastProgressAt ?? this.city.minute) >= LIFE_RULES.stalledMinutes) this.resetTask(c, 'atividade sem progresso');
    c.activity = { x: c.entity.x, y: c.entity.y, needs: { ...n } };
    return false;
  }
  resetTask(c, reason) {
    c.task = null; c.path = []; c.servicePaid = null; c.lastProgressAt = this.city.minute; this.stallRecoveries++;
    if (!c.lastRecoveryLog || this.city.minute - c.lastRecoveryLog > 1440) { c.lastRecoveryLog = this.city.minute; this.city.log(`${c.entity.properties.name} reorganizou a rotina: ${reason}.`, 'city', [c.id], { kind: 'routine-recovery', reason }); }
  }
}
