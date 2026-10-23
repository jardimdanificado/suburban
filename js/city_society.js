export const EVENT_CATEGORIES = { policy: 'Políticas públicas', nature: 'Vegetação', reputation: 'Reputação', finance: 'Finanças', credit: 'Crédito', death: 'Mortes', sanitation: 'Saneamento', land: 'Terrenos', construction: 'Construção', transport: 'Transportes', city: 'Cidade', economy: 'Economia', housing: 'Moradia', work: 'Trabalho', social: 'Convívio', relationship: 'Relacionamentos', family: 'Famílias', government: 'Governo', business: 'Empresas', production: 'Produção' };
export const SOCIAL_RULES = { friendAt: 30, closeFriendAt: 65, partnerAt: 68, conversationCooldown: 30, gestationMinutes: 3 * 1440, daysPerYear: 12, maxChildren: 2 };
const clamp = n => Math.max(0, Math.min(100, n));
const pairKey = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;
const topics = ['o bairro', 'o trabalho', 'os planos para o futuro', 'a família', 'a cidade', 'música', 'comida', 'o dia a dia'];

export class CitySociety {
  constructor(city) {
    this.city = city;
    this.relations = new Map();
    this.expecting = [];
    this.nextFamilyId = 1;
    this.birthCount = 0;
  }
  citizen(id) {
    if (id == null) return undefined;
    const c = this.city.accounts.get(`citizen:${id}`);
    return c && c.id === id && c.entity && !c.entity.destroyed ? c : undefined;
  }
  age(c) { return c.initialAge + Math.floor((this.city.minute - c.bornAt) / (1440 * SOCIAL_RULES.daysPerYear)); }
  isAdult(c) { return this.age(c) >= 18; }
  initializeCitizen(c, { age = 20 + Math.floor(this.city.random() * 24), parentIds = [] } = {}) {
    Object.assign(c, { initialAge: age, bornAt: this.city.minute, parentIds: [...parentIds], childIds: [], partnerId: null, expectingId: null, lastBirthAt: null, guardianId: parentIds[0] ?? null, personality: { sociability: 0.3 + this.city.random() * 0.7, kindness: 0.4 + this.city.random() * 0.6, interest: Math.floor(this.city.random() * topics.length), wantsRomance: this.city.random() < 0.9, wantsChildren: this.city.random() < 0.8 }, conversation: null, lastConversationAt: -Infinity });
    Object.freeze(c.personality);
  }
  getRelation(a, b, create = false) {
    const key = pairKey(a.id, b.id);
    if (!this.relations.has(key) && create) this.relations.set(key, { id: key, a: Math.min(a.id, b.id), b: Math.max(a.id, b.id), familiarity: 0, affection: 10, trust: 15, conversations: 0, lastContact: this.city.minute, status: 'known', since: this.city.minute, partnerSince: null });
    return this.relations.get(key);
  }
  relationsFor(id) { return [...this.relations.values()].filter(r => r.a === id || r.b === id).sort((a, b) => b.affection - a.affection); }
  ancestors(c, seen = new Set()) {
    for (const id of c.parentIds) if (!seen.has(id)) { seen.add(id); const parent = this.city.accounts.get(`citizen:${id}`); if (parent) this.ancestors(parent, seen); }
    return seen;
  }
  related(a, b) {
    const aa = this.ancestors(a), bb = this.ancestors(b);
    return a.id === b.id || aa.has(b.id) || bb.has(a.id) || [...aa].some(id => bb.has(id));
  }
  canPartner(a, b) { return this.isAdult(a) && this.isAdult(b) && !a.partnerId && !b.partnerId && a.personality.wantsRomance && b.personality.wantsRomance && !this.related(a, b); }
  canSocialize(c) {
    return !c.entity.destroyed && !c.path.length && !c.conversation && this.age(c)>=3 && c.task!=='energy' &&
      this.city.minute-c.lastConversationAt>=SOCIAL_RULES.conversationCooldown && Math.min(c.needs.food,c.needs.water,c.needs.energy)>20;
  }
  canConverse(a, b) {
    const dx=a.entity.x-b.entity.x,dy=a.entity.y-b.entity.y;
    return a!==b && this.canSocialize(a) && this.canSocialize(b) && dx*dx+dy*dy<=4;
  }
  startConversation(a, b) {
    if (!this.canConverse(a, b)) return false;
    const topic = topics[(a.personality.interest + Math.floor(this.city.random() * 3)) % topics.length];
    const duration = 4 + Math.floor(this.city.random() * 5);
    const conversation = { a: a.id, b: b.id, topic, startedAt: this.city.minute, until: this.city.minute + duration };
    a.conversation = b.conversation = conversation;
    a.lastConversationAt = b.lastConversationAt = this.city.minute;
    a.action = `Conversando com ${b.entity.properties.name} sobre ${topic}`;
    b.action = `Conversando com ${a.entity.properties.name} sobre ${topic}`;
    conversation.eventId = this.city.log(`${a.entity.properties.name} e ${b.entity.properties.name} começaram a conversar sobre ${topic}.`, 'social', [a.id, b.id], { kind: 'conversation', topic, duration }).id;
    return true;
  }
  finishConversation(a, b, conversation) {
    const r = this.getRelation(a, b, true);
    this.city.economy.practice(a, 'social', 5); this.city.economy.practice(b, 'social', 5);
    const compatible = a.personality.interest === b.personality.interest;
    const warm = this.city.random() < .6 + ((a.traits?.empathy ?? .5) + (b.traits?.empathy ?? .5)) * .17;
    r.conversations++; r.lastContact = this.city.minute;
    r.familiarity = clamp(r.familiarity + 7);
    r.affection = clamp(r.affection + (warm ? (compatible ? 10 : 7) : -8));
    r.trust = clamp(r.trust + (warm ? 5 : -6));
    for (const c of [a, b]) { c.needs.social = clamp(c.needs.social + (warm ? 18 : 4)); c.needs.leisure = clamp(c.needs.leisure + 5); c.conversation = null; }
    if (!warm) this.city.log(`${a.entity.properties.name} e ${b.entity.properties.name} discordaram sobre ${conversation.topic}.`, 'social', [a.id, b.id], { kind: 'disagreement' });
    this.interact(a, b, r, warm, conversation);
    this.updateBond(a, b, r);
  }
  interact(a, b, relation, warm, conversation) {
    const city = this.city, empathy = a.traits?.empathy ?? .5;
    let kind, message;
    if ((a.traits?.honesty ?? .5) < .35 && city.random() < .3) {
      const detected = city.random() < .2 + (b.traits?.skepticism ?? .5) * .65;
      kind = detected ? 'lie-discovered' : 'lie';
      relation.trust = clamp(relation.trust + (detected ? -14 : 2));
      relation.affection = clamp(relation.affection + (detected ? -8 : 3));
      if (detected) { b.mood = Math.max(-25, b.mood - 3); city.reputation.observe(a.accountId, 'civic', -1, 'mentira descoberta', {parentEventId:conversation.eventId}); }
      message = detected ? `${b.entity.properties.name} percebeu uma mentira de ${a.entity.properties.name}.` : `${a.entity.properties.name} contou uma história falsa a ${b.entity.properties.name}, que acreditou.`;
    } else if (!warm && empathy < .4) {
      kind = 'insult'; relation.affection = clamp(relation.affection - 6); relation.trust = clamp(relation.trust - 3);
      b.mood = Math.max(-25, b.mood - 3);
      message = `${a.entity.properties.name} ofendeu ${b.entity.properties.name} durante uma discussão.`;
    } else if (warm && empathy > .6 && b.needs.food < 40 && a.provisions > 0) {
      kind = 'food-shared'; a.provisions--; b.provisions++; relation.trust = clamp(relation.trust + 5);
      city.reputation.observe(a.accountId, 'civic', .5, 'compartilhou uma refeição', {parentEventId:conversation.eventId});
      message = `${a.entity.properties.name} compartilhou uma de suas provisões com ${b.entity.properties.name}.`;
    } else if (warm && relation.trust < 40 && empathy > .6) {
      kind = 'reconciliation'; relation.trust = clamp(relation.trust + 6); relation.affection = clamp(relation.affection + 4);
      message = `${a.entity.properties.name} e ${b.entity.properties.name} se reconciliaram.`;
    } else if (warm && city.random() < empathy * .5) {
      kind = 'praise'; b.mood = Math.min(25, b.mood + 2); relation.trust = clamp(relation.trust + 2);
      message = `${a.entity.properties.name} elogiou ${b.entity.properties.name}.`;
    }
    if (kind) {
      const event = city.log(message, 'social', [a.id,b.id], {kind,parentEventId:conversation.eventId,trust:relation.trust,affection:relation.affection});
      a.lastSocialEventId = b.lastSocialEventId = event.id;
    }
  }
  updateBond(a, b, r) {
    if (r.status === 'known' && r.affection >= SOCIAL_RULES.friendAt && r.trust >= 25) {
      r.status = 'friend'; this.city.log(`${a.entity.properties.name} e ${b.entity.properties.name} fizeram amizade.`, 'relationship', [a.id, b.id], { kind: 'friendship' });
    }
    if (r.status === 'friend' && r.affection >= SOCIAL_RULES.closeFriendAt && r.trust >= 50) {
      r.status = 'close'; this.city.log(`${a.entity.properties.name} e ${b.entity.properties.name} se tornaram grandes amigos.`, 'relationship', [a.id, b.id], { kind: 'close-friendship' });
    }
    if (r.affection >= SOCIAL_RULES.partnerAt && r.trust >= 50 && r.familiarity >= 42 && this.canPartner(a, b)) {
      a.partnerId = b.id; b.partnerId = a.id; r.status = 'partner'; r.partnerSince = this.city.minute;
      this.city.log(`${a.entity.properties.name} e ${b.entity.properties.name} começaram um relacionamento.`, 'relationship', [a.id, b.id], { kind: 'partnership' });
    }
    if (r.status === 'partner' && (r.affection < 25 || r.trust < 20)) {
      a.partnerId = b.partnerId = null; r.status = 'known'; r.partnerSince = null;
      this.city.log(`${a.entity.properties.name} e ${b.entity.properties.name} terminaram o relacionamento.`, 'relationship', [a.id, b.id], { kind: 'breakup' });
    } else if ((r.status === 'friend' || r.status === 'close') && r.affection < 20) {
      r.status = 'known'; this.city.log(`A amizade entre ${a.entity.properties.name} e ${b.entity.properties.name} se enfraqueceu.`, 'relationship', [a.id, b.id], { kind: 'friendship-ended' });
    }
  }
  updateMinute() {
    const people = this.city.citizens.filter(c => !c.entity.destroyed);
    for (const c of people) if (c.conversation && c.conversation.a === c.id) {
      const other = this.citizen(c.conversation.b), conversation = c.conversation;
      if (!other || Math.hypot(c.entity.x - other.entity.x, c.entity.y - other.entity.y) > 2) { c.conversation = null; if (other) other.conversation = null; }
      else if (this.city.minute >= conversation.until) this.finishConversation(c, other, conversation);
    }
    // A spatial grid limits encounters to nearby people, with one conversation per person.
    const buckets = new Map();
    for (const c of people) {
      if (!this.canSocialize(c)) continue;
      const x = Math.floor(c.entity.x / 2), y = Math.floor(c.entity.y / 2);
      for (let dx = -1; dx <= 1 && !c.conversation; dx++) for (let dy = -1; dy <= 1 && !c.conversation; dy++) {
        const nearby = buckets.get(`${x + dx},${y + dy}`) || [];
        let candidate=null,best=-Infinity;
        for(const other of nearby)if(this.canConverse(c,other)){const affection=this.getRelation(c,other)?.affection||0;if(affection>best){candidate=other;best=affection;}}
        if (candidate && this.city.random() < c.personality.sociability * 0.14) this.startConversation(c, candidate);
      }
      const key = `${x},${y}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(c);
    }
    for (const pregnancy of [...this.expecting]) if (this.city.minute >= pregnancy.dueAt) this.giveBirth(pregnancy);
  }
  planChild(a, b) {
    const r = this.getRelation(a, b);
    const city = this.city;
    if (!r || a.partnerId !== b.id || b.partnerId !== a.id || !this.isAdult(a) || !this.isAdult(b) || this.related(a, b) || !a.personality.wantsChildren || !b.personality.wantsChildren || a.expectingId || b.expectingId || a.childIds.length >= SOCIAL_RULES.maxChildren || b.childIds.length >= SOCIAL_RULES.maxChildren || r.partnerSince === null || city.minute - r.partnerSince < 2 * 1440 || r.affection < 75 || r.trust < 65 || !a.homeUnitId || !b.homeUnitId || a.balance + b.balance < 3000 || Math.min(a.needs.health, b.needs.health) < 50 || (a.lastBirthAt !== null && city.minute - a.lastBirthAt < 5 * 1440) || (b.lastBirthAt !== null && city.minute - b.lastBirthAt < 5 * 1440)) return null;
    if (!city.housing.home(a) || !city.housing.hasBathroom(city.housing.home(a))) return null;
    const pregnancy = { id: this.nextFamilyId++, parentIds: [a.id, b.id], startedAt: city.minute, dueAt: city.minute + SOCIAL_RULES.gestationMinutes };
    a.expectingId = b.expectingId = pregnancy.id;
    this.expecting.push(pregnancy);
    city.log(`${a.entity.properties.name} e ${b.entity.properties.name} esperam um filho.`, 'family', [a.id, b.id], { kind: 'expecting', dueAt: pregnancy.dueAt });
    return pregnancy;
  }
  giveBirth(pregnancy) {
    if (!this.expecting.includes(pregnancy) || this.city.minute < pregnancy.dueAt) return null;
    const parents = pregnancy.parentIds.map(id => this.citizen(id)).filter(Boolean);
    if (!parents.length) { this.expecting.splice(this.expecting.indexOf(pregnancy), 1); return null; }
    const guardian = parents.find(p => p.homeUnitId) || parents[0];
    const home = this.city.building(this.city.units.get(guardian.homeUnitId)?.buildingId);
    const position = home?.door || guardian.entity;
    const baby = this.city.addCitizen(position.x, position.y, this.city.citizens.length, { age: 0, parentIds: pregnancy.parentIds, grant: false });
    baby.guardianId = guardian.id;
    this.birthCount++;
    for (const parent of parents) { parent.childIds.push(baby.id); parent.expectingId = null; parent.lastBirthAt = this.city.minute; }
    this.expecting.splice(this.expecting.indexOf(pregnancy), 1);
    this.houseChild(baby);
    this.city.log(`${baby.entity.properties.name} nasceu, filho de ${parents.map(p => p.entity.properties.name).join(' e ')}.`, 'family', [...pregnancy.parentIds, baby.id], { kind: 'birth', childId: baby.id });
    return baby;
  }
  guardian(c) { return this.citizen(c.guardianId) || c.parentIds.map(id => this.citizen(id)).find(Boolean); }
  houseChild(child) {
    const parent = this.guardian(child); if (parent) this.city.housing.houseChild(child, parent);
  }
  daily() {
    for (const r of this.relations.values()) {
      const a = this.citizen(r.a), b = this.citizen(r.b);
      if (!a || !b) continue;
      if (this.city.minute - r.lastContact > 2 * 1440) { r.affection = clamp(r.affection - 4); r.trust = clamp(r.trust - 2); this.updateBond(a, b, r); }
      if (r.status === 'partner' && this.city.random() < .3) this.planChild(a, b);
    }
    for (const c of this.city.citizens) {
      if (this.isAdult(c) && c.guardianId !== null) {
        c.guardianId = null;
        const home = this.city.units.get(c.homeUnitId); if (home) home.rentPayerId = null;
        this.city.log(`${c.entity.properties.name} chegou à idade adulta e passa a procurar trabalho.`, 'family', [c.id], { kind: 'adulthood' });
      }
    }
  }
  removeCitizen(c) {
    for (const other of this.city.citizens) {
      if (other.partnerId === c.id) other.partnerId = null;
      if (other.conversation?.a === c.id || other.conversation?.b === c.id) other.conversation = null;
      if (other.guardianId === c.id) { other.guardianId = other.parentIds.find(id => id !== c.id && this.citizen(id)) ?? null; const home = this.city.units.get(other.homeUnitId); if (home) home.rentPayerId = other.guardianId ? `citizen:${other.guardianId}` : null; }
    }
    for (const r of this.relationsFor(c.id)) this.relations.delete(r.id);
    // Keep parent IDs on children for genealogy even after a parent's departure.
    for (const p of [...this.expecting]) if (p.parentIds.includes(c.id) && !p.parentIds.some(id => this.citizen(id))) this.expecting.splice(this.expecting.indexOf(p), 1);
  }
}

export function relationLabel(r) { return { known: 'Conhecido', friend: 'Amizade', close: 'Grande amizade', partner: 'Relacionamento' }[r.status] || 'Conhecido'; }
