import { formatMoney } from './city_ui_format.js';
import { UI_COLORS as C } from './city_ui_widgets.js';
import { GOODS } from './city_economy.js?v=regional-supply-5';
import { INTERCITY_BOAT_CLASSES } from './boat_types.js?v=local-sea-travel-2';

const labelCity = city => city?.metadata?.name || city?.id || 'Cidade';
const amount = cents => formatMoney(cents || 0);
const freight = quantity => Math.ceil(10 * (100 * .35 + quantity * .65));
const cargoSummary = transfer => transfer.payload.shipments
  ? transfer.payload.shipments.map(shipment => `${shipment.manifest.quantity} × ${GOODS[shipment.manifest.good]?.label || shipment.manifest.good}`).join(' + ')
  : `${transfer.payload.quantity} × ${GOODS[transfer.payload.good]?.label || transfer.payload.good}`;
const cargoValue = transfer => amount((transfer.payload.goodsAmount || 0) + (transfer.payload.freightAmount || 0) || transfer.payload.amount || 0);

function connectionControls(state, p, world) {
  const net = state.worldNet, online = [...world.cities.values()].filter(city => city.online);
  p.status('MUNDO ONLINE', world.connected
    ? `conectado a ${world.serverUrl || 'servidor'} · ${online.length} cidade(s) · dia ${Math.floor(world.minute / 1440) + 1} local`
    : 'desconectado — conecte-se para abrir rotas de comércio e migração', world.connected ? C.green : C.gold);
  if (!net) { p.note('Cliente de rede indisponível.'); return; }
  const buttons = [];
  if (world.connected) buttons.push({ label: 'DESCONECTAR', click: () => net.disconnect() });
  else buttons.push({ label: 'CONECTAR AO SERVIDOR', click: () => { net.url = state.worldServerUrl || 'ws://localhost:8787'; net.connect(); } });
  buttons.push({ label: 'ENDEREÇO…', click: () => {
    const value = window.prompt('Endereço do servidor do mundo (WebSocket):', state.worldServerUrl || 'ws://localhost:8787');
    if (!value) return;
    state.worldServerUrl = value;
    if (world.connected) { net.disconnect(); net.url = value; net.connect(); }
  } });
  p.buttons(buttons);
  if (state.worldNotice) p.note(state.worldNotice);
}

function citiesView(state, p, world) {
  p.heading('CIDADES CONECTADAS AO SERVIDOR');
  const cities = [...world.cities.values()].filter(city => city.online);
  if (!cities.length) { p.note('Nenhuma cidade conectada além desta. Conecte outro mundo ao mesmo servidor para abrir rotas.'); return; }
  for (const city of cities) {
    const summary = city.summary || {}, own = city.id === world.cityId;
    const people = summary.population ?? (own ? world.ownCity?.citizens?.filter(person => !person.entity.destroyed).length : null);
    p.record(labelCity(city) + (own ? ' · esta cidade' : ''), `${people ?? '?'} habitantes · ${summary.homeless ?? '?'} sem moradia · felicidade ${summary.averageHappiness ?? '?'} · vagas ${summary.openJobs ?? '?'} · moradias livres ${Math.max(0, (summary.units || 0) - (summary.occupied || 0))}`,
      null, own, { value: own ? 'CIDADE LOCAL' : 'CIDADE REMOTA' });
    if (city.port) p.note(`Porto municipal · cais ${city.port.berth ? `${city.port.berth.x}, ${city.port.berth.y}` : 'costeiro'} · acesso terrestre ${city.port.x}, ${city.port.y}`);
    if (!own) p.note(`Bens exportáveis: ${world.client?.goodsSummary ? '' : ''}${Object.keys(city.goods || {}).length} produtos catalogados.`);
  }
}

