import {renderPartyActivities} from './city_party_player.js';
import {MAYOR_CHALLENGES,challengeValue} from './city_mayor_challenges.js';
import {publicProjects} from './city_mayor_campaign.js';
import {OFFICE_ONLY_TYPES} from './city_offices.js?v=office-demand-rollout-1';
import {formatMoney as money} from './city_ui_format.js';
import {MANAGEMENT_THEME as T} from './management_ui.js';

export const mayorPlaying = city => city.mayorCampaign?.mode==='play'&&city.mayorCampaign.status==='active';
export const MAYOR_DESKS = {party:'Partido e bancada',agenda:'Central do partido',campaign:'Campanha eleitoral',challenges:'Compromissos públicos',build:'Obras e território',operations:'Serviços municipais',cabinet:'Gabinete',policies:'Políticas públicas',council:'Decisões da Câmara',orders:'Ordens emitidas'};

/** Actionable notices are derived from the current simulation, never from invented missions. */
export function mayorDecisions(city) {
  const tasks=[],gov=city.politics;
  if(gov.partyOfId(city.economy.mayorId)?.id!==city.mayorCampaign?.partyId)return tasks;
  for(const bill of gov.council.bills.filter(b=>b.status==='awaiting-sanction'&&city.minute<(b.sanctionAt??Infinity)))tasks.push({id:`bill:${bill.id}`,title:'Sanção ou veto',text:bill.title,desk:'council',billId:bill.id});
  const conditions=city.welfare.conditions();
  if(conditions.foodDays<2)tasks.push({id:'food',title:'Abastecimento em risco',text:`Reserva de alimentos: ${Number(conditions.foodDays||0).toFixed(1)} dias.`,desk:'operations',section:'programs',action:'restock',label:'ENCOMENDAR ALIMENTOS'});
  if(conditions.homeless>0)tasks.push({id:'housing',title:'Moradia necessária',text:`${conditions.homeless} moradores sem casa.`,desk:'build',section:'programs',action:'housing',label:'PLANEJAR HABITAÇÃO'});
  for(const project of publicProjects(city))if(project.status==='blocked'||project.waitingForBasicNeeds||project.materialFundingGap>0)tasks.push({id:`project:${project.id}`,title:'Obra aguardando execução',text:project.name||`Obra #${project.id}`,target:{kind:'project',id:project.id}});
  if(gov.approval<40)tasks.push({id:'approval',title:'Governo sob pressão',text:`Aprovação em ${Math.round(gov.approval)}%. Reveja demandas antes da eleição.`,desk:'challenges'});
  if(gov.active?.status==='campaign')tasks.push({id:`election:${gov.active.id}`,title:'Campanha eleitoral aberta',text:'Organize a propaganda do partido e os atos de rua.',desk:'campaign'});
  for(const challenge of city.mayorCampaign?.challenges||[])if(challenge.status==='active'&&challenge.deadline-city.minute<1440)tasks.push({id:`deadline:${challenge.id}`,title:'Último dia do compromisso',text:challenge.title,desk:'challenges'});else if(challenge.status==='failed')tasks.push({id:`challenge:${challenge.id}`,title:'Compromisso não cumprido',text:challenge.title,desk:'challenges'});
  return tasks;
}
export function mayorOrder(ui,action,options={}) {
  const result=ui.city.mayorAction(action,options);
  ui.notice=result?'Ordem enviada. A execução usa recursos e trabalhadores da cidade.':ui.city.lastError||'Ordem não concluída.';
  return result;
}
export function mayorTargetAt(city,tile) {
  if(!tile)return null;
  const inside=p=>tile.x>=p.x&&tile.y>=p.y&&tile.x<p.x+p.width&&tile.y<p.y+p.depth;
  const lot=city.development.plots.find(inside);
  const project=publicProjects(city).find(p=>lot&&p.plotId===lot.id||p.route?.some(point=>Math.floor(point.x)===tile.x&&Math.floor(point.y)===tile.y));
  if(project)return {kind:'project',id:project.id};
  return lot&&!lot.buildingId?{kind:'plot',id:lot.id}:null;
}
export function renderMayorTarget(ui,p) {
  const city=ui.city,target=ui.mayorTarget;
  if(!mayorPlaying(city)){p.note('O controle de prefeito não está ativo.');return;}
  const act=(action,options)=>mayorOrder(ui,action,options),focus=entity=>ui.camera?.(entity.x,entity.y);
  if(target?.kind==='rally'){
    p.heading('Bandeiraço neste ponto');p.kv('Local',`${target.point.x.toFixed(1)}, ${target.point.y.toFixed(1)}`);
    p.note('Reúne militantes em uma rua próxima. Depende de horário, disponibilidade e caminho; não compra votos.');
    p.button('CONVOCAR AQUI',()=>act('rally',{point:target.point}));
  }else if(target?.kind==='building'){
    const b=city.building(target.id);
    if(!b||b.entity.destroyed){p.note('Este imóvel não está mais disponível.');return;}
    const municipal=city.fiscal.municipal(b),hall=b.id===city.townhall()?.id;
    p.heading(b.entity.properties.name);
    p.kv('Conservação / equipe',`${Math.round(b.condition??100)}% · ${b.workers.length} trabalhadores`);
    p.kv('Caixa',money(b.balance||0));
    p.buttons([{label:'LOCALIZAR',click:()=>focus(b.entity)},{label:'FICHA COMPLETA',click:()=>ui.host.inspectMayorEntity(b.entity)}]);
    const projects=publicProjects(city).filter(project=>project.buildingId===b.id||project.plotId===b.plotId);
    for(const project of projects)p.button(`OBRA #${project.id} · ACOMPANHAR`,()=>ui.host.openMayorTarget({kind:'project',id:project.id}));
    if(municipal||hall){
      p.heading('ORDENS NESTE IMÓVEL');
      if((b.condition??100)<95)p.button('CONTRATAR MANUTENÇÃO',()=>act('maintain',{buildingId:b.id}));
      p.buttons([{label:'LIMPAR',click:()=>act('service',{buildingId:b.id,service:'cleaning'})},{label:'JARDINAGEM',click:()=>act('service',{buildingId:b.id,service:'garden'})}]);
      if(municipal)p.button(`CUSTEAR ${money(city.currency.price(10000))}`,()=>act('fund',{buildingId:b.id,amount:city.currency.price(10000)}));
      if(hall||['super_popular_housing','popular_housing','popular_luxury_housing'].includes(b.type))p.button('AMPLIAR UM ANDAR',()=>act('expand',{buildingId:b.id,floors:1}));
    }
    if(typeof city.world?.getTile==='function'&&!city.politics.roadConnected(b))p.button('CONTRATAR ACESSO VIÁRIO',()=>act('road',{buildingId:b.id}));
    if(hall)p.button('ABRIR GABINETE',()=>ui.host.openMayorDesk('cabinet'));
    if(b.type==='office_tower'&&municipal)p.button('INSTALAR ATIVIDADE EM ANDAR VAGO',()=>ui.host.openMayorDesk('build','offices'));
    if(!municipal&&!hall)p.note('Imóvel privado. Gestão interna permanece com o proprietário.');
  }else if(target?.kind==='person'){
    const c=city.society.citizen(target.id);
    if(!c||c.entity.destroyed){p.note('Este morador não está mais na cidade.');return;}
    p.heading(c.entity.properties.name);
    p.kv('Moradia',c.homeUnitId?'Com moradia':'Sem moradia');
    p.kv('Saldo',money(c.balance));
    p.buttons([{label:'LOCALIZAR',click:()=>focus(c.entity)},{label:'FICHA COMPLETA',click:()=>ui.host.inspectMayorEntity(c.entity)}]);
    if(city.society.isAdult(c)&&!c.homeUnitId&&c.balance<city.currency.price(20000))p.button('CONCEDER VALE-ALUGUEL',()=>act('rentVoucher',{citizenId:c.id}));
    p.button('AVALIAR PARA O GABINETE',()=>{const desk=ui.host.openMayorDesk('cabinet');desk.mayorCandidateId=c.id;});
  }else if(target?.kind==='project'){
    const project=city.development.projects.find(project=>project.id===target.id);
    if(!project){p.note('Obra não encontrada.');return;}
    p.heading(project.name||`Obra #${project.id}`);
    p.kv('Situação',project.paused?'Pausada':project.cancelled?'Cancelada':project.status);
    p.kv('Pedra entregue',`${project.inventory?.pedra||0} / ${project.stone||0}`);
    p.meter('Progresso da obra',Math.min(100,100*(project.labor||0)/Math.max(1,project.requiredLabor||0)));
    p.kv('Trabalho executado',`${Math.floor(project.labor||0)} / ${project.requiredLabor||0}`);
    const contractor=city.building(project.builderId);
    p.kv('Construtora',contractor?.entity.properties.name||'Aguardando equipe');
    if(project.waitingForBasicNeeds)p.note('A cidade prioriza necessidades básicas antes desta obra.');
    if(project.accountId==='treasury'&&!project.cancelled&&project.status!=='completed'){
      p.button(project.paused?'RETOMAR OBRA':'PAUSAR OBRA',()=>act('pauseWork',{projectId:project.id,paused:!project.paused}));
      p.note('Pausa suspende o trabalho. Materiais contratados podem continuar chegando; recursos permanecem reservados.');
      if(project.error)p.note(project.error);
    if(project.materialStatus)p.note(project.materialStatus);
    if(project.materialFundingGap>0)p.button('REVER ORÇAMENTO NA CÂMARA',()=>ui.host.openMayorDesk('council'));
      p.heading('PRIORIDADE DE EXECUÇÃO');
      p.buttons([[10,'BAIXA'],[100,'NORMAL'],[200,'URGENTE']].map(([value,label])=>({label,selected:project.priority===value,click:()=>act('priority',{projectId:project.id,value})})));
      p.note('Prioridade não dispensa materiais, transporte ou construtores.');
    }
    const lot=city.development.plots.find(lot=>lot.id===project.plotId),point=lot||project.door||project.route?.[0];
    if(point)p.button('LOCALIZAR CANTEIRO',()=>focus(point));
    p.button('CONTRATO COMPLETO',()=>ui.host.openContract(project.id));
  }else if(target?.kind==='plot'){
    const lot=city.development.plots.find(lot=>lot.id===target.id);
    if(!lot){p.note('Terreno não encontrado.');return;}
    if(lot.projectId){p.button('ACOMPANHAR OBRA NESTE TERRENO',()=>ui.host.openMayorTarget({kind:'project',id:lot.projectId}));return;}
    p.heading(`Construir no terreno #${lot.id}`);
    p.kv('Área / proprietário',`${lot.width} × ${lot.depth} · ${city.accountName(lot.ownerId)}`);
    p.button('LOCALIZAR TERRENO',()=>focus(lot));
    if(lot.buildingId){p.note('O terreno já está edificado.');return;}
    if(lot.ownerId!=='treasury'&&!lot.forSale){p.note('Terreno privado fora de venda. Escolha outro local.');return;}
    if(lot.ownerId!=='treasury')p.note(`Compra negociada do terreno: ${money(lot.price)}.`);
    const types=Object.entries(city.buildingTypes).filter(([id])=>!['townhall','mint','council_chamber'].includes(id)&&!OFFICE_ONLY_TYPES.has(id));
    const type=ui.mayorBuildingType||'popular_housing',crop=ui.mayorCrop||'milho';
    ui.selectControl(p,'Obra no terreno selecionado',types.map(([id,spec])=>[id,spec.label]),type,value=>{ui.mayorBuildingType=value;ui.mayorPlacement=null;});
    if(type==='farm')ui.selectControl(p,'Cultura no terreno selecionado',Object.entries(city.economy.crops).map(([id,spec])=>[id,spec.label]),crop,value=>{ui.mayorCrop=value;});
    p.button('CONTRATAR AQUI',()=>act('build',{...ui.mayorPlacement,type,crop,plotId:lot.id}));
    p.note('A ordem valida este terreno. Se ele for incompatível, nenhuma obra será contratada em outro local.');
  }else p.note('Clique em um imóvel, morador ou terreno da cidade para dar ordens.');
}

