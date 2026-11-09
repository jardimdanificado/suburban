import { formatMoney } from './city_ui_format.js';
import {BOAT_CLASSES} from './city_water_transport.js?v=regional-supply-3';
import {INTERCITY_BOAT_CLASSES} from './boat_types.js?v=local-sea-travel-2';

const labelCity=session=>session?.metadata?.name||session?.id||'Cidade';
const amount=cents=>formatMoney(cents||0);
const cleanSelect=(state,key,items,current,changed)=>state.selectControl(state.worldPage,key,items,current,changed);

function numberInput(state,p,key,label,initial,min,max){
  state.dynamicSelects??={};
  let input=state.dynamicSelects[key];
  if(!input){input=document.createElement('input');input.type='number';input.setAttribute('aria-label',label);input.value=String(initial);state.dynamicSelects[key]=input;input.addEventListener('pointerdown',()=>state.host?.manager.raise(state.windowId));}
  input.min=String(min);input.max=String(max);input.step='1';
  p.note(label);
  if(p.y>=p.top&&p.y+20<=p.bottom)state.inputAt(input,p.x,p.y,p.w);p.space(24);
  return input;
}

function commonControls(state,p,world,cities){
  const selected=world.cities.get(world.activeCityId);
  p.status('MUNDO MULTICIDADES',`${cities.length} cidade${cities.length===1?'':'s'} · ${world.routes.size} rotas · relógio global ${Math.floor(world.minute/1440)+1}º dia`);
  if(cities.length){
    cleanSelect(state,'world:activeCity',cities.map(session=>[session.id,labelCity(session)]),world.activeCityId,id=>state.worldActions?.selectCity?.(id));
    p.kv('Cidade observada',labelCity(selected));
  }
  p.buttons([
    {label:'FUNDAR CIDADE',click:()=>state.worldActions?.newCity?.()},
    {label:'SALVAR MUNDO',click:()=>state.worldActions?.save?.()},
    {label:'CARREGAR MUNDO',click:()=>state.worldActions?.load?.()},
  ]);
  if(state.worldNotice)p.note(state.worldNotice);
}

