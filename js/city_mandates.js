export const PROMISE_METRICS={
  fed:{label:'Moradores sem fome',unit:'%',higher:true},housed:{label:'Moradores abrigados',unit:'%',higher:true},employed:{label:'Adultos com ocupação',unit:'%',higher:true},
  lamps:{label:'Postes públicos abastecidos',unit:'%',higher:true},connected:{label:'Prédios ligados à estrada',unit:'%',higher:true},clean:{label:'Banheiros limpos',unit:'%',higher:true},
  publicHomes:{label:'Moradias populares concluídas',unit:'',higher:true},publicMeals:{label:'Refeitórios populares concluídos',unit:'',higher:true},stateFirms:{label:'Empresas estatais ativas',unit:'',higher:true},
  inflation:{label:'Inflação diária absoluta',unit:'%',higher:false},tax:{label:'Imposto salarial',unit:'%',higher:false},wage:{label:'Piso/hora em preços iniciais',unit:'centavos',higher:true},
  deliveries:{label:'Entregas pendentes',unit:'',higher:false},happiness:{label:'Felicidade média',unit:'%',higher:true},
};
const slogans={fed:'Ninguém vai passar fome',housed:'Casa para todas as pessoas',employed:'Uma ocupação para cada adulto',lamps:'Nenhum poste público sem óleo',connected:'Todo prédio ligado à estrada',clean:'Banheiro limpo é dignidade',publicHomes:'Construir moradia popular',publicMeals:'Abrir um refeitório popular',stateFirms:'Ampliar a produção municipal',inflation:'Conter a inflação',tax:'Aliviar o imposto do trabalhador',wage:'Valorizar o salário mínimo',deliveries:'Destravar as entregas',happiness:'Melhorar a vida no bairro'};
export class CityMandates {
  constructor(city){this.city=city;this.terms=[];this.current=null;this.nextId=1;this.lastDay=null;}
  metrics() {
    const city=this.city,people=city.citizens.filter(c=>!c.entity.destroyed),adults=people.filter(c=>city.society.isAdult(c)),buildings=city.buildings.filter(b=>!b.entity.destroyed),posts=city.lighting.posts.filter(p=>p.public && p.built),facilities=[...city.sanitation.facilities.values()];
    const pct=(a,b)=>b?Math.round(a/b*1000)/10:100;
    return {fed:pct(people.filter(c=>c.needs.food>=30).length,people.length),housed:pct(people.filter(c=>c.homeUnitId).length,people.length),employed:pct(adults.filter(c=>c.jobId||c.businessIds.length||c.role==='councilor').length,adults.length),lamps:posts.length?pct(posts.filter(p=>p.fuel>0).length,posts.length):0,
      connected:pct(buildings.filter(b=>city.politics.roadConnected(b)).length,buildings.length),clean:pct(facilities.filter(f=>f.cleanliness>=50).length,facilities.length),
      publicHomes:buildings.filter(b=>b.type==='popular_housing').reduce((n,b)=>n+[...city.housing.homes.values()].filter(h=>h.buildingId===b.id && city.housing.isSocial(h)).length,0),publicMeals:buildings.filter(b=>b.type==='popular_refectory' && b.active).length,stateFirms:buildings.filter(b=>b.municipal && b.active).length,
      inflation:Math.abs(city.currency.dailyInflation*100),tax:city.taxRate*100,wage:city.politics.policy.minimumWage*60,deliveries:city.logistics.shipments.filter(s=>!['delivered','cancelled'].includes(s.status)).length,happiness:people.reduce((n,c)=>n+c.happiness,0)/Math.max(1,people.length)};
  }
  program(candidate,party) {
    const base=this.metrics(),economy=party.ideology.economy;
    const keys=economy<-.3?['fed','housed','publicHomes','stateFirms','wage']:economy>.3?['tax','employed','deliveries','inflation','connected']:['fed','lamps','clean','connected','happiness'];
    if(party.ideology.green>.6)keys.splice(2,1,'clean');
    // Rotate a local priority into each slate rather than making every program identical.
    keys[4]=['lamps','employed','publicMeals','deliveries','housed','connected'][candidate.id%6];
    return [...new Set(keys)].map(metric=>{const spec=PROMISE_METRICS[metric],start=base[metric];let target;
      if(['fed','housed','employed','lamps','connected','clean'].includes(metric))target=100;
      else if(['publicHomes','publicMeals','stateFirms'].includes(metric))target=start+(metric==='publicHomes'?4:1);
      else if(metric==='tax')target=Math.max(-20,start-5);else if(metric==='inflation')target=.1;else if(metric==='wage')target=start+60;else if(metric==='deliveries')target=Math.floor(start*.5);else target=Math.min(100,start+10);
      return {metric,title:slogans[metric],campaignBaseline:start,target,current:start,higher:spec.higher};});
  }
  start(mayor,party,promises=[],electionId=null) {
    this.finish();const base=this.metrics();
    const term={id:this.nextId++,mayorId:mayor.id,mayorName:mayor.entity.properties.name,partyId:party.id,startedAt:this.city.minute,endedAt:null,electionId,baseline:Object.freeze({...base}),latest:Object.freeze({...base}),checkpoints:[],promises:promises.map(p=>({...p,baseline:base[p.metric],current:base[p.metric],progress:0,fulfilled:false})),score:0};
    this.current=term;this.terms.push(term);if(this.terms.length>32)this.terms.shift();this.lastDay=null;this.update();return term;
  }
  update(force=false) {
    const t=this.current;if(!t || !force && this.lastDay===this.city.day)return;this.lastDay=this.city.day;
    const now=this.metrics();t.latest=Object.freeze({...now});
    for(const p of t.promises){p.current=now[p.metric];const direction=p.higher?1:-1,goal=(p.target-p.baseline)*direction,change=(p.current-p.baseline)*direction;p.fulfilled=(p.current-p.target)*direction>=-.001;p.progress=goal>0?Math.max(-1,Math.min(1,change/goal)):p.fulfilled?1:-Math.min(1,Math.abs(change)/Math.max(1,Math.abs(p.baseline)));}
    t.score=t.promises.length?t.promises.reduce((s,p)=>s+p.progress,0)/t.promises.length:0;
    const snapshot=Object.freeze({minute:this.city.minute,day:this.city.day,...now,score:t.score});
    if(t.checkpoints.at(-1)?.day===this.city.day)t.checkpoints[t.checkpoints.length-1]=snapshot;else t.checkpoints.push(snapshot);
  }
  finish(reason='Encerramento do mandato') {
    const t=this.current;if(!t)return;this.update(true);t.endedAt=this.city.minute;t.endReason=reason;
    this.city.log(`${t.mayorName} encerrou a gestão; ${t.promises.filter(p=>p.fulfilled).length}/${t.promises.length} promessas cumpridas.`,'government',[t.mayorId],{kind:'term-assessed',termId:t.id,partyId:t.partyId,score:t.score});
    const memories=Object.freeze(t.promises.map(p=>Object.freeze({title:p.title,metric:p.metric,baseline:p.baseline,current:p.current,target:p.target,fulfilled:p.fulfilled})));
    for(const c of this.city.citizens.filter(c=>!c.entity.destroyed))this.city.politics.remember(c,{kind:'government-record',partyId:t.partyId,candidateId:t.mayorId,termId:t.id,effect:t.score*16,description:`Balanço de ${t.mayorName}: ${t.promises.filter(p=>p.fulfilled).length}/${t.promises.length} promessas cumpridas.`,promises:memories});
    this.current=null;
  }
  recordScore(candidateId,partyId) {
    const relevant=this.terms.filter(t=>t.promises.length && (t.mayorId===candidateId||t.partyId===partyId)).slice(-3);
    return relevant.length?relevant.reduce((n,t)=>n+t.score*(t.mayorId===candidateId?1:.75),0)/relevant.length*18:0;
  }
}
