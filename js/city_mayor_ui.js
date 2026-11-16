import {mayorDecisions,mayorOrder,renderMayorChallenges,renderMayorElection,MAYOR_DESKS} from './city_mayor_play.js';
import {OFFICE_ONLY_TYPES} from './city_offices.js?v=office-demand-rollout-1';
import {publicProjects,municipalFirmType,municipalOfficeVacancies} from './city_mayor_campaign.js';
import {describePromise} from './city_mandates.js';
import {formatMoney as money} from './city_ui_format.js';
import {SECRETARIATS,SECRETARY_ELECTION_MODES,TRANSPORT_POLICIES} from './city_secretariats.js';
import {TAX_CATEGORIES,baseTaxRate,taxRate,MINIMUM_WAGE_TAX_RATE,MINIMUM_BUSINESS_TAX_RATE} from './city_sales_tax.js';
import {ECONOMIC_POLICIES,economicPolicy} from './city_economic_policies.js';
import {equityShares,privatizationQuota} from './city_equity.js?v=daily-mayor-privatization-2';
import {PARTY_FLAG_BACKGROUNDS} from './city_party_flags.js';
import {PREJUDICE_TYPES} from './city_prejudice.js?v=discrimination-laws-1';
import {CRIME_TYPES} from './city_justice.js?v=citizen-access-1';
import {canFarmVertically} from './city_farm_layout.js';
const day = minute => `dia ${Math.floor(minute/1440)+1}`;
const names = {build:'Obra',priority:'Prioridade',fund:'Custeio',service:'Serviço',bill:'Proposta',decree:'Decreto',appoint:'Nomeação',dismiss:'Exoneração',nationalize:'Estatização',privatize:'Privatização',road:'Acesso viário',expand:'Ampliação',lighting:'Iluminação pública',restock:'Alimentos públicos',firm:'Empresa municipal',office:'Andar municipal',housing:'Habitação social',paving:'Pavimentação',roadRepair:'Conservação viária',maintain:'Manutenção predial',offerShares:'Oferta de participações',dividend:'Resultado de estatal',marketRecovery:'Recuperação de mercado',rentVoucher:'Vale-aluguel',housingCredit:'Crédito habitacional',equityLoan:'Crédito de participação',rally:'Bandeiraço',sanction:'Sanção',veto:'Veto',start:'Início'};
const tabs=[['agenda','SITUAÇÃO'],['build','OBRAS'],['operations','CUSTEIO'],['cabinet','GABINETE'],['policies','POLÍTICAS'],['council','CÂMARA'],['orders','ORDENS']];
const billStates={'awaiting-secretary-review':'Decreto em análise','superseded':'Substituído','awaiting-session':'Aguardando plenário',dismissed:'Arquivado','awaiting-sanction':'Aguardando sanção',vetoed:'Vetado','veto-maintained':'Veto mantido',proposed:'Em discussão',approved:'Aprovado',executing:'Em execução',executed:'Executado',rejected:'Rejeitado'};
function pager(ui,p,rows,key,size=6){
  if(rows.length<=size)return rows;
  const page=Math.min(ui[key]||0,Math.max(0,Math.ceil(rows.length/size)-1));
  p.buttons([{label:'ANTERIORES',click:()=>{ui[key]=Math.max(0,page-1);}},{label:'PRÓXIMAS',click:()=>{ui[key]=page+1;}}]);
  return rows.slice(page*size,page*size+size);
}
const policyValue=(spec,value)=>{if(typeof spec.default==='boolean')return value?'Ativada':'Desativada';return spec.step<1?`${(Number(value)*100).toFixed(1)}%`:String(Math.round(Number(value)));};
export function renderMayorCampaign(ui,p) {
  const city=ui.city,s=city.mayorCampaign,gov=city.politics;
  const act=(action,options={})=>mayorOrder(ui,action,options);
  if(!ui.mayorDesk)p.heading('MODO PREFEITO · GOVERNO INDIRETO');
  if(!s){
    const mayor=city.society.citizen(city.economy.mayorId),party=gov.party(mayor?.political?.partyId);
    p.note('Assuma a prefeitura atual. Nomeie secretários, emita decretos, proponha leis, contraia obras e serviços; cidadãos e empresas executam o trabalho real.');
    p.kv('Prefeito',mayor?.entity.properties.name||'Aguardando posse');
    p.kv('Seu partido',party?.name||'Aguardando filiação');
    p.note('Mantenha este partido na prefeitura. A troca por outro partido, inclusive por sucessão ou afastamento, encerra a campanha.');
    p.note('A agenda automática de governo e a expansão pública automática cedem as escolhas ao jogador. Serviços correntes, empresas privadas, Câmara e eleições continuam funcionando.');
    p.note('Não há capital extra. Obras usam a verba aprovada; serviços, custeio e ligações viárias usam o tesouro. A escolha do terreno segue o planejamento existente.');
    p.button('ASSUMIR A PREFEITURA',()=>act('start'));
    return;
  }
  if(!ui.mayorDesk){p.kv('Partido da campanha',s.partyName);p.kv('Prefeito em exercício',city.society.citizen(city.economy.mayorId)?.entity.properties.name||'Sucessão em andamento');}
  if(s.status==='defeated'){
    p.status('DERROTA',s.reason);
    p.note(`Campanha de ${day(s.startedAt)} até ${day(s.endedAt)}. A simulação para ao perder a prefeitura.`);
    if(s.mode==='play')p.button('ENCERRAR CAMPANHA E OBSERVAR A CIDADE',()=>act('observe'));
    else p.note('Campanha encerrada. A cidade voltou à simulação autônoma. Crie outra cidade para jogar novamente.');
    return;
  }
  if(s.mode!=='play'){p.note('Campanha encerrada pelo jogador. A cidade voltou à simulação autônoma.');return;}
  const view=ui.mayorView||'agenda';
  if(ui.mayorDesk){
    p.heading(MAYOR_DESKS[view]||'Prefeitura');
    p.note(`Tesouro ${money(city.treasury)} · obras ${money(gov.ensureWorksBudget())}`);
  }else{
    p.status('MANTENHA O PARTIDO NO PODER',`Avaliação ${Math.round(gov.approval)}/100 · votação ${gov.nextElectionAt==null?'sem data':day(gov.nextElectionAt)}`);
    p.links(tabs.map(([id,label])=>({label,selected:view===id,click:()=>{if(ui.host?.openMayorDesk)ui.host.openMayorDesk(id);else{ui.mayorView=id;ui.resetScroll();}}})));
  }
  if(view==='challenges'){renderMayorChallenges(ui,p);
  }else if(view==='campaign'){renderMayorElection(ui,p);
  }else if(view==='agenda'){
    p.note('Clique nos imóveis e moradores do mapa para dar ordens no local. Feche as janelas para acompanhar a cidade.');
    p.buttons([{label:'VOLTAR AO MAPA',click:()=>{if(ui.host){ui.host.hidden=true;ui.host.element.hidden=true;}}},{label:'ACOMPANHAR OBRAS',click:()=>ui.host?.openMayorDesk('build','queue')}]);
    p.buttons([{label:'CÂMARA E ORÇAMENTO',click:()=>ui.host?.openMayorDesk('council')},{label:'HISTÓRICO DE ORDENS',click:()=>ui.host?.openMayorDesk('orders')}]);
    p.buttons([{label:'COMPROMISSOS PÚBLICOS',click:()=>ui.host?.openMayorDesk('challenges')},{label:'ORGANIZAR CAMPANHA',click:()=>ui.host?.openMayorDesk('campaign')}]);
    p.heading('DECISÕES PENDENTES');
    const tasks=mayorDecisions(city);
    if(!tasks.length)p.note('Nenhuma decisão urgente. Acompanhe as obras e prepare a próxima eleição.');
    for(const task of pager(ui,p,tasks,'mayorDecisionPage',4)){
      p.status(task.title,task.text);
      if(task.billId!=null)p.buttons([{label:'SANCIONAR',click:()=>act('sanction',{billId:task.billId})},{label:'VETAR',click:()=>act('veto',{billId:task.billId})}]);
      else if(task.target)p.button('VER GARGALO',()=>ui.host?.openMayorTarget(task.target));
      else{
        if(task.action)p.button(task.label,()=>act(task.action));
        p.button('ANALISAR',()=>ui.host?.openMayorDesk(task.desk,task.section));
      }
    }
    p.heading('COMPROMISSOS DO MANDATO');
    for(const promise of gov.mandates.current?.promises||[])p.note(describePromise(promise));
    p.windowLink('AVALIAÇÃO DO GOVERNO',()=>ui.openPanel({tab:'government',views:{government:'elections'},politicsTab:'approval'}));
    p.windowLink('CAMPANHA E ELEIÇÕES',()=>ui.openPanel({tab:'government',views:{government:'elections'},politicsTab:'campaign'}));
    p.windowLink('PRODUÇÃO E ABASTECIMENTO',()=>ui.openPanel({tab:'production'}));
    p.button('ENCERRAR CAMPANHA E VOLTAR À SIMULAÇÃO',()=>act('observe'));
  }else if(view==='build'){
    const choices=[['new', 'Nova obra'], ['queue', 'Acompanhar e priorizar obras'], ['access', 'Ligar imóvel à malha viária'], ['expand', 'Ampliar imóveis públicos'], ['firm', 'Abrir empresa municipal'], ['offices', 'Ocupar andar empresarial'], ['programs', 'Habitação, vias e iluminação']];
    const section=choices.some(([id])=>id===ui.mayorSection)?ui.mayorSection:'new';
    ui.selectControl(p,'Escolher tarefa de obras',choices,section,value=>{ui.mayorSection=value;});

    if(section==='new'){
    const types=Object.entries(city.buildingTypes).filter(([id])=>!['townhall','mint','council_chamber'].includes(id)&&!OFFICE_ONLY_TYPES.has(id));
    const type=ui.mayorBuildingType||'popular_housing',crop=ui.mayorCrop||'milho',vertical=type==='farm'&&ui.mayorVertical===true&&canFarmVertically(crop),floors=ui.mayorFloors||3;
    ui.selectControl(p,'mayor-building',types.map(([id,spec])=>[id,spec.label]),type,value=>{ui.mayorBuildingType=value;});
    if(type==='farm'){
      ui.selectControl(p,'mayor-crop',Object.entries(city.economy.crops).map(([id,spec])=>[id,spec.label]),crop,value=>{ui.mayorCrop=value;});
      if(canFarmVertically(crop)){
        p.kv('Fazenda vertical',`${vertical?`${floors} andares`:'desativada'} · culturas sem árvores`);
        p.buttons([{label:'AO AR LIVRE',selected:!vertical,click:()=>{ui.mayorVertical=false;}},{label:'VERTICAL',selected:vertical,click:()=>{ui.mayorVertical=true;}}]);
        if(vertical)p.buttons([{label:'ANDAR −',click:()=>{ui.mayorFloors=Math.max(2,floors-1);}},{label:'ANDAR +',click:()=>{ui.mayorFloors=Math.min(8,floors+1);}}]);
      }else p.note('Árvores e palmeiras exigem uma fazenda ao ar livre.');
    }
    p.button('ESCOLHER TERRENO NO MAPA',()=>ui.host?.armMayorPlot({type,crop,...(vertical?{vertical:true,floors}: {})}));
    p.button('CONTRATAR EM LOCAL AUTOMÁTICO',()=>act('build',{type,crop,...(vertical?{vertical:true,floors}: {})}));
    p.note('O município procura terreno acessível. A contratação pode aguardar caixa, construtora ou terreno. Materiais e trabalho não são instantâneos.');
    }
    if(section==='queue'){
    p.heading('FILA DE OBRAS PÚBLICAS');
    const projects=publicProjects(city),page=Math.min(ui.mayorWorkPage||0,Math.max(0,Math.ceil(projects.length/8)-1));
    if(projects.length>8)p.buttons([{label:'ANTERIORES',click:()=>{ui.mayorWorkPage=Math.max(0,page-1);}},{label:'PRÓXIMAS',click:()=>{ui.mayorWorkPage=page+1;}}]);
    for(const project of projects.slice(page*8,page*8+8)){
      p.record(`#${project.id} · ${project.name||city.buildingTypes[project.type]?.label||project.service}`,`${project.status} · prioridade ${project.priority||0} · pedra ${project.inventory?.pedra||0}/${project.stone||0} · trabalho ${Math.floor(project.labor||0)}/${project.requiredLabor||0}`,()=>ui.host?.openMayorTarget({kind:'project',id:project.id}));
      p.buttons([[10,'BAIXA'],[100,'NORMAL'],[200,'URGENTE']].map(([value,label])=>({label,selected:project.priority===value,click:()=>act('priority',{projectId:project.id,value})})));
    }
    if(!projects.length)p.note('Nenhuma obra pública pendente.');
    }
    if(section==='access'){
    p.heading('ACESSO VIÁRIO');
    p.note('Contrate a pavimentação até a prefeitura com o tesouro. A obra exige pedra, trabalho e rota real; preserva a reserva municipal.');
    const canCheckAccess=typeof city.world?.getTile==='function';
    const detached=canCheckAccess?city.buildings.filter(b=>!b.entity.destroyed&&b.id!==city.townhall()?.id&&!gov.roadConnected(b)&&ui.matches(b.entity.properties.name)):[];
    for(const b of pager(ui,p,detached,'mayorAccessPage',5)){
      p.record(b.entity.properties.name,`${city.buildingTypes[b.type]?.label||b.type} · sem acesso pavimentado`);
      p.button('CONTRATAR ACESSO',()=>act('road',{buildingId:b.id}));
    }
    if(!detached.length)p.note(canCheckAccess?'Todos os imóveis cadastrados já têm acesso pavimentado.':'Consulta de acesso indisponível neste estado da cidade.');
    }
    if(section==='expand'){
    p.heading('AMPLIAÇÃO');
    const hall=city.townhall();
    if(hall)p.record(hall.entity.properties.name,`${hall.floors} pavimentos · ampliação direta`,()=>ui.openBuilding(hall.id));
    if(hall)p.button('AMPLIAR PREFEITURA (+1 ANDAR)',()=>act('expand',{buildingId:hall.id,floors:1}));
    const homes=city.buildings.filter(b=>!b.entity.destroyed&&['super_popular_housing','popular_housing','popular_luxury_housing'].includes(b.type)&&b.units.every(u=>u.ownerId==='treasury'));
    for(const b of pager(ui,p,homes,'mayorHousingPage',4)){
      p.record(b.entity.properties.name,`${b.floors} pavimentos · ${b.units.length} espaços`,()=>ui.openBuilding(b.id));
      p.buttons([{label:'AMPLIAR +1',click:()=>act('expand',{buildingId:b.id,floors:1})},{label:'AMPLIAR +2',click:()=>act('expand',{buildingId:b.id,floors:2})}]);
    }
    }
    if(section==='firm'){
    p.heading('OBRAS POR CONTA DO TESOURO');
    p.note('O governo autônomo abre empresas, instala atividades em andares municipais, planeja habitação, pavimenta, conserva vias e repara imóveis com o tesouro, preservando a reserva municipal. Estes comandos fazem o mesmo manualmente.');
    const firmSpecs=Object.entries(city.buildingTypes).filter(([id])=>municipalFirmType(city,id));
    const firmType=ui.mayorFirmType||'farm',firmCrop=ui.mayorCrop||'milho',firmVertical=firmType==='farm'&&ui.mayorVertical===true&&canFarmVertically(firmCrop),firmFloors=ui.mayorFloors||3;
    p.heading('EMPRESA MUNICIPAL');
    ui.selectControl(p,'mayor-firm-type',firmSpecs.map(([id,spec])=>[id,spec.label]),firmType,value=>{ui.mayorFirmType=value;});
    if(firmType==='farm'){
      ui.selectControl(p,'mayor-firm-crop',Object.entries(city.economy.crops).map(([id,spec])=>[id,spec.label]),firmCrop,value=>{ui.mayorCrop=value;});
      if(canFarmVertically(firmCrop)){
        p.kv('Fazenda vertical',`${firmVertical?`${firmFloors} andares`:'desativada'}`);
        p.buttons([{label:'AO AR LIVRE',selected:!firmVertical,click:()=>{ui.mayorVertical=false;}},{label:'VERTICAL',selected:firmVertical,click:()=>{ui.mayorVertical=true;}}]);
        if(firmVertical)p.buttons([{label:'ANDAR −',click:()=>{ui.mayorFloors=Math.max(2,firmFloors-1);}},{label:'ANDAR +',click:()=>{ui.mayorFloors=Math.min(8,firmFloors+1);}}]);
      }
    }
    p.button('ABRIR EMPRESA MUNICIPAL',()=>act('firm',{type:firmType,crop:firmCrop,...(firmVertical?{vertical:true,floors:firmFloors}: {})}));
    p.note('A empresa nasce pública, com terreno, obra, materiais e capital de operação pagos pelo tesouro. A reserva municipal é preservada e a operação depende de trabalhadores.');
    }
    if(section==='offices'){
    p.heading('EMPRESARIAL MUNICIPAL');
    const officeType=ui.mayorOfficeType||'newsroom',vacancies=municipalOfficeVacancies(city).filter(v=>ui.matches(v.tower.entity.properties.name));
    ui.selectControl(p,'mayor-office-type',[...OFFICE_ONLY_TYPES].map(type=>[type,city.buildingTypes[type]?.label||type]),officeType,value=>{ui.mayorOfficeType=value;});
    for(const vacancy of pager(ui,p,vacancies,'mayorOfficePage',4)){
      p.record(`Andar ${vacancy.floor} · ${vacancy.tower.entity.properties.name}`,'Andar público disponível');
      p.button(`INSTALAR ${(city.buildingTypes[officeType]?.label||officeType).toUpperCase()} AQUI`,()=>act('office',{type:officeType,towerId:vacancy.tower.id,floor:vacancy.floor}));
    }
    if(!vacancies.length)p.note('Nenhum andar público vago. Construa um empresarial municipal ou aguarde um andar ser liberado.');
    }
    if(section==='programs'){
    p.heading('PROGRAMAS DE INFRAESTRUTURA');
    p.buttons([{label:'HABITAÇÃO SOCIAL (DEMANDA REAL)',click:()=>act('housing')},{label:'PAVIMENTAÇÃO PRIORITÁRIA',click:()=>act('paving')},{label:'CONSERVAR VIAS DANIFICADAS',click:()=>act('roadRepair')},{label:'INSTALAR ILUMINAÇÃO PÚBLICA',click:()=>act('lighting')}]);
    p.note('Habitação amplia ou constrói conforme moradores sem casa. A pavimentação prioriza circulação e liga imóveis; a conservação recupera trechos danificados. Todas dependem de construtora, materiais e caixa após a reserva.');
    const upkeep=city.buildings.filter(b=>!b.entity.destroyed&&(city.fiscal.municipal(b)||b.id===city.townhall()?.id)&&(b.repairNeeded||(b.condition??100)<95)&&ui.matches(b.entity.properties.name));
    for(const b of pager(ui,p,upkeep,'mayorUpkeepPage',4)){
      p.record(b.entity.properties.name,`Conservação ${Math.round(b.condition??100)}/100 · ${city.buildingTypes[b.type]?.label||b.type}`,()=>ui.openBuilding(b.id));
      p.button('CONTRATAR REPARO PREVENTIVO',()=>act('maintain',{buildingId:b.id}));
    }
    if(!upkeep.length)p.note('Nenhum imóvel municipal abaixo de 95% de conservação.');
    }
  }else if(view==='operations'){
    const choices=[['services', 'Custeio e serviços por imóvel'], ['shares', 'Participações e resultados'], ['programs', 'Alimentação e proteção social']];
    const section=choices.some(([id])=>id===ui.mayorSection)?ui.mayorSection:'services';
    ui.selectControl(p,'Escolher tarefa de serviços',choices,section,value=>{ui.mayorSection=value;});

    if(section==='services'){
    p.note('Custeio sai do tesouro e preserva a reserva municipal. A folha e os serviços correntes continuam nos fluxos existentes.');
    const buildings=city.buildings.filter(b=>(city.fiscal.municipal(b)||b.id===city.townhall()?.id)&&ui.matches(b.entity.properties.name));
    const page=Math.min(ui.mayorCompanyPage||0,Math.max(0,Math.ceil(buildings.length/6)-1));
    if(buildings.length>6)p.buttons([{label:'ANTERIORES',click:()=>{ui.mayorCompanyPage=Math.max(0,page-1);}},{label:'PRÓXIMAS',click:()=>{ui.mayorCompanyPage=page+1;}}]);
    for(const b of buildings.slice(page*6,page*6+6)){
      p.record(b.entity.properties.name,`Caixa ${money(b.balance||0)} · ${b.workers.length} trabalhadores`,()=>ui.openBuilding(b.id));
      if(city.fiscal.municipal(b))p.buttons([10000,100000].map(value=>({label:`CUSTEAR ${money(city.currency.price(value))}`,click:()=>act('fund',{buildingId:b.id,amount:city.currency.price(value)})})));
      p.buttons([['repair','REPARO'],['cleaning','LIMPEZA'],['garden','JARDINAGEM']].map(([service,label])=>({label,click:()=>act('service',{buildingId:b.id,service})})));
    }
    p.heading('SERVIÇOS CONTRATADOS');
    for(const job of city.gigs.jobs.filter(j=>j.payerAccountId==='treasury'&&['open','working'].includes(j.status)).slice(-12))p.note(`#${job.id} · ${job.kind||job.scope} · ${job.status} · ${Math.floor(job.progress||0)}/${job.required}`);
    }
    if(section==='shares'){
    p.heading('PARTICIPAÇÕES MUNICIPAIS');
    const quota=privatizationQuota(city);
    p.kv('Cota diária de privatização',`${(gov.policy.dailyPrivatizationLimit??7).toFixed(1)}%`);
    p.kv('Ofertado / vendido hoje',`${(quota.offered/100).toFixed(2)}% / ${(quota.sold/100).toFixed(2)}%`);
    p.note('Estatização e privatização fora da cota diária passam pela Câmara. A oferta aprovada fica disponível para compradores; a transferência depende de mercado.');
    const firms=city.economy.businesses.filter(b=>b.active&&!b.entity.destroyed&&!['townhall','mint'].includes(b.type)&&ui.matches(b.entity.properties.name));
    for(const b of pager(ui,p,firms,'mayorFirmPage',6)){
      const publicPoints=equityShares(city,b).find(share=>share.accountId==='treasury')?.points||0;
      p.record(b.entity.properties.name,`${(publicPoints/100).toFixed(0)}% público · caixa ${money(b.balance||0)}`,()=>ui.openBuilding(b.id));
      if(publicPoints<10000)p.buttons([{label:'PROPOR ESTATIZAÇÃO',click:()=>act('nationalize',{buildingId:b.id})}]);
      if(publicPoints>0)p.buttons([{label:'PROPOR PRIVATIZAR 25%',click:()=>act('privatize',{buildingId:b.id,percent:25})},{label:'PROPOR PRIVATIZAR 100%',click:()=>act('privatize',{buildingId:b.id,percent:100})}]);
      if(publicPoints>0)p.buttons([{label:'OFERTAR 5% HOJE',click:()=>act('offerShares',{buildingId:b.id,percent:5})},{label:'OFERTAR 10% HOJE',click:()=>act('offerShares',{buildingId:b.id,percent:10})}]);
      if(city.fiscal.municipal(b))p.button('TRANSFERIR RESULTADO AO TESOURO',()=>act('dividend',{buildingId:b.id}));
    }
    }
    if(section==='programs'){
    p.heading('PROGRAMAS MUNICIPAIS');
    p.note('O governo autônomo executa estes programas sem passar pela Câmara. Aqui o prefeito escolhe o beneficiário elegível; todo valor sai do tesouro após a reserva municipal.');
    const markets=city.economy.businesses.filter(b=>b.active&&!b.entity.destroyed&&b.type==='market'&&((b.financialDistressDays||0)>0||b.balance<city.currency.price(5000)));
    for(const b of pager(ui,p,markets,'mayorMarketPage',3)){
      p.record(b.entity.properties.name,`Mercado em dificuldade · caixa ${money(b.balance||0)}`,()=>ui.openBuilding(b.id));
      p.button('RECUPERAR MERCADO',()=>act('marketRecovery',{buildingId:b.id}));
    }
    if(!markets.length)p.note('Nenhum mercado em dificuldade financeira.');
    const voucherCandidates=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)&&!c.homeUnitId&&c.balance<city.currency.price(20000)).sort((a,b)=>a.balance-b.balance);
    for(const c of pager(ui,p,voucherCandidates,'mayorVoucherPage',3)){
      p.record(c.entity.properties.name,`Sem moradia · saldo ${money(c.balance)}`,()=>ui.openCitizen?.(c.id));
      p.button('CONCEDER VALE-ALUGUEL',()=>act('rentVoucher',{citizenId:c.id}));
    }
    if(!voucherCandidates.length)p.note('Nenhuma família elegível para o vale-aluguel.');
    p.buttons([{label:'CRÉDITO HABITACIONAL COM ENTRADA SUBSIDIADA',click:()=>act('housingCredit')},{label:'CRÉDITO DE 5% EM ESTATAL',click:()=>act('equityLoan')},{label:'COMPRAR ALIMENTOS PARA REFEIÇÕES PÚBLICAS',click:()=>act('restock')}]);
    p.note('O crédito habitacional escolhe comprador empregado, imóvel privado à venda e banco; a entrada é subsidiada e o financiamento é real. O crédito de participação empresta ao morador para comprar 5% de uma estatal, com devolução descontada do saldo.');
    const loans=(gov.stateEquityLoans||[]).filter(loan=>loan.remaining>0);
    if(loans.length)p.note(`Créditos de participação em aberto: ${loans.length} · saldo ${money(loans.reduce((sum,loan)=>sum+loan.remaining,0))}`);
    }
  }else if(view==='cabinet'){
    p.note('Secretarias nomeadas respondem ao prefeito e podem vetar medidas pendentes da própria área. Prefeito, vice e vereadores não acumulam pasta. A administração revisa as vagas diariamente; nomeie um substituto para escolher agora.');
    const rows=(gov.secretaries||[]).map(row=>({...row,office:SECRETARIATS.find(office=>office.id===row.officeId)}));
    if(ui.mayorCabinetOverview)p.table([{label:'Pasta',weight:1.6},{label:'Responsável',weight:2},{label:'Capacidade'},{label:'Escolha',weight:1.6}],rows.map(row=>({cells:[row.office?.short||row.officeId,city.society.citizen(row.citizenId)?.entity.properties.name||row.citizenName||'Cargo vago',Math.round(row.skill||0),SECRETARY_ELECTION_MODES[row.mode||gov.policy.secretaryElectionModes?.[row.officeId]||'appointed']]})));
    p.button(ui.mayorCabinetOverview?'OCULTAR QUADRO DE SECRETARIAS':'VER QUADRO DE SECRETARIAS',()=>{ui.mayorCabinetOverview=!ui.mayorCabinetOverview;});
    if(ui.mayorCandidateId)p.button('MOSTRAR TODOS OS CANDIDATOS',()=>{ui.mayorCandidateId=null;});
    const officeId=ui.mayorOffice||'finance',office=SECRETARIATS.find(item=>item.id===officeId)||SECRETARIATS[0],row=rows.find(item=>item.officeId===office.id),holder=city.society.citizen(row?.citizenId),mode=gov.policy.secretaryElectionModes?.[office.id]||'appointed';
    p.buttons(SECRETARIATS.map(item=>({label:item.short.toUpperCase(),selected:item.id===office.id,click:()=>{ui.mayorOffice=item.id;ui.resetScroll();}})));
    p.heading(office.name);
    p.note(office.duty);
    p.kv('Titular',holder?.entity.properties.name||row?.citizenName||'Cargo vago');
    p.kv('Sistema de escolha',SECRETARY_ELECTION_MODES[mode]);
    if(mode!=='appointed'){
      p.note('Esta pasta não é nomeada pelo prefeito no sistema vigente. Apresente a mudança à Câmara para recuperar a nomeação direta.');
      p.button('PROPOR NOMEAÇÃO PELO PREFEITO',()=>act('bill',{type:'secretaryElection',payload:{office:office.id,mode:'appointed'}}));
    }else{
      if(holder)p.button('EXONERAR',()=>act('dismiss',{officeId:office.id}));
      p.heading('CANDIDATOS');
      const candidates=(gov.secretaryCandidates?.(office)||[]).filter(c=>ui.matches(c.name)&&(!ui.mayorCandidateId||c.citizenId===ui.mayorCandidateId));
      const shown=pager(ui,p,candidates,`mayor-candidates-${office.id}`,5);
      for(const candidate of shown)p.button(`${candidate.name} · ${Math.round(candidate.skill)}/100`,()=>act('appoint',{officeId:office.id,citizenId:candidate.citizenId}));
      if(!candidates.length)p.note('Nenhum morador elegível, livre de mandato e de outra pasta.');
    }
    p.heading('VETOS DE SECRETARIA');
    const pending=(gov.council.bills||[]).filter(b=>['awaiting-sanction','awaiting-secretary-review'].includes(b.status));
    if(!pending.length)p.note('Nenhuma medida pendente de análise.');
    for(const bill of pending)p.note(`#${bill.id} · ${bill.title} · ${gov.billSecretariats(bill).map(id=>SECRETARIATS.find(item=>item.id===id)?.short||id).join(', ')||'sem pasta responsável'}`);
  }else if(view==='policies'){
    const instrument=ui.mayorInstrument||'bill',decreeReady=city.minute>=gov.decreeReadyAt();
    p.buttons([{label:'PROJETO NA CÂMARA',selected:instrument==='bill',click:()=>{ui.mayorInstrument='bill';}},{label:'DECRETO DO PREFEITO',selected:instrument==='decree',click:()=>{ui.mayorInstrument='decree';}}]);
    p.kv('Próximo decreto',decreeReady?'Disponível agora':day(gov.decreeReadyAt()));
    p.note(instrument==='decree'?'Decretos não passam por votação inicial, mas a secretaria responsável pode vetar e a Câmara pode derrubar o veto. Orçamento, propriedade, identidade, remuneração e regras eleitorais exigem projeto de lei; medidas que ampliam poderes do prefeito também.':'Projetos passam pela Câmara; o prefeito articula com vereadores do partido ou com a presidência da Câmara. Medidas executivas de verba de obras podem ser solicitadas diretamente pelo prefeito.');
    const apply=(type,payload={})=>act(instrument==='decree'?'decree':'bill',{type,payload});
    const section=ui.mayorPolicyView||'tax';
    p.links([['tax','TRIBUTOS'],['labor','PREÇOS'],['social','SOCIAL'],['order','ORDEM'],['transport','TRANSPORTE'],['economy','ECONOMIA'],['elections','ELEIÇÕES'],['justice','JUSTIÇA'],['identity','IDENTIDADE']].map(([id,label])=>({label,selected:section===id,click:()=>{ui.mayorPolicyView=id;ui.resetScroll();}})));
    if(section==='tax'){
      const taxView=ui.mayorTaxView||'income';
      ui.selectControl(p,'Tributo a revisar',[['income','Renda e empresas'],['sectors','Impostos por ramo'],['trade','Tarifas de comércio']],taxView,value=>{ui.mayorTaxView=value;});
      if(taxView==='income'){

      p.heading('IMPOSTO SALARIAL');p.kv('Alíquota efetiva',`${(city.taxRate*100).toFixed(0)}%`);
      p.buttons([{label:'−2 P.P.',click:()=>apply('tax',{value:Math.max(MINIMUM_WAGE_TAX_RATE,Math.round((city.taxRate-.02)*100)/100)})},{label:'+2 P.P.',click:()=>apply('tax',{value:Math.min(.5,Math.round((city.taxRate+.02)*100)/100)})}]);
      p.heading('IMPOSTO EMPRESARIAL');p.kv('Alíquota efetiva',`${(gov.policy.businessTax*100).toFixed(0)}%`);
      p.buttons([{label:'−2 P.P.',click:()=>apply('businessTax',{value:Math.max(MINIMUM_BUSINESS_TAX_RATE,Math.round((gov.policy.businessTax-.02)*100)/100)})},{label:'+2 P.P.',click:()=>apply('businessTax',{value:Math.min(.5,Math.round((gov.policy.businessTax+.02)*100)/100)})}]);
      }else if(taxView==='sectors'){
      p.heading('IMPOSTO POR RAMO');
      for(const [category,spec] of pager(ui,p,Object.entries(TAX_CATEGORIES),'mayorTaxPage',6)){
        const base=baseTaxRate(city,category),effective=taxRate(city,category);
        p.kv(spec.label,`${(effective*100).toFixed(1)}% efetiva · ${(base*100).toFixed(1)}% de base`);
        p.buttons([{label:'−2 P.P.',click:()=>apply('salesTax',{category,value:Math.max(spec.rate,Math.round((base-.02)*100)/100)})},{label:'+2 P.P.',click:()=>apply('salesTax',{category,value:Math.min(.5,Math.round((base+.02)*100)/100)})}]);
      }
      }else{
      p.heading('TARIFAS DE COMÉRCIO');
      const goods=Object.entries(city.economy.goods).sort((a,b)=>a[1].label.localeCompare(b[1].label,'pt-BR'));
      for(const [good,spec] of pager(ui,p,goods,'mayorTradePage',6)){
        const importRate=gov.policy.importTaxes?.[good]??0,exportRate=gov.policy.exportTaxes?.[good]??0;
        p.kv(spec.label,`Importação ${(importRate*100).toFixed(0)}% · exportação ${(exportRate*100).toFixed(0)}%`);
        p.buttons([{label:'IMPORTAR −5',click:()=>apply('tradeTax',{good,importRate:Math.max(0,Math.round((importRate-.05)*100)/100),exportRate})},{label:'IMPORTAR +5',click:()=>apply('tradeTax',{good,importRate:Math.min(1,Math.round((importRate+.05)*100)/100),exportRate})},{label:'EXPORTAR −5',click:()=>apply('tradeTax',{good,importRate,exportRate:Math.max(0,Math.round((exportRate-.05)*100)/100)})},{label:'EXPORTAR +5',click:()=>apply('tradeTax',{good,importRate,exportRate:Math.min(1,Math.round((exportRate+.05)*100)/100)})}]);
      }
      }
    }else if(section==='labor'){
      p.heading('SALÁRIO MÍNIMO');
      p.kv('Piso por hora',money(city.currency.price(gov.policy.minimumWage)*60));
      p.buttons([{label:'−1 CENTAVO/MIN',click:()=>apply('minimumWage',{value:Math.max(1,gov.policy.minimumWage-1)})},{label:'+1 CENTAVO/MIN',click:()=>apply('minimumWage',{value:gov.policy.minimumWage+1})}]);
      p.heading('INFLAÇÃO E EMISSÃO');
      p.kv('Teto diário de emissão',money(city.currency.policy.dailyLimit));
      p.kv('Meta de inflação',`${((city.currency.policy.inflationTarget||0)*100).toFixed(2)}% ao dia`);
      p.note('O controle da inflação reduz o teto de emissão e queima caixa livre quando não há crise social.');
      p.button('APLICAR CONTROLE DA INFLAÇÃO',()=>apply('inflation',{value:Math.max(0,city.currency.policy.dailyLimit-20000),target:city.currency.policy.inflationTarget||.005}));
      p.heading('CUSTEIO E RESERVA');
      p.kv('Dias de caixa por serviço',String(economicPolicy(city,'serviceBufferDays')));
      p.note('Ajustes finos de custeio estão em ECONOMIA.');
    }else if(section==='social'){
      p.heading('PROTEÇÃO SOCIAL');
      p.kv('Benefícios por dia',money(city.welfare.policy.dailyBudget));
      p.buttons([{label:'−10%',click:()=>apply('welfare',{value:Math.max(0,Math.round(city.welfare.policy.dailyBudget*.9))})},{label:'+10%',click:()=>apply('welfare',{value:Math.round(city.welfare.policy.dailyBudget*1.1)})}]);
      p.note('O orçamento diário de benefícios atende famílias sem recursos e respeita o caixa disponível.');
      p.windowLink('PROTEÇÃO SOCIAL E MORADIA',()=>ui.openPanel({tab:'government',politicsTab:'overview'}));
    }else if(section==='order'){
      p.heading('EFETIVO POLICIAL');
      const target=gov.policy.policeStaffing??6,staffed=city.buildings.filter(b=>b.type==='police_station'&&b.active&&!b.entity.destroyed).reduce((n,b)=>n+city.justice.staffed(b),0);
      p.kv('Autorizado / empregado',`${target} / ${staffed}`);
      p.buttons([{label:`−${target<20?1:5}`,click:()=>apply('policeStaffing',{value:Math.max(0,target-(target<20?1:5))})},{label:`+${target<20?1:5}`,click:()=>apply('policeStaffing',{value:Math.min(1000,target+(target<20?1:5))})}]);
      p.heading('INTEGRIDADE PARLAMENTAR');
      const policies=city.justice.policies;
      for(const [type,label] of [['cleanRecord','Lei da ficha limpa'],['parliamentaryImmunity','Imunidade parlamentar']]){
        p.kv(label,policies[type]?'Em vigor':'Desativada');
        p.button(`${policies[type]?'DESATIVAR':'ATIVAR'} ${label.toUpperCase()}`,()=>apply(type,{value:!policies[type]}));
      }
      const bounds=city.justice.popularJuryBounds(),jury=Math.max(bounds.minimum,Math.min(bounds.maximum,policies.popularJurySize??bounds.minimum)),step=jury<15?1:5;
      p.kv('Júri popular',`${jury} jurados · faixa ${bounds.minimum}–${bounds.maximum}`);
      p.buttons([{label:`−${step}`,click:()=>apply('popularJurySize',{value:Math.max(bounds.minimum,jury-step)})},{label:`+${step}`,click:()=>apply('popularJurySize',{value:Math.min(bounds.maximum,jury+step)})}]);
      p.note('Substâncias reguladas ficam no painel de governo, seção Políticas de substâncias.');
    }else if(section==='transport'){
      const current=gov.policy.transportPolicy||'balanced';
      p.kv('Política vigente',TRANSPORT_POLICIES[current]);
      p.note('Bicicletas, fretes, segurança viária e conservação de vias. A mudança altera prioridades e incentivos.');
      for(const [policy,label] of Object.entries(TRANSPORT_POLICIES))if(policy!==current)p.button(label.toUpperCase(),()=>apply('transportPolicy',{policy}));
      p.heading('PRIORIDADE DE INFRAESTRUTURA');
      p.kv('Em vigor',gov.policy.infrastructurePriority==='lamps'?'Iluminação pública':'Acesso e pavimentação');
      p.buttons([['roads','ACESSO'],['lamps','ILUMINAÇÃO']].map(([value,label])=>({label,selected:gov.policy.infrastructurePriority===value,click:()=>apply('roads',{value})})));
    }else if(section==='economy'){
      p.heading('POLÍTICA ECONÔMICA');
      p.note('Parâmetros fiscais, patrimoniais, de consumo, empresas públicas, crédito e trabalho. Cada mudança vale imediatamente após a tramitação.');
      const entries=Object.entries(ECONOMIC_POLICIES);
      for(const [key,spec] of pager(ui,p,entries,'mayorEconomyPage',6)){
        const current=economicPolicy(city,key);
        p.kv(spec.label,policyValue(spec,current));
        p.note(spec.description);
        if(typeof spec.default==='boolean')p.button(current?'DESATIVAR':'ATIVAR',()=>apply('economicPolicy',{key,value:!current}));
        else p.buttons([{label:'−',click:()=>apply('economicPolicy',{key,value:Math.max(spec.min,Math.round((current-spec.step)*1e6)/1e6)})},{label:'+',click:()=>apply('economicPolicy',{key,value:Math.min(spec.max,Math.round((current+spec.step)*1e6)/1e6)})}]);
      }
    }else if(section==='elections'){
      const election=gov.active,partyId=gov.partyOfId(city.economy.mayorId)?.id,nomination=election?.candidates?.find(item=>item.partyId===partyId);
      p.heading('CAMPANHA DO PARTIDO');
      if(election?.status==='campaign'){
        p.kv('Candidatura do partido',nomination?.name||'Sem candidatura própria');
        p.kv('Votação',day(election.voteAt));
        p.note('Bandeiraços reúnem militantes, plantam bandeiras e apresentam as propostas a quem passa. O partido também organiza atos sozinho, mas o prefeito pode convocar um ato por hora entre 7h e 20h.');
        p.button('REALIZAR BANDEIRAÇO',()=>act('rally'));
      }else p.note('Sem campanha eleitoral em curso. A próxima votação é anunciada no calendário do governo.');
      p.heading('SISTEMA ELEITORAL');
      p.kv('Eleição para prefeito',gov.policy.mayorElectionSystem==='indirect'?'Indireta pela Câmara':'Direta pelos cidadãos');
      p.button(gov.policy.mayorElectionSystem==='indirect'?'TORNAR DIRETA':'TORNAR INDIRETA',()=>apply('mayorElectionSystem',{mode:gov.policy.mayorElectionSystem==='indirect'?'direct':'indirect'}));
      p.heading('PRAZOS');
      p.kv('Mandato / campanha',`${gov.policy.termDays} / ${gov.policy.campaignDays} dias`);
      p.buttons([{label:'MANDATO −1',click:()=>apply('termDays',{value:Math.max(gov.policy.campaignDays+1,gov.policy.termDays-1)})},{label:'MANDATO +1',click:()=>apply('termDays',{value:gov.policy.termDays+1})},{label:'CAMPANHA −1',click:()=>apply('campaignDays',{value:Math.max(1,gov.policy.campaignDays-1)})},{label:'CAMPANHA +1',click:()=>apply('campaignDays',{value:Math.min(gov.policy.termDays-1,gov.policy.campaignDays+1)})}]);
      p.heading('PARTIDOS E CANDIDATURAS');
      p.kv('Limite de partidos / candidaturas a prefeito',`${gov.policy.partyLimit} / ${gov.policy.mayorCandidateLimit??Math.floor(gov.policy.partyLimit/2)}`);
      const candidateMax=Math.floor(gov.policy.partyLimit/2),candidateLimit=gov.policy.mayorCandidateLimit??candidateMax;
      p.buttons([{label:'PARTIDOS −1',click:()=>apply('partyLimit',{value:Math.max(4,gov.policy.partyLimit-1)})},{label:'PARTIDOS +1',click:()=>apply('partyLimit',{value:gov.policy.partyLimit+1})},{label:'CANDIDATURAS −1',click:()=>apply('mayorCandidateLimit',{value:Math.max(2,candidateLimit-1)})},{label:'CANDIDATURAS +1',click:()=>apply('mayorCandidateLimit',{value:Math.min(candidateMax,candidateLimit+1)})}]);
      p.kv('Reeleições consecutivas',String(gov.policy.reelectionLimit));
      p.buttons([{label:'−1',click:()=>apply('reelectionLimit',{value:Math.max(0,gov.policy.reelectionLimit-1)})},{label:'+1',click:()=>apply('reelectionLimit',{value:gov.policy.reelectionLimit+1})}]);
      p.kv('Candidatura de empresários',gov.policy.entrepreneurCandidates===false?'Proibida':'Permitida');
      p.button(gov.policy.entrepreneurCandidates===false?'PERMITIR':'PROIBIR',()=>apply('entrepreneurCandidates',{value:gov.policy.entrepreneurCandidates===false}));
      p.heading('CÂMARA E REMUNERAÇÃO');
      p.kv('Representação',`${(gov.policy.councilRate??5).toFixed(1)}% da população · ${gov.council.seats} cadeiras`);
      p.kv('Orçamento diário da Câmara / prefeito',`${money(gov.policy.councilBudget)} / ${money(gov.policy.mayorBudget)}`);
      p.buttons([{label:'REPRESENTAÇÃO −0,5',click:()=>apply('councilRate',{value:Math.max(5,(gov.policy.councilRate??5)-.5)})},{label:'REPRESENTAÇÃO +0,5',click:()=>apply('councilRate',{value:Math.min(12.5,(gov.policy.councilRate??5)+.5)})}]);
      p.buttons([{label:'CÂMARA −10%',click:()=>apply('councilBudget',{value:Math.max(0,Math.round(gov.policy.councilBudget*.9))})},{label:'CÂMARA +10%',click:()=>apply('councilBudget',{value:Math.round(gov.policy.councilBudget*1.1)})},{label:'PREFEITO −10%',click:()=>apply('mayorBudget',{value:Math.max(0,Math.round(gov.policy.mayorBudget*.9))})},{label:'PREFEITO +10%',click:()=>apply('mayorBudget',{value:Math.round(gov.policy.mayorBudget*1.1)})}]);
      p.heading('FUNDO E COTA DE PRIVATIZAÇÃO');
      p.kv('Fundo partidário',money(gov.policy.partyFund??80000));
      p.buttons([{label:'−10%',click:()=>apply('partyFund',{value:Math.max(0,Math.round((gov.policy.partyFund??80000)*.9))})},{label:'+10%',click:()=>apply('partyFund',{value:Math.round((gov.policy.partyFund??80000)*1.1)})}]);
      const quotaRate=gov.policy.dailyPrivatizationLimit??7;
      p.kv('Cota diária de privatização',`${quotaRate.toFixed(1)}%`);
      p.buttons([{label:'−0,5',click:()=>apply('dailyPrivatizationLimit',{value:Math.max(0,Math.round((quotaRate-.5)*10)/10)})},{label:'+0,5',click:()=>apply('dailyPrivatizationLimit',{value:Math.min(10,Math.round((quotaRate+.5)*10)/10)})}]);
    }else if(section==='justice'){
      p.heading('DIREITOS E JÚRI');
      const policies=city.justice.policies,bounds=city.justice.popularJuryBounds(),jury=Math.max(bounds.minimum,Math.min(bounds.maximum,policies.popularJurySize??bounds.minimum)),step=jury<15?1:5;
      p.kv('Ficha limpa / imunidade',`${policies.cleanRecord?'ativa':'desativada'} / ${policies.parliamentaryImmunity?'ativa':'desativada'}`);
      p.buttons([{label:'FICHA LIMPA',click:()=>apply('cleanRecord',{value:!policies.cleanRecord})},{label:'IMUNIDADE',click:()=>apply('parliamentaryImmunity',{value:!policies.parliamentaryImmunity})}]);
      p.kv('Júri popular',`${jury} jurados · faixa ${bounds.minimum}–${bounds.maximum}`);
      p.buttons([{label:`−${step}`,click:()=>apply('popularJurySize',{value:Math.max(bounds.minimum,jury-step)})},{label:`+${step}`,click:()=>apply('popularJurySize',{value:Math.min(bounds.maximum,jury+step)})}]);
      p.heading('LEIS CONTRA DISCRIMINAÇÃO');
      for(const [prejudice,spec] of Object.entries(PREJUDICE_TYPES)){
        const prohibited=city.justice.policies.prejudiceLaws?.[prejudice]!==false;
        p.kv(spec.label,prohibited?'Atos proibidos':'Atos permitidos');
        p.button(`${prohibited?'LIBERAR':'PROIBIR'} ATOS`,()=>apply('prejudiceLaw',{prejudice,prohibited:!prohibited}));
      }
      p.heading('CÓDIGO PENAL');
      const crimes=Object.entries(CRIME_TYPES).filter(([crime])=>!PREJUDICE_TYPES[crime]&&city.justice.policies.penalCode[crime]);
      for(const [crime,label] of pager(ui,p,crimes,'mayorCrimePage',3)){
        const rule=city.justice.policies.penalCode[crime],update=changes=>apply('penalCode',{crime,rule:{...rule,...changes}});
        p.kv(label,`${rule.criminal?'Crime':'Descriminalizada'} · severidade ${rule.severity} · multa ${money(rule.fine)}`);
        p.buttons([{label:rule.criminal?'DESCRIMINALIZAR':'CRIMINALIZAR',click:()=>update({criminal:!rule.criminal})},{label:'SEVERIDADE −10',click:()=>update({severity:Math.max(0,rule.severity-10)})},{label:'SEVERIDADE +10',click:()=>update({severity:Math.min(100,rule.severity+10)})},{label:'MULTA −100',click:()=>update({fine:Math.max(0,rule.fine-100)})},{label:'MULTA +100',click:()=>update({fine:rule.fine+100})}]);
        p.buttons([{label:rule.fineOnly?'PERMITIR PRISÃO':'SOMENTE MULTA',click:()=>update({fineOnly:!rule.fineOnly})},{label:rule.politicalDisqualification?'PRESERVAR DIREITOS':'SUSPENDER DIREITOS',click:()=>update({politicalDisqualification:!rule.politicalDisqualification})},{label:rule.cassation?'NÃO CASSAR':'CASSAR MANDATO',click:()=>update({cassation:!rule.cassation})}]);
      }
    }else{
      const identity=gov.ensureMunicipalIdentity(),flag=identity.flag;
      p.heading('NOME E SLOGAN');
      p.kv('Nome atual',identity.name);
      p.kv('Slogan atual',identity.slogan||'Sem slogan oficial');
      if(typeof ui.inputAt==='function'&&ui.municipalNameInput){
        p.note('Novo nome municipal (2 a 48 caracteres):');const nameY=p.y;p.space(24);if(nameY>=p.top&&nameY+20<=p.bottom)ui.inputAt(ui.municipalNameInput,p.x,nameY,p.w);p.space(3);
        p.button('PROPOR NOVO NOME',()=>act('bill',{type:'cityName',payload:{value:ui.municipalNameInput?.value||''}}));
      }
      if(typeof ui.inputAt==='function'&&ui.municipalSloganInput){
        p.note('Novo slogan (2 a 120 caracteres):');const sloganY=p.y;p.space(24);if(sloganY>=p.top&&sloganY+20<=p.bottom)ui.inputAt(ui.municipalSloganInput,p.x,sloganY,p.w);p.space(3);
        p.button('PROPOR NOVO SLOGAN',()=>act('bill',{type:'citySlogan',payload:{value:ui.municipalSloganInput?.value||''}}));
      }
      p.heading('BANDEIRA MUNICIPAL');
      p.kv('Composição',flag?.layoutName||'Bandeira provisória');
      p.button('PROPOR NOVA COMPOSIÇÃO',()=>act('bill',{type:'cityFlag',payload:{operation:{type:'regenerate'}}}));
      p.note('Fundo da bandeira:');
      p.buttons((PARTY_FLAG_BACKGROUNDS||[]).slice(0,8).map(background=>({label:String(background).toUpperCase(),selected:flag?.backgroundStyle===background,click:()=>act('bill',{type:'cityFlag',payload:{operation:{type:'background',value:background}}})})));
      p.windowLink('HISTÓRICO DA IDENTIDADE MUNICIPAL',()=>ui.openPanel({tab:'government',politicsTab:'directory'}));
    }
  }else if(view==='council'){
    p.note('Propostas passam pela Câmara. Reforço da verba de obras e transferências do Executivo são solicitados pelo prefeito; as demais medidas exigem um vereador do partido.');
    const budget=gov.ensureWorksBudget();
    p.kv('Verba de obras atual',money(budget));
    p.buttons([city.currency.price(500000),city.currency.price(5000000)].map(value=>({label:`PEDIR DOTAÇÃO DE ${money(value)}`,click:()=>act('bill',{type:'worksBudget',value:budget+value})})));
    p.buttons([city.currency.price(100000),city.currency.price(1000000)].map(value=>({label:`TRANSFERIR ${money(value)}`,click:()=>act('bill',{type:'worksTransfer',value})})));
    p.note('Impostos, benefícios e demais leis estão em POLÍTICAS, com escolha entre projeto e decreto.');
    p.heading('SANÇÃO E VETO');
    const awaiting=gov.council.bills.filter(b=>b.status==='awaiting-sanction');
    if(!awaiting.length)p.note('Nenhum projeto aguardando decisão do prefeito.');
    for(const bill of awaiting){
      p.note(`#${bill.id} · ${bill.title}`);
      p.buttons([{label:'SANCIONAR',click:()=>act('sanction',{billId:bill.id})},{label:'VETAR',click:()=>act('veto',{billId:bill.id})}]);
    }
    p.heading('TRAMITAÇÃO RECENTE');
    for(const bill of gov.council.bills.slice(-12).reverse())p.note(`#${bill.id} · ${bill.title} · ${billStates[bill.status]||bill.status}${bill.result?` · ${bill.result}`:''}${bill.decree?' · decreto':''}`);
    p.windowLink('ABRIR CÂMARA E VOTAÇÕES',()=>ui.openPanel({tab:'government',politicsTab:'council'}));
  }else{
    for(const order of [...s.orders].reverse()){
      p.note(`#${order.id} · ${day(order.minute)} · ${names[order.action]||order.action} · ${order.text}`);
      if(order.amount)p.note(`Valor: ${money(order.amount)}${order.buildingId?` · ${city.building(order.buildingId)?.entity.properties.name||'Empresa municipal'}`:''}${order.citizenId?` · ${city.society.citizen(order.citizenId)?.entity.properties.name||'Morador'}`:''}`);
      if(order.billId!=null)p.note(`Projeto de lei #${order.billId}${order.decree?' · decreto do prefeito':''}`);
      if(order.gigId!=null)p.note(`Serviço #${order.gigId}`);
      if(order.points)p.note(`Participações ofertadas: ${(order.points/100).toFixed(2)}%`);
      if(order.participants)p.note(`Militantes mobilizados: ${order.participants}`);
      if(order.count)p.note(`Postes contratados: ${order.count}`);
      if(order.shipments)p.note(`Pedidos de alimento: ${order.shipments}`);
      if(order.projectId!=null)p.button(`ACOMPANHAR OBRA #${order.projectId}`,()=>ui.host?.openContract(order.projectId));
    }
  }
}
