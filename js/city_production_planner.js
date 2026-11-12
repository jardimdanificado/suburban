import {businessFloors} from './city_business_heights.js';
import {INDUSTRIES} from './city_industries.js';
import {DEVELOPMENT_RULES} from './city_development.js?v=road-network-cache-1';
import {chooseBuildingSite} from './city_terrain.js?v=entrance-retaining-clearance-1';
import {OFFICE_ONLY_TYPES,officeSpaceDemand,officeFloors,createMunicipalOffice} from './city_offices.js?v=office-demand-rollout-1';
const key=(type,crop)=>`${type}:${crop||''}`;
const pending=p=>!p.cancelled&&p.status!=='completed';
const inputs=(type,economy)=>{
  if(type==='shipyard'){
    const firm=economy.businesses.find(b=>b.type==='shipyard'&&b.active&&!b.entity.destroyed);
    return (firm&&economy.city.vehicles?.recipeFor(firm)?.inputs)||INDUSTRIES.shipyard.inputs;
  }
  if(type==='tobacco_workshop'){
    const cannabisAllowed=economy.city.substances?.law('cannabis')?.regime!=='prohibited',tobaccoAllowed=economy.city.substances?.law('tabaco')?.regime!=='prohibited';
    const flowerReady=economy.businesses.some(b=>(b.inventory.flor_cannabis||0)>=2),tobaccoReady=economy.businesses.some(b=>(b.inventory.folha_tabaco||0)>=6);
    return cannabisAllowed&&(!tobaccoAllowed||flowerReady&&!tobaccoReady)?{flor_cannabis:2,papel:1}:{folha_tabaco:6,papel:1};
  }
  return type==='bakery'?{trigo:2}:type==='mill'?{girassol:1}:INDUSTRIES[type]?.inputs||{};
};
const vehicleFactories=new Set(['bearing_factory','frame_factory','deck_factory','tire_factory','chain_factory','safety_equipment','saddle_factory','cycle_assembler','ropeworks','sailmaker','marine_fittings','marine_lumberyard','mast_factory','shipyard']);
const productionPlanCache=new WeakMap();
const startupCapital=(city,economy,type)=>type==='cycle_shop'
  ? Math.ceil(['bicicleta','bicicleta_carga','patins','skate'].reduce((n,g)=>n+economy.goods[g].price,0)*3)+city.currency.price(100000)
  : type==='boat_shop'?Math.ceil(['canoe','launch','ferry','cargo'].reduce((n,g)=>n+economy.goods[g].price,0))+city.currency.price(100000)
  : type==='bicycle_rental'?Math.ceil(economy.goods.bicicleta.price*3)+city.currency.price(100000)
  : city.currency.price(type==='bank'?2000000:type==='research_institute'?100000:['cycle_assembler','shipyard'].includes(type)?600000:vehicleFactories.has(type)?180000:({market:200000,greengrocer:75000,bakery:60000,restaurant:75000}[type]||60000));
