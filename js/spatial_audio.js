import { ANIMAL_SPECIES } from './animal_catalog.js';

// Spatial game audio. Every ember (fauna, construction sites, city ambience)
// gets a PannerNode placed at its world position; the listener follows the
// active camera, so panning and distance change as the camera moves.
// Pausing stops every source immediately: no fade, no queued voices.

export const DEFAULT_MANIFEST_URL = 'data/audio/manifest.json';
export const MAX_AUDIBLE_SPEED = 16;
const WATER_TILE = 2;
const MARKET_TYPES = new Set(['market', 'greengrocer', 'restaurant', 'bakery']);
const MAX_BUFFER_BYTES = 24 * 1024 * 1024;
const FAUNA_VOICE_LIMIT = 3;

// Same curve as the PannerNode 'inverse' distance model, kept pure so the
// selection code and the tests can reason about loudness without Web Audio.
export function distanceAttenuation(distance, { refDistance = 4, maxDistance = 40, rolloffFactor = 1.2 } = {}) {
  if (!(distance > 0)) return 1;
  if (distance >= maxDistance) return 0;
  const d = Math.max(distance, refDistance);
  return Math.max(0, Math.min(1, refDistance / (refDistance + rolloffFactor * (d - refDistance))));
}

export function isNightHour(hour) {
  return !Number.isFinite(hour) || hour < 6 || hour >= 19;
}

// Listener pose in world units. Isometric views listen from the camera focus
// (ground level), not from the orthographic eye 100+ units up in the air, so
// distance attenuation stays meaningful. Perspective views use the real eye.
export function listenerPose(renderer, groundY = 1) {
  if (!renderer) return null;
  const perspective = typeof renderer.isPerspectiveActive === 'function' && renderer.isPerspectiveActive();
  const camera = perspective ? renderer.fpCamera : renderer.camera;
  if (!camera?.position) return null;
  const m = camera.matrixWorld?.elements;
  let fx = 0, fy = 0, fz = -1;
  if (m && m.length >= 11) {
    const length = Math.hypot(m[8], m[9], m[10]) || 1;
    fx = -m[8] / length; fy = -m[9] / length; fz = -m[10] / length;
  }
  if (perspective) {
    const p = camera.position;
    return { x: p.x, y: p.y, z: p.z, fx, fy, fz };
  }
  const x = Number(renderer.camX), z = Number(renderer.camY);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  let dx = x - camera.position.x, dz = z - camera.position.z;
  const length = Math.hypot(dx, dz);
  if (length > 1e-6) { dx /= length; dz /= length; } else { dx = 0; dz = -1; }
  return { x, y: groundY, z, fx: dx, fy: 0, fz: dz };
}

// Weighted pick of one animal that is allowed to call right now.
export function chooseFaunaCall({ animals, listener, species = ANIMAL_SPECIES, random = Math.random, now = 0, radius = 22, cooldown = 6, lastCallAt = new Map(), night = false } = {}) {
  if (!listener || !animals) return null;
  const options = [];
  for (const animal of animals) {
    if (!animal || animal.dead || animal.entity?.destroyed) continue;
    const spec = species[animal.species];
    if (!spec) continue;
    if (animal.state === 'sleep') continue;
    const dx = animal.x - listener.x, dz = animal.y - listener.z;
    const distance = Math.hypot(dx, dz);
    if (distance > radius) continue;
    if (now - (lastCallAt.get(animal.species) ?? -Infinity) < cooldown) continue;
    const attenuation = distanceAttenuation(distance, { refDistance: 4, maxDistance: radius, rolloffFactor: 1.1 });
    if (attenuation < 0.04) continue;
    let weight = attenuation;
    weight *= spec.canFly ? 1.35 : 0.85;
    if (animal.category === 'livestock') weight *= 0.7;
    if (animal.state === 'flee' || animal.provokedUntil > 0) weight *= 1.6;
    if (night) weight *= spec.bodyPlan === 'owl' || animal.species === 'urubu' ? 1.8 : spec.canFly ? 0.2 : 1;
    options.push({ animal, species: animal.species, x: animal.x, y: animal.altitude || 0, z: animal.y, distance, weight });
  }
  if (!options.length) return null;
  const total = options.reduce((sum, option) => sum + option.weight, 0);
  let roll = random() * total;
  for (const option of options) {
    roll -= option.weight;
    if (roll <= 0) return option;
  }
  return options[options.length - 1];
}

