import { CityStateGraph, bindCityState } from './city_state.js?v=state-motion-7';

const graph = new CityStateGraph();
let state, paused = false, speed = 1, lastTime = performance.now(), accumulator = 0;
let tick = 0, elapsed = 0, awaitingAck = false, lastSnapshot = 0, lastMotion = 0, dirty = false, forceSnapshotPending = false;
const STEP = 1 / 60;
const STATE_INTERVAL = 400, MOTION_INTERVAL = 100;
const allowed = new Set(['vehicles.configureAssembly','vehicles.buyVehicle','vehicles.revisePart','publications.write', 'publications.read', 'publications.configure', 'politics.submitBill', 'politics.vetoBill', 'bank.deposit', 'bank.withdraw', 'bank.lend', 'currency.retire', 'addBuilding', 'setPolicies', 'setCitizenFinance']);

function positions() {
  const people = state.city.citizens, result = new Float64Array(people.length * 3);
  for (let i = 0; i < people.length; i++) {
    const c = people[i], at = i * 3;
    result[at] = c.id; result[at + 1] = c.entity.x; result[at + 2] = c.entity.y;
  }
  return result;
}
function vehiclePositions() {
  const vehicles = [...state.city.vehicles.units.values()].filter(v => v.active && !v.scrapped && v.entity);
  const result = new Float64Array(vehicles.length * 5);
  let at = 0;
  for (const v of vehicles) {
    result[at++] = v.id; result[at++] = v.x || 0; result[at++] = v.y || 0;
    result[at++] = v.altitude || 0; result[at++] = v.angle || 0;
  }
  return result;
}
function snapshot(force = false) {
  if (!state) return false;
  if (awaitingAck) { if (force) forceSnapshotPending = true; return false; }
  if (!force && performance.now() - lastSnapshot < STATE_INTERVAL) return false;
  const started = performance.now();
  const packet = graph.encode(state), motion = positions(), vehicles = vehiclePositions();
  postMessage({ type: 'state', packet, positions: motion, vehicles, tick, elapsed, workMs: performance.now() - started }, [motion.buffer, vehicles.buffer]);
  awaitingAck = true; lastSnapshot = lastMotion = performance.now(); dirty = forceSnapshotPending = false;
  return true;
}
function sendMotion() {
  if (!state || !dirty || paused || performance.now() - lastMotion < MOTION_INTERVAL) return;
  const motion = positions(), vehicles = vehiclePositions();
  postMessage({ type: 'motion', positions: motion, vehicles, tick, elapsed }, [motion.buffer, vehicles.buffer]);
  lastMotion = performance.now();
}
function fail(error) {
  paused = true;
  postMessage({ type: 'failure', message: error.stack || error.message || String(error) });
}
self.onmessage = ({ data }) => {
  try {
    if (data.type === 'init') {
      state = graph.apply(data.packet); bindCityState(state.city);
      state.city.createEntity = ({ x = 0, y = 0, properties = {}, ...extra }) => {
        const entity = { id: state.nextId++, x, y, destroyed: false, ...extra, properties };
        state.entities.push(entity); return entity;
      };
      lastTime = performance.now(); snapshot(true);
    } else if (data.type === 'control') {
      paused = data.paused; speed = data.speed;
      accumulator = 0; lastTime = performance.now();
    } else if (data.type === 'ack') {
      awaitingAck = false;
      if (dirty) snapshot(forceSnapshotPending);
    } else if (data.type === 'step' && state && paused) {
      state.city.update(STEP); tick++; elapsed += STEP; dirty = true; snapshot(true);
    } else if (data.type === 'command' && state) {
      let result;
      if (data.path === 'world.setTile') result = state.city.world.setTile(...data.args);
      else if (data.path === 'destroy') {
        const entity = graph.value(data.args[0]); if (entity) entity.destroyed = true;
        // Editor commands must take effect even while paused.
        state.city.reconcile(); state.city.development.reconcile();
        state.city.housing.reconcile(); state.city.sanitation.reconcile(); state.city.lighting.reconcile();
      } else if (allowed.has(data.path)) {
        const parts = data.path.split('.'), method = parts.pop();
        const target = parts.reduce((object, key) => object[key], state.city);
        result = target[method](...data.args.map(arg => graph.value(arg)));
      } else throw new Error(`Comando desconhecido: ${data.path}`);
      const errors = {
        'bank.deposit': 'Depósito indisponível: confira saldo e operação do banco.',
        'bank.withdraw': 'Saque indisponível: confira o saldo do depósito.',
        'bank.lend': 'Crédito indisponível: confira renda, limite e caixa do banco.',
        'currency.retire': 'É preciso preservar a reserva do tesouro e a base monetária mínima.',
      };
      const ok = result !== false && result !== null;
      postMessage({ type: 'result', id: data.id, ok, message: ok ? '' : errors[data.path] || state.city.lastError });
      dirty = true; snapshot(true);
    }
  } catch (error) {
    if (data.type === 'command') postMessage({ type: 'result', id: data.id, ok: false, message: error.message });
    else fail(error);
  }
};

setInterval(() => {
  if (!state) return;
  try {
    const now = performance.now(), dt = Math.min(.1, (now - lastTime) / 1000); lastTime = now;
    if (!paused) {
      // A bounded backlog prevents a slow hour from causing endless catch-up work.
      accumulator = Math.min(accumulator + dt * speed, Math.max(.25, speed * .25));
      const deadline = performance.now() + 8;
      let steps = 0;
      while (accumulator >= STEP && steps < 240 && performance.now() < deadline) {
        state.city.update(STEP); accumulator -= STEP; tick++; elapsed += STEP; steps++;
      }
      if (steps) dirty = true;
    }
    if (dirty && !snapshot()) sendMotion();
  } catch (error) { fail(error); }
}, 16);
