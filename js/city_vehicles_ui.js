import {colorName} from './city_colors.js';
import {renderVehiclePaint} from './city_paint_ui.js';
import {VEHICLE_SPECS,VEHICLE_RECIPES} from './city_vehicles.js';
import {formatMoney as money} from './city_ui_format.js';
import {UI_COLORS as C} from './city_ui_widgets.js';
const title=v=>VEHICLE_SPECS[v.good]?.label||v.good;
const stamp=n=>`D${Math.floor(n/1440)+1} ${String(Math.floor(n%1440/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;
function ownerLink(ui,account){const actor=ui.city.accounts.get(account);if(actor?.entity?.properties.citizen)ui.openCitizen(actor.id);else if(actor?.entity?.properties.cityBuilding)ui.openBuilding(actor.id);else if(account==='treasury')ui.openPanel({tab:'government',views:{government:'finance'}});}
export function renderVehicle(ui,p,v){
  const city=ui.city,system=city.vehicles,model=system.model(v),spec=VEHICLE_SPECS[v.good];
  p.heading(`${title(v)} #${v.id}`);p.status(model?.brand||'Fabricante desconhecido',model?.name||'Modelo sem identificação');
  p.metrics([['CONSERVAÇÃO',`${v.condition.toFixed(0)}%`,v.condition<30?C.red:C.green],['VELOCIDADE NA RUA',`${spec.speed} células/s`]]);
  p.heading('IDENTIDADE E PROPRIEDADE');p.kv('Registro individual',v.id);p.kv('Marca',model?.brand||'Sem registro');p.kv('Modelo / revisão',model?.name||'Sem registro');p.kv('Origem',v.initial?'Equipamento da fundação':v.imported?'Importado':'Produção local');
  p.button(`DONO: ${city.accountName(v.ownerAccountId)}`,()=>ownerLink(ui,v.ownerAccountId));
  if(model?.manufacturerId!=null)p.button(`FABRICANTE: ${city.building(model.manufacturerId)?.entity.properties.name||model.brand}`,()=>ui.openBuilding(model.manufacturerId));
  p.kv('Fabricação / registro',stamp(v.createdAt??model?.createdAt??0));p.kv('Lote',v.batchId??(v.initial?'Patrimônio inicial':'Sem lote registrado'));
  if(!v.active)p.kv('Preço de venda',money(system.vehiclePrice(v)));p.kv('Situação',v.status||(!v.active?'No estoque':v.driverId?'Em viagem':'Estacionado'));
  p.kv('Distância percorrida',`${v.distance.toFixed(1)} células`);p.kv('Capacidade de carga',`${spec.cargo} itens`);
  if(v.entity)p.button('LOCALIZAR NO MAPA',()=>ui.camera(v.entity.x,v.entity.y));
  if(v.driverId)p.button(`USUÁRIO ATUAL: ${city.accountName(`citizen:${v.driverId}`)}`,()=>ui.openCitizen(v.driverId));
  const rack=v.parking&&city.building(v.parking.rackId);p.kv('Estacionamento',rack?`${rack.entity.properties.name} · vaga ${v.parking.index+1}`:v.driverId?'Em deslocamento':v.parking?.kind==='roadside'?'Ao lado da rua':'Fora de bicicletário');if(rack)p.button('VER BICICLETÁRIO',()=>ui.openBuilding(rack.id));
  if(v.reservedParking)p.kv('Vaga reservada no destino',v.reservedParking.kind==='roadside'?'Ao lado da rua':`${city.building(v.reservedParking.rackId)?.entity.properties.name||v.reservedParking.rackId} · ${v.reservedParking.index+1}`);
  p.kv('Cor',colorName(v.color));
  if(ui.section)ui.section(p,'vehicleCustomization','Pintura e bandeiras',()=>renderVehiclePaint(ui,p,v));else renderVehiclePaint(ui,p,v);
  p.heading('PEÇAS ORIGINAIS E FORNECEDORES');
  const components=model?.components?.length?model.components:Object.entries(VEHICLE_RECIPES[v.good]||{}).map(([good,quantity])=>({good,quantity,producerName:'Não registrado',design:'—'}));
  p.table([{label:'Peça',weight:2},{label:'Quantidade'},{label:'Fabricante',weight:2},{label:'Revisão'}],components.map(part=>({cells:[city.economy.goods[part.good]?.label||part.good,part.quantity,part.producerName||city.building(part.producerId)?.entity.properties.name||String(part.producerId),part.design],click:()=>ui.openBuilding(part.producerId)})));
  if(!model?.components?.length)p.note('A tabela mostra a composição padrão deste equipamento inicial/importado. Os fornecedores das peças não foram registrados; não são atribuídos a uma fábrica local.');
  p.heading('TODOS OS PROPRIETÁRIOS');p.table([{label:'Quando'},{label:'Origem',weight:2},{label:'Novo proprietário',weight:2},{label:'Valor'},{label:'Motivo',weight:2}],(v.ownershipHistory||[]).map(row=>({cells:[stamp(row.minute),row.fromName||(row.from?city.accountName(row.from):'Fabricação'),row.toName||city.accountName(row.to),money(row.price||0),row.reason||'Transferência'],click:()=>ownerLink(ui,row.to)})));
  p.heading('MANUTENÇÃO E PEÇAS APLICADAS');
  for(const row of v.maintenanceHistory||[]){p.record(`${stamp(row.minute)} · ${row.workshopName||'Oficina'}`,`Reparo: ${money(row.price||0)}`,()=>ui.openBuilding(row.workshopId));p.table([{label:'Material'},{label:'Quantidade'},{label:'Origem',weight:2},{label:'Revisão'}],(row.components||[]).map(part=>({cells:[city.economy.goods[part.good]?.label||part.good,part.quantity,part.producerName||city.building(part.producerId)?.entity.properties.name||String(part.producerId),part.design]})));}
  if(!v.maintenanceHistory?.length)p.note('Nenhum reparo registrado.');
  if(v.parkingHistory?.length){p.heading('ESTACIONAMENTOS RECENTES');p.table([{label:'Quando'},{label:'Local',weight:2},{label:'Usuário',weight:2}],v.parkingHistory.slice().reverse().map(row=>({cells:[stamp(row.minute),row.rackName||'Fora de bicicletário',city.accountName(`citizen:${row.citizenId}`)],click:()=>ui.camera(row.x,row.y)})));}
  p.button('EVENTOS DESTE EQUIPAMENTO',()=>ui.openHistory(`vehicleId:${v.id}`));
}
export function renderParking(ui,p){
 const city=ui.city,system=city.vehicles,report=system.parkingReport();p.heading('BICICLETÁRIOS · BIKES E PATINETES');p.metrics([['VAGAS',report.capacity],['OCUPADAS',report.occupied],['RESERVADAS',report.reserved],['FORA DOS BICICLETÁRIOS',report.outside]]);
 p.note('A vaga é reservada antes da viagem. Ao chegar, o cidadão estaciona e termina o percurso a pé. Sem vaga próxima, procura espaço ao lado da rua e termina o trajeto a pé.');
 p.button('SOLICITAR NOVO BICICLETÁRIO',()=>city.politics.startPublicWork('bike_rack'));
 for(const b of report.sites){p.heading(b.entity.properties.name);p.button('LOCALIZAR BICICLETÁRIO',()=>ui.camera(b.entity.x,b.entity.y));p.table([{label:'Vaga'},{label:'Equipamento',weight:2},{label:'Proprietário',weight:2},{label:'Estado'}],b.bikeSlots.map(slot=>{const v=system.units.get(slot.vehicleId??slot.reservedBy);return {cells:[slot.index+1,v?`${title(v)} #${v.id}`:'Livre',v?city.accountName(v.ownerAccountId):'—',slot.vehicleId!=null?'Estacionado':slot.reservedBy!=null?'Reservado':'Disponível'],...(v?{click:()=>ui.openPanel({selectedVehicleId:v.id})}:{})};}));}
}
export function renderAssembly(ui,p,b){
  const system=ui.city.vehicles,plan=system.recipeFor(b);if(!plan)return;
  p.heading('LOTES E MODELOS');p.kv('Marca',b.entity.properties.name);p.kv('Próximo tipo',VEHICLE_SPECS[plan.good].label);p.kv('Pacote por lote',`${b.vehicleBatchSize?'':'Até '}${plan.size} veículos${b.vehicleBatchSize?'':' (automático)'}`);
  p.note('Cada lote usa um fabricante e uma revisão por peça. Trocar uma peça, fornecedor ou revisão registra outro modelo. Os componentes chegam por transporte.');
  p.button('PLANEJAMENTO AUTOMÁTICO DA PRODUÇÃO',()=>system.configureAssembly(b.id,'auto',3),!b.vehicleKind);
  p.buttons(['bicicleta','bicicleta_carga','patinete','patins'].map(kind=>({label:VEHICLE_SPECS[kind].label,selected:plan.good===kind,click:()=>system.configureAssembly(b.id,kind,b.vehicleBatchSize||3)})));
  p.buttons([1,3,6,12].map(size=>({label:`LOTE ${size}`,selected:plan.size===size,click:()=>system.configureAssembly(b.id,plan.good,size)})));
  if(b.vehicleAssembly){const batch=b.vehicleAssembly;p.meter(`Montagem do lote ${batch.id}`,100*batch.labor/batch.requiredLabor);p.kv('Unidades no lote',batch.quantity);}
  p.table([{label:'Componente',weight:2},{label:'Por lote'},{label:'No estoque'},{label:'Em frete'}],Object.entries(VEHICLE_RECIPES[plan.good]).map(([g,n])=>({cells:[ui.city.economy.goods[g].label,n*plan.size,b.inventory[g],b.incoming[g]]})));
}
export function renderMobility(ui,p){
  const city=ui.city,system=city.vehicles,view=ui.view(),units=[...system.units.values()].filter(v=>!v.scrapped);
  if(ui.selectedVehicleId!=null){const v=system.units.get(ui.selectedVehicleId);if(v){p.button('VOLTAR À FROTA',()=>ui.openPanel({selectedVehicleId:null}));renderVehicle(ui,p,v);return;}}
  if(view==='parking'){renderParking(ui,p);return;}
  if(view==='rentals'){
    p.heading('ALUGUEL DE BICICLETAS');p.metrics([['VIAGENS',system.stats.passengers],['RECEITA DE ALUGUÉIS',money(system.stats.fares)]]);
    p.note('Locadoras com funcionários compram bicicletas e alugam cada viagem por R$ 0,50, ajustado pelo índice monetário. O morador precisa chegar ao equipamento disponível.');
    for(const b of city.economy.businesses.filter(b=>b.type==='bicycle_rental')){const fleet=units.filter(v=>v.active&&v.ownerAccountId===b.accountId);p.record(b.entity.properties.name,`${fleet.length} bicicletas · ${fleet.filter(v=>!v.driverId&&v.condition>15).length} disponíveis · ${b.workers.length} funcionários`,()=>ui.openBuilding(b.id));}
    return;
  }
  if(view==='models'){
    p.heading('MONTADORAS, MODELOS E LOTES');p.metrics([['MODELOS',system.models.size],['LOTES',system.batches.length],['EM MONTAGEM',system.batches.filter(b=>b.status==='assembly').length]]);
    for(const b of city.economy.businesses.filter(b=>['cycle_assembler','skate_workshop'].includes(b.type)))p.record(b.entity.properties.name,`${b.vehicleAssembly?'Lote '+b.vehicleAssembly.id+' em montagem':'Aguardando peças ou trabalho'} · ${b.workers.length}/${b.jobs} funcionários`,()=>ui.openBuilding(b.id));
    p.table([{label:'Marca / modelo',weight:3},{label:'Tipo'},{label:'Unidades'}],[...system.models.values()].filter(m=>ui.matches(`${m.brand} ${m.name}`)).map(m=>({cells:[`${m.brand} · ${m.name}`,VEHICLE_SPECS[m.kind].label,units.filter(v=>v.modelId===m.id).length],click:()=>{const v=units.find(v=>v.modelId===m.id);if(v)ui.openPanel({selectedVehicleId:v.id});}})));
    if(!system.models.size)p.note('O primeiro modelo é registrado quando as peças do primeiro lote chegam à montadora.');return;
  }
  p.heading('FROTA E VEÍCULOS À VENDA');
  p.metrics([['EM USO',units.filter(v=>v.active).length],['À VENDA',units.filter(v=>!v.active).length],['EM VIAGEM',units.filter(v=>v.active&&v.driverId).length,C.cyan],['AVARIADOS',units.filter(v=>v.active&&v.condition<=15).length,C.red]]);
  const rows=units.filter(v=>ui.matches(`${title(v)} ${system.model(v)?.brand} ${system.model(v)?.name} ${city.accountName(v.ownerAccountId)}`));
  p.table([{label:'Marca / modelo',weight:3},{label:'Dono',weight:2},{label:'Conservação'},{label:'Situação',weight:2}],rows.map(v=>({cells:[`${system.model(v)?.brand} · ${system.model(v)?.name}`,city.accountName(v.ownerAccountId),`${v.condition.toFixed(0)}%`,!v.active?'Estoque / loja':v.journey?'Em viagem':v.condition<=15?'Avariado':'Estacionado'],click:()=>ui.openPanel({selectedVehicleId:v.id}),color:v.active&&v.condition<=15?C.gold:C.gray})));
  if(!rows.length){p.note('Ainda não há veículos fabricados. A cadeia começa com metais, madeira, látex e tecido.');p.heading('ONDE A CADEIA ESTÁ PARADA');p.table([{label:'Etapa',weight:2},{label:'Ativas / obras'},{label:'Funcionários'},{label:'Falta',weight:3}],system.productionStatus().map(row=>({cells:[row.label,`${row.active} / ${row.planned}`,row.workers,!row.active?'Instalar empresa':!row.workers?'Contratar funcionários':row.missing.join(', ')||'Produção disponível'],...(row.buildingId?{click:()=>ui.openBuilding(row.buildingId)}:{})})));}p.windowLink('INTERVIR: FINANCIAR OU IMPORTAR VEÍCULOS',()=>ui.openPanel({tab:'government',views:{government:'elections'},politicsTab:'interventions',interventionView:'economy'}));
}
