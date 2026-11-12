import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorldNetCoordinator } from '../js/world_net.js?v=world-net-1';

const makeCity = () => {
  const building = overrides => ({
    id: 'b-1', active: true, entity: { destroyed: false }, type: 'bakery',
    door: { x: 5, y: 5 }, workers: [{ wage: 10 }, { wage: 10 }], accountId: 'acc-bakery',
    inventory: {}, incoming: {}, worldIncoming: {}, importIncoming: {}, ...overrides,
  });
  const city = {
    minute: 100,
    buildings: [building({ type: 'market', inventory: { trigo: 40 } }), building({ id: 'b-2', inventory: { trigo: 0 } })],
    citizens: [],
    accounts: new Map([['acc-bakery', { balance: 100000 }], ['treasury', { balance: 0 }]]),
    worldPort: { cityId: 'city-1', door: { x: 8, y: 8 }, berth: { x: 8, y: 9 }, x: 8, y: 8 },
    economy: {
      goods: { trigo: { label: 'Trigo', price: 10 } },
      importDepot: null,
      accepts: () => true,
      retailAssortment: () => [],
    },
    currency: { price: cents => Math.ceil(cents / 100) },
    society: { isAdult: person => person.initialAge >= 18, age: person => person.initialAge, citizen: id => city.citizens.find(person => person.id === id) },
    vehicles: { recipeFor: () => ({ inputs: { trigo: 2 } }), units: new Map() },
    stats: () => ({ units: 10, occupied: 8, vacancies: 12, population: 40, happiness: 60 }),
    worldMigrationHousehold: citizenId => [citizenId],
    citizensById: null,
  };
  return city;
};

const makeCitizen = (overrides = {}) => ({
  id: 7, globalId: 'city-1:7', dead: false, entity: { destroyed: false, properties: { name: 'Zé' } },
  initialAge: 30, happiness: 40, jobId: null, homeUnitId: null, businessIds: [],
  needs: { food: 40, water: 50 }, traits: { ambition: .8, riskTolerance: .4 },
  worldMigrationPending: undefined, partnerId: null, childIds: [], ...overrides,
});

test('coordenador de rede: registro, diretório e rotas derivadas', () => {
  const city = makeCity();
  const coordinator = new WorldNetCoordinator({ cityId: 'city-1', cityGetter: () => ({ city, world: {} }) });
  coordinator.attachCity(city, {}, { preset: 'archipelago' });
  coordinator.setConnected(true, 'ws://test');
  assert.equal(coordinator.minute, 100);
  coordinator.cityOnline({ cityId: 'city-2', name: 'Vila Nova', summary: { population: 50 }, port: { x: 1, y: 1 }, minute: 90 });
  assert.ok(coordinator.routes.has('route:city-1>city-2'));
  assert.ok(coordinator.routes.has('route:city-2>city-1'));
  const vessel = coordinator.vessels.get('vessel:route:city-1>city-2');
  assert.equal(vessel.status, 'idle');
  assert.equal(coordinator.ports.get('city-2:port').cityId, 'city-2');
  coordinator.cityOffline('city-2');
  assert.equal(coordinator.routes.size, 0);
  assert.equal(coordinator.vessels.size, 0);
});