function fleetView(p, world) {
  p.heading('FROTA ENTRE CIDADES');
  if (!world.routes.size) { p.note('Sem rotas abertas. As rotas aparecem quando outra cidade conecta ao servidor.'); return; }
  for (const route of world.routes.values()) {
    const vessel = world.vessels.get(`vessel:${route.id}`);
    const status = { idle: 'atracada', reserved: 'reservada para embarque', 'at-sea': 'em viagem' }[vessel?.status] || '—';
    p.record(`${labelCity(world.cities.get(route.originCityId))} → ${labelCity(world.cities.get(route.destinationCityId))}`,
      `${route.travelMinutes} min · limite ${route.capacity} unidades · frete ${amount(route.freightPerUnit)}/unidade`,
      null, false, { value: `${INTERCITY_BOAT_CLASSES[vessel?.classId]?.label || 'Navio cargueiro'} municipal · ${status}` });
  }
  p.heading('EMBARCAÇÕES DESTA CIDADE');
  const city = world.ownCity;
  const boats = [...(city?.vehicles?.units?.values?.() || [])].filter(vessel => vessel.boatClass && vessel.active && !vessel.scrapped);
  if (!boats.length) p.note('Nenhuma embarcação local registrada.');
  for (const kind of Object.keys(BOAT_LABELS)) {
    const group = boats.filter(vessel => vessel.boatClass === kind);
    if (group.length) p.record(BOAT_LABELS[kind], `${group.length} unidade${group.length === 1 ? '' : 's'} · ${group.filter(vessel => vessel.driverId).length} em uso`, null, false, { value: kind });
  }
}

const BOAT_LABELS = { canoe: 'Canoa', launch: 'Lancha', ferry: 'Balsa', cargo: 'Navio cargueiro' };
const statusLabel = { reserving: 'reservando carga', scheduled: 'aguardando embarque', 'in-transit': 'no mar', delivered: 'entregue', cancelled: 'cancelada' };

function routesView(p, world) {
  p.heading('ROTAS MARÍTIMAS E VIAGENS');
  if (!world.routes.size) { p.note('As rotas aparecem quando houver outra cidade conectada.'); return; }
  const minute = world.minute;
  for (const route of world.routes.values()) {
    const origin = world.cities.get(route.originCityId), destination = world.cities.get(route.destinationCityId);
    p.heading(`${labelCity(origin)} → ${labelCity(destination)}`);
    const ships = [...world.transfers.values()].filter(item => item.originCityId === route.originCityId && item.destinationCityId === route.destinationCityId && ['reserving', 'scheduled', 'in-transit'].includes(item.status));
    if (!ships.length) p.note('Nenhuma viagem em andamento nesta rota.');
    for (const transfer of ships) {
      const manifest = transfer.kind === 'citizen'
        ? `${transfer.payload.package?.version === 2 ? transfer.payload.package.members.length : 1} morador(es)`
        : cargoSummary(transfer);
      const progress = transfer.status === 'in-transit'
        ? Math.max(0, Math.min(100, Math.floor((minute - transfer.departureMinute) / Math.max(1, transfer.arrivalMinute - transfer.departureMinute) * 100)))
        : 0;
      p.record(`${manifest} · ${cargoValue(transfer)}`,
        `${statusLabel[transfer.status] || transfer.status}${transfer.status === 'in-transit' ? ` · ${progress}% do trajeto` : ''}${transfer.payload.shipments?.length > 1 ? ` · ${transfer.payload.shipments.length} cargas consolidadas` : ''}${transfer.lastError ? ` · ${transfer.lastError}` : ''}`,
        null, false, { value: transfer.id });
    }
  }
}

function tradeView(state, p, world) {
  const net = state.worldNet;
  state.worldTradeTab ??= 'demand';
  p.links([
    { label: 'DEMANDA REGIONAL', selected: state.worldTradeTab === 'demand', click: () => { state.worldTradeTab = 'demand'; state.resetScroll(); } },
    { label: 'NOVA COMPRA', selected: state.worldTradeTab === 'manual', click: () => { state.worldTradeTab = 'manual'; state.resetScroll(); } },
    { label: 'CONTRATOS E ENVIOS', selected: state.worldTradeTab === 'records', click: () => { state.worldTradeTab = 'records'; state.resetScroll(); } },
  ]);
  if (state.worldTradeTab === 'records') return tradeRecordsView(p, world, net);
  if (state.worldTradeTab === 'manual') return tradeManualView(state, p, world, net);
  return tradeDemandView(state, p, world, net);
}