/** Campaign information shares the existing desktop status bar. */
export function mayorStatus(desktop) {
  const city=desktop.city;
  if(desktop.mayorMapOrder?.mode==='rally')return 'Clique próximo de uma rua para convocar o bandeiraço · Esc cancela';
  if(desktop.mayorMapOrder)return 'Escolha um terreno destacado · Esc cancela';
  const days=Math.max(0,((city.politics.nextElectionAt??city.minute)-city.minute)/1440);
  return `Aprovação ${Math.round(city.politics.approval)}% · eleição ${days.toFixed(1)}d · obras ${money(city.politics.ensureWorksBudget())}`;
}

/** Only existing, vacant, public or advertised plots are offered for map designation. */
export function drawMayorPlots(desktop,ui,project) {
  if(!mayorPlaying(desktop.city)||!desktop.mayorMapOrder||desktop.mayorMapOrder.mode==='rally')return;
  const ctx=ui.ctx;ctx.save();ctx.beginPath();ctx.rect(0,desktop.manager.top,ui.width,Math.max(0,ui.height-desktop.manager.top-27));ctx.clip();
  for(const lot of desktop.city.development.plots){
    if(lot.buildingId||lot.projectId||lot.landingReserved||lot.ownerId!=='treasury'&&!lot.forSale)continue;
    const points=[[lot.x,lot.y],[lot.x+lot.width,lot.y],[lot.x+lot.width,lot.y+lot.depth],[lot.x,lot.y+lot.depth]].map(([x,y])=>project(x,y));
    if(points.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)))continue;
    if(points.every(p=>p.x<0)||points.every(p=>p.x>ui.width)||points.every(p=>p.y<desktop.manager.top)||points.every(p=>p.y>ui.height-27))continue;
    ctx.beginPath();points.forEach((point,index)=>index?ctx.lineTo(point.x,point.y):ctx.moveTo(point.x,point.y));ctx.closePath();
    ctx.fillStyle='rgba(231,189,89,.25)';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=T.header;ctx.stroke();
    const center=project(lot.x+lot.width/2,lot.y+lot.depth/2);
    if(center)ui.text(`#${lot.id}`,center.x-12,center.y,T.captionInk);
  }
  ctx.restore();
}

