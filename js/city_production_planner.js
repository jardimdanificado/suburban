import {businessFloors} from './city_business_heights.js';
import {INDUSTRIES} from './city_industries.js';
import {DEVELOPMENT_RULES} from './city_development.js?v=business-heights-1';
import {chooseBuildingSite} from './city_terrain.js?v=investment-plan-reuse-1';
import {OFFICE_ONLY_TYPES,officeSpaceDemand,officeFloors,createMunicipalOffice} from './city_offices.js?v=office-demand-rollout-1';
const key=(type,crop)=>`${type}:${crop||''}`;
const pending=p=>!p.cancelled&&p.status!=='completed';
const inputs=(type)=>type==='bakery'?{trigo:2}:type==='mill'?{girassol:3}:INDUSTRIES[type]?.inputs||{};
const vehicleFactories=new Set(['bearing_factory','frame_factory','deck_factory','tire_factory','chain_factory','safety_equipment','saddle_factory','cycle_assembler']);
const startupCapital=(city,economy,type)=>type==='cycle_shop'
  ? Math.ceil(['bicicleta','bicicleta_carga','patins','skate'].reduce((n,g)=>n+economy.goods[g].price,0)*3)+city.currency.price(100000)
  : type==='bicycle_rental'?Math.ceil(economy.goods.bicicleta.price*3)+city.currency.price(100000)
  : city.currency.price(type==='bank'?2000000:type==='research_institute'?100000:type==='cycle_assembler'?600000:vehicleFactories.has(type)?180000:60000);
