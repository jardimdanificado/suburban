import { formatMoney } from './city_ui_format.js';
import {UI_COLORS as C} from './city_ui_widgets.js';
import {BOAT_CLASSES} from './city_water_transport.js?v=regional-supply-3';
import {INTERCITY_BOAT_CLASSES} from './boat_types.js?v=local-sea-travel-2';

const labelCity=session=>{
  const official=session?.city?.municipalIdentity?.name;
  if(official&& !/^Cidade\s+\d+$/i.test(official))return official;
  const stored=session?.metadata?.name;
  if(stored&& !/^Cidade\s+\d+$/i.test(stored))return stored;
  return session?.city?.politics?.ensureMunicipalIdentity?.().name||session?.id||'Cidade';
};
const amount=cents=>formatMoney(cents||0);
const cleanSelect=(state,key,label,items,current,changed)=>{state.worldPage.note(label);state.selectControl(state.worldPage,key,items,current,changed);};

function commonControls(state,p,world,cities){
  const selected=world.cities.get(world.activeCityId);
  p.status('MUNDO MULTICIDADES',`${cities.length} cidade${cities.length===1?'':'s'} · ${world.routes.size} rotas · relógio global ${Math.floor(world.minute/1440)+1}º dia`);
  if(cities.length){
    cleanSelect(state,'world:activeCity','CIDADE OBSERVADA',cities.map(session=>[session.id,labelCity(session)]),world.activeCityId,id=>state.worldActions?.selectCity?.(id));
    p.kv('Cidade observada',labelCity(selected));
  }
  p.buttons([
    {label:'FUNDAR CIDADE',click:()=>state.worldActions?.newCity?.()},
    {label:'SALVAR MUNDO',click:()=>state.worldActions?.save?.()},
    {label:'CARREGAR MUNDO',click:()=>state.worldActions?.load?.()},
  ]);
  if(state.worldNotice)p.note(state.worldNotice);
}

function citiesView(state,p,world,cities){
  p.heading('CIDADES E PORTOS MUNICIPAIS');
  if(!cities.length){p.note('Nenhuma cidade registrada.');return;}
  for(const session of cities){
    const port=world.ports.get(`${session.id}:port`),harbor=session.city.worldPort,berth=harbor?.berth,people=session.city.citizens?.filter(person=>!person.entity.destroyed).length||0,active=world.activeCityId===session.id;
    p.record(labelCity(session),`${people} habitantes · ${session.metadata.preset||'arquipélago'} · ${active?'cidade observada':'cidade disponível'}`,()=>state.worldActions?.selectCity?.(session.id),active,{value:port?'PORTO ATIVO':'SEM PORTO'});
    if(port)p.note(`Porto municipal · cais ${berth?`${berth.x}, ${berth.y}`:'costeiro'} · acesso terrestre ${port.x}, ${port.y}`);
  }
}

function fleetView(p,world){
  p.heading('FROTA ENTRE CIDADES');
  if(!world.vessels.size)p.note('Nenhuma embarcação intermunicipal registrada.');
  for(const route of world.routes.values()){
    const ships=[...world.vessels.values()].filter(vessel=>vessel.routeId===route.id||vessel.id.startsWith(`vessel:${route.id}:`));
    p.heading(`${labelCity(world.cities.get(route.originCityId))} ↔ ${labelCity(world.cities.get(route.destinationCityId))}`);
    for(const vessel of ships){const port=world.ports.get(vessel.currentPortId),status={idle:'atracada',reserved:'reservada para embarque','at-sea':'em viagem',returning:'retornando'}[vessel.status]||vessel.status;p.record(INTERCITY_BOAT_CLASSES[vessel.classId]?.label||'Embarcação',`${vessel.capacity} lugares/unidades · ${status} · ${port?labelCity(world.cities.get(port.cityId)):'em rota'}`,null,false,{value:vessel.id});}
  }
  p.heading('EMBARCAÇÕES LOCAIS');
  for(const session of world.cities.values()){
    const boats=[...(session.city.vehicles?.units?.values?.()||[])].filter(vessel=>vessel.boatClass&&vessel.active&&!vessel.scrapped);
    p.heading(labelCity(session));
    if(!boats.length){p.note('Nenhuma embarcação local registrada.');continue;}
    for(const kind of Object.keys(BOAT_CLASSES)){const group=boats.filter(vessel=>vessel.boatClass===kind);if(group.length)p.record(BOAT_CLASSES[kind].label,`${group.length} unidade${group.length===1?'':'s'} · ${group.filter(vessel=>vessel.driverId).length} em uso · ${group.filter(vessel=>!vessel.driverId).length} atracada${group.filter(vessel=>!vessel.driverId).length===1?'':'s'}`,null,false,{value:`${labelCity(session)} · ${kind}`});}
  }
}

