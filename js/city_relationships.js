import {appearance,companyPreference} from './city_clothing.js?v=party-caps-skin-1';
// Personal relationships react to encounters and known facts, not to a scan of all pairs.
export const RELATIONSHIP_RULES = { memories: 24, beliefs: 24, grief: 8, facts: 768, gossipHops: 6, proposalCooldown: 1440, visitCooldown: 60, visitDistance: 32, visitPathBudget: 3 };
export const FEELING_LABELS = { affection: 'Afeto', trust: 'Confiança', respect: 'Respeito', attraction: 'Atração', resentment: 'Ressentimento', fear: 'Receio' };
export const BOND_LABELS = { known:'Conhecido', friend:'Amizade', close:'Grande amizade', confidant:'Confidente', rival:'Rivalidade', enemy:'Inimizade', estranged:'Amizade rompida' };
export const ROMANCE_LABELS = { none:'Sem interesse romântico', crush:'Interesse romântico', courting:'Aproximação', partner:'Companheiro(a)', affair:'Envolvimento fora do compromisso', rejected:'Interesse rejeitado', ex:'Ex-companheiro(a)', widowed:'Vínculo com companheiro(a) falecido' };
export const ORIENTATION_LABELS = { hetero:'Interesse por outro gênero', homo:'Interesse pelo mesmo gênero', bi:'Interesse por diferentes gêneros', aromantic:'Sem interesse romântico' };
export const GENDER_LABELS = { man:'Homem', woman:'Mulher', nonbinary:'Não binário' };
const bounded = (n,min=0,max=100) => Math.max(min,Math.min(max,n));
const trait = (c,key) => c.traits?.[key] ?? .5;
const positive = new Set(['praise','gift','food-shared','support','mentoring','care','good-work','friendship','ride-share','reconciliation']);
const serious = new Set(['betrayal','humiliation','unpaid-work','breakup']);
const labels = { praise:'um elogio',gift:'ajuda financeira','food-shared':'partilha de comida',support:'apoio emocional',mentoring:'uma orientação profissional',care:'cuidado familiar',insult:'uma ofensa',humiliation:'uma humilhação',betrayal:'uma quebra de fidelidade','unpaid-work':'um salário não pago','good-work':'trabalho remunerado',competition:'uma disputa',reconciliation:'uma reconciliação','ride-share':'uma carona de bicicleta',rejection:'uma proposta rejeitada',flirt:'uma aproximação romântica',proposal:'uma proposta de relacionamento',partnership:'o início de um relacionamento',breakup:'uma separação',loss:'uma perda',apology:'um pedido de desculpas' };