/** Demand follows recipes before factories exist, preventing empty chains from remaining invisible. */
export function productionPlan(economy){
  const city=economy.city,firms=economy.businesses,projects=city.development.projects.filter(pending),rows=new Map(),since=economy.productionWaitSince??={},responses=economy.productionResponses??={};
  const firmSignature=firms.map(b=>`${b.id}:${b.type}:${b.crop||''}`).join('|'),projectSignature=projects.map(p=>`${p.id}:${p.type}:${p.crop||''}:${p.status}:${p.cancelled?1:0}:${p.productionChain?1:0}:${p.materialAccountId||''}:${p.inventory?.pedra||0}:${p.incoming?.pedra||0}`).join('|'),demandSignature=economy.demands.map(d=>`${d.type}:${d.crop||''}:${d.score}:${d.required||0}:${d.supply||0}:${d.reason||''}`).join('|'),cached=productionPlanCache.get(economy);
  if(cached&&cached.demands===economy.demands&&cached.minute===city.minute&&cached.structureRevision===city.structureRevision&&cached.firmSignature===firmSignature&&cached.projectSignature===projectSignature&&cached.demandSignature===demandSignature){if(city.profileDiagnostics&&economy.lastInvestmentSearchProfile)economy.lastInvestmentSearchProfile.productionPlanCacheHits=(economy.lastInvestmentSearchProfile.productionPlanCacheHits||0)+1;return cached.plan;}
  const producers=new Map();
  const hempAllowed=city.substances?.law('canhamo')?.regime!=='prohibited';
  for(const [type,spec]of Object.entries(INDUSTRIES))if(type!=='hemp_weaver'||hempAllowed)for(const good of Object.keys(spec.outputs))if(!producers.has(good))producers.set(good,{type,crop:null});
  for(const good of Object.keys(economy.crops))producers.set(good,{type:'farm',crop:good});
  producers.set('canhamo',{type:'farm',crop:'flor_cannabis'});
  // Prefer an installed supplier over the first recipe listed in the catalog.
  for(const b of firms)if(b.type!=='hemp_weaver'||hempAllowed)for(const good of Object.keys(INDUSTRIES[b.type]?.outputs||{}))producers.set(good,{type:b.type,crop:null});
  producers.set('pao',{type:'bakery',crop:null});producers.set('oleo',{type:'mill',crop:null});producers.set('pedra',{type:'quarry',crop:null});
  const existingByType=new Map(),plannedByType=new Map();
  for(const b of firms){const id=key(b.type,b.type==='farm'?b.crop:null);let sites=existingByType.get(id);if(!sites)existingByType.set(id,sites=[]);sites.push(b);}
  for(const p of projects){const id=key(p.type,p.type==='farm'?p.crop:null);let sites=plannedByType.get(id);if(!sites)plannedByType.set(id,sites=[]);sites.push(p);}
  const exists=(type,crop)=>existingByType.get(key(type,type==='farm'?crop:null))?.length||0;
  const planned=(type,crop)=>plannedByType.get(key(type,type==='farm'?crop:null))||[];
  // The recipe graph is normally acyclic. Keep the original trail-sensitive
  // traversal for cyclic recipes; score dominance is safe only in a DAG.
  const states=new Map();let acyclic=true;
  function inspect(type){if(states.get(type)===1){acyclic=false;return;}if(states.get(type)===2)return;states.set(type,1);for(const good of Object.keys(inputs(type,economy))){const provider=producers.get(good);if(provider)inspect(provider.type);}states.set(type,2);}
  for(const type of [...Object.keys(INDUSTRIES),'bakery','mill'])inspect(type);
  const expandedScores=new Map();let officeMissing;
  function visit(type,crop,score,origin,trail=new Set()){
    if(type==='coca_laboratory'&&city.substances?.law('coca')?.regime==='prohibited'||type==='hemp_weaver'&&city.substances?.law('canhamo')?.regime==='prohibited')return;
    const substance=type==='farm'?economy.crops[crop]?.substance:['distillery','brewery','winery','tequila_distillery'].includes(type)?'alcool':type==='coffee_roaster'?'cafe':null;if(substance&&city.substances?.law(substance)?.regime==='prohibited'&&!(crop==='flor_cannabis'&&city.substances?.law('canhamo')?.regime!=='prohibited'))return;
    const id=key(type,crop);if(!acyclic&&trail.has(id))return;
    const current=exists(type,crop),building=planned(type,crop),target=type==='research_institute'?city.politics.getResearch().demand().required:1;
    const absent=type==='office_tower'?(officeMissing??=officeSpaceDemand(city).missing>0):current+building.length<target;
    const row=rows.get(id)||{type,crop,origins:[],missing:absent,current,planned:building.length,projectId:building[0]?.id,score:0};
    if(!row.origins.includes(origin))row.origins.push(origin);row.score=Math.max(row.score,score);rows.set(id,row);
    if(acyclic&&(expandedScores.get(id)??-Infinity)>=score)return;
    expandedScores.set(id,score);
    const path=acyclic?trail:new Set(trail);if(!acyclic)path.add(id);
    // Both established and planned consumers create demand for the earlier stages.
    for(const good of Object.keys(inputs(type,economy))){const provider=producers.get(good);if(provider)visit(provider.type,provider.crop,score+12,`${city.buildingTypes[type]?.label||type} precisa de ${economy.goods[good]?.label||good}`,path);}
  }
  // Retail food distribution is a production-chain endpoint even though it
  // does not have an INDUSTRIES recipe. Keep its demand visible to the same
  // investment queue so food shops can be financed before optional industry.
  for(const d of economy.demands)if((d.score>=30||d.type==='tobacco_workshop'&&d.score>0&&city.substances?.law('cannabis')?.regime!=='prohibited')&&(INDUSTRIES[d.type]||['bakery','mill','market','greengrocer','restaurant'].includes(d.type)||d.type==='farm'))visit(d.type,d.crop,d.type==='farm'&&d.crop==='trigo'?240:Math.min(190,Math.max(d.score,d.type==='tobacco_workshop'?30:0)),d.reason);
  // Seed production only where the measured demand above needs another firm.
  // Opening every industry and crop at once created unsupported companies,
  // stranded inventory, and a construction queue sized for a much larger city.
  if(city.citizens.length>=64)visit('office_tower',null,Math.max(185,economy.demands.find(d=>d.type==='office_tower')?.score||0),'Andares para sedes partidárias e atividades que precisam de empresarial.');
  // Expand suppliers only when a live firm is actually short on an input.
  // Looking at every recipe entry also opened factories for stocked or idle
  // businesses, creating debt and inventory with no near-term use.
  for(const b of firms)for(const [good,amount] of Object.entries(b.inputDemand||{}))if(amount>0){const provider=producers.get(good);if(provider)visit(provider.type,provider.crop,150,`Abastecer ${city.buildingTypes[b.type]?.label||b.type}`);}
  const result=[];
  for(const [id,row]of rows){
    if(row.missing){since[id]??=city.minute;row.waitMinutes=city.minute-since[id];row.priority=row.score+Math.min(180,row.waitMinutes/60*3);}
    else{delete since[id];row.waitMinutes=0;row.priority=0;}
    row.blockedInputs=Object.keys(inputs(row.type,economy)).filter(g=>{const p=producers.get(g);return p&&!exists(p.type,p.crop);});
    row.reason=row.origins.join(' · ');row.state=row.planned?'Materiais e construção em andamento':!row.missing?'Etapa já instalada':responses[id]?.state||'Aguardando investimento';
    if(row.planned){const project=projects.find(p=>p.id===row.projectId);row.response={state:responses[id]?.projectId===row.projectId?responses[id].state:row.state,projectId:row.projectId};if(project?.materialAccountId)row.response.state=project.inventory.pedra>=project.stone?'Materiais entregues; aguardando trabalho na obra.':'Materiais financiados; aguardando compra e transporte.';}
    else if(!row.missing){
      const sites=existingByType.get(key(row.type,row.type==='farm'?row.crop:null))||[];
      const hasCrew=sites.some(b=>b.workers.length||city.society.citizen(b.ownerId));
      const hasCapital=sites.some(b=>b.balance>=b.wage*60);
      const shortages=Object.keys(inputs(row.type,economy)).filter(g=>!sites.some(b=>(b.inventory[g]||0)>=(inputs(row.type,economy)[g]||1)));
      row.state=!hasCrew?'Etapa instalada; aguardando trabalhadores.':!hasCapital?'Etapa instalada; caixa insuficiente para salários e insumos.':shortages.length?`Etapa instalada; aguardando ${shortages.map(g=>economy.goods[g]?.label||g).join(', ')}.`:'Etapa instalada e com recursos para operar.';row.response={state:row.state};
    }else row.response=responses[id]||{state:row.state};result.push(row);
    const d=economy.demands.find(d=>key(d.type,d.crop)===id);
    if(d){d.chainReason=row.reason;d.response=row.response;if(row.missing){d.score=Math.max(d.score,Math.min(260,row.priority));d.reason=row.reason;}}
  }
  economy.productionPlan=result.sort((a,b)=>b.priority-a.priority||key(a.type,a.crop).localeCompare(key(b.type,b.crop)));
  economy.demands.sort((a,b)=>b.score-a.score);
  productionPlanCache.set(economy,{demands:economy.demands,minute:city.minute,structureRevision:city.structureRevision,firmSignature,projectSignature,demandSignature:resultDemandSignature(economy.demands),plan:economy.productionPlan});
  return economy.productionPlan;
}
function resultDemandSignature(demands){return demands.map(d=>`${d.type}:${d.crop||''}:${d.score}:${d.required||0}:${d.supply||0}:${d.reason||''}`).join('|');}
function recordResponse(economy,row,state,extra={}){economy.productionResponses[key(row.type,row.crop)]={state,minute:economy.city.minute,...extra};row.response=economy.productionResponses[key(row.type,row.crop)];row.state=state;}
function fundProject(economy,project,capital,freight){
  const city=economy.city,id=`startup:${project.id}`,amount=Math.max(0,project.stone-(project.inventory.pedra||0)-(project.incoming.pedra||0))*economy.goods.pedra.price+capital+freight;
  city.accounts.set(id,{name:`Materiais e operação: ${city.buildingTypes[project.type].label}`,balance:0});
  if(!city.transfer(project.accountId,id,amount,'Reserva da cadeia produtiva',{projectId:project.id})){city.accounts.delete(id);return false;}
  project.materialAccountId=id;project.startupCapital=capital;project.productionChain=true;return true;
}
export function investProductionPlan(economy){
  const city=economy.city,detail=city.profileDiagnostics?{}:null;let stage='productionPlan',stageAt=detail?performance.now():0;
  const markStage=name=>{if(!detail)return;const now=performance.now();detail[`${stage}Ms`]=now-stageAt;stage=name;stageAt=now;};
  if(detail&&economy.lastInvestmentSearchProfile)economy.lastInvestmentSearchProfile.productionDetail=detail;
  const plan=productionPlan(economy);markStage('needsAndProjects');
  const needs=city.welfare.conditions(),active=city.development.projects.filter(pending),productionProjects=active.filter(p=>p.productionChain);
  const adultCount=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)).length;
  // Keep construction exposure proportional to the available workforce. A
  // six-project minimum let a 48-person town borrow and fund more new firms
  // than it could staff or supply at once.
  const pipelineLimit=Math.max(2,Math.min(8,Math.ceil(adultCount/80)));
  city.bank.developmentBanks();
  const pipelineFull=productionProjects.length>=pipelineLimit;
  // Reserve one extra slot for the first shared office building when a backed-up
  // production queue would otherwise prevent the service from ever starting.
  const officeException=pipelineFull&&plan.some(r=>r.type==='office_tower'&&r.missing&&!r.planned&&r.waitMinutes>=720);
  markStage('pendingProjects');
  // Existing unfunded sites must progress before commissioning replacement factories.
  for(const row of plan.filter(r=>r.planned)){
    const project=active.find(p=>p.id===row.projectId);if(!project||project.materialAccountId||!['building'].includes(project.service))continue;
    const capital=startupCapital(city,economy,project.type),freight=city.currency.price(24000),amount=Math.max(0,project.stone-(project.inventory.pedra||0)-(project.incoming.pedra||0))*economy.goods.pedra.price+capital+freight,payer=city.accounts.get(project.accountId),reserve=project.accountId==='treasury'?needs.reserve:city.currency.price(15000);
    if(!payer)continue;
    let loan=null;if(payer.balance<amount+reserve&&payer.entity?.properties.citizen&&payer.creditAllowed!==false)for(const bank of city.bank.available()){loan=city.bank.lendForBusiness(bank,payer,amount+reserve-payer.balance,{type:project.type,crop:project.crop,initialChain:true,projectId:project.id,score:Math.max(60,row.score),budget:amount+reserve});if(loan)break;}
    if(payer.balance>=amount+reserve&&fundProject(economy,project,capital,freight)){project.priority=Math.max(project.priority||0,110);if(loan){loan.projectId=project.id;project.loanId=loan.id;}recordResponse(economy,row,'Obra pendente recuperada: materiais e operação financiados.',{projectId:project.id});return true;}
    if(loan)city.bank.cancelBusinessLoan(loan);recordResponse(economy,row,'Obra pendente aguardando crédito ou capital para materiais.',{projectId:project.id});
  }


  markStage('chainPriority');
  const rows=plan.filter(r=>r.missing&&!r.planned&&r.type!=='quarry'&&(!officeException||r.type==='office_tower'||r.type==='farm'));
  const missingUpstreamGoods=new Set();
  for(const candidate of plan)if(candidate.missing&&candidate.planned===0){if(candidate.type==='farm'){missingUpstreamGoods.add(candidate.crop);if(candidate.crop==='flor_cannabis')missingUpstreamGoods.add('canhamo');}else if(candidate.type==='bakery')missingUpstreamGoods.add('pao');else if(candidate.type==='mill')missingUpstreamGoods.add('oleo');else for(const good of Object.keys(INDUSTRIES[candidate.type]?.outputs||{}))missingUpstreamGoods.add(good);}
  // Finish chains with crops already harvested before opening unrelated
  // upstream industries. Carry this priority through their missing suppliers.
  const suppliers=new Map(),harvestChains=new Set();
  for(const row of plan){const outputs=row.type==='farm'?[row.crop,...(row.crop==='flor_cannabis'?['canhamo']:[])]:Object.keys(INDUSTRIES[row.type]?.outputs||{});for(const good of outputs)if(!suppliers.has(good))suppliers.set(good,row);}
  const markHarvestChain=row=>{if(!row||harvestChains.has(row))return;harvestChains.add(row);for(const good of row.blockedInputs)markHarvestChain(suppliers.get(good));};
  const harvested=new Map();for(const farm of economy.businesses.filter(b=>b.type==='farm'))harvested.set(farm.crop,(harvested.get(farm.crop)||0)+(farm.inventory[farm.crop]||0));
  for(const row of plan)if(row.missing&&Object.entries(inputs(row.type,economy)).some(([good,q])=>(harvested.get(good)||0)>=q))markHarvestChain(row);
  rows.sort((a,b)=>Number(harvestChains.has(b))-Number(harvestChains.has(a))||b.priority-a.priority);
  city.development.ensurePlots();
  markStage('founderPool');
  const adults=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c));
  // The government assigns initial ventures to capable residents, spreading ownership and keeping managers within a small portfolio.
  const projectsByOwner=new Map(),projectOwners=new Set(),businessLoanClients=new Set();
  for(const project of active)if(project.ownerId!=null){projectsByOwner.set(project.ownerId,(projectsByOwner.get(project.ownerId)||0)+1);projectOwners.add(project.ownerId);}
  for(const loan of city.bank.loans)if(loan.purpose==='business'&&!['paid','written-off'].includes(loan.status))businessLoanClients.add(loan.clientId);
  const managerLoad=c=>c.businessIds.length+(projectsByOwner.get(c.id)||0);
  const founderPool=adults.filter(c=>!city.politics.officeHolder(c)&&managerLoad(c)<3&&c.creditAllowed!==false&&!businessLoanClients.has(c.accountId)&&!projectOwners.has(c.id)).map(c=>({citizen:c,load:managerLoad(c)}));
  markStage('siteAndFounders');
  const batchLimit=1,assignedManagers=new Set();let opened=0;
  const lotPools=new Map(),lotsFor=row=>{
    const kind=row.type==='farm'?'farm':['iron_mine','bauxite_mine'].includes(row.type)?'quarry':'urban';
    let lots=lotPools.get(kind);if(lots)return lots;
    lots=city.development.plots.filter(p=>p.ownerId==='treasury'&&!p.buildingId&&!p.projectId&&(kind==='farm'?city.development.isFarmPlot(p):p.width>=2&&p.depth>=2&&p.width<=8&&p.depth<=8&&(kind==='quarry'?p.type==='quarry':!['farm','quarry'].includes(p.type)))).sort((a,b)=>a.price-b.price||a.id-b.id).slice(0,4);
    lotPools.set(kind,lots);return lots;
  };
  // Commission several distinct initial firms each investment cycle; later expansion remains demand driven.
  for(const row of rows){
    if(opened>=batchLimit)break;
    // Open-air fields finish immediately and use no masonry construction slot.
    if(row.type!=='farm'&&productionProjects.length>=pipelineLimit+(officeException?1:0)){recordResponse(economy,row,`Aguardando execução das ${pipelineLimit} obras de cadeias já financiadas.`);continue;}
    if(OFFICE_ONLY_TYPES.has(row.type)){
      const towers=city.economy.businesses.filter(b=>b.type==='office_tower'&&b.municipal),vacant=towers.flatMap(tower=>officeFloors(city,tower).filter(f=>!f.tenantId&&f.units.length&&f.units.every(u=>u.forRent)).map(f=>({tower,floor:f})));
      const partyReserve=city.politics.parties.filter(p=>p.active&&p.headquarters?.kind!=='office').length,slot=vacant.length>partyReserve?vacant[0]:null,budget=city.currency.price(row.type==='bank'?2000000:100000),reserve=city.welfare.conditions().reserve;
      if(slot&&city.treasury>=reserve+budget){
        const office=createMunicipalOffice(city,slot.tower,slot.floor.floor,row.type,budget);
        if(office){recordResponse(economy,row,'Prefeitura instalou a atividade em um andar público disponível, preservando espaço para sedes partidárias.',{buildingId:office.id});city.log(`A prefeitura abriu ${city.buildingTypes[row.type].label} em um andar do empresarial municipal.`,'business',[],{kind:'municipal-office-opened',buildingId:office.id,towerId:slot.tower.id,floor:slot.floor.floor,type:row.type});opened++;continue;}
      }
      recordResponse(economy,row,'Aguardando andar municipal disponível e verba para capital inicial.');continue;
    }
    const upstreamMissing=row.blockedInputs.filter(g=>missingUpstreamGoods.has(g));
    if(upstreamMissing.length){recordResponse(economy,row,`Primeiro instalar fornecedores: ${upstreamMissing.map(g=>economy.goods[g].label).join(', ')}.`);continue;}
    if(['iron_mine','bauxite_mine'].includes(row.type))city.development.ensureQuarryPlot();
    const lots=lotsFor(row);
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
    const founders=founderPool.filter(row=>!assignedManagers.has(row.citizen.id)).map(row=>({...row,aptitude:(row.citizen.skills.management||0)*.45+(row.citizen.skills[managementSkill]||0)*.55+(row.citizen.skills.governance||0)*.15})).sort((a,b)=>a.load-b.load||b.aptitude-a.aptitude||Number(!!a.citizen.jobId)-Number(!!b.citizen.jobId)||b.citizen.balance-a.citizen.balance||a.citizen.id-b.citizen.id).slice(0,16).map(row=>row.citizen);
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
  markStage('complete');
  return opened>0;
}