function routesView(p,world){
  p.heading('ROTAS MARÍTIMAS E VIAGENS');
  if(!world.routes.size)p.note('As rotas aparecem quando houver pelo menos duas cidades.');
  for(const route of world.routes.values()){
    const ships=[...world.vessels.values()].filter(vessel=>vessel.routeId===route.id||vessel.id.startsWith(`vessel:${route.id}:`)),fleet=Object.keys(INTERCITY_BOAT_CLASSES).map(kind=>`${ships.filter(vessel=>vessel.classId===kind).length} ${INTERCITY_BOAT_CLASSES[kind].label.toLowerCase()}`).join(' · ');
    p.record(`${labelCity(world.cities.get(route.originCityId))} → ${labelCity(world.cities.get(route.destinationCityId))}`,`${route.travelMinutes} min · limite ${route.capacity} unidades · frete ${amount(route.freightPerUnit)}/unidade · ${fleet}`,null,false,{value:route.id});
    for(const transfer of [...world.transfers.values()].filter(item=>item.routeId===route.id&&['scheduled','departing','in-transit','arriving'].includes(item.status))){
      const vessel=world.vessels.get(transfer.vesselId),kind=INTERCITY_BOAT_CLASSES[vessel?.classId]?.label||'barco',start=transfer.departureMinute,end=transfer.arrivalMinute,progress=transfer.status==='scheduled'?0:Math.max(0,Math.min(100,Math.floor((world.minute-start)/Math.max(1,end-start)*100))),manifest=transfer.kind==='citizen'?`${transfer.payload.package?.version===2?transfer.payload.package.members.length:1} morador(es)`: `${transfer.payload.quantity} × ${transfer.payload.good}`;
      p.record(`Embarcação · ${kind}`,`${manifest} · ${transfer.status==='scheduled'?'aguardando embarque':transfer.status==='in-transit'?`no mar · ${progress}%`:transfer.status}`,null,false,{value:`${labelCity(world.cities.get(transfer.originCityId))} → ${labelCity(world.cities.get(transfer.destinationCityId))}`});
    }
    for(const vessel of ships.filter(item=>item.status==='returning')){const progress=Math.max(0,Math.min(100,Math.floor((1-(vessel.returnMinute-world.minute)/Math.max(1,route.travelMinutes))*100)));p.record(`Embarcação retornando · ${INTERCITY_BOAT_CLASSES[vessel.classId]?.label||'barco'}`,`Vazia para ${labelCity(world.cities.get(route.originCityId))} · ${progress}%`,null,false,{value:vessel.id});}
  }
}

