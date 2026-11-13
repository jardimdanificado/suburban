import {packBoatRiders,packBoatTows} from './boat_rider_motion.js';
import { CityStateGraph, bindCityState, CITY_NEED_FIELDS } from './city_state.js?v=regional-supply-12';
import { FF_SPEED, FF_LOD_SPEED, FF2_SPEED, FF3_SPEED, FF4_SPEED } from './simulation_time.js?v=ff3-ff4-steps-1';

const graph = new CityStateGraph();
let fieldTailPatches=false;
let state, paused = false, speed = 1, lastTime = performance.now(), accumulator = 0;
let cityId = 'city-1', observed=true;
let tick = 0, elapsed = 0, awaitingAck = false, lastSnapshot = 0, lastMotion = 0, lastSummary=0, lastSnapshotCost = 0, dirty = false, forceSnapshotPending = false, syncSnapshotPending = false;
const pendingCheckpointIds=[];
let lastUpdateMs=0,maxUpdateMs=0,maxUpdateMinute=0,maxUpdateProfile=null,updateTotalMs=0,updateCount=0,maxSnapshotMs=0,maxSnapshotMinute=0;
const phasePeaks={};
const MIN_STEP = 1 / 60;
// Keep ordinary worker updates to at most one city minute. Higher fast-forward
// modes batch more city minutes into each movement pass to reduce overhead.
const stepSize = () => speed >= FF4_SPEED ? 1 : speed >= FF3_SPEED ? .75 : speed >= FF2_SPEED ? .5 : Math.min(.25,Math.max(MIN_STEP,speed/128));
// Large cities can spend most of the worker's time creating full snapshots.
// Keep motion/vitals at 100 ms and adjust only the heavier UI state update.
// Full graph snapshots are the most expensive worker messages. At fast speeds
// the compact motion stream keeps people and needs current, so batch the slower
// business/political/UI graph updates more aggressively.
const stateInterval = () => {
  const people=state?.city?.citizens?.length||0;
  // Movement and needs have a compact 100 ms stream. Keep the heavier
  // object-graph sync less frequent once the full city reaches 512 citizens;
  // this avoids repeatedly walking and applying thousands of UI-facing nodes.
  const populationFloor=people>=1024?3000:people>=512?2500:400;
  if(speed>=128)return Math.max(4000,populationFloor,Math.min(5000,lastSnapshotCost*8));
  return Math.max(speed>=32?3000:speed>=16?1000:populationFloor,populationFloor,Math.min(3000,lastSnapshotCost*6));
};
const motionInterval=()=>observed?(speed>=128?320:100):500;
const allowed = new Set(['history.configureFavorites','paint.setPalette','paint.requestPurchase','paint.requestVehicle','paint.requestBuilding','vehicles.mountFlag','vehicles.removeFlag','politics.leaseHeadquarters','economy.rentOffice','economy.configureEmployment','economy.offerShares','economy.buyShares','economy.cancelShareOffer','vehicles.configureAssembly','vehicles.buyVehicle','vehicles.transferVehicle','vehicles.revisePart','politics.research.commissionService','publications.write', 'publications.read', 'publications.configure', 'politics.executePlayerAction','politics.intervene','politics.startPublicWork','politics.submitBill', 'politics.vetoBill', 'bank.deposit', 'bank.withdraw', 'bank.lend', 'bank.fileRecoveryPlan', 'currency.retire', 'addBuilding', 'setPolicies', 'setCitizenFinance','reserveWorldExport','worldExportReservationInfo','departWorldExport','completeWorldExport','returnWorldExport','reserveWorldImport','cancelWorldImport','receiveWorldImport','deliverWorldImport','reserveWorldPayment','receiveWorldPayment','settleWorldPayment','receiveWorldFreightIncome','setWorldBoatAssigned','approachWorldBoat','reserveWorldBoatCrew','departWorldBoatCrew','returnWorldBoatCrew','payWorldPassengerFare','refundWorldPassengerFare','refundWorldPayment','finalizeWorldPayment','reserveWorldCitizenMigration','cancelWorldCitizenMigration','departWorldCitizenMigration','receiveWorldCitizenMigration','completeWorldCitizenMigration','reserveWorldHouseholdMigration','cancelWorldHouseholdMigration','departWorldHouseholdMigration','receiveWorldHouseholdMigration','completeWorldHouseholdMigration']);

