import { CityStateGraph, bindCityState, CITY_NEED_FIELDS } from './city_state.js?v=pocket-water-cutaway-1';

const graph = new CityStateGraph();
let state, paused = false, speed = 1, lastTime = performance.now(), accumulator = 0;
let tick = 0, elapsed = 0, awaitingAck = false, lastSnapshot = 0, lastMotion = 0, lastSnapshotCost = 0, dirty = false, forceSnapshotPending = false;
const MIN_STEP = 1 / 60;
// One city minute is 0.25 simulation seconds. At high speed, advancing it
// in one call avoids rescanning every citizen several times for subminute
// movement that is already interpolated on the main thread.
const stepSize = () => Math.min(.25,Math.max(MIN_STEP,speed/128));
// Large cities can spend most of the worker's time creating full snapshots.
// Keep motion/vitals at 100 ms and adjust only the heavier UI state update.
const stateInterval = () => Math.max(speed>=32?900:speed>=16?600:400,Math.min(2000,lastSnapshotCost*5));
const MOTION_INTERVAL = 100;
const allowed = new Set(['paint.setPalette','paint.requestPurchase','paint.requestVehicle','paint.requestBuilding','vehicles.mountFlag','vehicles.removeFlag','politics.leaseHeadquarters','economy.rentOffice','economy.configureEmployment','economy.offerShares','economy.buyShares','economy.cancelShareOffer','vehicles.configureAssembly','vehicles.buyVehicle','vehicles.transferVehicle','vehicles.revisePart','politics.research.commissionService','publications.write', 'publications.read', 'publications.configure', 'politics.intervene','politics.startPublicWork','politics.submitBill', 'politics.vetoBill', 'bank.deposit', 'bank.withdraw', 'bank.lend', 'currency.retire', 'addBuilding', 'setPolicies', 'setCitizenFinance']);

function positions() {
  const people = state.city.citizens, result = new Float64Array(people.length * 3);
  for (let i = 0; i < people.length; i++) {
    const c = people[i], at = i * 3;
    result[at] = c.id; result[at + 1] = c.entity.x; result[at + 2] = c.entity.y;
  }
  return result;
}
function interiorPositions(){
  const people=state.city.citizens,result=new Float64Array(people.length*4);
  for(let i=0;i<people.length;i++){const c=people[i],location=c.indoorLocation,bridge=c.skybridgeZ>0,at=i*4;result[at]=c.id;result[at+1]=bridge?c.entity.x:location?.position?.x??NaN;result[at+2]=bridge?c.entity.y:location?.position?.y??NaN;result[at+3]=bridge?c.skybridgeZ:location?.position?.z??NaN;}
  return result;
}
function indoorFlags(){
 const city=state.city,people=city.citizens,result=new Uint8Array(people.length);
 for(let i=0;i<people.length;i++){const location=people[i].indoorLocation;if(!location||(location.roomType==='roof_terrace'||location.roomType==='balcony'&&!location.path?.length))continue;const building=city.building(location.buildingId);result[i]=!building||building.constructionKind!=='open-air'?1:0;}
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
function vitals(){
  const people=state.city.citizens,stride=CITY_NEED_FIELDS.length+2,result=new Float64Array(people.length*stride);
  for(let i=0;i<people.length;i++){const c=people[i],at=i*stride;for(let j=0;j<CITY_NEED_FIELDS.length;j++)result[at+j]=c.needs[CITY_NEED_FIELDS[j]];result[at+CITY_NEED_FIELDS.length]=c.happiness;result[at+CITY_NEED_FIELDS.length+1]=c.mood;}
  return result;
}
function snapshot(force = false) {
  if (!state) return false;
  if (awaitingAck) { if (force) forceSnapshotPending = true; return false; }
  if (!force && performance.now() - lastSnapshot < stateInterval()) return false;
  const started = performance.now();
  const packet = graph.encode(state,{packNeeds:true,packPositions:true}), motion = positions(), inside=interiorPositions(),vehicles = vehiclePositions(),indoors=indoorFlags();
  lastSnapshotCost=performance.now()-started;
  postMessage({ type: 'state', packet, positions: motion, inside, vehicles, indoors, tick, elapsed, workMs: lastSnapshotCost }, [motion.buffer, inside.buffer, vehicles.buffer, indoors.buffer, packet.packedNeeds.buffer]);
  awaitingAck = true; lastSnapshot = lastMotion = performance.now(); dirty = forceSnapshotPending = false;
  return true;
}
function sendMotion() {
  if (!state || !dirty || paused || performance.now() - lastMotion < MOTION_INTERVAL) return;
  const motion = positions(), inside=interiorPositions(),vehicles = vehiclePositions(),needs=vitals(),indoors=indoorFlags();
  postMessage({ type: 'motion', positions: motion, inside, vehicles, needs, indoors, tick, elapsed }, [motion.buffer, inside.buffer, vehicles.buffer, needs.buffer, indoors.buffer]);
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
      state.city.update(MIN_STEP); tick++; elapsed += MIN_STEP; dirty = true; snapshot(true);
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
      postMessage({ type: 'result', id: data.id, ok, message: ok ? (['politics.leaseHeadquarters','economy.rentOffice','politics.intervene','economy.offerShares','economy.buyShares','economy.cancelShareOffer','politics.submitBill'].includes(data.path)?(result?.description||'Operação concluída.'):'') : errors[data.path] || state.city.lastError });
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
      const deadline = performance.now() + (speed>=16?14:8), step=stepSize();
      let steps = 0;
      while (accumulator >= step && steps < 240 && performance.now() < deadline) {
        state.city.update(step); accumulator -= step; tick++; elapsed += step; steps++;
      }
      if (steps) dirty = true;
    }
    if (dirty && !snapshot()) sendMotion();
  } catch (error) { fail(error); }
}, 16);