function tradeView(state,p,world,cities){
  const service=state.worldTradeService;
  if(cities.length<2){p.note('Funde uma segunda cidade para abrir rotas comerciais.');return;}
  state.worldTradeTab??='demand';p.links([{label:'DEMANDA REGIONAL',selected:state.worldTradeTab==='demand',click:()=>{state.worldTradeTab='demand';state.resetScroll();}},{label:'ENVIOS E CONTRATOS',selected:state.worldTradeTab==='records',click:()=>{state.worldTradeTab='records';state.resetScroll();}}]);
  if(state.worldTradeTab==='records'){
    p.heading('CONTRATOS RECORRENTES');const contracts=[...world.contracts.values()].slice().reverse();
    if(!contracts.length)p.note('Nenhum contrato recorrente cadastrado.');
    for(const contract of contracts){const route=world.routes.get(contract.routeId),from=world.cities.get(route?.originCityId),to=world.cities.get(route?.destinationCityId),good=from?.city.economy.goods[contract.good]?.label||contract.good;p.record(`${contract.quantity} × ${good}`,`${labelCity(from)} → ${labelCity(to)} · ${contract.active?'ativo':'encerrado'}`,null,false,{value:`${amount(contract.unitPrice)} / unidade`});if(contract.active)p.button('ENCERRAR CONTRATO',()=>service?.cancelContract(contract.id));}
    p.heading('ENVIOS REALIZADOS');const transfers=[...world.transfers.values()].filter(item=>item.kind==='goods').slice().reverse();
    if(!transfers.length)p.note('Nenhum produto foi enviado entre cidades.');
    for(const transfer of transfers.slice(0,30)){const from=world.cities.get(transfer.originCityId),good=from?.city.economy.goods[transfer.payload.good]?.label||transfer.payload.good;p.record(`${transfer.payload.quantity} × ${good}`,`${labelCity(from)} → ${labelCity(world.cities.get(transfer.destinationCityId))} · ${transfer.status}`,null,false,{value:amount(transfer.payload.amount)});}
    return;
  }
  p.status('ABASTECIMENTO AUTOMÁTICO','A cada 15 minutos, o sistema compara excedentes das cidades de origem com empresas que precisam desses produtos. Quando encontra uma combinação válida, reserva a carga e envia o barco.',C.cyan);
  const activeTransfers=[...world.transfers.values()].filter(item=>item.kind==='goods'&&['scheduled','departing','in-transit','arriving'].includes(item.status)).sort((a,b)=>a.departureMinute-b.departureMinute);
  p.metrics([['ROTAS',world.routes.size],['CARGAS EM VIAGEM',activeTransfers.length],['CONTRATOS ATIVOS',[...world.contracts.values()].filter(contract=>contract.active).length]]);
  p.heading('DEMANDAS QUE PODEM GERAR EMBARQUES');
  const opportunities=service?.regionalTradePreview?.()||[];
  if(!opportunities.length)p.note('Nenhuma rota tem agora, ao mesmo tempo, estoque excedente no fornecedor e demanda válida no destino. Novas combinações são avaliadas automaticamente a cada hora.');
  for(const item of opportunities){const good=item.origin.city.economy.goods[item.good]?.label||item.good,freight=amount(item.quantity*item.route.freightPerUnit);p.card(`${item.quantity} × ${good}`,`${labelCity(item.origin)} → ${labelCity(item.destination)}\n${item.seller.entity.properties.name} → ${item.buyer.entity.properties.name}\nEstoque excedente ${item.surplus} · necessidade ${item.need} · frete estimado ${freight}`,null,false,C.cyan);}
  p.heading('CARGAS JÁ RESERVADAS');
  if(!activeTransfers.length)p.note('Ainda não há cargas reservadas ou em viagem.');
  for(const transfer of activeTransfers){const origin=world.cities.get(transfer.originCityId),destination=world.cities.get(transfer.destinationCityId),good=origin?.city.economy.goods[transfer.payload.good]?.label||transfer.payload.good,buyer=destination?.city.building(transfer.payload.destinationBuildingId),vessel=world.vessels.get(transfer.vesselId),status={scheduled:'aguardando embarque',departing:'carregando', 'in-transit':'no mar',arriving:'chegando ao porto'}[transfer.status]||transfer.status;p.record(`${transfer.payload.quantity} × ${good}`,`${labelCity(origin)} → ${labelCity(destination)} · ${buyer?.entity.properties.name||'comprador'} · ${status}`,null,false,{value:INTERCITY_BOAT_CLASSES[vessel?.classId]?.label||'embarcação'});}
}

function migrationView(state,p,world){
  p.status('MIGRAÇÃO AUTÔNOMA','Os moradores com dificuldade de moradia, trabalho ou bem-estar podem escolher outra cidade quando houver oportunidades e espaço. Famílias elegíveis viajam juntas.');
  const transfers=[...world.transfers.values()].filter(item=>item.kind==='citizen').sort((a,b)=>b.createdAt-a.createdAt).slice(0,20);
  p.heading(`VIAGENS DE MORADORES / ${[...world.transfers.values()].filter(item=>item.kind==='citizen').length}`);
  if(!transfers.length)p.note('Nenhuma migração entre cidades aconteceu ainda.');
  for(const transfer of transfers){
    const count=transfer.payload.package?.version===2?transfer.payload.package.members.length:1;
    const reason={work:'busca por trabalho',housing:'busca por moradia',wellbeing:'busca por bem-estar'}[transfer.payload.reason]||'decisão do morador';
    p.record(`${count} ${count===1?'morador':'moradores'}`,`${labelCity(world.cities.get(transfer.originCityId))} → ${labelCity(world.cities.get(transfer.destinationCityId))} · ${reason} · ${transfer.status}`,null,false,{value:'migração autônoma'});
  }
}

export function renderWorldManagement(state,p){
  const world=state.worldCoordinator,cities=[...(world?.cities.values()||[])];state.worldPage=p;
  if(!world){p.note('Coordenador mundial indisponível.');return;}
  commonControls(state,p,world,cities);
  if(state.view()==='trade')tradeView(state,p,world,cities);
  else if(state.view()==='migration')migrationView(state,p,world);
  else if(state.view()==='fleet')fleetView(p,world);
  else if(state.view()==='routes')routesView(p,world);
  else citiesView(state,p,world,cities);
}