function routesView(state,p,world){
  p.heading('PORTOS');
  if(!world.ports.size)p.note('Nenhum porto registrado.');
  for(const port of world.ports.values()){
    const session=world.cities.get(port.cityId),berth=session?.city.worldPort?.berth;
    const fleet=Object.keys(BOAT_CLASSES).map(kind=>`${session?.city.citizens.filter(person=>person.boatClass===kind).length||0} ${BOAT_CLASSES[kind].label.toLowerCase()}`).join(' · ');
    p.record(labelCity(session),`Porto municipal · cais ${berth?`${berth.x}, ${berth.y}`:'costeiro'} · acesso ${port.x}, ${port.y} · viagens locais ativas: ${fleet}`,null,false,{value:port.id});
  }
  p.heading('FROTAS E ROTAS MARÍTIMAS');
  if(!world.routes.size)p.note('As rotas aparecem quando houver pelo menos duas cidades.');
  for(const route of world.routes.values()){
    const ships=[...world.vessels.values()].filter(vessel=>vessel.routeId===route.id||vessel.id.startsWith(`vessel:${route.id}:`)),fleet=Object.keys(INTERCITY_BOAT_CLASSES).map(kind=>`${ships.filter(vessel=>vessel.classId===kind).length} ${INTERCITY_BOAT_CLASSES[kind].label.toLowerCase()}`).join(' · ');
    p.record(`${labelCity(world.cities.get(route.originCityId))} → ${labelCity(world.cities.get(route.destinationCityId))}`,`${route.travelMinutes} min · capacidade por viagem ${route.capacity} · frete ${amount(route.freightPerUnit)}/unidade · ${fleet}`,null,false,{value:route.id});
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
  const options=cities.map(session=>[session.id,labelCity(session)]);
  state.worldOrigin??=world.activeCityId;
  cleanSelect(state,'world:origin',options,state.worldOrigin,id=>{state.worldOrigin=id;state.worldSeller=null;state.worldGood=null;});
  const destinations=cities.filter(session=>session.id!==state.worldOrigin),destinationOptions=destinations.map(session=>[session.id,labelCity(session)]);
  state.worldDestination=destinationOptions.some(([id])=>id===state.worldDestination)?state.worldDestination:destinationOptions[0]?.[0];
  cleanSelect(state,'world:destination',destinationOptions,state.worldDestination,id=>{state.worldDestination=id;state.worldBuyer=null;});
  const origin=world.cities.get(state.worldOrigin),destination=world.cities.get(state.worldDestination);
  const sellers=(origin?.city.buildings||[]).filter(building=>building.active&&!building.entity.destroyed&&Object.values(building.inventory||{}).some(quantity=>quantity>0));
  state.worldSeller=sellers.some(building=>String(building.id)===String(state.worldSeller))?state.worldSeller:String(sellers[0]?.id??'');
  cleanSelect(state,'world:seller',sellers.map(building=>[String(building.id),building.entity.properties.name||`${building.type} #${building.id}`]),state.worldSeller,id=>{state.worldSeller=id;state.worldGood=null;});
  const seller=sellers.find(building=>String(building.id)===String(state.worldSeller));
  const goods=Object.keys(seller?.inventory||{}).filter(good=>(seller.inventory[good]||0)>0&&origin?.city.economy.goods[good]);
  state.worldGood=goods.includes(state.worldGood)?state.worldGood:goods[0];
  cleanSelect(state,'world:good',goods.map(good=>[good,origin.city.economy.goods[good].label||good]),state.worldGood,good=>{state.worldGood=good;});
  const buyers=(destination?.city.buildings||[]).filter(building=>building.active&&!building.entity.destroyed&&building.accountId&&destination.city.economy.accepts(building,state.worldGood));
  state.worldBuyer=buyers.some(building=>String(building.id)===String(state.worldBuyer))?state.worldBuyer:String(buyers[0]?.id??'');
  cleanSelect(state,'world:buyer',buyers.map(building=>[String(building.id),building.entity.properties.name||`${building.type} #${building.id}`]),state.worldBuyer,id=>{state.worldBuyer=id;});
  const route=world.routes.get(`route:${state.worldOrigin}>${state.worldDestination}`),stock=seller?.inventory?.[state.worldGood]||0;
  const quantity=numberInput(state,p,'world:quantity','Quantidade da carga',Math.max(1,Math.min(12,stock||1)),1,Math.max(1,Math.min(route?.capacity||1,stock||1)));
  const priceKey=`${state.worldOrigin}:${state.worldSeller}:${state.worldGood}`;
  if(state.worldPriceSelection!==priceKey){state.worldPriceSelection=priceKey;if(state.dynamicSelects?.['world:price'])state.dynamicSelects['world:price'].value=String(Math.max(1,Math.ceil(origin?.city.economy.goods[state.worldGood]?.price||1)));}
  const price=numberInput(state,p,'world:price','Preço por unidade (centavos)',Math.max(1,Math.ceil(origin?.city.economy.goods[state.worldGood]?.price||1)),1,100000000);
  const ready=!!service&&!!route&&!!seller&&!!buyers.length&&!!goods.length&&Number(quantity.value)>=1&&Number(price.value)>=1;
  if(ready)p.buttons([
    {label:'RESERVAR CARGA',click:async()=>{state.worldSequence=(state.worldSequence||0)+1;try{const trip=await service.schedule({id:`world-trade:${Date.now()}:${state.worldSequence}`,originCityId:state.worldOrigin,destinationCityId:state.worldDestination,sellerBuildingId:seller.id,destinationBuildingId:Number(state.worldBuyer),good:state.worldGood,quantity:Number(quantity.value),unitPrice:Number(price.value),departureMinute:world.minute+1});state.worldNotice=`Carga reservada. Total ${amount(trip.payload.amount)}; frete ${amount(trip.payload.freightAmount)}.`;}catch(error){state.worldNotice=error.message;}}},
    {label:'CONTRATO DIÁRIO',click:()=>{state.worldSequence=(state.worldSequence||0)+1;try{const id=`world-contract:${Date.now()}:${state.worldSequence}`;const contract=service.createContract({id,routeId:route.id,sellerBuildingId:seller.id,destinationBuildingId:Number(state.worldBuyer),good:state.worldGood,quantity:Number(quantity.value),unitPrice:Number(price.value),intervalMinutes:1440,nextDepartureMinute:world.minute+1});state.worldNotice=`Contrato diário criado para ${contract.quantity} ${contract.good}.`;}catch(error){state.worldNotice=error.message;}}},
  ]);
  else p.note('Selecione rota, produto, vendedor e comprador válidos para habilitar o embarque.');
  p.note('O abastecimento regional automático embarca excedentes reais quando há estoque local e demanda na cidade de destino.');
  p.heading('CONTRATOS E CARGAS');
  for(const contract of [...world.contracts.values()].slice(-8).reverse()){
    p.record(`${contract.good} · ${contract.quantity} unidades`,`${labelCity(world.cities.get(world.routes.get(contract.routeId)?.originCityId))} → ${labelCity(world.cities.get(world.routes.get(contract.routeId)?.destinationCityId))} · ${contract.active?'ativo':'pausado'}`,null,false,{value:amount(contract.unitPrice)});
    if(contract.active)p.button(`PAUSAR CONTRATO ${contract.id}`,()=>service.cancelContract(contract.id));
  }
  for(const transfer of [...world.transfers.values()].filter(item=>item.kind==='goods').slice(-8).reverse())p.record(`${transfer.payload.quantity} × ${transfer.payload.good}`,`${labelCity(world.cities.get(transfer.originCityId))} → ${labelCity(world.cities.get(transfer.destinationCityId))} · ${transfer.status}`,null,false,{value:amount(transfer.payload.amount)});
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
  else routesView(state,p,world);
}
