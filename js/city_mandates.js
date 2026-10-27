import {TAX_CATEGORIES,taxRate} from './city_sales_tax.js';
import {captureGovernmentExperience} from './city_electoral_behavior.js';
import {ideologicalProfile,ideologicalPromiseWeight} from './city_ideology.js';
import {outcomeAssessment,promiseAssessment,promiseDifficulty} from './city_promise_evaluation.js';
export const PROMISE_METRICS={
  ...Object.fromEntries(Object.entries(TAX_CATEGORIES).map(([key,spec])=>[`salesTax_${key}`,{label:`Imposto: ${spec.label}`,unit:'%',higher:false}])),
  health:{label:'Moradores com saúde acima de 60',unit:'%',higher:true},water:{label:'Moradores com água acima de 45',unit:'%',higher:true},rest:{label:'Moradores descansados',unit:'%',higher:true},hygiene:{label:'Moradores com higiene acima de 50',unit:'%',higher:true},
  clinics:{label:'Clínicas ativas',unit:'',higher:true},waterWorks:{label:'Serviços de água ativos',unit:'',higher:true},parks:{label:'Centros de lazer ativos',unit:'',higher:true},carriers:{label:'Transportadoras ativas',unit:'',higher:true},cleaners:{label:'Empresas de limpeza ativas',unit:'',higher:true},builders:{label:'Construtoras ativas',unit:'',higher:true},
  preservation:{label:'Conservação média dos imóveis',unit:'%',higher:true},waste:{label:'Lixo aguardando coleta',unit:'',higher:false},cultivatedTrees:{label:'Árvores cultivadas e sementes plantadas',unit:'',higher:true},oilReserve:{label:'Óleo disponível na cidade',unit:'',higher:true},oilMills:{label:'Moinhos de óleo ativos',unit:'',higher:true},sunflowerFarms:{label:'Lavouras de girassol ativas',unit:'',higher:true},
  woodStock:{label:'Madeira em estoque ou transporte',unit:'',higher:true},paperStock:{label:'Papel disponível',unit:'',higher:true},publishedTexts:{label:'Relatos preservados em livros e panfletos',unit:'',higher:true},readers:{label:'Moradores que leram publicações',unit:'%',higher:true},banks:{label:'Bancos em operação',unit:'',higher:true},paidLoans:{label:'Empréstimos quitados',unit:'',higher:true},publicJobs:{label:'Funcionários em empresas municipais',unit:'',higher:true},
  foodVariety:{label:'Culturas alimentares em produção',unit:'',higher:true},kitchens:{label:'Cozinhas ativas',unit:'',higher:true},artisans:{label:'Oficinas de artesãos ativas',unit:'',higher:true},equipped:{label:'Moradores com cestas ou carrinhos',unit:'%',higher:true},savers:{label:'Moradores com poupança',unit:'%',higher:true},smallFirms:{label:'Microempresas e cooperativas',unit:'',higher:true},foodReserve:{label:'Dias de reserva alimentar',unit:'dias',higher:true},literacy:{label:'Leituras realizadas',unit:'',higher:true},recycling:{label:'Resíduos processados',unit:'',higher:true},
  fed:{label:'Moradores sem fome',unit:'%',higher:true},housed:{label:'Moradores abrigados',unit:'%',higher:true},employed:{label:'Adultos com ocupação',unit:'%',higher:true},
  lamps:{label:'Postes públicos abastecidos',unit:'%',higher:true},connected:{label:'Prédios ligados à estrada',unit:'%',higher:true},clean:{label:'Banheiros limpos',unit:'%',higher:true},
  publicHomes:{label:'Moradias populares concluídas',unit:'',higher:true},publicMeals:{label:'Refeitórios populares concluídos',unit:'',higher:true},stateFirms:{label:'Empresas estatais ativas',unit:'',higher:true},
  inflation:{label:'Inflação diária absoluta',unit:'%',higher:false},tax:{label:'Imposto salarial',unit:'%',higher:false},wage:{label:'Piso/hora em preços iniciais',unit:'centavos',higher:true},
  deliveries:{label:'Entregas pendentes',unit:'',higher:false},happiness:{label:'Felicidade média',unit:'%',higher:true},
};
export function describePromise(pr){
  const spec=PROMISE_METRICS[pr.metric],unit=spec.unit||'',format=n=>`${Number(n).toFixed(['%','dias'].includes(unit)?1:0)}${unit==='%'?'%':unit?' '+unit:''}`;
  return `${pr.title}: ${spec.label.toLowerCase()} de ${format(pr.campaignBaseline??pr.baseline)} para ${format(pr.target)}`;
}
// The same needs make a promise relevant in conversations and at the ballot.
export function promiseRelevant(city,c,metric){
  const n=c.needs;
  if(['fed','publicMeals','kitchens','foodReserve','foodVariety'].includes(metric))return n.food<70;
  if(['housed','publicHomes'].includes(metric))return !c.homeUnitId;
  if(['employed','smallFirms','publicJobs'].includes(metric))return !c.jobId&&!c.businessIds.length;
  if(['health','clinics'].includes(metric))return n.health<80;
  if(['water','waterWorks'].includes(metric))return n.water<75;
  if(['rest','parks'].includes(metric))return n.energy<65||n.leisure<70;
  if(['clean','hygiene','cleaners'].includes(metric))return n.hygiene<70||n.toilet<60;
  if(['lamps','oilReserve','oilMills','sunflowerFarms'].includes(metric))return (city.economy.lightingSupplyReport?.empty||0)>0||n.safety<70;
  if(['equipped','artisans','woodStock'].includes(metric))return !c.equipment?.carrinho||c.businessIds.length>0;
  if(['deliveries','carriers','builders','preservation','connected'].includes(metric))return c.businessIds.length>0||!!c.homeUnitId||n.safety<70;
  if(['recycling','waste','cultivatedTrees'].includes(metric))return (c.political?.ideology.green||0)>.5||n.hygiene<65;
  if(['literacy','readers','publishedTexts','paperStock'].includes(metric))return n.leisure<80||(c.traits?.openness??.5)>.5;
  if(['savers','banks','paidLoans','inflation'].includes(metric))return c.balance<city.currency.price(30000)||(c.traits?.frugality??.5)>.5;
  if(metric.startsWith('salesTax_'))return metric==='salesTax_food'?n.food<75:c.businessIds.length>0||c.balance<city.currency.price(30000);
  if(metric==='wage')return !!c.jobId;if(metric==='tax')return c.balance>city.currency.price(10000);
  if(metric==='happiness')return c.happiness<75;
  return (c.political?.engagement||0)>.6;
}
const cityLampCount=city=>city.lighting.posts.filter(p=>p.built).length;
const slogans={fed:'Ninguém vai passar fome',housed:'Casa para todas as pessoas',employed:'Uma ocupação para cada adulto',lamps:'Nenhum poste público sem óleo',connected:'Todo prédio ligado à estrada',clean:'Banheiro limpo é dignidade',publicHomes:'Construir moradia popular',publicMeals:'Abrir um refeitório popular',stateFirms:'Ampliar a produção municipal',inflation:'Conter a inflação',tax:'Aliviar o imposto do trabalhador',wage:'Valorizar o salário mínimo',deliveries:'Destravar as entregas',happiness:'Melhorar a vida no bairro'};
export class CityMandates {
  constructor(city){this.city=city;this.terms=[];this.current=null;this.nextId=1;this.lastDay=null;this.lastHour=null;}
  metrics() {
    const city=this.city,people=city.citizens.filter(c=>!c.entity.destroyed),adults=people.filter(c=>city.society.isAdult(c)),buildings=city.buildings.filter(b=>!b.entity.destroyed),posts=city.lighting.posts.filter(p=>p.public && p.built),facilities=[...city.sanitation.facilities.values()];
    const pct=(a,b)=>b?Math.round(a/b*1000)/10:100;
    const active=type=>buildings.filter(b=>b.type===type&&b.active).length;
    const readings=people.reduce((n,c)=>n+Object.values(c.publicationReading||{}).reduce((n,v)=>n+v,0),0);
    return {...Object.fromEntries(Object.keys(TAX_CATEGORIES).map(key=>[`salesTax_${key}`,taxRate(city,key)*100])),health:pct(people.filter(c=>c.needs.health>=60).length,people.length),water:pct(people.filter(c=>c.needs.water>=45).length,people.length),rest:pct(people.filter(c=>c.needs.energy>=50).length,people.length),hygiene:pct(people.filter(c=>c.needs.hygiene>=50).length,people.length),
      clinics:active('clinic')+active('hospital'),waterWorks:active('utility'),parks:active('leisure')+active('park')+active('sports_center')+active('library')+active('theater'),carriers:active('carrier'),cleaners:active('cleaner'),builders:active('builder'),preservation:buildings.length?buildings.reduce((n,b)=>n+(b.condition??100),0)/buildings.length:100,
      waste:city.sanitation.wasteMetrics().awaiting,cultivatedTrees:[...city.nature.plants.values()].filter(p=>p.buildingId).length+city.nature.seeds.filter(p=>p.buildingId).length,oilReserve:city.goodsStock('oleo'),oilMills:active('mill'),sunflowerFarms:buildings.filter(b=>b.type==='farm'&&b.crop==='girassol'&&b.active).length,
      woodStock:city.goodsStock('madeira'),paperStock:city.goodsStock('papel'),publishedTexts:city.publications.nextEntryId-1,readers:pct(people.filter(c=>Object.values(c.publicationReading||{}).some(n=>n>0)).length,people.length),banks:active('bank'),paidLoans:city.bank.loans.filter(l=>l.status==='paid').length,publicJobs:buildings.filter(b=>b.municipal&&b.active).reduce((n,b)=>n+b.workers.length,0),foodVariety:new Set(buildings.filter(b=>b.type==='farm'&&b.active&&!['trigo','girassol'].includes(b.crop)).map(b=>b.crop)).size,kitchens:buildings.filter(b=>b.type==='kitchen'&&b.active).length,artisans:buildings.filter(b=>b.type==='artisan'&&b.active).length,equipped:pct(people.filter(c=>c.equipment?.cesta||c.equipment?.carrinho).length,people.length),savers:pct(people.filter(c=>city.bank.savings(c.accountId)>0).length,people.length),smallFirms:buildings.filter(b=>b.micro||b.equityPartners?.length>1).length,foodReserve:city.welfare.conditions().foodDays,literacy:readings,recycling:buildings.reduce((n,b)=>n+(b.wasteProcessed||0),0),fed:pct(people.filter(c=>c.needs.food>=30).length,people.length),housed:pct(people.filter(c=>c.homeUnitId).length,people.length),employed:pct(adults.filter(c=>c.jobId||c.businessIds.length||c.role==='councilor').length,adults.length),lamps:posts.length?pct(posts.filter(p=>p.fuel>0).length,posts.length):0,
      connected:pct(buildings.filter(b=>city.politics.roadConnected(b)).length,buildings.length),clean:pct(facilities.filter(f=>f.cleanliness>=50).length,facilities.length),
      publicHomes:buildings.filter(b=>['super_popular_housing','popular_housing','popular_luxury_housing'].includes(b.type)).reduce((n,b)=>n+[...city.housing.homes.values()].filter(h=>h.buildingId===b.id && city.housing.isSocial(h)).length,0),publicMeals:buildings.filter(b=>b.type==='popular_refectory' && b.active).length,stateFirms:buildings.filter(b=>b.municipal && b.active).length,
      inflation:Math.abs(city.currency.dailyInflation*100),tax:city.taxRate*100,wage:city.politics.policy.minimumWage*60,deliveries:city.logistics.shipments.filter(s=>!['delivered','cancelled'].includes(s.status)).length,happiness:people.reduce((n,c)=>n+c.happiness,0)/Math.max(1,people.length)};
  }
  program(candidate,party,usedMetrics=[],base=this.metrics()) {
    const profile=ideologicalProfile(party),e=profile.economy,green=profile.green,seed=candidate.id*31+this.city.politics.termNumber*17;
    const catalog=[
      ...Object.entries(TAX_CATEGORIES).map(([key,spec])=>[`salesTax_${key}`,`Reduzir imposto sobre ${spec.label.toLowerCase()}`,Math.max(0,base[`salesTax_${key}`]-2-seed%3)]),
      ['fed','Mutirão de comida: reduzir filas e atender quem passa fome',100],['housed','Aluguel social e casas para famílias sem teto',100],
      ['employed','Recolocar adultos sem renda em cadeias locais',95],['lamps','Rota do óleo: abastecer as ruas esquecidas',100],
      ['connected','Ligar as oficinas e bairros afastados à estrada',95],['clean','Mutirão permanente de limpeza dos banheiros',95],
      ['publicHomes','Novas moradias populares perto dos empregos',base.publicHomes+4+seed%5],['publicMeals','Refeitório popular com alimentação variada',base.publicMeals+1],
      ['stateFirms','Produção pública de bens essenciais',base.stateFirms+1+seed%2],['inflation','Proteger o poder de compra da cesta básica',.1],
      ['tax','Devolver renda ao trabalhador reduzindo o imposto',Math.max(-20,base.tax-3-seed%5)],['wage','Piso salarial com ganho real no mandato',base.wage+30+(seed%4)*30],
      ['deliveries','Pacto com transportadores para diminuir atrasos',Math.floor(base.deliveries*.4)],['happiness','Melhorar a satisfação dos bairros menos atendidos',Math.min(95,base.happiness+12)],
      ['foodVariety','Horta diversa: ampliar legumes, verduras e grãos locais',Math.min(Object.keys(this.city.economy.crops).filter(c=>!['trigo','girassol'].includes(c)).length,base.foodVariety+2)],['kitchens','Abrir cozinhas de bairro para marmitas completas',base.kitchens+1+seed%2],
      ['artisans','Polo de artesanato em madeira e fibras',base.artisans+1],['equipped','Programa de cestas e carrinhos para trabalhadores',Math.min(100,base.equipped+20+seed%15)],
      ['savers','Poupança para famílias formarem uma reserva',Math.min(95,base.savers+15)],['smallFirms','Apoiar negócios de desempregados e cooperativas',base.smallFirms+2+seed%3],
      ['foodReserve','Formar reserva alimentar para enfrentar crises',Math.max(3,Math.min(7,base.foodReserve+2))],['literacy','Mais livros e aprendizado para trabalhadores',base.literacy+10+seed%20],
      ['recycling','Transformar lixo acumulado em insumos produtivos',base.recycling+50+seed%50],
      ['health','Saúde no bairro: ampliar a parcela de moradores saudáveis',Math.min(100,base.health+15)],['water','Água para a rotina: reduzir a sede dos moradores',Math.min(100,base.water+20)],
      ['rest','Descanso digno: recuperar a energia da população',Math.min(100,base.rest+15)],['hygiene','Cidade cuidada: ampliar o acesso à higiene',Math.min(100,base.hygiene+20)],
      ['clinics','Levar uma nova clínica aos bairros',base.clinics+1],['waterWorks','Ampliar a rede local de atendimento de água',base.waterWorks+1],['parks','Criar mais espaços de lazer e convivência',base.parks+1],
      ['carriers','Abrir espaço para mais transportadoras atenderem a cidade',base.carriers+1],['cleaners','Fortalecer as equipes de faxina do município',base.cleaners+1],['builders','Ampliar o número de construtoras para destravar obras',base.builders+1],
      ['preservation','Cuidar do que já existe: recuperar a conservação dos imóveis',Math.min(100,base.preservation+15)],['waste','Lixo fora dos bairros: reduzir o volume aguardando coleta',Math.floor(base.waste*.4)],
      ['cultivatedTrees','Plantar o futuro: ampliar as árvores cultivadas',base.cultivatedTrees+12+seed%13],['oilReserve','Estoque de segurança de óleo para a iluminação',Math.max(12,cityLampCount(this.city)*2)],
      ['oilMills','Fortalecer a prensagem de óleo com mais um moinho',base.oilMills+1],['sunflowerFarms','Do campo à lamparina: ampliar as lavouras de girassol',base.sunflowerFarms+1],
      ['woodStock','Garantir madeira para artesãos e oficinas',base.woodStock+24],['paperStock','Papel para a cidade registrar sua própria história',base.paperStock+30],
      ['publishedTexts','Preservar a memória da cidade em livros e panfletos',base.publishedTexts+12+seed%9],['readers','Leitura ao alcance dos moradores',Math.min(100,base.readers+20)],
      ['banks','Ampliar a rede bancária e o acesso a serviços financeiros',base.banks+1],['paidLoans','Apoiar a quitação de empréstimos das famílias',base.paidLoans+3+seed%4],['publicJobs','Criar postos de trabalho em empresas municipais',base.publicJobs+4+seed%4],

    ];
    const preferred=e<-.3?['housed','publicHomes','publicMeals','wage','stateFirms','clinics','water','publicJobs','health']:e>.3?['tax','smallFirms','savers','deliveries','artisans','carriers','paidLoans','banks']:['kitchens','fed','clean','foodVariety','connected','preservation','hygiene','readers'];
    const priorityMetric={'Alimentação':'fed','Moradia':'housed','Emprego e renda':'employed','Saúde':'health','Higiene e saneamento':'clean','Transporte e acesso':'connected'},research=this.city.politics.getResearch?.(),survey=research?.studies.filter(s=>s.mode==='service'&&s.status==='published'&&s.serviceType==='public-priorities'&&(s.subjectId===candidate.id||s.requesterAccountId===candidate.accountId||s.subjectId===party.id)).sort((a,b)=>b.completedAt-a.completedAt)[0],surveyPriority=new Set((survey?.report?.rows||[]).slice(0,3).map(r=>priorityMetric[r.label]).filter(Boolean));
    const environmental=['recycling','foodVariety','clean','cultivatedTrees','waste'];
    const viable=catalog.filter(([key,,target])=>(target-base[key])*(PROMISE_METRICS[key].higher?1:-1)>.01);
    // Distinct main commitments within the same election, with bounded seeded variation.
    const unused=viable.filter(([key])=>!usedMetrics.includes(key)),pool=unused.length?unused:viable;
    const ranked=pool.map(row=>({row,rank:this.city.random()*1.6+ideologicalPromiseWeight(profile,row[0])+(preferred.includes(row[0])?.7:0)+(green>.6&&environmental.includes(row[0])?.7:0)+(surveyPriority.has(row[0])?1.6:0)})).sort((a,b)=>b.rank-a.rank);
    const ambition=Math.max(0,Math.min(1,.1+(candidate.traits?.ambition??.5)*.55+(1-(candidate.traits?.honesty??.5))*.2+this.city.random()*.35));
    return ranked.slice(0,1).map(({row:[metric,title,target]})=>{
      const spec=PROMISE_METRICS[metric],factor=.4+ambition*1.9;
      let adjusted=base[metric]+(target-base[metric])*factor;
      if(spec.unit==='%')adjusted=metric==='tax'?Math.max(-50,Math.min(50,adjusted)):metric==='inflation'?Math.max(0,adjusted):Math.max(0,Math.min(100,adjusted));
      else if(!spec.unit)adjusted=spec.higher?Math.ceil(adjusted):Math.max(0,Math.floor(adjusted));
      adjusted=Math.round(adjusted*10)/10;
      return {metric,title,target:adjusted,...promiseDifficulty(metric,base[metric],adjusted,spec),candidateAmbition:ambition,campaignBaseline:base[metric],current:base[metric],higher:spec.higher};
    });
  }

