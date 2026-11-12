import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorldServer } from '../server/world_server.mjs';

/** Scripted client session: answers server requests from a handler table. */
function fakeClient(world, cityId, handlers = {}) {
  const client = { cityId, sent: [], requests: [], handlers, closed: false, open: true };
  client.sendJson = message => {
    client.sent.push(message);
    world.handleMessage(client, JSON.stringify(message));
    if (message.type === 'request') {
      client.requests.push({ method: message.method, args: message.args });
      const handler = handlers[message.method];
      const answer = handler ? handler(message.args || [], message) : { __response: true, ok: false, message: 'sem handler' };
      Promise.resolve(answer).then(result => {
        const ok = result && result.__response ? result.ok !== false : true;
        const value = result && result.__response ? result.value : result;
        const failure = result && result.__response ? result.message : undefined;
        client.sendJson({ type: 'response', reqId: message.reqId, ok, value, message: failure });
      });
    }
  };
  client.close = () => { client.closed = true; world.handleDisconnect(client); };
  client.requestsOf = method => client.requests.filter(entry => entry.method === method).map(entry => entry.args);
  client.connect = hello => world.handleHello(client, { cityId, name: cityId, minute: 0, summary: { population: 96 }, port: { x: 4, y: 4 }, goods: {}, ...hello });
  return client;
}

const deliveredTransfers = world => world.history.filter(entry => entry.status === 'delivered');
const flush = () => new Promise(resolve => setImmediate(resolve));

test('mundo online: mesmo cityId de sessão viva é rejeitado sem derrubar a primeira', async () => {
  const world = new WorldServer({});
  const first = fakeClient(world, 'city-a');
  const second = fakeClient(world, 'city-a');
  first.connect({ minute: 10 });
  assert.ok(first.sent.some(m => m.type === 'welcome'), 'primeira cidade registrada');
  second.connect({ minute: 20 });
  const rejected = second.sent.filter(m => m.type === 'error');
  assert.ok(rejected.some(m => /já está conectad/.test(m.message)), 'segunda recebe erro claro');
  assert.equal(world.cities.get('city-a').session, first, 'a sessão original continua dona do cityId');
  assert.ok(first.sent.some(m => m.type === 'welcome'), 'primeira não foi derrubada');
  assert.ok(!first.sent.some(m => m.type === 'city-offline'), 'primeira não aparece como offline');
  first.close();
  second.close();
});

test('mundo online: takeover válido quando a sessão anterior já morreu', async () => {
  const world = new WorldServer({});
  const first = fakeClient(world, 'city-a');
  first.connect({ minute: 10 });
  first.close(); // navegador fechou/crashou: servidor marca offline
  const second = fakeClient(world, 'city-a', {});
  second.connect({ minute: 30 });
  assert.ok(second.sent.some(m => m.type === 'welcome'), 'segunda assumiu o cityId');
  assert.equal(world.cities.get('city-a').session, second);
  second.close();
});

test('mundo online: registro, diretório e rotas', async () => {
  const world = new WorldServer({});
  const a = fakeClient(world, 'city-a');
  const b = fakeClient(world, 'city-b');
  a.connect({ minute: 10 });
  b.connect({ minute: 5 });
  const welcome = a.sent.find(m => m.type === 'welcome');
  assert.ok(welcome);
  assert.equal(welcome.self.cityId, 'city-a');
  const bWelcome = b.sent.find(m => m.type === 'welcome');
  assert.ok(bWelcome.cities.some(city => city.cityId === 'city-a'));
  const broadcast = a.sent.find(m => m.type === 'city-online');
  assert.ok(broadcast?.city.cityId === 'city-b');
  a.close();
  b.close();
});