function tradeDemandView(state, p, world, net) {
  const cities = [...world.cities.values()].filter(city => city.online && city.id !== world.cityId);
  const activeTransfers = [...world.transfers.values()].filter(item => item.kind === 'goods' && ['reserving', 'scheduled', 'in-transit'].includes(item.status));
  p.status('ABASTECIMENTO AUTOMÁTICO', 'O servidor compara excedentes e demandas das cidades conectadas, enche o porão com produtos variados e envia o barco quando o lote útil se forma (25% da capacidade) ou expira a paciência de 240 minutos — quanto mais cheio, menor o frete por item.', C.cyan);
  p.metrics([['ROTAS', world.routes.size], ['CARGAS EM VIAGEM', activeTransfers.length], ['CONTRATOS ATIVOS', [...world.contracts.values()].length]]);
  if (!cities.length) { p.note('Nenhuma outra cidade conectada: os excedentes esperam uma cidade para abastecer.'); return; }
  const offers = world.computeOffers?.() || [];
  const demand = world.computeDemand?.() || [];
  p.heading('EXCEDENTES QUE PODEM EMBARCAR DESTA CIDADE');
  if (!offers.length) p.note('Nenhum estoque acima da reserva local agora. Excedentes do depósito de importação também podem embarcar.');
  for (const offer of offers) p.record(`${offer.quantity} × ${GOODS[offer.good]?.label || offer.good}`, `Preço sugerido ${amount(offer.unitPrice)} / unidade`, null, false, { value: 'excedente' });
  p.heading('DEMANDAS DESTA CIDADE QUE PUXAM CARGA');
  if (!demand.length) p.note('Nenhum prédio precisa de produtos importados agora, ou ninguém tem saldo para pagar.');
  for (const entry of demand) {
    const buyer = world.ownCity?.building(entry.destinationBuildingId);
    p.record(`${entry.quantity} × ${GOODS[entry.good]?.label || entry.good}`, buyer?.entity.properties.name || entry.destinationBuildingId || 'comprador', null, false, { value: 'demanda' });
  }
  p.heading('CARGAS RESERVADAS E EM VIAGEM');
  if (!activeTransfers.length) p.note('Ainda não há cargas reservadas ou em viagem.');
  for (const transfer of activeTransfers) {
    const status = { reserving: 'reservando carga', scheduled: 'aguardando embarque', 'in-transit': 'no mar' }[transfer.status] || transfer.status;
    p.record(cargoSummary(transfer), `${labelCity(world.cities.get(transfer.originCityId))} → ${labelCity(world.cities.get(transfer.destinationCityId))} · ${status}${transfer.payload.shipments?.length > 1 ? ` · ${transfer.payload.shipments.length} cargas consolidadas` : ''}`, null, false, { value: cargoValue(transfer) });
  }
}

