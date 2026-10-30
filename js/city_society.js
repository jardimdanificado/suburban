export const EVENT_CATEGORIES = { publication: 'Livros e panfletos', policy: 'Políticas públicas', nature: 'Vegetação', reputation: 'Reputação', finance: 'Finanças', credit: 'Crédito', death: 'Mortes', justice:'Justiça e segurança', sanitation: 'Saneamento', land: 'Terrenos', construction: 'Construção', transport: 'Transportes', city: 'Cidade', economy: 'Economia', housing: 'Moradia', work: 'Trabalho', social: 'Convívio', relationship: 'Relacionamentos', family: 'Famílias', government: 'Governo', business: 'Empresas', production: 'Produção' };
export const SOCIAL_RULES = { friendAt: 30, closeFriendAt: 65, partnerAt: 68, conversationCooldown: 30, gestationMinutes: 3 * 1440, daysPerYear: 12, maxChildren: 2 };
const pairKey = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;
const topics = ['o bairro', 'o trabalho', 'os planos para o futuro', 'a família', 'a cidade', 'música', 'comida', 'o dia a dia'];
const NO_NEIGHBORS=Object.freeze([]);
const ageCache=new WeakMap();

export class CitySociety {
  constructor(city) {
    this.city = city;
    this.relations = new Map();
    this.contactIndex = new Map();
    this.expecting = [];
    this.nextFamilyId = 1;
    this.birthCount = 0;
  }
  citizen(id) {
    if (id == null) return undefined;
    const c = this.city.accounts.get(`citizen:${id}`);
    return c && c.id === id && c.entity && !c.entity.destroyed ? c : undefined;
  }
  age(c) {
    const minute=this.city.minute,cached=ageCache.get(c);if(cached?.minute===minute)return cached.value;
    if(c._ageValue==null||minute>=c._nextBirthdayAt||minute<c.bornAt){
      c._ageValue=c.initialAge+Math.floor((this.city.minute-c.bornAt)/(1440*SOCIAL_RULES.daysPerYear));
      c._nextBirthdayAt=c.bornAt+(c._ageValue-c.initialAge+1)*1440*SOCIAL_RULES.daysPerYear;
    }
    if(cached){cached.minute=minute;cached.value=c._ageValue;}else ageCache.set(c,{minute,value:c._ageValue});
    return c._ageValue;
  }
  isAdult(c) { return this.age(c) >= 18; }
  initializeCitizen(c, options = {}) {
    const { age = 20 + Math.floor(this.city.random() * 24), parentIds = [] } = options;
    Object.assign(c, { initialAge: age, bornAt: this.city.minute, parentIds: [...parentIds], childIds: [], partnerId: null, expectingId: null, lastBirthAt: null, guardianId: parentIds[0] ?? null, personality: { sociability: 0.3 + this.city.random() * 0.7, kindness: 0.4 + this.city.random() * 0.6, interest: Math.floor(this.city.random() * topics.length), wantsRomance: this.city.random() < 0.9, wantsChildren: this.city.random() < 0.8 }, conversation: null, lastConversationAt: -Infinity });
    Object.freeze(c.personality);
    this.city.relationships.initialize(c, options);
  }
  getRelation(a, b, create = false) {
    const key = pairKey(a.id, b.id);
    if (!this.relations.has(key) && create && a.id!==b.id) {
      const relation={id:key,a:Math.min(a.id,b.id),b:Math.max(a.id,b.id),familiarity:0,affection:10,trust:15,conversations:0,lastContact:this.city.minute,status:'known',since:this.city.minute,partnerSince:null};
      this.relations.set(key,relation);
      for(const id of [a.id,b.id]){if(!this.contactIndex.has(id))this.contactIndex.set(id,new Set());this.contactIndex.get(id).add(key);}
      this.city.relationships.initializePair(relation,a,b);
    }
    return this.relations.get(key);
  }
  relationsFor(id) { return [...(this.contactIndex.get(id)||[])].map(key=>this.relations.get(key)).filter(Boolean).sort((a,b)=>(b.views?.[id]?.affection??b.affection)-(a.views?.[id]?.affection??a.affection)); }
  forgetRelation(r) {this.relations.delete(r.id);this.contactIndex.get(r.a)?.delete(r.id);this.contactIndex.get(r.b)?.delete(r.id);}
  ancestors(c, seen = new Set()) {
    for (const id of c.parentIds) if (!seen.has(id)) { seen.add(id); const parent = this.city.accounts.get(`citizen:${id}`); if (parent) this.ancestors(parent, seen); }
    return seen;
  }
  related(a, b) {
    if(a.id===b.id)return true;
    if(!a.parentIds.length&&!b.parentIds.length)return false;
    const aa = this.ancestors(a), bb = this.ancestors(b);
    return a.id === b.id || aa.has(b.id) || bb.has(a.id) || [...aa].some(id => bb.has(id));
  }
  canPartner(a, b) { return !a.partnerId && !b.partnerId && this.city.relationships.compatible(a,b); }
  canSocialize(c) {
    return !c.entity.destroyed && !c.skybridgeTransit && !c.skybridgeZ && !c.mobilityTrip && !c.ridingVehicleId && !(c.serviceQueue&&c.serviceQueue.kind===c.task&&c.serviceQueue.buildingId===c.targetId) && (!c.path.length||['walk','leisure','social'].includes(c.task)) && !c.conversation && !c.deliveryId && !c.cleaningJobId && !c.workMeal && !['council-session','research','interview','vote','campaign','construction','clean','transport','caregiving','food','provisions','supplies','lake-water','toilet','hygiene'].includes(c.task) && this.age(c)>=3 && c.task!=='energy' &&
      this.city.minute-c.lastConversationAt>=SOCIAL_RULES.conversationCooldown && Math.min(c.needs.food,c.needs.water,c.needs.energy)>20;
  }
  canConverse(a, b) {
    const ap=a.indoorLocation?.position||a.entity,bp=b.indoorLocation?.position||b.entity,dx=ap.x-bp.x,dy=ap.y-bp.y,dz=(ap.z||0)-(bp.z||0);
    if(a===b||a.indoorLocation?.buildingId!==b.indoorLocation?.buildingId||!(dx*dx+dy*dy+dz*dz<=4)||!this.canSocialize(a)||!this.canSocialize(b))return false;
    if(!a.indoorLocation&&!b.indoorLocation&&Math.floor(ap.x)===Math.floor(bp.x)&&Math.floor(ap.y)===Math.floor(bp.y))return false;
    const known=this.relations.has(pairKey(a.id,b.id));
    return known || (this.contactIndex.get(a.id)?.size||0)<64 && (this.contactIndex.get(b.id)?.size||0)<64;
  }
  startConversation(a, b, witnessIds = []) {
    if (!this.canConverse(a, b)) return false;
    const topic = topics[(a.personality.interest + Math.floor(this.city.random() * 3)) % topics.length];
    const duration = 4 + Math.floor(this.city.random() * 5);
    const conversation = { a: a.id, b: b.id, topic, startedAt: this.city.minute, until: this.city.minute + duration, witnessIds };
    for(const c of [a,b])if(c.path.length){c.path=[];c.targetId=null;if(['walk','leisure','social'].includes(c.task))c.task=null;}
    a.conversation = b.conversation = conversation;
    a.lastConversationAt = b.lastConversationAt = this.city.minute;
    a.action = `Conversando com ${b.entity.properties.name} sobre ${topic}`;
    b.action = `Conversando com ${a.entity.properties.name} sobre ${topic}`;
    conversation.eventId = this.city.log(`${a.entity.properties.name} e ${b.entity.properties.name} começaram a conversar sobre ${topic}.`, 'social', [a.id, b.id], { kind: 'conversation', topic, duration }).id;
    return true;
  }
  finishConversation(a,b,conversation) {
    const relationship=this.city.relationships,r=this.getRelation(a,b,true),av=r.views[a.id],bv=r.views[b.id];
    this.city.economy.practice(a,'social',5);this.city.economy.practice(b,'social',5);
    const chance=Math.max(.08,Math.min(.95,.58+((a.traits?.empathy??.5)+(b.traits?.empathy??.5))*.15+(av.affection+bv.affection)/600-(av.resentment+bv.resentment)/300));
    relationship.greet(a,b,this.city.random()<chance);
    a.conversation=b.conversation=null;
    relationship.interact(a,b,conversation);
    this.city.politics.campaigns.conversation(a,b);
    relationship.updateBond(a,b,r);
  }
  updateBond(a,b,r) {this.city.relationships.updateBond(a,b,r);}
  updateMinute() {
    for (const c of this.city.citizens) if (!c.entity.destroyed && c.conversation && c.conversation.a === c.id) {
      const other = this.citizen(c.conversation.b), conversation = c.conversation;
      if (!other || Math.hypot(c.entity.x - other.entity.x, c.entity.y - other.entity.y) > 2) { c.conversation = null; if (other) other.conversation = null; }
      else if (this.city.minute >= conversation.until) this.finishConversation(c, other, conversation);
    }
    // Conversation completion remains minute-accurate; discover new encounters
    // every five minutes and scale the contact budget to keep the same average
    // social throughput with fewer full-population scans at high simulation speed.
    if(this.city.minute%5===0){
    const buckets = new Map(),stride=Math.ceil(this.city.world.width/2)+4,tileCounts=new Map();
    const residents=this.city.citizens,contactBudget=Math.max(12,Math.ceil(residents.length*.1));
    for(const c of residents)if(!c.entity.destroyed&&!c.indoorLocation){const key=Math.floor(c.entity.x)+Math.floor(c.entity.y)*this.city.world.width;tileCounts.set(key,(tileCounts.get(key)||0)+1);}
    const offset=(this.city.minute*37)%Math.max(1,residents.length);
    let contacts=0;
    for(let residentIndex=0;residentIndex<residents.length&&contacts<contactBudget;residentIndex++){
      const c=residents[(offset+residentIndex)%residents.length];
      if (!this.canSocialize(c)) continue;
      if(!c.indoorLocation&&(tileCounts.get(Math.floor(c.entity.x)+Math.floor(c.entity.y)*this.city.world.width)||0)>1)continue;
      const x = Math.floor(c.entity.x / 2), y = Math.floor(c.entity.y / 2);
      for (let dx = -1; dx <= 1 && !c.conversation; dx++) for (let dy = -1; dy <= 1 && !c.conversation; dy++) {
        const nearby = buckets.get(x+dx+(y+dy)*stride) || NO_NEIGHBORS;
        let candidate=null,best=-Infinity;
        // In a crowded square, examine a rotating cross section instead of
        // comparing every resident with every other resident. The offset varies
        // by citizen and scan, so the same first arrivals do not monopolize
        // social contact.
        const sampleSize=Math.min(16,nearby.length),start=nearby.length?(Math.floor(this.city.minute/10)*13+c.id*7)%nearby.length:0;
        for(let i=0;i<sampleSize;i++){
          const other=nearby[(start+i)%nearby.length];
          const dx=c.entity.x-other.entity.x,dy=c.entity.y-other.entity.y;
          if(other.conversation || !(dx*dx+dy*dy<=4))continue;
          const relation=this.relations.get(pairKey(c.id,other.id));
          if(!relation && ((this.contactIndex.get(c.id)?.size||0)>=64 || (this.contactIndex.get(other.id)?.size||0)>=64))continue;
          const v=relation?.views?.[c.id];if(v && (v.fear>50 || v.status==='enemy') && !(v.resentment>55 && c.socialProfile.assertiveness>.6))continue;const score=(v?.affection||0)+(v?0:(this.city.minute+c.id)%6===0?55:0)+(other.partnerId===c.id?20:0)-(v?.fear||0)*.5+(v?.resentment>55 && c.socialProfile.assertiveness>.6?40:0);if(score>best){candidate=other;best=score;}}
        if (candidate && this.city.random() < 1-Math.pow(1-c.personality.sociability*0.14,10) && this.startConversation(c, candidate, nearby.filter(other=>other!==c && other!==candidate && Math.hypot(other.entity.x-c.entity.x,other.entity.y-c.entity.y)<=2).slice(0,4).map(other=>other.id)))contacts++;
      }
      const key = x+y*stride;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(c);
    }
    }
    for(let i=this.expecting.length-1;i>=0;i--)if(this.city.minute>=this.expecting[i].dueAt)this.giveBirth(this.expecting[i]);
  }
  planChild(a, b) {
    const r = this.getRelation(a, b);
    const city = this.city;
    if (!r || !city.relationships.readyForFamily(a,b) || a.partnerId !== b.id || b.partnerId !== a.id || !this.isAdult(a) || !this.isAdult(b) || this.related(a, b) || !a.personality.wantsChildren || !b.personality.wantsChildren || a.expectingId || b.expectingId || a.childIds.length >= SOCIAL_RULES.maxChildren || b.childIds.length >= SOCIAL_RULES.maxChildren || r.partnerSince === null || city.minute - r.partnerSince < 2 * 1440 || r.affection < 75 || r.trust < 65 || !a.homeUnitId || !b.homeUnitId || a.balance + b.balance < 3000 || Math.min(a.needs.health, b.needs.health) < 50 || (a.lastBirthAt !== null && city.minute - a.lastBirthAt < 5 * 1440) || (b.lastBirthAt !== null && city.minute - b.lastBirthAt < 5 * 1440)) return null;
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
    this.city.familyIndexDirty = true;
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
    this.city.relationships.daily();
    for (const r of this.relations.values()) {
      const a = this.citizen(r.a), b = this.citizen(r.b);
      if (!a || !b) continue;
      if (r.status === 'partner' && this.city.random() < .3) this.planChild(a, b);
    }
    for (const c of this.city.citizens) {
      if (this.isAdult(c) && c.guardianId !== null) {
        c.guardianId = null;
        this.city.familyIndexDirty = true;
        const home = this.city.units.get(c.homeUnitId); if (home) home.rentPayerId = null;
        this.city.log(`${c.entity.properties.name} chegou à idade adulta e passa a procurar trabalho.`, 'family', [c.id], { kind: 'adulthood' });
      }
    }
  }
  removeCitizen(c) {
    this.city.familyIndexDirty = true;
    for (const other of this.city.citizens) {
      if (other.partnerId === c.id) other.partnerId = null;
      if (other.conversation?.a === c.id || other.conversation?.b === c.id) other.conversation = null;
      if (other.guardianId === c.id) { other.guardianId = other.parentIds.find(id => id !== c.id && this.citizen(id)) ?? null; const home = this.city.units.get(other.homeUnitId); if (home) home.rentPayerId = other.guardianId ? `citizen:${other.guardianId}` : null; }
    }
    for (const r of this.relationsFor(c.id)) {const other=r.a===c.id?r.b:r.a,view=r.views[other];if(view.kinship || view.affection>=35 || view.resentment>=35 || ['partner','widowed','ex'].includes(view.romance)){r.active=false;this.city.relationships.sync(r);}else this.forgetRelation(r);}
    // Keep parent IDs on children for genealogy even after a parent's departure.
    for (const p of [...this.expecting]) if (p.parentIds.includes(c.id) && !p.parentIds.some(id => this.citizen(id))) this.expecting.splice(this.expecting.indexOf(p), 1);
  }
}

export function relationLabel(r) { return { known: 'Conhecido', friend: 'Amizade', close: 'Grande amizade', partner: 'Relacionamento', enemy:'Inimizade',rival:'Rivalidade' }[r.status] || 'Conhecido'; }