  start(mayor,party,promises=[],electionId=null) {
    this.finish();const base=this.metrics();
    const term={id:this.nextId++,mayorId:mayor.id,mayorName:mayor.entity.properties.name,partyId:party.id,calendarRules:this.city.politics.termRules,startedAt:this.city.minute,endedAt:null,electionId,baseline:Object.freeze({...base}),latest:Object.freeze({...base}),checkpoints:[],promises:promises.slice(0,1).map(p=>({...p,baseline:base[p.metric],current:base[p.metric],progress:0,fulfilled:false})),score:0};
    this.current=term;for(const c of this.city.citizens)if(!c.entity.destroyed){this.city.politics.initializeCitizen(c);captureGovernmentExperience(this.city,c,term.id);}this.terms.push(term);if(this.terms.length>32)this.terms.shift();this.lastDay=null;this.lastHour=null;this.update();return term;
  }
  update(force=false) {
    const t=this.current,hour=Math.floor(this.city.minute/60);if(!t||!force&&this.lastHour===hour)return;this.lastHour=hour;this.lastDay=this.city.day;
    const now=this.metrics();t.latest=Object.freeze({...now});t.outcomes=outcomeAssessment(t.baseline,now);
    for(const p of t.promises){
      const wasFulfilled=p.fulfilled,previousTier=p.overdeliveryTier||0;p.current=now[p.metric];
      const assessment=promiseAssessment(p,t,this.city.minute);p.progress=assessment.progress;p.fulfilled=assessment.fulfilled;
      if(assessment.completionAt!=null&&p.fulfilledAt==null)p.fulfilledAt=assessment.completionAt;
      p.assessment=Object.freeze(assessment);const tier=Math.floor(assessment.overdelivery*4+1e-6);
      let kind=null,message=null;
      if(p.fulfilled&&!wasFulfilled&&assessment.earned){kind=p.achievementEventId?'promise-recovered':'promise-fulfilled';message=`${t.mayorName} ${p.achievementEventId?'recuperou':'cumpriu'} a meta: ${p.title}.`;}
      else if(!p.fulfilled&&wasFulfilled&&p.achievementEventId){kind='promise-setback';message=`A meta de ${t.mayorName} deixou de ser atendida: ${p.title}.`;}
      else if(p.fulfilled&&tier>previousTier){kind='promise-surpassed';message=`${t.mayorName} superou a meta em ${(assessment.overdelivery*100).toFixed(0)}% do avanço prometido: ${p.title}.`;}
      if(kind){const event=this.city.log(message,'government',[t.mayorId],{kind,termId:t.id,partyId:t.partyId,metric:p.metric,baseline:p.baseline,target:p.target,current:p.current,fulfilledAt:p.fulfilledAt,earlyBonus:assessment.early,overdeliveryBonus:assessment.excess,popularityPoints:assessment.points,relatedEventIds:[p.lastEventId].filter(id=>id!=null)});if(kind==='promise-fulfilled')p.achievementEventId=event.id;p.lastEventId=event.id;}
      p.overdeliveryTier=Math.max(previousTier,tier);
    }
    const promisePoints=t.promises.reduce((n,p)=>n+p.assessment.points,0)/Math.max(1,t.promises.length);
    t.score=Math.max(-1.5,Math.min(1.5,promisePoints/40*.7+t.outcomes.points/40*.3));
    const snapshot=Object.freeze({minute:this.city.minute,day:this.city.day,...now,score:t.score,promisePoints,outcomePoints:t.outcomes.points});
    if(t.checkpoints.at(-1)?.day===this.city.day)t.checkpoints[t.checkpoints.length-1]=snapshot;else t.checkpoints.push(snapshot);
    if(t.checkpoints.length>180)t.checkpoints.shift();
  }
  finish(reason='Encerramento do mandato') {
    const t=this.current;if(!t)return;this.update(true);t.endedAt=this.city.minute;t.endReason=reason;
    this.city.log(`${t.mayorName} encerrou a gestão; ${t.promises.filter(p=>p.fulfilled).length}/${t.promises.length} promessas cumpridas.`,'government',[t.mayorId],{kind:'term-assessed',termId:t.id,partyId:t.partyId,score:t.score});
    const memories=Object.freeze(t.promises.map(p=>Object.freeze({title:p.title,metric:p.metric,baseline:p.baseline,current:p.current,target:p.target,fulfilled:p.fulfilled,fulfilledAt:p.fulfilledAt,overdelivery:p.assessment?.overdelivery,attention:p.attention})));
    for(const c of this.city.citizens.filter(c=>!c.entity.destroyed))this.city.politics.remember(c,{kind:'government-record',partyId:t.partyId,candidateId:t.mayorId,termId:t.id,effect:t.score*24,description:`Balanço de ${t.mayorName}: ${t.promises.filter(p=>p.fulfilled).length}/${t.promises.length} promessas cumpridas.`,promises:memories});
    this.current=null;
  }
  recordScore(candidateId,partyId) {
    const relevant=this.terms.filter(t=>t.promises.length && (t.mayorId===candidateId||t.partyId===partyId)).slice(-3);
    return relevant.length?relevant.reduce((n,t)=>n+t.score*(t.mayorId===candidateId?1:.75),0)/relevant.length*30:0;
  }
}