// Ambience zones for the camera surroundings. Each zone becomes a looping
// positional emitter anchored at the nearest real feature.
export function ambiencePlan({ listener, features = {}, night = false } = {}) {
  if (!listener) return [];
  const zones = [];
  const add = (key, feature, volume, radius) => {
    if (!feature || !Number.isFinite(feature.x) || !Number.isFinite(feature.z)) return;
    const distance = Math.hypot(feature.x - listener.x, feature.z - listener.z);
    if (distance > radius) return;
    const gain = volume * distanceAttenuation(distance, { refDistance: 6, maxDistance: radius, rolloffFactor: 0.8 });
    if (gain >= 0.03) zones.push({ key, x: feature.x, z: feature.z, distance, gain });
  };
  add(night ? 'frogs' : 'river', features.water, 0.55, 26);
  add(night ? 'night_insects' : 'forest_birds', features.plants, 0.5, 24);
  add('market', features.market, 0.55, 22);
  add('construction', features.construction, 0.5, 24);
  add('city_street', features.buildings, night ? 0.22 : 0.32, 26);
  zones.sort((a, b) => b.gain - a.gain);
  return zones.slice(0, 3);
}

function defaultContextFactory() {
  const Constructor = globalThis.AudioContext || globalThis.webkitAudioContext;
  return Constructor ? new Constructor({ latencyHint: 'interactive' }) : null;
}

function defaultMediaFactory(url) {
  const element = new globalThis.Audio();
  element.src = url;
  element.preload = 'auto';
  element.loop = true;
  return element;
}

function setNodePosition(node, x, y, z) {
  if (node.positionX) {
    node.positionX.setValueAtTime(x, node.context.currentTime);
    node.positionY.setValueAtTime(y, node.context.currentTime);
    node.positionZ.setValueAtTime(z, node.context.currentTime);
  } else {
    node.setPosition(x, y, z);
  }
}

export class SpatialAudio {
  constructor({
    renderer = null,
    getCity = () => null,
    getPaused = () => false,
    getSpeed = () => 1,
    groundYAt = () => 1,
    onPauseChange = () => {},
    manifestUrl = DEFAULT_MANIFEST_URL,
    contextFactory = defaultContextFactory,
    mediaFactory = defaultMediaFactory,
    fetchImpl = (...args) => fetch(...args),
    random = Math.random,
    volume = 0.8,
    muted = false,
    maxBufferBytes = MAX_BUFFER_BYTES,
  } = {}) {
    this.renderer = renderer;
    this.getCity = getCity;
    this.getPaused = getPaused;
    this.getSpeed = getSpeed;
    this.groundYAt = groundYAt;
    this.onPauseChange = onPauseChange;
    this.manifestUrl = manifestUrl;
    this.contextFactory = contextFactory;
    this.mediaFactory = mediaFactory;
    this.fetchImpl = fetchImpl;
    this.random = random;
    this.volume = volume;
    this.muted = muted;
    this.maxBufferBytes = maxBufferBytes;

    this.ctx = null;
    this.master = null;
    this.ready = false;
    this.loading = null;
    this.disposed = false;
    this.paused = null;
    this.animalFiles = {};
    this.worldFiles = {};
    this.buffers = new Map();
    this.bufferBytes = 0;
    this.playing = new Set();
    this.channels = new Map();
    this.lastCallAt = new Map();
    this.activeFauna = 0;
    this.faunaTimer = 1.4;
    this.ambienceTimer = 0;
    this.lastEventId = null;
    this.eventCursor = -1;
  }

