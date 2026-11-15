import {OFFICE_ONLY_TYPES} from './city_offices.js?v=office-demand-rollout-1';
import {publicProjects} from './city_mayor_campaign.js';
import {describePromise} from './city_mandates.js';
import {formatMoney as money} from './city_ui_format.js';
const day = minute => `dia ${Math.floor(minute/1440)+1}`;
const names = {build:'Obra',priority:'Prioridade',fund:'Custeio',service:'Serviço',bill:'Proposta',sanction:'Sanção',veto:'Veto',start:'Início'};
export function renderMayorCampaign(ui,p) {
  const city=ui.city,s=city.mayorCampaign,gov=city.politics;
  const act=(action,options={})=>{
    const result=city.mayorAction(action,options);
    ui.notice=result?'Ordem enviada. Confira a execução e os recursos disponíveis.':city.lastError||'Ordem não concluída.';
    return result;
  };
  p.heading('MODO PREFEITO · GOVERNO INDIRETO');
  if(!s){
    const mayor=city.society.citizen(city.economy.mayorId),party=gov.party(mayor?.political?.partyId);
    p.note('Assuma a prefeitura atual. Defina obras, prioridades e custeio; cidadãos e empresas executam o trabalho real.');
    p.kv('Prefeito',mayor?.entity.properties.name||'Aguardando posse');
    p.kv('Seu partido',party?.name||'Aguardando filiação');
    p.note('Mantenha este partido na prefeitura. A troca por outro partido, inclusive por sucessão ou afastamento, encerra a campanha.');
    p.note('A agenda automática de governo e a expansão pública automática cedem as escolhas ao jogador. Serviços correntes, empresas privadas, Câmara e eleições continuam funcionando.');
    p.note('Não há capital extra. Obras usam a verba aprovada; serviços e custeio usam o tesouro. A escolha do terreno segue o planejamento existente.');
    p.button('ASSUMIR A PREFEITURA',()=>act('start'));
    return;
  }
  p.kv('Partido da campanha',s.partyName);
  p.kv('Prefeito em exercício',city.society.citizen(city.economy.mayorId)?.entity.properties.name||'Sucessão em andamento');
  if(s.status==='defeated'){
    p.status('DERROTA',s.reason);
    p.note(`Campanha de ${day(s.startedAt)} até ${day(s.endedAt)}. A simulação para ao perder a prefeitura.`);
    if(s.mode==='play')p.button('ENCERRAR CAMPANHA E OBSERVAR A CIDADE',()=>act('observe'));
    else p.note('Campanha encerrada. A cidade voltou à simulação autônoma. Crie outra cidade para jogar novamente.');
    return;
  }
  if(s.mode!=='play'){p.note('Campanha encerrada pelo jogador. A cidade voltou à simulação autônoma.');return;}
  p.status('MANTENHA O PARTIDO NO PODER',`Avaliação do governo: ${Math.round(gov.approval)} / 100 · próxima votação: ${gov.nextElectionAt==null?'aguardando calendário':day(gov.nextElectionAt)}`);
  p.kv('Tesouro / reserva municipal',`${money(city.treasury)} / ${money(city.fiscal.reserve())}`);
  p.kv('Verba de obras',money(gov.ensureWorksBudget()));
  const view=ui.mayorView||'agenda';
  p.links([['agenda','SITUAÇÃO'],['build','OBRAS'],['operations','CUSTEIO E SERVIÇOS'],['council','CÂMARA'],['orders','ORDENS']].map(([id,label])=>({label,selected:view===id,click:()=>{ui.mayorView=id;ui.resetScroll();}})));
  if(view==='agenda'){
    p.heading('COMPROMISSOS DO MANDATO');
    for(const promise of gov.mandates.current?.promises||[])p.note(describePromise(promise));
    const conditions=city.welfare.conditions();
    p.kv('Moradores sem casa',String(conditions.homeless));
    p.kv('Reserva de alimentos',`${Number(conditions.foodDays||0).toFixed(1)} dias`);
    p.kv('Obras públicas pendentes',String(publicProjects(city).length));
    p.note('Identifique gargalos nos painéis de produção, empresas e transporte. Contratar uma instalação não garante insumos nem trabalhadores.');
    p.windowLink('PRODUÇÃO E ABASTECIMENTO',()=>ui.openPanel({tab:'production'}));
    p.windowLink('AVALIAÇÃO DO GOVERNO',()=>ui.openPanel({tab:'government',views:{government:'elections'},politicsTab:'approval'}));
    p.windowLink('CAMPANHA E ELEIÇÕES',()=>ui.openPanel({tab:'government',views:{government:'elections'},politicsTab:'campaign'}));
    p.button('ENCERRAR CAMPANHA E VOLTAR À SIMULAÇÃO',()=>act('observe'));
  }else if(view==='build'){
    const types=Object.entries(city.buildingTypes).filter(([id])=>!['townhall','mint','council_chamber'].includes(id)&&!OFFICE_ONLY_TYPES.has(id));
    const type=ui.mayorBuildingType||'popular_housing',crop=ui.mayorCrop||'milho';
    ui.selectControl(p,'mayor-building',types.map(([id,spec])=>[id,spec.label]),type,value=>{ui.mayorBuildingType=value;});
    if(type==='farm')ui.selectControl(p,'mayor-crop',Object.entries(city.economy.crops).map(([id,spec])=>[id,spec.label]),crop,value=>{ui.mayorCrop=value;});
    p.button('CONTRATAR COM A VERBA DE OBRAS',()=>act('build',{type,crop}));
    p.note('O município procura terreno acessível. A contratação pode aguardar caixa, construtora ou terreno. Materiais e trabalho não são instantâneos.');
    p.heading('FILA DE OBRAS PÚBLICAS');
    const projects=publicProjects(city),page=Math.min(ui.mayorWorkPage||0,Math.max(0,Math.ceil(projects.length/8)-1));
    if(projects.length>8)p.buttons([{label:'ANTERIORES',click:()=>{ui.mayorWorkPage=Math.max(0,page-1);}},{label:'PRÓXIMAS',click:()=>{ui.mayorWorkPage=page+1;}}]);
    for(const project of projects.slice(page*8,page*8+8)){
      p.record(`#${project.id} · ${project.name||city.buildingTypes[project.type]?.label||project.service}`,`${project.status} · prioridade ${project.priority||0} · pedra ${project.inventory?.pedra||0}/${project.stone||0} · trabalho ${Math.floor(project.labor||0)}/${project.requiredLabor||0}`,()=>ui.host?.openContract(project.id));
      p.buttons([[10,'BAIXA'],[100,'NORMAL'],[200,'URGENTE']].map(([value,label])=>({label,selected:project.priority===value,click:()=>act('priority',{projectId:project.id,value})})));
    }
    if(!projects.length)p.note('Nenhuma obra pública pendente.');
  }else if(view==='operations'){
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
  }else if(view==='council'){
    p.note('Propostas passam pela Câmara. Reforço da verba de obras é solicitado pelo prefeito; impostos e benefícios exigem vereador do partido.');
    p.buttons([100000,1000000].map(value=>({label:`PEDIR ${money(city.currency.price(value))} PARA OBRAS`,click:()=>act('bill',{type:'worksTransfer',value:city.currency.price(value)})})));
    for(const [type,label,current] of [['tax','Imposto salarial',city.taxRate],['businessTax','Imposto empresarial',gov.policy.businessTax]]){
      p.kv(label,`${Math.round(current*100)}%`);
      p.buttons([-.02,.02].map(delta=>({label:delta<0?'PROPOR REDUÇÃO DE 2 PONTOS':'PROPOR AUMENTO DE 2 PONTOS',click:()=>act('bill',{type,value:Math.max(0,Math.min(.5,current+delta))})})));
    }
    p.kv('Benefícios por dia',money(city.welfare.policy.dailyBudget));
    p.buttons([-.1,.1].map(delta=>({label:delta<0?'PROPOR REDUÇÃO DE 10%':'PROPOR AUMENTO DE 10%',click:()=>act('bill',{type:'welfare',value:Math.round(city.welfare.policy.dailyBudget*(1+delta))})})));
    for(const bill of gov.council.bills.filter(b=>b.status==='awaiting-sanction')){
      p.note(`#${bill.id} · ${bill.title}`);
      p.buttons(['sanction','veto'].map(action=>({label:action==='sanction'?'SANCIONAR':'VETAR',click:()=>act(action,{billId:bill.id})})));
    }
    p.heading('TRAMITAÇÃO RECENTE');
    for(const bill of gov.council.bills.slice(-10).reverse())p.note(`#${bill.id} · ${bill.title} · ${bill.status}${bill.result?` · ${bill.result}`:''}`);
  }else{
    for(const order of [...s.orders].reverse()){
      p.note(`#${order.id} · ${day(order.minute)} · ${names[order.action]} · ${order.text}`);
      if(order.amount)p.note(`Valor: ${money(order.amount)} · ${city.building(order.buildingId)?.entity.properties.name||'Empresa municipal'}`);
      if(order.billId!=null)p.note(`Projeto de lei #${order.billId}`);
      if(order.gigId!=null)p.note(`Serviço #${order.gigId}`);
      if(order.projectId!=null)p.button(`ACOMPANHAR OBRA #${order.projectId}`,()=>ui.host?.openContract(order.projectId));
    }
  }
}