test('mundo online: compra marítima completa com escrow e liquidação', async () => {
  const world = new WorldServer({});
  const a = fakeClient(world, 'city-a', {
    reserveWorldExport: () => true,
    worldExportReservationInfo: () => ({ buildingId: 'padaria-1', accountId: 'acc-padaria' }),
    reserveWorldBoatCrew: () => ({ ready: true, citizenId: 7 }),
    departWorldBoatCrew: () => true,
    departWorldExport: () => true,
    receiveWorldPayment: () => true,
    settleWorldPayment: () => true,
    completeWorldExport: () => true,
    returnWorldBoatCrew: () => true,
  });
  const b = fakeClient(world, 'city-b', {
    reserveWorldPayment: () => true,
    reserveWorldImport: () => true,
    receiveWorldImport: () => true,
    deliverWorldImport: () => true,
    finalizeWorldPayment: () => true,
  });
  a.connect({ minute: 100 });
  b.connect({ minute: 200 });
  world.handleTradeOrder('city-b', { sellerCityId: 'city-a', good: 'pao', quantity: 10, unitPrice: 5 });
  await flush();
  const scheduled = [...world.transfers.values()][0];
  assert.ok(scheduled);
  assert.equal(scheduled.status, 'scheduled');
  const manifest = scheduled.payload.shipments[0].manifest;
  assert.equal(manifest.goodsAmount, 50);
  assert.equal(manifest.freightAmount, Math.ceil(1 * (100 * .35 + 10 * .65)));
  assert.ok(scheduled.arrivalMinute >= 200 + 180);

  a.sendJson({ type: 'summary', minute: 110 });
  await world.tick(); // crew + departure
  assert.equal(scheduled.status, 'in-transit');
  assert.equal(a.requestsOf('reserveWorldBoatCrew').length, 1);
  assert.equal(b.requestsOf('receiveWorldImport').length, 0, 'destino não recebe antes do minuto previsto');

  b.sendJson({ type: 'summary', minute: 200 + 200 });
  await world.tick();
  assert.equal(deliveredTransfers(world).length, 1, 'entrega completa');
  const settledId = `${scheduled.id}:s0`;
  assert.deepEqual(a.requestsOf('settleWorldPayment')[0], [settledId, 'acc-padaria', 50, manifest.freightAmount, null]);
  assert.ok(b.requestsOf('finalizeWorldPayment').some(args => args[0] === settledId));
  a.close();
  b.close();
});

