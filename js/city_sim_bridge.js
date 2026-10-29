import {queueMotion} from './city_motion.js';
import { CityStateGraph, bindCityState, CITY_NEED_FIELDS } from './city_state.js?v=shared-origin-paths-1';
import {canStep,terrainWalkable} from './city_terrain.js?v=deep-perf-3';

// Worker snapshots can skip several corners of a valid route. Interpolating
// directly between those snapshots would draw a straight chord through water
// or rock even though the simulated route itself never crossed it.
function renderSegmentWalkable(world,ax,ay,bx,by){
  if(!Number.isFinite(ax)||!Number.isFinite(ay)||!Number.isFinite(bx)||!Number.isFinite(by))return false;
  const distance=Math.hypot(bx-ax,by-ay),steps=Math.max(1,Math.ceil(distance/.2));let px,py;
  for(let i=0;i<=steps;i++){
    const t=i/steps,x=ax+(bx-ax)*t,y=ay+(by-ay)*t,tx=Math.floor(x),ty=Math.floor(y);
    if(tx===px&&ty===py)continue;
    if(!terrainWalkable(world,tx,ty))return false;
    if(px!==undefined){
      if(tx!==px&&ty!==py){
        if(!terrainWalkable(world,tx,py)||!terrainWalkable(world,px,ty))return false;
      }
      if(!canStep(world,px,py,tx,ty))return false;
    }
    px=tx;py=ty;
  }
  return true;
}
export function sampleCitizenMotion(world,sample,now){
  // Citizens keep the simulation's discrete, retro step cadence. Interpolate
  // only when a worker packet skips over a corner along a valid ground path.
  const x=sample.entity.x,y=sample.entity.y,tx=sample.to.x,ty=sample.to.y;
  if(renderSegmentWalkable(world,x,y,tx,ty)){
    sample.entity.x=tx;sample.entity.y=ty;sample.blockedSince=null;sample.points.length=0;return true;
  }
  sample.blockedSince??=now;
  if(now-sample.blockedSince>=600&&terrainWalkable(world,Math.floor(tx),Math.floor(ty))){sample.entity.x=tx;sample.entity.y=ty;sample.points.length=0;sample.blockedSince=null;return true;}
  return false;
}
function renderIndoorPosition(c,position){
  if(Object.prototype.hasOwnProperty.call(c,'_renderIndoorPosition'))c._renderIndoorPosition=position;
  else Object.defineProperty(c,'_renderIndoorPosition',{value:position,writable:true,configurable:true,enumerable:false});
}
function sampleInterior(bridge,sample,now){
  if(bridge.time.paused)return;
 sample.entity.x=sample.to.x;sample.entity.y=sample.to.y;sample.entity.z=sample.to.z??0;
 renderIndoorPosition(sample.citizen,{x:sample.entity.x,y:sample.entity.y,z:sample.entity.z});
}
function receiveInteriorMotion(bridge,packet,now,resetAll=false){
  if(!packet)return;
  const live=new Set();
  for(let i=0;i<(packet?.length||0);i+=4){
    const id=packet[i],c=bridge.city.society.citizen(id);if(!c)continue;
    const x=packet[i+1],y=packet[i+2],z=packet[i+3];
    if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z)||(!c.indoorLocation&&z<=0)){renderIndoorPosition(c,null);bridge.interiorMotion.delete(id);continue;}
    live.add(id);let sample=bridge.interiorMotion.get(id);if(!sample){sample={id,citizen:c,entity:{x,y},to:{}};bridge.interiorMotion.set(id,sample);}sample.citizen=c;
    const reset=resetAll||!sample.points?.length||Math.hypot(x-sample.to.x,y-sample.to.y,z-(sample.to.z??z))>=8;
    queueMotion(sample,x,y,now,{reset});sample.to.z=z;sample.points.at(-1).z=z;
    if(reset)renderIndoorPosition(c,{x,y,z});else sampleInterior(bridge,sample,now);
  }
  for(const [id,sample]of bridge.interiorMotion)if(!live.has(id)){renderIndoorPosition(sample.citizen,null);bridge.interiorMotion.delete(id);}
}