export class CityRelationships {
  constructor(city) { this.city=city;this.facts=new Map();this.nextFactId=1;this.rumorsShared=0;this.corrections=0; }
  initialize(c,options={}) {
    const random=()=>this.city.random(),roll=random();
    c.socialProfile=Object.freeze({gender:options.gender|| (roll<.48?'woman':roll<.96?'man':'nonbinary'),orientation:options.orientation|| (random()<.12?'bi':random()<.08?'homo':!c.personality.wantsRomance?'aromantic':'hetero'),fidelity:.2+random()*.75,jealousy:.1+random()*.8,forgiveness:.1+random()*.8,assertiveness:.1+random()*.8,temper:.1+random()*.8});
    c.social={memories:[],beliefs:[],heardFacts:[],grief:[],lastVisitAt:-Infinity,romanceAfter:0,comfortUntil:0};
  }
  kinship(a,b) {
    if(a.parentIds.includes(b.id))return 'parent';
    if(b.parentIds.includes(a.id))return 'child';
    if(a.parentIds.some(id=>b.parentIds.includes(id)))return 'sibling';
    if(a.guardianId===b.id)return 'guardian';
    if(b.guardianId===a.id)return 'dependent';
    return null;
  }
  accepts(a,b) {
    const p=a.socialProfile,q=b.socialProfile;
    if(!p || !q || !a.personality.wantsRomance || p.orientation==='aromantic')return false;
    return p.orientation==='bi' || (p.orientation==='homo'?p.gender===q.gender:p.gender!==q.gender);
  }
  compatible(a,b) {
    return a!==b && this.city.society.isAdult(a) && this.city.society.isAdult(b) && this.accepts(a,b) && this.accepts(b,a) && !(this.city.society.getRelation(a,b)?.related ?? this.city.society.related(a,b));
  }
  attraction(a,b) {
    if(!this.compatible(a,b))return 0;
    const hash=(Math.imul(a.id+31,2654435761)^Math.imul(b.id+17,1597334677))>>>0;
    return bounded(20+hash%61+(a.personality.interest===b.personality.interest?10:0)-Math.min(25,Math.abs(this.city.society.age(a)-this.city.society.age(b))*.8));
  }
  initializePair(r,a,b) {
    const make=(observer,target)=>{const kinship=this.kinship(observer,target);return {affection:kinship?45:10,trust:kinship?50:15,respect:kinship?45:25,attraction:0,resentment:0,fear:0,status:'known',romance:'none',kinship,favorsOwed:0,lastProposalAt:-Infinity,rejectedUntil:0,lastApologyAt:-Infinity,lastStatusAt:this.city.minute};};
    r._socialPair=true;r.revision=0;r.related=this.city.society.related(a,b);
    r.views={[a.id]:make(a,b),[b.id]:make(b,a)};r.names={[a.id]:a.entity.properties.name,[b.id]:b.entity.properties.name};r.active=true;r.contexts=[];
    // Compatibility/genealogy are evaluated once when the pair is formed, then on courtship.
    r.views[a.id].attraction=this.attraction(a,b);r.views[b.id].attraction=this.attraction(b,a);
    this.context(r,a,b);this.sync(r);
  }
  view(a,b,create=false) { if(!a || !b || a.id===b.id)return null;return this.city.society.getRelation(a,b,create)?.views?.[a.id] || null; }
  context(r,a,b) {
    const aHome=this.city.building(this.city.units.get(a.homeUnitId)?.buildingId),bHome=this.city.building(this.city.units.get(b.homeUnitId)?.buildingId);
    const contexts=[...(this.kinship(a,b)?['family']:[]),...(a.jobId && a.jobId===b.jobId?['coworkers']:[]),...(a.homeId && a.homeId===b.homeId?['household']:[]),...(aHome && bHome && aHome!==bHome && Math.hypot(aHome.door.x-bHome.door.x,aHome.door.y-bHome.door.y)<=8?['neighbors']:[])];
    if(contexts.join('|')!==r.contexts.join('|'))r.contexts=Object.freeze(contexts);
  }
  sync(r) {
    r.revision=(r.revision||0)+1;
    const a=r.views[r.a],b=r.views[r.b];
    r.affection=(a.affection+b.affection)/2;r.trust=(a.trust+b.trust)/2;
    r.status=a.romance==='partner' && b.romance==='partner'?'partner':
      ['close','confidant'].includes(a.status) && ['close','confidant'].includes(b.status)?'close':
      ['friend','close','confidant'].includes(a.status) && ['friend','close','confidant'].includes(b.status)?'friend':
      a.status==='enemy'||b.status==='enemy'?'enemy':a.status==='rival'||b.status==='rival'?'rival':'known';
  }
  shift(observer,target,delta) {
    const v=this.view(observer,target,true);if(!v)return;
    for(const [key,value] of Object.entries(delta))if(key in FEELING_LABELS)v[key]=bounded(v[key]+value,key==='affection'?-100:0);
    this.sync(this.city.society.getRelation(observer,target));
    return v;
  }
  register(c) {
    for(const id of [...new Set([c.guardianId,...c.parentIds].filter(id=>id!=null))]) {
      const relative=this.city.society.citizen(id);if(relative){this.city.society.getRelation(c,relative,true);for(const childId of relative.childIds||[]){const sibling=this.city.society.citizen(childId);if(sibling && sibling!==c)this.city.society.getRelation(c,sibling,true);}}
    }
  }
  status(v) {
    if(v.affection<=-35 || v.resentment>=65)return 'enemy';
    if(v.resentment>=30 && v.respect>=35)return 'rival';
    if(v.wasFriend && (v.trust<25 || v.affection<10))return 'estranged';
    if(v.affection>=80 && v.trust>=80 && v.respect>=65 && v.resentment<15)return 'confidant';
    if(v.affection>=65 && v.trust>=55 && v.resentment<30)return 'close';
    if(v.affection>=35 && v.trust>=30 && v.resentment<45)return 'friend';
    return 'known';
  }
  updateBond(a,b,r=this.city.society.getRelation(a,b)) {
    if(!r?.views)return;
    for(const [observer,target] of [[a,b],[b,a]]) {
      const v=r.views[observer.id],next=this.status(v);
      if(next!==v.status) {
        const previous=v.status;v.status=next;v.lastStatusAt=this.city.minute;
        if(['friend','close','confidant'].includes(next))v.wasFriend=true;
        this.city.log(`${observer.entity.properties.name} passou a ver ${target.entity.properties.name} como ${BOND_LABELS[next].toLowerCase()}.`,'relationship',[observer.id,target.id],{kind:'personal-bond-changed',observerId:observer.id,targetId:target.id,previous,status:next});
      }
      if(v.attraction>=65 && v.romance==='none' && this.compatible(observer,target))v.romance='crush';
    }
    this.context(r,a,b);this.sync(r);
    if(a.partnerId===b.id && b.partnerId===a.id) {
      const av=r.views[a.id],bv=r.views[b.id];
      if(av.trust<15 || bv.trust<15 || av.affection<0 || bv.affection<0 || av.resentment>85 || bv.resentment>85)this.endPartnership(a,b,'perda de confiança e convivência');
    }
  }
  remember(c,fact,{otherId=null,firsthand=true,truth=fact.truth,impact=0}={}) {
    const salience=fact.kind==='loss'?90:serious.has(fact.kind)?80:['partnership','proposal','rejection'].includes(fact.kind)?65:positive.has(fact.kind)?35:25;
    const memory=Object.freeze({salience,factId:fact.id,eventId:fact.eventId,kind:fact.kind,actorId:fact.actorId,targetId:fact.targetId,otherId,minute:fact.minute,description:fact.description,firsthand,truth,impact});
    const rows=c.social.memories,index=rows.findIndex(m=>m.factId===fact.id);
    if(index>=0)rows.splice(index,1);
    rows.push(memory);
    if(rows.length>RELATIONSHIP_RULES.memories){
      let discard=0,lowest=Infinity;
      // Reserve recent experiences while retaining a small set of significant older memories.
      for(let i=0;i<rows.length-12;i++){const priority=rows[i].salience-(this.city.minute-rows[i].minute)/1440*2;if(priority<lowest){lowest=priority;discard=i;}}
      rows.splice(discard,1);
    }
    return memory;
  }
  fact(kind,actor,target,description,details={}) {
    const witnessIds=[...new Set(details.witnessIds||this.currentWitnesses||[])].filter(id=>{const c=this.city.society.citizen(id);return c && c!==actor && c!==target && Math.hypot(c.entity.x-actor.entity.x,c.entity.y-actor.entity.y)<=3;}).slice(0,6);
    const id=this.nextFactId++,event=this.city.log(description,['flirt','proposal','partnership','breakup','rejection','betrayal'].includes(kind)?'relationship':'social',[actor.id,target.id,...witnessIds],{...details,witnessIds,kind,socialFactId:id,actorId:actor.id,targetId:target.id});
    const {witnessIds:unused,relatedEventIds,...flat}=details;
    const fact=Object.freeze({id,kind,actorId:actor.id,targetId:target.id,aboutId:actor.id,creatorId:actor.id,truth:true,minute:this.city.minute,eventId:event.id,description,...flat});
    this.facts.set(id,fact);if(this.facts.size>RELATIONSHIP_RULES.facts)this.facts.delete(this.facts.keys().next().value);
    actor.lastSocialEventId=target.lastSocialEventId=event.id;
    this.remember(actor,fact,{otherId:target.id});this.remember(target,fact,{otherId:actor.id});
    for(const witnessId of witnessIds||[]) {const w=this.city.society.citizen(witnessId);if(w && w!==actor && w!==target)this.remember(w,fact,{otherId:actor.id});}
    return fact;
  }
  personalOpinion(observer,target) {
    const v=this.view(observer,target);if(!v)return 0;
    return bounded((v.trust-15)*.08+v.affection*.04-v.resentment*.14-v.fear*.08,-22,12);
  }
  businessPerson(b) {return this.city.society.citizen(b?.ownerId) || (b?.municipal?this.city.society.citizen(this.city.economy.mayorId):null) || (!b?.ownerId?this.city.society.citizen(b?.workers?.[0]):null);}
  businessPenalty(c,b) {return -this.personalOpinion(c,this.businessPerson(b))-companyPreference(c,b);}
  willingToWork(c,b) {
    const v=this.view(c,this.businessPerson(b));
    return !v || v.fear<75 && v.resentment<80 || c.balance<this.city.currency.price(3000);
  }
  canShareHome(host,guest) {
    const a=this.view(host,guest),b=this.view(guest,host);
    return !!a && !!b && a.affection>=65 && b.affection>=55 && a.trust>=60 && b.trust>=50 && a.resentment<25 && b.resentment<25;
  }
  greet(a,b,warm) {
    const r=this.city.society.getRelation(a,b,true);r.conversations++;r.lastContact=this.city.minute;r.familiarity=bounded(r.familiarity+5);
    for(const [observer,target] of [[a,b],[b,a]]) {
      const v=this.view(observer,target),empathy=trait(observer,'empathy');
      this.shift(observer,target,{affection:warm?2+empathy*3:-3-(observer.socialProfile.temper*4),trust:warm?1+empathy:-2,respect:warm?1:-1,resentment:warm?-empathy:2});
      if(this.compatible(observer,target))v.attraction=bounded(v.attraction*.95+this.attraction(observer,target)*.05+(warm?1:-2));
      observer.needs.social=bounded(observer.needs.social+(warm?16:3));observer.needs.leisure=bounded(observer.needs.leisure+4);
    }
    this.updateBond(a,b,r);
  }
  interact(a,b,conversation) {
    this.currentWitnesses=conversation.witnessIds||[];
    try {this.encounter(a,b,conversation);} finally {this.currentWitnesses=null;}
  }
  encounter(a,b,conversation) {
    // Resolve an accusation addressed to someone who knows what happened before choosing a new action.
    if(this.correctRumor(a,b,conversation)||this.correctRumor(b,a,conversation))return;
    const av=this.view(a,b,true),bv=this.view(b,a,true),parentEventId=conversation.eventId;
    const actor=this.city.random()<.5?a:b,target=actor===a?b:a,recipient=this.view(target,actor);
    if(recipient.resentment>20 && trait(actor,'empathy')>.5 && this.city.minute-recipient.lastApologyAt>360 && this.city.random()<.5) {this.apologize(actor,target,parentEventId);return;}
    if((av.resentment+bv.resentment)>65 && this.city.random()<.5) {this.conflict(actor,target,parentEventId);return;}
    if(target.social.grief.some(g=>g.until>this.city.minute) && trait(actor,'empathy')>.5 && this.view(actor,target).trust>=25) {
      target.social.comfortUntil=this.city.minute+360;target.mood=bounded(target.mood+4,-25,25);this.shift(target,actor,{affection:8,trust:6,respect:3});
      this.fact('support',actor,target,`${actor.entity.properties.name} acolheu ${target.entity.properties.name} durante o luto.`,{parentEventId});return;
    }
    if(trait(actor,'empathy')>.55 && this.help(actor,target,parentEventId))return;
    if(this.city.random()<.32 && this.romance(actor,target,parentEventId,conversation.witnessIds||[]))return;
    if(this.city.random()<.35 && this.gossip(actor,target,parentEventId))return;
    const tension=this.view(actor,target).resentment+this.view(target,actor).resentment;
    if(tension>25 || this.city.random()<actor.socialProfile.temper*.2) {this.conflict(actor,target,parentEventId);return;}
    if(actor.jobId && actor.jobId===target.jobId) {
      const skill=Object.keys(actor.skills).find(key=>actor.skills[key]>target.skills[key]+15);
      if(skill && this.city.random()<.4){this.city.economy.practice(target,skill,8);this.shift(target,actor,{affection:3,trust:4,respect:8});this.city.society.getRelation(actor,target).mentorId=actor.id;this.fact('mentoring',actor,target,`${actor.entity.properties.name} ensinou habilidades de trabalho a ${target.entity.properties.name}.`,{parentEventId,skill});return;}
      if(trait(actor,'ambition')>.65 && trait(target,'ambition')>.65 && this.city.random()<.25){this.shift(actor,target,{resentment:10,respect:4});this.shift(target,actor,{resentment:7,respect:3});this.fact('competition',actor,target,`${actor.entity.properties.name} e ${target.entity.properties.name} passaram a disputar reconhecimento profissional.`,{parentEventId});return;}
    }
    this.shift(target,actor,{affection:4,trust:2});target.mood=bounded(target.mood+2,-25,25);
    this.fact('praise',actor,target,`${actor.entity.properties.name} elogiou ${target.entity.properties.name}.`,{parentEventId});
  }
  help(actor,target,parentEventId) {
    const city=this.city,view=this.view(target,actor,true);
    if(target.needs.food<45 && actor.provisions>0){actor.provisions--;target.provisions++;this.shift(target,actor,{affection:10,trust:8,respect:5,resentment:-5});view.favorsOwed++;const reverse=this.view(actor,target);reverse.favorsOwed=Math.max(0,reverse.favorsOwed-1);this.fact('food-shared',actor,target,`${actor.entity.properties.name} compartilhou uma refeição com ${target.entity.properties.name}.`,{parentEventId,quantity:1});return true;}
    const reserve=city.currency.price(6000),amount=Math.min(city.currency.price(1000),Math.max(0,actor.balance-reserve));
    if(target.balance<city.currency.price(1500) && amount>0 && (this.view(actor,target).affection>30 || this.view(actor,target).favorsOwed>0) && city.transfer(actor.accountId,target.accountId,amount,'Ajuda entre pessoas próximas')) {
      this.shift(target,actor,{affection:9,trust:7,respect:4,resentment:-4});view.favorsOwed++;const reverse=this.view(actor,target);reverse.favorsOwed=Math.max(0,reverse.favorsOwed-1);
      this.fact('gift',actor,target,`${actor.entity.properties.name} ajudou ${target.entity.properties.name} com R$ ${(amount/100).toFixed(2)}.`,{parentEventId,amount});return true;
    }
    return false;
  }
  conflict(actor,target,parentEventId) {
    const intimidation=actor.socialProfile.assertiveness-target.socialProfile.assertiveness;
    const kind=intimidation>.3 && trait(actor,'empathy')<.4?'humiliation':'insult';
    this.shift(target,actor,{affection:kind==='humiliation'?-18:-10,trust:-8,respect:-5,resentment:kind==='humiliation'?20:12,fear:Math.max(0,intimidation*15)});
    this.shift(actor,target,{affection:-4,resentment:5});target.mood=bounded(target.mood-4,-25,25);
    this.fact(kind,actor,target,`${actor.entity.properties.name} ${kind==='humiliation'?'humilhou':'ofendeu'} ${target.entity.properties.name}.`,{parentEventId});
  }
  apologize(actor,target,parentEventId) {
    const v=this.view(target,actor,true);v.lastApologyAt=this.city.minute;
    const accepted=this.city.random()<bounded(.2+target.socialProfile.forgiveness*.65+trait(actor,'honesty')*.2-v.resentment/200,.05,.95);
    if(accepted){this.shift(target,actor,{affection:7,trust:8,respect:3,resentment:-18,fear:-5});this.shift(actor,target,{affection:3,trust:3,resentment:-8});}
    if(accepted){const falseBelief=target.social.beliefs.find(b=>b.believes && !b.corrected && this.facts.get(b.factId)?.creatorId===actor.id && this.facts.get(b.factId)?.truth===false);if(falseBelief)this.refute(actor,target,this.facts.get(falseBelief.factId),parentEventId,true);}
    this.fact(accepted?'reconciliation':'apology',actor,target,`${actor.entity.properties.name} pediu desculpas a ${target.entity.properties.name}, que ${accepted?'aceitou a aproximação':'ainda não quis perdoar'}.`,{parentEventId,accepted});
  }
  fabricate(speaker,listener,parentEventId) {
    const possible=this.city.society.relationsFor(speaker.id).map(r=>this.city.society.citizen(r.a===speaker.id?r.b:r.a)).filter(c=>c && c!==listener && c!==speaker);
    if(!possible.length)return null;
    const evidence=speaker.social.memories.slice(-8).map(m=>this.facts.get(m.factId)).find(f=>f?.truth && positive.has(f.kind) && possible.some(c=>c.id===f.actorId));
    const accused=evidence?this.city.society.citizen(evidence.actorId):possible[Math.floor(this.city.random()*Math.min(8,possible.length))],kind=evidence?'insult':accused.partnerId?'betrayal':'insult',id=this.nextFactId++;
    const description=`${speaker.entity.properties.name} inventou uma história sobre ${accused.entity.properties.name}: ${labels[kind]}.`;
    const event=this.city.log(description,'social',[speaker.id,accused.id],{kind:'rumor-fabricated',socialFactId:id,accusedId:accused.id,parentEventId});
    const fact=Object.freeze({id,kind,actorId:accused.id,targetId:accused.partnerId||listener.id,aboutId:accused.id,creatorId:speaker.id,truth:false,minute:this.city.minute,eventId:event.id,description:`História sobre ${accused.entity.properties.name}: ${labels[kind]}.`,evidenceFactId:evidence?.id??null});
    this.facts.set(id,fact);if(this.facts.size>RELATIONSHIP_RULES.facts)this.facts.delete(this.facts.keys().next().value);
    this.remember(speaker,fact,{otherId:accused.id,truth:false});return fact;
  }
  gossip(speaker,listener,parentEventId) {
    let fact=null;
    if(trait(speaker,'honesty')<.35 && this.city.random()<.35)fact=this.fabricate(speaker,listener,parentEventId);
    if(!fact) {
      const known=[...speaker.social.memories.slice(-8),...speaker.social.beliefs.slice(-8)].map(m=>this.facts.get(m.factId)).filter(f=>f && (positive.has(f.kind)||serious.has(f.kind)||f.kind==='insult') && f.actorId!==listener.id);
      if(!known.length)return false;fact=known[Math.floor(this.city.random()*known.length)];
    }
    const believed=speaker.social.beliefs.find(b=>b.factId===fact.id);
    if(believed?.corrected)return this.refute(speaker,listener,fact,parentEventId,false);
    if(believed && !believed.believes)return false;
    if((believed?.hops||0)>=RELATIONSHIP_RULES.gossipHops || listener.social.heardFacts.includes(fact.id))return false;
    const witness=listener.social.memories.find(m=>m.factId===fact.id && m.firsthand);
    if(witness){if(witness.truth===false)return this.refute(listener,speaker,fact,parentEventId,true);return false;}
    const aboutId=fact.kind==='betrayal' && listener.partnerId===fact.targetId?fact.targetId:fact.aboutId;
    const about=this.city.society.citizen(aboutId);if(!about)return false;
    const sourceTrust=this.view(listener,speaker,true).trust+(appearance(speaker)-50)*.12,bias=this.view(listener,about)?.affection||0;
    const chance=bounded(.42+sourceTrust/220-trait(listener,'skepticism')*.4+(bias<0 && !positive.has(fact.kind) ? .12 : 0),.05,.95);
    const believes=witness?witness.truth:this.city.random()<chance;
    const impact=believes ? positive.has(fact.kind)?{affection:5,trust:4,respect:3,resentment:-2}:{affection:-8,trust:-6,respect:-3,resentment:6}:{};
    const personalBetrayal=believes && fact.kind==='betrayal' && listener.partnerId===aboutId;
    if(personalBetrayal){impact.affection=-20;impact.trust=-30;impact.resentment=25;}
    if(believes)this.shift(listener,about,impact);
    const rivalId=personalBetrayal?(fact.actorId===aboutId?fact.targetId:fact.actorId):null,rival=this.city.society.citizen(rivalId);
    const rivalImpact=rival && rival!==listener?{affection:-8,resentment:12*listener.socialProfile.jealousy}:{};
    if(rival && rival!==listener)this.shift(listener,rival,rivalImpact);
    const moodDelta=personalBetrayal?-4-listener.socialProfile.jealousy*3:0;
    if(moodDelta)listener.mood=bounded(listener.mood+moodDelta,-25,25);
    const belief=Object.freeze({factId:fact.id,eventId:fact.eventId,kind:fact.kind,aboutId,sourceId:speaker.id,description:fact.description,believes,corrected:false,confidence:Math.round(chance*100),hops:(believed?.hops||0)+1,heardAt:this.city.minute,affectionDelta:impact.affection||0,trustDelta:impact.trust||0,respectDelta:impact.respect||0,resentmentDelta:impact.resentment||0,rivalId:rival && rival!==listener?rival.id:null,rivalAffectionDelta:rivalImpact.affection||0,rivalResentmentDelta:rivalImpact.resentment||0,moodDelta});
    listener.social.heardFacts.push(fact.id);if(listener.social.heardFacts.length>96)listener.social.heardFacts.shift();
    listener.social.beliefs.push(belief);if(listener.social.beliefs.length>RELATIONSHIP_RULES.beliefs)listener.social.beliefs.shift();this.rumorsShared++;
    this.city.log(`${speaker.entity.properties.name} contou a ${listener.entity.properties.name} uma história sobre ${about.entity.properties.name} (${labels[fact.kind]||fact.kind}); ${listener.entity.properties.name} ${believes?'acreditou':'ficou em dúvida'}.`,'social',[speaker.id,listener.id,about.id],{kind:'rumor-heard',socialFactId:fact.id,sourceId:speaker.id,listenerId:listener.id,believes,objectiveTruth:fact.truth,parentEventId:fact.eventId,conversationEventId:parentEventId});
    if(personalBetrayal)this.city.log(`${listener.entity.properties.name} reagiu com ciúme à história que ouviu sobre ${about.entity.properties.name}.`,'relationship',[listener.id,about.id],{kind:'jealousy-heard',socialFactId:fact.id,parentEventId:fact.eventId});
    this.updateBond(listener,about);if(rival && rival!==listener)this.updateBond(listener,rival);
    return true;
  }
  correctRumor(corrector,listener,conversation) {
    for(const belief of listener.social.beliefs) {
      if(!belief.believes || belief.corrected || this.city.minute-(belief.deniedAt??-Infinity)<360)continue;
      const fact=this.facts.get(belief.factId);if(!fact || fact.truth)continue;
      const proof=corrector.social.memories.some(m=>m.firsthand && ((m.factId===fact.id && m.truth===false && corrector.id!==fact.creatorId) || (fact.evidenceFactId!=null && m.factId===fact.evidenceFactId && m.truth)));
      if(proof || corrector.id===fact.actorId)return this.refute(corrector,listener,fact,conversation.eventId,proof);
    }
    return false;
  }
  refute(corrector,listener,fact,parentEventId,proof) {
    const index=listener.social.beliefs.findIndex(b=>b.factId===fact.id && b.believes && !b.corrected);if(index<0)return false;
    const belief=listener.social.beliefs[index],accused=this.city.society.citizen(listener.social.beliefs[index].aboutId);
    const accepted=proof || this.city.random()<bounded(.25+(this.view(listener,corrector)?.trust||15)/180+trait(listener,'skepticism')*.25-belief.confidence/300,.05,.95);
    if(accepted) {
      if(accused)this.shift(listener,accused,{affection:-belief.affectionDelta,trust:-belief.trustDelta,respect:-belief.respectDelta,resentment:-belief.resentmentDelta});
      const source=this.city.society.citizen(belief.sourceId);if(source)this.shift(listener,source,{trust:source.id===fact.creatorId?-14:-5,respect:-4,resentment:source.id===fact.creatorId?12:3});
      const rival=this.city.society.citizen(belief.rivalId);
      if(rival)this.shift(listener,rival,{affection:-(belief.rivalAffectionDelta||0),resentment:-(belief.rivalResentmentDelta||0)});
      if(source)this.updateBond(listener,source);
      if(rival && rival!==listener)this.updateBond(listener,rival);
      listener.mood=bounded(listener.mood-(belief.moodDelta||0),-25,25);
      this.corrections++;this.remember(listener,fact,{otherId:fact.aboutId,firsthand:false,truth:false});
    }
    listener.social.beliefs[index]=Object.freeze({...belief,believes:accepted?false:belief.believes,corrected:accepted,confidence:accepted?95:belief.confidence,deniedAt:this.city.minute});
    this.city.log(`${corrector.entity.properties.name} contestou a história sobre ${this.city.accountName(`citizen:${fact.aboutId}`)}; ${listener.entity.properties.name} ${accepted?'reviu sua opinião':'manteve a suspeita'}.`,'social',[corrector.id,listener.id,fact.aboutId],{kind:accepted?'rumor-corrected':'rumor-contested',socialFactId:fact.id,accepted,proof,parentEventId:fact.eventId,conversationEventId:parentEventId});
    if(accused)this.updateBond(listener,accused);return true;
  }
  romance(actor,target,parentEventId,witnessIds=[]) {
    if(!this.compatible(actor,target) || this.city.minute<actor.social.romanceAfter || this.city.minute<target.social.romanceAfter)return false;
    const a=this.view(actor,target,true),b=this.view(target,actor,true),city=this.city;
    if(a.attraction<55 || a.affection<25 || a.trust<20 || city.minute<a.rejectedUntil || city.minute-(a.lastFlirtAt??-Infinity)<360)return false;
    const committed=(actor.partnerId && actor.partnerId!==target.id)||(target.partnerId && target.partnerId!==actor.id);
    if(committed && (actor.socialProfile.fidelity>city.random() || target.socialProfile.fidelity>city.random()))return false;
    a.lastFlirtAt=city.minute;
    const accepted=b.attraction>=45 && b.affection>=25 && b.trust>=25 && b.fear<40 && city.minute>=b.rejectedUntil;
    if(!accepted){a.romance='rejected';a.rejectedUntil=city.minute+RELATIONSHIP_RULES.proposalCooldown;actor.mood=bounded(actor.mood-2,-25,25);this.fact('rejection',actor,target,`${actor.entity.properties.name} demonstrou interesse por ${target.entity.properties.name}, que não correspondeu.`,{parentEventId});return true;}
    if(committed) {
      const witnesses=new Set(witnessIds);
      for(const id of [actor.partnerId,target.partnerId]){const partner=city.society.citizen(id);if(partner && partner!==actor && partner!==target && Math.hypot(partner.entity.x-actor.entity.x,partner.entity.y-actor.entity.y)<=3)witnesses.add(id);}
      const valid=[...witnesses].filter(id=>{const w=city.society.citizen(id);return w && Math.hypot(w.entity.x-actor.entity.x,w.entity.y-actor.entity.y)<=3;}).slice(0,6);
      a.romance=b.romance='affair';this.shift(actor,target,{affection:5,attraction:4});this.shift(target,actor,{affection:5,attraction:4});
      const fact=this.fact('betrayal',actor,target,`${actor.entity.properties.name} e ${target.entity.properties.name} tiveram uma aproximação fora de seus compromissos.`,{parentEventId,witnessIds:valid});
      for(const id of valid){const w=city.society.citizen(id);if(w?.partnerId===actor.id)this.jealous(w,actor,target,fact);else if(w?.partnerId===target.id)this.jealous(w,target,actor,fact);}
      return true;
    }
    if(actor.partnerId===target.id)return false;
    a.romance=b.romance='courting';this.shift(actor,target,{affection:4,attraction:3});this.shift(target,actor,{affection:4,attraction:3});
    if(a.affection>=55 && b.affection>=55 && a.trust>=45 && b.trust>=45 && a.attraction>=60 && b.attraction>=60 && city.minute-a.lastProposalAt>=RELATIONSHIP_RULES.proposalCooldown) {
      a.lastProposalAt=city.minute;
      const accepts=city.random()<bounded(.45+b.trust/250+b.attraction/350-b.resentment/150,.05,.95);
      const proposal=this.fact('proposal',actor,target,`${actor.entity.properties.name} propôs um relacionamento a ${target.entity.properties.name}, que ${accepts?'aceitou':'preferiu esperar'}.`,{parentEventId,accepted:accepts});
      if(accepts)this.formPartnership(actor,target,proposal.eventId);
      else {a.romance='rejected';a.rejectedUntil=city.minute+RELATIONSHIP_RULES.proposalCooldown;}
    } else this.fact('flirt',actor,target,`${actor.entity.properties.name} e ${target.entity.properties.name} demonstraram interesse recíproco.`,{parentEventId});
    return true;
  }
  jealous(observer,partner,rival,fact) {
    const intensity=.6+observer.socialProfile.jealousy;
    this.shift(observer,partner,{affection:-18*intensity,trust:-28*intensity,resentment:22*intensity});
    this.shift(observer,rival,{affection:-12*intensity,resentment:18*intensity,respect:-5});observer.mood=bounded(observer.mood-7,-25,25);
    this.city.log(`${observer.entity.properties.name} presenciou a aproximação de ${partner.entity.properties.name} e ${rival.entity.properties.name} e reagiu com ciúme.`,'relationship',[observer.id,partner.id,rival.id],{kind:'jealousy',socialFactId:fact.id,parentEventId:fact.eventId});
    this.updateBond(observer,partner);this.updateBond(observer,rival);
  }
  formPartnership(a,b,parentEventId) {
    if(a.partnerId || b.partnerId || !this.compatible(a,b))return false;
    a.partnerId=b.id;b.partnerId=a.id;const r=this.city.society.getRelation(a,b,true);r.partnerSince=this.city.minute;
    r.views[a.id].romance=r.views[b.id].romance='partner';this.sync(r);
    this.fact('partnership',a,b,`${a.entity.properties.name} e ${b.entity.properties.name} iniciaram um relacionamento por decisão recíproca.`,{parentEventId});
    return true;
  }
  endPartnership(a,b,reason) {
    if(a.partnerId!==b.id || b.partnerId!==a.id)return false;
    a.partnerId=b.partnerId=null;const r=this.city.society.getRelation(a,b);r.partnerSince=null;r.separatedAt=this.city.minute;
    for(const [c,other] of [[a,b],[b,a]]){r.views[c.id].romance='ex';c.social.romanceAfter=this.city.minute+720;if(c.homeShareWith===other.id && !this.canShareHome(other,c))this.city.housing.release(c);}
    this.sync(r);this.fact('breakup',a,b,`${a.entity.properties.name} e ${b.entity.properties.name} encerraram o relacionamento: ${reason}.`);
    return true;
  }
  readyForFamily(a,b) {
    const av=this.view(a,b),bv=this.view(b,a);
    return !!av && !!bv && av.affection>=65 && bv.affection>=65 && av.trust>=55 && bv.trust>=55 && av.resentment<25 && bv.resentment<25;
  }
  seekContact(c) {
    const city=this.city;if(city.minute-c.social.lastVisitAt<RELATIONSHIP_RULES.visitCooldown)return false;c.social.lastVisitAt=city.minute;
    const candidates=city.society.relationsFor(c.id).map(r=>({r,person:city.society.citizen(r.a===c.id?r.b:r.a),view:r.views[c.id]})).filter(item=>item.person && item.view.affection>=35 && item.view.trust>=30 && item.view.resentment<35 && !item.person.path.length && !item.person.conversation && city.society.canSocialize(item.person) && Math.hypot(item.person.entity.x-c.entity.x,item.person.entity.y-c.entity.y)<=RELATIONSHIP_RULES.visitDistance);
    candidates.sort((a,b)=>(b.view.affection+b.view.trust+(b.person.partnerId===c.id?30:0)+b.person.social.grief.length*10)-(a.view.affection+a.view.trust+(a.person.partnerId===c.id?30:0)+a.person.social.grief.length*10));
    for(const {person} of candidates.slice(0,RELATIONSHIP_RULES.visitPathBudget)) {
      const path=city.findPath(c.entity,person.entity);if(path===null)continue;
      c.path=path;c.task='visit';c.socialVisitId=person.id;c.socialVisitUntil=city.minute+45;c.action=`Indo visitar ${person.entity.properties.name}`;return true;
    }
    return false;
  }
  arrive(c) {
    const other=this.city.society.citizen(c.socialVisitId);
    if(!other || this.city.minute>=c.socialVisitUntil || Math.hypot(c.entity.x-other.entity.x,c.entity.y-other.entity.y)>2){c.task=null;c.socialVisitId=null;return;}
    if(this.city.society.startConversation(c,other)){c.task=null;c.socialVisitId=null;return;}
    c.action=`Esperando um momento livre de ${other.entity.properties.name}`;
  }
  moodEffect(c) {
    if(!c.social.grief.length)return 0;
    const now=this.city.minute;
    return -Math.min(18,c.social.grief.reduce((sum,g)=>sum+g.strength*Math.max(0,(g.until-now)/(g.until-g.startedAt)),0))*(c.social.comfortUntil>now?.55:1);
  }
  onLoss(c,cause) {
    const relatives=this.city.society.relationsFor(c.id);
    for(const r of relatives) {
      const other=this.city.society.citizen(r.a===c.id?r.b:r.a);if(!other)continue;
      const v=r.views[other.id],strength=other.partnerId===c.id?30:v.kinship?25:v.affection>=65?18:v.affection>=35?10:0;
      if(!strength)continue;
      other.social.grief.push(Object.freeze({personId:c.id,name:c.entity.properties.name,startedAt:this.city.minute,until:this.city.minute+3*1440,strength,cause}));if(other.social.grief.length>RELATIONSHIP_RULES.grief)other.social.grief.shift();
      if(other.partnerId===c.id){v.romance='widowed';other.social.romanceAfter=this.city.minute+1440;}
      this.fact('loss',c,other,`${other.entity.properties.name} entrou em luto pela morte de ${c.entity.properties.name}.`,{cause});
    }
  }
  daily() {
    const now=this.city.minute;
    for(const c of this.city.citizens){c.social.grief=c.social.grief.filter(g=>g.until>now);c.social.beliefs=c.social.beliefs.filter(b=>now-b.heardAt<12*1440);}
    for(const r of this.city.society.relations.values()) {
      const a=this.city.society.citizen(r.a),b=this.city.society.citizen(r.b);if(!a || !b)continue;
      for(const [observer,target] of [[a,b],[b,a]]) {
        const v=r.views[observer.id];
        if(now-r.lastContact>2*1440){v.affection=bounded(v.affection+(v.affection>10?-1:0),-100,100);v.trust=bounded(v.trust-.5);}
        v.resentment=bounded(v.resentment-observer.socialProfile.forgiveness*.8);v.fear=bounded(v.fear-.5);
      }
      this.updateBond(a,b,r);
    }
  }
  careEvent(parent,child,parentEventId) {
    this.shift(child,parent,{affection:5,trust:4,respect:2,fear:-3});this.shift(parent,child,{affection:3,trust:1});
    this.fact('care',parent,child,`${parent.entity.properties.name} cuidou de ${child.entity.properties.name}.`,{parentEventId});
    this.updateBond(parent,child);
  }
  workEvent(building,c,paid) {
    const employer=this.city.society.citizen(building.ownerId) || (building.municipal?this.city.society.citizen(this.city.economy.mayorId):null);if(!employer || employer.id===c.id)return;
    if(paid){this.shift(c,employer,{trust:1,respect:1});this.shift(employer,c,{trust:1,respect:1});}
    else this.shift(c,employer,{trust:-12,resentment:10,respect:-5});
    this.fact(paid?'good-work':'unpaid-work',employer,c,`${c.entity.properties.name} ${paid?'recebeu pelo trabalho em':'não recebeu o salário esperado em'} ${building.entity.properties.name}.`,{buildingId:building.id});
    this.updateBond(employer,c);
  }
}