function tradeManualView(state, p, world, net) {
  const sellers = [...world.cities.values()].filter(city => city.online && city.id !== world.cityId);
  if (!sellers.length) { p.note('Nenhuma outra cidade conectada. Compre de outra cidade quando ela entrar no servidor.'); return; }
  state.worldSeller ??= sellers[0].id;
  state.worldGood ??= null;
  state.worldQuantity ??= 10;
  state.worldPriceFactor ??= 90;
  const seller = world.cities.get(state.worldSeller) || sellers[0];
  p.heading('COMPRAR DE OUTRA CIDADE');
  const sellerOptions = sellers.map(city => [city.id, labelCity(city)]);
  state.selectControl(p, 'world:seller', sellerOptions, seller.id, id => { state.worldSeller = id; state.resetScroll(); });
  const goods = Object.keys(GOODS).sort((a, b) => GOODS[a].label.localeCompare(GOODS[b].label));
  const good = state.worldGood && GOODS[state.worldGood] ? state.worldGood : goods[0];
  state.selectControl(p, 'world:good', goods.map(item => [item, GOODS[item].label]), good, id => { state.worldGood = id; state.resetScroll(); });
  const quantities = [5, 10, 20, 50, 100];
  state.selectControl(p, 'world:quantity', quantities.map(value => [value, `${value} unidades`]), state.worldQuantity, value => { state.worldQuantity = value; state.resetScroll(); });
  const factors = [[80, '80% do preço de tabela'], [90, '90% (sugestão)'], [100, '100%'], [120, '120%']];
  state.selectControl(p, 'world:price', factors, state.worldPriceFactor, value => { state.worldPriceFactor = value; state.resetScroll(); });
  const unitPrice = Math.max(1, Math.ceil((GOODS[good]?.price || 1) * state.worldPriceFactor / 100));
  const total = unitPrice * state.worldQuantity, freightCost = freight(state.worldQuantity);
  p.kv('Preço combinado', `${amount(unitPrice)} / unidade`);
  p.kv('Carga + frete marítimo', `${amount(total)} + ${amount(freightCost)}`);
  p.note('O tesouro municipal paga a reserva. O produto sai do estoque do vendedor para o porto, viaja de barco e é entregue automaticamente à empresa que mais precisa dele nesta cidade.');
  p.buttons([
    { label: 'ENCOMENDAR COMPRA', click: () => net.orderTrade({ sellerCityId: seller.id, good, quantity: state.worldQuantity, unitPrice, destinationBuildingId: null, payerAccountId: 'treasury' }) },
    { label: 'CRIAR CONTRATO DIÁRIO', click: () => net.createContract({ sellerCityId: seller.id, good, quantity: state.worldQuantity, unitPrice, destinationBuildingId: null, payerAccountId: 'treasury', intervalMinutes: 1440 }) },
  ]);
}

function tradeRecordsView(p, world, net) {
  p.heading('CONTRATOS RECORRENTES');
  const contracts = [...world.contracts.values()];
  if (!contracts.length) p.note('Nenhum contrato recorrente cadastrado.');
  for (const contract of contracts) {
    const good = GOODS[contract.good]?.label || contract.good;
    p.record(`${contract.quantity} × ${good}`, `${labelCity(world.cities.get(contract.sellerCityId))} → ${labelCity(world.cities.get(contract.buyerCityId))} · a cada ${contract.intervalMinutes} min${contract.lastError ? ` · ${contract.lastError}` : ''}`, null, false, { value: amount(contract.unitPrice) + ' / unidade' });
    p.button('ENCERRAR CONTRATO', () => net.cancelContract(contract.id));
  }
  p.heading('ENVIOS E COMPRAS RECENTES');
  const transfers = [...world.rawTransfers.values()].filter(item => item.kind === 'goods').sort((a, b) => (b.createdAt?.wall || 0) - (a.createdAt?.wall || 0)).slice(0, 30);
  if (!transfers.length) p.note('Nenhum produto enviado ou recebido ainda.');
  for (const transfer of transfers) {
    p.record(cargoSummary(transfer), `${labelCity(world.cities.get(transfer.originCityId))} → ${labelCity(world.cities.get(transfer.destinationCityId))} · ${statusLabel[transfer.status] || transfer.status}`, null, false, { value: cargoValue(transfer) });
    if (transfer.status === 'scheduled' && transfer.originCityId === world.cityId) p.button('CANCELAR ANTES DA PARTIDA', () => net.cancelTransfer(transfer.id));
  }
}