  async load() {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const response = await this.fetchImpl(this.manifestUrl, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`Manifesto de áudio indisponível (${response.status}).`);
      const manifest = await response.json();
      for (const [species, entry] of Object.entries(manifest.animals || {})) this.animalFiles[species] = entry.local_file;
      for (const [key, entry] of Object.entries(manifest.world || {})) this.worldFiles[key] = entry.local_file;
      this.ready = true;
      return manifest;
    })();
    try { return await this.loading; } finally { this.loading = null; }
  }

  get available() { return this.ready; }

  ensureContext() {
    if (this.ctx || this.disposed) return this.ctx;
    try { this.ctx = this.contextFactory(); } catch { return null; }
    if (!this.ctx) return null;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  async unlock() {
    const context = this.ensureContext();
    if (!context) return;
    try {
      if (context.state === 'suspended') await context.resume();
    } catch {}
    // Media-element loops rejected before the first gesture must be retried.
    for (const channel of this.channels.values()) {
      if (!channel.element.paused) continue;
      channel.element.play().catch(() => {});
    }
  }

  setMuted(value) {
    this.muted = !!value;
    this.applyMasterGain();
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value) || 0));
    this.applyMasterGain();
  }

  applyMasterGain() {
    if (!this.master || !this.ctx) return;
    const value = this.muted ? 0 : this.volume;
    this.master.gain.setTargetAtTime(value, this.ctx.currentTime, 0.04);
  }

  setPaused(paused) {
    paused = !!paused;
    if (paused === this.paused) return false;
    this.paused = paused;
    if (paused) this.silenceSources();
    this.onPauseChange(paused);
    return true;
  }

  // Hard stop: every buffer source is stopped on the spot and every loop is
  // paused. Nothing decays through a fade, so pause is truly silent.
  silenceSources() {
    for (const handle of this.playing) {
      try { handle.source.stop(0); } catch {}
    }
    this.playing.clear();
    this.activeFauna = 0;
    const now = this.ctx?.currentTime ?? 0;
    for (const channel of this.channels.values()) {
      try {
        channel.gain.gain.cancelScheduledValues(now);
        channel.gain.gain.setValueAtTime(0, now);
      } catch {}
      try { channel.element.pause(); } catch {}
      channel.stopAt = Infinity;
    }
    this.faunaTimer = 0.8;
    this.ambienceTimer = 0;
  }

  update(dt = 0) {
    if (this.disposed) return;
    this.setPaused(this.getPaused());
    if (this.paused) return;
    const context = this.ensureContext();
    if (!context) return;
    if ((this.getSpeed() || 1) > MAX_AUDIBLE_SPEED) { this.silenceSources(); return; }
    const renderer = this.renderer;
    const ground = this.groundYAt(Number(renderer?.camX) || 0, Number(renderer?.camY) || 0) + 1.2;
    const pose = listenerPose(renderer, ground);
    if (!pose) return;
    this.updateListener(pose);
    this.updateAmbience(dt, pose);
    this.updateFauna(dt, pose);
    this.pollCityEvents(pose);
  }

  updateListener(pose) {
    const listener = this.ctx.listener;
    const now = this.ctx.currentTime;
    if (listener.positionX) {
      listener.positionX.setTargetAtTime(pose.x, now, 0.08);
      listener.positionY.setTargetAtTime(pose.y, now, 0.08);
      listener.positionZ.setTargetAtTime(pose.z, now, 0.08);
      if (listener.forwardX) {
        listener.forwardX.setTargetAtTime(pose.fx, now, 0.08);
        listener.forwardY.setTargetAtTime(pose.fy, now, 0.08);
        listener.forwardZ.setTargetAtTime(pose.fz, now, 0.08);
        listener.upX.setTargetAtTime(0, now, 0.08);
        listener.upY.setTargetAtTime(1, now, 0.08);
        listener.upZ.setTargetAtTime(0, now, 0.08);
      } else {
        listener.setOrientation(pose.fx, pose.fy, pose.fz, 0, 1, 0);
      }
    } else {
      listener.setPosition(pose.x, pose.y, pose.z);
      listener.setOrientation(pose.fx, pose.fy, pose.fz, 0, 1, 0);
    }
  }

  updateFauna(dt, pose) {
    this.faunaTimer -= dt;
    if (this.faunaTimer > 0) return;
    this.faunaTimer = 1.1 + this.random() * 1.9;
    if (this.activeFauna >= FAUNA_VOICE_LIMIT) return;
    const animals = this.getCity()?.fauna?.animals;
    if (!animals?.size) return;
    const night = isNightHour(this.getCity()?.hour);
    const call = chooseFaunaCall({
      animals: animals.values(),
      listener: pose,
      random: this.random,
      now: this.ctx.currentTime,
      lastCallAt: this.lastCallAt,
      radius: 22,
      cooldown: 6,
      night,
    });
    if (!call) return;
    this.lastCallAt.set(call.species, this.ctx.currentTime);
    this.playFauna(call);
  }

  async playFauna(call) {
    const file = this.animalFiles[call.species];
    if (!file) return;
    this.activeFauna++;
    let buffer;
    try { buffer = await this.loadBuffer(file); } catch { this.activeFauna--; return; }
    if (this.paused || this.disposed || !this.ctx) { this.activeFauna--; return; }
    const spec = ANIMAL_SPECIES[call.species];
    const gain = (spec?.category === 'livestock' ? 0.45 : 0.55) * (call.animal?.state === 'flee' ? 1.2 : 1);
    const y = this.groundYAt(call.x, call.z) + (call.y || 0) + 0.45;
    this.playBuffer(buffer, { x: call.x, y, z: call.z, gain, kind: 'fauna' });
  }

  updateAmbience(dt, pose) {
    const now = this.ctx.currentTime;
    for (const channel of this.channels.values()) {
      if (channel.stopAt <= now) {
        try { channel.element.pause(); } catch {}
        channel.stopAt = Infinity;
      }
    }
    this.ambienceTimer -= dt;
    if (this.ambienceTimer > 0 || !this.ready) return;
    this.ambienceTimer = 1.8;
    const city = this.getCity();
    const plan = ambiencePlan({
      listener: pose,
      features: this.collectFeatures(city, pose),
      night: isNightHour(city?.hour),
    });
    const wanted = new Set(plan.map(zone => zone.key));
    for (const zone of plan) {
      const channel = this.ensureChannel(zone.key);
      if (!channel) continue;
      const y = this.groundYAt(zone.x, zone.z) + 0.8;
      setNodePosition(channel.panner, zone.x, y, zone.z);
      channel.gain.gain.setTargetAtTime(zone.gain, now, 0.4);
      channel.stopAt = Infinity;
      if (channel.element.paused) channel.element.play().catch(() => {});
    }
    for (const [key, channel] of this.channels) {
      if (wanted.has(key)) continue;
      channel.gain.gain.setTargetAtTime(0, now, 0.25);
      if (!Number.isFinite(channel.stopAt)) channel.stopAt = now + 0.9;
    }
  }

  ensureChannel(key) {
    const existing = this.channels.get(key);
    if (existing) return existing;
    const url = this.worldFiles[key];
    if (!url || !this.ctx) return null;
    let element;
    try { element = this.mediaFactory(url); } catch { return null; }
    element.loop = true;
    const source = this.ctx.createMediaElementSource(element);
    const panner = this.ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'inverse';
    panner.refDistance = 6;
    panner.maxDistance = 40;
    panner.rolloffFactor = 1;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    source.connect(panner);
    panner.connect(gain);
    gain.connect(this.master);
    const channel = { key, element, source, panner, gain, stopAt: Infinity };
    this.channels.set(key, channel);
    return channel;
  }

  collectFeatures(city, pose) {
    const features = {};
    const world = city?.world;
    if (world?.map && Number.isFinite(world.width) && Number.isFinite(world.height)) {
      const radius = 26;
      let best = null, bestDistance = Infinity;
      const x0 = Math.max(0, Math.floor(pose.x - radius));
      const x1 = Math.min(world.width - 1, Math.ceil(pose.x + radius));
      const z0 = Math.max(0, Math.floor(pose.z - radius));
      const z1 = Math.min(world.height - 1, Math.ceil(pose.z + radius));
      for (let z = z0; z <= z1; z += 2) {
        for (let x = x0; x <= x1; x += 2) {
          if (world.map[z * world.width + x] !== WATER_TILE) continue;
          const distance = Math.hypot(x + 0.5 - pose.x, z + 0.5 - pose.z);
          if (distance < bestDistance) { bestDistance = distance; best = { x: x + 0.5, z: z + 0.5 }; }
        }
      }
      if (best) features.water = best;
    }

    const plants = city?.nature?.plants;
    if (plants?.size) {
      let best = null, bestDistance = Infinity, scanned = 0;
      for (const plant of plants.values()) {
        if (++scanned > 4000) break;
        if (plant.entity?.destroyed) continue;
        const distance = Math.hypot(plant.x - pose.x, plant.y - pose.z);
        if (distance < bestDistance) { bestDistance = distance; best = { x: plant.x, z: plant.y }; }
      }
      if (best) features.plants = best;
    }

    const buildings = city?.buildings;
    if (Array.isArray(buildings)) {
      let nearest = null, nearestDistance = Infinity;
      let market = null, marketDistance = Infinity;
      for (const building of buildings) {
        const entity = building?.entity;
        if (!entity || entity.destroyed) continue;
        const distance = Math.hypot(entity.x - pose.x, entity.y - pose.z);
        if (distance < nearestDistance) { nearestDistance = distance; nearest = { x: entity.x, z: entity.y }; }
        if (MARKET_TYPES.has(building.type) && distance < marketDistance) {
          marketDistance = distance; market = { x: entity.x, z: entity.y };
        }
      }
      if (nearest) features.buildings = nearest;
      if (market) features.market = market;
    }

    const projects = city?.development?.projects;
    if (Array.isArray(projects)) {
      let nearest = null, nearestDistance = Infinity;
      for (const project of projects) {
        if (!project || project.cancelled || project.status !== 'building') continue;
        const position = this.projectPosition(city, project);
        if (!position) continue;
        const distance = Math.hypot(position.x - pose.x, position.z - pose.z);
        if (distance < nearestDistance) { nearestDistance = distance; nearest = position; }
      }
      if (nearest && nearestDistance <= 26) features.construction = nearest;
    }
    return features;
  }

  projectPosition(city, project) {
    if (project.door && Number.isFinite(project.door.x) && Number.isFinite(project.door.y)) {
      return { x: project.door.x, z: project.door.y };
    }
    if (project.buildingId != null) {
      const building = city.building?.(project.buildingId);
      if (building?.entity) return { x: building.entity.x, z: building.entity.y };
    }
    if (project.plotId != null) {
      const plot = city.development?.plots?.find(row => row.id === project.plotId);
      if (plot) return { x: plot.x + plot.width / 2, z: plot.y + plot.depth / 2 };
    }
    return null;
  }

  // Gameplay one-shots: construction starts hammer, a business opening rings
  // the register. Historical events are skipped on the first poll.
  pollCityEvents(pose) {
    const events = this.getCity()?.events;
    if (!Array.isArray(events) || !events.length) return;
    if (this.lastEventId === null) {
      this.lastEventId = events[events.length - 1].id ?? 0;
      this.eventCursor = events.length - 1;
      return;
    }
    const played = [];
    for (let index = events.length - 1; index > this.eventCursor && played.length < 2; index--) {
      const event = events[index];
      if (!event || (event.id ?? 0) <= this.lastEventId) break;
      const position = this.eventPosition(event);
      if (position) played.push({ event, position });
    }
    this.eventCursor = events.length - 1;
    this.lastEventId = events[this.eventCursor].id ?? this.lastEventId;
    for (const { event, position } of played.reverse()) {
      const kind = event.kind || event.data?.kind;
      if (kind === 'construction' || kind === 'service-contracted') {
        this.playWorldOneShot('hammer', position.x, position.z, 0.5);
      } else if (kind === 'business-founded') {
        this.playWorldOneShot('cash_register', position.x, position.z, 0.4);
      }
    }
  }

  eventPosition(event) {
    const data = event.data || event;
    const buildingId = data.buildingId ?? (Array.isArray(data.buildingIds) ? data.buildingIds[0] : null);
    if (buildingId == null) return null;
    const building = this.getCity()?.building?.(buildingId);
    if (!building?.entity || building.entity.destroyed) return null;
    return { x: building.entity.x, z: building.entity.y };
  }

  playWorldOneShot(key, x, z, gain = 0.5) {
    const file = this.worldFiles[key];
    if (!file || this.paused) return;
    const y = this.groundYAt(x, z) + 0.7;
    this.loadBuffer(file)
      .then(buffer => {
        if (this.paused || this.disposed) return;
        this.playBuffer(buffer, { x, y, z, gain, kind: 'world' });
      })
      .catch(() => {});
  }

  async loadBuffer(file) {
    const cached = this.buffers.get(file);
    if (cached) {
      this.buffers.delete(file);
      this.buffers.set(file, cached);
      return cached.buffer;
    }
    const response = await this.fetchImpl(file);
    if (!response.ok) throw new Error(`Som indisponível: ${file}`);
    const bytes = await response.arrayBuffer();
    const buffer = await this.ctx.decodeAudioData(bytes);
    const size = buffer.length * buffer.numberOfChannels * 4;
    this.buffers.set(file, { buffer, size });
    this.bufferBytes += size;
    while (this.bufferBytes > this.maxBufferBytes && this.buffers.size > 1) {
      const [oldestKey, oldest] = this.buffers.entries().next().value;
      if (oldestKey === file) break;
      this.buffers.delete(oldestKey);
      this.bufferBytes -= oldest.size;
    }
    return buffer;
  }

  playBuffer(buffer, { x, y, z, gain = 1, kind = 'world' } = {}) {
    const context = this.ctx;
    if (!context || this.paused) return null;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const level = context.createGain();
    level.gain.value = Math.max(0, Math.min(1, gain));
    let tail = level;
    let panner = null;
    if (Number.isFinite(x) && Number.isFinite(z)) {
      panner = context.createPanner();
      panner.panningModel = 'equalpower';
      panner.distanceModel = 'inverse';
      panner.refDistance = 4;
      panner.maxDistance = 40;
      panner.rolloffFactor = 1.2;
      setNodePosition(panner, x, Number.isFinite(y) ? y : 1, z);
      source.connect(panner);
      panner.connect(level);
    } else {
      source.connect(level);
    }
    tail.connect(this.master);
    const handle = { source, panner, level, kind };
    this.playing.add(handle);
    source.onended = () => {
      this.playing.delete(handle);
      if (kind === 'fauna') this.activeFauna = Math.max(0, this.activeFauna - 1);
      try { level.disconnect(); panner?.disconnect(); } catch {}
    };
    source.start();
    return handle;
  }

  dispose() {
    this.disposed = true;
    this.silenceSources();
    for (const channel of this.channels.values()) {
      try { channel.source.disconnect(); } catch {}
      try { channel.panner.disconnect(); } catch {}
      try { channel.gain.disconnect(); } catch {}
      channel.element.src = '';
    }
    this.channels.clear();
    this.ctx?.close?.();
    this.ctx = null;
  }
}
