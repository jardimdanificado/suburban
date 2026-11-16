import {publicProjects} from './city_mayor_campaign.js';
import {OFFICE_ONLY_TYPES} from './city_offices.js?v=office-demand-rollout-1';
import {formatMoney as money} from './city_ui_format.js';
import {MANAGEMENT_THEME as T,bevel} from './management_ui.js';

export const mayorPlaying = city => city.mayorCampaign?.mode==='play'&&city.mayorCampaign.status==='active';
export const MAYOR_DESKS = {agenda:'Agenda do prefeito',build:'Obras e território',operations:'Serviços municipais',cabinet:'Gabinete',policies:'Políticas públicas',council:'Decisões da Câmara',orders:'Ordens emitidas'};

/** Actionable notices are derived from the current simulation, never from invented missions. */
export function mayorDecisions(city) {
  const tasks=[],gov=city.politics;
  for(const bill of gov.council.bills.filter(b=>b.status==='awaiting-sanction'))tasks.push({id:`bill:${bill.id}`,title:'Sanção ou veto',text:bill.title,desk:'council',billId:bill.id});
  const conditions=city.welfare.conditions();
  if(conditions.foodDays<2)tasks.push({id:'food',title:'Abastecimento em risco',text:`Reserva de alimentos: ${Number(conditions.foodDays||0).toFixed(1)} dias.`,desk:'operations',section:'programs',action:'restock',label:'ENCOMENDAR ALIMENTOS'});
  if(conditions.homeless>0)tasks.push({id:'housing',title:'Moradia necessária',text:`${conditions.homeless} moradores sem casa.`,desk:'build',section:'programs',action:'housing',label:'PLANEJAR HABITAÇÃO'});
  for(const project of publicProjects(city))if(project.status==='blocked'||project.waitingForBasicNeeds)tasks.push({id:`project:${project.id}`,title:'Obra aguardando execução',text:project.name||`Obra #${project.id}`,target:{kind:'project',id:project.id}});
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
  if(target?.kind==='building'){
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
    p.kv('Situação',project.cancelled?'Cancelada':project.status);
    p.kv('Pedra entregue',`${project.inventory?.pedra||0} / ${project.stone||0}`);
    p.kv('Trabalho executado',`${Math.floor(project.labor||0)} / ${project.requiredLabor||0}`);
    const contractor=city.building(project.builderId);
    p.kv('Construtora',contractor?.entity.properties.name||'Aguardando equipe');
    if(project.waitingForBasicNeeds)p.note('A cidade prioriza necessidades básicas antes desta obra.');
    if(project.accountId==='treasury'&&!project.cancelled&&project.status!=='completed'){
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

/** Always-visible controls leave the map playable even when every management window is closed. */
export function drawMayorDock(desktop,ui,y) {
  const city=desktop.city;
  if(!mayorPlaying(city))return y;
  const pending=mayorDecisions(city),days=Math.max(0,((city.politics.nextElectionAt??city.minute)-city.minute)/1440);
  const labels=[['MAPA',()=>{desktop.mayorMapOrder=null;desktop.hidden=true;desktop.element.hidden=true;}],['CONSTRUIR',()=>desktop.openMayorDesk('build','new')],['SERVIÇOS',()=>desktop.openMayorDesk('operations','services')],['GABINETE',()=>desktop.openMayorDesk('cabinet')],['POLÍTICAS',()=>desktop.openMayorDesk('policies')],[`DECISÕES (${pending.length})`,()=>desktop.openMayorDesk('agenda')]];
  const columns=Math.min(6,Math.max(2,Math.floor((ui.width-8)/110))),rows=Math.ceil(labels.length/columns),height=27+rows*27;
  bevel(ui.ctx,0,y,ui.width,height,{fill:T.face});
  const status=desktop.mayorMapOrder?'ESCOLHA UM TERRENO DESTACADO · clique para revisar a obra · Esc cancela':`PREFEITO · aprovação ${Math.round(city.politics.approval)}% · eleição em ${days.toFixed(1)} dias · obras ${money(city.politics.ensureWorksBudget())}`;
  ui.text(ui.fitText(status,ui.width-18),8,y+7,T.ink);
  const width=Math.floor((ui.width-8)/columns);
  labels.forEach(([label,click],index)=>{
    ui.button(4+(index%columns)*width,y+25+Math.floor(index/columns)*27,width-3,24,label,click);
    if(ui.regions.at(-1))ui.regions.at(-1).label=label;
  });
  return y+height;
}

/** Only existing, vacant, public or advertised plots are offered for map designation. */
export function drawMayorPlots(desktop,ui,project) {
  if(!mayorPlaying(desktop.city)||!desktop.mayorMapOrder)return;
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
