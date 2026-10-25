import {VEHICLE_SPECS,VEHICLE_RECIPES} from './city_vehicles.js';
import {formatMoney as money} from './city_ui_format.js';
import {UI_COLORS as C} from './city_ui_widgets.js';
const title=v=>VEHICLE_SPECS[v.good]?.label||v.good;
export function renderVehicle(ui,p,v){
  const city=ui.city,system=city.vehicles,model=system.model(v),spec=VEHICLE_SPECS[v.good];
  p.heading(`${title(v)} #${v.id}`);p.status(model?.brand||'Montadora',model?.name||'Modelo sem identificação');
  p.metrics([['CONSERVAÇÃO',`${v.condition.toFixed(0)}%`,v.condition<30?C.red:C.green],['AUTONOMIA',`${v.fuel.toFixed(0)} de reserva`,v.fuel<10?C.red:C.cyan]]);
  p.kv('Proprietário',city.accountName(v.ownerAccountId));if(!v.active)p.kv('Preço de venda',money(system.vehiclePrice(v)));p.kv('Situação',!v.active?'No estoque':v.status||(v.journey?'Em viagem':'Estacionado'));
  p.kv('Combustível','Óleo de girassol');p.kv('Altitude / faixa',`${(v.altitude||0).toFixed(1)} / ${v.flightLevel??'Solo'}`);p.kv('Controle de voo',v.flightFault?'Falha de controle':'Operante');p.kv('Espera no ar',`${(v.airWait||0).toFixed(1)} s`);p.kv('Óleo no tanque / a receber',`${v.fuelStore?.inventory[v.fuelGood]||0} / ${v.fuelStore?.incoming[v.fuelGood]||0}`);
  p.kv('Distância percorrida',`${v.distance.toFixed(1)} células`);p.kv('Lugares / carga',`${spec.seats} pessoas / ${spec.cargo} itens`);p.kv('Lote de fabricação',v.batchId??'Produção artesanal');
  if(v.entity)p.button('LOCALIZAR VEÍCULO',()=>ui.camera(v.entity.x,v.entity.y));
  if(v.driverId)p.button(`MOTORISTA: ${city.accountName(`citizen:${v.driverId}`)}`,()=>ui.openCitizen(v.driverId));
  for(const id of v.passengerIds)p.record(city.accountName(`citizen:${id}`),'Passageiro',()=>ui.openCitizen(id));
  p.heading('PEÇAS E FORNECEDORES');
  p.table([{label:'Peça',weight:2},{label:'Quantidade'},{label:'Fabricante',weight:2},{label:'Revisão'}],(model?.components||[]).map(part=>({cells:[city.economy.goods[part.good]?.label||part.good,part.quantity,city.building(part.producerId)?.entity.properties.name||String(part.producerId),part.design],click:()=>ui.openBuilding(part.producerId)})));
  ui.section(p,'vehicleOwnership','Histórico de proprietários',()=>{for(const row of v.ownershipHistory||[])p.record(`Dia ${Math.floor(row.minute/1440)+1} · ${city.accountName(row.to)}`,`${city.accountName(row.from)} → ${city.accountName(row.to)} · ${row.reason||money(row.price)}`);});
  p.button('HISTÓRICO DO VEÍCULO',()=>ui.openHistory(`vehicleId:${v.id}`));
}
export function renderAssembly(ui,p,b){
  const system=ui.city.vehicles,plan=system.recipeFor(b);if(!plan)return;
  p.heading('LOTES E MODELOS');p.kv('Marca',b.entity.properties.name);p.kv('Próximo tipo',VEHICLE_SPECS[plan.good].label);p.kv('Pacote por lote',`${b.vehicleBatchSize?'':'Até '}${plan.size} veículos${b.vehicleBatchSize?'':' (automático)'}`);
  p.note('Cada lote usa um fabricante e uma revisão por peça. Trocar uma peça, fornecedor ou revisão registra outro modelo. Os componentes chegam por transporte.');
  p.button('PLANEJAMENTO AUTOMÁTICO DA PRODUÇÃO',()=>system.configureAssembly(b.id,'auto',3),!b.vehicleKind);
  p.buttons(['carro','caminhao','onibus'].map(kind=>({label:VEHICLE_SPECS[kind].label,selected:plan.good===kind,click:()=>system.configureAssembly(b.id,kind,b.vehicleBatchSize||3)})));
  p.buttons([1,3,6,12].map(size=>({label:`LOTE ${size}`,selected:plan.size===size,click:()=>system.configureAssembly(b.id,plan.good,size)})));
  if(b.vehicleAssembly){const batch=b.vehicleAssembly;p.meter(`Montagem do lote ${batch.id}`,100*batch.labor/batch.requiredLabor);p.kv('Unidades no lote',batch.quantity);}
  p.table([{label:'Componente',weight:2},{label:'Por lote'},{label:'No estoque'},{label:'Em frete'}],Object.entries(VEHICLE_RECIPES[plan.good]).map(([g,n])=>({cells:[ui.city.economy.goods[g].label,n*plan.size,b.inventory[g],b.incoming[g]]})));
}
export function renderMobility(ui,p){
  const city=ui.city,system=city.vehicles,view=ui.view(),units=[...system.units.values()].filter(v=>!v.scrapped);
  if(ui.selectedVehicleId!=null){const v=system.units.get(ui.selectedVehicleId);if(v){p.button('VOLTAR À FROTA',()=>ui.openPanel({selectedVehicleId:null}));renderVehicle(ui,p,v);return;}}
  if(view==='airspace'){
    const air=system.air;
    p.heading('TRÁFEGO AÉREO');p.metrics([['EM VOO',air.stats.airborne],['AGUARDANDO',air.stats.holding],['CONFLITOS EVITADOS',air.stats.avoided],['ACIDENTES',air.stats.accidents,C.red]]);
    p.kv('Pousos de emergência',air.stats.emergencies);p.kv('Base das faixas de cruzeiro',`${air.ceiling().toFixed(1)} de altitude absoluta`);
    p.note('Oito faixas de altitude, separadas por três unidades. Sentidos opostos usam níveis distintos. O controle prevê aproximações, dá prioridade a quem aguarda e retém decolagens ou pousos em conflito.');
    p.note('Falhas em veículos mal conservados podem comprometer o desvio. Acidentes exigem colisão física e causam danos, feridos e pousos de emergência.');
    p.table([{label:'Veículo',weight:2},{label:'Altitude'},{label:'Fase',weight:2},{label:'Espera'}],units.filter(v=>v.active).map(v=>({cells:[`${title(v)} #${v.id}`,(v.altitude||0).toFixed(1),v.status||'Estacionado',`${(v.airWait||0).toFixed(1)} s`],click:()=>ui.openPanel({selectedVehicleId:v.id})})));
    p.heading('REGISTRO DE ACIDENTES');
    if(!air.accidents.length)p.note('Nenhum acidente registrado.');
    for(const a of air.accidents.slice().reverse())p.block(`Acidente ${a.id} · dia ${Math.floor(a.minute/1440)+1}`,a.cause,q=>{q.kv('Veículos',a.vehicleIds.join(' e '));q.kv('Feridos',a.injured);q.kv('Altitude da colisão',a.altitude.toFixed(1));q.button('LOCALIZAR',()=>ui.camera(a.x,a.y));for(const id of a.vehicleIds)q.button(`VER VEÍCULO ${id}`,()=>ui.openPanel({selectedVehicleId:id}));for(const id of a.citizenIds)q.record(city.accountName(`citizen:${id}`),'Ocupante envolvido',()=>ui.openCitizen(id));});return;
  }
  if(view==='lines'){
    p.heading('TRANSPORTE COLETIVO AÉREO');p.metrics([['LINHAS',system.lines.length],['VIAGENS DE PASSAGEIROS',system.stats.passengers],['TARIFAS',money(system.stats.fares)]]);
    if(!system.lines.length)p.note('Uma empresa de ônibus precisa comprar um veículo, contratar motorista e ter pelo menos dois áreas de embarque e pouso.');
    for(const line of system.lines){const company=city.building(line.companyId);p.block(`LINHA ${line.id} · ${company?.entity.properties.name||'Empresa ausente'}`,({'waiting-driver':'Aguardando motorista','boarding-driver':'Motorista a caminho','operating':'Em operação','fuel-or-route':'Aguardando combustível ou rota','unpaid-driver':'Sem caixa para o motorista','maintenance':'Em manutenção'})[line.status]||line.status,q=>{
      q.kv('Tarifa / passageiros transportados',`${money(line.fare)} / ${line.passengers}`);q.kv('Receita da linha',money(line.revenue));q.kv('Passageiros a bordo',system.units.get(line.vehicleId)?.passengerIds.length||0);
      q.button('VER ÔNIBUS AÉREO E PILOTO',()=>ui.openPanel({selectedVehicleId:line.vehicleId}));for(const [i,stop]of line.stops.entries())q.record(`Ponto ${i+1}${i===line.current?' · atual':''}`,`${stop.x.toFixed(0)}, ${stop.y.toFixed(0)}`,()=>ui.camera(stop.x,stop.y));
    });}return;
  }
  if(view==='models'){
    p.heading('MONTADORAS, MODELOS E LOTES');p.metrics([['MODELOS',system.models.size],['LOTES',system.batches.length],['EM MONTAGEM',system.batches.filter(b=>b.status==='assembly').length]]);
    for(const b of city.economy.businesses.filter(b=>['automaker','carriage_builder'].includes(b.type)))p.record(b.entity.properties.name,`${b.vehicleAssembly?'Lote '+b.vehicleAssembly.id+' em montagem':'Aguardando peças ou trabalho'} · ${b.workers.length}/${b.jobs} funcionários`,()=>ui.openBuilding(b.id));
    p.table([{label:'Marca / modelo',weight:3},{label:'Tipo'},{label:'Unidades'}],[...system.models.values()].filter(m=>ui.matches(`${m.brand} ${m.name}`)).map(m=>({cells:[`${m.brand} · ${m.name}`,VEHICLE_SPECS[m.kind].label,units.filter(v=>v.modelId===m.id).length],click:()=>{const v=units.find(v=>v.modelId===m.id);if(v)ui.openPanel({selectedVehicleId:v.id});}})));
    if(!system.models.size)p.note('O primeiro modelo é registrado quando as peças do primeiro lote chegam à montadora.');return;
  }
  p.heading('FROTA E VEÍCULOS À VENDA');
  p.metrics([['EM USO',units.filter(v=>v.active).length],['À VENDA',units.filter(v=>!v.active).length],['SEM COMBUSTÍVEL',units.filter(v=>v.active&&v.fuel<1).length,C.gold],['AVARIADOS',units.filter(v=>v.active&&v.condition<=15).length,C.red]]);
  const rows=units.filter(v=>ui.matches(`${title(v)} ${system.model(v)?.brand} ${system.model(v)?.name} ${city.accountName(v.ownerAccountId)}`));
  p.table([{label:'Marca / modelo',weight:3},{label:'Dono',weight:2},{label:'Conservação'},{label:'Situação',weight:2}],rows.map(v=>({cells:[`${system.model(v)?.brand} · ${system.model(v)?.name}`,city.accountName(v.ownerAccountId),`${v.condition.toFixed(0)}%`,!v.active?'Estoque / concessionária':v.journey?'Em viagem':v.fuel<1?'Sem combustível':v.condition<=15?'Avariado':'Estacionado'],click:()=>ui.openPanel({selectedVehicleId:v.id}),color:v.active&&v.fuel<1?C.gold:C.gray})));
  if(!rows.length){p.note('Ainda não há veículos fabricados. A cadeia começa com metais, madeira, látex, tecido e vidro.');p.heading('ONDE A CADEIA ESTÁ PARADA');p.table([{label:'Etapa',weight:2},{label:'Ativas / obras'},{label:'Funcionários'},{label:'Falta',weight:3}],system.productionStatus().map(row=>({cells:[row.label,`${row.active} / ${row.planned}`,row.workers,!row.active?'Instalar empresa':!row.workers?'Contratar funcionários':row.missing.join(', ')||'Produção disponível'],...(row.buildingId?{click:()=>ui.openBuilding(row.buildingId)}:{})})));}p.windowLink('INTERVIR: FINANCIAR OU IMPORTAR VEÍCULOS',()=>ui.openPanel({tab:'government',views:{government:'elections'},politicsTab:'interventions',interventionView:'economy'}));
}