/** The worker owns simulation state; the UI keeps a read mirror with stable references. */
export class CitySimulationBridge {
  constructor({ city, entities, nextId, time, changed, notice, noticeTarget, profiling=false }) {
    this.city = city; this.city.profileDiagnostics=profiling; this.entities = entities; this.time = time; this.changed = changed; this.notice = notice; this.noticeTarget = noticeTarget;
    this.graph = new CityStateGraph(); this.state = { city, entities, nextId };
    this.active = false; this.commandId = 0; this.pending = new Map(); this.restores = [];
    this.motion = new Map();this.motionSamples=new Map();this.interiorMotion=new Map();this.vehicleMotion=new Map(); this.lastPositionUpdate = performance.now();
    if (typeof Worker === 'undefined') return;
    try {
      this.worker = new Worker(new URL('./city_sim_worker.js?v=shared-origin-paths-1', import.meta.url), { type: 'module' });
      this.worker.onmessage = event => { try { this.receive(event.data); } catch (error) { this.fail(error.message); } };
      this.worker.onerror = event => this.fail(event.message || 'Falha ao carregar a simulação.');
      this.worker.postMessage({ type: 'init', packet: this.graph.encode(this.state),profileDiagnostics:profiling });
      this.active = true;
      for (const [target, path, method] of [[city, '', 'addBuilding'], [city, '', 'setPolicies'], [city, '', 'setCitizenFinance'],
        ...['setPalette','requestPurchase','requestVehicle','requestBuilding'].map(method=>[city.paint,'paint.',method]),[city.vehicles,'vehicles.','mountFlag'],[city.vehicles,'vehicles.','removeFlag'],[city.economy,'economy.','rentOffice'],[city.economy,'economy.','configureEmployment'],[city.economy,'economy.','offerShares'],[city.economy,'economy.','buyShares'],[city.economy,'economy.','cancelShareOffer'],[city.vehicles,'vehicles.','configureAssembly'],[city.vehicles,'vehicles.','buyVehicle'],[city.vehicles,'vehicles.','transferVehicle'],[city.vehicles,'vehicles.','revisePart'],[city.politics.research,'politics.research.','commissionService'],[city.publications, 'publications.', 'write'], [city.publications, 'publications.', 'read'], [city.publications, 'publications.', 'configure'], [city.bank, 'bank.', 'deposit'], [city.bank, 'bank.', 'withdraw'], [city.bank, 'bank.', 'lend'],
        [city.politics, 'politics.', 'leaseHeadquarters'],[city.politics, 'politics.', 'intervene'],[city.politics, 'politics.', 'startPublicWork'],[city.politics, 'politics.', 'submitBill'], [city.politics, 'politics.', 'vetoBill'], [city.currency, 'currency.', 'retire'], [city.world, 'world.', 'setTile']]) {
        const original = target[method];
        target[method] = (...args) => { this.command(path + method, args); return true; };
        this.restores.push(() => { delete target[method]; if (!Object.getPrototypeOf(target)[method]) target[method] = original; });
      }
    } catch (error) { this.fail(error.message); }
  }
  command(path, args) {
    const id = ++this.commandId;
    // Policies/options are plain data. Bank/building references use graph IDs.
    const encoded = args.map(arg => arg && typeof arg === 'object' && this.graph.ids.has(arg) ? this.graph.ref(arg) : arg);
    this.pending.set(id, {path,target:this.noticeTarget?.()}); this.worker.postMessage({ type: 'command', id, path, args: encoded });
  }
  control() {
    if (!this.active) return;
    const { paused, speed } = this.time, signature = `${paused}:${speed}`;
    if (signature !== this.controlSignature) {
      this.controlSignature = signature; this.worker.postMessage({ type: 'control', paused, speed });
    }
  }
  step() { if (this.active && this.time.paused) { this.control(); this.worker.postMessage({ type: 'step' }); return true; } return false; }
  receive(data) {
    if (!this.active) return;
    if (data.type === 'failure') { this.fail(data.message); return; }
    if (data.type === 'result') {
      const pending = this.pending.get(data.id),path=pending?.path; this.pending.delete(data.id);
      if (!data.ok || ['politics.leaseHeadquarters','economy.rentOffice','politics.intervene','economy.offerShares','economy.buyShares','economy.cancelShareOffer','politics.submitBill'].includes(path)) this.notice(data.message || `Não foi possível concluir a operação: ${path}.`,pending?.target);
      return;
    }
    if (data.type === 'motion') { this.receiveMotion(data); return; }
    if (data.type !== 'state') return;
    const receiveStarted=performance.now();
    const revision = this.city.world.revision, count = this.entities.length, structure = this.city.structureRevision;
    for(const c of this.city.citizens){
      let sample=this.motionSamples.get(c.id);
      if(!sample){sample={id:c.id,from:{},to:{},entity:c.entity};this.motionSamples.set(c.id,sample);}
      sample.from.x=c.entity.x;sample.from.y=c.entity.y;
    }
    // Unchanged graph nodes still hold authoritative positions, not an interpolation sample.
    for (const motion of this.motion.values()) { motion.entity.x = motion.to.x; motion.entity.y = motion.to.y; }
    for(const motion of this.vehicleMotion.values()){motion.entity.x=motion.to.x;motion.entity.y=motion.to.y;}
    this.graph.apply(data.packet); bindCityState(this.city);
    this.interiorMotion.clear();for(const c of this.city.citizens)renderIndoorPosition(c,c.indoorLocation?.position?{...c.indoorLocation.position}:null);receiveInteriorMotion(this,data.inside,performance.now(),true);
    this.time.tick = data.tick; this.time.elapsed = data.elapsed;
    this.city._statsCache = null;this.city._uiRevision=(this.city._uiRevision||0)+1;
    const now = performance.now();
    this.lastPositionUpdate = now;
    this.motion.clear();
    for(let i=0;i<this.city.citizens.length;i++){
      const c=this.city.citizens[i], at=i*3;
      let sample=this.motionSamples.get(c.id);const existing=!!sample;
      if(!sample){sample={id:c.id,from:{x:c.entity.x,y:c.entity.y},to:{}};this.motionSamples.set(c.id,sample);}
      sample.entity=c.entity;sample.citizen=c;sample.seen=this.city._uiRevision;
      sample.to.x=data.positions?.[at]===c.id?data.positions[at+1]:c.entity.x;
      sample.to.y=data.positions?.[at]===c.id?data.positions[at+2]:c.entity.y;
      c.entity.x=sample.to.x;c.entity.y=sample.to.y;
      const dx=sample.to.x-sample.from.x,dy=sample.to.y-sample.from.y;
      const reset=!existing||this.time.paused||Math.hypot(dx,dy)>=8;
      queueMotion(sample,sample.to.x,sample.to.y,now,{reset});
      if(!reset){this.motion.set(c.id,sample);sampleCitizenMotion(this.city.world,sample,now);}
    }
    for(const [id,sample] of this.motionSamples)if(sample.seen!==this.city._uiRevision)this.motionSamples.delete(id);
    this.applyVehiclePositions(data.vehicles);
    this.changed({ terrain: revision !== this.city.world.revision, entities: count !== this.entities.length || structure !== this.city.structureRevision });
    this.metrics={...this.metrics,...data.workerMetrics,encodeMs:data.workMs,applyMs:performance.now()-receiveStarted,changedNodes:data.packet.nodes.length,newEvents:(data.packet.histories||[]).reduce((n,h)=>n+h.entries.length,0)};
    this.worker.postMessage({ type: 'ack' });
  }
  receiveMotion(data) {
    const now=performance.now();
    if(data.workerMetrics)this.metrics={...this.metrics,...data.workerMetrics};
    this.interpolate(now);
    const positions=data.positions,needs=data.needs,needsStride=CITY_NEED_FIELDS.length+2;
    this.lastPositionUpdate=now;
    this.time.tick=data.tick;this.time.elapsed=data.elapsed;
    for(let i=0;i<positions.length;i+=3){
      const sample=this.motionSamples.get(positions[i]);
      if(!sample||sample.entity.destroyed)continue;
      if(needs){const c=sample.citizen,at=i/3*needsStride;for(let j=0;j<CITY_NEED_FIELDS.length;j++)c.needs[CITY_NEED_FIELDS[j]]=needs[at+j];c.happiness=needs[at+CITY_NEED_FIELDS.length];c.mood=needs[at+CITY_NEED_FIELDS.length+1];}
      const x=positions[i+1],y=positions[i+2],fromX=sample.to.x,fromY=sample.to.y;
      sample.from.x=fromX;sample.from.y=fromY;sample.to.x=x;sample.to.y=y;
      const dx=x-fromX,dy=y-fromY;
      const reset=this.time.paused||Math.hypot(dx,dy)>=8;
      queueMotion(sample,x,y,now,{reset});
      if(!reset){this.motion.set(sample.id,sample);sampleCitizenMotion(this.city.world,sample,now);}
      else {sample.entity.x=x;sample.entity.y=y;this.motion.delete(sample.id);}
    }
    receiveInteriorMotion(this,data.inside,now,this.time.paused);
    this.applyVehiclePositions(data.vehicles);
  }
  applyVehiclePositions(positions) {
    if(!positions)return;
    const now=performance.now(),live=new Set();
    for(let i=0;i<positions.length;i+=5){
      const v=this.city.vehicles.units.get(positions[i]);
      if(!v?.entity)continue;
      live.add(v.id);let motion=this.vehicleMotion.get(v.id);
      if(!motion){motion={entity:v.entity,to:{}};this.vehicleMotion.set(v.id,motion);}
      motion.entity=v.entity;
      const x=positions[i+1],y=positions[i+2];
      v.x=x;v.y=y;queueMotion(motion,x,y,now,{reset:true});
      v.entity.x=x;v.entity.y=y;
      v.altitude=positions[i+3];v.angle=positions[i+4];
    }
    for(const id of this.vehicleMotion.keys())if(!live.has(id))this.vehicleMotion.delete(id);
    this.synchronizeRiders();
  }
  synchronizeRiders(){
    for(const v of this.city.vehicles?.units?.values()||[]){
      if(!v.entity)continue;
      const passengers=v.passengerIds||[];
      for(let i=-1;i<passengers.length;i++){
        const id=i<0?v.driverId:passengers[i];if(id==null)continue;
        const c=this.city.society.citizen(id);if(!c||c.ridingVehicleId!==v.id)continue;
        const side=i<0?0:(i+1)*.34;
        c.entity.x=v.entity.x+Math.cos(v.angle||0)*side;c.entity.y=v.entity.y-Math.sin(v.angle||0)*side;
      }
    }
  }
  interpolate(now) {
    for(const motion of this.interiorMotion.values())sampleInterior(this,motion,now);
    for (const motion of this.motion.values()) {
      if(this.time.paused)continue;
      if(sampleCitizenMotion(this.city.world,motion,now))this.motion.delete(motion.id);
    }
    this.synchronizeRiders();
  }
  fail(message) {
    const wasRunning=this.active;
    this.worker?.terminate(); this.active = false;
    if(wasRunning)this.time.paused=true;
    for (const restore of this.restores) restore(); this.restores = [];
    bindCityState(this.city);
    this.city.lighting.siteBuckets=null;
    for (const motion of this.motion.values()) { motion.entity.x = motion.to.x; motion.entity.y = motion.to.y; }
    for(const motion of this.vehicleMotion.values()){motion.entity.x=motion.to.x;motion.entity.y=motion.to.y;}
    this.pending.clear(); this.motion.clear();this.motionSamples.clear();this.interiorMotion.clear();this.vehicleMotion.clear();
    console.error('Simulação em segundo plano indisponível:', message);
    this.notice(wasRunning?`Simulação pausada após erro: ${String(message).split('\n')[0]}`:'Simulação em segundo plano indisponível; execução local ativada.');
  }
}