function migrationView(state, p, world) {
  const net = state.worldNet;
  const destinations = [...world.cities.values()].filter(city => city.online && city.id !== world.cityId);
  if (!destinations.length) { p.note('Conecte outra cidade ao servidor para abrir migração.'); return; }
  state.worldMigrationDestination ??= destinations[0].id;
  const destination = world.cities.get(state.worldMigrationDestination) || destinations[0];
  p.heading('MIGRAR MORADORES');
  state.selectControl(p, 'world:destination', destinations.map(city => [city.id, labelCity(city)]), destination.id, id => { state.worldMigrationDestination = id; state.resetScroll(); });
  p.note('O morador embarca no porto com saldo, habilidades e vínculos preservados; emprego e aluguel são liberados na partida. Núcleos familiares viajam juntos.');
  const city = world.ownCity, eligible = [];
  for (const person of city?.citizens || []) {
    if (!city.society.isAdult(person) || person.dead || person.entity.destroyed || person.worldMigrationPending) continue;
    const family = city.worldMigrationHousehold(person.id);
    if (!family?.length) continue;
    const adults = family.map(id => city.society.citizen(id)).filter(entry => city.society.isAdult(entry));
    if (adults.some(person2 => person2.jobId) && !adults.some(person2 => !person2.homeUnitId) && (person.happiness || 0) >= 55) continue;
    eligible.push({ person, familySize: family.length });
    if (eligible.length >= 24) break;
  }
  if (!eligible.length) p.note('Nenhum morador está considerando mudar de cidade agora.');
  for (const { person, familySize } of eligible) {
    p.record(`${person.entity.properties.name}`, `${familySize > 1 ? `núcleo com ${familySize} pessoas` : 'mudança individual'} · felicidade ${Math.round(person.happiness || 0)} · ${person.jobId ? 'empregado' : 'sem emprego'}${person.homeUnitId ? '' : ' · sem moradia'}`, null, false, { value: `→ ${labelCity(destination)}` });
    p.buttons([
      { label: 'EMIGRAR', click: () => net.orderMigration({ destinationCityId: destination.id, citizenId: person.id, household: false, reason: 'manual' }) },
      ...(familySize > 1 ? [{ label: 'LEVAR A FAMÍLIA', click: () => net.orderMigration({ destinationCityId: destination.id, citizenId: person.id, household: true, reason: 'manual' }) }] : []),
    ]);
  }
  p.heading('MIGRAÇÃO AUTÔNOMA');
  p.note('Todos os dias, os moradores desta cidade avaliam as cidades conectadas e o melhor candidato embarca sozinho — sem custo nem decisão sua. As políticas abaixo ajustam destino e ritmo; os botões EMIGRAR continuam disponíveis para escolher alguém específico.');
  p.buttons([{ label: 'CRIAR POLÍTICA DIÁRIA', click: () => net.createMigrationPolicy({ destinationCityId: destination.id, intervalMinutes: 1440, maxTransfers: 5 }) }]);
  const policies = [...world.policies.values()];
  for (const policy of policies) {
    p.record(`${labelCity(world.cities.get(policy.destinationCityId))} · a cada ${policy.intervalMinutes} min`, `${policy.transfersCreated}/${policy.maxTransfers} transferências${policy.lastError ? ` · ${policy.lastError}` : ''}`, null, false, { value: 'ativa' });
    p.button('ENCERRAR POLÍTICA', () => net.cancelMigrationPolicy(policy.id));
  }
  p.heading('VIAGENS DE MORADORES');
  const transfers = [...world.rawTransfers.values()].filter(item => item.kind === 'citizen').sort((a, b) => (b.createdAt?.wall || 0) - (a.createdAt?.wall || 0)).slice(0, 20);
  if (!transfers.length) p.note('Nenhuma migração entre cidades aconteceu ainda.');
  for (const transfer of transfers) {
    const count = transfer.payload.package?.version === 2 ? transfer.payload.package.members.length : 1;
    p.record(`${count} ${count === 1 ? 'morador' : 'moradores'}`, `${labelCity(world.cities.get(transfer.originCityId))} → ${labelCity(world.cities.get(transfer.destinationCityId))} · ${statusLabel[transfer.status] || transfer.status}`, null, false, { value: transfer.id });
  }
}

export function renderWorldManagement(state, p) {
  const world = state.worldCoordinator;
  state.worldPage = p;
  if (!world) { p.note('Coordenador do mundo indisponível.'); return; }
  connectionControls(state, p, world);
  if (state.view() === 'trade') tradeView(state, p, world);
  else if (state.view() === 'migration') migrationView(state, p, world);
  else if (state.view() === 'fleet') fleetView(p, world);
  else if (state.view() === 'routes') routesView(p, world);
  else citiesView(state, p, world);
}