test('coordenador de rede: transferências espelhadas e relógio por cidade observada', () => {
  const city = makeCity();
  const coordinator = new WorldNetCoordinator({ cityId: 'city-1', cityGetter: () => ({ city, world: {} }) });
  coordinator.attachCity(city, {}, {});
  coordinator.setConnected(true, 'ws://test');
  coordinator.cityOnline({ cityId: 'city-2', name: 'Vila Nova', summary: {}, port: { x: 1, y: 1 }, minute: 200 });
  coordinator.transferUpdate({ id: 't-1', kind: 'goods', originCityId: 'city-2', destinationCityId: 'city-1', status: 'in-transit', departureMinute: 210, arrivalMinute: 270, routeId: 'route:city-2>city-1', payload: { good: 'trigo', quantity: 10 } });
  assert.equal(coordinator.transfers.get('t-1').arrivalMinute, 270);
  const vessel = coordinator.vessels.get('vessel:route:city-2>city-1');
  assert.equal(vessel.status, 'at-sea');
  // Observando a cidade de origem, a partida acontece no relógio dela.
  coordinator.prepareForRender('city-2');
  let mirror = coordinator.transfers.get('t-1');
  assert.equal(mirror.departureMinute, 210);
  assert.equal(mirror.arrivalMinute, 270);
  // Observando o destino, a chegada usa o relógio local e a partida é derivada.
  coordinator.prepareForRender('city-1');
  mirror = coordinator.transfers.get('t-1');
  assert.equal(mirror.arrivalMinute, 270);
  assert.equal(mirror.departureMinute, 210);
  coordinator.transferUpdate({ id: 't-1', status: 'delivered' });
  assert.equal(coordinator.transfers.size, 0);
  assert.equal(coordinator.vessels.get('vessel:route:city-2>city-1').status, 'idle');
});

test('coordenador de rede: ofertas de excedente e demandas reais', () => {
  const city = makeCity();
  city.buildings[0].incoming = {};
  city.buildings[1].incoming = {};
  const coordinator = new WorldNetCoordinator({ cityId: 'city-1', cityGetter: () => ({ city, world: {} }) });
  coordinator.attachCity(city, {}, {});
  const offers = coordinator.computeOffers();
  assert.equal(offers.length, 1);
  assert.equal(offers[0].good, 'trigo');
  assert.equal(offers[0].quantity, 34); // 40 - reserva de 6
  assert.ok(offers[0].unitPrice >= 1);
  // Uma transferência em andamento reserva o excedente.
  coordinator.transferUpdate({ id: 't-9', kind: 'goods', originCityId: 'city-1', destinationCityId: 'city-2', status: 'scheduled', payload: { good: 'trigo', quantity: 34 } });
  assert.equal(coordinator.computeOffers().length, 0);

  city.buildings[0].inventory.trigo = 0;
  city.buildings[0].incoming.trigo = 0;
  const demand = coordinator.computeDemand();
  assert.ok(demand.some(entry => entry.good === 'trigo' && entry.destinationBuildingId === 'b-2' && entry.quantity > 0));
});

test('coordenador de rede: candidatos de migração pontuam dificuldade local', () => {
  const city = makeCity();
  city.citizens = [makeCitizen()];
  const coordinator = new WorldNetCoordinator({ cityId: 'city-1', cityGetter: () => ({ city, world: {} }) });
  coordinator.attachCity(city, {}, {});
  const destination = { summary: { population: 50, units: 20, occupied: 10, openJobs: 10, averageHappiness: 70 } };
  const choice = coordinator.migrationCandidates(destination);
  assert.equal(choice.citizenId, 7);
  assert.equal(choice.household, false);
  // Cidadão satisfeito e empregado não migra.
  city.citizens = [makeCitizen({ jobId: 'b-1', homeUnitId: 'u-1', happiness: 80, needs: { food: 90, water: 90 } })];
  assert.equal(coordinator.migrationCandidates(destination).citizenId, undefined);
  // Destino sem vagas bloqueia a decisão.
  city.citizens = [makeCitizen()];
  assert.equal(coordinator.migrationCandidates({ summary: { population: 50, units: 20, occupied: 20, openJobs: 0, averageHappiness: 70 } }).citizenId, undefined);
});

test('coordenador de rede: resolveCitizen local e falha elegante para remotos', () => {
  const city = makeCity();
  city.citizens = [makeCitizen()];
  const coordinator = new WorldNetCoordinator({ cityId: 'city-1', cityGetter: () => ({ city, world: {} }) });
  coordinator.attachCity(city, {}, {});
  const person = coordinator.resolveCitizen('city-1:7');
  assert.equal(person.name, 'Zé');
  assert.equal(coordinator.resolveCitizen('city-2:99'), null);
});
