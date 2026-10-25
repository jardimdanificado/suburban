import { CityStateGraph, bindCityState } from './city_state.js';

/** The worker owns simulation state; the UI keeps a read mirror with stable references. */
export class CitySimulationBridge {
  constructor({ city, entities, nextId, time, changed, notice }) {
    this.city = city; this.entities = entities; this.time = time; this.changed = changed; this.notice = notice;
    this.graph = new CityStateGraph(); this.state = { city, entities, nextId };
    this.active = false; this.commandId = 0; this.pending = new Map(); this.restores = [];
    this.motion = new Map();this.motionSamples=new Map(); this.lastSnapshot = performance.now();
    if (typeof Worker === 'undefined') return;
    try {
      this.worker = new Worker(new URL('./city_sim_worker.js?v=civic-institutions-1', import.meta.url), { type: 'module' });
      this.worker.onmessage = event => { try { this.receive(event.data); } catch (error) { this.fail(error.message); } };
      this.worker.onerror = event => this.fail(event.message || 'Falha ao carregar a simulação.');
      this.worker.postMessage({ type: 'init', packet: this.graph.encode(this.state) });
      this.active = true;
      for (const [target, path, method] of [[city, '', 'addBuilding'], [city, '', 'setPolicies'], [city, '', 'setCitizenFinance'],
        [city.publications, 'publications.', 'write'], [city.publications, 'publications.', 'read'], [city.publications, 'publications.', 'configure'], [city.bank, 'bank.', 'deposit'], [city.bank, 'bank.', 'withdraw'], [city.bank, 'bank.', 'lend'],
        [city.politics, 'politics.', 'submitBill'], [city.politics, 'politics.', 'vetoBill'], [city.currency, 'currency.', 'retire'], [city.world, 'world.', 'setTile']]) {
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
    this.pending.set(id, path); this.worker.postMessage({ type: 'command', id, path, args: encoded });
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
      const path = this.pending.get(data.id); this.pending.delete(data.id);
      if (!data.ok) this.notice(data.message || `Não foi possível concluir a operação: ${path}.`);
      return;
    }
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
    this.graph.apply(data.packet); bindCityState(this.city);
    this.time.tick = data.tick; this.time.elapsed = data.elapsed;
    this.city._statsCache = null;this.city._uiRevision=(this.city._uiRevision||0)+1;
    const now = performance.now(), duration = Math.max(16, Math.min(150, now - this.lastSnapshot));
    this.lastSnapshot = now;
    this.motion.clear();
    for(const c of this.city.citizens){
      let sample=this.motionSamples.get(c.id);const existing=!!sample;
      if(!sample){sample={id:c.id,from:{x:c.entity.x,y:c.entity.y},to:{}};this.motionSamples.set(c.id,sample);}
      sample.entity=c.entity;sample.seen=this.city._uiRevision;sample.to.x=c.entity.x;sample.to.y=c.entity.y;
      const dx=sample.to.x-sample.from.x,dy=sample.to.y-sample.from.y;
      if(existing&&!this.time.paused&&(dx!==0||dy!==0)&&Math.hypot(dx,dy)<8){
        sample.started=now;sample.duration=duration;this.motion.set(c.id,sample);
        c.entity.x=sample.from.x;c.entity.y=sample.from.y;
      }
    }
    for(const [id,sample] of this.motionSamples)if(sample.seen!==this.city._uiRevision)this.motionSamples.delete(id);
    this.changed({ terrain: revision !== this.city.world.revision, entities: count !== this.entities.length || structure !== this.city.structureRevision });
    this.metrics={encodeMs:data.workMs,applyMs:performance.now()-receiveStarted,changedNodes:data.packet.nodes.length,newEvents:(data.packet.histories||[]).reduce((n,h)=>n+h.entries.length,0)};
    this.worker.postMessage({ type: 'ack' });
  }
  interpolate(now) {
    for (const motion of this.motion.values()) {
      const t = this.time.paused ? 1 : Math.min(1, (now - motion.started) / motion.duration);
      motion.entity.x = motion.from.x + (motion.to.x - motion.from.x) * t;
      motion.entity.y = motion.from.y + (motion.to.y - motion.from.y) * t;
      if(t>=1)this.motion.delete(motion.id);
    }
  }
  fail(message) {
    this.worker?.terminate(); this.active = false;
    for (const restore of this.restores) restore(); this.restores = [];
    bindCityState(this.city);
    for (const motion of this.motion.values()) { motion.entity.x = motion.to.x; motion.entity.y = motion.to.y; }
    this.pending.clear(); this.motion.clear();this.motionSamples.clear();
    console.error('Simulação em segundo plano indisponível:', message);
    this.notice('Simulação em segundo plano indisponível; execução local ativada.');
  }
}
