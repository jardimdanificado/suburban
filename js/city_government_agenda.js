const live=b=>b&&!b.entity.destroyed;
const pending=b=>['awaiting-session','proposed','awaiting-sanction','approved','executing','vetoed'].includes(b.status);
const buildingFor={housed:'popular_housing',publicHomes:'popular_housing',publicMeals:'popular_refectory',kitchens:'kitchen',stateFirms:'utility',publicJobs:'carrier',employed:'carrier',smallFirms:'artisan',clean:'cleaner',hygiene:'cleaner',cleaners:'cleaner',health:'clinic',clinics:'clinic',water:'utility',waterWorks:'utility',rest:'leisure',parks:'leisure',carriers:'carrier',deliveries:'carrier',builders:'builder',cultivatedTrees:'forestry',woodStock:'forestry',paperStock:'paper_mill',publishedTexts:'publisher',readers:'publisher',literacy:'publisher',artisans:'artisan',equipped:'artisan',savers:'bank',banks:'bank',paidLoans:'bank',recycling:'composting',waste:'waste_collector',oilMills:'mill',sunflowerFarms:'farm'};
const supplyChains={paperStock:['forestry','paper_mill'],publishedTexts:['forestry','paper_mill','publisher'],readers:['forestry','paper_mill','publisher'],literacy:['forestry','paper_mill','publisher'],equipped:['forestry','artisan'],artisans:['forestry','artisan'],recycling:['waste_collector','composting'],waste:['waste_collector','composting'],lamps:['farm','mill','lamp_service'],oilReserve:['farm','mill','lamp_service']};
import {initializeEquity,offerShares,buyShares,equityValue} from './city_equity.js?v=daily-mayor-privatization-1';
import {formatMoney} from './city_ui_format.js';
export class CityGovernmentAgenda {
  constructor(city){this.city=city;this.lastPeriod=null;}
  record(term,execution,description,details={}){
    const event=this.city.log(description,'government',[term.mayorId],{kind:'government-agenda-action',termId:term.id,partyId:term.partyId,metric:term.promises[0].metric,...details});
    execution.actions.push({minute:this.city.minute,description,eventId:event.id,...details});if(execution.actions.length>48)execution.actions.shift();return event;
  }
  proposal(term,execution,type,payload,title){
    const p=this.city.politics,matching=p.council.bills.find(b=>pending(b)&&b.type===type&&(type!=='salesTax'||b.payload.category===payload.category)&&(type==='build'||payload.value==null||b.payload.value===payload.value)&&(type!=='build'||b.payload.buildingType===payload.buildingType&&(payload.buildingType!=='farm'||(b.payload.crop||'milho')===(payload.crop||'milho'))));
    if(matching){matching.agendaTermId=term.id;matching.promiseMetric=term.promises[0].metric;if(!execution.actions.some(a=>a.billId===matching.id))this.record(term,execution,`A gestão passou a acompanhar: ${matching.title}.`,{billId:matching.id,action:'follow-bill'});return matching;}
    if(p.council.bills.filter(b=>b.agendaTermId===term.id&&pending(b)).length>=2){execution.blocked='Aguardando os projetos prioritários já encaminhados à Câmara.';return null;}
    const author=p.council.people().find(c=>c.political.partyId===term.partyId)||p.council.people()[0];if(!author){execution.blocked='Câmara sem vereador disponível para apresentar o projeto.';return null;}
    const bill=p.council.propose(author,type,payload,`Plano de governo: ${title}`);if(!bill||typeof bill!=='object'){execution.blocked='Aguardando tramitação de proposta semelhante.';return null;}
    bill.agendaTermId=term.id;bill.promiseMetric=term.promises[0].metric;this.record(term,execution,`${term.mayorName} articulou na Câmara: ${title}.`,{billId:bill.id,action:'propose'});return bill;
  }
  build(term,execution,type,crop=null){
    const city=this.city,existing=city.development.projects.find(p=>p.accountId==='treasury'&&!p.cancelled&&p.status!=='completed'&&p.type===type&&(!crop||p.crop===crop));
    if(existing){existing.agendaTermId=term.id;existing.promiseMetric=term.promises[0].metric;existing.priority=Math.max(existing.priority||0,95);if(!execution.actions.some(a=>a.projectId===existing.id))this.record(term,execution,`Obra priorizada para a promessa: ${city.buildingTypes[type].label}.`,{projectId:existing.id,action:'prioritize'});execution.blocked=existing.error||'Obra em andamento; depende de materiais, transporte e trabalho.';return;}
    const bill=this.proposal(term,execution,'build',{buildingType:type,...(crop?{crop}:{})},`${city.buildingTypes[type].label}${crop?' de '+crop:''}`);
    if(bill?.projectId){const project=city.development.projects.find(a=>a.id===bill.projectId);if(project){project.agendaTermId=term.id;project.promiseMetric=term.promises[0].metric;project.priority=Math.max(project.priority||0,95);}}
  }
  operations(term,execution,types){
    const city=this.city,needs=city.welfare.conditions();let spent=0;
    for(const b of city.buildings.filter(b=>live(b)&&b.municipal&&types.includes(b.type))){
      const amount=Math.min(Math.max(0,city.currency.price(15000)-b.balance),Math.max(0,city.treasury-needs.reserve),city.currency.price(30000)-spent);if(amount<=0)continue;
      if(city.transfer('treasury',b.accountId,Math.floor(amount),'Custeio de serviço do plano de governo',{termId:term.id,buildingId:b.id})){spent+=Math.floor(amount);this.record(term,execution,`Custeio de operação para ${b.entity.properties.name}.`,{buildingId:b.id,amount:Math.floor(amount),action:'fund-operation'});}if(spent>=city.currency.price(30000))break;
    }
  }
  infrastructure(term,execution,metric){
    const city=this.city,dev=city.development,hall=city.buildings.find(b=>live(b)&&b.type==='townhall');if(!hall)return;
    if(metric==='lamps'){const before=new Set(dev.projects.map(p=>p.id));city.lighting.hourly();for(const project of dev.projects)if(!before.has(project.id)&&project.service==='lamp'){project.agendaTermId=term.id;this.record(term,execution,'Instalação de iluminação pública contratada.',{projectId:project.id,action:'contract'});}return;}
    const active=dev.projects.find(p=>p.accountId==='treasury'&&!p.cancelled&&p.status!=='completed'&&(metric==='connected'?['road','bridge'].includes(p.service):p.service==='repair'));
    if(active){active.agendaTermId=term.id;active.priority=Math.max(active.priority||0,95);execution.blocked='Serviço prioritário em execução.';return;}
    const target=city.buildings.filter(b=>live(b)&&b.id!==hall.id&&(metric==='connected'?!city.politics.roadConnected(b):b.condition<85)).sort((a,b)=>metric==='connected'?city.trafficScore(b.accessPath)-city.trafficScore(a.accessPath):(a.condition||100)-(b.condition||100))[0];
    if(!target){execution.blocked='Aguardando demanda de manutenção ou acesso.';return;}
    const route=city.findPath(target.door,hall.door);const estimate=metric==='connected'?(route?.length||0)*(city.currency.price(8000)*1.5+city.economy.goods.pedra.price):target.width*target.depth*city.currency.price(2500)*1.5+Math.max(2,Math.ceil(target.width*target.depth*.25))*city.economy.goods.pedra.price;
    if(city.treasury-city.welfare.conditions().reserve<estimate){execution.blocked='Sem orçamento livre para contratar o serviço preservando a reserva essencial.';return;}
    const project=metric==='connected'?dev.beginRoad('treasury',target.door,hall.door):dev.beginRepair('treasury',target.id,{preventive:true});
    if(project){project.agendaTermId=term.id;project.priority=Math.max(project.priority||0,95);this.record(term,execution,`Serviço contratado para a promessa: ${project.name}.`,{projectId:project.id,action:'contract'});}else execution.blocked='Aguardando construtora, acesso ou condições de contratação.';
  }
  initiative(term,execution,pr){
    const city=this.city,id=pr.initiativeId;if(!id||execution.initiativeApplied===id)return;const needs=city.welfare.conditions(),budget=Math.max(0,city.treasury-needs.reserve);
    if(id==='market-revival'||id==='market-coops'){
      const target=city.economy.businesses.filter(b=>b.active&&!b.entity.destroyed&&b.type==='market'&&((b.financialDistressDays||0)>0||b.balance<city.currency.price(5000))).sort((a,b)=>(a.balance||0)-(b.balance||0))[0];if(!target||budget<city.currency.price(1000))return;
      const amount=Math.min(budget,city.currency.price(30000),Math.max(city.currency.price(1000),Math.floor((target.totalExpenses||0)*.15)));if(!city.transfer('treasury',target.accountId,amount,id==='market-coops'?'Capitalização municipal para conversão de mercado em cooperativa':'Fundo de recuperação de mercado local',{termId:term.id,buildingId:target.id}))return;target.governmentRecovery??=[];target.governmentRecovery.push({minute:city.minute,amount,termId:term.id,initiativeId:id});execution.initiativeApplied=id;this.record(term,execution,`${target.entity.properties.name} recebeu plano de recuperação comercial de ${formatMoney(amount)}.`,{buildingId:target.id,amount,initiativeId:id,action:'market-recovery'});return;
    }
    if(id==='rent-voucher'){
      const recipient=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)&&!c.homeUnitId&&c.balance<city.currency.price(20000)).sort((a,b)=>a.balance-b.balance)[0],amount=Math.min(budget,city.currency.price(6000));if(!recipient||amount<1||!city.transfer('treasury',recipient.accountId,amount,'Vale-aluguel temporário do plano de governo',{termId:term.id,citizenId:recipient.id}))return;city.politics.rentVouchers??=[];city.politics.rentVouchers.push({citizenId:recipient.id,amount,minute:city.minute,termId:term.id});execution.initiativeApplied=id;this.record(term,execution,`${recipient.entity.properties.name} recebeu vale habitacional temporário.`,{citizenId:recipient.id,amount,initiativeId:id,action:'housing-voucher'});return;
    }
    if(id==='housing-credit'){
      const buyer=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)&&!c.homeUnitId&&c.balance<city.currency.price(90000)&&c.jobId).sort((a,b)=>b.balance-a.balance)[0],home=city.housing?.homes&&[...city.housing.homes.values()].find(h=>!city.housing.isSocial(h)&&city.housing.units(h).length&&city.housing.units(h).every(u=>u.forSale&&!u.tenantId)),banks=city.bank.developmentBanks();if(!buyer||!home||!banks.length)return;
      const price=city.housing.price(home),reserve=city.currency.price(30000),down=Math.ceil(price*.25),needed=price-down,grant=Math.max(down,down+reserve-buyer.balance);if(grant>budget||!city.transfer('treasury',buyer.accountId,grant,'Entrada subsidiada do programa de crédito habitacional',{termId:term.id,citizenId:buyer.id,homeId:home.id}))return;
      let loan=null;for(const bank of banks){loan=city.bank.mortgage(bank,buyer,needed,{homeId:home.id});if(loan)break;}if(!loan){city.transfer(buyer.accountId,'treasury',grant,'Estorno de entrada habitacional sem financiamento',{termId:term.id});return;}
      if(!city.housing.buyHome(buyer,home)){city.bank.cancelMortgage(loan);city.transfer(buyer.accountId,'treasury',grant,'Estorno de entrada habitacional não utilizada',{termId:term.id});return;}
      execution.initiativeApplied=id;this.record(term,execution,`${buyer.entity.properties.name} recebeu financiamento habitacional com entrada subsidiada.`,{citizenId:buyer.id,buildingId:home.buildingId,homeId:home.id,loanId:loan.id,amount:grant,initiativeId:id,action:'housing-credit'});return;
    }
    if(id==='state-equity-loan'){
      const resident=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)&&!c.businessIds?.length&&c.balance<city.currency.price(30000)).sort((a,b)=>(b.traits?.ambition||0)-(a.traits?.ambition||0))[0],firm=city.economy.businesses.find(b=>b.municipal&&!b.entity.destroyed&&b.active&&!['townhall','mint'].includes(b.type));if(!resident||!firm||budget<city.currency.price(1000)||!initializeEquity(city,firm))return;
      const value=equityValue(city,firm),points=500,price=Math.max(1,Math.ceil(value*points/10000)),principal=Math.min(budget,price);if(principal<price||!city.transfer('treasury',resident.accountId,principal,'Empréstimo municipal para aquisição de participação em estatal',{termId:term.id,citizenId:resident.id,buildingId:firm.id}))return;
      const offer=offerShares(city,firm,'treasury',points,{capitalRaise:false});if(!offer||!buyShares(city,firm,offer.id,resident.accountId,points)){city.transfer(resident.accountId,'treasury',principal,'Estorno de empréstimo de participação estatal',{termId:term.id});return;}
      city.politics.stateEquityLoans??=[];city.politics.stateEquityLoans.push({citizenId:resident.id,buildingId:firm.id,principal,remaining:principal,startedAt:city.minute,termId:term.id});execution.initiativeApplied=id;this.record(term,execution,`${resident.entity.properties.name} recebeu ${formatMoney(principal)} para adquirir 5% de ${firm.entity.properties.name}; a devolução será descontada quando houver saldo disponível.`,{citizenId:resident.id,buildingId:firm.id,amount:principal,initiativeId:id,action:'state-equity-loan'});return;
    }
  }
  hourly(force=false){
    const city=this.city,p=city.politics,term=p.mandates.current,pr=term?.promises[0];if(!pr||term.endedAt!=null)return;
    const period=`${term.id}:${Math.floor(city.minute/360)}`;if(!force&&this.lastPeriod===period)return;this.lastPeriod=period;
    const execution=pr.execution??={actions:[],status:'Planejamento',blocked:null,committed:0};execution.updatedAt=city.minute;execution.blocked=null;
    // Reconcile real bills and contracts before choosing the next bounded action.
    for(const action of execution.actions){const bill=p.council.bills.find(b=>b.id===action.billId);if(bill){action.status=bill.status;action.result=bill.result;if(bill.projectId)action.projectId=bill.projectId;}const project=city.development.projects.find(a=>a.id===action.projectId);if(project){action.status=project.cancelled?'cancelled':project.status;project.agendaTermId=term.id;project.priority=Math.max(project.priority||0,95);}if(bill?.result&&bill.status==='executing')execution.blocked=bill.result;}
    this.initiative(term,execution,pr);
    const metric=pr.metric,buildings=city.buildings.filter(live),active=type=>buildings.some(b=>b.type===type&&b.active&&(type!=='farm'||b.crop==='girassol'));
    if(!pr.fulfilled){
      if(['marketRecoveries','rentVouchers','stateEquityLoans'].includes(metric)){if(!execution.initiativeApplied)execution.blocked='Aguardando mercado em crise, família elegível ou estatal disponível e caixa preservando a reserva municipal.';}
      else if(metric.startsWith('salesTax_'))this.proposal(term,execution,'salesTax',{category:metric.slice(9),value:pr.target/100},`reduzir imposto do ramo para ${pr.target.toFixed(1)}%`);
      else if(['treasuryHealth','operatingHealth','serviceHealth','companyProductivity'].includes(metric)){city.fiscal.hourly();city.fiscal.fundServices();city.economy.hire();if(metric!=='companyProductivity')city.fiscal.requestRevenueReview();execution.blocked='Revisão de receitas, custeio dos serviços e contratação em andamento; resultado depende das contas e da produção reais.';}
      else if(metric==='tax')this.proposal(term,execution,'tax',{value:pr.target/100},`reduzir imposto para ${pr.target.toFixed(1)}%`);
      else if(metric==='wage')this.proposal(term,execution,'minimumWage',{value:Math.ceil(pr.target/60)},'aumentar o piso salarial prometido');
      else if(metric==='inflation'){if(city.currency.policy.inflationTarget>pr.target/100||!execution.actions.some(a=>a.action==='propose'))this.proposal(term,execution,'inflation',{value:Math.max(0,Math.floor(city.currency.policy.dailyLimit*.8)),target:pr.target/100},'controle de inflação e emissão');else execution.blocked='Aguardando os efeitos das medidas monetárias aprovadas.';}
      else if(['connected','preservation'].includes(metric))this.infrastructure(term,execution,metric);
      else{
        let type=buildingFor[metric],crop=metric==='sunflowerFarms'?'girassol':null;
        if(['fed','foodReserve','foodVariety'].includes(metric)){
          const crops=Object.keys(city.economy.crops).filter(c=>c!=='girassol'&&!city.economy.crops[c].nonFood),farm=crops.find(c=>!buildings.some(b=>b.type==='farm'&&b.crop===c));
          type=metric==='foodVariety'||city.welfare.conditions().foodDays<1?'farm':!active('kitchen')?'kitchen':'popular_refectory';crop=type==='farm'?(farm||'milho'):null;
          const before=city.logistics.shipments.length;city.welfare.restockPublicMeals();if(city.logistics.shipments.length>before)this.record(term,execution,'Compra e transporte de alimentos para refeições públicas.',{action:'order-food',orders:city.logistics.shipments.length-before});
        }
        if(['employed','smallFirms','publicJobs'].includes(metric)){const opportunity=city.economy.demands.find(d=>d.score>=60&&d.type!=='farm'&&city.buildingTypes[d.type]);if(opportunity)type=opportunity.type;}
        if(metric==='happiness'){const needs=city.welfare.conditions();type=needs.hungry>needs.population*.1?'popular_refectory':needs.homeless?'popular_housing':'leisure';}
        const chain=supplyChains[metric];if(chain){type=chain.find(t=>!active(t))||buildingFor[metric]||'carrier';crop=type==='farm'?'girassol':null;execution.plan=chain.map(t=>city.buildingTypes[t]?.label||t);}
        if(type&&city.buildingTypes[type]){
          this.operations(term,execution,[type,...(chain||[])]);
          const stockOrUse=['woodStock','cultivatedTrees','paperStock','publishedTexts','readers','literacy','equipped','savers','paidLoans'];
          if(['lamps','oilReserve'].includes(metric)&&chain.every(active)){
            const supply=city.economy.lightingSupplyReport;
            if(supply&&supply.farmPotential+supply.farmPlanned<supply.sunflowerRequired)this.build(term,execution,'farm','girassol');
            else if(supply&&supply.millPotential+supply.millPlanned<supply.oilRequired)this.build(term,execution,'mill');
            else{if(metric==='lamps')this.infrastructure(term,execution,'lamps');execution.blocked??=supply?.bottleneck||'Aguardando produção, transporte e abastecimento de óleo.';}
          }else if(stockOrUse.includes(metric)&&active(type)&&(!chain||chain.every(active)))execution.blocked='Cadeia disponível: custeio mantido; aguardando produção, trabalho, renda e uso pelos moradores.';
          else this.build(term,execution,type,crop);
        }else execution.blocked='Aguardando capacidade de executar a medida planejada.';
      }
    }
    execution.committed=Math.min(3,execution.actions.filter(a=>a.action==='fund-operation'&&a.amount>0||a.action==='order-food'&&a.orders>0||a.projectId&&city.development.projects.some(p=>p.id===a.projectId&&!p.cancelled&&p.startedAt>=term.startedAt&&(p.fee>0||p.labor>0))||a.status==='executed').length);
    execution.status=pr.fulfilled?'Meta atendida':execution.blocked?'Execução com pendências':execution.actions.length?'Medidas em andamento':'Planejamento';
    const state=`${execution.status}:${execution.blocked||''}`;if(execution.lastState!==state){execution.lastState=state;this.record(term,execution,`${execution.status}: ${execution.blocked||pr.title}`,{action:'status'});}
  }
}