test('mundo online: reserva recusada cancela sem efeitos', async () => {
  const world = new WorldServer({});
  const failures = [];
  const a = fakeClient(world, 'city-a', { reserveWorldExport: () => ({ __response: true, ok: false, message: 'sem estoque' }) });
  const b = fakeClient(world, 'city-b', {
    reserveWorldPayment: () => true,
    reserveWorldImport: () => true,
    refundWorldPayment: () => true,
    cancelWorldImport: () => true,
  });
  a.connect({});
  b.connect({});
  world.handleTradeOrder('city-b', { sellerCityId: 'city-a', good: 'pao', quantity: 4, unitPrice: 2 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(world.transfers.size, 0);
  const failed = b.sent.filter(m => m.type === 'trade:failed');
  assert.ok(failed.some(m => m.message.includes('sem estoque')));
  assert.equal(b.requestsOf('refundWorldPayment').length, 0, 'pagamento não foi reservado, nada a devolver');
  failures.push(failed.length);
  a.close();
  b.close();
});

test('mundo online: cancelamento voluntário desfaz as reservas', async () => {
  const world = new WorldServer({});
  const a = fakeClient(world, 'city-a', {
    reserveWorldExport: () => true,
    worldExportReservationInfo: () => ({ buildingId: 'b1', accountId: 'acc1' }),
    reserveWorldBoatCrew: () => ({ ready: true, citizenId: 3 }),
    departWorldBoatCrew: () => true,
    returnWorldExport: () => true,
    returnWorldBoatCrew: () => true,
  });
  const b = fakeClient(world, 'city-b', {
    reserveWorldPayment: () => true,
    reserveWorldImport: () => true,
    cancelWorldImport: () => true,
    refundWorldPayment: () => true,
  });
  a.connect({});
  b.connect({});
  world.handleTradeOrder('city-b', { sellerCityId: 'city-a', good: 'pao', quantity: 6, unitPrice: 3 });
  await flush();
  const transfer = [...world.transfers.values()][0];
  assert.equal(transfer.status, 'scheduled');
  const cancelled = await world.cancelTransfer(transfer.id, 'city-b');
  assert.ok(cancelled);
  assert.equal(world.transfers.size, 0);
  assert.equal(a.requestsOf('returnWorldExport').length, 1);
  assert.equal(b.requestsOf('refundWorldPayment').length, 1);
  assert.equal(b.requestsOf('cancelWorldImport').length, 1);
  a.close();
  b.close();
});

test('mundo online: cidade offline retém a viagem e retoma ao reconectar', async () => {
  const world = new WorldServer({});
  const a = fakeClient(world, 'city-a', {
    reserveWorldExport: () => true,
    worldExportReservationInfo: () => ({ buildingId: 'b1', accountId: 'acc1' }),
    reserveWorldBoatCrew: () => ({ ready: true, citizenId: 3 }),
    departWorldBoatCrew: () => true,
    departWorldExport: () => true,
    receiveWorldPayment: () => true,
    settleWorldPayment: () => true,
    completeWorldExport: () => true,
    returnWorldBoatCrew: () => true,
  });
  const b = fakeClient(world, 'city-b', {
    reserveWorldPayment: () => true,
    reserveWorldImport: () => true,
    receiveWorldImport: () => true,
    deliverWorldImport: () => true,
    finalizeWorldPayment: () => true,
  });
  a.connect({ minute: 50 });
  b.connect({ minute: 60 });
  world.handleTradeOrder('city-b', { sellerCityId: 'city-a', good: 'pao', quantity: 10, unitPrice: 5 });
  await flush();
  const transfer = [...world.transfers.values()][0];
  a.sendJson({ type: 'summary', minute: 70 });
  await world.tick();
  assert.equal(transfer.status, 'in-transit');
  b.close(); // destination goes offline before the arrival minute
  b.sendJson({ type: 'summary', minute: 60 + 400 });
  await world.tick();
  assert.equal(deliveredTransfers(world).length, 0, 'viagem retida com cidade offline');
  b.connect({ minute: 60 + 400 }); // reconnects with its clock ahead
  await world.tick();
  assert.equal(deliveredTransfers(world).length, 1, 'entrega retomada no reconectamento');
  a.close();
  b.close();
});

test('mundo online: migração individual via pacote versionado', async () => {
  const world = new WorldServer({});
  const packageData = { version: 1, globalId: 'city-a:42', citizenId: 42, name: 'Dona Ana' };
  const a = fakeClient(world, 'city-a', {
    reserveWorldCitizenMigration: () => packageData,
    reserveWorldBoatCrew: () => ({ ready: true, citizenId: 8 }),
    departWorldBoatCrew: () => true,
    departWorldCitizenMigration: () => true,
    completeWorldCitizenMigration: () => true,
    returnWorldBoatCrew: () => true,
  });
  const b = fakeClient(world, 'city-b', { receiveWorldCitizenMigration: () => true });
  a.connect({ minute: 300 });
  b.connect({ minute: 310 });
  world.handleMigrationOrder('city-a', { destinationCityId: 'city-b', citizenId: 42 });
  await flush();
  const transfer = [...world.transfers.values()][0];
  a.sendJson({ type: 'summary', minute: 310 });
  await world.tick();
  await world.tick();
  assert.equal(transfer.status, 'in-transit');
  b.sendJson({ type: 'summary', minute: 310 + 200 });
  await world.tick();
  assert.equal(deliveredTransfers(world).length, 1);
  assert.deepEqual(b.requestsOf('receiveWorldCitizenMigration')[0], [transfer.id, packageData]);
  assert.equal(a.requestsOf('completeWorldCitizenMigration').length, 1);
  a.close();
  b.close();
});

test('mundo online: contrato diário gera compras recorrentes', async () => {
  const world = new WorldServer({});
  const a = fakeClient(world, 'city-a', {
    reserveWorldExport: () => true,
    worldExportReservationInfo: () => ({ buildingId: 'b1', accountId: 'acc1' }),
    reserveWorldBoatCrew: () => ({ ready: true, citizenId: 3 }),
    departWorldBoatCrew: () => true,
    departWorldExport: () => true,
    receiveWorldPayment: () => true,
    settleWorldPayment: () => true,
    completeWorldExport: () => true,
    returnWorldBoatCrew: () => true,
  });
  const b = fakeClient(world, 'city-b', {
    reserveWorldPayment: () => true,
    reserveWorldImport: () => true,
    receiveWorldImport: () => true,
    deliverWorldImport: () => true,
    finalizeWorldPayment: () => true,
  });
  a.connect({});
  b.connect({ minute: 500 });
  const contract = await world.createContract('city-b', { sellerCityId: 'city-a', good: 'pao', quantity: 4, unitPrice: 3 });
  assert.ok(contract.active);
  a.sendJson({ type: 'summary', minute: 2 });
  b.sendJson({ type: 'summary', minute: 502 });
  await world.tick();
  await flush();
  assert.equal(deliveredTransfers(world).length, 0, 'a primeira compra ainda está em trânsito');
  const first = [...world.transfers.values()][0];
  assert.equal(first.status, 'scheduled', 'a compra do contrato foi agendada');
  assert.ok(first.contractId === contract.id);
  assert.equal(contract.transfersCreated, 1);
  a.sendJson({ type: 'summary', minute: 6 });
  await world.tick();
  assert.equal(first.status, 'in-transit');
  b.sendJson({ type: 'summary', minute: 500 + 400 });
  await world.tick();
  assert.equal(deliveredTransfers(world).length, 1);
  a.close();
  b.close();
});

test('mundo online: comércio regional autônomo casa oferta e demanda', async () => {
  const world = new WorldServer({ regionalTradeCooldownMs: 0 });
  const a = fakeClient(world, 'city-a', {
    worldOffers: () => [{ good: 'tabuas', quantity: 30, unitPrice: 4 }],
    reserveWorldExport: () => true,
    worldExportReservationInfo: () => ({ buildingId: 'b1', accountId: 'acc1' }),
    reserveWorldBoatCrew: () => ({ ready: true, citizenId: 3 }),
    departWorldBoatCrew: () => true,
    departWorldExport: () => true,
    receiveWorldPayment: () => true,
    settleWorldPayment: () => true,
    completeWorldExport: () => true,
    returnWorldBoatCrew: () => true,
  });
  const b = fakeClient(world, 'city-b', {
    worldDemand: () => [{ good: 'tabuas', quantity: 12, destinationBuildingId: 'moveleira-1', payerAccountId: 'acc-moveleira' }],
    reserveWorldPayment: () => true,
    reserveWorldImport: () => true,
    receiveWorldImport: () => true,
    deliverWorldImport: () => true,
    finalizeWorldPayment: () => true,
  });
  a.connect({});
  b.connect({});
  await world.tick();
  await flush();
  // Carga abaixo do lote útil (25% da capacidade): o barco espera o acúmulo.
  assert.equal(world.transfers.size, 0);
  assert.ok(world.freightWaiting.get('route:city-a>city-b'));
  // Paciência estoura (240 minutos simulados): navega com o que tem.
  a.sendJson({ type: 'summary', minute: 260 });
  await world.tick();
  await flush();
  const regional = [...world.transfers.values()];
  assert.equal(regional.length, 1);
  assert.equal(regional[0].payload.shipments[0].manifest.destinationBuildingId, 'moveleira-1');
  assert.equal(regional[0].payload.shipments[0].manifest.quantity, 12);
  assert.equal(regional[0].payload.quantity, 12);
  a.close();
  b.close();
});

test('mundo online: viagem única leva cargas mistas consolidadas', async () => {
  const world = new WorldServer({ regionalTradeCooldownMs: 0 });
  const a = fakeClient(world, 'city-a', {
    worldOffers: () => [
      { good: 'pao', quantity: 20, unitPrice: 6 },
      { good: 'tabuas', quantity: 40, unitPrice: 3 },
    ],
    reserveWorldExport: () => true,
    worldExportReservationInfo: () => ({ buildingId: 'b1', accountId: 'acc1' }),
    reserveWorldBoatCrew: () => ({ ready: true, citizenId: 3 }),
    departWorldBoatCrew: () => true,
    departWorldExport: () => true,
    receiveWorldPayment: () => true,
    settleWorldPayment: () => true,
    completeWorldExport: () => true,
    returnWorldBoatCrew: () => true,
  });
  const b = fakeClient(world, 'city-b', {
    worldDemand: () => [
      { good: 'pao', quantity: 20, destinationBuildingId: 'mercadinho-1', payerAccountId: 'acc-mercado' },
      { good: 'tabuas', quantity: 30, destinationBuildingId: 'moveleira-1', payerAccountId: 'acc-moveleira' },
    ],
    reserveWorldPayment: () => true,
    reserveWorldImport: () => true,
    receiveWorldImport: () => true,
    deliverWorldImport: () => true,
    finalizeWorldPayment: () => true,
  });
  a.connect({});
  b.connect({});
  await world.tick();
  await flush();
  const voyage = [...world.transfers.values()][0];
  assert.equal(voyage.payload.shipments.length, 2, 'dois produtos no mesmo porão');
  assert.equal(voyage.payload.quantity, 50);
  const ids = voyage.payload.shipments.map(shipment => shipment.id);
  assert.deepEqual(ids, [`${voyage.id}:s0`, `${voyage.id}:s1`]);
  a.sendJson({ type: 'summary', minute: 2 });
  await world.tick(); // crew + partida das duas cargas
  assert.equal(voyage.status, 'in-transit');
  assert.equal(a.requestsOf('departWorldExport').length, 2, 'as duas cargas embarcam no mesmo barco');
  b.sendJson({ type: 'summary', minute: 200 });
  await world.tick();
  assert.equal(deliveredTransfers(world).length, 1, 'entrega completa das duas cargas');
  assert.equal(a.requestsOf('settleWorldPayment').length, 2, 'liquidação por carga');
  a.close();
  b.close();
});

test('mundo online: migração autônoma diária sem intervenção do jogador', async () => {
  const world = new WorldServer({});
  const packageData = { version: 1, globalId: 'city-a:9', citizenId: 9, name: 'Dona Bia' };
  let candidateCalls = 0;
  const a = fakeClient(world, 'city-a', {
    worldMigrationCandidates: () => {
      candidateCalls++;
      return candidateCalls === 1 ? { citizenId: 9, household: false, reason: 'work', score: 55 } : {};
    },
    reserveWorldCitizenMigration: () => packageData,
    reserveWorldBoatCrew: () => ({ ready: true, citizenId: 5 }),
    departWorldBoatCrew: () => true,
    departWorldCitizenMigration: () => true,
    completeWorldCitizenMigration: () => true,
    returnWorldBoatCrew: () => true,
  });
  const b = fakeClient(world, 'city-b', { receiveWorldCitizenMigration: () => true });
  a.connect({ minute: 100 });
  b.connect({ minute: 100 });
  await world.tick();
  await flush();
  assert.equal(deliveredTransfers(world).length, 0, 'a migração ainda está programada');
  const transfer = [...world.transfers.values()][0];
  assert.ok(transfer?.kind === 'citizen' && transfer.originCityId === 'city-a');
  assert.equal(transfer.reason, 'work');
  a.sendJson({ type: 'summary', minute: 110 });
  await world.tick();
  await flush();
  a.sendJson({ type: 'summary', minute: 1500 }); // novo dia: nova rodada, sem candidatos
  await world.tick();
  await flush();
  b.sendJson({ type: 'summary', minute: 100 + 200 });
  await world.tick();
  await flush();
  assert.equal(deliveredTransfers(world).length, 1);
  // Mesmo dia (para o relógio da origem avançado) não abre outra rodada.
  a.sendJson({ type: 'summary', minute: 1600 });
  await world.tick();
  await flush();
  assert.equal(candidateCalls, 2, 'uma rodada por dia de origem');
  assert.equal(world.transfers.size, 0);
  a.close();
  b.close();
});


test('mundo online: política de migração pede candidatos à cidade de origem', async () => {
  const world = new WorldServer({});
  let asked = null;
  const a = fakeClient(world, 'city-a', {
    worldMigrationCandidates: args => {
      asked = args[0];
      return { citizenId: 12, household: false };
    },
    reserveWorldCitizenMigration: () => ({ version: 1, globalId: 'city-a:12', citizenId: 12, name: 'João' }),
    reserveWorldBoatCrew: () => ({ ready: true, citizenId: 3 }),
    departWorldBoatCrew: () => true,
    departWorldCitizenMigration: () => true,
    completeWorldCitizenMigration: () => true,
    returnWorldBoatCrew: () => true,
  });
  const b = fakeClient(world, 'city-b', { receiveWorldCitizenMigration: () => true });
  a.connect({ minute: 800 });
  b.connect({ minute: 800 });
  const policy = await world.createMigrationPolicy('city-a', { destinationCityId: 'city-b', intervalMinutes: 1440, maxTransfers: 1 });
  a.sendJson({ type: 'summary', minute: 820 });
  await world.tick();
  await flush();
  assert.ok(asked?.cityId === 'city-b');
  a.sendJson({ type: 'summary', minute: 830 });
  await world.tick();
  await flush();
  b.sendJson({ type: 'summary', minute: 820 + 400 });
  await world.tick();
  await flush();
  assert.equal(deliveredTransfers(world).length, 1);
  assert.equal(policy.transfersCreated, 1);
  assert.equal(policy.active, false, 'atingiu o limite de transferências');
  a.close();
  b.close();
});

test('mundo online: ledger sobrevive à reinicialização do servidor', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'world-ledger-'));
  try {
    const world = new WorldServer({ dataDir });
    const a = fakeClient(world, 'city-a', {
      reserveWorldExport: () => true,
      worldExportReservationInfo: () => ({ buildingId: 'b1', accountId: 'acc1' }),
      reserveWorldBoatCrew: () => ({ ready: true, citizenId: 3 }),
      departWorldBoatCrew: () => true,
      departWorldExport: () => true,
      receiveWorldPayment: () => true,
      settleWorldPayment: () => true,
      completeWorldExport: () => true,
      returnWorldBoatCrew: () => true,
    });
    const b = fakeClient(world, 'city-b', {
      reserveWorldPayment: () => true,
      reserveWorldImport: () => true,
      receiveWorldImport: () => true,
      deliverWorldImport: () => true,
      finalizeWorldPayment: () => true,
    });
    a.connect({ minute: 10 });
    b.connect({ minute: 20 });
    world.handleTradeOrder('city-b', { sellerCityId: 'city-a', good: 'pao', quantity: 10, unitPrice: 5 });
    await flush();
    const transfer = [...world.transfers.values()][0];
    a.sendJson({ type: 'summary', minute: 30 });
    await world.tick();
    assert.equal(transfer.status, 'in-transit');
    world.flushLedger();
    assert.ok(existsSync(join(dataDir, 'ledger.json')));

    const restored = new WorldServer({ dataDir });
    assert.ok(restored.transfers.has(transfer.id));
    assert.equal(restored.transfers.get(transfer.id).status, 'in-transit');
    a.close();
    b.close();
    // The restored server finishes the voyage once both cities return.
    const a2 = fakeClient(restored, 'city-a', {
      returnWorldBoatCrew: () => true,
      receiveWorldPayment: () => true,
      settleWorldPayment: () => true,
      completeWorldExport: () => true,
    });
    const b2 = fakeClient(restored, 'city-b', {
      receiveWorldImport: () => true,
      deliverWorldImport: () => true,
      finalizeWorldPayment: () => true,
    });
    a2.connect({ minute: 10 });
    b2.connect({ minute: 20 + 400 });
    await restored.tick();
    assert.equal(deliveredTransfers(restored).length, 1);
    a2.close();
    b2.close();
  } finally { rmSync(dataDir, { recursive: true, force: true }); }
});

test('mundo online: ledger persistido no disco em formato legível', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'world-ledger-'));
  try {
    const world = new WorldServer({ dataDir });
    world.nextTransferNumber = 3;
    world.flushLedger();
    const raw = JSON.parse(readFileSync(join(dataDir, 'ledger.json'), 'utf8'));
    assert.equal(raw.version, 1);
    assert.equal(raw.nextTransferNumber, 3);
  } finally { rmSync(dataDir, { recursive: true, force: true }); }
});