function positions() {
  const people = state.city.citizens, result = new Float64Array(people.length * 4);
  for (let i = 0; i < people.length; i++) {
    const c = people[i], at = i * 4;
    result[at] = c.id; result[at + 1] = c.entity.x; result[at + 2] = c.entity.y; result[at + 3] = c.path?.length ? 1 : 0;
  }
  return result;
}
function interiorPositions(){
  const people=state.city.citizens,result=new Float64Array(people.length*4);
  for(let i=0;i<people.length;i++){const c=people[i],location=c.indoorLocation,bridge=c.skybridgeZ>0,at=i*4;result[at]=c.id;result[at+1]=bridge?c.entity.x:location?.position?.x??NaN;result[at+2]=bridge?c.entity.y:location?.position?.y??NaN;result[at+3]=bridge?c.skybridgeZ:location?.position?.z??NaN;}
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
function recordProfile(profile,prefix=''){
  if(!profile)return;
  for(const [key,value]of Object.entries(profile)){
    if(key==='step'||key==='societyDetail'||key==='conversationParts'||key==='businessSearch'||key==='civicDetail'||key==='justiceParts'||key==='siteSearch'||key==='citizenDetail'){recordProfile(value,`${prefix}${key==='step'?'step.':key==='societyDetail'?'societyDetail.':key==='conversationParts'?'conversationParts.':key==='civicDetail'?'civicDetail.':key==='justiceParts'?'justiceParts.':key==='siteSearch'?'siteSearch.':key==='citizenDetail'?'citizenDetail.':'businessSearch.'}`);continue;}
    if(key==='pathSearchPeak'&&value){
      const current=phasePeaks[`${prefix}pathSearchPeak`];
      if(!current||profile.pathSearchMaxMs>current.ms)phasePeaks[`${prefix}pathSearchPeak`]={ms:profile.pathSearchMaxMs,minute:profile.minute,...value};
      continue;
    }
    if(key==='economyHourly'&&value){
      const name=`${prefix}economyHourly`,current=phasePeaks[name];
      if(!current||value.ms>current.ms)phasePeaks[name]={...value,minute:profile.minute};
      recordProfile(value,`${prefix}economyHourly.`);
      continue;
    }
    if(key==='pathSearchWork'&&value){
      const name=`${prefix}pathSearchWork`,current=phasePeaks[name];
      if(!current||profile.pathSearchTotalMs>current.ms)phasePeaks[name]={ms:profile.pathSearchTotalMs,minute:profile.minute,...value};
      continue;
    }
    if(key==='pathSearches'&&Number.isFinite(value)){
      const name=`${prefix}pathSearches`,current=phasePeaks[name];
      if(!current||value>current.count)phasePeaks[name]={count:value,minute:profile.minute};
      continue;
    }
    if((key==='completedCount'||key==='prejudiceActCount'||key==='calls'||key==='inspections'||key==='orientationHits'||key.endsWith('CandidateCount'))&&Number.isFinite(value)){
      const name=prefix+key,peak=phasePeaks[name];if(!peak||value>peak.count)phasePeaks[name]={count:value,minute:profile.minute};
      continue;
    }
    if(key.endsWith('CacheHits')&&Number.isFinite(value)){
      const name=prefix+key,peak=phasePeaks[name];if(!peak||value>peak.count)phasePeaks[name]={count:value,minute:profile.minute};
      continue;
    }
    if(!key.endsWith('Ms')||!Number.isFinite(value))continue;
    const name=prefix+key,peak=phasePeaks[name];if(!peak||value>peak.ms)phasePeaks[name]={ms:value,minute:profile.minute};
  }
}
function workerMetrics(includeProfile=false){return{lastUpdateMs,maxUpdateMs,maxUpdateMinute,...(includeProfile?{maxUpdateProfile}:{}),averageUpdateMs:updateCount?updateTotalMs/updateCount:0,maxSnapshotMs,maxSnapshotMinute,phasePeaks};}
function snapshot(force = false, sync = false) {
  if (!state) return false;
  // A city nobody is viewing keeps its state in the worker. Periodic graphs
  // would still cost hundreds of milliseconds to encode and would force the
  // UI thread to rebuild a mirror that is not drawn. Only explicit checkpoints
  // (city selection or save) request a state transfer.
  if (!observed && !sync) return false;
  if (awaitingAck) { if (force) forceSnapshotPending = true; if (sync) syncSnapshotPending = true; return false; }
  if (!force && performance.now() - lastSnapshot < stateInterval()) return false;
  const started = performance.now();  // The compact typed array for citizen needs beats routing them through the
  // object graph (measured: graph deltas cost ~8% more bytes and ~10% more
  // encode time than the packed array). The journal cadence, however, stays: it
  // trades the same bytes for lighter per-snapshot encoding and apply.
  const packet = graph.encode(state,{packNeeds:true,packPositions:true,omitCitizenPaths:true,fieldTailPatches,historyEvery:sync?1:4}), motion = positions(), inside=interiorPositions(),vehicles = vehiclePositions();
  lastSnapshotCost=performance.now()-started;
  if(lastSnapshotCost>maxSnapshotMs){maxSnapshotMs=lastSnapshotCost;maxSnapshotMinute=state.city.minute;}
  const checkpointIds=pendingCheckpointIds.splice(0);
  const transfer=[motion.buffer, inside.buffer, vehicles.buffer];
  if(packet.packedNeeds)transfer.push(packet.packedNeeds.buffer);
  postMessage({ type: 'state', cityId, packet, checkpointIds, positions: motion, boatRiders:packBoatRiders(state.city.citizens), boatTows:packBoatTows(state.city.citizens), inside, vehicles, tick, elapsed, sync, encodedWhileObserved: observed, workMs: lastSnapshotCost, workerMetrics:workerMetrics(true) }, transfer);
  awaitingAck = true; lastSnapshot = lastMotion = performance.now(); dirty = forceSnapshotPending = false;
  return true;
}
function sendMotion() {
  if (!state || !dirty || paused || performance.now() - lastMotion < motionInterval()) return;
  if(!observed){postMessage({type:'heartbeat',cityId,minute:state.city.minute,tick,elapsed,workerMetrics:workerMetrics()});lastMotion=performance.now();return;}
  const motion = positions(), inside=interiorPositions(),vehicles = vehiclePositions(),needs=vitals();
  postMessage({ type: 'motion', cityId, minute:state.city.minute, positions: motion, boatRiders:packBoatRiders(state.city.citizens), boatTows:packBoatTows(state.city.citizens), inside, vehicles, needs, tick, elapsed, workerMetrics:workerMetrics() }, [motion.buffer, inside.buffer, vehicles.buffer, needs.buffer]);
  lastMotion = performance.now();
}
function sendSummary(){
  if(!state||performance.now()-lastSummary<5000)return;lastSummary=performance.now();
  const city=state.city,people=(city.citizens||[]).filter(person=>!person.dead&&!person.entity.destroyed);
  const happiness=people.map(person=>Number.isFinite(person.happiness)?person.happiness:person.mood||0);
  const stats=city.stats(),units=Number.isFinite(stats.units)?stats.units:0,occupied=Number.isFinite(stats.occupied)?stats.occupied:0;
  postMessage({type:'summary',cityId,summary:{minute:city.minute,population:people.length,adults:people.filter(person=>city.society.isAdult(person)).length,homeless:people.filter(person=>!person.homeUnitId).length,employed:people.filter(person=>!!person.jobId).length,businesses:city.economy.businesses.length,averageHappiness:happiness.length?Math.round(happiness.reduce((sum,value)=>sum+value,0)/happiness.length):0,units,occupied,vacancies:Math.max(0,units-occupied),openJobs:Math.max(0,(Number.isFinite(stats.vacancies)?stats.vacancies:0))}});
}
function fail(error) {
  paused = true;
  postMessage({ type: 'failure', cityId, message: error.stack || error.message || String(error) });
}
self.onmessage = ({ data }) => {
  if(data.type!=='init'&&data.cityId&&data.cityId!==cityId)return;
  try {
    if (data.type === 'init') {
      cityId = data.cityId || 'city-1';
      fieldTailPatches=data.stateFeatures?.fieldTailPatches===true&&graph.supportsFieldTailPatches===true;
      state = graph.apply(data.packet); bindCityState(state.city);
      for(const citizen of state.city.citizens)citizen.globalId??=`${cityId}:${citizen.id}`;
      state.city.staggerInitialTaskDecisions();
      state.city.profileDiagnostics=data.profileDiagnostics===true;
      state.city.createEntity = ({ x = 0, y = 0, properties = {}, ...extra }) => {
        const entity = { id: state.nextId++, x, y, destroyed: false, ...extra, properties };
        state.entities.push(entity); return entity;
      };
      lastTime = performance.now(); snapshot(true, true);
    } else if(data.type==='benchmark-memory'&&state&&globalThis.process?.memoryUsage){
      const beforeGc=globalThis.process?.memoryUsage?.()||null;globalThis.gc?.();
      const memory=globalThis.process?.memoryUsage?.()||null,cacheSizes={},graphKinds={},graphSlots={};
      const holders={city:state.city,economy:state.city.economy,society:state.city.society,relationships:state.city.relationships,history:state.city.history,logistics:state.city.logistics,development:state.city.development,housing:state.city.housing,sanitation:state.city.sanitation,justice:state.city.justice,government:state.city.government,graph};
      for(const [holderName,holder] of Object.entries(holders))for(const [key,value] of Object.entries(holder||{}))if((value instanceof Map||value instanceof Set||Array.isArray(value))&&/cache|index|path|route|moving|next|retry|history|fact|relation|ship|event|feed|object|previous/i.test(key))cacheSizes[`${holderName}.${key}`]=value.size??value.length;
      for(const node of graph.previous.values()){graphKinds[node.kind]=(graphKinds[node.kind]||0)+1;graphSlots[node.kind]=(graphSlots[node.kind]||0)+(node.data?.length||0);}
      const people=state.city.citizens||[];
      postMessage({type:'benchmark-memory',id:data.id,beforeGc,memory,gcAvailable:typeof globalThis.gc==='function',diagnostics:{graphObjects:graph.objects.size,graphPrevious:graph.previous.size,graphRelations:graph.relationNodes.size,graphHistoryCursors:graph.historyCursors.size,graphKinds,graphSlots,people:people.length,relationships:state.city.society.relations.size,socialFacts:state.city.relationships.facts?.size||0,socialMemories:people.reduce((sum,person)=>sum+(person.social?.memories?.length||0)+(person.social?.beliefs?.length||0),0),cacheSizes}});
    } else if (data.type === 'control') {
      const timeChanged=paused!==data.paused||speed!==data.speed,observationChanged=observed!== (data.observed!==false);
      paused = data.paused; speed = data.speed;
      observed=data.observed!==false;
      if(state){
        // Simulation LOD speed tiers apply to the observed city; a background
        // city nobody renders always runs the fast-forward deferral, cutting
        // the per-minute CPU of every resident pass without touching system
        // rules more than the tested ff path already does (plano-fase 4).
        state.city.fastForward = observed ? speed >= FF_LOD_SPEED : true;
        state.city.fastForward2 = speed >= FF2_SPEED;
        state.city.detailedInteriorBuildingId=data.detailBuildingId??null;
      }
      if(timeChanged){accumulator = 0; lastTime = performance.now();}
      // Resuming observation needs a graph update even while paused so the
      // frozen mirror catches up before the city is drawn.
      if(observationChanged&&observed){lastSnapshot=0;dirty=true;}
    } else if (data.type === 'ack') {
      awaitingAck = false;
      if (dirty) { const force=forceSnapshotPending, sync=syncSnapshotPending; forceSnapshotPending=false; syncSnapshotPending=false; snapshot(force,sync); }
    } else if (data.type === 'checkpoint' && state) {
      if(Number.isSafeInteger(data.id))pendingCheckpointIds.push(data.id);
      dirty = true;
      if (awaitingAck) { forceSnapshotPending = true; syncSnapshotPending = true; }
      else snapshot(true, true);
    } else if (data.type === 'export-state' && state) {
      // A fresh encoder walks the whole authoritative state, so the packet can
      // be restored without any baseline from the receiver. This keeps the
      // large encode off the UI thread when the world is saved.
      const started=performance.now();
      const packet=new CityStateGraph().encode(state);
      postMessage({type:'export-state',cityId,id:data.id,packet,workMs:performance.now()-started});
    } else if (data.type === 'step' && state && paused) {
      state.city.update(MIN_STEP); tick++; elapsed += MIN_STEP; dirty = true; snapshot(true, true);
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
        reserveWorldCitizenMigration: 'Este adulto não está mais elegível para embarque. Atualize a seleção e tente novamente.',
        reserveWorldHouseholdMigration: 'Este núcleo familiar não está mais elegível para embarque. Atualize a seleção e tente novamente.',
      };
      const ok = result !== false && result !== null;
      postMessage({ type: 'result', cityId, id: data.id, ok, value:result, message: ok ? (['politics.leaseHeadquarters','economy.rentOffice','politics.intervene','economy.offerShares','economy.buyShares','economy.cancelShareOffer','politics.submitBill'].includes(data.path)?(result?.description||'Operação concluída.'):'') : errors[data.path] || state.city.lastError });
      // Commands still answer immediately; the mirror of a background city
      // catches up on its next checkpoint instead of paying a graph transfer.
      dirty = true; if(observed)snapshot(true);
    }
  } catch (error) {
    if (data.type === 'command') postMessage({ type: 'result', cityId, id: data.id, ok: false, message: error.message });
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
        const started=performance.now();state.city.update(step);lastUpdateMs=performance.now()-started;recordProfile(state.city.lastUpdateProfile);updateTotalMs+=lastUpdateMs;updateCount++;
        if(lastUpdateMs>maxUpdateMs){maxUpdateMs=lastUpdateMs;maxUpdateMinute=state.city.minute;maxUpdateProfile=state.city.profileDiagnostics?state.city.lastUpdateProfile:null;}
        accumulator -= step; tick++; elapsed += step; steps++;
      }
      if (steps) dirty = true;
    }
    sendSummary();
    if (dirty && !snapshot()) sendMotion();
  } catch (error) { fail(error); }
}, 16);