export function renderMayorChallenges(ui,p){
  const city=ui.city,rows=city.mayorCampaign.challenges||[],active=rows.find(c=>c.status==='active');
  p.note('Assuma uma meta pública de três dias. Cumprir melhora a memória dos eleitores; falhar prejudica a confiança. Sem dinheiro extra.');
  for(const row of rows.slice(-6).reverse()){
    const spec=MAYOR_CHALLENGES[row.kind],current=row.status==='active'?challengeValue(city,row.kind):row.current;
    p.status(row.title,`${{active:'Em andamento',completed:'Cumprido',failed:'Prazo esgotado'}[row.status]} · ${Number(current).toFixed(1)} / meta ${row.target}`);
    const progress=row.kind==='housing'?(row.baseline-current)/Math.max(1,row.baseline-row.target):(current-row.baseline)/Math.max(.01,row.target-row.baseline);
    p.meter('Meta',Math.max(0,Math.min(100,progress*100)));
    if(row.status==='active'){p.note(`Restam ${Math.max(0,(row.deadline-city.minute)/1440).toFixed(1)} dias.`);p.button('TRABALHAR NESTA META',()=>ui.host.openMayorDesk(spec.desk,spec.section));}
  }
  if(active)return;
  const term=city.politics.mandates.current?.id??city.mayorCampaign.startedAt;
  for(const [kind,spec]of Object.entries(MAYOR_CHALLENGES)){
    if(rows.some(c=>c.term===term&&c.kind===kind))continue;
    p.note(kind==='housing'?'Meta: reduzir em 25% os moradores sem casa em três dias.':kind==='works'?'Meta: concluir mais uma obra municipal em três dias.':'Meta: alcançar uma reserva de dois dias de alimentos em três dias.');
    p.button(`ASSUMIR: ${spec.title}`,()=>mayorOrder(ui,'challenge',{kind}));
  }
}
export function renderMayorElection(ui,p){
  const city=ui.city,s=city.mayorCampaign,e=city.politics.active,party=city.politics.party(s.partyId);
  p.kv('Partido',party?.name||s.partyName);
  p.kv('Caixa partidário',money(city.politics.partyAccount(party).balance));
  p.note('Propaganda usa dinheiro do partido, materiais, trabalhadores e caminhos reais. O tesouro não financia a campanha.');
  ui.selectControl(p,'Controle da campanha',[['automatic','Organização automática'],['manual','Eu escolho os atos e materiais']],s.campaignControl||'automatic',mode=>mayorOrder(ui,'campaignControl',{mode}));
  renderPartyActivities(ui,p,(action,options)=>mayorOrder(ui,action,options));
  if(e?.status!=='campaign'){p.note('Não há eleição em campanha. Prepare serviços e compromissos para a próxima votação.');return;}
  const n=e.candidates.find(n=>n.partyId===s.partyId);
  p.kv('Votação',`Em ${Math.max(0,(e.voteAt-city.minute)/1440).toFixed(1)} dias`);
  if(!n){p.note('Partido sem candidatura própria nesta eleição.');return;}
  p.heading(n.name);p.kv('Gasto da candidatura',money(n.campaignFinance?.spent||0));
  p.buttons([{label:'BANDEIRAÇO AUTOMÁTICO',click:()=>mayorOrder(ui,'rally')},{label:'ESCOLHER PONTO NO MAPA',click:()=>ui.host.armMayorPlot({mode:'rally'})}]);
  const kinds={pamphlet:'Distribuir panfletos',flag:'Instalar bandeira',banner:'Faixa autorizada',paint:'Pintura autorizada'};
  ui.selectControl(p,'Ação de propaganda',Object.entries(kinds),ui.mayorMaterialKind||'pamphlet',value=>{ui.mayorMaterialKind=value;});
  p.button('CONTRATAR PROPAGANDA',()=>mayorOrder(ui,'campaignMaterial',{kind:ui.mayorMaterialKind||'pamphlet'}));
  p.note('Um contrato por material e candidatura a cada dia, entre 7h e 22h. Bandeiraço: uma convocação por hora, entre 7h e 20h.');
  const missions=city.politics.campaigns.getMaterials().missions.filter(m=>m.electionId===e.id&&m.partyId===s.partyId);
  p.heading('EXECUÇÃO DA CAMPANHA');
  for(const m of missions.slice(-5).reverse())p.note(`${kinds[m.kind]||m.kind} · ${m.status} · pago ${money(m.paid||0)}${m.reason?` · ${m.reason}`:''}`);
  if(!missions.length)p.note('Nenhum contrato de propaganda nesta eleição.');
  p.windowLink('PESQUISAS E DEBATES',()=>ui.openPanel({tab:'government',views:{government:'elections'},politicsTab:'campaign'}));
}