// Get the vehicle supply chain off the ground in dependency order. The long tail
// of optional industries can still open later as the production queue clears.
const rolloutPriority={
  iron_mine:220,foundry:205,steel_mill:205,bauxite_mine:200,aluminum_smelter:190,
  rubber_grove:195,rubberworks:185,glassworks:185,forestry:185,sawmill:175,
  bearing_factory:170,frame_factory:170,deck_factory:170,tire_factory:170,
  chain_factory:170,safety_equipment:170,saddle_factory:170,cycle_assembler:155,
  cycle_shop:145,
};
/** Demand follows recipes before factories exist, preventing empty chains from remaining invisible. */
export function productionPlan(economy){
  const city=economy.city,firms=economy.businesses,projects=city.development.projects.filter(pending),rows=new Map(),since=economy.productionWaitSince??={},responses=economy.productionResponses??={};
  const producers=new Map();
  for(const [type,spec]of Object.entries(INDUSTRIES))for(const good of Object.keys(spec.outputs))if(!producers.has(good))producers.set(good,{type,crop:null});
  for(const good of Object.keys(economy.crops))producers.set(good,{type:'farm',crop:good});
  producers.set('pao',{type:'bakery',crop:null});producers.set('oleo',{type:'mill',crop:null});producers.set('pedra',{type:'quarry',crop:null});
  const existingByType=new Map(),plannedByType=new Map();
  for(const b of firms){const id=key(b.type,b.type==='farm'?b.crop:null);let sites=existingByType.get(id);if(!sites)existingByType.set(id,sites=[]);sites.push(b);}
  for(const p of projects){const id=key(p.type,p.type==='farm'?p.crop:null);let sites=plannedByType.get(id);if(!sites)plannedByType.set(id,sites=[]);sites.push(p);}
  const exists=(type,crop)=>existingByType.get(key(type,type==='farm'?crop:null))?.length||0;
  const planned=(type,crop)=>plannedByType.get(key(type,type==='farm'?crop:null))||[];
  // The recipe graph is normally acyclic. Keep the original trail-sensitive
  // traversal for cyclic recipes; score dominance is safe only in a DAG.
  const states=new Map();let acyclic=true;
  function inspect(type){if(states.get(type)===1){acyclic=false;return;}if(states.get(type)===2)return;states.set(type,1);for(const good of Object.keys(inputs(type))){const provider=producers.get(good);if(provider)inspect(provider.type);}states.set(type,2);}
  for(const type of [...Object.keys(INDUSTRIES),'bakery','mill'])inspect(type);
  const expandedScores=new Map();let officeMissing;
  function visit(type,crop,score,origin,trail=new Set()){
    const id=key(type,crop);if(!acyclic&&trail.has(id))return;
    const current=exists(type,crop),building=planned(type,crop),target=type==='research_institute'?city.politics.getResearch().demand().required:1;
    const absent=type==='office_tower'?(officeMissing??=officeSpaceDemand(city).missing>0):current+building.length<target;
    const row=rows.get(id)||{type,crop,origins:[],missing:absent,current,planned:building.length,projectId:building[0]?.id,score:0};
    if(!row.origins.includes(origin))row.origins.push(origin);row.score=Math.max(row.score,score);rows.set(id,row);
    if(acyclic&&(expandedScores.get(id)??-Infinity)>=score)return;
    expandedScores.set(id,score);
    const path=acyclic?trail:new Set(trail);if(!acyclic)path.add(id);
    // Both established and planned consumers create demand for the earlier stages.
    for(const good of Object.keys(inputs(type))){const provider=producers.get(good);if(provider)visit(provider.type,provider.crop,score+12,`${city.buildingTypes[type]?.label||type} precisa de ${economy.goods[good]?.label||good}`,path);}
  }
  for(const d of economy.demands)if(d.score>=30&&(INDUSTRIES[d.type]||['bakery','mill'].includes(d.type)||d.type==='farm'&&d.crop==='trigo'))visit(d.type,d.crop,d.type==='farm'&&d.crop==='trigo'?240:Math.min(190,d.score),d.reason);
  // The first installation of each sector is an explicit development objective, independent of empty shelves.
  for(const type of Object.keys(INDUSTRIES))if(!['domestic_trader','import_exporter'].includes(type))visit(type,null,type==='bank'?320:type==='research_institute'?220:type==='newsroom'?210:rolloutPriority[type]||145,'Iniciar a primeira produção desta cadeia.');
  for(const crop of Object.keys(economy.crops))visit('farm',crop,crop==='trigo'?240:140,'Diversidade inicial das matérias-primas e da alimentação.');
  // Bread is a basic consumption need even before the first bakery has opened.
  if(city.citizens.some(c=>!c.entity.destroyed))visit('bakery',null,200,'Alimentação: pão e farinha precisam de lavouras de trigo.');
  for(const type of ['market','greengrocer'])visit(type,null,210,'Distribuição inicial: levar a produção agrícola ao comércio de alimentos.');
  if(city.citizens.length>=64)visit('office_tower',null,Math.max(185,economy.demands.find(d=>d.type==='office_tower')?.score||0),'Andares para sedes partidárias e atividades que precisam de empresarial.');
  for(const b of [...firms,...projects])for(const good of Object.keys(inputs(b.type))){const provider=producers.get(good);if(provider)visit(provider.type,provider.crop,150,`Abastecer ${city.buildingTypes[b.type]?.label||b.type}`);}
  const result=[];
  for(const [id,row]of rows){
    if(row.missing){since[id]??=city.minute;row.waitMinutes=city.minute-since[id];row.priority=row.score+Math.min(180,row.waitMinutes/60*3);}
    else{delete since[id];row.waitMinutes=0;row.priority=0;}
    row.blockedInputs=Object.keys(inputs(row.type)).filter(g=>{const p=producers.get(g);return p&&!exists(p.type,p.crop);});
    row.reason=row.origins.join(' · ');row.state=row.planned?'Materiais e construção em andamento':!row.missing?'Etapa já instalada':responses[id]?.state||'Aguardando investimento';
    if(row.planned){const project=projects.find(p=>p.id===row.projectId);row.response={state:responses[id]?.projectId===row.projectId?responses[id].state:row.state,projectId:row.projectId};if(project?.materialAccountId)row.response.state=project.inventory.pedra>=project.stone?'Materiais entregues; aguardando trabalho na obra.':'Materiais financiados; aguardando compra e transporte.';}
    else if(!row.missing){
      const sites=existingByType.get(key(row.type,row.type==='farm'?row.crop:null))||[];
      const hasCrew=sites.some(b=>b.workers.length||city.society.citizen(b.ownerId));
      const hasCapital=sites.some(b=>b.balance>=b.wage*60);
      const shortages=Object.keys(inputs(row.type)).filter(g=>!sites.some(b=>(b.inventory[g]||0)>=(inputs(row.type)[g]||1)));
      row.state=!hasCrew?'Etapa instalada; aguardando trabalhadores.':!hasCapital?'Etapa instalada; caixa insuficiente para salários e insumos.':shortages.length?`Etapa instalada; aguardando ${shortages.map(g=>economy.goods[g]?.label||g).join(', ')}.`:'Etapa instalada e com recursos para operar.';row.response={state:row.state};
    }else row.response=responses[id]||{state:row.state};result.push(row);
    const d=economy.demands.find(d=>key(d.type,d.crop)===id);
    if(d){d.chainReason=row.reason;d.response=row.response;if(row.missing){d.score=Math.max(d.score,Math.min(260,row.priority));d.reason=row.reason;}}
  }
  economy.productionPlan=result.sort((a,b)=>b.priority-a.priority||key(a.type,a.crop).localeCompare(key(b.type,b.crop)));
  economy.demands.sort((a,b)=>b.score-a.score);return economy.productionPlan;
}
function recordResponse(economy,row,state,extra={}){economy.productionResponses[key(row.type,row.crop)]={state,minute:economy.city.minute,...extra};row.response=economy.productionResponses[key(row.type,row.crop)];row.state=state;}
function fundProject(economy,project,capital,freight){
  const city=economy.city,id=`startup:${project.id}`,amount=Math.max(0,project.stone-(project.inventory.pedra||0)-(project.incoming.pedra||0))*economy.goods.pedra.price+capital+freight;
  city.accounts.set(id,{name:`Materiais e operação: ${city.buildingTypes[project.type].label}`,balance:0});
  if(!city.transfer(project.accountId,id,amount,'Reserva da cadeia produtiva',{projectId:project.id})){city.accounts.delete(id);return false;}
  project.materialAccountId=id;project.startupCapital=capital;project.productionChain=true;return true;
}
export function investProductionPlan(economy){
  const city=economy.city,plan=productionPlan(economy),needs=city.welfare.conditions(),active=city.development.projects.filter(pending);
  const pipelineLimit=Math.max(6,Math.min(12,Math.ceil(city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)).length/40)));
  city.bank.developmentBanks();
  const pipelineFull=active.filter(p=>p.productionChain).length>=pipelineLimit;
  // Reserve one extra slot for the first shared office building when a backed-up
  // production queue would otherwise prevent the service from ever starting.
  const officeException=pipelineFull&&plan.some(r=>r.type==='office_tower'&&r.missing&&!r.planned&&r.waitMinutes>=720);
  if(pipelineFull&&!officeException){for(const row of plan.filter(r=>r.missing&&!r.planned))recordResponse(economy,row,`Aguardando execução das ${pipelineLimit} obras de cadeias já financiadas.`);return false;}
  // Existing unfunded sites must progress before commissioning replacement factories.
  for(const row of plan.filter(r=>r.planned)){
    const project=active.find(p=>p.id===row.projectId);if(!project||project.materialAccountId||!['building'].includes(project.service))continue;
    const capital=startupCapital(city,economy,project.type),freight=city.currency.price(24000),amount=Math.max(0,project.stone-(project.inventory.pedra||0)-(project.incoming.pedra||0))*economy.goods.pedra.price+capital+freight,payer=city.accounts.get(project.accountId),reserve=project.accountId==='treasury'?needs.reserve:city.currency.price(15000);
    if(!payer)continue;
    let loan=null;if(payer.balance<amount+reserve&&payer.entity?.properties.citizen&&payer.creditAllowed!==false)for(const bank of city.bank.available()){loan=city.bank.lendForBusiness(bank,payer,amount+reserve-payer.balance,{type:project.type,crop:project.crop,initialChain:true,projectId:project.id,score:Math.max(60,row.score),budget:amount+reserve});if(loan)break;}
    if(payer.balance>=amount+reserve&&fundProject(economy,project,capital,freight)){project.priority=Math.max(project.priority||0,110);if(loan){loan.projectId=project.id;project.loanId=loan.id;}recordResponse(economy,row,'Obra pendente recuperada: materiais e operação financiados.',{projectId:project.id});return true;}
    if(loan)city.bank.cancelBusinessLoan(loan);recordResponse(economy,row,'Obra pendente aguardando crédito ou capital para materiais.',{projectId:project.id});
  }

  const rows=plan.filter(r=>r.missing&&!r.planned&&r.type!=='quarry'&&(!officeException||r.type==='office_tower'));
  city.development.ensurePlots();
  const adults=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c));
  // The government assigns initial ventures to capable residents, spreading ownership and keeping managers within a small portfolio.
  const managerLoad=c=>c.businessIds.length+active.filter(p=>p.ownerId===c.id).length;
  const founderPool=adults.filter(c=>!city.politics.officeHolder(c)&&managerLoad(c)<3&&c.creditAllowed!==false&&!city.bank.loans.some(l=>l.clientId===c.accountId&&l.purpose==='business'&&!['paid','written-off'].includes(l.status)));
  const batchLimit=3,assignedManagers=new Set();let opened=0;
  // Commission several distinct initial firms each investment cycle; later expansion remains demand driven.
  for(const row of rows){
    if(opened>=batchLimit||city.development.projects.filter(p=>pending(p)&&p.productionChain).length>=pipelineLimit+(officeException?1:0))break;
    if(OFFICE_ONLY_TYPES.has(row.type)){
      const towers=city.economy.businesses.filter(b=>b.type==='office_tower'&&b.municipal),vacant=towers.flatMap(tower=>officeFloors(city,tower).filter(f=>!f.tenantId&&f.units.length&&f.units.every(u=>u.forRent)).map(f=>({tower,floor:f})));
      const partyReserve=city.politics.parties.filter(p=>p.active&&p.headquarters?.kind!=='office').length,slot=vacant.length>partyReserve?vacant[0]:null,budget=city.currency.price(row.type==='bank'?2000000:100000),reserve=city.welfare.conditions().reserve;
      if(slot&&city.treasury>=reserve+budget){
        const office=createMunicipalOffice(city,slot.tower,slot.floor.floor,row.type,budget);
        if(office){recordResponse(economy,row,'Prefeitura instalou a atividade em um andar público disponível, preservando espaço para sedes partidárias.',{buildingId:office.id});city.log(`A prefeitura abriu ${city.buildingTypes[row.type].label} em um andar do empresarial municipal.`,'business',[],{kind:'municipal-office-opened',buildingId:office.id,towerId:slot.tower.id,floor:slot.floor.floor,type:row.type});opened++;continue;}
      }
      recordResponse(economy,row,'Aguardando andar municipal disponível e verba para capital inicial.');continue;
    }
    const upstreamMissing=row.blockedInputs.filter(g=>plan.some(p=>p.missing&&p.planned===0&&(p.type==='farm'?p.crop===g:INDUSTRIES[p.type]?.outputs[g]||p.type==='bakery'&&g==='pao'||p.type==='mill'&&g==='oleo')));
    if(upstreamMissing.length){recordResponse(economy,row,`Primeiro instalar fornecedores: ${upstreamMissing.map(g=>economy.goods[g].label).join(', ')}.`);continue;}
    if(['iron_mine','bauxite_mine'].includes(row.type))city.development.ensureQuarryPlot();
    const lots=city.development.plots.filter(p=>p.ownerId==='treasury'&&!p.buildingId&&!p.projectId&&(row.type==='farm'?city.development.isFarmPlot(p):p.width>=2&&p.depth>=2&&p.width<=8&&p.depth<=8&&(['iron_mine','bauxite_mine'].includes(row.type)?p.type==='quarry':!['farm','quarry'].includes(p.type)))).sort((a,b)=>a.price-b.price||a.id-b.id).slice(0,4);
    if(!lots.length){recordResponse(economy,row,row.type==='farm'?'Aguardando terreno fértil.':'Aguardando terreno urbano.');continue;}
    let selected,accessPending=false;
    for(const lot of lots){
      const width=row.type==='farm'?lot.width:Math.min(row.type==='office_tower'?2:3,lot.width),depth=row.type==='farm'?lot.depth:Math.min(row.type==='office_tower'?2:3,lot.depth),site=chooseBuildingSite(city,lot.x,lot.y,width,depth,{plotId:lot.id,type:row.type});if(site.error){accessPending ||= !!site.pending;continue;}
      const builder=row.type==='farm'?null:city.development.selectBuilder('treasury',site.door);if(row.type!=='farm'&&!builder)continue;
      selected={lot,width,depth,site,builder};break;
    }
    if(!selected){recordResponse(economy,row,accessPending?'Planejando acesso ao terreno.':'Aguardando terreno e construtora com acesso ao canteiro.');continue;}
    const {lot,width,depth,site,builder}=selected,floors=row.type==='office_tower'?3:businessFloors(row.type,lot.id),stone=row.type==='farm'?0:width*depth*floors*DEVELOPMENT_RULES.stonePerCell,fee=builder?width*depth*floors*city.currency.price(DEVELOPMENT_RULES.constructionFeePerCell):0,capital=startupCapital(city,economy,row.type),freight=city.currency.price(24000),privateBudget=lot.price+stone*economy.goods.pedra.price+fee+capital+freight+city.currency.price(20000);
    const managementSkill=({farm:'agriculture',...Object.fromEntries(Object.entries(INDUSTRIES).map(([type,spec])=>[type,spec.skill]))})[row.type]||'management';
    const founders=founderPool.filter(c=>!assignedManagers.has(c.id)&&managerLoad(c)<3&&!city.development.projects.some(p=>pending(p)&&p.ownerId===c.id)).sort((a,b)=>managerLoad(a)-managerLoad(b)||((b.skills.management||0)*.45+(b.skills[managementSkill]||0)*.55+(b.skills.governance||0)*.15)-((a.skills.management||0)*.45+(a.skills[managementSkill]||0)*.55+(a.skills.governance||0)*.15)||Number(!!a.jobId)-Number(!!b.jobId)||b.balance-a.balance||a.id-b.id).slice(0,16);
    let project=null;
    for(const founder of founders){
      let loan=null;const deficit=Math.max(0,privateBudget-founder.balance);
      if(deficit&&founder.creditAllowed!==false)for(const bank of city.bank.available()){loan=city.bank.lendForBusiness(bank,founder,deficit,{type:row.type,crop:row.crop,initialChain:true,score:Math.max(60,row.priority),budget:privateBudget});if(loan)break;}
      if(founder.balance<privateBudget){if(loan)city.bank.cancelBusinessLoan(loan);continue;}
      if(city.development.buyPlot(founder.accountId,lot.id))project=city.development.beginProject(founder.accountId,lot.id,row.type,{width,depth,crop:row.crop,floors,rotation:site.rotation,builderId:builder?.id,priority:Math.max(105,Math.min(250,row.priority))});
      if(project){if(project.status==='completed'){const b=city.buildings.find(b=>b.plotId===lot.id);if(b)city.transfer(founder.accountId,b.accountId,capital,'Capital da lavoura prioritária',{buildingId:b.id,projectId:project.id});}else{fundProject(economy,project,capital,freight);founder.startupProjectId=project.id;}if(loan){loan.projectId=project.id;project.loanId=loan.id;}break;}
      if(lot.ownerId===founder.accountId&&!lot.projectId&&city.transfer('treasury',founder.accountId,lot.price,'Estorno de terreno: cadeia não iniciada')){lot.ownerId='treasury';lot.forSale=true;}
      if(loan)city.bank.cancelBusinessLoan(loan);
    }
    if(!project){
      const cost=stone*economy.goods.pedra.price+Math.ceil(fee*DEVELOPMENT_RULES.municipalMultiplier)+capital+freight+city.currency.price(70000);
      const foodSafe=row.type==='farm'||row.type==='bakery'||needs.foodDays>=2||needs.hungry<Math.max(3,needs.population*.15);
      if(!foodSafe){recordResponse(economy,row,city.bank.lastBusinessRefusal?.reason||'Sem crédito privado; município preservando alimentação emergencial.');continue;}
      if(city.treasury<needs.reserve+cost){recordResponse(economy,row,city.bank.lastBusinessRefusal?.reason||'Aguardando banco com atendimento ou caixa municipal após reserva social.',{requiredBudget:cost});continue;}
      if(active.filter(p=>p.accountId==='treasury'&&p.productionChain).length>=2){recordResponse(economy,row,'Aguardando conclusão das etapas públicas já financiadas.');continue;}
      project=city.development.beginProject('treasury',lot.id,row.type,{width,depth,crop:row.crop,floors,rotation:site.rotation,builderId:builder?.id,priority:Math.max(105,Math.min(250,row.priority))});
      if(project&&project.status!=='completed')fundProject(economy,project,capital,freight);
    }
    if(project){project.productionChain=true;project.chainReason=row.reason;project.priority=Math.max(105,Math.min(250,row.priority));if(project.accountId!=='treasury')assignedManagers.add(project.ownerId);recordResponse(economy,row,'Governo destinou a abertura a um gestor com afinidade e capacidade: materiais, construção e capital financiados.',{projectId:project.id});city.log(`Demanda iniciou ${city.buildingTypes[row.type].label}${row.crop?' de '+economy.crops[row.crop].label:''}: ${row.reason}`,'business',[],{kind:'production-chain-funded',projectId:project.id,type:row.type,crop:row.crop,accounts:[project.accountId]});opened++;continue;}
    recordResponse(economy,row,'A contratação ainda não encontrou condições de execução.');
  }
  return opened>0;
}
