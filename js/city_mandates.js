export const PROMISE_METRICS={
  foodVariety:{label:'Culturas alimentares em produção',unit:'',higher:true},kitchens:{label:'Cozinhas ativas',unit:'',higher:true},artisans:{label:'Oficinas de artesãos ativas',unit:'',higher:true},equipped:{label:'Moradores com cestas ou carrinhos',unit:'%',higher:true},savers:{label:'Moradores com poupança',unit:'%',higher:true},smallFirms:{label:'Microempresas e cooperativas',unit:'',higher:true},foodReserve:{label:'Dias de reserva alimentar',unit:'dias',higher:true},literacy:{label:'Leituras realizadas',unit:'',higher:true},recycling:{label:'Resíduos processados',unit:'',higher:true},
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
    return {foodVariety:new Set(buildings.filter(b=>b.type==='farm'&&b.active&&!['trigo','girassol'].includes(b.crop)).map(b=>b.crop)).size,kitchens:buildings.filter(b=>b.type==='kitchen'&&b.active).length,artisans:buildings.filter(b=>b.type==='artisan'&&b.active).length,equipped:pct(people.filter(c=>c.equipment?.cesta||c.equipment?.carrinho).length,people.length),savers:pct(people.filter(c=>city.bank.savings(c.accountId)>0).length,people.length),smallFirms:buildings.filter(b=>b.micro||b.equityPartners?.length>1).length,foodReserve:city.welfare.conditions().foodDays,literacy:city.economy.consumed.livros||0,recycling:buildings.reduce((n,b)=>n+(b.wasteProcessed||0),0),fed:pct(people.filter(c=>c.needs.food>=30).length,people.length),housed:pct(people.filter(c=>c.homeUnitId).length,people.length),employed:pct(adults.filter(c=>c.jobId||c.businessIds.length||c.role==='councilor').length,adults.length),lamps:posts.length?pct(posts.filter(p=>p.fuel>0).length,posts.length):0,
      connected:pct(buildings.filter(b=>city.politics.roadConnected(b)).length,buildings.length),clean:pct(facilities.filter(f=>f.cleanliness>=50).length,facilities.length),
      publicHomes:buildings.filter(b=>b.type==='popular_housing').reduce((n,b)=>n+[...city.housing.homes.values()].filter(h=>h.buildingId===b.id && city.housing.isSocial(h)).length,0),publicMeals:buildings.filter(b=>b.type==='popular_refectory' && b.active).length,stateFirms:buildings.filter(b=>b.municipal && b.active).length,
      inflation:Math.abs(city.currency.dailyInflation*100),tax:city.taxRate*100,wage:city.politics.policy.minimumWage*60,deliveries:city.logistics.shipments.filter(s=>!['delivered','cancelled'].includes(s.status)).length,happiness:people.reduce((n,c)=>n+c.happiness,0)/Math.max(1,people.length)};
  }
  program(candidate,party) {
    const base=this.metrics(),e=party.ideology.economy,green=party.ideology.green,seed=candidate.id*31+this.city.politics.termNumber*17;
    const catalog=[
      ['fed','Mutirão de comida: reduzir filas e atender quem passa fome',100],['housed','Aluguel social e casas para famílias sem teto',100],
      ['employed','Recolocar adultos sem renda em cadeias locais',95],['lamps','Rota do óleo: abastecer as ruas esquecidas',100],
      ['connected','Ligar as oficinas e bairros afastados à estrada',95],['clean','Mutirão permanente de limpeza dos banheiros',95],
      ['publicHomes','Novas moradias populares perto dos empregos',base.publicHomes+4+seed%5],['publicMeals','Refeitório popular com alimentação variada',base.publicMeals+1],
      ['stateFirms','Produção pública de bens essenciais',base.stateFirms+1+seed%2],['inflation','Proteger o poder de compra da cesta básica',.1],
      ['tax','Devolver renda ao trabalhador reduzindo o imposto',Math.max(-20,base.tax-3-seed%5)],['wage','Piso salarial com ganho real no mandato',base.wage+30+(seed%4)*30],
      ['deliveries','Pacto com transportadores para diminuir atrasos',Math.floor(base.deliveries*.4)],['happiness','Melhorar a satisfação dos bairros menos atendidos',Math.min(95,base.happiness+12)],
      ['foodVariety','Horta diversa: ampliar legumes, verduras e grãos locais',Math.min(12,base.foodVariety+2)],['kitchens','Abrir cozinhas de bairro para marmitas completas',base.kitchens+1+seed%2],
      ['artisans','Polo de artesanato em madeira e fibras',base.artisans+1],['equipped','Programa de cestas e carrinhos para trabalhadores',Math.min(100,base.equipped+20+seed%15)],
      ['savers','Poupança para famílias formarem uma reserva',Math.min(95,base.savers+15)],['smallFirms','Apoiar negócios de desempregados e cooperativas',base.smallFirms+2+seed%3],
      ['foodReserve','Formar reserva alimentar para enfrentar crises',Math.max(base.foodReserve+2,7)],['literacy','Mais livros e aprendizado para trabalhadores',base.literacy+10+seed%20],
      ['recycling','Transformar lixo acumulado em insumos produtivos',base.recycling+50+seed%50],
    ];
    const preferred=e<-.3?['housed','publicHomes','publicMeals','wage','stateFirms']:e>.3?['tax','smallFirms','savers','deliveries','artisans']:['kitchens','fed','clean','foodVariety','connected'];
    const ranked=catalog.filter(([key,,target])=>Math.abs(target-base[key])>.01).map((row,i)=>({row,rank:((Math.imul(seed+7,i+19)>>>0)%101)/101+(preferred.includes(row[0])?.65:0)+(green>.6&&['recycling','foodVariety','clean'].includes(row[0])?.5:0)})).sort((a,b)=>b.rank-a.rank);
    return ranked.slice(0,6).map(({row:[metric,title,target]})=>({metric,title,target,campaignBaseline:base[metric],current:base[metric],higher:PROMISE_METRICS[metric].higher}));
  }
  start(mayor,party,promises=[],electionId=null) {
    this.finish();const base=this.metrics();
    const term={id:this.nextId++,mayorId:mayor.id,mayorName:mayor.entity.properties.name,partyId:party.id,calendarRules:this.city.politics.termRules,startedAt:this.city.minute,endedAt:null,electionId,baseline:Object.freeze({...base}),latest:Object.freeze({...base}),checkpoints:[],promises:promises.map(p=>({...p,baseline:base[p.metric],current:base[p.metric],progress:0,fulfilled:false})),score:0};
    this.current=term;this.terms.push(term);if(this.terms.length>32)this.terms.shift();this.lastDay=null;this.update();return term;
  }
  update(force=false) {
    const t=this.current;if(!t || !force && this.lastDay===this.city.day)return;this.lastDay=this.city.day;
    const now=this.metrics();t.latest=Object.freeze({...now});
    for(const p of t.promises){p.current=now[p.metric];const direction=p.higher?1:-1,goal=(p.target-p.baseline)*direction,change=(p.current-p.baseline)*direction;p.fulfilled=(p.current-p.target)*direction>=-.001;p.progress=goal>0?Math.max(-1,Math.min(1,change/goal)):p.fulfilled?1:-Math.min(1,Math.abs(change)/Math.max(1,Math.abs(p.baseline)));}
    t.score=t.promises.length?t.promises.reduce((s,p)=>s+p.progress*.6+(p.fulfilled?.4:0)-.5,0)/t.promises.length:0;
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
